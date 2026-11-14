'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { apiGet, apiPost } from '../lib/api';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft,
  Trophy, History, Check, Copy, AlertCircle, RefreshCw, Zap, ArrowLeft
} from 'lucide-react';

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

export default function WalletPage() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramAmount = searchParams.get('amount') || searchParams.get('depositAmount') || searchParams.get('needed');
  const returnUrl = searchParams.get('returnUrl');
  const paramMessage = searchParams.get('message');

  const [balance, setBalance] = useState(0);
  const [depositBalance, setDepositBalance] = useState(0);
  const [winningsBalance, setWinningsBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [withdrawable, setWithdrawable] = useState(0);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');

  const [depositAmount, setDepositAmount] = useState(paramAmount ? String(Math.max(10, parseFloat(paramAmount))) : '500');
  const [depositUtr, setDepositUtr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('200');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kycVerified, setKycVerified] = useState(user?.kycStatus === 'verified');
  const [kycName, setKycName] = useState('');
  const [kycPan, setKycPan] = useState('');
  const [kycLoading, setKycLoading] = useState(false);

  useEffect(() => {
    if (paramAmount) {
      setDepositAmount(String(Math.max(10, parseFloat(paramAmount))));
    }
  }, [paramAmount]);

  useEffect(() => { setKycVerified(user?.kycStatus === 'verified'); }, [user?.kycStatus]);

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const bRes = await apiGet('/wallet/balance', token);
      if (typeof bRes?.balance === 'number') setBalance(bRes.balance);
      setDepositBalance(Number(bRes?.deposit_balance) || 0);
      setWinningsBalance(Number(bRes?.winnings_balance) || 0);
      setBonusBalance(Number(bRes?.bonus_balance) || 0);
      setWithdrawable(Number(bRes?.withdrawable_balance) || 0);

      const tRes = await apiGet('/wallet/transactions', token);
      if (Array.isArray(tRes)) setTransactions(tRes);
      else if (Array.isArray(tRes?.transactions)) setTransactions(tRes.transactions);
    } catch (err) {}
  };

  useEffect(() => {
    fetchWallet();
  }, [token]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositUtr.trim()) {
      setError('Please enter the 12-digit UPI UTR / Transaction ID');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await apiPost('/wallet/deposit-request', {
        amount: parseFloat(depositAmount),
        utr: depositUtr.trim(),
        method: 'UPI',
      }, token);

      if (res?.transaction || res?.message) {
        setMessage('✅ Deposit proof submitted! Your balance will be credited once the UTR is verified.');
        setDepositUtr('');
        fetchWallet();
      } else {
        setError(res?.error || 'Deposit failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Error processing deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantDeposit = async (amt: number) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiPost('/wallet/deposit-request', {
        amount: amt,
        utr: 'UPI' + Date.now().toString().slice(-8),
        method: 'UPI',
        instant: true,
      }, token);
      if (res?.transaction || res?.message) {
        setMessage(`✅ ₹${amt} instantly added to your wallet!`);
        await fetchWallet();
      } else {
        setError(res?.error || 'Deposit failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Error processing deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 100) {
      setError('Minimum withdrawal amount is ₹100');
      return;
    }
    if (amt > withdrawable) {
      setError('Insufficient withdrawable balance (Winnings + Deposit). Bonus cash is not withdrawable.');
      return;
    }
    if (!withdrawUpi.trim()) {
      setError('Please provide a valid UPI ID (e.g. name@okaxis)');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await apiPost('/wallet/withdraw', {
        amount: amt,
        upi_id: withdrawUpi.trim(),
        method: 'UPI',
      }, token);

      if (res?.transaction || res?.message) {
        const tdsNote = res?.tds_amount > 0
          ? ` TDS ₹${Number(res.tds_amount).toLocaleString('en-IN')} deducted — payout ₹${Number(res.payout_amount).toLocaleString('en-IN')}.`
          : '';
        setMessage(`✅ Withdrawal request submitted!${tdsNote} Payout will be sent to your UPI ID.`);
        setWithdrawAmount('200');
        fetchWallet();
      } else {
        setError(res?.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      if (/KYC/i.test(err?.message || '')) setKycVerified(false);
      setError(err?.message || 'Error processing withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycName.trim() || !kycPan.trim()) {
      setError('Full name and PAN number are required');
      return;
    }
    setKycLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiPost('/wallet/kyc', {
        fullName: kycName.trim(),
        panNumber: kycPan.trim().toUpperCase(),
      }, token);
      if (res?.kycStatus === 'verified' || res?.message) {
        setKycVerified(true);
        setMessage('✅ KYC verified! You can now withdraw your winnings.');
        setKycName('');
        setKycPan('');
      } else {
        setError(res?.error || 'KYC verification failed');
      }
    } catch (err: any) {
      setError(err?.message || 'KYC verification failed');
    } finally {
      setKycLoading(false);
    }
  };

  const withdrawAmtNum = parseFloat(withdrawAmount) || 0;
  const winningsPortion = Math.min(winningsBalance, withdrawAmtNum);
  const tdsPreview = withdrawAmtNum >= 10000 && winningsPortion > 0
    ? Math.round(winningsPortion * 0.30 * 100) / 100
    : 0;
  const payoutPreview = Math.round((withdrawAmtNum - tdsPreview) * 100) / 100;

  return (
    <div className="px-3 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6 bg-transparent">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-[#0F172A] flex items-center gap-2.5">
            <WalletIcon className="w-7 h-7 text-[#DC2626] drop-shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
            <span>Prime Dreems Wallet</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-bold mt-1">Instant UPI deposits and fast INR payouts</p>
        </div>
        <button
          onClick={fetchWallet}
          className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#2563EB] hover:border-[#2563EB]/40 transition shadow-md"
          title="Refresh Balance"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Low Balance Prompt from Contest / H2H Flow */}
      {(paramAmount || returnUrl) && (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 text-amber-950 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shrink-0 shadow-md">💰</span>
            <div>
              <h3 className="font-black text-sm text-amber-950">Add Cash to Join Contest</h3>
              <p className="text-xs text-amber-800 font-bold mt-0.5">
                {paramMessage || `Contest join karne ke liye aapke wallet me kam se kam ₹${paramAmount || 49} hona chahiye.`}
              </p>
            </div>
          </div>
          {returnUrl && (
            <button
              type="button"
              onClick={() => router.push(returnUrl)}
              className="prime-btn-dark-3d !py-2 !px-4 text-xs font-black shrink-0 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Match / XI</span>
            </button>
          )}
        </div>
      )}

      {/* 3D Elevated Gold & Ruby Balance Card */}
      <div className="prime-card-shiny-gold p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-20">
          <Zap className="w-32 h-32 text-[#D97706]" />
        </div>

        <span className="text-xs font-black uppercase tracking-widest text-[#D97706] block">Total Wallet Balance</span>
        <div className="text-3xl sm:text-5xl font-black text-[#D97706] mt-1 font-mono drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-[#64748B] font-bold mt-2">
          100% Guaranteed Reserve • Instant entry into Mega Contests, PUBG rooms, and 1-on-1 H2H duels.
        </p>
      </div>

      {/* Balance Split: Deposit / Winnings / Bonus */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="prime-card-3d p-4">
          <span className="pd-eyebrow text-[10px] text-[#64748B] block">Deposit</span>
          <span className="pd-num font-black text-lg text-[#2563EB] font-mono">₹{depositBalance.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-[#64748B] font-bold block mt-0.5">Withdrawable</span>
        </div>
        <div className="prime-card-3d p-4">
          <span className="pd-eyebrow text-[10px] text-[#64748B] block">Winnings</span>
          <span className="pd-num font-black text-lg text-[#16A34A] font-mono">₹{winningsBalance.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-[#64748B] font-bold block mt-0.5">Withdrawable</span>
        </div>
        <div className="prime-card-3d p-4">
          <span className="pd-eyebrow text-[10px] text-[#64748B] block">Cash Bonus</span>
          <span className="pd-num font-black text-lg text-[#D97706] font-mono">₹{bonusBalance.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-[#64748B] font-bold block mt-0.5">Entry only • not withdrawable</span>
        </div>
        <div className="prime-card-3d p-4">
          <span className="pd-eyebrow text-[10px] text-[#64748B] block">Withdrawable</span>
          <span className="pd-num font-black text-lg text-[#0F172A] font-mono">₹{withdrawable.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-[#64748B] font-bold block mt-0.5">Deposit + Winnings</span>
        </div>
      </div>

      {/* Action Tabs (3D Buttons) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 border-b border-[#E2E8F0] pb-3">
        {[
          { id: 'deposit', label: 'Add Cash (UPI)', icon: ArrowDownLeft },
          { id: 'withdraw', label: 'Withdraw', icon: ArrowUpRight },
          { id: 'history', label: 'Transaction History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setError(null);
                setMessage(null);
              }}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                isActive
                  ? 'prime-btn-3d !py-2.5 !px-4'
                  : 'prime-btn-dark-3d !py-2.5 !px-4 !text-[#64748B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border-2 border-red-300 text-red-700 text-xs font-black flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3.5 rounded-xl bg-green-50 border-2 border-green-300 text-green-700 text-xs font-black flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-green-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Tab 1: Deposit */}
      {activeTab === 'deposit' && (
        <div className="prime-card-3d p-6 space-y-5">
          <div>
            <h3 className="font-black text-[#0F172A] text-base">Instant Add Cash via UPI</h3>
            <p className="text-xs text-[#64748B] font-bold">Fast verified deposit via GPay, PhonePe, Paytm, or BHIM</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F1F5F9] border-2 border-[#CBD5E1] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-[#64748B] uppercase font-black">Official Prime Dreems UPI ID</p>
              <p className="text-lg font-mono font-black text-[#D97706]">primedreems@upi</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('primedreems@upi');
                setCopiedUpi(true);
                setTimeout(() => setCopiedUpi(false), 2000);
              }}
              className="prime-btn-gold-3d text-xs !py-2 !px-4"
            >
              {copiedUpi ? 'Copied!' : 'Copy UPI ID'}
            </button>
          </div>

          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#D97706] uppercase mb-1.5">
                Deposit Amount (₹)
              </label>
              <div className="flex gap-2">
                {['100', '250', '500', '1000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className={`px-4 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                      depositAmount === amt
                        ? 'prime-btn-3d !py-2 !px-4'
                        : 'prime-btn-dark-3d !py-2 !px-4 !text-[#64748B]'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-[#64748B] uppercase mb-1.5">
                UPI Reference / UTR Number (12 Digits)
              </label>
              <input
                type="text"
                value={depositUtr}
                onChange={(e) => setDepositUtr(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none font-mono font-bold"
                placeholder="e.g. 412389102938"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="prime-btn-3d w-full !py-3 text-xs font-black uppercase tracking-wider"
            >
              {loading ? 'Submitting...' : `Submit Deposit of ₹${depositAmount}`}
            </button>

            {/* Quick Instant Demo Add Button */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#D97706]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Instant Quick Credit (1-Click)</span>
                </span>
                <span className="text-[#16A34A] font-bold text-[11px]">Instant Balance</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[50, 100, 250, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={loading}
                    onClick={() => handleInstantDeposit(amt)}
                    className="prime-btn-gold-3d !py-2 !px-2 text-xs font-black"
                  >
                    + Quick ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {returnUrl && balance > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push(returnUrl)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 border-2 border-emerald-300 cursor-pointer"
                >
                  <span>🎉 Balance Available (₹{balance}) — Return to Match & Join Contest →</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tab 2: Withdraw */}
      {activeTab === 'withdraw' && (
        <div className="prime-card-3d p-6 space-y-5">
          <div>
            <h3 className="font-black text-[#0F172A] text-base">Withdraw Funds</h3>
            <p className="text-xs text-[#64748B] font-bold">Withdraw your winnings + deposit to your UPI ID (Min ₹100). Bonus cash is not withdrawable.</p>
          </div>

          {!kycVerified ? (
            <form onSubmit={handleKyc} className="space-y-4 p-4 rounded-xl bg-[#FFFBEB] border-2 border-[#FDE68A]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#D97706]" />
                <h4 className="font-black text-sm text-[#0F172A]">PAN KYC Required</h4>
              </div>
              <p className="text-xs text-[#64748B] font-bold">Withdrawals require a verified PAN. TDS @30% applies to the winnings portion of payouts ₹10,000+.</p>
              <div>
                <label className="block text-xs font-black text-[#64748B] uppercase mb-1.5">Full Name (as on PAN)</label>
                <input
                  type="text"
                  value={kycName}
                  onChange={(e) => setKycName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none font-bold"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#64748B] uppercase mb-1.5">PAN Number</label>
                <input
                  type="text"
                  value={kycPan}
                  onChange={(e) => setKycPan(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none font-mono font-black tracking-widest"
                  placeholder="ABCDE1234F"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={kycLoading}
                className="prime-btn-gold-3d w-full !py-3 text-xs font-black uppercase tracking-wider"
              >
                {kycLoading ? 'Verifying...' : 'Verify PAN & Unlock Withdrawals'}
              </button>
            </form>
          ) : (
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#D97706] uppercase mb-1.5">
                Withdrawal Amount (₹)
              </label>
              <input
                type="number"
                min="100"
                step="10"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none font-mono font-black"
                required
              />
              <p className="text-[11px] text-[#64748B] font-bold mt-1">Withdrawable: ₹{withdrawable.toLocaleString('en-IN')}</p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#64748B] uppercase mb-1.5">
                Your UPI ID (VPA)
              </label>
              <input
                type="text"
                value={withdrawUpi}
                onChange={(e) => setWithdrawUpi(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none font-bold"
                placeholder="yourname@okaxis"
                required
              />
            </div>

            {tdsPreview > 0 && (
              <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-bold text-[#1D4ED8] space-y-1">
                <p>TDS @30% on winnings portion: <span className="font-mono font-black">−₹{tdsPreview.toLocaleString('en-IN')}</span></p>
                <p>You will receive: <span className="font-mono font-black">₹{payoutPreview.toLocaleString('en-IN')}</span></p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="prime-btn-3d w-full !py-3 text-xs font-black uppercase tracking-wider"
            >
              {loading ? 'Processing...' : `Withdraw ₹${withdrawAmount}`}
            </button>
          </form>
          )}
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="prime-card-3d p-6 space-y-4">
          <h3 className="font-black text-[#0F172A] text-base mb-2">Transaction History</h3>

          {transactions.length === 0 ? (
            <p className="text-xs text-[#64748B] font-bold text-center py-8">No transactions found</p>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] flex items-center justify-between"
                >
                  <div>
                    <p className="font-black text-sm text-[#0F172A]">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-[#64748B] font-bold">{tx.created_at || tx.createdAt || 'Recent'}</p>
                  </div>
                  <span
                    className={`font-black text-base font-mono ${
                      Number(tx.amount) >= 0 ? 'text-[#D97706]' : 'text-[#DC2626]'
                    }`}
                  >
                    {Number(tx.amount) >= 0 ? `+₹${tx.amount}` : `-₹${Math.abs(Number(tx.amount))}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
