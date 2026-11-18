// 🏆 PRIME DREEMS — CANONICAL DEFAULT CONTESTS CONFIGURATION
// Exactly 8 Official Contest Configurations with Prize Tables, Spots, Bots, and Cloning Rules

const DEFAULT_CONTESTS = [
  // --- CONTEST 1: MEGA CONTEST ---
  {
    type: 'mega',
    title: 'Prime Mega Arena',
    total_spots: 10000000, // Unlimited
    is_unlimited: true,
    bot_spots: 15000,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 12125000,
    room_clone: false,
    spots_per_battlefield: null,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 1500000 },
      { rank_from: 2, rank_to: 1000, prize: 10000 },
      { rank_from: 1001, rank_to: 2000, prize: 500 },
      { rank_from: 2001, rank_to: 2500, prize: 100 },
      { rank_from: 2501, rank_to: 3000, prize: 50 },
      { rank_from: 3001, rank_to: 5000, prize: 30 },
    ],
  },

  // --- CONTEST 2: ROYAL MEGA LEAGUE ---
  {
    type: 'mega',
    title: 'Royal Mega League',
    total_spots: 100000,
    is_unlimited: false,
    bot_spots: 5000,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 2852500,
    room_clone: false,
    spots_per_battlefield: null,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 500000 },
      { rank_from: 2, rank_to: 100, prize: 10000 },
      { rank_from: 101, rank_to: 500, prize: 3000 },
      { rank_from: 501, rank_to: 1000, prize: 250 },
      { rank_from: 1001, rank_to: 1500, prize: 50 },
      { rank_from: 1501, rank_to: 2000, prize: 25 },
    ],
  },

  // --- CONTEST 3: MINI CONTEST ---
  {
    type: 'multi_battlefield',
    title: 'Mini Contest Room #1',
    base_title: 'Mini Contest',
    total_spots: 5000,
    spots_per_battlefield: 5000,
    battlefield_number: 1,
    is_unlimited: false,
    bot_spots: 2000,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 17500,
    room_clone: true,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 10000 },
      { rank_from: 2, rank_to: 5, prize: 1000 },
      { rank_from: 6, rank_to: 10, prize: 500 },
      { rank_from: 11, rank_to: 20, prize: 100 },
    ],
  },

  // --- CONTEST 4: MINI EMERALD ---
  {
    type: 'multi_battlefield',
    title: 'Mini Emerald Room #1',
    base_title: 'Mini Emerald',
    total_spots: 1000,
    spots_per_battlefield: 1000,
    battlefield_number: 1,
    is_unlimited: false,
    bot_spots: 70,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 2050,
    room_clone: true,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 500 },
      { rank_from: 2, rank_to: 5, prize: 300 },
      { rank_from: 6, rank_to: 10, prize: 50 },
      { rank_from: 11, rank_to: 15, prize: 20 },
    ],
  },

  // --- CONTEST 5: PRIME QUICK PLAY ---
  {
    type: 'multi_battlefield',
    title: 'Prime Quick Play Room #1',
    base_title: 'Prime Quick Play',
    total_spots: 600,
    spots_per_battlefield: 600,
    battlefield_number: 1,
    is_unlimited: false,
    bot_spots: 50,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 1250,
    room_clone: true,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 500 },
      { rank_from: 2, rank_to: 5, prize: 100 },
      { rank_from: 6, rank_to: 15, prize: 30 },
      { rank_from: 16, rank_to: 20, prize: 10 },
    ],
  },

  // --- CONTEST 6: ROYAL BATTLEFIELD ARENA ---
  {
    type: 'multi_battlefield',
    title: 'Royal Battlefield Arena Room #1',
    base_title: 'Royal Battlefield Arena',
    total_spots: 100,
    spots_per_battlefield: 100,
    battlefield_number: 1,
    is_unlimited: false,
    bot_spots: 30,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 750,
    room_clone: true,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 500 },
      { rank_from: 2, rank_to: 2, prize: 200 },
      { rank_from: 3, rank_to: 3, prize: 50 },
    ],
  },

  // --- CONTEST 7: PRIME BATTLEFIELD RUSH ---
  {
    type: 'multi_battlefield',
    title: 'Prime Battlefield Rush Room #1',
    base_title: 'Prime Battlefield Rush',
    total_spots: 50,
    spots_per_battlefield: 50,
    battlefield_number: 1,
    is_unlimited: false,
    bot_spots: 10,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 600,
    room_clone: true,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 500 },
      { rank_from: 2, rank_to: 2, prize: 100 },
    ],
  },

  // --- CONTEST 8: AMBER BATTLEFIELD BLITZ ---
  {
    type: 'multi_battlefield',
    title: 'Amber Battlefield Blitz Room #1',
    base_title: 'Amber Battlefield Blitz',
    total_spots: 15,
    spots_per_battlefield: 15,
    battlefield_number: 1,
    is_unlimited: false,
    bot_spots: 5,
    filled_spots: 0,
    entry_fee: 0,
    prize_pool: 200,
    room_clone: true,
    prize_breakup: [
      { rank_from: 1, rank_to: 1, prize: 200 },
    ],
  },
];

const CLONEABLE_TITLES = [
  'mini contest',
  'mini emerald',
  'prime quick play',
  'royal battlefield arena',
  'prime battlefield rush',
  'amber battlefield blitz',
];

function isContestCloneable(contest) {
  if (!contest) return false;
  const title = String(contest.title || '').toLowerCase();
  if (title.includes('prime mega arena') || title.includes('royal mega league')) {
    return false;
  }
  if (contest.type === 'mega') return false;
  if (contest.type === 'multi_battlefield') return true;
  return CLONEABLE_TITLES.some(t => title.includes(t));
}

function getContestBaseTitle(title = '') {
  return String(title).replace(/\s*Room\s*#\d+/i, '').trim();
}

module.exports = {
  DEFAULT_CONTESTS,
  isContestCloneable,
  getContestBaseTitle,
};
