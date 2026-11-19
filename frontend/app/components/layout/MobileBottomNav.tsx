'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Trophy, Settings, Crown } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'My Teams', href: '/my-teams', icon: Users },
  { label: 'Passes', href: '/subscription', icon: Crown },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pd-safe-bottom lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t-2 border-[#CBD5E1] px-2 pt-1 pb-1 flex items-center justify-around shadow-[0_-6px_24px_rgba(30,58,138,0.10)]">
      <span className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-[#93C5FD] to-transparent pointer-events-none" />
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all duration-200 ${
              active
                ? 'text-[#1D4ED8] font-black bg-gradient-to-b from-[#EFF6FF] to-[#E0F2FE] border-2 border-[#38BDF8] shadow-[0_2px_8px_rgba(56,189,248,0.3),inset_0_1px_0_rgba(255,255,255,0.9)]'
                : 'text-[#64748B] hover:text-[#0F172A] active:scale-95'
            }`}
          >
            <Icon className={`w-4 h-4 transition-transform duration-200 ${active ? 'text-[#2563EB] scale-105 drop-shadow-[0_2px_4px_rgba(37,99,235,0.35)]' : 'text-[#64748B]'}`} />
            <span className="text-[9px] mt-0.5 font-black tracking-wide leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
