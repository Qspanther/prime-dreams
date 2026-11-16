const { Client } = require('pg');

async function testPostgresConnection(connectionString) {
  if (!connectionString) return false;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (err) {
    console.warn('⚠️ Cloud PostgreSQL pre-flight check failed:', err.message);
    try { await client.end(); } catch (_) {}
    return false;
  }
}

// Support execution via child process for synchronous verification on boot
if (require.main === module) {
  const url = process.argv[2] || process.env.DATABASE_URL;
  testPostgresConnection(url).then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { testPostgresConnection };
