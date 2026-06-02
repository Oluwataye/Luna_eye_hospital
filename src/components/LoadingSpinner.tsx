import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  mode?: 'fullscreen' | 'inline' | 'button';
  label?: string;
  color?: string; // Optional custom color override for SVG parts
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  mode = 'inline',
  label,
  color
}) => {
  const sizeMap = {
    small: 18,
    medium: 44,
    large: 76
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className={`leh-spinner-container ${size} ${mode}`}>
      <div className="leh-spinner-graphic" style={{ width: currentSize, height: currentSize }}>
        <svg viewBox="0 0 50 50" className="leh-spinner-svg">
          {/* Outer Ring */}
          <circle 
            className="leh-spinner-outer" 
            cx="25" 
            cy="25" 
            r="20" 
            fill="none" 
            stroke="var(--leh-primary-light)" 
            strokeWidth="3.5" 
          />
          {/* Active Orbit Circle */}
          <circle 
            className="leh-spinner-inner" 
            cx="25" 
            cy="25" 
            r="20" 
            fill="none" 
            stroke={color || "var(--leh-primary)"} 
            strokeWidth="3.5" 
            strokeLinecap="round"
            strokeDasharray="90 150"
          />
          {/* Central Iris Core (Eye-EMR design branding) */}
          <circle 
            className="leh-spinner-core" 
            cx="25" 
            cy="25" 
            r="8" 
            fill={color || "var(--leh-primary)"} 
            opacity="0.8"
          />
          {/* Pupil Light Reflection Highlight */}
          <circle 
            cx="22" 
            cy="22" 
            r="2.5" 
            fill="white" 
          />
        </svg>
      </div>
      {label && <p className="leh-spinner-label">{label}</p>}
    </div>
  );

  if (mode === 'fullscreen') {
    return (
      <div className="leh-spinner-overlay">
        {content}
      </div>
    );
  }

  return content;
};
