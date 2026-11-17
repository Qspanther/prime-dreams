'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Users, Sparkles, ArrowRight, X, Gift, CheckCircle2 } from 'lucide-react';

interface TeamLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxTeams?: number;
  currentTeams?: number;
  passName?: string;
  daysLeft?: number;
  matchTitle?: string;
}

export default function TeamLimitModal({
  isOpen,
  onClose,
  maxTeams = 2,
  currentTeams = 2,
  passName = 'Tournament Pass',
  daysLeft,
  matchTitle,
}: TeamLimitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#0F172A] to-[#07090E] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(245,158,11,0.25)] text-white space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header with Glowing Icon */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.5)] border-2 border-white/20">
            <ShieldAlert className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/70 border border-amber-500/30 px-3 py-0.5 rounded-full inline-block">
              Quota Limit Reached
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5 font-['Montserrat'] tracking-tight">
              Team Creation Limit Reached
            </h3>
            {matchTitle && (
              <p className="text-xs text-slate-400 font-semibold truncate max-w-xs mt-0.5">
                {matchTitle}
              </p>
            )}
          </div>
        </div>

        {/* Informative Explanation in Standard English */}
        <p className="text-xs sm:text-sm text-slate-300 text-center leading-relaxed font-medium">
          You have already entered your maximum limit of <strong className="text-amber-400 font-black">{maxTeams} team(s)</strong> for this match under your current pass.
        </p>

        {/* Quota Breakdown Box */}
        <div className="bg-[#1E293B]/70 border border-[#334155] rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold">Active Tournament Pass:</span>
            <span className="font-black text-white font-mono bg-blue-950/60 border border-blue-500/30 px-2 py-0.5 rounded">
              {passName}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold">Match Lineup Limit:</span>
            <span className="font-black text-amber-400 font-mono">
              {maxTeams} Team(s) per Match
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold">Your Created Teams:</span>
            <span className="font-black text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {currentTeams} / {maxTeams} (100% Utilized)
            </span>
          </div>

          {daysLeft !== undefined && daysLeft > 0 && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
              <span className="text-slate-400 font-bold">Pass Validity:</span>
              <span className="font-bold text-sky-300">
                {daysLeft} day(s) remaining
              </span>
            </div>
          )}
        </div>

        {/* Upgrade / Unlock Guidance Note */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed font-medium text-center">
          💡 To enter additional fantasy teams for this match, upgrade to a higher Tournament Pass tier or invite friends with your promo code to unlock higher limits.
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <Link
            href="/subscription"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider text-center shadow-[0_10px_25px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 hover:scale-[1.02] transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>Upgrade Tournament Pass →</span>
          </Link>

          <Link
            href="/subscription#referral"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5 text-emerald-400" />
            <span>Invite Friends &amp; Unlock Free Passes</span>
          </Link>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Link
              href="/my-teams"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold text-center transition"
            >
              View My Lineups
            </Link>
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-lg bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
