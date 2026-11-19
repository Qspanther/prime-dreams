'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
  className?: string;
  onRefresh?: () => Promise<void> | void;
}

export default function PullToRefresh({
  children,
  className = '',
  onRefresh,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef<{ y: number; x: number; active: boolean; isHorizontal: boolean | null }>({
    y: 0,
    x: 0,
    active: false,
    isHorizontal: null,
  });

  const THRESHOLD = 65;
  const MAX_PULL = 85;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPullY(50);
    try {
      if (onRefresh) {
        await onRefresh();
        setTimeout(() => {
          setIsRefreshing(false);
          setPullY(0);
        }, 400);
      } else {
        // Smooth timeout then full page reload
        setTimeout(() => {
          window.location.reload();
        }, 200);
      }
    } catch {
      window.location.reload();
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isRefreshing) return;

      // Don't trigger if touching inside modals, overlays, or inputs
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [role="dialog"], [data-modal]')) {
        return;
      }

      // Only activate when at the very top of the scroll container
      if (el.scrollTop <= 1) {
        touchStartRef.current = {
          y: e.touches[0].clientY,
          x: e.touches[0].clientX,
          active: true,
          isHorizontal: null,
        };
      } else {
        touchStartRef.current.active = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current.active || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartRef.current.y;
      const deltaX = currentX - touchStartRef.current.x;

      // Check if this is a horizontal gesture (e.g. swiping tabs or carousels)
      if (touchStartRef.current.isHorizontal === null) {
        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
          touchStartRef.current.isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      if (touchStartRef.current.isHorizontal) {
        touchStartRef.current.active = false;
        setPullY(0);
        return;
      }

      // Only pull down if scrollTop <= 1 and gesture is downwards
      if (el.scrollTop <= 1 && deltaY > 0) {
        if (e.cancelable && deltaY > 8) {
          e.preventDefault();
        }
        // Damped pull distance
        const pull = Math.min(Math.pow(deltaY, 0.82) * 1.6, MAX_PULL);
        setPullY(pull);
      } else {
        setPullY(0);
      }
    };

    const onTouchEnd = () => {
      if (!touchStartRef.current.active || isRefreshing) return;
      touchStartRef.current.active = false;

      if (pullY >= THRESHOLD) {
        handleRefresh();
      } else {
        setPullY(0);
      }
    };

    const onTouchCancel = () => {
      touchStartRef.current.active = false;
      if (!isRefreshing) setPullY(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [pullY, isRefreshing]);

  return (
    <main
      ref={containerRef}
      className={`relative ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Chrome/Native Style Pull-to-Refresh Pill Indicator */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-2 z-50 flex items-center justify-center transition-all duration-150"
        style={{
          transform: `translateY(${isRefreshing ? 6 : Math.max(pullY - 48, -48)}px)`,
          opacity: pullY > 12 || isRefreshing ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 shadow-[0_6px_20px_rgba(37,99,235,0.28)] border-2 border-[#2563EB] backdrop-blur-md">
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#2563EB] ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${pullY * 4.5}deg)`,
              transition: isRefreshing ? undefined : 'transform 0.08s linear',
            }}
          />
          <span className="text-[10px] font-black tracking-wide text-[#1E3A8A]">
            {isRefreshing
              ? 'Refreshing...'
              : pullY >= THRESHOLD
              ? 'Release to refresh'
              : 'Pull down to refresh'}
          </span>
        </div>
      </div>

      {/* Content wrapper with smooth subtle bounce */}
      <div
        style={{
          transform: pullY > 0 ? `translateY(${Math.min(pullY * 0.4, 28)}px)` : undefined,
          transition: pullY === 0 ? 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined,
        }}
      >
        {children}
      </div>
    </main>
  );
}
