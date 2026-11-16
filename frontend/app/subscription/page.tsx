'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { apiGet, apiPost } from '../lib/api';
import {
  Crown, Users, Gift, Check, Sparkles, Shield, ArrowRight,
  Copy, Share2, AlertCircle, RefreshCw, Zap, Clock, Award
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Plan {
  id: string;
  name: string;
  price: number;
  validity_days: number;
  max_teams_per_match: number;
  description: string;
  badge?: string;
  is_active?: boolean;
}

interface ReferralOffer {
  target_count: number;
  reward_days: number;
  teams_per_match: number;
  is_active: boolean;
  title: string;
}

interface UserStatus {
  hasActivePass: boolean;
  hasPaidSubscription: boolean;
  paidPlanId: string | null;
  paidExpiresAt: string | null;
  paidDaysLeft: number;
  paidMaxTeams: number;
  hasReferralPass: boolean;
  referralPassExpiresAt: string | null;
  referralDaysLeft: number;
  referralMaxTeams: number;
  referralPassClaimedAt: string | null;
  effectiveMaxTeams: number;
  referralCode: string;
  totalReferralsCount: number;
  canClaimReferralPass: boolean;
}

export default function SubscriptionPage() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [referralOffer, setReferralOffer] = useState<ReferralOffer | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);

  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [claimingReferral, setClaimingReferral] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiGet('/subscription/plans', token);
      if (res) {
        if (res.plans) setPlans(res.plans);
        if (res.referralOffer) setReferralOffer(res.referralOffer);
        if (res.userStatus) setUserStatus(res.userStatus);
      }
    } catch (e) {
      console.error('Fetch plans err:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [token]);

  const handlePurchasePlan = async (planId: string) => {
    if (!token) {
      setActionMessage({ type: 'error', text: 'Please log in to activate a tournament pass.' });
      return;
    }

    setPurchasingPlanId(planId);
    setActionMessage(null);
    try {
      const res = await apiPost('/subscription/purchase-plan', { plan_id: planId }, token);
      setActionMessage({
        type: 'success',
        text: res.message || '🎉 Tournament Pass activated successfully!',
      });
      fetchPlans();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to activate pass.',
      });
    } finally {
      setPurchasingPlanId(null);
    }
  };

  const handleClaimReferralPass = async () => {
    if (!token) return;
    setClaimingReferral(true);
    setActionMessage(null);
    try {
      const res = await apiPost('/subscription/claim-referral-pass', {}, token);
      setActionMessage({
        type: 'success',
        text: res.message || '🎉 Free Referral Pass claimed successfully!',
      });
      fetchPlans();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to claim referral pass.',
      });
    } finally {
      setClaimingReferral(false);
    }
  };

  const copyReferralCode = () => {
    const code = userStatus?.referralCode || (user as any)?.referral_code || (user as any)?.referralCode || '';
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-[#F8FAFC] py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs uppercase font-extrabold px-3 py-1 rounded-full bg-[#D97706]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            100% Free-to-Play Contests with Pass
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Prime Dreems Tournament Passes
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            No wallet deductions per contest. Activate a subscription pass or invite your friends to create unlimited fantasy teams across all cricket fixtures!
          </p>
        </div>

        {/* Global Action Message */}
        {actionMessage && (
          <div className={`p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
              : 'bg-[#EF4444]/20 text-[#F87171] border border-[#EF4444]/40'
          }`}>
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs underline">Dismiss</button>
          </div>
        )}

        {/* User's Active Pass Card (if logged in) */}
        {user && userStatus && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0F172A] to-[#1E293B] border border-[#334155] shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={20} className={userStatus.hasActivePass ? 'text-[#F59E0B]' : 'text-[#64748B]'} />
                  <span className="text-sm font-bold text-[#94A3B8]">Your Current Membership</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {userStatus.hasPaidSubscription
                    ? `👑 ${userStatus.paidPlanId?.toUpperCase() || 'VIP'} Member`
                    : userStatus.hasReferralPass
                    ? '⚡ Referral Free Pass Holder'
                    : 'Free Explorer (No Active Pass)'}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  {userStatus.hasActivePass
                    ? `Allowed to create up to ${userStatus.effectiveMaxTeams} team(s) per match for free!`
                    : 'Activate a pass below or invite friends to unlock team creation.'}
                </p>
              </div>

              {userStatus.hasActivePass && (
                <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-[#334155] pt-3 sm:pt-0 sm:pl-6">
                  <div>
                    <span className="text-[11px] text-[#94A3B8]">Remaining Time</span>
                    <p className="text-xl font-black text-[#10B981]">
                      {Math.max(userStatus.paidDaysLeft, userStatus.referralDaysLeft)} Days Left
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#94A3B8]">Max Teams / Match</span>
                    <p className="text-xl font-black text-[#38BDF8]">
                      {userStatus.effectiveMaxTeams} Teams
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════ SECTION 1: DYNAMIC SUBSCRIPTION TIERS ═════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Sparkles size={20} className="text-[#F59E0B]" /> Choose Your Subscription Tier
            </h2>
            <span className="text-xs text-[#94A3B8]">Instant Activation • Zero Contest Fees</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p) => {
              const isCurrent = userStatus?.paidPlanId === p.id && (userStatus?.paidDaysLeft || 0) > 0;
              const isVIP = p.id === 'vip' || p.id === 'gold';
              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-2xl flex flex-col justify-between transition-all relative overflow-hidden ${
                    isVIP
                      ? 'bg-gradient-to-b from-[#1E293B] to-[#0F172A] border-2 border-[#F59E0B]/50 shadow-lg shadow-[#F59E0B]/10'
                      : 'bg-[#0F172A] border border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  {p.badge && (
                    <span className="absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
                      {p.badge}
                    </span>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-lg font-black text-white">{p.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">₹{p.price}</span>
                      <span className="text-xs text-[#94A3B8]">/ {p.validity_days} Days</span>
                    </div>

                    <p className="text-xs text-[#94A3B8] leading-relaxed">{p.description}</p>

                    <div className="pt-2 border-t border-[#1E293B] space-y-1.5 text-xs text-[#CBD5E1]">
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-[#10B981]" />
                        <span><strong>{p.max_teams_per_match} Teams</strong> per match</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-[#10B981]" />
                        <span>Valid for <strong>{p.validity_days} Days</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-[#10B981]" />
                        <span>Free entry in Mega &amp; Battlefield</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-4">
                    <button
                      onClick={() => handlePurchasePlan(p.id)}
                      disabled={purchasingPlanId === p.id}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                        isCurrent
                          ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]'
                          : isVIP
                          ? 'bg-gradient-to-r from-[#D97706] to-[#B45309] hover:from-[#B45309] hover:to-[#92400E] text-white shadow-md'
                          : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                      }`}
                    >
                      {purchasingPlanId === p.id
                        ? 'Activating...'
                        : isCurrent
                        ? '✓ Current Active Plan (Extend)'
                        : `Activate for ₹${p.price}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═════ SECTION 2: REFERRAL & PROMO CODE REWARDS ═════ */}
        {referralOffer && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B]/70 border border-[#38BDF8]/30 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-extrabold px-3 py-1 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                  🎁 Invite &amp; Play Free
                </span>
                <h3 className="text-2xl font-black text-white mt-2">
                  {referralOffer.title || `Refer ${referralOffer.target_count} Friends — Get ${referralOffer.reward_days} Days Free Access`}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Share your unique referral code. When {referralOffer.target_count} friends sign up, you unlock {referralOffer.reward_days} days of free tournament access with {referralOffer.teams_per_match} team(s) per match!
                </p>
              </div>

              {userStatus && (
                <div className="text-right sm:border-l border-[#334155] sm:pl-6">
                  <span className="text-xs text-[#94A3B8]">Your Referrals</span>
                  <p className="text-2xl font-black text-[#38BDF8]">
                    {userStatus.totalReferralsCount} / {referralOffer.target_count}
                  </p>
                </div>
              )}
            </div>

            {/* Referral Progress Bar */}
            {userStatus && (
              <div className="space-y-2">
                <div className="w-full h-2.5 rounded-full bg-[#07090E] overflow-hidden border border-[#334155]">
                  <div
                    className="h-full bg-gradient-to-r from-[#2563EB] to-[#10B981] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((userStatus.totalReferralsCount || 0) / referralOffer.target_count) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>{userStatus.totalReferralsCount} Friends Joined</span>
                  <span>
                    {userStatus.totalReferralsCount >= referralOffer.target_count
                      ? '🎯 Target Reached! Claim your free pass below.'
                      : `${referralOffer.target_count - userStatus.totalReferralsCount} more friends needed`}
                  </span>
                </div>
              </div>
            )}

            {/* Referral Code Share Row */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <div className="w-full sm:flex-1 p-3 rounded-xl bg-[#07090E] border border-[#334155] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#38BDF8]" />
                  <span className="text-xs text-[#94A3B8]">Your Promo Code:</span>
                  <span className="text-sm font-black text-white tracking-wider">
                    {userStatus?.referralCode || (user as any)?.referral_code || (user as any)?.referralCode || 'LOG_IN_TO_VIEW'}
                  </span>
                </div>
                {user && (
                  <button
                    onClick={copyReferralCode}
                    className="text-xs font-bold text-[#38BDF8] hover:text-[#7DD3FC] flex items-center gap-1"
                  >
                    <Copy size={13} /> {copiedCode ? 'Copied!' : 'Copy Code'}
                  </button>
                )}
              </div>

              {/* Claim Pass Button */}
              {userStatus && userStatus.canClaimReferralPass && (
                <button
                  onClick={handleClaimReferralPass}
                  disabled={claimingReferral}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm shadow-lg shadow-[#10B981]/20 transition-all flex items-center justify-center gap-2"
                >
                  <Gift size={16} />
                  {claimingReferral ? 'Claiming...' : 'Claim Free Pass Now!'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
