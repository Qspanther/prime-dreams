// 🩺 Next.js Frontend & Backend Health Check Proxy Route
// Hit by Render keep-alive crons to prevent spin-down on Render Free Tier.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendBase = (process.env.BACKEND_URL || 'https://prime-dreems-backend.onrender.com').replace(/\/+$/, '');
  let backendHealth = null;

  try {
    const res = await fetch(`${backendBase}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      backendHealth = await res.json();
    }
  } catch (err: any) {
    backendHealth = { error: err.message || 'Backend ping failed' };
  }

  return NextResponse.json({
    status: 'ok',
    service: 'prime-dreems-frontend',
    backend_status: backendHealth,
    timestamp: new Date().toISOString(),
  });
}
