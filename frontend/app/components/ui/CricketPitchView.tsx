'use client';

import React, { useState } from 'react';
import { X, Crown, Shield, Check, AlertCircle } from 'lucide-react';
import PlayerPhoto from './PlayerPhoto';

export interface PitchPlayer {
  id: string;
  name: string;
  team_name: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL' | string;
  credits: number;
  points?: number;
  photo_url?: string;
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

interface CricketPitchViewProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'view' | 'select_cap';
  teamName?: string;
  onTeamNameChange?: (name: string) => void;
  players: PitchPlayer[];
  captainId?: string | null;
  viceCaptainId?: string | null;
  onSelectCaptain?: (playerId: string) => void;
  onSelectViceCaptain?: (playerId: string) => void;
  onSubmitTeam?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
  teamA?: string;
  teamB?: string;
  teamACount?: number;
  teamBCount?: number;
  creditsLeft?: number;
  error?: string | null;
  entryFee?: number;
  walletBalance?: number | null;
  isLowBalance?: boolean;
}

function normalizeRole(role?: string): 'WK' | 'BAT' | 'AR' | 'BOWL' {
  const r = (role || '').toUpperCase().trim();
  if (r.includes('WK') || r.includes('KEEP')) return 'WK';
  if (r.includes('AR') || r.includes('ALL') || r.includes('ROUND')) return 'AR';
  if (r.includes('BOWL')) return 'BOWL';
  return 'BAT';
}

