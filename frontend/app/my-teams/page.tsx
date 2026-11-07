'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Crown, Star, Trophy, Clock, Users, ArrowRight, Plus } from 'lucide-react';
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
    <div className="px-3 sm:px-6 py-6 max-w-7xl mx-auto w-full space-y-6 bg-[#000000]">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-[#FF1744] drop-shadow-[0_0_10px_#FF1744]" />
            <span>My Cricket Fantasy Teams</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#A3A3A3] font-bold mt-1">
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
        <div className="py-24 text-center text-[#A3A3A3] bg-[#000000]">
          <div className="w-10 h-10 border-4 border-[#FF1744] border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_#FF1744]" />
          <p className="text-sm font-black text-white">Loading your teams...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="p-12 text-center prime-card-3d space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-b from-[#FF1744] to-[#800018] flex items-center justify-center text-3xl shadow-[0_0_20px_#FF1744] border-2 border-[#FF8095]">
            🏏
          </div>
          <h3 className="text-xl font-black text-white">No teams created yet</h3>
          <p className="text-xs text-[#A3A3A3] font-bold max-w-sm mx-auto">
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

            return (
              <div
                key={team.id}
                className="prime-card-3d p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Category & Status */}
                  <div className="flex items-center justify-between mb-3">
                    {match && <CategoryBadge category={match.category} size="xs" />}
                    <span className="font-mono text-xs font-black text-[#FFD700] px-2.5 py-0.5 rounded-lg bg-[#000000] border border-[#FFD700]/40">
                      {match?.status === 'live' ? '⚡ LIVE' : match?.match_date}
                    </span>
                  </div>

                  <h3 className="font-black text-white text-base mb-1">{team.team_name}</h3>
                  <p className="text-xs text-[#A3A3A3] font-bold">
                    {match?.title || 'Cricket Match'}
                  </p>

                  {/* Multipliers & Points Box */}
                  <div className="mt-4 p-3 rounded-xl bg-[#000000] border border-[#262626] grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-[#A3A3A3] uppercase font-black block">Cap (2×)</span>
                      <span className="text-xs font-black text-white truncate block mt-0.5">
                        {team.captain?.name || 'Assigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A3A3A3] uppercase font-black block">VC (1.5×)</span>
                      <span className="text-xs font-black text-white truncate block mt-0.5">
                        {team.viceCaptain?.name || 'Assigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A3A3A3] uppercase font-black block">Total Pts</span>
                      <span className="text-base font-black text-[#FFD700] font-mono block mt-0.5 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">
                        {team.total_points || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contest & Rank Footer */}
                <div className="mt-4 pt-3 border-t border-[#222222] flex items-center justify-between text-xs">
                  <span className="text-[#A3A3A3] font-bold">
                    Contest: <strong className="text-white">{contest?.title || 'Open Contest'}</strong>
                  </span>
                  {match && (
                    <Link
                      href={`/match/${match.id}`}
                      className="text-[#FFD700] font-black hover:underline flex items-center gap-1 group"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
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
