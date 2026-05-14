import React, { useState, useEffect } from 'react';
import { X, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const GreetingBanner: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [message, setMessage] = useState('');

  const motivationalMessages = [
    "You have a significant impact on patient lives today. Have a great shift.",
    "Accuracy in documentation is the foundation of patient safety.",
    "Compassion is the heart of clinical excellence. Let's make a difference.",
    "Every patient interaction is an opportunity for healing.",
    "Stay focused, stay precise, and provide the best care possible."
  ];

  useEffect(() => {
    // Check if banner was closed this session
    const isClosed = sessionStorage.getItem('greeting-banner-closed');
    if (!isClosed && user) {
      const hour = new Date().getHours();
      let text = '';
      
      if (hour >= 5 && hour < 12) text = 'Good morning';
      else if (hour >= 12 && hour < 17) text = 'Good afternoon';
      else text = 'Good evening';
      
      setGreeting(text);
      
      // Select a message based on the day
      const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      setMessage(motivationalMessages[dayOfYear % motivationalMessages.length]);
      
      setIsVisible(true);
    }
  }, [user]);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('greeting-banner-closed', 'true');
  };

  if (!isVisible || !user) return null;

  return (
    <div className="greeting-banner animate-slide-up">
      <div className="flex items-center gap-6">
        <div className="hidden md:flex w-14 h-14 rounded-2xl bg-white items-center justify-center text-primary shadow-sm border border-slate-100">
          <Activity size={28} />
        </div>
        <div>
          <h2 className="greeting-banner-title font-black tracking-tight">
            {greeting}, <span className="text-primary">{user.full_name || user.username}</span>
            <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-1 rounded-md ml-3 uppercase tracking-widest">{user.role}</span>
          </h2>
          <p className="greeting-banner-subtitle text-sm font-medium opacity-80">{message}</p>
        </div>
      </div>
      <button 
        className="greeting-banner-close" 
        onClick={handleClose}
        aria-label="Close greeting"
      >
        <X size={18} />
      </button>
    </div>
  );
};
