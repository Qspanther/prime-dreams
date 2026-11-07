'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import Link from 'next/link';
import { apiPost } from '../lib/api';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import PrimeLogo from '../components/ui/PrimeLogo';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/auth/login', form);
      login(data.token, data.user);
      if (data.user?.role === 'admin') {
        router.push('/admin/tournaments');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid username/email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex justify-center mb-4">
        <PrimeLogo size="lg" />
      </div>

      <div className="prime-card p-6 sm:p-8 space-y-5 bg-[#26221B] border-2 border-[#3D352A]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Welcome Back</h2>
          <p className="text-xs text-[#8C8273] mt-1">Log in with your Email or Username</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#FFC107] uppercase mb-1">
              Email or Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#8C8273]" />
              <input
                type="text"
                placeholder="you@domain.com or username"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1C1A17] border border-[#3D352A] text-white text-sm focus:border-[#E53935] outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[#FFC107] uppercase">
                Password
              </label>
              <Link href="/forgot-password" className="text-[11px] text-[#D1C7B7] hover:text-[#FFC107]">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#8C8273]" />
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1C1A17] border border-[#3D352A] text-white text-sm focus:border-[#E53935] outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="prime-btn w-full py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            {loading ? 'Logging in...' : 'Sign In to Prime Dreems'}
          </button>
        </form>

        {/* Quick Demo Access Helpers */}
        <div className="pt-2 border-t border-[#3D352A]/80">
          <p className="text-[11px] font-bold text-[#8C8273] uppercase mb-2 text-center tracking-wider">
            Quick Fill Access
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ email: 'admin@primedreems.com', password: 'Admin@123' })}
              className="py-1.5 px-2 rounded-lg bg-[#1C1A17] border border-[#E53935]/40 hover:border-[#E53935] text-[11px] font-bold text-[#FFC107] transition text-center"
            >
              👑 Fill Admin
            </button>
            <button
              type="button"
              onClick={() => setForm({ email: 'user@primedreems.com', password: 'User@123' })}
              className="py-1.5 px-2 rounded-lg bg-[#1C1A17] border border-[#3D352A] hover:border-[#FFC107]/60 text-[11px] font-bold text-[#D1C7B7] hover:text-white transition text-center"
            >
              🏏 Fill User
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#8C8273] pt-2">
          New to Prime Dreems?{' '}
          <Link href="/signup" className="text-[#FFC107] font-bold hover:underline">
            Create an Account
          </Link>
        </p>
      </div>
    </div>
  );
}
