import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function MarkbelLogo({ className = '', size = 48 }: LogoProps) {
  return (
    <img 
      src="/logo.png" 
      alt="Markbel Logo" 
      width={size} 
      height={size} 
      className={`${className} object-contain rounded-xl`}
    />
  );
}
