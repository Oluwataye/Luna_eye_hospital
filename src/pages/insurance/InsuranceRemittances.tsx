import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, Plus, CheckCircle2, Clock, 
  RefreshCw, X, Building2, DollarSign
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { InsuranceNavHeader } from './InsuranceNavHeader';
import './Insurance.css';

export const InsuranceRemittances: React.FC = () => {
  const { notify } = useNotification();

  const [remittances, setRemittances] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [payerFilter, setPayerFilter] = useState('');

  // Record Remittance Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    payer_id: '',
    payment_reference: '',
    payment_date: new Date().toISOString().slice(0, 10),
    total_amount: '',
    payment_method: 'EFT',
    bank_name: '',
    notes: ''
  });

  // Allocation Modal
  const [allocationModal, setAllocationModal] = useState<{
    open: boolean;
    remittance: any | null;
    claims: any[];
    allocations: Record<number, number>; // claimId -> allocated amount (in Naira)
    loadingClaims: boolean;
  }>({
    open: false,
    remittance: null,
    claims: [],
    allocations: {},
    loadingClaims: false
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [remRes, payersRes] = await Promise.all([
        api.insurance.getRemittances({
          payer_id: payerFilter || undefined
        }),
        api.insurance.getPayers(true)
      ]);
      setRemittances(remRes || []);
      setPayers(payersRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load remittances');
    } finally {
      setLoading(false);
    }
  }, [payerFilter, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRemittance = async () => {
    if (!recordForm.payer_id || !recordForm.payment_reference.trim() || !recordForm.total_amount) {
      notify('error', 'Payer, Payment Reference, and Amount are required');
      return;
    }
    const amountKobo = Math.round(parseFloat(recordForm.total_amount) * 100);
    if (isNaN(amountKobo) || amountKobo <= 0) {
      notify('error', 'Please provide a valid positive payment amount');
      return;
    }

    try {
      await api.insurance.createRemittance({
        payer_id: parseInt(recordForm.payer_id),
        payment_reference: recordForm.payment_reference,
        payment_date: recordForm.payment_date,
        total_amount: amountKobo,
        payment_method: recordForm.payment_method,
        bank_name: recordForm.bank_name,
        notes: recordForm.notes
      });
      notify('success', 'Remittance recorded successfully');
      setIsRecordModalOpen(false);
      setRecordForm({
        payer_id: '',
        payment_reference: '',
        payment_date: new Date().toISOString().slice(0, 10),
        total_amount: '',
        payment_method: 'EFT',
        bank_name: '',
        notes: ''
      });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Failed to record remittance');
    }
  };

  const openAllocationModal = async (rem: any) => {
    setAllocationModal({
      open: true,
      remittance: rem,
      claims: [],
      allocations: {},
      loadingClaims: true
    });

    try {
      // Fetch claims for this payer that are not fully paid
      const claimsRes = await api.insurance.getClaims({
        payer_id: rem.payer_id,
        limit: 100
      });
      const eligible = (claimsRes.claims || claimsRes || []).filter(
        (c: any) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'PARTIALLY_PAID'].includes(c.status)
      );
      setAllocationModal((prev) => ({
        ...prev,
        claims: eligible,
        loadingClaims: false
      }));
    } catch (err: any) {
      notify('error', 'Failed to fetch candidate claims for allocation');
      setAllocationModal((prev) => ({ ...prev, loadingClaims: false }));
    }
  };

  const handleAllocationAmountChange = (claimId: number, amountNaira: number) => {
    setAllocationModal((prev) => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [claimId]: amountNaira
      }
    }));
  };

  const executeAllocation = async () => {
    const { remittance, allocations } = allocationModal;
    if (!remittance) return;

    const payload = Object.entries(allocations)
      .filter(([_, val]) => val > 0)
      .map(([cId, val]) => ({
        claim_id: parseInt(cId),
        allocated_amount: Math.round(val * 100) // to kobo
      }));

    if (payload.length === 0) {
      notify('error', 'Please allocate an amount to at least one claim');
      return;
    }

    try {
      await api.insurance.allocateRemittance(remittance.id, payload);
      notify('success', 'Remittance allocated successfully');
      setAllocationModal({
        open: false,
        remittance: null,
        claims: [],
        allocations: {},
        loadingClaims: false
      });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Allocation failed');
    }
  };

  const formatNaira = (kobo: number) => {
    const amount = (kobo || 0) / 100;
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalAllocatedInModal = Object.values(allocationModal.allocations).reduce(
    (sum, val) => sum + (val || 0),
    0
  );
  const remainingUnallocatedInModal = allocationModal.remittance
    ? (allocationModal.remittance.unallocated_amount || 0) / 100 - totalAllocatedInModal
    : 0;

  return (
    <div className="insurance-container">
      {/* Header */}
      <InsuranceNavHeader
        title="Remittances & Settlements"
        subtitle="Record HMO bank payments and reconcile claim reimbursements"
        actions={
          <>
            <button
              className="btn-leh-forest"
              onClick={() => setIsRecordModalOpen(true)}
            >
              <Plus size={15} /> Record Remittance
            </button>
            <button className="btn-leh-secondary" onClick={loadData}>
              <RefreshCw size={15} /> Refresh
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="insurance-grid-stats">
        <div className="insurance-stat-card-modern">
          <div className="ins-stat-header">
            <span className="ins-stat-label">Total Received</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#dcfce7', color: '#15803d' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{formatNaira(remittances.reduce((s, r) => s + (r.total_amount || 0), 0))}</div>
          <div className="ins-stat-footer">All recorded payer inflows</div>
        </div>

        <div className="insurance-stat-card-modern">
          <div className="ins-stat-header">
            <span className="ins-stat-label">Fully Allocated</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{remittances.filter(r => (r.unallocated_amount || 0) === 0).length}</div>
          <div className="ins-stat-footer">Reconciled to claims</div>
        </div>

        <div className="insurance-stat-card-modern">
          <div className="ins-stat-header">
            <span className="ins-stat-label">Pending Allocation</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#fef3c7', color: '#b45309' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{remittances.filter(r => (r.unallocated_amount || 0) > 0).length}</div>
          <div className="ins-stat-footer">Contains unassigned credit</div>
        </div>
      </div>

      {/* Remittances Table Card */}
      <div className="insurance-card">
        <div className="insurance-filter-bar">
          <select
            className="insurance-filter-select"
            style={{ minWidth: '220px' }}
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="">All Payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {payerFilter && (
            <button
              className="btn-leh-secondary"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
              onClick={() => setPayerFilter('')}
            >
              Clear
            </button>
          )}
        </div>

        <div className="insurance-table-container">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : remittances.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              <CreditCard size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No remittances recorded yet.</p>
            </div>
          ) : (
            <table className="insurance-table">
              <thead>
                <tr>
                  <th>Payment Ref</th>
                  <th>Payer</th>
                  <th>Payment Date</th>
                  <th>Method & Bank</th>
                  <th style={{ textAlign: 'right' }}>Total Received</th>
                  <th style={{ textAlign: 'right' }}>Allocated</th>
                  <th style={{ textAlign: 'right' }}>Unallocated</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map((rem) => {
                  const unallocated = rem.unallocated_amount || 0;
                  return (
                    <tr key={rem.id}>
                      <td style={{ fontWeight: 600, color: 'var(--leh-forest)' }}>
                        {rem.payment_reference}
                      </td>
                      <td style={{ fontWeight: 500 }}>{rem.payer_name}</td>
                      <td>{rem.payment_date}</td>
                      <td>
                        <div>{rem.payment_method}</div>
                        {rem.bank_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>{rem.bank_name}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatNaira(rem.total_amount)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#15803d' }}>
                        {formatNaira(rem.allocated_amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: unallocated > 0 ? '#b45309' : '#64748b' }}>
                        {formatNaira(unallocated)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {unallocated > 0 ? (
                          <button
                            className="btn-leh-forest"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
                            onClick={() => openAllocationModal(rem)}
                          >
                            Allocate ({formatNaira(unallocated)})
                          </button>
                        ) : (
                          <span className="ins-badge ins-badge--paid">Reconciled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Remittance Modal */}
      {isRecordModalOpen && (
        <div className="ins-modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsRecordModalOpen(false)}>
          <div className="ins-modal" style={{ maxWidth: '640px' }}>
            <div className="ins-modal-header">
              <div className="ins-modal-header-left">
                <div className="ins-modal-icon-badge ins-modal-icon-badge--forest">
                  <CreditCard size={22} />
                </div>
                <div className="ins-modal-title-wrap">
                  <h3 className="ins-modal-title">Record Inflow Remittance</h3>
                  <p className="ins-modal-subtitle">Log HMO electronic bank settlement advice and reconciliation credit</p>
                </div>
              </div>
              <button 
                type="button" 
                className="ins-modal-close-btn" 
                onClick={() => setIsRecordModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ins-modal-body">
              {/* Section 1: Payer & Payment Reference */}
              <div className="ins-modal-section-card">
                <div className="ins-modal-section-title">
                  <Building2 size={14} /> Payer & Transaction Identification
                </div>
                
                <div className="ins-form-group">
                  <label className="ins-form-label">
                    Payer / HMO Network <span className="ins-form-label-required">*</span>
                  </label>
                  <select
                    className="ins-form-select"
                    value={recordForm.payer_id}
                    onChange={(e) => setRecordForm({ ...recordForm, payer_id: e.target.value })}
                  >
                    <option value="">-- Choose HMO / Insurance Payer --</option>
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                  <div className="ins-form-group" style={{ marginBottom: 0 }}>
                    <label className="ins-form-label">
                      Payment / Bank Reference <span className="ins-form-label-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="ins-form-input"
                      placeholder="e.g. TRF/HYG/2026/01 or NIP-88291"
                      value={recordForm.payment_reference}
                      onChange={(e) => setRecordForm({ ...recordForm, payment_reference: e.target.value })}
                    />
                  </div>
                  <div className="ins-form-group" style={{ marginBottom: 0 }}>
                    <label className="ins-form-label">Payment Date</label>
                    <input
                      type="date"
                      className="ins-form-input"
                      value={recordForm.payment_date}
                      onChange={(e) => setRecordForm({ ...recordForm, payment_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Financial Amount & Banking Details */}
              <div className="ins-modal-section-card" style={{ marginBottom: 0 }}>
                <div className="ins-modal-section-title">
                  <DollarSign size={14} /> Settlement Amount & Bank Routing
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="ins-form-group" style={{ marginBottom: 0 }}>
                    <label className="ins-form-label">
                      Total Remitted Amount <span className="ins-form-label-required">*</span>
                    </label>
                    <div className="ins-currency-input-wrap">
                      <span className="ins-currency-prefix">₦</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="ins-form-input ins-form-input--currency"
                        placeholder="0.00"
                        value={recordForm.total_amount}
                        onChange={(e) => setRecordForm({ ...recordForm, total_amount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="ins-form-group" style={{ marginBottom: 0 }}>
                    <label className="ins-form-label">Settlement Channel</label>
                    <select
                      className="ins-form-select"
                      value={recordForm.payment_method}
                      onChange={(e) => setRecordForm({ ...recordForm, payment_method: e.target.value })}
                    >
                      <option value="EFT">Electronic Bank Transfer (EFT)</option>
                      <option value="CHEQUE">Bank Cheque / Draft</option>
                      <option value="DIRECT_DEPOSIT">Direct Over-the-Counter Deposit</option>
                    </select>
                  </div>
                </div>

                <div className="ins-form-group">
                  <label className="ins-form-label">Hospital Receiving Bank Account</label>
                  <input
                    type="text"
                    className="ins-form-input"
                    placeholder="e.g. Zenith Bank - Operations Account (1012998231)"
                    value={recordForm.bank_name}
                    onChange={(e) => setRecordForm({ ...recordForm, bank_name: e.target.value })}
                  />
                </div>

                <div className="ins-form-group" style={{ marginBottom: 0 }}>
                  <label className="ins-form-label">Remittance Advice Notes / Description</label>
                  <textarea
                    className="ins-form-textarea"
                    rows={2}
                    placeholder="e.g. Inflow remittance covering approved claims for January 2026..."
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="ins-modal-footer">
              <button 
                type="button" 
                className="btn-leh-secondary" 
                onClick={() => setIsRecordModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-leh-forest" 
                onClick={handleCreateRemittance}
              >
                <CheckCircle2 size={15} /> Save Inflow Remittance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Modal */}
      {allocationModal.open && (
        <div className="ins-modal-overlay" onClick={(e) => e.target === e.currentTarget && setAllocationModal({ ...allocationModal, open: false })}>
          <div className="ins-modal" style={{ maxWidth: '880px' }}>
            <div className="ins-modal-header">
              <div className="ins-modal-header-left">
                <div className="ins-modal-icon-badge ins-modal-icon-badge--blue">
                  <CreditCard size={22} />
                </div>
                <div className="ins-modal-title-wrap">
                  <h3 className="ins-modal-title">
                    Allocate Remittance: {allocationModal.remittance?.payment_reference}
                  </h3>
                  <p className="ins-modal-subtitle">
                    Payer: <strong>{allocationModal.remittance?.payer_name}</strong> &bull; Total Available Remittance: {formatNaira(allocationModal.remittance?.unallocated_amount)}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="ins-modal-close-btn" 
                onClick={() => setAllocationModal({ ...allocationModal, open: false })}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ins-modal-body">
              {/* Live allocation counter banner */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px', 
                padding: '16px 20px', 
                background: '#fbfdf9', 
                borderRadius: '14px', 
                marginBottom: '18px', 
                border: '1.5px solid var(--leh-border)' 
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--leh-muted)' }}>
                    Allocating to Claims Now
                  </span>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem', color: 'var(--leh-forest)', letterSpacing: '-0.02em', marginTop: '2px' }}>
                    ₦{totalAllocatedInModal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--leh-muted)' }}>
                    Remaining Unallocated Balance
                  </span>
                  <div style={{ 
                    fontWeight: 900, 
                    fontSize: '1.4rem', 
                    color: remainingUnallocatedInModal < 0 ? '#dc2626' : '#15803d', 
                    letterSpacing: '-0.02em', 
                    marginTop: '2px' 
                  }}>
                    ₦{remainingUnallocatedInModal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {allocationModal.loadingClaims ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <LoadingSpinner />
                </div>
              ) : allocationModal.claims.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>No open or unpaid claims found for this payer.</p>
                </div>
              ) : (
                <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--leh-border)', borderRadius: '14px' }}>
                  <table className="insurance-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Claim Voucher</th>
                        <th>Patient Name</th>
                        <th>Service Date</th>
                        <th style={{ textAlign: 'right' }}>Claimed</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th style={{ width: '170px', textAlign: 'right' }}>Allocate (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationModal.claims.map((clm) => {
                        const claimedNaira = (clm.total_claimed || 0) / 100;
                        const paidNaira = (clm.total_paid || 0) / 100;
                        const outstanding = claimedNaira - paidNaira;
                        const currentVal = allocationModal.allocations[clm.id] || '';

                        return (
                          <tr key={clm.id}>
                            <td style={{ fontWeight: 700, color: 'var(--leh-ink)' }}>{clm.claim_number}</td>
                            <td>{clm.patient_name || clm.patient_id}</td>
                            <td style={{ color: 'var(--leh-muted)' }}>{clm.service_date}</td>
                            <td style={{ textAlign: 'right' }}>₦{claimedNaira.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                              ₦{outstanding.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="ins-currency-input-wrap">
                                <span className="ins-currency-prefix" style={{ fontSize: '13px', left: '10px' }}>₦</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={outstanding}
                                  className="ins-form-input ins-form-input--currency"
                                  style={{ textAlign: 'right', padding: '6px 10px 6px 24px', height: '34px', fontSize: '13px' }}
                                  placeholder="0.00"
                                  value={currentVal}
                                  onChange={(e) => handleAllocationAmountChange(clm.id, parseFloat(e.target.value) || 0)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="ins-modal-footer">
              <button 
                type="button" 
                className="btn-leh-secondary" 
                onClick={() => setAllocationModal({ ...allocationModal, open: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-leh-forest"
                disabled={totalAllocatedInModal <= 0 || remainingUnallocatedInModal < 0}
                onClick={executeAllocation}
              >
                <CheckCircle2 size={15} /> Confirm Settlements ({Object.values(allocationModal.allocations).filter(v => v > 0).length} Claims)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
