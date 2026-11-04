import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, Plus, CheckCircle2, Clock, 
  RefreshCw, X
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatCard } from '../../components/StatCard';
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
      <div className="insurance-header">
        <div>
          <h1 className="insurance-title">Remittances & Settlements</h1>
          <p className="insurance-subtitle">Record HMO bank payments and reconcile claim reimbursements</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--leh-forest)' }}
            onClick={() => setIsRecordModalOpen(true)}
          >
            <Plus size={16} /> Record Remittance
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="insurance-grid-stats">
        <StatCard
          title="Total Received"
          value={formatNaira(remittances.reduce((s, r) => s + (r.total_amount || 0), 0))}
          subtitle="All recorded payer inflows"
          icon={CreditCard}
          colorClass="green"
        />
        <StatCard
          title="Fully Allocated"
          value={remittances.filter(r => (r.unallocated_amount || 0) === 0).length}
          subtitle="Reconciled to claims"
          icon={CheckCircle2}
          colorClass="blue"
        />
        <StatCard
          title="Pending Allocation"
          value={remittances.filter(r => (r.unallocated_amount || 0) > 0).length}
          subtitle="Contains unassigned credit"
          icon={Clock}
          colorClass="amber"
        />
      </div>

      {/* Remittances Table Card */}
      <div className="insurance-card">
        <div className="insurance-filter-bar">
          <select
            className="form-select"
            style={{ width: '220px', height: '36px' }}
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="">All Payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {payerFilter && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPayerFilter('')}>
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
                            className="btn btn-sm btn-primary"
                            style={{ background: 'var(--leh-forest)', fontSize: '0.75rem' }}
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
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Record Inflow Remittance</h3>
              <button className="btn btn-sm btn-link" onClick={() => setIsRecordModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Payer / HMO *</label>
                <select
                  className="form-select"
                  value={recordForm.payer_id}
                  onChange={(e) => setRecordForm({ ...recordForm, payer_id: e.target.value })}
                >
                  <option value="">-- Choose Payer --</option>
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Reference *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. TRF/HYG/2026/01"
                    value={recordForm.payment_reference}
                    onChange={(e) => setRecordForm({ ...recordForm, payment_reference: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={recordForm.payment_date}
                    onChange={(e) => setRecordForm({ ...recordForm, payment_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Total Remitted Amount (₦) *</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    placeholder="e.g. 500000"
                    value={recordForm.total_amount}
                    onChange={(e) => setRecordForm({ ...recordForm, total_amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Method</label>
                  <select
                    className="form-select"
                    value={recordForm.payment_method}
                    onChange={(e) => setRecordForm({ ...recordForm, payment_method: e.target.value })}
                  >
                    <option value="EFT">Electronic Bank Transfer (EFT)</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Hospital Receiving Bank</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Zenith Bank - Operations Account"
                  value={recordForm.bank_name}
                  onChange={(e) => setRecordForm({ ...recordForm, bank_name: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Notes / Remittance Advice Details</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Covering claims submitted for January 2026..."
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsRecordModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateRemittance}>
                Save Remittance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Modal */}
      {allocationModal.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal" style={{ maxWidth: '850px' }}>
            <div className="ins-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  Allocate Remittance: {allocationModal.remittance?.payment_reference}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--leh-muted)' }}>
                  Payer: <strong>{allocationModal.remittance?.payer_name}</strong> &bull; Total Available: {formatNaira(allocationModal.remittance?.unallocated_amount)}
                </p>
              </div>
              <button className="btn btn-sm btn-link" onClick={() => setAllocationModal({ ...allocationModal, open: false })}>
                <X size={20} />
              </button>
            </div>

            <div className="ins-modal-body">
              {/* Live allocation counter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Allocating Now:</span>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--leh-forest)' }}>
                    ₦{totalAllocatedInModal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Remaining Balance:</span>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: remainingUnallocatedInModal < 0 ? '#dc2626' : '#15803d' }}>
                    ₦{remainingUnallocatedInModal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {allocationModal.loadingClaims ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <LoadingSpinner />
                </div>
              ) : allocationModal.claims.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--leh-muted)', padding: '2rem' }}>
                  No open or unpaid claims found for this payer.
                </p>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="insurance-table">
                    <thead>
                      <tr>
                        <th>Claim #</th>
                        <th>Patient</th>
                        <th>Service Date</th>
                        <th style={{ textAlign: 'right' }}>Claimed</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th style={{ width: '160px', textAlign: 'right' }}>Allocate (₦)</th>
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
                            <td style={{ fontWeight: 600 }}>{clm.claim_number}</td>
                            <td>{clm.patient_name || clm.patient_id}</td>
                            <td>{clm.service_date}</td>
                            <td style={{ textAlign: 'right' }}>₦{claimedNaira.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                              ₦{outstanding.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                min={0}
                                max={outstanding}
                                className="form-control form-control-sm"
                                style={{ textAlign: 'right' }}
                                placeholder="0.00"
                                value={currentVal}
                                onChange={(e) => handleAllocationAmountChange(clm.id, parseFloat(e.target.value) || 0)}
                              />
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
              <button className="btn btn-secondary" onClick={() => setAllocationModal({ ...allocationModal, open: false })}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={totalAllocatedInModal <= 0 || remainingUnallocatedInModal < 0}
                onClick={executeAllocation}
              >
                Confirm Allocations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
