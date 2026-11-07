'use client';

import React from 'react';

const CATEGORIES = ['All', 'World Cup', 'T20', 'League', "Women's"];

interface CategoryFilterTabsProps {
  selectedCategory: string;
  onSelect: (category: string) => void;
  className?: string;
}

export default function CategoryFilterTabs({ selectedCategory, onSelect, className = '' }: CategoryFilterTabsProps) {
  return (
    <div className={`flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none ${className}`}>
      {CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              isSelected
                ? 'prime-btn-3d shadow-[0_0_20px_rgba(255,23,68,0.6)] !py-2 !px-4'
                : 'prime-btn-dark-3d !py-2 !px-4 !text-[#D4D4D4] hover:!text-[#FFD700]'
            }`}
          >
            {cat === 'World Cup' && '🏆 '}
            {cat === 'T20' && '⚡ '}
            {cat === 'League' && '🏏 '}
            {cat === "Women's" && '👑 '}
            <span>{cat}</span>
          </button>
        );
      })}
    </div>
  );
}
