import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, Plus, Search, CheckCircle2, XCircle, 
  Clock, AlertCircle, RefreshCw, X
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatCard } from '../../components/StatCard';
import './Insurance.css';

export const InsuranceAuthorizations: React.FC = () => {
  const { notify } = useNotification();

  const [auths, setAuths] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payerFilter, setPayerFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    auth: any | null;
    status: 'APPROVED' | 'PARTIAL' | 'DENIED';
    auth_code: string;
    approved_amount: number;
    valid_until: string;
    denial_reason: string;
  }>({
    open: false,
    auth: null,
    status: 'APPROVED',
    auth_code: '',
    approved_amount: 0,
    valid_until: '',
    denial_reason: ''
  });

  // Create form
  const [formData, setFormData] = useState({
    patient_id: '',
    payer_id: '',
    plan_id: '',
    service_description: '',
    requested_amount: '',
    clinical_notes: '',
    urgency: 'ROUTINE'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [authRes, payersRes] = await Promise.all([
        api.insurance.getAuthorizations({
          status: statusFilter || undefined,
          payer_id: payerFilter || undefined
        }),
        api.insurance.getPayers(true)
      ]);
      setAuths(authRes || []);
      setPayers(payersRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load authorizations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, payerFilter, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!formData.patient_id.trim() || !formData.payer_id || !formData.service_description.trim()) {
      notify('error', 'Patient ID, Payer, and Service Description are required');
      return;
    }
    try {
      await api.insurance.createAuthorization({
        patient_id: formData.patient_id,
        payer_id: parseInt(formData.payer_id),
        plan_id: formData.plan_id ? parseInt(formData.plan_id) : null,
        service_description: formData.service_description,
        requested_amount: formData.requested_amount ? Math.round(parseFloat(formData.requested_amount) * 100) : null,
        clinical_notes: formData.clinical_notes,
        urgency: formData.urgency
      });
      notify('success', 'Authorization request logged successfully');
      setIsCreateModalOpen(false);
      setFormData({
        patient_id: '',
        payer_id: '',
        plan_id: '',
        service_description: '',
        requested_amount: '',
        clinical_notes: '',
        urgency: 'ROUTINE'
      });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Failed to create authorization');
    }
  };

  const handleRecordDecision = async () => {
    const { auth, status, auth_code, approved_amount, valid_until, denial_reason } = decisionModal;
    if (!auth) return;
    if (['APPROVED', 'PARTIAL'].includes(status) && !auth_code.trim()) {
      notify('error', 'Authorization Code provided by the HMO is required');
      return;
    }
    if (status === 'DENIED' && !denial_reason.trim()) {
      notify('error', 'Denial reason is required');
      return;
    }

    try {
      await api.insurance.decisionAuthorization(auth.id, {
        status,
        auth_code,
        approved_amount: approved_amount ? Math.round(approved_amount * 100) : null,
        valid_until: valid_until || null,
        denial_reason
      });
      notify('success', `Authorization recorded as ${status}`);
      setDecisionModal({
        open: false,
        auth: null,
        status: 'APPROVED',
        auth_code: '',
        approved_amount: 0,
        valid_until: '',
        denial_reason: ''
      });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Failed to update authorization decision');
    }
  };

  const formatNaira = (kobo: number) => {
    const amount = (kobo || 0) / 100;
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredAuths = auths.filter((a) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      a.patient_name?.toLowerCase().includes(term) ||
      a.patient_id?.toLowerCase().includes(term) ||
      a.auth_code?.toLowerCase().includes(term) ||
      a.service_description?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="insurance-container">
      {/* Header */}
      <div className="insurance-header">
        <div>
          <h1 className="insurance-title">Pre-Authorizations</h1>
          <p className="insurance-subtitle">Manage procedure approvals and HMO authorization codes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--leh-forest)' }}
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} /> Request Pre-Auth
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="insurance-grid-stats">
        <StatCard
          title="Pending Requests"
          value={auths.filter(a => a.status === 'PENDING').length}
          subtitle="Awaiting HMO response"
          icon={Clock}
          colorClass="amber"
        />
        <StatCard
          title="Approved"
          value={auths.filter(a => a.status === 'APPROVED').length}
          subtitle="Valid for billing"
          icon={CheckCircle2}
          colorClass="green"
        />
        <StatCard
          title="Partially Approved"
          value={auths.filter(a => a.status === 'PARTIAL').length}
          subtitle="Reduced coverage"
          icon={AlertCircle}
          colorClass="blue"
        />
        <StatCard
          title="Denied"
          value={auths.filter(a => a.status === 'DENIED').length}
          subtitle="Payer rejected"
          icon={XCircle}
          colorClass="red"
        />
      </div>

      {/* Main Table Card */}
      <div className="insurance-card">
        {/* Filter bar */}
        <div className="insurance-filter-bar">
          <div className="insurance-search-input">
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--leh-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px', height: '36px' }}
              placeholder="Search patient, auth code, procedure..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: '160px', height: '36px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PARTIAL">Partial</option>
            <option value="DENIED">Denied</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <select
            className="form-select"
            style={{ width: '180px', height: '36px' }}
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="">All Payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {(search || statusFilter || payerFilter) && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPayerFilter('');
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="insurance-table-container">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : filteredAuths.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              <ShieldCheck size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No authorization records found.</p>
            </div>
          ) : (
            <table className="insurance-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Payer</th>
                  <th>Service / Procedure</th>
                  <th>Auth Code</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th style={{ textAlign: 'right' }}>Approved</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuths.map((auth) => (
                  <tr key={auth.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{auth.patient_name || auth.patient_id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>ID: {auth.patient_id}</div>
                    </td>
                    <td>
                      <div>{auth.payer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>{auth.plan_name || 'Standard'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{auth.service_description}</div>
                      {auth.urgency && auth.urgency !== 'ROUTINE' && (
                        <span style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 700 }}>
                          [{auth.urgency}]
                        </span>
                      )}
                    </td>
                    <td>
                      {auth.auth_code ? (
                        <span style={{ fontWeight: 600, color: 'var(--leh-forest)' }}>{auth.auth_code}</span>
                      ) : (
                        <span style={{ color: 'var(--leh-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {auth.requested_amount ? formatNaira(auth.requested_amount) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: auth.approved_amount ? '#15803d' : 'inherit' }}>
                      {auth.approved_amount ? formatNaira(auth.approved_amount) : '—'}
                    </td>
                    <td>{auth.valid_until || '—'}</td>
                    <td>
                      <span className={`ins-badge ins-badge--${auth.status?.toLowerCase()}`}>
                        {auth.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {auth.status === 'PENDING' ? (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setDecisionModal({
                            open: true,
                            auth,
                            status: 'APPROVED',
                            auth_code: '',
                            approved_amount: auth.requested_amount ? auth.requested_amount / 100 : 0,
                            valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                            denial_reason: ''
                          })}
                        >
                          Record Decision
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-link"
                          onClick={() => setDecisionModal({
                            open: true,
                            auth,
                            status: auth.status,
                            auth_code: auth.auth_code || '',
                            approved_amount: auth.approved_amount ? auth.approved_amount / 100 : 0,
                            valid_until: auth.valid_until || '',
                            denial_reason: auth.denial_reason || ''
                          })}
                        >
                          View / Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Pre-Auth Modal */}
      {isCreateModalOpen && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Request Pre-Authorization</h3>
              <button className="btn btn-sm btn-link" onClick={() => setIsCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Patient ID / File No *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. PAT-00102"
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payer *</label>
                  <select
                    className="form-select"
                    value={formData.payer_id}
                    onChange={(e) => setFormData({ ...formData, payer_id: e.target.value })}
                  >
                    <option value="">-- Select Payer --</option>
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Urgency</label>
                  <select
                    className="form-select"
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent (24h)</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Procedure / Service Description *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Phacoemulsification with Foldable IOL (Right Eye)"
                  value={formData.service_description}
                  onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Estimated Tariff / Requested Amount (₦)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 150000"
                  value={formData.requested_amount}
                  onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Clinical Notes / Justification</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Diagnosis, severity, visual acuity, previous treatments failed..."
                  value={formData.clinical_notes}
                  onChange={(e) => setFormData({ ...formData, clinical_notes: e.target.value })}
                />
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {decisionModal.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Record HMO Decision</h3>
              <button className="btn btn-sm btn-link" onClick={() => setDecisionModal({ ...decisionModal, open: false })}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Payer Decision *</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {(['APPROVED', 'PARTIAL', 'DENIED'] as const).map((dec) => (
                    <label key={dec} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="auth_decision"
                        checked={decisionModal.status === dec}
                        onChange={() => setDecisionModal({ ...decisionModal, status: dec })}
                      />
                      <span>{dec}</span>
                    </label>
                  ))}
                </div>
              </div>

              {decisionModal.status !== 'DENIED' ? (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>HMO Pre-Auth Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AUTH-2026-9921"
                      value={decisionModal.auth_code}
                      onChange={(e) => setDecisionModal({ ...decisionModal, auth_code: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600 }}>Approved Amount (₦)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={decisionModal.approved_amount || ''}
                        onChange={(e) => setDecisionModal({ ...decisionModal, approved_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600 }}>Valid Until Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={decisionModal.valid_until}
                        onChange={(e) => setDecisionModal({ ...decisionModal, valid_until: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Denial Reason *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Provide payer denial reason code or explanation..."
                    value={decisionModal.denial_reason}
                    onChange={(e) => setDecisionModal({ ...decisionModal, denial_reason: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="ins-modal-footer">
              <button className="btn btn-secondary" onClick={() => setDecisionModal({ ...decisionModal, open: false })}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRecordDecision}>
                Save Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
