import React from 'react';
import { useLocation } from 'react-router-dom';

export const Footer: React.FC = () => {
  const location = useLocation();
  const isBilling = location.pathname.includes('/billing');
  
  return (
    <footer className={`app-footer mt-auto ${isBilling ? 'py-4' : 'py-6'} border-t border-slate-200`}>
      <div className="flex items-center justify-center w-full px-4 text-center">
        <p className="text-xs text-slate-400 font-medium">All Rights Reserved © 2026 T-Tech Solutions</p>
      </div>
    </footer>
  );
};
