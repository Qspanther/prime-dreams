const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user', // 'user' or 'admin'
  },
  is_bot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  otp_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  otp_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  otp_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  kyc_status: {
    type: DataTypes.STRING,
    defaultValue: 'none',
  },
  kyc_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  kyc_pan: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referral_code: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  referred_by_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  subscription_active_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  subscription_type: {
    type: DataTypes.STRING,
    defaultValue: 'none',
  },
  referral_round: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  referrals_in_current_round: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_shares_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_referrals_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'users',
});

module.exports = User;
