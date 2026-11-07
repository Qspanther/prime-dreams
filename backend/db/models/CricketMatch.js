const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const VALID_CATEGORIES = ['World Cup', 'T20', 'League', "Women's"];

const CricketMatch = sequelize.define('CricketMatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  cricbuzz_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM(...VALID_CATEGORIES),
    allowNull: false,
    validate: {
      isIn: {
        args: [VALID_CATEGORIES],
        msg: "Category must be one of: World Cup, T20, League, Women's",
      },
    },
  },
  team_a: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  team_a_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  team_a_logo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  team_b: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  team_b_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  team_b_logo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  match_poster: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  venue: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  match_date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  match_time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  lock_time_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'live', 'completed', 'abandoned'),
    defaultValue: 'upcoming',
  },
  score_summary: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  live_data: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  last_live_poll_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'cricket_matches',
});

CricketMatch.VALID_CATEGORIES = VALID_CATEGORIES;

module.exports = CricketMatch;

