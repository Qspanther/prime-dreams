export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') {
    return process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:5000';
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
