const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const TeamPlayer = sequelize.define('TeamPlayer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  team_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  player_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  is_captain: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_vice_captain: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  points_earned: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
}, {
  tableName: 'cricket_team_players',
  indexes: [
    { fields: ['team_id'] },
    { fields: ['player_id'] },
  ],
});

module.exports = TeamPlayer;

