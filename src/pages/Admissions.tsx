import React, { useState, useEffect } from 'react';
import { 
  BedDouble, UserMinus, PlusCircle, Save, Calendar, Printer, Clock, RefreshCw, Search, Shield, X, CheckCircle
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDateStandard } from '../utils/date';
import { LiveSearch } from '../components/LiveSearch';
import { useNotification } from '../context/NotificationContext';
import { printElementId } from '../utils/printHelpers';

export const Admissions: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'admitted' | 'discharged'>('admitted');
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [newAdmission, setNewAdmission] = useState({
    patient_id: '',
    ward_name: '',
    bed_number: '',
    reason: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      setRefreshing(true);
      const statusQuery = activeTab === 'admitted' ? 'Admitted' : 'Discharged';
      const [admData, patData, wrdData] = await Promise.all([
        api.getAdmissions(statusQuery),
        api.getPatients(),
        api.getWards()
      ]);
      setAdmissions(admData);
      setPatients(patData);
      setWards(wrdData);
      if (wrdData.length > 0 && !newAdmission.ward_name) {
        setNewAdmission(prev => ({ ...prev, ward_name: wrdData[0].name }));
      }
    } catch (err: any) {
      notify('error', 'Failed to load admission records: ' + (err.message || 'Connection error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelectedAdmission(null);

    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patient_id');
    if (pid) {
      setNewAdmission(prev => ({ ...prev, patient_id: pid }));
      setIsAdmitting(true);
    }
  }, [activeTab]);

  const calculateStay = (admissionDate: string, dischargeDate?: string) => {
    const start = new Date(admissionDate);
    const end = dischargeDate ? new Date(dischargeDate) : new Date();
    const diff = Math.max(0, end.getTime() - start.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days || 1;
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmission.patient_id) {
      notify('error', 'Please select a patient from the search results first');
      return;
    }
    if (!newAdmission.bed_number || !newAdmission.reason) {
      notify('error', 'Please fill in all required fields');
      return;
    }
    
    try {
      await api.createAdmission({
        ...newAdmission,
        admitting_doctor: user?.full_name || 'System'
      });
      notify('success', 'Patient admitted to ward successfully');
      setIsAdmitting(false);
      setNewAdmission({ patient_id: '', ward_name: wards[0]?.name || '', bed_number: '', reason: '', notes: '' });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Failed to admit patient');
    }
  };

  const handleUpdateNotes = async () => {
    if (!selectedAdmission) return;
    try {
      await api.updateAdmission(selectedAdmission.id, { notes: selectedAdmission.notes });
      notify('success', 'Clinical progress notes synchronized');
    } catch (err: any) {
      notify('error', 'Failed to update notes');
    }
  };

  const handleDischarge = async () => {
    if (!selectedAdmission) return;
    try {
      await api.dischargePatient(selectedAdmission.id, dischargeSummary);
      notify('success', 'Patient clinical discharge complete');
      setShowDischargeModal(false);
      loadData();
    } catch (err: any) {
      notify('error', 'Failed to discharge patient');
    }
  };

  const filteredAdmissions = admissions.filter(adm => 
    adm.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    adm.patient_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="leh-page-container">
      <div className="leh-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="leh-page-title">In-Patient Admission Center</h1>
            <p className="leh-page-subtitle">Manage hospital ward occupancy, clinical stay monitoring, and discharge protocols</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={loadData} 
              className="leh-btn-outline" 
              style={{ height: '42px' }}
              data-tooltip="Sync ward occupancy and patient records"
              aria-label="Refresh records"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> REFRESH
            </button>
            <button 
              onClick={() => setIsAdmitting(!isAdmitting)} 
              className="leh-btn-primary" 
              style={{ height: '42px' }}
              data-tooltip={isAdmitting ? "Return to active patient registry" : "Initialize new hospital admission protocol"}
            >
              <PlusCircle size={14} /> {isAdmitting ? 'BACK TO REGISTRY' : 'INITIALIZE ADMISSION'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left Grid: Admission Registry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="leh-table-card" style={{ padding: '8px' }}>
             <div style={{ display: 'flex', gap: '4px' }}>
               <button 
                 onClick={() => setActiveTab('admitted')}
                 style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: activeTab === 'admitted' ? 'var(--leh-primary-light)' : 'transparent', color: activeTab === 'admitted' ? 'var(--leh-primary)' : 'var(--leh-text-muted)', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
               >
                 CURRENTLY ADMITTED
               </button>
               <button 
                 onClick={() => setActiveTab('discharged')}
                 style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: activeTab === 'discharged' ? 'var(--leh-primary-light)' : 'transparent', color: activeTab === 'discharged' ? 'var(--leh-primary)' : 'var(--leh-text-muted)', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
               >
                 DISCHARGE LOGS
               </button>
             </div>
          </div>

          <div className="leh-table-card">
            <div style={{ padding: '24px', borderBottom: '1px solid var(--leh-border-light)' }}>
              <div className="leh-search-box">
                <Search size={18} className="leh-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search admitted patients..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  spellCheck={false}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="leh-search-clear" type="button">
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><RefreshCw className="animate-spin" style={{ color: 'var(--leh-primary)' }} /></div>
              ) : filteredAdmissions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }} className="leh-label">No admission records found</div>
              ) : (
                filteredAdmissions.map(adm => (
                  <div 
                    key={adm.id} 
                    onClick={() => setSelectedAdmission(adm)}
                    style={{ 
                      padding: '20px 24px', 
                      borderBottom: '1px solid var(--leh-border-light)', 
                      cursor: 'pointer',
                      background: selectedAdmission?.id === adm.id ? 'var(--leh-primary-light)' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span className="leh-table-bold" style={{ fontSize: '14px' }}>{adm.patient_name}</span>
                      <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--leh-primary)', background: 'white', padding: '2px 8px', borderRadius: '99px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        BED {adm.bed_number}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="leh-label" style={{ fontSize: '11px' }}>{adm.ward_name}</span>
                      <span className="leh-label" style={{ fontSize: '10px', fontWeight: '800' }}>
                        <Clock size={10} style={{ marginRight: '4px' }} /> 
                        {calculateStay(adm.admission_date)} DAYS
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Grid: Workspace */}
        <div style={{ flex: 1 }}>
          {isAdmitting ? (
            <div className="leh-table-card" style={{ padding: '40px' }}>
              <div style={{ marginBottom: '32px' }}>
                <h2 className="leh-table-title" style={{ fontSize: '22px', marginBottom: '8px' }}>Patient Admission Protocol</h2>
                <p className="leh-label">Authorize a new in-patient stay by selecting an active patient and allocating ward resources.</p>
              </div>

              <form onSubmit={handleAdmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div className="leh-form-group">
                  <label className="leh-label">TARGET PATIENT ENTITY</label>
                  <LiveSearch 
                    placeholder="Search clinical registry by name or ID..."
                    data={patients}
                    searchFields={['full_name', 'patient_id']}
                    onSelect={(p) => setNewAdmission({...newAdmission, patient_id: p.patient_id})}
                    renderItem={(p) => (
                      <div style={{ padding: '12px 16px' }}>
                        <p className="leh-table-bold" style={{ margin: 0 }}>{p.full_name}</p>
                        <p className="leh-label" style={{ fontSize: '10px', margin: 0 }}>HOSPITAL ID: {p.patient_id}</p>
                      </div>
                    )}
                  />
                  {newAdmission.patient_id && (
                    <div style={{ marginTop: '12px', padding: '12px 16px', background: 'var(--leh-primary-light)', borderRadius: '12px', border: '1px solid var(--leh-primary)', color: 'var(--leh-primary)', fontWeight: '800', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={14} /> TARGET SELECTED: {newAdmission.patient_id}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="leh-form-group">
                    <label className="leh-label">WARD ALLOCATION</label>
                    <select 
                      className="leh-select" 
                      style={{ height: '56px', fontWeight: '800' }}
                      value={newAdmission.ward_name} 
                      onChange={e => setNewAdmission({...newAdmission, ward_name: e.target.value})}
                    >
                      {wards.map(w => <option key={w.id} value={w.name}>{w.name.toUpperCase()} (Capacity: {w.capacity || 'N/A'})</option>)}
                    </select>
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">BED DESIGNATION</label>
                    <input 
                      className="leh-input" 
                      style={{ height: '56px', fontWeight: '800' }}
                      placeholder="e.g. BD-402"
                      value={newAdmission.bed_number} 
                      onChange={e => setNewAdmission({...newAdmission, bed_number: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="leh-form-group">
                  <label className="leh-label">CLINICAL INDICATION FOR ADMISSION</label>
                  <textarea 
                    className="leh-textarea" 
                    style={{ minHeight: '120px' }}
                    placeholder="Describe the primary reason for hospitalization..."
                    value={newAdmission.reason} 
                    onChange={e => setNewAdmission({...newAdmission, reason: e.target.value})} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px', paddingTop: '32px', borderTop: '1px solid var(--leh-border-light)' }}>
                  <button type="button" className="leh-btn-outline" style={{ height: '56px', padding: '0 40px' }} onClick={() => setIsAdmitting(false)}>CANCEL PROTOCOL</button>
                  <button 
                    type="submit" 
                    className="leh-btn-primary" 
                    style={{ height: '56px', padding: '0 40px', fontWeight: '900' }}
                    data-tooltip="Commit admission record to database"
                    aria-label="Authorize admission"
                  >
                    <Shield size={18} style={{ marginRight: '10px' }} /> AUTHORIZE ADMISSION
                  </button>
                </div>
              </form>
            </div>
          ) : !selectedAdmission ? (
            <div className="leh-table-card" style={{ height: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '80px', height: '80px', background: 'var(--leh-bg-light)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-text-light)', marginBottom: '24px' }}>
                <BedDouble size={40} />
              </div>
              <h2 className="leh-table-title">Select Admission Record</h2>
              <p className="leh-label" style={{ maxWidth: '300px' }}>Please choose a patient from the registry to view clinical progress, daily notes, and discharge options.</p>
            </div>
          ) : (
            <div className="leh-table-card">
              <div id="print-admissions-area">
                <div style={{ padding: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                    <div>
                      <h2 className="leh-table-title" style={{ fontSize: '28px', marginBottom: '8px' }}>{selectedAdmission.patient_name}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="leh-label" style={{ fontWeight: '800' }}>ID: {selectedAdmission.patient_id}</span>
                        <span style={{ color: 'var(--leh-border)' }}>|</span>
                        <span className={`leh-badge ${selectedAdmission.status === 'Admitted' ? 'leh-badge-green' : 'leh-badge-blue'}`}>{selectedAdmission.status.toUpperCase()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="leh-btn-outline" style={{ height: '44px' }} onClick={() => printElementId('print-admissions-area', `Case_Summary_${selectedAdmission.patient_name}`)}>
                        <Printer size={16} /> PRINT CASE
                      </button>
                      {activeTab === 'admitted' && (
                        <button className="leh-btn-primary" style={{ height: '44px', background: 'var(--leh-red)' }} onClick={() => {
                          setDischargeSummary(selectedAdmission.notes || '');
                          setShowDischargeModal(true);
                        }}>
                          <UserMinus size={16} /> DISCHARGE
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mb-32">
                    <div style={{ padding: '24px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                      <p className="leh-label" style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>Ward Allocation</p>
                      <p className="leh-table-bold" style={{ fontSize: '20px', margin: 0 }}>{selectedAdmission.ward_name}</p>
                      <p className="leh-label" style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-primary)', margin: '4px 0 0' }}>BED: {selectedAdmission.bed_number}</p>
                    </div>
                    <div style={{ padding: '24px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                      <p className="leh-label" style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>Attending Specialist</p>
                      <p className="leh-table-bold" style={{ fontSize: '20px', margin: 0 }}>{selectedAdmission.admitting_doctor}</p>
                      <p className="leh-label" style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-green)', margin: '4px 0 0' }}>AUTHORIZED ACCESS</p>
                    </div>
                    <div style={{ padding: '24px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                      <p className="leh-label" style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>Stay Duration</p>
                      <p className="leh-table-bold" style={{ fontSize: '20px', margin: 0 }}>{calculateStay(selectedAdmission.admission_date)} Clinical Days</p>
                      <p className="leh-label" style={{ fontSize: '12px', fontWeight: '800', margin: '4px 0 0' }}>From {formatDateStandard(selectedAdmission.admission_date)}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ padding: '24px', background: 'var(--leh-primary-light)', borderRadius: '24px', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                      <h3 className="leh-label" style={{ fontSize: '11px', fontWeight: '900', color: 'var(--leh-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={14} /> PRIMARY CLINICAL INDICATION
                      </h3>
                      <p className="leh-table-bold" style={{ fontSize: '17px', lineHeight: '1.6', margin: 0 }}>{selectedAdmission.reason}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label className="leh-label" style={{ fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                        <Calendar size={14} style={{ color: 'var(--leh-primary)' }} /> DAILY PROGRESS & CLINICAL OBSERVATIONS
                      </label>
                      <textarea 
                        className="leh-textarea" 
                        style={{ minHeight: '400px', padding: '32px', fontSize: '15px', lineHeight: '1.8', borderRadius: '32px', background: '#f8fafc' }}
                        value={selectedAdmission.notes || ''}
                        onChange={e => setSelectedAdmission({...selectedAdmission, notes: e.target.value})}
                        disabled={activeTab === 'discharged'}
                        placeholder="Record physician rounds, nursing observations, and recovery milestones..."
                      ></textarea>
                      
                      {activeTab === 'admitted' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                          <button className="leh-btn-primary" style={{ height: '56px', padding: '0 40px', fontWeight: '900', background: '#1e293b' }} onClick={handleUpdateNotes}>
                            <Save size={18} style={{ marginRight: '10px' }} /> UPDATE CASE FILE
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discharge Confirmation Modal */}
      {showDischargeModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '600px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <UserMinus style={{ color: 'var(--leh-red)' }} />
                <span>Finalize Clinical Discharge</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowDischargeModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', padding: '20px', background: 'var(--leh-bg-light)', borderRadius: '20px', border: '1px solid var(--leh-border-light)' }}>
                <div style={{ width: '56px', height: '56px', background: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <BedDouble size={28} />
                </div>
                <div>
                  <p className="leh-label" style={{ fontSize: '11px', marginBottom: '4px' }}>PATIENT UNDER REVIEW</p>
                  <p className="leh-table-bold" style={{ fontSize: '18px', margin: 0 }}>{selectedAdmission?.patient_name}</p>
                  <p className="leh-label" style={{ fontSize: '12px' }}>WARD: {selectedAdmission?.ward_name} • BED: {selectedAdmission?.bed_number}</p>
                </div>
              </div>

              <div className="leh-form-section" style={{ border: 'none', padding: 0, margin: 0 }}>
                <h4 className="leh-form-section-title">Discharge Protocol</h4>
                <div className="leh-form-group">
                  <label className="leh-label">FINAL SUMMARY & RECOVERY INSTRUCTIONS</label>
                  <textarea
                    className="leh-textarea"
                    style={{ minHeight: '200px', paddingTop: '16px', fontSize: '15px' }}
                    value={dischargeSummary}
                    onChange={(e) => setDischargeSummary(e.target.value)}
                    placeholder="Provide detailed instructions for home care, medication schedules, and follow-up clinical appointments..."
                    autoFocus
                    required
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="leh-modal-footer">
              <button type="button" className="leh-btn-outline" style={{ height: '52px', padding: '0 32px' }} onClick={() => setShowDischargeModal(false)}>CANCEL</button>
              <button type="button" className="leh-btn-primary" style={{ height: '52px', padding: '0 32px', background: 'var(--leh-red)' }} onClick={handleDischarge}>
                <CheckCircle size={18} />
                <span>AUTHORIZE CLINICAL DISCHARGE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
