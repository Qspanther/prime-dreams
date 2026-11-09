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

      {/* 3D Elevated Gold & Ruby Balance Card */}
      <div className="prime-card-shiny-gold p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-20">
          <Zap className="w-32 h-32 text-[#D97706]" />
        </div>

        <span className="text-xs font-black uppercase tracking-widest text-[#D97706] block">Available Liquid Balance</span>
        <div className="text-3xl sm:text-5xl font-black text-[#D97706] mt-1 font-mono drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-[#64748B] font-bold mt-2">
          100% Guaranteed Reserve • Instant entry into Mega Contests, PUBG rooms, and 1-on-1 H2H duels.
        </p>
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
          </form>
        </div>
      )}

      {/* Tab 2: Withdraw */}
      {activeTab === 'withdraw' && (
        <div className="prime-card-3d p-6 space-y-5">
          <div>
            <h3 className="font-black text-[#0F172A] text-base">Withdraw Funds</h3>
            <p className="text-xs text-[#64748B] font-bold">Withdraw your winnings directly to your UPI ID (Min ₹100)</p>
          </div>

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
