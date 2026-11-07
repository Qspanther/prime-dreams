// ★★★ PRIME DREEMS — CENTRAL CONFIGURATION FILE ★★★
// Cricket Fantasy Sports Platform
// All tunable constants for the application live here.

require('dotenv').config();

const config = {
  PLATFORM_NAME: 'Prime Dreems',

  // ─── Canonical Match Categories ───
  VALID_CATEGORIES: ['World Cup', 'T20', 'League', "Women's"],

  // ─── Cricket Fantasy Team Rules ───
  TOTAL_TEAM_SIZE: 11,
  TOTAL_CREDITS: 100,
  MAX_PLAYERS_PER_TEAM: 7,
  SQUAD_POOL_SIZE: 30, // 15 players Team A + 15 players Team B

  // Role Constraints
  ROLE_CONSTRAINTS: {
    WK: { min: 1, max: 4 },
    BAT: { min: 3, max: 6 },
    AR: { min: 1, max: 4 },
    BOWL: { min: 3, max: 6 },
  },

  // ─── Multipliers ───
  CAPTAIN_MULTIPLIER: 2.0,
  VICE_CAPTAIN_MULTIPLIER: 1.5,
  DEFAULT_MULTIPLIER: 1.0,

  // ─── Fantasy Cricket Scoring Weights ───
  SCORING_WEIGHTS: {
    run: 1,
    boundary: 1, // 4s bonus
    six: 2,      // 6s bonus
    half_century: 8,
    century: 16,
    duck: -2,    // Batsman / WK / AR only
    wicket: 25,
    four_wickets: 8,
    five_wickets: 16,
    maiden_over: 12,
    catch: 8,
    stumping: 12,
    runout_direct: 12,
    runout_indirect: 6,
    economy_under_5: 6,
    economy_5_to_6: 4,
    economy_9_to_10: -2,
    economy_over_10: -4,
    strike_rate_over_170: 6,
    strike_rate_150_to_170: 4,
    strike_rate_60_to_70: -2,
    strike_rate_under_60: -4,
  },

  // ─── Contest Defaults ───
  DEFAULT_LOCK_MINUTES: 15,
  H2H_COMMISSION_PERCENT: 15, // Platform margin 15%, Winner pool 85%

  // ─── Database ───
  DB_DIALECT: 'sqlite',
  DB_STORAGE: process.env.DB_STORAGE || require('path').resolve(__dirname, 'primedreems.sqlite'),

  // ─── Auth ───
  JWT_SECRET: process.env.JWT_SECRET || 'prime-dreems-dev-secret-key-2026',
  JWT_EXPIRY: '7d',
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 10,

  // ─── Server ───
  PORT: process.env.PORT || 5000,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // ─── Live Polling Throttle (Section 8: min 10s per match poll) ───
  LIVE_POLL_INTERVAL_MS: 10000,
};

module.exports = config;
