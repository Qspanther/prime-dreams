'use client';

import React, { useState } from 'react';
import { resolveImageUrl } from '../../lib/api';
import CategoryBadge from './CategoryBadge';
import { MapPin } from 'lucide-react';

interface MatchPosterFrameProps {
  poster?: string | null;
  title?: string;
  category?: string;
  venue?: string;
  topRightBadge?: React.ReactNode;
  heightClass?: string;
  className?: string;
}

export default function MatchPosterFrame({
  poster,
  title,
  category,
  venue,
  topRightBadge,
  heightClass = 'h-32 sm:h-36',
  className = '',
}: MatchPosterFrameProps) {
  const [imgError, setImgError] = useState(false);

  // If user uploaded a poster or provided a URL, use it; otherwise fallback to default cricket poster
  const resolved = resolveImageUrl(poster);
  const src = (!imgError && resolved) ? resolved : '/cricket/poster.png';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[#CBD5E1] bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A0F1D] shadow-[0_4px_16px_rgba(15,23,42,0.15)] group ${heightClass} ${className}`}
    >
      {/* Background Poster Image */}
      <img
        src={src}
        alt={title || 'Cricket Match Poster'}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        onError={() => {
          if (!imgError) setImgError(true);
        }}
      />

      {/* Atmospheric Cinematic Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40 mix-blend-overlay" />

      {/* Top Bar: Category on left, Status / Badge on right */}
      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
        <CategoryBadge category={category || 'League'} size="xs" />
        {topRightBadge && (
          <div className="pointer-events-auto">
            {topRightBadge}
          </div>
        )}
      </div>

      {/* Bottom Bar: Venue / Stadium info */}
      <div className="absolute bottom-2 inset-x-2.5 flex items-center justify-between text-[10px] text-white/95 font-bold drop-shadow-md pointer-events-none z-10">
        <span className="flex items-center gap-1 truncate max-w-[85%]">
          <MapPin className="w-3 h-3 text-red-400 shrink-0" />
          <span className="truncate">{venue || title || 'International Stadium'}</span>
        </span>
      </div>
    </div>
  );
}

