const { Sequelize } = require('sequelize');
const config = require('../config');

let sequelize;

const isPostgres = process.env.DATABASE_URL && 
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'));

if (isPostgres) {
  const sslConfig = process.env.DB_SSL === 'false'
    ? false
    : { require: false, rejectUnauthorized: false };

  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: sslConfig ? { ssl: sslConfig } : {},
    logging: false,
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    define: { timestamps: true, underscored: true },
  });
  console.log('🐘 Cloud PostgreSQL engine active via DATABASE_URL');
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
    console.log('⚡ Ultra high-performance SQLite engine & cricket indexes active.');
  } catch (err) {
    console.warn('SQLite PRAGMA tuning notice:', err.message);
  }
}).catch(() => {});

module.exports = sequelize;
