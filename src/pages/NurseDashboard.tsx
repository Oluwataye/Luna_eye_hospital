import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Activity, ClipboardList, Clock, 
  CheckCircle, RefreshCcw, Thermometer, Zap,
  History
} from 'lucide-react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { GreetingBanner } from '../components/GreetingBanner';
import { StatCard } from '../components/StatCard';

export const NurseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [queue, setQueue] = useState<any>({
    waiting: [],
    triaged_today: [],
    total_today: 0
  });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const qRes = await api.getQueue();
      setQueue({
        waiting: Array.isArray(qRes?.waiting) ? qRes.waiting : [],
        triaged_today: Array.isArray(qRes?.waiting_for_consultation) ? qRes.waiting_for_consultation : [],
        total_today: qRes?.total_today || 0
      });
    } catch (error) {
      notify('error', 'Nurse Terminal: Sync failure with clinical node');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStartTriage = () => {
    if (queue.waiting.length > 0) {
      const nextPatient = queue.waiting[0];
      navigate(`/triage?patientId=${nextPatient.patient_id}&visitId=${nextPatient.id}`);
    } else {
      notify('info', "No patients currently in the triage queue.");
    }
  };

  return (
    <div className="leh-page-container">
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box" style={{ background: 'var(--leh-primary)' }}>
            <Activity size={24} color="#fff" />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Nurse/VA Station</h1>
            <p className="leh-page-subtitle">Patient triage • Vital signs synchronization • Clinical flow control</p>
          </div>
        </div>
        
        <div className="leh-header-actions">
          <button 
            className="leh-btn-primary" 
            onClick={handleStartTriage}
            disabled={queue.waiting.length === 0}
            style={{ 
              background: queue.waiting.length > 0 
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                : undefined,
              boxShadow: queue.waiting.length > 0 
                ? '0 10px 25px -5px rgba(37, 99, 235, 0.4)' 
                : 'none'
            }}
          >
            <Thermometer size={20} />
            <span style={{ letterSpacing: '0.02em' }}>START NEXT TRIAGE</span>
          </button>
          <button onClick={loadData} className="leh-refresh-btn" style={{ height: '48px', width: '48px' }}>
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="leh-content-area">
        <GreetingBanner />

        {/* OPERATIONAL METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', margin: '32px 0' }}>
           <StatCard title="AWAITING TRIAGE" value={queue.waiting.length} icon={Clock} colorClass="amber" path="/triage" subtitle="Patients in queue" />
           <StatCard title="TRIAGED TODAY" value={queue.triaged_today.length} icon={CheckCircle} colorClass="green" path="/reports" subtitle="Completed assessments" />
           <StatCard title="TOTAL REGISTERED" value={queue.total_today} icon={Users} colorClass="blue" path="/patients" subtitle="Hospital throughput" />
           <StatCard title="VITAL ALERTS" value={0} icon={Zap} colorClass="red" path="/triage" subtitle="Critical readings" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* TRIAGE QUEUE */}
           <div className="lg:col-span-8">
              <section className="leh-table-card">
                 <div className="leh-table-header" style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <ClipboardList size={20} color="var(--leh-primary)" />
                       <h2 className="leh-table-title">Triage Waiting Matrix</h2>
                    </div>
                    <span className="leh-status-badge amber">{queue.waiting.length} PENDING</span>
                 </div>
                 
                 <div className="leh-table-wrapper" style={{ border: 'none' }}>
                    <table className="leh-table">
                       <thead>
                          <tr>
                             <th style={{ paddingLeft: '24px' }}>PATIENT</th>
                             <th>STATUS</th>
                             <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTION</th>
                          </tr>
                       </thead>
                       <tbody>
                          {queue.waiting.length === 0 ? (
                             <tr>
                                <td colSpan={3} style={{ padding: '80px 0', textAlign: 'center', color: 'var(--leh-text-muted)' }}>
                                   <p style={{ fontWeight: '800' }}>TRIAGE QUEUE IS CURRENTLY CLEAR</p>
                                </td>
                             </tr>
                          ) : (
                             queue.waiting.map((visit: any) => (
                                <tr key={visit.id} className="leh-table-row">
                                   <td style={{ paddingLeft: '24px' }}>
                                      <p style={{ fontWeight: '700', color: 'var(--leh-text-dark)', margin: 0 }}>{visit.full_name}</p>
                                      <p style={{ fontSize: '10px', color: 'var(--leh-text-muted)', margin: 0, fontWeight: '700' }}>#{visit.patient_id}</p>
                                   </td>
                                   <td>
                                      <span className="leh-status-badge amber">AWAITING TRIAGE</span>
                                   </td>
                                   <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                                      <button className="leh-btn-primary" style={{ height: '32px', fontSize: '10px' }} onClick={() => navigate(`/triage?patientId=${visit.patient_id}&visitId=${visit.id}`)}>
                                         START TRIAGE
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

           {/* SIDEBAR: ACTIVITY & TOOLS */}
           <div className="lg:col-span-4 flex flex-col gap-6">
              <section className="leh-table-card" style={{ padding: '24px' }}>
                 <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} color="var(--leh-primary)" />
                    Recent Activity
                 </h3>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {queue.triaged_today.slice(0, 5).map((v: any) => (
                       <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--leh-bg-light)', borderRadius: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700' }}>{v.full_name}</span>
                          <span style={{ fontSize: '9px', fontWeight: '900', color: 'var(--leh-green)' }}>COMPLETED</span>
                       </div>
                    ))}
                    {queue.triaged_today.length === 0 && <p style={{ fontSize: '12px', color: 'var(--leh-text-muted)', textAlign: 'center' }}>No triage completed today</p>}
                 </div>
              </section>

              <section className="leh-table-card" style={{ padding: '24px', background: 'var(--leh-text-dark)', color: 'white' }}>
                 <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '16px', color: 'white' }}>Quick Links</h3>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button onClick={() => navigate('/patients')} className="leh-btn-primary" style={{ background: 'rgba(255,255,255,0.1)', height: '40px', fontSize: '10px' }}>PATIENT SEARCH</button>
                    <button onClick={() => navigate('/reports')} className="leh-btn-primary" style={{ background: 'rgba(255,255,255,0.1)', height: '40px', fontSize: '10px' }}>DAILY REPORT</button>
                 </div>
              </section>
           </div>
        </div>
      </div>
    </div>
  );
};
