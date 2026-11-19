// ⚡ PRIME DREEMS — HIGH-PERFORMANCE INSTANT API CLIENT WITH SWR CACHING

export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return '/api-backend';
  }
  return process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://127.0.0.1:5000';
}

export function getWebSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (process.env.NEXT_PUBLIC_WEBSOCKET_URL) return process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')) {
    try {
      const u = new URL(process.env.NEXT_PUBLIC_API_URL);
      return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}/ws`;
    } catch (_) {}
  }
  if (typeof window !== 'undefined') {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
      return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:5000/ws`;
    }
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  }
  return 'ws://127.0.0.1:5000/ws';
}

// ── In-Memory Client SWR Cache for Instant (0ms) Page Loads ──
interface CacheEntry {
  data: any;
  timestamp: number;
}
const clientCache = new Map<string, CacheEntry>();

export function clearApiCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (key.includes(endpointPrefix)) {
      clientCache.delete(key);
    }
  }
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  retries?: number;
  skipCache?: boolean;
  ttlMs?: number;
};

export async function api(endpoint: string, options: FetchOptions = {}) {
  const { method = 'GET', body, token, retries = 1, skipCache = false, ttlMs = 6000 } = options;
  const isGet = method.toUpperCase() === 'GET';
  const cacheKey = `${token ? 'auth:' : 'anon:'}${endpoint}`;

  // 1. Instant Cache Return for GET requests (< 1ms)
  if (isGet && !skipCache && typeof window !== 'undefined') {
    const cached = clientCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      // If fresh, return immediately!
      if (age < ttlMs) {
        return cached.data;
      }
      // Stale-While-Revalidate: If under 30 seconds old, return cached data immediately
      // and revalidate in background silently
      if (age < 30000) {
        // Background revalidation
        fetchNetwork(endpoint, options, cacheKey).catch(() => {});
        return cached.data;
      }
    }
  }

  // If mutation (POST/PUT/DELETE), purge client caches so user sees instant updates
  if (!isGet) {
    clientCache.clear();
  }

  return await fetchNetwork(endpoint, options, cacheKey);
}

async function fetchNetwork(endpoint: string, options: FetchOptions, cacheKey: string) {
  const { method = 'GET', body, token, retries = 1 } = options;
  const isGet = method.toUpperCase() === 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const base = getApiBase();

  let res: Response;
  try {
    res = await fetch(`${base}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (netErr: any) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 500));
      return fetchNetwork(endpoint, { ...options, retries: retries - 1 }, cacheKey);
    }
    throw new Error('Network error: Unable to connect to server. Please try again.');
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return fetchNetwork(endpoint, { ...options, retries: retries - 1 }, cacheKey);
    }
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  if (!res.ok) {
    if (data && data.requiresOtp) {
      return data;
    }
    if (res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return fetchNetwork(endpoint, { ...options, retries: retries - 1 }, cacheKey);
    }
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  // Populate client cache on successful GET
  if (isGet && typeof window !== 'undefined') {
    clientCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

// Convenience wrappers
export const apiGet = (endpoint: string, token?: string | null, options?: Omit<FetchOptions, 'token' | 'method'>) =>
  api(endpoint, { ...options, method: 'GET', token });

export const apiPost = (endpoint: string, body: unknown, token?: string | null) =>
  api(endpoint, { method: 'POST', body, token });

export const apiDelete = (endpoint: string, token?: string | null) =>
  api(endpoint, { method: 'DELETE', token });

export const apiPut = (endpoint: string, body: unknown, token?: string | null) =>
  api(endpoint, { method: 'PUT', body, token });

export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (trimmed === '/cricket/poster.png' || trimmed === '/cricket/default-poster.jpg') {
    return trimmed;
  }
  if (!trimmed || trimmed === '/cricket/team_a.png' || trimmed === '/cricket/team_b.png' || trimmed === '/cricket/player_avatar.png') {
    return '';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/api-backend/uploads/')) {
    return trimmed.replace('/api-backend', '');
  }
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }
  return `/uploads/${trimmed}`;
}

export function resolvePlayerPhoto(url?: string | null, name?: string): string {
  const base = resolveImageUrl(url);
  if (!base || !/^https?:\/\//i.test(base)) return base;
  let isGoogleImgres = false;
  try {
    const u = new URL(base);
    isGoogleImgres = /(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.searchParams.has('imgurl');
  } catch (_) {}
  if (!isGoogleImgres && (/\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i.test(base) || /(dicebear|gstatic|redd\.it|wikimedia|twimg|fbcdn)/i.test(base))) {
    return base;
  }
  return `${getApiBase()}/player-photo?url=${encodeURIComponent(base)}&name=${encodeURIComponent(name || '')}`;
}
