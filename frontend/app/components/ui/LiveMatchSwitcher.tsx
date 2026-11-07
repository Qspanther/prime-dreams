'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Radio, ChevronRight, X } from 'lucide-react';
import CategoryBadge from './CategoryBadge';
import { apiGet } from '../../lib/api';

interface LiveMatchSummary {
  id: string;
  title: string;
  category: string;
  team_a: string;
  team_b: string;
  status_text: string;
  updated_tag: string;
  score_summary?: any;
}

export default function LiveMatchSwitcher({
  isOpen,
  onClose,
  activeMatchId,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeMatchId?: string;
}) {
  const [liveMatches, setLiveMatches] = useState<LiveMatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchLive = async () => {
      try {
        const res = await apiGet('/matches/live-all');
        if (mounted && res?.live_matches) {
          setLiveMatches(res.live_matches);
        }
      } catch (err) {
        // graceful degrade
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLive();
    // 10s poll throttle (§8)
    const interval = setInterval(fetchLive, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-xl prime-card-3d overflow-hidden border-2 border-[#FF1744] shadow-[0_0_40px_rgba(255,23,68,0.4)] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222222] flex items-center justify-between bg-[#000000]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF1744] animate-ping" />
            <h3 className="font-black text-white text-base">Live Match Switcher</h3>
            <span className="neon-badge-gold px-2.5 py-0.5 rounded-full text-xs font-black">
              {liveMatches.length} LIVE
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-white hover:bg-[#141414] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matches List */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading && liveMatches.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#A3A3A3] font-bold">Loading live cricket matches...</div>
          ) : liveMatches.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#A3A3A3] font-bold">No live cricket matches at the moment.</div>
          ) : (
            liveMatches.map((m) => {
              const isActive = m.id === activeMatchId;
              return (
                <Link
                  key={m.id}
                  href={`/match/${m.id}`}
                  onClick={onClose}
                  className={`block p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF1744]/25 to-[#000000] border-[#FF1744] shadow-[0_0_15px_rgba(255,23,68,0.4)]'
                      : 'bg-[#000000] border-[#222222] hover:border-[#FFD700] hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <CategoryBadge category={m.category} size="xs" />
                    <span className="text-xs font-mono text-[#FFD700] font-black flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#FF1744] animate-pulse" />
                      {m.updated_tag}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-white text-base">{m.title}</h4>
                      <p className="text-xs text-[#FFD700] font-mono font-bold mt-0.5">
                        {m.status_text || `${m.team_a} vs ${m.team_b}`}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#A3A3A3]" />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-[#222222] bg-[#000000] text-right">
          <button onClick={onClose} className="prime-btn-dark-3d text-xs !py-2 !px-4">
            Close Switcher
          </button>
        </div>
      </div>
    </div>
  );
}
