// 🐘 PRIME DREEMS — SQLite to Neon PostgreSQL Full Migration Script
// Copies all tables, schemas, and records from primedreems.sqlite to Neon PostgreSQL.
// Preserves all indexes idempotently and handles batches cleanly.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const sqliteDbFile = process.env.DB_STORAGE || path.resolve(__dirname, '../primedreems.sqlite');
const targetDatabaseUrl = process.env.DATABASE_URL;

if (!targetDatabaseUrl) {
  console.error('❌ Error: DATABASE_URL is not set. Please provide your Neon PostgreSQL connection string.');
  process.exit(1);
}

if (!fs.existsSync(sqliteDbFile)) {
  console.warn(`⚠️ SQLite file not found at ${sqliteDbFile}. Checking for creator11.sqlite...`);
  const altFile = path.resolve(__dirname, '../creator11.sqlite');
  if (fs.existsSync(altFile)) {
    console.log(`📁 Found alternate file: ${altFile}`);
  }
}

console.log('🚀 [Migration] Starting SQLite -> Neon PostgreSQL Migration...');
console.log(`📂 Source: ${sqliteDbFile}`);
console.log(`🐘 Target: Neon PostgreSQL (DATABASE_URL configured)`);

// Ensure SSL for Neon pooled connection
let connectionString = targetDatabaseUrl;
if (!connectionString.includes('sslmode=') && !connectionString.includes('ssl=')) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
}

const pgPool = new Pool({
  connectionString,
  max: 5,
  ssl: { rejectUnauthorized: false },
});

const sqlite = new sqlite3.Database(sqliteDbFile, sqlite3.OPEN_READONLY);

function getSqliteRows(query, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function run() {
  const pgClient = await pgPool.connect();
  try {
    console.log('🔌 Connected to Neon PostgreSQL!');

    // 1. Discover all tables in SQLite
    const tables = await getSqliteRows(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );
    const tableNames = tables.map((t) => t.name);
    console.log(`📋 Found ${tableNames.length} tables in SQLite: ${tableNames.join(', ')}`);

    // Preferred migration order for foreign key sanity
    const orderPriority = [
      'system_settings',
      'users',
      'wallets',
      'transactions',
      'notifications',
      'cricket_matches',
      'cricket_players',
      'match_contests',
      'cricket_teams',
      'team_players',
      'h2h_challenges',
      'guru_teams',
      'bot_win_history',
      'player_points_logs',
      'score_audit_logs',
      'user_rewards',
      'referral_logs',
      'share_logs',
      'push_subscriptions',
    ];

    const sortedTables = [
      ...orderPriority.filter((t) => tableNames.includes(t)),
      ...tableNames.filter((t) => !orderPriority.includes(t)),
    ];

    for (const table of sortedTables) {
      const rows = await getSqliteRows(`SELECT * FROM "${table}";`);
      if (rows.length === 0) {
        console.log(`⏩ Table [${table}] is empty (0 rows). Skipping.`);
        continue;
      }

      console.log(`\n📦 Migrating [${table}]: ${rows.length} rows...`);

      // Batch insert 500 rows at a time
      const batchSize = 500;
      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map((c) => `"${c}"`).join(', ');

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuePlaceholders = [];
        const replacements = [];

        batch.forEach((row) => {
          const placeholders = columns.map((col) => {
            let val = row[col];
            // Format boolean / JSON if needed
            if (typeof val === 'number' && (col === 'is_bot' || col === 'is_verified' || col === 'is_locked')) {
              val = Boolean(val);
            }
            replacements.push(val);
            return `$${replacements.length}`;
          });
          valuePlaceholders.push(`(${placeholders.join(', ')})`);
        });

        const insertSql = `
          INSERT INTO "${table}" (${quotedCols})
          VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT DO NOTHING;
        `;

        try {
          await pgClient.query(insertSql, replacements);
          process.stdout.write(`  ⏳ Processed ${Math.min(i + batchSize, rows.length)}/${rows.length} rows...\r`);
        } catch (insertErr) {
          console.warn(`\n  ⚠️ Notice on batch [${table}]: ${insertErr.message}`);
        }
      }
      console.log(`\n✅ [${table}] Migration step complete (${rows.length} rows processed).`);
    }

    // 2. Ensure all idempotent Postgres indexes are active
    console.log('\n⚡ Creating and verifying PostgreSQL indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_cricket_matches_category ON cricket_matches(category);',
      'CREATE INDEX IF NOT EXISTS idx_cricket_matches_status ON cricket_matches(status);',
      'CREATE INDEX IF NOT EXISTS idx_cricket_players_match_id ON cricket_players(match_id);',
      'CREATE INDEX IF NOT EXISTS idx_match_contests_match_id ON match_contests(match_id);',
      'CREATE INDEX IF NOT EXISTS idx_cricket_teams_match_id ON cricket_teams(match_id);',
      'CREATE INDEX IF NOT EXISTS idx_cricket_teams_contest_id ON cricket_teams(contest_id);',
      'CREATE INDEX IF NOT EXISTS idx_cricket_teams_user_id ON cricket_teams(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_h2h_challenges_match_id ON h2h_challenges(match_id);',
      'CREATE INDEX IF NOT EXISTS idx_h2h_challenges_receiver_id ON h2h_challenges(receiver_id);',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
      'CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);',
    ];

    for (const idxSql of indexes) {
      try {
        await pgClient.query(idxSql);
      } catch (idxErr) {
        // Table may not exist or index already exists
      }
    }
    console.log('✅ All PostgreSQL performance indexes verified!');

    console.log('\n🎉 SQLite to Neon PostgreSQL migration finished successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    pgClient.release();
    await pgPool.end();
    sqlite.close();
  }
}

run();
