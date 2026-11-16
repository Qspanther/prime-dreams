require('../backend/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const db = require('../backend/db/pg');

async function checkConns() {
  try {
    const res = await db.query(`
      SELECT count(*)::int as active_connections,
             array_agg(distinct application_name) as app_names
      FROM pg_stat_activity 
      WHERE state IS NOT NULL;
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
checkConns();
