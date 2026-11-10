const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const UserReward = sequelize.define('UserReward', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  coins: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  scratch_cards: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  spins_left: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  last_spin_date: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_daily_date: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  missions_progress: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  total_coins_earned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'user_rewards',
});

module.exports = UserReward;