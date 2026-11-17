const { CricketMatch, MatchContest, CricketTeam } = require('../db/models');
const { Op } = require('sequelize');

async function sanitizeContests() {
  console.log('⚡ Starting contest sanitization for Prime Dreems...');

  // 1. Deactivate / remove H2H, Private, Practice, and Rookie contests
  const removeContests = await MatchContest.findAll({
    where: {
      [Op.or]: [
        { type: 'h2h' },
        { type: 'private' },
        { is_private: true },
        { type: 'practice' },
        { title: { [Op.iLike]: '%h2h%' } },
        { title: { [Op.iLike]: '%head%to%head%' } },
        { title: { [Op.iLike]: '%practice%' } },
        { title: { [Op.iLike]: '%rookie%' } },
        { title: { [Op.iLike]: '%winner takes all%' } },
      ]
    }
  });

  console.log(`Found ${removeContests.length} obsolete / unwanted contests to remove.`);
  for (const c of removeContests) {
    // Delete teams tied to these contests or update them
    await CricketTeam.destroy({ where: { contest_id: c.id } });
    await c.destroy();
  }

  // 2. For every match, ensure exactly the 3 allowed contests exist:
  // - Mega Contest
  // - Battleground (multi_battlefield)
  // - Mini Contest (mini)
  const matches = await CricketMatch.findAll();
  console.log(`Auditing ${matches.length} matches...`);

  for (const m of matches) {
    const existing = await MatchContest.findAll({ where: { match_id: m.id } });

    // Check Mega
    let mega = existing.find(c => c.type === 'mega' || /mega/i.test(c.title));
    if (!mega) {
      mega = await MatchContest.create({
        match_id: m.id,
        type: 'mega',
        title: `Mega Grand League (${m.category || 'T20'})`,
        prize_pool: 100000,
        entry_fee: 0,
        total_spots: 2500,
        filled_spots: 1840,
        bot_spots: 1840,
        is_active: true,
        is_private: false,
        status: m.status === 'live' || m.status === 'completed' ? 'locked' : 'open',
      });
      console.log(`+ Created Mega Contest for ${m.title}`);
    } else {
      // Clean title
      const cleanTitle = mega.title.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
      await mega.update({
        title: cleanTitle.includes('Mega') ? cleanTitle : `Mega Contest (${cleanTitle})`,
        type: 'mega',
        is_private: false,
        entry_fee: 0,
        total_spots: Math.max(1000, mega.total_spots || 2500),
      });
    }

    // Check Battleground
    let bg = existing.find(c => c.type === 'multi_battlefield' || /battlefield|battleground/i.test(c.title));
    if (!bg) {
      bg = await MatchContest.create({
        match_id: m.id,
        type: 'multi_battlefield',
        title: `Battleground Arena Room #1 (${m.category || 'T20'})`,
        prize_pool: 2500,
        entry_fee: 0,
        total_spots: 25,
        filled_spots: 18,
        spots_per_battlefield: 25,
        battlefield_number: 1,
        bot_spots: 18,
        is_active: true,
        is_private: false,
        status: m.status === 'live' || m.status === 'completed' ? 'locked' : 'open',
      });
      console.log(`+ Created Battleground Room for ${m.title}`);
    } else {
      const cleanTitle = bg.title.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
      await bg.update({
        title: cleanTitle.includes('Battleground') || cleanTitle.includes('Battlefield') ? cleanTitle : `Battleground Room #1 (${cleanTitle})`,
        type: 'multi_battlefield',
        is_private: false,
        entry_fee: 0,
        total_spots: 25,
      });
    }

    // Check Mini Contest
    let mini = existing.find(c => c.type === 'mini' || /mini/i.test(c.title));
    if (!mini) {
      mini = await MatchContest.create({
        match_id: m.id,
        type: 'mini',
        title: `Mini League Contest (${m.category || 'T20'})`,
        prize_pool: 5000,
        entry_fee: 0,
        total_spots: 100,
        filled_spots: 65,
        bot_spots: 65,
        is_active: true,
        is_private: false,
        status: m.status === 'live' || m.status === 'completed' ? 'locked' : 'open',
      });
      console.log(`+ Created Mini Contest for ${m.title}`);
    } else {
      const cleanTitle = mini.title.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
      await mini.update({
        title: cleanTitle.includes('Mini') ? cleanTitle : `Mini League (${cleanTitle})`,
        type: 'mini',
        is_private: false,
        entry_fee: 0,
        total_spots: 100,
      });
    }
  }

  console.log('✅ Contest sanitization completed!');
  process.exit(0);
}

sanitizeContests().catch(err => {
  console.error('Error during sanitization:', err);
  process.exit(1);
});
