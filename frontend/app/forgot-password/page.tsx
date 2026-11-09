'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../lib/api';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Mail, Lock, ShieldCheck, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import PrimeLogo from '../components/ui/PrimeLogo';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiPost('/auth/forgot-password', { email: email.trim() });
      setSuccessMsg(`OTP sent to ${email.trim()}! Please check your inbox and spam folder.`);
      setCooldown(30);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending || !email.trim()) return;
    setResending(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiPost('/auth/forgot-password', { email: email.trim() });
      setSuccessMsg(`Fresh password reset OTP sent to ${email.trim()}!`);
      setCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword) return;
    setLoading(true);
    setError('');
    try {
      await apiPost('/auth/reset-password', { email: email.trim(), otp: otp.trim(), newPassword });
      setSuccessMsg('Password reset successful! Redirecting to login...');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        
        <div className="flex justify-center mb-6">
          <PrimeLogo size="md" />
        </div>
        
        <div className="prime-card-3d p-8">
          <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-6 mx-auto">
            <KeyRound size={24} />
          </div>
          
          <h2 className="text-2xl font-bold mb-2 text-center text-[#0F172A]">Reset Password</h2>
          <p className="text-sm text-[#334155] mb-6 text-center">
            {step === 1 ? "Enter your email to receive an OTP" : `Enter the 6-digit OTP sent to ${email}`}
          </p>

          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-700 text-center font-medium">{error}</div>}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-700 text-center font-medium flex items-center justify-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] z-10" />
                <input
                  type="email"
                  placeholder="Registered Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full !pl-10 px-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-sm placeholder-[#64748B] focus:border-[#2563EB] outline-none"
                />
              </div>
              <motion.button
                type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3 text-sm font-bold prime-btn-3d rounded-xl cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send Reset OTP'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-[#64748B] mb-1 font-semibold uppercase tracking-wider">
                  6-Digit OTP
                </label>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] z-10" />
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    autoFocus
                    className="w-full !pl-10 px-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] placeholder-[#64748B] focus:border-[#2563EB] outline-none font-mono tracking-widest text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#64748B] mb-1 font-semibold uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] z-10" />
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full !pl-10 px-3 py-2 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-sm placeholder-[#64748B] focus:border-[#2563EB] outline-none"
                  />
                </div>
              </div>

              <motion.button
                type="submit" disabled={loading || otp.length !== 6 || newPassword.length < 6} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3 text-sm font-bold prime-btn-3d rounded-xl cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Resetting Password...' : 'Save New Password'}
              </motion.button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[#64748B] hover:text-[#0F172A] transition"
                >
                  ← Change Email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || resending}
                  className="text-[#2563EB] hover:underline disabled:text-[#64748B] disabled:no-underline flex items-center gap-1 transition"
                >
                  <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                  {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          <div className="text-center mt-6 pt-4 border-t border-[#E2E8F0]">
            <Link href="/login" className="text-xs text-[#64748B] hover:text-[#2563EB] transition-colors">
              Remember your password? Log In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