export default function CricketPitchView({
  isOpen,
  onClose,
  mode = 'view',
  teamName = 'My Prime XI',
  onTeamNameChange,
  players,
  captainId,
  viceCaptainId,
  onSelectCaptain,
  onSelectViceCaptain,
  onSubmitTeam,
  submitting = false,
  isEditing = false,
  teamA,
  teamB,
  teamACount = 0,
  teamBCount = 0,
  creditsLeft,
  error,
  entryFee = 0,
  walletBalance = null,
  isLowBalance = false,
}: CricketPitchViewProps) {
  if (!isOpen) return null;

  const isSelectMode = mode === 'select_cap';
  const [selectedMultiplierMode, setSelectedMultiplierMode] = useState<'C' | 'VC'>('C');

  const captainPlayer = players.find((p) => p.id === captainId);
  const viceCaptainPlayer = players.find((p) => p.id === viceCaptainId);

  const { wks, bats, ars, bowls } = React.useMemo(() => {
    const res = { wks: [] as PitchPlayer[], bats: [] as PitchPlayer[], ars: [] as PitchPlayer[], bowls: [] as PitchPlayer[] };
    for (const p of players) {
      const r = normalizeRole(p.role);
      if (r === 'WK') res.wks.push(p);
      else if (r === 'BAT') res.bats.push(p);
      else if (r === 'AR') res.ars.push(p);
      else res.bowls.push(p);
    }
    return res;
  }, [players]);

  const handlePlayerTap = (p: PitchPlayer) => {
    if (!isSelectMode) return;

    if (selectedMultiplierMode === 'C') {
      onSelectCaptain?.(p.id);
      // Auto-advance to VC mode if VC not chosen yet or was this player
      if (!viceCaptainId || viceCaptainId === p.id) {
        setSelectedMultiplierMode('VC');
      }
    } else {
      onSelectViceCaptain?.(p.id);
    }
  };

  const renderPlayerNode = (p: PitchPlayer) => {
    const isCap = p.id === captainId || p.is_captain;
    const isVC = p.id === viceCaptainId || p.is_vice_captain;
    const displayName = (p.name || 'Player').split(' ').slice(-1)[0] || p.name || 'Player';

    return (
      <div
        key={p.id}
        onClick={() => handlePlayerTap(p)}
        className={`flex flex-col items-center select-none group min-w-[68px] sm:min-w-[80px] my-0.5 transition-all duration-200 ${
          isSelectMode ? 'cursor-pointer hover:scale-110 active:scale-95' : ''
        }`}
      >
        {/* Photo Container with C/VC Floating Badge */}
        <div className="relative">
          {/* Captain / Vice Captain Floating Badge */}
          {isCap && (
            <span className="absolute -top-3 -left-3 z-30 w-7 h-7 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border-2 border-white shadow-[0_0_14px_rgba(37,99,235,0.9)] animate-pulse">
              2×C
            </span>
          )}
          {isVC && (
            <span className="absolute -top-3 -left-3 z-30 w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center border-2 border-white shadow-[0_0_14px_rgba(245,158,11,0.9)] animate-pulse">
              1.5×
            </span>
          )}

          {/* Circular Photo with Interactive Glow */}
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 bg-slate-900 shadow-md transition-all duration-200 ${
            isCap
              ? 'border-blue-400 ring-4 ring-blue-500 shadow-[0_0_18px_rgba(37,99,235,0.9)]'
              : isVC
              ? 'border-amber-400 ring-4 ring-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.9)]'
              : isSelectMode
              ? selectedMultiplierMode === 'C'
                ? 'border-blue-300 ring-2 ring-blue-400/50 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse'
                : 'border-amber-300 ring-2 ring-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse'
              : 'border-white/80'
          }`}>
            <PlayerPhoto
              name={p.name}
              photoUrl={p.photo_url}
              boxClass="w-full h-full text-xs text-white flex items-center justify-center font-bold"
            />
          </div>

          {/* Team tag badge bottom-center of photo */}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-slate-950/90 text-white border border-white/20 whitespace-nowrap">
            {p.team_name?.slice(0, 3).toUpperCase()}
          </span>
        </div>

        {/* Player Name Pill */}
        <div className="mt-2 max-w-[76px] sm:max-w-[88px] text-center">
          <div className={`backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black truncate shadow border transition-colors ${
            isCap
              ? 'bg-blue-900/90 text-white border-blue-400'
              : isVC
              ? 'bg-amber-950/90 text-amber-200 border-amber-400'
              : 'bg-slate-950/90 text-white border-white/10'
          }`}>
            {displayName}
          </div>
          <div className="text-[9px] sm:text-[10px] font-bold text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {p.credits || 9.0} CR
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500/50 flex flex-col max-h-[96vh]">
        {/* Top Header Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-emerald-500/30 flex items-center justify-between z-10 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            {isSelectMode && onTeamNameChange ? (
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => onTeamNameChange(e.target.value)}
                  className="bg-slate-800 text-white border border-emerald-500/40 rounded-lg px-2.5 py-1 text-xs font-black max-w-[180px] outline-none focus:border-emerald-400"
                  placeholder="Team Name"
                />
              </div>
            ) : (
              <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2 truncate">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{teamName}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {players.length}/11 Players
                </span>
              </h3>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── PROMINENT CAPTAIN & VICE-CAPTAIN SELECTION BAR (ALWAYS VISIBLE AT TOP) ─── */}
        {isSelectMode && (
          <div className="px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-emerald-500/40 flex items-center justify-between gap-2.5 shrink-0 z-20 shadow-md">
            {/* Captain Mode Button */}
            <button
              type="button"
              onClick={() => setSelectedMultiplierMode('C')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 border-2 ${
                selectedMultiplierMode === 'C'
                  ? 'bg-blue-600 text-white border-blue-300 shadow-[0_0_16px_rgba(37,99,235,0.9)] ring-2 ring-blue-400 scale-[1.02]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-blue-400 hover:bg-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-black flex items-center justify-center shrink-0 shadow">C</span>
              <div className="text-left min-w-0">
                <span className="block leading-tight text-[10px] uppercase font-bold text-blue-200">
                  {selectedMultiplierMode === 'C' ? '👉 Selecting Captain (2×)' : 'Captain (2×)'}
                </span>
                <span className="block leading-tight text-xs font-black truncate max-w-[130px]">
                  {captainPlayer ? captainPlayer.name : 'Tap to Choose'}
                </span>
              </div>
            </button>

            {/* Vice-Captain Mode Button */}
            <button
              type="button"
              onClick={() => setSelectedMultiplierMode('VC')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 border-2 ${
                selectedMultiplierMode === 'VC'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.9)] ring-2 ring-amber-400 scale-[1.02]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-400 hover:bg-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow">VC</span>
              <div className="text-left min-w-0">
                <span className="block leading-tight text-[10px] uppercase font-bold text-amber-950">
                  {selectedMultiplierMode === 'VC' ? '👉 Selecting Vice-Cap (1.5×)' : 'Vice-Cap (1.5×)'}
                </span>
                <span className="block leading-tight text-xs font-black truncate max-w-[130px]">
                  {viceCaptainPlayer ? viceCaptainPlayer.name : 'Tap to Choose'}
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Error notice if any */}
        {error && (
          <div className="bg-red-500 text-white px-4 py-1.5 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stadium Grass Pitch Ground Canvas — Clean, without distracting role headings */}
        <div className="relative flex-1 p-3 sm:p-4 overflow-y-auto bg-gradient-to-b from-[#14532d] via-[#166534] to-[#0f3e22] flex flex-col justify-around min-h-[460px] sm:min-h-[520px]">
          {/* Grass Turf Stripes Background Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[repeating-linear-gradient(0deg,#000_0px,#000_28px,transparent_28px,transparent_56px)]" />

          {/* Oval 30-Yard Inner Circle Line */}
          <div className="absolute inset-3 sm:inset-5 rounded-[50%] border-2 border-dashed border-white/20 pointer-events-none" />

          {/* Pitch Rectangular Strip in the center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 sm:w-32 h-56 rounded-md bg-[#ca8a04]/20 border border-[#fef08a]/25 pointer-events-none flex flex-col justify-between py-2">
            <div className="w-full h-0.5 bg-white/40" />
            <div className="w-14 mx-auto h-0.5 bg-white/30" />
            <div className="w-full h-0.5 bg-white/40" />
          </div>

          {/* ROW 1: WICKET-KEEPERS (Top) — No text headings */}
          <div className="relative z-10 text-center py-0.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 min-h-[70px]">
              {wks.length > 0 ? (
                wks.map(renderPlayerNode)
              ) : (
                <div className="text-[11px] text-white/50 italic">No Wicket-Keeper</div>
              )}
            </div>
          </div>

          {/* ROW 2: BATTERS (Upper Middle) — No text headings */}
          <div className="relative z-10 text-center py-0.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 min-h-[70px]">
              {bats.length > 0 ? (
                bats.map(renderPlayerNode)
              ) : (
                <div className="text-[11px] text-white/50 italic">No Batters</div>
              )}
            </div>
          </div>

          {/* ROW 3: ALL-ROUNDERS (Lower Middle) — No text headings */}
          <div className="relative z-10 text-center py-0.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 min-h-[70px]">
              {ars.length > 0 ? (
                ars.map(renderPlayerNode)
              ) : (
                <div className="text-[11px] text-white/50 italic">No All-Rounders</div>
              )}
            </div>
          </div>

          {/* ROW 4: BOWLERS (Bottom) — No text headings */}
          <div className="relative z-10 text-center py-0.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 min-h-[70px]">
              {bowls.length > 0 ? (
                bowls.map(renderPlayerNode)
              ) : (
                <div className="text-[11px] text-white/50 italic">No Bowlers</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Back to XI + Submit/Update Team Button */}
        {isSelectMode ? (
          <div className="p-3 bg-slate-900 border-t border-emerald-500/30 flex items-center justify-between gap-3 shrink-0 z-20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
            >
              ← Back to XI
            </button>

            <button
              type="button"
              onClick={onSubmitTeam}
              disabled={submitting || !captainId || !viceCaptainId}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all border border-emerald-300 flex items-center justify-center gap-1.5"
            >
              {submitting
                ? 'Saving Team...'
                : isEditing
                ? 'Update Team (Free)'
                : isLowBalance
                ? `+ Add Funds (Need ₹${entryFee - (walletBalance || 0)})`
                : entryFee > 0
                ? `Pay ₹${entryFee} & Save Team`
                : 'Submit Team (Free)'}
            </button>
          </div>
        ) : (
          <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300 shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">C</span>
                <span>Captain (2×)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center">VC</span>
                <span>Vice-Cap (1.5×)</span>
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-black text-emerald-400 hover:text-emerald-300 uppercase cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
