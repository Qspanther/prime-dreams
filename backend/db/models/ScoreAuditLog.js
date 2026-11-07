const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const ScoreAuditLog = sequelize.define('ScoreAuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  admin_username: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'system',
  },
  action: {
    type: DataTypes.STRING, // 'score_override', 'points_override', 'pause_ingestion', 'resume_ingestion', 'validation_rejection'
    allowNull: false,
  },
  old_value: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  new_value: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'score_audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = ScoreAuditLog;

