import React from 'react';
import HomeClient from './HomeClient';
import { getApiBase } from './lib/api';

export const revalidate = 10;

async function getInitialMatches() {
  try {
    const res = await fetch(`${getApiBase()}/api/matches`, {
      next: { revalidate: 10 },
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
