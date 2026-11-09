'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '../../lib/auth-context';
import { apiGet } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  TrendingUp,
  Users,
  Clock,
  Shield,
  Eye,
  ArrowLeft,
  Search,
  X,
  Radio,
  Sparkles,
  Video,
  ThumbsUp,
  ExternalLink,
  Flame,
  Coins,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import ScorecardModal from '../../components/ScorecardModal';
import { TableRowSkeleton, CreatorSkeleton, StatsSkeleton } from '../../components/ui/Skeleton';

interface LeaderboardEntry {
  rank: number;
  teamId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  totalPoints: number;
  prizeAmount: number;
  refundAmount?: number;
  isRefund: boolean;
  platformFee: number;
  isCurrentUser: boolean;
  canViewTeam: boolean;
}

interface TournamentMeta {
  id: string;
  name: string;
  platform: string;
  status: string;
  startTime: string;
  endTime: string;
  lockTime: string;
  prizePool: number;
  entryFee: number;
  currentParticipants: number;
  rankingsFinalized?: boolean;
}

interface CreatorPerformance {
  creatorId: string;
  name: string;
  channelHandle?: string;
  category: string;
  profileImageUrl?: string;
  creditCost: number;
  video: {
    title: string;
    url: string;
    isPreContest?: boolean;
  };
  baseline: {
    views: number;
    likes: number;
    subscribers: number;
  };
  current: {
    views: number;
    likes: number;
    subscribers: number;
  };
  gains: {
    views: number;
    likes: number;
    subscribers: number;
  };
  points: {
    viewsPoints: number;
    likesPoints: number;
    subsPoints: number;
    totalPoints: number;
    captainPoints: number;
    viceCaptainPoints: number;
  };
}

function formatIndianNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN');
}

