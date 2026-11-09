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
      router.push(data.user?.role === 'admin' ? '/admin/tournaments' : '/');
    } catch (err: any) {
      setError(err?.message || 'Invalid username/email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex justify-center mb-2">
        <PrimeLogo size="lg" />
      </div>

      <div className="prime-card-3d p-6 sm:p-8 space-y-5">
        <div className="text-center">
          <h2 className="pd-title text-2xl">Welcome Back</h2>
          <p className="text-xs text-[#64748B] mt-1">Log in with your Email or Username</p>
        </div>

        {error && (
          <div className="pd-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="pd-label">Email or Username</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="you@domain.com or username"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="pd-input pl-9"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="pd-label mb-0">Password</label>
              <Link href="/forgot-password" className="text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-[#94A3B8]" />
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="pd-input pl-9"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="prime-btn-3d w-full py-3 text-sm font-black uppercase tracking-wider"
          >
            {loading ? 'Logging in...' : (
              <>Login <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#64748B] pt-1">
          New to Prime Dreems?{' '}
          <Link href="/signup" className="text-[#2563EB] font-bold hover:underline">
            Create an Account
          </Link>
        </p>
      </div>
    </div>
  );
}