const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Wallet = sequelize.define('Wallet', {
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
  balance: {
    // ASSUMPTION: Using DECIMAL for financial accuracy, stored as string in SQLite
    // balance = deposit_balance + winnings_balance + bonus_balance (kept in sync)
    type: DataTypes.DECIMAL(12, 4),
    defaultValue: 0,
    allowNull: false,
  },
  deposit_balance: {
    type: DataTypes.DECIMAL(12, 4),
    defaultValue: 0,
  },
  winnings_balance: {
    type: DataTypes.DECIMAL(12, 4),
    defaultValue: 0,
  },
  bonus_balance: {
    // Usable for contest entry only — never withdrawable
    type: DataTypes.DECIMAL(12, 4),
    defaultValue: 0,
  },
}, {
  tableName: 'wallets',
});

module.exports = Wallet;
