'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { apiGet, apiPut } from '../../lib/api';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Crown, Users, Gift, Save, CheckCircle2, AlertCircle,
  RefreshCw, ArrowLeft, Shield, Zap, Calendar, IndianRupee, Sparkles,
  Share2, Clock, Check, X, Search
} from 'lucide-react';

interface SettingsData {
  subscription_enabled: string;
  subscription_free_mode: string;
  subscription_free_until: string;
  share_unlock_target: string;
  share_unlock_reward_days: string;
  subscription_monthly_price: string;
  subscription_duration_days: string;
}

interface StatsData {
  activeSubscribersCount: number;
  paidSubscribersCount: number;
  shareUnlockedUsersCount: number;
  totalSharesLogged: number;
  totalReferralsMade: number;
}

interface UserAudit {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  referralCode: string;
  subscriptionActiveUntil: string | null;
  subscriptionType: string;
  hasActivePass: boolean;
  isShareTargetMet: boolean;
  totalShares: number;
  totalReferrals: number;
  createdAt: string;
}

export default function AdminSubscriptionsPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState<SettingsData>({
    subscription_enabled: 'true',
    subscription_free_mode: 'false',
    subscription_free_until: '',
    share_unlock_target: '3',
    share_unlock_reward_days: '30',
    subscription_monthly_price: '199',
    subscription_duration_days: '30',
  });

  const [stats, setStats] = useState<StatsData>({
    activeSubscribersCount: 0,
    paidSubscribersCount: 0,
    shareUnlockedUsersCount: 0,
    totalSharesLogged: 0,
    totalReferralsMade: 0,
  });

  const [users, setUsers] = useState<UserAudit[]>([]);

  const fetchSettings = () => {
    if (!token) return;
    setLoading(true);
    apiGet('/admin/subscription-settings', token)
      .then(res => {
        if (res && res.settings) {
          setForm(res.settings);
          if (res.stats) setStats(res.stats);
          if (res.users) setUsers(res.users);
        }
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to load subscription settings' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiPut('/admin/subscription-settings', form, token);
      setMessage({ type: 'success', text: 'Subscription & Share Access policies saved successfully!' });
      fetchSettings();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.referralCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center justify-center text-[#D97706]">
              <Crown size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F172A]">
                Subscription, Free Access &amp; Share Controls
              </h1>
              <p className="text-xs text-[#334155]">
                Configure when team creation is 100% free, when subscription is required, and minimum shares needed to unlock.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F1F5F9] rounded-xl text-xs font-semibold border border-[#CBD5E1] transition-all self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-red-50 border-red-300 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </motion.div>
      )}

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#CBD5E1] shadow-sm">
          <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1.5">
            <Zap size={14} className="text-[#2563EB]" /> Total Active Access
          </p>
          <p className="text-2xl font-black text-[#0F172A]">{stats.activeSubscribersCount}</p>
          <span className="text-[10px] text-[#64748B]">Users eligible to play</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#CBD5E1] shadow-sm">
          <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1.5">
            <Crown size={14} className="text-[#D97706]" /> Paid VIP Pass
          </p>
          <p className="text-2xl font-black text-[#D97706]">{stats.paidSubscribersCount}</p>
          <span className="text-[10px] text-[#64748B]">₹ Paid subscriptions</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#CBD5E1] shadow-sm">
          <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1.5">
            <Share2 size={14} className="text-emerald-600" /> Unlocked via Share
          </p>
          <p className="text-2xl font-black text-emerald-600">{stats.shareUnlockedUsersCount}</p>
          <span className="text-[10px] text-[#64748B]">Earned via invite</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#CBD5E1] shadow-sm">
          <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1.5">
            <Share2 size={14} className="text-purple-600" /> Total Shares
          </p>
          <p className="text-2xl font-black text-purple-600">{stats.totalSharesLogged}</p>
          <span className="text-[10px] text-[#64748B]">WhatsApp / Links</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#CBD5E1] shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1.5">
            <Users size={14} className="text-blue-600" /> Joined Friends
          </p>
          <p className="text-2xl font-black text-blue-600">{stats.totalReferralsMade}</p>
          <span className="text-[10px] text-[#64748B]">Registered through invites</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Free Access vs Subscription Master Gate */}
        <div className="prime-card-3d bg-white p-6 border border-[#CBD5E1] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                <Sparkles className="text-[#D97706]" size={20} />
                Free Access &amp; Gate Rules
              </h3>
              <p className="text-xs text-[#334155] mt-0.5">
                Control whether tournaments are 100% free for everyone, or require subscription/sharing.
              </p>
            </div>
            {form.subscription_free_mode === 'true' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                100% FREE MODE ACTIVE
              </span>
            ) : form.subscription_enabled === 'true' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
                GATE ENFORCED (SUB / SHARE REQUIRED)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E2E8F0] text-[#64748B]">
                GATE DISABLED
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Mode Toggle Card */}
            <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                    <Zap size={16} className="text-[#2563EB]" />
                    100% Free Access Mode
                  </h4>
                  <p className="text-xs text-[#334155] mt-0.5">
                    When active, all users can create teams without paying or sharing.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={form.subscription_free_mode === 'true'}
                    onChange={e => setForm({ ...form, subscription_free_mode: e.target.checked ? 'true' : 'false' })}
                  />
                  <div className="w-11 h-6 bg-[#CBD5E1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            {/* Free Until Date Picker */}
            <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-3">
              <div>
                <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                  <Clock size={16} className="text-[#D97706]" />
                  Free Access Valid Until (Date &amp; Time)
                </h4>
                <p className="text-xs text-[#334155] mt-0.5">
                  Promotional window: free for all until this exact deadline.
                </p>
              </div>
              <input
                type="datetime-local"
                value={form.subscription_free_until ? form.subscription_free_until.slice(0, 16) : ''}
                onChange={e => setForm({ ...form, subscription_free_until: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Share & Subscription Pricing Policy */}
        <div className="prime-card-3d bg-white p-6 border border-[#CBD5E1] space-y-6">
          <div className="pb-4 border-b border-[#E2E8F0]">
            <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
              <Share2 className="text-emerald-600" size={20} />
              Share Unlock Rules &amp; Subscription Pricing
            </h3>
            <p className="text-xs text-[#334155] mt-0.5">
              Set how many shares/friends unlock team creation, and set the monthly pass price.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Minimum Shares Target */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                Min. Shares to Unlock
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.share_unlock_target}
                  onChange={e => setForm({ ...form, share_unlock_target: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#64748B]">Users</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">E.g. share with 3 friends to play free</p>
            </div>

            {/* Reward Days on Share */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                Free Pass Validity
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.share_unlock_reward_days}
                  onChange={e => setForm({ ...form, share_unlock_reward_days: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#64748B]">Days</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">Free pass duration when target met</p>
            </div>

            {/* Monthly VIP Price */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                Monthly Pass Price (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.subscription_monthly_price}
                  onChange={e => setForm({ ...form, subscription_monthly_price: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl font-bold text-[#D97706] focus:outline-none focus:border-[#F59E0B] text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#64748B]">INR</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">Price for instant VIP monthly pass</p>
            </div>

            {/* Pass Duration Days */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-2">
                VIP Pass Duration
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.subscription_duration_days}
                  onChange={e => setForm({ ...form, subscription_duration_days: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#64748B]">Days</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">Duration of paid pass (e.g. 30 days)</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[#2563EB]/20"
            >
              <Save size={16} />
              {saving ? 'Saving Changes...' : 'Save Subscription & Share Rules'}
            </button>
          </div>
        </div>
      </form>

      {/* SECTION 3: User Share & Subscription Audit Table */}
      <div className="prime-card-3d bg-white p-6 border border-[#CBD5E1] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
              <Users className="text-[#2563EB]" size={20} />
              User Share &amp; Subscription Audit
            </h3>
            <p className="text-xs text-[#334155] mt-0.5">
              Live record of every user&apos;s shares, referral signups, and access status.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-[#64748B]" size={14} />
            <input
              type="text"
              placeholder="Search user, email or code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#334155] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Promo Code</th>
                <th className="py-3 px-4 text-center">Shares Logged</th>
                <th className="py-3 px-4 text-center">Friends Joined</th>
                <th className="py-3 px-4">Pass Status</th>
                <th className="py-3 px-4">Access Type</th>
                <th className="py-3 px-4">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B]">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0F172A]">{u.name}</div>
                      <div className="text-[11px] text-[#64748B]">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">
                      {u.referralCode || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-purple-600">
                      {u.totalShares || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-blue-600">
                      {u.totalReferrals || 0}
                    </td>
                    <td className="py-3 px-4">
                      {u.hasActivePass ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <Check size={14} /> Active
                        </span>
                      ) : u.isShareTargetMet ? (
                        <span className="inline-flex items-center gap-1 text-[#2563EB] font-bold">
                          <Check size={14} /> Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#64748B]">
                          <X size={14} /> Locked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-semibold">
                      {u.subscriptionType || 'none'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {u.subscriptionActiveUntil
                        ? new Date(u.subscriptionActiveUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
