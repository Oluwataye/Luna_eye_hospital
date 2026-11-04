import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, CheckCircle2, 
  AlertCircle, Clock, Eye, Layers, RefreshCw, X,
  Network, Send, Settings, CheckSquare, XSquare, ChevronRight, RotateCcw
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { InsuranceNavHeader } from './InsuranceNavHeader';
import './Insurance.css';

export const InsuranceClaims: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();

  const [claims, setClaims] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bulk selection
  const [selectedClaimIds, setSelectedClaimIds] = useState<number[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchPayerId, setBatchPayerId] = useState<string>('');

  // Transition modal
  const [transitionModal, setTransitionModal] = useState<{
    open: boolean;
    claim: any | null;
    targetStatus: string;
    reason: string;
    note: string;
  }>({
    open: false,
    claim: null,
    targetStatus: '',
    reason: '',
    note: ''
  });

  // EDI Clearinghouse Bridge
  const [ediModal, setEdiModal] = useState(false);
  const [ediTab, setEdiTab] = useState<'transmit' | 'configs'>('transmit');
  const [ediBatches, setEdiBatches] = useState<any[]>([]);
  const [ediConfigs, setEdiConfigs] = useState<any[]>([]);
  const [ediTransmissions, setEdiTransmissions] = useState<any[]>([]);
  const [ediJobs, setEdiJobs] = useState<any[]>([]);
  const [ediLoading, setEdiLoading] = useState(false);
  const [dispatchingBatchId, setDispatchingBatchId] = useState<number | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);
  const [ediConfigEdit, setEdiConfigEdit] = useState<Record<number, any>>({});
  const [savingConfigId, setSavingConfigId] = useState<number | null>(null);
  const [ediWsConnected, setEdiWsConnected] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [claimsRes, payersRes] = await Promise.all([
        api.insurance.getClaims({
          search: search || undefined,
          status: statusFilter || undefined,
          payer_id: payerFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 100
        }),
        api.insurance.getPayers(true)
      ]);
      setClaims(claimsRes.claims || claimsRes || []);
      setPayers(payersRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load insurance claims');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, payerFilter, dateFrom, dateTo, notify]);

  const loadEdiData = useCallback(async () => {
    setEdiLoading(true);
    try {
      const [batchRes, configRes, txRes, jobsRes] = await Promise.all([
        api.insurance.getBatches({ limit: 50 }),
        api.insurance.getEdiConfigs(),
        api.insurance.getEdiTransmissions(),
        api.insurance.getEdiJobs(50),
      ]);
      setEdiBatches(batchRes || []);
      setEdiConfigs(configRes || []);
      setEdiTransmissions(txRes || []);
      setEdiJobs(jobsRes || []);
    } catch (_e) {
      // non-fatal
    } finally {
      setEdiLoading(false);
    }
  }, []);

  // WebSocket live subscription for EDI queue updates (hybrid with fallback poll)
  useEffect(() => {
    if (!ediModal) return;

    let ws: WebSocket | null = null;
    let fallbackPollTimer: any = null;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/voice/live-ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setEdiWsConnected(true);
        ws?.send(JSON.stringify({ type: 'subscribe_edi' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'EDI_QUEUE_UPDATE') {
            // Live zero-latency instant push from server queue worker
            loadEdiData();
          }
        } catch {}
      };

      ws.onerror = () => {
        setEdiWsConnected(false);
      };

      ws.onclose = () => {
        setEdiWsConnected(false);
      };
    } catch {
      setEdiWsConnected(false);
    }

    // Hybrid fallback poll: runs every 15s if WebSocket is disconnected and jobs are active
    fallbackPollTimer = setInterval(() => {
      setEdiWsConnected((currentWsState) => {
        if (!currentWsState) {
          const hasActiveJob = ediJobs.some((j: any) => j.status === 'PENDING' || j.status === 'PROCESSING');
          if (hasActiveJob) {
            loadEdiData();
          }
        }
        return currentWsState;
      });
    }, 15000);

    return () => {
      if (ws) {
        try { ws.close(); } catch {}
      }
      if (fallbackPollTimer) {
        clearInterval(fallbackPollTimer);
      }
      setEdiWsConnected(false);
    };
  }, [ediModal, loadEdiData, ediJobs]);

  const handleEdiDispatch = async (batchId: number) => {
    setDispatchingBatchId(batchId);
    try {
      const result = await api.insurance.transmitBatch(batchId);
      if (result.enqueued) {
        notify('success', `Batch enqueued for transmission (Job #${result.jobId})`);
      } else if (result.success) {
        notify('success', `Batch dispatched via ${result.protocol}: ${result.message}`);
      } else {
        notify('error', `Dispatch failed: ${result.error || result.message}`);
      }
      await loadEdiData();
    } catch (err: any) {
      notify('error', err.message || 'Dispatch failed');
    } finally {
      setDispatchingBatchId(null);
    }
  };

  const handleEdiRetryJob = async (jobId: number) => {
    setRetryingJobId(jobId);
    try {
      const result = await api.insurance.retryEdiJob(jobId);
      notify('success', result.message || `Job #${jobId} re-queued`);
      await loadEdiData();
    } catch (err: any) {
      notify('error', err.message || 'Retry failed');
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleSaveEdiConfig = async (payerId: number) => {
    setSavingConfigId(payerId);
    try {
      await api.insurance.updateEdiConfig(payerId, ediConfigEdit[payerId] || {});
      notify('success', 'EDI configuration saved');
      await loadEdiData();
    } catch (err: any) {
      notify('error', err.message || 'Failed to save config');
    } finally {
      setSavingConfigId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedClaimIds(claims.map((c) => c.id));
    } else {
      setSelectedClaimIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedClaimIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateBatch = async () => {
    if (!batchPayerId) {
      notify('error', 'Please select a payer for the batch');
      return;
    }
    if (selectedClaimIds.length === 0) {
      notify('error', 'Please select at least one claim to batch');
      return;
    }
    try {
      await api.insurance.createBatch({
        payer_id: parseInt(batchPayerId),
        claim_ids: selectedClaimIds,
        notes: batchNotes
      });
      notify('success', 'Claims batch created successfully');
      setIsBatchModalOpen(false);
      setSelectedClaimIds([]);
      setBatchNotes('');
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Failed to create batch');
    }
  };

  const openTransitionDialog = (claim: any, targetStatus: string) => {
    setTransitionModal({
      open: true,
      claim,
      targetStatus,
      reason: '',
      note: ''
    });
  };

  const executeTransition = async () => {
    const { claim, targetStatus, reason, note } = transitionModal;
    if (!claim) return;
    try {
      await api.insurance.transitionClaim(claim.id, targetStatus, reason, note);
      notify('success', `Claim marked as ${targetStatus}`);
      setTransitionModal({ open: false, claim: null, targetStatus: '', reason: '', note: '' });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Status transition failed');
    }
  };

  const formatNaira = (kobo: number) => {
    const amount = (kobo || 0) / 100;
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="insurance-container">
      {/* Unified Nav Header */}
      <InsuranceNavHeader
        title="Insurance Claims Management"
        subtitle="Adjudication tracking, batching, and automated HMO clearinghouse dispatch"
        actions={
          <>
            {selectedClaimIds.length > 0 && (
              <button
                type="button"
                className="btn-leh-forest"
                onClick={() => setIsBatchModalOpen(true)}
              >
                <Layers size={15} /> Create Batch ({selectedClaimIds.length})
              </button>
            )}
            <button
              type="button"
              className="btn-leh-indigo"
              onClick={() => { setEdiModal(true); loadEdiData(); }}
            >
              <Network size={15} /> EDI Clearinghouse
            </button>
            <button
              type="button"
              className="btn-leh-secondary"
              onClick={loadData}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </>
        }
      />

      {/* Summary KPI Cards */}
      <div className="insurance-grid-stats">
        <div className="insurance-stat-card-modern insurance-stat-card-modern--blue">
          <div className="insurance-stat-icon-wrapper insurance-stat-icon-wrapper--blue">
            <FileText size={22} />
          </div>
          <div className="insurance-stat-content">
            <span className="insurance-stat-label">Draft / Ready</span>
            <span className="insurance-stat-value">{claims.filter(c => ['DRAFT', 'READY'].includes(c.status)).length}</span>
            <span className="insurance-stat-subtext">Pending batch submission</span>
          </div>
        </div>

        <div className="insurance-stat-card-modern insurance-stat-card-modern--amber">
          <div className="insurance-stat-icon-wrapper insurance-stat-icon-wrapper--amber">
            <Clock size={22} />
          </div>
          <div className="insurance-stat-content">
            <span className="insurance-stat-label">Submitted / In Review</span>
            <span className="insurance-stat-value">{claims.filter(c => ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(c.status)).length}</span>
            <span className="insurance-stat-subtext">Awaiting HMO adjudication</span>
          </div>
        </div>

        <div className="insurance-stat-card-modern insurance-stat-card-modern--green">
          <div className="insurance-stat-icon-wrapper insurance-stat-icon-wrapper--green">
            <CheckCircle2 size={22} />
          </div>
          <div className="insurance-stat-content">
            <span className="insurance-stat-label">Approved & Paid</span>
            <span className="insurance-stat-value">{claims.filter(c => ['APPROVED', 'PAID', 'PARTIALLY_PAID', 'PARTIALLY_APPROVED'].includes(c.status)).length}</span>
            <span className="insurance-stat-subtext">Settled or confirmed</span>
          </div>
        </div>

        <div className="insurance-stat-card-modern insurance-stat-card-modern--red">
          <div className="insurance-stat-icon-wrapper insurance-stat-icon-wrapper--red">
            <AlertCircle size={22} />
          </div>
          <div className="insurance-stat-content">
            <span className="insurance-stat-label">Queried / Rejected</span>
            <span className="insurance-stat-value">{claims.filter(c => ['QUERIED', 'REJECTED'].includes(c.status)).length}</span>
            <span className="insurance-stat-subtext">Requires staff attention</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="insurance-card">
        {/* Filters */}
        <div className="insurance-filter-bar">
          <div className="insurance-search-input">
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '11px', color: 'var(--leh-muted)' }} />
            <input
              type="text"
              placeholder="Search claim #, patient, enrollee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="insurance-filter-select"
            style={{ minWidth: '150px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="READY">Ready</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="QUERIED">Queried</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            className="insurance-filter-select"
            style={{ minWidth: '170px' }}
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="">All Payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <input
            type="date"
            className="insurance-filter-date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Service Date From"
          />
          <input
            type="date"
            className="insurance-filter-date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Service Date To"
          />

          {(search || statusFilter || payerFilter || dateFrom || dateTo) && (
            <button
              type="button"
              className="btn-leh-secondary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPayerFilter('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="insurance-table-container">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : claims.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No insurance claims found matching criteria.</p>
            </div>
          ) : (
            <table className="insurance-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedClaimIds.length === claims.length && claims.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Claim Number</th>
                  <th>Patient / Enrollee</th>
                  <th>Payer & Plan</th>
                  <th>Service Date</th>
                  <th style={{ textAlign: 'right' }}>Claimed Amount</th>
                  <th style={{ textAlign: 'right' }}>Approved Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedClaimIds.includes(claim.id)}
                        onChange={() => handleSelectOne(claim.id)}
                      />
                    </td>
                    <td>
                      <span
                        style={{ fontWeight: 600, color: 'var(--leh-forest)', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigate(`/insurance/claims/${claim.id}`)}
                      >
                        {claim.claim_number}
                      </span>
                      {claim.is_overdue && (
                        <span className="ins-badge ins-badge--overdue" style={{ marginLeft: '6px' }}>
                          Overdue
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{claim.patient_name || claim.patient_id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>
                        Policy: {claim.enrollee_number || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div>{claim.payer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>{claim.plan_name || 'Standard'}</div>
                    </td>
                    <td>{claim.service_date}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatNaira(claim.total_claimed)}
                    </td>
                    <td style={{ textAlign: 'right', color: claim.total_approved ? '#15803d' : 'inherit' }}>
                      {claim.total_approved ? formatNaira(claim.total_approved) : '—'}
                    </td>
                    <td>
                      <span className={`ins-badge ins-badge--${claim.status?.toLowerCase()}`}>
                        {claim.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          title="View Claim Details"
                          onClick={() => navigate(`/insurance/claims/${claim.id}`)}
                        >
                          <Eye size={14} /> View
                        </button>
                        {claim.status === 'DRAFT' && (
                          <button
                            className="btn btn-sm btn-outline-success"
                            title="Mark Ready for Submission"
                            onClick={() => openTransitionDialog(claim, 'READY')}
                          >
                            Ready
                          </button>
                        )}
                        {claim.status === 'READY' && (
                          <button
                            className="btn btn-sm btn-outline-info"
                            title="Submit to Payer"
                            onClick={() => openTransitionDialog(claim, 'SUBMITTED')}
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Batch Creation Modal */}
      {isBatchModalOpen && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <div className="ins-modal-header-left">
                <div className="ins-modal-icon-badge ins-modal-icon-badge--forest">
                  <Layers size={22} />
                </div>
                <div className="ins-modal-title-wrap">
                  <h3 className="ins-modal-title">Create Claim Batch</h3>
                  <div className="ins-modal-subtitle">Package selected claims for formal payer submission</div>
                </div>
              </div>
              <button 
                type="button" 
                className="ins-modal-close-btn" 
                onClick={() => setIsBatchModalOpen(false)}
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ins-modal-body">
              {/* Batch scope banner */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d', fontWeight: 800, fontSize: '15px' }}>
                  {selectedClaimIds.length}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#166534' }}>Packaging {selectedClaimIds.length} Claim(s)</div>
                  <div style={{ fontSize: '12px', color: '#15803d' }}>Selected claims will be grouped into a single submission batch with unique tracking ref</div>
                </div>
              </div>

              <div className="ins-form-group">
                <label className="ins-form-label">
                  Select Payer / HMO <span className="ins-form-label-required">*</span>
                </label>
                <select
                  className="ins-form-select"
                  value={batchPayerId}
                  onChange={(e) => setBatchPayerId(e.target.value)}
                >
                  <option value="">-- Choose Payer / Scheme --</option>
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="ins-form-group">
                <label className="ins-form-label">Batch Transmission Notes / Ref</label>
                <textarea
                  className="ins-form-textarea"
                  rows={3}
                  placeholder="e.g. Month-end batch dispatch via clearinghouse portal or courier ref #..."
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="ins-modal-footer">
              <button type="button" className="btn-leh-secondary" onClick={() => setIsBatchModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-leh-forest" onClick={handleCreateBatch}>
                <Layers size={14} /> Create Batch ({selectedClaimIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {transitionModal.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <div className="ins-modal-header-left">
                <div className={`ins-modal-icon-badge ${['REJECTED', 'CANCELLED'].includes(transitionModal.targetStatus) ? 'ins-modal-icon-badge--red' : ['QUERIED'].includes(transitionModal.targetStatus) ? 'ins-modal-icon-badge--amber' : 'ins-modal-icon-badge--forest'}`}>
                  {['REJECTED', 'CANCELLED'].includes(transitionModal.targetStatus) ? (
                    <AlertCircle size={22} />
                  ) : ['QUERIED'].includes(transitionModal.targetStatus) ? (
                    <RotateCcw size={22} />
                  ) : (
                    <CheckCircle2 size={22} />
                  )}
                </div>
                <div className="ins-modal-title-wrap">
                  <h3 className="ins-modal-title">Transition to {transitionModal.targetStatus}</h3>
                  <div className="ins-modal-subtitle">Update claim lifecycle status with audit trail notes</div>
                </div>
              </div>
              <button
                type="button"
                className="ins-modal-close-btn"
                onClick={() => setTransitionModal({ open: false, claim: null, targetStatus: '', reason: '', note: '' })}
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ins-modal-body">
              {/* Claim identifier banner */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--leh-muted)', fontWeight: 700 }}>Claim Reference</div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--leh-ink)' }}>{transitionModal.claim?.claim_number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--leh-muted)', fontWeight: 700 }}>Patient</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--leh-forest)' }}>{transitionModal.claim?.patient_name}</div>
                </div>
              </div>

              {['REJECTED', 'QUERIED', 'CANCELLED'].includes(transitionModal.targetStatus) && (
                <div className="ins-form-group">
                  <label className="ins-form-label">
                    Reason Code / Summary <span className="ins-form-label-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="ins-form-input"
                    placeholder="Enter standard denial code or reason..."
                    value={transitionModal.reason}
                    onChange={(e) => setTransitionModal({ ...transitionModal, reason: e.target.value })}
                  />
                </div>
              )}

              <div className="ins-form-group">
                <label className="ins-form-label">Notes / Audit Comment</label>
                <textarea
                  className="ins-form-textarea"
                  rows={3}
                  placeholder="Optional details for audit log and timeline..."
                  value={transitionModal.note}
                  onChange={(e) => setTransitionModal({ ...transitionModal, note: e.target.value })}
                />
              </div>
            </div>

            <div className="ins-modal-footer">
              <button
                type="button"
                className="btn-leh-secondary"
                onClick={() => setTransitionModal({ open: false, claim: null, targetStatus: '', reason: '', note: '' })}
              >
                Cancel
              </button>
              <button type="button" className="btn-leh-forest" onClick={executeTransition}>
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDI Clearinghouse Bridge Modal */}
      {ediModal && (
        <div className="ins-modal-overlay">
          <div className="ins-modal" style={{ maxWidth: '960px', width: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="ins-modal-header">
              <div className="ins-modal-header-left">
                <div className="ins-modal-icon-badge ins-modal-icon-badge--indigo">
                  <Network size={22} />
                </div>
                <div className="ins-modal-title-wrap">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="ins-modal-title">EDI Clearinghouse Bridge</h3>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: ediWsConnected ? '#dcfce7' : '#f1f5f9',
                        color: ediWsConnected ? '#15803d' : '#64748b',
                      }}
                      title={ediWsConnected ? 'Connected to server WebSocket: live queue push active' : 'WebSocket disconnected: 15s fallback poll active'}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: ediWsConnected ? '#16a34a' : '#94a3b8',
                        }}
                      />
                      {ediWsConnected ? 'Live Push' : 'Fallback Poll'}
                    </span>
                  </div>
                  <div className="ins-modal-subtitle">Automated electronic claims transmission & protocol gateway</div>
                </div>
              </div>
              <button 
                type="button" 
                className="ins-modal-close-btn" 
                onClick={() => setEdiModal(false)}
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', padding: '0 1.5rem' }}>
              {(['transmit', 'configs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEdiTab(tab)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: ediTab === tab ? 700 : 400,
                    color: ediTab === tab ? '#6366f1' : '#64748b',
                    borderBottom: ediTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                    marginBottom: '-2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.9rem',
                  }}
                >
                  {tab === 'transmit' ? <><Send size={15} /> Batch Transmission</> : <><Settings size={15} /> Payer EDI Configs</>}
                </button>
              ))}
            </div>

            <div className="ins-modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {ediLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><LoadingSpinner /></div>
              ) : ediTab === 'transmit' ? (
                <div>
                  <p style={{ color: 'var(--leh-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Select a batch to preview its payload and dispatch it to the HMO clearinghouse.
                    Batches with status <strong>OPEN</strong> or <strong>READY</strong> can be dispatched.
                  </p>
                  {ediBatches.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--leh-muted)', padding: '2rem' }}>
                      <Layers size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                      No batches available. Create a batch first from the claims list.
                    </div>
                  ) : (
                    <table className="insurance-table">
                      <thead>
                        <tr>
                          <th>Batch #</th><th>Payer</th><th>Claims</th>
                          <th style={{ textAlign: 'center' }}>Batch Status</th>
                          <th style={{ textAlign: 'center' }}>EDI Queue</th>
                          <th>Created</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ediBatches.map((b: any) => {
                          const lastTx = ediTransmissions.find((t) => t.batch_id === b.id);
                          const job = ediJobs.find((j) => j.batch_id === b.id);
                          const canDispatch = ['OPEN', 'READY'].includes(b.status) && (!job || ['DEAD_LETTER', 'FAILED', 'COMPLETED'].includes(job.status));
                          const isProcessing = job?.status === 'PROCESSING' || dispatchingBatchId === b.id;
                          const isPending = job?.status === 'PENDING';
                          const isDeadLetter = job?.status === 'DEAD_LETTER' || job?.status === 'FAILED';

                          return (
                            <tr key={b.id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.batch_number}</td>
                              <td>{b.payer_name}</td>
                              <td>{b.claim_count ?? '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`ins-badge ins-badge--${(b.status || 'draft').toLowerCase()}`}>{b.status}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isProcessing ? (
                                  <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> SENDING…
                                  </span>
                                ) : isPending ? (
                                  <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }} title={job?.last_error || 'Queued for transmission'}>
                                    <Clock size={11} /> QUEUED {job?.attempts ? `(Retry ${job.attempts}/3)` : ''}
                                  </span>
                                ) : isDeadLetter ? (
                                  <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }} title={job?.last_error || 'Exceeded retry attempts'}>
                                    <AlertCircle size={11} /> DEAD-LETTER
                                  </span>
                                ) : job?.status === 'COMPLETED' ? (
                                  <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckSquare size={11} /> SENT
                                  </span>
                                ) : lastTx ? (
                                  <span style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    {lastTx.status === 'SUCCESS' ? <CheckSquare size={13} color="#16a34a" /> : <XSquare size={13} color="#dc2626" />}
                                    {lastTx.protocol}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>Idle</span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.82rem', color: 'var(--leh-muted)' }}>
                                {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                                  {isDeadLetter && job && (
                                    <button
                                      className="btn btn-sm"
                                      style={{ background: '#dc2626', color: '#fff', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 8px' }}
                                      disabled={retryingJobId === job.id}
                                      onClick={() => handleEdiRetryJob(job.id)}
                                      title="Reset job attempts and queue immediate retry"
                                    >
                                      {retryingJobId === job.id ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={11} />}
                                      Retry Failed
                                    </button>
                                  )}
                                  {canDispatch && !isDeadLetter && (
                                    <button
                                      className="btn btn-sm btn-primary"
                                      style={{ background: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                      disabled={dispatchingBatchId === b.id}
                                      onClick={() => handleEdiDispatch(b.id)}
                                    >
                                      {dispatchingBatchId === b.id
                                        ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                        : <Send size={12} />}
                                      {dispatchingBatchId === b.id ? 'Queueing…' : 'Dispatch'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {ediTransmissions.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>Recent Transmission Log</strong>
                      <table className="insurance-table" style={{ marginTop: '0.5rem' }}>
                        <thead>
                          <tr>
                            <th>Batch</th><th>Payer</th><th>Protocol</th><th>Destination</th>
                            <th style={{ textAlign: 'center' }}>Status</th><th>Transmitted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ediTransmissions.slice(0, 15).map((tx: any) => (
                            <tr key={tx.id}>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{tx.batch_number}</td>
                              <td>{tx.payer_name}</td>
                              <td><span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{tx.protocol}</span></td>
                              <td style={{ fontSize: '0.78rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.destination}</td>
                              <td style={{ textAlign: 'center' }}>
                                {tx.status === 'SUCCESS'
                                  ? <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}><CheckSquare size={14} /> OK</span>
                                  : <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}><XSquare size={14} /> FAILED</span>}
                              </td>
                              <td style={{ fontSize: '0.82rem', color: 'var(--leh-muted)' }}>
                                {tx.transmitted_at ? new Date(tx.transmitted_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* Payer EDI Configs tab */
                <div>
                  <p style={{ color: 'var(--leh-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Configure the clearinghouse protocol for each HMO payer.
                    <strong> LOCAL_FOLDER</strong> writes files to disk,
                    <strong> REST_WEBHOOK</strong> posts to an HTTP endpoint,
                    <strong> SFTP</strong> queues to the SFTP outbox directory.
                  </p>
                  {ediConfigs.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--leh-muted)', padding: '2rem' }}>
                      <Settings size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                      No EDI configs yet. Add a payer to begin configuring.
                    </div>
                  ) : (
                    ediConfigs.map((cfg: any) => {
                      const edit = ediConfigEdit[cfg.payer_id] ?? cfg;
                      const setEdit = (patch: any) => setEdiConfigEdit((prev) => ({ ...prev, [cfg.payer_id]: { ...(prev[cfg.payer_id] ?? cfg), ...patch } }));
                      return (
                      <div key={cfg.payer_id} className="ins-modal-section-card" style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--leh-ink)' }}>
                              {cfg.payer_name}
                              <span style={{ fontSize: '0.78rem', color: 'var(--leh-muted)', marginLeft: '6px', fontWeight: 400 }}>({cfg.payer_code})</span>
                            </strong>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, color: 'var(--leh-forest)' }}>
                              <input type="checkbox" checked={!!edit.is_enabled} onChange={(e) => setEdit({ is_enabled: e.target.checked ? 1 : 0 })} />
                              Enabled
                            </label>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div className="ins-form-group" style={{ marginBottom: 0 }}>
                              <label className="ins-form-label">Protocol</label>
                              <select className="ins-form-select" value={edit.protocol || 'LOCAL_FOLDER'} onChange={(e) => setEdit({ protocol: e.target.value })}>
                                <option value="LOCAL_FOLDER">LOCAL_FOLDER (File Drop)</option>
                                <option value="REST_WEBHOOK">REST_WEBHOOK (HTTP POST)</option>
                                <option value="SFTP">SFTP</option>
                              </select>
                            </div>
                            <div className="ins-form-group" style={{ marginBottom: 0 }}>
                              <label className="ins-form-label">Format</label>
                              <select className="ins-form-select" value={edit.format || 'JSON'} onChange={(e) => setEdit({ format: e.target.value })}>
                                <option value="JSON">JSON</option>
                                <option value="CSV">CSV</option>
                              </select>
                            </div>
                            <div className="ins-form-group" style={{ marginBottom: 0 }}>
                              <label className="ins-form-label">Auto-Dispatch</label>
                              <select className="ins-form-select" value={edit.auto_dispatch ? '1' : '0'} onChange={(e) => setEdit({ auto_dispatch: e.target.value === '1' ? 1 : 0 })}>
                                <option value="0">Manual only</option>
                                <option value="1">Every 30 min (cron)</option>
                              </select>
                            </div>
                          </div>
                          {edit.protocol === 'LOCAL_FOLDER' && (
                            <div className="ins-form-group" style={{ marginBottom: '12px' }}>
                              <label className="ins-form-label">Local Folder Path</label>
                              <input type="text" className="ins-form-input" placeholder="e.g. C:\\EDI\\Outbox or ./edi_exports" value={edit.local_folder_path || ''} onChange={(e) => setEdit({ local_folder_path: e.target.value })} />
                            </div>
                          )}
                          {edit.protocol === 'REST_WEBHOOK' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              <div className="ins-form-group" style={{ marginBottom: 0 }}>
                                <label className="ins-form-label">Webhook URL</label>
                                <input type="text" className="ins-form-input" placeholder="https://hmo-portal.com/api/claims" value={edit.webhook_url || ''} onChange={(e) => setEdit({ webhook_url: e.target.value })} />
                              </div>
                              <div className="ins-form-group" style={{ marginBottom: 0 }}>
                                <label className="ins-form-label">Auth Header (optional)</label>
                                <input type="text" className="ins-form-input" placeholder="Bearer token or API key" value={edit.webhook_auth_header || ''} onChange={(e) => setEdit({ webhook_auth_header: e.target.value })} />
                              </div>
                            </div>
                          )}
                          {edit.protocol === 'SFTP' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              <div className="ins-form-group" style={{ marginBottom: 0 }}>
                                <label className="ins-form-label">SFTP Host</label>
                                <input type="text" className="ins-form-input" placeholder="sftp.hmo.com" value={edit.sftp_host || ''} onChange={(e) => setEdit({ sftp_host: e.target.value })} />
                              </div>
                              <div className="ins-form-group" style={{ marginBottom: 0 }}>
                                <label className="ins-form-label">Port</label>
                                <input type="number" className="ins-form-input" placeholder="22" value={edit.sftp_port || 22} onChange={(e) => setEdit({ sftp_port: parseInt(e.target.value) })} />
                              </div>
                              <div className="ins-form-group" style={{ marginBottom: 0 }}>
                                <label className="ins-form-label">Username</label>
                                <input type="text" className="ins-form-input" value={edit.sftp_username || ''} onChange={(e) => setEdit({ sftp_username: e.target.value })} />
                              </div>
                              <div className="ins-form-group" style={{ marginBottom: 0 }}>
                                <label className="ins-form-label">Password</label>
                                <input type="password" className="ins-form-input" value={edit.sftp_password || ''} onChange={(e) => setEdit({ sftp_password: e.target.value })} />
                              </div>
                              <div className="ins-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                <label className="ins-form-label">Remote Path</label>
                                <input type="text" className="ins-form-input" placeholder="/claims/inbound" value={edit.sftp_remote_path || ''} onChange={(e) => setEdit({ sftp_remote_path: e.target.value })} />
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-leh-forest"
                              style={{ fontSize: '0.82rem', padding: '0.4rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                              disabled={savingConfigId === cfg.payer_id}
                              onClick={() => handleSaveEdiConfig(cfg.payer_id)}
                            >
                              {savingConfigId === cfg.payer_id ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronRight size={13} />}
                              {savingConfigId === cfg.payer_id ? 'Saving…' : 'Save Config'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="ins-modal-footer">
              <button type="button" className="btn-leh-secondary" onClick={() => setEdiModal(false)}>Close</button>
              {ediTab === 'transmit' && (
                <button type="button" className="btn-leh-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={loadEdiData}>
                  <RefreshCw size={13} /> Refresh Queue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
