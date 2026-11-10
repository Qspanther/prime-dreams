'use client';

import React, { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from './lib/auth-context';
import Sidebar from './components/layout/Sidebar';
import AdminSidebar from './components/layout/AdminSidebar';
import TopBar from './components/layout/TopBar';
import MobileBottomNav from './components/layout/MobileBottomNav';
import H2HChallengePopup from './components/ui/H2HChallengePopup';
import NetworkStatus from './components/ui/NetworkStatus';

const publicPaths = ['/', '/login', '/signup', '/verify-otp', '/forgot-password'];
const authOnlyPaths = ['/login', '/signup', '/verify-otp', '/forgot-password'];

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();

  const isPublicPage = publicPaths.includes(pathname || '');
  const isAuthPage = authOnlyPaths.includes(pathname || '');
  const isAdminRoute = pathname?.startsWith('/admin');

  // Register Service Worker for offline caching + Web Push (FCM-style) notifications.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated && !isPublicPage) {
        router.push('/login');
      } else if (isAuthenticated && isAuthPage) {
        if (user?.role === 'admin') {
          router.push('/admin/tournaments');
        } else {
          router.push('/');
        }
      }
      if (isAdminRoute && user?.role !== 'admin') {
        router.push('/');
      }
    }
  }, [loading, isAuthenticated, isPublicPage, isAuthPage, isAdminRoute, user, router]);

  if (loading && !isPublicPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F4F9]">
        <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F0F4F9] text-[#0F172A] overflow-x-hidden font-['Montserrat',sans-serif]">
      {isAuthPage ? (
        <main className="relative z-10 min-h-screen flex items-center justify-center p-4">
          {children}
        </main>
      ) : (
        <div className="relative z-10 flex min-h-screen">
          {isAdminRoute ? <AdminSidebar /> : <Sidebar />}
          <div
            className={`flex-1 flex flex-col min-w-0 pb-20 lg:pb-8 ${
              isAdminRoute ? 'ml-0 md:ml-[240px]' : ''
            }`}
          >
            <TopBar />
            <main className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>
          </div>
          <MobileBottomNav />
        </div>
      )}

      {/* H2H Challenge Modal Popup (§7: Pop-up on login / screen with [Accept] and [Give Up]) */}
      <H2HChallengePopup />

      {/* Soft Offline & Reconnection Alert */}
      <NetworkStatus />
    </div>
  );
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
