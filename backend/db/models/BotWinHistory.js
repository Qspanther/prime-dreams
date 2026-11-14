const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const BotWinHistory = sequelize.define('BotWinHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bot_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  tournament_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  phase: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
  },
  points: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
  },
}, {
  tableName: 'bot_win_history',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
});

module.exports = BotWinHistory;
