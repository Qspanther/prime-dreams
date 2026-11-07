// 🏏 PRIME DREEMS — ISOLATED SCORING ENGINE & AUDIT TRAIL
// Section 6: Pure calculation function, configurable scoring rules, and full audit logs

const config = require('../../config');
const { PlayerPointsLog } = require('../../db/models');

/**
 * Pure calculation function: same input always produces same output (Section 6.1)
 */
function calculateFantasyPoints(stats, role = 'BAT', rules = config.SCORING_WEIGHTS) {
  let pts = 0;
  const w = rules || config.SCORING_WEIGHTS;

  // Batting
  const runs = Number(stats.runs) || 0;
  const fours = Number(stats.fours) || 0;
  const sixes = Number(stats.sixes) || 0;
  const balls = Number(stats.balls) || 0;

  pts += runs * w.run;
  pts += fours * w.boundary;
  pts += sixes * w.six;

  if (runs >= 100) {
    pts += w.century;
  } else if (runs >= 50) {
    pts += w.half_century;
  }

  // Duck penalty (-2 for BAT, WK, AR)
  if (balls > 0 && runs === 0 && stats.is_out && role !== 'BOWL') {
    pts += w.duck;
  }

  // Strike Rate bonus (min 10 balls faced)
  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr > 170) pts += w.strike_rate_over_170;
    else if (sr >= 150) pts += w.strike_rate_150_to_170;
    else if (sr < 60 && role !== 'BOWL') pts += w.strike_rate_under_60;
    else if (sr <= 70 && role !== 'BOWL') pts += w.strike_rate_60_to_70;
  }

  // Bowling
  const wickets = Number(stats.wickets) || 0;
  const maidens = Number(stats.maidens) || 0;
  const overs = Number(stats.overs) || 0;
  const runsConceded = Number(stats.runs_conceded) || 0;

  pts += wickets * w.wicket;
  if (wickets >= 5) {
    pts += w.five_wickets;
  } else if (wickets >= 4) {
    pts += w.four_wickets;
  }
  pts += maidens * w.maiden_over;

  // Economy Rate bonus (min 2 overs bowled)
  if (overs >= 2) {
    const econ = runsConceded / overs;
    if (econ < 5) pts += w.economy_under_5;
    else if (econ <= 6) pts += w.economy_5_to_6;
    else if (econ > 10) pts += w.economy_over_10;
    else if (econ >= 9) pts += w.economy_9_to_10;
  }

  // Fielding
  const catches = Number(stats.catches) || 0;
  const stumpings = Number(stats.stumpings) || 0;
  const roDirect = Number(stats.runouts_direct) || 0;
  const roIndirect = Number(stats.runouts_indirect) || 0;

  pts += catches * w.catch;
  if (catches >= 3) pts += 4;
  pts += stumpings * w.stumping;
  pts += roDirect * w.runout_direct;
  pts += roIndirect * w.runout_indirect;

  return Math.round(pts * 10) / 10;
}

/**
 * Audit log for every points modification (Section 6.2)
 */
async function auditPointsChange(matchId, playerId, playerName, eventType, oldPts, newPts, ballEventId = null) {
  try {
    const delta = Math.round((newPts - oldPts) * 10) / 10;
    if (delta === 0) return;

    await PlayerPointsLog.create({
      match_id: matchId,
      player_id: playerId,
      player_name: playerName || 'Player',
      event_type: eventType,
      old_points: oldPts,
      new_points: newPts,
      delta,
      ball_event_id: ballEventId,
    });
  } catch (err) {
    console.error('⚠️ [PointsAuditor] Failed to log points change:', err.message);
  }
}

module.exports = {
  calculateFantasyPoints,
  auditPointsChange,
};

