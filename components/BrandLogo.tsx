'use client';

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export function BrandLogo({ size = 'md', showText = true, className = '' }: BrandLogoProps) {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-sm', badge: 'text-[9px] px-1 py-0.2' },
    md: { icon: 'w-8 h-8', text: 'text-base', badge: 'text-[10px] px-1.5 py-0.5' },
    lg: { icon: 'w-10 h-10', text: 'text-xl', badge: 'text-xs px-2 py-0.5' },
    xl: { icon: 'w-14 h-14', text: 'text-3xl', badge: 'text-sm px-2.5 py-1' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Straight-Edge Kinetic Monogram Icon */}
      <div
        className={`${currentSize.icon} bg-zinc-950 text-white flex items-center justify-center border-2 border-zinc-900 rounded-none relative overflow-hidden flex-shrink-0 shadow-sm transition-transform hover:scale-105 active:scale-95`}
      >
        {/* Geometric High-Energy Kinetic SVG Mark */}
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1"
        >
          {/* Vertical Pillar */}
          <rect x="7" y="6" width="5.5" height="24" fill="#FFFFFF" />
          
          {/* Upper Kinetic Chevron */}
          <polygon
            points="14,18 25,7 29,7 18,18"
            fill="#2563EB"
          />
          
          {/* Lower Kinetic Chevron */}
          <polygon
            points="18,18 29,29 25,29 14,18"
            fill="#60A5FA"
          />
          
          {/* Energy Core Accent Dot */}
          <rect x="14" y="15.5" width="5" height="5" fill="#F59E0B" />
        </svg>
      </div>

      {/* Brand Typographic Logotype */}
      {showText && (
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-black tracking-tight text-zinc-950 uppercase ${currentSize.text}`}>
            KINETIC
          </span>
          <span
            className={`font-mono font-bold bg-blue-600 text-white uppercase rounded-none border border-blue-900 tracking-wider ${currentSize.badge}`}
          >
            AI
          </span>
        </div>
      )}
    </div>
  );
}
