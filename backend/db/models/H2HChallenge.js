const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const H2HChallenge = sequelize.define('H2HChallenge', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  contest_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sender_username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  receiver_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  receiver_username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired', 'completed'),
    defaultValue: 'pending',
  },
  sender_team_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  receiver_team_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  winner_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  prize_pool: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  winner_payout: {
    type: DataTypes.FLOAT,
    allowNull: false, // 85% of total (Sender + Accepter)
  },
  platform_fee: {
    type: DataTypes.FLOAT,
    allowNull: false, // 15% platform margin
  },
}, {
  tableName: 'h2h_challenges',
});

module.exports = H2HChallenge;

