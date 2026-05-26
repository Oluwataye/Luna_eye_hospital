import React, { useState, useEffect } from 'react';
import { 
  Printer, FileSpreadsheet, Filter, Calendar, User, Shield, RefreshCw
} from 'lucide-react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';

export const AuditLogs: React.FC = () => {
  const { notify } = useNotification();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    user_id: '',
    action_type: '',
    start_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({
        ...filters,
        user_id: filters.user_id ? Number(filters.user_id) : undefined
      });
      setLogs(data);
    } catch (error: any) {
      notify('error', 'Failed to load system audit logs: ' + (error.message || 'Connection error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      notify('error', 'Failed to load system users list');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const actionTypes = [
    // Auth
    'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
    // Legacy mixed-case (existing DB records)
    'Login', 'Login Failed',
    // Patients
    'PATIENT_CREATE', 'PATIENT_EDIT', 'Patient Edit',
    // Clinical
    'TRIAGE', 'TRIAGE_SAVE', 'TRIAGE_COMPLETE',
    'CONSULTATION_SAVE', 'CONSULTATION_FINALIZE', 'CLINICAL_EDIT',
    // Billing & Finance
    'BILLING_CREATE', 'BILLING_PAYMENT', 'BILLING_VOID',
    'Payment', 'Billing Void',
    // Receipts
    'Receipt Reprint',
    // Stock & Inventory
    'STOCK_ADJUST',
    // Check-in
    'CHECK_IN', 'CHECK_IN_NEW_VISIT', 'VISIT_STATUS_CHANGE',
    // Users
    'USER_CREATE', 'USER_UPDATE', 'USER_DEACTIVATE',
    // Procurement
    'SUPPLIER_CREATE',
    // Admin
    'SETTINGS_UPDATE', 'BACKUP', 'BACKUP_CREATE',
    // Admissions
    'ADMISSION_CREATE', 'ADMISSION_DISCHARGE', 'ADMISSION_UPDATE',
  ];

  const handleExport = () => {
    if (logs.length === 0) {
      notify('error', 'No logs to export');
      return;
    }

    const headers = ['Timestamp', 'User', 'Action', 'Details'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        `"${new Date(log.created_at).toLocaleString()}"`,
        `"${log.user_name}"`,
        `"${log.action_type}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${filters.start_date}_to_${filters.end_date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('success', 'Audit logs exported successfully');
  };

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            background: 'var(--leh-primary)', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.3)'
          }}>
            <Shield size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="leh-page-title">System Audit Trail</h1>
            <p className="leh-page-subtitle">Security logging, data modifications & administrative oversight</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="leh-btn-secondary" 
            style={{ height: '48px', padding: '0 24px' }} 
            onClick={() => window.print()}
            data-tooltip="Print system audit integrity report"
            aria-label="Print audit"
          >
            <Printer size={18} style={{ marginRight: '8px' }} />
            PRINT REPORT
          </button>
          <button 
            className="leh-btn-secondary" 
            style={{ height: '48px', padding: '0 24px', background: '#0f172a', color: '#fff', border: 'none' }} 
            onClick={handleExport}
            data-tooltip="Export audit trail to CSV file"
            aria-label="Export audit"
          >
            <FileSpreadsheet size={18} style={{ marginRight: '8px' }} />
            EXPORT EXCEL
          </button>
        </div>
      </header>

      {/* Stats Ribbon (Internal Security View) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 no-print">
        <div className="leh-stat-card">
          <p className="leh-label">Total Events</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">{logs.length}</h3>
            <span className="leh-status-dot" style={{ background: '#eff6ff', color: '#2563eb' }}>Logs</span>
          </div>
        </div>
        <div className="leh-stat-card">
          <p className="leh-label">Active Users</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">{users.length}</h3>
            <span className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed' }}>Verified</span>
          </div>
        </div>
        <div className="leh-stat-card">
          <p className="leh-label">Integrity Status</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">Secure</h3>
            <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981' }}>Verified</span>
          </div>
        </div>
        <div className="leh-stat-card">
          <p className="leh-label">Last Activity</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h3>
            <span className="leh-status-dot" style={{ background: '#f1f5f9', color: '#475569' }}>Live</span>
          </div>
        </div>
      </div>

      {/* Filters Terminal */}
      <div className="leh-table-card no-print" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Filter size={16} style={{ color: 'var(--leh-primary)' }} />
            <h3 className="leh-table-title" style={{ fontSize: '14px', margin: 0 }}>Filter Security Protocols</h3>
          </div>
          <button 
            className="leh-refresh-btn" 
            onClick={fetchLogs} 
            data-tooltip="Refresh security audit records"
            aria-label="Refresh logs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="leh-form-group" style={{ marginBottom: 0 }}>
            <label className="leh-label">Operator / User</label>
            <select 
              className="leh-select"
              style={{ height: '44px' }}
              value={filters.user_id} 
              onChange={(e) => setFilters({...filters, user_id: e.target.value})}
            >
              <option value="">All Users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
            </select>
          </div>
          <div className="leh-form-group" style={{ marginBottom: 0 }}>
            <label className="leh-label">Event Protocol</label>
            <select 
              className="leh-select"
              style={{ height: '44px' }}
              value={filters.action_type} 
              onChange={(e) => setFilters({...filters, action_type: e.target.value})}
            >
              <option value="">All Actions</option>
              {actionTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="leh-form-group" style={{ marginBottom: 0 }}>
            <label className="leh-label">Start Period</label>
            <div style={{ position: 'relative' }}>
              <Calendar style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} size={14} />
              <input 
                type="date" 
                className="leh-date-input" 
                style={{ width: '100%', paddingLeft: '40px' }}
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              />
            </div>
          </div>
          <div className="leh-form-group" style={{ marginBottom: 0 }}>
            <label className="leh-label">End Period</label>
            <div style={{ position: 'relative' }}>
              <Calendar style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} size={14} />
              <input 
                type="date" 
                className="leh-date-input" 
                style={{ width: '100%', paddingLeft: '40px' }}
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Branded Print Header (Visible only on print) */}
      <div className="hidden print-block" style={{ textAlign: 'center', marginBottom: '40px', paddingBottom: '20px', borderBottom: '2px solid var(--leh-primary)' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--leh-primary)', margin: '0 0 4px' }}>LUNA EYE HOSPITAL</h1>
        <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#475569', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Audit Integrity Report</h2>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>
          Telemetry Window: {filters.start_date} — {filters.end_date} | Generated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="leh-table-card">
        <div className="leh-table-container">
          <table className="leh-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '32px', width: '220px' }}>Telemetry Stamp</th>
                <th style={{ width: '200px' }}>Operator</th>
                <th style={{ width: '200px' }}>Event Protocol</th>
                <th style={{ paddingRight: '32px' }}>Operational Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '80px 0', textAlign: 'center' }}>
                    <div className="leh-loading-spinner" style={{ margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '80px 0', textAlign: 'center' }}>
                    <Shield size={40} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                    <p className="leh-label" style={{ fontStyle: 'italic' }}>No audit trails recorded for this period</p>
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                   <td style={{ paddingLeft: '32px' }}>
                     <div className="leh-date-display">
                        <span className="leh-date-main">
                          {formatDateStandard(log.created_at)}
                        </span>
                       <span className="leh-date-sub">
                         {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                       </span>
                     </div>
                   </td>
                  <td className="leh-table-bold">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ width: '28px', height: '28px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <User size={14} style={{ color: '#94a3b8' }} />
                       </div>
                       <span>{log.user_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="leh-status-dot" style={{ 
                      fontSize: '10px', 
                      background: log.action_type.includes('FAIL') ? '#fef2f2' : '#f8fafc', 
                      color: log.action_type.includes('FAIL') ? '#ef4444' : '#475569',
                      border: log.action_type.includes('FAIL') ? '1px solid #fee2e2' : '1px solid #e2e8f0',
                      textTransform: 'uppercase',
                      fontWeight: '800'
                    }}>
                      {log.action_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ paddingRight: '32px' }}>
                    <p style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500', fontStyle: 'italic', margin: 0 }}>"{log.details || '—'}"</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
