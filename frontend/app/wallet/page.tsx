'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wallet, ArrowRight } from 'lucide-react';

export default function WalletRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payouts-portal');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-[#0F172A] border border-[#1E293B] text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center mx-auto">
          <Wallet size={24} />
        </div>
        <h2 className="text-xl font-black text-white">Redirecting to Official Payouts Portal...</h2>
        <p className="text-xs text-[#94A3B8]">
          Wallet balances and contest winnings withdrawals have moved to the dedicated Prime Dreems Payouts Portal for complete financial transparency and legal compliance.
        </p>
        <Link
          href="/payouts-portal"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm transition-all"
        >
          Open Payouts Portal <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
