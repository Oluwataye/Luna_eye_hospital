import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, Plus, CheckCircle2, Clock, 
  RefreshCw, Building2, DollarSign
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

export const InsuranceRemittances: React.FC = () => {
  const { notify } = useNotification();

  const [remittances, setRemittances] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [payerFilter, setPayerFilter] = useState('');

  // Record Remittance Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
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

    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
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

    setIsAllocating(true);
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
    } finally {
      setIsAllocating(false);
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
      </div>      {/* Record Remittance Modal */}
      <InsuranceModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Inflow Remittance"
        subtitle="Log HMO electronic bank settlement advice and reconciliation credit"
        icon={<CreditCard size={18} />}
        size="md"
        isDirty={
          Boolean(
            recordForm.payer_id ||
            recordForm.payment_reference.trim() ||
            recordForm.total_amount ||
            recordForm.bank_name.trim() ||
            recordForm.notes.trim()
          )
        }
        footer={
          <>
            <FormButton
              variant="secondary"
              onClick={() => setIsRecordModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </FormButton>
            <FormButton
              variant="primary"
              onClick={handleCreateRemittance}
              loading={isSubmitting}
              icon={<CheckCircle2 size={16} />}
            >
              Save Inflow Remittance
            </FormButton>
          </>
        }
      >
        <FormSection
          title="Payer & Transaction Identification"
          icon={<Building2 size={15} />}
        >
          <FormField label="Payer / HMO Network" required>
            <FormSelect
              value={recordForm.payer_id}
              onChange={(e) => setRecordForm({ ...recordForm, payer_id: e.target.value })}
            >
              <option value="">-- Choose HMO / Insurance Payer --</option>
              {payers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </FormSelect>
          </FormField>

          <FormGrid columns={2}>
            <FormField label="Payment / Bank Reference" required>
              <FormInput
                type="text"
                placeholder="e.g. TRF/HYG/2026/01 or NIP-88291"
                value={recordForm.payment_reference}
                onChange={(e) => setRecordForm({ ...recordForm, payment_reference: e.target.value })}
              />
            </FormField>
            <FormField label="Payment Date" required>
              <FormInput
                type="date"
                value={recordForm.payment_date}
                onChange={(e) => setRecordForm({ ...recordForm, payment_date: e.target.value })}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Settlement Amount & Bank Routing"
          icon={<DollarSign size={15} />}
        >
          <FormGrid columns={2}>
            <FormField label="Total Remitted Amount" required>
              <FormInput
                type="number"
                currency
                min={0}
                step="0.01"
                placeholder="0.00"
                value={recordForm.total_amount}
                onChange={(e) => setRecordForm({ ...recordForm, total_amount: e.target.value })}
              />
            </FormField>

            <FormField label="Settlement Channel">
              <FormSelect
                value={recordForm.payment_method}
                onChange={(e) => setRecordForm({ ...recordForm, payment_method: e.target.value })}
              >
                <option value="EFT">Electronic Bank Transfer (EFT)</option>
                <option value="CHEQUE">Bank Cheque / Draft</option>
                <option value="DIRECT_DEPOSIT">Direct Over-the-Counter Deposit</option>
              </FormSelect>
            </FormField>
          </FormGrid>

          <FormField label="Hospital Receiving Bank Account">
            <FormInput
              type="text"
              placeholder="e.g. Zenith Bank - Operations Account (1012998231)"
              value={recordForm.bank_name}
              onChange={(e) => setRecordForm({ ...recordForm, bank_name: e.target.value })}
            />
          </FormField>

          <FormField label="Remittance Advice Notes / Description">
            <FormTextarea
              rows={2}
              placeholder="e.g. Inflow remittance covering approved claims for January 2026..."
              value={recordForm.notes}
              onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
            />
          </FormField>
        </FormSection>
      </InsuranceModal>

      {/* Allocation Modal */}
      <InsuranceModal
        isOpen={allocationModal.open}
        onClose={() => setAllocationModal({ ...allocationModal, open: false })}
        title={`Allocate Remittance: ${allocationModal.remittance?.payment_reference || ''}`}
        subtitle={`Payer: ${allocationModal.remittance?.payer_name || 'HMO'} • Total Available Remittance: ${formatNaira(allocationModal.remittance?.unallocated_amount)}`}
        icon={<CreditCard size={18} />}
        size="lg"
        isDirty={totalAllocatedInModal > 0}
        footer={
          <>
            <FormButton
              variant="secondary"
              onClick={() => setAllocationModal({ ...allocationModal, open: false })}
              disabled={isAllocating}
            >
              Cancel
            </FormButton>
            <FormButton
              variant="primary"
              disabled={totalAllocatedInModal <= 0 || remainingUnallocatedInModal < 0}
              loading={isAllocating}
              onClick={executeAllocation}
              icon={<CheckCircle2 size={16} />}
            >
              Confirm Settlements ({Object.values(allocationModal.allocations).filter((v: number) => v > 0).length} Claims)
            </FormButton>
          </>
        }
      >
        {/* Live allocation counter banner */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '16px', 
          padding: '16px 20px', 
          background: 'var(--leh-surface-alt, #fbfdf9)', 
          borderRadius: '12px', 
          marginBottom: '18px', 
          border: '1px solid var(--leh-border)' 
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
          <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--leh-border)', borderRadius: '12px' }}>
            <table className="insurance-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Claim Voucher</th>
                  <th>Patient Name</th>
                  <th>Service Date</th>
                  <th style={{ textAlign: 'right' }}>Claimed</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>Allocate (₦)</th>
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
                        <FormInput
                          type="number"
                          currency
                          min={0}
                          max={outstanding}
                          style={{ textAlign: 'right', height: '36px', fontSize: '13px' }}
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
      </InsuranceModal>
    </div>
  );
};
