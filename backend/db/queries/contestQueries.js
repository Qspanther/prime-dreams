// 🏆 Parameterized Contest Queries for PostgreSQL
const db = require('../pg');

async function getContestsByMatchId(matchId) {
  const res = await db.query(
    `SELECT * FROM match_contests 
     WHERE match_id = $1 
     ORDER BY entry_fee DESC, created_at ASC;`,
    [matchId]
  );
  return res.rows;
}

async function getContestById(contestId) {
  const res = await db.query(
    'SELECT * FROM match_contests WHERE id = $1 LIMIT 1;',
    [contestId]
  );
  return res.rows[0] || null;
}

async function incrementFilledSpots(contestId, incrementBy = 1) {
  const res = await db.query(
    `UPDATE match_contests 
     SET filled_spots = filled_spots + $2,
         updated_at = NOW() 
     WHERE id = $1 
     RETURNING *;`,
    [contestId, incrementBy]
  );
  return res.rows[0] || null;
}

async function updateContestPrizeBreakup(contestId, prizeBreakup) {
  const val = typeof prizeBreakup === 'string' ? prizeBreakup : JSON.stringify(prizeBreakup);
  const res = await db.query(
    `UPDATE match_contests 
     SET prize_breakup = $2,
         updated_at = NOW() 
     WHERE id = $1 
     RETURNING *;`,
    [contestId, val]
  );
  return res.rows[0] || null;
}

module.exports = {
  getContestsByMatchId,
  getContestById,
  incrementFilledSpots,
  updateContestPrizeBreakup,
};
