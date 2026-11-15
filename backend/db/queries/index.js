// 📦 Central Export for all Parameterized PostgreSQL Queries
const matchQueries = require('./matchQueries');
const contestQueries = require('./contestQueries');
const teamQueries = require('./teamQueries');
const walletQueries = require('./walletQueries');

module.exports = {
  ...matchQueries,
  ...contestQueries,
  ...teamQueries,
  ...walletQueries,
};
