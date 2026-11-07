// ─── Turso Cloud SQLite Sync Service ───
// Connects Prime Dreems to https://app.turso.tech/ via libSQL.
// Prevents data loss on Render ephemeral disk redeploys by continuously syncing
// the local SQLite state with your permanent Turso Cloud Database!

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const DEFAULT_TURSO_URL = 'libsql://creator11-db-qspanther.aws-ap-south-1.turso.io';
const DEFAULT_TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM1NDI0ODAsImlkIjoiMDFhMTk3NzQtYzMwMS03YWQ5LTg1MTgtMTI0Y2UxYzkxNjQwIiwia2lkIjoiM0ZnTmVpWFdZRjRMTE54TUFZV0NBSEVHTjMyQlpOamhYZ2xlVGdmUy14TSIsInJpZCI6IjgwMjc3OWY3LTU4ZGYtNGI2MS1hNzc3LWJlMTAwYThhMTA0YiJ9.Dk06EQOzT_fMJ6A57OEVEEEkYtSKg0qAOZcM7bAc8CjbiK2MzDydMTygDV8YxjYsKNiMBdmC4PMIQmjZMj2dCw';

let tursoClient = null;

function isTursoConfigured() {
  // If native Cloud PostgreSQL (DATABASE_URL) is active, skip Turso completely
  if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))) {
    return false;
  }
  const url = process.env.TURSO_DATABASE_URL || DEFAULT_TURSO_URL;
  const token = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN || DEFAULT_TURSO_TOKEN;
  return Boolean(url && token);
}

function getTursoClient() {
  if (tursoClient) return tursoClient;
  if (!isTursoConfigured()) return null;

  const url = process.env.TURSO_DATABASE_URL || DEFAULT_TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN || DEFAULT_TURSO_TOKEN;

  tursoClient = createClient({
    url,
    authToken,
  });

  return tursoClient;
}

const SYNC_TABLES = [
  'users',
  'wallets',
  'transactions',
  'cricket_matches',
  'cricket_players',
  'match_contests',
  'cricket_teams',
  'cricket_team_players',
  'h2h_challenges',
  'notifications',
  'system_settings',
  'referral_logs',
  'share_logs'
];

/**
 * Bootstrap on boot:
 * If Render restarted with a fresh/empty container and Turso has data,
 * pulls and seeds latest data from Turso Cloud into local SQLite.
 */
