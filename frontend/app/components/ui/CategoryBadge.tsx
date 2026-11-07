'use client';

import React from 'react';

export type CricketCategory = 'World Cup' | 'T20' | 'League' | "Women's" | string;

export default function CategoryBadge({ category, size = 'sm' }: { category: CricketCategory; size?: 'xs' | 'sm' | 'md' }) {
  let badgeClasses = 'bg-[#141414] text-white border-white/20';

  switch (category) {
    case 'World Cup':
      badgeClasses = 'bg-gradient-to-r from-[#FFD700] via-[#FFA000] to-[#FF8F00] text-black border-t-[#FFF9C4] border-b-[#996500] shadow-[0_0_12px_rgba(255,215,0,0.5)] font-black';
      break;
    case 'T20':
      badgeClasses = 'bg-gradient-to-r from-[#FFF59D] to-[#FFD700] text-black border-t-white border-b-[#B29400] shadow-[0_0_10px_rgba(255,235,59,0.5)] font-black';
      break;
    case 'League':
      badgeClasses = 'bg-gradient-to-r from-[#FF1744] via-[#D50000] to-[#9B0000] text-white border-t-[#FF8A80] border-b-[#4A0000] shadow-[0_0_12px_rgba(255,23,68,0.5)] font-black';
      break;
    case "Women's":
      badgeClasses = 'bg-gradient-to-r from-[#880E4F] via-[#AD1457] to-[#D81B60] text-[#FFF9C4] border-t-[#F48FB1] border-b-[#4A0033] shadow-[0_0_12px_rgba(233,30,99,0.4)] font-black';
      break;
    default:
      badgeClasses = 'bg-[#1F1F1F] text-white border-white/20 font-bold';
  }

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] rounded-md',
    sm: 'px-2.5 py-1 text-xs rounded-lg',
    md: 'px-3.5 py-1.5 text-xs rounded-lg font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase tracking-wider border border-t-[1.5px] border-b-[2px] transition-transform shadow-sm ${badgeClasses} ${sizeClasses[size]}`}
    >
      {category === 'World Cup' && '🏆'}
      {category === 'T20' && '⚡'}
      {category === 'League' && '🏏'}
      {category === "Women's" && '👑'}
      <span>{category}</span>
    </span>
  );
}
