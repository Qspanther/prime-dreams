// 🧠 PRIME DREEMS — GURU EXPERT MARKETPLACE API ROUTES
// Mounted at /guru and /api/guru by the parent agent.

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authenticate, isAdmin } = require('../middleware/auth');
const { CricketMatch, CricketPlayer, CricketTeam, TeamPlayer, GuruTeam } = require('../db/models');
const sequelize = require('../db/index');

/**
 * GET /guru/teams
 * Public list of active expert teams (optionally filtered by match_id),
 * with resolved player names for display.
 */
router.get('/teams', async (req, res) => {
  try {
    const { match_id } = req.query;
    const where = { is_active: true };
    if (match_id) where.match_id = match_id;

    const guruTeams = await GuruTeam.findAll({
      where,
      order: [['rating', 'DESC'], ['followers', 'DESC']],
    });

    const teams = [];
    for (const g of guruTeams) {
      const playerIds = Array.isArray(g.player_ids) ? g.player_ids : [];
      let players = [];
      if (playerIds.length) {
        players = await CricketPlayer.findAll({ where: { id: { [Op.in]: playerIds } } });
      }
      const nameById = {};
      players.forEach(p => { nameById[p.id] = p.name; });

      teams.push({
        id: g.id,
        guru_name: g.guru_name,
        title: g.title,
        match_id: g.match_id,
        player_ids: playerIds,
        captain_id: g.captain_id,
        vice_captain_id: g.vice_captain_id,
        rating: g.rating,
        price: g.price,
        description: g.description,
        followers: g.followers,
        player_names: playerIds.map(id => nameById[id]).filter(Boolean),
        captain_name: g.captain_id ? (nameById[g.captain_id] || null) : null,
        vice_captain_name: g.vice_captain_id ? (nameById[g.vice_captain_id] || null) : null,
      });
    }

    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /guru/teams
 * Admin-only: publish a new expert team.
 */
router.post('/teams', authenticate, isAdmin, async (req, res) => {
  try {
    const {
      match_id, guru_name, title, player_ids,
      captain_id, vice_captain_id, rating, price, description,
    } = req.body;

    if (!match_id || !guru_name || !title || !Array.isArray(player_ids)) {
      return res.status(400).json({ error: 'match_id, guru_name, title and player_ids (array) are required' });
    }

    const payload = {
      match_id,
      guru_name,
      title,
      player_ids,
      captain_id: captain_id || null,
      vice_captain_id: vice_captain_id || null,
      description: description || null,
    };
    if (rating !== undefined) payload.rating = rating;
    if (price !== undefined) payload.price = price;

    const team = await GuruTeam.create(payload);
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /guru/teams/:id/copy
 * Copy an expert team into the user's own Team Builder (no contest entry).
 */
router.post('/teams/:id/copy', authenticate, async (req, res) => {
  try {
    const guru = await GuruTeam.findByPk(req.params.id);
    if (!guru) return res.status(404).json({ error: 'Expert team not found' });

    const match = await CricketMatch.findByPk(guru.match_id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    // Lock check — same rule as the cricket team builder.
    const lockTime = new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000);
    if (new Date() >= lockTime) {
      return res.status(400).json({ error: 'Match locked, cannot copy team' });
    }

    // Max 6 teams per user per match.
    const myTeamCount = await CricketTeam.count({ where: { user_id: req.user.id, match_id: match.id } });
    if (myTeamCount >= 6) {
      return res.status(400).json({ error: 'Maximum 6 teams allowed per match.' });
    }

    const playerIds = Array.isArray(guru.player_ids) ? guru.player_ids : [];
    const captainId = guru.captain_id;
    const viceCaptainId = guru.vice_captain_id;

    // CricketTeam requires a captain & vice-captain (NOT NULL).
    if (!captainId || !viceCaptainId) {
      return res.status(400).json({ error: 'Expert team is missing a captain or vice-captain.' });
    }

    // Validate the guru's players still exist for this match.
    const players = playerIds.length
      ? await CricketPlayer.findAll({ where: { id: { [Op.in]: playerIds }, match_id: match.id } })
      : [];
    if (!playerIds.length || players.length !== playerIds.length) {
      return res.status(400).json({ error: 'Some expert players are no longer available for this match.' });
    }

    const team = await sequelize.transaction(async (t) => {
      const created = await CricketTeam.create({
        user_id: req.user.id,
        match_id: match.id,
        contest_id: null,
        team_name: `${guru.guru_name} Copy`,
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
        total_points: 0,
      }, { transaction: t });

      for (const playerId of playerIds) {
        await TeamPlayer.create({
          team_id: created.id,
          player_id: playerId,
          is_captain: playerId === captainId,
          is_vice_captain: playerId === viceCaptainId,
          points_earned: 0,
        }, { transaction: t });
      }

      await guru.increment('followers', { by: 1, transaction: t });
      return created;
    });

    res.json({
      success: true,
      team_id: team.id,
      message: 'Expert team copied! Edit it in Team Builder.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;