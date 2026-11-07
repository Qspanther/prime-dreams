// 🏏 PRIME DREEMS — NORMALIZED CRICKET SCHEMA & VALIDATION ENGINE
// Section 1.2 & Section 2.3: Guarantees strict monotonicity and schema integrity

/**
 * Valid canonical match categories
 */
const VALID_CATEGORIES = ['World Cup', 'T20', 'League', "Women's"];

/**
 * Normalizes a raw match object into the canonical Prime Dreems schema
 */
function createNormalizedMatch(raw) {
  return {
    match_id: raw.match_id || raw.id || null,
    cricbuzz_id: raw.cricbuzz_id || (raw.raw_id ? `cb-${raw.raw_id}` : null),
    title: String(raw.title || `${raw.team_a} vs ${raw.team_b}`).trim(),
    category: VALID_CATEGORIES.includes(raw.category) ? raw.category : 'League',
    team_a: String(raw.team_a || raw.team1 || '').trim(),
    team_a_code: String(raw.team_a_code || raw.team1Code || 'T1').toUpperCase().trim(),
    team_b: String(raw.team_b || raw.team2 || '').trim(),
    team_b_code: String(raw.team_b_code || raw.team2Code || 'T2').toUpperCase().trim(),
    venue: String(raw.venue || 'International Cricket Stadium').trim(),
    status: ['live', 'upcoming', 'completed', 'abandoned'].includes(raw.status) ? raw.status : 'upcoming',
    format: raw.format || raw.match_format || 'T20',
    start_time: raw.start_time ? new Date(raw.start_time).toISOString() : new Date().toISOString(),
    match_date: raw.match_date || 'Today',
    match_time: raw.match_time || 'Live Now',
  };
}

/**
 * Normalizes live score snapshot
 */
function createNormalizedScore(raw) {
  const teamAScore = raw.team_a_score || raw.team_a || { runs: 0, wickets: 0, overs: 0.0 };
  const teamBScore = raw.team_b_score || raw.team_b || { runs: 0, wickets: 0, overs: 0.0 };

  return {
    match_id: raw.match_id,
    current_innings: raw.current_innings || 'team_a',
    team_a: {
      runs: Math.max(0, parseInt(teamAScore.runs, 10) || 0),
      wickets: Math.max(0, Math.min(10, parseInt(teamAScore.wickets, 10) || 0)),
      overs: Math.max(0, parseFloat(teamAScore.overs) || 0.0),
    },
    team_b: {
      runs: Math.max(0, parseInt(teamBScore.runs, 10) || 0),
      wickets: Math.max(0, Math.min(10, parseInt(teamBScore.wickets, 10) || 0)),
      overs: Math.max(0, parseFloat(teamBScore.overs) || 0.0),
    },
    current_striker: raw.current_striker ? {
      name: String(raw.current_striker.name || 'Striker').trim(),
      role: raw.current_striker.role || 'BAT',
      runs: parseInt(raw.current_striker.runs, 10) || 0,
      balls: parseInt(raw.current_striker.balls, 10) || 0,
      fours: parseInt(raw.current_striker.fours, 10) || 0,
      sixes: parseInt(raw.current_striker.sixes, 10) || 0,
      strike_rate: String(raw.current_striker.strike_rate || '0.0'),
    } : null,
    non_striker: raw.non_striker ? {
      name: String(raw.non_striker.name || 'Non-Striker').trim(),
      role: raw.non_striker.role || 'BAT',
      runs: parseInt(raw.non_striker.runs, 10) || 0,
      balls: parseInt(raw.non_striker.balls, 10) || 0,
      fours: parseInt(raw.non_striker.fours, 10) || 0,
      sixes: parseInt(raw.non_striker.sixes, 10) || 0,
      strike_rate: String(raw.non_striker.strike_rate || '0.0'),
    } : null,
    current_bowler: raw.current_bowler ? {
      name: String(raw.current_bowler.name || 'Bowler').trim(),
      role: raw.current_bowler.role || 'BOWL',
      overs: String(raw.current_bowler.overs || '0.0'),
      maidens: parseInt(raw.current_bowler.maidens, 10) || 0,
      runs: parseInt(raw.current_bowler.runs, 10) || 0,
      wickets: parseInt(raw.current_bowler.wickets, 10) || 0,
      economy: String(raw.current_bowler.economy || '0.00'),
    } : null,
    recent_balls: Array.isArray(raw.recent_balls) ? raw.recent_balls.slice(-6) : [],
    current_rate: String(raw.current_rate || '0.00'),
    required_rate: String(raw.required_rate || '—'),
    partnership: raw.partnership || { runs: 0, balls: 0 },
    commentary: Array.isArray(raw.commentary) ? raw.commentary.slice(0, 10) : [],
    last_ball_event: raw.last_ball_event || 'Live in-play',
    last_ball_time: raw.last_ball_time || new Date().toISOString(),
  };
}

