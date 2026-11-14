'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './lib/auth-context';
import { apiGet, resolveImageUrl } from './lib/api';
import {
  Trophy, Clock, Users, ArrowRight, Shield, Activity,
  Radio, Sparkles, ChevronRight, AlertCircle, Calendar, Zap, Bell
} from 'lucide-react';
import CategoryFilterTabs from './components/ui/CategoryFilterTabs';
import CategoryBadge from './components/ui/CategoryBadge';
import PrimeLogo from './components/ui/PrimeLogo';
import MatchPosterFrame from './components/ui/MatchPosterFrame';

function getLiveScoreText(match: any, side: 'team_a' | 'team_b') {
  const score = match.score_summary?.[side];
  if (!score) return 'Score unavailable';
  const isBatting = match.score_summary?.current_innings === side;
  const hasScore = Number(score.runs) > 0 || Number(score.wickets) > 0 || Number(score.overs) > 0;
  if (!hasScore && !isBatting) return 'Yet to bat';
  return `${Number(score.runs) || 0}/${Number(score.wickets) || 0}${score.declared ? 'd' : ''} (${Number(score.overs) || 0} ov)`;
}

function getLiveScoreSummary(match: any) {
  return `${getLiveScoreText(match, 'team_a')}  •  ${getLiveScoreText(match, 'team_b')}`;
}

