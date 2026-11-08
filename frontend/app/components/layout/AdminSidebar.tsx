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
    <aside className="hidden md:flex bg-white/90 backdrop-blur-xl border-r-2 border-[#CBD5E1] fixed left-0 top-0 h-full w-[240px] z-40 flex-col py-6 shadow-[4px_0_20px_rgba(30,58,138,0.06)] text-[#0F172A]">
      {/* Admin Branding */}
      <div className="px-5 mb-8">
        <PrimeLogo size="sm" />
        <p className="text-[10px] text-[#2563EB] font-black tracking-widest uppercase mt-2">Admin Command Deck</p>
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
                    ? 'prime-btn-3d !justify-start !py-2.5 !px-3.5'
                    : 'text-[#475569] hover:text-[#0284C7] hover:bg-[#E0F2FE] border border-transparent hover:border-[#BAE6FD]'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-[#2563EB]'} />
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
        <p className="px-3 text-[10px] text-[#64748B] tracking-widest text-center font-mono font-bold">PRIME DREEMS • v2.1</p>
      </div>
    </aside>
  );
}
