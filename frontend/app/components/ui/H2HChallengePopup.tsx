'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Check, X, AlertCircle } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function H2HChallengePopup() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    // Check for any pending H2H challenge on login/mount
    apiGet('/h2h/pending', token)
      .then((res) => {
        if (res?.challenge) {
          setChallenge(res.challenge);
        }
      })
      .catch(() => {});
  }, [token]);

  if (!challenge) return null;

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost(`/h2h/${challenge.id}/accept`, {}, token);
      if (res?.success) {
        const contestId = res.challenge?.contest_id || res.contest?.id;
        const matchId = challenge.match_id;
        setChallenge(null);
        // Redirect to team builder for this H2H contest (§7)
        router.push(`/team-builder/${matchId}?contestId=${contestId}`);
      } else {
        setError(res?.error || 'Failed to accept challenge');
      }
    } catch (err: any) {
      setError(err?.message || 'Insufficient wallet balance or server error.');
    } finally {
      setLoading(false);
    }
  };

  const handleGiveUp = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/h2h/${challenge.id}/reject`, {}, token);
      setChallenge(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to decline challenge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#26221B] border-2 border-[#E53935] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#B71C1C] via-[#E53935] to-[#B71C1C] p-4 text-center text-white relative">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#1C1A17] border-2 border-[#FFC107] flex items-center justify-center text-2xl shadow-lg mb-2">
            ⚔️
          </div>
          <h3 className="font-black text-lg uppercase tracking-wider text-white">
            Head-to-Head Challenge!
          </h3>
          <p className="text-xs text-yellow-200 font-semibold mt-0.5">
            1-on-1 Cricket Battle • Winner Takes 85%
          </p>
        </div>

        {/* Content */}
        <div className="p-5 text-center space-y-4">
          <div>
            <p className="text-xs text-[#8C8273] uppercase font-bold tracking-wider">Challenger</p>
            <p className="text-lg font-black text-white">@{challenge.sender_username}</p>
          </div>

          <div className="bg-[#1C1A17] p-3.5 rounded-lg border border-[#3D352A] flex items-center justify-around">
            <div>
              <p className="text-[11px] text-[#8C8273] font-semibold">Entry Amount</p>
              <p className="text-xl font-black text-[#FFC107]">₹{challenge.amount}</p>
            </div>
            <div className="h-8 w-[1px] bg-[#3D352A]" />
            <div>
              <p className="text-[11px] text-[#8C8273] font-semibold">Winner Takes (85%)</p>
              <p className="text-xl font-black text-[#E53935]">₹{challenge.winner_payout}</p>
            </div>
          </div>

          {challenge.match && (
            <p className="text-xs text-[#D1C7B7] font-semibold">
              Match: <span className="text-[#FFC107]">{challenge.match.title}</span>
            </p>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons (§7: [Accept], [Give Up]) */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleGiveUp}
              disabled={loading}
              className="prime-btn-secondary py-2.5 font-bold text-sm text-[#D1C7B7] hover:text-white"
            >
              <X className="w-4 h-4" />
              Give Up
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="prime-btn py-2.5 font-bold text-sm"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Processing...' : 'Accept Challenge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

