import React, { useState, useRef, useEffect } from 'react';
import { Bell, UserCircle, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { NotificationPanel } from './NotificationPanel';
import { LiveSearch } from './LiveSearch';
import './Topbar.css';

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchPatients = async () => {
    try {
      const data = await api.getPatients();
      setPatients(data);
    } catch (error) {}
  };

  const fetchNotifications = async () => {
    if (!user?.role) return;
    try {
      const data = await api.getNotifications(user.role);
      setNotifications(data);
    } catch (error) {}
  };

  useEffect(() => {
    fetchNotifications();
    fetchPatients();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Notification Panel handling
      const notificationPanel = document.querySelector('.notification-panel-portal');
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node) &&
          (!notificationPanel || !notificationPanel.contains(event.target as Node))) {
        setShowNotifications(false);
      }
      // Profile Menu handling
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="leh-topbar">
      <div className="leh-topbar-left">
        {/* Branding removed per user request */}
        
        <div style={{ marginLeft: 0, flex: 1, maxWidth: '400px' }}>
          <LiveSearch 
            placeholder="Search clinical database by Identity, File No or Phone..." 
            data={patients}
            searchFields={['full_name', 'id', 'phone']}
            onSelect={(patient) => navigate(`/patients?view=profile&id=${patient.id}`)}
            renderItem={(p) => (
              <div className="leh-search-result-item">
                <div className="leh-result-avatar">
                  {p.full_name.charAt(0)}
                </div>
                <div className="leh-result-info">
                  <div className="leh-result-name">{p.full_name}</div>
                  <div className="leh-result-meta">#{p.id} • {p.phone}</div>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <div className="leh-topbar-right">
        <div className="leh-notification-wrapper" ref={notificationRef}>
          <button 
            className={`leh-notification-trigger ${unreadCount > 0 ? 'pulse-bell' : ''}`}
            onClick={() => setShowNotifications(!showNotifications)}
            data-tooltip={unreadCount > 0 ? `You have ${unreadCount} new notifications` : "No new notifications"}
            data-tooltip-pos="bottom"
          >
            <Bell size={20} strokeWidth={2.5} />
            {unreadCount > 0 && <span className="leh-notification-dot"></span>}
          </button>
          
          {showNotifications && (
            <NotificationPanel 
              notifications={notifications} 
              onMarkRead={handleMarkRead}
              onClose={() => setShowNotifications(false)}
              anchorRef={notificationRef}
            />
          )}
        </div>

        <div className="leh-topbar-divider"></div>

        {/* User Profile Component */}
        <div className="leh-user-profile-wrapper" ref={profileRef}>
          <button 
            className="leh-profile-trigger"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            data-tooltip="Open User Profile"
            data-tooltip-pos="bottom"
          >
            <div className="leh-profile-info">
              <span className="leh-profile-name">{user?.full_name || 'System User'}</span>
              <span className="leh-profile-role">{user?.role || 'Guest'}</span>
            </div>
            <div className="leh-profile-avatar">
              <UserCircle size={28} strokeWidth={1.5} />
            </div>
          </button>

          {showProfileMenu && (
            <div className="leh-profile-dropdown">
              <div className="leh-dropdown-header">
                 <ShieldCheck size={14} style={{ color: 'var(--leh-primary)' }} />
                 <span>AUTHENTICATED SESSION</span>
              </div>
              <button className="leh-dropdown-item" onClick={() => navigate('/settings')}>
                <Settings size={16} />
                <span>Account Settings</span>
              </button>
              <div className="leh-dropdown-divider"></div>
              <button className="leh-dropdown-item logout" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
