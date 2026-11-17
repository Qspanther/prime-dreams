const { Sequelize } = require('sequelize');
const { spawnSync } = require('child_process');
const config = require('../config');

let sequelize;

function probePostgresConnection(databaseUrl) {
  try {
    const probeScript = "const { Client } = require('pg'); const client = new Client({ connectionString: process.env._PROBE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3500 }); client.connect(err => { if (err) { console.error(err.message); process.exit(1); } client.query('SELECT 1', (qErr) => { client.end(); process.exit(qErr ? 1 : 0); }); });";
    const res = spawnSync(process.execPath, ['-e', probeScript], {
      env: { ...process.env, _PROBE_URL: databaseUrl },
      timeout: 4500,
      encoding: 'utf-8',
    });
    if (res.status === 0) {
      return { ok: true };
    }
    const errText = (res.stderr || res.stdout || '').trim();
    return { ok: false, error: errText || 'Connection failed or timed out' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const hasPostgresUrl = Boolean(process.env.DATABASE_URL && 
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://')));

let isPostgres = false;

if (hasPostgresUrl) {
  const check = probePostgresConnection(process.env.DATABASE_URL);
  if (check.ok) {
    isPostgres = true;
  } else {
    console.warn(`⚠️ [DB Fallback] Cloud PostgreSQL is unavailable or quota exceeded: ${check.error}`);
    console.warn(`⚡ [DB Fallback] Automatically falling back to resilient local SQLite database to prevent 500 errors.`);
  }
}

if (isPostgres) {
  const sslConfig = process.env.DB_SSL === 'false'
    ? false
    : { require: false, rejectUnauthorized: false };

  const poolMax = parseInt(process.env.PG_POOL_MAX || '5', 10);
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: sslConfig ? { ssl: sslConfig } : {},
    logging: false,
    pool: { max: poolMax, min: 0, acquire: 30000, idle: 10000 },
    define: { timestamps: true, underscored: true },
  });
  console.log(`🐘 Cloud PostgreSQL engine active via DATABASE_URL (Pool max: ${poolMax}, min: 0 for Neon free autosuspend)`);
} else {
  sequelize = new Sequelize({
    dialect: config.DB_DIALECT,
    storage: config.DB_STORAGE,
    logging: false,
    dialectOptions: {
      busyTimeout: 30000,
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    retry: {
      max: 5,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  });
  console.log('⚡ Ultra high-performance SQLite engine active (primedreems.sqlite).');
}

// Configure WAL mode, synchronous, memory cache, and high-performance indexes (SQLite only)
sequelize.authenticate().then(async () => {
  if (isPostgres) {
    console.log('🐘 Cloud PostgreSQL authenticated & ready.');
    try {
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_matches_category ON cricket_matches(category);').catch(() => {});
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_matches_status ON cricket_matches(status);').catch(() => {});
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_players_match_id ON cricket_players(match_id);').catch(() => {});
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_match_contests_match_id ON match_contests(match_id);').catch(() => {});
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_teams_match_id ON cricket_teams(match_id);').catch(() => {});
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_teams_user_id ON cricket_teams(user_id);').catch(() => {});
      await sequelize.query('ALTER TABLE match_contests ADD COLUMN IF NOT EXISTS bot_spots INTEGER DEFAULT 0;').catch(() => {});
      await sequelize.query('ALTER TABLE cricket_teams ADD COLUMN IF NOT EXISTS phase INTEGER DEFAULT 1;').catch(() => {});
      await sequelize.query('ALTER TABLE bot_win_history ADD COLUMN IF NOT EXISTS phase INTEGER DEFAULT 1;').catch(() => {});
      await sequelize.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255);').catch(() => {});
      await sequelize.query('ALTER TABLE match_contests ADD COLUMN IF NOT EXISTS prize_breakup TEXT;').catch(() => {});
      await sequelize.query('ALTER TABLE match_contests ADD COLUMN IF NOT EXISTS contest_code INTEGER;').catch(() => {});
      await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_match_contests_contest_code ON match_contests(contest_code);').catch(() => {});
      await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan_id VARCHAR(50);').catch(() => {});
      await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_max_teams INTEGER DEFAULT 2;').catch(() => {});
      await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_pass_valid_until TIMESTAMP WITH TIME ZONE;').catch(() => {});
      await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_pass_max_teams INTEGER DEFAULT 1;').catch(() => {});
      await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_pass_claimed_at TIMESTAMP WITH TIME ZONE;').catch(() => {});

      try {
        const [contestsWithoutCode] = await sequelize.query('SELECT id FROM match_contests WHERE contest_code IS NULL ORDER BY created_at ASC;');
        if (contestsWithoutCode && contestsWithoutCode.length > 0) {
          const [maxCodeRow] = await sequelize.query('SELECT MAX(contest_code) as max_code FROM match_contests;');
          let nextCode = (maxCodeRow[0]?.max_code ? parseInt(maxCodeRow[0].max_code, 10) : 2010) + 1;
          for (const c of contestsWithoutCode) {
            await sequelize.query('UPDATE match_contests SET contest_code = :code WHERE id = :id;', {
              replacements: { code: nextCode++, id: c.id }
            });
          }
          console.log(`🔢 Backfilled ${contestsWithoutCode.length} contests with unique numeric Contest IDs.`);
        }
      } catch (_) {}
      console.log('🐘 Cloud PostgreSQL schema verified & indexes active.');
    } catch (pgErr) {
      console.warn('PostgreSQL initialization notice:', pgErr.message);
    }
    return;
  }
  try {
    await sequelize.query('PRAGMA journal_mode = WAL;');
    await sequelize.query('PRAGMA synchronous = NORMAL;');
    await sequelize.query('PRAGMA busy_timeout = 30000;');
    await sequelize.query('PRAGMA cache_size = -64000;'); // 64MB memory page cache
    await sequelize.query('PRAGMA temp_store = MEMORY;');
    await sequelize.query('PRAGMA mmap_size = 268435456;'); // 256MB memory-mapped I/O
    await sequelize.query('PRAGMA wal_autocheckpoint = 1000;'); // Auto-checkpoint every 1000 pages (~4MB)

    // Essential high-speed compound and foreign key indexes for Cricket
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_matches_category ON cricket_matches(category);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_matches_status ON cricket_matches(status);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_players_match_id ON cricket_players(match_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_match_contests_match_id ON match_contests(match_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_teams_match_id ON cricket_teams(match_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_cricket_teams_user_id ON cricket_teams(user_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_h2h_challenges_match_id ON h2h_challenges(match_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_h2h_challenges_receiver_id ON h2h_challenges(receiver_id);');
    await sequelize.query('ALTER TABLE match_contests ADD COLUMN bot_spots INTEGER DEFAULT 0;').catch(() => {});
    await sequelize.query('ALTER TABLE cricket_teams ADD COLUMN phase INTEGER DEFAULT 1;').catch(() => {});
    await sequelize.query('ALTER TABLE bot_win_history ADD COLUMN phase INTEGER DEFAULT 1;').catch(() => {});
    await sequelize.query('ALTER TABLE notifications ADD COLUMN link TEXT;').catch(() => {});
    await sequelize.query('ALTER TABLE match_contests ADD COLUMN prize_breakup TEXT;').catch(() => {});
    await sequelize.query('ALTER TABLE match_contests ADD COLUMN contest_code INTEGER;').catch(() => {});
    await sequelize.query('ALTER TABLE users ADD COLUMN subscription_plan_id TEXT;').catch(() => {});
    await sequelize.query('ALTER TABLE users ADD COLUMN subscription_max_teams INTEGER DEFAULT 2;').catch(() => {});
    await sequelize.query('ALTER TABLE users ADD COLUMN referral_pass_valid_until TEXT;').catch(() => {});
    await sequelize.query('ALTER TABLE users ADD COLUMN referral_pass_max_teams INTEGER DEFAULT 1;').catch(() => {});
    await sequelize.query('ALTER TABLE users ADD COLUMN referral_pass_claimed_at TEXT;').catch(() => {});

    // SQLite backfill
    try {
      const [contestsWithoutCode] = await sequelize.query('SELECT id FROM match_contests WHERE contest_code IS NULL ORDER BY created_at ASC;');
      if (contestsWithoutCode && contestsWithoutCode.length > 0) {
        const [maxCodeRow] = await sequelize.query('SELECT MAX(contest_code) as max_code FROM match_contests;');
        let nextCode = (maxCodeRow[0]?.max_code ? parseInt(maxCodeRow[0].max_code, 10) : 2010) + 1;
        for (const c of contestsWithoutCode) {
          await sequelize.query('UPDATE match_contests SET contest_code = :code WHERE id = :id;', {
            replacements: { code: nextCode++, id: c.id }
          });
        }
      }
    } catch (_) {}
    console.log('⚡ Ultra high-performance SQLite engine & cricket indexes active.');
  } catch (err) {
    console.warn('SQLite PRAGMA tuning notice:', err.message);
  }
}).catch(() => {});

module.exports = sequelize;
