import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, 
  Eye, 
  RefreshCcw, 
  Save, 
  X, 
  Search, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Thermometer,
  Scale,
  Heart,
  Droplets,
  Stethoscope,
  Users,
  Zap,
  LayoutDashboard,
  Plus
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { PatientStatus } from '../constants/workflow';
import { LoadingSpinner } from '../components/LoadingSpinner';
import './Triage.css';

const VAInput = ({ placeholder, value, onChange }: any) => (
  <div className="va-field-redesign">
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="va-input-redesign"
    />
  </div>
);

const VitalField = ({ label, name, value, onChange, placeholder, unit, icon: Icon }: any) => (
  <div className="vital-field-redesign" title={`Enter ${label}`}>
    <label className="vital-label-redesign">
      {Icon && <Icon size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
      {label}
    </label>
    <div className="vital-input-wrap-redesign">
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="vital-input-redesign"
        aria-label={label}
      />
      {unit && (
        <span className="vital-unit-redesign">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const emptyForm = {
  bp_systolic: '', bp_diastolic: '',
  pulse_rate: '', temperature: '', weight: '',
  va_od_unaided: '', va_od_aided: '', va_od_pinhole: '',
  va_os_unaided: '', va_os_aided: '', va_os_pinhole: '',
  complaint: ''
};

export const Triage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [triageQueue, setTriageQueue] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    avgWaitTime: '0m',
    triagedToday: 0,
    urgentCases: 0
  });

  const loadQueue = useCallback(() => {
    setLoadingQueue(true);
    Promise.all([
      api.getTriageQueue(),
      api.getTriageStats()
    ])
      .then(([queueData, statsData]) => {
        const queue = Array.isArray(queueData) ? queueData.filter((p: any) => p.status === PatientStatus.WAITING_FOR_TRIAGE || p.status === 'Paid - Waiting for Triage' || p.status === 'Registered/Waiting') : [];
        setTriageQueue(queue);
        if (statsData) {
          setStats(statsData);
        }
      })
      .catch((err) => {
        console.error('Failed to load queue or stats:', err);
        notify('error', 'Failed to update clinical queue');
      })
      .finally(() => setLoadingQueue(false));
  }, [notify]);

  useEffect(() => { 
    loadQueue(); 
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVisitSelect = (visit: any) => {
    setSelectedVisit(visit);
    setFormData({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!selectedVisit) return;
    setIsSaving(true);
    try {
      await api.saveTriage({
        patient_id: selectedVisit.patient_id,
        visit_id: selectedVisit.id,
        ...formData,
        triaged_by: user?.full_name || user?.username
      });
      
      notify('success', `${selectedVisit.full_name} triage completed. Patient sent to consultation queue.`);
      setSelectedVisit(null);
      loadQueue();
    } catch (err: any) {
      notify('error', err.message || 'Submission failure');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header no-print">
        <div className="leh-header-left">
          <div className="leh-header-icon-box" style={{ background: 'var(--leh-amber)' }}>
            <Activity size={28} />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Vitals & Triage Terminal</h1>
            <p className="leh-page-subtitle">Clinical vitals recording • High-fidelity patient prioritization</p>
          </div>
        </div>

        <div className="leh-header-actions">
          <div className="leh-telemetry-pill">
             <span className="leh-telemetry-label">Session Status</span>
             <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
             <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>LIVE</span>
          </div>
          <div className="leh-input-group" style={{ width: '300px' }}>
            <Search size={18} className="leh-input-icon" />
            <input
              className="leh-input"
              placeholder="Filter triage queue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            className="leh-refresh-btn" 
            onClick={loadQueue}
            data-tooltip="Refresh patient clinical queue"
            aria-label="Refresh queue"
          >
            {loadingQueue ? <LoadingSpinner size="small" mode="button" /> : <RefreshCcw size={18} />}
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="no-print animate-slide-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="leh-stat-card blue" style={{ minHeight: 'auto', padding: '20px' }}>
          <div className="leh-stat-card-top" style={{ marginBottom: '8px' }}>
             <span className="leh-stat-title">Awaiting Triage</span>
             <div className="leh-stat-icon-box"><Users size={16} /></div>
          </div>
          <h3 className="leh-stat-value" style={{ fontSize: '24px', marginBottom: 0 }}>{triageQueue.length}</h3>
        </div>
        <div className="leh-stat-card amber" style={{ minHeight: 'auto', padding: '20px' }}>
          <div className="leh-stat-card-top" style={{ marginBottom: '8px' }}>
             <span className="leh-stat-title">Avg. Wait Time</span>
             <div className="leh-stat-icon-box"><Clock size={16} /></div>
          </div>
          <h3 className="leh-stat-value" style={{ fontSize: '24px', marginBottom: 0 }}>{stats.avgWaitTime}</h3>
        </div>
        <div className="leh-stat-card green" style={{ minHeight: 'auto', padding: '20px' }}>
          <div className="leh-stat-card-top" style={{ marginBottom: '8px' }}>
             <span className="leh-stat-title">Triaged Today</span>
             <div className="leh-stat-icon-box"><CheckCircle2 size={16} /></div>
          </div>
          <h3 className="leh-stat-value" style={{ fontSize: '24px', marginBottom: 0 }}>{stats.triagedToday}</h3>
        </div>
        <div className="leh-stat-card red" style={{ minHeight: 'auto', padding: '20px' }}>
          <div className="leh-stat-card-top" style={{ marginBottom: '8px' }}>
             <span className="leh-stat-title">Urgent Cases</span>
             <div className="leh-stat-icon-box"><Zap size={16} /></div>
          </div>
          <h3 className="leh-stat-value" style={{ fontSize: '24px', marginBottom: 0 }}>{stats.urgentCases}</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedVisit ? '420px 1fr' : '1fr', gap: '32px', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        
        {/* Patient Queue Panel */}
        <div className="leh-table-card no-print" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
           <div className="leh-table-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Users size={18} style={{ color: 'var(--leh-primary)' }} />
                <h3 className="leh-table-title" style={{ margin: 0, fontSize: '15px' }}>Clinical Queue</h3>
              </div>
              <span className="leh-status-dot blue" style={{ fontSize: '10px', fontWeight: '900' }}>{triageQueue.length} ENTIRES</span>
           </div>
           
           <div className="custom-scrollbar" style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
              {loadingQueue ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                   <LoadingSpinner size="medium" label="Loading clinical queue..." />
                </div>
              ) : triageQueue.length === 0 ? (
                <div style={{ padding: '80px 40px', textAlign: 'center', opacity: 0.3 }}>
                   <CheckCircle2 size={56} style={{ margin: '0 auto 16px', color: 'var(--leh-green)' }} />
                   <p style={{ fontWeight: '800', fontSize: '14px', letterSpacing: '0.05em' }}>CLEARED FOR NOW</p>
                   <p className="leh-label" style={{ fontSize: '11px', marginTop: '8px' }}>All registered patients have been processed</p>
                </div>
              ) : (
                triageQueue.filter(v => v.patient_name?.toLowerCase().includes(searchQuery.toLowerCase())).map(visit => (
                  <div 
                    key={visit.id}
                    onClick={() => handleVisitSelect(visit)}
                    className={`leh-table-row ${selectedVisit?.id === visit.id ? 'active' : ''}`}
                    style={{ 
                      padding: '20px 24px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      background: selectedVisit?.id === visit.id ? 'var(--leh-primary-light)' : 'transparent',
                      borderBottom: '1px solid var(--leh-border-light)',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                     {selectedVisit?.id === visit.id && (
                       <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--leh-primary)' }}></div>
                     )}
                     <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '12px', 
                          background: selectedVisit?.id === visit.id ? 'white' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: selectedVisit?.id === visit.id ? 'var(--leh-primary)' : '#64748b',
                          fontWeight: '800',
                          fontSize: '14px',
                          border: '1px solid',
                          borderColor: selectedVisit?.id === visit.id ? 'var(--leh-primary-light)' : 'transparent'
                        }}>
                           {visit.patient_name?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <span style={{ fontWeight: '800', color: selectedVisit?.id === visit.id ? 'var(--leh-primary)' : 'var(--leh-text-dark)', fontSize: '14px' }}>
                              {(visit.patient_name || '').toUpperCase()}
                           </span>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--leh-text-light)' }}>
                                 ID: #{visit.patient_id}
                              </span>
                              <span className="leh-status-dot" style={{ fontSize: '9px', fontWeight: '900', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '1px 6px' }}>
                                 {visit.department?.toUpperCase()}
                              </span>
                           </div>
                        </div>
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div className="leh-date-display" style={{ alignItems: 'flex-end' }}>
                           <span className="leh-date-main" style={{ fontSize: '11px', color: selectedVisit?.id === visit.id ? 'var(--leh-primary)' : 'inherit' }}>
                              {new Date(visit.checkin_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                           <span className="leh-date-sub" style={{ fontSize: '9px' }}>
                              {new Date(visit.checkin_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                           </span>
                        </div>
                        <ChevronRight size={16} style={{ color: selectedVisit?.id === visit.id ? 'var(--leh-primary)' : 'var(--leh-border)', transform: selectedVisit?.id === visit.id ? 'translateX(4px)' : 'none', transition: 'transform 0.2s' }} />
                     </div>
                  </div>
                ))
              )}
           </div>
           <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid var(--leh-border-light)' }}>
              <button className="leh-btn-secondary" style={{ width: '100%', height: '40px', justifyContent: 'center' }} onClick={() => navigate('/patients/register')}>
                <Plus size={16} />
                <span>REGISTER NEW PATIENT</span>
              </button>
           </div>
        </div>

        {/* Vitals Entry Panel */}
        {selectedVisit ? (
          <div className="leh-table-card animate-slide-up" style={{ background: 'white', display: 'flex', flexDirection: 'column' }}>
             <div className="leh-table-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Stethoscope size={24} />
                   </div>
                   <div>
                      <h2 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0 }}>Clinical Vitals Entry</h2>
                      <p style={{ fontSize: '13px', color: 'var(--leh-text-muted)', fontWeight: '600', margin: 0 }}>Recording telemetry for <span style={{ color: 'var(--leh-primary)' }}>{selectedVisit.patient_name}</span></p>
                   </div>
                </div>
                <button className="leh-refresh-btn" style={{ background: '#fef2f2', color: 'var(--leh-red)' }} onClick={() => setSelectedVisit(null)}>
                   <X size={20} />
                </button>
             </div>

             <div style={{ padding: '40px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                  {/* Vitals Core */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <VitalField label="BP SYSTOLIC" unit="mmHg" placeholder="120" name="bp_systolic" value={formData.bp_systolic} onChange={handleInputChange} icon={Droplets} />
                        <VitalField label="BP DIASTOLIC" unit="mmHg" placeholder="80" name="bp_diastolic" value={formData.bp_diastolic} onChange={handleInputChange} icon={Droplets} />
                     </div>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                        <VitalField label="PULSE RATE" unit="bpm" placeholder="72" name="pulse_rate" value={formData.pulse_rate} onChange={handleInputChange} icon={Heart} />
                        <VitalField label="TEMPERATURE" unit="°C" placeholder="36.5" name="temperature" value={formData.temperature} onChange={handleInputChange} icon={Thermometer} />
                        <VitalField label="BODY WEIGHT" unit="kg" placeholder="70" name="weight" value={formData.weight} onChange={handleInputChange} icon={Scale} />
                     </div>

                  </div>

                  {/* VA Assessment */}
                  <div>
                    <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '24px', border: '1px solid var(--leh-border-light)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                          <Eye size={18} style={{ color: 'var(--leh-primary)' }} />
                          <h3 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, letterSpacing: '0.05em' }}>VISUAL ACUITY PROTOCOL</h3>
                       </div>

                       <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '16px', alignItems: 'center' }}>
                             <span className="vital-label-redesign" style={{ padding: 0 }}>UNAIDED</span>
                             <VAInput placeholder="OD" value={formData.va_od_unaided} onChange={(e: any) => setFormData({...formData, va_od_unaided: e.target.value})} />
                             <VAInput placeholder="OS" value={formData.va_os_unaided} onChange={(e: any) => setFormData({...formData, va_os_unaided: e.target.value})} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '16px', alignItems: 'center' }}>
                             <span className="vital-label-redesign" style={{ padding: 0 }}>AIDED</span>
                             <VAInput placeholder="OD" value={formData.va_od_aided} onChange={(e: any) => setFormData({...formData, va_od_aided: e.target.value})} />
                             <VAInput placeholder="OS" value={formData.va_os_aided} onChange={(e: any) => setFormData({...formData, va_os_aided: e.target.value})} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '16px', alignItems: 'center' }}>
                             <span className="vital-label-redesign" style={{ padding: 0 }}>PINHOLE</span>
                             <VAInput placeholder="OD" value={formData.va_od_pinhole} onChange={(e: any) => setFormData({...formData, va_od_pinhole: e.target.value})} />
                             <VAInput placeholder="OS" value={formData.va_os_pinhole} onChange={(e: any) => setFormData({...formData, va_os_pinhole: e.target.value})} />
                          </div>
                       </div>

                       <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
                           <button 
                             className="leh-btn-primary" 
                             style={{ width: '100%', height: '56px', background: 'var(--leh-green)', fontSize: '14px', fontWeight: '800' }}
                             onClick={handleSave}
                             disabled={isSaving}
                           >
                             {isSaving ? (
                               <LoadingSpinner size="small" mode="button" label="Committing data..." color="white" />
                             ) : (
                               <>
                                 <Save size={22} style={{ marginRight: '12px' }} />
                                 <span>SUBMIT VITALS TO CONSULTANT</span>
                               </>
                             )}
                           </button>
                          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--leh-text-light)', marginTop: '16px', fontWeight: '600' }}>
                             Submitting will move this patient to the Clinical Pool
                          </p>
                       </div>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        ) : (
          <div className="leh-table-card" style={{ padding: '120px 40px', textAlign: 'center', background: '#f8fafc', borderStyle: 'dashed' }}>
             <div style={{ 
               width: '80px', 
               height: '80px', 
               borderRadius: '50%', 
               background: '#fff', 
               boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'center',
               color: 'var(--leh-border)',
               margin: '0 auto 24px'
             }}>
                <LayoutDashboard size={40} />
             </div>
             <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--leh-text-dark)', marginBottom: '8px' }}>Tactical Clinical Terminal</h3>
             <p className="leh-label" style={{ maxWidth: '400px', margin: '0 auto' }}>Select a patient from the operational queue on the left to begin clinical vitals recording and visual acuity assessment.</p>
          </div>
        )}
      </div>
    </div>
  );
};
