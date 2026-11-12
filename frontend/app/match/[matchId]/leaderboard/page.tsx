'use client';

import React, { useCallback, useEffect, use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Radio, RefreshCw, Trophy } from 'lucide-react';
import { apiGet } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

type LeaderboardData = {
  match?: { title: string; status: string; team_a: string; team_b: string; score_summary?: any; last_updated?: string | null };
  player_leaderboard?: any[];
  contest?: { id: string; title: string; status: string } | null;
  contest_leaderboard?: any[];
  contest_lineups_hidden?: boolean;
  my_team?: { team_id: string; team_name: string; rank: number | null; total_points: number; players?: any[] } | null;
};

function websocketUrl() {
  const configured = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configured) return configured;
  const configuredApi = process.env.NEXT_PUBLIC_API_URL;
  if (configuredApi?.startsWith('http')) {
    const apiUrl = new URL(configuredApi);
    return `${apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiUrl.host}/ws`;
  }
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:5000/ws`;
  }
  return 'wss://prime-dreems-backend.onrender.com/ws';
}

export default function MatchLeaderboardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId');
  const { token } = useAuth();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const query = teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';
      const result = await apiGet(`/matches/${matchId}/leaderboard${query}`, token);
      setData(result);
      setError('');
      setUpdatedAt(new Date());
    } catch (err: any) {
      setError(err?.message || 'Leaderboard load nahi ho paya.');
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId, token]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const safeRefresh = async () => { if (active) await refresh(); };
    void safeRefresh();

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void safeRefresh(); }, 250);
    };
    const connect = () => {
      if (stopped) return;
      try {
        socket = new WebSocket(websocketUrl());
        socket.onopen = () => socket?.send(JSON.stringify({ action: 'subscribe', matchId }));
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if ((message.type === 'BALL_DELTA' || message.type === 'MATCH_SNAPSHOT' || message.type === 'RESYNC_REQUIRED') && message.match_id === matchId) {
              scheduleRefresh();
            }
          } catch { /* Ignore malformed telemetry and keep the REST fallback active. */ }
        };
        socket.onclose = () => {
          if (!stopped) reconnectTimer = setTimeout(connect, 2000);
        };
        socket.onerror = () => socket?.close();
      } catch { /* REST refresh remains available when WebSocket is unavailable. */ }
    };
    connect();
    const fallbackPoll = setInterval(() => { void safeRefresh(); }, 12000);

    return () => {
      active = false;
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackPoll);
      socket?.close();
    };
  }, [matchId, refresh, token]);

  if (!token) {
    return <main className="max-w-5xl mx-auto px-4 py-10 text-center text-[#0F172A]">Live leaderboard dekhne ke liye <Link href="/login" className="font-black text-[#2563EB] underline">login karein</Link>.</main>;
  }

  const match = data?.match;
  const matchTitle = match?.title || [match?.team_a, match?.team_b].filter(Boolean).join(' vs ') || 'Match leaderboard';
  const myTeamPlayers = data?.my_team?.players || [];

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5 text-[#0F172A]">
      <Link href={`/match/${matchId}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#475569] hover:text-[#2563EB]">
        <ArrowLeft className="w-4 h-4" /> Match par wapas
      </Link>

      <header className="prime-card-3d p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#D97706]">
              {match?.status === 'live' ? <Radio className="w-4 h-4 animate-pulse" /> : <Trophy className="w-4 h-4" />}
              {match?.status === 'live' ? 'Live · ball-by-ball updates' : (match?.status || 'Leaderboard')}
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-black">{matchTitle}</h1>
            {match?.score_summary && <p className="mt-1 text-sm font-bold text-[#475569]">{[match.score_summary.team_a, match.score_summary.team_b].filter(Boolean).map((score: any) => `${score.runs ?? 0}/${score.wickets ?? 0} (${score.overs ?? 0} ov)`).join(' · ')}</p>}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#64748B]">
            <RefreshCw className="w-3.5 h-3.5" />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Connecting live feed'}
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      </header>

      {data?.my_team && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your contest rank</p><p className="mt-1 text-2xl font-black text-[#2563EB]">{data.my_team.rank ? `#${data.my_team.rank}` : '—'}</p></div>
          <div className="prime-card-3d p-4"><p className="text-xs font-bold text-[#64748B]">Your team points</p><p className="mt-1 text-2xl font-black text-[#D97706]">{Number(data.my_team.total_points || 0).toFixed(1)}</p></div>
          <div className="prime-card-3d p-4 col-span-2 sm:col-span-1"><p className="text-xs font-bold text-[#64748B]">Contest</p><p className="mt-1 truncate text-base font-black">{data.contest?.title || 'Not entered in a contest'}</p></div>
        </section>
      )}

      {teamId ? (
        <section className="space-y-4">
          <header className="prime-card-3d flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black"><Trophy className="w-5 h-5 text-[#2563EB]" /> {data?.my_team?.team_name || 'Your team'} leaderboard</h2>
              <p className="mt-1 text-xs text-[#64748B]">Sirf aapki team ke players · C = Captain (2×) · VC = Vice-Captain (1.5×)</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{myTeamPlayers.length} players</span>
          </header>

          {loading && !data ? <p className="prime-card-3d p-8 text-center text-sm font-bold text-[#64748B]">Aapki team ke live points load ho rahe hain…</p> : myTeamPlayers.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {myTeamPlayers.map((player: any) => (
                <article key={player.id} className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4 shadow-[0_0_18px_rgba(37,99,235,0.18)] transition hover:border-blue-400 hover:shadow-[0_0_26px_rgba(37,99,235,0.32)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-blue-200 bg-white/90 px-2 font-black text-blue-700 shadow-[0_0_12px_rgba(37,99,235,0.18)]">#{player.rank ?? '—'}</span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-slate-900">{player.name}</h3>
                        <p className="truncate text-[11px] font-semibold text-slate-500">{player.team_name} · {player.role}</p>
                      </div>
                    </div>
                    {(player.is_captain || player.is_vice_captain) && (
                      <span className="shrink-0 rounded-full border border-blue-300 bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-800">
                        {player.is_captain ? 'C · 2×' : 'VC · 1.5×'}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-blue-100 bg-white/80 p-3 shadow-[inset_0_0_12px_rgba(37,99,235,0.06)]">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Player points</p>
                      <p className="mt-1 font-mono text-xl font-black text-blue-700">{Number(player.points || 0).toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-white/80 p-3 shadow-[inset_0_0_12px_rgba(37,99,235,0.06)]">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Team points</p>
                      <p className="mt-1 font-mono text-xl font-black text-[#D97706]">{Number(player.points_earned || 0).toFixed(1)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-slate-600">
                    {player.stats?.runs ?? 0} runs · {player.stats?.balls ?? 0} balls · {player.stats?.wickets ?? 0} wickets
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="prime-card-3d p-8 text-center text-sm font-bold text-[#64748B]">Is team ke player points abhi available nahi hain.</p>
          )}
        </section>
      ) : (
        <section className="prime-card-3d overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] p-4 sm:p-5">
            <div><h2 className="flex items-center gap-2 text-lg font-black"><Trophy className="w-5 h-5 text-[#D97706]" /> Match player leaderboard</h2><p className="mt-1 text-xs text-[#64748B]">Match ke sabhi listed players ke fantasy points aur live rank.</p></div>
            <span className="text-xs font-black text-[#64748B]">{data?.player_leaderboard?.length || 0} players</span>
          </div>
          {loading && !data ? <p className="p-8 text-center text-sm font-bold text-[#64748B]">Live points load ho rahe hain…</p> : (
            <div className="divide-y divide-[#E2E8F0]">
              {(data?.player_leaderboard || []).map(player => (
                <div key={player.id} className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem] items-center gap-2 px-4 py-3">
                  <span className="text-sm font-black text-[#64748B]">#{player.rank}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-black">{player.name}</p><p className="text-[11px] font-semibold text-[#64748B]">{player.team_name} · {player.role}</p></div>
                  <span className="hidden sm:block text-right text-xs font-bold text-[#64748B]">{player.stats?.runs ?? 0} runs · {player.stats?.wickets ?? 0} wkts</span>
                  <span className="text-right font-mono text-base font-black text-[#D97706]">{Number(player.points || 0).toFixed(1)}</span>
                </div>
              ))}
              {!loading && !data?.player_leaderboard?.length && <p className="p-8 text-center text-sm font-bold text-[#64748B]">Is match ke player points abhi available nahi hain.</p>}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
