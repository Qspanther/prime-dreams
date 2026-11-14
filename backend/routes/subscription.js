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

module.exports = router;
