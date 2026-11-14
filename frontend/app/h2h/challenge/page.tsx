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
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    apiGet('/wallet/balance', token)
      .then((res) => {
        if (typeof res?.balance === 'number') setWalletBalance(res.balance);
      })
      .catch(() => {});
  }, [token]);

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

    // Pre-check wallet balance
    if (walletBalance !== null && walletBalance < entryAmount) {
      const needed = Math.round((entryAmount - walletBalance) * 100) / 100;
      setError(`Aapke wallet me paryapt balance nahi hai (Available: ₹${walletBalance}, Required: ₹${entryAmount}). Redirecting to Add Cash...`);
      setTimeout(() => {
        router.push(`/wallet?depositAmount=${Math.max(50, needed)}&needed=${needed}&returnUrl=${encodeURIComponent(window.location.href)}&message=H2H Challenge (₹${entryAmount}) ke liye funds add karein`);
      }, 1500);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost('/h2h/challenge', {
        match_id: matchId,
        team_id: teamId,
        receiver_id: opponent.id,
        amount: entryAmount,
      }, token);
      setSent(true);
      setTimeout(() => router.push('/my-teams'), 1200);
    } catch (err: any) {
      if (/insufficient/i.test(err?.message || '') || err?.code === 'INSUFFICIENT_BALANCE') {
        const needed = walletBalance !== null ? Math.max(10, entryAmount - walletBalance) : entryAmount;
        setError(`Insufficient wallet balance! ₹${entryAmount} required. Redirecting to Add Cash...`);
        setTimeout(() => {
          router.push(`/wallet?depositAmount=${Math.max(50, needed)}&needed=${needed}&returnUrl=${encodeURIComponent(window.location.href)}&message=H2H Challenge ke liye funds add karein`);
        }, 1500);
      } else {
        setError(err?.message || 'Could not send the challenge. Check your wallet balance.');
      }
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

        {/* Wallet Balance Status Bar */}
        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border-2 border-[#CBD5E1] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-[#64748B] block">Available Wallet Balance</span>
            <span className="text-base font-black font-mono text-[#0F172A]">
              ₹{walletBalance !== null ? walletBalance.toLocaleString('en-IN') : '...'}
            </span>
          </div>
          <Link
            href={`/wallet?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
            className="prime-btn-dark-3d !py-1.5 !px-3 text-xs font-black"
          >
            + Add Cash
          </Link>
        </div>

        <form onSubmit={sendChallenge} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wide">Entry amount</label>
              {walletBalance !== null && (
                <span className={`text-[11px] font-bold ${Number(amount) > walletBalance ? 'text-red-600' : 'text-emerald-600'}`}>
                  {Number(amount) > walletBalance
                    ? `⚠️ Low Balance (Need ₹${Number(amount) - walletBalance} more)`
                    : `✓ Sufficient Balance`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg">₹</span>
              <input type="number" min="10" step="1" required value={amount} onChange={event => setAmount(event.target.value)} className="pd-input w-full" />
            </div>
            <div className="flex gap-2 mt-2">
              {['50', '100', '250', '500'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`px-3 py-1 rounded-lg text-xs font-black border transition ${
                    amount === amt ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#CBD5E1]'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#64748B] mt-1.5">₹{amount || 0} will be deducted from your wallet upon sending.</p>
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

          {walletBalance !== null && Number(amount) > walletBalance ? (
            <button
              type="button"
              onClick={() => router.push(`/wallet?depositAmount=${Math.max(50, Number(amount) - walletBalance)}&needed=${Number(amount) - walletBalance}&returnUrl=${encodeURIComponent(window.location.href)}&message=H2H Challenge ke liye funds add karein`)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 border-2 border-amber-300 cursor-pointer"
            >
              <span>+ Add ₹{Number(amount) - walletBalance} to Send Challenge</span>
            </button>
          ) : (
            <button type="submit" disabled={submitting || sent} className="prime-btn-3d w-full py-3 font-black">
              {submitting ? 'Sending…' : sent ? 'Challenge sent' : `Pay ₹${amount || 0} & Send H2H Challenge`}
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
