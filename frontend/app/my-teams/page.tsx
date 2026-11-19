'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Shield, ArrowRight, Plus, Pencil, Lock, Trophy, Eye, Check, Clock } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import CategoryFilterTabs from '../components/ui/CategoryFilterTabs';
import CategoryBadge from '../components/ui/CategoryBadge';

const CricketPitchView = dynamic(() => import('../components/ui/CricketPitchView'), { ssr: false });

function getMatchCountdown(startTime: string | Date | undefined, now: number) {
  if (!startTime) return 'Starts soon';
  const diff = new Date(startTime).getTime() - now;
  if (diff <= 0) return 'Starting now';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function MyTeamsPage() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [previewTeam, setPreviewTeam] = useState<any>(null);

  // Live clock ticker every 1000ms for exact countdowns
  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch user teams + auto-refresh heartbeat (6s if any match is live)
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchTeams = () => {
      apiGet('/my-teams', token)
        .then((res) => {
          if (isMounted && res?.teams) {
            setTeams(res.teams);
          }
        })
        .catch((err) => console.error(err))
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    };

    fetchTeams();

    const hasLiveMatch = teams.some((t) => t.match?.status === 'live');
    const interval = setInterval(fetchTeams, hasLiveMatch ? 6000 : 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, teams.some((t) => t.match?.status === 'live')]);

  // Status counts
  const liveCount = useMemo(() => teams.filter((t) => t.match?.status === 'live').length, [teams]);
  const upcomingCount = useMemo(() => teams.filter((t) => !t.match?.status || t.match?.status === 'upcoming').length, [teams]);
  const completedCount = useMemo(() => teams.filter((t) => t.match?.status === 'completed').length, [teams]);

  // Filtering
  const categoryFiltered = useMemo(() => {
    return teams.filter((t) => {
      if (selectedCategory === 'All') return true;
      return t.match?.category === selectedCategory;
    });
  }, [teams, selectedCategory]);

  const activeTeams = useMemo(() => {
    return categoryFiltered.filter((t) => t.match?.status !== 'completed');
  }, [categoryFiltered]);

  const completedTeams = useMemo(() => {
    return categoryFiltered.filter((t) => t.match?.status === 'completed');
  }, [categoryFiltered]);

  const displayedTeams = useMemo(() => {
    if (statusFilter === 'live') return categoryFiltered.filter((t) => t.match?.status === 'live');
    if (statusFilter === 'upcoming') return categoryFiltered.filter((t) => !t.match?.status || t.match?.status === 'upcoming');
    if (statusFilter === 'completed') return completedTeams;
    return activeTeams;
  }, [statusFilter, categoryFiltered, activeTeams, completedTeams]);

  const renderTeamCard = (team: any) => {
    const match = team.match;
    const contest = team.contest;
    const matchStatus = match?.status || 'upcoming';
    const isUpcoming = matchStatus === 'upcoming';
    const isLive = matchStatus === 'live';
    const isCompleted = matchStatus === 'completed';

    const matchLock = match?.start_time
      ? new Date(new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000)
      : null;
    const teamLocked = !match || match.is_locked || isLive || isCompleted || (matchLock !== null && clockNow >= matchLock.getTime());

    return (
      <div key={team.id} className="prime-card-3d p-3 sm:p-4 flex flex-col justify-between group">
        <div>
          {/* Top Bar: Category & Status */}
          <div className="flex items-center justify-between mb-2">
            {match && <CategoryBadge category={match.category} size="xs" />}
            {isLive ? (
              <span className="font-mono text-[10px] font-black text-white px-2 py-0.5 rounded-md bg-red-600 shadow-xs flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>LIVE</span>
              </span>
            ) : isCompleted ? (
              <span className="font-mono text-[10px] font-black text-slate-700 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>COMPLETED</span>
              </span>
            ) : (
              <span className="font-mono text-[10px] font-black text-amber-800 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-amber-600" />
                <span>Starts in {getMatchCountdown(match?.start_time, clockNow)}</span>
              </span>
            )}
          </div>

          {/* Contest Identifier & Scoped Ranking */}
          <div className="mb-2 p-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center justify-between gap-1.5 shadow-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Trophy className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-black text-blue-900 truncate">
                CONTEST #{contest?.contest_code || contest?.id?.slice(0, 6) || 2011}
              </span>
            </div>
            <div className="shrink-0 text-right">
              {isUpcoming ? (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300">
                  ⏳ Starts Soon
                </span>
              ) : isLive ? (
                <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-300 shadow-xs flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Rank #{team.rank ?? '—'}</span>
                  <span className="text-[9px] text-emerald-600 font-bold">/ {team.total_contest_teams || contest?.filled_spots || 1}</span>
                </span>
              ) : (
                <span className="text-[10px] font-black font-mono text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded border border-blue-300 shadow-xs flex items-center gap-1">
                  <span>🏆 Rank #{team.rank ?? '—'}</span>
                  <span className="text-[9px] text-blue-600 font-bold">/ {team.total_contest_teams || contest?.filled_spots || 1}</span>
                </span>
              )}
            </div>
          </div>

          <h3 className="font-black text-[#0F172A] text-sm sm:text-base leading-snug mb-0.5 truncate">{team.team_name}</h3>
          <p className="text-[11px] text-[#64748B] font-bold truncate">{match?.title || 'Cricket Match'}</p>

          {/* Multipliers & Points Box */}
          <div className="mt-2.5 p-2 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] grid grid-cols-3 gap-1.5 text-center">
            <div>
              <span className="text-[9px] text-[#64748B] uppercase font-black block">Cap (2×)</span>
              <span className="text-[11px] font-black text-[#0F172A] truncate block mt-0.5">
                {team.captain?.name || 'Assigned'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#64748B] uppercase font-black block">VC (1.5×)</span>
              <span className="text-[11px] font-black text-[#0F172A] truncate block mt-0.5">
                {team.viceCaptain?.name || 'Assigned'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#64748B] uppercase font-black block">Total Pts</span>
              <span className={`text-sm sm:text-base font-black font-mono block mt-0.5 ${
                isLive ? 'text-[#16A34A] drop-shadow-[0_0_6px_rgba(22,163,74,0.3)]' : 'text-[#D97706]'
              }`}>
                {isUpcoming ? '0.0' : (team.total_points || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Contest & Rank Footer */}
        <div className="mt-2.5 pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px]">
          <span className="text-[#64748B] font-bold truncate max-w-[120px] text-[10px] sm:text-[11px]">
            <strong className="text-[#0F172A]">{contest?.title?.replace(/₹\s*[\d,]+/g, '').replace(/\s+/g, ' ').trim() || 'Open Contest'}</strong>
          </span>
          {match && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setPreviewTeam(team)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs border border-emerald-400 cursor-pointer"
                title="View team on cricket stadium pitch"
              >
                <Eye className="w-3 h-3 text-emerald-200" />
                <span>Pitch View</span>
              </button>

              {teamLocked ? (
                <span className="text-[#64748B] font-black text-[10px] flex items-center gap-0.5" title="Contest locked — editing closed">
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </span>
              ) : (
                <Link
                  href={`/team-builder/${match.id}?teamId=${team.id}`}
                  className="text-[#16A34A] font-black text-[10px] hover:underline flex items-center gap-0.5"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </Link>
              )}

              <Link
                href={`/match/${match.id}/leaderboard?teamId=${team.id}`}
                className="text-[#D97706] font-black text-[10px] hover:underline flex items-center gap-0.5 group"
              >
                <Trophy className="w-3 h-3" />
                <span>Ranks</span>
              </Link>

              <Link
                href={`/match/${match.id}`}
                className="text-[#2563EB] font-black text-[10px] hover:underline flex items-center gap-0.5 group"
              >
                <span>View</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-2 sm:px-6 pt-2 pb-24 sm:pb-8 max-w-7xl mx-auto w-full space-y-3 sm:space-y-4 bg-transparent text-[#0F172A]">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-2xl font-black text-[#0F172A] flex items-center gap-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB] drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
            <span>My Cricket Fantasy Teams</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-[#64748B] font-bold mt-0.5">
            Track your 11-player lineups, live points, multipliers, and contest ranks
          </p>
        </div>
        <Link href="/" className="prime-btn-3d text-[11px] !py-1.5 !px-3.5 font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Team</span>
        </Link>
      </div>

      {/* Category Filter Tabs */}
      <div>
        <CategoryFilterTabs
          selectedCategory={selectedCategory}
          onSelect={(cat) => setSelectedCategory(cat)}
          className="pb-1"
        />
      </div>

      {/* Match Status Portions Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'bg-white text-[#64748B] hover:text-[#0F172A] border border-[#CBD5E1]'
          }`}
        >
          All Teams ({categoryFiltered.length})
        </button>
        <button
          onClick={() => setStatusFilter('live')}
          className={`px-3 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
            statusFilter === 'live'
              ? 'bg-[#EF4444] text-white shadow-xs'
              : 'bg-white text-[#EF4444] hover:bg-red-50 border border-red-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          <span>Live ({liveCount})</span>
        </button>
        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`px-3 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
            statusFilter === 'upcoming'
              ? 'bg-[#D97706] text-white shadow-xs'
              : 'bg-white text-[#D97706] hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <Clock className="w-3 h-3 text-[#D97706]" />
          <span>Upcoming ({upcomingCount})</span>
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
            statusFilter === 'completed'
              ? 'bg-[#475569] text-white shadow-xs'
              : 'bg-white text-[#64748B] hover:bg-slate-50 border border-slate-300'
          }`}
        >
          <Check className="w-3 h-3 text-emerald-600" />
          <span>Completed ({completedCount})</span>
        </button>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="py-24 text-center text-[#64748B]">
          <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
          <p className="text-sm font-black text-[#0F172A]">Loading your teams...</p>
        </div>
      ) : displayedTeams.length === 0 && (statusFilter !== 'all' || completedTeams.length === 0) ? (
        <div className="p-8 text-center prime-card-3d space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-2xl shadow-[0_0_16px_rgba(37,99,235,0.35)] border border-[#93C5FD]">
            🏏
          </div>
          <h3 className="text-base font-black text-[#0F172A]">No teams in this section</h3>
          <p className="text-xs text-[#64748B] font-bold max-w-sm mx-auto">
            Pick an upcoming match, select your 11 players, and join contests to compete!
          </p>
          <Link href="/" className="prime-btn-3d inline-flex text-xs !py-2 !px-4 mt-1 font-black uppercase">
            Explore Matches
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Main Grid: Active / Filtered Teams */}
          {displayedTeams.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
              {displayedTeams.map(renderTeamCard)}
            </div>
          )}

          {/* Dedicated Completed Matches Section (When viewing All and completed matches exist) */}
          {statusFilter === 'all' && completedTeams.length > 0 && (
            <div className="pt-4 space-y-3 border-t border-dashed border-[#CBD5E1]">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h2 className="text-xs sm:text-sm font-black text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Completed Matches &amp; Archived Teams ({completedTeams.length})</span>
                </h2>
                <span className="text-[10px] font-bold text-[#64748B] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  Auto-pruned 6 days after match completion
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                {completedTeams.map(renderTeamCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dream11-Style Cricket Pitch Ground Preview Modal */}
      {previewTeam && (
        <CricketPitchView
          isOpen={!!previewTeam}
          onClose={() => setPreviewTeam(null)}
          teamName={previewTeam.team_name}
          teamRank={previewTeam.rank}
          teamTotalPoints={previewTeam.total_points}
          players={(previewTeam.players || []).map((p: any) => {
            const isCap = p.id === previewTeam.captain_id || p.id === previewTeam.captain?.id;
            const isVC = p.id === previewTeam.vice_captain_id || p.id === previewTeam.viceCaptain?.id;
            const basePts = Number(p.points || 0);
            const earned = p.points_earned ? Number(p.points_earned) : Math.round((isCap ? basePts * 2 : isVC ? basePts * 1.5 : basePts) * 10) / 10;
            return {
              id: p.id,
              name: p.name,
              team_name: p.team_name,
              role: p.role,
              credits: p.credits || 9.0,
              points: basePts,
              points_earned: earned,
              photo_url: p.photo_url,
              is_captain: isCap,
              is_vice_captain: isVC,
            };
          })}
          captainId={previewTeam.captain_id || previewTeam.captain?.id}
          viceCaptainId={previewTeam.vice_captain_id || previewTeam.viceCaptain?.id}
          teamA={previewTeam.match?.team_a}
          teamB={previewTeam.match?.team_b}
        />
      )}
    </div>
  );
}
