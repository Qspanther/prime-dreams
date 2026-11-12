'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, Search, Swords } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function H2HChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId');
  const teamId = searchParams.get('teamId');
  const { token } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [amount, setAmount] = useState('100');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [opponent, setOpponent] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!matchId || !teamId) {
      router.replace('/my-teams');
      return;
    }
    apiGet(`/matches/${matchId}`).then(result => setMatch(result?.match || null)).catch(() => setError('Could not load the match.'));
  }, [matchId, teamId, router]);

  useEffect(() => {
    if (!query.trim() || !token || opponent) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await apiGet(`/users/search?q=${encodeURIComponent(query)}`, token);
        setUsers(result?.users || []);
      } catch {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token, opponent]);

  const sendChallenge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) { router.push('/login'); return; }
    const entryAmount = Number(amount);
    if (!opponent) { setError('Search for and select an opponent first.'); return; }
    if (!Number.isFinite(entryAmount) || entryAmount < 10) { setError('Minimum H2H entry amount is ₹10.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/h2h/challenge', {
        match_id: matchId,
        team_id: teamId,
        receiver_id: opponent.id,
        amount: entryAmount,
      }, token);
      setSent(true);
      setTimeout(() => router.push('/my-teams'), 1200);
    } catch (err: any) {
      setError(err?.message || 'Could not send the challenge. Check your wallet balance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto px-4 py-8 space-y-5 text-[#0F172A]">
      <Link href={matchId ? `/match/${matchId}` : '/'} className="inline-flex items-center gap-2 text-sm font-bold text-[#475569] hover:text-[#2563EB]">
        <ArrowLeft className="w-4 h-4" /> Back to match
      </Link>

      <section className="prime-card-3d p-6 sm:p-8 space-y-5">
        <header className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
          <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <Swords className="w-6 h-6 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl font-black">Challenge an opponent</h1>
            <p className="text-sm text-[#64748B]">Your team is ready. Find a player for a 1-on-1 match.</p>
          </div>
        </header>

        {match && <p className="text-sm font-bold text-[#334155]">{match.team_a} vs {match.team_b}</p>}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {sent && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold flex gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" /> Challenge sent. The opponent has been notified.
          </div>
        )}

        <form onSubmit={sendChallenge} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wide mb-1.5">Entry amount</label>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg">₹</span>
              <input type="number" min="10" step="1" required value={amount} onChange={event => setAmount(event.target.value)} className="pd-input w-full" />
            </div>
            <p className="text-xs text-[#64748B] mt-1">₹{amount || 0} will be held from your wallet when you send the challenge.</p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wide mb-1.5">Search opponent</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
              <input value={query} onChange={event => { setQuery(event.target.value); setOpponent(null); }} placeholder="Username or email" className="pd-input w-full pl-9" />
            </div>
            {users.length > 0 && (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[#CBD5E1] bg-white p-1 shadow-sm">
                {users.map(user => (
                  <button key={user.id} type="button" onClick={() => { setOpponent(user); setQuery(`@${user.username}`); setUsers([]); }} className="w-full flex items-center justify-between rounded-lg p-2.5 text-left hover:bg-[#EFF6FF]">
                    <span className="font-bold">@{user.username}</span>
                    <span className="text-xs text-[#64748B]">{user.masked_email}</span>
                  </button>
                ))}
              </div>
            )}
            {opponent && <p className="mt-2 text-sm font-bold text-[#2563EB]">Selected: @{opponent.username}</p>}
          </div>

          <button type="submit" disabled={submitting || sent} className="prime-btn-3d w-full py-3 font-black">
            {submitting ? 'Sending…' : sent ? 'Challenge sent' : `Send H2H challenge · ₹${amount || 0}`}
          </button>
        </form>
      </section>
    </main>
  );
}
