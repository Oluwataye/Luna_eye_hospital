import React, { useEffect, useState } from 'react';
import { Database, HardDriveDownload, Users, Building2, Save, History, Upload, Download, Trash2, Edit3, Plus, Tags, Folders, RefreshCw, Shield } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

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
  const [showMgmtModal, setShowMgmtModal] = useState(false);
  const [mgmtForm, setMgmtForm] = useState<any>({});
  const [mgmtTarget, setMgmtTarget] = useState<'ward' | 'discount' | 'category' | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stats, sets, baks, wrds, dscs, cats] = await Promise.all([
        fetch(`${API_BASE_URL}/db-stats`).then(r => r.json()),
        api.getSettings(),
        api.getBackups(),
        api.getWards(),
        api.getDiscounts(),
        api.getInventoryCategories()
      ]);
      setDbStats(stats);
      setSettings(sets);
      setBackups(baks);
      setWards(wrds);
      setDiscounts(dscs);
      setInventoryCats(cats);
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

  const handleOpenMgmt = (target: 'ward' | 'discount' | 'category', item?: any) => {
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
    try {
      if (mgmtTarget === 'ward') {
        isEdit ? await api.updateWard(mgmtForm.id, mgmtForm) : await api.createWard(mgmtForm);
      } else if (mgmtTarget === 'discount') {
        isEdit ? await api.updateDiscount(mgmtForm.id, mgmtForm) : await api.createDiscount(mgmtForm);
      } else {
        isEdit ? await api.updateInventoryCategory(mgmtForm.id, mgmtForm) : await api.createInventoryCategory(mgmtForm);
      }
      notify('success', `${mgmtTarget} protocol ${isEdit ? 'updated' : 'initialized'} successfully`);
      setShowMgmtModal(false);
      fetchData();
    } catch (error: any) {
      notify('error', error.message || 'Failed to save protocol');
    }
  };

  const handleDeleteMgmt = (target: 'ward' | 'discount' | 'category', id: number) => {
    confirm({
      title: 'Decommission Protocol',
      message: `Are you sure you want to decommission this ${target}? This may affect historical clinical records.`,
      onConfirm: async () => {
        try {
          if (target === 'ward') await api.deleteWard(id);
          else if (target === 'discount') await api.deleteDiscount(id);
          else await api.deleteInventoryCategory(id);
          notify('success', 'Protocol decommissioned successfully');
          fetchData();
        } catch (error: any) {
          notify('error', error.message || 'Failed to decommission');
        }
      }
    });
  };

  return (
    <div className="leh-page-container">
      <div className="leh-page-header">
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

      <div style={{ display: 'flex', gap: '32px' }}>
        {/* Navigation Sidebar */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          <div className="leh-table-card" style={{ padding: '8px' }}>
            {[
              { id: 'clinic', label: 'Clinical Metadata', icon: Building2 },
              { id: 'management', label: 'Resource Management', icon: Users },
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
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{dbStats.tables.reduce((acc: number, t: any) => acc + t.rows, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1 }}>
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
                  <button onClick={() => handleOpenMgmt('ward')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
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
                              <button onClick={() => handleOpenMgmt('ward', w)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                              <button onClick={() => handleDeleteMgmt('ward', w.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
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
                  <button onClick={() => handleOpenMgmt('discount')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
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
                              <button onClick={() => handleOpenMgmt('discount', d)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                              <button onClick={() => handleDeleteMgmt('discount', d.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
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
                  <button onClick={() => handleOpenMgmt('category')} className="leh-btn-primary" style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}>
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
                              <button onClick={() => handleOpenMgmt('category', c)} className="leh-refresh-btn"><Edit3 size={14} /></button>
                              <button onClick={() => handleDeleteMgmt('category', c.id)} className="leh-refresh-btn" style={{ color: 'var(--leh-red)' }}><Trash2 size={14} /></button>
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
                 <Folders style={{ color: 'var(--leh-green)' }} />}
                <span>{isEdit ? `Edit ${mgmtTarget?.toUpperCase()} Protocol` : `Register New ${mgmtTarget?.toUpperCase()}`}</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowMgmtModal(false)}>
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
                      <label className="leh-label">PROTOCOL DESIGNATION</label>
                      <input 
                        className="leh-input"
                        required 
                        autoFocus
                        value={mgmtForm.name || ''} 
                        onChange={e => setMgmtForm({...mgmtForm, name: e.target.value})}
                        placeholder={`Enter unique ${mgmtTarget} name...`}
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
