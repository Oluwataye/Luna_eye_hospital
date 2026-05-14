import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, CheckCircle, User, Activity, Eye, 
  Pill, Glasses, Stethoscope, Scissors, CheckCircle2, Printer, 
  Search, Plus, Trash2, Clock, X, RefreshCcw, 
  History as HistoryIcon, Droplets, Target, 
  ClipboardList, AlertTriangle, Download, Info
} from 'lucide-react';

const SNELLEN_OPTIONS = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '3/60', '1/60', 'CF', 'HM', 'PL', 'NPL'];

const DIAGNOSIS_OPTIONS = [
  'Myopia', 'Hyperopia', 'Astigmatism', 'Presbyopia', 
  'Glaucoma Suspect', 'Primary Open Angle Glaucoma', 'Angle Closure Glaucoma',
  'Cataract', 'Diabetic Retinopathy', 'Hypertensive Retinopathy', 
  'Age-Related Macular Degeneration', 'Pterygium', 'Conjunctivitis', 
  'Dry Eye Syndrome', 'Retinal Detachment', 'Optic Neuritis', 
  'Amblyopia', 'Strabismus', 'Normal Eye Examination', 'Other'
];
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard, formatDateTimeStandard } from '../utils/date';
import { PatientStatus } from '../constants/workflow';

// --- TYPES ---
interface Medication {
  drug_name: string;
  strength: string;
  route: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

// --- HELPER COMPONENTS ---

const SectionHeader = ({ title, icon: Icon, onMarkNormal, onSave }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px solid var(--leh-border-light)', paddingBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
       <div style={{ width: '48px', height: '48px', background: 'var(--leh-primary-light)', color: 'var(--leh-primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={24} />
       </div>
       <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--leh-text-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</h2>
          <p style={{ fontSize: '12px', color: 'var(--leh-text-muted)', fontWeight: '600', margin: 0 }}>Clinical Documentation Module</p>
       </div>
    </div>
    <div style={{ display: 'flex', gap: '12px' }}>
      {onMarkNormal && (
        <button className="leh-btn-outline" onClick={onMarkNormal} style={{ background: 'white', color: 'var(--leh-primary)', border: '1px solid var(--leh-primary)', padding: '0 16px' }}>
          <CheckCircle2 size={16} />
          <span style={{ fontSize: '11px', fontWeight: '800' }}>MARK AS NORMAL</span>
        </button>
      )}
      {onSave && (
        <button className="leh-btn-primary" onClick={onSave} style={{ padding: '0 16px', background: 'var(--leh-green)', height: '40px' }}>
          <Save size={16} />
          <span style={{ fontSize: '11px', fontWeight: '800' }}>SAVE SECTION</span>
        </button>
      )}
    </div>
  </div>
);

const ClinicalField = ({ label, children, fullWidth = false }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
    <label style={{ fontSize: '11px', fontWeight: '900', color: 'var(--leh-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
    {children}
  </div>
);

const ODSideBySide = ({ label, childrenOD, childrenOS }: any) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '24px' }}>
     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: '900', color: 'var(--leh-primary)', background: 'var(--leh-primary-light)', padding: '4px 8px', borderRadius: '6px', width: 'fit-content' }}>{label} OD</div>
        {childrenOD}
     </div>
     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: '900', color: 'var(--leh-green)', background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px', width: 'fit-content' }}>{label} OS</div>
        {childrenOS}
     </div>
  </div>
);

// --- MAIN PAGE COMPONENT ---

