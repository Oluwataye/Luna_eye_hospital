import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, CheckCircle2, 
  AlertCircle, Clock, Eye, Layers, RefreshCw,
  Network, Send, Settings, CheckSquare, XSquare, ChevronRight, RotateCcw
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { InsuranceNavHeader } from './InsuranceNavHeader';
import {
  InsuranceModal,
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormButton,
  FormGrid,
  FormSection
} from '../../components/insurance';
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
      <InsuranceModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="Create Claim Batch"
        subtitle="Package selected claims for formal payer submission"
        icon={<Layers size={18} />}
        size="md"
        isDirty={Boolean(batchPayerId || batchNotes.trim())}
        footer={
          <>
            <FormButton
              variant="secondary"
              onClick={() => setIsBatchModalOpen(false)}
            >
              Cancel
            </FormButton>
            <FormButton
              variant="primary"
              onClick={handleCreateBatch}
              disabled={!batchPayerId}
              icon={<Layers size={15} />}
            >
              Create Batch ({selectedClaimIds.length})
            </FormButton>
          </>
        }
      >
        {/* Batch scope banner */}
        <div style={{
          background: 'var(--leh-surface-alt, #f0fdf4)',
          border: '1px solid var(--leh-border, #bbf7d0)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--leh-forest, #15803d)',
            fontWeight: 800,
            fontSize: '15px'
          }}>
            {selectedClaimIds.length}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--leh-ink)' }}>
              Packaging {selectedClaimIds.length} Claim(s)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--leh-muted)' }}>
              Selected claims will be grouped into a single submission batch with unique tracking ref
            </div>
          </div>
        </div>

        <FormField label="Select Payer / HMO" required>
          <FormSelect
            value={batchPayerId}
            onChange={(e) => setBatchPayerId(e.target.value)}
          >
            <option value="">-- Choose Payer / Scheme --</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </FormSelect>
        </FormField>

        <FormField label="Batch Transmission Notes / Ref">
          <FormTextarea
            rows={3}
            placeholder="e.g. Month-end batch dispatch via clearinghouse portal or courier ref #..."
            value={batchNotes}
            onChange={(e) => setBatchNotes(e.target.value)}
          />
        </FormField>
      </InsuranceModal>

      {/* Status Transition Modal */}
      <InsuranceModal
        isOpen={transitionModal.open}
        onClose={() => setTransitionModal({ open: false, claim: null, targetStatus: '', reason: '', note: '' })}
        title={`Transition to ${transitionModal.targetStatus}`}
        subtitle="Update claim lifecycle status with audit trail notes"
        icon={
          ['REJECTED', 'CANCELLED'].includes(transitionModal.targetStatus) ? (
            <AlertCircle size={18} />
          ) : ['QUERIED'].includes(transitionModal.targetStatus) ? (
            <RotateCcw size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )
        }
        size="md"
        isDirty={Boolean(transitionModal.reason.trim() || transitionModal.note.trim())}
        footer={
          <>
            <FormButton
              variant="secondary"
              onClick={() => setTransitionModal({ open: false, claim: null, targetStatus: '', reason: '', note: '' })}
            >
              Cancel
            </FormButton>
            <FormButton
              variant={['REJECTED', 'CANCELLED'].includes(transitionModal.targetStatus) ? 'danger' : 'primary'}
              onClick={executeTransition}
              icon={<CheckCircle2 size={15} />}
            >
              Confirm Transition
            </FormButton>
          </>
        }
      >
        {/* Claim identifier banner */}
        <div style={{
          background: 'var(--leh-surface-alt, #f8fafc)',
          border: '1px solid var(--leh-border, #e2e8f0)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--leh-muted)', fontWeight: 700 }}>
              Claim Reference
            </div>
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--leh-ink)' }}>
              {transitionModal.claim?.claim_number}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--leh-muted)', fontWeight: 700 }}>
              Patient
            </div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--leh-forest)' }}>
              {transitionModal.claim?.patient_name}
            </div>
          </div>
        </div>

        {['REJECTED', 'QUERIED', 'CANCELLED'].includes(transitionModal.targetStatus) && (
          <FormField label="Reason Code / Summary" required>
            <FormInput
              type="text"
              placeholder="Enter standard denial code or reason..."
              value={transitionModal.reason}
              onChange={(e) => setTransitionModal({ ...transitionModal, reason: e.target.value })}
            />
          </FormField>
        )}

        <FormField label="Notes / Audit Comment">
          <FormTextarea
            rows={3}
            placeholder="Optional details for audit log and timeline..."
            value={transitionModal.note}
            onChange={(e) => setTransitionModal({ ...transitionModal, note: e.target.value })}
          />
        </FormField>
      </InsuranceModal>

      {/* EDI Clearinghouse Bridge Modal */}
      <InsuranceModal
        isOpen={ediModal}
        onClose={() => setEdiModal(false)}
        title="EDI Clearinghouse Bridge"
        subtitle="Automated electronic claims transmission & protocol gateway"
        icon={<Network size={18} />}
        size="xl"
        footer={
          <>
            <FormButton
              variant="secondary"
              onClick={() => setEdiModal(false)}
            >
              Close
            </FormButton>
            {ediTab === 'transmit' && (
              <FormButton
                variant="secondary"
                icon={<RefreshCw size={13} />}
                onClick={loadEdiData}
              >
                Refresh Queue
              </FormButton>
            )}
          </>
        }
      >
        {/* Header toolbar with live indicator and tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--leh-border, #e2e8f0)', paddingBottom: '12px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['transmit', 'configs'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setEdiTab(tab)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: ediTab === tab ? '1.5px solid var(--leh-forest, #2E5A26)' : '1px solid var(--leh-border, #e2e8f0)',
                  background: ediTab === tab ? 'var(--leh-surface-alt, #f0fdf4)' : 'transparent',
                  fontWeight: ediTab === tab ? 700 : 500,
                  color: ediTab === tab ? 'var(--leh-forest, #2E5A26)' : 'var(--leh-muted, #4A5E45)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab === 'transmit' ? <><Send size={14} /> Batch Transmission</> : <><Settings size={14} /> Payer EDI Configs</>}
              </button>
            ))}
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: ediWsConnected ? '#dcfce7' : '#f1f5f9',
              color: ediWsConnected ? '#15803d' : '#64748b',
              border: `1px solid ${ediWsConnected ? '#bbf7d0' : '#e2e8f0'}`
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
            {ediWsConnected ? 'Live Push Active' : 'Fallback Poll Active'}
          </span>
        </div>

        {ediLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><LoadingSpinner /></div>
        ) : ediTab === 'transmit' ? (
          <div>
            <p style={{ color: 'var(--leh-muted)', fontSize: '13px', marginBottom: '14px', lineHeight: 1.5 }}>
              Select a batch to preview its payload and dispatch it to the HMO clearinghouse.
              Batches with status <strong>OPEN</strong> or <strong>READY</strong> can be dispatched.
            </p>
            {ediBatches.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--leh-muted)', padding: '2.5rem' }}>
                <Layers size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                No batches available. Create a batch first from the claims list.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--leh-border)', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="insurance-table" style={{ margin: 0 }}>
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
                              <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> SENDING…
                              </span>
                            ) : isPending ? (
                              <span style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }} title={job?.last_error || 'Queued for transmission'}>
                                <Clock size={11} /> QUEUED {job?.attempts ? `(Retry ${job.attempts}/3)` : ''}
                              </span>
                            ) : isDeadLetter ? (
                              <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }} title={job?.last_error || 'Exceeded retry attempts'}>
                                <AlertCircle size={11} /> DEAD-LETTER
                              </span>
                            ) : job?.status === 'COMPLETED' ? (
                              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckSquare size={11} /> SENT
                              </span>
                            ) : lastTx ? (
                              <span style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {lastTx.status === 'SUCCESS' ? <CheckSquare size={13} color="#16a34a" /> : <XSquare size={13} color="#dc2626" />}
                                {lastTx.protocol}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--leh-muted)' }}>Idle</span>
                            )}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--leh-muted)' }}>
                            {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {isDeadLetter && job && (
                                <button
                                  type="button"
                                  className="btn-leh-danger"
                                  style={{ height: '32px', fontSize: '11px', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
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
                                  type="button"
                                  className="btn-leh-forest"
                                  style={{ height: '32px', fontSize: '12px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
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
              </div>
            )}

            {ediTransmissions.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <strong style={{ fontSize: '13px', color: 'var(--leh-ink)' }}>Recent Transmission Log</strong>
                <div style={{ border: '1px solid var(--leh-border)', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
                  <table className="insurance-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Batch</th><th>Payer</th><th>Protocol</th><th>Destination</th>
                        <th style={{ textAlign: 'center' }}>Status</th><th>Transmitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ediTransmissions.slice(0, 15).map((tx: any) => (
                        <tr key={tx.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{tx.batch_number}</td>
                          <td>{tx.payer_name}</td>
                          <td><span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{tx.protocol}</span></td>
                          <td style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.destination}</td>
                          <td style={{ textAlign: 'center' }}>
                            {tx.status === 'SUCCESS'
                              ? <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><CheckSquare size={13} /> OK</span>
                              : <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><XSquare size={13} /> FAILED</span>}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--leh-muted)' }}>
                            {tx.transmitted_at ? new Date(tx.transmitted_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Payer EDI Configs tab */
          <div>
            <p style={{ color: 'var(--leh-muted)', fontSize: '13px', marginBottom: '14px', lineHeight: 1.5 }}>
              Configure the clearinghouse protocol for each HMO payer.
              <strong> LOCAL_FOLDER</strong> writes files to disk,
              <strong> REST_WEBHOOK</strong> posts to an HTTP endpoint,
              <strong> SFTP</strong> queues to the SFTP outbox directory.
            </p>
            {ediConfigs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--leh-muted)', padding: '2.5rem' }}>
                <Settings size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                No EDI configs yet. Add a payer to begin configuring.
              </div>
            ) : (
              ediConfigs.map((cfg: any) => {
                const edit = ediConfigEdit[cfg.payer_id] ?? cfg;
                const setEdit = (patch: any) => setEdiConfigEdit((prev) => ({ ...prev, [cfg.payer_id]: { ...(prev[cfg.payer_id] ?? cfg), ...patch } }));
                return (
                  <FormSection
                    key={cfg.payer_id}
                    title={`${cfg.payer_name} (${cfg.payer_code})`}
                    action={
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--leh-forest)' }}>
                        <input type="checkbox" checked={!!edit.is_enabled} onChange={(e) => setEdit({ is_enabled: e.target.checked ? 1 : 0 })} />
                        Enabled
                      </label>
                    }
                  >
                    <FormGrid columns={3}>
                      <FormField label="Protocol">
                        <FormSelect value={edit.protocol || 'LOCAL_FOLDER'} onChange={(e) => setEdit({ protocol: e.target.value })}>
                          <option value="LOCAL_FOLDER">LOCAL_FOLDER (File Drop)</option>
                          <option value="REST_WEBHOOK">REST_WEBHOOK (HTTP POST)</option>
                          <option value="SFTP">SFTP</option>
                        </FormSelect>
                      </FormField>

                      <FormField label="Format">
                        <FormSelect value={edit.format || 'JSON'} onChange={(e) => setEdit({ format: e.target.value })}>
                          <option value="JSON">JSON</option>
                          <option value="CSV">CSV</option>
                        </FormSelect>
                      </FormField>

                      <FormField label="Auto-Dispatch">
                        <FormSelect value={edit.auto_dispatch ? '1' : '0'} onChange={(e) => setEdit({ auto_dispatch: e.target.value === '1' ? 1 : 0 })}>
                          <option value="0">Manual only</option>
                          <option value="1">Every 30 min (cron)</option>
                        </FormSelect>
                      </FormField>
                    </FormGrid>

                    {edit.protocol === 'LOCAL_FOLDER' && (
                      <FormField label="Local Folder Path">
                        <FormInput type="text" placeholder="e.g. C:\EDI\Outbox or ./edi_exports" value={edit.local_folder_path || ''} onChange={(e) => setEdit({ local_folder_path: e.target.value })} />
                      </FormField>
                    )}

                    {edit.protocol === 'REST_WEBHOOK' && (
                      <FormGrid columns={2}>
                        <FormField label="Webhook URL">
                          <FormInput type="text" placeholder="https://hmo-portal.com/api/claims" value={edit.webhook_url || ''} onChange={(e) => setEdit({ webhook_url: e.target.value })} />
                        </FormField>
                        <FormField label="Auth Header (optional)">
                          <FormInput type="text" placeholder="Bearer token or API key" value={edit.webhook_auth_header || ''} onChange={(e) => setEdit({ webhook_auth_header: e.target.value })} />
                        </FormField>
                      </FormGrid>
                    )}

                    {edit.protocol === 'SFTP' && (
                      <>
                        <FormGrid columns={4}>
                          <FormField label="SFTP Host">
                            <FormInput type="text" placeholder="sftp.hmo.com" value={edit.sftp_host || ''} onChange={(e) => setEdit({ sftp_host: e.target.value })} />
                          </FormField>
                          <FormField label="Port">
                            <FormInput type="number" placeholder="22" value={edit.sftp_port || 22} onChange={(e) => setEdit({ sftp_port: parseInt(e.target.value) })} />
                          </FormField>
                          <FormField label="Username">
                            <FormInput type="text" value={edit.sftp_username || ''} onChange={(e) => setEdit({ sftp_username: e.target.value })} />
                          </FormField>
                          <FormField label="Password">
                            <FormInput type="password" value={edit.sftp_password || ''} onChange={(e) => setEdit({ sftp_password: e.target.value })} />
                          </FormField>
                        </FormGrid>
                        <FormField label="Remote Path">
                          <FormInput type="text" placeholder="/claims/inbound" value={edit.sftp_remote_path || ''} onChange={(e) => setEdit({ sftp_remote_path: e.target.value })} />
                        </FormField>
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <FormButton
                        variant="primary"
                        disabled={savingConfigId === cfg.payer_id}
                        loading={savingConfigId === cfg.payer_id}
                        onClick={() => handleSaveEdiConfig(cfg.payer_id)}
                        icon={<ChevronRight size={14} />}
                      >
                        Save Config
                      </FormButton>
                    </div>
                  </FormSection>
                );
              })
            )}
          </div>
        )}
      </InsuranceModal>
    </div>
  );
};
