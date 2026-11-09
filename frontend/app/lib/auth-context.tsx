'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  kycStatus?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  loading: true,
});

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return '/api-backend';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize null so the first client render matches SSR (no hydration mismatch);
  // stored credentials are applied in the mount effect below.
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('prime_dreems_token');
    if (stored) {
      setToken(stored);
      try {
        const cached = localStorage.getItem('prime_dreems_user');
        if (cached) setUser(JSON.parse(cached));
      } catch (_) {}
      // Verify token
      fetch(`${getApiBase()}/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            setUser(data);
            localStorage.setItem('prime_dreems_user', JSON.stringify(data));
          } else {
            localStorage.removeItem('prime_dreems_token');
            localStorage.removeItem('prime_dreems_user');
            setUser(null);
            setToken(null);
          }
        })
        .catch(() => {
          // Keep cached user if offline, or don't flush immediately unless invalid
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    try {
      localStorage.setItem('prime_dreems_token', newToken);
      localStorage.setItem('prime_dreems_user', JSON.stringify(newUser));
    } catch (_) {}
  };

  const logout = () => {
    try {
      localStorage.removeItem('prime_dreems_token');
      localStorage.removeItem('prime_dreems_user');
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (_) {}
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

