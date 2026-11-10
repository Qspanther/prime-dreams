'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy, Swords, Users, Clock, Shield, Radio,
  ArrowLeft, Search, Check, AlertCircle, Zap, Calendar, MapPin
} from 'lucide-react';
import { apiGet, apiPost, resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import CategoryBadge from '../../components/ui/CategoryBadge';
import PlayerPhoto from '../../components/ui/PlayerPhoto';

interface MatchDetailProps {
  params: Promise<{ matchId: string }>;
}

export default function MatchDetailPage({ params }: MatchDetailProps) {
  const router = useRouter();
  const { matchId } = use(params);
  const { user, token } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [activeView, setActiveView] = useState<'contests' | 'squads' | 'commentary'>('contests');
  const [selectedContestTab, setSelectedContestTab] = useState<'all' | 'standard' | 'multi_battlefield' | 'h2h' | 'private' | 'practice' | 'rookie' | 'guru'>('all');
  const [loading, setLoading] = useState(true);

  // Win probability + prize breakup + Guru marketplace
  const [winProb, setWinProb] = useState<any>(null);
  const [breakupContest, setBreakupContest] = useState<any>(null);
  const [breakupData, setBreakupData] = useState<any>(null);
  const [breakupLoading, setBreakupLoading] = useState(false);
  const [guruTeams, setGuruTeams] = useState<any[]>([]);
  const [guruLoaded, setGuruLoaded] = useState(false);
  const [guruCopying, setGuruCopying] = useState<string | null>(null);
  const [guruError, setGuruError] = useState<string | null>(null);

  const fetchWinProbability = async () => {
    if (!token) return;
    try {
      const res = await apiGet(`/matches/${matchId}/win-probability`, token);
      if (res?.success) setWinProb(res);
    } catch (err) { /* silent */ }
  };

  const fetchGuruTeams = async () => {
    try {
      const res = await apiGet(`/guru/teams?match_id=${matchId}`);
      if (res?.success) setGuruTeams(res.teams || []);
    } catch (err) { /* silent */ }
    finally { setGuruLoaded(true); }
  };

  const openPrizeBreakup = async (c: any) => {
    setBreakupContest(c);
    setBreakupData(null);
    setBreakupLoading(true);
    try {
      const res = await apiGet(`/contests/${c.id}/prize-breakup`);
      if (res?.success) setBreakupData(res);
    } catch (err) { /* silent */ }
    finally { setBreakupLoading(false); }
  };

  const handleCopyGuruTeam = async (g: any) => {
    if (!token) { router.push('/login'); return; }
    setGuruCopying(g.id);
    setGuruError(null);
    try {
      const res = await apiPost(`/guru/teams/${g.id}/copy`, {}, token);
      if (res?.success && res.team_id) {
        router.push(`/team-builder/${matchId}?teamId=${res.team_id}`);
      } else {
        setGuruError(res?.error || 'Could not copy team');
      }
    } catch (err: any) {
      setGuruError(err?.message || 'Could not copy team');
    } finally {
      setGuruCopying(null);
    }
  };

  useEffect(() => {
    if (selectedContestTab === 'guru' && !guruLoaded) fetchGuruTeams();
  }, [selectedContestTab, guruLoaded, matchId]);

  useEffect(() => {
    if (token && match && (match.status === 'live' || match.status === 'completed')) {
      fetchWinProbability();
    }
  }, [token, match?.status, matchId]);

  // H2H Custom Challenge Form State
  const [showH2HModal, setShowH2HModal] = useState(false);
  const [h2hAmount, setH2HAmount] = useState('100');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<any>(null);
  const [h2hSubmitting, setH2HSubmitting] = useState(false);
  const [h2hMessage, setH2HMessage] = useState<string | null>(null);
  const [h2hError, setH2HError] = useState<string | null>(null);

  // Private Contests State
  const [privateLoaded, setPrivateLoaded] = useState(false);
  const [myCreatedPrivate, setMyCreatedPrivate] = useState<any[]>([]);
  const [joinedPrivate, setJoinedPrivate] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinResult, setJoinResult] = useState<any>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [joinResolving, setJoinResolving] = useState(false);
  const [showCreatePrivate, setShowCreatePrivate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', entry_fee: '49', total_spots: '4' });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchPrivateContests = async () => {
    if (!token) return;
    try {
      const res = await apiGet(`/matches/${matchId}/private-contests`, token);
      if (res?.success) {
        setMyCreatedPrivate(res.created || []);
        setJoinedPrivate(res.joined || []);
      }
    } catch (err) { /* silent */ }
    finally { setPrivateLoaded(true); }
  };

  useEffect(() => {
    if (selectedContestTab === 'private' && !privateLoaded && token) {
      fetchPrivateContests();
    }
  }, [selectedContestTab, privateLoaded, token, matchId]);

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setJoinCodeError('Invite code daalo'); return; }
    setJoinResolving(true);
    setJoinCodeError(null);
    setJoinResult(null);
    try {
      const res = await apiGet(`/contests/private/${encodeURIComponent(code)}`, token!);
      if (res?.success) {
        setJoinResult(res);
        fetchPrivateContests();
      } else {
        setJoinCodeError(res?.error || 'Invalid code');
      }
    } catch (err: any) {
      setJoinCodeError(err?.message || 'Code resolve nahi hua');
    } finally {
      setJoinResolving(false);
    }
  };

  const handleCreatePrivate = async () => {
    setCreateSubmitting(true);
    setCreateError(null);
    setCreateResult(null);
    try {
      const res = await apiPost(`/matches/${matchId}/private-contests`, {
        title: createForm.title,
        entry_fee: parseFloat(createForm.entry_fee) || 0,
        total_spots: parseInt(createForm.total_spots, 10) || 2,
      }, token!);
      if (res?.success) {
        setCreateResult(res.contest);
        setCreateForm({ title: '', entry_fee: '49', total_spots: '4' });
        fetchPrivateContests();
      } else {
        setCreateError(res?.error || 'Contest create nahi hua');
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Contest create nahi hua');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) { /* clipboard unavailable */ }
  };

  const fetchMatchData = async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        apiGet(`/matches/${matchId}`),
        apiGet(`/matches/${matchId}/telemetry`).catch(() => null)
      ]);
      if (mRes?.match) setMatch(mRes.match);
      if (tRes?.success) setTelemetry(tRes);
    } catch (err) {
      console.error('Error fetching match details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchData();

    // ⚡ Real-Time WebSocket Streaming Gateway with 0-3s Reconnection Jitter (Section 3)
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        const wsUrl = `${protocol}//${host}:5000/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws?.send(JSON.stringify({ action: 'subscribe', matchId }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'BALL_DELTA' && data.match_id === matchId) {
              setMatch((prev: any) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  status: 'live',
                  score_summary: data.score_summary || prev.score_summary,
                  live_data: {
                    ...(prev.live_data || {}),
                    commentary: data.commentary ? [data.commentary, ...((prev.live_data?.commentary || []).slice(0, 9))] : (prev.live_data?.commentary || []),
                    last_ball_time: new Date().toISOString(),
                  }
                };
              });
              setTelemetry((prev: any) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  match: {
                    ...(prev.match || {}),
                    status: 'live',
                    score_summary: data.score_summary || prev.match?.score_summary,
                  }
                };
              });
            } else if (data.type === 'MATCH_SNAPSHOT' && data.match_id === matchId && data.data) {
              setMatch((prev: any) => ({
                ...prev,
                score_summary: data.data,
              }));
            } else if (data.type === 'RESYNC_REQUIRED') {
              fetchMatchData();
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            // Reconnection Jitter: 1s to 4s random backoff (Section 3.4)
            const jitter = Math.floor(Math.random() * 3000) + 1000;
            reconnectTimeout = setTimeout(connectWebSocket, jitter);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (e) {
        // Fallback to REST polling if WebSocket fails
      }
    };

    connectWebSocket();

    // Background REST polling heartbeat every 20 seconds as fallback
    const interval = setInterval(fetchMatchData, 20000);

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      clearInterval(interval);
    };
  }, [matchId]);

  // Search users for H2H opponent
  useEffect(() => {
    if (!searchQuery.trim() || !token) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiGet(`/users/search?q=${encodeURIComponent(searchQuery)}`, token);
        if (res?.users) setSearchResults(res.users);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const handleSendH2HChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      router.push('/login');
      return;
    }
    const amt = parseFloat(h2hAmount);
    if (!amt || amt < 10) {
      setH2HError('Minimum H2H challenge entry fee is ₹10.');
      return;
    }
    if (!selectedOpponent) {
      setH2HError('Please select an opponent to challenge.');
      return;
    }

    setH2HSubmitting(true);
    setH2HError(null);
    setH2HMessage(null);

    try {
      const res = await apiPost('/h2h/challenge', {
        match_id: matchId,
        receiver_id: selectedOpponent.id,
        opponent_id: selectedOpponent.id,
        amount: amt,
        entry_fee: amt,
      }, token);

      if (res?.success) {
        setH2HMessage('✅ H2H Challenge sent! Opponent notified. Once accepted, your contest will be active.');
        setTimeout(() => {
          setShowH2HModal(false);
          setH2HMessage(null);
          setSelectedOpponent(null);
          setSearchQuery('');
          fetchMatchData();
        }, 1500);
      } else {
        setH2HError(res?.error || 'Failed to send challenge. Please check your wallet balance.');
      }
    } catch (err: any) {
      setH2HError(err?.message || 'Error initiating challenge. Check your wallet balance.');
    } finally {
      setH2HSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#64748B]">
        <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
        <p className="text-sm font-black text-[#0F172A]">Loading cricket match &amp; squad details...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-24 text-center text-[#0F172A]">
        <p className="text-xl font-black mb-3">Match not found in database</p>
        <Link href="/" className="prime-btn-3d inline-flex">Back to Matches</Link>
      </div>
    );
  }

  const isLive = match.status === 'live';
  const liveData = telemetry?.match?.live_data || match.live_data || {};
  const scoreSummary = telemetry?.match?.score_summary || match.score_summary || {};
  const players = match.players || telemetry?.players || [];
  const teamAPlayers = players.filter((p: any) => p.team_name === match.team_a);
  const teamBPlayers = players.filter((p: any) => p.team_name === match.team_b);

  const filteredContests = (match.contests || []).filter((c: any) => {
    if (selectedContestTab === 'all') return true;
    if (selectedContestTab === 'rookie') return /rookie/i.test(c.title || '') || (c.type === 'standard' && Number(c.entry_fee) <= 49);
    if (selectedContestTab === 'guru') return false;
    return c.type === selectedContestTab;
  });

  return (
    <div className="px-3 sm:px-6 py-6 max-w-6xl mx-auto w-full space-y-6 bg-transparent text-[#0F172A]">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-black text-[#475569] hover:text-[#2563EB] transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to All Matches</span>
        </Link>
      </div>

      {/* Main Match Header 3D Card */}
      <div className="prime-card-3d p-6 space-y-4">
        {/* Match Poster Banner — fixed 3:2 size (full poster, no crop), 50% visibility */}
        {resolveImageUrl(match.match_poster) && (
          <div className="relative aspect-[3/2] w-full max-w-2xl mx-auto rounded-xl overflow-hidden border-2 border-[#CBD5E1] bg-[#F1F5F9] shadow-[0_4px_16px_rgba(37,99,235,0.12)]">
            <img
              src={resolveImageUrl(match.match_poster)}
              alt="Match Poster"
              className="w-full h-full object-cover opacity-50"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <CategoryBadge category={match.category} size="md" />

          {isLive ? (
            <span className="neon-badge-red px-3 py-1 rounded-full text-xs font-black flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              LIVE MATCH INNINGS
            </span>
          ) : match.is_locked ? (
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-300 text-xs font-black">
              🔒 CONTESTS LOCKED
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#1E3A8A] flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#93C5FD]">
                <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                📅 {match.match_date} • ⏰ {match.match_time}
              </span>
              <span className="bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] px-2.5 py-1 rounded-full text-xs font-black">
                ⚡ UPCOMING
              </span>
            </div>
          )}
        </div>

        {/* Teams Matchup Ribbon */}
        <div className="relative z-10 grid grid-cols-5 items-center gap-3 py-3">
          {/* Team A */}
          <div className="col-span-2 flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] border-2 border-[#93C5FD] flex items-center justify-center font-black text-lg text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] shrink-0 overflow-hidden">
              {resolveImageUrl(match.team_a_logo) ? (
                <img src={resolveImageUrl(match.team_a_logo)} alt={match.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              ) : (match.team_a_code || match.team_a?.slice(0, 3).toUpperCase())}
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-2xl text-[#0F172A] truncate">{match.team_a}</h2>
              {scoreSummary?.team_a && (
                <p className="text-base sm:text-lg font-mono font-black text-[#2563EB]">
                  {scoreSummary.team_a.runs}/{scoreSummary.team_a.wickets}
                  <span className="text-xs font-normal text-[#64748B] ml-1.5">
                    ({scoreSummary.team_a.overs} ov)
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* VS Divider */}
          <div className="col-span-1 text-center">
            <span className="inline-block px-3 py-1 rounded-xl bg-gradient-to-b from-[#0284C7] to-[#0369A1] border border-[#BAE6FD] text-white font-black text-sm italic shadow-md">
              VS
            </span>
          </div>

          {/* Team B */}
          <div className="col-span-2 flex items-center justify-end gap-2 sm:gap-4 text-right min-w-0">
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-2xl text-[#0F172A] truncate">{match.team_b}</h2>
              {scoreSummary?.team_b ? (
                <p className="text-base sm:text-lg font-mono font-black text-[#D97706]">
                  {scoreSummary.team_b.runs}/{scoreSummary.team_b.wickets}
                  <span className="text-xs font-normal text-[#64748B] ml-1.5">
                    ({scoreSummary.team_b.overs} ov)
                  </span>
                </p>
              ) : isLive ? (
                <p className="text-xs font-mono text-[#64748B]">Yet to bat</p>
              ) : null}
            </div>
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] border-2 border-[#FDE68A] flex items-center justify-center font-black text-lg text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)] shrink-0 overflow-hidden">
              {resolveImageUrl(match.team_b_logo) ? (
                <img src={resolveImageUrl(match.team_b_logo)} alt={match.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              ) : (match.team_b_code || match.team_b?.slice(0, 3).toUpperCase())}
            </div>
          </div>
        </div>

        {/* Schedule & Venue Meta */}
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B] font-bold">
          <span className="flex items-center gap-1.5 text-[#0F172A]">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>{match.venue || 'International Cricket Stadium'}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#2563EB]">
            <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Scheduled: {match.match_date} at {match.match_time}</span>
          </span>
          <span className="text-[#64748B]">
            Lock Time: {match.lock_time_minutes || 15} mins before match start
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 🔴 LIVE MATCH TELEMETRY DECK (Kaun khel rha h, kaun bowler h, har ball ka status) */}
      {/* ================================================================= */}
      {isLive && (
        <div className="prime-card-3d p-5 space-y-4 border-2 border-[#38BDF8] bg-white/95">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <h3 className="text-xs font-black text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#EF4444] animate-pulse" />
              <span>In-Play Live Cricket Telemetry Stream</span>
            </h3>
            <span className="bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
              ⚡ Cricbuzz Auto-Syncing (10s)
            </span>
          </div>

          {/* Batsmen on Crease & Active Bowler */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Batting Crease: Kaun khel rha h */}
            <div className="p-4 rounded-xl bg-white border-2 border-[#93C5FD] shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                <span className="text-xs font-black text-[#1E3A8A] uppercase">Batting Crease</span>
                <span className="text-[10px] text-[#64748B] font-bold">Runs (Balls) • 4s / 6s • SR</span>
              </div>

              {/* Striker */}
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between">
                <div>
                  <p className="font-black text-[#0F172A] text-sm flex items-center gap-1">
                    🏏 {liveData.current_striker?.name || 'Active Striker'} *
                  </p>
                  <span className="text-[11px] text-[#64748B] font-bold">
                    4s: {liveData.current_striker?.fours || 5} • 6s: {liveData.current_striker?.sixes || 2}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-black text-base text-[#2563EB] font-mono">
                    {liveData.current_striker?.runs || 48} ({liveData.current_striker?.balls || 32})
                  </span>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    SR: {liveData.current_striker?.strike_rate || '150.0'}
                  </span>
                </div>
              </div>

              {/* Non-Striker */}
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0F172A] text-xs">
                    {liveData.non_striker?.name || 'Non-Striker'}
                  </p>
                  <span className="text-[10px] text-[#64748B]">
                    4s: {liveData.non_striker?.fours || 2} • 6s: {liveData.non_striker?.sixes || 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-[#0F172A] font-bold">
                    {liveData.non_striker?.runs || 24} ({liveData.non_striker?.balls || 18})
                  </span>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    SR: {liveData.non_striker?.strike_rate || '133.3'}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Bowler: Kaun bowling kar rha h */}
            <div className="p-4 rounded-xl bg-white border-2 border-[#FCA5A5] shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                <span className="text-xs font-black text-[#DC2626] uppercase">Active Bowler</span>
                <span className="text-[10px] text-[#64748B] font-bold">Wickets / Runs Conceded</span>
              </div>

              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-black text-[#0F172A] text-sm flex items-center gap-1.5">
                    ⚾ {liveData.current_bowler?.name || 'Active Bowler'}
                  </p>
                  <span className="font-mono font-black text-base text-[#DC2626]">
                    {liveData.current_bowler?.wickets || 2}/{liveData.current_bowler?.runs || 28}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-white border border-[#CBD5E1]">
                    <span className="text-[10px] text-[#64748B] block font-bold">Overs</span>
                    <strong className="text-[#0F172A] font-mono">{liveData.current_bowler?.overs || '3.4'}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#CBD5E1]">
                    <span className="text-[10px] text-[#64748B] block font-bold">Maidens</span>
                    <strong className="text-[#0F172A] font-mono">{liveData.current_bowler?.maidens || 0}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#CBD5E1]">
                    <span className="text-[10px] text-[#64748B] block font-bold">Economy</span>
                    <strong className="text-[#0F172A] font-mono">{liveData.current_bowler?.economy || '7.63'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Over Tokens: Kis ball pe kitne run bane */}
          <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] flex flex-wrap items-center gap-3">
            <span className="text-xs font-black text-[#64748B] uppercase">This Over Balls:</span>
            <div className="flex items-center gap-2">
              {(liveData.recent_balls || ['1', '0', '4', '2', 'W', '1']).map((token: string, idx: number) => (
                <span
                  key={idx}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                    token === 'W'
                      ? 'bg-[#EF4444] text-white shadow-sm'
                      : token === '4' || token === '6'
                      ? 'bg-[#F59E0B] text-white shadow-sm'
                      : 'bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A]'
                  }`}
                >
                  {token}
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs font-mono font-bold">
              <span className="text-[#2563EB]">CRR: {liveData.current_rate || '8.76'}</span>
              <span className="text-[#64748B]">RRR: {liveData.required_rate || '8.40'}</span>
            </div>
          </div>

          {/* Live Commentary Feed: Kya hua h iss ball pe */}
          <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-2">
            <h4 className="text-xs font-black text-[#1E3A8A] uppercase flex items-center gap-1.5">
              <span>Ball-by-Ball Live Commentary</span>
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
              {(liveData.commentary || [
                '⚡ FOUR! Beautiful cover drive piercing through the fielders!',
                'Single pushed down to long-on.',
                'Dot ball, tight length on the off-stump.',
                '🔴 WICKET! Caught at deep square leg! Massive breakthrough!',
              ]).map((comm: string, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] font-medium text-[#0F172A] flex items-start gap-2">
                  <span className="text-[#2563EB] font-black shrink-0">#{i + 1}</span>
                  <span>{comm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Section Navigation: Contests vs Squad Rosters (15 + 15 Players) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('contests')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeView === 'contests' ? 'prime-btn-3d !py-2 !px-4' : 'prime-btn-dark-3d !py-2 !px-4 !text-[#64748B]'
            }`}
          >
            Contests &amp; Pools ({(match.contests || []).length})
          </button>

          <button
            onClick={() => setActiveView('squads')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeView === 'squads' ? 'prime-btn-gold-3d !py-2 !px-4' : 'prime-btn-dark-3d !py-2 !px-4 !text-[#64748B]'
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5" />
            <span>Squad Rosters (30 Players)</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowH2HModal(true)}
            className="prime-btn-dark-3d text-xs !py-2 !px-4 font-black flex items-center gap-1.5"
          >
            <Swords className="w-4 h-4 text-[#D97706]" />
            <span>H2H Duel</span>
          </button>
          {!match.is_locked && (
            <Link
              href={`/team-builder/${matchId}`}
              className="prime-btn-3d text-xs !py-2 !px-4 font-black flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              <span>Create My XI</span>
            </Link>
          )}
        </div>
      </div>

      {/* VIEW 1: CONTESTS LIST */}
      {activeView === 'contests' && (
        <div className="space-y-4">
          {/* Sub tabs for contest types */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Contests' },
              { id: 'practice', label: 'Practice (Free)' },
              { id: 'rookie', label: 'Rookie' },
              { id: 'standard', label: 'Standard Pools' },
              { id: 'multi_battlefield', label: 'PUBG Battlefield' },
              { id: 'h2h', label: 'H2H Custom' },
              { id: 'private', label: 'Private 🔒' },
              { id: 'guru', label: 'Guru Experts' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedContestTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                  selectedContestTab === tab.id
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F1F5F9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── LIVE WIN PROBABILITY TRACKER ─── */}
          {winProb?.teams?.length > 0 && (
            <div className="prime-card-3d p-5 space-y-3 border-2 border-[#2563EB]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#D97706]" />
                <h3 className="font-black text-sm uppercase text-[#0F172A]">Live Winning Tracker</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {winProb.teams.map((t: any) => (
                  <div key={t.team_id} className={`p-3 rounded-xl border-2 ${t.is_winning ? 'bg-green-50 border-green-300' : 'bg-[#F1F5F9] border-[#CBD5E1]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0F172A] truncate">{t.team_name}</span>
                      <span className="text-[10px] font-black text-[#64748B]">Rank #{t.rank}/{t.total_teams}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] font-bold truncate">{t.contest_title}</p>
                    {t.is_winning ? (
                      <p className="mt-1 font-black text-sm text-[#16A34A]">🎉 Aap jeet rahe ho ₹{Number(t.projected_winnings || 0).toLocaleString('en-IN')}</p>
                    ) : (
                      <p className="mt-1 text-xs font-bold text-[#475569]">
                        {t.win_probability != null ? `Win probability: ${t.win_probability}%` : (t.note || 'Match live nahi hai')}
                        {t.projected_winnings > 0 && <span className="text-[#D97706]"> • Target ₹{Number(t.projected_winnings).toLocaleString('en-IN')}</span>}
                      </p>
                    )}
                    {t.win_probability != null && (
                      <div className="mt-1.5 h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#16A34A]" style={{ width: `${t.win_probability}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── GURU EXPERT MARKETPLACE VIEW ─── */}
          {selectedContestTab === 'guru' && (
            <div className="space-y-4">
              <div className="prime-card-3d p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-[#D97706]" />
                  <h3 className="font-black text-sm uppercase text-[#0F172A]">Guru Expert Teams</h3>
                </div>
                <p className="text-xs text-[#64748B] font-bold">Experts ki banayi teams copy karo aur apna XI fatafat banao.</p>
              </div>
              {guruError && (
                <div className="pd-error"><AlertCircle className="w-4 h-4 shrink-0" /><span>{guruError}</span></div>
              )}
              {!guruLoaded ? (
                <p className="text-xs text-[#64748B] font-bold text-center py-6">Loading expert teams...</p>
              ) : guruTeams.length === 0 ? (
                <p className="text-xs text-[#64748B] font-bold text-center py-6">Is match ke liye abhi koi expert team nahi hai.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guruTeams.map((g) => (
                    <div key={g.id} className="contest-card-3d p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-[#0F172A]">{g.guru_name}</span>
                        <span className="text-[11px] font-black text-[#D97706]">★ {Number(g.rating || 0).toFixed(1)}</span>
                      </div>
                      <h4 className="font-black text-base text-[#0F172A]">{g.title}</h4>
                      {g.description && <p className="text-xs text-[#64748B] font-bold">{g.description}</p>}
                      <p className="text-[11px] text-[#64748B] font-bold">
                        C: <span className="text-[#2563EB] font-black">{g.captain_name || '—'}</span> • VC: <span className="text-[#2563EB] font-black">{g.vice_captain_name || '—'}</span>
                      </p>
                      <p className="text-[11px] text-[#64748B] font-bold">{(g.player_names || []).length} players • {g.followers || 0} followers</p>
                      <button
                        onClick={() => handleCopyGuruTeam(g)}
                        disabled={guruCopying === g.id || match.is_locked}
                        className="prime-btn-3d w-full !py-2 text-xs font-black uppercase tracking-wider disabled:opacity-40"
                      >
                        {guruCopying === g.id ? 'Copying...' : 'Copy Team'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── PRIVATE CONTESTS (Invite Code) VIEW ─── */}
          {selectedContestTab === 'private' && (
            <div className="space-y-5">
              {/* Join by Code */}
              <div className="prime-card-3d p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="font-black text-sm uppercase text-[#0F172A]">Join Private Contest</h3>
                </div>
                <p className="text-xs text-[#64748B] font-bold">Dost se invite code lo aur yahan paste karo.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB7K2M9P"
                    maxLength={12}
                    className="pd-input flex-1 min-w-[140px] font-mono font-black tracking-widest uppercase"
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={joinResolving || !token}
                    className="prime-btn-3d !py-2.5 !px-4 !text-xs shrink-0"
                  >
                    {joinResolving ? 'Checking...' : 'Find Contest'}
                  </button>
                </div>
                {joinCodeError && (
                  <div className="pd-error"><AlertCircle className="w-4 h-4 shrink-0" /><span>{joinCodeError}</span></div>
                )}
                {joinResult?.contest && (
                  <div className="rounded-xl bg-[#EFF6FF] border-2 border-[#93C5FD] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-[#0F172A] truncate">{joinResult.contest.title}</h4>
                        <p className="text-xs text-[#475569] font-bold mt-0.5">{joinResult.match?.team_a} vs {joinResult.match?.team_b}</p>
                      </div>
                      <span className="pd-num font-mono font-black text-sm text-[#1D4ED8] bg-white px-2.5 py-1 rounded-lg border border-[#BFDBFE]">₹{joinResult.contest.entry_fee}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-[#475569]">
                      <span>Prize Pool: <span className="pd-num font-black text-[#D97706]">₹{Number(joinResult.contest.prize_pool).toLocaleString('en-IN')}</span></span>
                      <span>{joinResult.contest.filled_spots}/{joinResult.contest.total_spots} joined</span>
                    </div>
                    <Link
                      href={`/team-builder/${joinResult.match?.id || matchId}?contestId=${joinResult.contest.id}`}
                      className="prime-btn-gold-3d w-full !py-2.5 !text-xs"
                    >
                      Join Contest ₹{joinResult.contest.entry_fee}
                    </Link>
                  </div>
                )}
              </div>

              {/* Create Private Contest */}
              <div className="prime-card-3d p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-[#D97706] shrink-0" />
                    <h3 className="font-black text-sm uppercase text-[#0F172A]">Create Private Contest</h3>
                  </div>
                  <button
                    onClick={() => setShowCreatePrivate(!showCreatePrivate)}
                    className="prime-btn-dark-3d !py-1.5 !px-3 !text-xs shrink-0"
                  >
                    {showCreatePrivate ? 'Close' : '+ Create'}
                  </button>
                </div>

                {showCreatePrivate && (
                  <div className="space-y-3 rounded-xl bg-[#FFF7E6] border-2 border-[#FDE68A] p-4">
                    <div>
                      <label className="pd-label">Contest Name</label>
                      <input
                        value={createForm.title}
                        onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                        placeholder="Dosto ke sath jung"
                        maxLength={40}
                        className="pd-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="pd-label">Entry Fee (₹)</label>
                        <input
                          type="number" min="0" step="1"
                          value={createForm.entry_fee}
                          onChange={(e) => setCreateForm({ ...createForm, entry_fee: e.target.value })}
                          className="pd-input pd-num"
                        />
                      </div>
                      <div>
                        <label className="pd-label">Total Spots</label>
                        <input
                          type="number" min="2" max="100" step="1"
                          value={createForm.total_spots}
                          onChange={(e) => setCreateForm({ ...createForm, total_spots: e.target.value })}
                          className="pd-input pd-num"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-[#92400E] font-bold">
                      Prize Pool auto-calculate hoga: spots × fee − 10% platform fee = <span className="pd-num font-black">₹{Math.round((parseFloat(createForm.entry_fee) || 0) * (parseInt(createForm.total_spots, 10) || 2) * 0.9)}</span>
                    </p>
                    {createError && (
                      <div className="pd-error"><AlertCircle className="w-4 h-4 shrink-0" /><span>{createError}</span></div>
                    )}
                    <button
                      onClick={handleCreatePrivate}
                      disabled={createSubmitting || !token}
                      className="prime-btn-gold-3d w-full !py-2.5 !text-xs"
                    >
                      {createSubmitting ? 'Creating...' : 'Create Private Contest'}
                    </button>
                  </div>
                )}

                {createResult?.invite_code && (
                  <div className="rounded-xl bg-[#ECFDF5] border-2 border-[#6EE7B7] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-[#065F46] truncate">{createResult.title}</h4>
                        <p className="text-xs text-[#047857] font-bold">Contest ban gaya! Code dost ko share karo:</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pd-num flex-1 text-center font-mono font-black text-lg tracking-[0.3em] text-[#065F46] bg-white rounded-xl border-2 border-[#6EE7B7] px-3 py-2 select-all">
                        {createResult.invite_code}
                      </span>
                      <button
                        onClick={() => copyInviteCode(createResult.invite_code)}
                        className="prime-btn-3d !py-2 !px-3 !text-xs shrink-0"
                      >
                        {copiedCode === createResult.invite_code ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <Link
                      href={`/team-builder/${matchId}?contestId=${createResult.id}`}
                      className="prime-btn-gold-3d w-full !py-2.5 !text-xs"
                    >
                      Join with your Team ₹{createResult.entry_fee}
                    </Link>
                  </div>
                )}
              </div>

              {/* My Created Private Contests */}
              {myCreatedPrivate.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-black text-xs uppercase tracking-wider text-[#475569] flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#2563EB]" /> Created by you ({myCreatedPrivate.length})
                  </h4>
                  {myCreatedPrivate.map((c: any) => (
                    <div key={c.id} className="contest-card-3d p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h5 className="font-black text-sm text-[#0F172A] truncate">{c.title}</h5>
                        <p className="text-xs text-[#64748B] font-bold">₹{c.entry_fee} entry • ₹{Number(c.prize_pool).toLocaleString('en-IN')} pool • {c.filled_spots}/{c.total_spots} joined</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyInviteCode(c.invite_code)}
                          className="prime-btn-dark-3d !py-1.5 !px-2.5 !text-[10px] font-mono shrink-0"
                          title={c.invite_code}
                        >
                          {copiedCode === c.invite_code ? 'Copied!' : c.invite_code}
                        </button>
                        <Link href={`/team-builder/${matchId}?contestId=${c.id}`} className="prime-btn-3d !py-1.5 !px-3 !text-[10px] shrink-0">
                          Join
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Joined Private Contests */}
              {joinedPrivate.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-black text-xs uppercase tracking-wider text-[#475569] flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-[#D97706]" /> Joined via code ({joinedPrivate.length})
                  </h4>
                  {joinedPrivate.map((c: any) => (
                    <div key={c.id} className="contest-card-3d p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h5 className="font-black text-sm text-[#0F172A] truncate">{c.title}</h5>
                        <p className="text-xs text-[#64748B] font-bold">₹{c.entry_fee} entry • {c.filled_spots}/{c.total_spots} joined</p>
                      </div>
                      <span className="pd-num font-mono font-black text-xs text-[#065F46] bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#6EE7B7] shrink-0">
                        Joined ✓
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {privateLoaded && myCreatedPrivate.length === 0 && joinedPrivate.length === 0 && !joinResult && (
                <div className="text-center py-6 text-xs text-[#64748B] font-bold">
                  Abhi koi private contest nahi — code se join karo ya apna banao! 🔒
                </div>
              )}
            </div>
          )}

          {/* ─── PUBLIC CONTESTS GRID ─── */}
          {selectedContestTab !== 'private' && selectedContestTab !== 'guru' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredContests.map((c: any) => {
              const spotsLeft = Math.max(0, (c.total_spots || 100) - (c.filled_spots || 0));
              const percentFilled = Math.min(100, Math.round(((c.filled_spots || 0) / (c.total_spots || 100)) * 100));

              return (
                <div key={c.id} className="contest-card-3d p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <CategoryBadge category={match.category} size="xs" />
                      <span className="font-mono font-black text-sm text-[#1D4ED8] bg-[#EFF6FF] px-2.5 py-1 rounded-lg border border-[#BFDBFE]">
                        {c.type === 'practice' || Number(c.entry_fee) === 0 ? 'FREE' : `₹${c.entry_fee}`}
                      </span>
                    </div>

                    <h4 className="font-black text-[#0F172A] text-base mb-1">{c.title}</h4>
                    <p className="text-xs text-[#64748B] font-bold">
                      Prize Pool: <span className="font-black text-[#D97706] font-mono">₹{c.prize_pool.toLocaleString('en-IN')}</span>
                    </p>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#2563EB] font-black">{spotsLeft} spots left</span>
                        <span className="text-[#64748B]">{c.total_spots} total</span>
                      </div>
                      <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden border border-[#CBD5E1]">
                        <div
                          className="h-full bg-gradient-to-r from-[#2563EB] via-[#38BDF8] to-[#0284C7] rounded-full transition-all"
                          style={{ width: `${percentFilled}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#E2E8F0] space-y-2">
                    <button
                      onClick={() => openPrizeBreakup(c)}
                      className="w-full text-[11px] font-black text-[#2563EB] hover:text-[#1D4ED8] uppercase tracking-wider flex items-center justify-center gap-1"
                    >
                      <Trophy className="w-3.5 h-3.5" /> Prize Breakup &amp; Winners
                    </button>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748B] font-bold">
                        {c.type === 'practice' ? 'Practice • No cash risk' : /rookie/i.test(c.title || '') ? 'Rookie • Beginner' : c.type === 'multi_battlefield' ? 'Auto-clones' : 'Guaranteed'}
                      </span>
                      <Link
                        href={`/team-builder/${matchId}?contestId=${c.id}`}
                        className="prime-btn-3d !py-2 !px-4 text-xs font-black uppercase tracking-wider"
                      >
                        {c.type === 'practice' || Number(c.entry_fee) === 0 ? 'Join Free' : `Join Contest ₹${c.entry_fee}`}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 👥 VIEW 2: FULL SQUAD ROSTER (15 Team A + 15 Team B Players) */}
      {/* ================================================================= */}
      {activeView === 'squads' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-[#0F172A] text-sm uppercase">
                Complete Match Squad Pool (30 Players Total)
              </h3>
              <p className="text-xs text-[#64748B] font-bold mt-0.5">
                Exact 15 players for {match.team_a} and 15 players for {match.team_b}
              </p>
            </div>
            <span className="bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-3 py-1 rounded-full text-xs font-black">
              15 + 15 Roster in Database
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team A 15 Players */}
            <div className="prime-card-3d p-5 space-y-3 border-2 border-[#93C5FD] bg-white">
              <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
                <h4 className="font-black text-sm text-[#1D4ED8] uppercase">{match.team_a} Squad</h4>
                <span className="text-xs font-mono font-bold text-[#64748B]">{teamAPlayers.length || 15} Players</span>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[32rem] overflow-y-auto pr-1">
                {(teamAPlayers.length > 0 ? teamAPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${match.team_a} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] p-2.5 flex flex-col items-center text-center shadow-xs">
                    <PlayerPhoto
                      name={p.name}
                      photoUrl={p.photo_url}
                      boxClass="w-full aspect-square rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-2xl text-[#93C5FD] mb-2"
                    />
                    <span className="font-bold text-[#0F172A] text-xs leading-tight line-clamp-2 min-h-[2rem] flex items-center">{p.name}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">{p.role}</span>
                      <span className="font-mono text-[10px] text-[#64748B] font-bold">{p.credits || 9.0} Cr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team B 15 Players */}
            <div className="prime-card-3d p-5 space-y-3 border-2 border-[#FDE68A] bg-white">
              <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
                <h4 className="font-black text-sm text-[#D97706] uppercase">{match.team_b} Squad</h4>
                <span className="text-xs font-mono font-bold text-[#64748B]">{teamBPlayers.length || 15} Players</span>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[32rem] overflow-y-auto pr-1">
                {(teamBPlayers.length > 0 ? teamBPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${match.team_b} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] p-2.5 flex flex-col items-center text-center shadow-xs">
                    <PlayerPhoto
                      name={p.name}
                      photoUrl={p.photo_url}
                      boxClass="w-full aspect-square rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-2xl text-[#FCD34D] mb-2"
                    />
                    <span className="font-bold text-[#0F172A] text-xs leading-tight line-clamp-2 min-h-[2rem] flex items-center">{p.name}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">{p.role}</span>
                      <span className="font-mono text-[10px] text-[#64748B] font-bold">{p.credits || 9.0} Cr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prize Breakup & Winners Modal */}
      {breakupContest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg prime-card-3d p-6 space-y-4 border-2 border-[#D97706] bg-white text-[#0F172A] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="font-black text-base flex items-center gap-2"><Trophy className="w-5 h-5 text-[#D97706]" /> Prize Breakup</h3>
                <p className="text-xs text-[#64748B] font-bold">{breakupContest.title} • Pool ₹{Number(breakupContest.prize_pool || 0).toLocaleString('en-IN')}</p>
              </div>
              <button onClick={() => { setBreakupContest(null); setBreakupData(null); }} className="text-[#64748B] hover:text-[#0F172A] text-lg">✕</button>
            </div>
            {breakupLoading ? (
              <p className="text-xs text-[#64748B] font-bold text-center py-6">Loading breakup...</p>
            ) : breakupData ? (
              <>
                <div className="space-y-1.5">
                  <h4 className="font-black text-xs uppercase text-[#64748B]">Rank-wise Prizes</h4>
                  {(breakupData.breakup || []).map((b: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold">
                      <span className="text-[#475569]">Rank {b.rank_from}{b.rank_to !== b.rank_from ? `–${b.rank_to}` : ''}</span>
                      <span className="font-mono font-black text-[#D97706]">₹{Number(b.prize || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                {(breakupData.winners || []).length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-black text-xs uppercase text-[#64748B]">Current Winners</h4>
                    {breakupData.winners.map((w: any) => (
                      <div key={w.rank} className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200 text-xs font-bold">
                        <span className="text-[#0F172A]">#{w.rank} {w.team_name} <span className="text-[#64748B]">({w.user_name})</span></span>
                        <span className="font-mono font-black text-[#16A34A]">{w.points} pts • ₹{Number(w.prize || 0).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[#64748B] font-bold text-center py-6">Breakup unavailable.</p>
            )}
          </div>
        </div>
      )}

      {/* H2H Challenge Modal */}
      {showH2HModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md prime-card-3d p-6 space-y-5 border-2 border-[#2563EB] shadow-2xl bg-white text-[#0F172A]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-black text-[#0F172A] text-base">H2H 1-on-1 Challenge</h3>
              </div>
              <button onClick={() => setShowH2HModal(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            {h2hError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{h2hError}</span>
              </div>
            )}
            {h2hMessage && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-green-500" />
                <span>{h2hMessage}</span>
              </div>
            )}

            <form onSubmit={handleSendH2HChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#1E3A8A] uppercase mb-1.5">
                  Set Challenge Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-base font-black text-[#2563EB]">₹</span>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={h2hAmount}
                    onChange={(e) => setH2HAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#F8FAFC] border-2 border-[#CBD5E1] text-[#0F172A] text-base font-black focus:border-[#2563EB] outline-none"
                    required
                  />
                </div>
                <p className="text-[11px] text-[#64748B] font-bold mt-1">
                  Winner takes 85% of total pool (₹{(parseFloat(h2hAmount || '0') * 2 * 0.85).toFixed(0)}), platform keeps 15%.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-[#1E3A8A] uppercase mb-1.5">
                  Search Opponent (Username or Email)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type username..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F8FAFC] border-2 border-[#CBD5E1] text-[#0F172A] text-xs font-bold focus:border-[#2563EB] outline-none"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-xl bg-white border border-[#CBD5E1] p-1.5 shadow-sm">
                    {searchResults.map((opp) => (
                      <button
                        key={opp.id}
                        type="button"
                        onClick={() => {
                          setSelectedOpponent(opp);
                          setSearchQuery(opp.username);
                          setSearchResults([]);
                        }}
                        className={`w-full p-2 text-left rounded-lg text-xs font-bold flex items-center justify-between ${
                          selectedOpponent?.id === opp.id ? 'bg-[#2563EB] text-white' : 'hover:bg-[#F1F5F9] text-[#0F172A]'
                        }`}
                      >
                        <span>@{opp.username}</span>
                        <span className="text-[10px] text-[#64748B]">{opp.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedOpponent && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-between text-xs">
                    <span className="text-[#0F172A] font-black">Challenging: @{selectedOpponent.username}</span>
                    <span className="text-[#2563EB] font-black">Ready</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowH2HModal(false)}
                  className="prime-btn-dark-3d text-xs !py-2 !px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={h2hSubmitting}
                  className="prime-btn-3d text-xs !py-2 !px-5"
                >
                  {h2hSubmitting ? 'Delivering...' : `Send Challenge (₹${h2hAmount})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
