// 🛡️ PRIME DREEMS — ADMIN DELETED MATCHES REGISTRY & TOMBSTONE STORE
// Guarantees that any match permanently deleted by an administrator
// is NEVER automatically re-discovered, re-created, or re-seeded by
// Cricbuzz background pollers, live feeds, or boot seeders.

const { SystemSetting } = require('../db/models');

const SETTING_KEY = 'admin_deleted_match_tombstones';

// In-memory sets for ultra-low latency (<0.1ms) lookups
const deletedIds = new Set();
const deletedCricbuzzIds = new Set();
const deletedNormalizedKeys = new Set();

let isLoaded = false;
let loadPromise = null;

function normalizeTeam(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\b(women|womens|men|u\d{2})\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function makeKeys(teamA, teamB, teamACode, teamBCode) {
  const normA = normalizeTeam(teamA);
  const normB = normalizeTeam(teamB);
  const normCodeA = normalizeTeam(teamACode);
  const normCodeB = normalizeTeam(teamBCode);

  const keys = [];
  if (normA && normB) {
    keys.push(`${normA}_vs_${normB}`);
    keys.push(`${normB}_vs_${normA}`);
  }
  if (normCodeA && normCodeB) {
    keys.push(`${normCodeA}_vs_${normCodeB}`);
    keys.push(`${normCodeB}_vs_${normCodeA}`);
  }
  return keys;
}

/**
 * Load persisted tombstones from SystemSetting
 */
async function loadDeletedMatches() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const setting = await SystemSetting.findOne({ where: { key: SETTING_KEY } });
      if (setting && setting.value) {
        let records = [];
        try {
          records = JSON.parse(setting.value);
        } catch (_) {
          records = [];
        }

        if (Array.isArray(records)) {
          for (const r of records) {
            if (r.id) deletedIds.add(String(r.id));
            if (r.cricbuzz_id) {
              const cbStr = String(r.cricbuzz_id);
              deletedCricbuzzIds.add(cbStr);
              deletedCricbuzzIds.add(cbStr.replace(/^cb-/, ''));
              deletedCricbuzzIds.add('cb-' + cbStr.replace(/^cb-/, ''));
            }
            if (Array.isArray(r.match_keys)) {
              r.match_keys.forEach(k => deletedNormalizedKeys.add(k));
            }
          }
        }
      }
      isLoaded = true;
    } catch (err) {
      console.warn('⚠️ [DeletedMatchesRegistry] Failed to load tombstones from DB:', err.message);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Register a match as permanently deleted by an admin
 */
async function registerDeletedMatch(matchData = {}) {
  const {
    id,
    cricbuzz_id,
    title,
    team_a,
    team_b,
    team_a_code,
    team_b_code
  } = matchData;

  const strId = id ? String(id) : null;
  const strCbId = cricbuzz_id ? String(cricbuzz_id) : null;
  const keys = makeKeys(team_a, team_b, team_a_code, team_b_code);

  // If title has "X vs Y" and team_a/team_b were not passed, extract them
  if ((!team_a || !team_b) && title) {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length >= 2) {
      const tA = parts[0].split(/[—–-]/)[0].trim();
      const tB = parts[1].split(/[—–-]/)[0].trim();
      makeKeys(tA, tB).forEach(k => keys.push(k));
    }
  }

  // Add to in-memory sets immediately for instant protection
  if (strId) deletedIds.add(strId);
  if (strCbId) {
    deletedCricbuzzIds.add(strCbId);
    deletedCricbuzzIds.add(strCbId.replace(/^cb-/, ''));
    deletedCricbuzzIds.add('cb-' + strCbId.replace(/^cb-/, ''));
  }
  keys.forEach(k => deletedNormalizedKeys.add(k));

  console.log(`🛡️ [DeletedMatchesRegistry] Blacklisted match "${title || strId}": cb_id=${strCbId}, keys=[${keys.join(', ')}]`);

  // Persist to system_settings in background
  try {
    let setting = await SystemSetting.findOne({ where: { key: SETTING_KEY } });
    let records = [];
    if (setting && setting.value) {
      try {
        records = JSON.parse(setting.value) || [];
      } catch (_) {
        records = [];
      }
    }

    const alreadyExists = records.some(r =>
      (strId && r.id === strId) ||
      (strCbId && r.cricbuzz_id === strCbId)
    );

    if (!alreadyExists) {
      records.push({
        id: strId,
        cricbuzz_id: strCbId,
        title: title || `${team_a} vs ${team_b}`,
        team_a,
        team_b,
        match_keys: keys,
        deleted_at: new Date().toISOString(),
      });

      const jsonStr = JSON.stringify(records);
      if (setting) {
        await setting.update({ value: jsonStr });
      } else {
        await SystemSetting.create({
          key: SETTING_KEY,
          value: jsonStr,
          description: 'Permanently deleted matches blacklist (tombstones)',
        });
      }
    }
  } catch (err) {
    console.error('❌ [DeletedMatchesRegistry] Error saving tombstone to system_settings:', err.message);
  }
}

/**
 * Check synchronously if a match has been deleted by an admin
 */
function isMatchBlacklisted(matchOrFeed) {
  if (!matchOrFeed) return false;

  // 1. Direct ID match
  const id = matchOrFeed.id ? String(matchOrFeed.id) : null;
  if (id && deletedIds.has(id)) return true;

  // 2. Cricbuzz ID match
  const cbId = matchOrFeed.cricbuzz_id
    ? String(matchOrFeed.cricbuzz_id)
    : (matchOrFeed.raw_id ? String(matchOrFeed.raw_id) : null);

  if (cbId) {
    if (deletedCricbuzzIds.has(cbId)) return true;
    if (deletedCricbuzzIds.has(cbId.replace(/^cb-/, ''))) return true;
    if (deletedCricbuzzIds.has('cb-' + cbId.replace(/^cb-/, ''))) return true;
  }

  // 3. Team pair and code matches
  const teamA = matchOrFeed.team_a;
  const teamB = matchOrFeed.team_b;
  const teamACode = matchOrFeed.team_a_code;
  const teamBCode = matchOrFeed.team_b_code;

  if (teamA || teamB || teamACode || teamBCode) {
    const keys = makeKeys(teamA, teamB, teamACode, teamBCode);
    for (const k of keys) {
      if (deletedNormalizedKeys.has(k)) return true;
    }
  }

  // 4. Match title parsing check
  if (matchOrFeed.title) {
    const parts = matchOrFeed.title.split(/\s+vs\.?\s+/i);
    if (parts.length >= 2) {
      const tA = parts[0].split(/[—–-]/)[0].trim();
      const tB = parts[1].split(/[—–-]/)[0].trim();
      const titleKeys = makeKeys(tA, tB);
      for (const k of titleKeys) {
        if (deletedNormalizedKeys.has(k)) return true;
      }
    }
  }

  return false;
}

// Auto-trigger load on require
loadDeletedMatches().catch(() => {});

module.exports = {
  loadDeletedMatches,
  registerDeletedMatch,
  isMatchBlacklisted,
  normalizeTeam,
};
