// 🎯 PRIME DREEMS — CONTEST ENGINE
// Handles Standard, Multi-Battlefield (Auto-Clone), H2H & Lock Timing

const { MatchContest, CricketMatch, H2HChallenge, Wallet, Transaction, Notification } = require('../db/models');
const CricketTeam = require('../db/models/CricketTeam');
const sequelize = require('../db');
const { Op } = require('sequelize');

async function chargeWalletEntry(userId, amount, description, transaction) {
  const fee = Math.round((Number(amount) || 0) * 100) / 100;
  const wallet = await Wallet.findOne({
    where: { user_id: userId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!wallet) throw new Error('Wallet not found');

  const balance = Number(wallet.balance) || 0;
  if (balance + 0.0001 < fee) {
    throw new Error(`Insufficient wallet balance. Contest entry fee is ₹${fee}.`);
  }

  let bonus = Number(wallet.bonus_balance) || 0;
  const winnings = Number(wallet.winnings_balance) || 0;
  let deposit = Number(wallet.deposit_balance) || 0;
  let remaining = fee;
  const useBonus = Math.min(bonus, remaining); bonus -= useBonus; remaining -= useBonus;
  const useWinnings = Math.min(winnings, remaining); remaining -= useWinnings;
  const useDeposit = Math.min(deposit, remaining); deposit -= useDeposit; remaining -= useDeposit;

  // Older wallets can have a total balance that predates bucket tracking.
  const unbucketed = Math.max(0, balance - (Number(wallet.bonus_balance || 0) + winnings + Number(wallet.deposit_balance || 0)));
  const useUnbucketed = Math.min(unbucketed, remaining);
  deposit += useUnbucketed;
  remaining -= useUnbucketed;
  if (remaining > 0.0001) throw new Error('Wallet balance buckets are inconsistent. Please contact support.');

  await wallet.update({
    bonus_balance: bonus,
    winnings_balance: winnings - useWinnings,
    deposit_balance: deposit,
    balance: Math.round((balance - fee) * 10000) / 10000,
  }, { transaction });
  await Transaction.create({
    wallet_id: wallet.id,
    amount: -fee,
    type: 'contest_entry',
    status: 'completed',
    description,
  }, { transaction });
  return wallet;
}

/**
 * Checks and updates contest lock status based on match start_time and lock_time_minutes (§15)
 */
async function checkContestLocks() {
  try {
    const now = new Date();
    const lockableMatches = await CricketMatch.findAll({
      where: { status: { [Op.in]: ['upcoming', 'live', 'completed'] } },
      include: [{ model: MatchContest, as: 'contests' }],
    });

    for (const match of lockableMatches) {
      const lockTime = new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000);
      if (now >= lockTime || ['live', 'completed'].includes(match.status)) {
        // Lock all open contests for this match
        for (const contest of match.contests) {
          if (contest.status === 'open') {
            await contest.update({ status: 'locked' });
            console.log(`🔒 [LockEngine] Contest "${contest.title}" (${contest.id}) locked. Match starts at ${match.start_time}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('⚠️ [LockEngine] Error updating contest locks:', err.message);
  }
}

/**
 * Multi-Battlefield Auto-Clone Engine (Section 7 Type 2)
 * When battlefield fills -> hides (deactivates from public list) -> auto-clones new open battlefield
 */
async function handleBattlefieldFill(contest) {
  if (contest.type !== 'multi_battlefield') return;
  const spotsPerRoom = contest.spots_per_battlefield || 20;

  if (contest.filled_spots >= spotsPerRoom) {
    // Hide filled battlefield
    await contest.update({ is_active: false, status: 'locked' });

    // Auto-create next battlefield
    const nextNumber = (contest.battlefield_number || 1) + 1;
    const newBattlefield = await MatchContest.create({
      match_id: contest.match_id,
      type: 'multi_battlefield',
      title: `${contest.title.replace(/Room #\d+/, '').trim()} Room #${nextNumber}`,
      prize_pool: contest.prize_pool,
      entry_fee: contest.entry_fee,
      total_spots: spotsPerRoom,
      filled_spots: 0,
      spots_per_battlefield: spotsPerRoom,
      battlefield_number: nextNumber,
      is_active: true,
      status: 'open',
    });

    console.log(`🎮 [Battlefield] Room #${contest.battlefield_number} filled! Auto-created Room #${nextNumber} (${newBattlefield.id})`);
    return newBattlefield;
  }
  return null;
}

/**
 * Create H2H Challenge (Section 7 Type 3)
 */
async function createH2HChallenge({ matchId, senderId, senderUsername, receiverId, receiverUsername, amount, senderTeamId }) {
  const numAmount = Math.round((Number(amount) || 0) * 100) / 100;
  if (!Number.isFinite(numAmount) || numAmount < 10) throw new Error('Minimum H2H challenge amount is ₹10.');
  if (!receiverId || receiverId === senderId) throw new Error('Choose a different opponent.');
  if (!senderTeamId) throw new Error('Create your match team before sending a challenge.');

  const t = await sequelize.transaction();
  try {
    const match = await CricketMatch.findByPk(matchId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!match) throw new Error('Match not found.');
    if (match.status !== 'upcoming') throw new Error('H2H challenges are available only before the match starts.');
    if (new Date() >= new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000)) {
      throw new Error('This match is locked. H2H challenges can no longer be sent.');
    }

    const senderTeam = await CricketTeam.findByPk(senderTeamId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!senderTeam || senderTeam.user_id !== senderId || senderTeam.match_id !== matchId) {
      throw new Error('The selected team does not belong to you or this match.');
    }
    if (senderTeam.contest_id) throw new Error('Choose a team that is not already entered in another contest.');

    const duplicate = await H2HChallenge.findOne({
      where: { sender_team_id: senderTeamId, status: 'pending' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (duplicate) throw new Error('This team already has a pending challenge.');

    await chargeWalletEntry(senderId, numAmount, `H2H challenge sent to @${receiverUsername} (₹${numAmount})`, t);

    const totalPool = numAmount * 2;
    const winnerPayout = Math.round(totalPool * 0.85 * 100) / 100;
    const platformFee = Math.round(totalPool * 0.15 * 100) / 100;
    const contest = await MatchContest.create({
      match_id: matchId,
      type: 'h2h',
      title: `H2H: @${senderUsername} vs @${receiverUsername}`,
      prize_pool: winnerPayout,
      entry_fee: numAmount,
      total_spots: 2,
      filled_spots: 1,
      status: 'open',
      is_active: true,
    }, { transaction: t });
    const challenge = await H2HChallenge.create({
      match_id: matchId,
      contest_id: contest.id,
      sender_id: senderId,
      sender_username: senderUsername,
      receiver_id: receiverId,
      receiver_username: receiverUsername,
      amount: numAmount,
      sender_team_id: senderTeamId,
      prize_pool: totalPool,
      winner_payout: winnerPayout,
      platform_fee: platformFee,
      status: 'pending',
    }, { transaction: t });
    await contest.update({ h2h_challenge_id: challenge.id }, { transaction: t });
    await senderTeam.update({ contest_id: contest.id }, { transaction: t });
    await Notification.create({
      user_id: receiverId,
      type: 'h2h_challenge',
      title: `H2H challenge from @${senderUsername}`,
      message: `@${senderUsername} challenged you to a ₹${numAmount} match. Accept to create your team, or decline to reject the challenge.`,
    }, { transaction: t });

    await t.commit();
    return { challenge, contest };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

/**
 * Accept H2H Challenge (Section 7 Type 3)
 */
async function acceptH2HChallenge({ challengeId, receiverId }) {
  const t = await sequelize.transaction();
  try {
    const challenge = await H2HChallenge.findByPk(challengeId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!challenge) throw new Error('Challenge not found.');
    if (challenge.receiver_id !== receiverId) throw new Error('You are not the invited opponent.');
    if (challenge.status !== 'pending') throw new Error(`Challenge is already ${challenge.status}.`);

    const match = await CricketMatch.findByPk(challenge.match_id, { transaction: t });
    const contest = await MatchContest.findByPk(challenge.contest_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!match || !contest || !contest.is_active || contest.status !== 'open' || contest.filled_spots >= contest.total_spots) {
      throw new Error('This H2H contest is no longer available.');
    }
    if (match.status !== 'upcoming' || new Date() >= new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000)) {
      throw new Error('This match is locked. The challenge can no longer be accepted.');
    }

    await challenge.update({ status: 'accepted' }, { transaction: t });
    await Notification.create({
      user_id: challenge.sender_id,
      type: 'h2h_challenge',
      title: `H2H challenge accepted by @${challenge.receiver_username}`,
      message: `@${challenge.receiver_username} accepted your ₹${challenge.amount} challenge. Their team entry fee will be charged when they create their team.`,
    }, { transaction: t });
    await t.commit();
    return { challenge, contest };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

/**
 * Reject / Give Up H2H Challenge (Section 7 Type 3)
 */
async function rejectH2HChallenge({ challengeId, userId }) {
  const t = await sequelize.transaction();
  try {
    const challenge = await H2HChallenge.findByPk(challengeId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!challenge) throw new Error('Challenge not found.');
    if (challenge.receiver_id !== userId && challenge.sender_id !== userId) throw new Error('Unauthorized.');
    if (challenge.status !== 'pending') throw new Error(`Challenge is already ${challenge.status}.`);

    const senderWallet = await Wallet.findOne({ where: { user_id: challenge.sender_id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!senderWallet) throw new Error('Sender wallet not found; challenge cannot be safely refunded.');
    const balance = Number(senderWallet.balance) || 0;
    await senderWallet.update({
      balance: Math.round((balance + Number(challenge.amount)) * 10000) / 10000,
      deposit_balance: (Number(senderWallet.deposit_balance) || 0) + Number(challenge.amount),
    }, { transaction: t });
    await Transaction.create({
      wallet_id: senderWallet.id,
      amount: challenge.amount,
      type: 'contest_refund',
      status: 'completed',
      description: `Refund for rejected H2H challenge (₹${challenge.amount})`,
    }, { transaction: t });

    await challenge.update({ status: 'rejected' }, { transaction: t });
    const contest = await MatchContest.findByPk(challenge.contest_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (contest) await contest.update({ status: 'cancelled', is_active: false }, { transaction: t });
    const senderTeam = challenge.sender_team_id
      ? await CricketTeam.findByPk(challenge.sender_team_id, { transaction: t, lock: t.LOCK.UPDATE })
      : null;
    if (senderTeam?.contest_id === challenge.contest_id) await senderTeam.update({ contest_id: null }, { transaction: t });

    if (userId === challenge.receiver_id) {
      await Notification.create({
        user_id: challenge.sender_id,
        type: 'h2h_challenge_rejected',
        title: `H2H challenge declined by @${challenge.receiver_username}`,
        message: `@${challenge.receiver_username} declined your ₹${challenge.amount} challenge. ₹${challenge.amount} has been refunded to your wallet.`,
      }, { transaction: t });
    }

    await t.commit();
    return { success: true, message: 'Challenge declined and sender refunded.' };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

module.exports = {
  checkContestLocks,
  handleBattlefieldFill,
  createH2HChallenge,
  acceptH2HChallenge,
  rejectH2HChallenge,
  chargeWalletEntry,
};

