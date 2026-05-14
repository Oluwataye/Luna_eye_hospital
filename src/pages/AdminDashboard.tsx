import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, AlertTriangle, ArrowRight, Package, 
  BarChart3, Users, Receipt, Printer, Settings as SettingsIcon,
  Activity, RefreshCw, Clock, ArrowUpRight, ShieldAlert,
  Wallet, LayoutDashboard, ChevronRight, LineChart, Search,
  History, Shield, CheckCircle, ShoppingBag, Key, Database,
  UserCheck, AlertCircle, Zap, ClipboardList,
  ShieldCheck, UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatCard } from '../components/StatCard';
import { GreetingBanner } from '../components/GreetingBanner';
import { useNotification } from '../context/NotificationContext';
import { NairaIcon } from '../components/NairaIcon';
import { formatDateStandard } from '../utils/date';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    patientsToday: 0,
    admittedCount: 0,
    pendingPayments: 0,
    lowStock: 0,
    expiringSoon: 0,
    salesToday: 0,
    backupStatus: 'System Healthy',
    recentLogs: [] as any[],
    activeUsers: 0
  });

  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const [queue, admissions, payments, inventory, sales, backups, logs, users] = await Promise.all([
        api.getQueue(),
        api.getAdmissions('Active'),
        api.getAwaitingPaymentQueue(),
        api.getInventory(),
        api.getSalesSummary(),
        api.getBackups(),
        api.getAuditLogs({}),
        api.getUsers()
      ]);

      // Calculate stock alerts
      const lowStockItems = inventory.filter((i: any) => i.quantity <= i.min_stock_level);
      const expiringItems = inventory.filter((i: any) => {
        if (!i.expiry_date) return false;
        const days = (new Date(i.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
        return days > 0 && days <= 30;
      });

      // Check backup freshness
      const lastBackup = backups[0];
      const isBackupOk = lastBackup ? (new Date().getTime() - new Date(lastBackup.created_at).getTime()) < 86400000 : false;

      setMetrics({
        patientsToday: queue.total_today || 0,
        admittedCount: admissions.length,
        pendingPayments: payments.length,
        lowStock: lowStockItems.length,
        expiringSoon: expiringItems.length,
        salesToday: sales.total_sales_today || 0,
        backupStatus: isBackupOk ? 'HEALTHY' : 'PENDING',
        recentLogs: (logs || []).slice(0, 6),
        activeUsers: (users || []).length
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      notify('error', 'Critical telemetry synchronization failure');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="leh-page-container">
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box">
            <Shield size={24} color="var(--leh-primary)" />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Executive Command Center</h1>
            <p className="leh-page-subtitle">Luna Eye Hospital • Administrative Oversight & Strategic Control</p>
          </div>
        </div>
        
        <div className="leh-header-actions">
          <div className="leh-telemetry-pill">
            <div className="sync-dot"></div>
            <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--leh-primary)' }}>LIVE STATUS • {lastUpdated}</span>
            <button onClick={fetchDashboardData} className="leh-refresh-btn" disabled={isRefreshing}>
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <button className="leh-btn-primary" onClick={() => navigate('/admin/reprint-management')} style={{ background: 'var(--leh-text-dark)' }}>
            <History size={18} />
            <span>AUDIT LOGS</span>
          </button>
        </div>
      </header>

      <div className="leh-content-area">
        <GreetingBanner />

        {/* TOP ROW: CORE PERFORMANCE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
          <StatCard title="TOTAL PATIENTS" value={metrics.patientsToday} icon={Users} colorClass="blue" path="/patients" subtitle="Today's registered" />
          <StatCard title="ADMITTED" value={metrics.admittedCount} icon={ClipboardList} colorClass="amber" path="/admissions" subtitle="Currently in ward" />
          <StatCard title="PENDING BILLS" value={metrics.pendingPayments} icon={NairaIcon} colorClass="red" path="/billing" subtitle="Revenue awaiting clearing" />
          <StatCard title="LOW STOCK" value={metrics.lowStock} icon={ShieldAlert} colorClass="amber" path="/inventory" subtitle="Items below threshold" />
          <StatCard title="EXPIRING SOON" value={metrics.expiringSoon} icon={AlertTriangle} colorClass="red" path="/inventory" subtitle="Inventory expiring < 30d" />
          <StatCard title="TOTAL SALES" value={`₦${metrics.salesToday.toLocaleString()}`} icon={NairaIcon} colorClass="green" path="/reports" subtitle="Gross revenue today" />
          <StatCard title="BACKUP STATUS" value={metrics.backupStatus} icon={Database} colorClass={metrics.backupStatus === 'HEALTHY' ? 'green' : 'amber'} path="/settings" subtitle="Last sync: 24h ago" />
          <StatCard title="SYSTEM LOGS" value="OPERATIONAL" icon={ShieldCheck} colorClass="blue" path="/audit-logs" subtitle="Audit trail active" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <section className="leh-table-card">
              <div className="leh-table-header" style={{ borderBottom: '1px solid var(--leh-border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ShieldCheck size={24} color="var(--leh-primary)" />
                  <h2 className="leh-table-title" style={{ margin: 0 }}>Executive Command Center</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="leh-btn-primary" onClick={() => navigate('/audit-logs')} style={{ background: 'var(--leh-text-dark)' }}>
                    <History size={18} />
                    <span>AUDIT LOGS</span>
                  </button>
                  <button className="leh-btn-primary" onClick={() => navigate('/users')}>
                    <UserPlus size={18} />
                    <span>MANAGE USERS</span>
                  </button>
                </div>
              </div>
              <div className="leh-table-wrapper" style={{ border: 'none' }}>
                 <table className="leh-table">
                    <thead>
                       <tr>
                          <th style={{ paddingLeft: '24px' }}>OPERATOR</th>
                          <th>ACTION</th>
                          <th style={{ textAlign: 'right', paddingRight: '24px' }}>TIME</th>
                       </tr>
                    </thead>
                    <tbody>
                       {metrics.recentLogs.map((log, i) => (
                          <tr key={i} className="leh-table-row">
                             <td style={{ paddingLeft: '24px' }} className="leh-table-bold">{log.user_name}</td>
                             <td style={{ fontSize: '13px' }}>{log.action}</td>
                             <td style={{ textAlign: 'right', paddingRight: '24px', fontSize: '12px', color: 'var(--leh-text-muted)' }}>
                                {formatDateStandard(log.created_at)} • {new Date(log.created_at).toLocaleTimeString()}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </section>
          </div>
          <div className="lg:col-span-4">
              <div style={{ 
                background: 'linear-gradient(135deg, var(--leh-primary) 0%, var(--leh-primary-dark) 100%)',
                padding: '24px',
                borderRadius: '20px',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 20px 40px rgba(37, 99, 235, 0.2)'
              }}>
                 <Zap size={24} />
                 <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>System Guard</h3>
                    <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0 0' }}>All clinical operations are encrypted and audited in real-time.</p>
                 </div>
                 <button className="leh-btn-primary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>SYSTEM HEALTH</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
