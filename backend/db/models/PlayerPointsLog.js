const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const PlayerPointsLog = sequelize.define('PlayerPointsLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  player_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  player_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  event_type: {
    type: DataTypes.STRING, // 'run', 'boundary', 'six', 'wicket', 'maiden', 'catch', 'manual_adjustment'
    allowNull: false,
  },
  old_points: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  new_points: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  delta: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  ball_event_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'player_points_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = PlayerPointsLog;

