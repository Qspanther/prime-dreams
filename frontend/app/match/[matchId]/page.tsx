'use client';

import React, { useEffect, useState, use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Trophy, Swords, Users, Clock, Shield, Radio, Lock,
  ArrowLeft, ArrowRight, AlertCircle, Zap, Calendar, MapPin, Share2, ShieldCheck, CheckCircle2, ChevronRight
} from 'lucide-react';
import { apiGet, apiPost, resolveImageUrl, getWebSocketUrl } from '../../lib/api';
import { wsManager } from '@/lib/ws-manager';
import { useAuth } from '../../lib/auth-context';
import CategoryBadge from '../../components/ui/CategoryBadge';
import PlayerPhoto from '../../components/ui/PlayerPhoto';

const PrizeBreakupModal = dynamic(() => import('../../components/ui/PrizeBreakupModal'), { ssr: false });
const TeamLimitModal = dynamic(() => import('../../components/ui/TeamLimitModal'), { ssr: false });

interface MatchDetailProps {
  params: Promise<{ matchId: string }>;
}

export default function MatchDetailPage({ params }: MatchDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryJoinCode = searchParams?.get('joinCode') || searchParams?.get('code') || '';
  const { matchId } = use(params);
  const { user, token } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [activeView, setActiveView] = useState<'contests' | 'squads' | 'commentary'>('contests');
  const [selectedContestTab, setSelectedContestTab] = useState<'all' | 'mega' | 'battleground' | 'mini' | 'guru'>('all');
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

  // Dynamic Subscription / Referral Match Quota Tracking
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);
  const [limitInfo, setLimitInfo] = useState<{
    maxTeams: number;
    currentTeams: number;
    passName: string;
    daysLeft?: number;
  }>({
    maxTeams: 2,
    currentTeams: 0,
    passName: 'Tournament Pass',
  });

  useEffect(() => {
    if (!token || !matchId) return;
    apiGet(`/matches/${matchId}/my-teams`, token)
      .then((res) => {
        if (res?.success) {
          setLimitInfo({
            maxTeams: res.max_teams || 2,
            currentTeams: res.count ?? (res.teams?.length || 0),
            passName: res.pass_name || 'Tournament Pass',
            daysLeft: res.days_left,
          });
        }
      })
      .catch(() => {});
  }, [token, matchId]);

  const handleCreateXI = (e: React.MouseEvent, targetUrl: string) => {
    e.preventDefault();
    if (limitInfo.currentTeams >= limitInfo.maxTeams && limitInfo.maxTeams > 0) {
      setShowLimitModal(true);
      return;
    }
    router.push(targetUrl);
  };

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



  const fetchMatchData = async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        apiGet(`/matches/${matchId}`),
        apiGet(`/matches/${matchId}/telemetry`).catch(() => null)
      ]);
      if (mRes?.match) {
        setMatch(mRes.match);
        if (typeof window !== 'undefined' && mRes.match.id && mRes.match.id !== matchId) {
          window.history.replaceState(null, '', `/match/${mRes.match.id}`);
        }
      } else {
        // Fallback: fetch active match list
        const listRes = await apiGet('/matches').catch(() => null);
        const fallback = (listRes?.matches || []).find((m: any) => m.status === 'live' || m.status === 'upcoming') || listRes?.matches?.[0];
        if (fallback && typeof window !== 'undefined') {
          window.location.replace(`/match/${fallback.id}`);
          return;
        }
      }
      if (tRes?.success) setTelemetry(tRes);
    } catch (err) {
      console.error('Error fetching match details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchData();

    // ⚡ Real-Time WebSocket Streaming via Singleton wsManager
    const unsubscribe = wsManager.subscribe(matchId, (data: any) => {
      try {
        if (data.type === 'BALL_DELTA' && (data.match_id === matchId || !data.match_id)) {
          setMatch((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'live',
              score_summary: data.score_summary || prev.score_summary,
              live_data: {
                ...(prev.live_data || {}),
                current_striker: data.current_striker !== undefined ? data.current_striker : prev.live_data?.current_striker,
                non_striker: data.non_striker !== undefined ? data.non_striker : prev.live_data?.non_striker,
                current_bowler: data.current_bowler !== undefined ? data.current_bowler : prev.live_data?.current_bowler,
                recent_balls: data.recent_balls !== undefined ? data.recent_balls : prev.live_data?.recent_balls,
                current_rate: data.current_rate !== undefined ? data.current_rate : prev.live_data?.current_rate,
                required_rate: data.required_rate !== undefined ? data.required_rate : prev.live_data?.required_rate,
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
                live_data: {
                  ...(prev.match?.live_data || {}),
                  current_striker: data.current_striker !== undefined ? data.current_striker : prev.match?.live_data?.current_striker,
                  non_striker: data.non_striker !== undefined ? data.non_striker : prev.match?.live_data?.non_striker,
                  current_bowler: data.current_bowler !== undefined ? data.current_bowler : prev.match?.live_data?.current_bowler,
                  recent_balls: data.recent_balls !== undefined ? data.recent_balls : prev.match?.live_data?.recent_balls,
                  current_rate: data.current_rate !== undefined ? data.current_rate : prev.match?.live_data?.current_rate,
                  required_rate: data.required_rate !== undefined ? data.required_rate : prev.match?.live_data?.required_rate,
                }
              }
            };
          });
        } else if (data.type === 'MATCH_SNAPSHOT' && (data.match_id === matchId || !data.match_id) && data.data) {
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
    });

    // Background REST polling heartbeat every 5 seconds for live ball fidelity
    const interval = setInterval(fetchMatchData, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [matchId]);

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
      <div className="py-24 text-center text-[#0F172A] space-y-4 max-w-md mx-auto px-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto text-3xl shadow-sm">
          🏏
        </div>
        <div>
          <p className="text-xl font-black text-[#0F172A] mb-1">Match Expired or Moved</p>
          <p className="text-xs text-[#64748B] font-medium leading-relaxed">
            This match has concluded or has been updated. Please visit the Live Cricket Arena to explore active matches.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/" className="prime-btn-3d inline-flex items-center gap-2">
            <span>Explore All Live Matches</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const liveData = telemetry?.match?.live_data || match.live_data || {};
  const scoreSummary = telemetry?.match?.score_summary || match.score_summary || {};
  const hasLiveScore = !!(
    (scoreSummary?.team_a?.overs > 0 || scoreSummary?.team_a?.runs > 0) ||
    (scoreSummary?.team_b?.overs > 0 || scoreSummary?.team_b?.runs > 0)
  );
  const isLive = match.status === 'live' || hasLiveScore;
  const isLocked = !!(
    match.is_locked ||
    isLive ||
    match.status === 'completed' ||
    (match.start_time && new Date() >= new Date(new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000))
  );
  const players = match.players || telemetry?.players || [];
  const teamAPlayers = players.filter((p: any) => p.team_name === match.team_a);
  const teamBPlayers = players.filter((p: any) => p.team_name === match.team_b);

  // Only Battleground, Mega Contest, and Mini Contest (Strictly Exclude H2H and Private)
  const allowedContests = (match.contests || []).filter((c: any) => {
    if (c.is_private || c.type === 'private' || c.type === 'h2h') return false;
    const title = String(c.title || '').toLowerCase();
    if (/\b(h2h|head[\s-]*to[\s-]*head|duel|private)\b/i.test(title)) return false;
    return true;
  });

  const filteredContests = allowedContests.filter((c: any) => {
    if (selectedContestTab === 'all') return true;
    const title = String(c.title || '').toLowerCase();
    if (selectedContestTab === 'mega') {
      return c.type === 'mega' || title.includes('mega') || (c.total_spots || 0) >= 1000;
    }
    if (selectedContestTab === 'battleground') {
      return c.type === 'multi_battlefield' || title.includes('battlefield') || title.includes('battleground');
    }
    if (selectedContestTab === 'mini') {
      return c.type === 'mini' || title.includes('mini') || ((c.total_spots || 0) > 25 && (c.total_spots || 0) <= 250);
    }
    return true;
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
            <Image
              src={resolveImageUrl(match.match_poster)}
              alt="Match Poster"
              fill
              unoptimized
              className="w-full h-full object-cover opacity-50"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <CategoryBadge category={match.category} size="md" />

          {isLive ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="neon-badge-red px-3 py-1 rounded-full text-xs font-black flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                LIVE MATCH INNINGS
              </span>
              <Link
                href={`/match/${matchId}/leaderboard`}
                className="prime-btn-gold-3d px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Live Leaderboard</span>
              </Link>
            </div>
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
        <div className="relative z-10 py-2 sm:py-3">
          {/* Mobile Screen Layout (<sm): Clean Two-Row Clash with VS Badge */}
          <div className="sm:hidden space-y-2">
            {/* Team A Card */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/90 border-2 border-[#93C5FD] shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] border-2 border-[#93C5FD] flex items-center justify-center font-black text-sm text-white shadow-xs shrink-0 overflow-hidden">
                  {resolveImageUrl(match.team_a_logo) ? (
                    <Image src={resolveImageUrl(match.team_a_logo)} alt={match.team_a} width={40} height={40} unoptimized className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  ) : (match.team_a_code || match.team_a?.slice(0, 3).toUpperCase())}
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-sm text-[#0F172A] truncate">{match.team_a}</h2>
                  <span className="text-[10px] text-[#64748B] font-bold block">{match.team_a_code || 'TEAM A'}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {scoreSummary?.team_a ? (
                  <p className="text-sm font-mono font-black text-[#2563EB]">
                    {scoreSummary.team_a.runs}/{scoreSummary.team_a.wickets}
                    <span className="text-[11px] font-normal text-[#64748B] ml-1">
                      ({scoreSummary.team_a.overs} ov)
                    </span>
                  </p>
                ) : (
                  <span className="text-xs font-mono text-[#64748B]">{isLive ? 'Yet to bat' : 'Scheduled'}</span>
                )}
              </div>
            </div>

            {/* VS Pill */}
            <div className="flex items-center justify-center -my-1">
              <span className="px-3 py-0.5 rounded-full bg-gradient-to-r from-[#0284C7] to-[#0369A1] text-white font-black text-[10px] italic shadow-sm border border-[#BAE6FD]">
                VS
              </span>
            </div>

            {/* Team B Card */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/90 border-2 border-[#FDE68A] shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] border-2 border-[#FDE68A] flex items-center justify-center font-black text-sm text-white shadow-xs shrink-0 overflow-hidden">
                  {resolveImageUrl(match.team_b_logo) ? (
                    <Image src={resolveImageUrl(match.team_b_logo)} alt={match.team_b} width={40} height={40} unoptimized className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  ) : (match.team_b_code || match.team_b?.slice(0, 3).toUpperCase())}
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-sm text-[#0F172A] truncate">{match.team_b}</h2>
                  <span className="text-[10px] text-[#64748B] font-bold block">{match.team_b_code || 'TEAM B'}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {scoreSummary?.team_b ? (
                  <p className="text-sm font-mono font-black text-[#D97706]">
                    {scoreSummary.team_b.runs}/{scoreSummary.team_b.wickets}
                    <span className="text-[11px] font-normal text-[#64748B] ml-1">
                      ({scoreSummary.team_b.overs} ov)
                    </span>
                  </p>
                ) : (
                  <span className="text-xs font-mono text-[#64748B]">{isLive ? 'Yet to bat' : 'Scheduled'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop & Tablet Layout (>=sm): Original 5-column Grid */}
          <div className="hidden sm:grid grid-cols-5 items-center gap-3">
            {/* Team A */}
            <div className="col-span-2 flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] border-2 border-[#93C5FD] flex items-center justify-center font-black text-lg text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] shrink-0 overflow-hidden">
                {resolveImageUrl(match.team_a_logo) ? (
                  <Image src={resolveImageUrl(match.team_a_logo)} alt={match.team_a} width={56} height={56} unoptimized className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
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
                  <Image src={resolveImageUrl(match.team_b_logo)} alt={match.team_b} width={56} height={56} unoptimized className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                ) : (match.team_b_code || match.team_b?.slice(0, 3).toUpperCase())}
              </div>
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
      {/* 🔴 LIVE MATCH TELEMETRY DECK (Active batsmen, bowler, ball-by-ball status) */}
      {/* ================================================================= */}
      {isLive && (
        <div className="prime-card-3d p-5 space-y-4 border-2 border-[#38BDF8] bg-white/95">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <h3 className="text-xs font-black text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#EF4444] animate-pulse" />
              <span>In-Play Live Cricket Telemetry Stream</span>
            </h3>
            <span className="bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
              ⚡ Live Telemetry Auto-Sync (10s)
            </span>
          </div>

          {/* Batsmen on Crease & Active Bowler */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Batting Crease */}
            <div className="p-4 rounded-xl bg-white border-2 border-[#93C5FD] shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                <span className="text-xs font-black text-[#1E3A8A] uppercase">Batting Crease</span>
                <span className="text-[10px] text-[#64748B] font-bold">Runs (Balls) • 4s / 6s • SR</span>
              </div>

              {/* Striker */}
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between">
                <div>
                  <p className="font-black text-[#0F172A] text-sm flex items-center gap-1">
                    🏏 {liveData.current_striker?.name || 'On Crease'} *
                  </p>
                  <span className="text-[11px] text-[#64748B] font-bold">
                    4s: {liveData.current_striker?.fours ?? 0} • 6s: {liveData.current_striker?.sixes ?? 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-black text-base text-[#2563EB] font-mono">
                    {liveData.current_striker?.runs ?? 0} ({liveData.current_striker?.balls ?? 0})
                  </span>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    SR: {liveData.current_striker?.strike_rate ?? '0.0'}
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
                    4s: {liveData.non_striker?.fours ?? 0} • 6s: {liveData.non_striker?.sixes ?? 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-[#0F172A] font-bold">
                    {liveData.non_striker?.runs ?? 0} ({liveData.non_striker?.balls ?? 0})
                  </span>
                  <span className="text-[10px] text-[#64748B] block font-mono">
                    SR: {liveData.non_striker?.strike_rate ?? '0.0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Bowler */}
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
                    {liveData.current_bowler ? `${liveData.current_bowler.wickets ?? 0}/${liveData.current_bowler.runs ?? 0}` : '0/0'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-white border border-[#CBD5E1]">
                    <span className="text-[10px] text-[#64748B] block font-bold">Overs</span>
                    <strong className="text-[#0F172A] font-mono">{liveData.current_bowler?.overs ?? '0.0'}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#CBD5E1]">
                    <span className="text-[10px] text-[#64748B] block font-bold">Maidens</span>
                    <strong className="text-[#0F172A] font-mono">{liveData.current_bowler?.maidens ?? 0}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#CBD5E1]">
                    <span className="text-[10px] text-[#64748B] block font-bold">Economy</span>
                    <strong className="text-[#0F172A] font-mono">{liveData.current_bowler?.economy ?? '0.00'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Over Tokens: Kis ball pe kitne run bane */}
          <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] flex flex-wrap items-center gap-3">
            <span className="text-xs font-black text-[#64748B] uppercase">This Over Balls:</span>
            <div className="flex items-center gap-2">
              {(liveData.recent_balls && liveData.recent_balls.length > 0 ? liveData.recent_balls : ['•']).map((token: string, idx: number) => (
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
              <span className="text-[#2563EB]">CRR: {liveData.current_rate ?? '0.00'}</span>
              <span className="text-[#64748B]">RRR: {liveData.required_rate ?? '—'}</span>
            </div>
          </div>

          {/* Live Commentary Feed */}
          <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-2">
            <h4 className="text-xs font-black text-[#1E3A8A] uppercase flex items-center gap-1.5">
              <span>Ball-by-Ball Live Commentary</span>
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
              {(liveData.commentary && liveData.commentary.length > 0 ? liveData.commentary : [
                liveData.status_text || 'Ball in-play. Live telemetry syncing...'
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
        <div className="flex flex-wrap items-center gap-3">
          {isLocked ? (
            <button
              disabled
              title="Match has started. Team creation is closed."
              className="px-4 py-2 rounded-xl text-xs font-black bg-[#F1F5F9] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed flex items-center gap-1.5 opacity-80"
            >
              <Lock className="w-4 h-4 text-[#94A3B8]" />
              <span>Squads Locked (Match In-Play)</span>
            </button>
          ) : (
            <button
              onClick={(e) => handleCreateXI(e, `/team-builder/${matchId}`)}
              className="prime-btn-3d text-xs !py-2 !px-4 font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Create My XI</span>
            </button>
          )}

          <Link
            href={`/match/${matchId}/leaderboard`}
            className="prime-btn-gold-3d text-xs !py-2 !px-4 font-black flex items-center gap-1.5"
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard & Teams</span>
          </Link>
        </div>
      </div>

      {/* VIEW 1: CONTESTS LIST */}
      {activeView === 'contests' && (
        <div className="space-y-4">
          {/* Sub tabs for contest types: Mega, Battleground, Mini */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Contests' },
              { id: 'mega', label: 'Mega Contest' },
              { id: 'battleground', label: 'Battleground' },
              { id: 'mini', label: 'Mini Contest' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedContestTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
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
                      <p className="mt-1 font-black text-sm text-[#16A34A]">🎉 In Rank #{t.rank || 1} Winning Position</p>
                    ) : (
                      <p className="mt-1 text-xs font-bold text-[#475569]">
                        {t.win_probability != null ? `Win probability: ${t.win_probability}%` : (t.note || 'Match is not live')}
                        {t.rank && <span className="text-[#2563EB]"> • Contest Rank #{t.rank}</span>}
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
                <p className="text-xs text-[#64748B] font-bold">Copy expert-curated lineups and deploy your winning XI instantly.</p>
              </div>
              {guruError && (
                <div className="pd-error"><AlertCircle className="w-4 h-4 shrink-0" /><span>{guruError}</span></div>
              )}
              {!guruLoaded ? (
                <p className="text-xs text-[#64748B] font-bold text-center py-6">Loading expert teams...</p>
              ) : guruTeams.length === 0 ? (
                <p className="text-xs text-[#64748B] font-bold text-center py-6">No expert teams available for this match yet.</p>
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

          {/* ─── PUBLIC CONTESTS GRID (Mega, Battleground, Mini) ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredContests.map((c: any) => {
              const isUnlimited = Boolean(c.is_unlimited || (c.total_spots || 0) >= 1000000 || String(c.title || '').toLowerCase().includes('prime mega arena'));
              const isCloneable = !isUnlimited && (c.type === 'multi_battlefield' || ['mini contest', 'mini emerald', 'prime quick play', 'royal battlefield arena', 'prime battlefield rush', 'amber battlefield blitz'].some(t => String(c.title || '').toLowerCase().includes(t)));
              const spotsLeft = isUnlimited ? 999999 : Math.max(0, (c.total_spots || 100) - (c.filled_spots || 0));
              const percentFilled = isUnlimited ? 0 : Math.min(100, Math.round(((c.filled_spots || 0) / (c.total_spots || 100)) * 100));
              const contestLocked = c.status !== 'open' || isLocked;
              // Unlimited or cloneable rooms NEVER show "Full" to user
              const contestFull = !isUnlimited && !isCloneable && spotsLeft === 0;

              const targetUrl = `/team-builder/${matchId}?contestId=${c.id}`;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!contestLocked && !contestFull) {
                      if (limitInfo.currentTeams >= limitInfo.maxTeams && limitInfo.maxTeams > 0) {
                        setShowLimitModal(true);
                      } else {
                        router.push(targetUrl);
                      }
                    }
                  }}
                  className={`contest-card-3d p-5 flex flex-col justify-between group transition-all ${
                    contestLocked || contestFull
                      ? 'cursor-not-allowed opacity-90'
                      : 'cursor-pointer hover:border-[#2563EB] hover:shadow-[0_0_24px_rgba(37,99,235,0.18)] hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    {/* High-Impact Highlighted Contest ID Header */}
                    <div className="flex items-center justify-between mb-3 bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-3.5 py-2.5 rounded-xl border-2 border-[#334155] shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] sm:text-xs font-black text-[#F59E0B] tracking-widest uppercase">CONTEST ID:</span>
                        <span className="px-2.5 py-0.5 rounded-md text-sm sm:text-base font-black font-mono bg-[#F59E0B] text-[#0F172A] tracking-wider shadow">
                          #{c.contest_code || 2011}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CategoryBadge category={match.category} size="xs" />
                        <span className="font-mono font-black text-[11px] sm:text-xs text-[#10B981] bg-[#064E3B]/80 px-2.5 py-0.5 rounded-lg border border-[#059669]/60 shadow-xs">
                          FREE (Pass)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-[#0F172A] text-base">{c.title?.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim()}</h4>
                      {c.type !== 'practice' && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                          <ShieldCheck className="w-3 h-3" /> Guaranteed
                        </span>
                      )}
                    </div>

                    {isUnlimited ? (
                      <div className="mt-4 py-2.5 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl flex items-center justify-between">
                        <span className="text-[#2563EB] font-black text-xs uppercase tracking-wider">Unlimited Spots</span>
                        <span className="text-[11px] font-mono font-bold text-slate-500">Open Arena</span>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#2563EB] font-black">{spotsLeft} spots left</span>
                          <span className="text-[#64748B]">{percentFilled}% filled • {c.total_spots} total</span>
                        </div>
                        <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden border border-[#CBD5E1]">
                          <div
                            className="h-full bg-gradient-to-r from-[#2563EB] via-[#38BDF8] to-[#0284C7] rounded-full transition-all"
                            style={{ width: `${percentFilled}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#E2E8F0] space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/match/${matchId}/leaderboard?contestId=${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-black text-[#2563EB] hover:text-[#1D4ED8] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer py-2 px-3 border-2 border-blue-100 rounded-xl hover:bg-blue-50 w-full"
                      >
                        <Users className="w-4 h-4 text-[#2563EB]" /> Live Contest Ranks & Teams ({c.filled_spots || 0})
                      </Link>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-[10px] text-[#64748B] font-bold">
                        {c.total_spots > 2 ? 'Up to 20 Teams' : 'Single Entry'}
                      </span>
                      {contestLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-600">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : contestFull ? (
                        <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                          Full
                        </span>
                      ) : (
                        <span className="text-xs font-black text-[#2563EB] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          <span>Enter Contest</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </div>
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

              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {(teamAPlayers.length > 0 ? teamAPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${match.team_a} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] hover:bg-white transition-all shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-[#BFDBFE] bg-[#EFF6FF] shrink-0">
                        <PlayerPhoto
                          name={p.name}
                          photoUrl={p.photo_url}
                          boxClass="w-full h-full text-xs text-[#1D4ED8] flex items-center justify-center font-bold"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[#0F172A] text-xs truncate block">{p.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-semibold">
                          <span className="font-bold text-[#1D4ED8]">{p.role}</span>
                          <span>•</span>
                          <span>Prev: <span className="font-bold text-[#2563EB]">{p.last_match_points || p.points || 0} pts</span></span>
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-[#D97706] shrink-0 px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A]">
                      {p.credits || 9.0} Cr
                    </span>
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

              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {(teamBPlayers.length > 0 ? teamBPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${match.team_b} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, idx: number) => (
                  <div key={p.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] hover:bg-white transition-all shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-[#FDE68A] bg-[#FEF3C7] shrink-0">
                        <PlayerPhoto
                          name={p.name}
                          photoUrl={p.photo_url}
                          boxClass="w-full h-full text-xs text-[#D97706] flex items-center justify-center font-bold"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[#0F172A] text-xs truncate block">{p.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-semibold">
                          <span className="font-bold text-[#D97706]">{p.role}</span>
                          <span>•</span>
                          <span>Prev: <span className="font-bold text-[#2563EB]">{p.last_match_points || p.points || 0} pts</span></span>
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-[#D97706] shrink-0 px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A]">
                      {p.credits || 9.0} Cr
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dream11-Style Guaranteed Prize Breakup Modal */}
      <PrizeBreakupModal
        isOpen={!!breakupContest}
        onClose={() => { setBreakupContest(null); setBreakupData(null); }}
        contest={breakupContest}
        breakupData={breakupData}
      />

      {/* Standard English Team Creation Limit Quota Modal */}
      <TeamLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        maxTeams={limitInfo.maxTeams}
        currentTeams={limitInfo.currentTeams}
        passName={limitInfo.passName}
        daysLeft={limitInfo.daysLeft}
        matchTitle={match?.title}
      />

    </div>
  );
}
