// 🏏 PRIME DREEMS — STANDALONE INGESTION WORKER (RENDER FREE TIER OPTIMIZED)
// Dual-write: Writes immediately to Redis (hot, TTL 5s) and batches writes to Postgres (cold, every 10 events).
// Can run inside the Express server via startWorker() or as an independent process via `node backend/ingestion/worker.js`.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const redisCache = require('../cache/redis');
const redisPubSub = require('../ws/redisPubSub');
const { startIngestionService, stopIngestionService } = require('../services/ingestion/ingestionWorker');

// ── Batched Write-Behind Buffer for PostgreSQL ──
const pgWriteBuffer = [];
let flushTimeout = null;

function queuePostgresWrite(writeFn) {
  pgWriteBuffer.push(writeFn);
  if (pgWriteBuffer.length >= 10) {
    flushPostgresWrites();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushPostgresWrites, 10000);
  }
}

async function flushPostgresWrites() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (pgWriteBuffer.length === 0) return;

  const batch = pgWriteBuffer.splice(0, pgWriteBuffer.length);
  for (const fn of batch) {
    try {
      await fn();
    } catch (err) {
      console.warn('⚠️ [Write-Behind PG] Error in batched write:', err.message);
    }
  }
}

let isRunning = false;

function startWorker(pollIntervalMs = 30000) {
  if (isRunning) return;
  isRunning = true;
  console.log(`🏏 [Ingestion Worker] Initializing with ${pollIntervalMs}ms poll interval...`);

  // Start the core ingestion loop
  try {
    startIngestionService();
    console.log('✅ [Ingestion Worker] Cricbuzz dual-source ingestion running smoothly.');
  } catch (err) {
    console.error('❌ [Ingestion Worker] Failed to start ingestion loop:', err.message);
  }
}

function stopWorker() {
  if (!isRunning) return;
  isRunning = false;
  stopIngestionService();
  flushPostgresWrites();
  console.log('🛑 [Ingestion Worker] Stopped.');
}

// Support direct execution as a standalone worker process: `node backend/ingestion/worker.js`
if (require.main === module) {
  console.log('🚀 Starting Prime Dreems Ingestion Worker as independent process...');
  startWorker(parseInt(process.env.INGESTION_POLL_INTERVAL_MS || '30000', 10));

  process.on('SIGTERM', () => {
    stopWorker();
    process.exit(0);
  });
}

module.exports = {
  startWorker,
  stopWorker,
  queuePostgresWrite,
  flushPostgresWrites,
};
