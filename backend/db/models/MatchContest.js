const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const MatchContest = sequelize.define('MatchContest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'standard',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  prize_pool: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  entry_fee: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  total_spots: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  filled_spots: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  bot_spots: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: true,
  },
  // Type 2 Multi-Battlefield settings
  spots_per_battlefield: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  battlefield_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Type 3 H2H settings
  h2h_challenge_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Type 4 Private contest settings
  is_private: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  invite_code: {
    type: DataTypes.STRING(12),
    allowNull: true,
  },
  creator_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('open', 'locked', 'live', 'completed', 'cancelled'),
    defaultValue: 'open',
  },
}, {
  tableName: 'match_contests',
  indexes: [
    { fields: ['match_id'] },
    { fields: ['match_id', 'is_active'] },
    { fields: ['invite_code'] },
  ],
});

module.exports = MatchContest;

