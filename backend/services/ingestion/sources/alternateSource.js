// 🏏 PRIME DREEMS — SECONDARY / ALTERNATE VERIFICATION SOURCE
// Section 2.1: Secondary cross-check against alternate mirror / mobile endpoint

const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/json,*/*',
      },
      timeout: 6000
    };
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Secondary timeout'));
    });
  });
}

/**
 * Secondary cross-check verification fetcher
 */
async function fetchSecondaryMatchScore(rawMatchId) {
  try {
    const url = `https://m.cricbuzz.com/cricket-match/${rawMatchId}`;
    const res = await fetchUrl(url);
    if (res.status !== 200) {
      return { available: false, reason: `HTTP ${res.status}` };
    }

    // Match runs and wickets patterns from mobile HTML
    const scoreRegex = /(\d+)\/(\d+)\s*\(([0-9.]+)\s*ov\)/i;
    const match = res.data.match(scoreRegex);
    if (match) {
      return {
        available: true,
        runs: parseInt(match[1], 10),
        wickets: parseInt(match[2], 10),
        overs: parseFloat(match[3]),
      };
    }

    return { available: false, reason: 'Score pattern not found in mobile HTML' };
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

module.exports = {
  fetchSecondaryMatchScore,
};

