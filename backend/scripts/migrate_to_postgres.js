// ─── Creator11 SQLite to PostgreSQL Full Migration Script ───
const sqlite3 = require('sqlite3').verbose();
const { Sequelize } = require('sequelize');
const path = require('path');

const sqlitePath = path.resolve(__dirname, '../creator11.sqlite');
const postgresUrl = process.env.DATABASE_URL;
if (!postgresUrl) throw new Error('Set DATABASE_URL before migrating.');

console.log('🚀 Starting SQLite -> Render Cloud PostgreSQL migration...');
console.log('📂 Source SQLite:', sqlitePath);
console.log('🐘 Target PostgreSQL: creator11_db on Render');

const pg = new Sequelize(postgresUrl, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
});

const sqlite = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY);

function getSqliteRows(query) {
  return new Promise((resolve, reject) => {
    sqlite.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function bulkInsertTable(tableName, rows, batchSize = 1000) {
  if (!rows || rows.length === 0) {
    console.log(`⏩ Table [${tableName}] has 0 rows. Skipping.`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map(c => `"${c}"`).join(', ');

  console.log(`📦 Migrating [${tableName}]: ${rows.length} rows (batch size: ${batchSize})...`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuePlaceholders = [];
    const replacements = [];

    batch.forEach((row) => {
      const placeholders = columns.map((col) => {
        replacements.push(row[col]);
        return `$${replacements.length}`;
      });
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
    });

    const sql = `
      INSERT INTO "${tableName}" (${quotedColumns})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT DO NOTHING;
    `;

    await pg.query(sql, { bind: replacements });
    process.stdout.write(`  ⏳ Inserted ${Math.min(i + batchSize, rows.length)}/${rows.length} rows...\r`);
  }

  console.log(`\n✅ [${tableName}] Migrated all ${rows.length} rows successfully!`);
}

async function run() {
  try {
    await pg.authenticate();
    console.log('🔌 Connected to Render PostgreSQL!');

    console.log('🧹 Truncating existing tables for clean full import...');
    await pg.query(`
      TRUNCATE TABLE 
        system_settings, creators, tournaments, users, wallets, 
        transactions, teams, team_creators, creator_stats_snapshots, 
        scores, leaderboard, notifications, referral_logs, share_logs, 
        contests, contest_participants, bot_win_history, user_streaks 
      CASCADE;
    `);
    console.log('✨ All tables truncated cleanly!');
    console.log('📦 Starting sequential table migration...\n');

    // 1. System Settings (19 rows)
    const settings = await getSqliteRows('SELECT * FROM system_settings');
    await bulkInsertTable('system_settings', settings);

    // 2. Creators (All 50 real creators)
    const creators = await getSqliteRows('SELECT * FROM creators');
    await bulkInsertTable('creators', creators);

    // 3. Tournaments
    const tournaments = await getSqliteRows('SELECT * FROM tournaments');
    const formattedTournaments = tournaments.map(t => ({
      ...t,
      rankings_finalized: Boolean(t.rankings_finalized),
    }));
    await bulkInsertTable('tournaments', formattedTournaments);

    // 4. Users (14 Real users + 1100 Bots = 1114 total) with referral code collision protection
    const users = await getSqliteRows('SELECT * FROM users');
    const seenCodes = new Set();
    const formattedUsers = users.map(u => {
      let code = u.referral_code;
      if (code) {
        if (seenCodes.has(code)) {
          const newCode = `${code.slice(0, 4)}${Math.floor(1000 + Math.random() * 8999)}`;
          console.log(`🔄 Deduplicated referral code for user ${u.name} (${u.email}): ${code} -> ${newCode}`);
          code = newCode;
        }
        seenCodes.add(code);
      }
      return {
        ...u,
        referral_code: code,
        is_bot: Boolean(u.is_bot),
        otp_verified: Boolean(u.otp_verified),
      };
    });
    await bulkInsertTable('users', formattedUsers, 300);

    // 5. Wallets (1113 rows)
    const wallets = await getSqliteRows('SELECT * FROM wallets');
    await bulkInsertTable('wallets', wallets, 500);

    // 6. Transactions (917 rows)
    const txs = await getSqliteRows('SELECT * FROM transactions');
    await bulkInsertTable('transactions', txs, 500);

    // 7. Teams (2007 rows)
    const teams = await getSqliteRows('SELECT * FROM teams');
    const formattedTeams = teams.map(t => ({
      ...t,
      is_locked: Boolean(t.is_locked),
    }));
    await bulkInsertTable('teams', formattedTeams, 500);

    // 8. Team Creators (22,077 rows)
    const teamCreators = await getSqliteRows('SELECT * FROM team_creators');
    await bulkInsertTable('team_creators', teamCreators, 1000);

    // 9. Creator Stats Snapshots (valid tournament & creator FKs)
    const snapshots = await getSqliteRows(`
      SELECT * FROM creator_stats_snapshots 
      WHERE tournament_id IN (SELECT id FROM tournaments) 
        AND creator_id IN (SELECT id FROM creators)
    `);
    await bulkInsertTable('creator_stats_snapshots', snapshots, 500);

    // 10. Scores (22,077 rows)
    const scores = await getSqliteRows('SELECT * FROM scores');
    await bulkInsertTable('scores', scores, 1000);

    // 11. Leaderboard (2007 rows)
    const leaderboard = await getSqliteRows('SELECT * FROM leaderboard');
    await bulkInsertTable('leaderboard', leaderboard, 500);

    // 12. Notifications (valid user FKs)
    const notifications = await getSqliteRows(`
      SELECT * FROM notifications 
      WHERE user_id IN (SELECT id FROM users)
    `);
    await bulkInsertTable('notifications', notifications, 500);

    // 13. Referral Logs (2 rows)
    const referralLogs = await getSqliteRows('SELECT * FROM referral_logs');
    await bulkInsertTable('referral_logs', referralLogs);

    // 14. Share Logs (1 row)
    const shareLogs = await getSqliteRows('SELECT * FROM share_logs');
    await bulkInsertTable('share_logs', shareLogs);

    console.log('\n🎉 ALL DATA MIGRATED TO CLOUD POSTGRESQL SUCCESSFULLY!');

    // Verification summary
    console.log('\n📊 Target Cloud PostgreSQL Verification:');
    const tablesToVerify = [
      'users', 'wallets', 'transactions', 'creators', 'tournaments', 
      'teams', 'team_creators', 'scores', 'leaderboard', 
      'system_settings', 'creator_stats_snapshots', 'notifications',
      'referral_logs', 'share_logs'
    ];
    for (const t of tablesToVerify) {
      const [[res]] = await pg.query(`SELECT count(*) as count FROM "${t}"`);
      console.log(`  ${t.padEnd(25)}: ${res.count} rows`);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    sqlite.close();
    await pg.close();
  }
}

run();
