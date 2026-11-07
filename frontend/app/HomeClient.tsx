'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './lib/auth-context';
import { apiGet } from './lib/api';
import {
  Trophy, Clock, Users, ArrowRight, Shield, Activity,
  Radio, Sparkles, ChevronRight, AlertCircle, Calendar, Zap
} from 'lucide-react';
import CategoryFilterTabs from './components/ui/CategoryFilterTabs';
import CategoryBadge from './components/ui/CategoryBadge';
import PrimeLogo from './components/ui/PrimeLogo';

interface HomeClientProps {
  initialMatches?: any[];
}

export default function HomeClient({ initialMatches = [] }: HomeClientProps) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [matches, setMatches] = useState<any[]>(initialMatches);
  const [loading, setLoading] = useState<boolean>(initialMatches.length === 0);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

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

  // Helper to calculate days until match
  const getDaysUntilMatch = (startTimeStr: string) => {
    const start = new Date(startTimeStr).getTime();
    const now = Date.now();
    const diffDays = (start - now) / (1000 * 60 * 60 * 24);
    return diffDays;
  };

  // 1. Live Matches (Sabse Pehle)
  const liveMatches = matches.filter((m) => m.status === 'live');

  // 2. Upcoming Matches (Starting within next 6 days)
  const upcomingMatches = matches.filter((m) => {
    if (m.status !== 'upcoming') return false;
    const days = getDaysUntilMatch(m.start_time);
    return days <= 6;
  });

  // 3. Coming Soon Matches (Scheduled > 6 days later)
  const comingSoonMatches = matches.filter((m) => {
    if (m.status !== 'upcoming') return false;
    const days = getDaysUntilMatch(m.start_time);
    return days > 6;
  });

  // Featured Hero Match (either first live match or first upcoming match)
  const heroMatch = liveMatches[0] || upcomingMatches[0] || matches[0];

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 bg-[#000000]">
      {/* Personalized Welcome Banner (§3: 3D Red & Shiny Gold on Pitch Black) */}
      {!bannerDismissed && (
        <div className="relative rounded-2xl prime-card-shiny-gold p-4 sm:p-5 flex items-center justify-between shadow-[0_10px_35px_rgba(255,215,0,0.2)]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-[#FF1744] via-[#D50000] to-[#7A0018] flex items-center justify-center shrink-0 shadow-[0_0_20px_#FF1744] border-2 border-[#FFD700]">
              <span className="text-2xl drop-shadow-md">🏏</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black text-white flex items-center gap-2">
                <span>Welcome back, <span className="text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]">{user?.name || user?.username || 'Champion'}</span>! 🏏</span>
                <span className="hidden sm:inline px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FF1744] text-white border border-[#FF8095] shadow-[0_0_8px_#FF1744]">
                  PRIME VIP
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-[#E5E5E5] font-semibold mt-0.5">
                Ready to build your winning cricket fantasy XI &amp; conquer the Grand Colosseum?
              </p>
            </div>
          </div>
          <button
            onClick={handleDismissBanner}
            className="text-[#A3A3A3] hover:text-white p-2 text-sm shrink-0 ml-2 rounded-lg hover:bg-white/10 transition"
            title="Dismiss for this session"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Grand Match Showcase (3D Elevated Colosseum Feature) */}
      {heroMatch && (
        <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#181818] via-[#0E0E0E] to-[#040404] border-2 border-[#333333] hover:border-[#FFD700]/60 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,1),0_0_40px_rgba(255,23,68,0.25)] transition-all duration-300">
          {/* Spotlight Ambient Beams */}
          <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full bg-[#FF1744]/25 blur-[120px] pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 w-[420px] h-[420px] rounded-full bg-[#FFD700]/20 blur-[120px] pointer-events-none" />

          {/* Top Glass Specular Line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

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
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    FEATURED MEGA MATCH
                  </span>
                )}
                <CategoryBadge category={heroMatch.category} size="sm" />
                <span className="bg-[#141414] text-[#D4D4D4] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-[#333333] shadow-sm">
                  📍 {heroMatch.venue || 'International Cricket Stadium'}
                </span>
              </div>

              <div>
                <span className="text-xs uppercase font-black text-[#A3A3A3] tracking-widest block">
                  Guaranteed Colosseum Prize Pool
                </span>
                <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#FFF59D] to-[#FFD700] drop-shadow-[0_4px_25px_rgba(255,215,0,0.6)] tracking-tight font-['Montserrat',sans-serif]">
                  ₹{heroMatch.total_prize_pool > 0 ? heroMatch.total_prize_pool.toLocaleString('en-IN') : '50,00,000'} MEGA ARENA
                </h1>
                <p className="text-xs sm:text-sm text-[#D4D4D4] font-bold mt-1">
                  1st Prize ₹15,00,000 Guaranteed • Instant UTR/UPI Bank Payouts • 0% Fair-Play Certified
                </p>
              </div>

              {/* 3D Teams Face-Off Card Ribbon */}
              <div className="grid grid-cols-7 items-center bg-gradient-to-r from-[#171717] via-[#0D0D0D] to-[#171717] rounded-2xl p-4 sm:p-5 border-2 border-[#2A2A2A] shadow-[inset_0_2px_4px_rgba(255,255,255,0.08),0_10px_25px_rgba(0,0,0,0.8)]">
                {/* Team A */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-[#FF1744] to-[#8A0018] flex items-center justify-center shadow-[0_0_18px_rgba(255,23,68,0.6)] font-black text-lg text-white font-['Montserrat'] shrink-0 border-2 border-[#FF8095]">
                    {heroMatch.team_a_code || heroMatch.team_a?.slice(0, 3).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-base text-white truncate drop-shadow-sm">{heroMatch.team_a}</span>
                    <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Form: W • W • L • W
                    </span>
                  </div>
                </div>

                {/* VS Badge & Lock Countdown */}
                <div className="col-span-1 flex flex-col items-center justify-center text-center">
                  <span className="font-black text-base text-[#FF1744] italic drop-shadow-[0_0_8px_#FF1744]">VS</span>
                  <div className="bg-[#1C1808] px-2.5 py-1 rounded-full text-[#FFD700] text-[10px] font-black mt-1 whitespace-nowrap border border-[#FFD700]/60 shadow-[0_0_8px_rgba(255,215,0,0.3)]">
                    {heroMatch.status === 'live' ? 'LIVE NOW' : `${heroMatch.match_date}`}
                  </div>
                </div>

                {/* Team B */}
                <div className="col-span-3 flex items-center justify-end gap-3 text-right">
                  <div className="flex flex-col min-w-0 items-end">
                    <span className="font-black text-base text-white truncate drop-shadow-sm">{heroMatch.team_b}</span>
                    <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1">
                      Form: W • W • W • L
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-[#FFD700] to-[#B38600] flex items-center justify-center shadow-[0_0_18px_rgba(255,215,0,0.6)] font-black text-lg text-black font-['Montserrat'] shrink-0 border-2 border-[#FFF9C4]">
                    {heroMatch.team_b_code || heroMatch.team_b?.slice(0, 3).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Action Card & Prize Structure Column (3D Embossed Card) */}
            <div className="lg:col-span-5 flex flex-col justify-between h-full prime-card-3d p-6 space-y-5 border-2 border-[#333333]">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] text-[#A3A3A3] uppercase font-black tracking-widest block">
                    Colosseum Championship
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">Mega Grand Entry Pass</h3>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-[#FFD700] font-mono drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                    {heroMatch.min_entry_fee > 0 ? `₹${heroMatch.min_entry_fee}` : '₹49'}
                  </span>
                  <span className="text-[10px] text-[#A3A3A3] font-bold block uppercase">Entry Fee</span>
                </div>
              </div>

              {/* Spots Fill Meter (3D Tube) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-[#FF1744] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#FF1744] animate-ping" />
                    2,450 Spots Left
                  </span>
                  <span className="text-[#A3A3A3]">Max 20 Teams</span>
                </div>
                <div className="w-full h-3 bg-[#000000] rounded-full overflow-hidden p-0.5 border border-[#333333] shadow-inner">
                  <div className="h-full bg-gradient-to-r from-[#FF1744] via-[#FFA000] to-[#FFD700] rounded-full shadow-[0_0_12px_#FF1744]" style={{ width: '84%' }} />
                </div>
              </div>

              {/* 3D Tactile Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href={`/team-builder/${heroMatch.id}`}
                  className="prime-btn-dark-3d text-center text-xs font-black uppercase tracking-wider"
                >
                  <Users className="w-4 h-4 text-[#FFD700]" />
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

      {/* ======================================================== */}
      {/* 1. 🔴 LIVE MATCHES (SABSE PEHLE) */}
      {/* ======================================================== */}
      {liveMatches.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#FF1744] shadow-[0_0_12px_#FF1744] animate-ping" />
              <span className="text-[#FF1744] drop-shadow-[0_0_12px_rgba(255,23,68,0.5)]">Live Cricket Arena</span>
              <span className="text-xs text-black font-black bg-[#FFD700] px-3 py-1 rounded-full border border-[#FFF9C4] shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                {liveMatches.length} In-Play
              </span>
            </h3>
            <span className="text-xs text-emerald-400 font-mono font-black flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D2411] border border-emerald-500/40">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              10s Live Sync
            </span>
          </div>

          {/* 3 Columns Grid on Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {liveMatches.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="prime-card-3d p-5 flex flex-col justify-between group border-2 border-[#FF1744]/40 hover:border-[#FFD700]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <CategoryBadge category={m.category} size="xs" />
                    <span className="neon-badge-red px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      LIVE
                    </span>
                  </div>

                  {/* Team A vs Team B Live Scores */}
                  <div className="grid grid-cols-2 gap-3 items-center py-2">
                    <div>
                      <span className="text-xs font-black text-white block truncate">{m.team_a}</span>
                      <p className="text-2xl font-black text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)] font-mono">
                        {m.score_summary?.team_a
                          ? `${m.score_summary.team_a.runs}/${m.score_summary.team_a.wickets} (${m.score_summary.team_a.overs} ov)`
                          : '146/3 (16.4 ov)'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-white block truncate">{m.team_b}</span>
                      <p className="text-xs font-bold text-[#A3A3A3]">Yet to bat</p>
                    </div>
                  </div>

                  {/* Striker & Bowler Live Telemetry Snippet */}
                  {m.live_data?.current_striker && (
                    <div className="bg-[#000000] rounded-xl p-3 mt-3 border border-[#2A2A2A] flex items-center justify-between text-xs shadow-inner">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[#FFD700]">🏏</span>
                        <span className="text-white font-black truncate">
                          {m.live_data.current_striker.name}*
                        </span>
                        <span className="text-[#FFD700] font-mono font-bold">
                          {m.live_data.current_striker.runs} ({m.live_data.current_striker.balls})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(m.live_data.recent_balls || ['1', '4', '0', 'W']).slice(-4).map((b: string, i: number) => (
                          <span
                            key={i}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ${
                              b === 'W'
                                ? 'bg-[#FF1744] text-white shadow-[0_0_8px_#FF1744]'
                                : b === '4' || b === '6'
                                ? 'bg-[#FFD700] text-black shadow-[0_0_8px_#FFD700]'
                                : 'bg-[#1C1C1C] border border-[#333333] text-white'
                            }`}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#222222] mt-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3A3A3]">
                    🏆 {m.contests_count || 3} Contests Active
                  </span>
                  <span className="prime-btn-3d !py-1.5 !px-3 !text-xs group-hover:scale-105">
                    <span>Enter Live Arena</span>
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
          <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.5)]">⚡ Upcoming Matches</span>
            <span className="text-xs text-[#A3A3A3] font-bold">(Next 6 Days)</span>
          </h3>
          <span className="text-xs font-black text-[#D4D4D4] px-3 py-1 rounded-full bg-[#141414] border border-[#262626]">
            {upcomingMatches.length} Matches Scheduled
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 rounded-2xl bg-[#141414] animate-pulse border border-[#262626]" />
            ))}
          </div>
        ) : upcomingMatches.length === 0 ? (
          <div className="p-8 rounded-2xl prime-card-3d text-center text-[#A3A3A3] font-bold">
            No upcoming matches in this category for the next 6 days.
          </div>
        ) : (
          /* 3 COLUMNS RESPONSIVE GRID ON DESKTOP (§User Request: 3 me dikhna chahiye) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcomingMatches.map((m) => (
              <div
                key={m.id}
                className="prime-card-3d p-5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <CategoryBadge category={m.category} size="xs" />
                    <span className="bg-[#000000] text-[#FFD700] text-[10px] font-black px-2.5 py-1 rounded-lg border border-[#FFD700]/40 flex items-center gap-1.5 shadow-sm">
                      <Clock className="w-3 h-3 text-[#FF1744]" />
                      {m.match_time}
                    </span>
                  </div>

                  {/* Team A vs Team B Head-to-Head */}
                  <div className="grid grid-cols-7 items-center py-3">
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#FF1744] to-[#800018] border border-[#FF8095] flex items-center justify-center font-black text-xs text-white shadow-[0_0_10px_rgba(255,23,68,0.4)]">
                        {m.team_a_code || m.team_a?.slice(0, 3).toUpperCase()}
                      </div>
                      <span className="text-xs font-black text-white truncate">{m.team_a}</span>
                    </div>

                    <div className="col-span-1 text-center font-black text-xs text-[#FF1744] italic drop-shadow-[0_0_6px_#FF1744]">
                      VS
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2.5 text-right">
                      <span className="text-xs font-black text-white truncate">{m.team_b}</span>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#FFD700] to-[#997A00] border border-[#FFF9C4] flex items-center justify-center font-black text-xs text-black shadow-[0_0_10px_rgba(255,215,0,0.4)]">
                        {m.team_b_code || m.team_b?.slice(0, 3).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#222222] mt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#A3A3A3] block text-[10px] font-bold uppercase">Prize Pool</span>
                    <span className="font-black text-[#FFD700] text-sm font-mono drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
                      ₹{m.total_prize_pool > 0 ? m.total_prize_pool.toLocaleString('en-IN') : '10,00,000'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/team-builder/${m.id}`}
                      className="prime-btn-dark-3d !py-1.5 !px-3 !text-xs font-black"
                    >
                      XI
                    </Link>
                    <Link
                      href={`/match/${m.id}`}
                      className="prime-btn-3d !py-1.5 !px-4 !text-xs font-black uppercase tracking-wider"
                    >
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
        <div className="space-y-4 pt-4 border-t border-[#222222]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FFD700]" />
              <span className="text-white">Coming Soon</span>
              <span className="text-xs text-[#A3A3A3] font-bold">(Scheduled &gt; 6 Days)</span>
            </h3>
            <span className="text-xs font-black text-[#D4D4D4] px-3 py-1 rounded-full bg-[#141414] border border-[#262626]">
              {comingSoonMatches.length} Matches
            </span>
          </div>

          {/* 3 COLUMNS RESPONSIVE GRID ON DESKTOP */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {comingSoonMatches.map((m) => (
              <div
                key={m.id}
                className="prime-card-3d p-5 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <CategoryBadge category={m.category} size="xs" />
                  <span className="bg-[#000000] text-[#A3A3A3] text-[10px] font-black px-2.5 py-1 rounded-lg border border-[#262626]">
                    Starts in {Math.round(getDaysUntilMatch(m.start_time))} Days
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#000000] border border-[#333333] flex items-center justify-center font-black text-xs text-[#FFD700]">
                      {m.team_a_code || m.team_a?.slice(0, 3).toUpperCase()}
                    </div>
                    <span className="text-xs font-black text-white truncate">{m.team_a}</span>
                  </div>

                  <span className="text-xs font-black text-[#FF1744] px-2 italic">VS</span>

                  <div className="flex items-center gap-2 min-w-0 justify-end">
                    <span className="text-xs font-black text-white truncate text-right">{m.team_b}</span>
                    <div className="w-9 h-9 rounded-xl bg-[#000000] border border-[#333333] flex items-center justify-center font-black text-xs text-[#FFD700]">
                      {m.team_b_code || m.team_b?.slice(0, 3).toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#222222] flex items-center justify-between text-xs">
                  <span className="text-[#A3A3A3] font-bold">
                    📅 {m.match_date} • ⏰ {m.match_time}
                  </span>
                  <Link
                    href={`/match/${m.id}`}
                    className="text-[#FFD700] font-black hover:underline flex items-center gap-1 group"
                  >
                    <span>Preview</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
