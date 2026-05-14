import './NotificationContext.css';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, ShieldAlert } from 'lucide-react';
import './NotificationContext.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
  duration: number; // ms
}

interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'primary';
}

interface NotificationContextType {
  notify: (type: NotificationType, message: string, duration?: number) => void;
  confirm: (options: ConfirmOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 5000;

// ─── Single Toast Component ───────────────────────────────────────────────────

const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const dismiss = useCallback(() => {
    setTimeout(() => onClose(toast.id), 320);
  }, [onClose, toast.id]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        dismiss();
      }
    }, 30);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [toast.duration, dismiss]);

  const config = {
    success: {
      border: '#22c55e',
      bg: '#f0fdf4',
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      title: 'Success',
      titleColor: '#15803d',
      bar: '#22c55e',
      Icon: CheckCircle2,
    },
    error: {
      border: '#ef4444',
      bg: '#fef2f2',
      iconBg: '#fee2e2',
      iconColor: '#dc2626',
      title: 'Error',
      titleColor: '#b91c1c',
      bar: '#ef4444',
      Icon: XCircle,
    },
    warning: {
      border: '#f59e0b',
      bg: '#fffbeb',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      title: 'Warning',
      titleColor: '#b45309',
      bar: '#f59e0b',
      Icon: AlertTriangle,
    },
    info: {
      border: '#3b82f6',
      bg: '#eff6ff',
      iconBg: '#dbeafe',
      iconColor: '#2563eb',
      title: 'Info',
      titleColor: '#1d4ed8',
      bar: '#3b82f6',
      Icon: Info,
    },
  }[toast.type];

  const { Icon } = config;

  return (
    <div
      className={`luna-toast ${toast.type} luna-toast--enter`}
      style={{ borderLeft: `4px solid ${config.border}`, background: config.bg }}
      role="alert"
      aria-live="polite"
    >
      <div className="luna-toast__icon" style={{ background: config.iconBg, color: config.iconColor }}>
        <Icon size={20} strokeWidth={2.2} />
      </div>

      <div className="luna-toast__content">
        <div className="luna-toast__title" style={{ color: config.titleColor }}>
          {config.title}
        </div>
        <div className="luna-toast__message">{toast.message}</div>
      </div>

      <button className="luna-toast__close" onClick={dismiss} aria-label="Dismiss notification">
        <X size={15} />
      </button>

      <div className="luna-toast__progress-track">
        <div
          className="luna-toast__progress-bar"
          style={{
            width: `${progress}%`,
            background: config.bar
          }}
        />
      </div>
    </div>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);

  const notify = useCallback(
    (type: NotificationType, message: string, duration: number = DEFAULT_DURATION) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: Toast = { id, type, message, createdAt: Date.now(), duration };

      setToasts((prev) => {
        const updated = [newToast, ...prev];
        return updated.slice(0, MAX_TOASTS);
      });
    },
    []
  );

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmOptions(options);
  }, []);

  const handleConfirm = () => {
    if (confirmOptions) {
      confirmOptions.onConfirm();
      setConfirmOptions(null);
    }
  };

  const handleCancel = () => {
    if (confirmOptions?.onCancel) confirmOptions.onCancel();
    setConfirmOptions(null);
  };

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}

      {/* ── Toast Container ── */}
      <div className="luna-toast-container" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={closeToast} />
        ))}
      </div>

      {/* ── Confirm Dialog ── */}
      {confirmOptions && (
        <div
          className="leh-modal-overlay"
          style={{ zIndex: 10001 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div className="leh-modal-content" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="leh-modal-body" style={{ padding: '48px 32px 32px' }}>
              <div
                className={`flex items-center justify-center mb-6`}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '24px',
                  margin: '0 auto 24px',
                  background: confirmOptions.type === 'danger' ? '#fef2f2' : confirmOptions.type === 'warning' ? '#fffbeb' : 'var(--leh-primary-light)',
                  color: confirmOptions.type === 'danger' ? '#ef4444' : confirmOptions.type === 'warning' ? '#f59e0b' : 'var(--leh-primary)'
                }}
              >
                {confirmOptions.type === 'danger' ? <ShieldAlert size={40} /> : confirmOptions.type === 'warning' ? <AlertTriangle size={40} /> : <CheckCircle2 size={40} />}
              </div>
              
              <h2 className="leh-modal-title" style={{ marginBottom: '12px', fontSize: '20px', display: 'block' }}>{confirmOptions.title}</h2>
              <p className="leh-label" style={{ fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{confirmOptions.message}</p>
            </div>
            
            <div className="leh-modal-footer" style={{ padding: '0 32px 32px', border: 'none', justifyContent: 'center', gap: '12px' }}>
              <button 
                type="button" 
                className="leh-btn-outline" 
                style={{ flex: 1, height: '48px' }}
                onClick={handleCancel}
              >
                {confirmOptions.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                className="leh-btn-primary"
                style={{ 
                  flex: 1, 
                  height: '48px',
                  background: confirmOptions.type === 'danger' ? '#ef4444' : confirmOptions.type === 'warning' ? '#f59e0b' : ''
                }}
                onClick={handleConfirm}
              >
                {confirmOptions.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
