import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Plus, Search, CheckCircle, Edit2, 
  RefreshCw, Shield, AlertTriangle, UserPlus
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
  FormDate,
  FormButton,
  FormGrid,
  FormSection,
  PatientPicker
} from '../../components/insurance';
import './Insurance.css';

export const InsuranceEnrollees: React.FC = () => {
  const { notify } = useNotification();

  const [enrollees, setEnrollees] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');

  // Modal & Validation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formData, setFormData] = useState({
    patient_id: '',
    payer_id: '',
    plan_id: '',
    enrollee_number: '',
    relationship: 'PRINCIPAL',
    principal_name: '',
    valid_from: '',
    valid_to: '',
    copay_type: 'PERCENTAGE',
    copay_value: 0,
    status: 'ACTIVE'
  });

  // Duplicate enrollee check under chosen payer
  const duplicateWarning = React.useMemo(() => {
    if (!formData.payer_id || !formData.enrollee_number.trim()) return null;
    const match = enrollees.find(
      (e) =>
        e.id !== editingId &&
        String(e.payer_id) === String(formData.payer_id) &&
        e.enrollee_number?.trim().toUpperCase() === formData.enrollee_number.trim().toUpperCase()
    );
    if (match) {
      return `Warning: Enrollee number is already registered for patient ${match.patient_id} under this payer`;
    }
    return null;
  }, [enrollees, editingId, formData.payer_id, formData.enrollee_number]);

  // Past date warning
  const pastDateWarning = React.useMemo(() => {
    if (!formData.valid_to) return null;
    const today = new Date().toISOString().split('T')[0];
    if (formData.valid_to < today) {
      return 'Note: Valid until date is in the past (policy may be expired)';
    }
    return null;
  }, [formData.valid_to]);

  const validateDateRange = (from: string, to: string) => {
    if (from && to && to < from) {
      setErrors((prev) => ({
        ...prev,
        valid_to: 'Valid Until date cannot be earlier than Valid From date'
      }));
    } else {
      setErrors((prev) => ({
        ...prev,
        valid_to: undefined
      }));
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [enrRes, payersRes, plansRes] = await Promise.all([
        api.insurance.getEnrollees({
          search: search || undefined,
          payer_id: payerFilter || undefined,
          status: verificationFilter || undefined
        }),
        api.insurance.getPayers(true),
        api.insurance.getPlans()
      ]);
      setEnrollees(enrRes || []);
      setPayers(payersRes || []);
      setPlans(plansRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load enrollees');
    } finally {
      setLoading(false);
    }
  }, [search, payerFilter, verificationFilter, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.patient_id.trim()) {
      newErrors.patient_id = 'Patient selection is required';
    }
    if (!formData.payer_id) {
      newErrors.payer_id = 'Payer / HMO selection is required';
    }
    if (!formData.enrollee_number.trim()) {
      newErrors.enrollee_number = 'Policy / Enrollee Number is required';
    }
    if (formData.valid_from && formData.valid_to && formData.valid_to < formData.valid_from) {
      newErrors.valid_to = 'Valid Until date cannot be earlier than Valid From date';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Focus first invalid field
      const firstFieldId = !formData.patient_id.trim()
        ? 'enrollee-patient-picker'
        : !formData.payer_id
        ? 'enrollee-payer'
        : !formData.enrollee_number.trim()
        ? 'enrollee-number'
        : 'enrollee-valid-to';
      document.getElementById(firstFieldId)?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patient_id: formData.patient_id,
        payer_id: parseInt(formData.payer_id),
        plan_id: formData.plan_id ? parseInt(formData.plan_id) : null,
        enrollee_number: formData.enrollee_number.trim().toUpperCase(),
        relationship: formData.relationship,
        valid_from: formData.valid_from || null,
        valid_to: formData.valid_to || null,
        copay_type: formData.copay_type,
        copay_value: formData.copay_value,
        status: formData.status
      };

      if (editingId) {
        await api.insurance.updateEnrollee(editingId, payload);
        notify('success', 'Enrollee record updated');
      } else {
        await api.insurance.createEnrollee(payload);
        notify('success', 'Enrollee registered');
      }

      setIsModalOpen(false);
      setEditingId(null);
      setErrors({});
      setFormData({
        patient_id: '',
        payer_id: '',
        plan_id: '',
        enrollee_number: '',
        relationship: 'PRINCIPAL',
        principal_name: '',
        valid_from: '',
        valid_to: '',
        copay_type: 'PERCENTAGE',
        copay_value: 0,
        status: 'ACTIVE'
      });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (id: number, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await api.insurance.verifyEnrollee(id, status);
      notify('success', `Enrollee marked as ${status}`);
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Verification update failed');
    }
  };

  const openEdit = (enr: any) => {
    setEditingId(enr.id);
    setErrors({});
    setFormData({
      patient_id: enr.patient_id,
      payer_id: String(enr.payer_id),
      plan_id: enr.plan_id ? String(enr.plan_id) : '',
      enrollee_number: enr.enrollee_number,
      relationship: enr.relationship || 'PRINCIPAL',
      principal_name: '',
      valid_from: enr.valid_from || '',
      valid_to: enr.valid_to || '',
      copay_type: enr.copay_type || 'PERCENTAGE',
      copay_value: enr.copay_value || 0,
      status: enr.status || 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const availablePlans = plans.filter(
    (p) => !formData.payer_id || p.payer_id === parseInt(formData.payer_id)
  );

  return (
    <div className="insurance-container">
      {/* Header */}
      <InsuranceNavHeader
        title="Insurance Enrollees Directory"
        subtitle="Manage patient HMO policy linkages, relationships, and verification"
        actions={
          <>
            <button
              className="btn-leh-forest"
              onClick={() => {
                setEditingId(null);
                setErrors({});
                setFormData({
                  patient_id: '',
                  payer_id: '',
                  plan_id: '',
                  enrollee_number: '',
                  relationship: 'PRINCIPAL',
                  principal_name: '',
                  valid_from: '',
                  valid_to: '',
                  copay_type: 'PERCENTAGE',
                  copay_value: 0,
                  status: 'ACTIVE'
                });
                setIsModalOpen(true);
              }}
            >
              <Plus size={15} /> Link Enrollee
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
            <span className="ins-stat-label">Total Enrollees</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#dcfce7', color: '#15803d' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{enrollees.length}</div>
          <div className="ins-stat-footer">Registered across all HMOs</div>
        </div>

        <div className="insurance-stat-card-modern">
          <div className="ins-stat-header">
            <span className="ins-stat-label">Verified</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{enrollees.filter(e => e.verification_status === 'VERIFIED').length}</div>
          <div className="ins-stat-footer">Eligibility active</div>
        </div>

        <div className="insurance-stat-card-modern">
          <div className="ins-stat-header">
            <span className="ins-stat-label">Pending Verification</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#fef3c7', color: '#b45309' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{enrollees.filter(e => e.verification_status === 'PENDING').length}</div>
          <div className="ins-stat-footer">Requires ID or card check</div>
        </div>

        <div className="insurance-stat-card-modern">
          <div className="ins-stat-header">
            <span className="ins-stat-label">Payers Represented</span>
            <div className="ins-stat-icon-wrap" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
              <Shield size={18} />
            </div>
          </div>
          <div className="ins-stat-value">{new Set(enrollees.map(e => e.payer_id)).size}</div>
          <div className="ins-stat-footer">Distinct HMO networks</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="insurance-card">
        <div className="insurance-filter-bar">
          <div className="insurance-search-input">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by patient name, file #, policy #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="insurance-filter-select"
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="">All Payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className="insurance-filter-select"
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
          >
            <option value="">All Verification</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {(search || payerFilter || verificationFilter) && (
            <button
              className="btn-leh-secondary"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
              onClick={() => {
                setSearch('');
                setPayerFilter('');
                setVerificationFilter('');
              }}
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
          ) : enrollees.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No enrollee records found.</p>
            </div>
          ) : (
            <table className="insurance-table">
              <thead>
                <tr>
                  <th>Patient File</th>
                  <th>Patient Name</th>
                  <th>Payer & Plan</th>
                  <th>Policy / Enrollee #</th>
                  <th>Relationship</th>
                  <th>Validity Period</th>
                  <th>Verification</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollees.map((enr) => (
                  <tr key={enr.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--leh-forest)' }}>
                        {enr.patient_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{enr.patient_name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>{enr.patient_phone || 'No phone'}</div>
                    </td>
                    <td>
                      <div>{enr.payer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--leh-muted)' }}>{enr.plan_name || 'Standard'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{enr.enrollee_number}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>
                        {enr.relationship || 'PRINCIPAL'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {enr.valid_from ? `${enr.valid_from} to ${enr.valid_to || 'Indefinite'}` : 'Not specified'}
                    </td>
                    <td>
                      <span className={`ins-badge ins-badge--${enr.verification_status === 'VERIFIED' ? 'approved' : enr.verification_status === 'REJECTED' ? 'rejected' : 'under_review'}`}>
                        {enr.verification_status || 'PENDING'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {enr.verification_status !== 'VERIFIED' && (
                          <button
                            className="ins-tbl-action-btn ins-tbl-action-btn--success"
                            title="Verify Enrollee"
                            onClick={() => handleVerify(enr.id, 'VERIFIED')}
                          >
                            Verify
                          </button>
                        )}
                        {enr.verification_status === 'PENDING' && (
                          <button
                            className="ins-tbl-action-btn ins-tbl-action-btn--danger"
                            title="Reject Enrollee"
                            onClick={() => handleVerify(enr.id, 'REJECTED')}
                          >
                            Reject
                          </button>
                        )}
                        <button
                          className="ins-tbl-action-btn"
                          title="Edit Record"
                          onClick={() => openEdit(enr)}
                        >
                          <Edit2 size={14} />
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

      {/* Create / Edit Modal (Section 4 Specification) */}
      <InsuranceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
          setErrors({});
        }}
        title={editingId ? 'Edit Enrollee Record' : 'Link Patient to Insurance Policy'}
        subtitle="Connect a patient to a payer so visits can be billed to insurance."
        icon={<UserPlus size={20} />}
        size="md"
        isDirty={Boolean(formData.patient_id || formData.payer_id || formData.enrollee_number)}
        footer={
          <>
            <FormButton
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
                setErrors({});
              }}
            >
              Cancel
            </FormButton>
            <FormButton
              type="button"
              variant="primary"
              loading={saving}
              disabled={!formData.patient_id || !formData.payer_id || !formData.enrollee_number.trim()}
              onClick={handleSave}
            >
              {editingId ? 'Save Changes' : 'Register Enrollee'}
            </FormButton>
          </>
        }
      >
        {/* Error Summary if submit has errors */}
        {Object.keys(errors).length > 0 && (
          <div className="ins-error-summary" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Please correct the following errors:</strong>
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {Object.values(errors).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Section 1: Patient */}
        <FormSection title="Patient">
          <FormGrid>
            <FormField
              id="enrollee-patient-picker"
              label="Patient"
              required
              fullWidth
              error={errors.patient_id}
              helperText={!editingId ? 'Search by patient full name, hospital file number, or phone number' : undefined}
            >
              <PatientPicker
                id="enrollee-patient-picker"
                value={formData.patient_id}
                disabled={Boolean(editingId)}
                required
                isInvalid={Boolean(errors.patient_id)}
                onChange={(patient) => {
                  setFormData((prev) => ({
                    ...prev,
                    patient_id: patient ? patient.patient_id || patient.file_no || patient.id : ''
                  }));
                  if (errors.patient_id) {
                    setErrors((prev) => ({ ...prev, patient_id: undefined }));
                  }
                }}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Section 2: Coverage */}
        <FormSection title="Coverage">
          <FormGrid>
            <FormField
              id="enrollee-payer"
              label="Payer / HMO"
              required
              error={errors.payer_id}
            >
              <FormSelect
                id="enrollee-payer"
                value={formData.payer_id}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({ ...prev, payer_id: val, plan_id: '' }));
                  if (errors.payer_id) {
                    setErrors((prev) => ({ ...prev, payer_id: undefined }));
                  }
                }}
                onBlur={() => {
                  if (!formData.payer_id) {
                    setErrors((prev) => ({ ...prev, payer_id: 'Payer / HMO is required' }));
                  }
                }}
                placeholderOption="Choose payer"
              >
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField
              id="enrollee-plan"
              label="Plan"
              helperText={!formData.payer_id ? 'Choose a payer first' : undefined}
            >
              <FormSelect
                id="enrollee-plan"
                disabled={!formData.payer_id}
                value={formData.plan_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, plan_id: e.target.value }))}
                placeholderOption="Standard / Default plan"
              >
                {availablePlans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name || pl.plan_name}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField
              id="enrollee-number"
              label="Policy / Enrollee Number"
              required
              error={errors.enrollee_number}
              helperText={duplicateWarning || undefined}
            >
              <FormInput
                id="enrollee-number"
                type="text"
                placeholder="e.g. NHIA/2026/88921"
                value={formData.enrollee_number}
                onChange={(e) => {
                  const raw = e.target.value;
                  setFormData((prev) => ({ ...prev, enrollee_number: raw }));
                  if (errors.enrollee_number) {
                    setErrors((prev) => ({ ...prev, enrollee_number: undefined }));
                  }
                }}
                onBlur={(e) => {
                  const trimmedUpper = e.target.value.trim().toUpperCase();
                  setFormData((prev) => ({ ...prev, enrollee_number: trimmedUpper }));
                  if (!trimmedUpper) {
                    setErrors((prev) => ({ ...prev, enrollee_number: 'Policy / Enrollee Number is required' }));
                  }
                }}
              />
            </FormField>

            <FormField
              id="enrollee-relationship"
              label="Relationship"
              required
            >
              <FormSelect
                id="enrollee-relationship"
                value={formData.relationship}
                onChange={(e) => setFormData((prev) => ({ ...prev, relationship: e.target.value }))}
              >
                <option value="PRINCIPAL">Principal</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="OTHER">Other Dependent</option>
              </FormSelect>
            </FormField>

            {/* When Relationship is not Principal, reveal Principal name field */}
            {formData.relationship !== 'PRINCIPAL' && (
              <FormField
                id="enrollee-principal-name"
                label="Principal Name"
                fullWidth
                helperText="Name of the primary policyholder / main subscriber"
              >
                <FormInput
                  id="enrollee-principal-name"
                  type="text"
                  placeholder="e.g. Alhaji Ibrahim Musa"
                  value={formData.principal_name || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, principal_name: e.target.value }))}
                />
              </FormField>
            )}
          </FormGrid>
        </FormSection>

        {/* Section 3: Validity */}
        <FormSection title="Validity">
          <FormGrid>
            <FormField
              id="enrollee-valid-from"
              label="Valid From"
              error={errors.valid_from}
              helperText="Leave blank if open-ended"
            >
              <FormDate
                id="enrollee-valid-from"
                value={formData.valid_from}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, valid_from: e.target.value }));
                  validateDateRange(e.target.value, formData.valid_to);
                }}
              />
            </FormField>

            <FormField
              id="enrollee-valid-to"
              label="Valid Until"
              error={errors.valid_to}
              helperText={pastDateWarning || 'Leave blank if open-ended'}
            >
              <FormDate
                id="enrollee-valid-to"
                value={formData.valid_to}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, valid_to: e.target.value }));
                  validateDateRange(formData.valid_from, e.target.value);
                }}
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </InsuranceModal>
    </div>
  );
};