async function pullFromTurso() {
  if (!isTursoConfigured()) return { success: false, reason: 'Turso not configured' };
  const client = getTursoClient();
  if (!client) return { success: false, reason: 'Turso client unavailable' };

  const sequelize = require('../db/index');
  console.log('📥 [TursoSync] Pulling latest data from Turso Cloud to local SQLite...');

  let pulledCount = 0;
  for (const table of SYNC_TABLES) {
    try {
      const cloudRes = await client.execute(`SELECT * FROM ${table};`);
      if (!cloudRes || !cloudRes.rows || cloudRes.rows.length === 0) continue;

      const rows = cloudRes.rows;
      const columns = cloudRes.columns;

      await sequelize.query('PRAGMA foreign_keys = OFF;');
      
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const placeholders = columns.map(() => '?').join(', ');
        const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`;

        await sequelize.query('BEGIN TRANSACTION;');
        for (const row of chunk) {
          const values = columns.map(c => row[c]);
          await sequelize.query(insertSql, { replacements: values });
        }
        await sequelize.query('COMMIT;');
      }
      pulledCount += rows.length;
      console.log(`   ⬇️ Restored ${rows.length} rows for "${table}" from Turso Cloud.`);
    } catch (err) {
      // Table might not exist or be empty, continue
    }
  }

  await sequelize.query('PRAGMA foreign_keys = ON;').catch(() => {});
  console.log(`✅ [TursoSync] Bootstrap complete: ${pulledCount} total records restored from Turso Cloud!`);
  return { success: true, pulledCount };
}

/**
 * Pushes specific local SQLite tables to Turso Cloud
 */
async function syncTablesToTurso(tables = SYNC_TABLES) {
  if (!isTursoConfigured()) return { success: false, reason: 'Turso not configured' };
  const client = getTursoClient();
  if (!client) return { success: false, reason: 'Turso client unavailable' };

  const sequelize = require('../db/index');

  try {
    await client.execute('PRAGMA foreign_keys = OFF;');
    let syncedCount = 0;

    for (const table of tables) {
      try {
        const [rows] = await sequelize.query(`SELECT * FROM ${table};`);
        if (!rows || rows.length === 0) continue;

        // Ensure table exists on Turso by getting schema
        const [schema] = await sequelize.query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';`);
        if (schema && schema[0] && schema[0].sql) {
          await client.execute(schema[0].sql).catch(() => {});
        }

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`;

        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const stmts = chunk.map(row => ({
            sql: insertSql,
            args: columns.map(c => row[c] !== undefined ? row[c] : null)
          }));
          await client.batch(stmts, 'write');
        }
        syncedCount += rows.length;
      } catch (tErr) {
        // Continue with other tables
      }
    }
    await client.execute('PRAGMA foreign_keys = ON;').catch(() => {});
    return { success: true, syncedCount };
  } catch (err) {
    if (err.message && (err.message.includes('blocked') || err.message.includes('quota'))) {
      console.warn('⚠️ [TursoSync] Turso write quota reached. Changes safely preserved in primary database.');
    } else {
      console.error('⚠️ [TursoSync] Push error:', err.message);
    }
    return { success: false, error: err.message };
  }
}

/**
 * Pushes all critical tables to Turso Cloud
 */
async function syncToTurso() {
  const result = await syncTablesToTurso(SYNC_TABLES);
  if (result.success) {
    console.log(`☁️ [TursoSync] Pushed ${result.syncedCount} records to Turso Cloud successfully.`);
  }
  return result;
}

// ─── Real-Time Debounced Sync on User Request ─────────────────────────────
let instantSyncDebounce = null;
const pendingTables = new Set();

/**
 * Call this on any important mutation (signup, team create, deposit, etc.)
 * Syncs the changed tables to Turso Cloud within 800ms!
 */
function triggerInstantSync(tables = []) {
  if (!isTursoConfigured()) return;

  if (Array.isArray(tables)) {
    tables.forEach(t => pendingTables.add(t));
  } else if (typeof tables === 'string') {
    pendingTables.add(tables);
  }

  if (instantSyncDebounce) return;
  instantSyncDebounce = setTimeout(async () => {
    instantSyncDebounce = null;
    const targetTables = pendingTables.size > 0 ? Array.from(pendingTables) : SYNC_TABLES;
    pendingTables.clear();
    try {
      const res = await syncTablesToTurso(targetTables);
      if (res.success && res.syncedCount > 0) {
        console.log(`⚡ [TursoSync:Instant] Real-time synced ${res.syncedCount} rows (${targetTables.join(', ')}) to Turso Cloud!`);
      }
    } catch (err) {
      console.warn('⚠️ [TursoSync:Instant] Sync notice:', err.message);
    }
  }, 800);
}

/**
 * Initialize sync service:
 * Checks connection, bootstraps data if local database is empty,
 * and sets up recurring sync.
 */
async function initTursoSync() {
  if (!isTursoConfigured()) {
    console.log('ℹ️ Turso Cloud not configured. Running standard local SQLite engine.');
    return { enabled: false };
  }

  try {
    const client = getTursoClient();
    console.log(`🌐 [TursoSync] Connecting to Turso Cloud at ${process.env.TURSO_DATABASE_URL}...`);

    // Verify connectivity
    const ping = await client.execute('SELECT 1 as alive;');
    if (ping.rows.length > 0) {
      console.log('✅ [TursoSync] Connected to Turso Cloud successfully!');
    }

    // Check if local DB is empty (e.g. freshly deployed container on Render)
    const sequelize = require('../db/index');
    let localUsers = 0;
    try {
      const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users;');
      localUsers = userCount[0]?.count || 0;
    } catch (e) {
      localUsers = 0;
    }

    if (localUsers === 0) {
      console.log('⚠️ [TursoSync] Local database is empty! Initiating automatic restore from Turso Cloud...');
      await pullFromTurso();
    } else {
      console.log(`📊 [TursoSync] Local database contains ${localUsers} users. Live sync active.`);
    }

    // Periodic sync: disabled aggressive 3-minute full dump to prevent burning Turso write quota.
    // Instead, real-time triggerInstantSync handles live user changes efficiently.
    console.log('⚡ [TursoSync] Efficient event-driven sync engine active.');

    return { enabled: true, connected: true };
  } catch (error) {
    console.error('⚠️ [TursoSync] Connection error:', error.message);
    return { enabled: true, connected: false, error: error.message };
  }
}

module.exports = {
  isTursoConfigured,
  getTursoClient,
  initTursoSync,
  syncToTurso,
  syncTablesToTurso,
  pullFromTurso,
  triggerInstantSync,
};
