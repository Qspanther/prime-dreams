'use client';

import React from 'react';
import { X, Swords, Trophy, Crown, Check, AlertCircle } from 'lucide-react';
import PlayerPhoto from './PlayerPhoto';

interface ComparePlayer {
  id: string;
  name: string;
  role: string;
  team_name: string;
  points?: number;
  points_earned?: number;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  photo_url?: string;
}

interface CompareTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  myTeam: {
    team_name: string;
    username?: string;
    total_points: number;
    rank?: number | null;
    players: ComparePlayer[];
  } | null;
  opponentTeam: {
    team_name: string;
    username?: string;
    total_points: number;
    rank?: number | null;
    players: ComparePlayer[];
  } | null;
}

export default function CompareTeamModal({
  isOpen,
  onClose,
  myTeam,
  opponentTeam,
}: CompareTeamModalProps) {
  if (!isOpen || !myTeam || !opponentTeam) return null;

  const myPlayers = myTeam.players || [];
  const oppPlayers = opponentTeam.players || [];

  const myCap = myPlayers.find(p => p.is_captain);
  const myVC = myPlayers.find(p => p.is_vice_captain);
  const oppCap = oppPlayers.find(p => p.is_captain);
  const oppVC = oppPlayers.find(p => p.is_vice_captain);

  // Common and differential calculations
  const myPlayerIds = new Set(myPlayers.map(p => p.id || p.name));
  const oppPlayerIds = new Set(oppPlayers.map(p => p.id || p.name));

  const commonCount = myPlayers.filter(p => oppPlayerIds.has(p.id || p.name)).length;
  const differentialCount = 11 - commonCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#2563EB]/40 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm sm:text-base">Head-to-Head Fantasy Team Comparison</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Team Score Header Cards */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          {/* My Team */}
          <div className="p-3 rounded-xl bg-blue-50 border-2 border-blue-200">
            <span className="text-[10px] font-black uppercase text-blue-700 block">Your Team</span>
            <h4 className="font-black text-sm text-[#0F172A] truncate">{myTeam.team_name}</h4>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black text-blue-600 font-mono">
                {Number(myTeam.total_points || 0).toFixed(1)} <span className="text-xs font-normal">pts</span>
              </span>
              <span className="text-xs font-black text-slate-600">
                {myTeam.rank ? `Rank #${myTeam.rank}` : '—'}
              </span>
            </div>
          </div>

          {/* Opponent Team */}
          <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-200 text-right">
            <span className="text-[10px] font-black uppercase text-amber-700 block">Competitor</span>
            <h4 className="font-black text-sm text-[#0F172A] truncate">{opponentTeam.team_name} (@{opponentTeam.username || 'user'})</h4>
            <div className="mt-1 flex items-baseline justify-between flex-row-reverse">
              <span className="text-xl font-black text-amber-600 font-mono">
                {Number(opponentTeam.total_points || 0).toFixed(1)} <span className="text-xs font-normal">pts</span>
              </span>
              <span className="text-xs font-black text-slate-600">
                {opponentTeam.rank ? `Rank #${opponentTeam.rank}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Multipliers & Differences Summary */}
        <div className="px-4 py-2.5 bg-[#EFF6FF] border-b border-[#BFDBFE] flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5 text-blue-800">
            <span>Common Players: <strong className="font-mono">{commonCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-800">
            <span>Differentials: <strong className="font-mono">{differentialCount}</strong></span>
          </div>
        </div>

        {/* Captain & Vice Captain Matchup */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white border-b border-[#E2E8F0] text-xs">
          <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 space-y-1">
            <span className="text-[10px] font-black uppercase text-blue-600 block">Your Multipliers</span>
            <p className="truncate font-black text-[#0F172A]">
              👑 C: {myCap?.name || '—'} <span className="text-blue-600 font-mono">({myCap?.points_earned || 0} pts)</span>
            </p>
            <p className="truncate font-black text-[#0F172A]">
              ⭐ VC: {myVC?.name || '—'} <span className="text-amber-600 font-mono">({myVC?.points_earned || 0} pts)</span>
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1 text-right">
            <span className="text-[10px] font-black uppercase text-amber-600 block">Competitor Multipliers</span>
            <p className="truncate font-black text-[#0F172A]">
              👑 C: {oppCap?.name || '—'} <span className="text-blue-600 font-mono">({oppCap?.points_earned || 0} pts)</span>
            </p>
            <p className="truncate font-black text-[#0F172A]">
              ⭐ VC: {oppVC?.name || '—'} <span className="text-amber-600 font-mono">({oppVC?.points_earned || 0} pts)</span>
            </p>
          </div>
        </div>

        {/* Side-by-Side 11 Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[11px] font-black uppercase text-[#64748B] pb-1 border-b border-[#E2E8F0]">
            <span>Your 11 Players</span>
            <span className="text-right">Competitor's 11 Players</span>
          </div>

          {Array.from({ length: 11 }).map((_, idx) => {
            const pMy = myPlayers[idx];
            const pOpp = oppPlayers[idx];
            const isMyCommon = pMy && oppPlayerIds.has(pMy.id || pMy.name);
            const isOppCommon = pOpp && myPlayerIds.has(pOpp.id || pOpp.name);

            return (
              <div key={idx} className="grid grid-cols-2 gap-3 items-center py-1.5 border-b border-[#F1F5F9] text-xs">
                {/* My Player */}
                {pMy ? (
                  <div className={`p-2 rounded-lg border flex items-center justify-between min-w-0 ${
                    isMyCommon ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/80 border-blue-300 shadow-xs'
                  }`}>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-[9px] font-black px-1 rounded bg-slate-200 text-slate-700">{pMy.role}</span>
                      <span className="truncate font-black text-[#0F172A]">{pMy.name}</span>
                      {pMy.is_captain && <span className="text-[9px] font-black text-blue-700">C</span>}
                      {pMy.is_vice_captain && <span className="text-[9px] font-black text-amber-700">VC</span>}
                    </div>
                    <span className="font-mono font-black text-[#2563EB] shrink-0 ml-1">
                      {pMy.points_earned ?? pMy.points ?? 0}
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px]">—</div>
                )}

                {/* Opponent Player */}
                {pOpp ? (
                  <div className={`p-2 rounded-lg border flex items-center justify-between min-w-0 ${
                    isOppCommon ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/80 border-amber-300 shadow-xs'
                  }`}>
                    <span className="font-mono font-black text-[#D97706] shrink-0 mr-1">
                      {pOpp.points_earned ?? pOpp.points ?? 0}
                    </span>
                    <div className="min-w-0 flex items-center gap-1.5 text-right justify-end">
                      {pOpp.is_captain && <span className="text-[9px] font-black text-blue-700">C</span>}
                      {pOpp.is_vice_captain && <span className="text-[9px] font-black text-amber-700">VC</span>}
                      <span className="truncate font-black text-[#0F172A]">{pOpp.name}</span>
                      <span className="text-[9px] font-black px-1 rounded bg-slate-200 text-slate-700">{pOpp.role}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px] text-right">—</div>
                )}
              </div>
            );
          })}
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

