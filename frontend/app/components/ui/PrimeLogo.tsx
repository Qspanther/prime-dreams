'use client';

import React from 'react';

export default function PrimeLogo({
  size = 'md',
  className = '',
  compactOnMobile = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  compactOnMobile?: boolean;
}) {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Prime Dreems Specular Shining Trophy Emblem (3D Metallic Edition) */}
      <div
        className={`${iconSizes[size]} rounded-xl bg-gradient-to-b from-[#222222] via-[#0A0A0A] to-[#000000] p-1.5 flex items-center justify-center relative shadow-[0_0_22px_rgba(255,215,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.7)] border-2 border-[#FFD700] group overflow-hidden`}
      >
        {/* Specular Glint Highlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#FFD700]/25 to-transparent pointer-events-none" />

        {/* Shining World Cup Trophy SVG with Metallic Facets and Sparkle */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
        >
          <defs>
            {/* Lustrous Ultra-Bright Gold Gradients */}
            <linearGradient id="trophyGoldShine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="15%" stopColor="#FFF9C4" />
              <stop offset="40%" stopColor="#FFD700" />
              <stop offset="75%" stopColor="#FFB300" />
              <stop offset="100%" stopColor="#FF8F00" />
            </linearGradient>

            <linearGradient id="specularGleam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#FFF9C4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="pedestalGold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF9C4" />
              <stop offset="50%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#4A3400" />
            </linearGradient>

            <radialGradient id="glintCenter" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#FFF9C4" />
              <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Trophy Cup Body */}
          <path
            d="M12 8H36V20C36 26.6274 30.6274 32 24 32C17.3726 32 12 26.6274 12 20V8Z"
            fill="url(#trophyGoldShine)"
            stroke="#FFFFFF"
            strokeWidth="0.75"
          />

          {/* Left Wing Handle */}
          <path
            d="M12 12H7C5.34315 12 4 13.3431 4 15V18C4 22.4183 7.58172 26 12 26V23C9.23858 23 7 20.7614 7 18V15H12V12Z"
            fill="url(#trophyGoldShine)"
            stroke="#FFF59D"
            strokeWidth="0.5"
          />

          {/* Right Wing Handle */}
          <path
            d="M36 12H41C42.6569 12 44 13.3431 44 15V18C44 22.4183 40.4183 26 36 26V23C38.7614 23 41 20.7614 41 18V15H36V12Z"
            fill="url(#trophyGoldShine)"
            stroke="#FFF59D"
            strokeWidth="0.5"
          />

          {/* World Cup Trophy Globe / Sphere Summit */}
          <circle cx="24" cy="7" r="4.5" fill="url(#trophyGoldShine)" stroke="#FFF" strokeWidth="0.75" />
          <path d="M20 7C20 4.5 28 4.5 28 7" stroke="#FFF" strokeWidth="0.5" strokeDasharray="1 1" />

          {/* Specular Glint Reflection Slashes on Cup Face */}
          <path d="M16 10L20 28H18L14 10H16Z" fill="url(#specularGleam)" opacity="0.9" />
          <path d="M22 10L25 29H24L21 10H22Z" fill="#FFFFFF" opacity="0.5" />

          {/* Trophy Stem & Tiered Base */}
          <path d="M21 32H27V36H21V32Z" fill="url(#pedestalGold)" stroke="#FFD700" strokeWidth="0.5" />
          <path d="M16 36H32V40C32 40.5523 31.5523 41 31 41H17C16.4477 41 16 40.5523 16 40V36Z" fill="url(#pedestalGold)" stroke="#FFF" strokeWidth="0.5" />
          <rect x="13" y="41" width="22" height="3.5" rx="1" fill="#000000" stroke="#FFD700" strokeWidth="1" />

          {/* Shining 4-Point Star Sparkle at Top Rim */}
          <path
            d="M32 9L33.5 12L36.5 13.5L33.5 15L32 18L30.5 15L27.5 13.5L30.5 12L32 9Z"
            fill="url(#glintCenter)"
            filter="drop-shadow(0 0 3px #FFFFFF)"
          />
          <circle cx="32" cy="13.5" r="1.5" fill="#FFFFFF" />

          {/* Small Star on Base */}
          <circle cx="24" cy="42.8" r="1" fill="#FFD700" />
        </svg>
      </div>

      {/* Brand Razor-Sharp Typography */}
      <div className={`${compactOnMobile ? 'hidden sm:flex' : 'flex'} flex-col leading-none min-w-0`}>
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-wider text-white uppercase ${textSizes[size]} drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-['Montserrat',sans-serif]`}>
            PRIME
          </span>
          <span className={`font-black tracking-wider bg-gradient-to-r from-[#FFF9C4] via-[#FFD700] to-[#FFA000] bg-clip-text text-transparent uppercase ${textSizes[size]} drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] font-['Montserrat',sans-serif]`}>
            DREEMS
          </span>
        </div>
        <div className={`${compactOnMobile ? 'hidden md:flex' : 'flex'} items-center gap-1.5 mt-1`}>
          <span className="w-2 h-2 rounded-full bg-[#FF1744] shadow-[0_0_8px_#FF1744] animate-pulse" />
          <span className="text-[10px] font-black tracking-widest text-[#FF1744] uppercase drop-shadow-[0_0_6px_rgba(255,23,68,0.5)]">
            Cricket Fantasy Colosseum
          </span>
        </div>
      </div>
    </div>
  );
}
