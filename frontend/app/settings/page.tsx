'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Settings, User, Mail, Shield, LogOut, KeyRound, Check, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiPut } from '../lib/api';

export default function SettingsPage() {
  const { user, token, logout, login } = useAuth();
  const router = useRouter();

  const [emailForm, setEmailForm] = useState({ newEmail: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  
  const [emailLoading, setEmailLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg({ type: '', text: '' });
    try {
      await apiPut('/auth/change-email', emailForm, token);
      setEmailMsg({ type: 'success', text: 'Email updated successfully!' });
      if (user) {
        login(token!, { ...user, email: emailForm.newEmail });
      }
      setEmailForm({ newEmail: '' });
    } catch (err: any) {
      setEmailMsg({ type: 'error', text: err.message || 'Failed to update email' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassLoading(true);
    setPassMsg({ type: '', text: '' });
    try {
      await apiPut('/auth/change-password', passForm, token);
      setPassMsg({ type: 'success', text: 'Password changed successfully!' });
      setPassForm({ currentPassword: '', newPassword: '' });
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setPassLoading(false);
    }
  };

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    : '—';

  return (
    <div className="px-3 sm:px-6 py-6 max-w-2xl mx-auto w-full space-y-6 bg-transparent">
      <div className="flex items-center gap-3">
        <Settings className="w-7 h-7 text-[#DC2626] drop-shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
        <h1 className="text-xl sm:text-3xl font-black text-[#0F172A]">Account Settings</h1>
      </div>

      {/* Account Profile Card (§10: User Identity) */}
      <div className="prime-card-3d p-6 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#D97706]">
          Player Identity
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
            <User className="w-5 h-5 text-[#DC2626]" />
            <div>
              <p className="text-[11px] text-[#64748B] font-bold">Username</p>
              <p className="text-sm font-black text-[#0F172A]">
                @{user?.username || user?.name?.toLowerCase().replace(/\s+/g, '_') || 'player'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
            <Mail className="w-5 h-5 text-[#DC2626]" />
            <div>
              <p className="text-[11px] text-[#64748B] font-bold">Registered Email</p>
              <p className="text-sm font-mono font-bold text-[#64748B]">{maskedEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1]">
            <Shield className="w-5 h-5 text-[#D97706]" />
            <div>
              <p className="text-[11px] text-[#64748B] font-bold">KYC Status</p>
              <p className="text-sm font-black text-emerald-600 capitalize">{user?.kycStatus || 'Verified & Active'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Email */}
      <div className="prime-card-3d p-6 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#D97706] flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#DC2626]" /> Update Email
        </h3>
        {emailMsg.text && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${emailMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-300' : 'bg-green-50 text-green-700 border border-green-300'}`}>
            <span>{emailMsg.text}</span>
          </div>
        )}
        <form onSubmit={handleChangeEmail} className="space-y-3">
          <input
            type="email"
            placeholder="New Email Address"
            value={emailForm.newEmail}
            onChange={(e) => setEmailForm({ newEmail: e.target.value })}
            required
            className="w-full bg-white border-2 border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] outline-none font-bold"
          />
          <button
            type="submit"
            disabled={emailLoading}
            className="prime-btn-3d text-xs !py-2.5 !px-5 font-black uppercase"
          >
            {emailLoading ? 'Updating...' : 'Save New Email'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="prime-card-3d p-6 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#D97706] flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#DC2626]" /> Change Password
        </h3>
        {passMsg.text && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${passMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-300' : 'bg-green-50 text-green-700 border border-green-300'}`}>
            <span>{passMsg.text}</span>
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            placeholder="Current Password"
            value={passForm.currentPassword}
            onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
            required
            className="w-full bg-white border-2 border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] outline-none font-bold"
          />
          <input
            type="password"
            placeholder="New Password (min 6 characters)"
            value={passForm.newPassword}
            onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
            required
            className="w-full bg-white border-2 border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] outline-none font-bold"
          />
          <button
            type="submit"
            disabled={passLoading}
            className="prime-btn-3d text-xs !py-2.5 !px-5 font-black uppercase"
          >
            {passLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleLogout}
        className="prime-btn-dark-3d w-full !py-3.5 text-sm font-black uppercase text-[#DC2626] hover:!text-[#DC2626] flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out of Prime Dreems</span>
      </button>
    </div>
  );
}
