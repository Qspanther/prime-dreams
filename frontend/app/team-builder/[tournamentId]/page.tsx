'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Crown, Check, ArrowLeft, AlertCircle, ChevronRight, Eye, Info, MapPin, Lock, Trophy } from 'lucide-react';
import { apiGet, apiPost, apiPut, resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import CategoryBadge from '../../components/ui/CategoryBadge';
import PlayerPhoto from '../../components/ui/PlayerPhoto';
import CricketPitchView from '../../components/ui/CricketPitchView';
import PlayerDetailModal from '../../components/ui/PlayerDetailModal';

interface Player {
  id: string;
  name: string;
  team_name: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
  credits: number;
  points: number;
  photo_url?: string;
  selected_by_pct?: number;
  last_match_points?: number | null;
  avg_points?: number | null;
  form?: string | null;
  is_playing_xi?: boolean;
}

const TOTAL_CREDITS = 105;

function normalizeRole(role?: string): 'WK' | 'BAT' | 'AR' | 'BOWL' {
  const r = (role || '').toUpperCase().trim();
  if (r.includes('WK') || r.includes('KEEP')) return 'WK';
  if (r.includes('AR') || r.includes('ALL') || r.includes('ROUND')) return 'AR';
  if (r.includes('BOWL')) return 'BOWL';
  return 'BAT';
}

export default function CricketTeamBuilderPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId');
  const teamId = searchParams.get('teamId');
  const h2hFlow = searchParams.get('h2h') === '1';
  const { tournamentId: matchId } = use(params);
  const { token } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [lockClockNow, setLockClockNow] = useState(() => Date.now());
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedRole, setSelectedRole] = useState<'WK' | 'BAT' | 'AR' | 'BOWL'>('WK');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [capMode, setCapMode] = useState<'C' | 'VC' | null>(null);
  const [teamName, setTeamName] = useState('My Prime XI');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [switchContestId, setSwitchContestId] = useState('');
  const [switching, setSwitching] = useState(false);
  const [showPitchPreview, setShowPitchPreview] = useState(false);
  const [pitchMode, setPitchMode] = useState<'view' | 'select_cap'>('select_cap');
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [selectedContestId, setSelectedContestId] = useState<string>(contestId || '');

  useEffect(() => {
    if (!token) return;
    apiGet('/wallet/balance', token)
      .then((res) => {
        if (typeof res?.balance === 'number') setWalletBalance(res.balance);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!selectedContestId && !h2hFlow && match?.contests?.length) {
      const openContest = match.contests.find((c: any) => c.status === 'open' && !c.is_private) || match.contests[0];
      if (openContest) setSelectedContestId(openContest.id);
    }
  }, [match?.contests, selectedContestId, h2hFlow]);

  const loadTeamIntoBuilder = (t: any) => {
    setEditingTeamId(t.id);
    setSelectedPlayerIds((t.players || []).map((p: Player) => p.id));
    setCaptainId(t.captain_id);
    setViceCaptainId(t.vice_captain_id);
    setTeamName(t.team_name || 'My Prime XI');
  };

  const startNewTeam = () => {
    setEditingTeamId(null);
    setSelectedPlayerIds([]);
    setCaptainId(null);
    setViceCaptainId(null);
    setTeamName(`My Prime XI ${myTeams.length + 1 > 1 ? 'T' + (myTeams.length + 1) : ''}`.trim());
  };

  const fetchMyTeams = async () => {
    if (!token) return;
    try {
      const res = await apiGet(`/matches/${matchId}/my-teams`, token);
      if (res?.success) setMyTeams(res.teams || []);
    } catch (err) { /* silent */ }
  };

  useEffect(() => { fetchMyTeams(); }, [matchId, token]);

  useEffect(() => {
    if (!match?.start_time) return;
    const lockAt = new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000;
    const delay = lockAt - Date.now();
    if (delay <= 0) {
      setLockClockNow(Date.now());
      return;
    }
    const timer = setTimeout(() => setLockClockNow(Date.now()), delay + 25);
    return () => clearTimeout(timer);
  }, [match?.start_time, match?.lock_time_minutes]);

  const handleSelectExistingTeam = async (t: any) => {
    try {
      const res = await apiGet(`/matches/${matchId}/teams/${t.id}`, token!);
      if (res?.team) loadTeamIntoBuilder(res.team);
    } catch (err: any) {
      setError(err?.message || 'Could not load team.');
    }
  };

  const handleCloneTeam = async (t: any) => {
    if (!token) { router.push('/login'); return; }
    if (myTeams.length >= 6) { setError('Maximum 6 teams per match.'); return; }
    setError(null);
    try {
      const res = await apiPost(`/matches/${matchId}/teams/${t.id}/clone`, {}, token);
      if (res?.success) {
        await fetchMyTeams();
        const newId = res.team?.id;
        if (newId) {
          const full = await apiGet(`/matches/${matchId}/teams/${newId}`, token);
          if (full?.team) loadTeamIntoBuilder(full.team);
        }
      } else {
        setError(res?.error || 'Could not clone team.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not clone team.');
    }
  };

  const handleSwitchContest = async () => {
    if (!token) { router.push('/login'); return; }
    if (!editingTeamId || !switchContestId) { setError('Select a contest to switch into.'); return; }
    setSwitching(true);
    setError(null);
    try {
      const res = await apiPost(`/matches/${matchId}/teams/${editingTeamId}/switch-contest`, { contest_id: switchContestId }, token);
      if (res?.success) {
        setSwitchContestId('');
        await fetchMyTeams();
        router.push('/my-teams');
      } else {
        setError(res?.error || 'Could not switch contest.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not switch contest.');
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiGet(`/matches/${matchId}`)
      .then(async (res) => {
        if (cancelled || !res?.match) return;
        setMatch(res.match);
        setPlayers(res.match.players || []);
        if (typeof window !== 'undefined' && res.match.id && res.match.id !== matchId) {
          window.history.replaceState(null, '', `/team-builder/${res.match.id}${h2hFlow ? '?h2h=1' : contestId ? `?contestId=${contestId}` : ''}`);
        }
        if (!token) return;
        try {
          const endpoint = teamId
            ? `/matches/${matchId}/teams/${teamId}`
            : `/matches/${matchId}/my-team?contest_id=${contestId || ''}`;
          const teamRes = await apiGet(endpoint, token);
          if (cancelled || !teamRes?.team) return;
          const t = teamRes.team;
          setEditingTeamId(t.id);
          setSelectedPlayerIds((t.players || []).map((p: Player) => p.id));
          setCaptainId(t.captain_id);
          setViceCaptainId(t.vice_captain_id);
          setTeamName(t.team_name || 'My Prime XI');
        } catch (err: any) {
          if (teamId && !cancelled) setError(err?.message || 'Could not load your saved team.');
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId, token, teamId, contestId]);

  const lockTime = match
    ? new Date(new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000)
    : null;
  const scoreSummary = match?.score_summary || {};
  const hasLiveScore = !!(
    (scoreSummary?.team_a?.overs > 0 || scoreSummary?.team_a?.runs > 0) ||
    (scoreSummary?.team_b?.overs > 0 || scoreSummary?.team_b?.runs > 0)
  );
  const isLive = match?.status === 'live' || hasLiveScore;
  const isLocked = !!match && (
    match.is_locked ||
    isLive ||
    match.status === 'completed' ||
    (match.start_time && new Date() >= new Date(new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000))
  );

  const { selectedPlayers, totalCreditsUsed, roleCounts, teamCounts } = React.useMemo(() => {
    const selMap = new Set(selectedPlayerIds);
    const sel: Player[] = [];
    let credits = 0;
    const rc = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    const tc: Record<string, number> = {};

    for (const p of players) {
      if (selMap.has(p.id)) {
        sel.push(p);
        credits += Number(p.credits) || 9.0;
        rc[normalizeRole(p.role)]++;
        tc[p.team_name] = (tc[p.team_name] || 0) + 1;
      }
    }
    return {
      selectedPlayers: sel,
      totalCreditsUsed: credits,
      roleCounts: rc,
      teamCounts: tc,
    };
  }, [players, selectedPlayerIds]);

  const creditsLeft = Math.round((TOTAL_CREDITS - totalCreditsUsed) * 10) / 10;

  const activeContest = (match?.contests || []).find((c: any) => c.id === selectedContestId);
  const entryFee = (!editingTeamId && !h2hFlow && activeContest) ? (Number(activeContest.entry_fee) || 0) : 0;
  const isLowBalance = !editingTeamId && !h2hFlow && entryFee > 0 && walletBalance !== null && walletBalance < entryFee;

  const togglePlayer = (p: Player) => {
    if (isLocked) {
      setError('Contest is locked. Team editing is closed.');
      return;
    }
    const isAlreadySelected = selectedPlayerIds.includes(p.id);

    if (isAlreadySelected) {
      setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== p.id));
      if (captainId === p.id) setCaptainId(null);
      if (viceCaptainId === p.id) setViceCaptainId(null);
      setError(null);
      return;
    }

    if (selectedPlayerIds.length >= 11) {
      setError('You can only select exactly 11 players.');
      return;
    }

    const currentTeamCount = teamCounts[p.team_name] || 0;
    if (currentTeamCount >= 7) {
      setError(`Maximum 7 players allowed from ${p.team_name}.`);
      return;
    }

    const nextCredits = creditsLeft - (Number(p.credits) || 9.0);
    if (nextCredits < 0) {
      setError('Not enough credits left for this player.');
      return;
    }

    // Role caps
    const currentRoleCount = roleCounts[p.role];
    const limits = { WK: 4, BAT: 6, AR: 4, BOWL: 6 };
    if (currentRoleCount >= limits[p.role]) {
      setError(`Maximum ${limits[p.role]} ${p.role} players allowed.`);
      return;
    }

    setSelectedPlayerIds([...selectedPlayerIds, p.id]);
    setError(null);
  };

  const validateTeamComposition = () => {
    if (selectedPlayerIds.length < 11) {
      const remaining = 11 - selectedPlayerIds.length;
      return `Please pick ${remaining} more player${remaining === 1 ? '' : 's'} to complete 11 players (${selectedPlayerIds.length}/11 selected).`;
    }
    if (selectedPlayerIds.length > 11) {
      return 'You can only pick exactly 11 players.';
    }
    if (roleCounts.WK < 1) return 'Pick at least 1 Wicket Keeper (WK).';
    if (roleCounts.BAT < 3) return `Pick at least 3 Batters (BAT) — currently ${roleCounts.BAT}.`;
    if (roleCounts.AR < 1) return 'Pick at least 1 All-Rounder (AR).';
    if (roleCounts.BOWL < 3) return `Pick at least 3 Bowlers (BOWL) — currently ${roleCounts.BOWL}.`;
    return null;
  };

  const handleProceedToCaptain = () => {
    if (isLocked) {
      setError('This match has ended. Team editing is closed.');
      return;
    }
    const validationError = validateTeamComposition();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPitchMode('select_cap');
    setShowPitchPreview(true);
  };

  const assignCapRole = (p: Player) => {
    if (!capMode) return;
    if (capMode === 'C') {
      setCaptainId(p.id);
      if (viceCaptainId === p.id) setViceCaptainId(null);
      if (!viceCaptainId || viceCaptainId === p.id) setCapMode('VC');
    } else {
      setViceCaptainId(p.id);
      if (captainId === p.id) setCaptainId(null);
      if (!captainId || captainId === p.id) setCapMode('C');
    }
  };

  const handleSubmitTeam = async () => {
    if (!token) {
      router.push('/login');
      return;
    }

    if (!captainId || !viceCaptainId) {
      setError('Please select both Captain (2×) and Vice-Captain (1.5×).');
      return;
    }

    // Pre-check wallet balance before submitting
    if (!editingTeamId && !h2hFlow && entryFee > 0 && walletBalance !== null && walletBalance < entryFee) {
      const needed = Math.round((entryFee - walletBalance) * 100) / 100;
      const returnUrl = `/team-builder/${matchId}${selectedContestId ? `?contestId=${selectedContestId}` : ''}`;
      setError(`Aapke wallet me paryapt balance nahi hai (Available: ₹${walletBalance}, Required: ₹${entryFee}). Redirecting to Add Cash...`);
      setShowPitchPreview(false);
      setTimeout(() => {
        router.push(`/wallet?depositAmount=${Math.max(50, needed)}&needed=${needed}&returnUrl=${encodeURIComponent(returnUrl)}&message=Contest (₹${entryFee}) join karne ke liye funds add karein`);
      }, 1500);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        team_name: teamName,
        player_ids: selectedPlayerIds,
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
      };
      const res = editingTeamId
        ? await apiPut(`/matches/${matchId}/teams/${editingTeamId}`, payload, token)
        : await apiPost(`/matches/${matchId}/teams`, { ...payload, contest_id: h2hFlow ? null : (selectedContestId || null) }, token);

      if (res?.success) {
        if (h2hFlow && !editingTeamId && res.team?.id) {
          router.push(`/h2h/challenge?matchId=${matchId}&teamId=${res.team.id}`);
        } else {
          router.push('/my-teams');
        }
      } else {
        if (/insufficient/i.test(res?.error || '') || res?.code === 'INSUFFICIENT_BALANCE') {
          const needed = walletBalance !== null ? Math.max(10, entryFee - walletBalance) : entryFee;
          setError(`Insufficient wallet balance! ₹${entryFee} required. Redirecting to Add Cash...`);
          setShowPitchPreview(false);
          setTimeout(() => {
            router.push(`/wallet?depositAmount=${Math.max(50, needed)}&needed=${needed}&returnUrl=${encodeURIComponent(window.location.href)}&message=Contest ke liye funds add karein`);
          }, 1500);
        } else {
          setError(res?.error || 'Failed to submit team');
        }
      }
    } catch (err: any) {
      if (/insufficient/i.test(err?.message || '') || err?.code === 'INSUFFICIENT_BALANCE') {
        const needed = walletBalance !== null ? Math.max(10, entryFee - walletBalance) : entryFee;
        setError(`Insufficient wallet balance! ₹${entryFee} required. Redirecting to Add Cash...`);
        setShowPitchPreview(false);
        setTimeout(() => {
          router.push(`/wallet?depositAmount=${Math.max(50, needed)}&needed=${needed}&returnUrl=${encodeURIComponent(window.location.href)}&message=Contest ke liye funds add karein`);
        }, 1500);
      } else {
        setError(err?.message || 'Error saving team. Check contest lock and balance.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#64748B]">
        <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
        <p className="text-sm font-black text-[#0F172A]">Loading 30 squad players...</p>
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
            Ye match complete ho chuka hai ya iska ID update ho gaya hai. Active matches par jaakar nayi team banayein.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/" className="prime-btn-3d inline-flex items-center gap-2">
            <span>Explore All Matches</span>
          </Link>
        </div>
      </div>
    );
  }

  const roleFilteredPlayers = players.filter((p) => normalizeRole(p.role) === selectedRole);

  return (
    <div className="px-3 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6 bg-transparent text-[#0F172A]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/match/${matchId}`}
          className="inline-flex items-center gap-2 text-xs font-black text-[#475569] hover:text-[#2563EB] transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Exit Builder</span>
        </Link>
        {match && <CategoryBadge category={match.category} size="xs" />}
      </div>

      {editingTeamId && (
        <div className={`p-3.5 rounded-xl border-2 text-xs font-black flex items-center gap-2 ${isLocked
            ? 'bg-red-50 border-red-300 text-red-700'
            : 'bg-green-50 border-green-300 text-green-700'
          }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {isLocked
              ? 'Contest is locked. Your saved team can no longer be edited.'
              : 'Edit mode: your saved team is loaded. Update it as many times as you like until the contest locks.'}
          </span>
        </div>
      )}

      {/* Squads Locked Banner */}
      {isLocked && (
        <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 flex flex-wrap items-center justify-between gap-3 text-red-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">🔒</span>
            <div>
              <h3 className="font-black text-sm text-red-950">Squads Locked (Match In-Play)</h3>
              <p className="text-xs text-red-700 font-medium">Match shuru ho chuka hai. Dream11 rules ke anusar live match me nayi team create ya edit nahi ki ja sakti.</p>
            </div>
          </div>
          <Link href={`/match/${matchId}`} className="prime-btn-dark-3d !py-2 !px-3 text-xs shrink-0">
            Live Score &amp; Leaderboard →
          </Link>
        </div>
      )}

      {/* Match & Squad Meter Card */}
      {match && (
        <div className="prime-card-3d p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              {/* Team A Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] border border-[#93C5FD] flex items-center justify-center font-black text-xs text-white overflow-hidden shrink-0">
                {resolveImageUrl(match.team_a_logo) ? (
                  <img src={resolveImageUrl(match.team_a_logo)} alt={match.team_a} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                ) : (match.team_a_code || match.team_a?.slice(0, 3).toUpperCase())}
              </div>

              <div>
                <h2 className="font-black text-[#0F172A] text-base sm:text-xl">
                  {match.team_a} vs {match.team_b}
                </h2>
                <p className="text-xs text-[#64748B] font-bold">Max 7 players from any single team</p>
              </div>

              {/* Team B Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] border border-[#FDE68A] flex items-center justify-center font-black text-xs text-white overflow-hidden shrink-0">
                {resolveImageUrl(match.team_b_logo) ? (
                  <img src={resolveImageUrl(match.team_b_logo)} alt={match.team_b} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                ) : (match.team_b_code || match.team_b?.slice(0, 3).toUpperCase())}
              </div>
            </div>

            <div className="text-right">
              <span className="pd-eyebrow block text-[#64748B]">Credits Left</span>
              <span className={`pd-num text-xl font-black font-mono ${creditsLeft < 9 ? 'text-[#DC2626]' : 'text-[#D97706] drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`}>
                {creditsLeft} / {TOTAL_CREDITS}
              </span>
            </div>
          </div>

          {/* 11 Players Count Meter */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
              <span className="pd-eyebrow !tracking-normal text-[10px] text-[#64748B] block">Selected</span>
              <span className="pd-num font-black text-base text-[#2563EB] font-mono">
                {selectedPlayerIds.length} / 11
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
              <span className="pd-eyebrow !tracking-normal text-[10px] text-[#64748B] block truncate" title={match.team_a}>{match.team_a_code || match.team_a}</span>
              <span className="pd-num font-black text-base text-[#0F172A] font-mono">
                {teamCounts[match.team_a] || 0} / 7
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
              <span className="pd-eyebrow !tracking-normal text-[10px] text-[#64748B] block truncate" title={match.team_b}>{match.team_b_code || match.team_b}</span>
              <span className="pd-num font-black text-base text-[#0F172A] font-mono">
                {teamCounts[match.team_b] || 0} / 7
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
              <span className="pd-eyebrow !tracking-normal text-[10px] text-[#64748B] block">Squad Pool</span>
              <span className="pd-num font-black text-base text-[#0F172A] font-mono">{players.length || 22} Total</span>
            </div>
          </div>

          {/* Dream11-Style Pitch & Stadium Insights Bar */}
          <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-black text-[#0F172A]">
                <MapPin className="w-4 h-4 text-[#2563EB]" />
                <span>{match.venue || 'Wankhede Stadium, Mumbai'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-bold text-[#475569]">
                <span>Pitch: <strong className="text-[#0F172A]">Batting Friendly</strong></span>
                <span>•</span>
                <span>Good for: <strong className="text-[#2563EB]">Pacers (64%)</strong></span>
                <span>•</span>
                <span>Avg 1st Inn: <strong className="text-[#D97706] font-mono">168</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Teams — up to 6 per match: select, clone, or start new */}
      {token && (
        <div className="prime-card-3d p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xs uppercase text-[#0F172A]">My Teams ({myTeams.length}/6)</h3>
            <button
              onClick={startNewTeam}
              disabled={myTeams.length >= 6 || isLocked}
              className="prime-btn-3d !py-1.5 !px-3 text-[11px] font-black uppercase disabled:opacity-40"
            >
              + New Team
            </button>
          </div>
          {myTeams.length === 0 ? (
            <p className="text-xs text-[#64748B] font-bold">No saved teams yet. Build your first XI below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myTeams.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 ${editingTeamId === t.id ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#CBD5E1] bg-white'}`}
                >
                  <button
                    onClick={() => handleSelectExistingTeam(t)}
                    className="text-[11px] font-black text-[#0F172A] hover:text-[#2563EB]"
                    title="Edit this team"
                  >
                    {t.team_name || 'Team'}
                  </button>
                  <button
                    onClick={() => handleCloneTeam(t)}
                    disabled={myTeams.length >= 6 || isLocked}
                    className="text-[10px] font-black text-[#D97706] hover:text-[#B45309] disabled:opacity-40"
                    title="Duplicate this team"
                  >
                    Clone
                  </button>
                </div>
              ))}
            </div>
          )}
          {editingTeamId && !isLocked && (match?.contests || []).length > 0 && (
            <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
              <label className="pd-label">Switch this team to another contest</label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={switchContestId}
                  onChange={(e) => setSwitchContestId(e.target.value)}
                  className="pd-input flex-1 min-w-[160px] text-xs font-bold"
                >
                  <option value="">Select contest...</option>
                  {(match.contests || [])
                    .filter((c: any) => c.is_active && !c.is_private && c.status === 'open' && (c.filled_spots || 0) < (c.total_spots || 0))
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>{c.title} (₹{c.entry_fee})</option>
                    ))}
                </select>
                <button
                  onClick={handleSwitchContest}
                  disabled={switching || !switchContestId}
                  className="prime-btn-gold-3d !py-2 !px-4 text-[11px] font-black uppercase disabled:opacity-40"
                >
                  {switching ? 'Switching...' : 'Switch Contest'}
                </button>
              </div>
              <p className="text-[10px] text-[#64748B] font-bold">Entry fee difference auto-adjust hoti hai (refund/extra deduction).</p>
            </div>
          )}
        </div>
      )}

      {/* Contest Selection & Wallet Balance Bar */}
      {!h2hFlow && (
        <div className="prime-card-3d p-4 bg-gradient-to-r from-blue-50/70 via-amber-50/50 to-slate-50 border-2 border-blue-200/90 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label className="pd-label !text-blue-900 text-[11px] font-black uppercase flex items-center gap-1.5 mb-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#D97706]" /> Target Contest
              </label>
              <select
                value={selectedContestId}
                onChange={(e) => setSelectedContestId(e.target.value)}
                className="pd-input text-xs font-bold text-[#0F172A] bg-white border-blue-300 w-full"
              >
                {(match?.contests || [])
                  .filter((c: any) => c.is_active && !c.is_private)
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.title} • {c.type === 'practice' || Number(c.entry_fee) === 0 ? 'FREE' : `₹${c.entry_fee} Entry`} • Pool ₹{Number(c.prize_pool || 0).toLocaleString('en-IN')}
                    </option>
                  ))}
                <option value="practice_free">Practice Contest (Free)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 shrink-0 pt-3 sm:pt-0">
              <div className="text-right">
                <span className="text-[10px] text-[#64748B] font-bold block">Entry Fee</span>
                <span className="font-mono text-sm font-black text-[#2563EB]">
                  {entryFee === 0 ? 'FREE' : `₹${entryFee}`}
                </span>
              </div>

              <div className="h-8 w-px bg-slate-300" />

              <div className="text-right">
                <span className="text-[10px] text-[#64748B] font-bold block">Wallet Balance</span>
                <span className={`font-mono text-sm font-black ${isLowBalance ? 'text-red-600' : 'text-emerald-700'}`}>
                  ₹{walletBalance != null ? Number(walletBalance).toFixed(0) : '0'}
                </span>
              </div>

              {isLowBalance ? (
                <Link
                  href={`/wallet?depositAmount=${entryFee - (walletBalance || 0)}&needed=${entryFee}&returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '')}`}
                  className="prime-btn-gold-3d !py-2 !px-3 text-xs font-black uppercase shrink-0"
                >
                  + Add ₹{entryFee - (walletBalance || 0)}
                </Link>
              ) : (
                <Link
                  href="/wallet"
                  className="prime-btn-dark-3d !py-2 !px-3 text-xs font-black uppercase shrink-0"
                >
                  + Add Cash
                </Link>
              )}
            </div>
          </div>

          {isLowBalance && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Insufficient balance for this contest. ₹{entryFee - (walletBalance || 0)} add karein team enter karne ke liye.</span>
            </div>
          )}
        </div>
      )}

      {/* Role Navigation Tabs with Limits */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { key: 'WK', label: 'WK', limit: '1-4' },
          { key: 'BAT', label: 'BAT', limit: '3-6' },
          { key: 'AR', label: 'AR', limit: '1-4' },
          { key: 'BOWL', label: 'BOWL', limit: '3-6' },
        ] as const).map(({ key, label, limit }) => (
          <button
            key={key}
            onClick={() => setSelectedRole(key)}
            className={`py-2.5 px-2 rounded-xl border text-center transition cursor-pointer ${
              selectedRole === key
                ? 'prime-btn-3d !py-2.5 !px-2'
                : 'bg-white border-[#CBD5E1] text-[#64748B] hover:border-[#93C5FD] hover:text-[#2563EB]'
            }`}
          >
            <div className="font-black text-xs sm:text-sm">{label} ({roleCounts[key]})</div>
            <div className="text-[10px] font-bold opacity-80 mt-0.5">{limit}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs px-1 text-[#64748B] font-bold">
        <span>
          {selectedRole === 'WK' && 'Pick 1 - 4 Wicket Keepers'}
          {selectedRole === 'BAT' && 'Pick 3 - 6 Batters'}
          {selectedRole === 'AR' && 'Pick 1 - 4 All-Rounders'}
          {selectedRole === 'BOWL' && 'Pick 3 - 6 Bowlers'}
        </span>
        <span className="text-[11px] text-[#2563EB] font-mono">
          {roleFilteredPlayers.length} Players Available
        </span>
      </div>

      {error && !showPitchPreview && (
        <div className="pd-error">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Compact Rectangular Players Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2.5 max-h-[38rem] overflow-y-auto pr-1">
        {roleFilteredPlayers.map((p) => {
          const isSelected = selectedPlayerIds.includes(p.id);
          const prevMatchPts = p.last_match_points != null ? p.last_match_points : (p.points || 0);

          return (
            <div
              key={p.id}
              onClick={() => togglePlayer(p)}
              className={`relative rounded-xl border-2 p-2 sm:p-2.5 flex flex-col items-center text-center cursor-pointer transition-all select-none ${
                isSelected
                  ? 'bg-[#EFF6FF] border-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.25)]'
                  : 'bg-white border-[#CBD5E1] hover:border-[#93C5FD] hover:shadow-xs'
              }`}
            >
              {/* Card Top Header: Team Badge, Info Icon, & Checkbox/Plus */}
              <div className="w-full flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#0F172A] text-white border border-black/10">
                  {p.team_name?.slice(0, 3).toUpperCase()}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailPlayer(p);
                    }}
                    className="w-5 h-5 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#64748B] hover:text-[#2563EB] flex items-center justify-center transition cursor-pointer"
                    title="View Player Stats & Recent 5 Matches"
                  >
                    <Info className="w-3 h-3" />
                  </button>

                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center font-black text-xs transition-all ${
                      isSelected
                        ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-[0_0_6px_rgba(37,99,235,0.4)]'
                        : 'bg-[#F1F5F9] border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '+'}
                  </span>
                </div>
              </div>

              {/* Player Photo — Compact Portrait Rectangle Frame (for uploaded photos) */}
              <div className="relative w-20 h-24 sm:w-22 sm:h-26 rounded-lg overflow-hidden border border-[#CBD5E1] bg-[#F1F5F9] my-0.5 shadow-inner">
                <PlayerPhoto
                  name={p.name}
                  photoUrl={p.photo_url}
                  boxClass="w-full h-full text-base text-[#64748B] flex items-center justify-center font-bold"
                />
              </div>

              {/* Player Name */}
              <span className="font-black text-xs sm:text-[13px] text-[#0F172A] truncate w-full mt-1">
                {p.name}
              </span>

              {/* Team & Role + Playing status */}
              <div className="flex items-center gap-1 text-[10px] text-[#64748B] font-semibold">
                <span className="font-bold text-[#1E3A8A]">{p.role}</span>
                <span>•</span>
                <span>Sel {p.selected_by_pct != null ? `${Math.round(p.selected_by_pct)}%` : '—'}</span>
              </div>
              {p.is_playing_xi === false ? (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-50 border border-amber-300 text-amber-800 mt-0.5">
                  ● Bench / Unannounced
                </span>
              ) : (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-300 text-emerald-700 mt-0.5">
                  ● Playing XI
                </span>
              )}

              {/* Compact Stats Badges: Prev Match Points & Credits */}
              <div className="grid grid-cols-2 gap-1.5 w-full mt-2 pt-1.5 border-t border-[#E2E8F0]">
                {/* Prev Points */}
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-md py-0.5 px-1 text-center">
                  <span className="text-[8px] text-[#1D4ED8] block uppercase font-bold leading-tight">Prev Pts</span>
                  <span className="font-mono font-black text-xs text-[#1E3A8A] leading-tight block">
                    {prevMatchPts}
                  </span>
                </div>

                {/* Credits */}
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-md py-0.5 px-1 text-center">
                  <span className="text-[8px] text-[#B45309] block uppercase font-bold leading-tight">Credits</span>
                  <span className="font-mono font-black text-xs text-[#B45309] leading-tight block">
                    {p.credits}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Bar */}
      <div className="sticky bottom-4 z-20 space-y-2">
        {error && !showPitchPreview && (
          <div className="p-3 rounded-xl bg-red-50 border-2 border-red-400 text-red-700 text-xs font-bold flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 font-black text-sm px-1.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-[#CBD5E1] flex items-center justify-between shadow-[0_10px_30px_rgba(30,58,138,0.18)]">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black ${selectedPlayerIds.length === 11 ? 'text-green-700' : 'text-[#0F172A]'}`}>
                {selectedPlayerIds.length}/11 Players Picked
              </span>
              {selectedPlayerIds.length === 11 && (
                <span className="text-[10px] font-black text-green-700 bg-green-100 border border-green-300 px-1.5 py-0.2 rounded">
                  ✓ 11 Selected
                </span>
              )}
            </div>
            <span className="text-xs text-[#D97706] font-mono font-black">{creditsLeft} CR left</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPitchMode('view');
                setShowPitchPreview(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white !py-2.5 !px-3 sm:!px-4 text-xs font-black flex items-center gap-1.5 rounded-xl shadow-lg border-2 border-emerald-400 cursor-pointer transition-transform hover:scale-105"
              title="View on Cricket Stadium Ground"
            >
              <Eye className="w-4 h-4 text-emerald-200" />
              <span>Preview XI</span>
            </button>

            {isLocked ? (
              <button
                type="button"
                disabled
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[#E2E8F0] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed flex items-center gap-1.5 shadow-none"
              >
                <Lock className="w-4 h-4 text-[#94A3B8]" />
                <span>Squads Locked</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleProceedToCaptain}
                className={`prime-btn-3d !py-2.5 !px-4 sm:!px-6 text-xs font-black uppercase tracking-wider cursor-pointer ${
                  selectedPlayerIds.length === 11 ? 'shadow-[0_0_16px_rgba(37,99,235,0.6)]' : 'opacity-90'
                }`}
              >
                <span>{isLowBalance ? `Add ₹${entryFee - (walletBalance || 0)} to Join →` : entryFee > 0 ? `Pay ₹${entryFee} • Choose C / VC →` : 'Choose C / VC →'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dream11-Style Cricket Pitch Ground Preview & Captain/Vice-Captain Selector */}
      <CricketPitchView
        isOpen={showPitchPreview}
        onClose={() => setShowPitchPreview(false)}
        mode={pitchMode}
        teamName={teamName}
        onTeamNameChange={setTeamName}
        players={selectedPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          team_name: p.team_name,
          role: p.role,
          credits: p.credits,
          points: p.last_match_points || p.points,
          photo_url: p.photo_url,
          is_captain: p.id === captainId,
          is_vice_captain: p.id === viceCaptainId,
        }))}
        captainId={captainId}
        viceCaptainId={viceCaptainId}
        onSelectCaptain={(pId) => {
          if (viceCaptainId === pId) setViceCaptainId(null);
          setCaptainId(pId);
        }}
        onSelectViceCaptain={(pId) => {
          if (captainId === pId) setCaptainId(null);
          setViceCaptainId(pId);
        }}
        onSubmitTeam={handleSubmitTeam}
        submitting={submitting}
        isEditing={!!editingTeamId}
        teamA={match?.team_a}
        teamB={match?.team_b}
        teamACount={teamCounts[match?.team_a] || 0}
        teamBCount={teamCounts[match?.team_b] || 0}
        creditsLeft={creditsLeft}
        entryFee={entryFee}
        walletBalance={walletBalance}
        isLowBalance={isLowBalance}
        error={error}
      />

      {/* Player Detailed Stats & 5-Match Performance Modal */}
      <PlayerDetailModal
        player={detailPlayer}
        onClose={() => setDetailPlayer(null)}
        isSelected={detailPlayer ? selectedPlayerIds.includes(detailPlayer.id) : false}
        onToggleSelect={(p) => togglePlayer(p as any)}
      />
    </div>
  );
}
