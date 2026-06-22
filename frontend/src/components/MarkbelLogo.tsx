import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function MarkbelLogo({ className = '', size = 48 }: LogoProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      className={className}
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="squircle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#222b3b" />
          <stop offset="100%" stopColor="#121822" />
        </linearGradient>
        <linearGradient id="cyber-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>

        {/* Neon Glow Filter */}
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Squircle Background Container */}
      <rect 
        x="8" 
        y="8" 
        width="84" 
        height="84" 
        rx="22" 
        fill="url(#squircle-grad)" 
        stroke="#2c374b" 
        strokeWidth="1.8"
      />

      {/* 2. Hanging Bookmark Ribbon */}
      <path 
        d="M 35,8 L 65,8 L 65,46 C 65,52 60,53 50,43 C 40,53 35,52 35,46 Z" 
        fill="url(#cyber-logo-grad)" 
        filter="url(#neon-glow)"
      />

      {/* 3. Bottom Rounded Pill Bar */}
      <rect 
        x="26" 
        y="70" 
        width="48" 
        height="6.5" 
        rx="3.25" 
        fill="url(#cyber-logo-grad)" 
        filter="url(#neon-glow)"
      />
    </svg>
  );
}







