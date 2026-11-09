// 🏏 PRIME DREEMS — CRICKET & CONTEST API ROUTES

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { 
  CricketMatch, CricketPlayer, MatchContest, 
  CricketTeam, TeamPlayer, H2HChallenge, User, Wallet 
} = require('../db/models');
const { authenticate, isAdmin } = require('../middleware/auth');
const config = require('../config');
const { syncLiveMatch, getCachedMatchLive } = require('../services/cricbuzzService');
const { createH2HChallenge, acceptH2HChallenge, rejectH2HChallenge, handleBattlefieldFill } = require('../services/contestService');
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
        { model: MatchContest, as: 'contests', where: { is_active: true }, required: false },
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
 * GET /api/matches/:id
 * Single match detail with 30-player pool (15 Team A + 15 Team B)
 */
router.get('/matches/:id', async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id, {
      include: [
        { model: CricketPlayer, as: 'players' },
        { model: MatchContest, as: 'contests', where: { is_active: true }, required: false },
      ],
    });

    if (!match) return res.status(404).json({ error: 'Match not found' });

    const now = new Date();
    const lockTime = new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000);
    const isLocked = now >= lockTime;

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
        players: match.players || [],
        contests: match.contests || [],
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
 * POST /api/matches/:id/teams
 * Create 11-player fantasy team (§4)
 */
async function validateCricketSelection(match, player_ids, captain_id, vice_captain_id) {
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
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    // Lock check (§15)
    const now = new Date();
    if (now >= matchLockTime(match)) {
      return res.status(400).json({ error: 'Contest selection is locked. Match starts shortly!' });
    }

    const { team_name, player_ids, captain_id, vice_captain_id, contest_id } = req.body;

    const validation = await validateCricketSelection(match, player_ids, captain_id, vice_captain_id);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }
    const players = validation.players;

    // Handle contest entry fee deduction if contest_id provided
    let contest = null;
    if (contest_id) {
      contest = await MatchContest.findByPk(contest_id);
      if (contest && contest.entry_fee > 0) {
        const wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
        if (!wallet || wallet.balance < contest.entry_fee) {
          return res.status(400).json({ error: `Insufficient wallet balance. Contest entry fee is ₹${contest.entry_fee}.` });
        }
        await wallet.update({ balance: wallet.balance - contest.entry_fee });
        await require('../db/models').Transaction.create({
          wallet_id: wallet.id,
          amount: -contest.entry_fee,
          type: 'contest_entry',
          description: `Entry fee for "${contest.title}"`,
        });
        await contest.update({ filled_spots: contest.filled_spots + 1 });
        await handleBattlefieldFill(contest);
      }
    }

    // Create Team
    const newTeam = await CricketTeam.create({
      user_id: req.user.id,
      match_id: match.id,
      contest_id: contest_id || null,
      team_name: team_name || 'My Prime XI',
      captain_id,
      vice_captain_id,
      total_points: 0,
    });

    // Create Team Players mapping
    for (const p of players) {
      await TeamPlayer.create({
        team_id: newTeam.id,
        player_id: p.id,
        is_captain: p.id === captain_id,
        is_vice_captain: p.id === vice_captain_id,
        points_earned: 0,
      });
    }

    res.json({
      success: true,
      message: 'Team successfully submitted! Best of luck 🏏',
      team: newTeam,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

module.exports = router;

