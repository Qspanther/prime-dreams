// 🐘 NEON POSTGRESQL CONNECTION POOL (FREE TIER OPTIMIZED)
// Limits active connections to 5-8 to strictly respect Neon Free Tier (Max 100 total pooled)
// Idle connections close quickly to allow Neon autosuspend when inactive.

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || '';
const isPgConfigured = Boolean(
  databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
);

const maxConnections = parseInt(process.env.PG_POOL_MAX || '5', 10);

let pool = null;

if (isPgConfigured) {
  // Ensure connection string options for Neon pgbouncer pooled access
  let connectionString = databaseUrl;
  if (!connectionString.includes('sslmode=') && !connectionString.includes('ssl=')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
  }

  pool = new Pool({
    connectionString,
    max: maxConnections,
    min: 0, // Allows pool to shrink to 0 so Neon can autosuspend after 5 min idle
    idleTimeoutMillis: 10000, // Close idle connections after 10s
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  pool.on('error', (err) => {
    console.error('🚨 [PG Pool] Unexpected error on idle client:', err.message);
  });

  pool.on('connect', () => {
    // optional debug trace
  });
}

/**
 * Execute parameterized query with automatic client acquire & release
 * @param {string} text - Parameterized SQL string ($1, $2, ...)
 * @param {Array} params - Array of parameter values
 */
async function query(text, params = []) {
  if (!pool) {
    throw new Error('PostgreSQL Pool is not initialized. Ensure DATABASE_URL is set.');
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log(`[SQL] ${duration}ms: ${text.slice(0, 100)}`);
    }
    return res;
  } catch (err) {
    console.error(`[SQL Error] ${err.message} in query: ${text.slice(0, 120)}`);
    throw err;
  }
}

/**
 * Get dedicated client for multi-statement transactions
 */
async function getClient() {
  if (!pool) {
    throw new Error('PostgreSQL Pool is not initialized. Ensure DATABASE_URL is set.');
  }
  return await pool.connect();
}

/**
 * Quick health check for Render /health endpoint
 */
async function healthCheck() {
  if (!pool) return { status: 'not_configured' };
  try {
    const res = await query('SELECT 1 AS alive;');
    return { status: 'healthy', alive: res.rows?.[0]?.alive === 1 };
  } catch (err) {
    return { status: 'unhealthy', error: err.message };
  }
}

module.exports = {
  pool,
  query,
  getClient,
  healthCheck,
  isConfigured: () => Boolean(pool),
};
