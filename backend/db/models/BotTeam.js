const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const BotTeam = sequelize.define('BotTeam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bot_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  bot_name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Bot Player',
  },
  bot_username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  match_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contest_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  team_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  captain_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  vice_captain_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  total_points: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  phase: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  // Compact 11-player lineup stored as JSON
  // Eliminates 11 rows in team_players per bot team -> 91% fewer DB writes!
  lineup: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('lineup');
      if (!raw) return [];
      try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_) {
        return [];
      }
    },
    set(val) {
      this.setDataValue('lineup', typeof val === 'string' ? val : JSON.stringify(val || []));
    },
  },
}, {
  tableName: 'bot_teams',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['contest_id', 'total_points'] },
    { fields: ['match_id'] },
    { fields: ['bot_id'] },
  ],
});

module.exports = BotTeam;
