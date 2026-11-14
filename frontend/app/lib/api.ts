export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
      // Connect directly to local backend port 5000 to eliminate Next.js proxy socket dropouts (ECONNRESET)
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return '/api-backend';
  }
  return process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://127.0.0.1:5000';
}

export function getWebSocketUrl(): string {
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

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  retries?: number;
};

export async function api(endpoint: string, options: FetchOptions = {}) {
  const { method = 'GET', body, token, retries = 1 } = options;

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
      cache: 'no-store', // Disable caching to ensure fresh data
    });
  } catch (netErr: any) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return api(endpoint, { ...options, retries: retries - 1 });
    }
    throw new Error('Network error: server se sampark nahi ho pa raha.');
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return api(endpoint, { ...options, retries: retries - 1 });
    }
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  if (!res.ok) {
    if (data && data.requiresOtp) {
      return data;
    }
    if (res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return api(endpoint, { ...options, retries: retries - 1 });
    }
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}

// Convenience wrappers
export const apiGet = (endpoint: string, token?: string | null) =>
  api(endpoint, { token });

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

// Player photos may be direct images, Google imgres links, or profile pages.
// Page links go through the backend resolver which extracts og:image server-side.
export function resolvePlayerPhoto(url?: string | null, name?: string): string {
  const base = resolveImageUrl(url);
  if (!base || !/^https?:\/\//i.test(base)) return base;
  let isGoogleImgres = false;
  try {
    const u = new URL(base);
    isGoogleImgres = /(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.searchParams.has('imgurl');
  } catch (_) {}
  // Google imgres always goes through the proxy: the embedded imgurl host may
  // block cross-origin browser loads, and the proxy can fall back to the tbn thumbnail.
  if (!isGoogleImgres && (/\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i.test(base) || /(dicebear|gstatic|redd\.it|wikimedia|twimg|fbcdn)/i.test(base))) {
    return base;
  }
  return `${getApiBase()}/player-photo?url=${encodeURIComponent(base)}&name=${encodeURIComponent(name || '')}`;
}
