'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Crown, Check, ArrowLeft, AlertCircle, ChevronRight } from 'lucide-react';
import { apiGet, apiPost, apiPut, resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import CategoryBadge from '../../components/ui/CategoryBadge';
import PlayerPhoto from '../../components/ui/PlayerPhoto';

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

export default function CricketTeamBuilderPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId');
  const teamId = searchParams.get('teamId');
  const h2hFlow = searchParams.get('h2h') === '1';
  const { tournamentId: matchId } = use(params);
  const { token } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedRole, setSelectedRole] = useState<'WK' | 'BAT' | 'AR' | 'BOWL'>('WK');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [showCapModal, setShowCapModal] = useState(false);
  const [capMode, setCapMode] = useState<'C' | 'VC' | null>(null);
  const [teamName, setTeamName] = useState('My Prime XI');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [switchContestId, setSwitchContestId] = useState('');
  const [switching, setSwitching] = useState(false);

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
  const isLocked = !!match && (
    match.is_locked || match.status === 'live' || match.status === 'completed' ||
    (lockTime !== null && new Date() >= lockTime)
  );

  const selectedPlayers = players.filter((p) => selectedPlayerIds.includes(p.id));
  const totalCreditsUsed = selectedPlayers.reduce((sum, p) => sum + (Number(p.credits) || 9.0), 0);
  const creditsLeft = Math.round((TOTAL_CREDITS - totalCreditsUsed) * 10) / 10;

  const roleCounts = {
    WK: selectedPlayers.filter((p) => p.role === 'WK').length,
    BAT: selectedPlayers.filter((p) => p.role === 'BAT').length,
    AR: selectedPlayers.filter((p) => p.role === 'AR').length,
    BOWL: selectedPlayers.filter((p) => p.role === 'BOWL').length,
  };

  const teamCounts: Record<string, number> = {};
  selectedPlayers.forEach((p) => {
    teamCounts[p.team_name] = (teamCounts[p.team_name] || 0) + 1;
  });

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
    if (selectedPlayerIds.length !== 11) {
      return 'Exactly 11 players required.';
    }
    if (roleCounts.WK < 1) return 'Pick at least 1 Wicket Keeper (1-4).';
    if (roleCounts.BAT < 3) return 'Pick at least 3 Batters (3-6).';
    if (roleCounts.AR < 1) return 'Pick at least 1 All-Rounder (1-4).';
    if (roleCounts.BOWL < 3) return 'Pick at least 3 Bowlers (3-6).';
    return null;
  };

  const handleProceedToCaptain = () => {
    const validationError = validateTeamComposition();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setCapMode(null);
    setShowCapModal(true);
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
        : await apiPost(`/matches/${matchId}/teams`, { ...payload, contest_id: h2hFlow ? null : contestId || null }, token);

      if (res?.success) {
        if (h2hFlow && !editingTeamId && res.team?.id) {
          router.push(`/h2h/challenge?matchId=${matchId}&teamId=${res.team.id}`);
        } else {
          router.push('/my-teams');
        }
      } else {
        setError(res?.error || 'Failed to submit team');
      }
    } catch (err: any) {
      setError(err?.message || 'Error saving team. Check contest lock and balance.');
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

  const roleFilteredPlayers = players.filter((p) => p.role === selectedRole);

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
              <span className="pd-num font-black text-base text-[#0F172A] font-mono">30 Total</span>
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

      {/* Role Navigation Tabs */}
      <div className="grid grid-cols-4 gap-2.5">
        {(['WK', 'BAT', 'AR', 'BOWL'] as const).map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`p-3 rounded-xl border text-center transition cursor-pointer ${selectedRole === role
                ? 'prime-btn-3d !p-3'
                : 'prime-btn-dark-3d !p-3 !text-[#64748B]'
              }`}
          >
            <div className="font-black text-sm">{role}</div>
            <div className="text-[11px] font-black mt-0.5">({roleCounts[role]})</div>
          </button>
        ))}
      </div>

      {error && !showCapModal && (
        <div className="pd-error">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Players Grid for Selected Role — 3 compact photos per row, names below */}
      <div className="grid grid-cols-3 gap-2.5 max-h-[36rem] overflow-y-auto pr-1">
        {roleFilteredPlayers.map((p) => {
          const isSelected = selectedPlayerIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlayer(p)}
              className={`relative rounded-xl border-2 p-2 flex flex-col items-center text-center cursor-pointer transition-all select-none ${isSelected
                  ? 'bg-[#EFF6FF] border-[#2563EB] shadow-[0_0_14px_rgba(37,99,235,0.35)]'
                  : 'bg-white border-[#CBD5E1] hover:border-[#93C5FD] hover:shadow-[0_0_10px_rgba(37,99,235,0.18)]'
                }`}
            >
              <div className="relative w-full aspect-square mb-1.5">
                <PlayerPhoto
                  name={p.name}
                  photoUrl={p.photo_url}
                  boxClass="w-full h-full rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] text-xl text-[#94A3B8]"
                />
                <span className={`absolute top-1 right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center font-black text-xs ${isSelected
                    ? 'bg-[#2563EB] text-white border-white shadow-[0_0_6px_rgba(37,99,235,0.6)]'
                    : 'bg-white/90 border-[#CBD5E1] text-[#64748B]'
                  }`}>
                  {isSelected ? <Check className="w-3.5 h-3.5" /> : '+'}
                </span>
              </div>
              <span className="font-black text-[11px] text-[#0F172A] leading-tight line-clamp-2 min-h-[2rem] flex items-center">{p.name}</span>
              {p.is_playing_xi && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-green-100 border border-green-300 text-green-700">Playing XI</span>
              )}
              <span className="text-[9px] text-[#64748B] font-bold mt-0.5 truncate w-full">
                {p.team_name} • <span className="text-[#D97706]">{p.points || 0} pts</span>
              </span>
              <div className="mt-1 grid grid-cols-3 gap-1 w-full text-[8px] font-bold text-[#475569]">
                <span className="rounded bg-[#F1F5F9] border border-[#E2E8F0] py-0.5" title="Selected by">
                  {p.selected_by_pct != null ? `${Math.round(p.selected_by_pct)}%` : '—'}
                </span>
                <span className="rounded bg-[#F1F5F9] border border-[#E2E8F0] py-0.5" title="Last match points">
                  {p.last_match_points != null ? `${p.last_match_points}` : '—'}
                </span>
                <span className="rounded bg-[#F1F5F9] border border-[#E2E8F0] py-0.5" title="Average points">
                  {p.avg_points != null ? `${Math.round(p.avg_points)}` : '—'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between w-full gap-1">
                <span className="text-[8px] font-bold text-[#64748B] truncate" title="Recent form">
                  {p.form ? `Form: ${p.form}` : 'Form: —'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#FFFBEB] border border-[#FDE68A] font-mono font-black text-[10px] text-[#B45309] shrink-0">
                  {p.credits} CR
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Floating Bar */}
      <div className="sticky bottom-4 z-20 p-4 bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-[#CBD5E1] flex items-center justify-between shadow-[0_10px_30px_rgba(30,58,138,0.18)]">
        <div>
          <span className="text-xs font-black text-[#0F172A] block">{selectedPlayerIds.length}/11 Players Picked</span>
          <span className="text-xs text-[#D97706] font-mono font-black">{creditsLeft} CR left</span>
        </div>
        <button
          onClick={handleProceedToCaptain}
          disabled={selectedPlayerIds.length !== 11 || isLocked}
          className="prime-btn-3d !py-2.5 !px-6 text-xs font-black uppercase tracking-wider disabled:opacity-40"
        >
          <span>Choose C / VC</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Captain & Vice-Captain Selection Modal — mode-based with photos */}
      {showCapModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl prime-card-3d p-6 space-y-4 border-2 border-[#2563EB] max-h-[90vh] flex flex-col bg-white">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="font-black text-[#0F172A] text-base flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[#D97706]" /> Assign Multipliers
                </h3>
                <p className="text-xs text-[#64748B] font-bold">Captain gets 2× Points • Vice-Captain gets 1.5× Points</p>
              </div>
              <button onClick={() => setShowCapModal(false)} className="text-[#64748B] hover:text-[#0F172A] text-lg">✕</button>
            </div>

            <div>
              <label className="pd-label">Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="pd-input font-black"
                placeholder="My Prime XI"
              />
            </div>

            <p className={`text-xs font-black text-center py-1.5 rounded-lg ${capMode
                ? capMode === 'C' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#FFFBEB] text-[#B45309]'
                : 'bg-[#F1F5F9] text-[#64748B]'
              }`}>
              {capMode
                ? `All players highlighted — tap one to make ${capMode === 'C' ? 'Captain (2×)' : 'Vice-Captain (1.5×)'}`
                : 'Tap C or VC below, then tap a player to assign'}
            </p>

            {/* Selected XI photo grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {selectedPlayers.map((p) => {
                  const isC = captainId === p.id;
                  const isVC = viceCaptainId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => assignCapRole(p)}
                      className={`rounded-xl border-2 p-2 flex flex-col items-center text-center transition cursor-pointer ${isC
                          ? 'bg-[#EFF6FF] border-[#2563EB] shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                          : isVC
                          ? 'bg-[#FFFBEB] border-[#F59E0B] shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                          : capMode
                          ? capMode === 'C'
                            ? 'bg-white border-[#93C5FD] shadow-[0_0_10px_rgba(37,99,235,0.3)] hover:border-[#2563EB]'
                            : 'bg-white border-[#FDE68A] shadow-[0_0_10px_rgba(245,158,11,0.3)] hover:border-[#F59E0B]'
                          : 'bg-[#F8FAFC] border-[#CBD5E1]'
                        }`}
                    >
                      <div className="relative w-full aspect-square mb-1.5">
                        <PlayerPhoto
                          name={p.name}
                          photoUrl={p.photo_url}
                          boxClass="w-full h-full rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] text-xl text-[#94A3B8]"
                        />
                        {isC && (
                          <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#2563EB] text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-[0_0_8px_rgba(37,99,235,0.6)]">C</span>
                        )}
                        {isVC && (
                          <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#F59E0B] text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-[0_0_8px_rgba(245,158,11,0.6)]">VC</span>
                        )}
                      </div>
                      <span className="font-bold text-[#0F172A] text-[11px] leading-tight line-clamp-2">{p.name}</span>
                      <span className="text-[9px] text-[#64748B] font-bold mt-0.5">{p.team_name} • {p.role}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* C / VC mode buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCapMode(capMode === 'C' ? null : 'C')}
                className={`py-3 rounded-xl font-black text-sm border-2 transition cursor-pointer flex items-center justify-center gap-2 ${capMode === 'C'
                    ? 'bg-[#2563EB] text-white border-[#93C5FD] shadow-[0_0_16px_rgba(37,99,235,0.5)]'
                    : 'bg-white text-[#1D4ED8] border-[#93C5FD] hover:bg-[#EFF6FF]'
                  }`}
              >
                <span className="w-7 h-7 rounded-full bg-white/20 border border-current flex items-center justify-center text-xs">C</span>
                Captain (2×)
                {captainId && <Check className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setCapMode(capMode === 'VC' ? null : 'VC')}
                className={`py-3 rounded-xl font-black text-sm border-2 transition cursor-pointer flex items-center justify-center gap-2 ${capMode === 'VC'
                    ? 'bg-[#F59E0B] text-white border-[#FDE68A] shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                    : 'bg-white text-[#B45309] border-[#FDE68A] hover:bg-[#FFFBEB]'
                  }`}
              >
                <span className="w-7 h-7 rounded-full bg-white/20 border border-current flex items-center justify-center text-[10px]">VC</span>
                Vice-Captain (1.5×)
                {viceCaptainId && <Check className="w-4 h-4" />}
              </button>
            </div>

            {error && <div className="pd-error">{error}</div>}

            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCapModal(false)}
                className="prime-btn-dark-3d text-xs !py-2 !px-4"
              >
                Back to XI
              </button>
              <button
                type="button"
                onClick={handleSubmitTeam}
                disabled={submitting || !captainId || !viceCaptainId}
                className="prime-btn-3d text-xs !py-2 !px-5 font-black disabled:opacity-40"
              >
                {submitting ? 'Saving...' : editingTeamId ? 'Update Team' : 'Submit Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
