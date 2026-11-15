const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    // If null, it's a global notification broadcast to all users
    type: DataTypes.UUID,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    // e.g., 'tournament_created', 'tournament_live', 'creator_updated', 'system'
    type: DataTypes.STRING,
    defaultValue: 'system',
  },
  link: {
    // Optional navigation URL when clicked (e.g. /my-teams, /match/...)
    type: DataTypes.STRING,
    allowNull: true,
  },
  read_by: {
    // For global notifications, store an array of user IDs who have read it.
    // We'll store it as a JSON array string.
    type: DataTypes.TEXT,
    defaultValue: '[]',
  }
}, {
  tableName: 'notifications',
});

module.exports = Notification;
