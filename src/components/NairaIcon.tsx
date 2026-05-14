import React from 'react';

export const NairaIcon: React.FC<{ size?: number, className?: string }> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M6 3v18" />
    <path d="M18 3v18" />
    <path d="M6 10h12" />
    <path d="M6 14h12" />
    <path d="M6 3l12 18" />
  </svg>
);
