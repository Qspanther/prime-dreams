'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Bell, LogOut, Menu, X, Home, Users, Wallet, Settings, Radio, Shield 
} from 'lucide-react';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import PrimeLogo from '../ui/PrimeLogo';
import LiveMatchSwitcher from '../ui/LiveMatchSwitcher';

export default function TopBar() {
  const { user, token, logout } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [showLiveSwitcher, setShowLiveSwitcher] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiGet('/wallet/balance', token)
      .then((res) => {
        if (typeof res?.balance === 'number') setBalance(res.balance);
      })
      .catch(() => {});

    apiGet('/notifications', token)
      .then((res) => {
        if (Array.isArray(res)) setNotifications(res);
        else if (Array.isArray(res?.notifications)) setNotifications(res.notifications);
      })
      .catch(() => {});
  }, [token]);

  // Polling for live match count (§8: Global live indicator)
  useEffect(() => {
    let mounted = true;
    const fetchLiveStats = async () => {
      try {
        const res = await apiGet('/matches/live-all');
        if (mounted && typeof res?.live_count === 'number') {
          setLiveCount(res.live_count);
        }
      } catch (err) {}
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read && !n.isRead).length;

  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-[#CBD5E1] bg-white/90 backdrop-blur-xl px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 shadow-[0_4px_20px_rgba(30,58,138,0.06)] text-[#0F172A]">
        {/* Left: Logo & Mobile Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-xl text-[#475569] hover:bg-[#E0F2FE] hover:text-[#0284C7] border border-[#CBD5E1] transition shadow-sm"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <PrimeLogo size="sm" />
          </Link>

          {/* Section 8: Global Live Indicator (3D Glowing Badge) */}
          {liveCount > 0 && (
            <button
              onClick={() => setShowLiveSwitcher(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-50 to-red-100 border-2 border-[#EF4444] text-xs font-black text-[#B91C1C] hover:scale-105 shadow-[0_4px_12px_rgba(239,68,68,0.25)] transition cursor-pointer"
              title="Click to switch live matches"
            >
              <Radio className="w-3.5 h-3.5 text-[#EF4444] animate-pulse" />
              <span className="tracking-wider">{liveCount} {liveCount === 1 ? 'Match' : 'Matches'} LIVE</span>
            </button>
          )}
        </div>

        {/* Right: Wallet Balance, Notifications & User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 3D Gold Wallet Balance Pill */}
          <Link
            href="/wallet"
            className="prime-btn-gold-3d !py-1.5 !px-3.5 !text-xs font-black"
          >
            <Wallet className="w-4 h-4 text-[#92400E]" />
            <span className="font-mono text-sm">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          </Link>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#475569] hover:text-[#2563EB] hover:border-[#3B82F6] transition shadow-sm"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center justify-center shadow-[0_0_8px_#EF4444]">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 mt-2 w-80 prime-card-3d p-4 z-50 animate-in fade-in zoom-in-95 border-2 border-[#94A3B8]">
                <div className="flex items-center justify-between pb-2 border-b border-[#CBD5E1] mb-3">
                  <span className="font-black text-xs uppercase text-[#1E293B] tracking-wider">Notifications</span>
                  <span className="text-[10px] text-[#64748B]">{notifications.length} total</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-center text-[#64748B] py-4">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A]">
                        <p className="font-bold text-[#0F172A] text-[11px]">{n.title}</p>
                        <p className="text-[10px] text-[#475569] mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User & Logout */}
          {user ? (
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <Link
                  href="/admin/tournaments"
                  className="prime-btn-3d !py-1.5 !px-3 !text-xs"
                  title="Open Admin Console"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Admin Console</span>
                  <span className="sm:hidden">Admin</span>
                </Link>
              )}
              <span className="hidden sm:inline text-xs font-black text-[#0369A1] px-2.5 py-1 rounded-xl bg-[#E0F2FE] border border-[#BAE6FD]">
                @{user.username || user.name?.split(' ')[0]}
              </span>
              <button
                onClick={logout}
                className="p-2.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#64748B] hover:text-[#EF4444] hover:border-[#EF4444] transition shadow-sm"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="prime-btn-3d !py-2 !px-4 !text-xs">
              Login
            </Link>
          )}
        </div>
      </header>

      {/* Live Match Switcher Modal */}
      <LiveMatchSwitcher
        isOpen={showLiveSwitcher}
        onClose={() => setShowLiveSwitcher(false)}
      />

      {/* Mobile Drawer (Exactly 4 items Section 2) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex lg:hidden">
          <div className="w-68 bg-[#0A0A0A] border-r-2 border-[#262626] p-5 flex flex-col justify-between h-full shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#222222]">
                <PrimeLogo size="sm" />
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-[#A3A3A3] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-5 space-y-2">
                {[
                  { label: 'Home', href: '/', icon: Home },
                  { label: 'My Teams', href: '/my-teams', icon: Users },
                  { label: 'Wallet', href: '/wallet', icon: Wallet },
                  { label: 'Settings', href: '/settings', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-black text-white hover:bg-[#1A1A1A] hover:text-[#FFD700] border border-transparent hover:border-[#FFD700]/30 transition"
                    >
                      <Icon className="w-5 h-5 text-[#FF1744]" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="prime-card-shiny-gold p-4 text-center">
              <p className="text-xs font-black text-[#FFD700]">🏏 PRIME DREEMS</p>
              <p className="text-[10px] text-[#A3A3A3] mt-0.5 font-bold">Cricket Fantasy Colosseum</p>
            </div>
          </div>

          <div className="flex-1" onClick={() => setMobileDrawerOpen(false)} />
        </div>
      )}
    </>
  );
}
