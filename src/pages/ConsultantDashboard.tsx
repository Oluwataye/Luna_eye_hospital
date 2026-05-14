import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Stethoscope, FlaskConical, BedDouble, 
  Clock, ArrowRight, RefreshCcw, Activity, ClipboardList, Zap
} from 'lucide-react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { GreetingBanner } from '../components/GreetingBanner';
import { StatCard } from '../components/StatCard';

export const ConsultantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [queueStats, setQueueStats] = useState<any>({
    waiting_for_consultation: [],
    consulting: [],
    admitted: [],
    total_today: 0
  });
  const [pendingInvestigations, setPendingInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [qRes, iRes] = await Promise.all([
        api.getQueue(),
        api.getInvestigations(undefined, 'Pending')
      ]);

      setQueueStats({
        waiting_for_consultation: Array.isArray(qRes?.waiting_for_consultation) ? qRes.waiting_for_consultation : [],
        consulting: Array.isArray(qRes?.consulting) ? qRes.consulting : [],
        admitted: Array.isArray(qRes?.admitted) ? qRes.admitted : [],
        total_today: qRes?.total_today || 0
      });
      setPendingInvestigations(iRes || []);
    } catch (error) {
      notify('error', 'Clinical Telemetry Node Sync Failure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNextPatient = () => {
    if (queueStats.waiting_for_consultation.length > 0) {
      const nextPatient = queueStats.waiting_for_consultation[0];
      navigate(`/consultations?patient_id=${nextPatient.patient_id}&visit_id=${nextPatient.id}`);
    } else {
      notify('info', "Clinical waiting queue is currently clear.");
    }
  };

  return (
    <div className="leh-page-container">
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box">
            <Stethoscope size={24} color="var(--leh-primary)" />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Consultant Station</h1>
            <p className="leh-page-subtitle">Luna Eye Hospital • Real-time clinical throughput & diagnostics</p>
          </div>
        </div>
        
        <div className="leh-header-actions">
          <button 
            className="leh-btn-primary" 
            onClick={handleNextPatient}
            disabled={queueStats.waiting_for_consultation.length === 0}
            style={{ 
              background: queueStats.waiting_for_consultation.length > 0 
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                : undefined,
              boxShadow: queueStats.waiting_for_consultation.length > 0 
                ? '0 10px 25px -5px rgba(37, 99, 235, 0.4)' 
                : 'none'
            }}
          >
            <Zap size={18} fill="currentColor" />
            <span style={{ letterSpacing: '0.02em' }}>CALL NEXT PATIENT</span>
          </button>
          <button onClick={loadData} className="leh-refresh-btn" style={{ height: '48px', width: '48px' }}>
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="leh-content-area">
        <GreetingBanner />

        {/* CLINICAL TELEMETRY GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', margin: '32px 0' }}>
           <StatCard title="TODAY'S PATIENTS" value={queueStats.total_today} icon={Users} colorClass="blue" path="/patients" subtitle="Total Registrations" />
           <StatCard title="READY FOR CONSULT" value={queueStats.waiting_for_consultation.length} icon={Clock} colorClass="amber" path="/consultations" subtitle="Waiting for session" />
           <StatCard title="IN CONSULTATION" value={queueStats.consulting.length} icon={Activity} colorClass="green" path="/consultations" subtitle="Active clinical nodes" />
           <StatCard title="PENDING LABS" value={pendingInvestigations.length} icon={FlaskConical} colorClass="purple" path="/results" subtitle="Awaiting results" />
           <StatCard title="UNDER YOUR CARE" value={queueStats.admitted.length} icon={BedDouble} colorClass="red" path="/admissions" subtitle="Admitted patients" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* MAIN QUEUE */}
           <div className="lg:col-span-8">
              <section className="leh-table-card">
                 <div className="leh-table-header" style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <ClipboardList size={20} color="var(--leh-primary)" />
                       <h2 className="leh-table-title">Clinical Queue Matrix</h2>
                    </div>
                    <span className="leh-status-badge blue">{queueStats.waiting_for_consultation.length} AWAITING</span>
                 </div>
                 
                 <div className="leh-table-wrapper" style={{ border: 'none' }}>
                    <table className="leh-table">
                       <thead>
                          <tr>
                             <th style={{ paddingLeft: '24px' }}>PATIENT IDENTITY</th>
                             <th>ARRIVAL</th>
                             <th>STATUS</th>
                             <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTION</th>
                          </tr>
                       </thead>
                       <tbody>
                          {queueStats.waiting_for_consultation.length === 0 ? (
                             <tr>
                                <td colSpan={4} style={{ padding: '80px 0', textAlign: 'center', color: 'var(--leh-text-muted)' }}>
                                   <p style={{ fontWeight: '800' }}>THE CLINICAL QUEUE IS CURRENTLY CLEAR</p>
                                </td>
                             </tr>
                          ) : (
                             queueStats.waiting_for_consultation.map((visit: any) => (
                                <tr key={visit.id} className="leh-table-row">
                                   <td style={{ paddingLeft: '24px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                         <div style={{ width: '32px', height: '32px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '12px' }}>{visit.full_name?.charAt(0)}</div>
                                         <div>
                                            <p style={{ fontWeight: '700', color: 'var(--leh-text-dark)', margin: 0 }}>{visit.full_name}</p>
                                            <p style={{ fontSize: '10px', color: 'var(--leh-text-muted)', margin: 0, fontWeight: '700' }}>#{visit.patient_id}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td>
                                      <div className="leh-date-display">
                                         <span className="leh-date-main" style={{ fontSize: '13px' }}>
                                           {formatDateStandard(visit.visit_date)}
                                         </span>
                                         <span className="leh-date-sub">
                                           {new Date(visit.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                         </span>
                                      </div>
                                   </td>
                                   <td>
                                      <span className="leh-status-badge amber" style={{ fontSize: '9px' }}>WAITING</span>
                                   </td>
                                   <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                                      <button 
                                         className="leh-btn-primary" 
                                         style={{ height: '32px', padding: '0 12px', fontSize: '10px' }}
                                         onClick={() => navigate(`/consultations?patient_id=${visit.patient_id}&visit_id=${visit.id}`)}
                                      >
                                         START SESSION
                                      </button>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>
           </div>

           {/* SIDEBAR: ACTIVE CONTEXT */}
           <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="leh-table-card" style={{ padding: '24px' }}>
                 <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} color="var(--leh-green)" />
                    Active Sessions
                 </h3>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {queueStats.consulting.length === 0 ? (
                       <p style={{ fontSize: '12px', color: 'var(--leh-text-muted)', textAlign: 'center' }}>No active consultation sessions</p>
                    ) : (
                       queueStats.consulting.map((v: any) => (
                          <div key={v.id} style={{ padding: '12px', background: 'var(--leh-bg-light)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '13px', fontWeight: '700' }}>{v.full_name}</span>
                             <button onClick={() => navigate(`/consultations?patient_id=${v.patient_id}&visit_id=${v.id}`)} className="leh-refresh-btn" style={{ padding: '4px' }}>
                                <ArrowRight size={14} />
                             </button>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              <div className="leh-table-card" style={{ padding: '24px' }}>
                 <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FlaskConical size={18} color="var(--leh-purple)" />
                    Investigation Alerts
                 </h3>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pendingInvestigations.slice(0, 3).map((i: any, idx) => (
                       <div key={idx} style={{ borderLeft: '3px solid var(--leh-purple)', padding: '8px 12px', background: '#f5f3ff', borderRadius: '4px' }}>
                          <p style={{ fontSize: '12px', fontWeight: '700', margin: 0 }}>{i.investigation_name}</p>
                          <p style={{ fontSize: '10px', color: 'var(--leh-text-muted)', margin: 0 }}>Patient: {i.patient_name}</p>
                       </div>
                    ))}
                    {pendingInvestigations.length === 0 && <p style={{ fontSize: '12px', color: 'var(--leh-text-muted)', textAlign: 'center' }}>No pending investigations</p>}
                 </div>
                 <button onClick={() => navigate('/results')} className="leh-btn-outline" style={{ width: '100%', marginTop: '16px', height: '36px', fontSize: '10px' }}>VIEW ALL RESULTS</button>
              </div>

              <div className="leh-table-card" style={{ padding: '24px', background: 'var(--leh-text-dark)', color: 'white' }}>
                 <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '16px', color: 'white' }}>Strategic Access</h3>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button onClick={() => navigate('/patients')} className="leh-btn-primary" style={{ background: 'rgba(255,255,255,0.1)', height: '40px', fontSize: '10px' }}>PATIENT FILES</button>
                    <button onClick={() => navigate('/reports')} className="leh-btn-primary" style={{ background: 'rgba(255,255,255,0.1)', height: '40px', fontSize: '10px' }}>CLINICAL LOGS</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
