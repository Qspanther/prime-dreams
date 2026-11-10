const { DataTypes } = require('sequelize');
const sequelize = require('../index');

// Stores a Web Push (FCM-style) subscription per user so the server can
// send push notifications when a match goes live, a contest locks, etc.
const PushSubscription = sequelize.define('PushSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    index: true,
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  p256dh: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  auth: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  user_agent: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'push_subscriptions',
});

module.exports = PushSubscription;
