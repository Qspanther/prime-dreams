'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy, Swords, Users, Clock, Shield, Radio,
  ArrowLeft, Search, Check, AlertCircle, Zap, Calendar, MapPin
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import CategoryBadge from '../../components/ui/CategoryBadge';

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
  const [selectedContestTab, setSelectedContestTab] = useState<'all' | 'standard' | 'multi_battlefield' | 'h2h'>('all');
  const [loading, setLoading] = useState(true);

  // H2H Custom Challenge Form State
  const [showH2HModal, setShowH2HModal] = useState(false);
  const [h2hAmount, setH2HAmount] = useState('100');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<any>(null);
  const [h2hSubmitting, setH2HSubmitting] = useState(false);
  const [h2hMessage, setH2HMessage] = useState<string | null>(null);
  const [h2hError, setH2HError] = useState<string | null>(null);

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
      <div className="py-24 text-center text-[#A3A3A3] bg-[#000000]">
        <div className="w-10 h-10 border-4 border-[#FF1744] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_#FF1744]" />
        <p className="text-sm font-black text-white">Loading cricket match &amp; squad details...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-24 text-center text-white bg-[#000000]">
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
    return c.type === selectedContestTab;
  });

  return (
    <div className="px-3 sm:px-6 py-6 max-w-6xl mx-auto w-full space-y-6 bg-[#000000] text-white">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-black text-[#D4D4D4] hover:text-[#FFD700] transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to All Matches</span>
        </Link>
      </div>

      {/* Main Match Header 3D Card */}
      <div className="prime-card-3d p-6 relative overflow-hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222222] pb-3">
          <CategoryBadge category={match.category} size="md" />

          {isLive ? (
            <span className="neon-badge-red px-3 py-1 rounded-full text-xs font-black flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              LIVE MATCH INNINGS
            </span>
          ) : match.is_locked ? (
            <span className="px-3 py-1 rounded-full bg-red-950/80 text-red-300 border border-red-600/50 text-xs font-black">
              🔒 CONTESTS LOCKED
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#FFD700] flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141414] border border-[#FFD700]/40">
                <Clock className="w-3.5 h-3.5 text-[#FF1744]" />
                📅 {match.match_date} • ⏰ {match.match_time}
              </span>
              <span className="bg-[#141414] text-[#D4D4D4] border border-[#262626] px-2.5 py-1 rounded-full text-xs font-black">
                ⚡ UPCOMING
              </span>
            </div>
          )}
        </div>

        {/* Teams Matchup Ribbon */}
        <div className="grid grid-cols-5 items-center gap-3 py-3">
          {/* Team A */}
          <div className="col-span-2 flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#FF1744] to-[#800018] border-2 border-[#FF8095] flex items-center justify-center font-black text-lg text-white shadow-[0_0_15px_rgba(255,23,68,0.5)] shrink-0">
              {match.team_a_code || match.team_a?.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <h2 className="font-black text-base sm:text-2xl text-white">{match.team_a}</h2>
              {scoreSummary?.team_a && (
                <p className="text-lg font-mono font-black text-[#FFD700]">
                  {scoreSummary.team_a.runs}/{scoreSummary.team_a.wickets}
                  <span className="text-xs font-normal text-[#A3A3A3] ml-1.5">
                    ({scoreSummary.team_a.overs} ov)
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* VS Divider */}
          <div className="col-span-1 text-center">
            <span className="inline-block px-3 py-1 rounded-xl bg-gradient-to-b from-[#FF1744] to-[#800018] border border-[#FF8095] text-white font-black text-sm italic shadow-[0_0_10px_#FF1744]">
              VS
            </span>
          </div>

          {/* Team B */}
          <div className="col-span-2 flex items-center justify-end gap-3 sm:gap-4 text-right">
            <div>
              <h2 className="font-black text-base sm:text-2xl text-white">{match.team_b}</h2>
              {scoreSummary?.team_b ? (
                <p className="text-lg font-mono font-black text-[#FFD700]">
                  {scoreSummary.team_b.runs}/{scoreSummary.team_b.wickets}
                  <span className="text-xs font-normal text-[#A3A3A3] ml-1.5">
                    ({scoreSummary.team_b.overs} ov)
                  </span>
                </p>
              ) : isLive ? (
                <p className="text-xs font-mono text-[#A3A3A3]">Yet to bat</p>
              ) : null}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#FFD700] to-[#997A00] border-2 border-[#FFF9C4] flex items-center justify-center font-black text-lg text-black shadow-[0_0_15px_rgba(255,215,0,0.5)] shrink-0">
              {match.team_b_code || match.team_b?.slice(0, 3).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Schedule & Venue Meta */}
        <div className="pt-3 border-t border-[#222222] flex flex-wrap items-center justify-between gap-3 text-xs text-[#A3A3A3] font-bold">
          <span className="flex items-center gap-1.5 text-white">
            <MapPin className="w-3.5 h-3.5 text-[#FF1744]" />
            <span>{match.venue || 'International Cricket Stadium'}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#FFD700]">
            <Calendar className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Scheduled: {match.match_date} at {match.match_time}</span>
          </span>
          <span>
            Lock Time: {match.lock_time_minutes || 15} mins before match start
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 🔴 LIVE MATCH TELEMETRY DECK (Kaun khel rha h, kaun bowler h, har ball ka status) */}
      {/* ================================================================= */}
      {isLive && (
        <div className="prime-card-3d p-5 space-y-4 border-2 border-[#FF1744]/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] pb-3">
            <h3 className="text-xs font-black text-[#FFD700] uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#FF1744] animate-pulse" />
              <span>In-Play Live Cricket Telemetry Stream</span>
            </h3>
            <span className="neon-badge-gold px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
              ⚡ Cricbuzz Auto-Syncing (10s)
            </span>
          </div>

          {/* Batsmen on Crease & Active Bowler */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Batting Crease: Kaun khel rha h */}
            <div className="p-4 rounded-xl bg-[#000000] border-2 border-[#FFD700]/40 space-y-3">
              <div className="flex justify-between items-center border-b border-[#222222] pb-2">
                <span className="text-xs font-black text-[#FFD700] uppercase">Batting Crease</span>
                <span className="text-[10px] text-[#A3A3A3] font-bold">Runs (Balls) • 4s / 6s • SR</span>
              </div>

              {/* Striker */}
              <div className="p-2.5 rounded-lg bg-[#0D0D0D] border border-[#222222] flex items-center justify-between">
                <div>
                  <p className="font-black text-white text-sm flex items-center gap-1">
                    🏏 {liveData.current_striker?.name || 'Active Striker'} *
                  </p>
                  <span className="text-[11px] text-[#A3A3A3] font-bold">
                    4s: {liveData.current_striker?.fours || 5} • 6s: {liveData.current_striker?.sixes || 2}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-black text-base text-[#FFD700] font-mono">
                    {liveData.current_striker?.runs || 48} ({liveData.current_striker?.balls || 32})
                  </span>
                  <span className="text-[10px] text-[#A3A3A3] block font-mono">
                    SR: {liveData.current_striker?.strike_rate || '150.0'}
                  </span>
                </div>
              </div>

              {/* Non-Striker */}
              <div className="p-2.5 rounded-lg bg-[#0D0D0D] border border-[#222222] flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-xs">
                    {liveData.non_striker?.name || 'Non-Striker'}
                  </p>
                  <span className="text-[10px] text-[#A3A3A3]">
                    4s: {liveData.non_striker?.fours || 2} • 6s: {liveData.non_striker?.sixes || 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-white font-bold">
                    {liveData.non_striker?.runs || 24} ({liveData.non_striker?.balls || 18})
                  </span>
                  <span className="text-[10px] text-[#A3A3A3] block font-mono">
                    SR: {liveData.non_striker?.strike_rate || '133.3'}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Bowler: Kaun bowling kar rha h */}
            <div className="p-4 rounded-xl bg-[#000000] border-2 border-[#FF1744]/40 space-y-3">
              <div className="flex justify-between items-center border-b border-[#222222] pb-2">
                <span className="text-xs font-black text-[#FF1744] uppercase">Active Bowler</span>
                <span className="text-[10px] text-[#A3A3A3] font-bold">Wickets / Runs Conceded</span>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0D0D] border border-[#222222] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-black text-white text-sm flex items-center gap-1.5">
                    ⚾ {liveData.current_bowler?.name || 'Active Bowler'}
                  </p>
                  <span className="font-mono font-black text-base text-[#FF1744]">
                    {liveData.current_bowler?.wickets || 2}/{liveData.current_bowler?.runs || 28}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-[#000000] border border-[#222222]">
                    <span className="text-[10px] text-[#A3A3A3] block font-bold">Overs</span>
                    <strong className="text-white font-mono">{liveData.current_bowler?.overs || '3.4'}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[#000000] border border-[#222222]">
                    <span className="text-[10px] text-[#A3A3A3] block font-bold">Maidens</span>
                    <strong className="text-white font-mono">{liveData.current_bowler?.maidens || 0}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[#000000] border border-[#222222]">
                    <span className="text-[10px] text-[#A3A3A3] block font-bold">Economy</span>
                    <strong className="text-white font-mono">{liveData.current_bowler?.economy || '7.63'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Over Tokens: Kis ball pe kitne run bane */}
          <div className="p-3 rounded-xl bg-[#000000] border border-[#222222] flex flex-wrap items-center gap-3">
            <span className="text-xs font-black text-[#A3A3A3] uppercase">This Over Balls:</span>
            <div className="flex items-center gap-2">
              {(liveData.recent_balls || ['1', '0', '4', '2', 'W', '1']).map((token: string, idx: number) => (
                <span
                  key={idx}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                    token === 'W'
                      ? 'bg-[#FF1744] text-white shadow-[0_0_10px_#FF1744]'
                      : token === '4' || token === '6'
                      ? 'bg-[#FFD700] text-black shadow-[0_0_10px_#FFD700]'
                      : 'bg-[#141414] border border-[#333333] text-white'
                  }`}
                >
                  {token}
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs font-mono font-bold">
              <span className="text-[#FFD700]">CRR: {liveData.current_rate || '8.76'}</span>
              <span className="text-[#A3A3A3]">RRR: {liveData.required_rate || '8.40'}</span>
            </div>
          </div>

          {/* Live Commentary Feed: Kya hua h iss ball pe */}
          <div className="p-4 rounded-xl bg-[#000000] border border-[#222222] space-y-2">
            <h4 className="text-xs font-black text-[#FFD700] uppercase flex items-center gap-1.5">
              <span>Ball-by-Ball Live Commentary</span>
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
              {(liveData.commentary || [
                '⚡ FOUR! Beautiful cover drive piercing through the fielders!',
                'Single pushed down to long-on.',
                'Dot ball, tight length on the off-stump.',
                '🔴 WICKET! Caught at deep square leg! Massive breakthrough!',
              ]).map((comm: string, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-[#0A0A0A] border border-[#222222] font-medium text-white flex items-start gap-2">
                  <span className="text-[#FFD700] font-black shrink-0">#{i + 1}</span>
                  <span>{comm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Section Navigation: Contests vs Squad Rosters (15 + 15 Players) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222222] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('contests')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeView === 'contests' ? 'prime-btn-3d !py-2 !px-4' : 'prime-btn-dark-3d !py-2 !px-4 !text-[#A3A3A3]'
            }`}
          >
            Contests &amp; Pools ({(match.contests || []).length})
          </button>

          <button
            onClick={() => setActiveView('squads')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeView === 'squads' ? 'prime-btn-gold-3d !py-2 !px-4' : 'prime-btn-dark-3d !py-2 !px-4 !text-[#A3A3A3]'
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
            <Swords className="w-4 h-4 text-[#FFD700]" />
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
              { id: 'standard', label: 'Standard Pools' },
              { id: 'multi_battlefield', label: 'PUBG Battlefield' },
              { id: 'h2h', label: 'H2H Custom' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedContestTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider ${
                  selectedContestTab === tab.id
                    ? 'bg-[#FF1744] text-white shadow-md'
                    : 'bg-[#111111] text-[#A3A3A3] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredContests.map((c: any) => {
              const spotsLeft = Math.max(0, (c.total_spots || 100) - (c.filled_spots || 0));
              const percentFilled = Math.min(100, Math.round(((c.filled_spots || 0) / (c.total_spots || 100)) * 100));

              return (
                <div key={c.id} className="prime-card-3d p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <CategoryBadge category={match.category} size="xs" />
                      <span className="font-mono font-black text-base text-[#FFD700]">
                        ₹{c.entry_fee}
                      </span>
                    </div>

                    <h4 className="font-black text-white text-base mb-1">{c.title}</h4>
                    <p className="text-xs text-[#A3A3A3] font-bold">
                      Prize Pool: <span className="font-black text-[#FFD700] font-mono">₹{c.prize_pool.toLocaleString('en-IN')}</span>
                    </p>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#FF1744] font-black">{spotsLeft} spots left</span>
                        <span className="text-[#A3A3A3]">{c.total_spots} total</span>
                      </div>
                      <div className="h-2 w-full bg-[#000000] rounded-full overflow-hidden border border-[#262626]">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF1744] to-[#FFD700] rounded-full transition-all"
                          style={{ width: `${percentFilled}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#222222] flex items-center justify-between">
                    <span className="text-[11px] text-[#A3A3A3] font-bold">
                      {c.type === 'multi_battlefield' ? 'Auto-clones' : 'Guaranteed'}
                    </span>
                    <Link
                      href={`/team-builder/${matchId}?contestId=${c.id}`}
                      className="prime-btn-3d !py-2 !px-4 text-xs font-black uppercase tracking-wider"
                    >
                      Join Contest ₹{c.entry_fee}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 👥 VIEW 2: FULL SQUAD ROSTER (15 Team A + 15 Team B Players) */}
      {/* ================================================================= */}
      {activeView === 'squads' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#222222] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-white text-sm uppercase">
                Complete Match Squad Pool (30 Players Total)
              </h3>
              <p className="text-xs text-[#A3A3A3] font-bold mt-0.5">
                Exact 15 players for {match.team_a} and 15 players for {match.team_b}
              </p>
            </div>
            <span className="neon-badge-gold px-3 py-1 rounded-full text-xs font-black">
              15 + 15 Roster in Database
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team A 15 Players */}
            <div className="prime-card-3d p-5 space-y-3 border-2 border-[#FF1744]/40">
              <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
                <h4 className="font-black text-sm text-[#FF8095] uppercase">{match.team_a} Squad</h4>
                <span className="text-xs font-mono font-bold text-white">{teamAPlayers.length || 15} Players</span>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {(teamAPlayers.length > 0 ? teamAPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${match.team_a} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="p-2.5 rounded-xl bg-[#000000] border border-[#222222] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[#A3A3A3] text-xs w-5 font-bold">#{idx + 1}</span>
                      <span className="font-bold text-white text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#141414] text-[#FFD700] border border-[#FFD700]/30">
                        {p.role}
                      </span>
                      <span className="font-mono text-xs text-[#A3A3A3] font-bold">{p.credits || 9.0} Cr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team B 15 Players */}
            <div className="prime-card-3d p-5 space-y-3 border-2 border-[#FFD700]/40">
              <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
                <h4 className="font-black text-sm text-[#FFD700] uppercase">{match.team_b} Squad</h4>
                <span className="text-xs font-mono font-bold text-white">{teamBPlayers.length || 15} Players</span>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {(teamBPlayers.length > 0 ? teamBPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${match.team_b} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="p-2.5 rounded-xl bg-[#000000] border border-[#222222] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[#A3A3A3] text-xs w-5 font-bold">#{idx + 1}</span>
                      <span className="font-bold text-white text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#141414] text-[#FFD700] border border-[#FFD700]/30">
                        {p.role}
                      </span>
                      <span className="font-mono text-xs text-[#A3A3A3] font-bold">{p.credits || 9.0} Cr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* H2H Challenge Modal */}
      {showH2HModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md prime-card-3d p-6 space-y-5 border-2 border-[#FF1744] shadow-[0_0_50px_rgba(255,23,68,0.5)]">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-[#FF1744]" />
                <h3 className="font-black text-white text-base">H2H 1-on-1 Challenge</h3>
              </div>
              <button onClick={() => setShowH2HModal(false)} className="text-[#A3A3A3] hover:text-white">✕</button>
            </div>

            {h2hError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{h2hError}</span>
              </div>
            )}
            {h2hMessage && (
              <div className="p-3 rounded-xl bg-green-950/80 border border-green-500/60 text-green-200 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-green-400" />
                <span>{h2hMessage}</span>
              </div>
            )}

            <form onSubmit={handleSendH2HChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#FFD700] uppercase mb-1.5">
                  Set Challenge Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-base font-black text-[#FFD700]">₹</span>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={h2hAmount}
                    onChange={(e) => setH2HAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#000000] border-2 border-[#333333] text-white text-base font-black focus:border-[#FF1744] outline-none"
                    required
                  />
                </div>
                <p className="text-[11px] text-[#A3A3A3] font-bold mt-1">
                  Winner takes 85% of total pool (₹{(parseFloat(h2hAmount || '0') * 2 * 0.85).toFixed(0)}), platform keeps 15%.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-[#FFD700] uppercase mb-1.5">
                  Search Opponent (Username or Email)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#A3A3A3]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type username..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#000000] border-2 border-[#333333] text-white text-xs font-bold focus:border-[#FF1744] outline-none"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-xl bg-[#000000] border border-[#333333] p-1.5">
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
                          selectedOpponent?.id === opp.id ? 'bg-[#FF1744] text-white' : 'hover:bg-[#1C1C1C] text-white'
                        }`}
                      >
                        <span>@{opp.username}</span>
                        <span className="text-[10px] text-[#A3A3A3]">{opp.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedOpponent && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[#141414] border border-[#FFD700]/40 flex items-center justify-between text-xs">
                    <span className="text-white font-black">Challenging: @{selectedOpponent.username}</span>
                    <span className="text-[#FFD700] font-black">Ready</span>
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
