const express = require('express');
const { authenticate } = require('../middleware/auth');
const { User, Wallet, Transaction, SystemSetting, Notification, ReferralLog, ShareLog } = require('../db/models');
const sequelize = require('../db/index');
const config = require('../config');
const smartEngine = require('../services/smart-engine');

const router = express.Router();

// Helper to fetch system setting or fallback
async function getSetting(key, fallback) {
  try {
    const s = await SystemSetting.findOne({ where: { key } });
    return s ? s.value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Helper to check user's tournament access status
 */
async function computeAccessStatus(user) {
  const now = new Date();

  // 1. Master Gate setting
  const subscriptionEnabled = (await getSetting('subscription_enabled', 'true')) === 'true';
  if (!subscriptionEnabled) {
    return { hasAccess: true, reason: 'gate_disabled', isFreeForEveryone: true };
  }

  // 2. Admin Free Access Mode
  const freeMode = (await getSetting('subscription_free_mode', 'false')) === 'true';
  if (freeMode) {
    return { hasAccess: true, reason: 'free_mode_active', isFreeForEveryone: true };
  }

  // 3. Admin Free Until Date
  const freeUntil = await getSetting('subscription_free_until', '');
  if (freeUntil && new Date(freeUntil) > now) {
    return {
      hasAccess: true,
      reason: 'free_until_active',
      isFreeForEveryone: true,
      freeUntil: new Date(freeUntil).toISOString()
    };
  }

  // 4. Admin or Bot bypass
  if (!user || user.is_bot || user.role === 'admin') {
    return { hasAccess: true, reason: 'admin_or_bot', isFreeForEveryone: false };
  }

  // 5. Active Paid / Extended Subscription
  if (user.subscription_active_until && new Date(user.subscription_active_until) > now) {
    return {
      hasAccess: true,
      reason: user.subscription_type === 'paid_monthly' ? 'paid_subscription' : 'share_unlocked',
      isFreeForEveryone: false,
      expiresAt: user.subscription_active_until
    };
  }

  // 6. Share / Referral Threshold
  const targetShares = parseInt(await getSetting('share_unlock_target', '3'), 10);
  const totalShares = user.total_shares_count || 0;
  const totalReferrals = user.total_referrals_count || 0;
  const maxCompleted = Math.max(totalShares, totalReferrals);

  if (maxCompleted >= targetShares) {
    return {
      hasAccess: true,
      reason: 'unlocked_via_share',
      isFreeForEveryone: false,
      totalShares,
      totalReferrals,
      targetShares
    };
  }

  // Locked: User needs to buy subscription or share
  return {
    hasAccess: false,
    reason: 'locked',
    isFreeForEveryone: false,
    targetShares,
    totalShares,
    totalReferrals,
    sharesNeeded: Math.max(0, targetShares - maxCompleted)
  };
}

// 1. GET /subscription/status — User subscription, share progress & complete history
router.get('/status', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const wallet = await Wallet.findOne({ where: { user_id: req.userId } });

    // Read Admin Configured Settings
    const monthlyPrice = parseFloat(await getSetting('subscription_monthly_price', '199'));
    const durationDays = parseInt(await getSetting('subscription_duration_days', '30'));
    const subscriptionEnabled = (await getSetting('subscription_enabled', 'true')) === 'true';
    const freeMode = (await getSetting('subscription_free_mode', 'false')) === 'true';
    const freeUntil = await getSetting('subscription_free_until', '');
    const targetShares = parseInt(await getSetting('share_unlock_target', '3'), 10);
    const rewardDays = parseInt(await getSetting('share_unlock_reward_days', '30'), 10);

    const now = new Date();
    const accessStatus = await computeAccessStatus(user);

    const totalShares = user.total_shares_count || 0;
    const totalReferrals = user.total_referrals_count || 0;
    const progressCount = Math.max(totalShares, totalReferrals);
    const isUnlockedViaShare = progressCount >= targetShares;

    let daysRemaining = 0;
    if (user.subscription_active_until && new Date(user.subscription_active_until) > now) {
      daysRemaining = Math.ceil((new Date(user.subscription_active_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Share Event History for this user
    let shareLogs = [];
    try {
      shareLogs = await ShareLog.findAll({
        where: { user_id: user.id },
        order: [['created_at', 'DESC']],
        limit: 25,
      });
    } catch (e) {
      console.warn('Share logs query note:', e.message);
    }

    // Referral Friends Signup History
    const referralLogs = await ReferralLog.findAll({
      where: { referrer_user_id: user.id },
      order: [['created_at', 'DESC']],
      limit: 25,
    });

    const referredUserIds = referralLogs.map(l => l.referred_user_id);
    const referredUsers = await User.findAll({
      where: { id: referredUserIds },
      attributes: ['id', 'name'],
    });

    const referralsList = referralLogs.map(l => {
      const u = referredUsers.find(ru => ru.id === l.referred_user_id);
      return {
        id: l.id,
        name: u ? u.name : 'Creator Player',
        joinedAt: l.created_at,
      };
    });

    res.json({
      success: true,
      access: accessStatus,
      freePromo: {
        isFreeMode: freeMode,
        freeUntil: freeUntil || null,
        isFreeNow: freeMode || Boolean(freeUntil && new Date(freeUntil) > now),
      },
      subscription: {
        isEnabled: subscriptionEnabled,
        isActive: accessStatus.hasAccess,
        expiresAt: user.subscription_active_until,
        daysRemaining,
        type: user.subscription_type || 'none',
        monthlyPrice,
        durationDays,
      },
      wallet: {
        balance: wallet ? parseFloat(wallet.balance) : 0,
        currencySymbol: '₹',
      },
      share: {
        code: user.referral_code,
        shareUrl: `${config.FRONTEND_URL}/signup?ref=${user.referral_code}`,
        targetShares,
        rewardDays,
        totalShares,
        totalReferrals,
        progressCount,
        isUnlocked: isUnlockedViaShare,
        sharesNeeded: Math.max(0, targetShares - progressCount),
        shareHistory: shareLogs.map(s => ({
          id: s.id,
          platform: s.platform,
          recipient: s.recipient || 'Direct',
          sharedAt: s.created_at,
        })),
        referralHistory: referralsList,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// 2. POST /subscription/record-share — Record every share event & grant unlock when threshold reached
router.post('/record-share', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const platform = String(req.body.platform || 'whatsapp').trim().toLowerCase();
    const recipient = String(req.body.recipient || '').trim().slice(0, 100);
    const shareUrl = `${config.FRONTEND_URL}/signup?ref=${user.referral_code}`;

    // 1. Create ShareLog entry
    try {
      await ShareLog.create({
        user_id: user.id,
        platform,
        recipient: recipient || null,
        share_url: shareUrl,
      });
    } catch (logErr) {
      console.warn('ShareLog creation note:', logErr.message);
    }

    // 2. Increment user's total shares
    const newTotalShares = (user.total_shares_count || 0) + 1;
    user.total_shares_count = newTotalShares;

    // 3. Check if user reached share unlock target
    const targetShares = parseInt(await getSetting('share_unlock_target', '3'), 10);
    const rewardDays = parseInt(await getSetting('share_unlock_reward_days', '30'), 10);

    const maxProgress = Math.max(newTotalShares, user.total_referrals_count || 0);
    let justUnlocked = false;

    if (maxProgress >= targetShares) {
      const now = new Date();
      // If user doesn't already have an active subscription, or existing expires sooner than rewardDays
      const currentExpiry = user.subscription_active_until ? new Date(user.subscription_active_until) : null;
      const targetExpiry = new Date(now.getTime() + rewardDays * 24 * 60 * 60 * 1000);

      if (!currentExpiry || currentExpiry < now) {
        user.subscription_active_until = targetExpiry;
        user.subscription_type = 'share_unlocked';
        justUnlocked = true;

        await Notification.create({
          user_id: user.id,
          title: '🎉 Free Tournament Access Unlocked!',
          message: `Great job! You've shared Creator11 with ${targetShares} friends. Your ${rewardDays}-Day Tournament Pass is now ACTIVE!`,
          type: 'referral_reward',
        });
      }
    }

    await user.save();

    res.json({
      success: true,
      message: justUnlocked
        ? '🎉 Congratulations! You reached the share target and unlocked FREE tournament access!'
        : `Share logged successfully! (${newTotalShares}/${targetShares} shares)`,
      totalShares: newTotalShares,
      totalReferrals: user.total_referrals_count || 0,
      targetShares,
      isUnlocked: maxProgress >= targetShares,
      justUnlocked,
    });
  } catch (error) {
    console.error('Record share error:', error);
    res.status(500).json({ error: error.message || 'Failed to record share' });
  }
});

// 3. POST /subscription/purchase — Prioritized user_wallet lane
router.post('/purchase', authenticate, async (req, res) => {
  try {
    const result = await smartEngine.execute('wallet', async () => {
      const t = await sequelize.transaction();
      try {
        const user = await User.findByPk(req.userId, { transaction: t });
        if (!user) {
          await t.rollback();
          return { errorStatus: 404, data: { error: 'User not found' } };
        }

        const wallet = await Wallet.findOne({ where: { user_id: req.userId }, transaction: t });
        if (!wallet) {
          await t.rollback();
          return { errorStatus: 404, data: { error: 'Wallet not found' } };
        }

        const monthlyPrice = parseFloat(await getSetting('subscription_monthly_price', '199'));
        const durationDays = parseInt(await getSetting('subscription_duration_days', '30'));
        const balance = parseFloat(wallet.balance) || 0;

        if (balance < monthlyPrice) {
          await t.rollback();
          return {
            errorStatus: 400,
            data: {
              error: `Insufficient wallet balance. Monthly pass is ₹${monthlyPrice.toFixed(2)}, but you have ₹${balance.toFixed(2)}.`,
              requiresDeposit: true,
              requiredAmount: monthlyPrice,
              currentBalance: balance,
              redirectTo: `/wallet?required=${monthlyPrice}`,
            }
          };
        }

        // Deduct subscription fee
        const newBalance = balance - monthlyPrice;
        await wallet.update({ balance: newBalance }, { transaction: t });

        // Create transaction log
        await Transaction.create({
          wallet_id: wallet.id,
          type: 'subscription',
          amount: -monthlyPrice,
          status: 'completed',
          description: `Monthly Tournament Pass (${durationDays} Days) - Creator Entertainment League`,
        }, { transaction: t });

        // Compute new expiry date
        const now = new Date();
        let newExpiry;
        if (user.subscription_active_until && new Date(user.subscription_active_until) > now) {
          newExpiry = new Date(new Date(user.subscription_active_until).getTime() + durationDays * 24 * 60 * 60 * 1000);
        } else {
          newExpiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        }

        await user.update({
          subscription_active_until: newExpiry,
          subscription_type: 'paid_monthly',
        }, { transaction: t });

        await Notification.create({
          user_id: user.id,
          title: '👑 VIP Monthly Pass Activated!',
          message: `Your monthly subscription is active until ${newExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. You can now compete in all tournaments!`,
          type: 'subscription_success',
        }, { transaction: t });

        await t.commit();

        console.log(`👑 User "${user.name}" purchased VIP Monthly Pass for ₹${monthlyPrice}. Valid until: ${newExpiry.toISOString()}`);

        return {
          status: 200,
          data: {
            success: true,
            message: 'VIP Monthly subscription activated successfully!',
            subscriptionActiveUntil: newExpiry,
            subscriptionType: 'paid_monthly',
            remainingBalance: newBalance,
          }
        };
      } catch (error) {
        await t.rollback();
        throw error;
      }
    }, true);

    if (result.errorStatus) {
      return res.status(result.errorStatus).json(result.data);
    }
    return res.status(result.status || 200).json(result.data);
  } catch (error) {
    console.error('Subscription purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase subscription' });
  }
});

// Public Promo Banner Configuration
router.get('/promo-banner-settings', async (req, res) => {
  try {
    const keys = [
      'share_unlock_target',
      'share_unlock_reward_days',
      'referral_bonus_amount',
      'welcome_bonus_amount',
      'promo_banner_title',
      'promo_banner_subtitle',
    ];
    const rows = await SystemSetting.findAll({ where: { key: keys } });
    const settings = {
      share_unlock_target: 3,
      share_unlock_reward_days: 30,
      referral_bonus_amount: 500,
      welcome_bonus_amount: 100,
      promo_banner_title: 'Share & Earn ₹500 Bonus Cash',
      promo_banner_subtitle: 'Invite 3 friends with your referral link to unlock instant cash bonus + 30 days tournament access!',
    };
    rows.forEach(r => {
      if (['share_unlock_target', 'share_unlock_reward_days', 'referral_bonus_amount', 'welcome_bonus_amount'].includes(r.key)) {
        settings[r.key] = Number(r.value) || settings[r.key];
      } else {
        settings[r.key] = r.value || settings[r.key];
      }
    });
    res.json({ success: true, settings });
  } catch (err) {
    res.json({
      success: true,
      settings: {
        share_unlock_target: 3,
        share_unlock_reward_days: 30,
        referral_bonus_amount: 500,
        welcome_bonus_amount: 100,
        promo_banner_title: 'Share & Earn ₹500 Bonus Cash',
        promo_banner_subtitle: 'Invite 3 friends with your referral link to unlock instant cash bonus + 30 days tournament access!',
      }
    });
  }
});

// ─── V2.6 DYNAMIC SUBSCRIPTION PLANS & REFERRAL OFFER ENDPOINTS ───

const DEFAULT_PLANS = [
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

const DEFAULT_REFERRAL_OFFER = {
  target_count: 5,
  reward_days: 10,
  teams_per_match: 2,
  is_active: true,
  title: 'Refer 5 Friends — Get 10 Days Free Access (2 Teams/Match)',
};

/**
 * GET /subscription/plans
 * Returns all active subscription tiers, current referral offer, and logged-in user status.
 */
router.get('/plans', async (req, res) => {
  try {
    let plans = DEFAULT_PLANS;
    const plansRow = await SystemSetting.findOne({ where: { key: 'subscription_plans' } });
    if (plansRow && plansRow.value) {
      try { plans = JSON.parse(plansRow.value); } catch (_) {}
    }

    let referralOffer = DEFAULT_REFERRAL_OFFER;
    const offerRow = await SystemSetting.findOne({ where: { key: 'referral_offer_config' } });
    if (offerRow && offerRow.value) {
      try { referralOffer = JSON.parse(offerRow.value); } catch (_) {}
    }

    let userStatus = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await User.findByPk(decoded.userId || decoded.id);
        if (user) {
          const now = new Date();
          const hasPaid = user.subscription_active_until && new Date(user.subscription_active_until) > now;
          const hasRef = user.referral_pass_valid_until && new Date(user.referral_pass_valid_until) > now;
          const paidDaysLeft = hasPaid ? Math.ceil((new Date(user.subscription_active_until) - now) / 86400000) : 0;
          const refDaysLeft = hasRef ? Math.ceil((new Date(user.referral_pass_valid_until) - now) / 86400000) : 0;

          userStatus = {
            hasActivePass: hasPaid || hasRef,
            hasPaidSubscription: hasPaid,
            paidPlanId: user.subscription_plan_id,
            paidExpiresAt: user.subscription_active_until,
            paidDaysLeft,
            paidMaxTeams: user.subscription_max_teams || 2,
            hasReferralPass: hasRef,
            referralPassExpiresAt: user.referral_pass_valid_until,
            referralDaysLeft: refDaysLeft,
            referralMaxTeams: user.referral_pass_max_teams || 1,
            referralPassClaimedAt: user.referral_pass_claimed_at,
            effectiveMaxTeams: Math.max(hasPaid ? (user.subscription_max_teams || 2) : 0, hasRef ? (user.referral_pass_max_teams || 1) : 0),
            referralCode: user.referral_code,
            totalReferralsCount: user.total_referrals_count || 0,
            canClaimReferralPass: (user.total_referrals_count || 0) >= referralOffer.target_count && (!hasRef || refDaysLeft <= 0),
          };
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      plans: plans.filter(p => p.is_active !== false),
      referralOffer,
      userStatus,
    });
  } catch (error) {
    console.error('Fetch plans error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscription/purchase-plan
 * User selects and activates a subscription plan.
 */
router.post('/purchase-plan', authenticate, async (req, res) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ error: 'plan_id is required' });

    let plans = DEFAULT_PLANS;
    const plansRow = await SystemSetting.findOne({ where: { key: 'subscription_plans' } });
    if (plansRow && plansRow.value) {
      try { plans = JSON.parse(plansRow.value); } catch (_) {}
    }

    const selectedPlan = plans.find(p => p.id === plan_id);
    if (!selectedPlan) return res.status(404).json({ error: `Subscription plan "${plan_id}" not found.` });

    const user = await User.findByPk(req.userId || req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    let newExpiry;
    if (user.subscription_active_until && new Date(user.subscription_active_until) > now) {
      // Extend existing subscription
      newExpiry = new Date(new Date(user.subscription_active_until).getTime() + (selectedPlan.validity_days * 86400000));
    } else {
      newExpiry = new Date(now.getTime() + (selectedPlan.validity_days * 86400000));
    }

    await user.update({
      subscription_plan_id: selectedPlan.id,
      subscription_active_until: newExpiry,
      subscription_max_teams: selectedPlan.max_teams_per_match || 2,
      subscription_type: 'paid_plan',
    });

    await Notification.create({
      user_id: user.id,
      title: `👑 ${selectedPlan.name} Activated!`,
      message: `Your ${selectedPlan.name} is now active until ${newExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. You can now create up to ${selectedPlan.max_teams_per_match} teams per match for free!`,
      type: 'subscription_success',
    }).catch(() => {});

    res.json({
      success: true,
      message: `🎉 ${selectedPlan.name} activated successfully! Enjoy ${selectedPlan.max_teams_per_match} teams per match until ${newExpiry.toLocaleDateString('en-IN')}.`,
      plan: selectedPlan,
      subscriptionActiveUntil: newExpiry,
      maxTeamsPerMatch: selectedPlan.max_teams_per_match,
    });
  } catch (error) {
    console.error('Purchase plan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscription/claim-referral-pass
 * User claims their free referral tournament pass when they hit the required referral count.
 * Freezes the snapshot: valid_until and max_teams are permanently locked in for this pass!
 */
router.post('/claim-referral-pass', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId || req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let referralOffer = DEFAULT_REFERRAL_OFFER;
    const offerRow = await SystemSetting.findOne({ where: { key: 'referral_offer_config' } });
    if (offerRow && offerRow.value) {
      try { referralOffer = JSON.parse(offerRow.value); } catch (_) {}
    }

    const currentReferrals = user.total_referrals_count || 0;
    if (currentReferrals < referralOffer.target_count) {
      return res.status(400).json({
        error: `You need ${referralOffer.target_count} referrals to claim this pass. You currently have ${currentReferrals}.`,
        needed: referralOffer.target_count - currentReferrals,
      });
    }

    const now = new Date();
    // Snapshot preservation: lock in current offer values into user record!
    const validUntil = new Date(now.getTime() + (referralOffer.reward_days * 86400000));
    const maxTeams = parseInt(referralOffer.teams_per_match, 10) || 1;

    await user.update({
      referral_pass_valid_until: validUntil,
      referral_pass_max_teams: maxTeams,
      referral_pass_claimed_at: now,
    });

    await Notification.create({
      user_id: user.id,
      title: '🎁 Referral Free Pass Claimed!',
      message: `Congratulations! Your free pass is active until ${validUntil.toLocaleDateString('en-IN')}. You can create ${maxTeams} team(s) per match for free!`,
      type: 'referral_reward',
    }).catch(() => {});

    res.json({
      success: true,
      message: `🎉 Free Referral Pass claimed successfully! Valid for ${referralOffer.reward_days} days (${maxTeams} team/match).`,
      pass: {
        valid_until: validUntil,
        max_teams: maxTeams,
        claimed_at: now,
      }
    });
  } catch (error) {
    console.error('Claim referral pass error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADMIN: GET /admin/subscription-plans
 * Returns current subscription plans and referral offer configuration for Admin Deck.
 */
router.get('/admin/plans', authenticate, async (req, res) => {
  try {
    const { isAdmin } = require('../middleware/auth');
    if (req.user?.role !== 'admin' && req.role !== 'admin') {
      const u = await User.findByPk(req.userId || req.user?.id);
      if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    }

    let plans = DEFAULT_PLANS;
    const plansRow = await SystemSetting.findOne({ where: { key: 'subscription_plans' } });
    if (plansRow && plansRow.value) {
      try { plans = JSON.parse(plansRow.value); } catch (_) {}
    }

    let referralOffer = DEFAULT_REFERRAL_OFFER;
    const offerRow = await SystemSetting.findOne({ where: { key: 'referral_offer_config' } });
    if (offerRow && offerRow.value) {
      try { referralOffer = JSON.parse(offerRow.value); } catch (_) {}
    }

    res.json({ success: true, plans, referralOffer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADMIN: PUT /admin/subscription-plans
 * Updates subscription plans and referral offer in real-time.
 */
router.put('/admin/plans', authenticate, async (req, res) => {
  try {
    const u = await User.findByPk(req.userId || req.user?.id);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { plans, referralOffer } = req.body;

    if (Array.isArray(plans)) {
      const cleanPlans = plans.map(p => ({
        id: String(p.id || '').trim().toLowerCase(),
        name: String(p.name || '').trim(),
        price: parseFloat(p.price) || 0,
        validity_days: parseInt(p.validity_days, 10) || 30,
        max_teams_per_match: parseInt(p.max_teams_per_match, 10) || 2,
        description: String(p.description || '').trim(),
        badge: String(p.badge || '').trim(),
        is_active: p.is_active !== false,
      })).filter(p => p.id && p.name);

      let row = await SystemSetting.findOne({ where: { key: 'subscription_plans' } });
      if (row) {
        await row.update({ value: JSON.stringify(cleanPlans) });
      } else {
        await SystemSetting.create({
          key: 'subscription_plans',
          value: JSON.stringify(cleanPlans),
          description: 'Admin configured subscription plans',
        });
      }
    }

    if (referralOffer && typeof referralOffer === 'object') {
      const cleanOffer = {
        target_count: parseInt(referralOffer.target_count, 10) || 5,
        reward_days: parseInt(referralOffer.reward_days, 10) || 10,
        teams_per_match: parseInt(referralOffer.teams_per_match, 10) || 2,
        is_active: referralOffer.is_active !== false,
        title: String(referralOffer.title || 'Refer friends to unlock free access').trim(),
      };

      let row = await SystemSetting.findOne({ where: { key: 'referral_offer_config' } });
      if (row) {
        await row.update({ value: JSON.stringify(cleanOffer) });
      } else {
        await SystemSetting.create({
          key: 'referral_offer_config',
          value: JSON.stringify(cleanOffer),
          description: 'Admin configured referral offer',
        });
      }
    }

    res.json({ success: true, message: 'Subscription plans and referral offer updated successfully!' });
  } catch (error) {
    console.error('Update plans error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
