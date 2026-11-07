const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const CricketTeam = sequelize.define('CricketTeam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  contest_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  team_name: {
    type: DataTypes.STRING,
    defaultValue: 'My XI',
  },
  captain_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  vice_captain_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  total_points: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'cricket_teams',
});

module.exports = CricketTeam;

