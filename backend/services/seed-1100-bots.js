// Backward compatibility wrapper for seed-10000-bots
const { seedBots } = require('./seed-10000-bots');

module.exports = { seedBots };

if (require.main === module) {
  const target = process.argv[2] ? parseInt(process.argv[2]) : 10000;
  seedBots(target).then(() => process.exit(0)).catch(err => {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  });
}
