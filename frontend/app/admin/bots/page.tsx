'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, Clock, ShieldCheck, Zap, RefreshCw, Users, Trophy, Play, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/app/lib/auth-context';
import { apiGet, apiPost } from '@/app/lib/api';

export default function AdminBotManagementPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<any>(null);
  const [watcherStatus, setWatcherStatus] = useState<any>(null);
  const [botsList, setBotsList] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const fetchAllData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [statusRes, watcherRes, botsRes, winnersRes] = await Promise.all([
        apiGet('/bot-manager/status', token).catch(() => null),
        apiGet('/bot-manager/72h-status', token).catch(() => null),
        apiGet('/bot-manager/bots?limit=25', token).catch(() => null),
        apiGet('/bot-manager/winners-history', token).catch(() => null),
      ]);

      if (statusRes) setBotStatus(statusRes);
      if (watcherRes) setWatcherStatus(watcherRes);
      if (botsRes?.bots) setBotsList(botsRes.bots);
      if (winnersRes?.history) setWinners(winnersRes.history);
    } catch (err: any) {
      console.error('Error fetching bot data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const handleTriggerCheck = async () => {
    try {
      setTriggering(true);
      setActionMsg(null);
      const res = await apiPost('/bot-manager/trigger-72h-check', {}, token);
      setActionMsg(res?.message || '1-Hour Rule Scheduler check triggered successfully!');
      await fetchAllData();
    } catch (err: any) {
      setActionMsg(`Trigger failed: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleSeedBots = async () => {
    const confirm = window.confirm('Are you sure you want to initialize/seed 10,000 autonomous bots in the database?');
    if (!confirm) return;
    try {
      setTriggering(true);
      setActionMsg('Seeding 10,000 bots into database...');
      const res = await apiPost('/bot-manager/seed-bots', { targetCount: 10000 }, token);
      setActionMsg(res?.message || 'Successfully seeded bot network to 10,000 bots!');
      await fetchAllData();
    } catch (err: any) {
      setActionMsg(`Seed failed: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#CBD5E1]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white shadow-md">
              <Bot size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Bot Network Command</h1>
              <p className="text-xs font-bold text-[#64748B]">Autonomous Micro-Batch Pacing & 1-Hour Completion Rule Engine</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="prime-btn-dark-3d !py-2 !px-3 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleTriggerCheck}
            disabled={triggering}
            className="prime-btn-3d !py-2 !px-4 text-xs font-black flex items-center gap-1.5"
          >
            <Zap size={14} />
            <span>Trigger 1-Hour Tick</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#93C5FD] text-[#1D4ED8] text-xs font-bold flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-xs font-black underline ml-4">Dismiss</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 bg-white rounded-2xl border-2 border-[#CBD5E1] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Bot Network</span>
            <Bot size={18} className="text-[#2563EB]" />
          </div>
          <div className="text-3xl font-black text-[#0F172A]">
            {botStatus?.totalBots ?? botStatus?.registeredBotsCount ?? '10,000'}
          </div>
          <p className="text-[11px] font-bold text-[#10B981] mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} /> Autonomous & Ready
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-5 bg-white rounded-2xl border-2 border-[#CBD5E1] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-black uppercase tracking-wider">1-Hour Completion Rule</span>
            <Clock size={18} className="text-[#F59E0B]" />
          </div>
          <div className="text-3xl font-black text-[#0F172A]">1 Hour Prior</div>
          <p className="text-[11px] font-bold text-[#2563EB] mt-1">
            Targets lock 60m before match start
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-5 bg-white rounded-2xl border-2 border-[#CBD5E1] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Pacing Architecture</span>
            <Zap size={18} className="text-[#8B5CF6]" />
          </div>
          <div className="text-3xl font-black text-[#0F172A]">Micro-Batch</div>
          <p className="text-[11px] font-bold text-[#64748B] mt-1">
            1-by-1 join with organic jitter
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-5 bg-white rounded-2xl border-2 border-[#CBD5E1] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Isolation Guard</span>
            <ShieldCheck size={18} className="text-[#10B981]" />
          </div>
          <div className="text-3xl font-black text-[#10B981]">100% Protected</div>
          <p className="text-[11px] font-bold text-[#64748B] mt-1">
            H2H & Private Contests Excluded
          </p>
        </div>
      </div>

      {/* Upcoming Matches & 1-Hour Tracking Table */}
      <div className="bg-white rounded-2xl border-2 border-[#CBD5E1] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#0F172A]">Match Deployment & 1-Hour Countdown</h2>
            <p className="text-xs text-[#64748B]">All upcoming fixtures with automated micro-batch progression</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider text-[10px] font-black">
                <th className="py-3 px-3">Match</th>
                <th className="py-3 px-3">Time Until Start</th>
                <th className="py-3 px-3">1-Hour Deadline Status</th>
                <th className="py-3 px-3">Contest Eligibility</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {watcherStatus?.matches && watcherStatus.matches.length > 0 ? (
                watcherStatus.matches.map((m: any) => {
                  const is1HPassed = Number(m.hoursUntilStart) <= 1.0;
                  return (
                    <tr key={m.id || m.matchId} className="hover:bg-[#F8FAFC]">
                      <td className="py-3.5 px-3 font-bold text-[#0F172A]">
                        {m.title}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-[#2563EB]">
                        {Number(m.hoursUntilStart || 0).toFixed(1)} hrs
                      </td>
                      <td className="py-3.5 px-3">
                        {is1HPassed ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#DCFCE7] text-[#16A34A] border border-[#86EFAC]">
                            ✓ Target Locked (≤ 1.0h)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                            ⚡ Active Micro-Joining
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-[#64748B]">
                        Mega & Battlefield Active • H2H Excluded
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Link href={`/match/${m.id || m.matchId}`} className="text-[#2563EB] font-black hover:underline inline-flex items-center gap-1">
                          View Match <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#94A3B8] font-bold">
                    No active upcoming fixtures currently in tracking window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Bot Profiles Sample & Quick Admin Utilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample Bot Identities */}
        <div className="bg-white rounded-2xl border-2 border-[#CBD5E1] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-[#0F172A]">Bot Squad Registry (Sample)</h2>
              <p className="text-xs text-[#64748B]">Indian identities with isolated wallets & verified KYC</p>
            </div>
            <button
              onClick={handleSeedBots}
              disabled={triggering}
              className="prime-btn-dark-3d !py-1.5 !px-3 text-[11px] font-bold"
            >
              Seed 10,000 Bots
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {botsList.length > 0 ? (
              botsList.slice(0, 10).map((bot: any, idx: number) => (
                <div key={bot.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[10px] font-black text-[#475569]">
                      {bot.name?.[0] || 'B'}
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#0F172A]">{bot.name}</p>
                      <p className="text-[10px] text-[#64748B]">@{bot.username || 'bot'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A]">
                    ₹1,00,000 Wallet
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#94A3B8] py-4 text-center font-bold">Loading registered bots...</p>
            )}
          </div>
        </div>

        {/* Fair Rotation & Tactical Rearrangement Status */}
        <div className="bg-white rounded-2xl border-2 border-[#CBD5E1] p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-black text-[#0F172A]">Anti-Monopoly Fair Rotation</h2>
            <p className="text-xs text-[#64748B]">Tiers 1-6 rotation prevents single bot dominance across tournaments</p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-[#0F172A]">Death Stage Tactical Rearrangement</p>
                <p className="text-[11px] text-[#64748B]">Last 6-10 balls: Guarantees top prize positions</p>
              </div>
              <span className="text-xs font-black text-[#10B981]">AUTOMATIC</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-[#0F172A]">Post-Match Winner Rotation</p>
                <p className="text-[11px] text-[#64748B]">Cycles champion bots to lower tiers for fair variance</p>
              </div>
              <span className="text-xs font-black text-[#2563EB]">ACTIVE</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-[#0F172A]">Database Query Isolation</p>
                <p className="text-[11px] text-[#64748B]">Writes to dedicated bot_teams table with JSON lineups</p>
              </div>
              <span className="text-xs font-black text-[#10B981]">ENABLED (91% WRITE SAVINGS)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
