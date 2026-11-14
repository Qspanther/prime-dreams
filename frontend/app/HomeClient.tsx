'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from './lib/auth-context';
import { apiGet, apiPost, resolveImageUrl } from './lib/api';
import {
  Trophy, Clock, Users, ArrowRight, Shield, Activity,
  Radio, Sparkles, ChevronRight, ChevronLeft, AlertCircle,
  Calendar, Zap, Bell, Flame, Coins, Gift, Share2, Copy, Check
} from 'lucide-react';
import CategoryFilterTabs from './components/ui/CategoryFilterTabs';
import CategoryBadge from './components/ui/CategoryBadge';
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
  const { user, token } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [matches, setMatches] = useState<any[]>(initialMatches);
  const [loading, setLoading] = useState<boolean>(initialMatches.length === 0);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Dynamic Banner Carousel State
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [copiedReferral, setCopiedReferral] = useState<boolean>(false);
  const [claimingDaily, setClaimingDaily] = useState<boolean>(false);
  const [dailyClaimedSession, setDailyClaimedSession] = useState<boolean>(false);

  // Touch Swipe Coordinates for Mobile Banner Gestures
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipingBanner = useRef<boolean>(false);

  // User Reward & Promo Configuration
  const [rewardsState, setRewardsState] = useState<any>(null);
  const [promoSettings, setPromoSettings] = useState<{
    referral_bonus_amount: number;
    welcome_bonus_amount: number;
    share_unlock_target: number;
    promo_banner_title: string;
    promo_banner_subtitle: string;
  }>({
    referral_bonus_amount: 500,
    welcome_bonus_amount: 100,
    share_unlock_target: 3,
    promo_banner_title: 'Share & Earn ₹500 Bonus Cash!',
    promo_banner_subtitle: 'Invite 3 friends with your referral link to unlock instant cash bonus + 30 days tournament access!',
  });

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
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, [selectedCategory]);

  // Fetch Admin Promo Settings & User Rewards
  useEffect(() => {
    apiGet('/subscription/promo-banner-settings')
      .then((res) => {
        if (res?.settings) {
          setPromoSettings({
            referral_bonus_amount: Number(res.settings.referral_bonus_amount) || 500,
            welcome_bonus_amount: Number(res.settings.welcome_bonus_amount) || 100,
            share_unlock_target: Number(res.settings.share_unlock_target) || 3,
            promo_banner_title: res.settings.promo_banner_title || 'Share & Earn ₹500 Bonus Cash!',
            promo_banner_subtitle: res.settings.promo_banner_subtitle || 'Invite 3 friends with your referral link to unlock instant cash bonus + 30 days tournament access!',
          });
        }
      })
      .catch(() => {});

    if (token) {
      apiGet('/rewards/state', token)
        .then((res) => {
          if (res?.success) setRewardsState(res);
        })
        .catch(() => {});
    }
  }, [token]);

  // Session-only dismiss for personalized welcome banner
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

  // Claim Daily Login Reward Directly from Banner
  const handleClaimDailyReward = async () => {
    if (!token) {
      setReminderToast('Please log in to claim your daily bonus!');
      setTimeout(() => setReminderToast(null), 3000);
      return;
    }
    setClaimingDaily(true);
    try {
      const res = await apiPost('/rewards/claim-daily', {}, token);
      if (res?.success) {
        setDailyClaimedSession(true);
        setReminderToast(`🎉 Congratulations! You claimed ${res.coins_earned || 20} Prime Coins!`);
        setTimeout(() => setReminderToast(null), 4000);
        // Refresh reward state
        apiGet('/rewards/state', token).then(r => r?.success && setRewardsState(r)).catch(() => {});
      } else {
        setReminderToast(res?.error || 'Could not claim daily reward');
        setTimeout(() => setReminderToast(null), 3000);
      }
    } catch (err: any) {
      setReminderToast(err.message || 'Already claimed or server error');
      setTimeout(() => setReminderToast(null), 3000);
    } finally {
      setClaimingDaily(false);
    }
  };

  // Copy Referral Share Link
  const handleCopyReferral = () => {
    const code = user?.referral_code || 'PRIME100';
    const shareText = `🏏 Join me on Prime Dreams Cricket Fantasy! Use my code "${code}" to unlock a ₹${promoSettings.welcome_bonus_amount} Signup Bonus + Free Match Passes: https://prime-dreams.onrender.com/signup?ref=${code}`;
    navigator.clipboard.writeText(shareText);
    setCopiedReferral(true);
    setReminderToast(`📋 Referral link copied! Share with friends to earn ₹${promoSettings.referral_bonus_amount} Bonus!`);
    setTimeout(() => {
      setCopiedReferral(false);
      setReminderToast(null);
    }, 4000);
  };

  // Filter Live, Upcoming & Coming Soon Matches
  const { liveMatches, upcomingMatches, comingSoonMatches } = useMemo(() => {
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

  // Construct Dynamic Advertisement Banners List
  const bannerSlides = useMemo(() => {
    const slides: any[] = [];

    // 1. Live Matches Advertisement Banners (1 for every live fixture)
    liveMatches.forEach((m, idx) => {
      slides.push({
        id: `live-${m.id}`,
        type: 'live_match',
        badge: '🔴 LIVE IN-PLAY MATCH',
        badgeClass: 'neon-badge-red',
        category: m.category,
        venue: m.venue || 'International Cricket Stadium',
        title: m.title || `${m.team_a} vs ${m.team_b}`,
        teamA: m.team_a,
        teamB: m.team_b,
        teamALogo: m.team_a_logo,
        teamBLogo: m.team_b_logo,
        teamACode: m.team_a_code || m.team_a?.slice(0, 3).toUpperCase(),
        teamBCode: m.team_b_code || m.team_b?.slice(0, 3).toUpperCase(),
        scoreSummary: getLiveScoreSummary(m),
        statusText: m.live_data?.status_text || 'Live score syncing from telemetry feed',
        matchId: m.id,
        prizePool: m.total_prize_pool > 0 ? `₹${m.total_prize_pool.toLocaleString('en-IN')}` : '₹50,00,000',
        entryFee: m.min_entry_fee > 0 ? `₹${m.min_entry_fee}` : '₹49',
        gradient: 'from-[#090D16] via-[#0F172A] to-[#1E3A8A]',
      });
    });

    // 2. Featured Upcoming Mega Match Banner (if upcoming fixtures exist)
    if (upcomingMatches.length > 0) {
      const topMatch = upcomingMatches[0];
      slides.push({
        id: `upcoming-${topMatch.id}`,
        type: 'upcoming_match',
        badge: '🔥 FEATURED MEGA MATCH',
        badgeClass: 'neon-badge-gold',
        category: topMatch.category,
        venue: topMatch.venue || 'Stadium Arena',
        title: topMatch.title || `${topMatch.team_a} vs ${topMatch.team_b}`,
        teamA: topMatch.team_a,
        teamB: topMatch.team_b,
        teamALogo: topMatch.team_a_logo,
        teamBLogo: topMatch.team_b_logo,
        teamACode: topMatch.team_a_code || topMatch.team_a?.slice(0, 3).toUpperCase(),
        teamBCode: topMatch.team_b_code || topMatch.team_b?.slice(0, 3).toUpperCase(),
        matchDate: topMatch.match_date,
        matchTime: topMatch.match_time,
        matchId: topMatch.id,
        prizePool: topMatch.total_prize_pool > 0 ? `₹${topMatch.total_prize_pool.toLocaleString('en-IN')}` : '₹10,00,000',
        entryFee: topMatch.min_entry_fee > 0 ? `₹${topMatch.min_entry_fee}` : '₹49',
        gradient: 'from-[#0B132B] via-[#1C2541] to-[#3A506B]',
      });
    }

    // 3. Account-Wise Daily Reward Banner (Shown only if NOT redeemed yet)
    const canClaimDaily = (!dailyClaimedSession && rewardsState?.can_claim_daily !== false);
    if (canClaimDaily) {
      slides.push({
        id: 'account-daily-reward',
        type: 'daily_reward',
        badge: '🎁 DAILY REWARD READY',
        badgeClass: 'bg-emerald-500 text-white font-black',
        title: 'Claim Your Daily 20 Prime Coins + Free Scratch Card!',
        subtitle: 'Log in daily to claim free coins, spin the wheel, and unlock free tournament passes.',
        actionType: 'claim_daily',
        gradient: 'from-[#064E3B] via-[#047857] to-[#0284C7]',
      });
    }

    // 4. Admin-Configured Referral / Share Bonus Cash Banner
    slides.push({
      id: 'account-referral-promo',
      type: 'referral_bonus',
      badge: `📢 EARN ₹${promoSettings.referral_bonus_amount} BONUS CASH`,
      badgeClass: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black',
      title: promoSettings.promo_banner_title,
      subtitle: promoSettings.promo_banner_subtitle,
      targetFriends: promoSettings.share_unlock_target,
      completedFriends: user?.total_referrals_count || 0,
      referralCode: user?.referral_code || 'PRIME100',
      actionType: 'copy_referral',
      gradient: 'from-[#1E1B4B] via-[#312E81] to-[#2563EB]',
    });

    // 5. Welcome 100% Deposit Bonus Banner
    slides.push({
      id: 'account-deposit-boost',
      type: 'deposit_boost',
      badge: '⚡ 100% DEPOSIT BONUS',
      badgeClass: 'bg-purple-600 text-white font-black',
      title: 'Instant 100% Match Deposit Bonus',
      subtitle: `Add cash to your wallet & get an instant bonus up to ₹${promoSettings.referral_bonus_amount}! Play mega contests risk-free.`,
      actionLink: '/wallet',
      gradient: 'from-[#3B0764] via-[#581C87] to-[#7E22CE]',
    });

    return slides;
  }, [liveMatches, upcomingMatches, rewardsState, dailyClaimedSession, promoSettings, user]);

  // Auto-rotate advertisement banners:
  // Immediate auto-swap cue on mount (swaps after 2.5s so mobile/desktop users immediately notice auto-rotation),
  // then rotates every 4.5s (pauses on hover or active touch swipe).
  useEffect(() => {
    if (bannerSlides.length <= 1) return;

    const initialCue = setTimeout(() => {
      if (!isHovered && !isSwipingBanner.current) {
        setActiveSlide((prev) => (prev + 1) % bannerSlides.length);
      }
    }, 2500);

    const interval = setInterval(() => {
      if (!isHovered && !isSwipingBanner.current) {
        setActiveSlide((prev) => (prev + 1) % bannerSlides.length);
      }
    }, 4500);

    return () => {
      clearTimeout(initialCue);
      clearInterval(interval);
    };
  }, [bannerSlides.length, isHovered]);

  // Touch Swipe Gesture Handlers for Mobile Banners
  const handleBannerTouchStart = (e: React.TouchEvent) => {
    setIsHovered(true);
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    isSwipingBanner.current = true;
  };

  const handleBannerTouchMove = (e: React.TouchEvent) => {
    // Keep touch tracking live
  };

  const handleBannerTouchEnd = (e: React.TouchEvent) => {
    setIsHovered(false);
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - endX;
    const diffY = (touchStartY.current || 0) - endY;

    // Trigger slide swap if horizontal swipe distance > 35px and larger than vertical drift
    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        // Swiped Left -> Next Slide
        setActiveSlide((prev) => (prev + 1) % bannerSlides.length);
      } else {
        // Swiped Right -> Previous Slide
        setActiveSlide((prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isSwipingBanner.current = false;
  };

  const currentSlideData = bannerSlides[activeSlide] || bannerSlides[0];

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-transparent text-[#0F172A]">
      {/* Personalized Welcome Banner */}
      {!bannerDismissed && (
        <div className="relative rounded-2xl prime-card-shiny-gold p-3.5 sm:p-5 flex items-center justify-between border-2 border-[#F59E0B] shadow-[0_10px_25px_rgba(245,158,11,0.18)]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(37,99,235,0.4)] border-2 border-white">
              <span className="text-xl sm:text-2xl drop-shadow-md">🏏</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-lg font-black text-[#0F172A] flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="truncate">Welcome back, <span className="text-[#2563EB]">{user?.name || user?.username || 'Champion'}</span>! 🏏</span>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-black bg-[#2563EB] text-white border border-[#93C5FD] shadow-sm shrink-0">
                  PRIME VIP
                </span>
              </h2>
              <p className="text-[11px] sm:text-sm text-[#475569] font-semibold mt-0.5 line-clamp-1 sm:line-clamp-none">
                Ready to build your winning cricket fantasy XI &amp; conquer the Grand Colosseum?
              </p>
            </div>
          </div>
          <button
            onClick={handleDismissBanner}
            className="text-[#64748B] hover:text-[#0F172A] p-1.5 sm:p-2 text-sm shrink-0 ml-1.5 rounded-lg hover:bg-black/5 transition cursor-pointer"
            title="Dismiss for this session"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🎪 DYNAMIC PROMOTIONAL & LIVE ADVERTISEMENT BANNER CAROUSEL */}
      {/* ======================================================== */}
      {bannerSlides.length > 0 && (
        <div className="space-y-2.5">
          <div
            className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_16px_40px_rgba(15,23,42,0.20)] border-2 border-[#94A3B8] [touch-action:pan-y]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={handleBannerTouchStart}
            onTouchMove={handleBannerTouchMove}
            onTouchEnd={handleBannerTouchEnd}
          >
            {/* The Horizontal Sliding Track (Smooth CSS transform for visible left/right slide animation) */}
            <div
              className="flex w-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {bannerSlides.map((slide, slideIdx) => (
                <div
                  key={slide.id}
                  className={`w-full shrink-0 p-4 sm:p-7 md:p-8 bg-gradient-to-br ${slide.gradient} text-white min-h-[220px] sm:min-h-[260px] flex flex-col justify-between relative select-none`}
                >
                  {/* Ambient Lighting Beams */}
                  <div className="absolute -right-24 -top-24 w-[380px] h-[380px] rounded-full bg-blue-400/20 blur-[100px] pointer-events-none" />
                  <div className="absolute -left-24 -bottom-24 w-[380px] h-[380px] rounded-full bg-amber-400/15 blur-[100px] pointer-events-none" />
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />

                  {/* ─── SLIDE TYPE 1: LIVE IN-PLAY MATCH BANNER ─── */}
                  {slide.type === 'live_match' && (
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
                      <div className="lg:col-span-8 flex flex-col gap-2 sm:gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="neon-badge-red px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            LIVE MATCH ARENA
                          </span>
                          <CategoryBadge category={slide.category} size="xs" />
                          <span className="bg-white/15 backdrop-blur-md text-white px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border border-white/20 truncate max-w-[200px] sm:max-w-none">
                            📍 {slide.venue}
                          </span>
                        </div>

                        <div>
                          <h2 className="text-lg sm:text-3xl lg:text-4xl font-black text-white drop-shadow-md font-['Montserrat'] tracking-tight leading-snug">
                            {slide.title}
                          </h2>
                          <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 flex-wrap">
                            <span className="text-base sm:text-2xl font-black font-mono text-[#FDE047] drop-shadow-sm">
                              {slide.scoreSummary}
                            </span>
                            <span className="hidden sm:inline text-white/50">•</span>
                            <span className="text-[11px] sm:text-sm font-semibold text-emerald-300">
                              {slide.statusText}
                            </span>
                          </div>
                        </div>

                        {/* High-Converting Advertising Highlights */}
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-0.5 sm:pt-1">
                          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2">
                            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F59E0B] shrink-0" />
                            <span className="text-[11px] sm:text-xs font-bold">Prize: <strong className="text-[#FDE047] text-xs sm:text-sm font-mono">{slide.prizePool}</strong></span>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2">
                            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                            <span className="text-[11px] sm:text-xs font-bold">Entry: <strong className="text-white text-xs sm:text-sm font-mono">{slide.entryFee}</strong></span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-md border border-white/20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2">
                            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300 shrink-0" />
                            <span className="text-[11px] sm:text-xs font-bold">Telemetry: <strong className="text-sky-300 text-[11px] sm:text-xs">Live Telemetry Gateway</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Trigger */}
                      <div className="lg:col-span-4 flex flex-col justify-center items-stretch lg:items-end gap-2 sm:gap-3">
                        <div className="bg-black/30 backdrop-blur-md p-2.5 sm:p-4 rounded-2xl border border-white/20 text-center w-full lg:max-w-[280px]">
                          <span className="text-[9px] sm:text-[10px] text-amber-300 uppercase tracking-widest font-black block">Grand Colosseum</span>
                          <span className="text-sm sm:text-lg font-black text-white block mt-0.5">1st Prize ₹15,00,000</span>
                          <span className="text-[9px] sm:text-[10px] text-white/70 block mt-0.5">Instant UPI Bank Withdrawals</span>
                        </div>

                        <Link
                          href={`/match/${slide.matchId}`}
                          className="w-full lg:max-w-[280px] prime-btn-3d text-center text-xs sm:text-sm font-black uppercase tracking-wider py-2.5 sm:py-3 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(37,99,235,0.5)] hover:scale-105 transition"
                        >
                          <span>Enter Live Arena</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* ─── SLIDE TYPE 2: FEATURED UPCOMING MEGA MATCH ─── */}
                  {slide.type === 'upcoming_match' && (
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
                      <div className="lg:col-span-8 flex flex-col gap-2 sm:gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="neon-badge-gold px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5 shadow-lg">
                            <Flame className="w-3.5 h-3.5 fill-white" />
                            FEATURED MEGA CONTEST
                          </span>
                          <CategoryBadge category={slide.category} size="xs" />
                          <span className="bg-white/15 backdrop-blur-md text-white px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border border-white/20 truncate">
                            📅 {slide.matchDate} • ⏰ {slide.matchTime}
                          </span>
                        </div>

                        <div>
                          <h2 className="text-lg sm:text-3xl lg:text-4xl font-black text-white drop-shadow-md font-['Montserrat'] tracking-tight leading-snug">
                            {slide.title}
                          </h2>
                          <p className="text-xs sm:text-sm text-white/80 font-semibold mt-1 line-clamp-2 sm:line-clamp-none">
                            Pick your 11 cricket champions &amp; assign Captain (2.0×) and Vice-Captain (1.5×) on the stadium pitch.
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap pt-0.5 sm:pt-1">
                          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2">
                            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F59E0B]" />
                            <span className="text-[11px] sm:text-xs font-bold">Prize Pool: <strong className="text-[#FDE047] text-xs sm:text-sm font-mono">{slide.prizePool}</strong></span>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300" />
                            <span className="text-[11px] sm:text-xs font-bold">10,000 Spots Pool</span>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-4 flex flex-col justify-center items-stretch lg:items-end gap-2.5 sm:gap-3">
                        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full lg:max-w-[280px]">
                          <Link
                            href={`/team-builder/${slide.matchId}`}
                            className="prime-btn-dark-3d text-center text-xs font-black uppercase tracking-wider py-2.5 flex items-center justify-center gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2563EB]" />
                            <span>Create XI</span>
                          </Link>
                          <Link
                            href={`/match/${slide.matchId}`}
                            className="prime-btn-3d text-center text-xs font-black uppercase tracking-wider py-2.5 flex items-center justify-center gap-1.5"
                          >
                            <span>Join Now</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── SLIDE TYPE 3: ACCOUNT-WISE DAILY REWARD BANNER ─── */}
                  {slide.type === 'daily_reward' && (
                    <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-6 py-1 sm:py-2">
                      <div className="space-y-1.5 sm:space-y-2 max-w-xl">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-md">
                          <Gift className="w-3.5 h-3.5" />
                          DAILY REWARD BONUS
                        </span>
                        <h2 className="text-lg sm:text-3xl lg:text-4xl font-black text-white font-['Montserrat'] leading-snug">
                          {slide.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium">
                          {slide.subtitle}
                        </p>
                      </div>

                      <div className="shrink-0 flex flex-col items-stretch sm:items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={handleClaimDailyReward}
                          disabled={claimingDaily}
                          className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 text-xs sm:text-sm font-black hover:scale-105 transition shadow-[0_10px_25px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          <span>{claimingDaily ? 'Claiming Coins...' : '⚡ CLAIM DAILY REWARD NOW'}</span>
                        </button>
                        <span className="text-[10px] sm:text-[11px] text-white/80 font-bold text-center">100% Free • One-click credit</span>
                      </div>
                    </div>
                  )}

                  {/* ─── SLIDE TYPE 4: REFERRAL & SHARE BONUS BANNER ─── */}
                  {slide.type === 'referral_bonus' && (
                    <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-6 py-1 sm:py-2">
                      <div className="space-y-1.5 sm:space-y-2 max-w-xl">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-orange-500 text-white shadow-md">
                          <Share2 className="w-3.5 h-3.5" />
                          {slide.badge}
                        </span>
                        <h2 className="text-lg sm:text-3xl lg:text-4xl font-black text-white font-['Montserrat'] leading-snug">
                          {slide.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium">
                          {slide.subtitle}
                        </p>
                        <div className="flex items-center gap-2 sm:gap-3 pt-1 flex-wrap">
                          <span className="text-xs text-amber-300 font-bold">Your Referral Code:</span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-black/40 border border-white/20 font-mono font-black text-white text-xs">
                            {slide.referralCode}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-stretch sm:items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={handleCopyReferral}
                          className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-white text-slate-900 text-xs sm:text-sm font-black hover:bg-slate-100 hover:scale-105 transition shadow-[0_10px_25px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {copiedReferral ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[#2563EB]" />}
                          <span>{copiedReferral ? 'Link Copied!' : '📲 SHARE LINK & CLAIM BONUS'}</span>
                        </button>
                        <span className="text-[10px] sm:text-[11px] text-white/80 font-bold text-center">Invite friends via WhatsApp or Link</span>
                      </div>
                    </div>
                  )}

                  {/* ─── SLIDE TYPE 5: 100% DEPOSIT BOOST BANNER ─── */}
                  {slide.type === 'deposit_boost' && (
                    <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-6 py-1 sm:py-2">
                      <div className="space-y-1.5 sm:space-y-2 max-w-xl">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-purple-400 text-slate-950 shadow-md">
                          <Coins className="w-3.5 h-3.5" />
                          WALLET CASH BONUS
                        </span>
                        <h2 className="text-lg sm:text-3xl lg:text-4xl font-black text-white font-['Montserrat'] leading-snug">
                          {slide.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium">
                          {slide.subtitle}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <Link
                          href={slide.actionLink}
                          className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-xs sm:text-sm font-black hover:scale-105 transition shadow-[0_10px_25px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2"
                        >
                          <span>💰 ADD CASH &amp; CLAIM 100% BONUS</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Bottom Bar: Manual Arrows + Slide Dots Navigation */}
                  <div className="relative z-10 pt-3 sm:pt-4 mt-2 border-t border-white/15 flex items-center justify-between">
                    {/* Prev / Next Controls */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSlide((prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition cursor-pointer"
                        aria-label="Previous Slide"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSlide((prev) => (prev + 1) % bannerSlides.length);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition cursor-pointer"
                        aria-label="Next Slide"
                      >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <span className="text-[10px] sm:text-[11px] text-white/70 font-mono font-bold ml-1">
                        {slideIdx + 1} / {bannerSlides.length}
                      </span>
                    </div>

                    {/* Inside Slide Indicator Dots */}
                    <div className="flex items-center gap-1.5">
                      {bannerSlides.map((s, idx) => (
                        <button
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSlide(idx);
                          }}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            activeSlide === idx
                              ? 'w-6 sm:w-7 bg-white shadow-md'
                              : 'w-2 bg-white/35 hover:bg-white/60'
                          }`}
                          aria-label={`Jump to slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 🔘 PROMINENT HIGHLIGHTED INDICATOR DOTS BENEATH BANNER */}
          {bannerSlides.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1 pb-0.5">
              {bannerSlides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    activeSlide === idx
                      ? 'w-8 bg-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.7)]'
                      : 'w-2.5 bg-[#CBD5E1] hover:bg-[#94A3B8]'
                  }`}
                  aria-label={`Jump to banner ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 5.4: User-Side Category Filter Tabs */}
      <div className="space-y-3 pt-1 sm:pt-2">
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

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 scrollbar-none [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]">
            {liveMatches.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="prime-card-3d min-w-[270px] max-w-[300px] shrink-0 snap-start p-3 flex flex-col justify-between group border border-emerald-300 shadow-[0_0_22px_rgba(34,197,94,0.20)] hover:border-emerald-500 hover:shadow-[0_0_28px_rgba(34,197,94,0.34)]"
              >
                <div>
                  {/* Match Poster Frame */}
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
                    {m.contests_count ? `🏆 ${m.contests_count} Contests` : `Score: Live Feed`}
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
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 scrollbar-none [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 min-w-[270px] max-w-[300px] shrink-0 snap-start rounded-2xl bg-white/70 animate-pulse border-2 border-[#CBD5E1]" />
            ))}
          </div>
        ) : upcomingMatches.length === 0 ? (
          <div className="p-8 rounded-2xl prime-card-3d text-center text-[#64748B] font-bold">
            No upcoming matches in this category for the next 6 days.
          </div>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 scrollbar-none [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]">
            {upcomingMatches.map((m) => (
              <div
                key={m.id}
                className="prime-card-3d min-w-[270px] max-w-[300px] shrink-0 snap-start p-3 flex flex-col justify-between group border border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.16)] hover:border-amber-500 hover:shadow-[0_0_24px_rgba(245,158,11,0.28)]"
              >
                <div>
                  {/* Match Poster Frame */}
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

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 scrollbar-none [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]">
            {comingSoonMatches.map((m) => (
              <div
                key={m.id}
                className="prime-card-3d min-w-[270px] max-w-[300px] shrink-0 snap-start p-3 flex flex-col justify-between space-y-2.5 border border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.16)] hover:border-amber-500 hover:shadow-[0_0_24px_rgba(245,158,11,0.28)]"
              >
                <div>
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
                    className="text-[#2563EB] font-black hover:underline flex items-center gap-0.5 group text-xs"
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
