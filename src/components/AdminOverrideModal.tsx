import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { ShieldAlert, X, User, MessageSquare, CheckCircle } from 'lucide-react';

export const AdminOverrideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notify } = useNotification();
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadQueue = async () => {
      try {
        const data = await api.getAwaitingPaymentQueue();
        setQueue(data.filter((v: any) => v.status === 'Awaiting Payment'));
      } catch (err: any) {
        notify('error', 'Failed to load queue: ' + err.message);
      }
    };
    loadQueue();
  }, [notify]);

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return notify('error', 'Please select a patient visit');
    if (!reason.trim() || reason.length < 10) return notify('error', 'Please provide a detailed reason for the override (min 10 chars)');

    setLoading(true);
    try {
      await api.updateVisitStatus(selectedVisit, 'Paid - Waiting for Triage', 'Admin Override', `Emergency Override: ${reason}`);
      notify('success', 'Patient successfully pushed to triage queue via override');
      onClose();
    } catch (err: any) {
      notify('error', 'Failed to override: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="leh-modal-overlay">
      <div className="leh-modal-content" style={{ maxWidth: '560px' }}>
        <div className="leh-modal-header">
          <h2 className="leh-modal-title">
            <ShieldAlert style={{ color: 'var(--leh-red)' }} />
            <span>Emergency Clinical Override</span>
          </h2>
          <button className="leh-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="leh-modal-body">
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', color: '#991b1b', fontWeight: '700', margin: 0, lineHeight: '1.5' }}>
              Bypassing the payment gate is a critical administrative action. This encounter will be immediately visible in the Triage queue. All overrides are logged for clinical audit.
            </p>
          </div>

          <form onSubmit={handleOverride} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="leh-form-group">
              <label className="leh-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={14} /> SELECT PATIENT VISIT
              </label>
              <select 
                className="leh-select" 
                value={selectedVisit || ''} 
                onChange={(e) => setSelectedVisit(Number(e.target.value))}
                required
                style={{ height: '48px' }}
              >
                <option value="">-- Choose from Awaiting Payment queue --</option>
                {queue.map(v => (
                  <option key={v.visit_id} value={v.visit_id}>
                    {v.full_name} (ID: {v.patient_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="leh-form-group">
              <label className="leh-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={14} /> OVERRIDE JUSTIFICATION
              </label>
              <textarea 
                className="leh-textarea" 
                style={{ minHeight: '120px', padding: '16px' }}
                placeholder="Describe the clinical emergency or administrative necessity..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
              <span className="leh-helper-text">Minimum 10 characters required for audit compliance.</span>
            </div>
          </form>
        </div>

        <div className="leh-modal-footer">
          <button type="button" className="leh-btn-outline" onClick={onClose} disabled={loading}>
            CANCEL
          </button>
          <button type="button" className="leh-btn-primary" style={{ background: 'var(--leh-red)' }} onClick={handleOverride} disabled={loading}>
            {loading ? 'PROCESSING...' : (
              <>
                <CheckCircle size={18} />
                <span>CONFIRM & PUSH TO TRIAGE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
