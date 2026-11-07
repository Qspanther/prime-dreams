import React from 'react';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

async function getInitialMatches() {
  try {
    const res = await fetch('http://127.0.0.1:5000/api/matches', {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches || [];
  } catch (err) {
    console.error('SSR fetch matches error:', err);
    return [];
  }
}

export default async function HomePage() {
  const matches = await getInitialMatches();
  return <HomeClient initialMatches={matches} />;
}
