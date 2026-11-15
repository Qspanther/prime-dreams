// 🤖 ISOLATED DATABASE CONNECTION FOR BOT NETWORK
// Uses dedicated pool (max 3 connections) to prevent exhausting Neon Free Tier limits.
// Shares the same Neon database tables with user backend, but has 0 connection contention.

const { Sequelize } = require('sequelize');
const { Pool } = require('pg');

const databaseUrl = process.env.BOT_DATABASE_URL || process.env.DATABASE_URL || '';
const isPostgres = Boolean(
  databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
);

const poolMax = parseInt(process.env.BOT_PG_POOL_MAX || '3', 10);

let sequelize = null;
let pgPool = null;

if (isPostgres) {
  let connectionString = databaseUrl;
  if (!connectionString.includes('sslmode=') && !connectionString.includes('ssl=')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
  }

  // 1. Direct PG Pool for raw queries & health monitoring
  pgPool = new Pool({
    connectionString,
    max: poolMax,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  pgPool.on('error', (err) => {
    console.error('🚨 [Bot DB Pool] Idle client error:', err.message);
  });

  // 2. Sequelize for Bot Models
  sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: false, rejectUnauthorized: false } },
    logging: false,
    pool: {
      max: poolMax,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: { timestamps: true, underscored: true },
  });

  console.log(`🤖 [Bot Service] Isolated Neon Pool initialized (Max ${poolMax} connections, min: 0).`);
} else {
  // Local SQLite fallback for offline development
  const path = require('path');
  const sqliteFile = path.resolve(__dirname, '../primedreems.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqliteFile,
    logging: false,
  });
  console.log('🤖 [Bot Service] SQLite fallback active for local development.');
}

/**
 * Check active connection count on Neon server to prevent over-subscription
 * If Neon active connections > 60, bot scheduler will skip the current tick.
 */
async function getNeonActiveConnections() {
  if (!pgPool) return 0;
  try {
    const res = await pgPool.query('SELECT count(*)::int as count FROM pg_stat_activity WHERE state IS NOT NULL;');
    return res.rows[0]?.count || 0;
  } catch (err) {
    return 0; // Best effort
  }
}

module.exports = {
  sequelize,
  pgPool,
  getNeonActiveConnections,
  isPostgres: () => isPostgres,
};
