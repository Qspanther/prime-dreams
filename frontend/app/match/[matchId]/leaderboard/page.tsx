'use client';

import React, { useCallback, useEffect, use, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Radio, RefreshCw, Search, Trophy, X, Swords, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiGet, getWebSocketUrl } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { wsManager } from '@/lib/ws-manager';

const CompareTeamModal = dynamic(() => import('../../../components/ui/CompareTeamModal'), { ssr: false });

type LeaderboardData = {
  match?: { title: string; status: string; team_a: string; team_b: string; score_summary?: any; last_updated?: string | null };
  player_leaderboard?: any[];
  contest?: { id: string; contest_code?: number | null; title: string; status: string; entry_fee?: number; prize_pool?: number; type?: string } | null;
  contests?: Array<{ id: string; contest_code?: number | null; title: string; status: string; entry_fee?: number; prize_pool?: number; type?: string }>;
  contest_leaderboard?: any[];
  total_contest_teams?: number;
  batch_page?: number;
  batch_limit?: number;
  has_more?: boolean;
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

  // Progressive 10-team Batched Loading & Priority Search States
  const [displayedTeams, setDisplayedTeams] = useState<any[]>([]);
  const [currentBatch, setCurrentBatch] = useState<number>(1);
  const [totalContestTeams, setTotalContestTeams] = useState<number>(0);
  const [hasMoreBatches, setHasMoreBatches] = useState<boolean>(false);
  const [loadingNextBatch, setLoadingNextBatch] = useState<boolean>(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Synchronous cache & search interrupt refs
  const allLoadedTeamsRef = useRef<any[]>([]);
  const searchInputRef = useRef<string>('');
  const isLoopRunningRef = useRef<boolean>(false);
  const isLoopFinishedRef = useRef<boolean>(false);

  const [compareTeamA, setCompareTeamA] = useState<any>(null);
  const [compareTeamB, setCompareTeamB] = useState<any>(null);

  const handleOpenCompare = (team: any) => {
    if (activeMyTeam) {
      setCompareTeamA(activeMyTeam);
      setCompareTeamB(team);
    } else {
      const rankOneTeam = displayedTeams.find(t => t.rank === 1 && t.team_id !== team.team_id) ||
        (displayedTeams[0]?.team_id !== team.team_id ? displayedTeams[0] : displayedTeams[1]);
      if (rankOneTeam) {
        setCompareTeamA(rankOneTeam);
        setCompareTeamB(team);
      }
    }
  };

  const autoLoadLoop = useCallback(async (startPage: number, contestId: string) => {
    if (isLoopRunningRef.current || isLoopFinishedRef.current) return;
    isLoopRunningRef.current = true;
    let page = startPage;

    try {
      while (true) {
        // Immediate search preference: interrupt loop if user types anything
        if (searchInputRef.current.trim().length > 0) {
          break;
        }

        setLoadingNextBatch(true);
        const q = new URLSearchParams();
        if (teamId) q.set('team_id', teamId);
        if (contestId) q.set('contest_id', contestId);
        q.set('page', String(page));
        q.set('limit', '100');

        const result = await apiGet(`/matches/${matchId}/leaderboard?${q.toString()}`, token || undefined);

        // Discard if user searched while request was in-flight
        if (searchInputRef.current.trim().length > 0) {
          break;
        }

        const newTeams = result?.contest_leaderboard || [];
        if (newTeams.length === 0) {
          setHasMoreBatches(false);
          isLoopFinishedRef.current = true;
          break;
        }

        const existingIds = new Set(allLoadedTeamsRef.current.map((t: any) => t.team_id));
        const filtered = newTeams.filter((t: any) => !existingIds.has(t.team_id));
        const updated = [...allLoadedTeamsRef.current, ...filtered];
        allLoadedTeamsRef.current = updated;

        setDisplayedTeams(updated);
        setCurrentBatch(page);

        const totalTeams = Number(result?.total_contest_teams) || updated.length;
        setTotalContestTeams(totalTeams);

        const hasMore = Boolean(result.has_more) && (updated.length < totalTeams);
        setHasMoreBatches(hasMore);

        if (!hasMore || updated.length >= totalTeams) {
          isLoopFinishedRef.current = true;
          break;
        }

        page += 1;
        // Fast yield to browser event loop
        await new Promise(r => setTimeout(r, 20));
      }
    } catch (err) {
      console.warn('Auto batch loop error:', err);
    } finally {
      setLoadingNextBatch(false);
      isLoopRunningRef.current = false;
    }
  }, [teamId, matchId, token]);

  const refresh = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (teamId) q.set('team_id', teamId);
      if (selectedContestId) q.set('contest_id', selectedContestId);
      q.set('page', '1');
      q.set('limit', '100');
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const result = await apiGet(`/matches/${matchId}/leaderboard${queryStr}`, token || undefined);
      if (result?.match?.id && result.match.id !== matchId && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/match/${result.match.id}/leaderboard${queryStr}`);
      }
      setData(result);
      const activeContestId = selectedContestId || result?.contest?.id || '';
      if (!selectedContestId && result?.contest?.id) {
        setSelectedContestId(result.contest.id);
      }
      if (!isSearchActive && searchInputRef.current.trim().length === 0) {
        // If all teams for this contest are already loaded, do not reset or restart loop!
        if (isLoopFinishedRef.current && allLoadedTeamsRef.current.length > 0) {
          setTotalContestTeams(Number(result?.total_contest_teams) || allLoadedTeamsRef.current.length);
          setError('');
          setUpdatedAt(new Date());
          return;
        }

        const teams = result?.contest_leaderboard || [];
        allLoadedTeamsRef.current = teams;
        setDisplayedTeams(teams);
        setCurrentBatch(1);
        const total = Number(result?.total_contest_teams) || teams.length;
        setTotalContestTeams(total);
        const hasMore = Boolean(result?.has_more) && (teams.length < total);
        setHasMoreBatches(hasMore);

        if (!hasMore || teams.length >= total) {
          isLoopFinishedRef.current = true;
        } else if (activeContestId) {
          void autoLoadLoop(2, activeContestId);
        }
      }
      setError('');
      setUpdatedAt(new Date());
    } catch (err: any) {
      console.warn('Leaderboard refresh warning:', err?.message);
      setData(prev => {
        if (!prev) setError('Live leaderboard is synchronizing. Auto-refreshing shortly.');
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId, selectedContestId, token, isSearchActive, autoLoadLoop]);

  // Priority Search: Instant server-side search by team name, username, or user ID
  // When user types, it halts the auto-loop immediately and displays the searched team
  useEffect(() => {
    const query = participantSearch.trim();
    searchInputRef.current = query;

    if (query.length === 0) {
      if (isSearchActive) {
        setIsSearchActive(false);
        // Restore all accumulated teams from the auto-loader
        setDisplayedTeams(allLoadedTeamsRef.current);
        // Resume remaining batches if list was not completely finished
        if (allLoadedTeamsRef.current.length < totalContestTeams && selectedContestId) {
          const nextPage = Math.floor(allLoadedTeamsRef.current.length / 10) + 1;
          void autoLoadLoop(nextPage, selectedContestId);
        }
      }
      return;
    }

    // Immediately stop the background auto-batch loop
    setIsSearchActive(true);
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams();
        if (selectedContestId) q.set('contest_id', selectedContestId);
        q.set('search', query);
        const result = await apiGet(`/matches/${matchId}/leaderboard?${q.toString()}`, token || undefined);
        setDisplayedTeams(result.contest_leaderboard || []);
        setHasMoreBatches(false); // Halt loop while showing search results
      } catch (err) {
        console.warn('Priority search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 180); // Fast 180ms debounce

    return () => clearTimeout(timer);
  }, [participantSearch, matchId, selectedContestId, token, isSearchActive, totalContestTeams, autoLoadLoop]);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const safeRefresh = async () => { if (active) await refresh(); };
    void safeRefresh();

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void safeRefresh(); }, 250);
    };

    // ⚡ Real-Time WebSocket Streaming via Singleton wsManager
    const unsubscribe = wsManager.subscribe(matchId, (message: any) => {
      try {
        if ((message.type === 'BALL_DELTA' || message.type === 'MATCH_SNAPSHOT' || message.type === 'RESYNC_REQUIRED') && (message.match_id === matchId || !message.match_id)) {
          scheduleRefresh();
        }
      } catch { /* keep REST fallback active */ }
    });

    const fallbackPoll = setInterval(() => { void safeRefresh(); }, 12000);

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(fallbackPoll);
      unsubscribe();
    };
  }, [matchId, refresh]);

  const match = data?.match;
  const matchTitle = match?.title || [match?.team_a, match?.team_b].filter(Boolean).join(' vs ') || 'Match Leaderboard';
  const activeMyTeam = data?.my_team || null;

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5 text-[#0F172A]">
      <Link href={`/match/${matchId}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#475569] hover:text-[#2563EB] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Match
      </Link>

      <header className="prime-card-3d p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#D97706]">
              {match?.status === 'live' ? <Radio className="w-4 h-4 animate-pulse" /> : <Trophy className="w-4 h-4" />}
              {match?.status === 'live' ? 'Live · Ball-by-ball updates' : (match?.status || 'Leaderboard')}
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-black">{matchTitle}</h1>
            {match?.score_summary && (
              <p className="mt-1 text-sm font-bold text-[#475569]">
                {[match.score_summary.team_a, match.score_summary.team_b].filter(Boolean).map((score: any) => `${score.runs ?? 0}/${score.wickets ?? 0} (${score.overs ?? 0} ov)`).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#64748B]">
            <RefreshCw className="w-3.5 h-3.5" />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Connecting live feed...'}
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

      {/* Contest Selector Tabs */}
      {(data?.contests || []).length > 0 && (
        <section className="prime-card-3d p-4 space-y-3 bg-gradient-to-r from-blue-50/70 via-amber-50/40 to-slate-50 border-2 border-blue-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#D97706]" /> Choose Contest to Inspect Teams:
            </span>
            {data?.contest && (
              <span className="text-xs font-mono font-black text-[#059669] bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#A7F3D0]">
                Contest #{data.contest.contest_code || 2011} • FREE ENTRY (PASS)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {data?.contests?.map((c: any) => {
              const isSelected = selectedContestId === c.id || (!selectedContestId && data?.contest?.id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedContestId(c.id);
                    setParticipantSearch('');
                    searchInputRef.current = '';
                    setIsSearchActive(false);
                    isLoopFinishedRef.current = false;
                    allLoadedTeamsRef.current = [];
                    setDisplayedTeams([]);
                    setCurrentBatch(1);
                    setHasMoreBatches(false);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition cursor-pointer flex items-center gap-2 border ${isSelected
                    ? 'prime-btn-3d border-[#2563EB]'
                    : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#93C5FD] hover:text-[#2563EB]'
                    }`}
                >
                  <span>{c.contest_code ? `Contest #${c.contest_code} • ` : ''}{c.title?.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').trim()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {c.filled_spots || 0}/{c.total_spots || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Your Team Quick Summary */}
      {data?.my_team && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your Contest Rank</p><p className="mt-1 text-2xl font-black text-[#2563EB]">{data.my_team.rank ? `#${data.my_team.rank}` : '—'}</p></div>
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your Fantasy Points</p><p className="mt-1 text-2xl font-black text-[#D97706]">{Number(data.my_team.total_points || 0).toFixed(1)}</p></div>
          <div className="prime-card-3d p-4 col-span-2 sm:col-span-1"><p className="text-xs font-bold text-[#64748B]">Current Contest</p><p className="mt-1 truncate text-base font-black">{data.contest?.contest_code ? `Contest #${data.contest.contest_code} • ` : ''}{data.contest?.title?.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').trim() || 'Contest'}</p></div>
        </section>
      )}

      {/* Leaderboard View Switcher */}
      <div className="flex items-center gap-2 border-b border-[#CBD5E1] pb-2">
        <button
          onClick={() => setActiveLeaderboardTab('contest_teams')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition flex items-center gap-2 ${activeLeaderboardTab === 'contest_teams'
            ? 'prime-btn-3d'
            : 'bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          <Trophy className="w-4 h-4 text-[#D97706]" />
          <span>All Contest Teams ({totalContestTeams || displayedTeams.length})</span>
        </button>

        <button
          onClick={() => setActiveLeaderboardTab('match_players')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition flex items-center gap-2 ${activeLeaderboardTab === 'match_players'
            ? 'prime-btn-3d'
            : 'bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          <Radio className="w-4 h-4 text-[#2563EB]" />
          <span>Match Players ({data?.player_leaderboard?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: ALL CONTEST TEAMS (Batched in sets of 10 with priority search) */}
      {activeLeaderboardTab === 'contest_teams' && (
        <section className="prime-card-3d overflow-hidden space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Trophy className="h-5 w-5 text-[#D97706]" />
                {data?.contest?.contest_code ? `Contest #${data.contest.contest_code} • ` : ''}{data?.contest?.title?.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').trim() || 'Contest'} — All User Teams
              </h2>
              <p className="mt-1 text-xs text-[#64748B]">
                All user teams, players, captains and points in this contest. Tap any team to inspect its 11 players or compare with your lineup.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                {isSearchActive ? `${displayedTeams.length} Matches Found` : `Showing ${displayedTeams.length} of ${totalContestTeams || displayedTeams.length} Teams`}
              </span>
            </div>
          </div>

          {/* Informational Banner for user without team */}
          {!activeMyTeam && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">🏏</span>
                <p className="font-bold text-blue-950">
                  <span className="font-black text-[#2563EB]">Browsing all participant teams:</span> Tap any team to inspect its 11 players, or click <strong className="text-amber-700">Compare XI</strong> to compare lineups side-by-side!
                </p>
              </div>
              <Link
                href={`/team-builder/${matchId}?contestId=${selectedContestId || ''}`}
                className="prime-btn-gold-3d !py-1.5 !px-3 text-xs font-black shrink-0"
              >
                + Build My XI (Free)
              </Link>
            </div>
          )}

          {/* Priority Search Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-xs">
              <Search className="h-4 w-4 shrink-0 text-blue-600" />
              <input
                type="search"
                value={participantSearch}
                onChange={event => setParticipantSearch(event.target.value)}
                placeholder="Search by team name, username, or user ID..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              />
              {participantSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setParticipantSearch('');
                    searchInputRef.current = '';
                  }}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            {isSearchActive && (
              <p className="text-[11px] text-blue-600 font-bold px-1 flex items-center justify-between">
                <span>⚡ Priority Search Active: Showing results for &quot;{participantSearch}&quot;</span>
                <button
                  type="button"
                  onClick={() => {
                    setParticipantSearch('');
                    searchInputRef.current = '';
                  }}
                  className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Reset &amp; Resume All Teams
                </button>
              </p>
            )}
          </div>

          {loading && displayedTeams.length === 0 ? (
            <div className="p-12 text-center text-sm font-bold text-[#64748B] space-y-2">
              <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading initial batch of teams...</p>
            </div>
          ) : searchLoading ? (
            <div className="p-8 text-center text-sm font-bold text-[#64748B] space-y-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Searching teams with priority preference...</p>
            </div>
          ) : displayedTeams.length > 0 ? (
            <div className="space-y-3">
              {displayedTeams.map((team: any) => {
                const isMyTeam = team.is_my_team || (data?.my_team && data.my_team.team_id === team.team_id);
                return (
                  <details
                    key={team.team_id}
                    className={`overflow-hidden rounded-2xl border transition shadow-sm ${isMyTeam
                      ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
                      : 'border-blue-200 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30'
                      }`}
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-blue-50/50">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 min-w-10 items-center justify-center rounded-xl font-black text-sm border shadow-xs ${team.rank === 1
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
                              handleOpenCompare(team);
                            }}
                            className="prime-btn-dark-3d !py-1.5 !px-3 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-[#2563EB]"
                            title="Side-by-side compare with your team or leader"
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
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${player.is_captain
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
                                  <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-black shrink-0">C (2×)</span>
                                )}
                                {player.is_vice_captain && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white text-[9px] font-black shrink-0">VC (1.5×)</span>
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
                              <span className="font-mono text-xs font-black text-emerald-600 block">
                                +{Number(player.points_earned ?? (player.is_captain ? (player.points || 0) * 2 : player.is_vice_captain ? (player.points || 0) * 1.5 : (player.points || 0))).toFixed(1)} pts
                              </span>
                              {(player.is_captain || player.is_vice_captain) && (
                                <span className="text-[8px] font-semibold text-slate-500 block">
                                  Base: {Number(player.points || 0).toFixed(1)}
                                </span>
                              )}
                              <span className="text-[9px] font-bold text-[#64748B]">
                                Rank #{player.rank || '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}

              {/* Minimal streaming indicator while background loop is active (Zero button) */}
              {loadingNextBatch && !isSearchActive && (
                <div className="py-2.5 text-center text-xs font-bold text-[#64748B] flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Loading contest teams ({displayedTeams.length} of {totalContestTeams || '...'})</span>
                </div>
              )}

              {!isSearchActive && !hasMoreBatches && displayedTeams.length > 0 && !loadingNextBatch && (
                <p className="text-[11px] text-emerald-600 font-bold text-center pt-2 flex items-center justify-center gap-1.5">
                  <span>✓ All {displayedTeams.length} contest teams loaded</span>
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm font-bold text-[#64748B]">
                {participantSearch.trim().length >= 2
                  ? 'No teams found matching your search query.'
                  : 'No teams have entered this contest yet.'}
              </p>
              <Link
                href={`/team-builder/${matchId}${data?.contest?.id ? `?contestId=${data.contest.id}` : ''}`}
                className="prime-btn-3d inline-flex items-center gap-2 text-xs !py-2 !px-4"
              >
                + Be the First to Create a Team
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
              <h2 className="flex items-center gap-2 text-lg font-black"><Trophy className="w-5 h-5 text-[#D97706]" /> Match Player Leaderboard</h2>
              <p className="mt-1 text-xs text-[#64748B]">Live fantasy points and match rankings for all participating players.</p>
            </div>
            <span className="text-xs font-black text-[#64748B]">{data?.player_leaderboard?.length || 0} players</span>
          </div>
          {loading && !data ? <p className="p-8 text-center text-sm font-bold text-[#64748B]">Loading live fantasy points...</p> : (
            <div className="divide-y divide-[#E2E8F0]">
              {(data?.player_leaderboard || []).map(player => (
                <div key={player.id} className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem] items-center gap-2 px-4 py-3">
                  <span className="text-sm font-black text-[#64748B]">#{player.rank}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-black">{player.name}</p><p className="text-[11px] font-semibold text-[#64748B]">{player.team_name} · {player.role}</p></div>
                  <span className="hidden sm:block text-right text-xs font-bold text-[#64748B]">{player.stats?.runs ?? 0} runs · {player.stats?.wickets ?? 0} wkts</span>
                  <span className="text-right font-mono text-base font-black text-[#D97706]">{Number(player.points || 0).toFixed(1)}</span>
                </div>
              ))}
              {!loading && !data?.player_leaderboard?.length && <p className="p-8 text-center text-sm font-bold text-[#64748B]">Player points are not yet available for this match.</p>}
            </div>
          )}
        </section>
      )}

      {/* Head-to-Head Compare XI Modal */}
      <CompareTeamModal
        isOpen={Boolean(compareTeamA && compareTeamB)}
        onClose={() => { setCompareTeamA(null); setCompareTeamB(null); }}
        myTeam={compareTeamA}
        opponentTeam={compareTeamB}
        myTeamLabel={activeMyTeam && compareTeamA?.team_id === activeMyTeam.team_id ? 'Your Team' : `Leader (Rank #${compareTeamA?.rank || 1})`}
        opponentTeamLabel={activeMyTeam && compareTeamA?.team_id === activeMyTeam.team_id ? `Competitor (@${compareTeamB?.username || 'user'})` : `Team #${compareTeamB?.rank || '—'} (@${compareTeamB?.username || 'user'})`}
        buildTeamLink={!activeMyTeam ? `/team-builder/${matchId}?contestId=${selectedContestId}` : undefined}
      />
    </main>
  );
}
