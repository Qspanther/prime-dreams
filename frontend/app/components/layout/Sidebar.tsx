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
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r-2 border-[#CBD5E1] bg-white/85 backdrop-blur-xl p-4 justify-between z-20 min-h-screen shadow-[4px_0_20px_rgba(30,58,138,0.05)] text-[#0F172A]">
      <div className="space-y-6">
        <Link href="/" className="block px-2 pt-1 group">
          <PrimeLogo size="md" />
        </Link>

        <div className="pt-2">
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-[#2563EB] mb-3">
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
                      ? 'prime-btn-3d !justify-start !py-3 !px-4'
                      : 'text-[#334155] hover:bg-[#E0F2FE] hover:text-[#0284C7] border border-transparent hover:border-[#BAE6FD]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#2563EB]'}`} />
                  <span className="tracking-wide">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="prime-card-shiny-gold p-4 text-center border-2 border-[#F59E0B]">
        <p className="text-xs font-black text-[#92400E] tracking-wider">🏏 PRIME DREEMS</p>
        <p className="text-[10px] text-[#B45309] mt-0.5 font-bold">Cricket Fantasy Colosseum</p>
      </div>
    </aside>
  );
}
