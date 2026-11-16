require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sequelize = require('./index');

async function migrate() {
  console.log('🔄 Running v2.6 schema migration on Neon DB...');
  await sequelize.authenticate();

  // 1. Add columns to match_contests
  await sequelize.query('ALTER TABLE match_contests ADD COLUMN IF NOT EXISTS contest_code INTEGER;');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_match_contests_contest_code ON match_contests(contest_code);').catch(() => {});

  // 2. Add columns to users
  await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan_id VARCHAR(50);');
  await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_max_teams INTEGER DEFAULT 2;');
  await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_pass_valid_until TIMESTAMP WITH TIME ZONE;');
  await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_pass_max_teams INTEGER DEFAULT 1;');
  await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_pass_claimed_at TIMESTAMP WITH TIME ZONE;');

  // 3. Backfill contest_code for any contests without one
  const [contestsWithoutCode] = await sequelize.query('SELECT id, title FROM match_contests WHERE contest_code IS NULL ORDER BY created_at ASC;');
  if (contestsWithoutCode && contestsWithoutCode.length > 0) {
    const [maxCodeRow] = await sequelize.query('SELECT MAX(contest_code) as max_code FROM match_contests;');
    let nextCode = (maxCodeRow[0]?.max_code ? parseInt(maxCodeRow[0].max_code, 10) : 2010) + 1;
    for (const c of contestsWithoutCode) {
      await sequelize.query('UPDATE match_contests SET contest_code = :code WHERE id = :id;', {
        replacements: { code: nextCode++, id: c.id }
      });
    }
    console.log(`✅ Backfilled ${contestsWithoutCode.length} contests with unique numeric Contest IDs (starting from 2011).`);
  }

  // 4. Verify
  const [sample] = await sequelize.query('SELECT contest_code, title, prize_pool FROM match_contests ORDER BY contest_code ASC LIMIT 10;');
  console.log('🏆 Sample Contests with Numeric IDs:', sample);

  // 5. Seed default Subscription Plans in SystemSetting if not present
  const { SystemSetting } = require('./models');
  const existingPlans = await SystemSetting.findOne({ where: { key: 'subscription_plans' } });
  if (!existingPlans) {
    const defaultPlans = [
      {
        id: 'bronze',
        name: 'Bronze Tier',
        price: 49,
        validity_days: 10,
        max_teams_per_match: 2,
        description: 'Create up to 2 fantasy teams per match for 10 days.',
        badge: 'Starter',
        is_active: true,
      },
      {
        id: 'silver',
        name: 'Silver Pro',
        price: 99,
        validity_days: 20,
        max_teams_per_match: 3,
        description: 'Create up to 3 fantasy teams per match for 20 days.',
        badge: 'Popular',
        is_active: true,
      },
      {
        id: 'gold',
        name: 'Gold Master',
        price: 199,
        validity_days: 30,
        max_teams_per_match: 4,
        description: 'Create up to 4 fantasy teams per match for 30 days + full leaderboard stats.',
        badge: 'Best Value',
        is_active: true,
      },
      {
        id: 'vip',
        name: 'VIP Platinum',
        price: 499,
        validity_days: 90,
        max_teams_per_match: 6,
        description: 'Create maximum 6 fantasy teams per match for 90 days with VIP priority access.',
        badge: 'VIP Elite',
        is_active: true,
      },
    ];
    await SystemSetting.create({
      key: 'subscription_plans',
      value: JSON.stringify(defaultPlans),
      description: 'Admin configurable subscription tiers',
    });
    console.log('✅ Seeded default subscription plans (Bronze, Silver, Gold, VIP).');
  }

  // 6. Seed default Referral Offer in SystemSetting if not present
  const existingOffer = await SystemSetting.findOne({ where: { key: 'referral_offer_config' } });
  if (!existingOffer) {
    const defaultReferralOffer = {
      target_count: 5,
      reward_days: 10,
      teams_per_match: 2,
      is_active: true,
      title: 'Refer 5 Friends — Get 10 Days Free Access (2 Teams/Match)',
    };
    await SystemSetting.create({
      key: 'referral_offer_config',
      value: JSON.stringify(defaultReferralOffer),
      description: 'Dynamic referral offer settings',
    });
    console.log('✅ Seeded dynamic referral offer config.');
  }

  console.log('🚀 Migration complete!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
