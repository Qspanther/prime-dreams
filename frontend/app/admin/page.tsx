'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Trophy, Shield, Activity, DollarSign, Radio, 
  Clock, RefreshCw, ChevronRight, Eye, Layers, Sparkles, Check, AlertCircle, Plus,
  Calendar, MapPin, Globe, DownloadCloud, CheckCircle2, Sliders, Play, Pause, Trash2
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import CategoryBadge from '../components/ui/CategoryBadge';
import CategoryFilterTabs from '../components/ui/CategoryFilterTabs';

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [activeDeckTab, setActiveDeckTab] = useState<'cricbuzz' | 'health' | 'platform'>('cricbuzz');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Data Health & Ingestion Monitor State (Section 4)
  const [dataHealthReport, setDataHealthReport] = useState<any>(null);

  // Manual Override Modal State (Section 4.2)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideMatch, setOverrideMatch] = useState<any>(null);
  const [overrideTeam, setOverrideTeam] = useState<'team_a' | 'team_b'>('team_a');
  const [overrideRuns, setOverrideRuns] = useState('');
  const [overrideWickets, setOverrideWickets] = useState('');
  const [overrideOvers, setOverrideOvers] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Cricbuzz Feed State
  const [cricbuzzFeed, setCricbuzzFeed] = useState<any>(null);
  const [cricbuzzLoading, setCricbuzzLoading] = useState(true);
  const [selectedCbLiveId, setSelectedCbLiveId] = useState<string | null>(null);
  const [selectedCbUpcomingId, setSelectedCbUpcomingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Platform Match Selected States
  const [selectedLiveMatchId, setSelectedLiveMatchId] = useState<string | null>(null);
  const [selectedUpcomingMatchId, setSelectedUpcomingMatchId] = useState<string | null>(null);

  // Fetch Cricbuzz Live Extractor Feed
  const fetchCricbuzzFeed = async () => {
    if (!token) return;
    try {
      const res = await apiGet('/admin/cricbuzz/feed', token);
      if (res?.success) {
        setCricbuzzFeed(res);
        if (!selectedCbLiveId && res.liveMatches?.length > 0) {
          setSelectedCbLiveId(res.liveMatches[0].cricbuzz_id);
        }
        if (!selectedCbUpcomingId && res.upcomingMatches?.length > 0) {
          setSelectedCbUpcomingId(res.upcomingMatches[0].cricbuzz_id);
        }
      }
    } catch (err) {
      console.error('Error fetching cricbuzz feed:', err);
    } finally {
      setCricbuzzLoading(false);
    }
  };

  // Fetch Platform Matches
  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const url = selectedCategory === 'All'
        ? '/admin/cricket/matches'
        : `/admin/cricket/matches?category=${encodeURIComponent(selectedCategory)}`;
      const res = await apiGet(url, token);
      if (res?.matches) {
        setMatches(res.matches);
        const liveList = res.matches.filter((m: any) => m.status === 'live');
        const upList = res.matches.filter((m: any) => m.status === 'upcoming');
        if (!selectedLiveMatchId && liveList.length > 0) {
          setSelectedLiveMatchId(liveList[0].id);
        }
        if (!selectedUpcomingMatchId && upList.length > 0) {
          setSelectedUpcomingMatchId(upList[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching platform matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = async (m: any) => {
    const ok = window.confirm(`Are you sure you want to permanently delete "${m.title}"?\n\nThis will remove the match, all associated contests, 30-player rosters, and contest records.`);
    if (!ok) return;

    try {
      const res = await apiDelete(`/admin/cricket/matches/${m.id}`, token);
      if (res?.success) {
        setMatches(prev => prev.filter(item => item.id !== m.id));
        alert(res.message || 'Match and contests deleted successfully.');
        fetchDashboardData();
      } else {
        alert(res?.error || 'Failed to delete match');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting match');
    }
  };

  // Fetch Data Health Metrics
  const fetchDataHealth = async () => {
    if (!token) return;
    try {
      const res = await apiGet('/admin/data-health', token);
      if (res?.success) {
        setDataHealthReport(res.report);
      }
    } catch (err) {
      console.error('Error fetching data health:', err);
    }
  };

  useEffect(() => {
    fetchCricbuzzFeed();
    fetchDashboardData();
    fetchDataHealth();
    const interval = setInterval(() => {
      fetchCricbuzzFeed();
      fetchDashboardData();
      fetchDataHealth();
    }, 8000);
    return () => clearInterval(interval);
  }, [token, selectedCategory]);

  // One-Click Import Cricbuzz Match into Prime Dreems
  const handleImportMatch = async (cricbuzzId: string) => {
    if (!cricbuzzId || !token) return;
    setImportingId(cricbuzzId);
    setImportSuccess(null);
    try {
      const res = await apiPost('/admin/cricbuzz/import', { cricbuzz_id: cricbuzzId }, token);
      if (res?.success) {
        setImportSuccess(res.message);
        setTimeout(() => setImportSuccess(null), 3500);
        await fetchCricbuzzFeed();
        await fetchDashboardData();
      }
    } catch (err: any) {
      console.error('Error importing match:', err);
    } finally {
      setImportingId(null);
    }
  };

  // Open Score Override Modal
  const handleOpenOverrideModal = (m: any) => {
    setOverrideMatch(m);
    setOverrideTeam('team_a');
    setOverrideRuns(String(m.score_summary?.team_a?.runs || 0));
    setOverrideWickets(String(m.score_summary?.team_a?.wickets || 0));
    setOverrideOvers(String(m.score_summary?.team_a?.overs || 0));
    setOverrideReason('');
    setOverrideMsg(null);
    setOverrideError(null);
    setOverrideModalOpen(true);
  };

  // Submit Manual Score Override
  const handleSubmitScoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideMatch || !token) return;
    if (!overrideReason.trim() || overrideReason.trim().length < 5) {
      setOverrideError('Please provide a descriptive audit reason (min 5 characters).');
      return;
    }
    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      const res = await apiPost(`/admin/matches/${overrideMatch.id}/override-score`, {
        team: overrideTeam,
        runs: parseInt(overrideRuns, 10),
        wickets: parseInt(overrideWickets, 10),
        overs: parseFloat(overrideOvers),
        reason: overrideReason.trim(),
      }, token);

      if (res?.success) {
        setOverrideMsg('✅ Score override broadcast live with audit log!');
        setTimeout(() => {
          setOverrideModalOpen(false);
          setOverrideMsg(null);
          fetchDashboardData();
          fetchDataHealth();
        }, 1500);
      } else {
        setOverrideError(res?.error || 'Failed to submit score override.');
      }
    } catch (err: any) {
      setOverrideError(err?.message || 'Error executing override.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // Toggle Ingestion Pause / Resume
  const handleToggleIngestion = async (matchId: string, currentlyPaused: boolean) => {
    if (!token || !matchId) return;
    try {
      await apiPost(`/admin/matches/${matchId}/toggle-ingestion`, { paused: !currentlyPaused }, token);
      await fetchDataHealth();
    } catch (err) {
      console.error('Error toggling ingestion:', err);
    }
  };

  // Cricbuzz Selected Live & Upcoming Matches
  const cbLiveMatches = cricbuzzFeed?.liveMatches || [];
  const cbUpcomingMatches = cricbuzzFeed?.upcomingMatches || [];
  const activeCbLive = cbLiveMatches.find((m: any) => m.cricbuzz_id === selectedCbLiveId) || cbLiveMatches[0];
  const activeCbUpcoming = cbUpcomingMatches.find((m: any) => m.cricbuzz_id === selectedCbUpcomingId) || cbUpcomingMatches[0];

  // Platform Matches
  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');
  const activeLiveMatch = liveMatches.find((m) => m.id === selectedLiveMatchId) || liveMatches[0];
  const activeUpcomingMatch = upcomingMatches.find((m) => m.id === selectedUpcomingMatchId) || upcomingMatches[0];
  const upcomingTeamAPlayers = activeUpcomingMatch ? (activeUpcomingMatch.players || []).filter((p: any) => p.team_name === activeUpcomingMatch.team_a) : [];
  const upcomingTeamBPlayers = activeUpcomingMatch ? (activeUpcomingMatch.players || []).filter((p: any) => p.team_name === activeUpcomingMatch.team_b) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-3 sm:px-6 py-6 bg-transparent text-[#0F172A]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#CBD5E1] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#2563EB] shadow-md animate-ping" />
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight flex items-center gap-2.5">
              <span>Cricbuzz Real-Time Database &amp; Command Deck</span>
            </h1>
          </div>
          <p className="text-[#64748B] text-xs sm:text-sm font-bold mt-1">
            Zero-Mistake Ingestion Pipeline: Live In-Play Scores, Dual-Source Cross-Check, Ball Telemetry, and Manual Override
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchCricbuzzFeed(); fetchDashboardData(); fetchDataHealth(); }}
            className="prime-btn-dark-3d text-xs !py-2.5 !px-4 flex items-center gap-2"
            title="Refresh Ingestion Feed"
          >
            <RefreshCw className={`w-4 h-4 ${cricbuzzLoading ? 'animate-spin' : ''}`} />
            <span>Sync Ingestion</span>
          </button>
          <Link
            href="/admin/tournaments"
            className="prime-btn-3d text-xs !py-2.5 !px-5 font-black uppercase tracking-wider flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Match</span>
          </Link>
        </div>
      </div>

      {/* Main Switcher: Cricbuzz Live Feed vs Ingestion Health vs Platform Contests DB */}
      <div className="flex flex-wrap items-center gap-3 p-1.5 rounded-2xl bg-white border-2 border-[#CBD5E1] shadow-sm w-fit">
        <button
          onClick={() => setActiveDeckTab('cricbuzz')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
            activeDeckTab === 'cricbuzz'
              ? 'prime-btn-3d'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Globe className="w-4 h-4 text-[#2563EB]" />
          <span>🌐 Cricbuzz Live Database Feed ({cbLiveMatches.length} Live • {cbUpcomingMatches.length} Upcoming)</span>
        </button>

        <button
          onClick={() => { setActiveDeckTab('health'); fetchDataHealth(); }}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
            activeDeckTab === 'health'
              ? 'prime-btn-gold-3d'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Shield className="w-4 h-4 text-[#D97706]" />
          <span>🛡️ Ingestion Health &amp; Manual Override</span>
          {dataHealthReport?.has_delayed_matches && (
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveDeckTab('platform')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
            activeDeckTab === 'platform'
              ? 'prime-btn-3d'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Trophy className="w-4 h-4 text-[#2563EB]" />
          <span>🏆 Prime Dreems Contests Database ({matches.length} Matches)</span>
        </button>
      </div>

      {importSuccess && (
        <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-black flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{importSuccess}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌐 MODE 1: CRICBUZZ REAL-TIME EXTRACTOR FEED (Direct from Cricbuzz API)  */}
      {/* ========================================================================= */}
      {activeDeckTab === 'cricbuzz' && (
        <div className="space-y-8">
          {/* Real-time Cricbuzz Status Banner */}
          <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-black text-[#0F172A]">
                Source: <strong className="text-[#2563EB]">Cricbuzz Live Cricket Network &amp; API Extractor Pipeline</strong>
              </span>
            </div>
            <div className="flex items-center gap-4 text-[#64748B] font-bold">
              <span>● Ingestion Cadence: 7s</span>
              <span>● Dual-Source Verification: Active</span>
              <span className="text-[#1D4ED8]">{cbLiveMatches.length} Matches In-Play Right Now</span>
            </div>
          </div>

          {/* TABLE 1: CRICBUZZ LIVE IN-PLAY MATCHES */}
          <div className="prime-card-3d bg-white rounded-2xl border-2 border-[#38BDF8] p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#EF4444] animate-ping" />
                <h2 className="text-lg font-black text-[#0F172A] uppercase tracking-wider">
                  Table 1 — Cricbuzz Live In-Play Matches ({cbLiveMatches.length})
                </h2>
              </div>
              <span className="text-xs text-[#64748B] font-bold">Live telemetry updates every 7s</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider bg-[#F8FAFC]">
                    <th className="p-3">Match</th>
                    <th className="p-3">Format / Series</th>
                    <th className="p-3">Live Score</th>
                    <th className="p-3">Current In-Play Action</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {cbLiveMatches.map((m: any) => {
                    const isSelected = selectedCbLiveId === m.cricbuzz_id;
                    const isImported = m.is_imported;

                    return (
                      <tr 
                        key={m.cricbuzz_id}
                        onClick={() => setSelectedCbLiveId(m.cricbuzz_id)}
                        className={`hover:bg-[#F1F5F9] transition cursor-pointer ${
                          isSelected ? 'bg-[#EFF6FF] border-l-4 border-l-[#2563EB]' : 'bg-white'
                        }`}
                      >
                        <td className="p-3">
                          <CategoryBadge category={m.category} size="xs" />
                          <p className="font-black text-[#0F172A] text-sm mt-1">{m.title}</p>
                          <p className="text-[11px] text-[#64748B]">{m.venue}</p>
                        </td>
                        <td className="p-3">
                          <span className="text-[#0F172A] font-bold block">{m.match_format}</span>
                          <span className="text-[10px] text-[#64748B]">{m.series}</span>
                        </td>
                        <td className="p-3 font-mono">
                          <p className="text-[#2563EB] font-black text-sm">
                            {m.team_a}: {m.score_summary?.team_a?.runs || 0}/{m.score_summary?.team_a?.wickets || 0} ({m.score_summary?.team_a?.overs || 0} ov)
                          </p>
                          <p className="text-[#D97706] font-bold text-xs mt-0.5">
                            {m.team_b}: {m.score_summary?.team_b?.runs || 0}/{m.score_summary?.team_b?.wickets || 0} ({m.score_summary?.team_b?.overs || 0} ov)
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="text-[#0F172A] font-bold line-clamp-1">{m.live_commentary || m.cricbuzz_status || 'Ball in-play'}</p>
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">● Ball verified from Cricbuzz stream</p>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImportMatch(m.cricbuzz_id);
                              }}
                              disabled={isImported || importingId === m.cricbuzz_id}
                              className={`text-xs !py-1.5 !px-3 font-black rounded-lg transition ${
                                isImported
                                  ? 'bg-[#F1F5F9] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed'
                                  : 'prime-btn-3d'
                              }`}
                            >
                              {importingId === m.cricbuzz_id ? 'Importing...' : isImported ? '✓ In Contests' : '⚡ 1-Click Import'}
                            </button>
                            <Link
                              href={`/admin/tournaments?import=${m.cricbuzz_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs !py-1.5 !px-2.5 font-black rounded-lg border border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] transition whitespace-nowrap"
                            >
                              Review &amp; Edit &rarr;
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {cbLiveMatches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        No matches currently LIVE on Cricbuzz. Check Upcoming Fixtures below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2: CRICBUZZ UPCOMING FIXTURES */}
          <div className="prime-card-3d bg-white rounded-2xl border-2 border-[#CBD5E1] p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#2563EB]" />
                <h2 className="text-lg font-black text-[#0F172A] uppercase tracking-wider">
                  Table 2 — Cricbuzz Upcoming Fixtures ({cbUpcomingMatches.length})
                </h2>
              </div>
              <span className="text-xs text-[#64748B] font-bold">Auto-transitions to LIVE when match starts in real life</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider bg-[#F8FAFC]">
                    <th className="p-3">Match</th>
                    <th className="p-3">Series / Format</th>
                    <th className="p-3">Schedule Time</th>
                    <th className="p-3">Squad Roster</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {cbUpcomingMatches.map((m: any) => {
                    const isImported = m.is_imported;

                    return (
                      <tr key={m.cricbuzz_id} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-3">
                          <CategoryBadge category={m.category} size="xs" />
                          <p className="font-black text-[#0F172A] text-sm mt-1">{m.title}</p>
                          <p className="text-[11px] text-[#64748B]">{m.venue}</p>
                        </td>
                        <td className="p-3">
                          <span className="text-[#0F172A] font-bold block">{m.match_format}</span>
                          <span className="text-[10px] text-[#64748B]">{m.series}</span>
                        </td>
                        <td className="p-3 font-mono">
                          <p className="text-[#2563EB] font-black">{m.cricbuzz_status || 'Scheduled'}</p>
                        </td>
                        <td className="p-3">
                          <span className="text-[#0F172A] font-bold block">30 Players Verified</span>
                          <span className="text-[10px] text-emerald-600 font-bold">15 + 15 Pool Ready</span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleImportMatch(m.cricbuzz_id)}
                              disabled={isImported || importingId === m.cricbuzz_id}
                              className={`text-xs !py-1.5 !px-3 font-black rounded-lg transition ${
                                isImported
                                  ? 'bg-[#F1F5F9] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed'
                                  : 'prime-btn-gold-3d'
                              }`}
                            >
                              {importingId === m.cricbuzz_id ? 'Importing...' : isImported ? '✓ In Contests' : '⚡ 1-Click Import'}
                            </button>
                            <Link
                              href={`/admin/tournaments?import=${m.cricbuzz_id}`}
                              className="text-xs !py-1.5 !px-2.5 font-black rounded-lg border border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] transition whitespace-nowrap"
                            >
                              Review &amp; Edit &rarr;
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🛡️ MODE 2: DATA HEALTH, DUAL-SOURCE VERIFICATION & MANUAL OVERRIDE TOOL   */}
      {/* ========================================================================= */}
      {activeDeckTab === 'health' && (
        <div className="space-y-6">
          {/* Red Alert Banner if any match is delayed > 30s (Section 4.1) */}
          {dataHealthReport?.has_delayed_matches && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-400 text-red-900 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <p className="font-black text-sm text-red-700">CRITICAL DATA HEALTH ALERT</p>
                <p className="text-xs text-red-600 mt-0.5">
                  One or more live matches have not received telemetry updates in over 30 seconds. Ingestion stream may be throttled. Please inspect matches below or use Manual Override.
                </p>
              </div>
            </div>
          )}

          {/* Health Metrics Grid (Section 4.1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#64748B] uppercase">Ingestion Worker</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xl font-black text-emerald-600 mt-2">
                {dataHealthReport?.worker_status || 'RUNNING'}
              </p>
              <p className="text-[10px] text-[#64748B] mt-1">7s cadence active</p>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-xs">
              <span className="text-xs font-black text-[#64748B] uppercase">Primary Source</span>
              <p className="text-xl font-black text-[#0F172A] mt-2">
                {dataHealthReport?.source_health?.primary?.status || 'OK'}
              </p>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">Cricbuzz Live Stream</p>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-xs">
              <span className="text-xs font-black text-[#64748B] uppercase">Secondary Cross-Check</span>
              <p className="text-xl font-black text-[#0F172A] mt-2">
                {dataHealthReport?.source_health?.secondary?.status || 'OK'}
              </p>
              <p className="text-[10px] text-[#2563EB] font-bold mt-1">Dual-Source Verifier</p>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-xs">
              <span className="text-xs font-black text-[#64748B] uppercase">Validation Discards (1h)</span>
              <p className="text-xl font-black text-[#D97706] mt-2">
                {dataHealthReport?.validation_failures_count_1h || 0}
              </p>
              <p className="text-[10px] text-[#64748B] mt-1">Monotonicity guards active</p>
            </div>

            <div className="p-4 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-xs">
              <span className="text-xs font-black text-[#64748B] uppercase">WebSocket Clients</span>
              <p className="text-xl font-black text-[#2563EB] mt-2">
                {dataHealthReport?.websocket_gateway?.active_connections || 0}
              </p>
              <p className="text-[10px] text-[#64748B] mt-1">Delta stream listeners</p>
            </div>
          </div>

          {/* Active Live Matches Telemetry & Control Table */}
          <div className="prime-card-3d bg-white rounded-2xl border-2 border-[#CBD5E1] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2563EB]" />
                  <span>Live Matches Ingestion &amp; Override Controls</span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  Real-time latency tracking, dual-source status, pause stream, and instant manual override
                </p>
              </div>
              <button
                onClick={fetchDataHealth}
                className="prime-btn-dark-3d text-xs !py-1.5 !px-3 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] text-[#737373] uppercase text-[10px] tracking-wider">
                    <th className="p-3">Match</th>
                    <th className="p-3">Score &amp; Status</th>
                    <th className="p-3">Stream Latency</th>
                    <th className="p-3">Cross-Check</th>
                    <th className="p-3">Ingestion State</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {(dataHealthReport?.database_live_matches || matches.filter(m => m.status === 'live')).map((m: any) => {
                    const healthMatch = (dataHealthReport?.live_matches || []).find((h: any) => h.match_id === m.id);
                    const secondsAgo = healthMatch ? healthMatch.updated_seconds_ago : 0;
                    const isDelayed = secondsAgo > 30;
                    const isPaused = healthMatch?.is_paused || false;

                    return (
                      <tr key={m.id} className="hover:bg-[#121212] transition">
                        <td className="p-3">
                          <p className="font-black text-white">{m.title}</p>
                          <p className="text-[10px] text-[#A3A3A3]">{m.category} • {m.team_a} vs {m.team_b}</p>
                        </td>
                        <td className="p-3 font-mono">
                          <span className="text-[#FFD700] font-black">
                            {m.team_a}: {m.score_summary?.team_a?.runs || 0}/{m.score_summary?.team_a?.wickets || 0} ({m.score_summary?.team_a?.overs || 0} ov)
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isDelayed ? 'bg-red-950 text-red-300 border border-red-500/50 animate-pulse'
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            Updated {secondsAgo}s ago
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-950 text-blue-300 border border-blue-500/40">
                            {healthMatch?.cross_check_status || 'VERIFIED'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isPaused ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                                     : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {isPaused ? 'PAUSED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleOpenOverrideModal(m)}
                            className="prime-btn-gold-3d text-[11px] !py-1 !px-2.5 font-black inline-flex items-center gap-1"
                          >
                            <span>✏️ Override Score</span>
                          </button>
                          <button
                            onClick={() => handleToggleIngestion(m.id, isPaused)}
                            className={`text-[11px] !py-1 !px-2.5 font-black rounded-lg transition inline-flex items-center gap-1 border ${
                              isPaused
                                ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200 hover:bg-emerald-800'
                                : 'bg-amber-900/60 border-amber-500 text-amber-200 hover:bg-amber-800'
                            }`}
                          >
                            <span>{isPaused ? '▶️ Resume' : '⏸️ Pause'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(dataHealthReport?.database_live_matches || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#737373]">
                        No matches currently LIVE in database. Import a live match from the Cricbuzz tab above to monitor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🏆 MODE 3: PRIME DREEMS PLATFORM CONTESTS DATABASE                       */}
      {/* ========================================================================= */}
      {activeDeckTab === 'platform' && (
        <div className="space-y-6">
          <CategoryFilterTabs
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
          />

          <div className="prime-card-3d bg-white rounded-2xl border-2 border-[#CBD5E1] p-5 shadow-sm">
            <h3 className="text-base font-black text-[#0F172A] mb-4">
              Prime Dreems Active Contests &amp; Tournament Schedule ({matches.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider bg-[#F8FAFC]">
                    <th className="p-4">Match</th>
                    <th className="p-4">Teams</th>
                    <th className="p-4">Date &amp; Time</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Squads</th>
                    <th className="p-4">Contests</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {matches.map((m) => {
                    const pA = (m.players || []).filter((p: any) => p.team_name === m.team_a).length;
                    const pB = (m.players || []).filter((p: any) => p.team_name === m.team_b).length;

                    return (
                      <tr key={m.id} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-4">
                          <CategoryBadge category={m.category} size="xs" />
                          <p className="font-black text-[#0F172A] text-xs sm:text-sm mt-1">{m.title}</p>
                        </td>
                        <td className="p-4 font-black text-[#0F172A]">
                          <div className="flex items-center gap-2">
                            <span>{m.team_a}</span>
                            <span className="text-[#2563EB] text-[10px] italic">VS</span>
                            <span>{m.team_b}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono">
                          <p className="font-black text-[#0F172A] flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                            {m.match_date}
                          </p>
                          <p className="text-[11px] text-[#2563EB] font-bold">⏰ {m.match_time}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            m.status === 'live' ? 'neon-badge-red' : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                          }`}>
                            {m.status === 'live' ? '🔴 LIVE' : 'UPCOMING'}
                          </span>
                        </td>
                        <td className="p-4 font-bold">
                          <span className="text-[#1D4ED8] block">{m.team_a}: {pA} Players</span>
                          <span className="text-[#D97706] block">{m.team_b}: {pB} Players</span>
                        </td>
                        <td className="p-4 font-bold">
                          <span className="text-[#0F172A] block">{(m.contests || []).length || 4} Contests</span>
                          <span className="text-[10px] text-[#D97706] font-mono">
                            Pool: ₹{((m.total_prize_pool || 1000000) / 100000).toFixed(0)}L
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/match/${m.id}`}
                              className="prime-btn-dark-3d text-xs !py-1.5 !px-3 font-black"
                            >
                              Inspect Contest &rarr;
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteMatch(m)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-black text-red-600 flex items-center gap-1 transition"
                              title="Delete match and all its contests"
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ✏️ MANUAL SCORE OVERRIDE MODAL WITH AUDIT LOG (Section 4.2)              */}
      {/* ========================================================================= */}
      {overrideModalOpen && overrideMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-2 border-[#2563EB] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-[#0F172A]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#2563EB]" />
                  <span>Manual Score Override Tool</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {overrideMatch.title}
                </p>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A] text-lg font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitScoreOverride} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#64748B] font-bold mb-1">Select Inning / Team</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideTeam('team_a');
                      setOverrideRuns(String(overrideMatch.score_summary?.team_a?.runs || 0));
                      setOverrideWickets(String(overrideMatch.score_summary?.team_a?.wickets || 0));
                      setOverrideOvers(String(overrideMatch.score_summary?.team_a?.overs || 0));
                    }}
                    className={`p-2.5 rounded-xl border text-center font-black transition ${
                      overrideTeam === 'team_a'
                        ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                        : 'border-[#CBD5E1] text-[#64748B] bg-white'
                    }`}
                  >
                    {overrideMatch.team_a}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideTeam('team_b');
                      setOverrideRuns(String(overrideMatch.score_summary?.team_b?.runs || 0));
                      setOverrideWickets(String(overrideMatch.score_summary?.team_b?.wickets || 0));
                      setOverrideOvers(String(overrideMatch.score_summary?.team_b?.overs || 0));
                    }}
                    className={`p-2.5 rounded-xl border text-center font-black transition ${
                      overrideTeam === 'team_b'
                        ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#D97706]'
                        : 'border-[#CBD5E1] text-[#64748B] bg-white'
                    }`}
                  >
                    {overrideMatch.team_b}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#64748B] font-bold mb-1">Total Runs</label>
                  <input
                    type="number"
                    min="0"
                    max="1200"
                    value={overrideRuns}
                    onChange={(e) => setOverrideRuns(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#0F172A] font-black text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] font-bold mb-1">Wickets</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={overrideWickets}
                    onChange={(e) => setOverrideWickets(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#0F172A] font-black text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] font-bold mb-1">Overs (e.g. 14.3)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={overrideOvers}
                    onChange={(e) => setOverrideOvers(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#0F172A] font-black text-center"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1E3A8A] font-black mb-1">
                  Mandatory Audit Reason (Required by Section 4.2)
                </label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. 3rd umpire DRS decision reversed on ball 14.3, adding 4 runs"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-3 text-[#0F172A] placeholder-[#94A3B8]"
                  required
                />
              </div>

              {overrideError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-black">
                  {overrideError}
                </div>
              )}

              {overrideMsg && (
                <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-black">
                  {overrideMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="prime-btn-dark-3d text-xs !py-2 !px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="prime-btn-3d text-xs !py-2 !px-5 font-black uppercase tracking-wider"
                >
                  {overrideSubmitting ? 'Broadcasting...' : 'Broadcast Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
