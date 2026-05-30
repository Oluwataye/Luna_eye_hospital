import React, { useEffect, useState } from 'react';
import { Database, HardDriveDownload, Users, Building2, Save, History, Upload, Download, Trash2, Edit3, Plus, Tags, Folders, RefreshCw, Shield, FileText, Printer, FileSpreadsheet, Filter, Calendar, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';

const actionTypes = [
  // Auth
  'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
  // Legacy mixed-case
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

export const Settings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { notify, confirm } = useNotification();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'clinic');
  const [dbStats, setDbStats] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    clinic_name: '',
    clinic_address: '',
    clinic_phone: '',
    clinic_whatsapp: '',
    clinic_email: ''
  });
  const [backups, setBackups] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // New Management States
  const [wards, setWards] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [inventoryCats, setInventoryCats] = useState<any[]>([]);
  const [investigationTemplates, setInvestigationTemplates] = useState<any[]>([]);
  const [showMgmtModal, setShowMgmtModal] = useState(false);
  const [mgmtForm, setMgmtForm] = useState<any>({});
  const [mgmtTarget, setMgmtTarget] = useState<'ward' | 'discount' | 'category' | 'template' | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditUsers, setAuditUsers] = useState<any[]>([]);
  const [auditFilters, setAuditFilters] = useState({
    user_id: '',
    action_type: '',
    start_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stats, sets, baks, wrds, dscs, cats, tpls] = await Promise.all([
        api.getDbStats(),
        api.getSettings(),
        api.getBackups(),
        api.getWards(),
        api.getDiscounts(),
        api.getInventoryCategories(),
        api.getInvestigationTemplates()
      ]);
      setDbStats(stats);
      setSettings(sets);
      setBackups(baks);
      setWards(wrds);
      setDiscounts(dscs);
      setInventoryCats(cats);
      setInvestigationTemplates(tpls);
    } catch (error: any) {
      notify('error', 'Failed to fetch settings: ' + (error.message || 'Check connection'));
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      notify('success', 'Clinic settings updated successfully');
    } catch (error: any) {
      notify('error', error.message || 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerBackup = async () => {
    confirm({
      title: 'Manual Backup',
      message: 'Trigger a new server-side database backup? This may take a few moments.',
      onConfirm: async () => {
        try {
          await api.triggerBackup(user?.full_name || 'Admin');
          notify('success', 'Database backup created successfully');
          fetchData();
        } catch (error: any) {
          notify('error', error.message || 'Backup failed');
        }
      }
    });
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    confirm({
      title: 'Critical: Restore Database',
      message: 'This will overwrite the CURRENT database with the backup file. This action is IRREVERSIBLE. Proceed?',
      onConfirm: async () => {
        try {
          await api.restoreBackup(file);
          notify('success', 'Database restored. Application will reload.');
          setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
          notify('error', error.message || 'Restore failed');
        }
      }
    });
  };

  const handleOpenMgmt = (target: 'ward' | 'discount' | 'category' | 'template', item?: any) => {
    setMgmtTarget(target);
    if (item) {
      setMgmtForm(item);
      setIsEdit(true);
    } else {
      setMgmtForm({});
      setIsEdit(false);
    }
    setShowMgmtModal(true);
  };

  const handleSaveMgmt = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = mgmtTarget;
    if (!target) return;

    // 1. Back up current states
    const prevWards = [...wards];
    const prevDiscounts = [...discounts];
    const prevCategories = [...inventoryCats];
    const prevTemplates = [...investigationTemplates];

    // 2. Determine state setters
    let setList: React.Dispatch<React.SetStateAction<any[]>> = () => {};

    if (target === 'ward') {
      setList = setWards;
    } else if (target === 'discount') {
      setList = setDiscounts;
    } else if (target === 'category') {
      setList = setInventoryCats;
    } else if (target === 'template') {
      setList = setInvestigationTemplates;
    }

    // 3. Apply optimistic update to local state
    let tempId = mgmtForm.id;
    if (isEdit) {
      // Edit: update matching item in the list
      setList(prev => prev.map(item => item.id === mgmtForm.id ? { ...item, ...mgmtForm } : item));
    } else {
      // Create: append placeholder with temp negative ID
      tempId = -Date.now();
      const newItem = { ...mgmtForm, id: tempId };
      setList(prev => [...prev, newItem]);
    }

    setShowMgmtModal(false);

    try {
      let res: any;
      if (target === 'ward') {
        res = isEdit ? await api.updateWard(mgmtForm.id, mgmtForm) : await api.createWard(mgmtForm);
      } else if (target === 'discount') {
        res = isEdit ? await api.updateDiscount(mgmtForm.id, mgmtForm) : await api.createDiscount(mgmtForm);
      } else if (target === 'category') {
        res = isEdit ? await api.updateInventoryCategory(mgmtForm.id, mgmtForm) : await api.createInventoryCategory(mgmtForm);
      } else if (target === 'template') {
        res = isEdit ? await api.updateInvestigationTemplate(mgmtForm.id, mgmtForm) : await api.createInvestigationTemplate(mgmtForm);
      }

      notify('success', `${target} protocol ${isEdit ? 'updated' : 'initialized'} successfully`);
      
      // If we created a new item, update its ID from the response
      if (!isEdit && res && res.id) {
        setList(prev => prev.map(item => item.id === tempId ? { ...item, id: res.id } : item));
      }
      
      // Sync with full backend state (such as created_at or sequence fields)
      fetchData();
    } catch (error: any) {
      // Rollback on failure
      setWards(prevWards);
      setDiscounts(prevDiscounts);
      setInventoryCats(prevCategories);
      setInvestigationTemplates(prevTemplates);
      notify('error', error.message || 'Failed to save protocol');
    }
  };

  const handleDeleteMgmt = (target: 'ward' | 'discount' | 'category' | 'template', id: number) => {
    confirm({
      title: 'Decommission Protocol',
      message: `Are you sure you want to decommission this ${target}? This may affect historical clinical records.`,
      onConfirm: async () => {
        // 1. Back up current states
        const prevWards = [...wards];
        const prevDiscounts = [...discounts];
        const prevCategories = [...inventoryCats];
        const prevTemplates = [...investigationTemplates];

        // 2. Perform optimistic UI deletion
        if (target === 'ward') {
          setWards(prev => prev.filter(item => item.id !== id));
        } else if (target === 'discount') {
          setDiscounts(prev => prev.filter(item => item.id !== id));
        } else if (target === 'category') {
          setInventoryCats(prev => prev.filter(item => item.id !== id));
        } else if (target === 'template') {
          setInvestigationTemplates(prev => prev.filter(item => item.id !== id));
        }

        try {
          if (target === 'ward') await api.deleteWard(id);
          else if (target === 'discount') await api.deleteDiscount(id);
          else if (target === 'category') await api.deleteInventoryCategory(id);
          else if (target === 'template') await api.deleteInvestigationTemplate(id);
          
          notify('success', 'Protocol decommissioned successfully');
          fetchData();
        } catch (error: any) {
          // Rollback on failure
          setWards(prevWards);
          setDiscounts(prevDiscounts);
          setInventoryCats(prevCategories);
          setInvestigationTemplates(prevTemplates);
          notify('error', error.message || 'Failed to decommission');
        }
      }
    });
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const data = await api.getAuditLogs({
        ...auditFilters,
        user_id: auditFilters.user_id ? Number(auditFilters.user_id) : undefined
      });
      setAuditLogs(data);
    } catch (error: any) {
      notify('error', 'Failed to load system audit logs: ' + (error.message || 'Connection error'));
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchAuditUsers = async () => {
    try {
      const data = await api.getUsers();
      setAuditUsers(data);
    } catch (error: any) {
      notify('error', 'Failed to load system users list');
    }
  };

  const handleExportAudit = () => {
    if (auditLogs.length === 0) {
      notify('error', 'No logs to export');
      return;
    }

    const headers = ['Timestamp', 'User', 'Action', 'Details'];
    const csvContent = [
      headers.join(','),
      ...auditLogs.map(log => [
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
    link.setAttribute('download', `audit_logs_${auditFilters.start_date}_to_${auditFilters.end_date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('success', 'Audit logs exported successfully');
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchAuditUsers();
      fetchAuditLogs();
    }
  }, [activeTab, auditFilters]);

  return (
    <div className="leh-page-container">
      <div className="leh-page-header no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="leh-page-title">Enterprise System Control</h1>
            <p className="leh-page-subtitle">Configure clinical protocols, database safeguards, and hospital metadata</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
             <button onClick={fetchData} className="leh-btn-outline" style={{ height: '42px' }}>
               <RefreshCw size={14} /> REFRESH
             </button>
             <button onClick={handleSaveSettings} className="leh-btn-primary" style={{ height: '42px' }} disabled={isSaving}>
               <Save size={14} /> {isSaving ? 'SYNCHRONIZING...' : 'SAVE ALL CONFIG'}
             </button>
          </div>
        </div>
      </div>

      <div className="settings-layout-row" style={{ display: 'flex', gap: '32px', overflow: 'hidden', minWidth: 0 }}>
        {/* Navigation Sidebar */}
        <div style={{ width: '280px', flexShrink: 0 }} className="no-print">
          <div className="leh-table-card" style={{ padding: '8px' }}>
            {[
              { id: 'clinic', label: 'Clinical Metadata', icon: Building2 },
              { id: 'management', label: 'Resource Management', icon: Users },
              { id: 'templates', label: 'Result Templates', icon: FileText },
              { id: 'database', label: 'Database & Security', icon: Database },
              { id: 'logs', label: 'System Audit Logs', icon: History }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--leh-primary-light)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--leh-primary)' : 'var(--leh-text-grey)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? '800' : '600',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'database' && dbStats && (
            <div style={{ marginTop: '24px', padding: '24px', background: 'var(--leh-bg-light)', borderRadius: '14px', border: '1px solid var(--leh-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Shield size={18} style={{ color: 'var(--leh-primary)' }} />
                <span style={{ fontWeight: '800', fontSize: '11px', color: 'var(--leh-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Storage Metrics</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--leh-text-muted)' }}>Database Size</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{dbStats.size}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--leh-text-muted)' }}>Total Records</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{(dbStats.tables || []).reduce((acc: number, t: any) => acc + t.rows, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          {activeTab === 'clinic' && (
            <div className="leh-table-card" style={{ padding: '32px' }}>
              <h3 className="leh-table-title" style={{ marginBottom: '32px' }}>Clinical Metadata Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div className="leh-form-group">
                  <label className="leh-label">Hospital / Clinic Name</label>
                  <input 
                    className="leh-input" 
                    value={settings.clinic_name} 
                    onChange={e => setSettings({...settings, clinic_name: e.target.value})} 
                  />
                  <span className="leh-helper-text">Appears on all receipts and official medical documents</span>
                </div>
                <div className="leh-form-group">
                  <label className="leh-label">Contact Email Address</label>
                  <input 
                    className="leh-input" 
                    value={settings.clinic_email} 
                    onChange={e => setSettings({...settings, clinic_email: e.target.value})} 
                  />
                </div>
                <div className="leh-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="leh-label">Physical Address</label>
                  <input 
                    className="leh-input" 
                    value={settings.clinic_address} 
                    onChange={e => setSettings({...settings, clinic_address: e.target.value})} 
                  />
                </div>
                <div className="leh-form-group">
                  <label className="leh-label">Primary Support Phone</label>
                  <input 
                    className="leh-input" 
                    value={settings.clinic_phone} 
                    onChange={e => setSettings({...settings, clinic_phone: e.target.value})} 
                  />
                </div>
                <div className="leh-form-group">
                  <label className="leh-label">WhatsApp Clinical Alert Number</label>
                  <input 
                    className="leh-input" 
                    value={settings.clinic_whatsapp} 
                    onChange={e => setSettings({...settings, clinic_whatsapp: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'management' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Wards Section */}
              <div className="leh-table-card">
                <div className="leh-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="leh-table-title">Wards & Specialized Departments</h3>
                  <button type="button" onClick={() => handleOpenMgmt('ward')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
                    <Plus size={14} /> NEW WARD
                  </button>
                </div>
                <div className="leh-table-wrapper">
                  <table className="leh-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: '32px' }}>Designation</th>
                        <th>Capacity / Notes</th>
                        <th style={{ width: '120px', paddingRight: '32px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wards.map(w => (
                        <tr key={w.id}>
                          <td style={{ paddingLeft: '32px' }} className="leh-table-bold">{w.name}</td>
                          <td className="leh-label">{w.description}</td>
                          <td style={{ paddingRight: '32px' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button type="button" onClick={() => handleOpenMgmt('ward', w)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                              <button type="button" onClick={() => handleDeleteMgmt('ward', w.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Discounts Section */}
              <div className="leh-table-card">
                <div className="leh-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="leh-table-title">Yield & Discount Protocols</h3>
                  <button type="button" onClick={() => handleOpenMgmt('discount')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
                    <Plus size={14} /> NEW PROTOCOL
                  </button>
                </div>
                <div className="leh-table-wrapper">
                  <table className="leh-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: '32px' }}>Rule Label</th>
                        <th>Yield Value</th>
                        <th>Security</th>
                        <th>Status</th>
                        <th style={{ width: '120px', paddingRight: '32px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discounts.map(d => (
                        <tr key={d.id}>
                          <td style={{ paddingLeft: '32px' }} className="leh-table-bold">{d.name}</td>
                          <td>
                            <span style={{ fontWeight: '800' }}>{d.type === 'fixed' ? '₦' : ''}{d.value}{d.type === 'percentage' ? '%' : ''}</span>
                          </td>
                          <td>
                            {d.requires_auth ? 
                              <span className="leh-badge-amber">AUTH REQ</span> : 
                              <span className="leh-badge-green">OPEN</span>
                            }
                          </td>
                          <td>
                            {d.is_active ? 
                              <span style={{ color: 'var(--leh-green)', fontWeight: '800', fontSize: '11px' }}>● ACTIVE</span> : 
                              <span style={{ color: 'var(--leh-text-muted)', fontWeight: '800', fontSize: '11px' }}>○ DISABLED</span>
                            }
                          </td>
                          <td style={{ paddingRight: '32px' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button type="button" onClick={() => handleOpenMgmt('discount', d)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                              <button type="button" onClick={() => handleDeleteMgmt('discount', d.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Categories */}
              <div className="leh-table-card">
                <div className="leh-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="leh-table-title">Stock Taxonomy Categories</h3>
                  <button type="button" onClick={() => handleOpenMgmt('category')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
                    <Plus size={14} /> NEW CATEGORY
                  </button>
                </div>
                <div className="leh-table-wrapper">
                  <table className="leh-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: '32px' }}>Category Name</th>
                        <th>Operational Scope</th>
                        <th style={{ width: '120px', paddingRight: '32px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryCats.map(c => (
                        <tr key={c.id}>
                          <td style={{ paddingLeft: '32px' }} className="leh-table-bold">{c.name}</td>
                          <td className="leh-label">{c.description}</td>
                          <td style={{ paddingRight: '32px' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button type="button" onClick={() => handleOpenMgmt('category', c)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                              <button type="button" onClick={() => handleDeleteMgmt('category', c.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="leh-table-card" style={{ padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <h3 className="leh-table-title" style={{ margin: 0 }}>Clinical Database Guardian</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label className="leh-btn-outline" style={{ height: '42px', cursor: 'pointer' }}>
                      <Upload size={14} /> UPLOAD & RESTORE
                      <input type="file" accept=".sql" onChange={handleRestore} style={{ display: 'none' }} />
                    </label>
                    <button onClick={handleTriggerBackup} className="leh-btn-primary" style={{ height: '42px' }}>
                      <HardDriveDownload size={14} /> TRIGGER BACKUP
                    </button>
                  </div>
                </div>

                <div className="leh-table-wrapper" style={{ border: '1px solid var(--leh-border-light)', borderRadius: '16px' }}>
                  <table className="leh-table">
                    <thead>
                      <tr style={{ background: 'var(--leh-bg-light)' }}>
                        <th style={{ paddingLeft: '24px' }}>Timestamp</th>
                        <th>Encrypted File Node</th>
                        <th>Created By</th>
                        <th style={{ width: '140px', paddingRight: '24px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((bak, i) => (
                        <tr key={i}>
                          <td style={{ paddingLeft: '24px' }} className="leh-label font-bold">{new Date(bak.created_at).toLocaleString()}</td>
                          <td className="leh-table-bold">{bak.filename}</td>
                          <td className="leh-label">{bak.created_by}</td>
                          <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                             <a href={`${API_BASE_URL}/download-backup/${bak.filename}`} className="leh-refresh-btn" style={{ marginLeft: 'auto' }}>
                               <Download size={14} />
                             </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: '32px', background: 'white', borderRadius: 'var(--leh-radius-card)', border: '1px solid var(--leh-border-light)', display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-primary)' }}>
                  <Shield size={32} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>Autonomous Integrity Sentinel</h4>
                  <p className="leh-label" style={{ margin: 0, fontWeight: '700', color: 'var(--leh-primary)' }}>Full incremental snapshots are automatically generated and encrypted every 24 hours at 00:00 AST.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="leh-table-card">
              <div className="leh-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="leh-table-title">Diagnostic Results Templates</h3>
                <button type="button" onClick={() => handleOpenMgmt('template')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
                  <Plus size={14} /> NEW TEMPLATE
                </button>
              </div>
              <div className="leh-table-wrapper">
                <table className="leh-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '32px' }}>Investigation Name</th>
                      <th>Default Unit</th>
                      <th>Ref Range</th>
                      <th>Template Note Context</th>
                      <th style={{ width: '120px', paddingRight: '32px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investigationTemplates.map(t => (
                      <tr key={t.id}>
                        <td style={{ paddingLeft: '32px' }} className="leh-table-bold">{t.test_name}</td>
                        <td>{t.default_unit || '—'}</td>
                        <td>{t.default_reference_range || '—'}</td>
                        <td className="leh-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {t.template_content}
                        </td>
                        <td style={{ paddingRight: '32px' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => handleOpenMgmt('template', t)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                            <button type="button" onClick={() => handleDeleteMgmt('template', t.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }} className="no-print">
                <button 
                  className="leh-btn-outline" 
                  style={{ height: '42px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }} 
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> PRINT REPORT
                </button>
                <button 
                  className="leh-btn-primary" 
                  style={{ height: '42px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }} 
                  onClick={handleExportAudit}
                >
                  <FileSpreadsheet size={14} /> EXPORT EXCEL
                </button>
              </div>

              {/* Filters Card */}
              <div className="leh-table-card no-print" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Filter size={16} style={{ color: 'var(--leh-primary)' }} />
                    <h3 className="leh-table-title" style={{ fontSize: '14px', margin: 0 }}>Filter Security Protocols</h3>
                  </div>
                  <button 
                    className="leh-refresh-btn" 
                    onClick={fetchAuditLogs} 
                    data-tooltip="Refresh security audit records"
                    aria-label="Refresh logs"
                  >
                    <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                  <div className="leh-form-group" style={{ marginBottom: 0 }}>
                    <label className="leh-label">Operator / User</label>
                    <select 
                      className="leh-select"
                      style={{ height: '44px' }}
                      value={auditFilters.user_id} 
                      onChange={(e) => setAuditFilters({...auditFilters, user_id: e.target.value})}
                    >
                      <option value="">All Users</option>
                      {auditUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
                    </select>
                  </div>
                  <div className="leh-form-group" style={{ marginBottom: 0 }}>
                    <label className="leh-label">Event Protocol</label>
                    <select 
                      className="leh-select"
                      style={{ height: '44px' }}
                      value={auditFilters.action_type} 
                      onChange={(e) => setAuditFilters({...auditFilters, action_type: e.target.value})}
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
                        className="leh-input" 
                        style={{ width: '100%', paddingLeft: '40px', height: '44px' }}
                        value={auditFilters.start_date}
                        onChange={(e) => setAuditFilters({...auditFilters, start_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="leh-form-group" style={{ marginBottom: 0 }}>
                    <label className="leh-label">End Period</label>
                    <div style={{ position: 'relative' }}>
                      <Calendar style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} size={14} />
                      <input 
                        type="date" 
                        className="leh-input" 
                        style={{ width: '100%', paddingLeft: '40px', height: '44px' }}
                        value={auditFilters.end_date}
                        onChange={(e) => setAuditFilters({...auditFilters, end_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Branded Print Header (Visible only on print) */}
              <div className="print-only" style={{ textAlign: 'center', marginBottom: '40px', paddingBottom: '20px', borderBottom: '2px solid var(--leh-primary)' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--leh-primary)', margin: '0 0 4px' }}>LUNA EYE HOSPITAL</h1>
                <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#475569', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Audit Integrity Report</h2>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>
                  Telemetry Window: {auditFilters.start_date} — {auditFilters.end_date} | Generated: {new Date().toLocaleString()}
                </div>
              </div>

              {/* Table */}
              <div className="leh-table-card">
                <div className="leh-table-wrapper">
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
                      {auditLoading ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '80px 0', textAlign: 'center' }}>
                            <div className="leh-loading-spinner" style={{ margin: '0 auto' }}></div>
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '80px 0', textAlign: 'center' }}>
                            <Shield size={40} style={{ color: '#cbd5e1', marginBottom: '16px', margin: '0 auto' }} />
                            <p className="leh-label" style={{ fontStyle: 'italic', textAlign: 'center' }}>No audit trails recorded for this period</p>
                          </td>
                        </tr>
                      ) : auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ paddingLeft: '32px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '800', fontSize: '13px', color: '#1e293b' }}>
                                {formatDateStandard(log.created_at)}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--leh-text-muted)' }}>
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
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'inline-block'
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
          )}
        </div>
      </div>

      {/* Management Protocol Modal */}
      {showMgmtModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '520px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                {mgmtTarget === 'ward' ? <Building2 style={{ color: 'var(--leh-primary)' }} /> : 
                 mgmtTarget === 'discount' ? <Tags style={{ color: 'var(--leh-amber)' }} /> : 
                 mgmtTarget === 'template' ? <FileText style={{ color: 'var(--leh-primary)' }} /> :
                 <Folders style={{ color: 'var(--leh-green)' }} />}
                <span>{isEdit ? `Edit ${mgmtTarget?.toUpperCase()} Protocol` : `Register New ${mgmtTarget?.toUpperCase()}`}</span>
              </div>
              <button type="button" className="leh-modal-close" onClick={() => setShowMgmtModal(false)}>
                <RefreshCw size={20} className={isSaving ? "animate-spin" : ""} />
              </button>
            </div>
            
            <div className="leh-modal-body">
              <form onSubmit={handleSaveMgmt}>
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <Shield size={14} /> Protocol Specifications
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">{mgmtTarget === 'template' ? 'INVESTIGATION / TEST NAME' : 'PROTOCOL DESIGNATION'}</label>
                      <input 
                        className="leh-input"
                        required 
                        autoFocus
                        value={mgmtForm.name || mgmtForm.test_name || ''} 
                        onChange={e => setMgmtForm({...mgmtForm, name: e.target.value, test_name: e.target.value})}
                        placeholder={mgmtTarget === 'template' ? "e.g. Random Blood Sugar, RBS..." : `Enter unique ${mgmtTarget} name...`}
                      />
                    </div>

                    {mgmtTarget === 'discount' ? (
                      <>
                        <div className="leh-form-group">
                          <label className="leh-label">YIELD VALUE</label>
                          <input 
                            className="leh-input"
                            type="number" 
                            step="0.01"
                            required 
                            value={mgmtForm.value || 0} 
                            onChange={e => setMgmtForm({...mgmtForm, value: parseFloat(e.target.value)})}
                          />
                        </div>
                        <div className="leh-form-group">
                          <label className="leh-label">CALCULATION LOGIC</label>
                          <select 
                            className="leh-select"
                            value={mgmtForm.type || 'fixed'} 
                            onChange={e => setMgmtForm({...mgmtForm, type: e.target.value})}
                          >
                            <option value="fixed">Fixed Currency (₦)</option>
                            <option value="percentage">Percentage Yield (%)</option>
                          </select>
                        </div>
                        <div className="leh-form-group full-width">
                          <div style={{ 
                            padding: '16px', 
                            background: 'var(--leh-bg-grey)', 
                            borderRadius: '12px', 
                            border: '1px solid var(--leh-border-light)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={!!mgmtForm.requires_auth} 
                                onChange={e => setMgmtForm({...mgmtForm, requires_auth: e.target.checked ? 1 : 0})}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--leh-primary)' }}
                              />
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>REQUIRE ADMIN OVERRIDE</span>
                            </label>
                            {isEdit && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox" 
                                  checked={!!mgmtForm.is_active} 
                                  onChange={e => setMgmtForm({...mgmtForm, is_active: e.target.checked ? 1 : 0})}
                                  style={{ width: '16px', height: '16px', accentColor: 'var(--leh-green)' }}
                                />
                                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-green)' }}>PROTOCOL IS ACTIVE</span>
                              </label>
                            )}
                          </div>
                        </div>
                      </>
                    ) : mgmtTarget === 'template' ? (
                      <>
                        <div className="leh-form-group">
                          <label className="leh-label">DEFAULT UNIT</label>
                          <input 
                            className="leh-input"
                            value={mgmtForm.default_unit || ''} 
                            onChange={e => setMgmtForm({...mgmtForm, default_unit: e.target.value})}
                            placeholder="e.g. mmol/L, mg/dL..."
                          />
                        </div>
                        <div className="leh-form-group">
                          <label className="leh-label">REFERENCE RANGE</label>
                          <input 
                            className="leh-input"
                            value={mgmtForm.default_reference_range || ''} 
                            onChange={e => setMgmtForm({...mgmtForm, default_reference_range: e.target.value})}
                            placeholder="e.g. 3.9 - 5.6, < 7.8..."
                          />
                        </div>
                        <div className="leh-form-group full-width">
                          <label className="leh-label">TEMPLATE NOTE CONTENT</label>
                          <textarea 
                            className="leh-textarea"
                            style={{ minHeight: '160px', fontFamily: 'monospace' }}
                            value={mgmtForm.template_content || ''} 
                            onChange={e => setMgmtForm({...mgmtForm, template_content: e.target.value})}
                            placeholder="Enter the template structure for results observations..."
                          />
                        </div>
                      </>
                    ) : (
                      <div className="leh-form-group full-width">
                        <label className="leh-label">OPERATIONAL DESCRIPTION</label>
                        <textarea 
                          className="leh-textarea"
                          style={{ minHeight: '120px' }}
                          value={mgmtForm.description || ''} 
                          onChange={e => setMgmtForm({...mgmtForm, description: e.target.value})}
                          placeholder="Provide detailed clinical or administrative context..."
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="leh-modal-footer" style={{ padding: '0', marginTop: '24px' }}>
                  <button type="button" className="leh-btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setShowMgmtModal(false)}>CANCEL</button>
                  <button type="submit" className="leh-btn-primary" style={{ flex: 2, height: '52px' }}>
                    <Save size={18} />
                    <span>{isEdit ? 'SAVE PROTOCOL' : 'INITIALIZE PROTOCOL'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
