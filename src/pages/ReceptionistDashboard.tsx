import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UserPlus, ClipboardList, CreditCard, Printer, 
  Activity, ArrowRight, UserCheck, Receipt,
  LayoutDashboard, Users, Search, Filter,
  ArrowUpRight, TrendingUp, Clock, ShieldCheck,
  Zap, RefreshCcw, Banknote, History, ChevronRight,
  FileText, TrendingDown
} from 'lucide-react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { GreetingBanner } from '../components/GreetingBanner';
import { StatCard } from '../components/StatCard';
import ReprintReceiptModal from '../components/ReprintReceiptModal';
import { NairaIcon } from '../components/NairaIcon';

export const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [stats, setStats] = useState({
    registeredToday: 0,
    checkedIn: 0,
    billedToday: 0,
    receiptsIssued: 0,
    pendingPayments: 0
  });
  
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [awaitingPaymentQueue, setAwaitingPaymentQueue] = useState<any[]>([]);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintReceiptNo, setReprintReceiptNo] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [patients, queue, transactions, awaitingPayments] = await Promise.all([
        api.getPatients(),
        api.getQueue(),
        api.getTransactions(),
        api.getAwaitingPaymentQueue()
      ]);
      
      const patientsArr = Array.isArray(patients) ? patients : [];
      const transactionsArr = Array.isArray(transactions) ? transactions : [];
      const awaitingPaymentsArr = Array.isArray(awaitingPayments) ? awaitingPayments : [];

      const todayStr = new Date().toLocaleDateString();
      
      const regToday = patientsArr.filter((p: any) => new Date(p.created_at).toLocaleDateString() === todayStr).length;
      const todayTrans = transactionsArr.filter((t: any) => new Date(t.created_at).toLocaleDateString() === todayStr);
      const billedAmount = todayTrans.reduce((sum: number, t: any) => sum + (t.total_amount || t.amount || 0), 0);

      setStats({
        registeredToday: regToday,
        checkedIn: (Array.isArray(queue?.waiting) ? queue.waiting.length : 0) + 
                   (Array.isArray(queue?.waiting_for_consultation) ? queue.waiting_for_consultation.length : 0),
        billedToday: billedAmount,
        receiptsIssued: todayTrans.length,
        pendingPayments: awaitingPaymentsArr.filter((v: any) => !v.has_paid).length
      });

      setRecentTransactions(todayTrans.slice(0, 8));
      setAwaitingPaymentQueue(awaitingPaymentsArr);
    } catch (err: any) {
      notify('error', 'Reception Telemetry: Operational node out of sync');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePushToTriage = async (visitId: number) => {
    try {
      await api.updateVisitStatus(visitId, 'Paid - Waiting for Triage');
      notify('success', 'Workflow Authorized: Patient pushed to Triage');
      loadData();
    } catch (err: any) {
      notify('error', 'Authorization Failed: ' + err.message);
    }
  };

  return (
    <div className="leh-page-container">
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box" style={{ background: 'var(--leh-primary)' }}>
            <Users size={24} color="#fff" />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Reception Terminal</h1>
            <p className="leh-page-subtitle">Front-desk operations • Revenue clearing • Patient enrollment</p>
          </div>
        </div>
        
        <div className="leh-header-actions">
          <GreetingBanner />
          <button onClick={loadData} className="leh-refresh-btn" style={{ height: '48px', width: '48px' }} title="Refresh Dashboard Data">
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="leh-content-area">
        {/* QUICK ACTION PROTOCOLS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
           <button className="leh-btn-primary" style={{ height: '80px', borderRadius: '16px', flexDirection: 'column', gap: '4px' }} onClick={() => navigate('/patients/register')}>
              <UserPlus size={20} />
              <span style={{ fontSize: '12px', fontWeight: '900' }}>REGISTER NEW PATIENT</span>
           </button>
           <button className="leh-btn-secondary" style={{ height: '80px', borderRadius: '16px', background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', flexDirection: 'column', gap: '4px' }} onClick={() => navigate('/patients')}>
              <UserCheck size={20} />
              <span style={{ fontSize: '12px', fontWeight: '900' }}>CHECK IN PATIENT</span>
           </button>
           <button className="leh-btn-secondary" style={{ height: '80px', borderRadius: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', flexDirection: 'column', gap: '4px' }} onClick={() => navigate('/billing')}>
              <CreditCard size={20} />
              <span style={{ fontSize: '12px', fontWeight: '900' }}>NEW BILL</span>
           </button>
           <button className="leh-btn-secondary" style={{ height: '80px', borderRadius: '16px', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6', flexDirection: 'column', gap: '4px' }} onClick={() => navigate('/billing')}>
              <Printer size={20} />
              <span style={{ fontSize: '12px', fontWeight: '900' }}>PRINT RECEIPT</span>
           </button>
        </div>

        {/* RECEPTION TELEMETRY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
           <StatCard title="REGISTRATIONS" value={stats.registeredToday} icon={Users} colorClass="blue" path="/patients" subtitle="Today's enrollment" />
           <StatCard title="IN QUEUE" value={stats.checkedIn} icon={ClipboardList} colorClass="amber" path="/patients" subtitle="Currently in facility" />
           <StatCard title="TOTAL BILLED" value={`₦${stats.billedToday.toLocaleString()}`} icon={NairaIcon} colorClass="green" path="/billing" subtitle="Daily revenue" />
           <StatCard title="PENDING PAY" value={stats.pendingPayments} icon={NairaIcon} colorClass="red" path="/billing" subtitle="Awaiting clearing" />
           <StatCard title="RECEIPTS" value={stats.receiptsIssued} icon={Receipt} colorClass="purple" path="/billing" subtitle="Issued today" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* CLEARANCE WORKFLOW */}
           <div className="lg:col-span-8">
              <section className="leh-table-card">
                 <div className="leh-table-header" style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <ShieldCheck size={20} color="var(--leh-primary)" />
                       <h2 className="leh-table-title">Financial Clearance Queue</h2>
                    </div>
                    <span className="leh-status-badge blue">{awaitingPaymentQueue.length} PENDING</span>
                 </div>
                 
                 <div className="leh-table-wrapper" style={{ border: 'none' }}>
                    <table className="leh-table">
                       <thead>
                          <tr>
                             <th style={{ paddingLeft: '24px' }}>PATIENT</th>
                             <th>SETTLEMENT</th>
                             <th>STATUS</th>
                             <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTION</th>
                          </tr>
                       </thead>
                       <tbody>
                          {awaitingPaymentQueue.length === 0 ? (
                             <tr>
                                <td colSpan={4} style={{ padding: '80px 0', textAlign: 'center', color: 'var(--leh-text-muted)' }}>
                                   <p style={{ fontWeight: '800' }}>ALL FINANCIAL ENCOUNTERS CLEARED</p>
                                </td>
                             </tr>
                          ) : (
                             awaitingPaymentQueue.map((visit: any) => (
                                <tr key={visit.visit_id} className="leh-table-row">
                                   <td style={{ paddingLeft: '24px' }}>
                                      <p style={{ fontWeight: '700', color: 'var(--leh-text-dark)', margin: 0 }}>{visit.full_name}</p>
                                      <p style={{ fontSize: '10px', color: 'var(--leh-text-muted)', margin: 0, fontWeight: '700' }}>#{visit.patient_id}</p>
                                   </td>
                                   <td>
                                      {visit.has_paid ? (
                                         <span className="leh-status-badge green">PAID</span>
                                      ) : (
                                         <span className="leh-status-badge red">UNPAID</span>
                                      )}
                                   </td>
                                   <td>
                                      <span className="leh-status-badge blue" style={{ fontSize: '9px' }}>{visit.status.toUpperCase()}</span>
                                   </td>
                                   <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                                      {visit.has_paid ? (
                                         <button className="leh-btn-primary" style={{ height: '32px', fontSize: '10px' }} onClick={() => handlePushToTriage(visit.visit_id)}>
                                            AUTHORIZE ENTRY
                                         </button>
                                      ) : (
                                         <button className="leh-btn-secondary" style={{ height: '32px', fontSize: '10px' }} onClick={() => navigate(`/billing?patientId=${visit.patient_id}`)}>
                                            BILL PATIENT
                                         </button>
                                      )}
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>
           </div>

           {/* TRANSACTION LOGS */}
           <div className="lg:col-span-4">
              <section className="leh-table-card">
                 <div className="leh-table-header" style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                       <History size={18} color="var(--leh-primary)" />
                       <h3 style={{ fontSize: '14px', fontWeight: '900', margin: 0 }}>Daily Transactions</h3>
                    </div>
                 </div>
                 
                 <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       {recentTransactions.map((tx: any) => (
                          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div>
                                <p style={{ fontSize: '12px', fontWeight: '800', margin: 0 }}>{tx.receipt_no}</p>
                                <p style={{ fontSize: '10px', color: 'var(--leh-text-muted)', margin: 0 }}>
                                  {formatDateStandard(tx.created_at)} • {new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                             </div>
                             <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '13px', fontWeight: '900', margin: 0 }}>₦{tx.total_amount.toLocaleString()}</p>
                                <button 
                                   style={{ background: 'none', border: 'none', color: 'var(--leh-primary)', fontSize: '9px', fontWeight: '900', cursor: 'pointer', padding: 0 }}
                                   onClick={() => { setReprintReceiptNo(tx.receipt_no); setShowReprintModal(true); }}
                                >
                                   REPRINT
                                </button>
                             </div>
                          </div>
                       ))}
                       {recentTransactions.length === 0 && <p style={{ fontSize: '12px', color: 'var(--leh-text-muted)', textAlign: 'center' }}>No transactions recorded today</p>}
                    </div>
                    
                    <button className="leh-btn-outline" style={{ width: '100%', marginTop: '24px', height: '40px', fontSize: '11px' }} onClick={() => navigate('/reports')}>
                       FINANCIAL SUMMARY
                    </button>
                 </div>
              </section>
           </div>
        </div>
      </div>

      {showReprintModal && (
        <ReprintReceiptModal receipt_number={reprintReceiptNo} onClose={() => setShowReprintModal(false)} />
      )}
    </div>
  );
};
