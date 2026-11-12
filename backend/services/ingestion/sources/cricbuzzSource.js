// 🏏 PRIME DREEMS — CRICBUZZ PRIMARY INGESTION SOURCE
// Extracts live fixtures, real-time ball telemetry, and schedules directly from Cricbuzz

const https = require('https');
const playerSnapshotCache = new Map();
const squadCache = new Map();

function extractJsonObject(text, fromIndex) {
  const start = text.indexOf('{', fromIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJsonArray(text, fromIndex) {
  const start = text.indexOf('[', fromIndex);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function roleFromSquad(role, keeper = false) {
  const normalized = String(role || '').toLowerCase();
  if (keeper || normalized.includes('keeper') || normalized.startsWith('wk')) return 'WK';
  if (normalized.includes('all')) return 'AR';
  if (normalized.includes('bowl')) return 'BOWL';
  return 'BAT';
}

function emptyPlayerStats() {
  return {
    runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0,
    overs: 0, runs_conceded: 0, catches: 0, stumpings: 0,
    runouts_direct: 0, runouts_indirect: 0, is_out: false,
  };
}

function oversAsBallFraction(value) {
  const text = String(value || 0);
  const [wholePart, ballsPart = '0'] = text.split('.');
  const whole = Math.max(0, Number(wholePart) || 0);
  const balls = Math.max(0, Math.min(5, Number(ballsPart) || 0));
  return whole + balls / 6;
}

async function fetchMatchSquad(rawId, scorecardHtml, scorecardData) {
  const cached = squadCache.get(String(rawId));
  if (cached && cached.expiresAt > Date.now()) return cached.players;

  const matchPath = scorecardHtml.match(new RegExp(`href="(/cricket-match-squads/${rawId}/[^"?#]+)"`))?.[1];
  if (!matchPath) return cached?.players || [];

  const squadHtml = await fetchWithBackoff(`https://www.cricbuzz.com${matchPath}`, 1);
  const squadData = decodeNextData(squadHtml);
  const teamNames = new Map([
    [String(scorecardData.matchHeader?.team1?.id || ''), scorecardData.matchHeader?.team1?.name],
    [String(scorecardData.matchHeader?.team2?.id || ''), scorecardData.matchHeader?.team2?.name],
  ]);
  const playersById = new Map();
  const listMarker = /"playing XI"\s*:/gi;
  let marker;
  while ((marker = listMarker.exec(squadData)) !== null) {
    try {
      const list = JSON.parse(extractJsonArray(squadData, marker.index + marker[0].length - 1) || '[]');
      for (const player of list) {
        const id = player.id == null ? null : String(player.id);
        const name = String(player.fullName || player.name || '').trim();
        if (!id || !name) continue;
        playersById.set(id, {
          external_id: id,
          name,
          team_name: teamNames.get(String(player.teamId)) || player.teamName || 'Unknown',
          role: roleFromSquad(player.role, player.keeper),
        });
      }
    } catch (_) { /* Ignore malformed individual squad blocks. */ }
  }

  const players = [...playersById.values()];
  squadCache.set(String(rawId), { players, expiresAt: Date.now() + 90000 });
  return players;
}

/** Fetch the official scorecard snapshot used by the ball-by-ball points board. */
async function fetchLivePlayerSnapshot(rawId) {
  if (!rawId) return null;
  const key = String(rawId);
  const cached = playerSnapshotCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  try {
    const html = await fetchWithBackoff(`https://www.cricbuzz.com/live-cricket-scorecard/${key}`, 1);
    const decoded = decodeNextData(html);
    const marker = '"scorecardApiData":';
    const markerIndex = decoded.indexOf(marker);
    if (markerIndex === -1) throw new Error('Scorecard data is not available yet.');
    const rawScorecard = extractJsonObject(decoded, markerIndex + marker.length);
    const scorecard = rawScorecard ? JSON.parse(rawScorecard) : null;
    if (!scorecard || !Array.isArray(scorecard.scoreCard)) throw new Error('Scorecard innings are unavailable.');

    let players = [];
    try { players = await fetchMatchSquad(key, html, scorecard); }
    catch (error) { console.warn(`[Cricbuzz] Playing XI unavailable for ${key}: ${error.message}`); }
    const playerMap = new Map(players.map(player => [player.external_id, { ...player, stats: emptyPlayerStats() }]));
    const ensurePlayer = (externalId, name, teamName, role) => {
      if (externalId == null || !name) return null;
      const id = String(externalId);
      if (!playerMap.has(id)) {
        playerMap.set(id, {
          external_id: id,
          name: String(name).trim(),
          team_name: teamName || 'Unknown',
          role: role || 'BAT',
          stats: emptyPlayerStats(),
        });
      }
      return playerMap.get(id);
    };

    for (const innings of scorecard.scoreCard) {
      const batting = innings.batTeamDetails || {};
      const bowling = innings.bowlTeamDetails || {};
      for (const batter of Object.values(batting.batsmenData || {})) {
        const player = ensurePlayer(batter.batId, batter.batName, batting.batTeamName, roleFromSquad('', batter.isKeeper));
        if (!player) continue;
        const stats = player.stats;
        stats.runs += Number(batter.runs) || 0;
        stats.balls += Number(batter.balls) || 0;
        stats.fours += Number(batter.fours) || 0;
        stats.sixes += Number(batter.sixes) || 0;
        if (batter.outDesc && !/^(batting|not out|did not bat|retired hurt)$/i.test(String(batter.outDesc).trim())) stats.is_out = true;
        if (String(batter.wicketCode || '').toUpperCase() === 'CAUGHT' && Number(batter.fielderId1) > 0) {
          const fielder = playerMap.get(String(batter.fielderId1));
          if (fielder) fielder.stats.catches += 1;
        }
      }
      for (const bowler of Object.values(bowling.bowlersData || {})) {
        const player = ensurePlayer(bowler.bowlerId, bowler.bowlName, bowling.bowlTeamName, roleFromSquad('Bowler'));
        if (!player) continue;
        player.stats.wickets += Number(bowler.wickets) || 0;
        player.stats.maidens += Number(bowler.maidens) || 0;
        player.stats.overs += oversAsBallFraction(bowler.overs);
        player.stats.runs_conceded += Number(bowler.runs) || 0;
      }
    }

    const snapshot = {
      players: [...playerMap.values()],
      source_updated_at: scorecard.responseLastUpdated || null,
    };
    playerSnapshotCache.set(key, { snapshot, expiresAt: Date.now() + 5000 });
    if (players.length) squadCache.set(key, { players, expiresAt: Date.now() + 90000 });
    return snapshot;
  } catch (error) {
    console.warn(`[Cricbuzz] Live player scorecard unavailable for ${key}: ${error.message}`);
    return cached?.snapshot || null;
  }
}

function decodeNextData(html) {
  const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let fullStr = '';
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      fullStr += JSON.parse('"' + match[1] + '"');
    } catch (_) {
      fullStr += match[1];
    }
  }
  return fullStr;
}

function getLatestInnings(teamScore) {
  return Object.values(teamScore || {})
    .filter(item => item && Number.isFinite(Number(item.inningsId)) && Number.isFinite(Number(item.runs)))
    .sort((a, b) => Number(a.inningsId) - Number(b.inningsId))
    .at(-1) || null;
}

function getScorecardHtmlInnings(html, teamA, teamACode, teamB, teamBCode) {
  const innings = { team_a: [], team_b: [] };
  const headerRegex = /bg-cbGrnCyn text-cbWhite">/g;
  const clean = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let header;
  while ((header = headerRegex.exec(html)) !== null) {
    const block = html.slice(header.index, header.index + 1000);
    const headingEnd = block.indexOf('</div>');
    const heading = block.slice(0, headingEnd === -1 ? 250 : headingEnd + 6).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const inningNumber = Number(heading.match(/\b(\d+)(?:st|nd|rd|th)\s+Innings/i)?.[1]);
    const score = block.match(/<span class="font-bold">([\d,]+)-(\d+)(?:\s*(d))?<\/span>/);
    const overs = block.match(/\(([\d.]+)\s*Ov\)/);
    if (!inningNumber || !score || !overs) continue;
    const normalizedHeading = clean(heading);
    const side = normalizedHeading.includes(clean(teamA)) || normalizedHeading.includes(clean(teamACode))
      ? 'team_a'
      : normalizedHeading.includes(clean(teamB)) || normalizedHeading.includes(clean(teamBCode))
        ? 'team_b'
        : null;
    if (!side) continue;
    innings[side].push({
      inningsId: inningNumber,
      runs: Number(score[1].replace(/,/g, '')),
      wickets: Number(score[2]),
      overs: Number(overs[1]),
      isDeclared: score[3] === 'd',
    });
  }
  const latest = values => values.sort((a, b) => a.inningsId - b.inningsId).at(-1) || null;
  return { team_a: latest(innings.team_a), team_b: latest(innings.team_b) };
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 8000
    };
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(totalTimeout);
        resolve({ status: res.statusCode, data });
      });
    });
    const totalTimeout = setTimeout(() => req.destroy(new Error('Cricbuzz fetch timeout')), options.timeout);
    req.on('error', error => {
      clearTimeout(totalTimeout);
      reject(error);
    });
    req.on('timeout', () => req.destroy(new Error('Cricbuzz fetch timeout')));
  });
}

