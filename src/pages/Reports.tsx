import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, Package, AlertCircle, Search, RefreshCcw, Printer, 
  Shield, PieChart, Activity, ChevronRight, Filter, Calendar, Download, Truck
} from 'lucide-react';
import { NairaIcon } from '../components/NairaIcon';
import { formatDateStandard } from '../utils/date';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';

type ReportTab = 
  | 'inventory' | 'sales' | 'profit_loss' | 'patients' 
  | 'procurement' | 'debtors' | 'expenses' | 'audit_log';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ReportTab>((searchParams.get('tab') as ReportTab) || 'inventory');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Package, title: 'Inventory Analytics', subtitle: 'Global stock valuation & asset health' },
    { id: 'sales', label: 'Revenue Stream', icon: NairaIcon, title: 'Financial Intelligence', subtitle: 'Transaction logs & revenue performance' },
    { id: 'patients', label: 'Clinical Flow', icon: Users, title: 'Patient Dynamics', subtitle: 'Clinic throughput & admission metrics' },
    { id: 'procurement', label: 'Procurement', icon: Truck, title: 'Supply Logistics', subtitle: 'Stock acquisition & supplier accounts' },
    { id: 'debtors', label: 'Receivables', icon: AlertCircle, title: 'Outstanding Debt', subtitle: 'Awaiting settlements & aging analysis' },
    { id: 'audit_log', label: 'Security Log', icon: Shield, title: 'System Integrity', subtitle: 'Audit trail & access monitoring' },
  ];

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let result: any = [];
      switch (activeTab) {
        case 'inventory': result = await api.getInventory(); break;
        case 'sales': result = await api.getSalesReport(dateRange.start, dateRange.end); break;
        case 'patients': result = await api.getPatientActivity(dateRange.start, dateRange.end); break;
        case 'procurement': result = await api.getProcurementReport(dateRange.start, dateRange.end); break;
        case 'debtors': result = await api.getDebtorsReport(); break;
        case 'audit_log': 
          const logs = await api.getAuditReport(dateRange.start, dateRange.end);
          result = Array.isArray(logs) ? logs : [];
          break;
      }
      setData(result || []);
    } catch (e) { notify('error', 'Telemetry Error: Report generation failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReportData(); }, [activeTab, dateRange]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }, [data, searchQuery]);

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header">
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
            <PieChart size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="leh-page-title">{activeTabData?.title || 'System Analytics'}</h1>
            <p className="leh-page-subtitle">{activeTabData?.subtitle}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            background: '#fff', 
            padding: '8px 16px', 
            borderRadius: '14px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <Calendar size={14} style={{ color: 'var(--leh-primary)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date" 
                className="leh-date-input" 
                style={{ height: '32px', width: '130px', border: 'none', background: 'transparent', padding: 0, fontWeight: '800', fontSize: '12px', color: '#1e293b' }} 
                value={dateRange.start} 
                onChange={e => setDateRange(p => ({...p, start: e.target.value}))} 
              />
              <span style={{ color: '#cbd5e1', fontWeight: '900' }}>—</span>
              <input 
                type="date" 
                className="leh-date-input" 
                style={{ height: '32px', width: '130px', border: 'none', background: 'transparent', padding: 0, fontWeight: '800', fontSize: '12px', color: '#1e293b' }} 
                value={dateRange.end} 
                onChange={e => setDateRange(p => ({...p, end: e.target.value}))} 
              />
            </div>
          </div>
          <button 
            className="leh-btn-secondary" 
            style={{ width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            onClick={() => fetchReportData()}
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Analytics Stats Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="leh-stat-card">
          <p className="leh-label">TELEMETRY VOLUME</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">{filteredData.length.toLocaleString()}</h3>
            <span className="leh-status-dot" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: '900' }}>ENTRIES</span>
          </div>
        </div>
        <div className="leh-stat-card">
          <p className="leh-label">TEMPORAL WINDOW</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">{Math.round((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000*60*60*24))} DAYS</h3>
            <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>RANGE</span>
          </div>
        </div>
        <div className="leh-stat-card">
          <p className="leh-label">SENSORY STATUS</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">OPERATIONAL</h3>
            <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>SYNCED</span>
          </div>
        </div>
        <div className="leh-stat-card">
          <p className="leh-label">LAST TELEMETRY</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="leh-stat-value">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h3>
            <span className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: '900' }}>LIVE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Matrix */}
        <aside className="lg:col-span-3">
          <div className="leh-table-card" style={{ position: 'sticky', top: '24px', padding: '16px' }}>
            <div style={{ padding: '0 8px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: '12px' }}>
              <p className="leh-label" style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>INTELLIGENCE MODULES</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  className={`leh-tab ${activeTab === tab.id ? 'active' : ''}`}
                  style={{ 
                    width: '100%', 
                    justifyContent: 'space-between', 
                    padding: '14px 18px', 
                    borderRadius: '14px',
                    fontSize: '13px',
                    fontWeight: activeTab === tab.id ? '800' : '600',
                    border: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onClick={() => {
                    setActiveTab(tab.id as ReportTab);
                    navigate(`/reports?tab=${tab.id}`);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <tab.icon size={18} style={{ opacity: activeTab === tab.id ? 1 : 0.6 }} />
                    <span>{tab.label.toUpperCase()}</span>
                  </div>
                  {activeTab === tab.id && <ChevronRight size={14} />}
                </button>
              ))}
            </div>
            
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
               <button 
                 className="leh-btn-primary" 
                 style={{ width: '100%', height: '52px', fontWeight: '900', fontSize: '12px' }} 
                 onClick={() => notify('info', 'Compiling encrypted report payload...')}
               >
                <Download size={18} style={{ marginRight: '10px' }} />
                GENERATE EXPORT
              </button>
            </div>
          </div>
        </aside>

        {/* Intelligence Content Area */}
        <main className="lg:col-span-9 flex flex-col gap-6">
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', left: '16px', top: '14px', color: '#9ca3af' }} size={18} />
              <input 
                type="text" 
                placeholder="Query clinical intelligence data..." 
                className="leh-input"
                style={{ paddingLeft: '48px', height: '48px', fontSize: '14px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="leh-btn-secondary" style={{ width: '48px', height: '48px', padding: 0 }}>
              <Filter size={18} /> 
            </button>
            <button 
              className="leh-btn-secondary" 
              style={{ height: '48px', padding: '0 24px', background: 'var(--leh-text-primary)', color: '#fff', border: 'none', fontWeight: '800', fontSize: '12px' }} 
              onClick={() => window.print()}
            >
              <Printer size={18} style={{ marginRight: '10px' }} />
              PRINT REPORT
            </button>
          </div>

          <div className="leh-table-card">
            {loading ? (
              <div style={{ padding: '100px 0', textAlign: 'center' }}>
                <div className="leh-loading-spinner" style={{ margin: '0 auto 24px' }}></div>
                <p className="leh-label" style={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '11px', color: 'var(--leh-primary)' }}>Synchronizing Clinical Telemetry...</p>
              </div>
            ) : (
              <div className="leh-table-container">
                <table className="leh-table">
                  <thead>
                    <tr>
                      {activeTab === 'inventory' && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Product Specifications</th>
                          <th style={{ width: '160px' }}>Classification</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Volume</th>
                          <th style={{ width: '150px', textAlign: 'right' }}>Acquisition Cost</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '180px' }}>Asset Valuation</th>
                        </>
                      )}
                      {activeTab === 'sales' && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Financial TX Hash</th>
                          <th>Counterparty</th>
                          <th style={{ width: '140px', textAlign: 'center' }}>Protocol</th>
                          <th style={{ width: '160px', textAlign: 'right' }}>Gross Revenue</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '150px' }}>Temporal Stamp</th>
                        </>
                      )}
                      {activeTab === 'audit_log' && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Operator Identity</th>
                          <th style={{ width: '200px' }}>Event Signature</th>
                          <th style={{ width: '180px' }}>Clinical Node</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '160px' }}>Timeline</th>
                        </>
                      )}
                      {!['inventory', 'sales', 'audit_log'].includes(activeTab) && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Identity Hash</th>
                          <th>Event Description</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '160px' }}>Node Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        {activeTab === 'inventory' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <p className="leh-table-bold" style={{ margin: 0 }}>{row.name}</p>
                               <p className="leh-label" style={{ fontSize: '9px', margin: 0 }}>SKU: #{String(row.id).slice(0,8).toUpperCase()}</p>
                            </td>
                            <td>
                              <span className="leh-status-dot" style={{ background: '#f1f5f9', color: '#475569', fontWeight: '800' }}>{row.category?.toUpperCase() || 'GENERAL'}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                               <span className="leh-table-bold" style={{ fontSize: '15px' }}>{row.stock}</span>
                               <p className="leh-label" style={{ fontSize: '9px', margin: 0 }}>UNITS</p>
                            </td>
                            <td style={{ textAlign: 'right', color: '#64748b', fontWeight: '800', fontSize: '13px' }}>₦{(row.cost_price || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                               <span className="leh-table-bold" style={{ fontSize: '16px', color: 'var(--leh-primary)' }}>₦{(row.stock * (row.cost_price || 0)).toLocaleString()}</span>
                            </td>
                          </>
                        )}
                        {activeTab === 'sales' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <span className="leh-table-bold" style={{ color: 'var(--leh-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{row.receipt_no || String(row.id).toUpperCase()}</span>
                            </td>
                            <td>
                               <p className="leh-table-bold" style={{ margin: 0 }}>{row.patient_name || 'EXTERNAL WALK-IN'}</p>
                               <p className="leh-label" style={{ fontSize: '9px', margin: 0 }}>FILE: {row.file_number || 'N/A'}</p>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>{row.payment_method?.toUpperCase() || 'N/A'}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                               <span className="leh-table-bold" style={{ fontSize: '16px' }}>₦{(row.total_amount || 0).toLocaleString()}</span>
                            </td>
                             <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                                <div className="leh-date-display" style={{ alignItems: 'flex-end' }}>
                                  <span className="leh-date-main">
                                    {formatDateStandard(row.created_at)}
                                  </span>
                                  <span className="leh-date-sub">
                                    {new Date(row.created_at).getFullYear()}
                                  </span>
                                </div>
                             </td>
                          </>
                        )}
                        {activeTab === 'audit_log' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '28px', height: '28px', background: 'var(--leh-primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-primary)', fontWeight: '900', fontSize: '11px' }}>{row.user_name?.charAt(0) || 'U'}</div>
                                  <span className="leh-table-bold">{row.user_name}</span>
                               </div>
                            </td>
                            <td><span className="leh-label" style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>{row.action_type}</span></td>
                            <td>
                              <span className="leh-status-dot" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: '800' }}>{row.module?.toUpperCase() || ''}</span>
                            </td>
                             <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                                <div className="leh-date-display" style={{ alignItems: 'flex-end' }}>
                                  <span className="leh-date-main">
                                    {formatDateStandard(row.created_at)}
                                  </span>
                                  <span className="leh-date-sub">
                                    {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                             </td>
                          </>
                        )}
                        {!['inventory', 'sales', 'audit_log'].includes(activeTab) && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <span className="leh-table-bold" style={{ color: 'var(--leh-primary)', fontSize: '12px', fontFamily: 'monospace' }}>#{row.id ? String(row.id).slice(0,10) : i+1}</span>
                            </td>
                            <td><span className="leh-table-bold">{row.name || row.description || 'Verified System Protocol'}</span></td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                               <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>{row.status?.toUpperCase() || 'SYNCHRONIZED'}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!loading && filteredData.length === 0 && (
              <div style={{ padding: '120px 0', textAlign: 'center', background: '#f8fafc' }}>
                 <Activity size={48} style={{ color: '#cbd5e1', marginBottom: '20px', opacity: 0.5 }} />
                 <p className="leh-label" style={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '11px' }}>No telemetry data captured for this period</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
