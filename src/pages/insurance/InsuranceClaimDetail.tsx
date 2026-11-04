import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Printer, Plus, Trash2, X
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import './Insurance.css';

export const InsuranceClaimDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useNotification();

  const [claim, setClaim] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);

  // Note dialog
  const [newNote, setNewNote] = useState('');

  // Status transition dialog
  const [transitionDialog, setTransitionDialog] = useState<{
    open: boolean;
    toStatus: string;
    reason: string;
    note: string;
    approvedAmount?: number;
  }>({
    open: false,
    toStatus: '',
    reason: '',
    note: ''
  });

  // Write-off dialog
  const [writeOffDialog, setWriteOffDialog] = useState<{
    open: boolean;
    reason: string;
  }>({
    open: false,
    reason: ''
  });

  // New Item dialog
  const [newItemDialog, setNewItemDialog] = useState<{
    open: boolean;
    item_type: string;
    item_code: string;
    description: string;
    quantity: number;
    unit_price: number;
  }>({
    open: false,
    item_type: 'SERVICE',
    item_code: '',
    description: '',
    quantity: 1,
    unit_price: 0
  });

  const loadClaim = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [claimRes, reasonsRes] = await Promise.all([
        api.insurance.getClaim(parseInt(id)),
        api.insurance.getRejectionReasons()
      ]);
      setClaim(claimRes.claim || claimRes);
      setHistory(claimRes.history || []);
      setItems(claimRes.items || []);
      setRejectionReasons(reasonsRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load claim detail');
    } finally {
      setLoading(false);
    }
  }, [id, notify]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  const formatNaira = (kobo: number) => {
    const amount = (kobo || 0) / 100;
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isLocked = ['PAID', 'WRITTEN_OFF', 'CANCELLED'].includes(claim?.status);

  // Legal transitions map
  const getAvailableTransitions = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'DRAFT': return ['READY', 'CANCELLED'];
      case 'READY': return ['SUBMITTED', 'CANCELLED'];
      case 'SUBMITTED': return ['UNDER_REVIEW', 'QUERIED', 'REJECTED'];
      case 'UNDER_REVIEW': return ['APPROVED', 'PARTIALLY_APPROVED', 'QUERIED', 'REJECTED'];
      case 'QUERIED': return ['RESUBMITTED'];
      case 'RESUBMITTED': return ['UNDER_REVIEW'];
      case 'APPROVED': return ['PAID'];
      case 'PARTIALLY_APPROVED': return ['PARTIALLY_PAID'];
      case 'PARTIALLY_PAID': return ['PAID'];
      case 'REJECTED': return ['DRAFT', 'WRITTEN_OFF'];
      default: return [];
    }
  };

  const handleTransition = async () => {
    if (!claim) return;
    const { toStatus, reason, note, approvedAmount } = transitionDialog;
    try {
      await api.insurance.transitionClaim(claim.id, toStatus, reason, note);
      
      // If approved amount was provided and status is APPROVED / PARTIALLY_APPROVED
      if (approvedAmount !== undefined && ['APPROVED', 'PARTIALLY_APPROVED'].includes(toStatus)) {
        await api.insurance.updateClaim(claim.id, {
          total_approved: Math.round(approvedAmount * 100)
        });
      }

      notify('success', `Status updated to ${toStatus}`);
      setTransitionDialog({ open: false, toStatus: '', reason: '', note: '' });
      loadClaim();
    } catch (err: any) {
      notify('error', err.message || 'Transition failed');
    }
  };

  const handleWriteOff = async () => {
    if (!claim || !writeOffDialog.reason) {
      notify('error', 'Reason is required to write off a claim');
      return;
    }
    try {
      await api.insurance.writeOffClaim(claim.id, writeOffDialog.reason);
      notify('success', 'Claim has been written off');
      setWriteOffDialog({ open: false, reason: '' });
      loadClaim();
    } catch (err: any) {
      notify('error', err.message || 'Write off failed');
    }
  };

  const handleAddNote = async () => {
    if (!claim || !newNote.trim()) return;
    try {
      await api.insurance.addClaimNote(claim.id, newNote);
      notify('success', 'Note added to claim');
      setNewNote('');
      loadClaim();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add note');
    }
  };

  const handleAddItem = async () => {
    if (!newItemDialog.description.trim() || newItemDialog.unit_price <= 0) {
      notify('error', 'Description and valid price are required');
      return;
    }
    const unitKobo = Math.round(newItemDialog.unit_price * 100);
    const claimedKobo = unitKobo * (newItemDialog.quantity || 1);
    const updatedItems = [
      ...items.map(it => ({
        item_type: it.item_type,
        item_code: it.item_code,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        claimed_amount: it.claimed_amount
      })),
      {
        item_type: newItemDialog.item_type,
        item_code: newItemDialog.item_code || 'MANUAL',
        description: newItemDialog.description,
        quantity: newItemDialog.quantity,
        unit_price: unitKobo,
        claimed_amount: claimedKobo
      }
    ];

    try {
      await api.insurance.updateClaimItems(claim.id, updatedItems);
      notify('success', 'Item added to claim');
      setNewItemDialog({
        open: false,
        item_type: 'SERVICE',
        item_code: '',
        description: '',
        quantity: 1,
        unit_price: 0
      });
      loadClaim();
    } catch (err: any) {
      notify('error', err.message || 'Failed to update items');
    }
  };

  const handleDeleteItem = async (index: number) => {
    if (!window.confirm('Remove this item from the claim?')) return;
    const updatedItems = items.filter((_, idx) => idx !== index).map(it => ({
      item_type: it.item_type,
      item_code: it.item_code,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      claimed_amount: it.claimed_amount
    }));

    try {
      await api.insurance.updateClaimItems(claim.id, updatedItems);
      notify('success', 'Item removed');
      loadClaim();
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove item');
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="insurance-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="insurance-container">
        <button className="btn btn-secondary" onClick={() => navigate('/insurance/claims')}>
          <ArrowLeft size={16} /> Back to Claims
        </button>
        <p style={{ marginTop: '2rem' }}>Claim not found.</p>
      </div>
    );
  }

  const availableTransitions = getAvailableTransitions(claim.status);

  return (
    <div className="insurance-container">
      {/* Top Controls (Hidden on Print) */}
      <div className="insurance-header no-print" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-leh-secondary" style={{ padding: '0.45rem 1rem' }} onClick={() => navigate('/insurance/claims')}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 className="insurance-title" style={{ fontSize: '1.4rem' }}>{claim.claim_number}</h1>
            <p className="insurance-subtitle">
              Payer: <strong>{claim.payer_name}</strong> &bull; Plan: {claim.plan_name || 'Standard'} &bull; Service Date: {claim.service_date}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-leh-secondary" onClick={triggerPrint}>
            <Printer size={15} /> Print Claim Form
          </button>
          {!isLocked && (
            <>
              {availableTransitions.map((st) => (
                <button
                  key={st}
                  className="btn-leh-forest"
                  onClick={() => setTransitionDialog({ open: true, toStatus: st, reason: '', note: '' })}
                >
                  Mark as {st.replace('_', ' ')}
                </button>
              ))}
              {['SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'PARTIALLY_APPROVED'].includes(claim.status) && (
                <button
                  className="btn-leh-danger"
                  onClick={() => setWriteOffDialog({ open: true, reason: '' })}
                >
                  Write-off Balance
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Claim Detail & Printable Layout */}
      <div className="printable-claim">
        {/* Hospital Branding Header (Always visible & on print) */}
        <div style={{ borderBottom: '2px solid var(--leh-forest)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--leh-forest)', fontSize: '1.5rem', fontWeight: 800 }}>
              LUNA EYE HOSPITAL
            </h2>
            <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#444' }}>
              Specialist Eye Centre &bull; Minna, Niger State, Nigeria
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
              Official HMO / NHIA Medical Claim Voucher
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{claim.claim_number}</div>
            <span className={`ins-badge ins-badge--${claim.status?.toLowerCase()}`}>
              {claim.status?.replace('_', ' ')}
            </span>
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
              Date: {claim.service_date}
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Patient & Policy */}
          <div className="insurance-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--leh-forest)', borderBottom: '1px solid var(--leh-border)', paddingBottom: '0.5rem' }}>
              Patient & Enrollee Information
            </h4>
            <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
              <div><strong>Patient Name:</strong> {claim.patient_name || claim.patient_id}</div>
              <div><strong>Patient File ID:</strong> {claim.patient_id}</div>
              <div><strong>Policy / Enrollee #:</strong> {claim.enrollee_number || 'N/A'}</div>
              <div><strong>Relationship:</strong> {claim.relationship || 'PRINCIPAL'}</div>
              <div><strong>Authorization Code:</strong> {claim.auth_code || 'None'}</div>
              <div><strong>Primary Diagnosis:</strong> {claim.primary_icd10 || 'Routine Ophthalmic Care'}</div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="insurance-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--leh-forest)', borderBottom: '1px solid var(--leh-border)', paddingBottom: '0.5rem' }}>
              Financial Adjudication
            </h4>
            <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Billed:</span>
                <strong>{formatNaira(claim.total_billed)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Patient Copay:</span>
                <strong>{formatNaira(claim.patient_copay)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--leh-forest)' }}>
                <span>Total Claimed (Payer Portion):</span>
                <strong>{formatNaira(claim.total_claimed)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
                <span>Approved Amount:</span>
                <strong>{claim.total_approved ? formatNaira(claim.total_approved) : 'Pending'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f766e' }}>
                <span>Paid by Payer:</span>
                <strong>{claim.total_paid ? formatNaira(claim.total_paid) : '₦0.00'}</strong>
              </div>
              {claim.rejection_reason && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fee2e2', borderRadius: '4px', color: '#991b1b' }}>
                  <strong>Rejection Note:</strong> {claim.rejection_reason}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Claim Items Table */}
        <div className="insurance-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--leh-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: 'var(--leh-ink)', fontWeight: 700 }}>Billed Service & Medication Items</h4>
            {!isLocked && (
              <button
                className="btn-leh-forest no-print"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                onClick={() => setNewItemDialog({ open: true, item_type: 'SERVICE', item_code: '', description: '', quantity: 1, unit_price: 0 })}
              >
                <Plus size={14} /> Add Item
              </button>
            )}
          </div>
          <div className="insurance-table-container">
            <table className="insurance-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Claimed</th>
                  <th style={{ textAlign: 'right' }}>Approved</th>
                  <th className="no-print" style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--leh-muted)' }}>
                      No items attached to this claim voucher.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>
                          {it.item_type}
                        </span>
                      </td>
                      <td>{it.item_code || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{it.description}</td>
                      <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatNaira(it.unit_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNaira(it.claimed_amount)}</td>
                      <td style={{ textAlign: 'right', color: it.approved_amount ? '#15803d' : 'inherit' }}>
                        {it.approved_amount ? formatNaira(it.approved_amount) : '—'}
                      </td>
                      <td className="no-print" style={{ textAlign: 'center' }}>
                        {!isLocked && (
                          <button
                            className="btn btn-sm btn-link text-danger"
                            title="Remove Item"
                            onClick={() => handleDeleteItem(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Doctor & Officer Certification Sign-off (Shown on Print) */}
        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
          <div style={{ borderTop: '1px solid #999', paddingTop: '0.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Attending Physician / Optometrist Signature & Date</p>
          </div>
          <div style={{ borderTop: '1px solid #999', paddingTop: '0.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Hospital Insurance Desk Officer Signature & Stamp</p>
          </div>
        </div>
      </div>

      {/* Audit History & Notes (No print) */}
      <div className="no-print" style={{ marginTop: '2rem' }}>
        <div className="insurance-card" style={{ padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--leh-ink)' }}>Status History & Audit Trail</h4>
          {history.length === 0 ? (
            <p style={{ color: 'var(--leh-muted)', fontSize: '0.875rem' }}>No status changes recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((h, i) => (
                <div key={i} style={{ borderLeft: '3px solid var(--leh-forest)', paddingLeft: '1rem', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 600 }}>
                    {h.from_status ? `${h.from_status} → ` : ''}{h.to_status}
                    <span style={{ fontWeight: 400, color: 'var(--leh-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>
                      by {h.changed_by} on {new Date(h.changed_at).toLocaleString()}
                    </span>
                  </div>
                  {h.notes && <div style={{ color: '#444', marginTop: '2px' }}>{h.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Add Note */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--leh-border)' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Add Case Note</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Log internal note or HMO phone discussion..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button className="btn-leh-secondary" style={{ padding: '0.45rem 1.1rem' }} onClick={handleAddNote}>
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Dialog */}
      {transitionDialog.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Transition to {transitionDialog.toStatus}</h3>
              <button className="btn btn-sm btn-link" onClick={() => setTransitionDialog({ ...transitionDialog, open: false })}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              {['APPROVED', 'PARTIALLY_APPROVED'].includes(transitionDialog.toStatus) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Approved Amount (₦) *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Enter approved amount"
                    value={transitionDialog.approvedAmount || ''}
                    onChange={(e) => setTransitionDialog({ ...transitionDialog, approvedAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
              {['REJECTED', 'QUERIED'].includes(transitionDialog.toStatus) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Rejection / Query Reason *</label>
                  <select
                    className="form-select"
                    value={transitionDialog.reason}
                    onChange={(e) => setTransitionDialog({ ...transitionDialog, reason: e.target.value })}
                  >
                    <option value="">-- Select Standard Reason --</option>
                    {rejectionReasons.map((r) => (
                      <option key={r.code} value={r.code}>{r.code} - {r.description}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Audit Note</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Optional details..."
                  value={transitionDialog.note}
                  onChange={(e) => setTransitionDialog({ ...transitionDialog, note: e.target.value })}
                />
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn-leh-secondary" onClick={() => setTransitionDialog({ ...transitionDialog, open: false })}>
                Cancel
              </button>
              <button className="btn-leh-forest" onClick={handleTransition}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write-off Dialog */}
      {writeOffDialog.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Write Off Claim Balance</h3>
              <button className="btn btn-sm btn-link" onClick={() => setWriteOffDialog({ open: false, reason: '' })}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              <p style={{ color: 'var(--leh-danger)' }}>
                Warning: Writing off will permanently close this claim and recognize uncollected payer balance as bad debt expense.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Reason for Write-off *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Disputed tariff / Payer denied appeal after 90 days..."
                  value={writeOffDialog.reason}
                  onChange={(e) => setWriteOffDialog({ ...writeOffDialog, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn-leh-secondary" onClick={() => setWriteOffDialog({ open: false, reason: '' })}>
                Cancel
              </button>
              <button className="btn-leh-danger" onClick={handleWriteOff}>
                Confirm Write-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Dialog */}
      {newItemDialog.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Add Service / Item</h3>
              <button className="btn btn-sm btn-link" onClick={() => setNewItemDialog({ ...newItemDialog, open: false })}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Item Type</label>
                <select
                  className="form-select"
                  value={newItemDialog.item_type}
                  onChange={(e) => setNewItemDialog({ ...newItemDialog, item_type: e.target.value })}
                >
                  <option value="SERVICE">Medical Service / Consultation</option>
                  <option value="INVESTIGATION">Laboratory / Diagnostic</option>
                  <option value="SURGERY">Surgical Procedure</option>
                  <option value="MEDICATION">Pharmacy / Drug</option>
                  <option value="FRAME">Optical Frame</option>
                  <option value="LENS">Optical Lens</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Item Code</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. EYE-CONS-01"
                  value={newItemDialog.item_code}
                  onChange={(e) => setNewItemDialog({ ...newItemDialog, item_code: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Description *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Slit lamp examination"
                  value={newItemDialog.description}
                  onChange={(e) => setNewItemDialog({ ...newItemDialog, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Quantity</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control"
                    value={newItemDialog.quantity}
                    onChange={(e) => setNewItemDialog({ ...newItemDialog, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Unit Price (₦) *</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={newItemDialog.unit_price || ''}
                    onChange={(e) => setNewItemDialog({ ...newItemDialog, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn-leh-secondary" onClick={() => setNewItemDialog({ ...newItemDialog, open: false })}>
                Cancel
              </button>
              <button className="btn-leh-forest" onClick={handleAddItem}>
                Add to Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