/**
 * Fetch with Exponential Backoff (2s, 4s, 8s)
 */
async function fetchWithBackoff(url, retries = 3) {
  let delay = 2000;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchUrl(url);
      if (res.status === 200) return res.data;
      throw new Error(`Cricbuzz HTTP ${res.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

/**
 * Fetch and extract all live matches from Cricbuzz live-scores stream
 */
async function fetchLiveFeed() {
  const html = await fetchWithBackoff('https://www.cricbuzz.com/cricket-match/live-scores');

  // Next.js hydration parser
  const fullStr = decodeNextData(html);

  const infoRegex = /\{"matchId":(\d+),"seriesId":(\d+),"seriesName":"([^"]+)","matchDesc":"([^"]+)","matchFormat":"([^"]+)","startDate":(\d+|"[^"]+"),"endDate":(\d+|"[^"]+"),"state":"([^"]+)","status":"([^"]+)"[\s\S]*?"team1":\{"teamId":(\d+),"teamName":"([^"]+)","teamSName":"([^"]+)"[\s\S]*?"team2":\{"teamId":(\d+),"teamName":"([^"]+)","teamSName":"([^"]+)"/g;

  const matches = [];
  const seenIds = new Set();
  let mi;

  while ((mi = infoRegex.exec(fullStr)) !== null) {
    const rawId = mi[1];
    if (seenIds.has(rawId)) continue;
    seenIds.add(rawId);

    const seriesName = mi[3];
    const matchDesc = mi[4];
    const format = mi[5];
    const startDate = mi[6];
    const endDate = mi[7];
    const state = mi[8];
    const status = mi[9];
    const team1Id = Number(mi[10]);
    const team1 = mi[11];
    const team1Code = mi[12];
    const team2Id = Number(mi[13]);
    const team2 = mi[14];
    const team2Code = mi[15];

    let score1 = { runs: 0, wickets: 0, overs: 0 };
    let score2 = { runs: 0, wickets: 0, overs: 0 };
    let currentBattingTeamId = null;
    let venue = null;
    let scoreDataAvailable = false;

    const scoreIdx = fullStr.indexOf(`"matchId":${rawId}`);
    if (scoreIdx !== -1) {
      const nextMatchIdx = fullStr.indexOf('"matchId":', scoreIdx + 10);
      const chunk = fullStr.slice(scoreIdx, nextMatchIdx === -1 ? scoreIdx + 10000 : nextMatchIdx);
      const readObject = (key) => {
        const keyIdx = chunk.indexOf(`"${key}":`);
        if (keyIdx === -1) return null;
        try {
          const rawObject = extractJsonObject(chunk, keyIdx);
          return rawObject ? JSON.parse(rawObject) : null;
        } catch (_) {
          return null;
        }
      };

      const findLatestInnings = (teamKey, teamScore) => {
        let latest = getLatestInnings(teamScore);
        let innings = latest ? [latest] : [];
        if (innings.length === 0) {
          const scoreKey = `"${teamKey}Score":`;
          const scoreStart = chunk.indexOf(scoreKey);
          if (scoreStart !== -1) {
            const nextTeam = teamKey === 'team1' ? '"team2Score":' : '"matchTeam":';
            const nextTeamStart = chunk.indexOf(nextTeam, scoreStart + scoreKey.length);
            const scoreChunk = chunk.slice(scoreStart, nextTeamStart === -1 ? chunk.length : nextTeamStart);
            innings = [...scoreChunk.matchAll(/"inngs(\d+)":\{"inningsId":(\d+),"runs":(\d+),"wickets":(\d+),"overs":([0-9.]+)(?:,"isDeclared":(true|false))?/g)]
              .map(item => ({
                inningsId: Number(item[2]),
                runs: Number(item[3]),
                wickets: Number(item[4]),
                overs: Number(item[5]),
                isDeclared: item[6] === 'true',
              }))
              .sort((a, b) => a.inningsId - b.inningsId);
          }
        }
        latest = innings.at(-1);
        if (!latest) return null;
        scoreDataAvailable = true;
        return {
          runs: Number(latest.runs),
          wickets: Number(latest.wickets) || 0,
          overs: Number(latest.overs) || 0,
          ...(latest.isDeclared ? { declared: true } : {}),
        };
      };

      const matchScore = readObject('matchScore');
      score1 = findLatestInnings('team1', matchScore?.team1Score) || score1;
      score2 = findLatestInnings('team2', matchScore?.team2Score) || score2;
      currentBattingTeamId = Number(chunk.match(/"currBatTeamId":(\d+)/)?.[1]) || null;
      const venueInfo = readObject('venueInfo');
      if (venueInfo?.ground) venue = `${venueInfo.ground}${venueInfo.city ? `, ${venueInfo.city}` : ''}`;
      else {
        const ground = chunk.match(/"venueInfo":\{"id":\d+,"ground":"([^"\\]*(?:\\.[^"\\]*)*)","city":"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (ground) venue = `${JSON.parse(`"${ground[1]}"`)}${ground[2] ? `, ${JSON.parse(`"${ground[2]}"`)}` : ''}`;
      }
    }

    let category = 'League';
    if (seriesName.toLowerCase().includes('world cup')) category = 'World Cup';
    else if (seriesName.toLowerCase().includes('women') || team1.toLowerCase().includes('women')) category = "Women's";
    else if (format.toUpperCase() === 'T20' || matchDesc.toUpperCase().includes('T20')) category = 'T20';

    const normalizedState = state.toLowerCase();
    const isAbandoned = /abandon|cancel|no result/i.test(status);
    const isPaused = /stumps|lunch|tea|rain|weather|delay|bad light|break/i.test(status);
    const matchStatus = isAbandoned
      ? 'abandoned'
      : normalizedState === 'complete' || normalizedState === 'completed'
        ? 'completed'
        : (normalizedState === 'in progress' || normalizedState === 'innings break') && !isPaused && scoreDataAvailable
          ? 'live'
          : 'upcoming';
    const startTimeMs = Number(String(startDate).replace(/^"|"$/g, '')) || null;
    const currentInnings = currentBattingTeamId === team1Id
      ? 'team_a'
      : currentBattingTeamId === team2Id
        ? 'team_b'
        : score2.runs > 0 ? 'team_b' : 'team_a';

    matches.push({
      cricbuzz_id: 'cb-' + rawId,
      raw_id: rawId,
      title: `${team1} vs ${team2} — ${matchDesc}`,
      series: seriesName,
      category,
      team_a: team1,
      team_a_id: team1Id,
      team_a_code: team1Code,
      team_b: team2,
      team_b_id: team2Id,
      team_b_code: team2Code,
      venue,
      start_time_ms: startTimeMs,
      end_time_ms: Number(String(endDate).replace(/^"|"$/g, '')) || null,
      current_batting_team_id: currentBattingTeamId,
      score_data_available: scoreDataAvailable,
      status: matchStatus,
      match_format: `${format} • Cricket`,
      cricbuzz_status: status,
      cricbuzz_state: state,
      score_summary: {
        team_a: score1,
        team_b: score2,
        current_innings: currentInnings,
      },
      live_commentary: status,
    });
  }

  // Some Cricbuzz live-scores responses omit matchScore in the hydration payload.
  // Fetch the official scorecard for those in-progress fixtures before classifying them.
  const scorecardFallbacks = matches.filter(match =>
    !match.score_data_available && /in progress|innings break/i.test(match.cricbuzz_state || '')
  );
  await Promise.all(scorecardFallbacks.map(async match => {
    try {
      const scorecardHtml = await fetchWithBackoff(`https://www.cricbuzz.com/live-cricket-scorecard/${match.raw_id}`, 2);
      const scorecardData = decodeNextData(scorecardHtml);
      const matchMarker = `"matchId":${match.raw_id}`;
      let matchIndex = scorecardData.indexOf(matchMarker);
      if (matchIndex === -1) {
        console.warn(`[Cricbuzz] Scorecard response for ${match.raw_id} had no hydrated match data (HTTP body ${scorecardHtml.length} chars).`);
        return;
      }
      let chunk = '';
      let scoreIndex = -1;
      while (matchIndex !== -1) {
        const nextMatchIndex = scorecardData.indexOf('"matchId":', matchIndex + matchMarker.length);
        const candidate = scorecardData.slice(matchIndex, nextMatchIndex === -1 ? matchIndex + 30000 : nextMatchIndex);
        const candidateScoreIndex = candidate.indexOf('"matchScore":');
        if (candidateScoreIndex !== -1) {
          chunk = candidate;
          scoreIndex = candidateScoreIndex;
          break;
        }
        matchIndex = scorecardData.indexOf(matchMarker, matchIndex + matchMarker.length);
      }
      const matchScoreJson = scoreIndex === -1 ? null : extractJsonObject(chunk, scoreIndex);
      const matchScore = matchScoreJson ? JSON.parse(matchScoreJson) : null;
      let teamA = getLatestInnings(matchScore?.team1Score);
      let teamB = getLatestInnings(matchScore?.team2Score);
      if (!teamA && !teamB) {
        const htmlScores = getScorecardHtmlInnings(scorecardHtml, match.team_a, match.team_a_code, match.team_b, match.team_b_code);
        teamA = htmlScores.team_a;
        teamB = htmlScores.team_b;
      }
      if (!teamA && !teamB) {
        console.warn(`[Cricbuzz] Scorecard response for ${match.raw_id} had no parseable JSON or HTML innings scores.`);
        return;
      }
      const teamAId = Number(chunk.match(/"team1":\{"teamId":(\d+)/)?.[1]) || match.team_a_id;
      const teamBId = Number(chunk.match(/"team2":\{"teamId":(\d+)/)?.[1]) || match.team_b_id;
      const currentBattingTeamId = Number(chunk.match(/"currBatTeamId":(\d+)/)?.[1]) || match.current_batting_team_id || null;
      const toScore = innings => innings ? {
        runs: Number(innings.runs),
        wickets: Number(innings.wickets) || 0,
        overs: Number(innings.overs) || 0,
        ...(innings.isDeclared ? { declared: true } : {}),
      } : { runs: 0, wickets: 0, overs: 0 };
      match.score_summary = {
        team_a: toScore(teamA),
        team_b: toScore(teamB),
        current_innings: currentBattingTeamId === teamBId ? 'team_b' : currentBattingTeamId === teamAId ? 'team_a' : teamB ? 'team_b' : 'team_a',
      };
      match.current_batting_team_id = currentBattingTeamId;
      match.score_data_available = true;
      if (match.cricbuzz_state.toLowerCase() === 'in progress' && !/stumps|lunch|tea|rain|weather|delay|bad light|break/i.test(match.cricbuzz_status || '')) {
        match.status = 'live';
      }
      console.info(`[Cricbuzz] Scorecard fallback loaded scores for match ${match.raw_id}.`);
      const venueIndex = chunk.indexOf('"venueInfo":');
      if (venueIndex !== -1) {
        const venueJson = extractJsonObject(chunk, venueIndex);
        const venueInfo = venueJson ? JSON.parse(venueJson) : null;
        if (venueInfo?.ground) match.venue = `${venueInfo.ground}${venueInfo.city ? `, ${venueInfo.city}` : ''}`;
      }
    } catch (error) {
      console.warn(`[Cricbuzz] Scorecard fallback failed for ${match.raw_id}: ${error.message}`);
    }
  }));

  return matches;
}

module.exports = {
  fetchLiveFeed,
  fetchLivePlayerSnapshot,
};

