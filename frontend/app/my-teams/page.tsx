'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ArrowRight, Plus, Pencil, Lock } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import CategoryFilterTabs from '../components/ui/CategoryFilterTabs';
import CategoryBadge from '../components/ui/CategoryBadge';

export default function MyTeamsPage() {
  const { token, isAuthenticated } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

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
              match.status === 'completed' || (matchLock !== null && new Date() >= matchLock);

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
                </div>

                {/* Contest & Rank Footer */}
                <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-bold">
                    Contest: <strong className="text-[#0F172A]">{contest?.title || 'Open Contest'}</strong>
                  </span>
                  {match && (
                    <div className="flex items-center gap-3">
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
    </div>
  );
}
