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
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xl border-t-2 border-[#CBD5E1] px-2 py-2 flex items-center justify-around shadow-[0_-4px_20px_rgba(30,58,138,0.08)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[64px] py-1.5 rounded-xl transition-all duration-150 ${
              active
                ? 'text-[#2563EB] font-black bg-[#E0F2FE] border-2 border-[#38BDF8] shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
            <span className="text-[11px] mt-1 font-black">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
