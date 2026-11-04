import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2,
  User,
  Users,
  Shield,
  Phone,
  UserPlus,
  FileText,
  Search,
  UserCheck,
  AlertTriangle,
  X
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const PatientRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notify } = useNotification();
  const { user } = useAuth();
  
  // Card Type: 'individual' (₦3,000) or 'family' (₦10,000)
  const initialCardType = searchParams.get('type') === 'family' ? 'family' : 'individual';
  const [cardType, setCardType] = useState<'individual' | 'family'>(initialCardType);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Registration Mode for Individual: 'new' (auto-generates next number) or 'existing' (manual cardholder with existing hospital number)
  const initialMode = searchParams.get('mode') === 'existing' ? 'existing' : 'new';
  const [registrationMode, setRegistrationMode] = useState<'new' | 'existing'>(initialMode);
  const [existingHospitalNumber, setExistingHospitalNumber] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<{ found: boolean; message: string } | null>(null);

  // Registration Mode for Family: 'new' (full new household) or 'existing' (manual cardholder capture)
  const initialFamilyMode = searchParams.get('type') === 'family' && searchParams.get('mode') === 'existing' ? 'existing' : 'new';
  const [familyRegistrationMode, setFamilyRegistrationMode] = useState<'new' | 'existing'>(initialFamilyMode);
  const [existingFamilyCardNumber, setExistingFamilyCardNumber] = useState('');
  const [isFamilyLookingUp, setIsFamilyLookingUp] = useState(false);
  const [familyLookupStatus, setFamilyLookupStatus] = useState<{ found: boolean; message: string; familyId?: number } | null>(null);

  // Individual Patient Form Data
  const [formData, setFormData] = useState({
    full_name: '',
    dob: '',
    gender: '',
    phone: '',
    alternate_phone: '',
    address: '',
    occupation: '',
    marital_status: '',
    blood_group: '',
    genotype: '',
    allergies: '',
    medical_alerts: '',
    next_of_kin: '',
    next_of_kin_phone: '',
    next_of_kin_address: '',
    payment_category: 'Standard',
    department: 'General',
    tribe: '',
    religion: '',
    state_of_origin: ''
  });

  // Family Card Form Data (Only the 6 household fields)
  const [familyData, setFamilyData] = useState({
    family_name: '',           // Surname only, e.g. "Taiwo"
    contact_person_name: '',
    contact_person_phone: '',
    residential_address: '',
    tribe: '',
    state_of_origin: ''
  });

  // Duplicate Surname Warning Modal State
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Insurance Policy Capture State
  const [insurancePayers, setInsurancePayers] = useState<any[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<any[]>([]);
  const [insuranceInfo, setInsuranceInfo] = useState({
    payer_id: '',
    plan_id: '',
    enrollee_number: '',
    relationship: 'PRINCIPAL',
    valid_from: '',
    valid_to: ''
  });

  useEffect(() => {
    api.insurance.getPayers(true)
      .then((p: any) => setInsurancePayers(p || []))
      .catch(() => {});
    api.insurance.getPlans()
      .then((pl: any) => setInsurancePlans(pl || []))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFamilyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFamilyData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  // Look up an existing hospital number for Individual Patients
  const handleLookupExistingNumber = async () => {
    const rawNumber = existingHospitalNumber.trim();
    if (!rawNumber) {
      notify('error', 'Please enter the hospital number to verify (e.g. 01/26/LEH)');
      return;
    }
    setIsLookingUp(true);
    setLookupStatus(null);
    try {
      const patient = await api.getPatient(rawNumber);
      if (patient && patient.id) {
        setFormData({
          full_name: patient.full_name || '',
          dob: patient.dob || '',
          gender: patient.gender || '',
          phone: patient.phone || '',
          alternate_phone: patient.alternate_phone || '',
          address: patient.address || '',
          occupation: patient.occupation || '',
          marital_status: patient.marital_status || '',
          blood_group: patient.blood_group || '',
          genotype: patient.genotype || '',
          allergies: patient.allergies || '',
          medical_alerts: patient.medical_alerts || '',
          next_of_kin: patient.next_of_kin || '',
          next_of_kin_phone: patient.next_of_kin_phone || '',
          next_of_kin_address: patient.next_of_kin_address || '',
          payment_category: patient.payment_category || 'Standard',
          department: patient.department || 'General',
          tribe: patient.tribe || '',
          religion: patient.religion || '',
          state_of_origin: patient.state_of_origin || ''
        });
        setLookupStatus({
          found: true,
          message: `Digital record found for ${patient.full_name} (${patient.id}). Details pre-filled for review or update.`
        });
        notify('success', `Found patient: ${patient.full_name}`);
      } else {
        setLookupStatus({
          found: false,
          message: `No digital record for ${rawNumber} yet. You can now register this manual cardholder into the system database.`
        });
        notify('info', `Hospital number ${rawNumber} is available for manual cardholder registration`);
      }
    } catch {
      setLookupStatus({
        found: false,
        message: `No digital record for ${rawNumber} yet. You can now register this manual cardholder into the system database.`
      });
      notify('info', `Hospital number ${rawNumber} is ready for manual cardholder registration`);
    } finally {
      setIsLookingUp(false);
    }
  };

  // Look up an existing Family Card Number for Family Card capture
  const handleLookupExistingFamily = async () => {
    const rawNumber = existingFamilyCardNumber.trim().toUpperCase();
    if (!rawNumber) {
      notify('error', 'Please enter the Family Card Number (e.g. 0001/26/LEH)');
      return;
    }
    setIsFamilyLookingUp(true);
    setFamilyLookupStatus(null);
    try {
      const family = await api.getFamily(rawNumber);
      if (family && family.id) {
        // Already in system — pre-fill for update
        setFamilyData({
          family_name: family.family_name || '',
          contact_person_name: family.contact_person_name || '',
          contact_person_phone: family.contact_person_phone || '',
          residential_address: family.residential_address || '',
          tribe: family.tribe || '',
          state_of_origin: family.state_of_origin || ''
        });
        setFamilyLookupStatus({
          found: true,
          message: `Record found: "${family.family_name} Family" (${family.family_card_number}). Details pre-filled — update if needed, then save.`,
          familyId: family.id
        });
        notify('success', `Found family: ${family.family_name} Family`);
      } else {
        setFamilyLookupStatus({
          found: false,
          message: `No digital record for "${rawNumber}" yet. Fill in the household details below to capture this family into the system.`
        });
        notify('info', `Card number ${rawNumber} is ready for family capture`);
      }
    } catch {
      setFamilyLookupStatus({
        found: false,
        message: `No digital record for "${rawNumber}" yet. Fill in the household details below to capture this family into the system.`
      });
      notify('info', `Card ${rawNumber} ready for capture — fill in the details below`);
    } finally {
      setIsFamilyLookingUp(false);
    }
  };

  // Submit Existing Family Capture (update if already in system, create with existing card number if not)
  const handleExistingFamilySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cardNumber = existingFamilyCardNumber.trim().toUpperCase();
    if (!cardNumber) {
      notify('error', 'Please enter the existing Family Card Number first');
      return;
    }
    if (!cardNumber.includes('/')) {
      notify('error', 'Card number must be in the format: Number/Year/LEH (e.g. 0001/26/LEH)');
      return;
    }
    if (!familyData.family_name.trim()) {
      notify('error', 'Family name (surname) is required');
      return;
    }
    if (!familyData.contact_person_name.trim()) {
      notify('error', 'Contact person name is required');
      return;
    }
    if (!familyData.contact_person_phone.trim()) {
      notify('error', 'Contact person phone number is required');
      return;
    }

    setLoading(true);
    try {
      if (familyLookupStatus?.familyId) {
        // Family already in EMR — just update the record
        await api.updateFamily(familyLookupStatus.familyId, familyData);
        notify('success', `${familyData.family_name} Family record updated and verified successfully.`);
        navigate(`/families/${familyLookupStatus.familyId}`);
      } else {
        // Not in EMR yet — create with the existing physical card number (no new billing)
        const payload = {
          ...familyData,
          family_name: familyData.family_name.trim(),
          existing_card_number: cardNumber,
          confirm_duplicate: true
        };
        const result = await api.createFamily(payload);
        const createdFamily = result.family || result;
        notify('success', `${createdFamily.family_name} Family captured into the system. Card: ${createdFamily.family_card_number}`);
        navigate(`/families/${createdFamily.id}`);
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to capture family record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Individual Registration
  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registrationMode === 'existing') {
      const cleanNumber = existingHospitalNumber.trim().toUpperCase();
      if (!cleanNumber) {
        notify('error', 'Please enter the Existing Hospital Number (e.g. 01/26/LEH)');
        setStep(1);
        return;
      }
      if (!cleanNumber.includes('/')) {
        notify('error', 'Hospital number must be in the format: Number/Year/LEH (e.g. 01/26/LEH)');
        setStep(1);
        return;
      }
    }

    if (!formData.full_name || !formData.dob || !formData.gender || !formData.phone) {
      notify('error', 'Full legal name, date of birth, gender, and phone number are required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        hospital_number: registrationMode === 'existing' ? existingHospitalNumber.trim().toUpperCase() : undefined
      };
      const result = await api.createPatient(payload);
      const isExisting = registrationMode === 'existing';
      notify('success', `Patient ${formData.full_name} ${isExisting ? 'captured/updated' : 'registered'}. Hospital No: ${result.id}`);

      // Link insurance policy enrollee record if insurance category chosen
      if (['HMO', 'NHIS', 'INSURANCE'].includes(formData.payment_category) && insuranceInfo.payer_id && insuranceInfo.enrollee_number) {
        try {
          await api.insurance.createEnrollee({
            patient_id: result.id,
            payer_id: parseInt(insuranceInfo.payer_id),
            plan_id: insuranceInfo.plan_id ? parseInt(insuranceInfo.plan_id) : null,
            enrollee_number: insuranceInfo.enrollee_number,
            relationship: insuranceInfo.relationship || 'PRINCIPAL',
            valid_from: insuranceInfo.valid_from || null,
            valid_to: insuranceInfo.valid_to || null,
            status: 'ACTIVE'
          });
          notify('success', `Linked to insurance policy #${insuranceInfo.enrollee_number}`);
        } catch (enrErr) {
          console.error('[Registration] Failed to create enrollee record:', enrErr);
        }
      }

      // Auto check-in to billing queue
      try {
        const checkinResult = await api.checkInPatient(String(result.id), 'billing', user?.full_name || 'System');
        notify('success', `${formData.full_name} routed to billing (Individual Card - ₦3,000)`);
        navigate(`/billing?patient_id=${encodeURIComponent(result.id)}&visit_id=${checkinResult.visit_id || ''}&patient_name=${encodeURIComponent(formData.full_name)}&auto_select=Individual%20Card&card_fee=3000`);
      } catch (checkinErr) {
        console.error('Failed to auto-checkin patient to billing:', checkinErr);
        navigate(`/billing?patient_id=${encodeURIComponent(result.id)}&patient_name=${encodeURIComponent(formData.full_name)}&auto_select=Individual%20Card&card_fee=3000`);
      }
    } catch (err: any) {
      notify('error', err.message || 'Registration failed. Please check all required fields.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Family Registration (with optional confirmDuplicate override)
  const handleFamilySubmit = async (e?: React.FormEvent, confirmDuplicate = false) => {
    if (e) e.preventDefault();

    const surname = familyData.family_name.trim();
    if (!surname) {
      notify('error', 'Family name (surname) is required');
      return;
    }
    if (!familyData.contact_person_name.trim()) {
      notify('error', 'Contact person name is required');
      return;
    }
    if (!familyData.contact_person_phone.trim()) {
      notify('error', 'Contact person phone number is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...familyData,
        family_name: surname,
        confirm_duplicate: confirmDuplicate
      };

      const result = await api.createFamily(payload);

      // Duplicate surname warning check
      if (result.warning === 'duplicate_surname_detected') {
        setDuplicateMatches(result.matches || []);
        setShowDuplicateModal(true);
        setLoading(false);
        return;
      }

      setShowDuplicateModal(false);
      const createdFamily = result;
      notify('success', `${createdFamily.family_name} Family registered! Card Number: ${createdFamily.family_card_number}`);

      // Direct route to Billing with ₦10,000 Family Card fee pre-populated
      navigate(
        `/billing?patient_id=${encodeURIComponent(createdFamily.family_card_number)}&patient_name=${encodeURIComponent(createdFamily.family_name + ' Family')}&auto_select=Family%20Card&card_fee=10000&family_id=${createdFamily.id}&is_family=1`
      );
    } catch (err: any) {
      notify('error', err.message || 'Family registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leh-page-container">
      {/* Header */}
      <header className="leh-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/patients')} className="leh-icon-btn">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="leh-page-title">Registration</h1>
            <p className="leh-page-subtitle">
              {cardType === 'individual'
                ? `Individual Card Registration • ₦3,000 • Step ${step} of 3`
                : cardType === 'family' && familyRegistrationMode === 'existing'
                  ? 'Family Card Capture • Existing Manual Cardholder • No Charge'
                  : 'Family Card Household Registration • ₦10,000 • Create Family Household'}
            </p>
          </div>
        </div>
      </header>

      <div className="leh-table-card" style={{ maxWidth: '850px', margin: '0 auto', padding: '0', overflow: 'hidden' }}>
        
        {/* CARD TYPE SELECTOR TABS */}
        <div style={{
          padding: '20px 24px',
          background: 'var(--leh-surface)',
          borderBottom: '1.5px solid var(--leh-border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-forest)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Select Card Category:
            </span>
            <span style={{ fontSize: '11px', color: 'var(--leh-muted)' }}>
              Registration fee auto-populates directly into billing upon completion
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Tab 1: Individual Card */}
            <div
              onClick={() => setCardType('individual')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: cardType === 'individual' ? '2px solid var(--leh-forest)' : '1.5px solid var(--leh-border)',
                background: cardType === 'individual' ? '#ffffff' : 'var(--leh-forest-tint)',
                boxShadow: cardType === 'individual' ? '0 4px 16px rgba(46, 90, 38, 0.12)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: cardType === 'individual' ? 'var(--leh-forest)' : 'rgba(46, 90, 38, 0.12)',
                  color: cardType === 'individual' ? 'var(--leh-lime)' : 'var(--leh-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <User size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--leh-ink)' }}>Individual Card</div>
                  <div style={{ fontSize: '11px', color: 'var(--leh-muted)' }}>Single patient identity</div>
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '900',
                color: cardType === 'individual' ? 'var(--leh-ink)' : 'var(--leh-muted)',
                background: cardType === 'individual' ? 'var(--leh-lime)' : 'var(--leh-border-light)',
                padding: '5px 12px',
                borderRadius: '8px'
              }}>
                ₦3,000
              </div>
            </div>

            {/* Tab 2: Family Card */}
            <div
              onClick={() => setCardType('family')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: cardType === 'family' ? '2px solid var(--leh-forest)' : '1.5px solid var(--leh-border)',
                background: cardType === 'family' ? '#ffffff' : 'var(--leh-forest-tint)',
                boxShadow: cardType === 'family' ? '0 4px 16px rgba(46, 90, 38, 0.12)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: cardType === 'family' ? 'var(--leh-forest)' : 'rgba(46, 90, 38, 0.12)',
                  color: cardType === 'family' ? 'var(--leh-lime)' : 'var(--leh-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Users size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--leh-ink)' }}>Family Card</div>
                  <div style={{ fontSize: '11px', color: 'var(--leh-muted)' }}>Household folder & dependents</div>
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '900',
                color: cardType === 'family' ? 'var(--leh-ink)' : 'var(--leh-muted)',
                background: cardType === 'family' ? 'var(--leh-lime)' : 'var(--leh-border-light)',
                padding: '5px 12px',
                borderRadius: '8px'
              }}>
                ₦10,000
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* CASE A: FAMILY CARD FORM (ONLY 6 HOUSEHOLD FIELDS)                   */}
        {/* ==================================================================== */}
        {cardType === 'family' && (
          <form onSubmit={familyRegistrationMode === 'existing' ? handleExistingFamilySubmit : handleFamilySubmit} style={{ padding: '36px' }}>

            {/* ── Family Registration Mode Switcher: New vs Existing ── */}
            <div style={{
              marginBottom: '28px',
              paddingBottom: '20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-forest)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Family Card Type:
                </span>
              </div>
              <div style={{ display: 'inline-flex', background: 'var(--leh-forest-tint)', borderRadius: '10px', padding: '3px', gap: '4px', border: '1px solid var(--leh-border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFamilyRegistrationMode('new');
                    setExistingFamilyCardNumber('');
                    setFamilyLookupStatus(null);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontWeight: '800', fontSize: '12px', transition: 'all 0.2s ease',
                    background: familyRegistrationMode === 'new' ? 'var(--leh-forest)' : 'transparent',
                    color: familyRegistrationMode === 'new' ? 'var(--leh-lime)' : 'var(--leh-muted)'
                  }}
                >
                  <UserPlus size={14} />
                  <span>New Family</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFamilyRegistrationMode('existing')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontWeight: '800', fontSize: '12px', transition: 'all 0.2s ease',
                    background: familyRegistrationMode === 'existing' ? 'var(--leh-forest)' : 'transparent',
                    color: familyRegistrationMode === 'existing' ? 'var(--leh-lime)' : 'var(--leh-muted)'
                  }}
                >
                  <FileText size={14} />
                  <span>Existing Family (Manual Card)</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* ── Existing Family Card Number Lookup Panel ── */}
              {familyRegistrationMode === 'existing' && (
                <div style={{
                  background: 'linear-gradient(135deg, var(--leh-forest-tint) 0%, var(--leh-lime-soft) 100%)',
                  border: '1.5px solid var(--leh-border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} style={{ color: 'var(--leh-forest)' }} />
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--leh-ink)' }}>
                        Existing Family Card Number <span style={{ color: 'var(--leh-danger)' }}>*</span>
                      </h4>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--leh-forest)' }}>
                      Format: Number/Year/LEH (e.g. 0001/26/LEH)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={existingFamilyCardNumber}
                      onChange={(e) => {
                        setExistingFamilyCardNumber(e.target.value.toUpperCase());
                        setFamilyLookupStatus(null);
                      }}
                      placeholder="e.g. 0001/26/LEH"
                      className="leh-input"
                      style={{ fontWeight: '800', fontSize: '14px', textTransform: 'uppercase' }}
                    />
                    <button
                      type="button"
                      onClick={handleLookupExistingFamily}
                      disabled={isFamilyLookingUp || !existingFamilyCardNumber.trim()}
                      className="leh-btn-outline"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Search size={15} />
                      <span>{isFamilyLookingUp ? 'Checking...' : 'Check Card'}</span>
                    </button>
                  </div>

                  {familyLookupStatus && (
                    <div style={{
                      fontSize: '12px', padding: '8px 12px', borderRadius: '8px', fontWeight: '600',
                      background: familyLookupStatus.found ? 'var(--leh-success-bg)' : 'var(--leh-info-bg)',
                      color: familyLookupStatus.found ? 'var(--leh-success)' : 'var(--leh-info)',
                      border: `1px solid ${familyLookupStatus.found ? 'var(--leh-success-border)' : 'var(--leh-info-border)'}`
                    }}>
                      {familyLookupStatus.found ? <UserCheck size={14} style={{ display: 'inline', marginRight: '6px' }} /> : null}
                      <span>{familyLookupStatus.message}</span>
                    </div>
                  )}

                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--leh-muted)', lineHeight: '1.5' }}>
                    This captures a family that already holds a <strong>physical hospital card</strong> but hasn&apos;t been entered into the EMR system yet. Their existing card number is preserved and <strong>no registration fee is charged</strong>.
                  </p>
                </div>
              )}

              {/* ── Info Banner (New Family only) ── */}
              {familyRegistrationMode === 'new' && (
                <div style={{
                  background: 'linear-gradient(135deg, var(--leh-forest-tint) 0%, var(--leh-lime-soft) 100%)',
                  border: '1.5px solid var(--leh-border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--leh-lime)', color: 'var(--leh-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(192, 255, 114, 0.4)' }}>
                    <Users size={22} />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--leh-ink)', lineHeight: '1.4' }}>
                    <strong>Family Household Registration (₦10,000):</strong> This provisions the family master folder. Individual members can be registered or linked anytime under this card with their own clinical histories.
                  </div>
                </div>
              )}

              {/* Field 1: Family Surname */}
              <div className="leh-form-group">
                <label className="leh-label">
                  Family Name (Surname Only) <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type="text" 
                  name="family_name" 
                  value={familyData.family_name}
                  onChange={handleFamilyChange} 
                  className="leh-input" 
                  placeholder="e.g. Taiwo" 
                  required 
                  style={{ fontSize: '15px', fontWeight: '700' }}
                />
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Entered as surname only. The system displays it as "<strong>{familyData.family_name ? `${familyData.family_name.trim()} Family` : '... Family'}</strong>" everywhere.
                </span>
              </div>

              {/* Field 2 & 3: Contact Person Name and Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="leh-form-group">
                  <label className="leh-label">
                    Contact Person Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    name="contact_person_name" 
                    value={familyData.contact_person_name}
                    onChange={handleFamilyChange} 
                    className="leh-input" 
                    placeholder="e.g. Taiwo Babatunde" 
                    required 
                  />
                </div>
                <div className="leh-form-group">
                  <label className="leh-label">
                    Contact Person Phone Number <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input 
                    type="tel" 
                    name="contact_person_phone" 
                    value={familyData.contact_person_phone}
                    onChange={handleFamilyChange} 
                    className="leh-input" 
                    placeholder="08012345678" 
                    required 
                  />
                </div>
              </div>

              {/* Field 4: Residential Address */}
              <div className="leh-form-group">
                <label className="leh-label">Residential Address</label>
                <textarea 
                  name="residential_address" 
                  value={familyData.residential_address}
                  onChange={handleFamilyChange} 
                  className="leh-input" 
                  style={{ height: '70px', paddingTop: '8px' }}
                  placeholder="House number, Street, City, State" 
                />
              </div>

              {/* Field 5 & 6: Tribe and State of Origin */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="leh-form-group">
                  <label className="leh-label">Tribe</label>
                  <input 
                    type="text" 
                    name="tribe" 
                    value={familyData.tribe}
                    onChange={handleFamilyChange} 
                    className="leh-input" 
                    placeholder="e.g. Yoruba, Hausa, Igbo, etc." 
                  />
                </div>
                <div className="leh-form-group">
                  <label className="leh-label">State of Origin</label>
                  <input 
                    type="text" 
                    name="state_of_origin" 
                    value={familyData.state_of_origin}
                    onChange={handleFamilyChange} 
                    className="leh-input" 
                    placeholder="e.g. Ogun State" 
                  />
                </div>
              </div>

              {/* Family Registration Actions */}
              <div className="leh-form-actions" style={{ marginTop: '20px', paddingTop: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/patients')}
                  className="leh-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="leh-btn-primary"
                  style={{ padding: '0 28px', height: '44px' }}
                >
                  {loading ? (
                    <LoadingSpinner
                      size="small"
                      mode="button"
                      label={familyRegistrationMode === 'existing' ? 'Saving Record...' : 'Creating Household...'}
                      color="white"
                    />
                  ) : familyRegistrationMode === 'existing' ? (
                    <>
                      <CheckCircle2 size={18} style={{ marginRight: '8px' }} />
                      <span>
                        {familyLookupStatus?.familyId ? 'UPDATE & SAVE FAMILY RECORD' : 'CAPTURE EXISTING FAMILY (NO CHARGE)'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} style={{ marginRight: '8px' }} />
                      <span>REGISTER FAMILY & BILL CARD (₦10,000)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ==================================================================== */}
        {/* CASE B: INDIVIDUAL CARD FORM (EXISTING 3 STEPS)                      */}
        {/* ==================================================================== */}
        {cardType === 'individual' && (
          <>
            {/* Registration Mode Switcher: New vs Existing */}
            <div style={{
              padding: '14px 24px',
              background: '#ffffff',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-forest)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Patient Identity Type:
                </span>
              </div>
              <div style={{ display: 'inline-flex', background: 'var(--leh-forest-tint)', borderRadius: '10px', padding: '3px', gap: '4px', border: '1px solid var(--leh-border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationMode('new');
                    setExistingHospitalNumber('');
                    setLookupStatus(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                    background: registrationMode === 'new' ? 'var(--leh-forest)' : 'transparent',
                    color: registrationMode === 'new' ? 'var(--leh-lime)' : 'var(--leh-muted)'
                  }}
                >
                  <UserPlus size={14} />
                  <span>New Patient</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegistrationMode('existing')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                    background: registrationMode === 'existing' ? 'var(--leh-forest)' : 'transparent',
                    color: registrationMode === 'existing' ? 'var(--leh-lime)' : 'var(--leh-muted)'
                  }}
                >
                  <FileText size={14} />
                  <span>Existing Patient (Manual Card)</span>
                </button>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', gap: '12px' }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ 
                  flex: 1, height: '6px', 
                  background: s <= step ? 'var(--leh-forest)' : 'var(--leh-border-light)', 
                  borderRadius: '3px',
                  transition: 'background 0.3s ease'
                }}></div>
              ))}
            </div>

            <form onSubmit={handleIndividualSubmit} style={{ padding: '36px' }}>
              {/* STEP 1: Identity & Demographics */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {registrationMode === 'existing' && (
                    <div style={{
                      background: 'linear-gradient(135deg, var(--leh-forest-tint) 0%, var(--leh-lime-soft) 100%)',
                      border: '1.5px solid var(--leh-border)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} style={{ color: 'var(--leh-forest)' }} />
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--leh-ink)' }}>
                            Existing Hospital Number <span style={{ color: 'var(--leh-danger)' }}>*</span>
                          </h4>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--leh-forest)' }}>
                          Format: Number/Year/LEH (e.g. 01/26/LEH)
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          value={existingHospitalNumber}
                          onChange={(e) => {
                            setExistingHospitalNumber(e.target.value.toUpperCase());
                            setLookupStatus(null);
                          }}
                          placeholder="e.g. 01/26/LEH"
                          className="leh-input"
                          style={{ fontWeight: '800', fontSize: '14px', textTransform: 'uppercase' }}
                          required={registrationMode === 'existing'}
                        />
                        <button
                          type="button"
                          onClick={handleLookupExistingNumber}
                          disabled={isLookingUp || !existingHospitalNumber.trim()}
                          className="leh-btn-outline"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <Search size={15} />
                          <span>{isLookingUp ? 'Checking...' : 'Check Number'}</span>
                        </button>
                      </div>

                      {lookupStatus && (
                        <div style={{
                          fontSize: '12px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: '600',
                          background: lookupStatus.found ? '#dcfce7' : '#e0f2fe',
                          color: lookupStatus.found ? '#166534' : '#0369a1'
                        }}>
                          {lookupStatus.found ? <UserCheck size={14} style={{ display: 'inline', marginRight: '6px' }} /> : null}
                          <span>{lookupStatus.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <User size={18} style={{ color: 'var(--leh-primary)' }} />
                    <h3 className="leh-table-title" style={{ fontSize: '15px', margin: 0 }}>Identity & Demographics</h3>
                  </div>
                  
                  <div className="leh-form-group">
                    <label className="leh-label">Full Legal Name <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="text" name="full_name" value={formData.full_name}
                      onChange={handleChange} className="leh-input" 
                      placeholder="e.g. Adebayo Olumide" required 
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Date of Birth <span style={{ color: 'red' }}>*</span></label>
                      <input 
                        type="date" name="dob" value={formData.dob}
                        onChange={handleChange} className="leh-date-input" 
                        style={{ width: '100%' }} required 
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">Gender <span style={{ color: 'red' }}>*</span></label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className="leh-input" required>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Marital Status</label>
                      <select name="marital_status" value={formData.marital_status} onChange={handleChange} className="leh-input">
                        <option value="">Select status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">Occupation</label>
                      <input 
                        type="text" name="occupation" value={formData.occupation}
                        onChange={handleChange} className="leh-input" 
                        placeholder="e.g. Teacher, Civil Servant" 
                      />
                    </div>
                  </div>

                  {/* Demographic additions: Tribe & Religion */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Tribe</label>
                      <input 
                        type="text" name="tribe" value={formData.tribe}
                        onChange={handleChange} className="leh-input" 
                        placeholder="e.g. Yoruba, Igbo, Hausa" 
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">Religion</label>
                      <input 
                        type="text" name="religion" value={formData.religion}
                        onChange={handleChange} className="leh-input" 
                        placeholder="e.g. Christianity, Islam" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Contact, Location & Next of Kin */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Phone size={18} style={{ color: 'var(--leh-primary)' }} />
                    <h3 className="leh-table-title" style={{ fontSize: '15px', margin: 0 }}>Contact & Emergency Details</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Primary Phone <span style={{ color: 'red' }}>*</span></label>
                      <input 
                        type="tel" name="phone" value={formData.phone}
                        onChange={handleChange} className="leh-input" 
                        placeholder="08012345678" required 
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">Alternate Phone</label>
                      <input 
                        type="tel" name="alternate_phone" value={formData.alternate_phone}
                        onChange={handleChange} className="leh-input" 
                        placeholder="Optional second number" 
                      />
                    </div>
                  </div>

                  <div className="leh-form-group">
                    <label className="leh-label">Residential Address <span style={{ color: 'red' }}>*</span></label>
                    <textarea 
                      name="address" value={formData.address}
                      onChange={handleChange} className="leh-input" 
                      style={{ height: '70px', paddingTop: '8px' }}
                      placeholder="Full residential street address, City, State" required
                    />
                  </div>

                  <div className="leh-form-group">
                    <label className="leh-label">State of Origin</label>
                    <input 
                      type="text" name="state_of_origin" value={formData.state_of_origin}
                      onChange={handleChange} className="leh-input" 
                      placeholder="e.g. Ogun State" 
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Next of Kin (Full Name) <span style={{ color: 'red' }}>*</span></label>
                      <input 
                        type="text" name="next_of_kin" value={formData.next_of_kin}
                        onChange={handleChange} className="leh-input" 
                        placeholder="Emergency contact full name" required 
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">Next of Kin Phone <span style={{ color: 'red' }}>*</span></label>
                      <input 
                        type="tel" name="next_of_kin_phone" value={formData.next_of_kin_phone}
                        onChange={handleChange} className="leh-input" 
                        placeholder="Emergency contact phone" required 
                      />
                    </div>
                  </div>

                  <div className="leh-form-group">
                    <label className="leh-label">Next of Kin Address</label>
                    <input 
                      type="text" name="next_of_kin_address" value={formData.next_of_kin_address}
                      onChange={handleChange} className="leh-input" 
                      placeholder="Next of kin residential address" 
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Clinical Baseline & Payment Category */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={18} style={{ color: 'var(--leh-primary)' }} />
                    <h3 className="leh-table-title" style={{ fontSize: '15px', margin: 0 }}>Clinical Baseline & Payment Category</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Blood Group</label>
                      <select name="blood_group" value={formData.blood_group} onChange={handleChange} className="leh-input">
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
                      <select name="genotype" value={formData.genotype} onChange={handleChange} className="leh-input">
                        <option value="">Unknown</option>
                        <option value="AA">AA</option>
                        <option value="AS">AS</option>
                        <option value="SS">SS</option>
                        <option value="AC">AC</option>
                      </select>
                    </div>
                  </div>

                  <div className="leh-form-group">
                    <label className="leh-label">Known Allergies</label>
                    <input 
                      type="text" name="allergies" value={formData.allergies}
                      onChange={handleChange} className="leh-input" 
                      placeholder="e.g. Penicillin, Pollen, Latex" 
                    />
                  </div>

                  <div className="leh-form-group">
                    <label className="leh-label">Medical Alerts / History</label>
                    <textarea 
                      name="medical_alerts" value={formData.medical_alerts}
                      onChange={handleChange} className="leh-input" 
                      style={{ height: '70px', paddingTop: '8px' }}
                      placeholder="Pre-existing conditions, glaucoma suspect, surgical history, etc."
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="leh-form-group">
                      <label className="leh-label">Payment Category</label>
                      <select name="payment_category" value={formData.payment_category} onChange={handleChange} className="leh-input">
                        <option value="Standard">Standard (Cash)</option>
                        <option value="NHIS">NHIS</option>
                        <option value="HMO">HMO</option>
                        <option value="Waived">Waived / Free</option>
                        <option value="Staff">Staff Benefit</option>
                      </select>
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">Initial Department</label>
                      <select name="department" value={formData.department} onChange={handleChange} className="leh-input">
                        <option value="General">General</option>
                        <option value="Optometry">Optometry</option>
                        <option value="Ophthalmology">Ophthalmology</option>
                        <option value="Pharmacy">Pharmacy</option>
                      </select>
                    </div>
                  </div>

                  {['HMO', 'NHIS', 'INSURANCE'].includes(formData.payment_category) && (
                    <div style={{
                      background: 'var(--leh-forest-tint)',
                      border: '1.5px solid var(--leh-border)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={16} style={{ color: 'var(--leh-forest)' }} />
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--leh-ink)' }}>
                          HMO / NHIA Policy Details
                        </h4>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="leh-form-group">
                          <label className="leh-label">Select Payer / HMO <span style={{ color: 'red' }}>*</span></label>
                          <select
                            className="leh-input"
                            value={insuranceInfo.payer_id}
                            onChange={(e) => setInsuranceInfo({ ...insuranceInfo, payer_id: e.target.value, plan_id: '' })}
                          >
                            <option value="">-- Choose HMO/Payer --</option>
                            {insurancePayers.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="leh-form-group">
                          <label className="leh-label">Health Plan</label>
                          <select
                            className="leh-input"
                            value={insuranceInfo.plan_id}
                            onChange={(e) => setInsuranceInfo({ ...insuranceInfo, plan_id: e.target.value })}
                          >
                            <option value="">-- Standard / Default --</option>
                            {insurancePlans
                              .filter((pl: any) => !insuranceInfo.payer_id || pl.payer_id === parseInt(insuranceInfo.payer_id))
                              .map((pl: any) => (
                                <option key={pl.id} value={pl.id}>{pl.name}</option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                        <div className="leh-form-group">
                          <label className="leh-label">Enrollee / Policy Number <span style={{ color: 'red' }}>*</span></label>
                          <input
                            type="text"
                            className="leh-input"
                            placeholder="e.g. NHIA/2026/00192"
                            value={insuranceInfo.enrollee_number}
                            onChange={(e) => setInsuranceInfo({ ...insuranceInfo, enrollee_number: e.target.value })}
                          />
                        </div>

                        <div className="leh-form-group">
                          <label className="leh-label">Relationship</label>
                          <select
                            className="leh-input"
                            value={insuranceInfo.relationship}
                            onChange={(e) => setInsuranceInfo({ ...insuranceInfo, relationship: e.target.value })}
                          >
                            <option value="PRINCIPAL">Principal</option>
                            <option value="SPOUSE">Spouse</option>
                            <option value="CHILD">Child</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation buttons for Individual Form */}
              <div className="leh-form-actions" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                {step > 1 && (
                  <button type="button" onClick={prevStep} className="leh-btn-outline">
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>
                )}
                <div style={{ flex: 1 }}></div>
                {step < 3 ? (
                  <button type="button" onClick={nextStep} className="leh-btn-primary">
                    <span>Continue</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button type="submit" disabled={loading} className="leh-btn-primary" style={{ padding: '0 28px' }}>
                    {loading ? (
                      <LoadingSpinner size="small" mode="button" label="Registering..." color="white" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} style={{ marginRight: '8px' }} />
                        <span>REGISTER & BILL INDIVIDUAL CARD (₦3,000)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {/* ==================================================================== */}
      {/* DUPLICATE SURNAME CONFIRMATION MODAL                                 */}
      {/* ==================================================================== */}
      {showDuplicateModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '580px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <AlertTriangle style={{ color: '#d97706' }} />
                <span>Existing Households Under "{familyData.family_name}"</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowDuplicateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                The following family households are already registered under the surname "<strong>{familyData.family_name}</strong>". Please verify if the patient belongs to one of these existing households, or confirm registration of a new distinct household.
              </p>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                {duplicateMatches.map((m: any) => (
                  <div key={m.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ color: '#0f172a' }}>{m.family_name} Family</strong>
                      <span style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--leh-primary)', fontSize: '11px' }}>
                        {m.family_card_number}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Contact: {m.contact_person_name} • Phone: {m.contact_person_phone}
                    </div>
                    {m.residential_address && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Address: {m.residential_address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                type="button" 
                onClick={() => setShowDuplicateModal(false)} 
                className="leh-btn-outline"
              >
                Review / Change Name
              </button>
              <button 
                type="button" 
                onClick={() => handleFamilySubmit(undefined, true)} 
                className="leh-btn-primary"
              >
                Confirm & Register New Household
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientRegistration;
