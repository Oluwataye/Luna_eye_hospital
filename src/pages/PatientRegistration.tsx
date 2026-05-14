import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2,
  User,
  Shield,
  Phone,
  RefreshCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';

export const PatientRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Field names EXACTLY match the server's POST /api/patients expected fields
  const [formData, setFormData] = useState({
    full_name: '',
    dob: '',                    // server expects 'dob' not 'date_of_birth'
    gender: '',
    phone: '',
    alternate_phone: '',
    address: '',
    occupation: '',
    marital_status: '',
    blood_group: '',
    genotype: '',
    allergies: '',
    medical_alerts: '',         // server expects 'medical_alerts' not 'medical_history'
    next_of_kin: '',            // server expects 'next_of_kin' not 'emergency_contact_name'
    next_of_kin_phone: '',      // server expects 'next_of_kin_phone' not 'emergency_contact_phone'
    payment_category: 'Standard',
    department: 'General'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.dob || !formData.gender || !formData.phone) {
      notify('error', 'Full name, date of birth, gender, and phone are required');
      return;
    }
    setLoading(true);
    try {
      const result = await api.createPatient(formData);
      notify('success', `Patient ${formData.full_name} registered. File No: ${result.id}`);
      navigate('/patients');
    } catch (err: any) {
      notify('error', err.message || 'Registration failed. Please check all required fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leh-page-container">
      <header className="leh-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/patients')} className="leh-icon-btn">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="leh-page-title">Patient Registration</h1>
            <p className="leh-page-subtitle">Step {step} of 3 — Clinical identity provisioning</p>
          </div>
        </div>
      </header>

      <div className="leh-table-card" style={{ maxWidth: '800px', margin: '0 auto', padding: '0' }}>
        {/* Step Progress Bar */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ 
              flex: 1, height: '6px', 
              background: s <= step ? 'var(--leh-primary)' : '#f1f5f9', 
              borderRadius: '3px',
              transition: 'background 0.3s ease'
            }}></div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '40px' }}>
          {/* STEP 1: Identity & Demographics */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <User size={20} style={{ color: 'var(--leh-primary)' }} />
                <h3 className="leh-table-title" style={{ fontSize: '16px', margin: 0 }}>Identity & Demographics</h3>
              </div>
              
              <div className="leh-form-group">
                <label className="leh-label">Full Legal Name <span style={{ color: 'red' }}>*</span></label>
                <input 
                  type="text" name="full_name" value={formData.full_name}
                  onChange={handleChange} className="leh-input" 
                  placeholder="As it appears on government ID" required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                    placeholder="e.g. Teacher, Farmer" 
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Contact & Location */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Phone size={20} style={{ color: 'var(--leh-primary)' }} />
                <h3 className="leh-table-title" style={{ fontSize: '16px', margin: 0 }}>Contact & Location</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                  style={{ height: '80px', paddingTop: '10px' }}
                  placeholder="Full street address, City, State" required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="leh-form-group">
                  <label className="leh-label">Next of Kin (Name) <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="text" name="next_of_kin" value={formData.next_of_kin}
                    onChange={handleChange} className="leh-input" 
                    placeholder="Emergency contact name" required 
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
            </div>
          )}

          {/* STEP 3: Clinical Baseline & Payment */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Shield size={20} style={{ color: 'var(--leh-primary)' }} />
                <h3 className="leh-table-title" style={{ fontSize: '16px', margin: 0 }}>Clinical Baseline & Payment</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                  style={{ height: '80px', paddingTop: '10px' }}
                  placeholder="Pre-existing conditions, surgical history, etc."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
            </div>
          )}

          <div className="leh-form-actions" style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
            {step > 1 && (
              <button type="button" onClick={prevStep} className="leh-btn-outline">
                <ChevronLeft size={18} />
                <span>Previous</span>
              </button>
            )}
            <div style={{ flex: 1 }}></div>
            {step < 3 ? (
              <button type="button" onClick={nextStep} className="leh-btn-primary">
                <span>Continue</span>
                <ChevronRight size={18} />
              </button>
            ) : (
              <button type="submit" disabled={loading} className="leh-btn-primary" style={{ padding: '0 32px' }}>
                {loading ? <RefreshCcw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>{loading ? 'Registering...' : 'Register Clinical Identity'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
