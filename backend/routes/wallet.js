const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Wallet, Transaction, User, Notification, SystemSetting } = require('../db/models');
const sequelize = require('../db/index');
const smartEngine = require('../services/smart-engine');
const { triggerInstantSync } = require('../services/tursoSyncService');

const router = express.Router();

// Default INR payment receiving details
const DEFAULT_INR_CONFIG = {
  currency: 'INR',
  currencySymbol: '₹',
  minDeposit: 99,
  maxDeposit: 100000,
  minWithdrawal: 100,
  upi: {
    id: 'primedreems@upi',
    name: 'Prime Dreems',
    qrPayload: 'upi://pay?pa=primedreems@upi&pn=Prime%20Dreems&cu=INR'
  },
  bank: {
    accountName: 'Prime Dreems Sports Pvt Ltd',
    accountNumber: '50200084729104',
    ifsc: 'HDFC0000240',
    bankName: 'HDFC Bank Ltd'
  }
};

// GET /wallet/config — Public & Authenticated INR Gateway Configuration
router.get('/config', async (req, res) => {
  try {
    const settings = await SystemSetting.findAll({
      where: {
        key: ['inr_upi_id', 'inr_upi_name', 'inr_bank_name', 'inr_account_number', 'inr_ifsc']
      }
    });

    const config = JSON.parse(JSON.stringify(DEFAULT_INR_CONFIG));
    settings.forEach(s => {
      if (s.key === 'inr_upi_id' && s.value) {
        config.upi.id = s.value;
        config.upi.qrPayload = `upi://pay?pa=${encodeURIComponent(s.value)}&pn=Prime%20Dreems&cu=INR`;
      }
      if (s.key === 'inr_upi_name' && s.value) config.upi.name = s.value;
      if (s.key === 'inr_bank_name' && s.value) config.bank.bankName = s.value;
      if (s.key === 'inr_account_number' && s.value) config.bank.accountNumber = s.value;
      if (s.key === 'inr_ifsc' && s.value) config.bank.ifsc = s.value;
    });

    res.json(config);
  } catch (error) {
    console.error('Wallet config error:', error);
    res.status(500).json({ error: 'Failed to retrieve INR wallet config' });
  }
});

// GET /wallet/crypto-addresses — Legacy route compatibility
router.get('/crypto-addresses', async (req, res) => {
  res.json({
    currency: 'INR',
    currencySymbol: '₹',
    ...DEFAULT_INR_CONFIG
  });
});

