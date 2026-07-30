import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

import logo from '../../../../resources/logo.png';

export default function MarkbelLogo({ className = '', size = 48 }: LogoProps) {
  return (
    <img 
      src={logo} 
      alt="Markbel Logo" 
      width={size} 
      height={size} 
      className={`${className} object-contain rounded-xl`}
    />
  );
}
