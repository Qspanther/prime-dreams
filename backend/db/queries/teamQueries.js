// 👥 Parameterized Cricket Teams & Leaderboard Queries for PostgreSQL
const db = require('../pg');

async function getTeamById(teamId) {
  const res = await db.query(
    'SELECT * FROM cricket_teams WHERE id = $1 LIMIT 1;',
    [teamId]
  );
  return res.rows[0] || null;
}

async function getTeamsByContestId(contestId, { limit = 10, offset = 0, search = '' }) {
  const params = [contestId];
  let searchCondition = '';

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    params.push(search.trim());
    searchCondition = `
      AND (
        LOWER(t.team_name) LIKE $${params.length - 1} 
        OR LOWER(u.username) LIKE $${params.length - 1} 
        OR LOWER(u.name) LIKE $${params.length - 1}
        OR t.user_id = $${params.length}
      )
    `;
  }

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    SELECT 
      t.id, t.team_name, t.total_points, t.rank, t.phase, t.user_id, t.created_at,
      u.username, u.name as user_full_name, u.avatar, u.is_bot
    FROM cricket_teams t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.contest_id = $1 ${searchCondition}
    ORDER BY t.total_points DESC, t.created_at ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const res = await db.query(sql, params);
  return res.rows;
}

async function countTeamsByContestId(contestId, search = '') {
  const params = [contestId];
  let searchCondition = '';

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    params.push(search.trim());
    searchCondition = `
      AND (
        LOWER(t.team_name) LIKE $${params.length - 1} 
        OR LOWER(u.username) LIKE $${params.length - 1} 
        OR LOWER(u.name) LIKE $${params.length - 1}
        OR t.user_id = $${params.length}
      )
    `;
  }

  const sql = `
    SELECT COUNT(*)::INTEGER AS total 
    FROM cricket_teams t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.contest_id = $1 ${searchCondition};
  `;

  const res = await db.query(sql, params);
  return res.rows[0]?.total || 0;
}

module.exports = {
  getTeamById,
  getTeamsByContestId,
  countTeamsByContestId,
};
