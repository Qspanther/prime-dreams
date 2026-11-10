'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Gift, Trophy, RotateCw, Star, CheckCircle2,
  AlertCircle, Sparkles, Lock, Loader2
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
}

interface RewardState {
  coins: number;
  scratch_cards: number;
  spins_left: number;
  last_spin_date: string | null;
  can_claim_daily: boolean;
  can_spin: boolean;
  missions: Mission[];
}

const SPIN_PRIZES = [10, 20, 30, 50, 75, 100, 150, 200];
const SCRATCH_PRIZES = [5, 10, 15, 25, 50, 100];

export default function RewardsPage() {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<RewardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Daily claim
  const [claimingDaily, setClaimingDaily] = useState(false);
  // Spin
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  // Scratch
  const [scratching, setScratching] = useState(false);
  const [scratchResult, setScratchResult] = useState<number | null>(null);
  const [scratchRevealed, setScratchRevealed] = useState(false);
  // Missions
  const [claimingMission, setClaimingMission] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await apiGet('/rewards/state', token);
      if (res?.success) setState(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    loadState();
  }, [isAuthenticated, token, loadState, router]);

  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiPost('/rewards/claim-daily', {}, token);
      setMessage(res?.message || 'Daily reward claimed!');
      await loadState();
    } catch (e: any) {
      setError(e?.message || 'Could not claim daily reward');
    } finally {
      setClaimingDaily(false);
    }
  };

  const handleSpin = async () => {
    setSpinning(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiPost('/rewards/spin', {}, token);
      const prize = Number(res?.prize) || 0;
      // Spin to a random angle; the prize is decided by the server.
      const segIndex = Math.max(0, SPIN_PRIZES.indexOf(prize));
      const segAngle = (360 / SPIN_PRIZES.length) * segIndex;
      setSpinAngle(360 * 5 - segAngle - (360 / SPIN_PRIZES.length) / 2);
      setSpinResult(prize);
      setMessage(res?.message || `You won ${prize} DreamCoins!`);
      setTimeout(async () => await loadState(), 600);
    } catch (e: any) {
      setError(e?.message || 'No spins left today. Come back tomorrow!');
    } finally {
      setSpinning(false);
    }
  };

  const handleScratch = async () => {
    setScratching(true);
    setMessage(null);
    setError(null);
    setScratchRevealed(false);
    setScratchResult(null);
    try {
      const res = await apiPost('/rewards/scratch', {}, token);
      const prize = Number(res?.prize) || 0;
      setScratchResult(prize);
      setMessage(res?.message || `You scratched and won ${prize} DreamCoins!`);
      setTimeout(async () => await loadState(), 600);
    } catch (e: any) {
      setError(e?.message || 'No scratch cards left');
    } finally {
      setScratching(false);
    }
  };

  const handleClaimMission = async (id: string) => {
    setClaimingMission(id);
    setMessage(null);
    setError(null);
    try {
      const res = await apiPost(`/rewards/missions/${id}/claim`, {}, token);
      setMessage(res?.message || 'Mission complete!');
      await loadState();
    } catch (e: any) {
      setError(e?.message || 'Could not claim mission');
    } finally {
      setClaimingMission(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
      </div>
    );
  }

  const coins = state?.coins ?? 0;
  const scratchCards = state?.scratch_cards ?? 0;
  const spinsLeft = state?.spins_left ?? 0;
  const canClaimDaily = state?.can_claim_daily ?? false;
  const canSpin = state?.can_spin ?? false;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#F59E0B] flex items-center justify-center shadow-[0_6px_20px_rgba(245,158,11,0.4)]">
          <Coins className="w-6 h-6 text-[#92400E]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#0F172A]">DreamCoins Rewards</h1>
          <p className="text-xs text-[#64748B] font-bold">Earn coins, spin the wheel, scratch &amp; complete missions</p>
        </div>
      </div>

      {(error || message) && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
          error ? 'bg-red-50 text-red-700 border-red-300' : 'bg-green-50 text-green-700 border-green-300'
        }`}>
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{error || message}</span>
        </div>
      )}

      {/* Balance card */}
      <div className="prime-card-shiny-gold p-5 rounded-3xl border-2 border-[#F59E0B] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#92400E] uppercase font-black tracking-widest">Your Balance</p>
          <p className="text-3xl font-black text-[#92400E] font-mono">{coins.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-[#B45309] font-bold">DreamCoins</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center bg-white/70 rounded-2xl px-4 py-2 border border-[#FDE68A]">
            <p className="text-lg font-black text-[#92400E]">{scratchCards}</p>
            <p className="text-[10px] text-[#B45309] font-bold uppercase">Scratch</p>
          </div>
          <div className="text-center bg-white/70 rounded-2xl px-4 py-2 border border-[#FDE68A]">
            <p className="text-lg font-black text-[#92400E]">{spinsLeft}</p>
            <p className="text-[10px] text-[#B45309] font-bold uppercase">Spins</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily claim */}
        <div className="bg-white rounded-3xl border-2 border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-[#2563EB]" />
            <h3 className="font-black text-sm text-[#0F172A]">Daily Reward</h3>
          </div>
          <p className="text-xs text-[#64748B] font-bold mb-4">Claim your free DreamCoins every day. Streak rewards keep growing!</p>
          <button
            onClick={handleClaimDaily}
            disabled={claimingDaily || !canClaimDaily}
            className="prime-btn-3d w-full !py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claimingDaily ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {canClaimDaily ? 'Claim ₹20 DreamCoins' : 'Claimed Today ✓'}
          </button>
        </div>

        {/* Spin wheel */}
        <div className="bg-white rounded-3xl border-2 border-[#E2E8F0] p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <RotateCw className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-black text-sm text-[#0F172A]">Spin the Wheel</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0">
              <div
                className="w-28 h-28 rounded-full relative transition-transform duration-1000 ease-out"
                style={{ transform: `rotate(${spinAngle}deg)` }}
              >
                {SPIN_PRIZES.map((p, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(${i % 2 ? '#7C3AED' : '#C4B5FD'} ${i * (360 / SPIN_PRIZES.length)}deg ${(i + 1) * (360 / SPIN_PRIZES.length)}deg)`,
                      clipPath: `polygon(50% 50%, 50% 0%, 100% ${50 - Math.tan(Math.PI / SPIN_PRIZES.length) * 50}%)`,
                      transform: `rotate(${i * (360 / SPIN_PRIZES.length)}deg)`,
                    }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-[#7C3AED] flex items-center justify-center">
                  <Star className="w-4 h-4 text-[#7C3AED]" />
                </div>
              </div>
              <div className="absolute top-1/2 -right-1 w-0 h-0 border-y-8 border-y-transparent border-l-8 border-l-[#7C3AED]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#64748B] font-bold mb-2">{spinsLeft} spin{spinsLeft !== 1 ? 's' : ''} left today</p>
              <button
                onClick={handleSpin}
                disabled={spinning || !canSpin}
                className="prime-btn-3d w-full !py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {spinning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                {spinResult !== null ? `You won ${spinResult}!` : canSpin ? 'Spin Now' : 'No spins left'}
              </button>
            </div>
          </div>
        </div>

        {/* Scratch card */}
        <div className="bg-white rounded-3xl border-2 border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="font-black text-sm text-[#0F172A]">Scratch Card</h3>
          </div>
          <p className="text-xs text-[#64748B] font-bold mb-4">{scratchCards} card{scratchCards !== 1 ? 's' : ''} remaining</p>
          <div
            onClick={() => !scratching && scratchCards > 0 && handleScratch()}
            className={`relative h-36 rounded-2xl border-2 border-dashed flex items-center justify-center text-center transition ${
              scratchRevealed || scratchResult !== null
                ? 'border-[#F59E0B] bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]'
                : 'border-[#CBD5E1] bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] cursor-pointer hover:border-[#F59E0B]'
            }`}
          >
            {scratching ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#F59E0B]" />
            ) : scratchResult !== null ? (
              <div>
                <p className="text-3xl font-black text-[#92400E] font-mono">{scratchResult}</p>
                <p className="text-[10px] text-[#B45309] font-bold uppercase">DreamCoins won!</p>
              </div>
            ) : scratchCards > 0 ? (
              <div className="px-4">
                <Star className="w-6 h-6 mx-auto mb-2 text-[#F59E0B]" />
                <p className="text-xs font-black text-[#0F172A]">Tap to scratch</p>
                <p className="text-[10px] text-[#64748B] font-bold mt-1">Win up to {Math.max(...SCRATCH_PRIZES)} DreamCoins</p>
              </div>
            ) : (
              <div className="px-4">
                <Lock className="w-6 h-6 mx-auto mb-2 text-[#CBD5E1]" />
                <p className="text-xs font-black text-[#64748B]">No scratch cards left</p>
              </div>
            )}
          </div>
        </div>

        {/* Missions */}
        <div className="bg-white rounded-3xl border-2 border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="font-black text-sm text-[#0F172A]">Missions</h3>
          </div>
          <div className="space-y-3">
            {(state?.missions || []).map((m) => {
              const done = m.progress >= m.target;
              return (
                <div key={m.id} className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-[#0F172A]">{m.title}</p>
                      <p className="text-[10px] text-[#64748B] font-bold">{m.description}</p>
                    </div>
                    <span className="text-[10px] font-black text-[#D97706] whitespace-nowrap">+{m.reward} 🪙</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FFD700] rounded-full"
                        style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-[#64748B]">{m.progress}/{m.target}</span>
                    <button
                      onClick={() => handleClaimMission(m.id)}
                      disabled={!done || m.claimed || claimingMission === m.id}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        m.claimed
                          ? 'bg-green-100 text-green-700'
                          : done
                            ? 'bg-[#F59E0B] text-white hover:bg-[#D97706]'
                            : 'bg-[#E2E8F0] text-[#64748B]'
                      }`}
                    >
                      {claimingMission === m.id ? '...' : m.claimed ? 'Claimed ✓' : done ? 'Claim' : 'In progress'}
                    </button>
                  </div>
                </div>
              );
            })}
            {(state?.missions || []).length === 0 && (
              <p className="text-xs text-[#64748B] font-bold text-center py-4">No missions available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
