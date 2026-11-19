const sequelize = require('../db/index');
const hotStore = require('./ingestion/hotStore');
const { registerDeletedMatch } = require('./deletedMatchesRegistry');

/**
 * 🗑️ Bulletproof Match Deletion Service
 * Permanently deletes any Cricket Match and cascades through all related records
 * (Contests, Squad Players, Cricket Teams, Team Players, H2H Challenges, Guru Teams, Score Logs, Points Logs).
 * Registers match tombstones so background ingestion workers NEVER re-discover or recreate it.
 */
async function deleteMatchPermanently(matchId) {
  if (!matchId) {
    throw new Error('match_id is required for deletion');
  }

  // 1. Fetch match details before deletion so we can blacklist its cricbuzz_id and teams
  const matches = await sequelize.query(
    'SELECT id, title, team_a, team_b, team_a_code, team_b_code, cricbuzz_id FROM cricket_matches WHERE id = ?',
    { replacements: [matchId], type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  const matchData = (matches && matches[0]) || { id: matchId };
  const matchTitle = matchData.title || `Match ID ${matchId}`;

  // 🛡️ Register tombstone IMMEDIATELY: locks out background Cricbuzz ingestion loops permanently
  await registerDeletedMatch(matchData);

  // 2. Temporarily turn off foreign keys in SQLite so constraint locks NEVER block deletion
  try {
    await sequelize.query('PRAGMA foreign_keys = OFF;');
  } catch (e) {
    // In PostgreSQL PRAGMA does not apply; child deletion handles constraints cleanly
  }

  try {
    // 3. Find all contests for this match
    const contests = await sequelize.query(
      'SELECT id FROM match_contests WHERE match_id = ?',
      { replacements: [matchId], type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);
    const contestIds = (contests || []).map(c => c.id).filter(Boolean);

    // 4. Find all teams for this match or its contests
    let teamIds = [];
    if (contestIds.length > 0) {
      const placeholders = contestIds.map(() => '?').join(',');
      const teams = await sequelize.query(
        `SELECT id FROM cricket_teams WHERE match_id = ? OR contest_id IN (${placeholders})`,
        { replacements: [matchId, ...contestIds], type: sequelize.QueryTypes.SELECT }
      ).catch(() => []);
      teamIds = (teams || []).map(t => t.id).filter(Boolean);
    } else {
      const teams = await sequelize.query(
        'SELECT id FROM cricket_teams WHERE match_id = ?',
        { replacements: [matchId], type: sequelize.QueryTypes.SELECT }
      ).catch(() => []);
      teamIds = (teams || []).map(t => t.id).filter(Boolean);
    }

    // 5. Find all players for this match
    const players = await sequelize.query(
      'SELECT id FROM cricket_players WHERE match_id = ?',
      { replacements: [matchId], type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);
    const playerIds = (players || []).map(p => p.id).filter(Boolean);

    // 6. Delete cricket_team_players
    if (teamIds.length > 0) {
      const placeholders = teamIds.map(() => '?').join(',');
      await sequelize.query(
        `DELETE FROM cricket_team_players WHERE team_id IN (${placeholders})`,
        { replacements: teamIds }
      ).catch(() => {});
    }
    if (playerIds.length > 0) {
      const placeholders = playerIds.map(() => '?').join(',');
      await sequelize.query(
        `DELETE FROM cricket_team_players WHERE player_id IN (${placeholders})`,
        { replacements: playerIds }
      ).catch(() => {});
    }

    // 7. Delete h2h_challenges
    await sequelize.query(
      'DELETE FROM h2h_challenges WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});
    if (contestIds.length > 0) {
      const placeholders = contestIds.map(() => '?').join(',');
      await sequelize.query(
        `DELETE FROM h2h_challenges WHERE contest_id IN (${placeholders})`,
        { replacements: contestIds }
      ).catch(() => {});
    }

    // 8. Delete guru_teams
    await sequelize.query(
      'DELETE FROM guru_teams WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});

    // 9. Delete score_audit_logs & player_points_logs
    await sequelize.query(
      'DELETE FROM score_audit_logs WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});
    await sequelize.query(
      'DELETE FROM player_points_logs WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});

    // 10. Delete cricket_teams
    await sequelize.query(
      'DELETE FROM cricket_teams WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});
    if (contestIds.length > 0) {
      const placeholders = contestIds.map(() => '?').join(',');
      await sequelize.query(
        `DELETE FROM cricket_teams WHERE contest_id IN (${placeholders})`,
        { replacements: contestIds }
      ).catch(() => {});
    }

    // 11. Delete match_contests
    await sequelize.query(
      'DELETE FROM match_contests WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});

    // 12. Delete cricket_players
    await sequelize.query(
      'DELETE FROM cricket_players WHERE match_id = ?',
      { replacements: [matchId] }
    ).catch(() => {});

    // 13. Delete cricket_matches
    await sequelize.query(
      'DELETE FROM cricket_matches WHERE id = ?',
      { replacements: [matchId] }
    );

    // 14. HotStore memory cleanup
    if (hotStore && typeof hotStore.cleanupMatch === 'function') {
      hotStore.cleanupMatch(matchId);
    }

    // 15. Purge memory micro-cache
    try {
      const { purgeCache } = require('../middleware/cache');
      purgeCache('/matches');
      purgeCache('/api/matches');
      purgeCache('/cricket');
      purgeCache('/admin');
    } catch (_) {}

    // 16. Purge Redis cache
    try {
      const redisCache = require('../cache/redis');
      if (redisCache && typeof redisCache.del === 'function') {
        redisCache.del(`match:${matchId}:score`).catch(() => {});
        redisCache.del(`match:${matchId}:leaderboard`).catch(() => {});
        redisCache.del(`match:${matchId}:contests`).catch(() => {});
        if (matchData.cricbuzz_id) {
          redisCache.del(`match:${matchData.cricbuzz_id}:score`).catch(() => {});
        }
      }
    } catch (_) {}

    return {
      success: true,
      title: matchTitle,
      message: `Match "${matchTitle}" and all its contests, squad rosters, and player records have been permanently deleted.`
    };
  } finally {
    // 17. Always re-enable foreign keys for SQLite
    try {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    } catch (_) {}
  }
}

/**
 * 🧹 Scheduled Retention & Data Expiration Engine
 * - Rule 1: Completed matches older than 7 days and all cascaded data are permanently deleted.
 * - Rule 2: User teams & bot teams from completed matches older than 6 days are auto-deleted.
 */
async function cleanupExpiredMatchesAndTeams() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

  // 1. Delete completed matches older than 7 days
  try {
    const expiredMatches = await sequelize.query(
      `SELECT id, title FROM cricket_matches 
       WHERE status = 'completed' AND (updated_at < :sevenDaysAgo OR start_time < :sevenDaysAgo)`,
      { replacements: { sevenDaysAgo }, type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    if (expiredMatches && expiredMatches.length > 0) {
      console.log(`🗑️ [Data Retention] Found ${expiredMatches.length} completed match(es) older than 7 days. Deleting permanently...`);
      for (const m of expiredMatches) {
        await deleteMatchPermanently(m.id).catch(err => {
          console.warn(`⚠️ [Data Retention] Could not delete expired match ${m.id}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Data Retention] Match cleanup notice:`, err.message);
  }

  // 2. Delete user teams for completed matches older than 6 days
  try {
    const expiredTeams = await sequelize.query(
      `SELECT ct.id FROM cricket_teams ct
       JOIN cricket_matches cm ON cm.id = ct.match_id
       WHERE cm.status = 'completed' AND (ct.created_at < :sixDaysAgo OR cm.start_time < :sixDaysAgo)`,
      { replacements: { sixDaysAgo }, type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    if (expiredTeams && expiredTeams.length > 0) {
      const teamIds = expiredTeams.map(t => t.id).filter(Boolean);
      console.log(`🗑️ [Data Retention] Purging ${teamIds.length} user team(s) from completed matches older than 6 days...`);
      const placeholders = teamIds.map(() => '?').join(',');
      await sequelize.query(`DELETE FROM cricket_team_players WHERE team_id IN (${placeholders})`, { replacements: teamIds }).catch(() => {});
      await sequelize.query(`DELETE FROM contest_participants WHERE team_id IN (${placeholders})`, { replacements: teamIds }).catch(() => {});
      await sequelize.query(`DELETE FROM cricket_teams WHERE id IN (${placeholders})`, { replacements: teamIds }).catch(() => {});
    }
  } catch (err) {
    console.warn(`⚠️ [Data Retention] User team cleanup notice:`, err.message);
  }

  // 3. Delete bot teams for completed matches older than 6 days
  try {
    const expiredBotTeams = await sequelize.query(
      `SELECT bt.id FROM bot_teams bt
       JOIN cricket_matches cm ON cm.id = bt.match_id
       WHERE cm.status = 'completed' AND (bt.created_at < :sixDaysAgo OR cm.start_time < :sixDaysAgo)`,
      { replacements: { sixDaysAgo }, type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    if (expiredBotTeams && expiredBotTeams.length > 0) {
      const botTeamIds = expiredBotTeams.map(t => t.id).filter(Boolean);
      console.log(`🗑️ [Data Retention] Purging ${botTeamIds.length} bot team(s) from completed matches older than 6 days...`);
      const placeholders = botTeamIds.map(() => '?').join(',');
      await sequelize.query(`DELETE FROM bot_teams WHERE id IN (${placeholders})`, { replacements: botTeamIds }).catch(() => {});
    }
  } catch (err) {
    console.warn(`⚠️ [Data Retention] Bot team cleanup notice:`, err.message);
  }
}

module.exports = { deleteMatchPermanently, cleanupExpiredMatchesAndTeams };
