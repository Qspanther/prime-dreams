'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Wallet, Settings } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'My Teams', href: '/my-teams', icon: Users },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#000000]/95 backdrop-blur-xl border-t border-[#222222] px-2 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.95)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[64px] py-1.5 rounded-xl transition-all duration-150 ${
              active
                ? 'text-[#FFD700] font-black bg-[#141414] border border-[#FFD700]/40 shadow-[0_0_12px_rgba(255,215,0,0.25)]'
                : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-[#FFD700]' : 'text-[#FF1744]'}`} />
            <span className="text-[11px] mt-1 font-black">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
