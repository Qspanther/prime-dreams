// ⚡ REDIS CACHING CLIENT WITH IN-MEMORY FALLBACK
// Supports Upstash Redis / Render Key-Value with transparent in-process Map fallback
// Cache keys:
//   match:{id}:score       -> TTL 5s
//   match:{id}:leaderboard -> TTL 10s (sorted set / json)
//   match:{id}:contests    -> TTL 30s

const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.KV_URL;
let redisClient = null;
let isRedisActive = false;

// ── In-Memory Map Fallback with TTL ──
const memoryCache = new Map(); // key -> { value, expiresAt }
const memorySortedSets = new Map(); // key -> Array<{ score, member }>

function pruneMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt && entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}
setInterval(pruneMemoryCache, 15000).unref();

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ [Redis] Max connection retries reached. Using in-memory cache fallback.');
          return null; // Stop retrying, use fallback
        }
        return Math.min(times * 1000, 3000);
      },
    });

    redisClient.connect().then(() => {
      isRedisActive = true;
      console.log('⚡ [Redis] Connected successfully to Redis / Upstash / Render KV');
    }).catch((err) => {
      console.warn('⚠️ [Redis] Connection failed, active in-memory cache fallback:', err.message);
      isRedisActive = false;
    });

    redisClient.on('error', (err) => {
      if (isRedisActive) {
        console.warn('⚠️ [Redis] Error, falling back to in-memory cache:', err.message);
      }
      isRedisActive = false;
    });

    redisClient.on('ready', () => {
      isRedisActive = true;
    });
  } catch (err) {
    console.warn('⚠️ [Redis] Initialization failed, using in-memory cache fallback:', err.message);
  }
} else {
  console.log('🧠 [Cache] No REDIS_URL configured. Running ultra-fast in-memory Map cache with TTL.');
}

/**
 * Get cached value (auto-deserialized JSON)
 */
async function get(key) {
  if (isRedisActive && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      // Fallback to memory
    }
  }

  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Set cached value with TTL in seconds
 */
async function set(key, value, ttlSeconds = 30) {
  const serialized = JSON.stringify(value);

  if (isRedisActive && redisClient) {
    try {
      if (ttlSeconds > 0) {
        await redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (err) {
      // Fallback to memory
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
  });
  return true;
}

/**
 * Delete a cache key
 */
async function del(key) {
  if (isRedisActive && redisClient) {
    try {
      await redisClient.del(key);
    } catch (_) {}
  }
  memoryCache.delete(key);
  memorySortedSets.delete(key);
}

/**
 * Sorted Set: ZADD
 */
async function zadd(key, score, member) {
  const memberStr = typeof member === 'string' ? member : JSON.stringify(member);

  if (isRedisActive && redisClient) {
    try {
      await redisClient.zadd(key, score, memberStr);
      return true;
    } catch (_) {}
  }

  // In-memory sorted set fallback
  let set = memorySortedSets.get(key);
  if (!set) {
    set = [];
    memorySortedSets.set(key, set);
  }
  const idx = set.findIndex((entry) => entry.member === memberStr);
  if (idx >= 0) {
    set[idx].score = score;
  } else {
    set.push({ score, member: memberStr });
  }
  set.sort((a, b) => b.score - a.score); // Descending order
  return true;
}

/**
 * Sorted Set: ZREVRANGE
 */
async function zrevrange(key, start = 0, stop = -1, withScores = false) {
  if (isRedisActive && redisClient) {
    try {
      if (withScores) {
        return await redisClient.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await redisClient.zrevrange(key, start, stop);
    } catch (_) {}
  }

  const set = memorySortedSets.get(key) || [];
  const endIdx = stop === -1 ? set.length : stop + 1;
  const slice = set.slice(start, endIdx);

  if (withScores) {
    const result = [];
    slice.forEach((s) => {
      result.push(s.member, String(s.score));
    });
    return result;
  }
  return slice.map((s) => s.member);
}

// ── Canonical Domain Cache Helpers ──

async function getMatchScore(matchId) {
  return await get(`match:${matchId}:score`);
}

async function setMatchScore(matchId, scoreData, ttl = 5) {
  return await set(`match:${matchId}:score`, scoreData, ttl);
}

async function getMatchLeaderboard(matchId) {
  return await get(`match:${matchId}:leaderboard`);
}

async function setMatchLeaderboard(matchId, leaderboardData, ttl = 10) {
  return await set(`match:${matchId}:leaderboard`, leaderboardData, ttl);
}

async function getMatchContests(matchId) {
  return await get(`match:${matchId}:contests`);
}

async function setMatchContests(matchId, contestsData, ttl = 30) {
  return await set(`match:${matchId}:contests`, contestsData, ttl);
}

async function getMatchesList(category = 'all', status = 'all') {
  return await get(`matches:list:${category}:${status}`);
}

async function setMatchesList(category = 'all', status = 'all', data = [], ttl = 8) {
  return await set(`matches:list:${category}:${status}`, data, ttl);
}

async function getMatchDetails(matchId) {
  return await get(`match:${matchId}:details`);
}

async function setMatchDetails(matchId, data, ttl = 10) {
  return await set(`match:${matchId}:details`, data, ttl);
}

async function getContestLeaderboardCache(matchId, contestId, page = 1, limit = 10, search = '') {
  const sKey = search ? `:s:${encodeURIComponent(search)}` : '';
  return await get(`leaderboard:${matchId}:${contestId}:p${page}:l${limit}${sKey}`);
}

async function setContestLeaderboardCache(matchId, contestId, page = 1, limit = 10, search = '', data = null, ttl = 8) {
  const sKey = search ? `:s:${encodeURIComponent(search)}` : '';
  return await set(`leaderboard:${matchId}:${contestId}:p${page}:l${limit}${sKey}`, data, ttl);
}

async function invalidateMatch(matchId) {
  await Promise.all([
    del(`match:${matchId}:score`),
    del(`match:${matchId}:leaderboard`),
    del(`match:${matchId}:contests`),
    del(`match:${matchId}:details`),
  ]);
}

module.exports = {
  get,
  set,
  del,
  zadd,
  zrevrange,
  getMatchesList,
  setMatchesList,
  getMatchDetails,
  setMatchDetails,
  getContestLeaderboardCache,
  setContestLeaderboardCache,
  getMatchScore,
  setMatchScore,
  getMatchLeaderboard,
  setMatchLeaderboard,
  getMatchContests,
  setMatchContests,
  invalidateMatch,
  isRedisActive: () => isRedisActive,
  getRedisClient: () => redisClient,
};
