const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const CricketPlayer = sequelize.define('CricketPlayer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  team_name: {
    type: DataTypes.STRING,
    allowNull: false, // Team A or Team B
  },
  role: {
    type: DataTypes.ENUM('WK', 'BAT', 'AR', 'BOWL'),
    allowNull: false,
  },
  photo_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  credits: {
    type: DataTypes.FLOAT,
    defaultValue: 9.0,
  },
  points: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      maidens: 0,
      overs: 0,
      catches: 0,
      stumpings: 0,
      runouts_direct: 0,
      runouts_indirect: 0,
      duck: false,
      economy: 0,
      strike_rate: 0,
    },
  },
}, {
  tableName: 'cricket_players',
  indexes: [
    { fields: ['match_id'] },
    { fields: ['match_id', 'points'] },
  ],
});

module.exports = CricketPlayer;

