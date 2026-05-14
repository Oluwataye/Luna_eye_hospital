import React from 'react';
import { useLocation } from 'react-router-dom';

export const Footer: React.FC = () => {
  const location = useLocation();
  const isBilling = location.pathname.includes('/billing');
  const buildDate = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '07/05/2026 14:52';
  
  return (
    <footer className={`app-footer mt-auto ${isBilling ? 'py-4' : 'py-6'} border-t border-slate-200`}>
      <div className="flex justify-between items-center w-full px-6">
        {isBilling ? (
          <>
            <p className="text-[13px] text-[#64748b]">© 2026 Luna Eye Hospital • VisionCare EMR</p>
            <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.05em]">
              VERSION 2.2.0 • BUILD: {buildDate}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} T-Tech Solutions • VisionCare EMR</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Version 2.2.0 • Build: {buildDate}
            </p>
          </>
        )}
      </div>
    </footer>
  );
};
