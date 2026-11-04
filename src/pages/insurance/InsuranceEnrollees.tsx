import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Plus, Search, CheckCircle, Edit2, 
  RefreshCw, X, Shield, AlertTriangle
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatCard } from '../../components/StatCard';
import './Insurance.css';

export const InsuranceEnrollees: React.FC = () => {
  const { notify } = useNotification();

  const [enrollees, setEnrollees] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    payer_id: '',
    plan_id: '',
    enrollee_number: '',
    relationship: 'PRINCIPAL',
    valid_from: '',
    valid_to: '',
    copay_type: 'PERCENTAGE',
    copay_value: 0,
    status: 'ACTIVE'
  });

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
    if (!formData.patient_id.trim() || !formData.payer_id || !formData.enrollee_number.trim()) {
      notify('error', 'Patient ID, Payer, and Enrollee Number are required');
      return;
    }

    try {
      const payload = {
        patient_id: formData.patient_id,
        payer_id: parseInt(formData.payer_id),
        plan_id: formData.plan_id ? parseInt(formData.plan_id) : null,
        enrollee_number: formData.enrollee_number,
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
        notify('success', 'New enrollee registered successfully');
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        patient_id: '',
        payer_id: '',
        plan_id: '',
        enrollee_number: '',
        relationship: 'PRINCIPAL',
        valid_from: '',
        valid_to: '',
        copay_type: 'PERCENTAGE',
        copay_value: 0,
        status: 'ACTIVE'
      });
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Operation failed');
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
    setFormData({
      patient_id: enr.patient_id,
      payer_id: String(enr.payer_id),
      plan_id: enr.plan_id ? String(enr.plan_id) : '',
      enrollee_number: enr.enrollee_number,
      relationship: enr.relationship || 'PRINCIPAL',
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
      <div className="insurance-header">
        <div>
          <h1 className="insurance-title">Insurance Enrollees Directory</h1>
          <p className="insurance-subtitle">Manage patient HMO policy linkages, relationships, and verification</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--leh-forest)' }}
            onClick={() => {
              setEditingId(null);
              setFormData({
                patient_id: '',
                payer_id: '',
                plan_id: '',
                enrollee_number: '',
                relationship: 'PRINCIPAL',
                valid_from: '',
                valid_to: '',
                copay_type: 'PERCENTAGE',
                copay_value: 0,
                status: 'ACTIVE'
              });
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Link Enrollee
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="insurance-grid-stats">
        <StatCard
          title="Total Enrollees"
          value={enrollees.length}
          subtitle="Registered across all HMOs"
          icon={Users}
          colorClass="green"
        />
        <StatCard
          title="Verified"
          value={enrollees.filter(e => e.verification_status === 'VERIFIED').length}
          subtitle="Eligibility active"
          icon={CheckCircle}
          colorClass="blue"
        />
        <StatCard
          title="Pending Verification"
          value={enrollees.filter(e => e.verification_status === 'PENDING').length}
          subtitle="Requires ID or card check"
          icon={AlertTriangle}
          colorClass="amber"
        />
        <StatCard
          title="Payers Represented"
          value={new Set(enrollees.map(e => e.payer_id)).size}
          subtitle="Distinct HMO networks"
          icon={Shield}
          colorClass="purple"
        />
      </div>

      {/* Filter and Table */}
      <div className="insurance-card">
        <div className="insurance-filter-bar">
          <div className="insurance-search-input">
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--leh-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px', height: '36px' }}
              placeholder="Search by patient name, file #, policy #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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

          <select
            className="form-select"
            style={{ width: '160px', height: '36px' }}
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
              className="btn btn-sm btn-outline-secondary"
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
                            className="btn btn-sm btn-outline-success"
                            title="Verify Enrollee"
                            onClick={() => handleVerify(enr.id, 'VERIFIED')}
                          >
                            Verify
                          </button>
                        )}
                        {enr.verification_status === 'PENDING' && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            title="Reject Enrollee"
                            onClick={() => handleVerify(enr.id, 'REJECTED')}
                          >
                            Reject
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-secondary"
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                {editingId ? 'Edit Enrollee Record' : 'Link Patient to Insurance Policy'}
              </h3>
              <button className="btn btn-sm btn-link" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ins-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Patient File Number / ID *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. PAT-00102"
                  disabled={!!editingId}
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payer / HMO *</label>
                  <select
                    className="form-select"
                    value={formData.payer_id}
                    onChange={(e) => setFormData({ ...formData, payer_id: e.target.value, plan_id: '' })}
                  >
                    <option value="">-- Choose Payer --</option>
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Specific Plan</label>
                  <select
                    className="form-select"
                    value={formData.plan_id}
                    onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                  >
                    <option value="">-- Standard / Default --</option>
                    {availablePlans.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Policy / Enrollee Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. NHIA/2026/88921"
                    value={formData.enrollee_number}
                    onChange={(e) => setFormData({ ...formData, enrollee_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Relationship</label>
                  <select
                    className="form-select"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  >
                    <option value="PRINCIPAL">Principal</option>
                    <option value="SPOUSE">Spouse</option>
                    <option value="CHILD">Child</option>
                    <option value="OTHER">Other Dependent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Valid From</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Valid Until</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.valid_to}
                    onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingId ? 'Save Changes' : 'Register Enrollee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
