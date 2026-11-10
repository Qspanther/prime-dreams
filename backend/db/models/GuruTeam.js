const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const GuruTeam = sequelize.define('GuruTeam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  guru_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  player_ids: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  captain_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  vice_captain_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 4.5,
  },
  price: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  followers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'guru_teams',
});

module.exports = GuruTeam;