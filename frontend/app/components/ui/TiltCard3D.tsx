'use client';

import React from 'react';

export default function TiltCard3D({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  intensity?: number;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`prime-card p-4 transition-all duration-150 ${className}`}
    >
      {children}
    </div>
  );
}
