'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { apiGet, apiPost } from '../lib/api';
import {
  Trophy, Wallet as WalletIcon, ArrowUpRight, Search, Shield,
  CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Sparkles,
  ExternalLink, Hash, Award, TrendingUp, Users, ChevronRight,
  Clock, IndianRupee, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrizeSlab {
  rank_from: number;
  rank_to: number;
  prize: number;
  percentage: number;
}

interface ContestDetail {
  id: string;
  contest_code: number;
  title: string;
  type: string;
  prize_pool: number;
  total_spots: number;
  filled_spots: number;
  status: string;
  match_title?: string;
  match?: {
    id: string;
    title: string;
    team_a: string;
    team_b: string;
    status: string;
    start_time?: string;
  };
}

interface WinnerItem {
  rank: number;
  team_name: string;
  user_name: string;
  points: number;
  prize: number;
}

interface MyParticipation {
  team_id: string;
  team_name: string;
  total_points: number;
  my_rank: number;
  prize_amount: number;
  contest_id: string;
  contest_code: number;
  contest_title: string;
  prize_pool: number;
  contest_status: string;
  match_title: string;
  match_status: string;
  created_at: string;
}

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at?: string;
}

export default function PayoutsPortalPage() {
  const { user, token } = useAuth();

  const [activeTab, setActiveTab] = useState<'search' | 'wallet' | 'my-contests'>('search');

  // Search by Contest ID state
  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedContest, setSearchedContest] = useState<ContestDetail | null>(null);
  const [breakup, setBreakup] = useState<PrizeSlab[]>([]);
  const [winners, setWinners] = useState<WinnerItem[]>([]);

  // Directory of all contests
  const [directory, setDirectory] = useState<ContestDetail[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Wallet & Withdrawals state
  const [winningsBalance, setWinningsBalance] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('200');
  const [withdrawMethod, setWithdrawMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [bankAccNumber, setBankAccNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccName, setBankAccName] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // User Participations
  const [participations, setParticipations] = useState<MyParticipation[]>([]);
  const [loadingParticipations, setLoadingParticipations] = useState(false);

  // Load contest directory on mount
  useEffect(() => {
    fetchDirectory();
  }, []);

  // Load wallet & participations if logged in
  useEffect(() => {
    if (token) {
      fetchWallet();
      fetchParticipations();
    }
  }, [token]);

  const fetchDirectory = async () => {
    setLoadingDirectory(true);
    try {
      const res = await apiGet('/contests/directory');
      if (res && res.contests) {
        setDirectory(res.contests);
      }
    } catch (e) {
      console.error('Directory fetch err:', e);
    } finally {
      setLoadingDirectory(false);
    }
  };

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const res = await apiGet('/wallet', token);
      if (res && res.wallet) {
        setWinningsBalance(parseFloat(res.wallet.winnings_balance) || 0);
        setTotalBalance(parseFloat(res.wallet.balance) || 0);
      }
      if (res && res.transactions) {
        setTransactions(res.transactions);
      }
    } catch (e) {
      console.error('Wallet fetch err:', e);
    }
  };

  const fetchParticipations = async () => {
    if (!token) return;
    setLoadingParticipations(true);
    try {
      const res = await apiGet('/contests/my-participations', token);
      if (res && res.participations) {
        setParticipations(res.participations);
      }
    } catch (e) {
      console.error('Participations fetch err:', e);
    } finally {
      setLoadingParticipations(false);
    }
  };

  const handleSearchContest = async (codeToSearch?: string) => {
    const code = (codeToSearch || searchCode).trim().replace('#', '');
    if (!code) {
      setSearchError('Please enter a numeric Contest ID (e.g. 2013)');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchedContest(null);
    setBreakup([]);
    setWinners([]);

    try {
      const res = await apiGet(`/contests/code/${code}`);
      if (res && res.contest) {
        setSearchedContest(res.contest);
        setBreakup(res.breakup || []);
        setWinners(res.winners || []);
        setSearchCode(code);
      } else {
        setSearchError(`Contest #${code} not found. Please check the ID.`);
      }
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : `Contest #${code} not found.`);
    } finally {
      setSearching(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setWithdrawMsg({ type: 'error', text: 'Please log in to submit a withdrawal request.' });
      return;
    }

    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 100) {
      setWithdrawMsg({ type: 'error', text: 'Minimum withdrawal amount is ₹100.' });
      return;
    }

    if (amt > winningsBalance) {
      setWithdrawMsg({ type: 'error', text: `Insufficient winnings balance. You have ₹${winningsBalance.toFixed(2)} available.` });
      return;
    }

    setWithdrawing(true);
    setWithdrawMsg(null);

    try {
      const body = {
        amount: amt,
        method: withdrawMethod,
        upi_id: withdrawMethod === 'UPI' ? withdrawUpi : undefined,
        account_number: withdrawMethod === 'BANK' ? bankAccNumber : undefined,
        ifsc: withdrawMethod === 'BANK' ? bankIfsc : undefined,
        account_name: withdrawMethod === 'BANK' ? bankAccName : undefined,
      };

      await apiPost('/wallet/withdraw', body, token);
      setWithdrawMsg({
        type: 'success',
        text: `🎉 Withdrawal request for ₹${amt.toFixed(2)} submitted successfully! Processed within 2-4 hours.`,
      });
      fetchWallet();
      setWithdrawAmount('200');
    } catch (err: unknown) {
      setWithdrawMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Withdrawal request failed. Please check KYC verification.',
      });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-[#F8FAFC]">
      {/* ─── Top Brand Header ─── */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/90 backdrop-blur-md border-b border-[#1E293B] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D97706] to-[#B45309] flex items-center justify-center text-white shadow-lg shadow-[#D97706]/20">
              <Trophy size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">PRIME DREEMS</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                  Official Payouts &amp; Rewards Portal
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Decoupled Prize System • Direct Winnings Withdrawals • Legal Compliance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#38BDF8] border border-[#334155] transition-all"
            >
              <ArrowLeft size={14} /> Prime Dreems Arena
            </Link>
            {user ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0F172A] border border-[#1E293B]">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-medium text-[#E2E8F0]">{user.name || user.username}</span>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Overview Bar ─── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0F172A] border-b border-[#1E293B] py-6 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0B0F19]/60 border border-[#1E293B] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8]">Withdrawable Winnings</p>
              <p className="text-2xl font-black text-[#10B981]">₹{winningsBalance.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <WalletIcon size={20} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0B0F19]/60 border border-[#1E293B] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8]">Active Contests Monitored</p>
              <p className="text-2xl font-black text-[#38BDF8]">{directory.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center">
              <Hash size={20} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0B0F19]/60 border border-[#1E293B] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8]">Your Entered Contests</p>
              <p className="text-2xl font-black text-[#F59E0B]">{participations.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center">
              <Award size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex border-b border-[#1E293B] gap-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'search'
                ? 'border-[#38BDF8] text-[#38BDF8]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Search size={16} /> Search Prize Chart by Contest ID
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'wallet'
                ? 'border-[#10B981] text-[#10B981]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <WalletIcon size={16} /> Winnings Wallet &amp; Withdrawals
          </button>

          <button
            onClick={() => setActiveTab('my-contests')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'my-contests'
                ? 'border-[#F59E0B] text-[#F59E0B]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Trophy size={16} /> My Contests &amp; Prize Claims ({participations.length})
          </button>
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* ═════ TAB 1: CONTEST SEARCH & PRIZE CHART ═════ */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Search Input Box */}
            <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] shadow-xl">
              <div className="max-w-2xl mx-auto text-center space-y-3">
                <span className="text-xs uppercase tracking-wider font-extrabold text-[#38BDF8] bg-[#38BDF8]/10 px-3 py-1 rounded-full border border-[#38BDF8]/20">
                  Instant Contest Lookup
                </span>
                <h2 className="text-2xl font-black text-white">Enter Contest ID to View Prize Breakdown</h2>
                <p className="text-xs text-[#94A3B8]">
                  Every contest on Prime Dreems has a unique numeric ID (e.g. 2011, 2012, 2013). Type the number below to inspect its total prize pool, spots, and rank-by-rank prize payouts.
                </p>

                <form
                  onSubmit={(e) => { e.preventDefault(); handleSearchContest(); }}
                  className="flex items-center gap-2 pt-2"
                >
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-[#64748B]">#</span>
                    <input
                      type="number"
                      placeholder="e.g. 2011, 2012, 2013..."
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-[#07090E] border border-[#334155] focus:border-[#38BDF8] text-white text-base font-bold outline-none transition-all placeholder:text-[#475569]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {searching ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                    Search Chart
                  </button>
                </form>

                {searchError && (
                  <div className="p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#F87171] text-xs font-semibold flex items-center justify-center gap-2">
                    <AlertCircle size={16} /> {searchError}
                  </div>
                )}

                {/* Quick Chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="text-[11px] text-[#64748B]">Popular Contests:</span>
                  {directory.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSearchContest(String(c.contest_code))}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#38BDF8] border border-[#334155] transition-all"
                    >
                      #{c.contest_code} ({c.title.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Searched Contest Result Card */}
            {searchedContest && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B]/50 border border-[#38BDF8]/40 shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-black px-2.5 py-1 rounded-lg bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40">
                          Contest #{searchedContest.contest_code}
                        </span>
                        <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">
                          {searchedContest.status}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white mt-2">{searchedContest.title}</h3>
                      <p className="text-xs text-[#94A3B8]">
                        Fixture: {searchedContest.match?.title || 'Cricket Fixture'}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-xs text-[#94A3B8]">Total Prize Pool</span>
                        <p className="text-2xl font-black text-[#10B981]">
                          ₹{searchedContest.prize_pool.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="text-right border-l border-[#334155] pl-6">
                        <span className="text-xs text-[#94A3B8]">Spots Status</span>
                        <p className="text-sm font-bold text-white">
                          <span className="text-[#38BDF8] font-black">{searchedContest.filled_spots}</span> / {searchedContest.total_spots}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rank Prize Breakup Table */}
                <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B]">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles size={18} className="text-[#F59E0B]" /> Rank-Wise Official Prize Distribution
                    </h4>
                    <span className="text-xs text-[#94A3B8]">{breakup.length} Reward Slabs</span>
                  </div>

                  {breakup.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#1E293B] text-xs font-bold uppercase text-[#64748B]">
                            <th className="py-3 px-4">Rank Tier</th>
                            <th className="py-3 px-4">Pool Share (%)</th>
                            <th className="py-3 px-4 text-right">Prize Per Winner</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E293B]">
                          {breakup.map((slab, i) => (
                            <tr key={i} className="hover:bg-[#1E293B]/30 transition-colors">
                              <td className="py-3 px-4 font-bold text-white">
                                {slab.rank_from === slab.rank_to
                                  ? `Rank #${slab.rank_from}`
                                  : `Rank #${slab.rank_from} – #${slab.rank_to}`}
                                {slab.rank_from === 1 && (
                                  <span className="ml-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B]">
                                    👑 1st Prize
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs text-[#94A3B8]">{slab.percentage}%</td>
                              <td className="py-3 px-4 text-right font-black text-[#10B981] text-base">
                                ₹{slab.prize.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B] text-center py-6">
                      Custom prize breakdown pending admin distribution for this contest.
                    </p>
                  )}
                </div>

                {/* Top Winners / Live Standings if available */}
                {winners && winners.length > 0 && (
                  <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B]">
                    <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <Trophy size={18} className="text-[#38BDF8]" /> Standings &amp; Entitled Winners
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {winners.slice(0, 9).map((w, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-[#07090E] border border-[#1E293B] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-[#94A3B8]">Rank #{w.rank}</span>
                            <p className="text-xs font-bold text-white truncate max-w-[120px]">{w.team_name}</p>
                            <p className="text-[10px] text-[#64748B]">@{w.user_name || 'Player'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-[#10B981]">₹{w.prize.toLocaleString('en-IN')}</span>
                            <p className="text-[10px] text-[#38BDF8]">{w.points} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Contests Directory Table */}
            <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">All Active Prime Dreems Contests</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Click any contest to view its prize breakdown or copy its ID.
                  </p>
                </div>
                <button
                  onClick={fetchDirectory}
                  className="text-xs text-[#38BDF8] hover:text-[#7DD3FC] flex items-center gap-1 font-semibold"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {loadingDirectory ? (
                <div className="text-center py-8 text-xs text-[#64748B] flex items-center justify-center gap-2">
                  <RefreshCw className="animate-spin" size={16} /> Loading contests...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1E293B] text-xs font-bold uppercase text-[#64748B]">
                        <th className="py-3 px-4">Contest ID</th>
                        <th className="py-3 px-4">Contest Title</th>
                        <th className="py-3 px-4">Match</th>
                        <th className="py-3 px-4">Prize Pool</th>
                        <th className="py-3 px-4">Spots</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {directory.map((c) => (
                        <tr key={c.id} className="hover:bg-[#1E293B]/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                              #{c.contest_code}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{c.title}</td>
                          <td className="py-3 px-4 text-xs text-[#94A3B8]">{c.match_title}</td>
                          <td className="py-3 px-4 font-black text-[#10B981]">
                            ₹{c.prize_pool.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#CBD5E1]">
                            {c.filled_spots} / {c.total_spots}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                handleSearchContest(String(c.contest_code));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-xs font-bold px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-all"
                            >
                              Inspect Chart →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════ TAB 2: WINNINGS WALLET & WITHDRAWALS ═════ */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            {!user ? (
              <div className="p-8 rounded-2xl bg-[#0F172A] border border-[#1E293B] text-center space-y-4 max-w-md mx-auto">
                <Shield size={36} className="text-[#38BDF8] mx-auto" />
                <h3 className="text-lg font-bold text-white">Log In to Access Your Winnings</h3>
                <p className="text-xs text-[#94A3B8]">
                  Use the same Prime Dreems email and password to log in and withdraw your winnings safely.
                </p>
                <Link
                  href="/login"
                  className="inline-block px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm"
                >
                  Log In Now
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Winnings Card & Withdraw Form */}
                <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] space-y-6">
                  <div className="p-5 rounded-xl bg-gradient-to-br from-[#064E3B] to-[#047857] text-white shadow-xl">
                    <span className="text-xs uppercase tracking-wider font-extrabold text-[#A7F3D0]">
                      Available Winnings Balance
                    </span>
                    <p className="text-3xl font-black mt-1">₹{winningsBalance.toLocaleString('en-IN')}</p>
                    <p className="text-[11px] text-[#D1FAE5] mt-1">
                      Direct withdrawal to UPI ID or Verified Bank Account.
                    </p>
                  </div>

                  <form onSubmit={handleWithdraw} className="space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Send size={16} className="text-[#10B981]" /> Request Instant Withdrawal
                    </h4>

                    {/* Method Selector */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawMethod('UPI')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                          withdrawMethod === 'UPI'
                            ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                            : 'bg-[#07090E] border-[#334155] text-[#94A3B8]'
                        }`}
                      >
                        ⚡ UPI (Instant)
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawMethod('BANK')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                          withdrawMethod === 'BANK'
                            ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                            : 'bg-[#07090E] border-[#334155] text-[#94A3B8]'
                        }`}
                      >
                        🏦 Bank IMPS
                      </button>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="text-xs text-[#94A3B8] font-medium block mb-1">
                        Withdrawal Amount (₹100 - ₹5,00,000)
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="500000"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#07090E] border border-[#334155] text-white font-bold outline-none focus:border-[#10B981]"
                      />
                    </div>

                    {withdrawMethod === 'UPI' ? (
                      <div>
                        <label className="text-xs text-[#94A3B8] font-medium block mb-1">
                          UPI ID (e.g. name@okhdfcbank or 9876543210@paytm)
                        </label>
                        <input
                          type="text"
                          placeholder="your-vpa@upi"
                          value={withdrawUpi}
                          onChange={(e) => setWithdrawUpi(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#07090E] border border-[#334155] text-white text-sm outline-none focus:border-[#10B981]"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-[#94A3B8] font-medium block mb-1">Bank Account Number</label>
                          <input
                            type="text"
                            placeholder="Account Number"
                            value={bankAccNumber}
                            onChange={(e) => setBankAccNumber(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-lg bg-[#07090E] border border-[#334155] text-white text-sm outline-none focus:border-[#10B981]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-[#94A3B8] font-medium block mb-1">IFSC Code</label>
                            <input
                              type="text"
                              placeholder="HDFC0001234"
                              value={bankIfsc}
                              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 rounded-lg bg-[#07090E] border border-[#334155] text-white text-sm outline-none focus:border-[#10B981]"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[#94A3B8] font-medium block mb-1">Beneficiary Name</label>
                            <input
                              type="text"
                              placeholder="Full Name"
                              value={bankAccName}
                              onChange={(e) => setBankAccName(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#07090E] border border-[#334155] text-white text-sm outline-none focus:border-[#10B981]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {withdrawMsg && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        withdrawMsg.type === 'success'
                          ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                          : 'bg-[#EF4444]/20 text-[#F87171] border border-[#EF4444]/40'
                      }`}>
                        {withdrawMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {withdrawMsg.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={withdrawing || winningsBalance < 100}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-[#059669] to-[#047857] hover:from-[#047857] hover:to-[#065F46] text-white font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {withdrawing ? 'Submitting...' : `Withdraw ₹${withdrawAmount}`}
                    </button>
                  </form>
                </div>

                {/* Transaction Ledger */}
                <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#38BDF8]" /> Recent Withdrawal &amp; Winning History
                  </h4>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {transactions.length > 0 ? (
                      transactions.slice(0, 10).map((t) => (
                        <div key={t.id} className="p-3 rounded-xl bg-[#07090E] border border-[#1E293B] flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white capitalize">{t.type.replace('_', ' ')}</p>
                            <p className="text-[11px] text-[#94A3B8]">{t.description}</p>
                          </div>
                          <div className="text-right">
                            <span className={`font-black ${t.amount >= 0 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                              {t.amount >= 0 ? `+₹${t.amount}` : `-₹${Math.abs(t.amount)}`}
                            </span>
                            <span className="block text-[10px] uppercase font-bold text-[#64748B]">{t.status}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#64748B] text-center py-8">
                        No withdrawal or prize transactions found yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════ TAB 3: MY CONTESTS & PRIZE CLAIMS ═════ */}
        {activeTab === 'my-contests' && (
          <div className="space-y-6">
            {!user ? (
              <div className="p-8 rounded-2xl bg-[#0F172A] border border-[#1E293B] text-center space-y-4 max-w-md mx-auto">
                <Trophy size={36} className="text-[#F59E0B] mx-auto" />
                <h3 className="text-lg font-bold text-white">Log In to View Your Contests</h3>
                <p className="text-xs text-[#94A3B8]">
                  Track the exact rank and winning prize you are entitled to across all contests.
                </p>
                <Link
                  href="/login"
                  className="inline-block px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm"
                >
                  Log In Now
                </Link>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Your Contests &amp; Entitled Winnings</h3>
                    <p className="text-xs text-[#94A3B8]">
                      Verify your team performance against the official prize chart for every contest.
                    </p>
                  </div>
                  <button
                    onClick={fetchParticipations}
                    className="text-xs text-[#38BDF8] hover:text-[#7DD3FC] flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {loadingParticipations ? (
                  <div className="text-center py-8 text-xs text-[#64748B] flex items-center justify-center gap-2">
                    <RefreshCw className="animate-spin" size={16} /> Loading your participations...
                  </div>
                ) : participations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {participations.map((p, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-[#07090E] border border-[#1E293B] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                            Contest #{p.contest_code}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-[#64748B]">{p.contest_status}</span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white truncate">{p.contest_title}</h4>
                          <p className="text-[11px] text-[#94A3B8]">{p.match_title}</p>
                        </div>

                        <div className="p-3 rounded-lg bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-[#94A3B8]">Your Team</span>
                            <p className="text-xs font-bold text-white">{p.team_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#94A3B8]">Current Rank</span>
                            <p className="text-sm font-black text-[#F59E0B]">Rank #{p.my_rank}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <span className="text-[10px] text-[#94A3B8]">Prize Entitled / Won</span>
                            <p className="text-base font-black text-[#10B981]">
                              {p.prize_amount > 0 ? `₹${p.prize_amount.toLocaleString('en-IN')}` : '₹0'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              handleSearchContest(String(p.contest_code));
                              setActiveTab('search');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-xs font-bold text-[#38BDF8] hover:text-[#7DD3FC]"
                          >
                            View Full Slabs →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <Trophy size={36} className="text-[#64748B] mx-auto opacity-50" />
                    <p className="text-xs text-[#94A3B8]">
                      You haven&apos;t joined any contests yet. Head over to Prime Dreems to build your fantasy team!
                    </p>
                    <Link
                      href="/"
                      className="inline-block px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold"
                    >
                      Compete in Prime Dreems Arena
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
