'use client';

import React, { useCallback, useEffect, use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Radio, RefreshCw, Search, Trophy, X, Swords, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiGet, getWebSocketUrl } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import CompareTeamModal from '../../../components/ui/CompareTeamModal';

type LeaderboardData = {
  match?: { title: string; status: string; team_a: string; team_b: string; score_summary?: any; last_updated?: string | null };
  player_leaderboard?: any[];
  contest?: { id: string; title: string; status: string; entry_fee?: number; prize_pool?: number; type?: string } | null;
  contests?: Array<{ id: string; title: string; status: string; entry_fee?: number; prize_pool?: number; type?: string }>;
  contest_leaderboard?: any[];
  contest_lineups_hidden?: boolean;
  my_team?: { team_id: string; team_name: string; rank: number | null; total_points: number; players?: any[] } | null;
};

export default function MatchLeaderboardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId');
  const contestIdFromUrl = searchParams.get('contestId') || searchParams.get('contest_id') || '';
  const { token } = useAuth();
  const [selectedContestId, setSelectedContestId] = useState<string>(contestIdFromUrl);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'contest_teams' | 'match_players'>('contest_teams');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantSearchResults, setParticipantSearchResults] = useState<any[] | null>(null);
  const [participantSearchLoading, setParticipantSearchLoading] = useState(false);
  const [compareOpponent, setCompareOpponent] = useState<any>(null);

  const refresh = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (teamId) q.set('team_id', teamId);
      if (selectedContestId) q.set('contest_id', selectedContestId);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const result = await apiGet(`/matches/${matchId}/leaderboard${queryStr}`, token || undefined);
      if (result?.match?.id && result.match.id !== matchId && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/match/${result.match.id}/leaderboard${queryStr}`);
      }
      setData(result);
      if (!selectedContestId && result?.contest?.id) {
        setSelectedContestId(result.contest.id);
      }
      setError('');
      setUpdatedAt(new Date());
    } catch (err: any) {
      console.warn('Leaderboard refresh warning:', err?.message);
      setData(prev => {
        if (!prev) setError('Live leaderboard sync ho raha hai. Thodi der me auto-refresh hoga.');
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId, selectedContestId, token]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const safeRefresh = async () => { if (active) await refresh(); };
    void safeRefresh();

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void safeRefresh(); }, 250);
    };
    const connect = () => {
      if (stopped) return;
      try {
        socket = new WebSocket(getWebSocketUrl());
        socket.onopen = () => socket?.send(JSON.stringify({ action: 'subscribe', matchId }));
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if ((message.type === 'BALL_DELTA' || message.type === 'MATCH_SNAPSHOT' || message.type === 'RESYNC_REQUIRED') && message.match_id === matchId) {
              scheduleRefresh();
            }
          } catch { /* Ignore malformed telemetry and keep the REST fallback active. */ }
        };
        socket.onclose = () => {
          if (!stopped) reconnectTimer = setTimeout(connect, 2000);
        };
        socket.onerror = () => socket?.close();
      } catch { /* REST refresh remains available when WebSocket is unavailable. */ }
    };
    connect();
    const fallbackPoll = setInterval(() => { void safeRefresh(); }, 12000);

    return () => {
      active = false;
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackPoll);
      socket?.close();
    };
  }, [matchId, refresh]);

  useEffect(() => {
    const query = participantSearch.trim();
    if (!teamId || query.length < 2 || !token) {
      setParticipantSearchResults(null);
      setParticipantSearchLoading(false);
      return;
    }

    let active = true;
    setParticipantSearchLoading(true);
    setParticipantSearchResults(null);
    const timer = setTimeout(async () => {
      try {
        const result = await apiGet(`/users/search?q=${encodeURIComponent(query)}`, token);
        if (active) setParticipantSearchResults(result.users || []);
      } catch {
        if (active) setParticipantSearchResults([]);
      } finally {
        if (active) setParticipantSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [participantSearch, teamId, token]);

  const match = data?.match;
  const matchTitle = match?.title || [match?.team_a, match?.team_b].filter(Boolean).join(' vs ') || 'Match leaderboard';
  const activeMyTeam = data?.my_team || null;
  const myTeamPlayers = activeMyTeam?.players || [];
  const allContestTeams = data?.contest_leaderboard || [];
  const visibleContestTeams = participantSearch.trim().length >= 2
    ? allContestTeams.filter(team => {
        const q = participantSearch.toLowerCase();
        return (
          team.username?.toLowerCase().includes(q) ||
          team.team_name?.toLowerCase().includes(q) ||
          participantSearchResults?.some(user => user.id === team.user_id)
        );
      })
    : allContestTeams;

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5 text-[#0F172A]">
      <Link href={`/match/${matchId}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#475569] hover:text-[#2563EB]">
        <ArrowLeft className="w-4 h-4" /> Match par wapas
      </Link>

      <header className="prime-card-3d p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#D97706]">
              {match?.status === 'live' ? <Radio className="w-4 h-4 animate-pulse" /> : <Trophy className="w-4 h-4" />}
              {match?.status === 'live' ? 'Live · ball-by-ball updates' : (match?.status || 'Leaderboard')}
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-black">{matchTitle}</h1>
            {match?.score_summary && <p className="mt-1 text-sm font-bold text-[#475569]">{[match.score_summary.team_a, match.score_summary.team_b].filter(Boolean).map((score: any) => `${score.runs ?? 0}/${score.wickets ?? 0} (${score.overs ?? 0} ov)`).join(' · ')}</p>}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#64748B]">
            <RefreshCw className="w-3.5 h-3.5" />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Connecting live feed'}
          </div>
        </div>
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-center justify-between text-sm font-semibold text-red-700">
            <span>{error}</span>
            <button
              onClick={() => { setError(''); setLoading(true); refresh(); }}
              className="prime-btn-dark-3d !py-1 !px-3 text-xs ml-3 cursor-pointer shrink-0"
            >
              Retry Live Sync
            </button>
          </div>
        )}
      </header>

      {data?.my_team && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your contest rank</p><p className="mt-1 text-2xl font-black text-[#2563EB]">{data.my_team.rank ? `#${data.my_team.rank}` : '—'}</p></div>
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your team points</p><p className="mt-1 text-2xl font-black text-[#D97706]">{Number(data.my_team.total_points || 0).toFixed(1)}</p></div>
          <div className="prime-card-3d p-4 col-span-2 sm:col-span-1"><p className="text-xs font-bold text-[#64748B]">Contest</p><p className="mt-1 truncate text-base font-black">{data.contest?.title || 'Not entered in a contest'}</p></div>
        </section>
      )}

      {/* Contest Selector Tabs */}
      {(data?.contests || []).length > 0 && (
        <section className="prime-card-3d p-4 space-y-3 bg-gradient-to-r from-blue-50/70 via-amber-50/40 to-slate-50 border-2 border-blue-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#D97706]" /> Choose Contest to Inspect Teams:
            </span>
            {data?.contest && (
              <span className="text-xs font-mono font-black text-[#2563EB] bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                {data.contest.type === 'practice' || Number(data.contest.entry_fee) === 0 ? 'FREE ENTRY' : `Entry ₹${data.contest.entry_fee}`} • Pool ₹{Number(data.contest.prize_pool || 0).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {data?.contests?.map((c: any) => {
              const isSelected = selectedContestId === c.id || (!selectedContestId && data?.contest?.id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedContestId(c.id);
                    setParticipantSearch('');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? 'prime-btn-3d border-[#2563EB]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#93C5FD] hover:text-[#2563EB]'
                  }`}
                >
                  <span>{c.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {c.filled_spots || 0}/{c.total_spots || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Your Team Quick Stats (if user has entered this contest) */}
      {data?.my_team && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your contest rank</p><p className="mt-1 text-2xl font-black text-[#2563EB]">{data.my_team.rank ? `#${data.my_team.rank}` : '—'}</p></div>
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your team points</p><p className="mt-1 text-2xl font-black text-[#D97706]">{Number(data.my_team.total_points || 0).toFixed(1)}</p></div>
          <div className="prime-card-3d p-4 col-span-2 sm:col-span-1"><p className="text-xs font-bold text-[#64748B]">Contest</p><p className="mt-1 truncate text-base font-black">{data.contest?.title || 'Contest'}</p></div>
        </section>
      )}

      {/* Leaderboard View Switcher */}
      <div className="flex items-center gap-2 border-b border-[#CBD5E1] pb-2">
        <button
          onClick={() => setActiveLeaderboardTab('contest_teams')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition flex items-center gap-2 ${
            activeLeaderboardTab === 'contest_teams'
              ? 'prime-btn-3d'
              : 'bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Trophy className="w-4 h-4 text-[#D97706]" />
          <span>All Contest Teams ({allContestTeams.length})</span>
        </button>

        <button
          onClick={() => setActiveLeaderboardTab('match_players')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition flex items-center gap-2 ${
            activeLeaderboardTab === 'match_players'
              ? 'prime-btn-3d'
              : 'bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Radio className="w-4 h-4 text-[#2563EB]" />
          <span>Match Players ({data?.player_leaderboard?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: ALL CONTEST TEAMS */}
      {activeLeaderboardTab === 'contest_teams' && (
        <section className="prime-card-3d overflow-hidden space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Trophy className="h-5 w-5 text-[#D97706]" />
                {data?.contest?.title || 'Contest'} — All User Teams
              </h2>
              <p className="mt-1 text-xs text-[#64748B]">
                Is contest mein create ki gayi sabhi users ki teams, players, captain aur points. Kisi bhi team par tap karke uske 11 players dekhein ya apni team se compare karein.
              </p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {visibleContestTeams.length} teams
            </span>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-xs">
            <Search className="h-4 w-4 shrink-0 text-blue-600" />
            <input
              type="search"
              value={participantSearch}
              onChange={event => setParticipantSearch(event.target.value)}
              placeholder="Username ya team name se search karein..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
            {participantSearch && (
              <button type="button" onClick={() => setParticipantSearch('')} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          {loading && !data ? (
            <p className="p-8 text-center text-sm font-bold text-[#64748B]">Contest teams load ho rahi hain…</p>
          ) : visibleContestTeams.length > 0 ? (
            <div className="space-y-3">
              {visibleContestTeams.map((team: any, tIdx: number) => {
                const isMyTeam = team.is_my_team || (data?.my_team && data.my_team.team_id === team.team_id);
                return (
                  <details
                    key={team.team_id}
                    className={`overflow-hidden rounded-2xl border transition shadow-sm ${
                      isMyTeam
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
                        : 'border-blue-200 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30'
                    }`}
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-blue-50/50">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 min-w-10 items-center justify-center rounded-xl font-black text-sm border shadow-xs ${
                          team.rank === 1
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : team.rank === 2
                            ? 'bg-slate-200 text-slate-800 border-slate-300'
                            : team.rank === 3
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-white text-blue-700 border-blue-200'
                        }`}>
                          #{team.rank}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-black text-sm text-slate-900">{team.team_name}</p>
                            {isMyTeam && (
                              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                                Your Team
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 font-semibold">
                            <span>@{team.username}</span>
                            <span>•</span>
                            <span className="text-[#2563EB] font-bold">C: {team.captain_name || 'Captain'}</span>
                            <span>•</span>
                            <span className="text-[#D97706] font-bold">VC: {team.vice_captain_name || 'Vice-Cap'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-mono text-lg font-black text-[#D97706]">{Number(team.total_points || 0).toFixed(1)} pts</p>
                          <span className="text-[10px] font-bold text-blue-600 underline">Tap to view XI ▾</span>
                        </div>

                        {!isMyTeam && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (activeMyTeam) {
                                setCompareOpponent(team);
                              } else {
                                alert('Aapki team se compare karne ke liye pehle is match me apni team create karein.');
                              }
                            }}
                            className="prime-btn-dark-3d !py-1.5 !px-3 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-[#2563EB]"
                            title="Side-by-side compare with your team"
                          >
                            <Swords className="w-3.5 h-3.5 text-amber-500" />
                            <span>Compare XI</span>
                          </button>
                        )}
                      </div>
                    </summary>

                    {/* Team Players XI Full Roster View */}
                    <div className="border-t border-blue-100 bg-white/95 p-4">
                      <div className="flex items-center justify-between mb-3 text-xs font-bold text-[#64748B]">
                        <span className="uppercase tracking-wider font-black text-[#0F172A] flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-[#D97706]" /> 11-Player Playing Lineup
                        </span>
                        <span>{team.players?.length || 0} Players</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {(team.players || []).map((player: any) => (
                          <div
                            key={`${team.team_id}-${player.id}`}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                              player.is_captain
                                ? 'bg-blue-50/90 border-blue-300 shadow-xs'
                                : player.is_vice_captain
                                ? 'bg-amber-50/90 border-amber-300 shadow-xs'
                                : 'bg-[#F8FAFC] border-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs text-[#0F172A] truncate">{player.name}</span>
                                {player.is_captain && (
                                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">C</span>
                                )}
                                {player.is_vice_captain && (
                                  <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">VC</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-semibold mt-0.5">
                                <span className="font-bold text-[#D97706]">{player.role}</span>
                                <span>•</span>
                                <span className="truncate">{player.team_name}</span>
                                <span>•</span>
                                <span>{player.credits || 9.0} Cr</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-black text-[#D97706] block">
                                {Number(player.points_earned || player.points || 0).toFixed(1)} pts
                              </span>
                              <span className="text-[9px] font-bold text-[#64748B]">
                                #{player.rank || '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm font-bold text-[#64748B]">
                {participantSearch.trim().length >= 2
                  ? 'Is search query se koi team nahi mili.'
                  : 'Is contest mein abhi tak koi team create nahi hui hai.'}
              </p>
              <Link
                href={`/team-builder/${matchId}${data?.contest?.id ? `?contestId=${data.contest.id}` : ''}`}
                className="prime-btn-3d inline-flex items-center gap-2 text-xs !py-2 !px-4"
              >
                + Sabse Pehle Team Banayein
              </Link>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: MATCH PLAYERS LEADERBOARD */}
      {activeLeaderboardTab === 'match_players' && (
        <section className="prime-card-3d overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] p-4 sm:p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black"><Trophy className="w-5 h-5 text-[#D97706]" /> Match player leaderboard</h2>
              <p className="mt-1 text-xs text-[#64748B]">Match ke sabhi listed players ke fantasy points aur live rank.</p>
            </div>
            <span className="text-xs font-black text-[#64748B]">{data?.player_leaderboard?.length || 0} players</span>
          </div>
          {loading && !data ? <p className="p-8 text-center text-sm font-bold text-[#64748B]">Live points load ho rahe hain…</p> : (
            <div className="divide-y divide-[#E2E8F0]">
              {(data?.player_leaderboard || []).map(player => (
                <div key={player.id} className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem] items-center gap-2 px-4 py-3">
                  <span className="text-sm font-black text-[#64748B]">#{player.rank}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-black">{player.name}</p><p className="text-[11px] font-semibold text-[#64748B]">{player.team_name} · {player.role}</p></div>
                  <span className="hidden sm:block text-right text-xs font-bold text-[#64748B]">{player.stats?.runs ?? 0} runs · {player.stats?.wickets ?? 0} wkts</span>
                  <span className="text-right font-mono text-base font-black text-[#D97706]">{Number(player.points || 0).toFixed(1)}</span>
                </div>
              ))}
              {!loading && !data?.player_leaderboard?.length && <p className="p-8 text-center text-sm font-bold text-[#64748B]">Is match ke player points abhi available nahi hain.</p>}
            </div>
          )}
        </section>
      )}

      {/* Dream11-Style Head-to-Head Compare XI Modal */}
      <CompareTeamModal
        isOpen={!!compareOpponent}
        onClose={() => setCompareOpponent(null)}
        myTeam={activeMyTeam as any}
        opponentTeam={compareOpponent}
      />
    </main>
  );
}
