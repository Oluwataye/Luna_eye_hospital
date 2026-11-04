import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Link as LinkIcon, 
  ArrowLeft, 
  Phone, 
  MapPin, 
  User, 
  X, 
  Edit3, 
  AlertCircle,
  Unlink,
  Search,
  Activity
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatDateStandard } from '../utils/date';

export const FamilyProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { notify } = useNotification();

  const [family, setFamily] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showLinkPatientModal, setShowLinkPatientModal] = useState(false);
  const [showEditFamilyModal, setShowEditFamilyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add Member Form State
  const [memberForm, setMemberForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'Male',
    phone: '',
    alternate_phone: '',
    relationship_to_family: 'Spouse',
    religion: '',
    address: '',
    tribe: '',
    state_of_origin: '',
    occupation: '',
    marital_status: '',
    next_of_kin: '',
    next_of_kin_phone: '',
    next_of_kin_address: '',
    blood_group: '',
    genotype: '',
    allergies: '',
    medical_alerts: '',
    payment_category: 'Standard'
  });

  // Link Existing Patient Form State
  const [existingSearch, setExistingSearch] = useState('');
  const [existingPatients, setExistingPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<any>(null);
  const [linkRelationship, setLinkRelationship] = useState('Spouse');

  // Edit Family Form State
  const [editForm, setEditForm] = useState({
    family_name: '',
    contact_person_name: '',
    contact_person_phone: '',
    residential_address: '',
    tribe: '',
    state_of_origin: ''
  });

  const fetchFamily = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getFamily(id);
      setFamily(data);
      if (data) {
        setEditForm({
          family_name: data.family_name || '',
          contact_person_name: data.contact_person_name || '',
          contact_person_phone: data.contact_person_phone || '',
          residential_address: data.residential_address || '',
          tribe: data.tribe || '',
          state_of_origin: data.state_of_origin || ''
        });
        // Pre-fill Add Member form with family defaults
        setMemberForm(prev => ({
          ...prev,
          last_name: data.family_name || '',
          address: data.residential_address || '',
          tribe: data.tribe || '',
          state_of_origin: data.state_of_origin || '',
          phone: data.contact_person_phone || '',
          next_of_kin: data.contact_person_name || '',
          next_of_kin_phone: data.contact_person_phone || '',
          next_of_kin_address: data.residential_address || ''
        }));
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to load family profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [id]);

  // Search existing patients when typing in link modal
  useEffect(() => {
    const timer = setTimeout(async () => {
      const query = existingSearch.trim();
      if (query.length >= 2) {
        setSearchingPatients(true);
        try {
          const results = await api.getPatients({ search: query, limit: 20 });
          // Filter out patients who are already members of this family
          const currentMemberIds = (family?.members || []).map((m: any) => String(m.id));
          setExistingPatients(results.filter((p: any) => !currentMemberIds.includes(String(p.id))));
        } catch (err) {
          console.error(err);
        } finally {
          setSearchingPatients(false);
        }
      } else {
        setExistingPatients([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [existingSearch, family]);

  const calculateAge = (dob: string) => {
    if (!dob) return '—';
    try {
      const birthDate = new Date(dob);
      const difference = Date.now() - birthDate.getTime();
      const age = Math.floor(difference / (1000 * 60 * 60 * 24 * 365.25));
      return isNaN(age) ? '—' : `${age} yrs`;
    } catch {
      return '—';
    }
  };

  // Submit Add Member
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family) return;
    if (!memberForm.first_name || !memberForm.last_name || !memberForm.dob || !memberForm.gender || !memberForm.phone) {
      notify('error', 'First name, last name, date of birth, gender, and phone are required');
      return;
    }

    setSubmitting(true);
    try {
      const fullName = `${memberForm.last_name.trim()} ${memberForm.first_name.trim()}`;
      const payload = {
        ...memberForm,
        full_name: fullName
      };
      const newMember = await api.addFamilyMember(family.id, payload);
      notify('success', `Member ${fullName} registered under ${family.family_name} Family (File No: ${newMember.id})`);
      setShowAddMemberModal(false);
      fetchFamily();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Link Patient
  const handleLinkPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !selectedExistingPatient) {
      notify('error', 'Please select a patient to link');
      return;
    }

    setSubmitting(true);
    try {
      await api.linkPatientToFamily(family.id, {
        patient_id: selectedExistingPatient.id,
        relationship_to_family: linkRelationship
      });
      notify('success', `${selectedExistingPatient.full_name} linked to ${family.family_name} Family as ${linkRelationship}`);
      setShowLinkPatientModal(false);
      setSelectedExistingPatient(null);
      setExistingSearch('');
      fetchFamily();
    } catch (err: any) {
      notify('error', err.message || 'Failed to link patient');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Family
  const handleEditFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family) return;
    if (!editForm.family_name || !editForm.contact_person_name || !editForm.contact_person_phone) {
      notify('error', 'Family name, contact person name, and phone are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.updateFamily(family.id, editForm);
      notify('success', 'Family household details updated');
      setShowEditFamilyModal(false);
      fetchFamily();
    } catch (err: any) {
      notify('error', err.message || 'Failed to update family details');
    } finally {
      setSubmitting(false);
    }
  };

  // Unlink Member
  const handleRemoveMember = async (member: any) => {
    if (!family) return;
    const confirmDetach = window.confirm(
      `Remove ${member.full_name} from ${family.family_name} Family?\n\nNote: Their individual medical history, visits, consultations, and test records will be completely preserved.`
    );
    if (!confirmDetach) return;

    try {
      await api.removeFamilyMember(family.id, member.id);
      notify('success', `${member.full_name} detached from ${family.family_name} Family`);
      fetchFamily();
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="leh-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <LoadingSpinner size="large" label="Loading family household records..." />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="leh-page-container">
        <header className="leh-page-header">
          <Link to="/patients" className="leh-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={18} />
            <span>Back to Registry</span>
          </Link>
        </header>
        <div className="leh-table-card" style={{ padding: '60px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Family Record Not Found</h2>
          <p style={{ color: '#64748b', fontSize: '14px' }}>The requested family card record does not exist or has been deactivated.</p>
        </div>
      </div>
    );
  }

  const members = family.members || [];

  return (
    <div className="leh-page-container animate-fade-in">
      {/* Page Header */}
      <header className="leh-page-header">
        <div className="leh-header-left">
          <Link to="/patients" className="leh-btn-outline" style={{ width: '42px', height: '42px', padding: 0 }}>
            <ArrowLeft size={20} />
          </Link>
          <div className="leh-header-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="leh-page-title">{family.family_name.toUpperCase()} FAMILY</h1>
              <span style={{ 
                background: 'var(--leh-forest-tint)', 
                color: 'var(--leh-forest)', 
                border: '1px solid var(--leh-border)',
                fontSize: '12px', 
                fontWeight: '900', 
                fontFamily: 'monospace',
                padding: '4px 10px', 
                borderRadius: '8px' 
              }}>
                CARD NO: {family.family_card_number}
              </span>
              <span className="leh-status-badge green">ACTIVE HOUSEHOLD</span>
            </div>
            <p className="leh-page-subtitle">
              Family Card Household Profile • {members.length} Registered Member{members.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="leh-header-actions">
          <button 
            type="button" 
            onClick={() => setShowEditFamilyModal(true)} 
            className="leh-btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Edit3 size={16} />
            <span>EDIT HOUSEHOLD</span>
          </button>
          <button 
            type="button" 
            onClick={() => setShowLinkPatientModal(true)} 
            className="leh-btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LinkIcon size={16} />
            <span>LINK EXISTING PATIENT</span>
          </button>
          <button 
            type="button" 
            onClick={() => setShowAddMemberModal(true)} 
            className="leh-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserPlus size={18} />
            <span>ADD MEMBER</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Left = Household Overview, Right = Members Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Household Information Card */}
        <div className="leh-table-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ 
              width: '72px', height: '72px', 
              background: 'linear-gradient(135deg, var(--leh-forest-tint) 0%, var(--leh-lime-soft) 100%)', 
              border: '1.5px solid var(--leh-border)',
              color: 'var(--leh-forest)', 
              borderRadius: '20px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 12px',
              boxShadow: '0 4px 14px rgba(46, 90, 38, 0.12)'
            }}>
              <Users size={36} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 4px', color: '#0f172a' }}>
              {family.family_name} Family
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
              Registered on {formatDateStandard(family.created_at)}
            </p>
          </div>

          {/* Contact Person Details */}
          <div>
            <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Contact Person
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={15} style={{ color: 'var(--leh-primary)', flexShrink: 0 }} />
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{family.contact_person_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={15} style={{ color: 'var(--leh-primary)', flexShrink: 0 }} />
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{family.contact_person_phone}</span>
              </div>
            </div>
          </div>

          {/* Residence & Demographics */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Location & Background
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <MapPin size={15} style={{ color: 'var(--leh-primary)', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ color: '#475569', lineHeight: '1.4' }}>{family.residential_address || 'No residential address specified'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f8fafc', paddingTop: '8px' }}>
                <span className="leh-label">Tribe</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{family.tribe || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="leh-label">State of Origin</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{family.state_of_origin || '—'}</span>
              </div>
            </div>
          </div>

          {/* Audit Details */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', fontSize: '11px', color: '#94a3b8' }}>
            <div>Created by: <strong style={{ color: '#64748b' }}>{family.created_by || 'System'}</strong></div>
            {family.updated_at && (
              <div style={{ marginTop: '4px' }}>
                Last updated: {formatDateStandard(family.updated_at)} {family.updated_by ? `by ${family.updated_by}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Members Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="leh-table-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="leh-table-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>
                  Registered Family Members ({members.length})
                </h3>
                <p className="leh-label" style={{ margin: 0 }}>
                  Each family member maintains their own unique patient hospital folder and clinical records.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddMemberModal(true)} 
                className="leh-btn-primary"
                style={{ height: '38px', padding: '0 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UserPlus size={16} />
                <span>ADD MEMBER</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="leh-table-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="leh-table-wrapper">
              <table className="leh-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '24px', width: '130px' }}>HOSPITAL NO.</th>
                    <th>MEMBER NAME</th>
                    <th>RELATIONSHIP</th>
                    <th>GENDER / AGE</th>
                    <th>PHONE</th>
                    <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ opacity: 0.4, marginBottom: '12px' }}>
                          <Users size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '800' }}>No Members Registered Yet</h4>
                        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                          This family household card has been created. Click below to add the first family member or link an existing patient.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                          <button 
                            type="button" 
                            onClick={() => setShowAddMemberModal(true)} 
                            className="leh-btn-primary"
                            style={{ height: '36px', padding: '0 16px', fontSize: '12px' }}
                          >
                            <UserPlus size={15} /> Add Member
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowLinkPatientModal(true)} 
                            className="leh-btn-outline"
                            style={{ height: '36px', padding: '0 16px', fontSize: '12px' }}
                          >
                            <LinkIcon size={15} /> Link Existing Patient
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    members.map((member: any) => (
                      <tr key={member.id} className="leh-table-row">
                        <td style={{ paddingLeft: '24px' }}>
                          <Link 
                            to={`/patients/profile/${encodeURIComponent(member.id)}`}
                            style={{ 
                              fontFamily: 'monospace', 
                              fontWeight: '900', 
                              color: 'var(--leh-primary)', 
                              background: 'var(--leh-primary-light)', 
                              padding: '5px 10px', 
                              borderRadius: '7px', 
                              fontSize: '11px',
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            {member.id}
                          </Link>
                        </td>
                        <td>
                          <Link 
                            to={`/patients/profile/${encodeURIComponent(member.id)}`}
                            style={{ fontWeight: '800', color: '#0f172a', textDecoration: 'none' }}
                          >
                            {member.full_name}
                          </Link>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#0369a1',
                            background: '#e0f2fe',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            display: 'inline-block'
                          }}>
                            {member.relationship_to_family || 'Member'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`leh-status-badge ${member.gender === 'Male' ? 'blue' : 'red'}`} style={{ fontSize: '10px' }}>
                              {member.gender}
                            </span>
                            <span className="leh-label" style={{ fontSize: '12px' }}>
                              {calculateAge(member.dob)}
                            </span>
                          </div>
                        </td>
                        <td className="leh-label" style={{ fontSize: '12px' }}>
                          {member.phone || '—'}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Link 
                              to={`/patients/check-in/${encodeURIComponent(member.id)}`}
                              className="leh-btn-outline"
                              style={{ padding: '5px 10px', fontSize: '11px', height: '30px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Check-in patient to clinical queue"
                            >
                              <Activity size={13} />
                              <span>Check In</span>
                            </Link>
                            <Link 
                              to={`/patients/profile/${encodeURIComponent(member.id)}`}
                              className="leh-btn-outline"
                              style={{ padding: '5px 10px', fontSize: '11px', height: '30px' }}
                            >
                              Profile
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="leh-btn-outline"
                              style={{ padding: '5px 8px', fontSize: '11px', height: '30px', color: '#ef4444', borderColor: '#fecaca' }}
                              title="Detach from family (keeps patient record)"
                            >
                              <Unlink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD FAMILY MEMBER */}
      {/* ========================================================= */}
      {showAddMemberModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <UserPlus style={{ color: 'var(--leh-primary)' }} />
                <span>Add Member to {family.family_name} Family</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowAddMemberModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                  Registering a member provisions a separate individual patient identity under Family Card <strong>{family.family_card_number}</strong>. Demographic fields are pre-filled from household records.
                </div>

                {/* Names */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Surname / Last Name <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="text" 
                      value={memberForm.last_name} 
                      onChange={e => setMemberForm(prev => ({ ...prev, last_name: e.target.value }))}
                      className="leh-input" 
                      placeholder="e.g. Taiwo"
                      required 
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">First Name <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="text" 
                      value={memberForm.first_name} 
                      onChange={e => setMemberForm(prev => ({ ...prev, first_name: e.target.value }))}
                      className="leh-input" 
                      placeholder="e.g. Bukola"
                      required 
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Relationship to Family <span style={{ color: 'red' }}>*</span></label>
                    <select 
                      value={memberForm.relationship_to_family}
                      onChange={e => setMemberForm(prev => ({ ...prev, relationship_to_family: e.target.value }))}
                      className="leh-input"
                      required
                    >
                      <option value="Head">Head</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Dependent">Dependent</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* DOB & Gender */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Date of Birth <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="date" 
                      value={memberForm.dob} 
                      onChange={e => setMemberForm(prev => ({ ...prev, dob: e.target.value }))}
                      className="leh-date-input" 
                      style={{ width: '100%' }}
                      required 
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Gender <span style={{ color: 'red' }}>*</span></label>
                    <select 
                      value={memberForm.gender}
                      onChange={e => setMemberForm(prev => ({ ...prev, gender: e.target.value }))}
                      className="leh-input"
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Primary Phone <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="tel" 
                      value={memberForm.phone} 
                      onChange={e => setMemberForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="leh-input" 
                      placeholder="08012345678"
                      required 
                    />
                  </div>
                </div>

                {/* Background & Address */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Tribe</label>
                    <input 
                      type="text" 
                      value={memberForm.tribe} 
                      onChange={e => setMemberForm(prev => ({ ...prev, tribe: e.target.value }))}
                      className="leh-input" 
                      placeholder="e.g. Yoruba"
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">State of Origin</label>
                    <input 
                      type="text" 
                      value={memberForm.state_of_origin} 
                      onChange={e => setMemberForm(prev => ({ ...prev, state_of_origin: e.target.value }))}
                      className="leh-input" 
                      placeholder="e.g. Ogun"
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Religion</label>
                    <input 
                      type="text" 
                      value={memberForm.religion} 
                      onChange={e => setMemberForm(prev => ({ ...prev, religion: e.target.value }))}
                      className="leh-input" 
                      placeholder="e.g. Christianity, Islam"
                    />
                  </div>
                </div>

                <div className="leh-form-group">
                  <label className="leh-label">Residential Address</label>
                  <input 
                    type="text" 
                    value={memberForm.address} 
                    onChange={e => setMemberForm(prev => ({ ...prev, address: e.target.value }))}
                    className="leh-input" 
                    placeholder="Residential address"
                  />
                </div>

                {/* Next of Kin */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Next of Kin Full Name</label>
                    <input 
                      type="text" 
                      value={memberForm.next_of_kin} 
                      onChange={e => setMemberForm(prev => ({ ...prev, next_of_kin: e.target.value }))}
                      className="leh-input" 
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Next of Kin Phone</label>
                    <input 
                      type="tel" 
                      value={memberForm.next_of_kin_phone} 
                      onChange={e => setMemberForm(prev => ({ ...prev, next_of_kin_phone: e.target.value }))}
                      className="leh-input" 
                      placeholder="Emergency contact phone"
                    />
                  </div>
                </div>

                {/* Clinical Baseline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Blood Group</label>
                    <select 
                      value={memberForm.blood_group}
                      onChange={e => setMemberForm(prev => ({ ...prev, blood_group: e.target.value }))}
                      className="leh-input"
                    >
                      <option value="">Unknown</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Genotype</label>
                    <select 
                      value={memberForm.genotype}
                      onChange={e => setMemberForm(prev => ({ ...prev, genotype: e.target.value }))}
                      className="leh-input"
                    >
                      <option value="">Unknown</option>
                      <option value="AA">AA</option>
                      <option value="AS">AS</option>
                      <option value="SS">SS</option>
                      <option value="AC">AC</option>
                    </select>
                  </div>
                </div>

                <div className="leh-form-group">
                  <label className="leh-label">Known Allergies / Medical Alerts</label>
                  <input 
                    type="text" 
                    value={memberForm.allergies} 
                    onChange={e => setMemberForm(prev => ({ ...prev, allergies: e.target.value }))}
                    className="leh-input" 
                    placeholder="e.g. Penicillin allergy, Glaucoma suspect"
                  />
                </div>
              </div>

              <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowAddMemberModal(false)} className="leh-btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="leh-btn-primary">
                  {submitting ? 'Registering Member...' : 'Save & Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: LINK EXISTING PATIENT */}
      {/* ========================================================= */}
      {showLinkPatientModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '580px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <LinkIcon style={{ color: 'var(--leh-primary)' }} />
                <span>Link Existing Patient to Family</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowLinkPatientModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLinkPatientSubmit}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                  Attach an individually registered patient to <strong>{family.family_name} Family</strong>. Their past medical history will remain completely intact.
                </div>

                {/* Patient Search */}
                <div className="leh-form-group">
                  <label className="leh-label">Search Patient by Name, File No, or Phone</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      value={existingSearch} 
                      onChange={e => setExistingSearch(e.target.value)}
                      placeholder="Type patient name or file number (e.g. 0001/26/LEH)..." 
                      className="leh-input" 
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {/* Search Results Autocomplete */}
                {searchingPatients && (
                  <div style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: '#64748b' }}>
                    Searching registry...
                  </div>
                )}

                {existingPatients.length > 0 && !selectedExistingPatient && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    {existingPatients.map((p: any) => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setSelectedExistingPatient(p);
                          setExistingSearch('');
                        }}
                        style={{ 
                          padding: '10px 14px', 
                          borderBottom: '1px solid #f1f5f9', 
                          cursor: 'pointer',
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '13px'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <div>
                          <span style={{ fontWeight: '800', color: '#0f172a' }}>{p.full_name}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>({p.gender}, {calculateAge(p.dob)})</span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--leh-primary)', fontSize: '11px' }}>
                          {p.id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Patient Card */}
                {selectedExistingPatient && (
                  <div style={{ 
                    padding: '14px 18px', 
                    borderRadius: '12px', 
                    background: '#f0fdf4', 
                    border: '1px solid #86efac', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#166534', fontSize: '14px' }}>
                        {selectedExistingPatient.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#15803d' }}>
                        File No: {selectedExistingPatient.id} • Phone: {selectedExistingPatient.phone || 'N/A'}
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedExistingPatient(null)} 
                      className="leh-btn-outline"
                      style={{ padding: '4px 10px', fontSize: '11px', height: '28px' }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Relationship Dropdown */}
                <div className="leh-form-group">
                  <label className="leh-label">Relationship to Family <span style={{ color: 'red' }}>*</span></label>
                  <select 
                    value={linkRelationship}
                    onChange={e => setLinkRelationship(e.target.value)}
                    className="leh-input"
                    required
                  >
                    <option value="Head">Head</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Dependent">Dependent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowLinkPatientModal(false)} className="leh-btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !selectedExistingPatient} className="leh-btn-primary">
                  {submitting ? 'Linking...' : 'Link to Family'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EDIT FAMILY DETAILS */}
      {/* ========================================================= */}
      {showEditFamilyModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '600px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <Edit3 style={{ color: 'var(--leh-primary)' }} />
                <span>Edit Household Details</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowEditFamilyModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditFamilySubmit}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div className="leh-form-group">
                  <label className="leh-label">Family Surname <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="text" 
                    value={editForm.family_name} 
                    onChange={e => setEditForm(prev => ({ ...prev, family_name: e.target.value }))}
                    className="leh-input" 
                    required 
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Displayed as "{editForm.family_name || '...'} Family"
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Contact Person Name <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="text" 
                      value={editForm.contact_person_name} 
                      onChange={e => setEditForm(prev => ({ ...prev, contact_person_name: e.target.value }))}
                      className="leh-input" 
                      required 
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">Contact Phone <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="tel" 
                      value={editForm.contact_person_phone} 
                      onChange={e => setEditForm(prev => ({ ...prev, contact_person_phone: e.target.value }))}
                      className="leh-input" 
                      required 
                    />
                  </div>
                </div>

                <div className="leh-form-group">
                  <label className="leh-label">Residential Address</label>
                  <textarea 
                    value={editForm.residential_address} 
                    onChange={e => setEditForm(prev => ({ ...prev, residential_address: e.target.value }))}
                    className="leh-input" 
                    style={{ height: '70px', paddingTop: '8px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="leh-form-group">
                    <label className="leh-label">Tribe</label>
                    <input 
                      type="text" 
                      value={editForm.tribe} 
                      onChange={e => setEditForm(prev => ({ ...prev, tribe: e.target.value }))}
                      className="leh-input" 
                    />
                  </div>
                  <div className="leh-form-group">
                    <label className="leh-label">State of Origin</label>
                    <input 
                      type="text" 
                      value={editForm.state_of_origin} 
                      onChange={e => setEditForm(prev => ({ ...prev, state_of_origin: e.target.value }))}
                      className="leh-input" 
                    />
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowEditFamilyModal(false)} className="leh-btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="leh-btn-primary">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyProfile;
