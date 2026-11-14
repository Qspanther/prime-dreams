'use client';

import React from 'react';
import { X, Trophy, Award, ShieldCheck, Users } from 'lucide-react';

export interface PrizeBreakupTier {
  rank_range: string;
  prize_per_winner: number;
  total_winners: number;
  total_tier_prize: number;
}

interface PrizeBreakupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contest: {
    id: string;
    title: string;
    entry_fee: number;
    prize_pool: number;
    total_spots: number;
    filled_spots?: number;
    type?: string;
  } | null;
}

export default function PrizeBreakupModal({
  isOpen,
  onClose,
  contest,
}: PrizeBreakupModalProps) {
  if (!isOpen || !contest) return null;

  const pool = Number(contest.prize_pool) || 0;
  const spots = Number(contest.total_spots) || 100;
  const entryFee = Number(contest.entry_fee) || 0;

  // Generate realistic tiered payout distribution matching standard fantasy rules
  const generateTiers = (): PrizeBreakupTier[] => {
    if (pool <= 0 || spots <= 2) {
      if (spots === 2) {
        return [
          { rank_range: '#1', prize_per_winner: pool, total_winners: 1, total_tier_prize: pool },
        ];
      }
      return [
        { rank_range: '#1', prize_per_winner: pool, total_winners: 1, total_tier_prize: pool },
      ];
    }

    if (spots <= 10) {
      const rank1 = Math.round(pool * 0.7);
      const rank2 = Math.round(pool * 0.3);
      return [
        { rank_range: '#1', prize_per_winner: rank1, total_winners: 1, total_tier_prize: rank1 },
        { rank_range: '#2', prize_per_winner: rank2, total_winners: 1, total_tier_prize: rank2 },
      ];
    }

    // Larger contests (50+ spots)
    const rank1 = Math.round(pool * 0.35);
    const rank2 = Math.round(pool * 0.15);
    const rank3 = Math.round(pool * 0.08);
    const rank4_10_per = Math.max(entryFee * 2, Math.round((pool * 0.14) / 7));
    const rank11_50_count = Math.min(40, Math.floor(spots * 0.3));
    const rank11_50_per = Math.max(entryFee, Math.round((pool * 0.18) / (rank11_50_count || 1)));
    const remainingPool = Math.max(0, pool - (rank1 + rank2 + rank3 + (rank4_10_per * 7) + (rank11_50_per * rank11_50_count)));

    const tiers: PrizeBreakupTier[] = [
      { rank_range: '#1', prize_per_winner: rank1, total_winners: 1, total_tier_prize: rank1 },
      { rank_range: '#2', prize_per_winner: rank2, total_winners: 1, total_tier_prize: rank2 },
      { rank_range: '#3', prize_per_winner: rank3, total_winners: 1, total_tier_prize: rank3 },
      { rank_range: '#4 - #10', prize_per_winner: rank4_10_per, total_winners: 7, total_tier_prize: rank4_10_per * 7 },
    ];

    if (rank11_50_count > 0) {
      tiers.push({
        rank_range: `#11 - #${10 + rank11_50_count}`,
        prize_per_winner: rank11_50_per,
        total_winners: rank11_50_count,
        total_tier_prize: rank11_50_per * rank11_50_count,
      });
    }

    if (remainingPool > entryFee && spots >= 100) {
      const restWinners = Math.min(spots - (10 + rank11_50_count), Math.floor(remainingPool / entryFee));
      if (restWinners > 0) {
        tiers.push({
          rank_range: `#${11 + rank11_50_count} - #${10 + rank11_50_count + restWinners}`,
          prize_per_winner: entryFee,
          total_winners: restWinners,
          total_tier_prize: entryFee * restWinners,
        });
      }
    }

    return tiers;
  };

  const tiers = generateTiers();
  const totalWinnersCount = tiers.reduce((acc, t) => acc + t.total_winners, 0);
  const winningPercentage = Math.round((totalWinnersCount / spots) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D97706]/40 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">{contest.title}</h3>
              <p className="text-xs text-amber-300 font-bold">
                Guaranteed Prize Pool • ₹{pool.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlights Banner */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-[#FFFBEB] border-b border-[#FDE68A] text-center text-xs">
          <div>
            <span className="text-[10px] text-[#92400E] block font-black uppercase">Entry Fee</span>
            <span className="text-sm font-black text-[#B45309] font-mono">
              {entryFee === 0 ? 'FREE' : `₹${entryFee}`}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[#92400E] block font-black uppercase">Total Spots</span>
            <span className="text-sm font-black text-[#0F172A] font-mono">{spots}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#92400E] block font-black uppercase">Winners %</span>
            <span className="text-sm font-black text-emerald-700 font-mono">{winningPercentage}%</span>
          </div>
        </div>

        {/* Prize Breakup Table */}
        <div className="p-4 flex-1 overflow-y-auto max-h-[380px] space-y-3">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#64748B]">
            <span>Rank</span>
            <span>Winnings</span>
          </div>

          <div className="rounded-xl border border-[#CBD5E1] overflow-hidden bg-white shadow-xs divide-y divide-[#E2E8F0]">
            {tiers.map((t, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-3.5 py-2.5 text-xs font-bold transition ${
                  idx === 0
                    ? 'bg-[#FEF3C7] text-[#92400E] font-black'
                    : idx === 1
                    ? 'bg-[#F1F5F9] text-[#1E293B]'
                    : idx === 2
                    ? 'bg-[#FFF7ED] text-[#9A3412]'
                    : 'text-[#0F172A]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {idx === 0 && <span className="text-amber-500 font-black text-sm">🥇</span>}
                  {idx === 1 && <span className="text-slate-400 font-black text-sm">🥈</span>}
                  {idx === 2 && <span className="text-amber-700 font-black text-sm">🥉</span>}
                  <span>{t.rank_range}</span>
                  {t.total_winners > 1 && (
                    <span className="text-[10px] text-[#64748B] font-normal">
                      ({t.total_winners} winners)
                    </span>
                  )}
                </div>

                <div className="font-mono font-black text-sm text-[#0F172A]">
                  ₹{t.prize_per_winner.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-[#64748B] font-semibold text-center mt-2">
            In case of ties for any rank, the prize amount is split equally among tied participants.
          </p>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="prime-btn-dark-3d !py-2 !px-5 text-xs font-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

