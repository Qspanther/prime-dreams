// 🎯 PRIME DREEMS — CONTEST ENGINE
// Handles Standard, Multi-Battlefield (Auto-Clone), H2H & Lock Timing

const { MatchContest, CricketMatch, H2HChallenge, Wallet, Transaction, Notification } = require('../db/models');

/**
 * Checks and updates contest lock status based on match start_time and lock_time_minutes (§15)
 */
async function checkContestLocks() {
  try {
    const now = new Date();
    const upcomingMatches = await CricketMatch.findAll({
      where: { status: 'upcoming' },
      include: [{ model: MatchContest, as: 'contests' }],
    });

    for (const match of upcomingMatches) {
      const lockTime = new Date(match.start_time.getTime() - (match.lock_time_minutes || 15) * 60000);
      if (now >= lockTime) {
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
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Valid challenge amount is required');
  }

  // 1. Check sender wallet
  const senderWallet = await Wallet.findOne({ where: { user_id: senderId } });
  if (!senderWallet || senderWallet.balance < numAmount) {
    throw new Error(`Insufficient wallet balance. You need ₹${numAmount} to initiate this challenge.`);
  }

  // 2. Deduct sender wallet
  await senderWallet.update({ balance: senderWallet.balance - numAmount });
  await Transaction.create({
    wallet_id: senderWallet.id,
    amount: -numAmount,
    type: 'contest_entry',
    description: `H2H challenge sent to @${receiverUsername} (₹${numAmount})`,
  });

  const totalPool = numAmount * 2;
  const winnerPayout = Math.round(totalPool * 0.85 * 100) / 100; // 85%
  const platformFee = Math.round(totalPool * 0.15 * 100) / 100;  // 15%

  // 3. Create H2H Contest record
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
  });

  // 4. Create H2H Challenge record
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
  });

  await contest.update({ h2h_challenge_id: challenge.id });

  // 5. Send Notification to Receiver (Section 7)
  await Notification.create({
    user_id: receiverId,
    type: 'h2h_challenge',
    title: `⚔️ H2H Challenge from @${senderUsername}`,
    message: `@${senderUsername} has challenged you to a ₹${numAmount} Head-to-Head match! Winner takes ₹${winnerPayout}.`,
    data: {
      challenge_id: challenge.id,
      contest_id: contest.id,
      match_id: matchId,
      amount: numAmount,
      sender_username: senderUsername,
    },
  });

  return { challenge, contest };
}

/**
 * Accept H2H Challenge (Section 7 Type 3)
 */
async function acceptH2HChallenge({ challengeId, receiverId }) {
  const challenge = await H2HChallenge.findByPk(challengeId);
  if (!challenge) throw new Error('Challenge not found');
  if (challenge.receiver_id !== receiverId) throw new Error('Unauthorized');
  if (challenge.status !== 'pending') throw new Error(`Challenge is already ${challenge.status}`);

  // 1. Check receiver wallet
  const receiverWallet = await Wallet.findOne({ where: { user_id: receiverId } });
  if (!receiverWallet || receiverWallet.balance < challenge.amount) {
    throw new Error(`Insufficient wallet balance. You need ₹${challenge.amount} to accept this challenge.`);
  }

  // 2. Deduct receiver wallet
  await receiverWallet.update({ balance: receiverWallet.balance - challenge.amount });
  await Transaction.create({
    wallet_id: receiverWallet.id,
    amount: -challenge.amount,
    type: 'contest_entry',
    description: `Accepted H2H challenge from @${challenge.sender_username} (₹${challenge.amount})`,
  });

  // 3. Update challenge & contest status
  await challenge.update({ status: 'accepted' });
  const contest = await MatchContest.findByPk(challenge.contest_id);
  if (contest) {
    await contest.update({ filled_spots: 2, status: 'locked' });
  }

  // 4. Notify sender
  await Notification.create({
    user_id: challenge.sender_id,
    type: 'h2h_challenge',
    title: `⚔️ Challenge Accepted by @${challenge.receiver_username}!`,
    message: `@${challenge.receiver_username} accepted your ₹${challenge.amount} H2H challenge. Match on!`,
    data: { challenge_id: challenge.id, match_id: challenge.match_id },
  });

  return { challenge, contest };
}

/**
 * Reject / Give Up H2H Challenge (Section 7 Type 3)
 */
async function rejectH2HChallenge({ challengeId, userId }) {
  const challenge = await H2HChallenge.findByPk(challengeId);
  if (!challenge) throw new Error('Challenge not found');
  if (challenge.receiver_id !== userId && challenge.sender_id !== userId) {
    throw new Error('Unauthorized');
  }
  if (challenge.status !== 'pending') throw new Error(`Challenge is already ${challenge.status}`);

  // Refund sender
  const senderWallet = await Wallet.findOne({ where: { user_id: challenge.sender_id } });
  if (senderWallet) {
    await senderWallet.update({ balance: senderWallet.balance + challenge.amount });
    await Transaction.create({
      wallet_id: senderWallet.id,
      amount: challenge.amount,
      type: 'contest_win',
      description: `Refund for rejected H2H challenge (₹${challenge.amount})`,
    });
  }

  await challenge.update({ status: 'rejected' });
  const contest = await MatchContest.findByPk(challenge.contest_id);
  if (contest) {
    await contest.update({ status: 'cancelled', is_active: false });
  }

  return { success: true, message: 'Challenge declined and sender refunded' };
}

module.exports = {
  checkContestLocks,
  handleBattlefieldFill,
  createH2HChallenge,
  acceptH2HChallenge,
  rejectH2HChallenge,
};

