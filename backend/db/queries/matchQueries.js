// 🏏 Parameterized Match Queries for PostgreSQL
const db = require('../pg');

async function getMatchById(matchId) {
  const res = await db.query(
    'SELECT * FROM cricket_matches WHERE id = $1 LIMIT 1;',
    [matchId]
  );
  return res.rows[0] || null;
}

async function getLiveMatches() {
  const res = await db.query(
    `SELECT * FROM cricket_matches 
     WHERE status IN ('live', 'in_progress', 'innings_break') 
     ORDER BY start_time ASC;`
  );
  return res.rows;
}

async function getMatchesByFilter({ category, status, limit = 50 }) {
  const conditions = [];
  const params = [];

  if (category && category !== 'All') {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  params.push(limit);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM cricket_matches ${whereClause} ORDER BY start_time ASC LIMIT $${params.length};`;

  const res = await db.query(sql, params);
  return res.rows;
}

async function updateMatchScore(matchId, { score_summary, live_data, status, last_ball_update }) {
  const res = await db.query(
    `UPDATE cricket_matches 
     SET score_summary = COALESCE($2, score_summary),
         live_data = COALESCE($3, live_data),
         status = COALESCE($4, status),
         last_ball_update = COALESCE($5, last_ball_update),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *;`,
    [matchId, score_summary, live_data, status, last_ball_update || new Date().toISOString()]
  );
  return res.rows[0] || null;
}

module.exports = {
  getMatchById,
  getLiveMatches,
  getMatchesByFilter,
  updateMatchScore,
};
