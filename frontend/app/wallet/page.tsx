'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { apiGet, apiPost } from '../lib/api';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft,
  Trophy, History, Check, Copy, AlertCircle, RefreshCw, Zap
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
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');

  const [depositAmount, setDepositAmount] = useState('500');
  const [depositUtr, setDepositUtr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('200');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const bRes = await apiGet('/wallet/balance', token);
      if (typeof bRes?.balance === 'number') setBalance(bRes.balance);

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
      const res = await apiPost('/wallet/deposit-inr', {
        amount: parseFloat(depositAmount),
        utr_number: depositUtr.trim(),
        payment_method: 'UPI',
      }, token);

      if (res?.success) {
        setMessage('✅ Deposit request submitted successfully! Your balance will update as soon as the UTR is verified.');
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

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 100) {
      setError('Minimum withdrawal amount is ₹100');
      return;
    }
    if (amt > balance) {
      setError('Insufficient wallet balance');
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
      const res = await apiPost('/wallet/withdraw-inr', {
        amount: amt,
        upi_id: withdrawUpi.trim(),
      }, token);

      if (res?.success) {
        setMessage('✅ Withdrawal request submitted! Payout will be sent directly to your UPI ID.');
        setWithdrawAmount('200');
        fetchWallet();
      } else {
        setError(res?.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Error processing withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-3 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6 bg-[#000000]">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <WalletIcon className="w-7 h-7 text-[#FF1744] drop-shadow-[0_0_10px_#FF1744]" />
            <span>Prime Dreems Wallet</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#A3A3A3] font-bold mt-1">Instant UPI deposits and fast INR payouts</p>
        </div>
        <button
          onClick={fetchWallet}
          className="p-2.5 rounded-xl bg-[#141414] border border-[#262626] text-[#A3A3A3] hover:text-[#FFD700] hover:border-[#FFD700]/40 transition shadow-md"
          title="Refresh Balance"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 3D Elevated Gold & Ruby Balance Card */}
      <div className="prime-card-shiny-gold p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-20">
          <Zap className="w-32 h-32 text-[#FFD700]" />
        </div>

        <span className="text-xs font-black uppercase tracking-widest text-[#FFD700] block">Available Liquid Balance</span>
        <div className="text-3xl sm:text-5xl font-black text-[#FFD700] mt-1 font-mono drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]">
          ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-[#E5E5E5] font-bold mt-2">
          100% Guaranteed Reserve • Instant entry into Mega Contests, PUBG rooms, and 1-on-1 H2H duels.
        </p>
      </div>

      {/* Action Tabs (3D Buttons) */}
      <div className="flex items-center gap-2.5 border-b border-[#222222] pb-3">
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                isActive
                  ? 'prime-btn-3d !py-2.5 !px-4'
                  : 'prime-btn-dark-3d !py-2.5 !px-4 !text-[#A3A3A3]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border-2 border-red-500/60 text-red-200 text-xs font-black flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3.5 rounded-xl bg-green-950/80 border-2 border-green-500/60 text-green-200 text-xs font-black flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-green-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Tab 1: Deposit */}
      {activeTab === 'deposit' && (
        <div className="prime-card-3d p-6 space-y-5">
          <div>
            <h3 className="font-black text-white text-base">Instant Add Cash via UPI</h3>
            <p className="text-xs text-[#A3A3A3] font-bold">Fast verified deposit via GPay, PhonePe, Paytm, or BHIM</p>
          </div>

          <div className="p-4 rounded-xl bg-[#000000] border-2 border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-[#A3A3A3] uppercase font-black">Official Prime Dreems UPI ID</p>
              <p className="text-lg font-mono font-black text-[#FFD700]">primedreems@upi</p>
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
              <label className="block text-xs font-black text-[#FFD700] uppercase mb-1.5">
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
                        : 'prime-btn-dark-3d !py-2 !px-4 !text-[#A3A3A3]'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-[#D4D4D4] uppercase mb-1.5">
                UPI Reference / UTR Number (12 Digits)
              </label>
              <input
                type="text"
                value={depositUtr}
                onChange={(e) => setDepositUtr(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#000000] border-2 border-[#333333] text-white text-sm focus:border-[#FF1744] outline-none font-mono font-bold"
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
          </form>
        </div>
      )}

      {/* Tab 2: Withdraw */}
      {activeTab === 'withdraw' && (
        <div className="prime-card-3d p-6 space-y-5">
          <div>
            <h3 className="font-black text-white text-base">Withdraw Funds</h3>
            <p className="text-xs text-[#A3A3A3] font-bold">Withdraw your winnings directly to your UPI ID (Min ₹100)</p>
          </div>

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#FFD700] uppercase mb-1.5">
                Withdrawal Amount (₹)
              </label>
              <input
                type="number"
                min="100"
                step="10"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#000000] border-2 border-[#333333] text-white text-sm focus:border-[#FF1744] outline-none font-mono font-black"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#D4D4D4] uppercase mb-1.5">
                Your UPI ID (VPA)
              </label>
              <input
                type="text"
                value={withdrawUpi}
                onChange={(e) => setWithdrawUpi(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#000000] border-2 border-[#333333] text-white text-sm focus:border-[#FF1744] outline-none font-bold"
                placeholder="yourname@okaxis"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="prime-btn-3d w-full !py-3 text-xs font-black uppercase tracking-wider"
            >
              {loading ? 'Processing...' : `Withdraw ₹${withdrawAmount}`}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="prime-card-3d p-6 space-y-4">
          <h3 className="font-black text-white text-base mb-2">Transaction History</h3>

          {transactions.length === 0 ? (
            <p className="text-xs text-[#A3A3A3] font-bold text-center py-8">No transactions found</p>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl bg-[#000000] border border-[#222222] flex items-center justify-between"
                >
                  <div>
                    <p className="font-black text-sm text-white">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-[#A3A3A3] font-bold">{tx.created_at || tx.createdAt || 'Recent'}</p>
                  </div>
                  <span
                    className={`font-black text-base font-mono ${
                      Number(tx.amount) >= 0 ? 'text-[#FFD700]' : 'text-[#FF1744]'
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
