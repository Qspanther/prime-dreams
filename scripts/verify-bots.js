require('../backend/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const db = require('../backend/db/pg');

async function check() {
  try {
    const res = await db.query(`
      SELECT 
        c.id, c.title, c.type, c.is_private, c.h2h_challenge_id,
        COUNT(t.id) FILTER (WHERE u.is_bot = true)::int as bot_teams,
        COUNT(t.id) FILTER (WHERE u.is_bot = false OR u.is_bot IS NULL)::int as human_teams
      FROM match_contests c
      LEFT JOIN cricket_teams t ON t.contest_id = c.id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE c.type = 'h2h' OR c.is_private = true OR c.type = 'private' OR c.h2h_challenge_id IS NOT NULL
      GROUP BY c.id, c.title, c.type, c.is_private, c.h2h_challenge_id;
    `);
    
    let h2hBots = 0;
    let privateBots = 0;
    res.rows.forEach(r => {
      const bots = parseInt(r.bot_teams, 10) || 0;
      if (r.type === 'h2h' || r.h2h_challenge_id) h2hBots += bots;
      if (r.is_private === true || r.type === 'private') privateBots += bots;
    });

    console.log(JSON.stringify({
      total_contests_inspected: res.rows.length,
      h2h_bots: h2hBots,
      private_bots: privateBots,
      sample_contests: res.rows.slice(0, 5)
    }, null, 2));
    process.exit(0);
  } catch(e) {
    console.error('Error querying Neon:', e.message);
    process.exit(1);
  }
}
check();
