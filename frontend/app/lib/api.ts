export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') {
    return process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://127.0.0.1:5000';
  }
  return '/api-backend';
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function api(endpoint: string, options: FetchOptions = {}) {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const base = getApiBase();
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', // Disable caching to ensure fresh data
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  if (!res.ok) {
    if (data && data.requiresOtp) {
      return data;
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
  if (!trimmed || trimmed === '/cricket/team_a.png' || trimmed === '/cricket/team_b.png' || trimmed === '/cricket/poster.png' || trimmed === '/cricket/player_avatar.png') {
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
