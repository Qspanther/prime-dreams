'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost } from '../lib/api';
import { Mail, Lock, User, ArrowRight, AlertCircle, Gift } from 'lucide-react';
import PrimeLogo from '../components/ui/PrimeLogo';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', promoCode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('promo');
      if (ref) {
        setForm((prev) => ({ ...prev, promoCode: ref.toUpperCase() }));
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiPost('/auth/signup', form);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('otp_email', form.email);
      }
      router.push('/verify-otp');
    } catch (err: any) {
      setError(err?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex justify-center mb-4">
        <PrimeLogo size="lg" />
      </div>

      <div className="prime-card-3d p-6 sm:p-8 space-y-5 bg-white border-2 border-[#CBD5E1]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0F172A]">Create Account</h2>
          <p className="text-xs text-[#64748B] mt-1">Join Prime Dreems Cricket Fantasy League</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#D97706] uppercase mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-[#64748B]" />
              <input
                type="text"
                placeholder="Rohit Verma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#D97706] uppercase mb-1">
              Unique Username (§10)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-[#64748B]">@</span>
              <input
                type="text"
                placeholder="rohit_v"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                required
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#D97706] uppercase mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#64748B]" />
              <input
                type="email"
                placeholder="you@domain.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#D97706] uppercase mb-1">
              Password (min 6 characters)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#64748B]" />
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-sm focus:border-[#2563EB] outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="prime-btn-3d w-full py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            {loading ? 'Creating Account...' : 'Register & Verify OTP'}
          </button>
        </form>

        <p className="text-center text-xs text-[#64748B] pt-2">
          Already registered?{' '}
          <Link href="/login" className="text-[#D97706] font-bold hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
