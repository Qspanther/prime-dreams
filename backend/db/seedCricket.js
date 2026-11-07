// 🏏 PRIME DREEMS — CRICKET DATABASE SEEDER
// Populates 4 Canonical Categories: World Cup, T20, League, Women's
// Each match with 30 Players (15 Team A + 15 Team B) & 3 Contest Types

const { CricketMatch, CricketPlayer, MatchContest, User, Wallet } = require('./models');

const MATCH_SQUADS = [
  {
    title: 'India vs Australia — World Cup Final',
    category: 'World Cup',
    team_a: 'India',
    team_a_code: 'IND',
    team_a_logo: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=120&h=120&q=80',
    team_b: 'Australia',
    team_b_code: 'AUS',
    team_b_logo: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=120&h=120&q=80',
    match_poster: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
    venue: 'Narendra Modi Stadium, Ahmedabad',
    status: 'live',
    match_date: 'Today',
    match_time: '19:30',
    start_time: new Date(Date.now() - 3600000), // started 1 hr ago (LIVE)
    lock_time_minutes: 15,
    score_summary: {
      team_a: { runs: 168, wickets: 3, overs: 17.4 },
      team_b: { runs: 0, wickets: 0, overs: 0.0 },
      current_innings: 'team_a',
    },
    live_data: {
      status_text: 'IND 168/3 (17.4 ov) • Current RR: 9.51',
      commentary: [
        '⚡ FOUR! Virat Kohli drives it through extra cover for a boundary!',
        '1 run, pushed to long-on by KL Rahul.',
        '🚀 SIX! Kohli steps out and sends Starc over long-off!',
        'No run, defended solidly off the back foot.',
      ],
    },
    players_a: [
      { name: 'Rohit Sharma', role: 'BAT', credits: 10.0, points: 48 },
      { name: 'Shubman Gill', role: 'BAT', credits: 9.0, points: 24 },
      { name: 'Virat Kohli', role: 'BAT', credits: 10.5, points: 76 },
      { name: 'Shreyas Iyer', role: 'BAT', credits: 8.5, points: 18 },
      { name: 'Suryakumar Yadav', role: 'BAT', credits: 9.0, points: 15 },
      { name: 'KL Rahul', role: 'WK', credits: 9.5, points: 42 },
      { name: 'Ishan Kishan', role: 'WK', credits: 8.5, points: 0 },
      { name: 'Hardik Pandya', role: 'AR', credits: 9.5, points: 52 },
      { name: 'Ravindra Jadeja', role: 'AR', credits: 9.0, points: 34 },
      { name: 'Axar Patel', role: 'AR', credits: 8.5, points: 12 },
      { name: 'Jasprit Bumrah', role: 'BOWL', credits: 10.0, points: 65 },
      { name: 'Mohammed Shami', role: 'BOWL', credits: 9.5, points: 58 },
      { name: 'Kuldeep Yadav', role: 'BOWL', credits: 8.5, points: 28 },
      { name: 'Mohammed Siraj', role: 'BOWL', credits: 8.5, points: 25 },
      { name: 'Arshdeep Singh', role: 'BOWL', credits: 8.0, points: 0 },
    ],
    players_b: [
      { name: 'David Warner', role: 'BAT', credits: 9.5, points: 0 },
      { name: 'Travis Head', role: 'BAT', credits: 9.5, points: 0 },
      { name: 'Steve Smith', role: 'BAT', credits: 9.5, points: 0 },
      { name: 'Marnus Labuschagne', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Tim David', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Josh Inglis', role: 'WK', credits: 8.5, points: 12 },
      { name: 'Alex Carey', role: 'WK', credits: 8.0, points: 0 },
      { name: 'Glenn Maxwell', role: 'AR', credits: 9.5, points: 36 },
      { name: 'Marcus Stoinis', role: 'AR', credits: 8.5, points: 14 },
      { name: 'Cameron Green', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Pat Cummins', role: 'BOWL', credits: 9.5, points: 32 },
      { name: 'Mitchell Starc', role: 'BOWL', credits: 9.5, points: 40 },
      { name: 'Josh Hazlewood', role: 'BOWL', credits: 9.0, points: 28 },
      { name: 'Adam Zampa', role: 'BOWL', credits: 8.5, points: 25 },
      { name: 'Nathan Ellis', role: 'BOWL', credits: 8.0, points: 0 },
    ],
  },
  {
    title: 'England vs West Indies — T20 Super Series',
    category: 'T20',
    team_a: 'England',
    team_a_code: 'ENG',
    team_a_logo: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=120&h=120&q=80',
    team_b: 'West Indies',
    team_b_code: 'WI',
    team_b_logo: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=120&h=120&q=80',
    match_poster: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80',
    venue: 'Kensington Oval, Barbados',
    status: 'upcoming',
    match_date: 'Tomorrow',
    match_time: '20:00',
    start_time: new Date(Date.now() + 86400000), // starts in 24h
    lock_time_minutes: 15,
    players_a: [
      { name: 'Jos Buttler', role: 'WK', credits: 10.0, points: 0 },
      { name: 'Philip Salt', role: 'WK', credits: 9.0, points: 0 },
      { name: 'Jonny Bairstow', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Harry Brook', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Will Jacks', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Ben Duckett', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Liam Livingstone', role: 'AR', credits: 9.0, points: 0 },
      { name: 'Moeen Ali', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Sam Curran', role: 'AR', credits: 9.0, points: 0 },
      { name: 'Chris Jordan', role: 'AR', credits: 8.0, points: 0 },
      { name: 'Jofra Archer', role: 'BOWL', credits: 9.5, points: 0 },
      { name: 'Adil Rashid', role: 'BOWL', credits: 9.0, points: 0 },
      { name: 'Mark Wood', role: 'BOWL', credits: 9.0, points: 0 },
      { name: 'Reece Topley', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Tom Hartley', role: 'BOWL', credits: 8.0, points: 0 },
    ],
    players_b: [
      { name: 'Nicholas Pooran', role: 'WK', credits: 10.0, points: 0 },
      { name: 'Shai Hope', role: 'WK', credits: 8.5, points: 0 },
      { name: 'Brandon King', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Johnson Charles', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Shimron Hetmyer', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Rovman Powell', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Sherfane Rutherford', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Andre Russell', role: 'AR', credits: 10.0, points: 0 },
      { name: 'Romario Shepherd', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Roston Chase', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Akeal Hosein', role: 'BOWL', credits: 9.0, points: 0 },
      { name: 'Alzarri Joseph', role: 'BOWL', credits: 9.0, points: 0 },
      { name: 'Gudakesh Motie', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Shamar Joseph', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Obed McCoy', role: 'BOWL', credits: 8.0, points: 0 },
    ],
  },
  {
    title: 'Mumbai vs Chennai — Indian League Derby',
    category: 'League',
    team_a: 'Mumbai',
    team_a_code: 'MUM',
    team_a_logo: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=120&h=120&q=80',
    team_b: 'Chennai',
    team_b_code: 'CHE',
    team_b_logo: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=120&h=120&q=80',
    match_poster: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
    venue: 'Wankhede Stadium, Mumbai',
    status: 'live',
    match_date: 'Today',
    match_time: '19:30',
    start_time: new Date(Date.now() - 5400000), // started 1.5 hr ago (LIVE)
    lock_time_minutes: 15,
    score_summary: {
      team_a: { runs: 188, wickets: 6, overs: 20.0 },
      team_b: { runs: 112, wickets: 2, overs: 11.3 },
      current_innings: 'team_b',
    },
    live_data: {
      status_text: 'CHE 112/2 (11.3 ov) • Need 77 runs in 51 balls',
      commentary: [
        '⚡ FOUR! Ruturaj sweeps past short fine-leg!',
        '2 runs, quick running between the wickets.',
        '🔴 WICKET! Caught at mid-off, big breakthrough!',
      ],
    },
    players_a: [
      { name: 'Rohit Sharma', role: 'BAT', credits: 10.0, points: 38 },
      { name: 'Ishan Kishan', role: 'WK', credits: 9.0, points: 22 },
      { name: 'Suryakumar Yadav', role: 'BAT', credits: 10.0, points: 64 },
      { name: 'Tilak Varma', role: 'BAT', credits: 8.5, points: 32 },
      { name: 'Tim David', role: 'BAT', credits: 8.5, points: 19 },
      { name: 'Dewald Brevis', role: 'BAT', credits: 8.0, points: 0 },
      { name: 'Hardik Pandya', role: 'AR', credits: 9.5, points: 41 },
      { name: 'Mohammad Nabi', role: 'AR', credits: 8.5, points: 18 },
      { name: 'Romario Shepherd', role: 'AR', credits: 8.5, points: 26 },
      { name: 'Jasprit Bumrah', role: 'BOWL', credits: 10.0, points: 55 },
      { name: 'Gerald Coetzee', role: 'BOWL', credits: 8.5, points: 29 },
      { name: 'Piyush Chawla', role: 'BOWL', credits: 8.5, points: 22 },
      { name: 'Akash Madhwal', role: 'BOWL', credits: 8.0, points: 12 },
      { name: 'Nuwan Thushara', role: 'BOWL', credits: 8.0, points: 0 },
      { name: 'Vishnu Vinod', role: 'WK', credits: 7.5, points: 0 },
    ],
    players_b: [
      { name: 'Ruturaj Gaikwad', role: 'BAT', credits: 9.5, points: 49 },
      { name: 'Rachin Ravindra', role: 'BAT', credits: 9.0, points: 21 },
      { name: 'Ajinkya Rahane', role: 'BAT', credits: 8.5, points: 14 },
      { name: 'Daryl Mitchell', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Shivam Dube', role: 'AR', credits: 9.0, points: 35 },
      { name: 'MS Dhoni', role: 'WK', credits: 9.0, points: 18 },
      { name: 'Aravelly Avanish', role: 'WK', credits: 7.5, points: 0 },
      { name: 'Ravindra Jadeja', role: 'AR', credits: 9.5, points: 32 },
      { name: 'Moeen Ali', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Mitchell Santner', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Matheesha Pathirana', role: 'BOWL', credits: 9.5, points: 48 },
      { name: 'Tushar Deshpande', role: 'BOWL', credits: 8.5, points: 25 },
      { name: 'Mustafizur Rahman', role: 'BOWL', credits: 9.0, points: 31 },
      { name: 'Deepak Chahar', role: 'BOWL', credits: 8.5, points: 16 },
      { name: 'Shardul Thakur', role: 'BOWL', credits: 8.0, points: 0 },
    ],
  },
  {
    title: "India Women vs Australia Women — Women's World Championship",
    category: "Women's",
    team_a: 'India Women',
    team_a_code: 'IND-W',
    team_a_logo: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=120&h=120&q=80',
    team_b: 'Australia Women',
    team_b_code: 'AUS-W',
    team_b_logo: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=120&h=120&q=80',
    match_poster: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80',
    venue: 'Melbourne Cricket Ground, Melbourne',
    status: 'upcoming',
    match_date: 'Tomorrow',
    match_time: '14:30',
    start_time: new Date(Date.now() + 64800000), // starts in 18h
    lock_time_minutes: 15,
    players_a: [
      { name: 'Smriti Mandhana', role: 'BAT', credits: 10.5, points: 0 },
      { name: 'Shafali Verma', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Harmanpreet Kaur', role: 'BAT', credits: 10.0, points: 0 },
      { name: 'Jemimah Rodrigues', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Harleen Deol', role: 'BAT', credits: 8.0, points: 0 },
      { name: 'Richa Ghosh', role: 'WK', credits: 9.0, points: 0 },
      { name: 'Yastika Bhatia', role: 'WK', credits: 8.0, points: 0 },
      { name: 'Deepti Sharma', role: 'AR', credits: 10.0, points: 0 },
      { name: 'Pooja Vastrakar', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Amanjot Kaur', role: 'AR', credits: 8.0, points: 0 },
      { name: 'Renuka Singh', role: 'BOWL', credits: 9.0, points: 0 },
      { name: 'Radha Yadav', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Shreyanka Patil', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Titas Sadhu', role: 'BOWL', credits: 8.0, points: 0 },
      { name: 'Saika Ishaque', role: 'BOWL', credits: 8.0, points: 0 },
    ],
    players_b: [
      { name: 'Alyssa Healy', role: 'WK', credits: 10.0, points: 0 },
      { name: 'Beth Mooney', role: 'WK', credits: 10.0, points: 0 },
      { name: 'Ellyse Perry', role: 'BAT', credits: 10.0, points: 0 },
      { name: 'Phoebe Litchfield', role: 'BAT', credits: 9.0, points: 0 },
      { name: 'Grace Harris', role: 'BAT', credits: 8.5, points: 0 },
      { name: 'Ashleigh Gardner', role: 'AR', credits: 10.0, points: 0 },
      { name: 'Tahlia McGrath', role: 'AR', credits: 9.0, points: 0 },
      { name: 'Annabel Sutherland', role: 'AR', credits: 9.0, points: 0 },
      { name: 'Georgia Wareham', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Sophie Molineux', role: 'AR', credits: 8.5, points: 0 },
      { name: 'Megan Schutt', role: 'BOWL', credits: 9.0, points: 0 },
      { name: 'Alana King', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Darcie Brown', role: 'BOWL', credits: 8.5, points: 0 },
      { name: 'Kim Garth', role: 'BOWL', credits: 8.0, points: 0 },
      { name: 'Tayla Vlaeminck', role: 'BOWL', credits: 8.0, points: 0 },
    ],
  },
];

async function seedCricketMatches() {
  const matchCount = await CricketMatch.count();
  if (matchCount > 0) {
    console.log(`🏏 Cricket database already has ${matchCount} matches.`);
    return;
  }

  console.log('🌱 Seeding Prime Dreems cricket matches, players & contests...');

  for (const mData of MATCH_SQUADS) {
    const match = await CricketMatch.create({
      title: mData.title,
      category: mData.category,
      team_a: mData.team_a,
      team_a_code: mData.team_a_code,
      team_a_logo: mData.team_a_logo,
      team_b: mData.team_b,
      team_b_code: mData.team_b_code,
      team_b_logo: mData.team_b_logo,
      match_poster: mData.match_poster,
      venue: mData.venue,
      status: mData.status,
      match_date: mData.match_date,
      match_time: mData.match_time,
      start_time: mData.start_time,
      lock_time_minutes: mData.lock_time_minutes,
      score_summary: mData.score_summary || {},
      live_data: mData.live_data || {},
    });

    // Seed 15 players for Team A
    for (const p of mData.players_a) {
      await CricketPlayer.create({
        match_id: match.id,
        name: p.name,
        team_name: mData.team_a,
        role: p.role,
        photo_url: '/cricket/player_avatar.png',
        credits: p.credits,
        points: p.points || 0,
      });
    }

    // Seed 15 players for Team B
    for (const p of mData.players_b) {
      await CricketPlayer.create({
        match_id: match.id,
        name: p.name,
        team_name: mData.team_b,
        role: p.role,
        photo_url: '/cricket/player_avatar.png',
        credits: p.credits,
        points: p.points || 0,
      });
    }

    // Contest Type 1: Standard Prize Pool (§7)
    await MatchContest.create({
      match_id: match.id,
      type: 'standard',
      title: `Mega Grand League ₹1,00,000 (${mData.category})`,
      prize_pool: 100000,
      entry_fee: 49,
      total_spots: 2500,
      filled_spots: 1840,
      status: 'open',
    });

    // Contest Type 2: Multi-Battlefield (Auto-Clone) (§7)
    await MatchContest.create({
      match_id: match.id,
      type: 'multi_battlefield',
      title: `PUBG Battlefield Room #1 (${mData.category})`,
      prize_pool: 2500,
      entry_fee: 99,
      total_spots: 25,
      filled_spots: 18,
      spots_per_battlefield: 25,
      battlefield_number: 1,
      status: 'open',
    });

    // Contest Type 3: Head to Head (H2H) sample (§7)
    await MatchContest.create({
      match_id: match.id,
      type: 'h2h',
      title: `H2H Winner Takes All (${mData.category})`,
      prize_pool: 850,
      entry_fee: 500,
      total_spots: 2,
      filled_spots: 1,
      status: 'open',
    });

    console.log(`   ✅ Seeded: ${match.title} [${match.category}] with 30 players & 3 contest types`);
  }

  console.log('🏆 Prime Dreems cricket database seeding completed successfully!');
}

module.exports = { seedCricketMatches };

