'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Crown, Star, Check, X, ArrowLeft,
  AlertCircle, Users, Award, ChevronRight, Zap
} from 'lucide-react';
import { apiGet, apiPost, resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import CategoryBadge from '../../components/ui/CategoryBadge';

interface Player {
  id: string;
  name: string;
  team_name: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
  credits: number;
  points: number;
  photo_url?: string;
}

export default function CricketTeamBuilderPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId');
  const { tournamentId: matchId } = use(params);
  const { token, user } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedRole, setSelectedRole] = useState<'WK' | 'BAT' | 'AR' | 'BOWL'>('WK');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [showCapModal, setShowCapModal] = useState(false);
  const [teamName, setTeamName] = useState('My Prime XI');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet(`/matches/${matchId}`)
      .then((res) => {
        if (res?.match) {
          setMatch(res.match);
          setPlayers(res.match.players || []);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  const selectedPlayers = players.filter((p) => selectedPlayerIds.includes(p.id));

  // Counts & limits
  const totalCreditsUsed = selectedPlayers.reduce((sum, p) => sum + (Number(p.credits) || 9.0), 0);
  const creditsLeft = Math.round((100 - totalCreditsUsed) * 10) / 10;

  const roleCounts = {
    WK: selectedPlayers.filter((p) => p.role === 'WK').length,
    BAT: selectedPlayers.filter((p) => p.role === 'BAT').length,
    AR: selectedPlayers.filter((p) => p.role === 'AR').length,
    BOWL: selectedPlayers.filter((p) => p.role === 'BOWL').length,
  };

  const teamCounts: Record<string, number> = {};
  selectedPlayers.forEach((p) => {
    teamCounts[p.team_name] = (teamCounts[p.team_name] || 0) + 1;
  });

  const togglePlayer = (p: Player) => {
    const isAlreadySelected = selectedPlayerIds.includes(p.id);

    if (isAlreadySelected) {
      setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== p.id));
      if (captainId === p.id) setCaptainId(null);
      if (viceCaptainId === p.id) setViceCaptainId(null);
      setError(null);
      return;
    }

    if (selectedPlayerIds.length >= 11) {
      setError('You can only select exactly 11 players.');
      return;
    }

    const currentTeamCount = teamCounts[p.team_name] || 0;
    if (currentTeamCount >= 7) {
      setError(`Maximum 7 players allowed from ${p.team_name}.`);
      return;
    }

    const nextCredits = creditsLeft - (Number(p.credits) || 9.0);
    if (nextCredits < 0) {
      setError('Not enough credits left for this player.');
      return;
    }

    // Role caps
    const currentRoleCount = roleCounts[p.role];
    const limits = { WK: 4, BAT: 6, AR: 4, BOWL: 6 };
    if (currentRoleCount >= limits[p.role]) {
      setError(`Maximum ${limits[p.role]} ${p.role} players allowed.`);
      return;
    }

    setSelectedPlayerIds([...selectedPlayerIds, p.id]);
    setError(null);
  };

  const validateTeamComposition = () => {
    if (selectedPlayerIds.length !== 11) {
      return 'Exactly 11 players required.';
    }
    if (roleCounts.WK < 1) return 'Pick at least 1 Wicket Keeper (1-4).';
    if (roleCounts.BAT < 3) return 'Pick at least 3 Batters (3-6).';
    if (roleCounts.AR < 1) return 'Pick at least 1 All-Rounder (1-4).';
    if (roleCounts.BOWL < 3) return 'Pick at least 3 Bowlers (3-6).';
    return null;
  };

  const handleProceedToCaptain = () => {
    const validationError = validateTeamComposition();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setShowCapModal(true);
  };

  const handleSubmitTeam = async () => {
    if (!token) {
      router.push('/login');
      return;
    }

    if (!captainId || !viceCaptainId) {
      setError('Please select both Captain (2×) and Vice-Captain (1.5×).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiPost(`/matches/${matchId}/teams`, {
        team_name: teamName,
        player_ids: selectedPlayerIds,
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
        contest_id: contestId || null,
      }, token);

      if (res?.success) {
        router.push('/my-teams');
      } else {
        setError(res?.error || 'Failed to submit team');
      }
    } catch (err: any) {
      setError(err?.message || 'Error saving team. Check contest lock and balance.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#A3A3A3] bg-[#000000]">
        <div className="w-10 h-10 border-4 border-[#FF1744] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_#FF1744]" />
        <p className="text-sm font-black text-white">Loading 30 squad players...</p>
      </div>
    );
  }

  const roleFilteredPlayers = players.filter((p) => p.role === selectedRole);

  return (
    <div className="px-3 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6 bg-[#000000]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/match/${matchId}`}
          className="inline-flex items-center gap-2 text-xs font-black text-[#D4D4D4] hover:text-[#FFD700] transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Exit Builder</span>
        </Link>
        {match && <CategoryBadge category={match.category} size="xs" />}
      </div>

      {/* Match & Squad Meter Card (3D Elevated) */}
      {match && (
        <div className="prime-card-3d p-5 space-y-4 relative overflow-hidden">
          {/* Match Poster Backdrop if available */}
          {resolveImageUrl(match.match_poster) && (
            <div className="absolute inset-0 z-0 opacity-15 pointer-events-none overflow-hidden">
              <img
                src={resolveImageUrl(match.match_poster)}
                alt="Poster"
                className="w-full h-full object-cover scale-105"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/60" />
            </div>
          )}

          <div className="relative z-10 flex items-center justify-between pb-3 border-b border-[#222222]">
            <div className="flex items-center gap-3">
              {/* Team A Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] border border-[#93C5FD] flex items-center justify-center font-black text-xs text-white overflow-hidden shrink-0">
                {resolveImageUrl(match.team_a_logo) ? (
                  <img src={resolveImageUrl(match.team_a_logo)} alt={match.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                ) : (match.team_a_code || match.team_a?.slice(0, 3).toUpperCase())}
              </div>

              <div>
                <h2 className="font-black text-white text-base sm:text-xl">
                  {match.team_a} vs {match.team_b}
                </h2>
                <p className="text-xs text-[#A3A3A3] font-bold">Max 7 players from any single team</p>
              </div>

              {/* Team B Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] border border-[#FDE68A] flex items-center justify-center font-black text-xs text-white overflow-hidden shrink-0">
                {resolveImageUrl(match.team_b_logo) ? (
                  <img src={resolveImageUrl(match.team_b_logo)} alt={match.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                ) : (match.team_b_code || match.team_b?.slice(0, 3).toUpperCase())}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#A3A3A3] uppercase font-black block">Credits Left</span>
              <span className={`text-xl font-black font-mono ${creditsLeft < 9 ? 'text-[#FF1744]' : 'text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]'}`}>
                {creditsLeft} / 100
              </span>
            </div>
          </div>

          {/* 11 Players Count Meter */}
          <div className="relative z-10 grid grid-cols-4 gap-2 pt-1 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-[#000000] border border-[#2A2A2A]">
              <span className="text-[10px] text-[#A3A3A3] font-bold block">Selected</span>
              <span className="font-black text-base text-[#FFD700] font-mono">
                {selectedPlayerIds.length} / 11
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#000000] border border-[#2A2A2A]">
              <span className="text-[10px] text-[#A3A3A3] font-bold block truncate">{match.team_a}</span>
              <span className="font-black text-base text-white font-mono">
                {teamCounts[match.team_a] || 0} / 7
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#000000] border border-[#2A2A2A]">
              <span className="text-[10px] text-[#A3A3A3] font-bold block truncate">{match.team_b}</span>
              <span className="font-black text-base text-white font-mono">
                {teamCounts[match.team_b] || 0} / 7
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#000000] border border-[#2A2A2A]">
              <span className="text-[10px] text-[#A3A3A3] font-bold block">Squad Pool</span>
              <span className="font-black text-base text-white font-mono">30 Total</span>
            </div>
          </div>
        </div>
      )}

      {/* Role Navigation Tabs (3D Buttons) */}
      <div className="grid grid-cols-4 gap-2.5">
        {(['WK', 'BAT', 'AR', 'BOWL'] as const).map((role) => {
          const isSelected = selectedRole === role;
          const count = roleCounts[role];

          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`p-3 rounded-xl border text-center transition cursor-pointer ${isSelected
                  ? 'prime-btn-3d !p-3 shadow-[0_0_15px_rgba(255,23,68,0.5)]'
                  : 'prime-btn-dark-3d !p-3 !text-[#A3A3A3]'
                }`}
            >
              <div className="font-black text-sm">{role}</div>
              <div className="text-[11px] font-black mt-0.5">
                ({count})
              </div>
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

      {/* Players List for Selected Role */}
      <div className="space-y-2.5">
        {roleFilteredPlayers.map((p) => {
          const isSelected = selectedPlayerIds.includes(p.id);

          return (
            <div
              key={p.id}
              onClick={() => togglePlayer(p)}
              className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all select-none border-2 ${isSelected
                  ? 'bg-gradient-to-r from-[#FF1744]/25 to-[#000000] border-[#FF1744] shadow-[0_0_15px_rgba(255,23,68,0.4)]'
                  : 'bg-[#121212] border-[#222222] hover:border-[#FFD700]/50 hover:bg-[#181818]'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border-2 overflow-hidden shrink-0 ${isSelected ? 'bg-[#FF1744] text-white border-[#FF8095] shadow-[0_0_8px_#FF1744]' : 'bg-[#000000] text-[#FFD700] border-[#333333]'
                  }`}>
                  {resolveImageUrl(p.photo_url) ? (
                    <img
                      src={resolveImageUrl(p.photo_url)}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        if ((e.target as HTMLImageElement).parentElement) {
                          (e.target as HTMLImageElement).parentElement!.textContent = p.role;
                        }
                      }}
                    />
                  ) : (
                    <span className="font-mono text-xs">{p.role}</span>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">{p.name}</h4>
                  <p className="text-xs text-[#A3A3A3] font-bold">
                    {p.team_name} • <span className="text-[#FFD700]">{p.points || 0} pts</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-[#FFD700]">
                  {p.credits} CR
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 font-black ${isSelected
                    ? 'bg-[#FF1744] text-white border-white shadow-[0_0_6px_#FF1744]'
                    : 'bg-[#000000] border-[#333333] text-[#A3A3A3]'
                  }`}>
                  {isSelected ? <Check className="w-4 h-4" /> : '+'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Bar */}
      <div className="sticky bottom-4 z-20 p-4 bg-[#0A0A0A]/95 backdrop-blur-xl rounded-2xl border-2 border-[#2A2A2A] flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,1)]">
        <div>
          <span className="text-xs font-black text-white block">
            {selectedPlayerIds.length}/11 Players Picked
          </span>
          <span className="text-xs text-[#FFD700] font-mono font-black">
            {creditsLeft} CR left
          </span>
        </div>

        <button
          onClick={handleProceedToCaptain}
          disabled={selectedPlayerIds.length !== 11}
          className="prime-btn-3d !py-2.5 !px-6 text-xs font-black uppercase tracking-wider disabled:opacity-40"
        >
          <span>Choose C / VC</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Captain & Vice-Captain Selection Modal (§4: C 2.0x, VC 1.5x) */}
      {showCapModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg prime-card-3d p-6 space-y-5 border-2 border-[#FF1744] max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(255,23,68,0.5)] animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div>
                <h3 className="font-black text-white text-base">Assign Multipliers</h3>
                <p className="text-xs text-[#FFD700] font-bold">Captain gets 2× Points • Vice-Captain gets 1.5× Points</p>
              </div>
              <button
                onClick={() => setShowCapModal(false)}
                className="text-[#A3A3A3] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-black text-[#FFD700] uppercase mb-1.5">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#000000] border-2 border-[#333333] text-white text-sm focus:border-[#FF1744] outline-none font-black"
                placeholder="My Prime XI"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedPlayers.map((p) => {
                const isC = captainId === p.id;
                const isVC = viceCaptainId === p.id;

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#000000] border border-[#222222] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#222222] border border-[#333333] flex items-center justify-center text-[10px] font-black text-[#FFD700] shrink-0 overflow-hidden">
                        {resolveImageUrl(p.photo_url) ? (
                          <img src={resolveImageUrl(p.photo_url)} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          <span>{p.role}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-black text-sm text-white">{p.name}</p>
                        <p className="text-xs text-[#A3A3A3] font-bold">{p.team_name} • {p.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCaptainId(p.id);
                          if (viceCaptainId === p.id) setViceCaptainId(null);
                        }}
                        className={`w-10 h-10 rounded-xl font-black text-xs border-2 transition cursor-pointer ${isC
                            ? 'bg-[#FF1744] text-white border-[#FF8095] shadow-[0_0_12px_#FF1744]'
                            : 'bg-[#141414] text-[#A3A3A3] border-[#333333] hover:text-[#FFD700]'
                          }`}
                        title="2x Multiplier"
                      >
                        2×
                      </button>

                      <button
                        onClick={() => {
                          setViceCaptainId(p.id);
                          if (captainId === p.id) setCaptainId(null);
                        }}
                        className={`w-10 h-10 rounded-xl font-black text-xs border-2 transition cursor-pointer ${isVC
                            ? 'bg-[#FFD700] text-black border-white shadow-[0_0_12px_#FFD700]'
                            : 'bg-[#141414] text-[#A3A3A3] border-[#333333] hover:text-[#FFD700]'
                          }`}
                        title="1.5x Multiplier"
                      >
                        1.5×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-black">
                {error}
              </div>
            )}

            <div className="pt-3 border-t border-[#222222] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCapModal(false)}
                className="prime-btn-dark-3d text-xs !py-2 !px-4"
              >
                Back to XI
              </button>
              <button
                type="button"
                onClick={handleSubmitTeam}
                disabled={submitting || !captainId || !viceCaptainId}
                className="prime-btn-3d text-xs !py-2 !px-5 font-black disabled:opacity-40"
              >
                {submitting ? 'Saving...' : 'Submit Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