/**
 * Strict Monotonicity & Data Integrity Validator (Section 2.3)
 * Ensures:
 * 1. Runs never decrease
 * 2. Wickets never decrease
 * 3. Overs never decrease
 * 4. Boundaries & legal values
 */
function validateScoreUpdate(newScore, lastGoodSnapshot) {
  if (!newScore) {
    return { valid: false, reason: 'Empty score payload' };
  }

  // Basic sanity bounds
  const checkSanity = (scoreObj, label) => {
    if (scoreObj.runs < 0 || scoreObj.runs > 1200) {
      return `${label} runs (${scoreObj.runs}) out of realistic bounds [0..1200]`;
    }
    if (scoreObj.wickets < 0 || scoreObj.wickets > 10) {
      return `${label} wickets (${scoreObj.wickets}) out of realistic bounds [0..10]`;
    }
    if (scoreObj.overs < 0 || scoreObj.overs > 150) {
      return `${label} overs (${scoreObj.overs}) out of realistic bounds [0..150]`;
    }
    const ballPart = Math.round((scoreObj.overs % 1) * 10);
    if (ballPart > 6) {
      return `${label} over ball fraction (${ballPart}) is greater than 6 balls`;
    }
    return null;
  };

  const sanityA = checkSanity(newScore.team_a, 'Team A');
  if (sanityA) return { valid: false, reason: sanityA };

  const sanityB = checkSanity(newScore.team_b, 'Team B');
  if (sanityB) return { valid: false, reason: sanityB };

  // Monotonicity check against last good snapshot
  if (lastGoodSnapshot) {
    const isCurrentA = newScore.current_innings === 'team_a';
    const activeNew = isCurrentA ? newScore.team_a : newScore.team_b;
    const activeOld = isCurrentA ? (lastGoodSnapshot.team_a || { runs: 0, wickets: 0, overs: 0 }) 
                                : (lastGoodSnapshot.team_b || { runs: 0, wickets: 0, overs: 0 });

    // Inning switch check: if innings changed, old is 0
    if (lastGoodSnapshot.current_innings === newScore.current_innings) {
      if (activeNew.runs < activeOld.runs) {
        return {
          valid: false,
          reason: `Monotonicity violation: Runs decreased from ${activeOld.runs} to ${activeNew.runs}`,
        };
      }
      if (activeNew.wickets < activeOld.wickets) {
        return {
          valid: false,
          reason: `Monotonicity violation: Wickets decreased from ${activeOld.wickets} to ${activeNew.wickets}`,
        };
      }

      // Overs comparison (convert to total balls)
      const oldBalls = Math.floor(activeOld.overs) * 6 + Math.round((activeOld.overs % 1) * 10);
      const newBalls = Math.floor(activeNew.overs) * 6 + Math.round((activeNew.overs % 1) * 10);
      if (newBalls < oldBalls) {
        return {
          valid: false,
          reason: `Monotonicity violation: Overs decreased from ${activeOld.overs} to ${activeNew.overs}`,
        };
      }
    }
  }

  return { valid: true };
}

module.exports = {
  VALID_CATEGORIES,
  createNormalizedMatch,
  createNormalizedScore,
  validateScoreUpdate,
};

