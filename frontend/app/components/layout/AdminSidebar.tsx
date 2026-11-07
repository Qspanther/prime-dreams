'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Trophy, Users, Shield, Wallet, Sliders, ArrowLeft
} from 'lucide-react';
import PrimeLogo from '../ui/PrimeLogo';

const navItems = [
  { href: '/admin', label: 'Console Overview', icon: Home },
  { href: '/admin/tournaments', label: 'Cricket Matches & Contests', icon: Trophy },
  { href: '/admin/crypto', label: 'INR Gateway & Payments', icon: Wallet },
  { href: '/admin/formula', label: 'Fantasy Scoring Formula', icon: Sliders },
  { href: '/admin/users', label: 'Player Management', icon: Shield },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex bg-[#000000] border-r border-[#222222] fixed left-0 top-0 h-full w-[240px] z-40 flex-col py-6 shadow-[4px_0_25px_rgba(0,0,0,0.9)]">
      {/* Admin Branding */}
      <div className="px-5 mb-8">
        <PrimeLogo size="sm" />
        <p className="text-[10px] text-[#FFD700] font-black tracking-widest uppercase mt-2">Admin Command Deck</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${isActive
                    ? 'prime-btn-3d !justify-start !py-2.5 !px-3.5 shadow-[0_0_15px_rgba(255,23,68,0.5)]'
                    : 'text-[#A3A3A3] hover:text-[#FFD700] hover:bg-[#141414] border border-transparent hover:border-[#FFD700]/30'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-[#FF1744]'} />
                <span className="text-xs font-black tracking-wide">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Return to Public Player App */}
      <div className="px-4 mt-auto space-y-2">
        <Link href="/">
          <div className="prime-btn-dark-3d w-full !py-2 !px-3 text-xs font-black flex items-center justify-center gap-2">
            <ArrowLeft size={14} />
            <span>Switch to Player App</span>
          </div>
        </Link>
        <p className="px-3 text-[10px] text-[#A3A3A3] tracking-widest text-center font-mono font-bold">PRIME DREEMS • v2.1</p>
      </div>
    </aside>
  );
}
