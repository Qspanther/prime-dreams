// 📡 REDIS PUB/SUB ADAPTER FOR WEBSOCKET GATEWAY
// Enables decoupled ingestion publishing and gateway distribution.
// Falls back to in-process EventEmitter when Redis is not available.

const EventEmitter = require('events');
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.KV_URL;
const localBus = new EventEmitter();

let pubClient = null;
let subClient = null;
let isPubSubActive = false;

if (redisUrl) {
  try {
    pubClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    subClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      isPubSubActive = true;
      console.log('📡 [WS PubSub] Connected to Redis Pub/Sub channel network.');

      // Pattern subscribe to all match delta channels: match:*:delta
      subClient.psubscribe('match:*:delta', (err) => {
        if (err) console.warn('⚠️ [WS PubSub] psubscribe error:', err.message);
      });

      subClient.on('pmessage', (_pattern, channel, message) => {
        try {
          // Channel format: match:{matchId}:delta
          const parts = channel.split(':');
          const matchId = parts[1];
          const payload = JSON.parse(message);
          localBus.emit('delta', { matchId, payload });
        } catch (parseErr) {
          console.warn('⚠️ [WS PubSub] Message parse error:', parseErr.message);
        }
      });
    }).catch((err) => {
      console.warn('⚠️ [WS PubSub] Redis connection failed, using local event bus:', err.message);
      isPubSubActive = false;
    });

    pubClient.on('error', () => { isPubSubActive = false; });
    subClient.on('error', () => { isPubSubActive = false; });
  } catch (err) {
    console.warn('⚠️ [WS PubSub] Setup exception, falling back to local bus:', err.message);
  }
} else {
  console.log('📡 [WS PubSub] Running in single-instance mode (Local event bus active).');
}

/**
 * Publish delta event to match channel
 * @param {string} matchId
 * @param {object} deltaPayload
 */
async function publishDelta(matchId, deltaPayload) {
  const channel = `match:${matchId}:delta`;
  const serialized = JSON.stringify(deltaPayload);

  // Always emit to local bus for immediate zero-latency single-instance dispatch
  localBus.emit('delta', { matchId, payload: deltaPayload });

  if (isPubSubActive && pubClient) {
    try {
      await pubClient.publish(channel, serialized);
    } catch (pubErr) {
      // Best-effort publish
    }
  }
}

/**
 * Subscribe gateway to delta events
 * @param {function({ matchId, payload })} callback
 */
function onDelta(callback) {
  localBus.on('delta', callback);
}

module.exports = {
  publishDelta,
  onDelta,
  isPubSubActive: () => isPubSubActive,
};