function getDaysUntilMatch(startTimeStr: string) {
  if (!startTimeStr) return 0;
  return (new Date(startTimeStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

interface HomeClientProps {
  initialMatches?: any[];
}

export default function HomeClient({ initialMatches = [] }: HomeClientProps) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [matches, setMatches] = useState<any[]>(initialMatches);
  const [loading, setLoading] = useState<boolean>(initialMatches.length === 0);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  const toggleReminder = (e: React.MouseEvent, matchId: string, matchTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setReminders((prev) => {
      const next = !prev[matchId];
      setReminderToast(next ? `🔔 Reminder active for ${matchTitle} (30m before match)` : `Reminder removed`);
      setTimeout(() => setReminderToast(null), 3000);
      return { ...prev, [matchId]: next };
    });
  };

  // Fetch matches from API with category filter
  const fetchMatches = async () => {
    try {
      const url = selectedCategory === 'All'
        ? '/matches'
        : `/matches?category=${encodeURIComponent(selectedCategory)}`;
      const res = await apiGet(url);
      if (res?.matches) {
        setMatches(res.matches);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    // Auto-sync live scores every 10 seconds (§8, §12)
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, [selectedCategory]);

  // Session-only dismiss for personalized welcome banner (§3)
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      const dismissed = sessionStorage.getItem('prime_welcome_dismissed');
      if (dismissed === 'true') setBannerDismissed(true);
    }
  }, []);

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('prime_welcome_dismissed', 'true');
    }
  };

  // 1. Live, Upcoming & Coming Soon Matches (Optimized single-pass memoization)
  const { liveMatches, upcomingMatches, comingSoonMatches } = React.useMemo(() => {
    const now = Date.now();
    const live: any[] = [];
    const upcoming: any[] = [];
    const comingSoon: any[] = [];

    for (const m of matches) {
      if (m.status === 'completed') continue;
      const hasLiveScore = !!(
        (m.score_summary?.team_a?.overs > 0 || m.score_summary?.team_a?.runs > 0) ||
        (m.score_summary?.team_b?.overs > 0 || m.score_summary?.team_b?.runs > 0)
      );
      const startMs = m.start_time ? new Date(m.start_time).getTime() : 0;
      const startTimePassed = startMs > 0 && now >= startMs;

      if (m.status === 'live' || hasLiveScore || startTimePassed) {
        live.push(m);
      } else if (m.status === 'upcoming') {
        const diffDays = (startMs - now) / (1000 * 60 * 60 * 24);
        if (diffDays <= 6) {
          upcoming.push(m);
        } else {
          comingSoon.push(m);
        }
      }
    }
    return { liveMatches: live, upcomingMatches: upcoming, comingSoonMatches: comingSoon };
  }, [matches]);

  // Featured Hero Match (either first live match or first upcoming match)
  const heroMatch = liveMatches[0] || upcomingMatches[0] || matches[0];

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 bg-transparent text-[#0F172A]">
      {/* Personalized Welcome Banner (§3: 3D Golden Liquid Glass) */}
      {!bannerDismissed && (
        <div className="relative rounded-2xl prime-card-shiny-gold p-4 sm:p-5 flex items-center justify-between border-2 border-[#F59E0B] shadow-[0_10px_25px_rgba(245,158,11,0.18)]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(37,99,235,0.4)] border-2 border-white">
              <span className="text-2xl drop-shadow-md">🏏</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black text-[#0F172A] flex items-center gap-2">
                <span>Welcome back, <span className="text-[#2563EB]">{user?.name || user?.username || 'Champion'}</span>! 🏏</span>
                <span className="hidden sm:inline px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#2563EB] text-white border border-[#93C5FD] shadow-sm">
                  PRIME VIP
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] font-semibold mt-0.5">
                Ready to build your winning cricket fantasy XI &amp; conquer the Grand Colosseum?
              </p>
            </div>
          </div>
          <button
            onClick={handleDismissBanner}
            className="text-[#64748B] hover:text-[#0F172A] p-2 text-sm shrink-0 ml-2 rounded-lg hover:bg-black/5 transition"
            title="Dismiss for this session"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Grand Match Showcase (3D Elevated Bluish-White Crystal Feature) */}
      {heroMatch && (
        <div className="relative w-full rounded-3xl bg-gradient-to-br from-white via-[#F0F6FD] to-[#E2EEFC] border-2 border-[#94A3B8] hover:border-[#2563EB] overflow-hidden shadow-[0_15px_40px_rgba(30,58,138,0.12)] transition-all duration-300 text-[#0F172A]">
          {/* Match Poster Backdrop if available */}
          {resolveImageUrl(heroMatch.match_poster) && (
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
              <img
                src={resolveImageUrl(heroMatch.match_poster)}
                alt="Match Poster"
                className="w-full h-full object-cover scale-105"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/70" />
            </div>
          )}

          {/* Spotlight Ambient Beams */}
          <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full bg-blue-400/15 blur-[120px] pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 w-[420px] h-[420px] rounded-full bg-sky-300/20 blur-[120px] pointer-events-none" />

          {/* Top Glass Specular Line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 items-center">
            {/* Left Match Narrative & Telemetry */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {heroMatch.status === 'live' ? (
                  <span className="neon-badge-red px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                    LIVE MATCH ARENA
                  </span>
                ) : (
                  <span className="neon-badge-gold px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-white text-white" />
                    FEATURED MEGA MATCH
                  </span>
                )}
                <CategoryBadge category={heroMatch.category} size="sm" />
                <span className="bg-white/80 text-[#334155] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-[#CBD5E1] shadow-sm">
                  📍 {heroMatch.venue || 'International Cricket Stadium'}
                </span>
              </div>

              <div>
                <span className="pd-eyebrow block text-[#64748B]">
                  {heroMatch.status === 'live' ? 'Current Live Score' : 'Guaranteed Colosseum Prize Pool'}
                </span>
                <h1 className="pd-num text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#0284C7] drop-shadow-sm tracking-tight font-['Montserrat',sans-serif]">
                  {heroMatch.status === 'live'
                    ? getLiveScoreSummary(heroMatch)
                    : `₹${heroMatch.total_prize_pool > 0 ? heroMatch.total_prize_pool.toLocaleString('en-IN') : '50,00,000'} MEGA ARENA`}
                </h1>
                <p className="pd-num text-xs sm:text-sm text-[#475569] font-bold mt-1">
                  {heroMatch.status === 'live'
                    ? heroMatch.live_data?.status_text || 'Live status confirmed by the score feed.'
                    : '1st Prize ₹15,00,000 Guaranteed • Instant UTR/UPI Bank Payouts • 0% Fair-Play Certified'}
                </p>
              </div>

              {/* 3D Teams Face-Off Card Ribbon */}
              <div className="grid grid-cols-7 items-center bg-white/90 rounded-2xl p-4 sm:p-5 border-2 border-[#CBD5E1] shadow-[0_4px_12px_rgba(30,58,138,0.06)]">
                {/* Team A */}
                <div className="col-span-3 flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-[#EF4444] to-[#B91C1C] flex items-center justify-center shadow-[0_4px_14px_rgba(239,68,68,0.4)] font-black text-lg text-white font-['Montserrat'] shrink-0 border-2 border-white overflow-hidden">
                    {resolveImageUrl(heroMatch.team_a_logo) && heroMatch.team_a_logo !== '/cricket/team_a.png' ? (
                      <img src={resolveImageUrl(heroMatch.team_a_logo)} alt={heroMatch.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = heroMatch.team_a_code || heroMatch.team_a?.slice(0, 3).toUpperCase(); }} />
                    ) : (heroMatch.team_a_code || heroMatch.team_a?.slice(0, 3).toUpperCase())}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-base text-[#0F172A] truncate drop-shadow-sm">{heroMatch.team_a}</span>
                    <span className="text-[10px] sm:text-xs text-emerald-600 font-extrabold flex items-center gap-1 min-w-0 max-w-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{heroMatch.status === 'live' ? getLiveScoreText(heroMatch, 'team_a') : 'Form: W • W • L • W'}</span>
                    </span>
                  </div>
                </div>

                {/* VS Badge & Lock Countdown */}
                <div className="col-span-1 min-w-0 flex flex-col items-center justify-center text-center">
                  <span className="font-black text-base text-[#2563EB] italic">VS</span>
                  <div className="bg-[#E0F2FE] px-1.5 py-0.5 rounded-full text-[#0369A1] text-[9px] font-black mt-1 border border-[#38BDF8] shadow-sm leading-tight max-w-full">
                    {heroMatch.status === 'live' ? 'LIVE NOW' : `${heroMatch.match_date}`}
                  </div>
                </div>

                {/* Team B */}
                <div className="col-span-3 flex items-center justify-end gap-2 sm:gap-3 text-right min-w-0">
                  <div className="flex flex-col min-w-0 items-end">
                    <span className="font-black text-base text-[#0F172A] truncate drop-shadow-sm">{heroMatch.team_b}</span>
                    <span className="text-[10px] sm:text-xs text-emerald-600 font-extrabold flex items-center gap-1 min-w-0 max-w-full">
                      <span className="truncate">{heroMatch.status === 'live' ? getLiveScoreText(heroMatch, 'team_b') : 'Form: W • W • W • L'}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] flex items-center justify-center shadow-[0_4px_14px_rgba(245,158,11,0.4)] font-black text-lg text-white font-['Montserrat'] shrink-0 border-2 border-white overflow-hidden">
                    {resolveImageUrl(heroMatch.team_b_logo) && heroMatch.team_b_logo !== '/cricket/team_b.png' ? (
                      <img src={resolveImageUrl(heroMatch.team_b_logo)} alt={heroMatch.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = heroMatch.team_b_code || heroMatch.team_b?.slice(0, 3).toUpperCase(); }} />
                    ) : (heroMatch.team_b_code || heroMatch.team_b?.slice(0, 3).toUpperCase())}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Action Card & Prize Structure Column (3D Distinct Border Box) */}
            <div className="lg:col-span-5 flex flex-col justify-between h-full prime-card-3d p-6 space-y-5 border-2 border-[#94A3B8]">
              {heroMatch.status === 'live' ? (
                <>
                  <div>
                    <span className="pd-eyebrow block text-[#64748B]">Live match status</span>
                    <h3 className="text-lg font-black text-[#0F172A] mt-1">{heroMatch.live_data?.status_text || 'Live score syncing'}</h3>
                    <p className="text-xs text-[#64748B] mt-3">
                      Source: {heroMatch.live_data?.source || 'Cricbuzz'}
                      {heroMatch.last_live_poll_at ? ` · Updated ${Math.max(0, Math.round((Date.now() - new Date(heroMatch.last_live_poll_at).getTime()) / 1000))}s ago` : ''}
                    </p>
                  </div>
                  <Link href={`/match/${heroMatch.id}`} className="prime-btn-3d text-center text-xs font-black uppercase tracking-wider">
                    <span>View Live Score</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              ) : (
                <>
              <div className="flex items-start justify-between">
                <div>
                  <span className="pd-eyebrow block text-[#64748B]">
                    Colosseum Championship
                  </span>
                  <h3 className="text-lg font-black text-[#0F172A] mt-1">Mega Grand Entry Pass</h3>
                </div>
                <div className="text-right">
                  <span className="pd-num text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#F59E0B] to-[#B45309] drop-shadow-sm font-mono">
                    {heroMatch.min_entry_fee > 0 ? `₹${heroMatch.min_entry_fee}` : '₹49'}
                  </span>
                  <span className="text-[10px] text-[#64748B] font-bold block uppercase">Entry Fee</span>
                </div>
              </div>

              {/* Spots Fill Meter (3D Tube) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-[#DC2626] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
                    2,450 Spots Left
                  </span>
                  <span className="text-[#64748B]">Max 20 Teams</span>
                </div>
                <div className="w-full h-3 bg-[#E2E8F0] rounded-full overflow-hidden p-0.5 border border-[#CBD5E1] shadow-inner">
                  <div className="h-full bg-gradient-to-r from-[#3B82F6] via-[#0EA5E9] to-[#06B6D4] rounded-full shadow-sm" style={{ width: '84%' }} />
                </div>
              </div>

              {/* 3D Tactile Water Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Link
                  href={`/team-builder/${heroMatch.id}`}
                  className="prime-btn-dark-3d text-center text-xs font-black uppercase tracking-wider"
                >
                  <Users className="w-4 h-4 text-[#2563EB]" />
                  <span>Create Team</span>
                </Link>

                <Link
                  href={`/match/${heroMatch.id}`}
                  className="prime-btn-3d text-center text-xs font-black uppercase tracking-wider"
                >
                  <span>Join Contests</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 5.4: User-Side Category Filter Tabs (3D Buttons) */}
      <div className="space-y-3 pt-2">
        <CategoryFilterTabs
          selectedCategory={selectedCategory}
          onSelect={(cat) => setSelectedCategory(cat)}
        />
      </div>

      {/* Floating Reminder Toast Banner */}
      {reminderToast && (
        <div className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-slate-900 text-white border border-amber-400 text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
          <span>{reminderToast}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. 🔴 LIVE MATCHES (SABSE PEHLE) */}
      {/* ======================================================== */}
      {liveMatches.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-black text-[#0F172A] uppercase tracking-wider flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-ping" />
              <span className="text-[#EF4444]">Live Cricket Arena</span>
              <span className="text-xs text-white font-black bg-[#2563EB] px-3 py-1 rounded-full border border-[#93C5FD] shadow-sm">
                {liveMatches.length} In-Play · ↔ Swipe
              </span>
            </h3>
            <span className="text-xs text-emerald-700 font-mono font-black flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
              10s Live Sync
            </span>
          </div>

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 touch-pan-x">
            {liveMatches.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="prime-card-3d min-w-[270px] max-w-[300px] shrink-0 snap-start p-3 flex flex-col justify-between group border border-emerald-300 shadow-[0_0_22px_rgba(34,197,94,0.20)] hover:border-emerald-500 hover:shadow-[0_0_28px_rgba(34,197,94,0.34)]"
              >
                <div>
                  {/* Match Poster Frame — Always Prominently Visible */}
                  <MatchPosterFrame
                    poster={m.match_poster}
                    title={m.title || `${m.team_a} vs ${m.team_b}`}
                    category={m.category}
                    venue={m.venue || m.title || 'Live Match Arena'}
                    topRightBadge={
                      <span className="neon-badge-red px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        LIVE
                      </span>
                    }
                    heightClass="h-32 sm:h-36 mb-2.5"
                  />

                  {/* Team A vs Team B Clash */}
                  <div className="grid grid-cols-7 items-center py-1 px-0.5">
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#EF4444] to-[#B91C1C] border border-white flex items-center justify-center font-black text-[11px] text-white shadow-xs overflow-hidden shrink-0">
                        {resolveImageUrl(m.team_a_logo) && m.team_a_logo !== '/cricket/team_a.png' ? (
                          <img src={resolveImageUrl(m.team_a_logo)} alt={m.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (m.team_a_code || m.team_a?.slice(0, 3).toUpperCase())}
                      </div>
                      <span className="text-xs font-black text-[#0F172A] truncate">{m.team_a}</span>
                    </div>

                    <div className="col-span-1 text-center font-black text-xs text-[#2563EB] italic">
                      VS
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2 text-right min-w-0">
                      <span className="text-xs font-black text-[#0F172A] truncate">{m.team_b}</span>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#F59E0B] to-[#D97706] border border-white flex items-center justify-center font-black text-[11px] text-white shadow-xs overflow-hidden shrink-0">
                        {resolveImageUrl(m.team_b_logo) && m.team_b_logo !== '/cricket/team_b.png' ? (
                          <img src={resolveImageUrl(m.team_b_logo)} alt={m.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (m.team_b_code || m.team_b?.slice(0, 3).toUpperCase())}
                      </div>
                    </div>
                  </div>

                  {/* Compact Live Score at the Bottom */}
                  <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2 mt-2 space-y-1 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span className="font-black text-[#1D4ED8] truncate">
                          {getLiveScoreText(m, 'team_a')}
                        </span>
                      </div>
                      <span className="font-bold text-[#64748B] shrink-0 text-right">
                        {getLiveScoreText(m, 'team_b')}
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-[#64748B] truncate leading-tight">
                      {m.live_data?.status_text || 'Live score syncing'}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#E2E8F0] mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748B]">
                    {m.contests_count ? `🏆 ${m.contests_count} Contests` : `Score: Cricbuzz`}
                  </span>
                  <span className="prime-btn-3d !py-1.5 !px-3 !text-xs group-hover:scale-105">
                    <span>View Live Score</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ⚡ UPCOMING MATCHES (Starting within next 6 days) */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-black text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
            <span className="text-[#2563EB]">⚡ Upcoming Matches</span>
            <span className="text-xs text-[#64748B] font-bold">(Next 6 Days)</span>
          </h3>
          <span className="text-xs font-black text-[#334155] px-3 py-1 rounded-full bg-white border border-[#CBD5E1] shadow-sm flex items-center gap-2">
            {upcomingMatches.length} Matches <span aria-hidden="true">↔ Swipe</span>
          </span>
        </div>

        {loading ? (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 touch-pan-x">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 min-w-[270px] max-w-[300px] shrink-0 snap-start rounded-2xl bg-white/70 animate-pulse border-2 border-[#CBD5E1]" />
            ))}
          </div>
        ) : upcomingMatches.length === 0 ? (
          <div className="p-8 rounded-2xl prime-card-3d text-center text-[#64748B] font-bold">
            No upcoming matches in this category for the next 6 days.
          </div>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 touch-pan-x">
            {upcomingMatches.map((m) => (
              <div
                key={m.id}
                className="prime-card-3d min-w-[270px] max-w-[300px] shrink-0 snap-start p-3 flex flex-col justify-between group border border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.16)] hover:border-amber-500 hover:shadow-[0_0_24px_rgba(245,158,11,0.28)]"
              >
                <div>
                  {/* Match Poster Frame — Always Prominently Visible */}
                  <MatchPosterFrame
                    poster={m.match_poster}
                    title={m.title || `${m.team_a} vs ${m.team_b}`}
                    category={m.category}
                    venue={m.venue || m.title || 'Stadium'}
                    topRightBadge={
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => toggleReminder(e, m.id, `${m.team_a} vs ${m.team_b}`)}
                          className={`p-1.5 rounded-lg backdrop-blur-md transition cursor-pointer ${
                            reminders[m.id]
                              ? 'bg-amber-400 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                              : 'bg-black/50 text-white hover:bg-black/75'
                          }`}
                          title={reminders[m.id] ? 'Reminder active' : 'Set match reminder'}
                        >
                          <Bell className="w-3 h-3" />
                        </button>
                        <span className="bg-[#E0F2FE]/95 backdrop-blur-xs text-[#0369A1] text-[10px] font-black px-2 py-0.5 rounded-lg border border-[#BAE6FD] flex items-center gap-1 shadow-md">
                          <Clock className="w-3 h-3 text-[#2563EB]" />
                          {m.match_time}
                        </span>
                      </div>
                    }
                    heightClass="h-32 sm:h-36 mb-2.5"
                  />

                  {/* Team A vs Team B Head-to-Head */}
                  <div className="grid grid-cols-7 items-center py-1.5 px-0.5">
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#EF4444] to-[#B91C1C] border border-white flex items-center justify-center font-black text-[11px] text-white shadow-xs overflow-hidden shrink-0">
                        {resolveImageUrl(m.team_a_logo) && m.team_a_logo !== '/cricket/team_a.png' ? (
                          <img src={resolveImageUrl(m.team_a_logo)} alt={m.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (m.team_a_code || m.team_a?.slice(0, 3).toUpperCase())}
                      </div>
                      <span className="text-xs font-black text-[#0F172A] truncate">{m.team_a}</span>
                    </div>

                    <div className="col-span-1 text-center font-black text-xs text-[#2563EB] italic">
                      VS
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2 text-right min-w-0">
                      <span className="text-xs font-black text-[#0F172A] truncate">{m.team_b}</span>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#F59E0B] to-[#D97706] border border-white flex items-center justify-center font-black text-[11px] text-white shadow-xs overflow-hidden shrink-0">
                        {resolveImageUrl(m.team_b_logo) && m.team_b_logo !== '/cricket/team_b.png' ? (
                          <img src={resolveImageUrl(m.team_b_logo)} alt={m.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (m.team_b_code || m.team_b?.slice(0, 3).toUpperCase())}
                      </div>
                    </div>
                  </div>
                </div>

                  <div className="pt-2.5 border-t border-[#E2E8F0] mt-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#64748B] block text-[9px] font-bold uppercase">Prize Pool</span>
                      <span className="font-black text-[#D97706] text-xs sm:text-sm font-mono">
                        ₹{m.total_prize_pool > 0 ? m.total_prize_pool.toLocaleString('en-IN') : '10,00,000'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/team-builder/${m.id}`}
                        className="prime-btn-dark-3d !py-1.5 !px-2.5 !text-xs font-black"
                      >
                        XI
                      </Link>
                      <Link href={`/match/${m.id}`} className="prime-btn-3d !py-1.5 !px-3 !text-xs font-black uppercase tracking-wider">
                        Join
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. 📅 COMING SOON MATCHES (>6 Days out) */}
      {/* ======================================================== */}
      {comingSoonMatches.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#CBD5E1]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-black text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2563EB]" />
              <span className="text-[#0F172A]">Coming Soon</span>
              <span className="text-xs text-[#64748B] font-bold">(Scheduled &gt; 6 Days)</span>
            </h3>
            <span className="text-xs font-black text-[#334155] px-3 py-1 rounded-full bg-white border border-[#CBD5E1] shadow-sm flex items-center gap-2">
              {comingSoonMatches.length} Matches <span aria-hidden="true">↔ Swipe</span>
            </span>
          </div>

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 touch-pan-x">
            {comingSoonMatches.map((m) => (
              <div
                key={m.id}
                className="prime-card-3d min-w-[270px] max-w-[300px] shrink-0 snap-start p-3 flex flex-col justify-between space-y-2.5 border border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.16)] hover:border-amber-500 hover:shadow-[0_0_24px_rgba(245,158,11,0.28)]"
              >
                <div>
                  {/* Match Poster Frame — Always Prominently Visible */}
                  <MatchPosterFrame
                    poster={m.match_poster}
                    title={m.title}
                    category={m.category}
                    venue={m.venue || m.title || 'Stadium'}
                    topRightBadge={
                      <span className="bg-[#E0F2FE]/95 backdrop-blur-xs text-[#0369A1] text-[10px] font-black px-2 py-0.5 rounded-lg border border-[#BAE6FD]">
                        Starts in {Math.round(getDaysUntilMatch(m.start_time))} Days
                      </span>
                    }
                    heightClass="h-32 sm:h-36 mb-2.5"
                  />

                  <div className="flex items-center justify-between py-1.5 px-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#EF4444] to-[#B91C1C] border border-white flex items-center justify-center font-black text-[11px] text-white overflow-hidden shrink-0">
                        {resolveImageUrl(m.team_a_logo) ? (
                          <img src={resolveImageUrl(m.team_a_logo)} alt={m.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (m.team_a_code || m.team_a?.slice(0, 3).toUpperCase())}
                      </div>
                      <span className="text-xs font-black text-[#0F172A] truncate">{m.team_a}</span>
                    </div>

                    <span className="text-xs font-black text-[#2563EB] px-1 italic">VS</span>

                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <span className="text-xs font-black text-[#0F172A] truncate text-right">{m.team_b}</span>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#F59E0B] to-[#D97706] border border-white flex items-center justify-center font-black text-[11px] text-white overflow-hidden shrink-0">
                        {resolveImageUrl(m.team_b_logo) ? (
                          <img src={resolveImageUrl(m.team_b_logo)} alt={m.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (m.team_b_code || m.team_b?.slice(0, 3).toUpperCase())}
                      </div>
                    </div>
                  </div>
                </div>

                  <div className="pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-bold text-[11px]">
                      📅 {m.match_date} • ⏰ {m.match_time}
                    </span>
                    <Link
                      href={`/match/${m.id}`}
                      className="text-[#2563EB] font-black hover:underline flex items-center gap-1 group text-xs"
                    >
                      <span>Preview</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
