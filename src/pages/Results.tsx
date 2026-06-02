import React, { useState, useEffect } from 'react';
import { FlaskConical, CheckCircle, FileText, Printer, Search, RefreshCw, Lock } from 'lucide-react';
import { api } from '../api';
import { PrintInvestigation } from '../components/PrintInvestigation';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Results: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'reviewed'>('pending');
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);

  // Result entry state
  const [selectedInv, setSelectedInv] = useState<any>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [testValue, setTestValue] = useState('');
  const [medicalComments, setMedicalComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.getInvestigationTemplates()
      .then(data => setTemplates(data))
      .catch(err => console.warn('Failed to load investigation templates:', err));
  }, []);

  const loadInvestigations = () => {
    setLoading(true);
    let statusQuery: string;
    switch(activeTab) {
      case 'pending': statusQuery = 'Pending'; break;
      case 'completed': statusQuery = 'Completed'; break;
      case 'reviewed': statusQuery = 'Reviewed'; break;
      default: statusQuery = 'Pending';
    }
    
    api.getInvestigations(undefined, statusQuery)
      .then(data => {
        setInvestigations(data);
        setLoading(false);
      })
      .catch(err => {
        notify('error', 'Failed to load investigations: ' + (err.message || 'Connection error'));
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInvestigations();
    setSelectedInv(null);
  }, [activeTab]);

  const matchedTemplate = selectedInv ? templates.find(t => 
    t.test_name.toLowerCase() === selectedInv.test_name.toLowerCase() ||
    selectedInv.test_name.toLowerCase().includes(t.test_name.toLowerCase()) ||
    t.test_name.toLowerCase().includes(selectedInv.test_name.toLowerCase())
  ) : null;
  
  const displayUnit = selectedInv?.unit || matchedTemplate?.default_unit;
  const displayRef = selectedInv?.reference_range || matchedTemplate?.default_reference_range;

  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv) return;
    
    setIsSubmitting(true);
    try {
      await api.updateInvestigationResult(selectedInv.id, { 
        results_notes: resultNotes, 
        test_value: testValue,
        medical_comments: medicalComments,
        status: 'Completed',
        unit: displayUnit || null,
        reference_range: displayRef || null
      });
      notify('success', `Investigation results for ${selectedInv.patient_name} submitted`);
      setSelectedInv(null);
      setResultNotes('');
      setTestValue('');
      setMedicalComments('');
      loadInvestigations();
    } catch(err: any) {
      notify('error', err.message || "Failed to submit results");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkReviewed = async (id: number) => {
    try {
      await api.updateInvestigationResult(id, { status: 'Reviewed' });
      notify('success', "Investigation marked as reviewed");
      setSelectedInv(null);
      loadInvestigations();
    } catch (err: any) {
      notify('error', err.message || "Failed to update review status");
    }
  };

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header no-print">
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
            <FlaskConical size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="leh-page-title">Diagnostics & Results</h1>
            <p className="leh-page-subtitle">Laboratory Information System (LIS) Terminal • Test Verification</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', background: '#fff', padding: '6px', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <button 
            className={`leh-tab ${activeTab === 'pending' ? 'active' : ''}`} 
            style={{ height: '36px', padding: '0 16px', fontSize: '11px', fontWeight: '800', border: 'none' }}
            onClick={() => setActiveTab('pending')}
          >
            TEST QUEUE
          </button>
          <button 
            className={`leh-tab ${activeTab === 'completed' ? 'active' : ''}`} 
            style={{ height: '36px', padding: '0 16px', fontSize: '11px', fontWeight: '800', border: 'none' }}
            onClick={() => setActiveTab('completed')}
          >
            COMPLETED
          </button>
          <button 
            className={`leh-tab ${activeTab === 'reviewed' ? 'active' : ''}`} 
            style={{ height: '36px', padding: '0 16px', fontSize: '11px', fontWeight: '800', border: 'none' }}
            onClick={() => setActiveTab('reviewed')}
            data-tooltip="View clinical archives"
          >
            ARCHIVE
          </button>
          <div style={{ width: '1px', background: '#e5e7eb', margin: '8px 4px' }}></div>
          <button 
            onClick={loadInvestigations} 
            className="leh-btn-outline" 
            style={{ border: 'none', height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            data-tooltip="Refresh test queue"
            aria-label="Refresh investigations"
          >
            {loading ? <LoadingSpinner size="small" mode="button" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
        {/* Sidebar: Test Queue */}
        <aside className="lg:col-span-4">
          <div className="leh-table-card" style={{ padding: '24px' }}>
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '12px', color: '#9ca3af' }} size={16} />
              <input 
                type="text" 
                placeholder="Query investigation list..." 
                className="leh-input"
                style={{ paddingLeft: '40px', height: '40px', fontSize: '13px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <LoadingSpinner size="medium" label="Loading tests..." />
                </div>
              ) : investigations.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <FlaskConical size={40} style={{ color: '#e2e8f0', marginBottom: '12px' }} />
                  <p className="leh-label" style={{ fontStyle: 'italic' }}>No matching tests found</p>
                </div>
              ) : (
                investigations.filter(inv => 
                  inv.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  inv.test_name.toLowerCase().includes(searchQuery.toLowerCase())
                ).map(inv => (
                  <button 
                    key={inv.id} 
                    className={`leh-tab ${selectedInv?.id === inv.id ? 'active' : ''}`}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'flex-start', 
                      padding: '16px', 
                      gap: '4px',
                      borderRadius: '16px',
                      height: 'auto',
                      textAlign: 'left',
                      border: selectedInv?.id === inv.id ? '2px solid var(--leh-primary)' : '2px solid #f1f5f9',
                      background: selectedInv?.id === inv.id ? 'var(--leh-primary-light)' : '#fff'
                    }}
                    onClick={() => {
                      setSelectedInv(inv);
                      setTestValue(inv.test_value || '');
                      setMedicalComments(inv.medical_comments || '');
                      
                      // Look up matching template if results_notes is empty
                      if (!inv.results_notes) {
                        const matched = templates.find(t => 
                          t.test_name.toLowerCase() === inv.test_name.toLowerCase() ||
                          inv.test_name.toLowerCase().includes(t.test_name.toLowerCase()) ||
                          t.test_name.toLowerCase().includes(inv.test_name.toLowerCase())
                        );
                        if (matched) {
                          setResultNotes(matched.template_content || '');
                        } else {
                          setResultNotes('');
                        }
                      } else {
                        setResultNotes(inv.results_notes);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span className="leh-label" style={{ fontSize: '10px', fontWeight: '800', color: selectedInv?.id === inv.id ? 'var(--leh-primary)' : '#94a3b8', textTransform: 'uppercase' }}>{inv.test_name}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span className="leh-status-dot" style={{ 
                          fontSize: '9px', 
                          background: inv.billing_status === 'Paid' ? '#ecfdf5' : '#fef2f2', 
                          color: inv.billing_status === 'Paid' ? '#10b981' : '#ef4444',
                          fontWeight: '800'
                        }}>
                          {inv.billing_status || 'Unpaid'}
                        </span>
                        <span className="leh-status-dot" style={{ 
                          fontSize: '9px', 
                          background: inv.status === 'Pending' ? '#fffbeb' : '#ecfdf5', 
                          color: inv.status === 'Pending' ? '#b45309' : '#10b981' 
                        }}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                    <span className="leh-table-bold" style={{ fontSize: '14px', marginTop: '4px' }}>{inv.patient_name}</span>
                    <div style={{ width: '100%', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="leh-date-display">
                        <span className="leh-date-main" style={{ fontSize: '10px' }}>
                          {formatDateStandard(inv.created_at)}
                        </span>
                        <span className="leh-date-sub" style={{ fontSize: '9px' }}>
                          {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="leh-label" style={{ fontSize: '10px' }}>ID: {String(inv.patient_id).slice(0, 8)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Diagnostic Terminal */}
        <main className="lg:col-span-8">
          {!selectedInv ? (
            <div className="leh-table-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', textAlign: 'center' }}>
              <div style={{ width: '100px', height: '100px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', marginBottom: '24px' }}>
                <FlaskConical size={48} />
              </div>
              <h2 className="leh-table-title" style={{ color: '#94a3b8', letterSpacing: '0.1em' }}>SCANNER IDLE</h2>
              <p className="leh-label">Select an investigation to begin data entry or clinical review.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="leh-table-card" style={{ padding: '40px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'var(--leh-primary-light)', borderRadius: '50%', opacity: 0.5 }}></div>
                
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                         <span className="leh-status-dot" style={{ background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', fontWeight: '800' }}>{selectedInv.test_name}</span>
                         <span className="leh-label" style={{ fontSize: '11px', fontWeight: '800' }}>INV-{selectedInv.id.toString().padStart(5, '0')}</span>
                      </div>
                      <h2 className="leh-page-title" style={{ fontSize: '40px', margin: 0 }}>{selectedInv.patient_name}</h2>
                      <p className="leh-label" style={{ fontSize: '11px', fontWeight: '800', marginTop: '8px' }}>Requested by Dr. {selectedInv.requested_by}</p>
                    </div>
                    {activeTab !== 'pending' && (
                      <button 
                        className="leh-btn-secondary" 
                        style={{ height: '48px', padding: '0 24px', background: '#1e293b', color: '#fff', border: 'none' }} 
                        onClick={() => window.print()}
                        data-tooltip="Print this diagnostic report"
                        aria-label="Print report"
                      >
                        <Printer size={18} style={{ marginRight: '8px' }} /> PRINT DIAGNOSTICS
                      </button>
                    )}
                  </header>

                  {selectedInv.billing_status !== 'Paid' ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '60px 40px',
                      background: '#fff',
                      border: '2px dashed #fee2e2',
                      borderRadius: '24px',
                      textAlign: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: '#fef2f2',
                        color: '#ef4444',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Lock size={32} />
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#991b1b', margin: 0 }}>AWAITING PAYMENT</h3>
                      <p style={{ fontSize: '13px', color: '#7f1d1d', maxWidth: '400px', margin: 0, lineHeight: '1.6' }}>
                        This laboratory investigation is locked. Results entry and sample dispatch are blocked until payment is completed at the billing counter.
                      </p>
                      <div style={{ marginTop: '8px', padding: '12px 24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                        Test Price: ₦{(selectedInv.price || 0).toLocaleString()}
                      </div>
                    </div>
                  ) : activeTab === 'pending' ? (
                    <form onSubmit={handleSubmitResult} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: displayUnit ? '1fr 1fr' : '1fr', gap: '24px' }}>
                        {displayUnit && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label className="leh-label" style={{ fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                              TEST VALUE / RESULT
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                className="leh-input"
                                style={{ paddingRight: '80px' }}
                                value={testValue}
                                onChange={(e) => setTestValue(e.target.value)}
                                placeholder="Numerical value..."
                              />
                              <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px', fontWeight: '800' }}>
                                {displayUnit}
                              </span>
                            </div>
                            {displayRef && (
                              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '8px' }}>Ref Range: {displayRef}</span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <label className="leh-label" style={{ fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                            MEDICAL COMMENTS
                          </label>
                          <input
                            type="text"
                            className="leh-input"
                            value={medicalComments}
                            onChange={(e) => setMedicalComments(e.target.value)}
                            disabled={!(user?.role === 'Admin' || user?.role === 'Optometrist')}
                            placeholder={user?.role === 'Admin' || user?.role === 'Optometrist' ? "E.g. High, Low, Normal..." : "Restricted to Clinicians (Optometrist / Admin)"}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label className="leh-label" style={{ fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                          <FileText size={14} style={{ color: 'var(--leh-primary)' }} /> DIAGNOSTIC FINDINGS & OBSERVATIONS
                        </label>
                        <textarea 
                          className="leh-input" 
                          style={{ minHeight: '400px', padding: '32px', fontSize: '14px', lineHeight: '1.8', borderRadius: '32px', background: '#f8fafc' }}
                          placeholder="Type detailed laboratory findings, visual metrics, and clinical impressions..."
                          value={resultNotes}
                          onChange={(e) => setResultNotes(e.target.value)}
                          required
                        ></textarea>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                             <button 
                               type="submit" 
                               className="leh-btn-primary" 
                               style={{ height: '72px', width: '100%', borderRadius: '20px', fontWeight: '800', fontSize: '14px' }} 
                               disabled={isSubmitting}
                             >
                               {isSubmitting ? (
                                 <LoadingSpinner size="small" mode="button" label="Releasing findings..." color="white" />
                               ) : (
                                 <>
                                   <CheckCircle size={20} style={{ marginRight: '12px' }} />
                                   <span>FINALIZE & RELEASE RESULT</span>
                                 </>
                               )}
                             </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div style={{ 
                        padding: '48px', 
                        background: '#1e293b', 
                        borderRadius: '32px', 
                        color: '#fff', 
                        boxShadow: '0 20px 40px -10px rgba(30, 41, 59, 0.2)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{ position: 'absolute', top: '24px', right: '24px', opacity: 0.1 }}>
                          <FlaskConical size={100} />
                        </div>
                        <h3 className="leh-label" style={{ color: 'var(--leh-primary)', fontWeight: '800', letterSpacing: '0.2em', marginBottom: '32px' }}>CLINICAL DIAGNOSTIC REPORT</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: selectedInv.unit ? '1fr 1fr' : '1fr', gap: '24px', marginBottom: '32px', padding: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                          {selectedInv.unit && (
                            <div>
                              <p className="leh-label" style={{ fontSize: '10px', color: '#94a3b8' }}>TEST VALUE / RESULT</p>
                              <p style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0' }}>{selectedInv.test_value || 'N/A'} <span style={{ fontSize: '14px', color: 'var(--leh-primary)' }}>{selectedInv.unit}</span></p>
                              {selectedInv.reference_range && <p style={{ fontSize: '11px', color: '#64748b' }}>Ref: {selectedInv.reference_range}</p>}
                            </div>
                          )}
                          <div>
                            <p className="leh-label" style={{ fontSize: '10px', color: '#94a3b8' }}>MEDICAL COMMENTS</p>
                            <p style={{ fontSize: '16px', margin: '4px 0' }}>{selectedInv.medical_comments || 'None'}</p>
                          </div>
                        </div>

                        <div style={{ fontSize: '16px', lineHeight: '2', opacity: 0.9, whiteSpace: 'pre-wrap', fontFamily: 'serif' }}>
                          {selectedInv.results_notes || 'No clinical notes provided for this investigation.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                           <div style={{ width: '40px', height: '40px', background: '#ecfdf5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                             <CheckCircle size={20} />
                           </div>
                           <div>
                             <p className="leh-label" style={{ fontSize: '9px', fontWeight: '800', margin: 0 }}>RELEASED ON</p>
                             <p className="leh-table-bold" style={{ fontSize: '13px', margin: 0 }}>{new Date(selectedInv.completed_at).toLocaleString()}</p>
                           </div>
                        </div>
                        {activeTab === 'completed' && (user?.role === 'Admin' || user?.role === 'Optometrist') && (
                          <button 
                            className="leh-btn-primary" 
                            style={{ height: '44px', padding: '0 24px', fontSize: '11px', fontWeight: '800' }} 
                            onClick={() => handleMarkReviewed(selectedInv.id)}
                          >
                            AUTHORIZE REVIEW
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Print Layer */}
      {selectedInv && (activeTab === 'completed' || activeTab === 'reviewed') && (
        <div className="print-only">
          <PrintInvestigation investigation={selectedInv} />
        </div>
      )}
    </div>
  );
};
