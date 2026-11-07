'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { apiGet, apiPost, apiPut, apiDelete, getApiBase } from '../../lib/api';
import {
  Trophy, Plus, ChevronDown, ChevronUp, AlertCircle,
  Check, X, Shield, Clock, Users, ArrowRight, Layers,
  Radio, RefreshCw, Activity, Calendar, MapPin, Edit2, Trash2, Upload, ImageIcon
} from 'lucide-react';
import CategoryFilterTabs from '../../components/ui/CategoryFilterTabs';
import CategoryBadge from '../../components/ui/CategoryBadge';

export default function AdminCricketMatchesPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'matches' | 'telemetry' | 'squads'>('matches');
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Telemetry Inspector State
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);

  // 6-Step Match Creation & Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Form State
  const [teamA, setTeamA] = useState('India');
  const [teamB, setTeamB] = useState('South Africa');
  const [category, setCategory] = useState<'World Cup' | 'T20' | 'League' | "Women's">('World Cup');
  const [matchDate, setMatchDate] = useState('2026-11-15');
  const [matchTime, setMatchTime] = useState('19:30');
  const [venue, setVenue] = useState('Wankhede Stadium, Mumbai');
  const [teamALogo, setTeamALogo] = useState('/cricket/team_a.png');
  const [teamBLogo, setTeamBLogo] = useState('/cricket/team_b.png');
  const [matchPoster, setMatchPoster] = useState('/cricket/poster.png');
  const [lockMinutes, setLockMinutes] = useState(15);

  const [players, setPlayers] = useState<any[]>(() => {
    const roles: ('WK' | 'BAT' | 'AR' | 'BOWL')[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'WK', 'BAT', 'BOWL'];
    const list: any[] = [];
    for (let i = 1; i <= 15; i++) {
      list.push({ team_name: 'India', name: i === 1 ? 'Rohit Sharma' : i === 2 ? 'Virat Kohli' : `IND Player ${i}`, role: roles[i - 1], credits: 9.0 });
    }
    for (let i = 1; i <= 15; i++) {
      list.push({ team_name: 'South Africa', name: i === 1 ? 'Quinton de Kock' : i === 2 ? 'Kagiso Rabada' : `SA Player ${i}`, role: roles[i - 1], credits: 9.0 });
    }
    return list;
  });

  const [contests, setContests] = useState<any[]>([
    { type: 'standard', title: 'Mega Grand Contest ₹1,00,000', prize_pool: 100000, entry_fee: 49, total_spots: 2500 },
    { type: 'multi_battlefield', title: 'PUBG Battlefield Room #1', prize_pool: 2500, entry_fee: 99, total_spots: 25 },
    { type: 'h2h', title: 'H2H Custom Duel', prize_pool: 0, entry_fee: 0, total_spots: 2 },
  ]);

  const fetchMatches = async () => {
    if (!token) return;
    try {
      const url = selectedCategory === 'All' ? '/admin/cricket/matches' : `/admin/cricket/matches?category=${encodeURIComponent(selectedCategory)}`;
      const res = await apiGet(url, token);
      if (res?.matches) {
        setMatches(res.matches);
        if (!selectedMatchId && res.matches.length > 0) setSelectedMatchId(res.matches[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, [token, selectedCategory]);

  const fetchTelemetry = async (id: string) => {
    if (!id) return;
    setTelemetryLoading(true);
    try {
      const res = await apiGet(`/matches/${id}/telemetry`);
      if (res?.success) setTelemetry(res);
    } catch (e) {
      console.error(e);
    } finally {
      setTelemetryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMatchId) fetchTelemetry(selectedMatchId);
  }, [selectedMatchId]);

  const handleSyncLive = async () => {
    if (!selectedMatchId || !token) return;
    setSyncingLive(true);
    try {
      await apiPost(`/admin/cricket/matches/${selectedMatchId}/sync-live`, {}, token);
      await fetchTelemetry(selectedMatchId);
      await fetchMatches();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingLive(false);
    }
  };

  const handleStartCreate = () => {
    setEditingMatchId(null);
    setTeamA('India');
    setTeamB('South Africa');
    setCategory('World Cup');
    setMatchDate('2026-11-15');
    setMatchTime('19:30');
    setVenue('Wankhede Stadium, Mumbai');
    setTeamALogo('/cricket/team_a.png');
    setTeamBLogo('/cricket/team_b.png');
    setMatchPoster('/cricket/poster.png');
    setLockMinutes(15);
    const roles: ('WK' | 'BAT' | 'AR' | 'BOWL')[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'WK', 'BAT', 'BOWL'];
    const list: any[] = [];
    for (let i = 1; i <= 15; i++) {
      list.push({ team_name: 'India', name: i === 1 ? 'Rohit Sharma' : i === 2 ? 'Virat Kohli' : `IND Player ${i}`, role: roles[i - 1], credits: 9.0 });
    }
    for (let i = 1; i <= 15; i++) {
      list.push({ team_name: 'South Africa', name: i === 1 ? 'Quinton de Kock' : i === 2 ? 'Kagiso Rabada' : `SA Player ${i}`, role: roles[i - 1], credits: 9.0 });
    }
    setPlayers(list);
    setContests([
      { type: 'standard', title: 'Mega Grand Contest ₹1,00,000', prize_pool: 100000, entry_fee: 49, total_spots: 2500 },
      { type: 'multi_battlefield', title: 'PUBG Battlefield Room #1', prize_pool: 2500, entry_fee: 99, total_spots: 25 },
      { type: 'h2h', title: 'H2H Custom Duel', prize_pool: 0, entry_fee: 0, total_spots: 2 },
    ]);
    setFieldErrors({});
    setSuccessMsg(null);
    setCurrentStep(1);
    setShowModal(true);
  };

  const handleEditMatch = (m: any) => {
    setEditingMatchId(m.id);
    setTeamA(m.team_a || '');
    setTeamB(m.team_b || '');
    setCategory(m.category || 'World Cup');
    setMatchDate(m.match_date || '');
    setMatchTime(m.match_time || '');
    setVenue(m.venue || '');
    setTeamALogo(m.team_a_logo || '/cricket/team_a.png');
    setTeamBLogo(m.team_b_logo || '/cricket/team_b.png');
    setMatchPoster(m.match_poster || '/cricket/poster.png');
    setLockMinutes(m.lock_time_minutes || 15);

    if (m.players && m.players.length === 30) {
      setPlayers(m.players.map((p: any) => ({
        team_name: p.team_name,
        name: p.name,
        role: p.role || 'BAT',
        credits: p.credits || 9.0
      })));
    } else {
      const roles: ('WK' | 'BAT' | 'AR' | 'BOWL')[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'WK', 'BAT', 'BOWL'];
      const list: any[] = [];
      const tAName = m.team_a || 'Team A';
      const tBName = m.team_b || 'Team B';
      for (let i = 1; i <= 15; i++) {
        list.push({ team_name: tAName, name: `${tAName} Player ${i}`, role: roles[i - 1], credits: 9.0 });
      }
      for (let i = 1; i <= 15; i++) {
        list.push({ team_name: tBName, name: `${tBName} Player ${i}`, role: roles[i - 1], credits: 9.0 });
      }
      setPlayers(list);
    }

    if (m.contests && m.contests.length > 0) {
      setContests(m.contests.map((c: any) => ({
        type: c.type || 'standard',
        title: c.title,
        prize_pool: c.prize_pool,
        entry_fee: c.entry_fee,
        total_spots: c.total_spots
      })));
    } else {
      setContests([
        { type: 'standard', title: 'Mega Grand Contest ₹1,00,000', prize_pool: 100000, entry_fee: 49, total_spots: 2500 },
        { type: 'multi_battlefield', title: 'PUBG Battlefield Room #1', prize_pool: 2500, entry_fee: 99, total_spots: 25 },
        { type: 'h2h', title: 'H2H Custom Duel', prize_pool: 0, entry_fee: 0, total_spots: 2 },
      ]);
    }

    setFieldErrors({});
    setSuccessMsg(null);
    setCurrentStep(1);
    setShowModal(true);
  };

  const handleDeleteMatch = async (m: any) => {
    const ok = window.confirm(`Are you sure you want to permanently delete "${m.title}"?\n\nThis will remove the match, all associated contests, 30-player rosters, and contest records.`);
    if (!ok) return;

    try {
      const res = await apiDelete(`/admin/cricket/matches/${m.id}`, token);
      if (res?.success) {
        setMatches(prev => prev.filter(item => item.id !== m.id));
        if (selectedMatchId === m.id) setSelectedMatchId(null);
        alert(res.message || 'Match and contests deleted successfully.');
        fetchMatches();
      } else {
        alert(res?.error || 'Failed to delete match');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting match');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'team_a' | 'team_b' | 'poster') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploadingField(field);
    try {
      const base = getApiBase();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${base}/admin/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (data?.url) {
        if (field === 'team_a') setTeamALogo(data.url);
        else if (field === 'team_b') setTeamBLogo(data.url);
        else if (field === 'poster') setMatchPoster(data.url);
      } else {
        alert(data?.error || 'Failed to upload image');
      }
    } catch (err: any) {
      alert(err?.message || 'Error uploading file');
    } finally {
      setUploadingField(null);
    }
  };

  const handleCreateSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});
    setSuccessMsg(null);
    try {
      const payload = {
        team_a: teamA, team_b: teamB, category, match_date: matchDate, match_time: matchTime,
        venue, team_a_logo: teamALogo, team_b_logo: teamBLogo, match_poster: matchPoster,
        players, contests, lock_time_minutes: lockMinutes,
      };

      let res;
      if (editingMatchId) {
        res = await apiPut(`/admin/cricket/matches/${editingMatchId}`, payload, token);
      } else {
        res = await apiPost('/admin/cricket/matches/verify-and-create', payload, token);
      }

      if (res?.success) {
        setSuccessMsg(editingMatchId ? '✅ Match & contests updated successfully in database!' : '✅ Match verified against live DB & published successfully!');
        setTimeout(() => { setShowModal(false); setCurrentStep(1); fetchMatches(); }, 1200);
      } else {
        const errors = res?.field_errors || { general: res?.error || 'Verification/Update failed' };
        setFieldErrors(errors);
        const keys = Object.keys(errors);
        if (keys.some(k => ['team_a', 'team_b', 'category', 'match_date', 'match_time', 'venue'].includes(k))) setCurrentStep(1);
        else if (keys.some(k => ['team_a_logo', 'team_b_logo', 'match_poster'].includes(k))) setCurrentStep(2);
        else if (keys.some(k => k === 'players' || k.startsWith('player_'))) setCurrentStep(3);
        else if (keys.some(k => k === 'contests')) setCurrentStep(4);
        else if (keys.some(k => k === 'lock_time_minutes')) setCurrentStep(5);
      }
    } catch (err: any) {
      setFieldErrors({ general: err?.message || 'Database rejected verification or update.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-3 sm:px-6 py-6 max-w-7xl mx-auto w-full space-y-6 bg-[#000000] text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#FF1744]" />
            <span>Cricket Match Operations &amp; Database</span>
          </h1>
          <p className="text-xs text-[#A3A3A3] font-bold mt-0.5">
            Real-time cricket telemetry, squad verification, fixtures schedule, and Cricbuzz live sync
          </p>
        </div>
        <button
          onClick={handleStartCreate}
          className="prime-btn-3d text-xs !py-2.5 !px-5 font-black uppercase tracking-wider flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Match (6-Step)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3">
        {(['matches', 'telemetry', 'squads'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeTab === tab ? 'prime-btn-gold-3d' : 'prime-btn-dark-3d !text-[#A3A3A3]'
            }`}
          >
            {tab === 'matches' && 'Matches & Contests'}
            {tab === 'telemetry' && 'Live In-Play Telemetry'}
            {tab === 'squads' && '30-Player Squads'}
          </button>
        ))}
      </div>

      {/* TAB 1: MATCHES & CONTESTS */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          <CategoryFilterTabs selectedCategory={selectedCategory} onSelect={setSelectedCategory} />

          {/* 🔴 Table 1: Live In-Play Matches */}
          <div className="prime-card-3d overflow-hidden border-2 border-[#FF1744]/40">
            <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#000000]">
              <span className="font-black text-xs text-[#FF1744] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF1744] animate-ping" />
                Live In-Play Matches ({matches.filter(m => m.status === 'live').length})
              </span>
              <span className="text-[11px] text-[#A3A3A3] font-bold">Real-time live telemetry active</span>
            </div>

            {matches.filter(m => m.status === 'live').length === 0 ? (
              <div className="p-6 text-center text-[#A3A3A3] text-xs font-bold">No matches currently LIVE.</div>
            ) : (
              <div className="divide-y divide-[#1A1A1A]">
                {matches.filter(m => m.status === 'live').map((m) => {
                  const isExp = expandedMatchId === m.id;
                  const tA = (m.players || []).filter((p: any) => p.team_name === m.team_a);
                  const tB = (m.players || []).filter((p: any) => p.team_name === m.team_b);
                  return (
                    <div key={m.id} className="bg-[#0A0A0A] hover:bg-[#111111] transition">
                      <div
                        onClick={() => setExpandedMatchId(isExp ? null : m.id)}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryBadge category={m.category} size="xs" />
                          <div>
                            <h4 className="font-black text-white text-sm sm:text-base">{m.title}</h4>
                            <p className="text-xs text-[#FFD700] font-mono font-bold mt-0.5">
                              🔴 LIVE INNINGS • {m.score_summary?.team_a ? `${m.score_summary.team_a.runs}/${m.score_summary.team_a.wickets} (${m.score_summary.team_a.overs} ov)` : 'In Progress'} • 📍 {m.venue || 'Stadium'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="neon-badge-red px-2.5 py-1 rounded-full text-xs font-black uppercase">
                            🔴 LIVE
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMatchId(m.id);
                              setActiveTab('telemetry');
                            }}
                            className="prime-btn-3d text-[11px] !py-1 !px-3 font-black"
                          >
                            Live Telemetry Deck &rarr;
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#3A3A3A] text-xs font-black text-[#FFD700] flex items-center gap-1 transition"
                            title="Edit match & contests"
                          >
                            <Edit2 className="w-3 h-3 text-[#FFD700]" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-xs font-black text-[#FF8095] flex items-center gap-1 transition"
                            title="Delete match and contests"
                          >
                            <Trash2 className="w-3 h-3 text-[#FF1744]" />
                            <span>Delete</span>
                          </button>
                          {isExp ? <ChevronUp className="w-4 h-4 text-[#FFD700]" /> : <ChevronDown className="w-4 h-4 text-[#A3A3A3]" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="p-4 bg-[#000000] border-t border-[#222222] space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#FF1744]/40 space-y-2">
                              <h5 className="text-xs font-black text-[#FF8095] uppercase">{m.team_a} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tA.length > 0 ? tA : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${m.team_a} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#000000] border border-[#222222] flex justify-between text-[11px]">
                                    <span className="truncate text-white font-bold">{p.name}</span>
                                    <span className="text-[#FFD700] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#FFD700]/40 space-y-2">
                              <h5 className="text-xs font-black text-[#FFD700] uppercase">{m.team_b} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tB.length > 0 ? tB : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${m.team_b} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#000000] border border-[#222222] flex justify-between text-[11px]">
                                    <span className="truncate text-white font-bold">{p.name}</span>
                                    <span className="text-[#FFD700] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ⚡ Table 2: All Upcoming Matches Master Database */}
          <div className="prime-card-3d overflow-hidden border border-[#222222]">
            <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#000000]">
              <span className="font-black text-xs text-[#FFD700] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FFD700]" />
                All Upcoming Matches Database ({matches.filter(m => m.status === 'upcoming').length})
              </span>
              <span className="text-[11px] text-[#A3A3A3] font-bold">Click match row to inspect schedule &amp; 15+15 squad roster</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-[#A3A3A3] font-bold">Loading cricket database...</div>
            ) : matches.filter(m => m.status === 'upcoming').length === 0 ? (
              <div className="p-12 text-center text-[#A3A3A3] font-bold">No upcoming matches found in this category.</div>
            ) : (
              <div className="divide-y divide-[#1A1A1A]">
                {matches.filter(m => m.status === 'upcoming').map((m) => {
                  const isExp = expandedMatchId === m.id;
                  const tA = (m.players || []).filter((p: any) => p.team_name === m.team_a);
                  const tB = (m.players || []).filter((p: any) => p.team_name === m.team_b);
                  return (
                    <div key={m.id} className="bg-[#0A0A0A] hover:bg-[#111111] transition">
                      <div
                        onClick={() => setExpandedMatchId(isExp ? null : m.id)}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryBadge category={m.category} size="xs" />
                          <div>
                            <h4 className="font-black text-white text-sm sm:text-base">{m.title}</h4>
                            <p className="text-xs text-[#A3A3A3] font-bold mt-0.5">
                              📅 Date: <span className="text-white">{m.match_date}</span> • ⏰ Time: <span className="text-[#FFD700] font-mono">{m.match_time}</span> • 📍 Venue: <span className="text-white">{m.venue || 'Stadium'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-[#000000] border border-[#FF1744]/40 text-xs font-mono font-bold text-[#FF8095]">
                            {m.team_a}: {tA.length || 15}
                          </span>
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-[#000000] border border-[#FFD700]/40 text-xs font-mono font-bold text-[#FFE082]">
                            {m.team_b}: {tB.length || 15}
                          </span>
                          <span className="bg-[#141414] text-[#D4D4D4] border border-[#262626] px-2.5 py-1 rounded-full text-xs font-black">
                            UPCOMING
                          </span>
                          <span className="text-xs font-black text-[#FFD700]">{(m.contests || []).length} Contests</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#3A3A3A] text-xs font-black text-[#FFD700] flex items-center gap-1 transition"
                            title="Edit match & contests"
                          >
                            <Edit2 className="w-3 h-3 text-[#FFD700]" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-xs font-black text-[#FF8095] flex items-center gap-1 transition"
                            title="Delete match and contests"
                          >
                            <Trash2 className="w-3 h-3 text-[#FF1744]" />
                            <span>Delete</span>
                          </button>
                          {isExp ? <ChevronUp className="w-4 h-4 text-[#FFD700]" /> : <ChevronDown className="w-4 h-4 text-[#A3A3A3]" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="p-4 bg-[#000000] border-t border-[#222222] space-y-4">
                          <div className="p-3 rounded-xl bg-[#0D0D0D] border border-[#262626] flex flex-wrap items-center justify-between gap-3 text-xs text-[#A3A3A3]">
                            <span>📅 Match Date: <strong className="text-white">{m.match_date}</strong></span>
                            <span>⏰ Start Time: <strong className="text-[#FFD700]">{m.match_time}</strong></span>
                            <span>📍 Venue: <strong className="text-white">{m.venue || 'Stadium'}</strong></span>
                            <span>🔒 Contest Lock: <strong className="text-white">{m.lock_time_minutes || 15}m before match</strong></span>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#FF1744]/40 space-y-2">
                              <h5 className="text-xs font-black text-[#FF8095] uppercase">{m.team_a} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tA.length > 0 ? tA : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${m.team_a} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#000000] border border-[#222222] flex justify-between text-[11px]">
                                    <span className="truncate text-white font-bold">{p.name}</span>
                                    <span className="text-[#FFD700] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#FFD700]/40 space-y-2">
                              <h5 className="text-xs font-black text-[#FFD700] uppercase">{m.team_b} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tB.length > 0 ? tB : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${m.team_b} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#000000] border border-[#222222] flex justify-between text-[11px]">
                                    <span className="truncate text-white font-bold">{p.name}</span>
                                    <span className="text-[#FFD700] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-4 gap-2">
                            {(m.contests || []).map((c: any) => (
                              <div key={c.id} className="p-2.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-xs">
                                <span className="font-black text-white block truncate">{c.title}</span>
                                <span className="text-[#FFD700] text-[10px] font-mono block">
                                  {c.type === 'h2h' ? 'H2H Duel (User Fee)' : `Fee: ₹${c.entry_fee} • Pool: ₹${c.prize_pool}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0A0A0A] border border-[#222222]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#FFD700] uppercase">Live Match:</span>
              <select
                value={selectedMatchId || ''}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#000000] border border-[#333333] text-white text-xs font-black outline-none"
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>{m.team_a} vs {m.team_b} ({m.status.toUpperCase()})</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSyncLive}
              disabled={syncingLive}
              className="prime-btn-3d text-xs !py-1.5 !px-3 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
              <span>Advance Ball / Sync</span>
            </button>
          </div>

          {telemetryLoading ? (
            <div className="p-12 text-center text-[#A3A3A3] font-bold">Streaming live telemetry...</div>
          ) : telemetry?.match ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 prime-card-3d p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
                  <h3 className="text-xs font-black text-[#FFD700] uppercase flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-[#FF1744] animate-pulse" />
                    <span>In-Play Live Stream</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Cricbuzz Active</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-black text-white">{telemetry.match.team_a}</h4>
                    <p className="text-2xl font-black text-[#FFD700]">
                      {telemetry.match.score_summary?.team_a?.runs || 146}/{telemetry.match.score_summary?.team_a?.wickets || 3}
                      <span className="text-xs font-normal text-[#A3A3A3] ml-1">
                        ({telemetry.match.score_summary?.team_a?.overs || 16.4} ov)
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <h4 className="text-lg font-black text-white">{telemetry.match.team_b}</h4>
                    <p className="text-xs font-bold text-[#A3A3A3]">Yet to bat</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#222222] flex items-center gap-2">
                  <span className="text-[10px] text-[#A3A3A3] font-bold uppercase">This Over:</span>
                  <div className="flex gap-1.5">
                    {(telemetry.match.live_data?.recent_balls || ['1', '0', '4', '2', 'W', '1']).map((token: string, i: number) => (
                      <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                        token === 'W' ? 'bg-[#FF1744] text-white' : token === '4' || token === '6' ? 'bg-[#FFD700] text-black' : 'bg-[#141414] text-white border border-[#333333]'
                      }`}>
                        {token}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-mono font-bold text-[#A3A3A3] ml-auto">
                    CRR: {telemetry.match.live_data?.current_rate || '8.76'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-[#000000] border border-[#FFD700]/40 space-y-1">
                    <span className="text-[10px] text-[#FFD700] font-black uppercase block">Active Striker</span>
                    <p className="font-black text-white text-sm">
                      🏏 {telemetry.match.live_data?.current_striker?.name || 'Striker'} *
                    </p>
                    <p className="text-xs font-mono text-[#FFD700]">
                      {telemetry.match.live_data?.current_striker?.runs || 48} runs ({telemetry.match.live_data?.current_striker?.balls || 32}b)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#000000] border border-[#FF1744]/40 space-y-1">
                    <span className="text-[10px] text-[#FF1744] font-black uppercase block">Active Bowler</span>
                    <p className="font-black text-white text-sm">
                      ⚾ {telemetry.match.live_data?.current_bowler?.name || 'Bowler'}
                    </p>
                    <p className="text-xs font-mono text-[#FF1744]">
                      {telemetry.match.live_data?.current_bowler?.wickets || 2} wkts / {telemetry.match.live_data?.current_bowler?.runs || 28} runs
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 prime-card-3d p-4 flex flex-col h-[360px]">
                <h4 className="text-xs font-black text-[#FFD700] uppercase mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#FF1744]" />
                  <span>Live Commentary</span>
                </h4>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {(telemetry.match.live_data?.commentary || [
                    '⚡ FOUR! Beautiful cover drive!',
                    'Single pushed towards long-off.',
                    'Dot ball, good length.',
                    '🔴 WICKET! Clean bowled!',
                  ]).map((line: string, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-[#000000] border border-[#222222] text-xs font-bold text-white">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: SQUADS EXPLORER */}
      {activeTab === 'squads' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0A0A0A] border border-[#222222]">
            <span className="text-xs font-black text-[#FFD700] uppercase">Inspect Roster:</span>
            <select
              value={selectedMatchId || ''}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#000000] border border-[#333333] text-white text-xs font-black outline-none"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>{m.team_a} vs {m.team_b}</option>
              ))}
            </select>
            <span className="neon-badge-gold px-2.5 py-0.5 rounded-full text-[10px] font-black ml-auto">
              30/30 Players Pool
            </span>
          </div>

          {telemetry?.match && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[
                { team: telemetry.match.team_a, border: 'border-[#FF1744]/40', badge: 'text-[#FF8095]' },
                { team: telemetry.match.team_b, border: 'border-[#FFD700]/40', badge: 'text-[#FFD700]' }
              ].map(({ team, border, badge }) => {
                const teamPlayers = (telemetry.players || []).filter((p: any) => p.team_name === team);
                return (
                  <div key={team} className={`prime-card-3d p-4 space-y-3 border-2 ${border}`}>
                    <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
                      <h4 className={`font-black text-sm uppercase ${badge}`}>{team} Squad</h4>
                      <span className="text-xs font-mono font-bold text-white">{teamPlayers.length || 15} Players</span>
                    </div>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {(teamPlayers.length > 0 ? teamPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `${team}-${i}`, name: `${team} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, i: number) => (
                        <div key={p.id || i} className="p-2 rounded-lg bg-[#000000] border border-[#222222] flex justify-between items-center text-xs">
                          <span className="font-bold text-white truncate">#{i + 1} {p.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#141414] text-[#FFD700] border border-[#FFD700]/30">{p.role}</span>
                            <span className="font-mono text-[11px] text-[#A3A3A3]">{p.credits || 9.0} Cr</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6-Step Match Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-2xl bg-[#0A0A0A] border-2 border-[#FF1744] rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-[#222222] pb-3">
              <div>
                <h3 className="font-black text-white text-base">
                  {editingMatchId ? '✏️ Edit Match & Contests' : '⚡ Create Match'} (Step {currentStep} of 6)
                </h3>
                <span className="text-xs text-[#FFD700] font-bold">
                  {currentStep === 1 && 'Match Details & Category Selector'}
                  {currentStep === 2 && 'Team Logos & Poster'}
                  {currentStep === 3 && '30 Squad Players (15 + 15)'}
                  {currentStep === 4 && 'Contests Configuration'}
                  {currentStep === 5 && 'Lock Time Window'}
                  {currentStep === 6 && 'DB Verification & Publish'}
                </span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#A3A3A3] hover:text-white">✕</button>
            </div>

            {fieldErrors.general && (
              <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
                <span>{fieldErrors.general}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded-lg bg-green-950/80 border border-green-500/50 text-green-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {currentStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#A3A3A3] font-black uppercase">Team A Name *</label>
                      <input
                        type="text"
                        value={teamA}
                        onChange={(e) => {
                          setTeamA(e.target.value);
                          setPlayers(prev => prev.map((p, idx) => idx < 15 ? { ...p, team_name: e.target.value } : p));
                        }}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#000000] border border-[#333333] text-white font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A3A3A3] font-black uppercase">Team B Name *</label>
                      <input
                        type="text"
                        value={teamB}
                        onChange={(e) => {
                          setTeamB(e.target.value);
                          setPlayers(prev => prev.map((p, idx) => idx >= 15 ? { ...p, team_name: e.target.value } : p));
                        }}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#000000] border border-[#333333] text-white font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#FFD700] font-black uppercase">Category * (Mandatory 1 of 4)</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {(['World Cup', 'T20', 'League', "Women's"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`p-2 rounded-lg border text-xs font-bold ${
                            category === cat ? 'bg-[#FF1744] text-white border-[#FF1744]' : 'bg-[#000000] text-[#A3A3A3] border-[#262626]'
                          }`}
                        >
                          <CategoryBadge category={cat} size="xs" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#A3A3A3] font-black uppercase">Match Date *</label>
                      <input
                        type="date"
                        value={matchDate}
                        onChange={(e) => setMatchDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#000000] border border-[#333333] text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A3A3A3] font-black uppercase">Match Time *</label>
                      <input
                        type="time"
                        value={matchTime}
                        onChange={(e) => setMatchTime(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#000000] border border-[#333333] text-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#A3A3A3] font-black uppercase">Venue / Stadium</label>
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-[#000000] border border-[#333333] text-white outline-none"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#000000] border border-[#222222] text-[11px] text-[#A3A3A3] space-y-1">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#FFD700]" />
                      <span>Image Guidelines &amp; Direct Upload</span>
                    </p>
                    <p>
                      Aap direct Google Images / Cricbuzz / Web se kisi bhi image ka direct URL paste kar sakte hain, ya fir apne device (computer/phone) se <strong>Upload File</strong> button dabakar directly upload kar sakte hain. Dono tarike fully supported hain!
                    </p>
                  </div>

                  {/* Team A Logo */}
                  <div className="p-3 rounded-xl bg-[#000000] border border-[#222222] space-y-2">
                    <label className="text-[10px] text-[#FF8095] font-black uppercase">{teamA} Logo (Web URL or Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={teamALogo}
                        onChange={(e) => setTeamALogo(e.target.value)}
                        placeholder="https://... or /cricket/team_a.png"
                        className="flex-1 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#333333] text-white outline-none font-mono text-xs"
                      />
                      <label className="cursor-pointer px-3 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-[#3A3A3A] text-xs font-black text-[#FFD700] flex items-center gap-1.5 transition shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingField === 'team_a' ? 'Uploading...' : 'Upload File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingField === 'team_a'}
                          onChange={(e) => handleFileUpload(e, 'team_a')}
                          className="hidden"
                        />
                      </label>
                      {teamALogo && (
                        <img
                          src={teamALogo}
                          alt="Team A"
                          className="w-9 h-9 rounded-lg border border-[#333333] object-contain bg-[#111111] shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Team B Logo */}
                  <div className="p-3 rounded-xl bg-[#000000] border border-[#222222] space-y-2">
                    <label className="text-[10px] text-[#FFD700] font-black uppercase">{teamB} Logo (Web URL or Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={teamBLogo}
                        onChange={(e) => setTeamBLogo(e.target.value)}
                        placeholder="https://... or /cricket/team_b.png"
                        className="flex-1 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#333333] text-white outline-none font-mono text-xs"
                      />
                      <label className="cursor-pointer px-3 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-[#3A3A3A] text-xs font-black text-[#FFD700] flex items-center gap-1.5 transition shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingField === 'team_b' ? 'Uploading...' : 'Upload File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingField === 'team_b'}
                          onChange={(e) => handleFileUpload(e, 'team_b')}
                          className="hidden"
                        />
                      </label>
                      {teamBLogo && (
                        <img
                          src={teamBLogo}
                          alt="Team B"
                          className="w-9 h-9 rounded-lg border border-[#333333] object-contain bg-[#111111] shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Match Poster */}
                  <div className="p-3 rounded-xl bg-[#000000] border border-[#222222] space-y-2">
                    <label className="text-[10px] text-[#A3A3A3] font-black uppercase">Match Poster / Banner (Web URL or Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={matchPoster}
                        onChange={(e) => setMatchPoster(e.target.value)}
                        placeholder="https://... or /cricket/poster.png"
                        className="flex-1 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#333333] text-white outline-none font-mono text-xs"
                      />
                      <label className="cursor-pointer px-3 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-[#3A3A3A] text-xs font-black text-[#FFD700] flex items-center gap-1.5 transition shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingField === 'poster' ? 'Uploading...' : 'Upload File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingField === 'poster'}
                          onChange={(e) => handleFileUpload(e, 'poster')}
                          className="hidden"
                        />
                      </label>
                      {matchPoster && (
                        <img
                          src={matchPoster}
                          alt="Poster"
                          className="w-9 h-9 rounded-lg border border-[#333333] object-cover bg-[#111111] shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[#FFD700] uppercase">30 Players Pool</span>
                    <span className="text-[#A3A3A3]">15 {teamA} + 15 {teamB}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      { team: teamA, start: 0, end: 15, labelColor: 'text-[#FF8095]' },
                      { team: teamB, start: 15, end: 30, labelColor: 'text-[#FFD700]' }
                    ].map(({ team, start, end, labelColor }) => (
                      <div key={team} className="space-y-1.5">
                        <span className={`font-black text-xs uppercase ${labelColor}`}>{team}</span>
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                          {players.slice(start, end).map((p, idx) => {
                            const realIdx = start + idx;
                            return (
                              <div key={realIdx} className="p-1.5 rounded bg-[#000000] border border-[#222222] flex items-center gap-1.5">
                                <span className="text-[10px] text-[#A3A3A3] w-4">{idx + 1}</span>
                                <input
                                  type="text"
                                  value={p.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPlayers(prev => prev.map((item, i) => i === realIdx ? { ...item, name: val } : item));
                                  }}
                                  className="flex-1 px-2 py-0.5 rounded bg-[#111111] border border-[#333333] text-white text-xs outline-none"
                                />
                                <select
                                  value={p.role}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPlayers(prev => prev.map((item, i) => i === realIdx ? { ...item, role: val } : item));
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-[#111111] border border-[#333333] text-[#FFD700] text-[10px] font-bold outline-none"
                                >
                                  <option value="WK">WK</option>
                                  <option value="BAT">BAT</option>
                                  <option value="AR">AR</option>
                                  <option value="BOWL">BOWL</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[#FFD700] uppercase">Contests Configuration</span>
                    <button
                      type="button"
                      onClick={() => setContests(prev => [...prev, { type: 'standard', title: `Contest #${prev.length + 1}`, prize_pool: 10000, entry_fee: 25, total_spots: 500 }])}
                      className="text-xs font-black text-[#FFD700] hover:underline"
                    >
                      + Add Contest
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {contests.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-[#000000] border border-[#222222] space-y-2">
                        <div className="flex justify-between items-center">
                          <input
                            type="text"
                            value={c.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setContests(prev => prev.map((item, i) => i === idx ? { ...item, title: val } : item));
                            }}
                            className="font-bold text-xs bg-transparent text-white border-b border-[#333333] outline-none w-2/3"
                          />
                          {contests.length > 1 && (
                            <button type="button" onClick={() => setContests(prev => prev.filter((_, i) => i !== idx))} className="text-[#A3A3A3] hover:text-[#FF1744] text-xs">
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={c.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              setContests(prev => prev.map((item, i) => i === idx ? { ...item, type: val } : item));
                            }}
                            className="px-2 py-1 rounded bg-[#111111] border border-[#333333] text-[#FFD700] font-bold text-xs"
                          >
                            <option value="standard">Standard</option>
                            <option value="multi_battlefield">Battlefield</option>
                            <option value="h2h">H2H</option>
                          </select>

                          {c.type === 'h2h' ? (
                            <div className="col-span-2 text-[10px] text-[#FFD700] flex items-center font-bold">
                              User specifies entry fee on challenge (85% win split)
                            </div>
                          ) : (
                            <>
                              <input
                                type="number"
                                placeholder="Fee"
                                value={c.entry_fee}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setContests(prev => prev.map((item, i) => i === idx ? { ...item, entry_fee: val } : item));
                                }}
                                className="px-2 py-1 rounded bg-[#111111] border border-[#333333] text-white text-xs"
                              />
                              <input
                                type="number"
                                placeholder="Pool"
                                value={c.prize_pool}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setContests(prev => prev.map((item, i) => i === idx ? { ...item, prize_pool: val } : item));
                                }}
                                className="px-2 py-1 rounded bg-[#111111] border border-[#333333] text-white text-xs"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-3 p-4 rounded-xl bg-[#000000] border border-[#222222]">
                  <h4 className="font-black text-xs text-[#FFD700] uppercase">Contest Lock Timing</h4>
                  <p className="text-xs text-[#A3A3A3]">
                    Contests automatically lock X minutes before start time.
                  </p>
                  <div className="flex gap-2">
                    {[5, 10, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setLockMinutes(mins)}
                        className={`px-4 py-2 rounded-xl text-xs font-black ${
                          lockMinutes === mins ? 'prime-btn-3d' : 'prime-btn-dark-3d'
                        }`}
                      >
                        {mins} Mins
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-3 p-4 rounded-xl bg-[#000000] border border-[#222222]">
                  <h4 className="font-black text-xs text-[#FFD700] uppercase">
                    {editingMatchId ? 'Ready to Update Database' : 'Ready for DB Verification'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#A3A3A3]">Match:</span> <strong className="text-white ml-1">{teamA} vs {teamB}</strong></div>
                    <div><span className="text-[#A3A3A3]">Category:</span> <strong className="text-[#FFD700] ml-1">{category}</strong></div>
                    <div><span className="text-[#A3A3A3]">Squad:</span> <strong className="text-white ml-1">{players.length} Players</strong></div>
                    <div><span className="text-[#A3A3A3]">Contests:</span> <strong className="text-white ml-1">{contests.length} Configured</strong></div>
                    <div><span className="text-[#A3A3A3]">Lock Time:</span> <strong className="text-white ml-1">{lockMinutes}m before start</strong></div>
                    <div><span className="text-[#A3A3A3]">Mode:</span> <strong className="text-[#FF8095] ml-1">{editingMatchId ? 'Update Existing' : 'New Creation'}</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="pt-3 border-t border-[#222222] flex justify-between">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="prime-btn-dark-3d !py-1.5 !px-4 text-xs font-black"
                >
                  &larr; Back
                </button>
              ) : <div />}

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="prime-btn-3d !py-1.5 !px-5 text-xs font-black uppercase tracking-wider"
                >
                  Next &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateSubmit}
                  disabled={submitting}
                  className="prime-btn-gold-3d !py-2 !px-6 text-xs font-black uppercase tracking-wider"
                >
                  {submitting
                    ? (editingMatchId ? 'Updating Database...' : 'Verifying with DB...')
                    : (editingMatchId ? 'Update Match & Contests' : 'Verify & Publish')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