// GET /wallet/balance — Get user's INR balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ where: { user_id: req.userId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    res.json({
      balance: parseFloat(wallet.balance),
      deposit_balance: parseFloat(wallet.deposit_balance) || 0,
      winnings_balance: parseFloat(wallet.winnings_balance) || 0,
      bonus_balance: parseFloat(wallet.bonus_balance) || 0,
      withdrawable_balance: (parseFloat(wallet.deposit_balance) || 0) + (parseFloat(wallet.winnings_balance) || 0),
      currency: 'INR',
      currencySymbol: '₹'
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /wallet/deposit-request — Submit INR Deposit Proof (UPI / UTR Ref)
router.post('/deposit-request', authenticate, async (req, res) => {
  try {
    const { amount, method = 'UPI', txid, utr, sender_upi } = req.body;
    const numAmount = parseFloat(amount);
    const referenceNumber = (utr || txid || '').trim();

    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount < 10 || numAmount > 1000000) {
      return res.status(400).json({ error: 'Minimum deposit amount is ₹10' });
    }

    if (!referenceNumber || referenceNumber.length < 6) {
      return res.status(400).json({ error: 'Valid 12-digit UPI Reference Number / UTR is required' });
    }

    // Check if UTR already submitted
    const existing = await Transaction.findOne({ where: { txid: referenceNumber } });
    if (existing) {
      return res.status(400).json({ error: 'This UTR / Reference Number has already been submitted' });
    }

    const wallet = await Wallet.findOne({ where: { user_id: req.userId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const payMethod = method.toUpperCase();
    const isAutoCredit = process.env.NODE_ENV !== 'production' || req.body.instant === true;
    const txStatus = isAutoCredit ? 'completed' : 'pending';

    if (isAutoCredit) {
      const curBal = Number(wallet.balance) || 0;
      const curDep = Number(wallet.deposit_balance) || 0;
      await wallet.update({
        balance: Math.round((curBal + numAmount) * 100) / 100,
        deposit_balance: Math.round((curDep + numAmount) * 100) / 100,
      });
    }

    const tx = await Transaction.create({
      wallet_id: wallet.id,
      type: 'deposit',
      amount: numAmount,
      network: payMethod,
      txid: referenceNumber,
      wallet_address: sender_upi || '',
      status: txStatus,
      description: `INR (₹${numAmount.toLocaleString('en-IN')}) Deposit via ${payMethod} - UTR: ${referenceNumber.slice(-8)}`,
    });

    await Notification.create({
      user_id: req.userId,
      title: isAutoCredit ? '₹ Wallet Credited' : '₹ Deposit Proof Submitted',
      message: isAutoCredit
        ? `₹${numAmount.toLocaleString('en-IN')} has been added to your wallet successfully.`
        : `Your deposit proof of ₹${numAmount.toLocaleString('en-IN')} via ${payMethod} (UTR: ${referenceNumber}) has been submitted. It will be verified shortly.`,
      type: 'wallet_deposit',
    });

    triggerInstantSync(['wallets', 'transactions']);

    res.json({
      message: isAutoCredit
        ? `₹${numAmount.toLocaleString('en-IN')} added to wallet successfully!`
        : 'Deposit proof submitted successfully! Balance will be credited upon verification.',
      transaction: tx,
      balance: wallet.balance,
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /wallet/add-funds — Instant direct funding for testing & admin
// body.source: 'deposit' | 'winnings' | 'bonus' (default deposit)
router.post('/add-funds', authenticate, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Direct demo funding is disabled in production. Please add cash using UPI and submit your 12-digit UTR.' });
    }
    const { amount, method = 'UPI', source = 'deposit' } = req.body;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0 || numAmount > 1000000) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const bucket = ['deposit', 'winnings', 'bonus'].includes(source) ? source : 'deposit';

    const result = await smartEngine.execute('wallet', async () => {
      const t = await sequelize.transaction();
      try {
        const wallet = await Wallet.findOne({ where: { user_id: req.userId }, transaction: t });
        const currentBalance = parseFloat(wallet.balance);
        const newBalance = currentBalance + numAmount;

        const updates = { balance: newBalance };
        updates[`${bucket}_balance`] = (parseFloat(wallet[`${bucket}_balance`]) || 0) + numAmount;

        await wallet.update(updates, { transaction: t });

        const tx = await Transaction.create({
          wallet_id: wallet.id,
          type: 'deposit',
          amount: numAmount,
          network: method.toUpperCase(),
          status: 'completed',
          description: `Direct INR (₹${numAmount.toLocaleString('en-IN')}) Quick Credit`,
        }, { transaction: t });

        await Notification.create({
          user_id: req.userId,
          title: '₹ Wallet Credited',
          message: `₹${numAmount.toLocaleString('en-IN')} has been added to your INR wallet.`,
          type: 'wallet_deposit',
        }, { transaction: t });

        await t.commit();

        return {
          message: `₹${numAmount.toLocaleString('en-IN')} added successfully`,
          balance: newBalance,
          transaction: tx,
        };
      } catch (error) {
        await t.rollback();
        throw error;
      }
    }, true);

    res.json(result);
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /wallet/withdraw — Submit INR Payout Request (UPI / Bank Account)
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const { amount, method = 'UPI', upi_id, account_number, ifsc, account_name, bank_name } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount < 100 || numAmount > 500000) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ₹100' });
    }

    const payMethod = method.toUpperCase();

    if (payMethod === 'UPI') {
      if (!upi_id || !upi_id.includes('@')) {
        return res.status(400).json({ error: 'Valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm) is required' });
      }
    } else {
      if (!account_number || account_number.trim().length < 8) {
        return res.status(400).json({ error: 'Valid Bank Account Number is required' });
      }
      if (!ifsc || ifsc.trim().length < 8) {
        return res.status(400).json({ error: 'Valid Bank IFSC code is required' });
      }
    }

    // Check KYC status
    const user = await User.findByPk(req.userId);
    if (user.kyc_status !== 'verified') {
      return res.status(403).json({ error: 'KYC PAN verification required before INR withdrawal', kycStatus: user.kyc_status });
    }

    const result = await smartEngine.execute('wallet', async () => {
      const t = await sequelize.transaction();
      try {
        const wallet = await Wallet.findOne({ where: { user_id: req.userId }, transaction: t });
        const currentBalance = parseFloat(wallet.balance);
        const winnings = parseFloat(wallet.winnings_balance) || 0;
        const deposit = parseFloat(wallet.deposit_balance) || 0;
        const withdrawable = winnings + deposit;

        if (withdrawable < numAmount) {
          await t.rollback();
          return { errorStatus: 400, data: { error: `Insufficient withdrawable balance. Winnings + Deposit available: ₹${withdrawable.toLocaleString('en-IN')} (bonus cash is not withdrawable)` } };
        }

        // Deduct from winnings first, then deposit (bonus untouched)
        let remaining = numAmount;
        const useWinnings = Math.min(winnings, remaining); remaining -= useWinnings;
        const useDeposit = Math.min(deposit, remaining); remaining -= useDeposit;

        // TDS: 30% on the winnings portion of withdrawals of ₹10,000+ (Indian tax rule)
        let tdsAmount = 0;
        let payoutAmount = numAmount;
        if (numAmount >= 10000 && useWinnings > 0) {
          tdsAmount = Math.round(useWinnings * 0.30 * 100) / 100;
          payoutAmount = Math.round((numAmount - tdsAmount) * 100) / 100;
        }

        const newBalance = currentBalance - numAmount;
        await wallet.update({
          balance: newBalance,
          winnings_balance: winnings - useWinnings,
          deposit_balance: deposit - useDeposit,
        }, { transaction: t });

        const destination = payMethod === 'UPI' ? upi_id.trim() : `A/C ${account_number.slice(-4)} (${ifsc})`;
        const tx = await Transaction.create({
          wallet_id: wallet.id,
          type: 'withdraw',
          amount: -numAmount,
          network: payMethod,
          wallet_address: destination,
          status: 'pending',
          description: `INR (₹${numAmount.toLocaleString('en-IN')}) Payout via ${payMethod} to ${destination}${tdsAmount > 0 ? ` — TDS ₹${tdsAmount.toLocaleString('en-IN')} deducted` : ''}`,
        }, { transaction: t });

        if (tdsAmount > 0) {
          await Transaction.create({
            wallet_id: wallet.id,
            type: 'tds',
            amount: -tdsAmount,
            network: payMethod,
            status: 'pending',
            description: `TDS @30% on winnings portion ₹${useWinnings.toLocaleString('en-IN')} of ₹${numAmount.toLocaleString('en-IN')} withdrawal (₹10,000+ threshold). Payout: ₹${payoutAmount.toLocaleString('en-IN')}`,
          }, { transaction: t });
        }

        const tdsNote = tdsAmount > 0
          ? ` TDS of ₹${tdsAmount.toLocaleString('en-IN')} (30%) has been deducted — you will receive ₹${payoutAmount.toLocaleString('en-IN')}.`
          : '';

        await Notification.create({
          user_id: req.userId,
          title: '₹ Withdrawal Request Submitted',
          message: `Your payout request of ₹${numAmount.toLocaleString('en-IN')} via ${payMethod} to ${destination} is being processed.${tdsNote}`,
          type: 'wallet_withdrawal',
        }, { transaction: t });

        await t.commit();

        return {
          status: 200,
          data: {
            message: `Withdrawal request submitted successfully! Processing payout.${tdsNote}`,
            balance: newBalance,
            tds_amount: tdsAmount,
            payout_amount: payoutAmount,
            transaction: tx,
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
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /wallet/kyc — Submit KYC PAN verification
router.post('/kyc', authenticate, async (req, res) => {
  try {
    const { fullName, panNumber } = req.body;
    if (!fullName || !panNumber) {
      return res.status(400).json({ error: 'Full name and PAN number are required' });
    }

    const cleanPan = panNumber.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
      return res.status(400).json({ error: 'Invalid PAN format. Use 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)' });
    }

    await User.update(
      { kyc_status: 'verified', kyc_name: fullName.trim(), kyc_pan: cleanPan },
      { where: { id: req.userId } }
    );

    res.json({ message: 'KYC verified successfully! You can now withdraw funds.', kycStatus: 'verified' });
  } catch (error) {
    console.error('KYC error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /wallet/transactions — User's transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ where: { user_id: req.userId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const transactions = await Transaction.findAll({
      where: { wallet_id: wallet.id },
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