export const Consultations: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('History');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const autoSaveTimerRef = React.useRef<any>(null);

  const menuItems = [
    { id: 'History', label: 'History & Complaint', icon: User },
    { id: 'Vitals', label: 'Vitals Review', icon: Activity },
    { id: 'Vision', label: 'Visual Acuity', icon: Eye },
    { id: 'IOP', label: 'Intraocular Pressure', icon: Target },
    { id: 'Refraction', label: 'Refraction', icon: Glasses },
    { id: 'AnteriorSeg', label: 'Anterior Segment', icon: Eye },
    { id: 'Dilation', label: 'Dilation', icon: Droplets },
    { id: 'Fundoscopy', label: 'Fundoscopy', icon: Eye },
    { id: 'Diagnosis', label: 'Clinical Diagnosis', icon: Target },
    { id: 'Plan', label: 'Treatment Plan', icon: Pill },
    { id: 'Notes', label: 'Clinical Notes', icon: ClipboardList },
    { id: 'Surgery', label: 'Surgery & Admission', icon: Scissors }
  ];
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [triageData, setTriageData] = useState<any>(null);
  const [sendBackNote, setSendBackNote] = useState('');

  const [formData, setFormData] = useState<any>({
    complaint: '', hpi: '', ocular_history: '', medical_history: '', drug_history: '', allergies: '', family_history: '',
    vitals_bp_systolic: '', vitals_bp_diastolic: '', vitals_pulse: '', vitals_temp: '', vitals_weight: '',
    va_od_unaided_dv: '', va_os_unaided_dv: '', va_od_aided_dv: '', va_os_aided_dv: '',
    va_od_unaided_nv: '', va_os_unaided_nv: '', va_od_aided_nv: '', va_os_aided_nv: '',
    va_od_ph: '', va_os_ph: '', va_method: 'Snellen Chart', va_notes: '',
    iop_od: '', iop_os: '', iop_method: 'Non-contact Tonometer', iop_time: '', iop_notes: '',
    ref_od_sph: '', ref_od_cyl: '', ref_od_axis: '', ref_od_va: '',
    ref_os_sph: '', ref_os_cyl: '', ref_os_axis: '', ref_os_va: '',
    ref_od_near_add: '', ref_os_near_add: '', ref_pd: '', ref_notes: '', ref_prism_od: '', ref_prism_os: '',
    as_lids_od: 'Normal', as_lids_os: 'Normal', as_lids_notes_od: '', as_lids_notes_os: '',
    as_conj_od: 'Normal', as_conj_os: 'Normal', as_conj_notes_od: '', as_conj_notes_os: '',
    as_cornea_od: 'Normal', as_cornea_os: 'Normal', as_cornea_notes_od: '', as_cornea_notes_os: '',
    as_ac_depth_od: 'Normal', as_ac_depth_os: 'Normal',
    as_ac_cells_od: 'None', as_ac_cells_os: 'None',
    as_ac_flare_od: 'None', as_ac_flare_os: 'None',
    as_iris_od: 'Normal', as_iris_os: 'Normal', as_iris_notes_od: '', as_iris_notes_os: '',
    as_lens_od: 'Clear', as_lens_os: 'Clear',
    as_lens_grade_od: '', as_lens_grade_os: '', as_lens_notes_od: '', as_lens_notes_os: '',
    as_vit_od: 'Normal', as_vit_os: 'Normal', as_vit_notes_od: '', as_vit_notes_os: '',
    as_comments: '',
    as_abnormal: {},
    dil_agent: 'Tropicamide 1%', dil_od: 'No', dil_os: 'No', dil_time_od: '', dil_time_os: '',
    dil_va_od: '', dil_va_os: '', dil_adequate: 'Adequate', dil_notes: '',
    fs_disc_cdr_od: '0.3', fs_disc_cdr_os: '0.3',
    fs_disc_margins_od: 'Distinct', fs_disc_margins_os: 'Distinct',
    fs_disc_color_od: 'Normal', fs_disc_color_os: 'Normal',
    fs_macula_od: 'Normal', fs_macula_os: 'Normal', fs_macula_notes_od: '', fs_macula_notes_os: '',
    fs_vessels_av_od: '2:3', fs_vessels_av_os: '2:3',
    fs_vessels_nipping_od: 'Absent', fs_vessels_nipping_os: 'Absent',
    fs_vessels_notes: '',
    fs_periph_od: 'Normal', fs_periph_os: 'Normal', fs_periph_notes_od: '', fs_periph_notes_os: '',
    fs_vit_od: 'Normal', fs_vit_os: 'Normal', fs_vit_notes_od: '', fs_vit_notes_os: '',
    fs_method: 'Slit Lamp with 90D Lens', fs_summary: '',
    fs_abnormal: {},
    diag_od: '', diag_os: '', diag_secondary: '', diag_differential: '', diag_summary: '', diag_severity: 'Mild', diag_confirmed: false,
    plan_glasses_od: { sph: '', cyl: '', axis: '', add: '', prism: '' },
    plan_glasses_os: { sph: '', cyl: '', axis: '', add: '', prism: '' },
    plan_glasses_pd: '', plan_frame: '', plan_lens_type: '', plan_lens_material: '', plan_special_instructions: '',
    plan_meds: [] as Medication[],
    plan_types: [],
    plan_followup_date: '', plan_instructions: '',
    notes_internal: '', notes_reception: '', notes_nurse: '',
    surgery_advised: false, surgery_type: '', surgery_urgency: 'Elective', surgery_notes: '',
    surgery_date: '', surgery_surgeon: '', surgery_preop: '', surgery_counselled: false, surgery_counsel_notes: '',
    admission_advised: false, admission_reason: '', admission_urgency: 'Routine'
  });

  const [sectionStatus, setSectionStatus] = useState<any>({});

  const loadQueue = useCallback(async () => {
    try {
      const data = await api.getConsultationQueue();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Queue Fetch Error:', err);
      notify('error', `Clinical Queue Error: ${err.message || 'Unknown error'}`);
    }
  }, [notify]);

  useEffect(() => { 
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const fetchConsultation = useCallback(async (patientId: string, visitId: number) => {
    try {
      const consultations = await api.getConsultations(patientId);
      const currentConsultation = consultations.find((c: any) => c.visit_id === visitId);
      if (currentConsultation) {
        let savedData = {};
        try {
          savedData = typeof currentConsultation.clinical_data === 'string' 
            ? JSON.parse(currentConsultation.clinical_data) 
            : currentConsultation.clinical_data || {};
        } catch (e) {
          console.warn('Failed to parse clinical_data JSON', e);
        }
        
        setFormData((prev: any) => ({
          ...prev,
          ...savedData,
          complaint: currentConsultation.complaint || (savedData as any).complaint || prev.complaint,
          diag_summary: currentConsultation.primary_diagnosis || (savedData as any).diag_summary || prev.diag_summary
        }));
        
        const status: any = {};
        if ((savedData as any).complaint) status['History'] = true;
        if ((savedData as any).vitals_bp_systolic) status['Vitals'] = true;
        if ((savedData as any).va_od_unaided_dv) status['VA'] = true;
        if ((savedData as any).iop_od) status['IOP'] = true;
        if ((savedData as any).ref_od_sph) status['Refraction'] = true;
        if ((savedData as any).as_lids_od) status['AnteriorSeg'] = true;
        if ((savedData as any).dil_adequate) status['Dilation'] = true;
        if ((savedData as any).fs_disc_cdr_od) status['Fundoscopy'] = true;
        if ((savedData as any).diag_od) status['Diagnosis'] = true;
        if ((savedData as any).plan_meds?.length > 0) status['Plan'] = true;
        if ((savedData as any).clinical_notes) status['Notes'] = true;
        if ((savedData as any).surgery_advised) status['Surgery'] = true;
        setSectionStatus(status);
        
        setIsLocked(currentConsultation.finalized === 1 || currentConsultation.finalize === 1);
        
        notify('info', 'Previous clinical progress loaded');
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.warn('Consultation fetch failed:', err);
    }
  }, [notify]);

  const fetchTriage = useCallback(async (patientId: string) => {
    try {
      const data = await api.getPatientTriage(patientId);
      setTriageData(data);
      if (data) {
        setFormData((prev: any) => ({ 
          ...prev, 
          allergies: data.allergies || prev.allergies,
          vitals_bp_systolic: data.bp_systolic || prev.vitals_bp_systolic,
          vitals_bp_diastolic: data.bp_diastolic || prev.vitals_bp_diastolic,
          vitals_pulse: data.pulse_rate || prev.vitals_pulse,
          vitals_temp: data.temperature || prev.vitals_temp,
          vitals_weight: data.weight || prev.vitals_weight,
          complaint: data.complaint || prev.complaint
        }));
      }
    } catch (err) {
      console.warn('Triage fetch failed:', err);
    }
  }, []);

  const handlePatientSelect = async (p: any) => {
    try {
      await api.updateVisitStatus(p.visit_id, PatientStatus.IN_CONSULTATION, user?.full_name);
      setSelectedPatient(p);
      
      // Load triage first (baseline)
      await fetchTriage(p.patient_id || p.id);
      
      // Load existing consultation (takes precedence if exists)
      await fetchConsultation(p.patient_id || p.id, p.visit_id);
      
      setIsDirty(false); // Reset dirty state on new patient
      setIsLocked(false); // Reset lock
      notify('info', `Consultation Started: ${p.full_name}`);
      loadQueue();
    } catch (err) {
      notify('error', 'Failed to initialize clinical session');
    }
  };

  const handleInputChange = (e: any) => {
    if (isLocked) return;
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  // Auto-save logic
  useEffect(() => {
    if (isDirty && selectedPatient) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(false);
      }, 30000);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formData, isDirty, selectedPatient]);

  const calculateAge = (dob: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    return Math.floor(difference / (1000 * 60 * 60 * 24 * 365.25));
  };

  const markSectionNormal = (section: string) => {
    setIsDirty(true);
    let normalValues: any = {};
    if (section === 'AnteriorSeg') {
      normalValues = {
        as_lids_od: 'Normal', as_lids_os: 'Normal',
        as_conj_od: 'Normal', as_conj_os: 'Normal',
        as_cornea_od: 'Clear', as_cornea_os: 'Clear',
        as_ac_depth_od: 'Normal', as_ac_depth_os: 'Normal',
        as_iris_od: 'Normal', as_iris_os: 'Normal',
        as_lens_od: 'Clear', as_lens_os: 'Clear'
      };
    } else if (section === 'Fundoscopy') {
      normalValues = {
        fs_disc_cdr_od: '0.3', fs_disc_cdr_os: '0.3',
        fs_disc_color_od: 'Normal', fs_disc_color_os: 'Normal',
        fs_disc_margins_od: 'Distinct', fs_disc_margins_os: 'Distinct',
        fs_macula_od: 'Normal', fs_macula_os: 'Normal',
        fs_vessels_nipping_od: 'None', fs_vessels_nipping_os: 'None',
        fs_periph_od: 'Normal', fs_periph_os: 'Normal'
      };
    } else if (section === 'Dilation') {
      normalValues = {
        dil_adequate: 'Adequate',
        dil_od: 'Yes', dil_os: 'Yes'
      };
    }
    
    setFormData((prev: any) => ({
      ...prev,
      ...normalValues
    }));
    notify('success', `${section} marked as normal`);
  };

  const handleSave = async (finalize: boolean = false) => {
     if (!selectedPatient) return;
     
     // Mandatory clinical validation for finalization
     if (finalize) {
       const missing = [];
       if (!formData.complaint || formData.complaint.trim().length < 5) {
         missing.push('Section A: Chief Complaint (min 5 chars)');
       }
       if (!formData.diag_od?.trim() && !formData.diag_os?.trim()) {
         missing.push('Section I: Primary Diagnosis (OD or OS)');
       }

       if (missing.length > 0) {
         notify('error', `Cannot finalize: ${missing.join(', ')} missing.`);
         if (missing[0].includes('Chief Complaint')) setActiveTab('History');
         else setActiveTab('Diagnosis');
         return;
       }
     }

     setIsSaving(true);
      try {
        const payload = {
          patient_id: selectedPatient.patient_id || selectedPatient.id,
          visit_id: selectedPatient.visit_id || (selectedPatient.patient_id ? selectedPatient.id : null),
          ...formData,
          bp: formData.vitals_bp_systolic ? `${formData.vitals_bp_systolic}/${formData.vitals_bp_diastolic}` : '',
          va_od_unaided: formData.va_od_unaided_dv,
          va_os_unaided: formData.va_os_unaided_dv,
          primary_diagnosis: formData.diag_summary || formData.diag_od || (finalize ? '' : 'Pending Diagnosis'),
          clinical_data: formData,
          finalized: finalize,
          finalize: finalize,
          consultant_id: user?.id,
          consultant_name: user?.full_name
        };
        await api.createConsultation(payload);
        
        setSectionStatus((prev: any) => ({ ...prev, [activeTab]: true }));
        setIsDirty(false);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

        notify('success', finalize ? 'Consultation finalized successfully' : 'Clinical progress saved');
        if (finalize) {
          setSelectedPatient(null);
          loadQueue();
        }
     } catch (err: any) {
        notify('error', `Failed to save clinical data: ${err.message || 'Unknown error'}`);
     } finally {
        setIsSaving(false);
     }
  };

  const handleSendBack = async () => {
    if (!selectedPatient) return;
    try {
      await api.updateVisitStatus(selectedPatient.current_visit_id || selectedPatient.visit_id || 0, PatientStatus.WAITING_FOR_TRIAGE, user?.full_name, sendBackNote);
      notify('success', `Patient sent back to Triage`);
      setShowSendBackModal(false);
      setSelectedPatient(null);
      loadQueue();
    } catch (err) {
      notify('error', 'Failed to update patient status');
    }
  };

  const addMedication = () => {
    setFormData((prev: any) => ({
      ...prev,
      plan_meds: [...prev.plan_meds, { drug_name: '', strength: '', route: 'Topical', dose: '', frequency: '', duration: '', instructions: '' }]
    }));
    setIsDirty(true);
  };

  const removeMedication = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      plan_meds: prev.plan_meds.filter((_: any, i: number) => i !== index)
    }));
    setIsDirty(true);
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...formData.plan_meds];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setFormData((prev: any) => ({ ...prev, plan_meds: newMeds }));
    setIsDirty(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'History':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section A: History & Chief Complaint" icon={User} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <ClinicalField label="Chief Complaint" fullWidth>
                <textarea className="clinical-textarea" name="complaint" value={formData.complaint} onChange={handleInputChange} placeholder="Reason for visit..." style={{ height: '120px' }} required disabled={isLocked} />
              </ClinicalField>
              <ClinicalField label="History of Present Illness (HPI)" fullWidth>
                <textarea className="clinical-textarea" name="hpi" value={formData.hpi} onChange={handleInputChange} placeholder="Details of current symptoms..." style={{ height: '150px' }} />
              </ClinicalField>
              <ClinicalField label="Ocular History">
                <textarea className="clinical-textarea" name="ocular_history" value={formData.ocular_history} onChange={handleInputChange} placeholder="Previous conditions, surgeries..." style={{ height: '100px' }} />
              </ClinicalField>
              <ClinicalField label="Medical/Systemic History">
                <textarea className="clinical-textarea" name="medical_history" value={formData.medical_history} onChange={handleInputChange} placeholder="DM, Hypertension, etc..." style={{ height: '100px' }} />
              </ClinicalField>
              <ClinicalField label="Drug History">
                <textarea className="clinical-textarea" name="drug_history" value={formData.drug_history} onChange={handleInputChange} placeholder="Current medications..." style={{ height: '100px' }} />
              </ClinicalField>
              <ClinicalField label="Allergies">
                <textarea className="clinical-textarea" name="allergies" value={formData.allergies} onChange={handleInputChange} placeholder="Allergic reactions..." style={{ height: '100px', border: formData.allergies ? '2px solid var(--leh-red)' : '' }} />
              </ClinicalField>
              <ClinicalField label="Family History" fullWidth>
                <textarea className="clinical-textarea" name="family_history" value={formData.family_history} onChange={handleInputChange} placeholder="Hereditary conditions..." style={{ height: '80px' }} />
              </ClinicalField>
            </div>
          </div>
        );
      case 'Vitals':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section B: Vital Signs Review" icon={Activity} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <ClinicalField label="BP Systolic (mmHg)">
                <input className="clinical-input" name="vitals_bp_systolic" value={formData.vitals_bp_systolic} onChange={handleInputChange} />
              </ClinicalField>
              <ClinicalField label="BP Diastolic (mmHg)">
                <input className="clinical-input" name="vitals_bp_diastolic" value={formData.vitals_bp_diastolic} onChange={handleInputChange} />
              </ClinicalField>
              <ClinicalField label="Pulse Rate (bpm)">
                <input className="clinical-input" name="vitals_pulse" value={formData.vitals_pulse} onChange={handleInputChange} />
              </ClinicalField>
              <ClinicalField label="Temperature (°C)">
                <input className="clinical-input" name="vitals_temp" value={formData.vitals_temp} onChange={handleInputChange} />
              </ClinicalField>
              <ClinicalField label="Weight (kg)">
                <input className="clinical-input" name="vitals_weight" value={formData.vitals_weight} onChange={handleInputChange} />
              </ClinicalField>
            </div>
          </div>
        );
      case 'Vision':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section C: Visual Acuity" icon={Eye} onSave={() => handleSave(false)} />
            <div style={{ marginBottom: '24px' }}>
               <ClinicalField label="Acuity Measurement Method">
                  <select className="clinical-input" name="va_method" value={formData.va_method} onChange={handleInputChange}>
                     <option>Snellen Chart</option>
                     <option>LogMAR</option>
                     <option>Allen Pictures</option>
                     <option>LEA Symbols</option>
                  </select>
               </ClinicalField>
            </div>
            <ODSideBySide label="DV UNAIDED" 
              childrenOD={<select className="clinical-input" name="va_od_unaided_dv" value={formData.va_od_unaided_dv} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>}
              childrenOS={<select className="clinical-input" name="va_os_unaided_dv" value={formData.va_os_unaided_dv} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>}
            />
            <ODSideBySide label="NV UNAIDED" 
              childrenOD={<select className="clinical-input" name="va_od_unaided_nv" value={formData.va_od_unaided_nv} onChange={handleInputChange}><option value="">Select</option>{['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48'].map(o => <option key={o} value={o}>{o}</option>)}</select>}
              childrenOS={<select className="clinical-input" name="va_os_unaided_nv" value={formData.va_os_unaided_nv} onChange={handleInputChange}><option value="">Select</option>{['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48'].map(o => <option key={o} value={o}>{o}</option>)}</select>}
            />
            <ODSideBySide label="PINHOLE" 
              childrenOD={<select className="clinical-input" name="va_od_ph" value={formData.va_od_ph} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>}
              childrenOS={<select className="clinical-input" name="va_os_ph" value={formData.va_os_ph} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>}
            />
            <ODSideBySide label="DV AIDED (Current Glasses)" 
              childrenOD={<select className="clinical-input" name="va_od_aided_dv" value={formData.va_od_aided_dv} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>}
              childrenOS={<select className="clinical-input" name="va_os_aided_dv" value={formData.va_os_aided_dv} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>}
            />
          </div>
        );
      case 'IOP':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section D: Intraocular Pressure" icon={Target} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              <ClinicalField label="IOP OD (mmHg)">
                <input 
                  className="clinical-input" 
                  type="number" 
                  name="iop_od" 
                  value={formData.iop_od} 
                  onChange={handleInputChange} 
                  style={{ border: formData.iop_od > 21 ? '2px solid #dc2626' : '', background: formData.iop_od > 21 ? '#fef2f2' : '' }}
                />
                {formData.iop_od > 21 && <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: '800' }}>⚠️ ELEVATED IOP</span>}
              </ClinicalField>
              <ClinicalField label="IOP OS (mmHg)">
                <input 
                  className="clinical-input" 
                  type="number" 
                  name="iop_os" 
                  value={formData.iop_os} 
                  onChange={handleInputChange} 
                  style={{ border: formData.iop_os > 21 ? '2px solid #dc2626' : '', background: formData.iop_os > 21 ? '#fef2f2' : '' }}
                />
                {formData.iop_os > 21 && <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: '800' }}>⚠️ ELEVATED IOP</span>}
              </ClinicalField>
              <ClinicalField label="Method">
                <select className="clinical-input" name="iop_method" value={formData.iop_method} onChange={handleInputChange}>
                  <option>Non-contact Tonometer</option>
                  <option>Goldmann Applanation</option>
                  <option>Icare Tonometer</option>
                  <option>Digital Palpation</option>
                  <option>Schiotz Tonometer</option>
                </select>
              </ClinicalField>
              <ClinicalField label="Time of Measurement">
                <input className="clinical-input" type="time" name="iop_time" value={formData.iop_time} onChange={handleInputChange} />
              </ClinicalField>
              <ClinicalField label="IOP Notes" fullWidth>
                <textarea className="clinical-textarea" name="iop_notes" value={formData.iop_notes} onChange={handleInputChange} placeholder="Asymmetry, corneal thickness corrections..." style={{ height: '80px' }} />
              </ClinicalField>
            </div>
          </div>
        );
      case 'Refraction':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section E: Refraction (Objective/Subjective)" icon={Glasses} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gap: '24px' }}>
              <ODSideBySide label="REFRACTION" 
                childrenOD={
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <ClinicalField label="SPH"><input className="clinical-input" name="ref_od_sph" value={formData.ref_od_sph} onChange={handleInputChange} /></ClinicalField>
                    <ClinicalField label="CYL"><input className="clinical-input" name="ref_od_cyl" value={formData.ref_od_cyl} onChange={handleInputChange} /></ClinicalField>
                    <ClinicalField label="AXIS"><input className="clinical-input" name="ref_od_axis" value={formData.ref_od_axis} onChange={handleInputChange} /></ClinicalField>
                    <ClinicalField label="VA"><select className="clinical-input" name="ref_od_va" value={formData.ref_od_va} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    <ClinicalField label="ADD"><input className="clinical-input" name="ref_od_near_add" value={formData.ref_od_near_add} onChange={handleInputChange} /></ClinicalField>
                  </div>
                }
                childrenOS={
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <ClinicalField label="SPH"><input className="clinical-input" name="ref_os_sph" value={formData.ref_os_sph} onChange={handleInputChange} /></ClinicalField>
                    <ClinicalField label="CYL"><input className="clinical-input" name="ref_os_cyl" value={formData.ref_os_cyl} onChange={handleInputChange} /></ClinicalField>
                    <ClinicalField label="AXIS"><input className="clinical-input" name="ref_os_axis" value={formData.ref_os_axis} onChange={handleInputChange} /></ClinicalField>
                    <ClinicalField label="VA"><select className="clinical-input" name="ref_os_va" value={formData.ref_os_va} onChange={handleInputChange}><option value="">Select</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    <ClinicalField label="ADD"><input className="clinical-input" name="ref_os_near_add" value={formData.ref_os_near_add} onChange={handleInputChange} /></ClinicalField>
                  </div>
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                <ClinicalField label="PD (mm)"><input className="clinical-input" name="ref_pd" value={formData.ref_pd} onChange={handleInputChange} /></ClinicalField>
                <ClinicalField label="Refraction Notes" fullWidth>
                  <textarea className="clinical-textarea" name="ref_notes" value={formData.ref_notes} onChange={handleInputChange} placeholder="Cycloplegic refraction details..." style={{ height: '80px' }} />
                </ClinicalField>
              </div>
            </div>
          </div>
        );
      case 'AnteriorSeg':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section F: Anterior Segment / Slit Lamp" icon={Eye} onMarkNormal={() => markSectionNormal('AnteriorSeg')} onSave={() => handleSave(false)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
               <ODSideBySide label="LIDS/LASHES" 
                 childrenOD={<input className="clinical-input" name="as_lids_od" value={formData.as_lids_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="as_lids_os" value={formData.as_lids_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="CONJUNCTIVA/SCLERA" 
                 childrenOD={<input className="clinical-input" name="as_conj_od" value={formData.as_conj_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="as_conj_os" value={formData.as_conj_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="CORNEA" 
                 childrenOD={<input className="clinical-input" name="as_cornea_od" value={formData.as_cornea_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="as_cornea_os" value={formData.as_cornea_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="AC DEPTH" 
                 childrenOD={<select className="clinical-input" name="as_ac_depth_od" value={formData.as_ac_depth_od} onChange={handleInputChange}><option>Normal</option><option>Shallow</option><option>Deep</option></select>}
                 childrenOS={<select className="clinical-input" name="as_ac_depth_os" value={formData.as_ac_depth_os} onChange={handleInputChange}><option>Normal</option><option>Shallow</option><option>Deep</option></select>}
               />
               <ODSideBySide label="IRIS/PUPIL" 
                 childrenOD={<input className="clinical-input" name="as_iris_od" value={formData.as_iris_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="as_iris_os" value={formData.as_iris_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="LENS" 
                 childrenOD={<input className="clinical-input" name="as_lens_od" value={formData.as_lens_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="as_lens_os" value={formData.as_lens_os} onChange={handleInputChange} />}
               />
               <ClinicalField label="Additional Anterior Segment Notes" fullWidth>
                  <textarea className="clinical-textarea" name="as_comments" value={formData.as_comments} onChange={handleInputChange} placeholder="Vitreous face, pigments, etc..." style={{ height: '100px' }} />
               </ClinicalField>
            </div>
          </div>
        );
      case 'Dilation':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section G: Dilation" icon={Droplets} onMarkNormal={() => markSectionNormal('Dilation')} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
               <ODSideBySide label="DILATED?" 
                 childrenOD={<select className="clinical-input" name="dil_od" value={formData.dil_od} onChange={handleInputChange}><option value="No">No</option><option value="Yes">Yes</option></select>}
                 childrenOS={<select className="clinical-input" name="dil_os" value={formData.dil_os} onChange={handleInputChange}><option value="No">No</option><option value="Yes">Yes</option></select>}
               />
               
               {(formData.dil_od === 'Yes' || formData.dil_os === 'Yes') && (
                 <>
                   <ClinicalField label="Dilating Agent">
                      <select className="clinical-input" name="dil_agent" value={formData.dil_agent} onChange={handleInputChange}>
                         <option>Tropicamide 1%</option>
                         <option>Phenylephrine 2.5%</option>
                         <option>Cyclopentolate 1%</option>
                         <option>Atropine 1%</option>
                      </select>
                   </ClinicalField>
                   <ClinicalField label="Adequacy">
                      <select className="clinical-input" name="dil_adequate" value={formData.dil_adequate} onChange={handleInputChange}>
                         <option>Adequate</option>
                         <option>Inadequate</option>
                      </select>
                   </ClinicalField>
                   <ODSideBySide label="TIME" 
                     childrenOD={<input className="clinical-input" type="time" name="dil_time_od" value={formData.dil_time_od} onChange={handleInputChange} disabled={formData.dil_od !== 'Yes'} />}
                     childrenOS={<input className="clinical-input" type="time" name="dil_time_os" value={formData.dil_time_os} onChange={handleInputChange} disabled={formData.dil_os !== 'Yes'} />}
                   />
                 </>
               )}
               
               <ClinicalField label="Post-Dilation Notes" fullWidth>
                  <textarea className="clinical-textarea" name="dil_notes" value={formData.dil_notes} onChange={handleInputChange} placeholder="Adverse reactions, poor response..." style={{ height: '80px' }} />
               </ClinicalField>
            </div>
          </div>
        );
      case 'Fundoscopy':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section H: Fundoscopy" icon={Eye} onMarkNormal={() => markSectionNormal('Fundoscopy')} onSave={() => handleSave(false)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
               <ODSideBySide label="OPTIC DISC (CDR)" 
                 childrenOD={<input className="clinical-input" name="fs_disc_cdr_od" value={formData.fs_disc_cdr_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="fs_disc_cdr_os" value={formData.fs_disc_cdr_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="MACULA" 
                 childrenOD={<input className="clinical-input" name="fs_macula_od" value={formData.fs_macula_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="fs_macula_os" value={formData.fs_macula_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="VESSELS (A/V Ratio)" 
                 childrenOD={<input className="clinical-input" name="fs_vessels_av_od" value={formData.fs_vessels_av_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="fs_vessels_av_os" value={formData.fs_vessels_av_os} onChange={handleInputChange} />}
               />
               <ODSideBySide label="PERIPHERY" 
                 childrenOD={<input className="clinical-input" name="fs_periph_od" value={formData.fs_periph_od} onChange={handleInputChange} />}
                 childrenOS={<input className="clinical-input" name="fs_periph_os" value={formData.fs_periph_os} onChange={handleInputChange} />}
               />
               <ClinicalField label="Fundoscopy Summary" fullWidth>
                  <textarea className="clinical-textarea" name="fs_summary" value={formData.fs_summary} onChange={handleInputChange} placeholder="Overall posterior pole assessment..." style={{ height: '100px' }} />
               </ClinicalField>
            </div>
          </div>
        );
      case 'Diagnosis':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section I: Clinical Diagnosis" icon={Target} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
               <ClinicalField label="Primary Diagnosis OD">
                  <select className="clinical-input" name="diag_od" value={formData.diag_od} onChange={handleInputChange}>
                     <option value="">Select Diagnosis</option>
                     {DIAGNOSIS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
               </ClinicalField>
               <ClinicalField label="Primary Diagnosis OS">
                  <select className="clinical-input" name="diag_os" value={formData.diag_os} onChange={handleInputChange}>
                     <option value="">Select Diagnosis</option>
                     {DIAGNOSIS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
               </ClinicalField>
               <ClinicalField label="Secondary Diagnoses" fullWidth>
                  <textarea className="clinical-textarea" name="diag_secondary" value={formData.diag_secondary} onChange={handleInputChange} placeholder="List co-morbidities..." style={{ height: '80px' }} />
               </ClinicalField>
               <ClinicalField label="Diagnostic Summary / Impression" fullWidth>
                  <textarea className="clinical-textarea" name="diag_summary" value={formData.diag_summary} onChange={handleInputChange} placeholder="Clinical conclusion..." style={{ height: '120px' }} />
               </ClinicalField>
            </div>
          </div>
        );
      case 'Plan':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section J: Treatment Plan" icon={Pill} onSave={() => handleSave(false)} />
            
            {/* Medications */}
            <div style={{ marginBottom: '40px' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-primary)' }}>MEDICATION PRESCRIPTION</h3>
                  <button className="leh-btn-outline" onClick={addMedication} style={{ height: '32px', padding: '0 12px' }}>
                    <Plus size={14} /> ADD DRUG
                  </button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {formData.plan_meds.length === 0 && <p style={{ textAlign: 'center', padding: '24px', background: 'var(--leh-bg-light)', borderRadius: '12px', fontSize: '13px', color: 'var(--leh-text-muted)' }}>No medications prescribed.</p>}
                  {formData.plan_meds.map((med: Medication, idx: number) => (
                     <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', padding: '16px', background: 'white', border: '1px solid var(--leh-border-light)', borderRadius: '12px' }} className="medication-terminal-row">
                        <ClinicalField label="Drug Name"><input className="clinical-input" value={med.drug_name} onChange={(e) => updateMedication(idx, 'drug_name', e.target.value)} placeholder="e.g. G. Timolol" /></ClinicalField>
                        <ClinicalField label="Dose/Freq"><input className="clinical-input" value={med.dose} onChange={(e) => updateMedication(idx, 'dose', e.target.value)} placeholder="e.g. 1 drop BD" /></ClinicalField>
                        <ClinicalField label="Duration"><input className="clinical-input" value={med.duration} onChange={(e) => updateMedication(idx, 'duration', e.target.value)} placeholder="e.g. 1 month" /></ClinicalField>
                        <ClinicalField label="Route">
                           <select className="clinical-input" value={med.route} onChange={(e) => updateMedication(idx, 'route', e.target.value)}>
                              <option>Topical</option><option>Oral</option><option>Injection</option>
                           </select>
                        </ClinicalField>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                           <button onClick={() => removeMedication(idx)} style={{ height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff1f2', color: '#e11d48', border: 'none', borderRadius: '10px' }}>
                              <Trash2 size={18} />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* Glasses Prescription */}
            <div style={{ padding: '24px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
               <h3 style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-primary)', marginBottom: '16px' }}>GLASSES PRESCRIPTION</h3>
               <ODSideBySide label="FINAL PRESCRIPTION" 
                 childrenOD={
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input className="clinical-input" placeholder="SPH" value={formData.plan_glasses_od.sph} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, sph: e.target.value } }))} />
                      <input className="clinical-input" placeholder="CYL" value={formData.plan_glasses_od.cyl} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, cyl: e.target.value } }))} />
                      <input className="clinical-input" placeholder="AXIS" value={formData.plan_glasses_od.axis} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, axis: e.target.value } }))} />
                   </div>
                 }
                 childrenOS={
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input className="clinical-input" placeholder="SPH" value={formData.plan_glasses_os.sph} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_os: { ...prev.plan_glasses_os, sph: e.target.value } }))} />
                      <input className="clinical-input" placeholder="CYL" value={formData.plan_glasses_os.cyl} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_os: { ...prev.plan_glasses_os, cyl: e.target.value } }))} />
                      <input className="clinical-input" placeholder="AXIS" value={formData.plan_glasses_os.axis} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_os: { ...prev.plan_glasses_os, axis: e.target.value } }))} />
                   </div>
                 }
               />
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: '16px' }}>
                  <ClinicalField label="Near Add"><input className="clinical-input" value={formData.plan_glasses_od.add} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, add: e.target.value }, plan_glasses_os: { ...prev.plan_glasses_os, add: e.target.value } }))} /></ClinicalField>
                  <ClinicalField label="PD (mm)"><input className="clinical-input" value={formData.plan_glasses_pd} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_pd: e.target.value }))} /></ClinicalField>
                  <ClinicalField label="Lens Type"><input className="clinical-input" value={formData.plan_lens_type} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_lens_type: e.target.value }))} placeholder="e.g. Bifocal, Photochromic" /></ClinicalField>
               </div>
            </div>
          </div>
        );
      case 'Notes':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section K: Clinical Notes & Follow-up" icon={ClipboardList} onSave={() => handleSave(false)} />
            <div style={{ display: 'grid', gap: '32px' }}>
               <ClinicalField label="Detailed Clinical Notes" fullWidth>
                  <textarea className="clinical-textarea" name="notes_clinical" value={formData.notes_clinical} onChange={handleInputChange} placeholder="Internal observations, advice given..." style={{ height: '200px' }} />
               </ClinicalField>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <ClinicalField label="Follow-up Date">
                    <input className="leh-date-input" type="date" name="plan_followup_date" value={formData.plan_followup_date} onChange={handleInputChange} />
                  </ClinicalField>
                  <ClinicalField label="Clinic / Specialty">
                     <select className="clinical-input" name="notes_followup_clinic" value={formData.notes_followup_clinic} onChange={handleInputChange}>
                        <option>General Eye Clinic</option><option>Glaucoma Clinic</option><option>Retina Clinic</option><option>Pediatric Clinic</option><option>Cornea Clinic</option>
                     </select>
                  </ClinicalField>
               </div>
            </div>
          </div>
        );
      case 'Surgery':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section L: Surgery Flag" icon={Scissors} onSave={() => handleSave(false)} />
            <div style={{ padding: '32px', background: formData.surgery_advised ? '#fff1f2' : 'white', borderRadius: '24px', border: formData.surgery_advised ? '2px solid #e11d48' : '1px solid var(--leh-border-light)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <input type="checkbox" checked={formData.surgery_advised} onChange={(e) => setFormData((prev: any) => ({ ...prev, surgery_advised: e.target.checked }))} style={{ width: '24px', height: '24px' }} disabled={isLocked} />
                  <span style={{ fontSize: '16px', fontWeight: '900', color: formData.surgery_advised ? '#e11d48' : 'var(--leh-text-dark)' }}>SURGERY ADVISED?</span>
               </div>
               
               {formData.surgery_advised && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <ClinicalField label="Surgery Type">
                       <input className="clinical-input" name="surgery_type" value={formData.surgery_type} onChange={handleInputChange} placeholder="e.g. Phaco + IOL" disabled={isLocked} />
                    </ClinicalField>
                    <ClinicalField label="Eye Side">
                       <select className="clinical-input" name="surgery_side" value={formData.surgery_side} onChange={handleInputChange} disabled={isLocked}>
                          <option>Right Eye (OD)</option><option>Left Eye (OS)</option><option>Both Eyes (OU)</option>
                       </select>
                    </ClinicalField>
                    <ClinicalField label="Urgency">
                       <select className="clinical-input" name="surgery_urgency" value={formData.surgery_urgency} onChange={handleInputChange} disabled={isLocked}>
                          <option>Elective</option><option>Urgent</option><option>Emergency</option>
                       </select>
                    </ClinicalField>
                    <ClinicalField label="Surgery Notes" fullWidth>
                       <textarea className="clinical-textarea" name="surgery_notes" value={formData.surgery_notes} onChange={handleInputChange} placeholder="Pre-op requirements, risks discussed..." style={{ height: '100px' }} disabled={isLocked} />
                    </ClinicalField>
                 </div>
               )}
            </div>

            <div style={{ marginTop: '32px', padding: '32px', background: formData.admission_advised ? '#eff6ff' : 'white', borderRadius: '24px', border: formData.admission_advised ? '2px solid var(--leh-primary)' : '1px solid var(--leh-border-light)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <input type="checkbox" checked={formData.admission_advised} onChange={(e) => setFormData((prev: any) => ({ ...prev, admission_advised: e.target.checked }))} style={{ width: '24px', height: '24px' }} disabled={isLocked} />
                  <span style={{ fontSize: '16px', fontWeight: '900', color: formData.admission_advised ? 'var(--leh-primary)' : 'var(--leh-text-dark)' }}>ADMISSION ADVISED?</span>
               </div>
               
               {formData.admission_advised && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <ClinicalField label="Reason for Admission" fullWidth>
                       <textarea className="clinical-textarea" name="admission_reason" value={formData.admission_reason} onChange={handleInputChange} placeholder="Specific condition requiring inpatient care..." style={{ height: '100px' }} disabled={isLocked} />
                    </ClinicalField>
                    <ClinicalField label="Admission Urgency">
                       <select className="clinical-input" name="admission_urgency" value={formData.admission_urgency} onChange={handleInputChange} disabled={isLocked}>
                          <option>Routine</option><option>Urgent</option><option>Emergency</option>
                       </select>
                    </ClinicalField>
                 </div>
               )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="leh-page-container" style={{ padding: 0, height: 'calc(100vh - 80px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* ZONE 1: PATIENT CONTEXT BAR */}
      {selectedPatient && (
        <div style={{ background: 'white', borderBottom: '1px solid var(--leh-border-light)', padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }} className="no-print">
           <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--leh-text-dark)' }}>{selectedPatient.full_name.toUpperCase()}</span>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                    <span className={`leh-status-badge ${selectedPatient.gender === 'Male' ? 'blue' : 'red'}`} style={{ fontSize: '10px' }}>{selectedPatient.gender.toUpperCase()}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--leh-text-muted)' }}>FILE: #{selectedPatient.id}</span>
                 </div>
              </div>
              <div style={{ width: '1px', height: '32px', background: 'var(--leh-border-light)' }}></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '32px' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="leh-label" style={{ fontSize: '9px', fontWeight: '900', color: 'var(--leh-text-light)' }}>DOB</span>
                    <span style={{ fontSize: '13px', fontWeight: '800' }}>{new Date(selectedPatient.dob).toLocaleDateString()}</span>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="leh-label" style={{ fontSize: '9px', fontWeight: '900', color: 'var(--leh-text-light)' }}>AGE</span>
                    <span style={{ fontSize: '13px', fontWeight: '800' }}>{calculateAge(selectedPatient.dob)} YRS</span>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="leh-label" style={{ fontSize: '9px', fontWeight: '900', color: 'var(--leh-text-light)' }}>CLINICIAN</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--leh-primary)' }}>{user?.full_name || 'SYSTEM'}</span>
                 </div>
              </div>
           </div>
           <div style={{ display: 'flex', gap: '12px' }}>
             <button className="leh-btn-outline" onClick={() => setShowSendBackModal(true)}>SEND BACK</button>
             <button className="leh-btn-outline" onClick={() => setSelectedPatient(null)} style={{ height: '36px', padding: '0 12px' }}>
                <X size={16} />
                <span style={{ fontSize: '11px' }}>EXIT</span>
             </button>
           </div>
        </div>
      )}

      {/* ZONE 2: WORKSPACE HEADER */}
      {selectedPatient && (
        <div style={{ padding: '14px 32px', background: '#f8fafc', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }} className="no-print">
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="leh-btn-outline" onClick={() => setShowTriageModal(true)} style={{ background: 'white' }}>
                 <HistoryIcon size={16} />
                 <span style={{ fontSize: '11px' }}>VIEW TRIAGE</span>
              </button>
              <button className="leh-btn-outline" onClick={() => {
                notify('info', 'Preparing print layout...');
                setTimeout(window.print, 500);
              }} style={{ background: 'white' }}>
                 <Printer size={16} />
                 <span style={{ fontSize: '11px' }}>PRINT SUMMARY</span>
              </button>
              <button className="leh-btn-outline" onClick={() => {
                notify('info', 'Generating PDF Document...');
                setTimeout(window.print, 500);
              }} style={{ background: 'white' }}>
                 <Download size={16} />
                 <span style={{ fontSize: '11px' }}>DOWNLOAD PDF</span>
              </button>
           </div>
           <div style={{ display: 'flex', gap: '12px' }}>
             <button 
               className="leh-btn-primary" 
               onClick={() => handleSave(false)} 
               disabled={isSaving}
               style={{ background: 'var(--leh-green)', height: '40px' }}
             >
                <Save size={18} />
                <span>SAVE DRAFT</span>
             </button>
             <button 
               className="leh-btn-primary" 
               onClick={() => { if (window.confirm('Finalize this clinical visit? Finalized visits move to payment/pharmacy.')) { handleSave(true); } }} 
               disabled={isSaving}
               style={{ background: 'var(--leh-primary)', minWidth: '180px' }}
             >
                {isSaving ? <RefreshCcw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                <span>{isSaving ? 'FINALIZING...' : 'FINALIZE VISIT'}</span>
             </button>
           </div>
        </div>
      )}

      {/* ZONE 3: TWO-PANEL WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 25%) 1fr', flex: 1, overflow: 'hidden' }} className="no-print">
        
        {/* LEFT PANEL: NAVIGATION */}
        <div style={{ background: 'white', borderRight: '1px solid var(--leh-border-light)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
           {!selectedPatient ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                 <div style={{ padding: '24px', borderBottom: '1px solid var(--leh-border-light)' }}>
                    <div className="leh-search-box">
                      <Search size={18} className="leh-search-icon" />
                      <input
                        placeholder="Search queue..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        spellCheck={false}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="leh-search-clear" type="button">
                          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
                        </button>
                      )}
                    </div>
                 </div>
                 <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    {patients
                      .filter(p => p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort((a, b) => new Date(a.visit_date || 0).getTime() - new Date(b.visit_date || 0).getTime())
                      .map(p => (
                       <div key={p.id} className="leh-table-row" style={{ padding: '20px 24px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--leh-bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: 'var(--leh-primary)' }}>{p.full_name?.[0]}</div>
                          <div style={{ flex: 1 }}>
                             <div style={{ fontWeight: '800', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               {p.full_name}
                               <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--leh-text-muted)', background: 'var(--leh-bg-light)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <Clock size={10} /> 
                                 {formatDateStandard(p.visit_date)} • {new Date(p.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                             </div>
                             <div style={{ fontSize: '10px', color: 'var(--leh-text-muted)', fontWeight: '700', marginTop: '2px' }}>#{p.file_number || p.patient_id || p.id} • {calculateAge(p.dob)}Y • {p.gender}</div>
                             {p.complaint && <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--leh-primary)', marginTop: '4px' }}>"{p.complaint}"</div>}
                          </div>
                          <button 
                            className="leh-btn-primary" 
                            style={{ height: '32px', padding: '0 16px', fontSize: '11px', background: 'var(--leh-primary)' }}
                            onClick={() => handlePatientSelect(p)}
                          >START</button>
                       </div>
                    ))}
                 </div>
              </div>
           ) : (
              <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                 <h3 style={{ fontSize: '10px', fontWeight: '900', color: 'var(--leh-text-muted)', margin: '0 12px 16px', letterSpacing: '0.1em' }}>CLINICAL SECTIONS (PRD 6.5)</h3>
                 {menuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isDirty) {
                          // Optional: Auto-save on tab change? 
                          // The requirement says "show warning and auto-save after 30s inactivity"
                        }
                        setActiveTab(item.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: activeTab === item.id ? 'var(--leh-primary)' : 'transparent',
                        color: activeTab === item.id ? 'white' : 'var(--leh-text-dark)',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                       <item.icon size={18} style={{ opacity: activeTab === item.id ? 1 : 0.6 }} />
                       <span style={{ fontSize: '12px', fontWeight: '700', flex: 1 }}>{item.label}</span>
                       {sectionStatus[item.id] && <CheckCircle2 size={14} style={{ color: activeTab === item.id ? 'white' : 'var(--leh-green)' }} />}
                    </button>
                 ))}
                 <div style={{ marginTop: 'auto', padding: '20px 12px', borderTop: '1px solid var(--leh-border-light)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                     <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-text-muted)' }}>PROGRESS</span>
                     <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--leh-primary)' }}>
                       {Object.values(sectionStatus).filter(Boolean).length} / 12 SECTIONS
                     </span>
                   </div>
                   <div style={{ height: '6px', background: 'var(--leh-bg-light)', borderRadius: '3px', overflow: 'hidden' }}>
                     <div style={{ height: '100%', width: `${(Object.values(sectionStatus).filter(Boolean).length / 12) * 100}%`, background: 'var(--leh-primary)', transition: 'width 0.3s ease' }}></div>
                   </div>
                 </div>
              </div>
           )}
        </div>

        {/* RIGHT PANEL: WORKSPACE */}
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '32px' }}>
            {!selectedPatient ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <Stethoscope size={64} style={{ color: 'var(--leh-border)', marginBottom: '24px' }} />
                <h2 style={{ fontSize: '24px', fontWeight: '900' }}>Select Patient to Begin</h2>
                <p style={{ color: 'var(--leh-text-muted)', maxWidth: '400px', marginTop: '12px' }}>Choose a patient from the queue on the left to start their clinical consultation.</p>
              </div>
            ) : (
               <div className="leh-table-card animate-slide-up" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', minHeight: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', borderRadius: '24px', border: '1px solid white' }}>
                {isDirty && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', marginBottom: '24px', color: '#92400e', fontSize: '12px', fontWeight: '700' }} className="animate-fade-in">
                    <AlertTriangle size={16} />
                    <span>You have unsaved changes in this section. Progress will auto-save in 30s.</span>
                  </div>
                )}
                {renderTabContent()}
              </div>
            )}
          </div>
      </div>

      {/* HIGH-FIDELITY PRINT AREA (Sections A-L) */}
      <div id="print-area" className="print-only" style={{ padding: '40px', color: '#000', fontFamily: '"Inter", sans-serif', width: '210mm', minHeight: '297mm', margin: '0 auto', background: 'white' }}>
        {selectedPatient && (
          <>
            {/* DOCUMENT HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
              <h1 style={{ fontSize: '28px', margin: '0 0 5px 0', fontWeight: '900', letterSpacing: '-0.5px' }}>LUNA EYE HOSPITAL</h1>
              <p style={{ fontSize: '12px', margin: '2px 0', fontWeight: '600' }}>13A, Behind Bomas Supermarket, Old Airport Road, Minna</p>
              <p style={{ fontSize: '12px', margin: '2px 0' }}>Phone: 09044687558 | WhatsApp: 09114111418</p>
              <p style={{ fontSize: '12px', margin: '2px 0' }}>Email: lunaeyehospital@gmail.com</p>
            </div>

            {/* DOCUMENT TITLE BLOCK */}
            <div style={{ marginBottom: '25px' }}>
              <h2 style={{ fontSize: '18px', textAlign: 'center', margin: '0 0 15px 0', fontWeight: '900', textDecoration: 'underline' }}>CONSULTATION SUMMARY REPORT</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '12px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                <div>
                  <p style={{ margin: '3px 0' }}><strong>Patient Name:</strong> {selectedPatient.full_name}</p>
                  <p style={{ margin: '3px 0' }}><strong>File No:</strong> #{selectedPatient.file_number || selectedPatient.id}</p>
                  <p style={{ margin: '3px 0' }}><strong>Gender / DOB:</strong> {selectedPatient.gender} / {formatDateStandard(selectedPatient.dob)}</p>
                  <p style={{ margin: '3px 0' }}><strong>Age:</strong> {calculateAge(selectedPatient.dob)} Yrs</p>
                </div>
                <div>
                  <p style={{ margin: '3px 0' }}><strong>Visit Date:</strong> {formatDateStandard(selectedPatient.visit_date || selectedPatient.checkin_at)}</p>
                  <p style={{ margin: '3px 0' }}><strong>Visit ID:</strong> #{selectedPatient.visit_id || selectedPatient.id}</p>
                  <p style={{ margin: '3px 0' }}><strong>Attending Clinician:</strong> {user?.full_name}</p>
                  <p style={{ margin: '3px 0' }}><strong>Print Date:</strong> {formatDateTimeStandard(new Date())}</p>
                </div>
              </div>
            </div>

            {/* DOCUMENT BODY - SECTIONS A-L */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section A: History */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>A. CHIEF COMPLAINT AND HISTORY</h3>
                <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                  <p><strong>Chief Complaint:</strong> {formData.complaint || 'N/A'}</p>
                  {formData.hpi && <p><strong>HPI:</strong> {formData.hpi}</p>}
                  {formData.ocular_history && <p><strong>Past Ocular:</strong> {formData.ocular_history}</p>}
                  {formData.medical_history && <p><strong>Medical/Systemic:</strong> {formData.medical_history}</p>}
                  {formData.allergies && <p style={{ color: '#dc2626' }}><strong>ALLERGIES:</strong> {formData.allergies}</p>}
                </div>
              </div>

              {/* Section B: Vitals */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>B. VITAL SIGNS</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', fontSize: '11px' }}>
                  <div><strong>BP:</strong> {formData.vitals_bp_systolic}/{formData.vitals_bp_diastolic}</div>
                  <div><strong>Pulse:</strong> {formData.vitals_pulse} bpm</div>
                  <div><strong>Temp:</strong> {formData.vitals_temp} °C</div>
                  <div><strong>Weight:</strong> {formData.vitals_weight} kg</div>
                </div>
              </div>

              {/* Section C: Visual Acuity */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>C. VISUAL ACUITY ({formData.va_method})</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'left' }}>EYE</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'left' }}>UNAIDED (DV)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'left' }}>UNAIDED (NV)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'left' }}>PH</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'left' }}>AIDED (DV)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>OD (Right)</strong></td>
                      <td>{formData.va_od_unaided_dv}</td><td>{formData.va_od_unaided_nv}</td><td>{formData.va_od_ph}</td><td>{formData.va_od_aided_dv}</td>
                    </tr>
                    <tr>
                      <td><strong>OS (Left)</strong></td>
                      <td>{formData.va_os_unaided_dv}</td><td>{formData.va_os_unaided_nv}</td><td>{formData.va_os_ph}</td><td>{formData.va_os_aided_dv}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section D: IOP */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>D. IOP ({formData.iop_method})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '11px' }}>
                   <div><strong>OD:</strong> {formData.iop_od} mmHg</div>
                   <div><strong>OS:</strong> {formData.iop_os} mmHg</div>
                </div>
              </div>

              {/* Section E: Refraction */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>E. REFRACTION</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px' }}>EYE</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px' }}>SPH</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px' }}>CYL</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px' }}>AXIS</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '6px' }}>VA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>OD</strong></td><td>{formData.ref_od_sph}</td><td>{formData.ref_od_cyl}</td><td>{formData.ref_od_axis}</td><td>{formData.ref_od_va}</td>
                    </tr>
                    <tr>
                      <td><strong>OS</strong></td><td>{formData.ref_os_sph}</td><td>{formData.ref_os_cyl}</td><td>{formData.ref_os_axis}</td><td>{formData.ref_os_va}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section F: Anterior Segment */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>F. ANTERIOR SEGMENT</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '10px' }}>
                  <div style={{ border: '1px solid #eee', padding: '8px' }}>
                    <p><strong>OD:</strong> Lids: {formData.as_lids_od}, Conj: {formData.as_conj_od}, Cornea: {formData.as_cornea_od}, AC: {formData.as_ac_depth_od}, Iris: {formData.as_iris_od}, Lens: {formData.as_lens_od}</p>
                  </div>
                  <div style={{ border: '1px solid #eee', padding: '8px' }}>
                    <p><strong>OS:</strong> Lids: {formData.as_lids_os}, Conj: {formData.as_conj_os}, Cornea: {formData.as_cornea_os}, AC: {formData.as_ac_depth_os}, Iris: {formData.as_iris_os}, Lens: {formData.as_lens_os}</p>
                  </div>
                </div>
              </div>

              {/* Section G: Dilation */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>G. DILATION</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', fontSize: '11px' }}>
                  <div><strong>Adequacy:</strong> {formData.dil_adequate}</div>
                  <div><strong>OD Dilated:</strong> {formData.dil_od}</div>
                  <div><strong>OS Dilated:</strong> {formData.dil_os}</div>
                </div>
                {formData.dil_agent && <p style={{ fontSize: '11px', margin: '5px 0' }}><strong>Agent:</strong> {formData.dil_agent} ({formData.dil_time})</p>}
              </div>

              {/* Section H: Fundoscopy / Posterior Segment */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>H. FUNDOSCOPY</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '10px' }}>
                  <div style={{ border: '1px solid #eee', padding: '8px' }}>
                    <p><strong>OD:</strong> Disc: {formData.fs_disc_color_od}, CDR: {formData.fs_disc_cdr_od}, Margins: {formData.fs_disc_margins_od}, Macula: {formData.fs_macula_od}, Vessels: {formData.fs_vessels_nipping_od}, Periph: {formData.fs_periph_od}</p>
                  </div>
                  <div style={{ border: '1px solid #eee', padding: '8px' }}>
                    <p><strong>OS:</strong> Disc: {formData.fs_disc_color_os}, CDR: {formData.fs_disc_cdr_os}, Margins: {formData.fs_disc_margins_os}, Macula: {formData.fs_macula_os}, Vessels: {formData.fs_vessels_nipping_os}, Periph: {formData.fs_periph_os}</p>
                  </div>
                </div>
              </div>

              {/* Section I: Diagnosis */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>I. DIAGNOSIS</h3>
                <div style={{ fontSize: '11px' }}>
                  <p><strong>OD:</strong> {formData.diag_od || 'N/A'}</p>
                  <p><strong>OS:</strong> {formData.diag_os || 'N/A'}</p>
                  <p><strong>Summary:</strong> {formData.diag_summary}</p>
                </div>
              </div>

              {/* Section J: Treatment Plan */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>J. TREATMENT PLAN</h3>
                <div style={{ fontSize: '11px' }}>
                  {formData.plan_meds && formData.plan_meds.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <p><strong>Prescribed Medications:</strong></p>
                      {formData.plan_meds.map((m: any, i: number) => (
                        <p key={i}>• {m.drug_name} {m.strength} - {m.dose} ({m.frequency}) for {m.duration}</p>
                      ))}
                    </div>
                  )}
                  {formData.plan_glasses && <p><strong>Glasses Prescription:</strong> {formData.plan_glasses}</p>}
                </div>
              </div>

              {/* Section K: Clinical Notes & Follow-up */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>K. CLINICAL NOTES & FOLLOW-UP</h3>
                <div style={{ fontSize: '11px' }}>
                  <p><strong>Notes:</strong> {formData.clinical_notes || 'No additional notes.'}</p>
                  <p><strong>Follow-up:</strong> {formData.follow_up_date ? `Review on ${formData.follow_up_date}` : 'As needed'}</p>
                </div>
              </div>

              {/* Section L: Surgery Flag */}
              {formData.surgery_advised && (
                <div style={{ border: '2px solid #dc2626', padding: '10px', borderRadius: '4px', background: '#fef2f2' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#dc2626' }}>L. SURGERY BOOKING</h3>
                  <div style={{ fontSize: '11px' }}>
                    <p><strong>Procedure:</strong> {formData.surgery_type} ({formData.surgery_side})</p>
                    <p><strong>Urgency:</strong> {formData.surgery_urgency}</p>
                  </div>
                </div>
              )}

            </div>

            {/* DOCUMENT FOOTER */}
            <div style={{ marginTop: '50px', borderTop: '2px solid #000', paddingTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px' }}>
                <div>
                  <p style={{ fontSize: '11px', margin: '0' }}><strong>Clinician Name:</strong> {user?.full_name}</p>
                  <p style={{ fontSize: '11px', margin: '5px 0' }}><strong>Designation:</strong> Ophthalmic Clinician</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ height: '40px', borderBottom: '1px solid #000', marginBottom: '5px' }}></div>
                  <p style={{ fontSize: '10px', margin: '0' }}>Signature & Stamp / Date</p>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '9px', color: '#64748b', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                <p>This document is a formal clinical record generated by <strong>VisionCare EMR v2.0</strong> for Luna Eye Hospital.</p>
                <p>© 2026 VisionCare Systems. Audit Trail ID: {selectedPatient.visit_id}-{Date.now()}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showTriageModal && (
        <div className="leh-modal-overlay">
           <div className="leh-modal-content" style={{ maxWidth: '520px' }}>
              <div className="leh-modal-header">
                 <div className="leh-modal-title">
                    <Activity style={{ color: 'var(--leh-primary)' }} />
                    <span>Baseline Triage Reference</span>
                 </div>
                 <button className="leh-modal-close" onClick={() => setShowTriageModal(false)}><X size={20} /></button>
              </div>
              <div className="leh-modal-body" style={{ padding: '32px' }}>
                 {triageData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                       <div className="leh-form-section" style={{ border: 'none', padding: 0, margin: 0 }}>
                          <h4 className="leh-form-section-title">Physiological Vitals</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                             <div style={{ padding: '16px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                                <p className="leh-label" style={{ fontSize: '10px', marginBottom: '4px' }}>BLOOD PRESSURE</p>
                                <p className="leh-table-bold" style={{ fontSize: '18px', margin: 0 }}>{triageData.bp_systolic}/{triageData.bp_diastolic} <small style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>mmHg</small></p>
                             </div>
                             <div style={{ padding: '16px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                                <p className="leh-label" style={{ fontSize: '10px', marginBottom: '4px' }}>PULSE RATE</p>
                                <p className="leh-table-bold" style={{ fontSize: '18px', margin: 0 }}>{triageData.pulse_rate} <small style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>bpm</small></p>
                             </div>
                             <div style={{ padding: '16px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                                <p className="leh-label" style={{ fontSize: '10px', marginBottom: '4px' }}>BODY TEMP</p>
                                <p className="leh-table-bold" style={{ fontSize: '18px', margin: 0 }}>{triageData.temperature} <small style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>°C</small></p>
                             </div>
                             <div style={{ padding: '16px', background: 'var(--leh-bg-light)', borderRadius: '16px', border: '1px solid var(--leh-border-light)' }}>
                                <p className="leh-label" style={{ fontSize: '10px', marginBottom: '4px' }}>WEIGHT</p>
                                <p className="leh-table-bold" style={{ fontSize: '18px', margin: 0 }}>{triageData.weight} <small style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>kg</small></p>
                             </div>
                          </div>
                       </div>

                       <div className="leh-form-section" style={{ border: 'none', padding: 0, margin: 0 }}>
                          <h4 className="leh-form-section-title">Critical Alerts</h4>
                          <div style={{ padding: '20px', background: triageData.allergies ? '#fff1f2' : 'var(--leh-bg-light)', borderRadius: '16px', border: triageData.allergies ? '1px solid #fda4af' : '1px solid var(--leh-border-light)' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <AlertTriangle size={18} color={triageData.allergies ? '#e11d48' : 'var(--leh-text-muted)'} />
                                <span className="leh-table-bold" style={{ color: triageData.allergies ? '#e11d48' : 'var(--leh-text-dark)' }}>DRUG & ENVIRONMENTAL ALLERGIES</span>
                             </div>
                             <p className="leh-label" style={{ color: triageData.allergies ? '#be123c' : 'var(--leh-text-muted)', fontSize: '14px', fontWeight: triageData.allergies ? '800' : '600' }}>
                                {triageData.allergies || 'NO KNOWN ALLERGIES REPORTED BY PATIENT'}
                             </p>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                       <Info size={48} color="var(--leh-border)" style={{ marginBottom: '16px' }} />
                       <p className="leh-label">No baseline triage data available for this visit.</p>
                    </div>
                 )}
              </div>
              <div className="leh-modal-footer">
                 <button className="leh-btn-primary" style={{ width: '100%', height: '48px' }} onClick={() => setShowTriageModal(false)}>CLOSE REFERENCE</button>
              </div>
           </div>
        </div>
      )}

      {showSendBackModal && (
        <div className="leh-modal-overlay">
           <div className="leh-modal-content" style={{ maxWidth: '480px' }}>
              <div className="leh-modal-header">
                 <div className="leh-modal-title">
                    <RefreshCcw style={{ color: 'var(--leh-red)' }} />
                    <span>Revert to Triage Registry</span>
                 </div>
                 <button className="leh-modal-close" onClick={() => setShowSendBackModal(false)}><X size={20} /></button>
              </div>
              <div className="leh-modal-body" style={{ padding: '32px' }}>
                 <p className="leh-label" style={{ marginBottom: '20px', fontSize: '14px' }}>
                    Are you sure you want to send <strong style={{ color: 'var(--leh-text-dark)' }}>{selectedPatient?.full_name}</strong> back to the Triage queue?
                 </p>
                 <div className="leh-form-group">
                    <label className="leh-label">REASON FOR REVERSION</label>
                    <textarea 
                      className="leh-textarea" 
                      value={sendBackNote} 
                      onChange={(e) => setSendBackNote(e.target.value)} 
                      placeholder="e.g. Vitals need re-checking, patient requested break..." 
                      style={{ height: '120px', paddingTop: '16px' }} 
                    />
                 </div>
              </div>
              <div className="leh-modal-footer">
                 <button className="leh-btn-outline" style={{ flex: 1, height: '48px' }} onClick={() => setShowSendBackModal(false)}>CANCEL</button>
                 <button className="leh-btn-primary" style={{ flex: 1, height: '48px', background: 'var(--leh-red)' }} onClick={handleSendBack}>
                    <RefreshCcw size={16} /> CONFIRM REVERSION
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
export default Consultations;
