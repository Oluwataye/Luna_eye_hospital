import React, { useLayoutEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Package, Receipt, ClipboardCheck, UserPlus, Clock, CheckCircle2, X } from 'lucide-react';

interface Notification {
  id: number;
  message: string;
  module: string;
  is_read: number;
  created_at: string;
}

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
  onClearAll: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  notifications, 
  onMarkRead, 
  onDelete,
  onClearAll,
  onClose,
  anchorRef
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (anchorRef.current && panelRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      let left = anchorRect.right - panelRect.width;
      if (left < 10) left = 10;
      if (left + panelRect.width > viewportWidth - 10) {
        left = viewportWidth - panelRect.width - 10;
      }

      setCoords({
        top: anchorRect.bottom + 12,
        left
      });
    }
  }, [anchorRef, notifications.length]);

  const getIcon = (module: string) => {
    switch (module) {
      case 'Inventory': return <Package size={16} style={{ color: '#f59e0b' }} />;
      case 'Billing': return <Receipt size={16} style={{ color: '#10b981' }} />;
      case 'Results': return <ClipboardCheck size={16} style={{ color: 'var(--leh-primary)' }} />;
      case 'Patients': return <UserPlus size={16} style={{ color: '#0ea5e9' }} />;
      default: return <Bell size={16} style={{ color: '#94a3b8' }} />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return createPortal(
    <div 
      ref={panelRef}
      className="leh-notification-panel"
      style={{
        position: 'fixed',
        width: '360px',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        border: '1px solid var(--leh-border-light)',
        overflow: 'hidden',
        zIndex: 10000,
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        animation: 'leh-dropdown-slide 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div style={{ padding: '20px 24px', background: 'var(--leh-bg-light)', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0 }}>Clinical Alerts</h3>
          {unreadCount > 0 && (
            <span style={{ background: 'var(--leh-primary)', color: 'white', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '99px' }}>
              {unreadCount} NEW
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {notifications.length > 0 && (
            <button 
              onClick={onClearAll} 
              style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: '800', color: '#ef4444', cursor: 'pointer' }}
            >
              CLEAR ALL
            </button>
          )}
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: '800', color: 'var(--leh-text-muted)', cursor: 'pointer' }}
          >
            CLOSE
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: 'var(--leh-bg-light)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-border)' }}>
              <Bell size={28} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--leh-text-muted)', fontWeight: '700', margin: 0 }}>No active notifications</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => !n.is_read && onMarkRead(n.id)}
                style={{ 
                   padding: '20px 24px', 
                   borderBottom: '1px solid var(--leh-border-light)', 
                   display: 'flex', 
                   gap: '16px', 
                   cursor: 'pointer',
                   background: n.is_read ? 'white' : 'rgba(37, 99, 235, 0.02)',
                   transition: 'background 0.2s ease'
                }}
              >
                <div style={{ 
                   marginTop: '2px',
                   width: '36px', 
                   height: '36px', 
                   borderRadius: '10px', 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center', 
                   background: n.is_read ? 'var(--leh-bg-light)' : 'white',
                   boxShadow: n.is_read ? 'none' : '0 4px 8px rgba(0,0,0,0.05)',
                   flexShrink: 0
                }}>
                  {getIcon(n.module)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                  <p style={{ 
                     fontSize: '13px', 
                     lineHeight: '1.4', 
                     margin: 0,
                     fontWeight: n.is_read ? '600' : '800',
                     color: n.is_read ? 'var(--leh-text-muted)' : 'var(--leh-text-dark)'
                  }}>
                    {n.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: '800', color: 'var(--leh-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> {formatTime(n.created_at)}</span>
                    <span>•</span>
                    <span style={{ color: 'var(--leh-primary)' }}>{n.module}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', alignSelf: 'center', flexShrink: 0 }}>
                  {!n.is_read && (
                    <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(n.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--leh-text-light)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      transition: 'background 0.2s, color 0.2s'
                    }}
                    title="Delete notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ padding: '16px', background: 'var(--leh-bg-light)', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', fontWeight: '900', color: 'var(--leh-text-light)', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>
            System Audit Log Protocol Active
          </p>
        </div>
      )}
    </div>,
    document.body
  );
};
