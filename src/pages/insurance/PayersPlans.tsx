import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Phone, Mail,
  Building2, Shield
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

export const PayersPlans: React.FC = () => {
  const { notify } = useNotification();

  const [payers, setPayers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Search
  const [payerSearch, setPayerSearch] = useState('');

  // Payer Modal
  const [payerModal, setPayerModal] = useState<{
    open: boolean;
    editingId: number | null;
    name: string;
    code: string;
    type: string;
    contact_person: string;
    phone: string;
    email: string;
    payment_terms_days: number;
    portal_url: string;
  }>({
    open: false,
    editingId: null,
    name: '',
    code: '',
    type: 'HMO',
    contact_person: '',
    phone: '',
    email: '',
    payment_terms_days: 30,
    portal_url: ''
  });

  // Plan Modal
  const [planModal, setPlanModal] = useState<{
    open: boolean;
    editingId: number | null;
    name: string;
    code: string;
    description: string;
    copay_percentage: number;
    requires_authorization_default: boolean;
  }>({
    open: false,
    editingId: null,
    name: '',
    code: '',
    description: '',
    copay_percentage: 0,
    requires_authorization_default: false
  });

  const loadPayers = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await api.insurance.getPayers(false);
      setPayers(pRes || []);
      if (pRes && pRes.length > 0 && !selectedPayer) {
        setSelectedPayer(pRes[0]);
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to load payers');
    } finally {
      setLoading(false);
    }
  }, [notify, selectedPayer]);

  const loadPlans = useCallback(async (payerId: number) => {
    try {
      const plRes = await api.insurance.getPlans(payerId);
      setPlans(plRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load plans');
    }
  }, [notify]);

  useEffect(() => {
    loadPayers();
  }, [loadPayers]);

  useEffect(() => {
    if (selectedPayer?.id) {
      loadPlans(selectedPayer.id);
    } else {
      setPlans([]);
    }
  }, [selectedPayer, loadPlans]);

  const handleSavePayer = async () => {
    if (!payerModal.name.trim()) {
      notify('error', 'Payer name is required');
      return;
    }
    try {
      const payload = {
        name: payerModal.name,
        code: payerModal.code || payerModal.name.slice(0, 4).toUpperCase(),
        type: payerModal.type,
        contact_person: payerModal.contact_person,
        phone: payerModal.phone,
        email: payerModal.email,
        payment_terms_days: payerModal.payment_terms_days,
        portal_url: payerModal.portal_url
      };

      if (payerModal.editingId) {
        await api.insurance.updatePayer(payerModal.editingId, payload);
        notify('success', 'Payer updated successfully');
      } else {
        const created = await api.insurance.createPayer(payload);
        notify('success', 'New payer added');
        setSelectedPayer(created);
      }
      setPayerModal({
        open: false,
        editingId: null,
        name: '',
        code: '',
        type: 'HMO',
        contact_person: '',
        phone: '',
        email: '',
        payment_terms_days: 30,
        portal_url: ''
      });
      loadPayers();
    } catch (err: any) {
      notify('error', err.message || 'Failed to save payer');
    }
  };

  const handleSavePlan = async () => {
    if (!selectedPayer?.id) return;
    if (!planModal.name.trim()) {
      notify('error', 'Plan name is required');
      return;
    }
    try {
      const payload = {
        payer_id: selectedPayer.id,
        name: planModal.name,
        code: planModal.code || planModal.name.slice(0, 4).toUpperCase(),
        description: planModal.description,
        copay_percentage: planModal.copay_percentage,
        requires_authorization_default: planModal.requires_authorization_default ? 1 : 0
      };

      if (planModal.editingId) {
        await api.insurance.updatePlan(planModal.editingId, payload);
        notify('success', 'Plan updated successfully');
      } else {
        await api.insurance.createPlan(payload);
        notify('success', 'Plan added to payer');
      }
      setPlanModal({
        open: false,
        editingId: null,
        name: '',
        code: '',
        description: '',
        copay_percentage: 0,
        requires_authorization_default: false
      });
      loadPlans(selectedPayer.id);
    } catch (err: any) {
      notify('error', err.message || 'Failed to save plan');
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!window.confirm('Delete this plan?')) return;
    try {
      await api.insurance.deletePlan(planId);
      notify('success', 'Plan deleted');
      if (selectedPayer?.id) loadPlans(selectedPayer.id);
    } catch (err: any) {
      notify('error', err.message || 'Delete failed');
    }
  };

  const filteredPayers = payers.filter((p) =>
    p.name.toLowerCase().includes(payerSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(payerSearch.toLowerCase())
  );

  return (
    <div className="insurance-container">
      {/* Header */}
      <InsuranceNavHeader
        title="Payers & Insurance Plans"
        subtitle="Configure HMO networks, NHIA schemes, and plan coverage policies"
        actions={
          <button
            className="btn-leh-forest"
            onClick={() => setPayerModal({
              open: true,
              editingId: null,
              name: '',
              code: '',
              type: 'HMO',
              contact_person: '',
              phone: '',
              email: '',
              payment_terms_days: 30,
              portal_url: ''
            })}
          >
            <Plus size={15} /> Add Payer
          </button>
        }
      />

      {/* Two-Panel Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: '1.5rem' }}>
        {/* Left Panel: Payers List */}
        <div className="insurance-card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--leh-border)' }}>
            <div className="insurance-search-input">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search payers..."
                value={payerSearch}
                onChange={(e) => setPayerSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ maxHeight: '650px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : filteredPayers.length === 0 ? (
              <p style={{ padding: '1.5rem', color: 'var(--leh-muted)', textAlign: 'center' }}>No payers found.</p>
            ) : (
              filteredPayers.map((p) => {
                const isSelected = selectedPayer?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPayer(p)}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--leh-border-light)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--leh-forest-tint)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--leh-forest)' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--leh-ink)' }}>{p.name}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px' }}>
                        {p.type || 'HMO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--leh-muted)', marginTop: '4px' }}>
                      Code: {p.code || '—'} &bull; Terms: {p.payment_terms_days || 30} days
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Selected Payer Details & Plans */}
        <div>
          {selectedPayer ? (
            <div>
              {/* Payer Summary Card */}
              <div className="insurance-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--leh-forest)', fontSize: '1.4rem' }}>
                      {selectedPayer.name}
                    </h2>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--leh-muted)', flexWrap: 'wrap' }}>
                      <div><strong>Type:</strong> {selectedPayer.type}</div>
                      <div><strong>Code:</strong> {selectedPayer.code}</div>
                      <div><strong>Terms:</strong> {selectedPayer.payment_terms_days} days</div>
                    </div>
                  </div>
                  <button
                    className="btn-leh-secondary"
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                    onClick={() => setPayerModal({
                      open: true,
                      editingId: selectedPayer.id,
                      name: selectedPayer.name,
                      code: selectedPayer.code || '',
                      type: selectedPayer.type || 'HMO',
                      contact_person: selectedPayer.contact_person || '',
                      phone: selectedPayer.phone || '',
                      email: selectedPayer.email || '',
                      payment_terms_days: selectedPayer.payment_terms_days || 30,
                      portal_url: selectedPayer.portal_url || ''
                    })}
                  >
                    <Edit2 size={13} /> Edit Payer Info
                  </button>
                </div>

                {(selectedPayer.contact_person || selectedPayer.phone || selectedPayer.email) && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--leh-border-light)', display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                    {selectedPayer.contact_person && <div>Contact: {selectedPayer.contact_person}</div>}
                    {selectedPayer.phone && <div><Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />{selectedPayer.phone}</div>}
                    {selectedPayer.email && <div><Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />{selectedPayer.email}</div>}
                  </div>
                )}
              </div>

              {/* Plans Card */}
              <div className="insurance-card">
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--leh-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--leh-forest)' }}>Registered Health Benefit Plans</h3>
                  <button
                    className="btn-leh-forest"
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                    onClick={() => setPlanModal({
                      open: true,
                      editingId: null,
                      name: '',
                      code: '',
                      description: '',
                      copay_percentage: 0,
                      requires_authorization_default: false
                    })}
                  >
                    <Plus size={14} /> Add Plan
                  </button>
                </div>

                <div className="insurance-table-container">
                  {plans.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
                      No health plans added under {selectedPayer.name}. Click "Add Plan" to create one.
                    </div>
                  ) : (
                    <table className="insurance-table">
                      <thead>
                        <tr>
                          <th>Plan Name</th>
                          <th>Code</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'center' }}>Copay %</th>
                          <th style={{ textAlign: 'center' }}>Pre-Auth Default</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map((pl) => (
                          <tr key={pl.id}>
                            <td style={{ fontWeight: 600 }}>{pl.name}</td>
                            <td>{pl.code || '—'}</td>
                            <td>{pl.description || 'Standard outpatient & optical care'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{pl.copay_percentage || 0}%</td>
                            <td style={{ textAlign: 'center' }}>
                              {pl.requires_authorization_default ? (
                                <span className="ins-badge ins-badge--under_review">Required</span>
                              ) : (
                                <span style={{ color: 'var(--leh-muted)' }}>None</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-sm btn-link"
                                  onClick={() => setPlanModal({
                                    open: true,
                                    editingId: pl.id,
                                    name: pl.name,
                                    code: pl.code || '',
                                    description: pl.description || '',
                                    copay_percentage: pl.copay_percentage || 0,
                                    requires_authorization_default: !!pl.requires_authorization_default
                                  })}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn btn-sm btn-link text-danger"
                                  onClick={() => handleDeletePlan(pl.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="insurance-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              Select a payer from the left to view and configure its health plans.
            </div>
          )}
        </div>
      </div>

      {/* Payer Modal */}
      <InsuranceModal
        isOpen={payerModal.open}
        onClose={() => setPayerModal({ ...payerModal, open: false })}
        title={payerModal.editingId ? 'Edit Insurance Payer' : 'Register New Insurance Payer'}
        subtitle="Configure HMO corporate details and standard payment terms"
        icon={<Building2 size={20} />}
        size="md"
        isDirty={Boolean(payerModal.name || payerModal.code)}
        footer={
          <>
            <FormButton
              type="button"
              variant="secondary"
              onClick={() => setPayerModal({ ...payerModal, open: false })}
            >
              Cancel
            </FormButton>
            <FormButton
              type="button"
              variant="primary"
              disabled={!payerModal.name.trim()}
              onClick={handleSavePayer}
            >
              {payerModal.editingId ? 'Save Changes' : 'Save Payer'}
            </FormButton>
          </>
        }
      >
        <FormSection title="Corporate Details">
          <FormGrid>
            <FormField
              id="payer-name"
              label="Payer / HMO Name"
              required
              fullWidth
              helperText="Official corporate entity name recognized by billing"
            >
              <FormInput
                id="payer-name"
                type="text"
                placeholder="e.g. Hygeia HMO"
                value={payerModal.name}
                onChange={(e) => setPayerModal({ ...payerModal, name: e.target.value })}
              />
            </FormField>

            <FormField id="payer-code" label="Payer Code" helperText="3-5 character identifier">
              <FormInput
                id="payer-code"
                type="text"
                placeholder="e.g. HYG"
                value={payerModal.code}
                onChange={(e) => setPayerModal({ ...payerModal, code: e.target.value.toUpperCase() })}
              />
            </FormField>

            <FormField id="payer-type" label="Scheme Type">
              <FormSelect
                id="payer-type"
                value={payerModal.type}
                onChange={(e) => setPayerModal({ ...payerModal, type: e.target.value })}
              >
                <option value="HMO">Private HMO</option>
                <option value="NHIA">NHIA (National)</option>
                <option value="STATE_SCHEME">State Health Scheme</option>
                <option value="CORPORATE">Corporate Direct</option>
              </FormSelect>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Contact & Settlement Terms">
          <FormGrid>
            <FormField id="payer-contact" label="Contact Person">
              <FormInput
                id="payer-contact"
                type="text"
                placeholder="e.g. Desk Officer / Claims Lead"
                value={payerModal.contact_person}
                onChange={(e) => setPayerModal({ ...payerModal, contact_person: e.target.value })}
              />
            </FormField>

            <FormField id="payer-terms" label="Payment Terms (Days)" helperText="Contractual settlement timeline">
              <FormInput
                id="payer-terms"
                type="number"
                min={0}
                value={payerModal.payment_terms_days}
                onChange={(e) =>
                  setPayerModal({
                    ...payerModal,
                    payment_terms_days: parseInt(e.target.value) || 30
                  })
                }
              />
            </FormField>

            <FormField id="payer-phone" label="Phone Number">
              <FormInput
                id="payer-phone"
                type="tel"
                placeholder="e.g. 08012345678"
                value={payerModal.phone}
                onChange={(e) => setPayerModal({ ...payerModal, phone: e.target.value })}
              />
            </FormField>

            <FormField id="payer-email" label="Email Address">
              <FormInput
                id="payer-email"
                type="email"
                placeholder="claims@payer.com"
                value={payerModal.email}
                onChange={(e) => setPayerModal({ ...payerModal, email: e.target.value })}
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </InsuranceModal>

      {/* Plan Modal */}
      <InsuranceModal
        isOpen={planModal.open}
        onClose={() => setPlanModal({ ...planModal, open: false })}
        title={planModal.editingId ? 'Edit Plan' : `Add Plan to ${selectedPayer?.name || 'Payer'}`}
        subtitle="Define policy copay rates and authorization prerequisites"
        icon={<Shield size={20} />}
        size="md"
        isDirty={Boolean(planModal.name || planModal.code)}
        footer={
          <>
            <FormButton
              type="button"
              variant="secondary"
              onClick={() => setPlanModal({ ...planModal, open: false })}
            >
              Cancel
            </FormButton>
            <FormButton
              type="button"
              variant="primary"
              disabled={!planModal.name.trim()}
              onClick={handleSavePlan}
            >
              {planModal.editingId ? 'Save Changes' : 'Save Plan'}
            </FormButton>
          </>
        }
      >
        <FormSection title="Plan Specification">
          <FormGrid>
            <FormField id="plan-name" label="Plan Name" required fullWidth>
              <FormInput
                id="plan-name"
                type="text"
                placeholder="e.g. Gold Comprehensive Plan"
                value={planModal.name}
                onChange={(e) => setPlanModal({ ...planModal, name: e.target.value })}
              />
            </FormField>

            <FormField id="plan-code" label="Plan Code" helperText="Short acronym">
              <FormInput
                id="plan-code"
                type="text"
                placeholder="e.g. GLD"
                value={planModal.code}
                onChange={(e) => setPlanModal({ ...planModal, code: e.target.value.toUpperCase() })}
              />
            </FormField>

            <FormField id="plan-copay" label="Default Copay %" helperText="0 to 100 percent">
              <FormInput
                id="plan-copay"
                type="number"
                min={0}
                max={100}
                value={planModal.copay_percentage}
                onChange={(e) =>
                  setPlanModal({
                    ...planModal,
                    copay_percentage: parseInt(e.target.value) || 0
                  })
                }
              />
            </FormField>

            <FormField
              id="plan-desc"
              label="Description & Limitations"
              fullWidth
              helperText="Benefit notes, coverage caps, exclusions"
            >
              <FormTextarea
                id="plan-desc"
                rows={2}
                placeholder="Benefit notes, coverage limitations, optical caps..."
                value={planModal.description}
                onChange={(e) => setPlanModal({ ...planModal, description: e.target.value })}
              />
            </FormField>

            <div
              className="ins-col-span-2"
              style={{
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--leh-ink)'
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px', accentColor: 'var(--leh-forest)' }}
                  checked={planModal.requires_authorization_default}
                  onChange={(e) =>
                    setPlanModal({
                      ...planModal,
                      requires_authorization_default: e.target.checked
                    })
                  }
                />
                <span>By default, procedures under this plan require Pre-Authorization</span>
              </label>
            </div>
          </FormGrid>
        </FormSection>
      </InsuranceModal>
    </div>
  );
};

