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
    type: DataTypes.ENUM('standard', 'multi_battlefield', 'h2h'),
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
  status: {
    type: DataTypes.ENUM('open', 'locked', 'live', 'completed', 'cancelled'),
    defaultValue: 'open',
  },
}, {
  tableName: 'match_contests',
});

module.exports = MatchContest;

