import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, 
  Search, 
  Eye, 
  Users,
  RefreshCcw,
  CheckCircle,
  Phone,
  MapPin,
  Calendar,
  History,
  FileText,
  User as UserIcon,
  ArrowLeft,
  Activity,
  CreditCard,
  Stethoscope
} from 'lucide-react';
import { api } from '../api';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { formatDateStandard } from '../utils/date';
import { PatientStatus, StatusLabels } from '../constants/workflow';
import { Modal } from '../components/Modal';
import { FileText as FileIcon, Printer, ClipboardList, Info } from 'lucide-react';

interface PatientsProps {
  view?: 'list' | 'profile' | 'checkin';
}

export const Patients: React.FC<PatientsProps> = ({ view: initialView = 'list' }) => {
  const navigate = useNavigate();
  const { id: urlId } = useParams();
  const { notify } = useNotification();
  const { user } = useAuth();
  
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Current patient context for profile/checkin sub-views
  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [clinicalHistory, setClinicalHistory] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Check-in state
  const [checkInLoading, setCheckInLoading] = useState<string | null>(null); // stores which action is loading

  // Consultation Details Modal State
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await api.getPatients();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      notify('error', 'Registry synchronization failed');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientContext = async (id: string) => {
    setViewLoading(true);
    try {
      const allPatients = await api.getPatients();
      const patient = allPatients.find((p: any) => String(p.id) === String(id));
      if (patient) {
        setCurrentPatient(patient);
        if (initialView === 'profile') {
          const history = await api.getConsultations(String(patient.id));
          setClinicalHistory(Array.isArray(history) ? history : []);
        }
      } else {
        notify('error', 'Patient record not found in registry');
        navigate('/patients');
      }
    } catch (err) {
      notify('error', 'Error resolving patient context');
    } finally {
      setViewLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (urlId && (initialView === 'profile' || initialView === 'checkin')) {
      loadPatientContext(urlId);
    }
  }, [urlId, initialView]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => 
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
    );
  }, [patients, searchTerm]);

  const calculateAge = (dob: string) => {
    if (!dob) return 'N/A';
    try {
      const birthDate = new Date(dob);
      const difference = Date.now() - birthDate.getTime();
      return Math.floor(difference / (1000 * 60 * 60 * 24 * 365.25));
    } catch (e) { return 'N/A'; }
  };

  // ─── Check-in Action Handler ──────────────────────────────────────────────
  // target: 'triage' | 'consultation' | 'billing'
  const handleCheckInAction = async (target: 'triage' | 'consultation' | 'billing') => {
    if (!currentPatient) return;
    setCheckInLoading(target);
    try {
      const result = await api.checkInPatient(String(currentPatient.id), target, user?.full_name);
      
      if (target === 'billing') {
        notify('success', `${currentPatient.full_name} routed to billing`);
        navigate(`/billing?patient_id=${encodeURIComponent(currentPatient.id)}&visit_id=${result.visit_id || ''}&patient_name=${encodeURIComponent(currentPatient.full_name)}`);
      } else {
        const destMsg = target === 'triage' 
          ? `${currentPatient.full_name} has been sent to the triage queue.` 
          : `${currentPatient.full_name} has been sent directly to the consultation queue.`;
        notify('success', destMsg);
        navigate('/patients');
      }
    } catch (err: any) {
      notify('error', err.message || 'Check-in failed');
    } finally {
      setCheckInLoading(null);
    }
  };

  // ─── Profile Sub-View ─────────────────────────────────────────────────────
  if (initialView === 'profile') {
    if (viewLoading) return (
      <div className="leh-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <RefreshCcw size={40} className="animate-spin" style={{ color: 'var(--leh-primary)' }} />
      </div>
    );
    if (!currentPatient) return null;
    const p = currentPatient;

    return (
      <div className="leh-page-container animate-fade-in">
        <header className="leh-page-header">
          <div className="leh-header-left">
            <Link to="/patients" className="leh-btn-outline" style={{ width: '42px', height: '42px', padding: 0 }}>
              <ArrowLeft size={20} />
            </Link>
            <div className="leh-header-text">
              <h1 className="leh-page-title">{(p.full_name || 'UNKNOWN').toUpperCase()}</h1>
              <p className="leh-page-subtitle">Patient Profile • File No. {p.id}</p>
            </div>
          </div>
          <div className="leh-header-actions">
            <Link to={`/patients/check-in/${encodeURIComponent(p.id)}`} className="leh-btn-primary">
              <CheckCircle size={20} />
              <span>CHECK-IN PATIENT</span>
            </Link>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px', alignItems: 'start' }}>
          <aside className="leh-table-card" style={{ padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '80px', height: '80px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <UserIcon size={40} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 8px 0' }}>{p.full_name}</h2>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <span className="leh-status-badge blue">{p.gender}</span>
                <span className="leh-status-badge grey">{calculateAge(p.dob)} YRS</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Phone size={15} style={{ color: 'var(--leh-primary)', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontWeight: '700', fontSize: '13px' }}>{p.phone || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <MapPin size={15} style={{ color: 'var(--leh-primary)', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--leh-text-muted)', lineHeight: '1.5' }}>{p.address || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Calendar size={15} style={{ color: 'var(--leh-primary)', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--leh-text-muted)' }}>DOB: {p.dob ? formatDateStandard(p.dob) : 'N/A'}</span>
              </div>
            </div>
            {(p.blood_group || p.allergies) && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {p.blood_group && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="leh-label">Blood Group</span><span style={{ fontWeight: '900', color: '#ef4444' }}>{p.blood_group}</span></div>}
                {p.allergies && <div><span className="leh-label" style={{ display: 'block', marginBottom: '4px' }}>Allergies</span><span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700' }}>{p.allergies}</span></div>}
              </div>
            )}
          </aside>

          <main className="leh-table-card">
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <History size={20} style={{ color: 'var(--leh-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Consultation History</h3>
              <span className="leh-status-badge grey" style={{ marginLeft: 'auto' }}>{clinicalHistory.length} records</span>
            </div>
            <div className="leh-table-container">
              <table className="leh-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '24px' }}>DATE</th>
                    <th>COMPLAINT</th>
                    <th>CONSULTANT</th>
                    <th>DIAGNOSIS</th>
                    <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicalHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '80px', textAlign: 'center' }}>
                        <FileText size={48} style={{ color: '#cbd5e1', marginBottom: '16px', opacity: 0.5 }} />
                        <p className="leh-label">No consultation records found</p>
                      </td>
                    </tr>
                  ) : (
                    clinicalHistory.map((h: any) => (
                      <tr key={h.id} className="leh-table-row">
                        <td style={{ paddingLeft: '24px' }}>{formatDateStandard(h.created_at)}</td>
                        <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.chief_complaint || h.complaint || 'N/A'}</td>
                        <td className="leh-label">{h.consultant_name || 'N/A'}</td>
                        <td className="leh-label">{h.primary_diagnosis || '—'}</td>
                        <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                          {['admin', 'optometrist', 'consultant', 'doctor'].includes((user?.role || '').toLowerCase()) ? (
                            <button 
                              className="leh-btn-outline" 
                              style={{ height: '32px', padding: '0 10px', borderRadius: '8px', fontSize: '11px', color: 'var(--leh-primary)' }}
                              onClick={() => {
                                setSelectedConsultation(h);
                                setShowHistoryModal(true);
                              }}
                            >
                              <Eye size={12} />
                              <span>DETAILS</span>
                            </button>
                          ) : (
                            <span className="leh-label" style={{ fontSize: '10px', opacity: 0.5 }}>Restricted</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>

        {/* CONSULTATION HISTORY DETAILS MODAL */}
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title="Clinical Consultation Details"
          maxWidth="900px"
          icon={<ClipboardList size={24} style={{ color: 'var(--leh-primary)' }} />}
        >
          {selectedConsultation && (() => {
            const h = selectedConsultation;
            let clinicalData: any = {};
            try {
              clinicalData = typeof h.clinical_data === 'string' ? JSON.parse(h.clinical_data) : (h.clinical_data || {});
            } catch (e) { console.error('Failed to parse clinical data', e); }

            return (
              <div style={{ padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px', background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Visit Date</p>
                    <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>{formatDateStandard(h.created_at)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Consulting Clinician</p>
                    <p style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: 'var(--leh-primary)' }}>{h.consultant_name || 'System record'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {/* Section: Complaint */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Info size={16} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chief Complaint & History</h4>
                    </div>
                    <div className="leh-table-card" style={{ padding: '20px', background: 'white' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.6' }}><strong>Complaint:</strong> {h.complaint || 'No complaint recorded.'}</p>
                      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#475569' }}><strong>Clinical History:</strong> {clinicalData.clinical_notes || 'No additional history recorded.'}</p>
                    </div>
                  </section>

                  {/* Section: Vitals & VA */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Activity size={16} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Baseline Vitals</h4>
                      </div>
                      <div className="leh-table-card" style={{ padding: '20px', background: 'white', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                         <div><span className="leh-label" style={{ fontSize: '11px' }}>BP</span><p style={{ margin: 0, fontWeight: '800' }}>{h.bp || 'N/A'}</p></div>
                         <div><span className="leh-label" style={{ fontSize: '11px' }}>IOP (OD/OS)</span><p style={{ margin: 0, fontWeight: '800' }}>{h.iop_od || '-'}/{h.iop_os || '-'} <small>{clinicalData.iop_method}</small></p></div>
                      </div>
                    </section>

                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Eye size={16} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Acuity</h4>
                      </div>
                      <div className="leh-table-card" style={{ padding: '0', background: 'white', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Eye</th>
                              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Unaided</th>
                              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Pinhole</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}><strong>OD</strong></td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{h.va_od_unaided || '-'}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{h.va_od_pinhole || '-'}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px' }}><strong>OS</strong></td>
                              <td style={{ padding: '8px' }}>{h.va_os_unaided || '-'}</td>
                              <td style={{ padding: '8px' }}>{h.va_os_pinhole || '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  {/* Section: Diagnosis & Management */}
                  <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Stethoscope size={16} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis & Management Plan</h4>
                    </div>
                    <div className="leh-table-card" style={{ padding: '24px', background: 'white', borderLeft: '4px solid #10b981' }}>
                      <div style={{ marginBottom: '20px' }}>
                         <span className="leh-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Primary Diagnosis</span>
                         <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#065f46' }}>{h.primary_diagnosis || 'No diagnosis recorded.'}</p>
                         {h.diagnosis_notes && <p style={{ margin: '8px 0 0 0', fontSize: '13px', fontStyle: 'italic', color: '#64748b' }}>"{h.diagnosis_notes}"</p>}
                      </div>
                      <div>
                         <span className="leh-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Management Plan</span>
                         <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{h.management_plan || 'N/A'}</p>
                      </div>
                    </div>
                  </section>

                  {/* Section: Medications if any */}
                  {clinicalData.plan_meds && clinicalData.plan_meds.length > 0 && (
                    <section>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ClipboardList size={16} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescribed Medications</h4>
                      </div>
                      <div className="leh-table-card" style={{ padding: '0', background: 'white', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#fef2f2' }}>
                              <th style={{ padding: '12px', textAlign: 'left' }}>Medication</th>
                              <th style={{ padding: '12px', textAlign: 'left' }}>Dosage</th>
                              <th style={{ padding: '12px', textAlign: 'left' }}>Frequency</th>
                              <th style={{ padding: '12px', textAlign: 'left' }}>Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicalData.plan_meds.map((med: any, idx: number) => (
                              <tr key={idx} style={{ borderTop: '1px solid #fee2e2' }}>
                                <td style={{ padding: '12px', fontWeight: '700' }}>{med.drug_name} {med.strength}</td>
                                <td style={{ padding: '12px' }}>{med.dose}</td>
                                <td style={{ padding: '12px' }}>{med.frequency}</td>
                                <td style={{ padding: '12px' }}>{med.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>

                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="leh-btn-outline" onClick={() => setShowHistoryModal(false)}>CLOSE</button>
                  <button className="leh-btn-primary" onClick={() => window.print()}>
                    <Printer size={18} />
                    <span>PRINT RECORD</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    );
  }

  // ─── Check-In Sub-View ────────────────────────────────────────────────────
  if (initialView === 'checkin') {
    if (viewLoading) return (
      <div className="leh-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <RefreshCcw size={40} className="animate-spin" style={{ color: 'var(--leh-primary)' }} />
      </div>
    );
    if (!currentPatient) return null;
    const p = currentPatient;

    const actions = [
      {
        key: 'triage' as const,
        label: 'Route to Triage',
        description: 'Send patient to nursing for vitals, VA, and preliminary assessment',
        icon: Activity,
        color: 'var(--leh-primary)',
        bgColor: 'var(--leh-primary-light)',
        borderColor: '#dbeafe'
      },
      {
        key: 'consultation' as const,
        label: 'Direct Consultation',
        description: 'Bypass triage and send patient directly to the doctor\'s consultation queue',
        icon: Stethoscope,
        color: 'var(--leh-green)',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0'
      },
      {
        key: 'billing' as const,
        label: 'Bill First',
        description: 'Direct patient to cash point for payment before clinical assessment',
        icon: CreditCard,
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        borderColor: '#ddd6fe'
      }
    ];

    return (
      <div className="leh-page-container animate-fade-in">
        <header className="leh-page-header">
          <div className="leh-header-left">
            <Link to="/patients" className="leh-btn-outline" style={{ width: '42px', height: '42px', padding: 0 }}>
              <ArrowLeft size={20} />
            </Link>
            <div className="leh-header-text">
              <h1 className="leh-page-title">{p.full_name} (#{p.id})</h1>
              <p className="leh-page-subtitle">Select next action for this patient</p>
            </div>
          </div>
          <Link to={`/patients/profile/${encodeURIComponent(p.id)}`} className="leh-btn-outline">
            <Eye size={18} />
            <span>VIEW FULL PROFILE</span>
          </Link>
        </header>

        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {/* Patient card */}
          <div className="leh-table-card" style={{ padding: '28px 32px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '60px', height: '60px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserIcon size={30} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px 0', color: 'var(--leh-text-dark)' }}>{p.full_name}</p>
              <p className="leh-label" style={{ margin: 0, fontSize: '12px' }}>
                File No: <strong>{p.id}</strong> &nbsp;•&nbsp; {p.gender} &nbsp;•&nbsp; {calculateAge(p.dob)} yrs &nbsp;•&nbsp; {p.phone}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {p.allergies && <span className="leh-status-badge red" style={{ fontSize: '10px' }}>⚠ ALLERGIES</span>}
              {p.blood_group && <p style={{ fontSize: '11px', fontWeight: '900', color: '#ef4444', margin: '4px 0 0 0' }}>{p.blood_group}</p>}
            </div>
          </div>

          {/* Action Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              Select Destination
            </p>
            {actions.map(action => {
              const Icon = action.icon;
              const isLoading = checkInLoading === action.key;
              return (
                <button
                  key={action.key}
                  onClick={() => handleCheckInAction(action.key)}
                  disabled={checkInLoading !== null}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '24px 28px',
                    background: checkInLoading ? '#f8fafc' : action.bgColor,
                    border: `2px solid ${checkInLoading ? '#e2e8f0' : action.borderColor}`,
                    borderRadius: '16px',
                    cursor: checkInLoading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.2s',
                    opacity: checkInLoading && !isLoading ? 0.5 : 1
                  }}
                >
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: checkInLoading ? '#e2e8f0' : action.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isLoading ? <RefreshCcw size={24} className="animate-spin" /> : <Icon size={24} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '16px', fontWeight: '900', color: checkInLoading ? 'var(--leh-text-muted)' : action.color, margin: '0 0 4px 0' }}>
                      {isLoading ? 'Processing...' : action.label}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--leh-text-muted)', margin: 0, lineHeight: '1.5' }}>
                      {action.description}
                    </p>
                  </div>
                  {!isLoading && !checkInLoading && (
                    <div style={{ color: action.color, fontWeight: '900', fontSize: '20px' }}>→</div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link to="/patients" className="leh-btn-outline" style={{ border: 'none', color: 'var(--leh-text-muted)', fontWeight: '700' }}>
              Cancel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main List View ───────────────────────────────────────────────────────
  return (
    <div className="leh-page-container">
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box"><Users size={32} /></div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Patient Registry</h1>
            <p className="leh-page-subtitle">Centralized medical records & visit management</p>
          </div>
        </div>
        <div className="leh-header-actions">
          <div className="leh-search-box" style={{ width: '320px' }}>
            <Search size={18} className="leh-search-icon" />
            <input
              placeholder="Search by name, file no, or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              spellCheck={false}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="leh-search-clear" type="button">
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
              </button>
            )}
          </div>
          <Link to="/patients/register" className="leh-btn-primary">
            <UserPlus size={20} />
            <span>REGISTER PATIENT</span>
          </Link>
        </div>
      </header>

      <div className="leh-table-wrapper">
        <table className="leh-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '24px' }}>FILE NO.</th>
              <th>FULL NAME</th>
              <th>GENDER / AGE</th>
              <th>PHONE</th>
              <th>VISIT STATUS</th>
              <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <RefreshCcw size={40} className="animate-spin" style={{ color: 'var(--leh-primary)' }} />
                    <p className="leh-label">Loading patient registry...</p>
                  </div>
                </td>
              </tr>
            ) : filteredPatients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                  <div style={{ opacity: 0.3 }}>
                    <Users size={64} style={{ margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ fontWeight: '800', textTransform: 'uppercase' }}>No records found</p>
                  </div>
                </td>
              </tr>
            ) : filteredPatients.map(patient => (
                <tr key={patient.id} className="leh-table-row">
                  <td style={{ paddingLeft: '24px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: '900', color: 'var(--leh-primary)', background: 'var(--leh-primary-light)', padding: '5px 12px', borderRadius: '8px', fontSize: '11px' }}>
                      {patient.id}
                    </span>
                  </td>
                  <td style={{ fontWeight: '800', color: 'var(--leh-text-dark)' }}>{patient.full_name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`leh-status-badge ${patient.gender === 'Male' ? 'blue' : 'red'}`} style={{ fontSize: '10px' }}>{patient.gender}</span>
                      <span className="leh-label">{calculateAge(patient.dob)} yrs</span>
                    </div>
                  </td>
                  <td className="leh-label">{patient.phone || '—'}</td>
                  <td>
                    <span className={`leh-status-badge ${(() => {
                      const s = patient.current_status as PatientStatus;
                      if (!s) return 'gray';
                      if (s === PatientStatus.WAITING_FOR_TRIAGE) return 'blue';
                      if (s === PatientStatus.IN_TRIAGE) return 'blue';
                      if (s === PatientStatus.WAITING_FOR_CONSULTATION) return 'amber';
                      if (s === PatientStatus.IN_CONSULTATION) return 'green';
                      if (s === PatientStatus.CONSULTATION_COMPLETE) return 'green';
                      if (s === PatientStatus.AWAITING_BILLING) return 'red';
                      if (s === PatientStatus.PAID) return 'green';
                      if (s === PatientStatus.ADMITTED) return 'purple';
                      return 'green';
                    })()}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {patient.current_status ? (StatusLabels[patient.current_status as PatientStatus] || patient.current_status) : 'No Active Visit'}
                    </span>
                  </td>
                  <td style={{ paddingRight: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <Link
                        to={`/patients/profile/${encodeURIComponent(patient.id)}`}
                        className="leh-btn-outline"
                        style={{ height: '36px', padding: '0 14px', borderRadius: '10px' }}
                        data-tooltip={`View Profile for ${patient.full_name}`}
                        aria-label="View Patient Profile"
                      >
                        <Eye size={15} /><span style={{ fontSize: '12px' }}>VIEW</span>
                      </Link>
                      
                      {(() => {
                        const s = patient.current_status as PatientStatus;
                        
                        // 1. DISCHARGED -> Only View
                        if (s === PatientStatus.DISCHARGED) return null;

                        // 2. Already in clinical workflow -> Disabled Grey
                        const isInQueue = [
                          PatientStatus.WAITING_FOR_TRIAGE,
                          PatientStatus.WAITING_FOR_CONSULTATION,
                          PatientStatus.IN_CONSULTATION,
                          PatientStatus.CONSULTATION_COMPLETE
                        ].includes(s as any);

                        if (isInQueue) {
                          return (
                            <button
                              disabled
                              className="leh-btn-outline"
                              title="Patient already in queue"
                              style={{ 
                                height: '36px', padding: '0 14px', borderRadius: '10px', 
                                opacity: 0.6, cursor: 'not-allowed', 
                                color: '#94a3b8', borderColor: '#e2e8f0', background: '#f8fafc' 
                              }}
                            >
                              <CheckCircle size={15} /><span style={{ fontSize: '12px' }}>CHECK-IN</span>
                            </button>
                          );
                        }

                        // 3. Post-Billing -> Send to Triage (Amber)
                        const isPostBilling = s === PatientStatus.AWAITING_BILLING || s === PatientStatus.PAID;
                        if (isPostBilling) {
                          return (
                            <Link
                              to={`/patients/check-in/${encodeURIComponent(patient.id)}`}
                              className="leh-btn-primary"
                              style={{ height: '36px', padding: '0 14px', borderRadius: '10px', background: '#f59e0b', border: 'none' }}
                              data-tooltip="Send patient to Triage Queue"
                            >
                              <CheckCircle size={15} /><span style={{ fontSize: '12px' }}>SEND TO TRIAGE</span>
                            </Link>
                          );
                        }

                        // 4. REGISTERED or No active visit -> Normal Check-In
                        return (
                          <Link
                            to={`/patients/check-in/${encodeURIComponent(patient.id)}`}
                            className="leh-btn-primary"
                            style={{ height: '36px', padding: '0 14px', borderRadius: '10px' }}
                            data-tooltip="Start Check-in Process"
                          >
                            <CheckCircle size={15} /><span style={{ fontSize: '12px' }}>CHECK-IN</span>
                          </Link>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};
