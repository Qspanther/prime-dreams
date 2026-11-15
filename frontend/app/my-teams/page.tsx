'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Shield, ArrowRight, Plus, Pencil, Lock, Trophy, Eye, Copy, Check, Share2, Swords, Clock } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import CategoryFilterTabs from '../components/ui/CategoryFilterTabs';
import CategoryBadge from '../components/ui/CategoryBadge';

const CricketPitchView = dynamic(() => import('../components/ui/CricketPitchView'), { ssr: false });

export default function MyTeamsPage() {
  const { token, user, isAuthenticated } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [lockClockNow, setLockClockNow] = useState(() => Date.now());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [previewTeam, setPreviewTeam] = useState<any>(null);
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);

  const copyFieldLink = (team: any) => {
    if (!team.contest?.invite_code || !team.match?.id) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/match/${team.match.id}?joinCode=${team.contest.invite_code}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedTeamId(team.id);
      setTimeout(() => setCopiedTeamId(null), 2500);
    }).catch(() => {});
  };

  const shareFieldWhatsApp = (team: any) => {
    if (!team.contest?.invite_code || !team.match?.id) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/match/${team.match.id}?joinCode=${team.contest.invite_code}`;
    const text = `🏏 Join my cricket ground "${team.contest.title}" on Prime Dreems!\n💰 Entry Fee: ₹${team.contest.entry_fee}\n🏆 Dynamic Prize Pool (60%): ₹${team.contest.prize_pool}\n🔑 Code: ${team.contest.invite_code}\n👉 Join here: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => {
    if (!token) return;
    apiGet('/my-teams', token)
      .then((res) => {
        if (res?.teams) {
          setTeams(res.teams);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const lockTimes = teams
      .map((team) => {
        const match = team.match;
        if (!match?.start_time || match.status !== 'upcoming') return null;
        return new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000;
      })
      .filter((time): time is number => time !== null);
    const now = Date.now();
    const dueLockTime = Math.max(0, ...lockTimes.filter(time => time <= now));
    if (dueLockTime > lockClockNow) setLockClockNow(dueLockTime);

    const nextLockTime = lockTimes.filter(time => time > now).sort((a, b) => a - b)[0];
    if (!nextLockTime) return;

    const timer = setTimeout(() => setLockClockNow(Date.now()), nextLockTime - Date.now() + 25);
    return () => clearTimeout(timer);
  }, [teams, lockClockNow]);

  const filteredTeams = teams.filter((t) => {
    if (selectedCategory === 'All') return true;
    return t.match?.category === selectedCategory;
  });

  return (
    <div className="px-3 sm:px-6 py-6 max-w-7xl mx-auto w-full space-y-6 bg-transparent text-[#0F172A]">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-[#0F172A] flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-[#2563EB] drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
            <span>My Cricket Fantasy Teams</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-bold mt-1">
            Track your 11-player lineups, live points, multipliers, and contest ranks
          </p>
        </div>
        <Link href="/" className="prime-btn-3d text-xs !py-2.5 !px-5 font-black uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Create New Team</span>
        </Link>
      </div>

      {/* Section 5.4: User-Side Category Filter Tabs */}
      <div className="space-y-2">
        <CategoryFilterTabs
          selectedCategory={selectedCategory}
          onSelect={(cat) => setSelectedCategory(cat)}
        />
      </div>

      {/* Teams Grid (3 Columns on Desktop) */}
      {loading ? (
        <div className="py-24 text-center text-[#64748B]">
          <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
          <p className="text-sm font-black text-[#0F172A]">Loading your teams...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="p-12 text-center prime-card-3d space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(37,99,235,0.4)] border-2 border-[#93C5FD]">
            🏏
          </div>
          <h3 className="text-xl font-black text-[#0F172A]">No teams created yet</h3>
          <p className="text-xs text-[#64748B] font-bold max-w-sm mx-auto">
            Pick a match from the home arena, select your 11 players, and enter standard or H2H contests.
          </p>
          <Link href="/" className="prime-btn-3d inline-flex text-xs !py-2.5 !px-5 mt-2 font-black uppercase">
            Explore Matches
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeams.map((team) => {
            const match = team.match;
            const contest = team.contest;
            const matchLock = match?.start_time
              ? new Date(new Date(match.start_time).getTime() - (match.lock_time_minutes || 15) * 60000)
              : null;
            const teamLocked = !match || match.is_locked || match.status === 'live' ||
              match.status === 'completed' || (matchLock !== null && lockClockNow >= matchLock.getTime());

            return (
              <div
                key={team.id}
                className="prime-card-3d p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Category & Status */}
                  <div className="flex items-center justify-between mb-3">
                    {match && <CategoryBadge category={match.category} size="xs" />}
                    <span className="font-mono text-xs font-black text-[#D97706] px-2.5 py-0.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
                      {match?.status === 'live' ? '⚡ LIVE' : match?.match_date}
                    </span>
                  </div>

                  <h3 className="font-black text-[#0F172A] text-base mb-1">{team.team_name}</h3>
                  <p className="text-xs text-[#64748B] font-bold">
                    {match?.title || 'Cricket Match'}
                  </p>

                  {/* Multipliers & Points Box */}
                  <div className="mt-4 p-3 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-[#64748B] uppercase font-black block">Cap (2×)</span>
                      <span className="text-xs font-black text-[#0F172A] truncate block mt-0.5">
                        {team.captain?.name || 'Assigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748B] uppercase font-black block">VC (1.5×)</span>
                      <span className="text-xs font-black text-[#0F172A] truncate block mt-0.5">
                        {team.viceCaptain?.name || 'Assigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748B] uppercase font-black block">Total Pts</span>
                      <span className="text-base font-black text-[#D97706] font-mono block mt-0.5 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                        {team.total_points || 0}
                      </span>
                    </div>
                  </div>

                  {/* H2H Challenge Status Box */}
                  {(contest?.type === 'h2h' || contest?.challenge) && (
                    <div className="mt-3 p-3 rounded-xl border-2 bg-white flex flex-col gap-2 shadow-sm border-[#CBD5E1]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-[#1E293B] flex items-center gap-1.5">
                          <Swords className="w-4 h-4 text-[#2563EB]" />
                          <span>H2H Duel</span>
                        </span>
                        {contest.challenge?.receiver_team_id ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#ECFDF5] text-[#059669] border border-[#6EE7B7] shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                            <span>ACCEPTED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] shadow-sm">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#475569] font-medium leading-relaxed">
                        {contest.challenge?.receiver_team_id
                          ? `Opponent @${contest.challenge.receiver_username || 'Opponent'} has accepted & registered their team. Duel is on!`
                          : `Request sent to @${contest.challenge?.receiver_username || 'Opponent'}. Waiting for opponent to accept & register team.`}
                      </p>
                    </div>
                  )}

                  {/* Private Playground / Field Box with 60% Dynamic Prize Pool & Direct Share Link */}
                  {(contest?.is_private || contest?.type === 'private') && (
                    <div className="mt-3 p-3 rounded-xl border-2 border-[#93C5FD] bg-[#EFF6FF] flex flex-col gap-2.5 shadow-sm">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-[#1E3A8A] flex items-center gap-1.5 truncate">
                          <span>🏟️</span>
                          <span className="truncate">{contest.title || 'Private Field'}</span>
                        </span>
                        <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-md border border-[#BFDBFE] text-[#1D4ED8] shrink-0">
                          ₹{contest.entry_fee} Entry
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center p-2 rounded-lg bg-white/90 border border-[#BFDBFE]">
                        <div>
                          <span className="text-[10px] font-bold text-[#64748B] block">Prize Pool (60%)</span>
                          <span className="text-xs font-black font-mono text-[#D97706]">
                            ₹{contest.prize_pool || Math.round((Number(contest.filled_spots) || 1) * (Number(contest.entry_fee) || 0) * 0.6)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#64748B] block">Players Joined</span>
                          <span className="text-xs font-black font-mono text-[#1E293B]">
                            {contest.filled_spots || 1}
                          </span>
                        </div>
                      </div>

                      {/* Shareable Link & Code */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <div className="flex-1 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 flex items-center justify-between min-w-0">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase shrink-0">Code:</span>
                          <span className="text-[11px] font-mono font-black text-[#0F172A] tracking-wider truncate ml-1">
                            {contest.invite_code || '---'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyFieldLink(team)}
                          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 shadow-sm transition shrink-0 cursor-pointer"
                          title="Copy field link to invite friends"
                        >
                          {copiedTeamId === team.id ? (
                            <>
                              <Check className="w-3 h-3 text-green-300" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => shareFieldWhatsApp(team)}
                          className="bg-[#25D366] hover:bg-[#20BD5A] text-white p-1.5 rounded-lg shadow-sm transition shrink-0 cursor-pointer"
                          title="Share on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contest & Rank Footer */}
                <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-bold">
                    Contest: <strong className="text-[#0F172A]">{contest?.title || 'Open Contest'}</strong>
                  </span>
                  {match && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewTeam(team)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm border border-emerald-400 cursor-pointer"
                        title="View team on cricket stadium pitch"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Pitch View</span>
                      </button>

                      {teamLocked ? (
                        <span className="text-[#64748B] font-black flex items-center gap-1" title="Contest locked — editing closed">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <Link
                          href={`/team-builder/${match.id}?teamId=${team.id}`}
                          className="text-[#16A34A] font-black hover:underline flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
                      )}
                      <Link
                        href={`/match/${match.id}/leaderboard?teamId=${team.id}`}
                        className="text-[#D97706] font-black hover:underline flex items-center gap-1 group"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Leaderboard</span>
                      </Link>
                      <Link
                        href={`/match/${match.id}`}
                        className="text-[#2563EB] font-black hover:underline flex items-center gap-1 group"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dream11-Style Cricket Pitch Ground Preview Modal */}
      {previewTeam && (
        <CricketPitchView
          isOpen={!!previewTeam}
          onClose={() => setPreviewTeam(null)}
          teamName={previewTeam.team_name}
          players={(previewTeam.players || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            team_name: p.team_name,
            role: p.role,
            credits: p.credits || 9.0,
            points: p.points || 0,
            photo_url: p.photo_url,
            is_captain: p.id === previewTeam.captain_id || p.id === previewTeam.captain?.id,
            is_vice_captain: p.id === previewTeam.vice_captain_id || p.id === previewTeam.viceCaptain?.id,
          }))}
          captainId={previewTeam.captain_id || previewTeam.captain?.id}
          viceCaptainId={previewTeam.vice_captain_id || previewTeam.viceCaptain?.id}
          teamA={previewTeam.match?.team_a}
          teamB={previewTeam.match?.team_b}
        />
      )}
    </div>
  );
}
