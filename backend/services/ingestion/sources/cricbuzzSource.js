// 🏏 PRIME DREEMS — CRICBUZZ PRIMARY INGESTION SOURCE
// Extracts live fixtures, real-time ball telemetry, and schedules directly from Cricbuzz

const https = require('https');

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
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Cricbuzz fetch timeout'));
    });
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
  const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let fullStr = '';
  let m;
  while ((m = regex.exec(html)) !== null) {
    try {
      fullStr += JSON.parse('"' + m[1] + '"');
    } catch (e) {
      fullStr += m[1];
    }
  }

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
    const state = mi[8];
    const status = mi[9];
    const team1 = mi[11];
    const team1Code = mi[12];
    const team2 = mi[14];
    const team2Code = mi[15];

    let score1 = { runs: 0, wickets: 0, overs: 0 };
    let score2 = { runs: 0, wickets: 0, overs: 0 };

    const scoreIdx = fullStr.indexOf(`"matchId":${rawId}`);
    if (scoreIdx !== -1) {
      const chunk = fullStr.slice(scoreIdx, scoreIdx + 1200);
      const s1m = chunk.match(/"team1Score":\{"inngs1":\{"inningsId":\d+,"runs":(\d+),"wickets":(\d+),"overs":([0-9.]+)\}/);
      if (s1m) score1 = { runs: Number(s1m[1]), wickets: Number(s1m[2]), overs: Number(s1m[3]) };
      const s2m = chunk.match(/"team2Score":\{"inngs1":\{"inningsId":\d+,"runs":(\d+),"wickets":(\d+),"overs":([0-9.]+)\}/);
      if (s2m) score2 = { runs: Number(s2m[1]), wickets: Number(s2m[2]), overs: Number(s2m[3]) };
    }

    let category = 'League';
    if (seriesName.toLowerCase().includes('world cup')) category = 'World Cup';
    else if (seriesName.toLowerCase().includes('women') || team1.toLowerCase().includes('women')) category = "Women's";
    else if (format.toUpperCase() === 'T20' || matchDesc.toUpperCase().includes('T20')) category = 'T20';

    const isLive = state.toLowerCase() === 'in progress' || state.toLowerCase() === 'innings break';

    matches.push({
      cricbuzz_id: 'cb-' + rawId,
      raw_id: rawId,
      title: `${team1} vs ${team2} — ${matchDesc}`,
      series: seriesName,
      category,
      team_a: team1,
      team_a_code: team1Code,
      team_b: team2,
      team_b_code: team2Code,
      venue: `${team1} International Stadium`,
      status: isLive ? 'live' : 'upcoming',
      match_format: `${format} • Cricket`,
      cricbuzz_status: status,
      cricbuzz_state: state,
      score_summary: {
        team_a: score1,
        team_b: score2,
        current_innings: score2.runs > 0 ? 'team_b' : 'team_a',
      },
      live_commentary: status,
    });
  }

  return matches;
}

module.exports = {
  fetchLiveFeed,
};