export default function LeaderboardPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const { token } = useAuth();
  const [tournament, setTournament] = useState<TournamentMeta | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [creatorsPerformance, setCreatorsPerformance] = useState<CreatorPerformance[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [userPrize, setUserPrize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Creators panel states
  const [creatorSearch, setCreatorSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'points' | 'views' | 'likes' | 'subs'>('points');
  const [activeTab, setActiveTab] = useState<'standings' | 'creators'>('standings');

  useEffect(() => {
    if (!token) return;
    const fetchLeaderboard = () => {
      apiGet(`/leaderboard/${tournamentId}`, token)
        .then(data => {
          if (data.tournament) setTournament(data.tournament);
          setEntries(data.entries || []);
          if (Array.isArray(data.creatorsPerformance)) {
            setCreatorsPerformance(data.creatorsPerformance);
          }
          setUserRank(data.userRank);
          setUserPoints(data.userPoints);
          setUserPrize(data.userPrize);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 8000);
    return () => clearInterval(interval);
  }, [token, tournamentId]);

  // Determine if official rankings should be displayed (ONLY after contest completion & bot rearrangement)
  const showRankings = tournament?.status === 'completed' && Boolean(tournament?.rankingsFinalized);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={20} className="text-[#D97706] drop-shadow-md" />;
    if (rank === 2) return <Medal size={20} className="text-[#94A3B8] drop-shadow-sm" />;
    if (rank === 3) return <Medal size={20} className="text-amber-600 drop-shadow-sm" />;
    return <span className="text-xs font-black text-[#64748B] w-6 text-center">#{rank}</span>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter entries based on search query
  const filteredEntries = entries.filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = e.userName?.toLowerCase().includes(q);
    const emailMatch = e.userEmail?.toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  // Filter and sort creators
  const categories = ['all', 'Gaming', 'Comedy', 'Vlogging', 'Tech', 'Lifestyle'];
  const filteredCreators = creatorsPerformance
    .filter(c => {
      if (categoryFilter !== 'all' && c.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (!creatorSearch.trim()) return true;
      const q = creatorSearch.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.channelHandle && c.channelHandle.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'views') return (b.gains?.views || 0) - (a.gains?.views || 0);
      if (sortBy === 'likes') return (b.gains?.likes || 0) - (a.gains?.likes || 0);
      if (sortBy === 'subs') return (b.gains?.subscribers || 0) - (a.gains?.subscribers || 0);
      return (b.points?.totalPoints || 0) - (a.points?.totalPoints || 0);
    });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-4 px-3 sm:px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-[#E2E8F0] animate-shimmer" />
            <div className="h-8 w-64 rounded-xl bg-[#E2E8F0] animate-shimmer" />
          </div>
          <div className="flex gap-3">
            <div className="h-14 w-28 rounded-2xl bg-[#E2E8F0] animate-shimmer" />
            <div className="h-14 w-36 rounded-2xl bg-[#E2E8F0] animate-shimmer" />
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="h-20 rounded-2xl bg-[#E2E8F0] animate-shimmer mb-4" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="p-4 rounded-3xl bg-white border border-[#CBD5E1] space-y-3">
              <div className="h-6 w-48 rounded bg-[#E2E8F0] animate-shimmer" />
              {[1, 2, 3].map((i) => (
                <CreatorSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const defaultRefund = Math.max(0, (tournament?.entryFee || 99) - 2);

  return (
    <div className="max-w-7xl mx-auto py-2 px-3 sm:px-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors">
          <ArrowLeft size={14} /> Back to Tournaments
        </Link>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('standings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'standings' ? 'bg-[#2563EB] text-white shadow' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            🏆 Standings ({entries.length})
          </button>
          <button
            onClick={() => setActiveTab('creators')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'creators' ? 'bg-[#2563EB] text-white shadow' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            ⭐ Creators Live ({creatorsPerformance.length})
          </button>
        </div>
      </div>

      {/* Header & Tournament Overview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                tournament?.status === 'live'
                  ? 'bg-red-50 text-[#DC2626] border border-red-300'
                  : tournament?.status === 'completed'
                    ? 'bg-[#F59E0B]/15 text-[#D97706] border border-[#F59E0B]/40'
                    : 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/30'
              }`}>
                {tournament?.status === 'live' && <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />}
                {tournament?.status?.toUpperCase()} BATTLE
              </span>
              <span className="text-xs text-[#64748B] font-medium">
                {tournament?.platform?.toUpperCase()} LEAGUE
              </span>
              {!showRankings && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/30">
                  ⚡ Live Points Mode (Rankings reveal at contest end)
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
              {showRankings ? (
                <Trophy size={28} className="text-[#D97706]" />
              ) : (
                <Radio size={28} className="text-[#DC2626] animate-pulse" />
              )}
              {tournament?.name || 'Tournament Leaderboard'}
            </h1>
            <p className="text-xs text-[#334155] mt-1">
              Live league dashboard • Monitor creator delta metrics, participant standings, and verified score multipliers.
            </p>
          </div>

          {tournament && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white px-4 py-2.5 rounded-2xl border border-[#CBD5E1] shadow-sm text-right">
                <p className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold">Entry Fee</p>
                <p className="text-lg font-black text-[#2563EB]">₹{tournament.entryFee}</p>
              </div>
              <div className="bg-white px-4 py-2.5 rounded-2xl border border-[#CBD5E1] shadow-sm text-right">
                <p className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold">Prize Pool</p>
                <p className="text-xl font-black text-[#D97706]">₹{tournament.prizePool.toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Time Window Details */}
        {tournament && (
          <div className="mt-4 p-3 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#334155]">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#2563EB]" />
              <span className="font-semibold text-[#0F172A]">Contest Window:</span>
              <span>{formatDate(tournament.startTime)}</span>
              <span>➔</span>
              <span>{formatDate(tournament.endTime)}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-[#2563EB]" />
                <span>{tournament?.currentParticipants || entries.length} Competitors</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#2563EB]" />
                <span>{creatorsPerformance.length} Verified Creators Tracked</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Main 2-Column Split: Standings on Left, Creators on Right */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        
        {/* ─── LEFT COLUMN: User Standing + Standings Table ─── */}
        <div className={`lg:col-span-7 space-y-6 ${activeTab === 'creators' ? 'hidden lg:block' : 'block'}`}>
          {/* User's Current Standing Banner */}
          {userPoints !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                showRankings
                  ? 'border-[#2563EB]/40 bg-gradient-to-r from-[#2563EB]/10 to-transparent'
                  : 'border-[#DC2626]/30 bg-gradient-to-r from-red-50 to-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  showRankings ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-red-50 text-[#DC2626]'
                }`}>
                  {showRankings ? <TrendingUp size={22} /> : <Radio size={22} className="animate-pulse" />}
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-medium">
                    {showRankings ? 'Your Official Battle Rank' : 'Your Live Battle Score'}
                  </p>
                  <div className="flex items-baseline gap-2">
                    {showRankings && userRank ? (
                      <h3 className="text-2xl font-black text-[#0F172A]">#{userRank}</h3>
                    ) : (
                      <h3 className="text-2xl font-black text-[#0F172A]">{userPoints !== null ? userPoints.toFixed(4) : '0.0000'} pts</h3>
                    )}
                    {!showRankings && (
                      <span className="text-[10px] font-bold text-[#DC2626] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-ping" /> Live (Rank Hidden)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right">
                {showRankings ? (
                  <>
                    <p className="text-xs text-[#64748B] font-medium">Total Team Score</p>
                    <p className="text-xl font-black text-[#D97706]">{userPoints.toFixed(4)} pts</p>
                    {userPrize && userPrize >= 100 ? (
                      <span className="inline-block mt-0.5 text-xs font-bold text-[#D97706]">
                        🏆 +₹{userPrize.toLocaleString('en-IN')} Prize Won
                      </span>
                    ) : (
                      <span className="inline-block mt-0.5 text-xs font-bold text-emerald-600">
                        🛡️ ₹{defaultRefund} Refunded • ₹2 fee deducted
                      </span>
                    )}
                  </>
                ) : (
                  <div className="max-w-xs text-xs text-[#334155]">
                    <span className="font-semibold text-[#0F172A]">Live Points Mode:</span> Rank is intentionally hidden until contest end so every user can track scores fairly!
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Search Bar */}
          <div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={17} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search competitor by Name or Email address..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder-[#64748B] text-sm focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {searchQuery && (
              <div className="flex items-center justify-between text-xs text-[#334155] mt-2 px-1">
                <span>
                  Showing <strong>{filteredEntries.length}</strong> matching player(s)
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[#2563EB] hover:underline font-medium cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>

          {/* Leaderboard Entries List */}
          {entries.length === 0 ? (
            <div className="bg-white p-10 text-center border border-[#CBD5E1] rounded-3xl shadow-sm">
              <Trophy size={40} className="mx-auto text-[#64748B] mb-3 opacity-40" />
              <p className="text-[#334155] font-medium">No participants tracked in this league yet.</p>
              <p className="text-xs text-[#64748B] mt-1">Enter a team via Team Builder to compete and claim your ranking!</p>
              <Link
                href={`/team-builder/${tournamentId}`}
                className="inline-block mt-4 px-5 py-2.5 rounded-xl prime-btn-3d text-xs font-bold shadow-lg hover:opacity-95 transition"
              >
                ⚡ Enter Team Now
              </Link>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="bg-white p-8 text-center border border-[#CBD5E1] rounded-3xl shadow-sm">
              <Search size={30} className="mx-auto text-[#64748B] mb-2 opacity-40" />
              <p className="text-[#0F172A] font-bold">No participants found</p>
              <p className="text-xs text-[#64748B] mt-1">
                No player found matching &ldquo;{searchQuery}&rdquo;. Try another name.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#64748B] px-3 pb-1">
                <span>{showRankings ? 'Competitor & Final Rank' : 'Competitor (Live Points Mode • Rank Hidden)'}</span>
                <span>{showRankings ? 'Points / Payout' : 'Live Score & Multipliers'}</span>
              </div>
              {filteredEntries.map((entry, i) => {
                const isWinner = showRankings && entry.rank === 1;
                const isPodium = showRankings && entry.rank <= 3;
                const refundAmt = entry.refundAmount || defaultRefund;

                return (
                  <motion.div
                    key={entry.teamId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    onClick={() => entry.canViewTeam && setSelectedTeamId(entry.teamId)}
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl transition-all cursor-pointer ${
                      entry.isCurrentUser
                        ? 'bg-[#2563EB]/10 border border-[#2563EB]/50 shadow-lg shadow-[#2563EB]/10'
                        : isWinner
                          ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/50 hover:bg-[#F59E0B]/20'
                          : isPodium
                            ? 'bg-white border border-[#CBD5E1] hover:border-[#2563EB]/50'
                            : 'bg-white border border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    {/* Left: Rank/Status + Avatar + Name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {showRankings ? (
                        <div className="w-7 flex justify-center shrink-0">
                          {getRankIcon(entry.rank)}
                        </div>
                      ) : (
                        <div className="w-7 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-mono font-bold text-[#64748B]"># -</span>
                        </div>
                      )}

                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB]/20 to-[#3B82F6]/20 flex items-center justify-center text-xs font-bold text-[#0F172A] shrink-0 border border-[#CBD5E1]">
                        {entry.userName.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-[#0F172A] truncate">
                            {entry.userName}
                          </span>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/50">
                              YOU
                            </span>
                          )}
                          {isWinner && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#F59E0B] text-white">
                              👑 WINNER
                            </span>
                          )}
                        </div>

                        {showRankings && (
                          entry.prizeAmount >= 100 ? (
                            <p className="text-[11px] font-bold text-[#D97706] mt-0.5">
                              🏆 +₹{entry.prizeAmount.toLocaleString('en-IN')} Prize Won
                            </p>
                          ) : (
                            <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                              🛡️ ₹{refundAmt} Refunded • <span className="text-[#64748B]">₹2 fee</span>
                            </p>
                          )
                        )}
                      </div>
                    </div>

                    {/* Right: Live Points + View Scorecard action */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <p className="text-base font-extrabold text-[#0F172A]">
                          {entry.totalPoints.toFixed(4)}
                        </p>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">
                          {showRankings ? 'Final Pts' : tournament?.status === 'upcoming' ? 'Drafted' : 'Live Pts'}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeamId(entry.teamId);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#F1F5F9] hover:bg-[#2563EB] hover:text-white text-[#2563EB] transition-all border border-[#CBD5E1] cursor-pointer"
                      >
                        <Eye size={12} />
                        <span className="hidden sm:inline">Scorecard</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: All Creators Live Performance in this League ─── */}
        <div className={`lg:col-span-5 space-y-4 ${activeTab === 'standings' ? 'hidden lg:block' : 'block'}`}>
          <div className="prime-card-3d p-5 rounded-3xl space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-[#D97706]" />
                  <h2 className="text-lg font-black text-[#0F172A]">League Creators Performance</h2>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Metric surges & points generated strictly during this league window
                </p>
              </div>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/30 shrink-0">
                {creatorsPerformance.length} Stars
              </span>
            </div>

            {/* Controls: Search, Category Filter, and Sorting */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" size={14} />
                <input
                  type="text"
                  value={creatorSearch}
                  onChange={(e) => setCreatorSearch(e.target.value)}
                  placeholder="Filter creator in this league..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] placeholder-[#64748B] text-xs focus:outline-none focus:border-[#2563EB] transition-all"
                />
                {creatorSearch && (
                  <button
                    onClick={() => setCreatorSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider shrink-0 transition-all ${
                      categoryFilter === cat
                        ? 'bg-[#2563EB] text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                        : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sort by Metric */}
              <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                <span className="text-[11px]">Sort By:</span>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    onClick={() => setSortBy('points')}
                    className={`px-2 py-0.5 rounded-md font-bold transition ${
                      sortBy === 'points' ? 'bg-amber-50 text-[#D97706] border border-amber-300' : 'hover:text-[#0F172A]'
                    }`}
                  >
                    Pts
                  </button>
                  <button
                    onClick={() => setSortBy('views')}
                    className={`px-2 py-0.5 rounded-md font-bold transition ${
                      sortBy === 'views' ? 'bg-sky-50 text-sky-700 border border-sky-300' : 'hover:text-[#0F172A]'
                    }`}
                  >
                    Views
                  </button>
                  <button
                    onClick={() => setSortBy('likes')}
                    className={`px-2 py-0.5 rounded-md font-bold transition ${
                      sortBy === 'likes' ? 'bg-rose-50 text-rose-600 border border-rose-300' : 'hover:text-[#0F172A]'
                    }`}
                  >
                    Likes
                  </button>
                  <button
                    onClick={() => setSortBy('subs')}
                    className={`px-2 py-0.5 rounded-md font-bold transition ${
                      sortBy === 'subs' ? 'bg-purple-50 text-purple-700 border border-purple-300' : 'hover:text-[#0F172A]'
                    }`}
                  >
                    Subs
                  </button>
                </div>
              </div>
            </div>

            {/* Creators Scrollable List */}
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {filteredCreators.length === 0 ? (
                <div className="p-8 text-center border border-[#E2E8F0] rounded-2xl bg-[#F8FAFC]">
                  <p className="text-xs text-[#64748B]">No creator matches this filter.</p>
                </div>
              ) : (
                filteredCreators.map((c) => {
                  const viewsGain = c.gains?.views || 0;
                  const likesGain = c.gains?.likes || 0;
                  const subsGain = c.gains?.subscribers || 0;
                  const totalPts = c.points?.totalPoints || 0;
                  const captainPts = c.points?.captainPoints || (totalPts * 2.0);
                  const vcPts = c.points?.viceCaptainPoints || (totalPts * 1.5);

                  return (
                    <motion.div
                      key={c.creatorId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F1F5F9] transition-all space-y-3"
                    >
                      {/* Top Creator Info & Points */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {c.profileImageUrl ? (
                            <img
                              src={c.profileImageUrl}
                              alt={c.name}
                              className="w-10 h-10 rounded-xl object-cover border border-[#CBD5E1] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
                              {c.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-[#0F172A] truncate">{c.name}</h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                              <span className="text-purple-600 font-semibold">{c.category}</span>
                              <span>•</span>
                              <span>{c.creditCost} CR</span>
                            </div>
                          </div>
                        </div>

                        {/* Glowing Points Contributed Badge */}
                        <div className="text-right shrink-0">
                          <div className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#F59E0B]/15 to-[#D97706]/15 border border-[#F59E0B]/40 text-[#D97706] text-xs font-black shadow-sm">
                            +{totalPts.toFixed(4)} Pts
                          </div>
                          <p className="text-[9px] text-[#64748B] mt-0.5">
                            C: +{captainPts.toFixed(2)} • VC: +{vcPts.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* 3 Metric Deltas: Views, Likes, Subscribers */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-center">
                        <div>
                          <p className="text-[10px] text-[#64748B] flex items-center justify-center gap-1">
                            <Eye size={11} className="text-sky-500" /> Views
                          </p>
                          <p className="text-xs font-extrabold text-sky-600 font-mono mt-0.5">
                            +{formatIndianNumber(viewsGain)}
                          </p>
                          <p className="text-[9px] text-[#64748B]">
                            +{(c.points?.viewsPoints || 0).toFixed(2)} pts
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-[#64748B] flex items-center justify-center gap-1">
                            <ThumbsUp size={11} className="text-rose-500" /> Likes
                          </p>
                          <p className="text-xs font-extrabold text-rose-600 font-mono mt-0.5">
                            +{formatIndianNumber(likesGain)}
                          </p>
                          <p className="text-[9px] text-[#64748B]">
                            +{(c.points?.likesPoints || 0).toFixed(2)} pts
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-[#64748B] flex items-center justify-center gap-1">
                            <Users size={11} className="text-purple-500" /> Subs
                          </p>
                          <p className="text-xs font-extrabold text-purple-600 font-mono mt-0.5">
                            +{formatIndianNumber(subsGain)}
                          </p>
                          <p className="text-[9px] text-[#64748B]">
                            +{(c.points?.subsPoints || 0).toFixed(2)} pts
                          </p>
                        </div>
                      </div>

                      {/* Video Title & Watch Link if available */}
                      {c.video?.title && (
                        <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1 gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <Video size={12} className="text-[#2563EB] shrink-0" />
                            <span className="truncate">{c.video.title}</span>
                          </div>
                          {c.video.url && (
                            <a
                              href={c.video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2563EB] hover:underline flex items-center gap-0.5 shrink-0"
                            >
                              <span>Watch</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Transparent Scorecard Modal */}
      <ScorecardModal
        teamId={selectedTeamId}
        onClose={() => setSelectedTeamId(null)}
      />
    </div>
  );
}
