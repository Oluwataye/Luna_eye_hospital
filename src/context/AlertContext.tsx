import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

export interface Alert {
  id: number;
  message: string;
  module: string;
  is_read: number;
  created_at: string;
}

interface AlertContextType {
  alerts: Alert[];
  sseConnected: boolean;
  unreadCount: number;
  markRead: (id: number) => Promise<void>;
  deleteAlert: (id: number) => Promise<void>;
  clearAllAlerts: () => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sseConnected, setSseConnected] = useState(true);

  useEffect(() => {
    if (!user?.role) {
      setAlerts([]);
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(`/api/notifications/stream?role=${encodeURIComponent(user.role)}`, {
        withCredentials: true
      });

      eventSource.onopen = () => {
        setSseConnected(true);
        // Sync missed notifications during connection outage
        api.getNotifications(user.role)
          .then(data => setAlerts(data))
          .catch(() => {});
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAlerts(data);
        } catch (err) {
          console.error("Error parsing SSE data", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error, auto-reconnecting...", err);
        setSseConnected(false);
        if (eventSource) {
          eventSource.close();
        }
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [user?.role]);

  const markRead = async (id: number) => {
    try {
      await api.markNotificationAsRead(id);
      setAlerts(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) {
      console.error("Failed to mark alert as read", error);
    }
  };

  const deleteAlert = async (id: number) => {
    try {
      await api.deleteNotification(id);
      setAlerts(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Failed to delete alert", error);
    }
  };

  const clearAllAlerts = async () => {
    if (!user?.role) return;
    try {
      await api.clearNotifications(user.role);
      setAlerts([]);
    } catch (error) {
      console.error("Failed to clear alerts", error);
    }
  };

  const unreadCount = alerts.filter(n => !n.is_read).length;

  return (
    <AlertContext.Provider value={{ alerts, sseConnected, unreadCount, markRead, deleteAlert, clearAllAlerts }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
