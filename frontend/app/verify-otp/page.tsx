'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { motion } from 'framer-motion';
import { apiPost } from '../lib/api';
import { ShieldCheck, Zap, Mail, RefreshCw, Edit2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import PrimeLogo from '../components/ui/PrimeLogo';

export default function VerifyOtpPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const e = sessionStorage.getItem('otp_email');
    if (e) setEmail(e);
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your registered email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await apiPost('/auth/verify-otp', { email: email.trim(), otp: otp.trim() });
      login(data.token, data.user);
      sessionStorage.removeItem('otp_email');
      sessionStorage.removeItem('otp_hint');
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
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
      const res: any = await apiPost('/auth/resend-otp', { email: email.trim() });
      setSuccessMsg(res.message || 'Fresh OTP sent! Please check your email inbox and spam folder.');
      setCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <PrimeLogo size="md" />
        </div>

        <div className="prime-card-3d p-8">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck size={28} className="text-[#2563EB]" />
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A]">Verify OTP</h2>
              <p className="text-xs text-[#334155]">Enter the 6-digit code sent to your email</p>
            </div>
          </div>

          {/* Email Notice & Quick Edit */}
          <div className="mb-6 p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[#2563EB] font-bold">
                <Mail size={15} />
                <span>Verification Email</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingEmail(!isEditingEmail)}
                className="text-[11px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 transition-colors"
              >
                <Edit2 size={12} />
                {isEditingEmail ? 'Done' : 'Change'}
              </button>
            </div>

            {isEditingEmail ? (
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#64748B] outline-none focus:border-[#2563EB]"
              />
            ) : (
              <p className="text-xs text-[#334155] font-mono break-all font-semibold">
                {email || <span className="text-[#D97706] font-normal font-sans">No email set. Click Change to enter.</span>}
              </p>
            )}

            <p className="text-[11px] text-[#64748B]">
              💡 Please check your <strong>Inbox</strong> and <strong>Spam / Junk</strong> folder.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-700 flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-[#64748B] mb-2 text-center uppercase tracking-wider font-semibold">
                6-Digit Security Code
              </label>
              <input
                type="text"
                placeholder="••••••"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                autoFocus
                className="w-full text-center !text-3xl !tracking-[0.4em] !font-mono py-3 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] placeholder-[#64748B] focus:border-[#2563EB] outline-none"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading || otp.length !== 6}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 text-sm font-bold prime-btn-3d rounded-xl disabled:opacity-50 shadow-lg shadow-[#2563EB]/20 hover:opacity-95 transition cursor-pointer"
            >
              {loading ? 'Verifying OTP...' : 'Verify & Enter 3D Arena'}
            </motion.button>

            {/* Resend OTP Button with countdown */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || resending || !email.trim()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline disabled:text-[#64748B] disabled:no-underline disabled:cursor-not-allowed transition"
              >
                <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                {resending
                  ? 'Sending fresh OTP...'
                  : cooldown > 0
                    ? `Resend OTP in ${cooldown}s`
                    : 'Resend OTP to Email'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E2E8F0] text-center">
            <Link href="/signup" className="text-xs text-[#64748B] hover:text-[#2563EB] transition">
              ← Back to Create Account
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
