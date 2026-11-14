'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiGet, apiPost, apiPut, apiDelete, getApiBase, resolveImageUrl } from '../../lib/api';
import {
  Trophy, Plus, ChevronDown, ChevronUp, AlertCircle,
  Check, X, Shield, Clock, Users, ArrowRight, Layers,
  Radio, RefreshCw, Activity, Calendar, MapPin, Edit2, Trash2, Upload, ImageIcon, Zap
} from 'lucide-react';
import CategoryFilterTabs from '../../components/ui/CategoryFilterTabs';
import CategoryBadge from '../../components/ui/CategoryBadge';

function AdminCricketMatchesContent() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const importCbId = searchParams.get('import');

  const [activeTab, setActiveTab] = useState<'matches' | 'telemetry' | 'squads'>('matches');
  const [matches, setMatches] = useState<any[]>([]);
  const [cricbuzzUpcoming, setCricbuzzUpcoming] = useState<any[]>([]);
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
      list.push({ team_name: 'India', name: i === 1 ? 'Rohit Sharma' : i === 2 ? 'Virat Kohli' : `IND Player ${i}`, role: roles[i - 1], credits: 9.0, photo_url: '' });
    }
    for (let i = 1; i <= 15; i++) {
      list.push({ team_name: 'South Africa', name: i === 1 ? 'Quinton de Kock' : i === 2 ? 'Kagiso Rabada' : `SA Player ${i}`, role: roles[i - 1], credits: 9.0, photo_url: '' });
    }
    return list;
  });

  const [contests, setContests] = useState<any[]>([
    { type: 'mega', title: 'Mega Grand Contest ₹1,00,000', prize_pool: 100000, entry_fee: 49, total_spots: 10000, bot_spots: 10000 },
    { type: 'multi_battlefield', title: 'PUBG Battlefield Room #1', prize_pool: 2500, entry_fee: 99, total_spots: 25, bot_spots: 7 },
    { type: 'mini', title: 'Mini Quick Contest ₹1,000', prize_pool: 1000, entry_fee: 25, total_spots: 100, bot_spots: 25 },
    { type: 'practice', title: 'Practice Contest (Free)', prize_pool: 0, entry_fee: 0, total_spots: 50, bot_spots: 10 },
    { type: 'private', title: 'Private Friends Contest', prize_pool: 500, entry_fee: 25, total_spots: 20, bot_spots: 0 },
    { type: 'h2h', title: 'H2H Custom Duel', prize_pool: 0, entry_fee: 0, total_spots: 2, bot_spots: 0 },
  ]);

  const handleSelectCricbuzzFixture = (cbMatch: any) => {
    if (!cbMatch) return;
    setEditingMatchId(null);
    setTeamA(cbMatch.team_a || '');
    setTeamB(cbMatch.team_b || '');
    setCategory(cbMatch.category || 'League');
    setMatchDate(cbMatch.match_date || new Date().toISOString().split('T')[0]);
    setMatchTime(cbMatch.match_time || '19:30');
    setVenue(cbMatch.venue || `${cbMatch.team_a} International Stadium`);
    setTeamALogo(cbMatch.team_a_logo || '');
    setTeamBLogo(cbMatch.team_b_logo || '');
    setMatchPoster(cbMatch.match_poster || '');

    const list: any[] = [];
    const sA = cbMatch.squad_a || [];
    const sB = cbMatch.squad_b || [];
    for (let i = 0; i < 15; i++) {
      const p = sA[i];
      list.push({
        team_name: cbMatch.team_a,
        name: p?.name || `${cbMatch.team_a} Player ${i + 1}`,
        role: p?.role || 'BAT',
        credits: p?.credits || 9.0,
        photo_url: p?.photo_url || '',
      });
    }
    for (let i = 0; i < 15; i++) {
      const p = sB[i];
      list.push({
        team_name: cbMatch.team_b,
        name: p?.name || `${cbMatch.team_b} Player ${i + 1}`,
        role: p?.role || 'BAT',
        credits: p?.credits || 9.0,
        photo_url: p?.photo_url || '',
      });
    }
    setPlayers(list);
    setFieldErrors({});
    setSuccessMsg(`⚡ Auto-filled details & 30 players from ${cbMatch.team_a} vs ${cbMatch.team_b}`);
  };

  const fetchMatches = async () => {
    if (!token) return;
    try {
      const url = selectedCategory === 'All' ? '/admin/cricket/matches' : `/admin/cricket/matches?category=${encodeURIComponent(selectedCategory)}`;
      const res = await apiGet(url, token);
      if (res?.matches) {
        setMatches(res.matches);
        if (!selectedMatchId && res.matches.length > 0) setSelectedMatchId(res.matches[0].id);
      }

      // Also fetch upcoming Cricbuzz fixtures for quick auto-fill
      const cbRes = await apiGet('/admin/cricbuzz/feed', token);
      if (cbRes?.upcomingMatches) {
        setCricbuzzUpcoming(cbRes.upcomingMatches);
        if (importCbId) {
          const target = cbRes.upcomingMatches.find((u: any) => u.cricbuzz_id === importCbId);
          if (target) {
            handleSelectCricbuzzFixture(target);
            setShowModal(true);
            setCurrentStep(1);
          }
        }
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
    if (cricbuzzUpcoming.length > 0) {
      handleSelectCricbuzzFixture(cricbuzzUpcoming[0]);
    } else {
      setTeamA('India');
      setTeamB('South Africa');
      setCategory('World Cup');
      setMatchDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
      setMatchTime('19:30');
      setVenue('Wankhede Stadium, Mumbai');
      setTeamALogo('https://flagcdn.com/w160/in.png');
      setTeamBLogo('https://flagcdn.com/w160/za.png');
      setMatchPoster('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&auto=format&fit=crop&q=80');
      setLockMinutes(15);
      const roles: ('WK' | 'BAT' | 'AR' | 'BOWL')[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'WK', 'BAT', 'BOWL'];
      const indSquad = ['Rohit Sharma', 'Shubman Gill', 'Virat Kohli', 'KL Rahul', 'Rishabh Pant', 'Hardik Pandya', 'Ravindra Jadeja', 'Ravichandran Ashwin', 'Jasprit Bumrah', 'Mohammed Siraj', 'Mohammed Shami', 'Ishan Kishan', 'Shreyas Iyer', 'Kuldeep Yadav', 'Shardul Thakur'];
      const saSquad = ['Quinton de Kock', 'Temba Bavuma', 'Aiden Markram', 'Rassie van der Dussen', 'David Miller', 'Heinrich Klaasen', 'Marco Jansen', 'Keshav Maharaj', 'Kagiso Rabada', 'Anrich Nortje', 'Lungi Ngidi', 'Gerald Coetzee', 'Tristan Stubbs', 'Reeza Hendricks', 'Tabraiz Shamsi'];
      const list: any[] = [];
      for (let i = 0; i < 15; i++) {
        list.push({ team_name: 'India', name: indSquad[i], role: roles[i], credits: 9.0, photo_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(indSquad[i])}` });
      }
      for (let i = 0; i < 15; i++) {
        list.push({ team_name: 'South Africa', name: saSquad[i], role: roles[i], credits: 9.0, photo_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(saSquad[i])}` });
      }
      setPlayers(list);
    }
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
    setTeamALogo(m.team_a_logo || '');
    setTeamBLogo(m.team_b_logo || '');
    setMatchPoster(m.match_poster || '');
    setLockMinutes(m.lock_time_minutes || 15);

    if (m.players && m.players.length === 30) {
      setPlayers(m.players.map((p: any) => ({
        team_name: p.team_name,
        name: p.name,
        role: p.role || 'BAT',
        credits: p.credits || 9.0,
        photo_url: p.photo_url || ''
      })));
    } else {
      const roles: ('WK' | 'BAT' | 'AR' | 'BOWL')[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'WK', 'BAT', 'BOWL'];
      const list: any[] = [];
      const tAName = m.team_a || 'Team A';
      const tBName = m.team_b || 'Team B';
      for (let i = 1; i <= 15; i++) {
        list.push({ team_name: tAName, name: `${tAName} Player ${i}`, role: roles[i - 1], credits: 9.0, photo_url: '' });
      }
      for (let i = 1; i <= 15; i++) {
        list.push({ team_name: tBName, name: `${tBName} Player ${i}`, role: roles[i - 1], credits: 9.0, photo_url: '' });
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
    <div className="px-3 sm:px-6 py-6 max-w-7xl mx-auto w-full space-y-6 bg-transparent text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CBD5E1] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#2563EB]" />
            <span>Cricket Match Operations &amp; Database</span>
          </h1>
          <p className="text-xs text-[#64748B] font-bold mt-0.5">
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
              activeTab === tab ? 'prime-btn-3d' : 'prime-btn-dark-3d !text-[#64748B]'
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
          <div className="prime-card-3d overflow-hidden border-2 border-[#38BDF8] bg-white">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <span className="font-black text-xs text-[#DC2626] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping" />
                Live In-Play Matches ({matches.filter(m => m.status === 'live').length})
              </span>
              <span className="text-[11px] text-[#64748B] font-bold">Real-time live telemetry active</span>
            </div>

            {matches.filter(m => m.status === 'live').length === 0 ? (
              <div className="p-6 text-center text-[#64748B] text-xs font-bold">No matches currently LIVE.</div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {matches.filter(m => m.status === 'live').map((m) => {
                  const isExp = expandedMatchId === m.id;
                  const tA = (m.players || []).filter((p: any) => p.team_name === m.team_a);
                  const tB = (m.players || []).filter((p: any) => p.team_name === m.team_b);
                  return (
                    <div key={m.id} className="bg-white hover:bg-[#F8FAFC] transition">
                      <div
                        onClick={() => setExpandedMatchId(isExp ? null : m.id)}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryBadge category={m.category} size="xs" />
                          <div>
                            <h4 className="font-black text-[#0F172A] text-sm sm:text-base">{m.title}</h4>
                            <p className="text-xs text-[#2563EB] font-mono font-bold mt-0.5">
                              🔴 LIVE INNINGS • {m.score_summary?.team_a ? `${m.score_summary.team_a.runs}/${m.score_summary.team_a.wickets} (${m.score_summary.team_a.overs} ov)` : 'In Progress'} • 📍 {m.venue || 'Stadium'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
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
                            className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-xs font-black text-[#1D4ED8] flex items-center gap-1 transition"
                            title="Edit match & contests"
                          >
                            <Edit2 className="w-3 h-3 text-[#1D4ED8]" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-black text-red-600 flex items-center gap-1 transition"
                            title="Delete match and contests"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                            <span>Delete</span>
                          </button>
                          {isExp ? <ChevronUp className="w-4 h-4 text-[#2563EB]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-white border border-[#93C5FD] space-y-2">
                              <h5 className="text-xs font-black text-[#1D4ED8] uppercase">{m.team_a} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tA.length > 0 ? tA : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${m.team_a} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white border border-[#CBD5E1] shrink-0 flex items-center justify-center">
                                        {resolveImageUrl(p.photo_url) ? (
                                          <img src={resolveImageUrl(p.photo_url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        ) : (
                                          <span className="text-[7px] font-black text-[#1D4ED8]">{p.role}</span>
                                        )}
                                      </div>
                                      <span className="truncate text-[#0F172A] font-bold">{p.name}</span>
                                    </div>
                                    <span className="text-[#1D4ED8] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border border-[#FDE68A] space-y-2">
                              <h5 className="text-xs font-black text-[#D97706] uppercase">{m.team_b} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tB.length > 0 ? tB : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${m.team_b} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white border border-[#CBD5E1] shrink-0 flex items-center justify-center">
                                        {resolveImageUrl(p.photo_url) ? (
                                          <img src={resolveImageUrl(p.photo_url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        ) : (
                                          <span className="text-[7px] font-black text-[#D97706]">{p.role}</span>
                                        )}
                                      </div>
                                      <span className="truncate text-[#0F172A] font-bold">{p.name}</span>
                                    </div>
                                    <span className="text-[#D97706] font-black">{p.role}</span>
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
          <div className="prime-card-3d overflow-hidden border-2 border-[#CBD5E1] bg-white">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <span className="font-black text-xs text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2563EB]" />
                All Upcoming Matches Database ({matches.filter(m => m.status === 'upcoming').length})
              </span>
              <span className="text-[11px] text-[#64748B] font-bold">Click match row to inspect schedule &amp; 15+15 squad roster</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-[#64748B] font-bold">Loading cricket database...</div>
            ) : matches.filter(m => m.status === 'upcoming').length === 0 ? (
              <div className="p-12 text-center text-[#64748B] font-bold">No upcoming matches found in this category.</div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {matches.filter(m => m.status === 'upcoming').map((m) => {
                  const isExp = expandedMatchId === m.id;
                  const tA = (m.players || []).filter((p: any) => p.team_name === m.team_a);
                  const tB = (m.players || []).filter((p: any) => p.team_name === m.team_b);
                  return (
                    <div key={m.id} className="bg-white hover:bg-[#F8FAFC] transition">
                      <div
                        onClick={() => setExpandedMatchId(isExp ? null : m.id)}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryBadge category={m.category} size="xs" />
                          <div>
                            <h4 className="font-black text-[#0F172A] text-sm sm:text-base">{m.title}</h4>
                            <p className="text-xs text-[#64748B] font-bold mt-0.5">
                              📅 Date: <span className="text-[#0F172A]">{m.match_date}</span> • ⏰ Time: <span className="text-[#2563EB] font-mono">{m.match_time}</span> • 📍 Venue: <span className="text-[#0F172A]">{m.venue || 'Stadium'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-mono font-bold text-[#1D4ED8]">
                            {m.team_a}: {tA.length || 15}
                          </span>
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-xs font-mono font-bold text-[#D97706]">
                            {m.team_b}: {tB.length || 15}
                          </span>
                          <span className="bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] px-2.5 py-1 rounded-full text-xs font-black">
                            UPCOMING
                          </span>
                          <span className="text-xs font-black text-[#2563EB]">{(m.contests || []).length} Contests</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-xs font-black text-[#1D4ED8] flex items-center gap-1 transition"
                            title="Edit match & contests"
                          >
                            <Edit2 className="w-3 h-3 text-[#1D4ED8]" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMatch(m);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-black text-red-600 flex items-center gap-1 transition"
                            title="Delete match and contests"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                            <span>Delete</span>
                          </button>
                          {isExp ? <ChevronUp className="w-4 h-4 text-[#2563EB]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-4">
                          <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
                            <span>📅 Match Date: <strong className="text-[#0F172A]">{m.match_date}</strong></span>
                            <span>⏰ Start Time: <strong className="text-[#2563EB]">{m.match_time}</strong></span>
                            <span>📍 Venue: <strong className="text-[#0F172A]">{m.venue || 'Stadium'}</strong></span>
                            <span>🔒 Contest Lock: <strong className="text-[#0F172A]">{m.lock_time_minutes || 15}m before match</strong></span>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-white border border-[#93C5FD] space-y-2">
                              <h5 className="text-xs font-black text-[#1D4ED8] uppercase">{m.team_a} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tA.length > 0 ? tA : Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `${m.team_a} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white border border-[#CBD5E1] shrink-0 flex items-center justify-center">
                                        {resolveImageUrl(p.photo_url) ? (
                                          <img src={resolveImageUrl(p.photo_url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        ) : (
                                          <span className="text-[7px] font-black text-[#1D4ED8]">{p.role}</span>
                                        )}
                                      </div>
                                      <span className="truncate text-[#0F172A] font-bold">{p.name}</span>
                                    </div>
                                    <span className="text-[#1D4ED8] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border border-[#FDE68A] space-y-2">
                              <h5 className="text-xs font-black text-[#D97706] uppercase">{m.team_b} (15 Players)</h5>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                {(tB.length > 0 ? tB : Array.from({ length: 15 }, (_, i) => ({ id: `b-${i}`, name: `${m.team_b} #${i + 1}`, role: 'BAT' }))).map((p: any) => (
                                  <div key={p.id} className="p-1.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white border border-[#CBD5E1] shrink-0 flex items-center justify-center">
                                        {resolveImageUrl(p.photo_url) ? (
                                          <img src={resolveImageUrl(p.photo_url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        ) : (
                                          <span className="text-[7px] font-black text-[#D97706]">{p.role}</span>
                                        )}
                                      </div>
                                      <span className="truncate text-[#0F172A] font-bold">{p.name}</span>
                                    </div>
                                    <span className="text-[#D97706] font-black">{p.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-4 gap-2">
                            {(m.contests || []).map((c: any) => (
                              <div key={c.id} className="p-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-xs shadow-xs space-y-1">
                                <div className="flex justify-between items-center gap-1">
                                  <span className="font-black text-[#0F172A] block truncate">{c.title}</span>
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8]">
                                    {c.type}
                                  </span>
                                </div>
                                <span className="text-[#D97706] text-[10px] font-mono block font-bold">
                                  {c.type === 'h2h' ? 'H2H Duel (User Fee)' : `Fee: ₹${c.entry_fee} • Pool: ₹${c.prize_pool}`}
                                </span>
                                <span className="text-[10px] font-mono block font-bold text-[#2563EB]">
                                  {c.type === 'h2h' || c.is_private ? '🚫 Bots: 0 (Protected)' : `🤖 Bots: ${c.bot_spots || 'Auto'} teams`}
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#1E3A8A] uppercase">Live Match:</span>
              <select
                value={selectedMatchId || ''}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-xs font-black outline-none"
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
            <div className="p-12 text-center text-[#64748B] font-bold">Streaming live telemetry...</div>
          ) : telemetry?.match ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 prime-card-3d p-5 space-y-4 bg-white border-2 border-[#38BDF8]">
                <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
                  <h3 className="text-xs font-black text-[#1E3A8A] uppercase flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-[#EF4444] animate-pulse" />
                    <span>In-Play Live Stream</span>
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-mono font-bold">Cricbuzz Active</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-black text-[#0F172A]">{telemetry.match.team_a}</h4>
                    <p className="text-2xl font-black text-[#2563EB]">
                      {telemetry.match.score_summary?.team_a?.runs || 146}/{telemetry.match.score_summary?.team_a?.wickets || 3}
                      <span className="text-xs font-normal text-[#64748B] ml-1">
                        ({telemetry.match.score_summary?.team_a?.overs || 16.4} ov)
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <h4 className="text-lg font-black text-[#0F172A]">{telemetry.match.team_b}</h4>
                    <p className="text-xs font-bold text-[#64748B]">Yet to bat</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] flex items-center gap-2">
                  <span className="text-[10px] text-[#64748B] font-bold uppercase">This Over:</span>
                  <div className="flex gap-1.5">
                    {(telemetry.match.live_data?.recent_balls || ['1', '0', '4', '2', 'W', '1']).map((token: string, i: number) => (
                      <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                        token === 'W' ? 'bg-[#EF4444] text-white shadow-xs' : token === '4' || token === '6' ? 'bg-[#F59E0B] text-white shadow-xs' : 'bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1]'
                      }`}>
                        {token}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-mono font-bold text-[#64748B] ml-auto">
                    CRR: {telemetry.match.live_data?.current_rate || '8.76'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#93C5FD] space-y-1">
                    <span className="text-[10px] text-[#1D4ED8] font-black uppercase block">Active Striker</span>
                    <p className="font-black text-[#0F172A] text-sm">
                      🏏 {telemetry.match.live_data?.current_striker?.name || 'Striker'} *
                    </p>
                    <p className="text-xs font-mono text-[#2563EB]">
                      {telemetry.match.live_data?.current_striker?.runs || 48} runs ({telemetry.match.live_data?.current_striker?.balls || 32}b)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#FCA5A5] space-y-1">
                    <span className="text-[10px] text-[#DC2626] font-black uppercase block">Active Bowler</span>
                    <p className="font-black text-[#0F172A] text-sm">
                      ⚾ {telemetry.match.live_data?.current_bowler?.name || 'Bowler'}
                    </p>
                    <p className="text-xs font-mono text-[#DC2626]">
                      {telemetry.match.live_data?.current_bowler?.wickets || 2} wkts / {telemetry.match.live_data?.current_bowler?.runs || 28} runs
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 prime-card-3d p-4 flex flex-col h-[360px] bg-white border-2 border-[#CBD5E1]">
                <h4 className="text-xs font-black text-[#1E3A8A] uppercase mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Live Commentary</span>
                </h4>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {(telemetry.match.live_data?.commentary || [
                    '⚡ FOUR! Beautiful cover drive!',
                    'Single pushed towards long-off.',
                    'Dot ball, good length.',
                    '🔴 WICKET! Clean bowled!',
                  ]).map((line: string, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A]">
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
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-sm">
            <span className="text-xs font-black text-[#1E3A8A] uppercase">Inspect Roster:</span>
            <select
              value={selectedMatchId || ''}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-xs font-black outline-none"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>{m.team_a} vs {m.team_b}</option>
              ))}
            </select>
            <span className="bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full text-[10px] font-black ml-auto">
              30/30 Players Pool
            </span>
          </div>

          {telemetry?.match && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[
                { team: telemetry.match.team_a, border: 'border-[#93C5FD]', badge: 'text-[#1D4ED8]' },
                { team: telemetry.match.team_b, border: 'border-[#FDE68A]', badge: 'text-[#D97706]' }
              ].map(({ team, border, badge }) => {
                const teamPlayers = (telemetry.players || []).filter((p: any) => p.team_name === team);
                return (
                  <div key={team} className={`prime-card-3d p-4 space-y-3 border-2 ${border} bg-white`}>
                    <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
                      <h4 className={`font-black text-sm uppercase ${badge}`}>{team} Squad</h4>
                      <span className="text-xs font-mono font-bold text-[#64748B]">{teamPlayers.length || 15} Players</span>
                    </div>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {(teamPlayers.length > 0 ? teamPlayers : Array.from({ length: 15 }, (_, i) => ({ id: `${team}-${i}`, name: `${team} Player ${i + 1}`, role: 'BAT', credits: 9.0 }))).map((p: any, i: number) => (
                        <div key={p.id || i} className="p-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-[#CBD5E1] shrink-0 flex items-center justify-center">
                              {resolveImageUrl(p.photo_url) ? (
                                <img src={resolveImageUrl(p.photo_url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                              ) : (
                                <span className="text-[8px] font-black text-[#1E3A8A]">{p.role}</span>
                              )}
                            </div>
                            <span className="font-bold text-[#0F172A] truncate">#{i + 1} {p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">{p.role}</span>
                            <span className="font-mono text-[11px] text-[#64748B]">{p.credits || 9.0} Cr</span>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-2xl bg-white border-2 border-[#2563EB] rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col text-[#0F172A]">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="font-black text-[#0F172A] text-base">
                  {editingMatchId ? '✏️ Edit Match & Contests' : '⚡ Create Match'} (Step {currentStep} of 6)
                </h3>
                <span className="text-xs text-[#2563EB] font-bold">
                  {currentStep === 1 && 'Match Details & Category Selector'}
                  {currentStep === 2 && 'Team Logos & Poster'}
                  {currentStep === 3 && '30 Squad Players (15 + 15)'}
                  {currentStep === 4 && 'Contests Configuration'}
                  {currentStep === 5 && 'Lock Time Window'}
                  {currentStep === 6 && 'DB Verification & Publish'}
                </span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            {fieldErrors.general && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
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
                  {/* ⚡ Quick Auto-Fill from Cricbuzz Upcoming Fixtures */}
                  {cricbuzzUpcoming.length > 0 && !editingMatchId && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-[#EFF6FF] via-[#DBEAFE] to-[#BFDBFE] border border-[#93C5FD] space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-[#1E3A8A] flex items-center gap-1.5 uppercase">
                          <Zap className="w-3.5 h-3.5 text-[#2563EB] fill-[#2563EB]" />
                          ⚡ Auto-Pick Cricbuzz Upcoming Fixture
                        </span>
                        <span className="text-[10px] text-[#2563EB] font-bold">Auto-fills Date, Time, Venue &amp; 30 Players</span>
                      </div>
                      <select
                        onChange={(e) => {
                          const m = cricbuzzUpcoming.find(u => u.cricbuzz_id === e.target.value);
                          if (m) handleSelectCricbuzzFixture(m);
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#93C5FD] text-[#0F172A] font-bold text-xs outline-none shadow-inner"
                        defaultValue=""
                      >
                        <option value="" disabled>-- Select an Upcoming Match to Auto-Fill Everything --</option>
                        {cricbuzzUpcoming.map(u => (
                          <option key={u.cricbuzz_id} value={u.cricbuzz_id}>
                            {u.title} • {u.match_date} @ {u.match_time} ({u.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#64748B] font-black uppercase">Team A Name *</label>
                      <input
                        type="text"
                        value={teamA}
                        onChange={(e) => {
                          setTeamA(e.target.value);
                          setPlayers(prev => prev.map((p, idx) => idx < 15 ? { ...p, team_name: e.target.value } : p));
                        }}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#64748B] font-black uppercase">Team B Name *</label>
                      <input
                        type="text"
                        value={teamB}
                        onChange={(e) => {
                          setTeamB(e.target.value);
                          setPlayers(prev => prev.map((p, idx) => idx >= 15 ? { ...p, team_name: e.target.value } : p));
                        }}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#1E3A8A] font-black uppercase">Category * (Mandatory 1 of 4)</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {(['World Cup', 'T20', 'League', "Women's"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`p-2 rounded-lg border text-xs font-bold transition ${
                            category === cat ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs' : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]'
                          }`}
                        >
                          <CategoryBadge category={cat} size="xs" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#64748B] font-black uppercase">Match Date *</label>
                      <input
                        type="date"
                        value={matchDate}
                        onChange={(e) => setMatchDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#64748B] font-black uppercase">Match Time *</label>
                      <input
                        type="time"
                        value={matchTime}
                        onChange={(e) => setMatchTime(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#64748B] font-black uppercase">Venue / Stadium</label>
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] outline-none"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] text-[#1E3A8A] space-y-1">
                    <p className="font-bold text-[#0F172A] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#2563EB]" />
                      <span>Image Guidelines &amp; Direct Upload</span>
                    </p>
                    <p>
                      Aap direct Google Images / Cricbuzz / Web se kisi bhi image ka direct URL paste kar sakte hain, ya fir apne device (computer/phone) se <strong>Upload File</strong> button dabakar directly upload kar sakte hain. Dono tarike fully supported hain!
                    </p>
                  </div>

                  {/* Team A Logo */}
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                    <label className="text-[10px] text-[#1D4ED8] font-black uppercase">{teamA} Logo (Web URL or Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={teamALogo}
                        onChange={(e) => setTeamALogo(e.target.value)}
                        placeholder="https://... or /uploads/..."
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] outline-none font-mono text-xs"
                      />
                      <label className="cursor-pointer px-3 py-2 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-xs font-black text-[#1D4ED8] flex items-center gap-1.5 transition shrink-0">
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
                      {resolveImageUrl(teamALogo) ? (
                        <div className="w-12 h-12 rounded-xl border border-[#CBD5E1] bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                          <img
                            src={resolveImageUrl(teamALogo)}
                            alt="Team A"
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Team B Logo */}
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                    <label className="text-[10px] text-[#D97706] font-black uppercase">{teamB} Logo (Web URL or Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={teamBLogo}
                        onChange={(e) => setTeamBLogo(e.target.value)}
                        placeholder="https://... or /uploads/..."
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] outline-none font-mono text-xs"
                      />
                      <label className="cursor-pointer px-3 py-2 rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FDE68A] text-xs font-black text-[#D97706] flex items-center gap-1.5 transition shrink-0">
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
                      {resolveImageUrl(teamBLogo) ? (
                        <div className="w-12 h-12 rounded-xl border border-[#CBD5E1] bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                          <img
                            src={resolveImageUrl(teamBLogo)}
                            alt="Team B"
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Match Poster */}
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                    <label className="text-[10px] text-[#64748B] font-black uppercase">Match Poster / Banner (Web URL or Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={matchPoster}
                        onChange={(e) => setMatchPoster(e.target.value)}
                        placeholder="https://... or /uploads/..."
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] outline-none font-mono text-xs"
                      />
                      <label className="cursor-pointer px-3 py-2 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-xs font-black text-[#334155] flex items-center gap-1.5 transition shrink-0">
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
                      {resolveImageUrl(matchPoster) ? (
                        <div className="w-14 h-12 rounded-xl border border-[#CBD5E1] bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                          <img
                            src={resolveImageUrl(matchPoster)}
                            alt="Poster"
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[#1E3A8A] uppercase">30 Players Pool</span>
                    <span className="text-[#64748B]">15 {teamA} + 15 {teamB}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      { team: teamA, start: 0, end: 15, labelColor: 'text-[#1D4ED8]' },
                      { team: teamB, start: 15, end: 30, labelColor: 'text-[#D97706]' }
                    ].map(({ team, start, end, labelColor }) => (
                      <div key={team} className="space-y-1.5">
                        <span className={`font-black text-xs uppercase ${labelColor}`}>{team}</span>
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                          {players.slice(start, end).map((p, idx) => {
                            const realIdx = start + idx;
                            return (
                              <div key={realIdx} className="p-2 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-1.5 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[#64748B] font-bold w-4">{idx + 1}</span>
                                  {resolveImageUrl(p.photo_url) ? (
                                    <div className="w-8 h-8 rounded-full border border-[#93C5FD] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                                      <img
                                        src={resolveImageUrl(p.photo_url)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-[#E2E8F0] border border-[#CBD5E1] flex items-center justify-center text-[9px] text-[#1E3A8A] font-black shrink-0">
                                      {p.role}
                                    </div>
                                  )}
                                  <input
                                    type="text"
                                    value={p.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPlayers(prev => prev.map((item, i) => i === realIdx ? { ...item, name: val } : item));
                                    }}
                                    placeholder="Player Name"
                                    className="flex-1 px-2.5 py-1 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold outline-none"
                                  />
                                  <select
                                    value={p.role}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPlayers(prev => prev.map((item, i) => i === realIdx ? { ...item, role: val } : item));
                                    }}
                                    className="px-2 py-1 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-xs font-black outline-none"
                                  >
                                    <option value="WK">WK</option>
                                    <option value="BAT">BAT</option>
                                    <option value="AR">AR</option>
                                    <option value="BOWL">BOWL</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-1.5 pl-6">
                                  <input
                                    type="text"
                                    value={p.photo_url || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPlayers(prev => prev.map((item, i) => i === realIdx ? { ...item, photo_url: val } : item));
                                    }}
                                    placeholder="Photo URL (paste web image link)"
                                    className="flex-1 px-2 py-0.5 rounded bg-white border border-[#CBD5E1] text-[#0F172A] text-[11px] outline-none placeholder-[#94A3B8]"
                                  />
                                  <label className="cursor-pointer px-2 py-1 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[10px] font-black text-[#1D4ED8] flex items-center gap-1 transition shrink-0">
                                    <Upload className="w-2.5 h-2.5" />
                                    <span>Upload Photo</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const formData = new FormData();
                                        formData.append('image', file);
                                        try {
                                          const base = getApiBase();
                                          const headers: Record<string, string> = {};
                                          if (token) headers['Authorization'] = `Bearer ${token}`;
                                          const res = await fetch(`${base}/admin/upload`, { method: 'POST', headers, body: formData });
                                          const data = await res.json();
                                          if (data?.url) {
                                            setPlayers(prev => prev.map((item, i) => i === realIdx ? { ...item, photo_url: data.url } : item));
                                          }
                                        } catch (err) { console.error('Photo upload failed:', err); }
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
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
                    <div>
                      <span className="font-black text-[#1E3A8A] uppercase block">Contests Configuration & Bot Quotas</span>
                      <span className="text-[11px] text-[#64748B]">
                        Mega, Battlefield, Mini, Practice, Private & H2H contests configure karein aur unke Bot spots set karein.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContests(prev => [...prev, {
                        type: 'mega',
                        title: `Mega Contest #${prev.length + 1}`,
                        prize_pool: 25000,
                        entry_fee: 49,
                        total_spots: 1000,
                        bot_spots: 500
                      }])}
                      className="prime-btn-3d !py-1.5 !px-3 !text-xs shrink-0"
                    >
                      + Add Contest
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    {contests.map((c, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white border-2 border-[#CBD5E1] shadow-[0_0_12px_rgba(37,99,235,0.10)] space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB]">Contest #{idx + 1}</span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                              {c.type === 'mega' ? '🏆 Mega Grand' :
                               c.type === 'multi_battlefield' ? '⚔️ Battlefield (25)' :
                               c.type === 'mini' ? '🎯 Mini (100)' :
                               c.type === 'practice' ? '🆓 Practice' :
                               c.type === 'private' ? '🔒 Private' :
                               c.type === 'h2h' ? '🥊 H2H Duel' : '📊 Standard'}
                            </span>
                          </div>
                          {contests.length > 1 && (
                            <button type="button" onClick={() => setContests(prev => prev.filter((_, i) => i !== idx))} className="text-[#64748B] hover:text-red-600 text-xs font-black">
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="pd-label">Contest Name</label>
                            <input
                              type="text"
                              value={c.title}
                              placeholder="Mega Grand Contest"
                              onChange={(e) => {
                                const val = e.target.value;
                                setContests(prev => prev.map((item, i) => i === idx ? { ...item, title: val } : item));
                              }}
                              className="pd-input font-bold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="pd-label">Contest Type</label>
                            <select
                              value={c.type}
                              onChange={(e) => {
                                const newType = e.target.value;
                                setContests(prev => prev.map((item, i) => {
                                  if (i !== idx) return item;
                                  const updated = { ...item, type: newType };
                                  if (newType === 'mega') {
                                    if (!updated.title || updated.title.startsWith('Contest #') || updated.title.startsWith('Mega Contest #')) {
                                      updated.title = 'Mega Grand Contest ₹1,00,000';
                                    }
                                    updated.total_spots = 10000;
                                    updated.bot_spots = 10000;
                                    updated.entry_fee = 49;
                                    updated.prize_pool = 100000;
                                    updated.is_private = false;
                                  } else if (newType === 'multi_battlefield') {
                                    if (!updated.title || updated.title.startsWith('Contest #') || updated.title.startsWith('Mega Contest #')) {
                                      updated.title = 'PUBG Battlefield Room #1';
                                    }
                                    updated.total_spots = 25;
                                    updated.spots_per_battlefield = 25;
                                    updated.bot_spots = 7;
                                    updated.entry_fee = 99;
                                    updated.prize_pool = 2500;
                                    updated.is_private = false;
                                  } else if (newType === 'mini') {
                                    if (!updated.title || updated.title.startsWith('Contest #') || updated.title.startsWith('Mega Contest #')) {
                                      updated.title = 'Mini Quick Contest ₹1,000';
                                    }
                                    updated.total_spots = 100;
                                    updated.bot_spots = 25;
                                    updated.entry_fee = 25;
                                    updated.prize_pool = 2500;
                                    updated.is_private = false;
                                  } else if (newType === 'practice') {
                                    if (!updated.title || updated.title.startsWith('Contest #') || updated.title.startsWith('Mega Contest #')) {
                                      updated.title = 'Practice Contest (Free)';
                                    }
                                    updated.total_spots = 50;
                                    updated.bot_spots = 10;
                                    updated.entry_fee = 0;
                                    updated.prize_pool = 0;
                                    updated.is_private = false;
                                  } else if (newType === 'private') {
                                    if (!updated.title || updated.title.startsWith('Contest #') || updated.title.startsWith('Mega Contest #')) {
                                      updated.title = 'Private Friends Contest';
                                    }
                                    updated.total_spots = 20;
                                    updated.bot_spots = 0;
                                    updated.entry_fee = 25;
                                    updated.prize_pool = 500;
                                    updated.is_private = true;
                                  } else if (newType === 'h2h') {
                                    if (!updated.title || updated.title.startsWith('Contest #') || updated.title.startsWith('Mega Contest #')) {
                                      updated.title = 'H2H Custom Duel';
                                    }
                                    updated.total_spots = 2;
                                    updated.bot_spots = 0;
                                    updated.entry_fee = 0;
                                    updated.prize_pool = 0;
                                    updated.is_private = false;
                                  } else {
                                    updated.is_private = false;
                                  }
                                  return updated;
                                }));
                              }}
                              className="pd-input font-bold text-[#2563EB]"
                            >
                              <option value="mega">🏆 Mega Grand Contest (Up to 10,000 Teams)</option>
                              <option value="multi_battlefield">⚔️ PUBG Battlefield (25 spots, Room Auto-Clone)</option>
                              <option value="mini">🎯 Mini Contest (10 - 100 spots)</option>
                              <option value="practice">🆓 Practice Contest (Free Entry)</option>
                              <option value="private">🔒 Private Contest (Invite Only, 0 Bots)</option>
                              <option value="h2h">🥊 Head-to-Head Duel (1v1, 0 Bots)</option>
                              <option value="standard">📊 Standard Public Contest</option>
                            </select>
                          </div>

                          <div>
                            <label className="pd-label">Total Spots</label>
                            <input
                              type="number"
                              min={2}
                              value={c.total_spots}
                              disabled={c.type === 'h2h'}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setContests(prev => prev.map((item, i) => i === idx ? { ...item, total_spots: val } : item));
                              }}
                              className="pd-input font-mono disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="pd-label">Entry Fee (₹)</label>
                            <input
                              type="number"
                              min={0}
                              value={c.entry_fee}
                              disabled={c.type === 'h2h' || c.type === 'practice'}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setContests(prev => prev.map((item, i) => i === idx ? { ...item, entry_fee: val } : item));
                              }}
                              className="pd-input font-mono disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="pd-label">Prize Pool (₹)</label>
                            <input
                              type="number"
                              min={0}
                              value={c.prize_pool}
                              disabled={c.type === 'h2h' || c.type === 'practice'}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setContests(prev => prev.map((item, i) => i === idx ? { ...item, prize_pool: val } : item));
                              }}
                              className="pd-input font-mono disabled:opacity-50"
                            />
                          </div>

                          {/* 🤖 BOTS TEAMS COUNT FIELD */}
                          <div className="sm:col-span-2 p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-black uppercase text-[#1D4ED8] flex items-center gap-1.5">
                                <span>🤖 Bots Ki Teams (Bot Spots)</span>
                                <span className="text-[9px] font-bold bg-[#DBEAFE] px-2 py-0.5 rounded-full text-[#1E40AF]">Autonomous Allocation</span>
                              </label>
                              {(c.type === 'h2h' || c.type === 'private') ? (
                                <span className="text-[10px] font-bold text-[#DC2626] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                  🚫 Bots Disabled for {c.type === 'h2h' ? 'H2H' : 'Private'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-[#2563EB] font-bold">
                                  {c.bot_spots ? `${c.bot_spots} Teams set` : 'Default Rule Active'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={c.type === 'mega' ? 10000 : c.total_spots}
                                value={c.type === 'h2h' || c.type === 'private' ? 0 : (c.bot_spots !== undefined ? c.bot_spots : '')}
                                disabled={c.type === 'h2h' || c.type === 'private'}
                                placeholder={
                                  c.type === 'mega' ? '10000' :
                                  c.type === 'multi_battlefield' ? '7' :
                                  c.total_spots === 100 ? '25' :
                                  'e.g. 500 (Bots 500 teams banayenge)'
                                }
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setContests(prev => prev.map((item, i) => i === idx ? { ...item, bot_spots: val } : item));
                                }}
                                className="pd-input font-mono font-bold disabled:opacity-50 disabled:bg-[#F1F5F9]"
                              />
                            </div>

                            <p className="text-[10px] text-[#64748B]">
                              {c.type === 'h2h' || c.type === 'private'
                                ? '⚠️ Rules Guard: Head-to-Head aur Private contests me bots 100% block rehte hain.'
                                : '💡 Is contest me bots kitni teams banayenge (e.g. 500 likhne par bots 500 teams banayenge). Default rules: 25 spots me 7 bots, 100 spots me 25 bots, Mega me 10,000 teams.'}
                            </p>
                          </div>
                        </div>

                        {c.type === 'h2h' && (
                          <p className="text-[10px] text-[#2563EB] font-bold bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-2.5 py-1.5">
                            H2H duel: 2 spots. Entry fee challenge banate waqt user set karta hai (85% winner split).
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1]">
                  <h4 className="font-black text-xs text-[#1E3A8A] uppercase">Contest Lock Timing</h4>
                  <p className="text-xs text-[#64748B]">
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
                <div className="space-y-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1]">
                  <h4 className="font-black text-xs text-[#1E3A8A] uppercase">
                    {editingMatchId ? 'Ready to Update Database' : 'Ready for DB Verification'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#64748B]">Match:</span> <strong className="text-[#0F172A] ml-1">{teamA} vs {teamB}</strong></div>
                    <div><span className="text-[#64748B]">Category:</span> <strong className="text-[#2563EB] ml-1">{category}</strong></div>
                    <div><span className="text-[#64748B]">Squad:</span> <strong className="text-[#0F172A] ml-1">{players.length} Players</strong></div>
                    <div><span className="text-[#64748B]">Contests:</span> <strong className="text-[#0F172A] ml-1">{contests.length} Configured</strong></div>
                    <div><span className="text-[#64748B]">Lock Time:</span> <strong className="text-[#0F172A] ml-1">{lockMinutes}m before start</strong></div>
                    <div><span className="text-[#64748B]">Mode:</span> <strong className="text-[#1D4ED8] ml-1">{editingMatchId ? 'Update Existing' : 'New Creation'}</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="pt-3 border-t border-[#E2E8F0] flex justify-between">
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

export default function AdminCricketMatchesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-[#64748B] font-bold">Loading match console...</div>}>
      <AdminCricketMatchesContent />
    </Suspense>
  );
}
