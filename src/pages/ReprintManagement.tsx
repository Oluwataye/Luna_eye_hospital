import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, 
  Printer, 
  Settings,
  Search, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  Lock,
  X,
  History,
  Flag,
  Eye
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import ReprintReceiptModal from '../components/ReprintReceiptModal';
const ReprintManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify, confirm } = useNotification();

  const [activeTab, setActiveTab] = useState<'all' | 'restricted' | 'control'>('all');
  const [logs, setLogs] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    user_name: '',
    search: '',
    flagged_only: false
  });

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [reprintReceiptNo, setReprintReceiptNo] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState<{ id: number; is_flagged: boolean } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionData, setRestrictionData] = useState({ user_id: '', user_name: '', reason: '' });
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(5);

  // Reprint Control States
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearchReceipts = async () => {
    try {
      setSearching(true);
      const data = await api.searchReceiptsForReprint({
        search: searchQuery,
        start_date: searchStartDate,
        end_date: searchEndDate
      });
      setSearchResults(data || []);
    } catch (error) {
      notify('error', 'Failed to search receipts database');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'Admin') {
      notify('error', 'Access denied. Administrator privileges required.');
      navigate('/dashboard');
      return;
    }
    
    fetchData();
    fetchStats();
    fetchSettings();
    fetchAllUsers();
    
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [user, activeTab, page, filters]);

  const fetchData = async () => {
    try {
      if (activeTab === 'all') {
        const data = await api.getReprintLogs({ ...filters, page, limit: 10 });
        setLogs(data || []);
      } else if (activeTab === 'restricted') {
        const data = await api.getAllReprintRestrictions();
        setRestrictions(data || []);
      } else if (activeTab === 'control') {
        handleSearchReceipts();
      }
    } catch (error) {
      notify('error', 'Failed to fetch reprint data');
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getReprintStats();
      setStats(data);
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.getReprintSettings();
      if (res.daily_reprint_threshold) setThreshold(res.daily_reprint_threshold);
    } catch (error) {
      console.error('Settings fetch error:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const data = await api.getUsers();
      setAllUsers(data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await api.updateReprintSettings({ 
        daily_reprint_threshold: threshold, 
        updated_by: user?.id || 0 
      });
      notify('success', 'Reprint threshold updated successfully');
      setShowSettings(false);
    } catch (error) {
      notify('error', 'Failed to update settings');
    }
  };

  const submitFlag = async () => {
    if (!showFlagModal) return;
    if (!flagReason.trim()) return notify('error', 'Please provide a reason for flagging');
    
    try {
      await api.flagReprint(showFlagModal.id, { 
        is_flagged: !showFlagModal.is_flagged, 
        flag_reason: flagReason 
      });
      notify('success', `Transaction ${!showFlagModal.is_flagged ? 'flagged' : 'unflagged'} successfully`);
      setShowFlagModal(null);
      setFlagReason('');
      fetchData();
    } catch (error) {
      notify('error', 'Failed to update flag');
    }
  };

  const handleAddRestriction = async () => {
    if (!restrictionData.user_id || !restrictionData.reason.trim()) {
      return notify('error', 'Please select a user and provide a reason');
    }
    
    const selectedUser = allUsers.find(u => u.id.toString() === restrictionData.user_id);
    
    try {
      await api.setReprintRestriction({
        user_id: Number(restrictionData.user_id),
        user_name: selectedUser?.full_name || 'Staff',
        admin_id: user?.id || 0,
        is_active: true,
        restriction_reason: restrictionData.reason
      });
      notify('success', 'User reprint access restricted');
      setShowRestrictionModal(false);
      setRestrictionData({ user_id: '', user_name: '', reason: '' });
      fetchData();
    } catch (error) {
      notify('error', 'Failed to restrict user');
    }
  };

  const handleRemoveRestriction = (userId: number) => {
    confirm({
      title: 'Remove Restriction',
      message: 'Are you sure you want to restore reprint access for this user?',
      type: 'warning',
      confirmText: 'RESTORE ACCESS',
      onConfirm: async () => {
        try {
          await api.setReprintRestriction({
            user_id: userId,
            user_name: 'Staff', // Placeholder as it's not needed for disabling but required by type
            admin_id: user?.id || 0,
            is_active: false
          });
          notify('success', 'Restriction removed successfully');
          fetchData();
          fetchStats();
        } catch (error) {
          notify('error', 'Failed to remove restriction');
        }
      }
    });
  };

  return (
    <div className="leh-page-container">
      <div className="leh-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="leh-page-title">Reprint Audit & Security Center</h1>
            <p className="leh-page-subtitle">Monitor duplicate clinical documentation, manage security flags, and enforce administrative locks</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowSettings(true)} className="leh-btn-outline" style={{ height: '42px' }} data-tooltip="Configure daily reprint limits per staff">
              <Settings size={14} /> AUDIT THRESHOLDS
            </button>
            <button onClick={() => setShowRestrictionModal(true)} className="leh-btn-primary" style={{ height: '42px' }} data-tooltip="Revoke reprint privileges for specific users">
              <Lock size={14} /> RESTRIC ACCESS
            </button>
          </div>
        </div>
      </div>

      <div className="leh-stat-grid">
        <div className="leh-stat-card blue">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Reprint Volume (24h)</span>
            <div className="leh-stat-icon-box"><RefreshCcw /></div>
          </div>
          <span className="leh-stat-value">{stats?.total_today || 0}</span>
          <div className="leh-stat-bottom">Total duplicate receipts generated</div>
        </div>
        <div className="leh-stat-card amber">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Security Flags</span>
            <div className="leh-stat-icon-box"><Flag /></div>
          </div>
          <span className="leh-stat-value">{stats?.total_flagged || 0}</span>
          <div className="leh-stat-bottom">Transactions requiring audit review</div>
        </div>
        <div className="leh-stat-card red">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Active Restrictions</span>
            <div className="leh-stat-icon-box"><Lock /></div>
          </div>
          <span className="leh-stat-value">{stats?.total_restricted || 0}</span>
          <div className="leh-stat-bottom">Users with revoked reprint access</div>
        </div>
      </div>

      <div className="leh-table-card" style={{ padding: '8px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => { setActiveTab('all'); setPage(1); }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', border: 'none', background: activeTab === 'all' ? 'var(--leh-primary-light)' : 'transparent', color: activeTab === 'all' ? 'var(--leh-primary)' : 'var(--leh-text-grey)', borderRadius: '12px', cursor: 'pointer', fontWeight: activeTab === 'all' ? '800' : '600', fontSize: '14px', transition: 'all 0.2s' }}
          >
            <History size={18} /> FULL AUDIT TRAIL
          </button>
          <button 
            onClick={() => { setActiveTab('control'); setPage(1); }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', border: 'none', background: activeTab === 'control' ? 'var(--leh-primary-light)' : 'transparent', color: activeTab === 'control' ? 'var(--leh-primary)' : 'var(--leh-text-grey)', borderRadius: '12px', cursor: 'pointer', fontWeight: activeTab === 'control' ? '800' : '600', fontSize: '14px', transition: 'all 0.2s' }}
          >
            <Printer size={18} /> REPRINT CONTROL UNIT
          </button>
          <button 
            onClick={() => { setActiveTab('restricted'); setPage(1); }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', border: 'none', background: activeTab === 'restricted' ? 'var(--leh-primary-light)' : 'transparent', color: activeTab === 'restricted' ? 'var(--leh-primary)' : 'var(--leh-text-grey)', borderRadius: '12px', cursor: 'pointer', fontWeight: activeTab === 'restricted' ? '800' : '600', fontSize: '14px', transition: 'all 0.2s' }}
          >
            <ShieldCheck size={18} /> SECURITY LOCKS
          </button>
        </div>
      </div>

      {activeTab === 'all' && (
        <div className="leh-table-card">
          <div style={{ padding: '24px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="leh-search-box">
                <Search size={18} className="leh-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search by Receipt No, Patient or Operator..." 
                  value={filters.search} 
                  onChange={e => setFilters({...filters, search: e.target.value})} 
                  spellCheck={false}
                />
                {filters.search && (
                  <button onClick={() => setFilters({...filters, search: ''})} className="leh-search-clear" type="button">
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
               <Calendar size={14} style={{ color: 'var(--leh-primary)' }} />
               <input 
                 type="date" 
                 className="leh-date-input" 
                 style={{ width: '150px', height: '36px', fontSize: '12px' }} 
                 value={filters.from_date} 
                 onChange={e => setFilters({...filters, from_date: e.target.value})} 
               />
                <button 
                  onClick={() => setFilters({
                    from_date: '',
                    to_date: '',
                    user_name: '',
                    search: '',
                    flagged_only: false
                  })} 
                  className="leh-btn-outline"
                  style={{ height: '42px', fontSize: '11px', fontWeight: 'bold' }}
                >
                  <RefreshCcw size={14} /> RESET ALL FILTERS
                </button>
                <button 
                  onClick={() => setFilters({...filters, flagged_only: !filters.flagged_only})} 
                  className={`leh-btn-outline ${filters.flagged_only ? 'leh-btn-active' : ''}`}
                  style={{ 
                    height: '42px', 
                    background: filters.flagged_only ? '#fef2f2' : 'white', 
                    borderColor: filters.flagged_only ? '#ef4444' : 'var(--leh-border-light)', 
                    color: filters.flagged_only ? '#ef4444' : 'var(--leh-text-grey)' 
                  }}
                >
                   <Flag size={14} /> {filters.flagged_only ? 'SHOWING: FLAGGED ONLY' : 'SHOWING: ALL LOGS'}
                </button>
            </div>
          </div>
          <div className="leh-table-wrapper">
            <table className="leh-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '32px' }}>Timestamp</th>
                  <th>Receipt / Reference</th>
                  <th>Patient Identity</th>
                  <th>Operator (Staff)</th>
                  <th style={{ textAlign: 'right', paddingRight: '32px' }}>Audit Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ paddingLeft: '32px' }}>
                       <div className="leh-date-display">
                          <span className="leh-date-main">
                             {formatDateStandard(log.reprint_timestamp)}
                           </span>
                          <span className="leh-date-sub">
                            {new Date(log.reprint_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                    </td>
                    <td>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="leh-table-bold">{log.receipt_number}</span>
                          {log.is_flagged && <Flag size={14} style={{ color: 'var(--leh-red)' }} />}
                       </div>
                    </td>
                    <td className="leh-table-bold">{log.patient_name || 'N/A'}</td>
                    <td className="leh-table-bold" style={{ color: 'var(--leh-primary)' }}>{log.reprinted_by_name}</td>
                    <td style={{ paddingRight: '32px', textAlign: 'right' }}>
                       <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setReprintReceiptNo(log.receipt_number)} className="leh-refresh-btn" title="View & Print Receipt Preview" aria-label="View Receipt"><Eye size={14} /></button>
                          <button onClick={() => setShowFlagModal({ id: log.id, is_flagged: log.is_flagged })} className="leh-refresh-btn" style={{ color: log.is_flagged ? 'var(--leh-red)' : 'var(--leh-text-muted)' }} title={log.is_flagged ? "Clear Security Flag" : "Flag for Audit Review"} aria-label={log.is_flagged ? "Clear Security Flag" : "Flag for Audit Review"}><Flag size={14} /></button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'control' && (
        <div className="leh-table-card">
          <div style={{ padding: '24px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div className="leh-search-box">
                <Search size={18} className="leh-search-icon" />
                <input 
                  type="text" 
                  placeholder="Enter Receipt No, Patient Name or Patient ID..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchReceipts(); }}
                  spellCheck={false}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="leh-search-clear" type="button">
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} style={{ color: 'var(--leh-primary)' }} />
                <input 
                  type="date" 
                  className="leh-date-input" 
                  style={{ width: '140px', height: '36px', fontSize: '12px' }} 
                  value={searchStartDate} 
                  onChange={e => setSearchStartDate(e.target.value)} 
                />
                <span style={{ fontSize: '12px', color: 'var(--leh-text-muted)' }}>to</span>
                <input 
                  type="date" 
                  className="leh-date-input" 
                  style={{ width: '140px', height: '36px', fontSize: '12px' }} 
                  value={searchEndDate} 
                  onChange={e => setSearchEndDate(e.target.value)} 
                />
              </div>

              <button 
                onClick={handleSearchReceipts}
                className="leh-btn-primary"
                style={{ height: '42px', padding: '0 20px', fontSize: '13px' }}
                disabled={searching}
              >
                {searching ? 'SEARCHING...' : 'SEARCH DATABASE'}
              </button>

              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSearchStartDate('');
                  setSearchEndDate('');
                  setSearchResults([]);
                }} 
                className="leh-btn-outline"
                style={{ height: '42px', fontSize: '12px', fontWeight: 'bold' }}
              >
                <RefreshCcw size={14} /> RESET
              </button>
            </div>
          </div>

          <div className="leh-table-wrapper">
            <table className="leh-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '32px' }}>Transaction Date</th>
                  <th>Receipt Number</th>
                  <th>Patient Name & ID</th>
                  <th>Invoice Value</th>
                  <th>Paid Status</th>
                  <th style={{ textAlign: 'right', paddingRight: '32px' }}>Override Control</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.length > 0 ? (
                  searchResults.map(tx => {
                    const balance = tx.total_amount - tx.amount_paid - (tx.discount || 0);
                    const isPaidFull = balance <= 0;
                    return (
                      <tr key={tx.id}>
                        <td style={{ paddingLeft: '32px' }}>
                          <div className="leh-date-display">
                            <span className="leh-date-main">
                              {formatDateStandard(tx.created_at)}
                            </span>
                            <span className="leh-date-sub">
                              {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="leh-table-bold" style={{ color: 'var(--leh-primary)', fontFamily: 'monospace' }}>
                            {tx.receipt_no}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="leh-table-bold">{tx.patient_name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>ID: {tx.patient_id}</span>
                          </div>
                        </td>
                        <td className="leh-table-bold">
                          ₦{tx.total_amount?.toLocaleString()}
                        </td>
                        <td>
                          <span className={`leh-status-badge ${isPaidFull ? 'green' : 'amber'}`} style={{ fontSize: '10px' }}>
                            {isPaidFull ? 'PAID FULL' : `BAL: ₦${balance.toLocaleString()}`}
                          </span>
                        </td>
                        <td style={{ paddingRight: '32px', textAlign: 'right' }}>
                          <button 
                            onClick={() => setReprintReceiptNo(tx.receipt_no)} 
                            className="leh-btn-primary" 
                            style={{ height: '32px', padding: '0 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            title="Initiate Administrative Reprint"
                          >
                            <Printer size={12} /> INITIATE REPRINT
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--leh-text-muted)' }}>
                      <div style={{ maxWidth: '320px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Printer size={36} style={{ opacity: 0.3, color: 'var(--leh-primary)' }} />
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>No Transactions Loaded</span>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Enter a search query above to locate historical receipts across any period.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'restricted' && (
        <div className="leh-table-card">
          <div className="leh-table-header"><h3 className="leh-table-title">Active Independent Reprint Restrictions</h3></div>
          <div className="leh-table-wrapper">
            <table className="leh-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '32px' }}>Target Operator</th>
                  <th>Clinical Role</th>
                  <th>Restriction Reason</th>
                  <th>Authorized At</th>
                  <th style={{ textAlign: 'right', paddingRight: '32px' }}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {restrictions.map(r => (
                  <tr key={r.user_id}>
                    <td style={{ paddingLeft: '32px' }} className="leh-table-bold">{r.user_name}</td>
                    <td>
                      <span className={`leh-badge-${r.role?.toLowerCase() === 'admin' ? 'purple' : 'blue'}`}>
                        {r.role?.toUpperCase() || 'USER'}
                      </span>
                    </td>
                    <td className="leh-label">{r.restriction_reason}</td>
                    <td className="leh-label font-bold">{new Date(r.restricted_at).toLocaleString()}</td>
                    <td style={{ paddingRight: '32px', textAlign: 'right' }}>
                       <button onClick={() => handleRemoveRestriction(r.user_id)} className="leh-btn-outline" style={{ height: '32px', padding: '0 12px', fontSize: '11px', color: 'var(--leh-red)', borderColor: '#fecaca' }}>
                          RESTORE ACCESS
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '480px' }}>
            <div className="leh-modal-header">
               <div className="leh-modal-title">
                 <Settings style={{ color: 'var(--leh-primary)' }} />
                 <span>Audit Thresholds</span>
               </div>
               <button className="leh-modal-close" onClick={() => setShowSettings(false)}>
                 <X size={20} />
               </button>
            </div>
            
            <div className="leh-modal-body" style={{ padding: '32px' }}>
              <div style={{ background: 'var(--leh-primary-light)', padding: '24px', borderRadius: '24px', textAlign: 'center', marginBottom: '32px', border: '1px solid var(--leh-primary)' }}>
                 <div style={{ width: '64px', height: '64px', background: '#fff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-primary)', margin: '0 auto 16px', boxShadow: '0 8px 20px rgba(37,99,235,0.15)' }}>
                    <Printer size={32} />
                 </div>
                 <h4 className="leh-table-bold" style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--leh-primary)' }}>Reprint Tolerance Ceiling</h4>
                 <p className="leh-label" style={{ fontSize: '13px', margin: 0, lineHeight: '1.6' }}>Define the daily limit for independent clinical document reproduction per staff node.</p>
              </div>

              <div className="leh-form-group">
                 <label className="leh-label">OPERATIONAL DAILY LIMIT</label>
                 <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      className="leh-input" 
                      style={{ height: '72px', fontSize: '28px', fontWeight: '900', textAlign: 'center', color: 'var(--leh-primary)', borderRadius: '20px', border: '2px solid var(--leh-primary-light)' }} 
                      value={threshold} 
                      onChange={e => setThreshold(parseInt(e.target.value) || 1)} 
                    />
                    <span style={{ position: 'absolute', right: '24px', top: '26px', fontSize: '11px', fontWeight: '900', color: 'var(--leh-primary)', opacity: 0.5, letterSpacing: '0.1em' }}>REPRINTS / DAY</span>
                 </div>
              </div>
            </div>

            <div className="leh-modal-footer">
               <button className="leh-btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setShowSettings(false)}>CANCEL</button>
               <button className="leh-btn-primary" style={{ flex: 2, height: '52px' }} onClick={handleUpdateSettings}>COMMIT PROTOCOL</button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '500px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <Flag style={{ color: 'var(--leh-red)' }} />
                <span>Security Risk Flag</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowFlagModal(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '16px', background: '#fff1f2', borderRadius: '16px', border: '1px solid #fda4af' }}>
                 <AlertTriangle color="#e11d48" size={24} />
                 <p className="leh-label" style={{ color: '#be123c', fontSize: '13px', margin: 0, fontWeight: '700' }}>
                    Authorizing this flag will trigger a secondary administrative review for this transaction.
                 </p>
              </div>
              
              <div className="leh-form-group">
                 <label className="leh-label">RISK CONTEXT / JUSTIFICATION</label>
                 <textarea 
                    className="leh-textarea" 
                    style={{ minHeight: '140px', paddingTop: '16px', fontSize: '15px' }} 
                    placeholder="Specify the anomaly detected during audit (e.g., suspicious timing, high frequency)..." 
                    value={flagReason} 
                    onChange={e => setFlagReason(e.target.value)}
                 />
              </div>
            </div>

            <div className="leh-modal-footer">
               <button className="leh-btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setShowFlagModal(null)}>DISMISS</button>
               <button className="leh-btn-primary" style={{ flex: 2, height: '52px', background: 'var(--leh-red)' }} onClick={submitFlag}>AUTHORIZE FLAG</button>
            </div>
          </div>
        </div>
      )}

      {/* Restriction Modal */}
      {showRestrictionModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '520px' }}>
             <div className="leh-modal-header">
               <div className="leh-modal-title">
                 <Lock style={{ color: 'var(--leh-red)' }} />
                 <span>Administrative Lock</span>
               </div>
               <button className="leh-modal-close" onClick={() => setShowRestrictionModal(false)}>
                 <X size={20} />
               </button>
             </div>

             <div className="leh-modal-body" style={{ padding: '32px' }}>
                <p className="leh-label" style={{ marginBottom: '24px', fontSize: '14px' }}>
                   Revoking independent reprint privileges for the specified clinical operator node.
                </p>

                <div className="leh-form-group">
                   <label className="leh-label">TARGET OPERATOR NODE</label>
                   <select 
                     className="leh-select" 
                     style={{ height: '56px', fontWeight: '800', borderRadius: '16px', fontSize: '15px' }} 
                     value={restrictionData.user_id} 
                     onChange={e => setRestrictionData({...restrictionData, user_id: e.target.value})}
                   >
                      <option value="">-- CHOOSE STAFF NODE --</option>
                      {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name.toUpperCase()} ({u.role.toUpperCase()})</option>)}
                   </select>
                </div>

                <div className="leh-form-group" style={{ marginTop: '24px' }}>
                   <label className="leh-label">CLINICAL AUDIT JUSTIFICATION</label>
                   <textarea 
                     className="leh-textarea" 
                     style={{ minHeight: '140px', paddingTop: '16px', fontSize: '15px' }} 
                     placeholder="Provide specific reason for mandatory administrative lock..." 
                     value={restrictionData.reason} 
                     onChange={e => setRestrictionData({...restrictionData, reason: e.target.value})}
                   />
                </div>
             </div>

             <div className="leh-modal-footer">
                <button className="leh-btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setShowRestrictionModal(false)}>CANCEL</button>
                <button className="leh-btn-primary" style={{ flex: 2, height: '52px', background: 'var(--leh-red)' }} onClick={handleAddRestriction}>COMMIT ACCESS LOCK</button>
             </div>
          </div>
        </div>
      )}

      {reprintReceiptNo && <ReprintReceiptModal receipt_number={reprintReceiptNo} onClose={() => setReprintReceiptNo(null)} />}
    </div>
  );
};

export default ReprintManagement;
