'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { apiGet, apiPost } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Coins, ArrowRight, ShieldCheck, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import PrizeBreakupModal from '../../../components/ui/PrizeBreakupModal';

interface Contest {
  id: string;
  name: string;
  type: string;
  entry_fee: string;
  prize_pool: string;
  max_participants: number;
  joined_participants: number;
  status: string;
}

interface Team {
  id: string;
  score: string;
}

export default function ContestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuth();
  const router = useRouter();

  const [contests, setContests] = useState<Contest[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [breakupContest, setBreakupContest] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    Promise.all([
      apiGet(`/tournaments/${id}`, token),
      apiGet(`/tournaments/${id}/contests`, token),
      apiGet(`/teams/tournament/${id}`, token)
    ])
    .then(([tData, cData, teamsData]) => {
      setTournament(tData);
      setContests(cData);
      setUserTeams(teamsData);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [id, token, router]);

  const handleJoinClick = (contest: Contest) => {
    setSelectedContest(contest);
    setErrorMsg('');
    if (userTeams.length > 0) {
      setSelectedTeamId(userTeams[0].id);
    }
  };

  const confirmJoin = async () => {
    if (!selectedContest || !selectedTeamId) return;
    setJoinLoading(true);
    setErrorMsg('');
    try {
      await apiPost(`/contests/${selectedContest.id}/join`, { teamId: selectedTeamId }, token);
      
      // Update local state to reflect joined participant
      setContests(prev => prev.map(c => 
        c.id === selectedContest.id ? { ...c, joined_participants: c.joined_participants + 1 } : c
      ));
      
      setSelectedContest(null);
      // Optional: Show success toast or redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join contest');
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const megaContests = contests.filter(c => c.type === 'mega');
  const h2hContests = contests.filter(c => c.type === 'h2h');
  const otherContests = contests.filter(c => c.type !== 'mega' && c.type !== 'h2h');

  const ContestCard = ({ contest }: { contest: Contest }) => {
    const spotsLeft = contest.max_participants - contest.joined_participants;
    const progressPercent = (contest.joined_participants / contest.max_participants) * 100;
    
    return (
      <div className="prime-card-3d p-5 transition-colors">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg">{contest.name}</h3>
            <p className="text-xs text-[#64748B] capitalize">{contest.type.replace(/_/g, ' ')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748B] mb-1">Prize Pool</p>
            <p className="font-bold text-[#2563EB] flex items-center justify-end gap-1">
              <Trophy size={14} /> ₹{contest.prize_pool}
            </p>
            <button
              type="button"
              onClick={() => setBreakupContest({
                id: contest.id,
                title: contest.name,
                entry_fee: Number(contest.entry_fee) || 0,
                prize_pool: Number(contest.prize_pool) || 0,
                total_spots: contest.max_participants,
                filled_spots: contest.joined_participants,
                type: contest.type,
              })}
              className="text-[10px] font-black text-[#D97706] hover:underline uppercase mt-1 cursor-pointer"
            >
              Prize Breakup
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-[#64748B] mb-2">
            <span>{spotsLeft} spots left</span>
            <span>{contest.max_participants} spots</span>
          </div>
          <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center">
              <Coins size={14} className="text-[#D97706]" />
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Entry Fee</p>
              <p className="font-bold">₹{contest.entry_fee}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleJoinClick(contest)}
            disabled={spotsLeft === 0}
            className="px-6 py-2 prime-btn-3d font-bold rounded-xl text-sm disabled:opacity-50"
          >
            {spotsLeft === 0 ? 'Full' : 'Join'}
          </motion.button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#0F172A] transition-colors">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold">{tournament?.name} Contests</h1>
          <p className="text-sm text-[#334155]">Select a contest to join with your team</p>
        </div>
      </div>

      <div className="flex justify-between items-center prime-card-3d p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <ShieldCheck size={24} className="text-[#2563EB]" />
          <div>
            <p className="text-sm text-[#64748B]">Your Teams for this Match</p>
            <p className="font-bold">{userTeams.length} Created</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/leaderboard/${id}`}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-3.5 py-2 prime-btn-dark-3d rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
            >
              <Trophy size={15} /> Live Dashboard
            </motion.button>
          </Link>
          <Link href={`/team-builder/${id}`}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 prime-btn-dark-3d rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <UserPlus size={16} /> Create Team
            </motion.button>
          </Link>
        </div>
      </div>

      {contests.length === 0 ? (
        <div className="text-center py-20 text-[#64748B] prime-card-3d rounded-2xl">
          No contests available for this match yet.
        </div>
      ) : (
        <div className="space-y-10">
          {megaContests.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-[#2563EB] rounded-full"></span> Mega Contests
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {megaContests.map(c => <ContestCard key={c.id} contest={c} />)}
              </div>
            </section>
          )}

          {h2hContests.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-[#0EA5E9] rounded-full"></span> Head to Head
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {h2hContests.map(c => <ContestCard key={c.id} contest={c} />)}
              </div>
            </section>
          )}

          {otherContests.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-[#F59E0B] rounded-full"></span> More Contests
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {otherContests.map(c => <ContestCard key={c.id} contest={c} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Join Modal */}
      <AnimatePresence>
        {selectedContest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedContest(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md prime-card-3d p-8 rounded-2xl shadow-2xl"
            >
              <button onClick={() => setSelectedContest(null)} className="absolute top-4 right-4 text-[#64748B] hover:text-[#0F172A]">
                <X size={20} />
              </button>

              <h2 className="text-xl font-bold mb-1">Join {selectedContest.name}</h2>
              <p className="text-sm text-[#334155] mb-6">Entry Fee: <span className="font-bold text-[#0F172A]">₹{selectedContest.entry_fee}</span></p>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-300">
                  {errorMsg}
                </div>
              )}

              {userTeams.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[#64748B] mb-4">You need to create a team for this match first.</p>
                  <Link href={`/team-builder/${id}`}>
                    <button className="px-6 py-3 prime-btn-3d rounded-xl font-bold w-full">
                      Create Team Now
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-[#64748B] mb-2">Select Your Team</label>
                    <div className="space-y-2">
                      {userTeams.map((team, idx) => (
                        <div 
                          key={team.id}
                          onClick={() => setSelectedTeamId(team.id)}
                          className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-colors ${
                            selectedTeamId === team.id ? 'border-[#2563EB] bg-[#2563EB]/10' : 'border-[#CBD5E1] hover:bg-[#F1F5F9]'
                          }`}
                        >
                          <span className="font-bold">Team {idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={confirmJoin}
                    disabled={joinLoading || !selectedTeamId}
                    className="w-full py-4 prime-btn-3d font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {joinLoading ? 'Joining...' : `Pay ${selectedContest.entry_fee} & Join`}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PrizeBreakupModal
        isOpen={!!breakupContest}
        onClose={() => setBreakupContest(null)}
        contest={breakupContest}
      />
    </div>
  );
}
