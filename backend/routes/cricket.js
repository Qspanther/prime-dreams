// 🏏 PRIME DREEMS — CRICKET & CONTEST API ROUTES

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { 
  CricketMatch, CricketPlayer, MatchContest, 
  CricketTeam, TeamPlayer, H2HChallenge, User, Wallet,
  Transaction, Notification
} = require('../db/models');
const sequelize = require('../db');
const { authenticate, isAdmin } = require('../middleware/auth');
const config = require('../config');
const { syncLiveMatch, getCachedMatchLive } = require('../services/cricbuzzService');
const { createH2HChallenge, acceptH2HChallenge, rejectH2HChallenge, handleBattlefieldFill, chargeWalletEntry } = require('../services/contestService');
const { deleteMatchPermanently } = require('../services/cricketDeleteHelper');
const dns = require('dns').promises;

// ─── Player photo resolver: profile/page links -> viewable image bytes ───
const photoCache = new Map();
const PRIVATE_IP = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1|::ffff:127\.|fc|fd)/i;
const DIRECT_IMAGE = /\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i;
const IMAGE_HOST = /(dicebear|gstatic|redd\.it|wikimedia|twimg|fbcdn)/i;

async function safeFetch(url, redirects = 0) {
  if (redirects > 4) throw new Error('redirect limit');
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
  const { address } = await dns.lookup(u.hostname);
  if (PRIVATE_IP.test(address)) throw new Error('private address');
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrimeDreems/1.0', Accept: '*/*' },
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc) throw new Error('redirect');
    return safeFetch(new URL(loc, url).toString(), redirects + 1);
  }
  return res;
}

function photoCandidates(raw) {
  const out = [];
  let target = raw;
  try {
    const u = new URL(raw);
    if (/(^|\.)google\.[a-z.]+$/i.test(u.hostname)) {
      const img = u.searchParams.get('imgurl');
      const tbn = u.searchParams.get('tbnid');
      if (img) { target = img; out.push(img); }
      if (tbn) out.push(`https://encrypted-tbn0.gstatic.com/images?q=tbn:${tbn}`);
    }
  } catch (_) {}
  if (DIRECT_IMAGE.test(target) || IMAGE_HOST.test(target)) out.unshift(target);
  return { target, out };
}

function ogImage(html, base) {
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      try { return new URL(m[1].replace(/&amp;/g, '&'), base).toString(); } catch (_) {}
    }
  }
  return null;
}

async function resolvePhoto(raw) {
  const hit = photoCache.get(raw);
  if (hit && Date.now() - hit.ts < 3600000) return hit.image;
  let image = null;
  try {
    const { target, out } = photoCandidates(raw);
    if (out.length === 0) {
      const res = await safeFetch(target);
      const ct = res.headers.get('content-type') || '';
      if (ct.startsWith('image/')) { out.push(target); await res.body?.cancel(); }
      else if (ct.includes('html')) { const og = ogImage(await res.text(), target); if (og) out.push(og); }
      else { await res.body?.cancel(); }
    }
    for (const c of out) {
      try {
        const r = await safeFetch(c);
        const ct = r.headers.get('content-type') || '';
        const ok = r.ok && ct.startsWith('image/');
        await r.body?.cancel();
        if (ok) { image = c; break; }
      } catch (_) {}
    }
  } catch (_) { image = null; }
  if (photoCache.size > 500) photoCache.clear();
  photoCache.set(raw, { image, ts: Date.now() });
  return image;
}

router.get('/player-photo', async (req, res) => {
  const raw = String(req.query.url || '').trim();
  const name = String(req.query.name || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return res.status(400).end();
  try {
    let image = await resolvePhoto(raw);
    if (!image) image = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name || raw)}`;
    const img = await safeFetch(image);
    const ct = img.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return res.status(404).end();
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 6000000) return res.status(404).end();
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  } catch (_) {
    return res.status(404).end();
  }
});

/**
 * GET /api/matches
 * Returns match list with category filtering (Section 5.4)
 */
router.get('/matches', async (req, res) => {
  try {
    const { category, status } = req.query;
    const where = {};

    if (category && config.VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (status) {
      where.status = status;
    }

    const matches = await CricketMatch.findAll({
      where,
      include: [
        { model: MatchContest, as: 'contests', where: { is_active: true, is_private: false }, required: false },
      ],
      order: [['start_time', 'ASC']],
    });

    const now = new Date();
    const formatted = matches.map(m => {
      const lockTime = new Date(m.start_time.getTime() - (m.lock_time_minutes || 15) * 60000);
      const isLocked = now >= lockTime;
      const totalPrizePool = (m.contests || []).reduce((sum, c) => sum + (c.prize_pool || 0), 0);
      const minEntry = (m.contests || []).reduce((min, c) => Math.min(min, c.entry_fee || 0), 9999);

      return {
        id: m.id,
        title: m.title,
        category: m.category,
        team_a: m.team_a,
        team_a_code: m.team_a_code || m.team_a.substring(0, 3).toUpperCase(),
        team_a_logo: m.team_a_logo || '/cricket/team_a.png',
        team_b: m.team_b,
        team_b_code: m.team_b_code || m.team_b.substring(0, 3).toUpperCase(),
        team_b_logo: m.team_b_logo || '/cricket/team_b.png',
        match_poster: m.match_poster || '/cricket/poster.png',
        venue: m.venue,
        match_date: m.match_date,
        match_time: m.match_time,
        start_time: m.start_time,
        status: m.status,
        is_locked: isLocked,
        lock_time: lockTime,
        lock_time_minutes: m.lock_time_minutes,
        contests_count: (m.contests || []).length,
        total_prize_pool: totalPrizePool,
        min_entry_fee: minEntry === 9999 ? 0 : minEntry,
        score_summary: m.score_summary,
        live_data: m.live_data,
      };
    });

    res.json({ success: true, matches: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/live-all
 * Multi-live match switcher & global live indicator (§8)
 */
router.get('/matches/live-all', async (req, res) => {
  try {
    const liveMatches = await CricketMatch.findAll({
      where: { status: 'live' },
      attributes: ['id', 'title', 'category', 'team_a', 'team_b', 'score_summary', 'live_data'],
    });

    const list = liveMatches.map(m => {
      const cached = getCachedMatchLive(m.id);
      return {
        id: m.id,
        title: m.title,
        category: m.category,
        team_a: m.team_a,
        team_b: m.team_b,
        score_summary: cached ? cached.score_summary : m.score_summary,
        status_text: cached?.live_data?.status_text || `${m.team_a} vs ${m.team_b}`,
        updated_tag: cached?.updated_tag || 'Live',
      };
    });

    res.json({
      success: true,
      live_count: list.length,
      live_matches: list,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/telemetry
 * Real-time match telemetry (Striker, Non-striker, Bowler, Ball-by-Ball, Commentary, Fantasy points)
 */
router.get('/matches/:id/telemetry', async (req, res) => {
  try {
    const { id } = req.params;
    const match = await CricketMatch.findByPk(id, {
      include: [{ model: CricketPlayer, as: 'players' }],
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    let liveSnapshot = getCachedMatchLive(id);
    if (!liveSnapshot) {
      liveSnapshot = await syncLiveMatch(id);
    }

    const payload = {
      success: true,
      match: {
        id: match.id,
        title: match.title,
        category: match.category,
        team_a: match.team_a,
        team_a_code: match.team_a_code,
        team_b: match.team_b,
        team_b_code: match.team_b_code,
        status: match.status,
        score_summary: liveSnapshot?.score_summary || match.score_summary || {},
        live_data: liveSnapshot?.live_data || match.live_data || {},
        updated_tag: liveSnapshot?.updated_tag || 'Live',
      },
      players: (match.players || []).map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        team_name: p.team_name,
        credits: p.credits || 9.0,
        points: p.points || 0,
        stats: p.stats || {},
      })),
    };

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/leaderboard
 * Live player points and, optionally, the current user's contest team standings.
 */
router.get('/matches/:id/leaderboard', authenticate, async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const players = await CricketPlayer.findAll({
      where: { match_id: match.id },
      order: [['points', 'DESC'], ['name', 'ASC']],
    });
    let priorPlayerPoints = null;
    let playerRank = 0;
    const playerLeaderboard = players.map((player, index) => {
      const points = Number(player.points) || 0;
      if (priorPlayerPoints === null || points !== priorPlayerPoints) playerRank = index + 1;
      priorPlayerPoints = points;
      return {
        id: player.id,
        rank: playerRank,
        name: player.name,
        role: player.role,
        team_name: player.team_name,
        points,
        stats: player.stats || {},
      };
    });

    const teamId = req.query.team_id;
    const playerRanks = new Map(playerLeaderboard.map(player => [player.id, player.rank]));
    const response = {
      success: true,
      match: {
        id: match.id,
        title: match.title,
        status: match.status,
        team_a: match.team_a,
        team_b: match.team_b,
        score_summary: match.score_summary || {},
        last_updated: match.last_live_poll_at || null,
      },
      player_leaderboard: teamId ? [] : playerLeaderboard,
      contest: null,
      contest_leaderboard: [],
      my_team: null,
    };

    if (teamId) {
      const myTeam = await CricketTeam.findOne({
        where: { id: teamId, match_id: match.id, user_id: req.user.id },
        include: [{
          model: TeamPlayer,
          as: 'teamPlayers',
          attributes: ['is_captain', 'is_vice_captain', 'points_earned'],
          include: [{ model: CricketPlayer, as: 'player', attributes: ['id', 'name', 'role', 'team_name', 'points', 'stats'] }],
        }],
      });
      if (!myTeam) return res.status(404).json({ error: 'Your team was not found for this match.' });

      const myPlayers = (myTeam.teamPlayers || []).map(entry => ({
        id: entry.player?.id,
        name: entry.player?.name || 'Player',
        role: entry.player?.role || null,
        team_name: entry.player?.team_name || null,
        points: Number(entry.player?.points) || 0,
        points_earned: Number(entry.points_earned) || 0,
        rank: playerRanks.get(entry.player?.id) || null,
        is_captain: Boolean(entry.is_captain),
        is_vice_captain: Boolean(entry.is_vice_captain),
        stats: entry.player?.stats || {},
      }));
      response.my_team = {
        team_id: myTeam.id,
        team_name: myTeam.team_name,
        rank: null,
        total_points: Number(myTeam.total_points) || 0,
        players: myPlayers,
      };

      const contest = myTeam.contest_id
        ? await MatchContest.findOne({ where: { id: myTeam.contest_id, match_id: match.id } })
        : null;
      if (contest) {
        response.contest = { id: contest.id, title: contest.title, status: contest.status };
        const lineupsAreVisible = ['live', 'completed'].includes(match.status) || ['locked', 'live', 'completed'].includes(contest.status);
        if (!lineupsAreVisible) {
          response.contest_lineups_hidden = true;
          return res.json(response);
        }

        const teams = await CricketTeam.findAll({
          where: { contest_id: contest.id },
          attributes: ['id', 'user_id', 'team_name', 'total_points'],
          include: [
            { model: User, as: 'user', attributes: ['id', 'username', 'name'] },
            {
              model: TeamPlayer,
              as: 'teamPlayers',
              attributes: ['is_captain', 'is_vice_captain', 'points_earned'],
              include: [{ model: CricketPlayer, as: 'player', attributes: ['id', 'name', 'role', 'team_name', 'points', 'stats'] }],
            },
          ],
          order: [['total_points', 'DESC'], ['created_at', 'ASC']],
        });

        let priorTeamPoints = null;
        let teamRank = 0;
        response.contest_leaderboard = teams.map((team, index) => {
          const points = Number(team.total_points) || 0;
          if (priorTeamPoints === null || points !== priorTeamPoints) teamRank = index + 1;
          priorTeamPoints = points;
          return {
            team_id: team.id,
            user_id: team.user_id,
            team_name: team.team_name || 'Team',
            username: team.user?.username || team.user?.name || 'Player',
            rank: teamRank,
            total_points: points,
            players: (team.teamPlayers || []).map(entry => ({
              id: entry.player?.id,
              name: entry.player?.name || 'Player',
              role: entry.player?.role || null,
              team_name: entry.player?.team_name || null,
              points: Number(entry.player?.points) || 0,
              points_earned: Number(entry.points_earned) || 0,
              rank: playerRanks.get(entry.player?.id) || null,
              is_captain: Boolean(entry.is_captain),
              is_vice_captain: Boolean(entry.is_vice_captain),
              stats: entry.player?.stats || {},
            })),
          };
        });

        const myStanding = response.contest_leaderboard.find(team => team.team_id === myTeam.id);
        if (myStanding) {
          response.my_team.rank = myStanding.rank;
          response.my_team.total_points = myStanding.total_points;
        }
      } else {
        response.contest_leaderboard = [];
      }
    }

    res.json(response);
  } catch (err) {
    console.error('Get live cricket leaderboard error:', err);
    res.status(500).json({ error: 'Could not load the live leaderboard.' });
  }
});

/**
 * GET /api/matches/:id
 * Single match detail with 30-player pool (15 Team A + 15 Team B)
 */
router.get('/matches/:id', async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id, {
      include: [
        { model: CricketPlayer, as: 'players' },
        { model: MatchContest, as: 'contests', where: { is_active: true, is_private: false }, required: false },
      ],
    });

    if (!match) return res.status(404).json({ error: 'Match not found' });

    const now = new Date();
    const lockTime = new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000);
    const isLocked = now >= lockTime;

    // ─── Practice (free) contest: auto-seed one per upcoming match ───
    let contests = match.contests || [];
    if (match.status === 'upcoming' && !contests.some((c) => c.type === 'practice')) {
      try {
        await MatchContest.create({
          match_id: match.id,
          type: 'practice',
          title: 'Practice Contest (Free)',
          prize_pool: 0,
          entry_fee: 0,
          total_spots: 50,
          filled_spots: 0,
          is_active: true,
          status: 'open',
        });
        const refreshed = await MatchContest.findAll({ where: { match_id: match.id, is_active: true, is_private: false } });
        contests = refreshed;
      } catch (err) { /* seeding is best-effort */ }
    }

    // ─── Rookie (beginner) contest: auto-seed one per upcoming match ───
    if (match.status === 'upcoming' && !contests.some((c) => /rookie/i.test(c.title || ''))) {
      try {
        await MatchContest.create({
          match_id: match.id,
          type: 'standard',
          title: 'Rookie Contest (Beginner)',
          prize_pool: 1000,
          entry_fee: 19,
          total_spots: 100,
          filled_spots: 0,
          is_active: true,
          status: 'open',
        });
        const refreshed = await MatchContest.findAll({ where: { match_id: match.id, is_active: true, is_private: false } });
        contests = refreshed;
      } catch (err) { /* seeding is best-effort */ }
    }

    // ─── Player stats: "Selected by X%", last match & avg points, form ───
    const [selRows] = await sequelize.query(
      `SELECT tp.player_id, COUNT(*) AS cnt FROM cricket_team_players tp
       JOIN cricket_teams ct ON ct.id = tp.team_id
       WHERE ct.match_id = :mid GROUP BY tp.player_id`,
      { replacements: { mid: match.id } }
    );
    const [totalRow] = await sequelize.query(
      'SELECT COUNT(*) AS cnt FROM cricket_teams WHERE match_id = :mid',
      { replacements: { mid: match.id } }
    );
    const totalTeams = Number(totalRow?.cnt || 0);
    const selectedCount = new Map(selRows.map((r) => [r.player_id, Number(r.cnt)]));

    const playersWithStats = (match.players || []).map((p) => {
      let statsObj = {};
      try { statsObj = p.stats ? (typeof p.stats === 'string' ? JSON.parse(p.stats) : p.stats) : {}; } catch (e) { statsObj = {}; }
      if (!statsObj || typeof statsObj !== 'object') statsObj = {};
      const cnt = selectedCount.get(p.id) || 0;
      return {
        ...p.toJSON(),
        selected_by: cnt,
        selected_by_pct: totalTeams > 0 ? Math.min(100, Math.round((cnt / totalTeams) * 100)) : 0,
        last_match_points: statsObj.last_match_points ?? null,
        avg_points: statsObj.avg_points ?? null,
        form: statsObj.form || null,
        is_playing_xi: !!statsObj.playing_xi,
      };
    });

    res.json({
      success: true,
      match: {
        id: match.id,
        title: match.title,
        category: match.category,
        team_a: match.team_a,
        team_a_code: match.team_a_code || match.team_a.substring(0, 3).toUpperCase(),
        team_a_logo: match.team_a_logo || '/cricket/team_a.png',
        team_b: match.team_b,
        team_b_code: match.team_b_code || match.team_b.substring(0, 3).toUpperCase(),
        team_b_logo: match.team_b_logo || '/cricket/team_b.png',
        match_poster: match.match_poster || '/cricket/poster.png',
        venue: match.venue,
        match_date: match.match_date,
        match_time: match.match_time,
        start_time: match.start_time,
        status: match.status,
        is_locked: isLocked,
        lock_time: lockTime,
        lock_time_minutes: match.lock_time_minutes,
        players: playersWithStats,
        contests,
        score_summary: match.score_summary,
        live_data: match.live_data,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/live
 * Isolated real-time live score with cached graceful degrade (§8)
 */
router.get('/matches/:id/live', async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    let live = getCachedMatchLive(match.id);
    if (!live && match.status === 'live') {
      live = await syncLiveMatch(match);
    }

    res.json({
      success: true,
      live: live || {
        match_id: match.id,
        status: match.status,
        score_summary: match.score_summary,
        live_data: match.live_data,
        updated_tag: 'Standby',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/matches/:id/playing-xi
 * Admin: mark the announced Playing XI for a match. Sets stats.playing_xi on
 * every CricketPlayer of the match (true if in player_ids, false otherwise),
 * preserving all other stats keys. Body: { player_ids: [uuid, ...] }.
 */
router.post('/matches/:id/playing-xi', authenticate, isAdmin, async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const { player_ids } = req.body;
    if (!Array.isArray(player_ids)) {
      return res.status(400).json({ error: 'player_ids must be an array of player UUIDs.' });
    }
    const playingSet = new Set(player_ids.map((id) => String(id)));

    const players = await CricketPlayer.findAll({ where: { match_id: match.id } });
    let updated = 0;
    for (const p of players) {
      let statsObj = {};
      try { statsObj = p.stats ? (typeof p.stats === 'string' ? JSON.parse(p.stats) : p.stats) : {}; } catch (e) { statsObj = {}; }
      if (!statsObj || typeof statsObj !== 'object') statsObj = {};
      statsObj.playing_xi = playingSet.has(String(p.id));
      await p.update({ stats: statsObj });
      updated++;
    }

    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/win-probability
 * Per-team win probability + projected winnings for the user's teams in a match.
 * Probability is a heuristic based on contest rank and points gap to the leader;
 * it is null (with note "Live nahi hai") until the match is live/completed.
 */
router.get('/matches/:id/win-probability', authenticate, async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const myTeams = await CricketTeam.findAll({
      where: { user_id: req.user.id, match_id: match.id },
      order: [['created_at', 'ASC']],
    });

    const liveOrCompleted = match.status === 'live' || match.status === 'completed';
    const teams = [];

    for (const team of myTeams) {
      if (!team.contest_id) {
        teams.push({
          team_id: team.id,
          team_name: team.team_name,
          contest_id: null,
          contest_title: null,
          current_points: team.total_points,
          rank: null,
          total_teams: 0,
          win_probability: null,
          projected_winnings: 0,
          is_winning: false,
          note: liveOrCompleted ? 'No contest joined' : 'Live nahi hai',
        });
        continue;
      }

      const contest = await MatchContest.findByPk(team.contest_id);
      const contestTeams = await CricketTeam.findAll({
        where: { contest_id: team.contest_id },
        order: [['total_points', 'DESC']],
      });
      const totalTeams = contestTeams.length;
      let rank = contestTeams.findIndex((t) => t.id === team.id) + 1;
      if (rank < 1) rank = totalTeams || 1;

      const leaderPoints = totalTeams > 0 ? (parseFloat(contestTeams[0].total_points) || 0) : 0;
      const myPoints = parseFloat(team.total_points) || 0;
      const gap = Math.max(0, leaderPoints - myPoints);

      let winProbability = null;
      let note = null;
      if (!liveOrCompleted) {
        note = 'Live nahi hai';
      } else {
        const raw = 100 - ((rank - 1) * 100) / Math.max(totalTeams, 1) - gap * 0.5;
        winProbability = Math.min(99, Math.max(1, Math.round(raw)));
      }

      const breakup = contest
        ? buildPrizeBreakup(parseFloat(contest.prize_pool) || 0, parseInt(contest.total_spots, 10) || 0)
        : [];
      const bucket = breakup.find((b) => rank >= b.rank_from && rank <= b.rank_to);

      teams.push({
        team_id: team.id,
        team_name: team.team_name,
        contest_id: team.contest_id,
        contest_title: contest ? contest.title : null,
        current_points: team.total_points,
        rank,
        total_teams: totalTeams,
        win_probability: winProbability,
        projected_winnings: bucket ? bucket.prize : 0,
        is_winning: liveOrCompleted && rank === 1,
        ...(note ? { note } : {}),
      });
    }

    res.json({ success: true, match_status: match.status, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/matches/:id/teams
 * Create 11-player fantasy team (§4)
 */
async function validateCricketSelection(match, player_ids, captain_id, vice_captain_id, transaction = undefined) {
  if (!Array.isArray(player_ids) || player_ids.length !== 11) {
    return { error: 'You must select exactly 11 players for your team.' };
  }
  if (!captain_id || !vice_captain_id) {
    return { error: 'You must assign a Captain (2x) and Vice-Captain (1.5x).' };
  }
  if (captain_id === vice_captain_id) {
    return { error: 'Captain and Vice-Captain must be different players.' };
  }

  const players = await CricketPlayer.findAll({
    where: { id: { [Op.in]: player_ids }, match_id: match.id },
    transaction,
  });

  if (players.length !== 11) {
    return { error: 'All 11 players must belong to this match.' };
  }

  // Role and budget checks
  let totalCredits = 0;
  const teamCounts = {};
  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };

  players.forEach(p => {
    totalCredits += Number(p.credits) || 9.0;
    teamCounts[p.team_name] = (teamCounts[p.team_name] || 0) + 1;
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  });

  if (totalCredits > config.TOTAL_CREDITS) {
    return { error: `Total team credits (${totalCredits}) exceeds limit (${config.TOTAL_CREDITS}).` };
  }
  for (const team in teamCounts) {
    if (teamCounts[team] > config.MAX_PLAYERS_PER_TEAM) {
      return { error: `Cannot pick more than ${config.MAX_PLAYERS_PER_TEAM} players from ${team}.` };
    }
  }
  if (roleCounts.WK < 1) return { error: 'Select at least 1 Wicket Keeper.' };
  if (roleCounts.BAT < 3) return { error: 'Select at least 3 Batsmen.' };
  if (roleCounts.AR < 1) return { error: 'Select at least 1 All-Rounder.' };
  if (roleCounts.BOWL < 3) return { error: 'Select at least 3 Bowlers.' };

  return { players };
}

function matchLockTime(match) {
  return new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000);
}

router.post('/matches/:id/teams', authenticate, async (req, res) => {
  let transaction;
  let filledContest = null;
  try {
    transaction = await sequelize.transaction();
    const match = await CricketMatch.findByPk(req.params.id, { transaction });
    if (!match) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Match not found' });
    }

    // Lock check (§15)
    const now = new Date();
    if (now >= matchLockTime(match)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Contest selection is locked. Match starts shortly!' });
    }

    // Max 6 teams per user per match (Dream11-style)
    const myTeamCount = await CricketTeam.count({ where: { user_id: req.user.id, match_id: match.id }, transaction });
    if (myTeamCount >= 6) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Maximum 6 teams allowed per match.' });
    }

    const { team_name, player_ids, captain_id, vice_captain_id, contest_id } = req.body;

    const validation = await validateCricketSelection(match, player_ids, captain_id, vice_captain_id, transaction);
    if (validation.error) {
      await transaction.rollback();
      return res.status(400).json({ error: validation.error });
    }
    const players = validation.players;

    let contest = null;
    if (contest_id) {
      contest = await MatchContest.findByPk(contest_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!contest) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Contest not found.' });
      }
      if (contest.match_id !== match.id) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Contest does not belong to this match.' });
      }
      if (!contest.is_active || contest.status !== 'open') {
        await transaction.rollback();
        return res.status(400).json({ error: `Contest is ${contest.status}.` });
      }
      if (contest.filled_spots >= contest.total_spots) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Contest is full.' });
      }

      if (contest.type === 'h2h') {
        const challenge = await H2HChallenge.findOne({ where: { contest_id: contest.id }, transaction, lock: transaction.LOCK.UPDATE });
        if (!challenge || challenge.status !== 'accepted' || challenge.receiver_id !== req.user.id || challenge.receiver_team_id) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Accept an H2H challenge before registering a team in this contest.' });
        }
      }

      const fee = Number(contest.entry_fee) || 0;
      if (fee > 0) {
        await chargeWalletEntry(req.user.id, fee, `Entry fee for "${contest.title}"`, transaction);
      }
    }

    const newTeam = await CricketTeam.create({
      user_id: req.user.id,
      match_id: match.id,
      contest_id: contest_id || null,
      team_name: team_name || 'My Prime XI',
      captain_id,
      vice_captain_id,
      total_points: 0,
    }, { transaction });

    await TeamPlayer.bulkCreate(players.map(p => ({
        team_id: newTeam.id,
        player_id: p.id,
        is_captain: p.id === captain_id,
        is_vice_captain: p.id === vice_captain_id,
        points_earned: 0,
    })), { transaction });

    if (contest) {
      const filledSpots = (Number(contest.filled_spots) || 0) + 1;
      const isFull = filledSpots >= Number(contest.total_spots);
      await contest.update({
        filled_spots: filledSpots,
        ...(isFull ? { status: 'locked' } : {}),
      }, { transaction });
      if (contest.type === 'h2h') {
        await H2HChallenge.update(
          { receiver_team_id: newTeam.id },
          { where: { contest_id: contest.id, receiver_id: req.user.id, status: 'accepted' }, transaction }
        );
      }
      if (contest.type === 'multi_battlefield' && isFull) filledContest = contest;
    }

    await transaction.commit();
    if (filledContest) {
      try { await handleBattlefieldFill(filledContest); }
      catch (error) { console.error('[Contest] Filled-room rollover failed:', error.message); }
    }
    res.json({
      success: true,
      message: contest
        ? 'Team entered into the contest successfully! Best of luck 🏏'
        : 'Team successfully submitted! Best of luck 🏏',
      team: newTeam,
    });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    const isDatabaseError = String(err.name || '').startsWith('Sequelize');
    res.status(isDatabaseError ? 500 : 400).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/my-team
 * User's existing team for this match (optionally scoped to a contest),
 * so the team builder can reopen it in edit mode.
 */
router.get('/matches/:id/my-team', authenticate, async (req, res) => {
  try {
    const team = await CricketTeam.findOne({
      where: {
        user_id: req.user.id,
        match_id: req.params.id,
        contest_id: req.query.contest_id || null,
      },
      include: [{ model: CricketPlayer, as: 'players' }],
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, team: team || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/my-teams
 * All of the user's teams for this match (max 6) — for the team selector.
 */
router.get('/matches/:id/my-teams', authenticate, async (req, res) => {
  try {
    const teams = await CricketTeam.findAll({
      where: { user_id: req.user.id, match_id: req.params.id },
      attributes: ['id', 'team_name', 'captain_id', 'vice_captain_id', 'contest_id', 'created_at'],
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, teams, max_teams: 6 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/matches/:id/teams/:teamId/clone
 * Duplicate an existing team (Dream11-style clone). No entry fee.
 */
router.post('/matches/:id/teams/:teamId/clone', authenticate, async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const team = await CricketTeam.findByPk(req.params.teamId, {
      include: [{ model: CricketPlayer, as: 'players' }],
    });
    if (!team || team.match_id !== match.id) return res.status(404).json({ error: 'Team not found' });
    if (team.user_id !== req.user.id) return res.status(403).json({ error: 'Not your team' });

    const now = new Date();
    if (now >= matchLockTime(match)) {
      return res.status(400).json({ error: 'Contest is locked. Teams can no longer be created.' });
    }

    const myTeamCount = await CricketTeam.count({ where: { user_id: req.user.id, match_id: match.id } });
    if (myTeamCount >= 6) {
      return res.status(400).json({ error: 'Maximum 6 teams allowed per match.' });
    }

    const clone = await CricketTeam.create({
      user_id: req.user.id,
      match_id: match.id,
      contest_id: null,
      team_name: `${team.team_name} (T${myTeamCount + 1})`,
      captain_id: team.captain_id,
      vice_captain_id: team.vice_captain_id,
      total_points: 0,
    });

    for (const p of team.players || []) {
      await TeamPlayer.create({
        team_id: clone.id,
        player_id: p.id,
        is_captain: p.id === team.captain_id,
        is_vice_captain: p.id === team.vice_captain_id,
        points_earned: 0,
      });
    }

    res.json({ success: true, message: 'Team cloned!', team: clone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/matches/:id/teams/:teamId/switch-contest
 * Move an existing team into a different public contest of the same match
 * before lock time. The entry-fee difference is settled atomically:
 * extra fee is deducted bonus -> winnings -> deposit; a lower fee refunds the
 * difference to deposit_balance. Body: { contest_id }.
 */
router.post('/matches/:id/teams/:teamId/switch-contest', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const match = await CricketMatch.findByPk(req.params.id, { transaction: t });
    if (!match) { await t.rollback(); return res.status(404).json({ error: 'Match not found' }); }

    const team = await CricketTeam.findByPk(req.params.teamId, { transaction: t });
    if (!team || team.match_id !== match.id) { await t.rollback(); return res.status(404).json({ error: 'Team not found' }); }
    if (team.user_id !== req.user.id) { await t.rollback(); return res.status(403).json({ error: 'Not your team' }); }

    const now = new Date();
    if (now >= matchLockTime(match)) {
      await t.rollback();
      return res.status(400).json({ error: 'Contest is locked. Teams can no longer be switched.' });
    }

    const { contest_id } = req.body;
    if (!contest_id) { await t.rollback(); return res.status(400).json({ error: 'Target contest_id is required.' }); }

    const target = await MatchContest.findByPk(contest_id, { transaction: t });
    if (!target) { await t.rollback(); return res.status(404).json({ error: 'Target contest not found' }); }
    if (target.match_id !== match.id) { await t.rollback(); return res.status(400).json({ error: 'Target contest does not belong to this match.' }); }
    if (!target.is_active) { await t.rollback(); return res.status(400).json({ error: 'Target contest is not active.' }); }
    if (target.is_private) { await t.rollback(); return res.status(400).json({ error: 'Cannot switch into a private contest.' }); }
    if (target.status !== 'open') { await t.rollback(); return res.status(400).json({ error: `Target contest is ${target.status}.` }); }
    if (target.filled_spots >= target.total_spots) { await t.rollback(); return res.status(400).json({ error: 'Target contest is full.' }); }
    if (target.id === team.contest_id) { await t.rollback(); return res.status(400).json({ error: 'Team is already in this contest.' }); }

    const oldContest = team.contest_id ? await MatchContest.findByPk(team.contest_id, { transaction: t }) : null;
    const oldFee = oldContest ? (parseFloat(oldContest.entry_fee) || 0) : 0;
    const newFee = parseFloat(target.entry_fee) || 0;
    const diff = Math.round((newFee - oldFee) * 100) / 100;

    // ─── Settle the entry-fee difference (bonus -> winnings -> deposit) ───
    if (diff !== 0) {
      const wallet = await Wallet.findOne({ where: { user_id: req.user.id }, transaction: t });
      if (!wallet) { await t.rollback(); return res.status(400).json({ error: 'Wallet not found' }); }
      const bonus = parseFloat(wallet.bonus_balance) || 0;
      const winnings = parseFloat(wallet.winnings_balance) || 0;
      const deposit = parseFloat(wallet.deposit_balance) || 0;
      const balance = parseFloat(wallet.balance) || 0;

      if (diff > 0) {
        const available = bonus + winnings + deposit; // withdrawable + bonus
        if (available < diff) {
          await t.rollback();
          return res.status(400).json({ error: `Insufficient wallet balance. Additional entry fee is ₹${diff}.` });
        }
        let remaining = diff;
        const useBonus = Math.min(bonus, remaining); remaining -= useBonus;
        const useWinnings = Math.min(winnings, remaining); remaining -= useWinnings;
        const useDeposit = Math.min(deposit, remaining); remaining -= useDeposit;
        await wallet.update({
          bonus_balance: bonus - useBonus,
          winnings_balance: winnings - useWinnings,
          deposit_balance: deposit - useDeposit,
          balance: balance - diff,
        }, { transaction: t });
        await Transaction.create({
          wallet_id: wallet.id,
          amount: -diff,
          type: 'contest_switch',
          status: 'completed',
          description: `Contest switch fee: "${oldContest ? oldContest.title : 'No contest'}" → "${target.title}"`,
        }, { transaction: t });
      } else {
        const refund = Math.abs(diff);
        await wallet.update({
          deposit_balance: deposit + refund,
          balance: balance + refund,
        }, { transaction: t });
        await Transaction.create({
          wallet_id: wallet.id,
          amount: refund,
          type: 'contest_switch',
          status: 'completed',
          description: `Contest switch refund: "${oldContest ? oldContest.title : 'No contest'}" → "${target.title}"`,
        }, { transaction: t });
      }
    }

    // ─── Move the spot from the old contest to the target, then re-point the team ───
    if (oldContest) {
      await oldContest.update({ filled_spots: Math.max(0, (parseInt(oldContest.filled_spots, 10) || 0) - 1) }, { transaction: t });
    }
    await target.update({ filled_spots: (parseInt(target.filled_spots, 10) || 0) + 1 }, { transaction: t });
    await team.update({ contest_id: target.id }, { transaction: t });

    await t.commit();
    res.json({ success: true, message: 'Team switched to new contest', team });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/matches/:id/teams/:teamId
 * Single team with its players (owner only).
 */
router.get('/matches/:id/teams/:teamId', authenticate, async (req, res) => {
  try {
    const team = await CricketTeam.findByPk(req.params.teamId, {
      include: [{ model: CricketPlayer, as: 'players' }],
    });
    if (!team || team.match_id !== req.params.id) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (team.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your team' });
    }
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/matches/:id/teams/:teamId
 * Edit a saved team any number of times until the contest lock time.
 * Entry fee is never charged again on edit.
 */
router.put('/matches/:id/teams/:teamId', authenticate, async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const team = await CricketTeam.findByPk(req.params.teamId);
    if (!team || team.match_id !== match.id) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (team.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your team' });
    }

    const now = new Date();
    if (now >= matchLockTime(match) || match.status === 'live' || match.status === 'completed') {
      return res.status(400).json({ error: 'Contest is locked. Team can no longer be edited.' });
    }

    const { team_name, player_ids, captain_id, vice_captain_id } = req.body;
    const validation = await validateCricketSelection(match, player_ids, captain_id, vice_captain_id);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    await team.update({
      team_name: team_name || team.team_name,
      captain_id,
      vice_captain_id,
    });

    await TeamPlayer.destroy({ where: { team_id: team.id } });
    for (const p of validation.players) {
      await TeamPlayer.create({
        team_id: team.id,
        player_id: p.id,
        is_captain: p.id === captain_id,
        is_vice_captain: p.id === vice_captain_id,
        points_earned: 0,
      });
    }

    res.json({ success: true, message: 'Team updated successfully!', team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/my-teams
 * Returns user's created cricket teams
 */
router.get('/my-teams', authenticate, async (req, res) => {
  try {
    const teams = await CricketTeam.findAll({
      where: { user_id: req.user.id },
      include: [
        { model: CricketMatch, as: 'match' },
        { model: MatchContest, as: 'contest' },
        { model: CricketPlayer, as: 'captain' },
        { model: CricketPlayer, as: 'viceCaptain' },
        { model: CricketPlayer, as: 'players' },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/search
 * Search users by username or email for H2H challenges (§10)
 */
router.get('/users/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, users: [] });

    const users = await User.findAll({
      where: {
        id: { [Op.ne]: req.user.id },
        is_bot: false,
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { name: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'username', 'name', 'email'],
      limit: 10,
    });

    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username || u.name.replace(/\s+/g, '_').toLowerCase(),
      name: u.name,
      masked_email: u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    }));

    res.json({ success: true, users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/h2h/challenge
 * Initiate H2H challenge (§7 Type 3)
 */
router.post('/h2h/challenge', authenticate, async (req, res) => {
  try {
    const match_id = req.body.match_id;
    const receiver_id = req.body.receiver_id || req.body.opponent_id;
    const amount = req.body.amount || req.body.entry_fee;
    const team_id = req.body.team_id || null;

    if (!receiver_id) return res.status(400).json({ error: 'Challenger opponent is required' });
    if (!team_id) return res.status(400).json({ error: 'Create your team before sending an H2H challenge.' });
    if (!amount || Number(amount) < 10) return res.status(400).json({ error: 'Minimum H2H amount is ₹10' });

    const receiver = await User.findByPk(receiver_id);
    if (!receiver) return res.status(404).json({ error: 'Challenger user not found' });

    const senderUsername = req.user.username || req.user.name;
    const receiverUsername = receiver.username || receiver.name;

    const result = await createH2HChallenge({
      matchId: match_id,
      senderId: req.user.id,
      senderUsername,
      receiverId: receiver.id,
      receiverUsername,
      amount,
      senderTeamId: team_id,
    });

    res.json({
      success: true,
      message: `H2H challenge of ₹${amount} sent to @${receiverUsername}!`,
      challenge: result.challenge,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/h2h/pending
 * Pending challenge for receiver popup on login / home (§7)
 */
router.get('/h2h/pending', authenticate, async (req, res) => {
  try {
    const challenge = await H2HChallenge.findOne({
      where: { receiver_id: req.user.id, status: 'pending' },
      include: [{ model: CricketMatch, as: 'match' }],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/h2h/:id/accept
 * Accept H2H Challenge with wallet balance check (§7)
 */
router.post('/h2h/:id/accept', authenticate, async (req, res) => {
  try {
    const result = await acceptH2HChallenge({
      challengeId: req.params.id,
      receiverId: req.user.id,
    });

    res.json({
      success: true,
      message: 'Challenge accepted! Proceed to pick your winning XI.',
      challenge: result.challenge,
      contest: result.contest,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/h2h/:id/reject
 * Reject / Give Up H2H Challenge (§7)
 */
router.post('/h2h/:id/reject', authenticate, async (req, res) => {
  try {
    const result = await rejectH2HChallenge({
      challengeId: req.params.id,
      userId: req.user.id,
    });

    res.json({ success: true, message: result.message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/matches/:id & /api/cricket/matches/:id
 * Bulletproof deletion of match under any condition
 */
router.delete('/matches/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await deleteMatchPermanently(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/cricket/matches/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await deleteMatchPermanently(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRIVATE CONTESTS (invite code) ───
function generateInviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /matches/:matchId/private-contests — create a private contest
router.post('/matches/:matchId/private-contests', authenticate, async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const now = new Date();
    if (now >= new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000)) {
      return res.status(400).json({ error: 'Contest creation is locked. Match starts shortly!' });
    }

    const { title, entry_fee, total_spots } = req.body;
    const fee = Math.max(0, parseFloat(entry_fee) || 0);
    const spots = Math.min(100, Math.max(2, parseInt(total_spots, 10) || 2));
    const name = (title || '').trim() || 'Private Contest';

    const prizePool = Math.round(fee * spots * 0.9 * 100) / 100;

    let inviteCode = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const clash = await MatchContest.findOne({ where: { invite_code: inviteCode, is_private: true } });
      if (!clash) break;
      inviteCode = generateInviteCode();
    }

    const contest = await MatchContest.create({
      match_id: match.id,
      type: 'private',
      title: name,
      prize_pool: prizePool,
      entry_fee: fee,
      total_spots: spots,
      filled_spots: 0,
      is_active: true,
      is_private: true,
      invite_code: inviteCode,
      creator_id: req.user.id,
      status: 'open',
    });

    res.json({ success: true, contest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /matches/:matchId/private-contests — my private contests for a match (created or joined)
router.get('/matches/:matchId/private-contests', authenticate, async (req, res) => {
  try {
    const contests = await MatchContest.findAll({
      where: { match_id: req.params.matchId, is_private: true, is_active: true },
      order: [['created_at', 'DESC']],
    });

    const myTeams = await CricketTeam.findAll({
      where: { user_id: req.user.id, match_id: req.params.matchId },
      attributes: ['contest_id'],
    });
    const joinedContestIds = new Set(myTeams.map((t) => t.contest_id).filter(Boolean));

    const mine = contests.filter((c) => c.creator_id === req.user.id);
    const joined = contests.filter((c) => c.creator_id !== req.user.id && joinedContestIds.has(c.id));

    res.json({
      success: true,
      created: mine,
      joined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /contests/private/:code — resolve an invite code
router.get('/contests/private/:code', authenticate, async (req, res) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code || code.length < 6) return res.status(400).json({ error: 'Invalid invite code' });

    const contest = await MatchContest.findOne({ where: { invite_code: code, is_private: true, is_active: true } });
    if (!contest) return res.status(404).json({ error: 'No private contest found for this code' });

    const match = await CricketMatch.findByPk(contest.match_id);
    if (!match) return res.status(404).json({ error: 'Match for this contest not found' });

    if (contest.status !== 'open') return res.status(400).json({ error: `Contest is ${contest.status}` });
    if (contest.filled_spots >= contest.total_spots) return res.status(400).json({ error: 'Contest is full' });

    const now = new Date();
    if (now >= new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000)) {
      return res.status(400).json({ error: 'Contest is locked. Match starts shortly!' });
    }

    res.json({
      success: true,
      contest: {
        id: contest.id,
        title: contest.title,
        entry_fee: contest.entry_fee,
        prize_pool: contest.prize_pool,
        total_spots: contest.total_spots,
        filled_spots: contest.filled_spots,
        invite_code: contest.invite_code,
      },
      match: { id: match.id, title: match.title, team_a: match.team_a, team_b: match.team_b },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Deterministic rank-wise prize distribution.
 * Returns buckets { rank_from, rank_to, prize, percentage } where `prize` and
 * `percentage` are PER RANK (each rank inside the range wins the same amount) and
 * rank_to is clipped to the contest size. Per-rank amounts use the full ladder
 * range size so prizes stay monotonic regardless of contest size. Prizes are
 * floored to 2 decimals, guaranteeing the total distributed never exceeds the pool.
 *
 * Ladder (share of pool): rank 1 = 20%, 2-3 = 15%, 4-10 = 15%, 11-30 = 15%,
 * 31-60 = 12%, 61-100 = 8%, ranks beyond 100 share the 15% remainder.
 * Small contests: 1 -> winner 100%; 2 -> 90/10; <=10 -> top 3 get 50/30/20.
 */
function buildPrizeBreakup(prizePool, totalSpots) {
  const pool = Math.max(0, parseFloat(prizePool) || 0);
  const spots = Math.max(0, parseInt(totalSpots, 10) || 0);
  if (pool <= 0 || spots <= 0) return [];

  const floor2 = (n) => Math.floor((Number(n) || 0) * 100) / 100;
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // sharePct is the pool share for the FULL range [from..to] (fullCount ranks).
  const makeBucket = (from, to, sharePct, fullCount) => {
    const count = fullCount || (to - from + 1);
    const perRankPct = sharePct / count;
    return {
      rank_from: from,
      rank_to: Math.min(to, spots),
      prize: floor2((pool * perRankPct) / 100),
      percentage: round2(perRankPct),
    };
  };

  if (spots === 1) return [makeBucket(1, 1, 100, 1)];
  if (spots === 2) return [makeBucket(1, 1, 90, 1), makeBucket(2, 2, 10, 1)];
  if (spots <= 10) {
    const out = [makeBucket(1, 1, 50, 1), makeBucket(2, 2, 30, 1)];
    if (spots >= 3) out.push(makeBucket(3, 3, 20, 1));
    return out;
  }

  const ladder = [
    [1, 1, 20],
    [2, 3, 15],
    [4, 10, 15],
    [11, 30, 15],
    [31, 60, 12],
    [61, 100, 8],
  ];
  const out = [];
  let usedShare = 0;
  for (const [from, to, share] of ladder) {
    if (from > spots) break;
    out.push(makeBucket(from, to, share, to - from + 1));
    usedShare += share;
  }
  const remainder = 100 - usedShare;
  if (spots > 100 && remainder > 0) {
    out.push(makeBucket(101, spots, remainder, spots - 100));
  }
  return out;
}

/**
 * GET /api/contests/:id/prize-breakup
 * Public: deterministic prize breakup + current top-20 winners for a contest.
 */
router.get('/contests/:id/prize-breakup', async (req, res) => {
  try {
    const contest = await MatchContest.findByPk(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    const prizePool = parseFloat(contest.prize_pool) || 0;
    const totalSpots = parseInt(contest.total_spots, 10) || 0;
    const breakup = buildPrizeBreakup(prizePool, totalSpots);

    const topTeams = await CricketTeam.findAll({
      where: { contest_id: contest.id },
      order: [['total_points', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      limit: 20,
    });

    const winners = topTeams.map((team, idx) => {
      const rank = idx + 1;
      const bucket = breakup.find((b) => rank >= b.rank_from && rank <= b.rank_to);
      return {
        rank,
        team_name: team.team_name,
        user_name: team.user?.name || 'Player',
        points: team.total_points,
        prize: bucket ? bucket.prize : 0,
      };
    });

    res.json({
      success: true,
      contest: {
        id: contest.id,
        title: contest.title,
        prize_pool: prizePool,
        total_spots: totalSpots,
        filled_spots: contest.filled_spots,
        entry_fee: contest.entry_fee,
      },
      total_prize: prizePool,
      breakup,
      winners,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

