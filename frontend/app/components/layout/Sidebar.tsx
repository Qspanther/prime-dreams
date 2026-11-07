'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Wallet, Settings } from 'lucide-react';
import PrimeLogo from '../ui/PrimeLogo';

export default function Sidebar() {
  const pathname = usePathname();

  // EXACTLY 4 Items as strictly required by Section 2
  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'My Teams', href: '/my-teams', icon: Users },
    { label: 'Wallet', href: '/wallet', icon: Wallet },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[#222222] bg-[#000000] p-4 justify-between z-20 min-h-screen shadow-[4px_0_25px_rgba(0,0,0,0.8)]">
      <div className="space-y-6">
        <Link href="/" className="block px-2 pt-1 group">
          <PrimeLogo size="md" />
        </Link>

        <div className="pt-2">
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-[#FFD700] mb-3">
            Prime Navigation
          </p>
          <nav className="space-y-2" aria-label="Sidebar Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-black transition-all duration-150 ${
                    isActive
                      ? 'prime-btn-3d shadow-[0_0_16px_rgba(255,23,68,0.5)] !justify-start'
                      : 'text-[#D4D4D4] hover:bg-[#141414] hover:text-[#FFD700] hover:border hover:border-[#FFD700]/30'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#FF1744]'}`} />
                  <span className="tracking-wide">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="prime-card-shiny-gold p-4 text-center">
        <p className="text-xs font-black text-[#FFD700] tracking-wider">🏏 PRIME DREEMS</p>
        <p className="text-[10px] text-[#A3A3A3] mt-0.5 font-bold">Cricket Fantasy Colosseum</p>
      </div>
    </aside>
  );
}
