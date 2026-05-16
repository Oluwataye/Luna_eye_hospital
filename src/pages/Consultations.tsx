import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, CheckCircle, User, Activity, Eye, 
  Pill, Glasses, Stethoscope, Scissors, CheckCircle2, Printer, 
  Search, Plus, Trash2, Clock, X, RefreshCcw, Loader2,
  History as HistoryIcon, Droplets, Target, 
  ClipboardList, AlertTriangle, Download, Info, AlertCircle
} from 'lucide-react';

const SNELLEN_OPTIONS = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '3/60', '1/60', 'CF', 'HM', 'PL', 'NPL'];

const DIAGNOSIS_OPTIONS = [
  'Immature Senile Cataract',
  'Mature Senile Cataract',
  'Hypermature Cataract',
  'Primary Open Angle Glaucoma',
  'Primary Angle Closure Glaucoma',
  'Glaucoma Suspect',
  'Allergic Conjunctivitis',
  'Bacterial Conjunctivitis',
  'Viral Conjunctivitis',
  'Dry Eye Syndrome',
  'Pterygium',
  'Pinguecula',
  'Corneal Ulcer',
  'Corneal Abrasion',
  'Uveitis (Anterior)',
  'Diabetic Retinopathy',
  'Hypertensive Retinopathy',
  'Age-Related Macular Degeneration',
  'Retinal Detachment',
  'Vitreous Hemorrhage',
  'Refractive Error (Myopia)',
  'Refractive Error (Hyperopia)',
  'Refractive Error (Astigmatism)',
  'Presbyopia',
  'Amblyopia',
  'Strabismus',
  'Chalazion / Stye',
  'Normal Findings'
];

const LIDS_OPTIONS = ['Normal', 'Ptosis', 'Entropion', 'Ectropion', 'Lid Edema', 'Chalazion', 'Hordeolum', 'Trichiasis', 'Distichiasis', 'Blepharitis', 'Other'];
const CONJ_OPTIONS = ['Normal', 'Congestion', 'Chemosis', 'Pterygium', 'Pinguecula', 'Subconjunctival Hemorrhage', 'Follicles', 'Papillae', 'Other'];
const CORNEA_OPTIONS = ['Clear', 'Hazy', 'Edema', 'Ulcer', 'Scar', 'Keratic Precipitates', 'Pannus', 'Infiltrates', 'Other'];
const AC_DEPTH_OPTIONS = ['Normal', 'Shallow', 'Deep', 'Flat'];
const AC_CELLS_OPTIONS = ['None', '1+', '2+', '3+', '4+'];
const IRIS_OPTIONS = ['Normal', 'Rubeosis', 'Synechiae', 'Coloboma', 'Atrophy', 'Other'];
const LENS_OPTIONS = ['Clear', 'NS 1+', 'NS 2+', 'NS 3+', 'NS 4+', 'Cortical', 'PSC', 'Aphakia', 'Pseudophakia (PCIOL)', 'Pseudophakia (ACIOL)', 'Other'];
const DISC_MARGIN_OPTIONS = ['Distinct', 'Blurred', 'Swollen', 'Cupped'];
const DISC_COLOR_OPTIONS = ['Pink', 'Pale', 'Hyperemic', 'Waxy Pale'];
const MACULA_OPTIONS = ['Normal Reflex', 'Edema', 'Exudates', 'Drusen', 'Hemorrhage', 'Scar', 'ERM', 'Hole', 'Other'];
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

const SectionHeader = ({ title, icon: Icon, onMarkNormal, onSave, isSaving }: { title: string; icon?: any; onMarkNormal?: () => void; onSave?: () => void; isSaving?: boolean }) => (
    <div className="section-header-sticky">
      <h2>
        {Icon && <Icon size={20} />}
        {title}
      </h2>
      <div style={{ display: 'flex', gap: '12px' }}>
        {onMarkNormal && (
          <button className="leh-btn-outline" onClick={onMarkNormal} style={{ height: '36px', padding: '0 16px', fontSize: '11px' }}>
            MARK ALL NORMAL
          </button>
        )}
        {onSave && (
          <button className="leh-btn-primary" onClick={onSave} disabled={isSaving} style={{ height: '36px', padding: '0 20px', fontSize: '11px' }}>
            {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            SAVE SECTION
          </button>
        )}
      </div>
    </div>
  );

const ClinicalField = ({ label, children, fullWidth = false }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
    <label className="clinical-label-premium">{label}</label>
    {children}
  </div>
);

const ODSideBySide = ({ label, childrenOD, childrenOS }: any) => (
  <div className="eye-comparison-container">
    <div className="eye-card">
       <div className="eye-badge badge-od">RIGHT EYE (OD)</div>
       {label && <label className="clinical-label-premium" style={{ opacity: 0.5 }}>{label}</label>}
       {childrenOD}
    </div>
    <div className="eye-card">
       <div className="eye-badge badge-os">LEFT EYE (OS)</div>
       {label && <label className="clinical-label-premium" style={{ opacity: 0.5 }}>{label}</label>}
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [triageData, setTriageData] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
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
    diagnosis_primary: '', diagnosis_secondary: '', diagnosis_notes: '',
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
      setHistoryList(Array.isArray(consultations) ? consultations : []);
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
          plan_meds: Array.isArray((savedData as any).plan_meds) ? (savedData as any).plan_meds : [],
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

  const fetchTriage = useCallback(async (patientId: string, visitId?: string | number) => {
    try {
      // Priority: fetch triage for THIS visit first
      const data = visitId ? await api.getVisitTriage(visitId) : await api.getTriageHistory(patientId).then(h => h[0]);
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
      await fetchTriage(p.patient_id || p.id, p.visit_id);
      
      // Load existing consultation (takes precedence if exists)
      await fetchConsultation(p.patient_id || p.id, p.visit_id);
      
      setIsDirty(false); // Reset dirty state on new patient
      setIsLocked(false); // Reset lock
      notify('info', `Consultation Started: ${p.full_name}`);
      loadQueue();
    } catch (err: any) {
      console.error('Patient Selection Error:', err);
      notify('error', 'Failed to initialize clinical session');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (isLocked) return;
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const markSectionNormal = (section: string) => {
    const normalValues: any = {};
    if (section === 'AnteriorSeg') {
      normalValues.as_lids_od = 'Normal'; normalValues.as_lids_os = 'Normal';
      normalValues.as_conj_od = 'Normal'; normalValues.as_conj_os = 'Normal';
      normalValues.as_cornea_od = 'Clear'; normalValues.as_cornea_os = 'Clear';
      normalValues.as_ac_depth_od = 'Normal'; normalValues.as_ac_depth_os = 'Normal';
      normalValues.as_ac_cells_od = 'None'; normalValues.as_ac_cells_os = 'None';
      normalValues.as_iris_od = 'Normal'; normalValues.as_iris_os = 'Normal';
      normalValues.as_lens_od = 'Clear'; normalValues.as_lens_os = 'Clear';
    } else if (section === 'Fundoscopy') {
      normalValues.fs_disc_margins_od = 'Distinct'; normalValues.fs_disc_margins_os = 'Distinct';
      normalValues.fs_disc_color_od = 'Pink'; normalValues.fs_disc_color_os = 'Pink';
      normalValues.fs_macula_od = 'Normal Reflex'; normalValues.fs_macula_os = 'Normal Reflex';
      normalValues.fs_vessels_nipping_od = 'Absent'; normalValues.fs_vessels_nipping_os = 'Absent';
      normalValues.fs_periph_od = 'Normal'; normalValues.fs_periph_os = 'Normal';
    }
    setFormData((prev: any) => ({ ...prev, ...normalValues }));
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

  const handleSave = async (finalize: boolean = false) => {
     if (!selectedPatient) return;
     
     // Mandatory clinical validation for finalization
     if (finalize) {
       const missing = [];
       if (!formData.complaint || formData.complaint.trim().length < 5) {
         missing.push('Section A: Chief Complaint (min 5 chars)');
       }
        if (!formData.diagnosis_primary?.trim()) {
          missing.push('Section I: Primary Diagnosis');
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
          primary_diagnosis: formData.diagnosis_primary || 'Pending Diagnosis',
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
    if (isLocked) return;
    setFormData((prev: any) => ({
      ...prev,
      plan_meds: [...(prev.plan_meds || []), { drug_name: '', strength: '', route: 'Topical', dose: '', frequency: '', duration: '', instructions: '' }]
    }));
    setIsDirty(true);
  };

  const removeMedication = (index: number) => {
    if (isLocked) return;
    setFormData((prev: any) => ({
      ...prev,
      plan_meds: (prev.plan_meds || []).filter((_: any, i: number) => i !== index)
    }));
    setIsDirty(true);
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    if (isLocked) return;
    const newMeds = [...(formData.plan_meds || [])];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setFormData((prev: any) => ({ ...prev, plan_meds: newMeds }));
    setIsDirty(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'History':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section A: History & Chief Complaint" icon={User} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header">
                <div className="clinical-group-title">Chief Complaint & History</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px' }}>
                <ClinicalField label="Chief Complaint" fullWidth>
                  <textarea className="clinical-textarea" name="complaint" value={formData.complaint} onChange={handleInputChange} placeholder="Reason for visit..." style={{ height: '120px' }} required disabled={isLocked} />
                </ClinicalField>
                <ClinicalField label="History of Present Illness (HPI)" fullWidth>
                  <textarea className="clinical-textarea" name="hpi" value={formData.hpi} onChange={handleInputChange} placeholder="Details of current symptoms..." style={{ height: '120px' }} disabled={isLocked} />
                </ClinicalField>
                <ClinicalField label="Ocular History">
                  <textarea className="clinical-textarea" name="ocular_history" value={formData.ocular_history} onChange={handleInputChange} placeholder="Previous conditions, surgeries..." style={{ height: '100px' }} disabled={isLocked} />
                </ClinicalField>
                <ClinicalField label="Medical/Systemic History">
                  <textarea className="clinical-textarea" name="medical_history" value={formData.medical_history} onChange={handleInputChange} placeholder="DM, Hypertension, etc..." style={{ height: '100px' }} disabled={isLocked} />
                </ClinicalField>
                <ClinicalField label="Drug History">
                  <textarea className="clinical-textarea" name="drug_history" value={formData.drug_history} onChange={handleInputChange} placeholder="Current medications..." style={{ height: '100px' }} disabled={isLocked} />
                </ClinicalField>
                <ClinicalField label="Allergies">
                  <textarea className="clinical-textarea" name="allergies" value={formData.allergies} onChange={handleInputChange} placeholder="Allergic reactions..." style={{ height: '100px', border: formData.allergies ? '2px solid #ef4444' : '' }} disabled={isLocked} />
                </ClinicalField>
                <ClinicalField label="Family History" fullWidth>
                  <textarea className="clinical-textarea" name="family_history" value={formData.family_history} onChange={handleInputChange} placeholder="Hereditary conditions..." style={{ height: '80px' }} disabled={isLocked} />
                </ClinicalField>
              </div>
            </div>
          </div>
        );
      case 'Vitals':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section B: Vital Signs Review" icon={Activity} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header">
                <div className="clinical-group-title">Patient Physiological Summary</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div className="eye-card" style={{ padding: '16px' }}>
                  <span className="clinical-label-premium" style={{ fontSize: '10px' }}>Blood Pressure</span>
                  <div style={{ fontSize: '18px', fontWeight: '800' }}>{triageData?.bp_systolic || '--'}/{triageData?.bp_diastolic || '--'} <small style={{ color: '#94a3b8', fontSize: '11px' }}>mmHg</small></div>
                </div>
                <div className="eye-card" style={{ padding: '16px' }}>
                  <span className="clinical-label-premium" style={{ fontSize: '10px' }}>Pulse Rate</span>
                  <div style={{ fontSize: '18px', fontWeight: '800' }}>{triageData?.pulse_rate || '--'} <small style={{ color: '#94a3b8', fontSize: '11px' }}>bpm</small></div>
                </div>
                <div className="eye-card" style={{ padding: '16px' }}>
                  <span className="clinical-label-premium" style={{ fontSize: '10px' }}>Body Temp</span>
                  <div style={{ fontSize: '18px', fontWeight: '800' }}>{triageData?.temperature || '--'} <small style={{ color: '#94a3b8', fontSize: '11px' }}>°C</small></div>
                </div>
                <div className="eye-card" style={{ padding: '16px' }}>
                  <span className="clinical-label-premium" style={{ fontSize: '10px' }}>Body Weight</span>
                  <div style={{ fontSize: '18px', fontWeight: '800' }}>{triageData?.weight || '--'} <small style={{ color: '#94a3b8', fontSize: '11px' }}>kg</small></div>
                </div>
              </div>

              <div className="leh-form-group">
                <label className="clinical-label-premium">Consultant's Observation Notes</label>
                <textarea 
                  className="clinical-textarea" 
                  name="vitals_notes" 
                  value={formData.vitals_notes} 
                  onChange={handleInputChange} 
                  placeholder="Enter any specific observations regarding patient vitals..."
                />
              </div>
            </div>
          </div>
        );
      case 'Vision':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section C: Visual Acuity" icon={Eye} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Acuity Measurements</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>METHOD:</span>
                   <select className="clinical-input" name="va_method" value={formData.va_method} onChange={handleInputChange} style={{ height: '40px', width: '180px' }}>
                      <option>Snellen Chart</option>
                      <option>LogMAR</option>
                      <option>Allen Pictures</option>
                      <option>LEA Symbols</option>
                   </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gap: '40px' }}>
                <ODSideBySide label="DISTANCE VISION (Unaided)" 
                  childrenOD={<ClinicalField><select className="clinical-input" name="va_od_unaided_dv" value={formData.va_od_unaided_dv} onChange={handleInputChange}><option value="">Select Result</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>}
                  childrenOS={<ClinicalField><select className="clinical-input" name="va_os_unaided_dv" value={formData.va_os_unaided_dv} onChange={handleInputChange}><option value="">Select Result</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>}
                />
                <ODSideBySide label="NEAR VISION (Unaided)" 
                  childrenOD={<ClinicalField><select className="clinical-input" name="va_od_unaided_nv" value={formData.va_od_unaided_nv} onChange={handleInputChange}><option value="">Select Result</option>{['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48'].map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>}
                  childrenOS={<ClinicalField><select className="clinical-input" name="va_os_unaided_nv" value={formData.va_os_unaided_nv} onChange={handleInputChange}><option value="">Select Result</option>{['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48'].map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>}
                />
                <ODSideBySide label="PINHOLE (PH)" 
                  childrenOD={<ClinicalField><select className="clinical-input" name="va_od_ph" value={formData.va_od_ph} onChange={handleInputChange}><option value="">Select Result</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>}
                  childrenOS={<ClinicalField><select className="clinical-input" name="va_os_ph" value={formData.va_os_ph} onChange={handleInputChange}><option value="">Select Result</option>{SNELLEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>}
                />
              </div>
            </div>
          </div>
        );
      case 'IOP':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section D: Intraocular Pressure" icon={Target} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Tonometry Results</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>METHOD:</span>
                   <select className="clinical-input" name="iop_method" value={formData.iop_method} onChange={handleInputChange} style={{ height: '40px', width: '220px' }}>
                      <option>Non-contact Tonometer</option>
                      <option>Goldmann Applanation</option>
                      <option>Tono-Pen</option>
                      <option>iCare</option>
                   </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gap: '40px' }}>
                <ODSideBySide label="IOP (mmHg)" 
                  childrenOD={
                    <div style={{ position: 'relative' }}>
                      <input type="number" className="clinical-input" name="iop_od" value={formData.iop_od} onChange={handleInputChange} placeholder="0" style={{ border: formData.iop_od > 21 ? '2px solid #ef4444' : '', background: formData.iop_od > 21 ? '#fff1f2' : '', paddingRight: '60px' }} disabled={isLocked} />
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>mmHg</span>
                      {formData.iop_od > 21 && <div className="clinical-indicator-dot dot-elevated" style={{ position: 'absolute', right: '4px', top: '4px' }}></div>}
                    </div>
                  }
                  childrenOS={
                    <div style={{ position: 'relative' }}>
                      <input type="number" className="clinical-input" name="iop_os" value={formData.iop_os} onChange={handleInputChange} placeholder="0" style={{ border: formData.iop_os > 21 ? '2px solid #ef4444' : '', background: formData.iop_os > 21 ? '#fff1f2' : '', paddingRight: '60px' }} />
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>mmHg</span>
                      {formData.iop_os > 21 && <div className="clinical-indicator-dot dot-elevated" style={{ position: 'absolute', right: '4px', top: '4px' }}></div>}
                    </div>
                  }
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px' }}>
                   <div className="leh-form-group">
                      <label className="clinical-label-premium">Time of Measurement</label>
                      <input type="time" className="clinical-input" name="iop_time" value={formData.iop_time} onChange={handleInputChange} />
                   </div>
                   <div className="leh-form-group">
                      <label className="clinical-label-premium">Tonometry Observations</label>
                      <input type="text" className="clinical-input" name="iop_notes" value={formData.iop_notes} onChange={handleInputChange} placeholder="Asymmetry, corneal thickness corrections..." />
                   </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Refraction':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section E: Refraction (Objective/Subjective)" icon={Glasses} onSave={() => handleSave(false)} isSaving={isSaving} />
            
            <div style={{ display: 'grid', gap: '32px' }}>
              <div className="clinical-section-card">
                <div className="clinical-group-header" style={{ marginBottom: '24px' }}>
                   <div className="clinical-group-title">Objective Refraction (AR/K)</div>
                </div>
                <ODSideBySide label="REFRACTION (Sph / Cyl x Axis)" 
                   childrenOD={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input className="clinical-input" name="ref_od_sph" value={formData.ref_od_sph} onChange={handleInputChange} placeholder="SPH" />
                      <input className="clinical-input" name="ref_od_cyl" value={formData.ref_od_cyl} onChange={handleInputChange} placeholder="CYL" />
                      <input className="clinical-input" name="ref_od_axis" value={formData.ref_od_axis} onChange={handleInputChange} placeholder="AXIS" />
                    </div>
                   }
                   childrenOS={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input className="clinical-input" name="ref_os_sph" value={formData.ref_os_sph} onChange={handleInputChange} placeholder="SPH" />
                      <input className="clinical-input" name="ref_os_cyl" value={formData.ref_os_cyl} onChange={handleInputChange} placeholder="CYL" />
                      <input className="clinical-input" name="ref_os_axis" value={formData.ref_os_axis} onChange={handleInputChange} placeholder="AXIS" />
                    </div>
                   }
                />
              </div>

              <div className="clinical-section-card" style={{ borderLeft: '4px solid var(--leh-primary)' }}>
                <div className="clinical-group-header" style={{ marginBottom: '24px' }}>
                   <div className="clinical-group-title">Subjective Refraction (Best Corrected)</div>
                </div>
                <div style={{ display: 'grid', gap: '32px' }}>
                   <ODSideBySide label="DISTANCE REFRACTION" 
                      childrenOD={<div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px' }}><input className="clinical-input" name="ref_od_subjective_dv" value={formData.ref_od_subjective_dv} onChange={handleInputChange} placeholder="OD RX" /><input className="clinical-input" name="ref_od_va" value={formData.ref_od_va} onChange={handleInputChange} placeholder="VA" /></div>}
                      childrenOS={<div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px' }}><input className="clinical-input" name="ref_os_subjective_dv" value={formData.ref_os_subjective_dv} onChange={handleInputChange} placeholder="OS RX" /><input className="clinical-input" name="ref_os_va" value={formData.ref_os_va} onChange={handleInputChange} placeholder="VA" /></div>}
                   />
                   <ODSideBySide label="NEAR ADDITION" 
                      childrenOD={<input className="clinical-input" name="ref_od_near_add" value={formData.ref_od_near_add} onChange={handleInputChange} placeholder="OD Add" />}
                      childrenOS={<input className="clinical-input" name="ref_os_near_add" value={formData.ref_os_near_add} onChange={handleInputChange} placeholder="OS Add" />}
                   />
                </div>
              </div>
            </div>
          </div>
        );
      case 'AnteriorSeg':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section F: Anterior Segment / Slit Lamp" icon={Eye} onMarkNormal={() => markSectionNormal('AnteriorSeg')} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Slit Lamp Biomicroscopy</div>
              </div>
              
              <div style={{ display: 'grid', gap: '32px' }}>
                <ODSideBySide label="LIDS & ADNEXA" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lids_od" value={formData.as_lids_od} onChange={handleInputChange}>{LIDS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lids_notes_od" value={formData.as_lids_notes_od} onChange={handleInputChange} placeholder="Lid notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lids_os" value={formData.as_lids_os} onChange={handleInputChange}>{LIDS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lids_notes_os" value={formData.as_lids_notes_os} onChange={handleInputChange} placeholder="Lid notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
                <ODSideBySide label="CONJUNCTIVA / SCLERA" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_conj_od" value={formData.as_conj_od} onChange={handleInputChange}>{CONJ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_conj_notes_od" value={formData.as_conj_notes_od} onChange={handleInputChange} placeholder="Conj notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_conj_os" value={formData.as_conj_os} onChange={handleInputChange}>{CONJ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_conj_notes_os" value={formData.as_conj_notes_os} onChange={handleInputChange} placeholder="Conj notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
                <ODSideBySide label="CORNEA / TEAR FILM" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_cornea_od" value={formData.as_cornea_od} onChange={handleInputChange}>{CORNEA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_cornea_notes_od" value={formData.as_cornea_notes_od} onChange={handleInputChange} placeholder="Cornea notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_cornea_os" value={formData.as_cornea_os} onChange={handleInputChange}>{CORNEA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_cornea_notes_os" value={formData.as_cornea_notes_os} onChange={handleInputChange} placeholder="Cornea notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
                <ODSideBySide label="ANTERIOR CHAMBER" 
                  childrenOD={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <ClinicalField label="Depth"><select className="clinical-input" name="as_ac_depth_od" value={formData.as_ac_depth_od} onChange={handleInputChange}>{AC_DEPTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      <ClinicalField label="Cells"><select className="clinical-input" name="as_ac_cells_od" value={formData.as_ac_cells_od} onChange={handleInputChange}>{AC_CELLS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                  childrenOS={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <ClinicalField label="Depth"><select className="clinical-input" name="as_ac_depth_os" value={formData.as_ac_depth_os} onChange={handleInputChange}>{AC_DEPTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      <ClinicalField label="Cells"><select className="clinical-input" name="as_ac_cells_os" value={formData.as_ac_cells_os} onChange={handleInputChange}>{AC_CELLS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                />
                <ODSideBySide label="IRIS / PUPIL" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_iris_od" value={formData.as_iris_od} onChange={handleInputChange}>{IRIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_iris_notes_od" value={formData.as_iris_notes_od} onChange={handleInputChange} placeholder="Iris notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_iris_os" value={formData.as_iris_os} onChange={handleInputChange}>{IRIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_iris_notes_os" value={formData.as_iris_notes_os} onChange={handleInputChange} placeholder="Iris notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
                <ODSideBySide label="LENS (Cataract Grading)" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lens_od" value={formData.as_lens_od} onChange={handleInputChange}>{LENS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lens_notes_od" value={formData.as_lens_notes_od} onChange={handleInputChange} placeholder="Lens notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lens_os" value={formData.as_lens_os} onChange={handleInputChange}>{LENS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lens_notes_os" value={formData.as_lens_notes_os} onChange={handleInputChange} placeholder="Lens notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
              </div>
            </div>
          </div>
        );
      case 'Dilation':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section G: Dilation" icon={Droplets} onMarkNormal={() => markSectionNormal('Dilation')} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Mydriatic Administration</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
                <div className="leh-form-group">
                   <label className="clinical-label-premium">Dilation Drops Used</label>
                   <select className="clinical-input" name="dil_agent" value={formData.dil_agent} onChange={handleInputChange}>
                      <option value="">Select Agent</option>
                      <option>Tropicamide 1%</option>
                      <option>Tropicamide 0.5%</option>
                      <option>Cyclopentolate 1%</option>
                      <option>Phenylephrine 2.5%</option>
                      <option>Tropicamide + Phenylephrine</option>
                   </select>
                </div>
                <div className="leh-form-group">
                   <label className="clinical-label-premium">Time Administered</label>
                   <input type="time" className="clinical-input" name="dil_time_od" value={formData.dil_time_od} onChange={handleInputChange} />
                </div>
              </div>
              <div style={{ marginTop: '32px' }}>
                <ODSideBySide label="DILATED?" 
                   childrenOD={
                    <select className="clinical-input" name="dil_od" value={formData.dil_od} onChange={handleInputChange}>
                       <option value="No">No</option><option value="Yes">Yes</option>
                    </select>
                   }
                   childrenOS={
                    <select className="clinical-input" name="dil_os" value={formData.dil_os} onChange={handleInputChange}>
                       <option value="No">No</option><option value="Yes">Yes</option>
                    </select>
                   }
                />
              </div>
            </div>
          </div>
        );
      case 'Fundoscopy':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section H: Fundoscopy" icon={Search} onMarkNormal={() => markSectionNormal('Fundoscopy')} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Posterior Segment Evaluation</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>METHOD:</span>
                   <select className="clinical-input" name="fs_method" value={formData.fs_method} onChange={handleInputChange} style={{ height: '40px', width: '220px' }}>
                      <option>Slit Lamp with 90D Lens</option>
                      <option>Indirect Ophthalmoscopy</option>
                      <option>Direct Ophthalmoscopy</option>
                   </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gap: '40px' }}>
                <ODSideBySide label="OPTIC DISC (CDR, Margin, Color)" 
                  childrenOD={
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <ClinicalField label="CDR"><input className="clinical-input" name="fs_disc_cdr_od" value={formData.fs_disc_cdr_od} onChange={handleInputChange} placeholder="0.3" /></ClinicalField>
                        <ClinicalField label="Margin"><select className="clinical-input" name="fs_disc_margins_od" value={formData.fs_disc_margins_od} onChange={handleInputChange}>{DISC_MARGIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      </div>
                      <ClinicalField label="Color"><select className="clinical-input" name="fs_disc_color_od" value={formData.fs_disc_color_od} onChange={handleInputChange}>{DISC_COLOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                  childrenOS={
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <ClinicalField label="CDR"><input className="clinical-input" name="fs_disc_cdr_os" value={formData.fs_disc_cdr_os} onChange={handleInputChange} placeholder="0.3" /></ClinicalField>
                        <ClinicalField label="Margin"><select className="clinical-input" name="fs_disc_margins_os" value={formData.fs_disc_margins_os} onChange={handleInputChange}>{DISC_MARGIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      </div>
                      <ClinicalField label="Color"><select className="clinical-input" name="fs_disc_color_os" value={formData.fs_disc_color_os} onChange={handleInputChange}>{DISC_COLOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                />
                <ODSideBySide label="MACULA / FOVEA" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_macula_od" value={formData.fs_macula_od} onChange={handleInputChange}>{MACULA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="fs_macula_notes_od" value={formData.fs_macula_notes_od} onChange={handleInputChange} placeholder="Macula notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_macula_os" value={formData.fs_macula_os} onChange={handleInputChange}>{MACULA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="fs_macula_notes_os" value={formData.fs_macula_notes_os} onChange={handleInputChange} placeholder="Macula notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
                <ODSideBySide label="RETINAL VESSELS" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><input className="clinical-input" name="fs_vessels_av_od" value={formData.fs_vessels_av_od} onChange={handleInputChange} placeholder="A/V 2:3" /><select className="clinical-input" name="fs_vessels_nipping_od" value={formData.fs_vessels_nipping_od} onChange={handleInputChange}><option value="Absent">AV Nipping: Absent</option><option value="Present">AV Nipping: Present</option></select></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><input className="clinical-input" name="fs_vessels_av_os" value={formData.fs_vessels_av_os} onChange={handleInputChange} placeholder="A/V 2:3" /><select className="clinical-input" name="fs_vessels_nipping_os" value={formData.fs_vessels_nipping_os} onChange={handleInputChange}><option value="Absent">AV Nipping: Absent</option><option value="Present">AV Nipping: Present</option></select></div>}
                />
                <ODSideBySide label="PERIPHERY" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_periph_od" value={formData.fs_periph_od} onChange={handleInputChange}><option value="Normal">Normal</option><option value="Break/Tear">Break/Tear</option><option value="Detachment">Detachment</option><option value="Lattice">Lattice</option><option value="Other">Other</option></select><input className="clinical-input" name="fs_periph_notes_od" value={formData.fs_periph_notes_od} onChange={handleInputChange} placeholder="Periph notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_periph_os" value={formData.fs_periph_os} onChange={handleInputChange}><option value="Normal">Normal</option><option value="Break/Tear">Break/Tear</option><option value="Detachment">Detachment</option><option value="Lattice">Lattice</option><option value="Other">Other</option></select><input className="clinical-input" name="fs_periph_notes_os" value={formData.fs_periph_notes_os} onChange={handleInputChange} placeholder="Periph notes..." style={{ height: '38px', fontSize: '12px' }} /></div>}
                />
                <div className="leh-form-group">
                   <label className="clinical-label-premium">Posterior Segment Summary</label>
                   <textarea className="clinical-textarea" name="fs_summary" value={formData.fs_summary} onChange={handleInputChange} placeholder="Overall posterior pole assessment..." style={{ height: '80px' }} />
                </div>
              </div>
            </div>
          </div>
        );
      case 'Diagnosis':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section I: Assessment & Diagnosis" icon={Activity} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Clinical Impression</div>
              </div>
              
              <div style={{ display: 'grid', gap: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                  <div className="leh-form-group">
                    <label className="clinical-label-premium">Primary Diagnosis</label>
                    <select className="clinical-input" name="diagnosis_primary" value={formData.diagnosis_primary} onChange={handleInputChange} disabled={isLocked}>
                      <option value="">Select Primary Condition</option>
                      {DIAGNOSIS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="leh-form-group">
                    <label className="clinical-label-premium">Secondary Diagnosis</label>
                    <select className="clinical-input" name="diagnosis_secondary" value={formData.diagnosis_secondary} onChange={handleInputChange} disabled={isLocked}>
                      <option value="">Select Secondary Condition</option>
                      {DIAGNOSIS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="leh-form-group">
                   <label className="clinical-label-premium">Other/Specific Findings (ICD-10 Notes)</label>
                   <textarea className="clinical-textarea" name="diagnosis_notes" value={formData.diagnosis_notes} onChange={handleInputChange} placeholder="Additional diagnostic details, staging, or specific ICD codes..." style={{ height: '120px' }} disabled={isLocked} />
                </div>
              </div>
            </div>
          </div>
        );
      case 'Plan':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section J: Management Plan" icon={ClipboardList} onSave={() => handleSave(false)} isSaving={isSaving} />
            
            <div style={{ display: 'grid', gap: '32px' }}>
              <div className="clinical-section-card">
                <div className="clinical-group-header" style={{ marginBottom: '24px' }}>
                   <div className="clinical-group-title">Medication & Therapeutics</div>
                   <button className="leh-btn-primary" onClick={addMedication} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: '12px' }} disabled={isLocked}>
                      <Plus size={16} style={{ marginRight: '8px' }} /> Add Drug
                   </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   {formData.plan_meds.length === 0 && (
                     <div style={{ textAlign: 'center', padding: '48px', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #e2e8f0' }}>
                        <Pill size={32} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                        <p style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>No medications prescribed yet.</p>
                     </div>
                   )}
                   {(formData.plan_meds || []).map((med: Medication, idx: number) => (
                      <div key={idx} className="medication-terminal-row">
                         <ClinicalField label="Drug Name"><input className="clinical-input" value={med.drug_name} onChange={(e) => updateMedication(idx, 'drug_name', e.target.value)} placeholder="e.g. G. Timolol" /></ClinicalField>
                         <ClinicalField label="Dose/Freq"><input className="clinical-input" value={med.dose} onChange={(e) => updateMedication(idx, 'dose', e.target.value)} placeholder="e.g. 1 drop BD" /></ClinicalField>
                         <ClinicalField label="Duration"><input className="clinical-input" value={med.duration} onChange={(e) => updateMedication(idx, 'duration', e.target.value)} placeholder="e.g. 1 month" /></ClinicalField>
                         <ClinicalField label="Route">
                            <select className="clinical-input" value={med.route} onChange={(e) => updateMedication(idx, 'route', e.target.value)}>
                               <option>Topical</option><option>Oral</option><option>Injection</option>
                            </select>
                         </ClinicalField>
                         <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button onClick={() => removeMedication(idx)} style={{ height: '56px', width: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '1rem', cursor: 'pointer' }}>
                               <Trash2 size={20} />
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
              </div>

              <div className="clinical-section-card">
                <div className="clinical-group-header">
                   <div className="clinical-group-title">Glasses Prescription</div>
                </div>
                <ODSideBySide 
                  childrenOD={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                       <ClinicalField label="SPH"><input className="clinical-input" placeholder="SPH" value={formData.plan_glasses_od.sph} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, sph: e.target.value } }))} /></ClinicalField>
                       <ClinicalField label="CYL"><input className="clinical-input" placeholder="CYL" value={formData.plan_glasses_od.cyl} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, cyl: e.target.value } }))} /></ClinicalField>
                       <ClinicalField label="AXIS"><input className="clinical-input" placeholder="AXIS" value={formData.plan_glasses_od.axis} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, axis: e.target.value } }))} /></ClinicalField>
                    </div>
                  }
                  childrenOS={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                       <ClinicalField label="SPH"><input className="clinical-input" placeholder="SPH" value={formData.plan_glasses_os.sph} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_os: { ...prev.plan_glasses_os, sph: e.target.value } }))} /></ClinicalField>
                       <ClinicalField label="CYL"><input className="clinical-input" placeholder="CYL" value={formData.plan_glasses_os.cyl} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_os: { ...prev.plan_glasses_os, cyl: e.target.value } }))} /></ClinicalField>
                       <ClinicalField label="AXIS"><input className="clinical-input" placeholder="AXIS" value={formData.plan_glasses_os.axis} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_os: { ...prev.plan_glasses_os, axis: e.target.value } }))} /></ClinicalField>
                    </div>
                  }
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: '24px' }}>
                   <ClinicalField label="Near Add"><input className="clinical-input" value={formData.plan_glasses_od.add} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_od: { ...prev.plan_glasses_od, add: e.target.value }, plan_glasses_os: { ...prev.plan_glasses_os, add: e.target.value } }))} /></ClinicalField>
                   <ClinicalField label="PD (mm)"><input className="clinical-input" value={formData.plan_glasses_pd} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_glasses_pd: e.target.value }))} /></ClinicalField>
                   <ClinicalField label="Lens Type"><input className="clinical-input" value={formData.plan_lens_type} onChange={(e) => setFormData((prev: any) => ({ ...prev, plan_lens_type: e.target.value }))} placeholder="e.g. Bifocal, Photochromic" /></ClinicalField>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Notes':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section K: Clinical Notes & Follow-up" icon={ClipboardList} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header">
                <div className="clinical-group-title">Detailed Observations</div>
              </div>
              <div style={{ display: 'grid', gap: '32px' }}>
                 <ClinicalField label="Internal Clinical Notes" fullWidth>
                    <textarea className="clinical-textarea" name="notes_clinical" value={formData.notes_clinical} onChange={handleInputChange} placeholder="Internal observations, advice given, specialized test results..." style={{ height: '240px' }} />
                 </ClinicalField>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px', background: '#f8fafc', borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                    <ClinicalField label="Follow-up Date">
                      <input className="clinical-input" type="date" name="plan_followup_date" value={formData.plan_followup_date} onChange={handleInputChange} />
                    </ClinicalField>
                    <ClinicalField label="Clinic / Specialty">
                       <select className="clinical-input" name="notes_followup_clinic" value={formData.notes_followup_clinic} onChange={handleInputChange}>
                          <option>General Eye Clinic</option><option>Glaucoma Clinic</option><option>Retina Clinic</option><option>Pediatric Clinic</option><option>Cornea Clinic</option>
                       </select>
                    </ClinicalField>
                 </div>
              </div>
            </div>
          </div>
        );
      case 'Admission':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section L: Specialized Management" icon={Activity} onSave={() => handleSave(false)} isSaving={isSaving} />
            
            <div style={{ display: 'grid', gap: '32px' }}>
              <div className="clinical-section-card" style={{ border: formData.surgery_advised ? '2px solid #ef4444' : '' }}>
                 <div className="clinical-group-header">
                    <div className="clinical-group-title">Surgical Planning</div>
                    <label className="checkbox-clinical-container" style={{ marginLeft: 'auto' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: formData.surgery_advised ? '#ef4444' : '#64748b' }}>ADVISE SURGERY?</span>
                      <input type="checkbox" className="clinical-checkbox" checked={formData.surgery_advised} onChange={(e) => setFormData((prev: any) => ({ ...prev, surgery_advised: e.target.checked }))} disabled={isLocked} />
                    </label>
                 </div>
                 
                 {formData.surgery_advised && (
                   <div className="animate-slide-up" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                     <div className="leh-form-group">
                       <label className="clinical-label-premium">Surgical Procedure</label>
                       <select className="clinical-input" name="surgery_procedure" value={formData.surgery_procedure} onChange={handleInputChange}>
                         <option value="">Select Procedure</option>
                         <option>Phacoemulsification + IOL</option>
                         <option>SICS + IOL</option>
                         <option>Trabeculectomy</option>
                         <option>Pterygium Excision</option>
                       </select>
                     </div>
                     <div className="leh-form-group">
                       <label className="clinical-label-premium">Eye for Surgery</label>
                       <select className="clinical-input" name="surgery_eye" value={formData.surgery_eye} onChange={handleInputChange}>
                         <option value="">Select Eye</option>
                         <option value="OD">Right Eye (OD)</option>
                         <option value="OS">Left Eye (OS)</option>
                         <option value="Bilateral">Bilateral (OU)</option>
                       </select>
                     </div>
                   </div>
                 )}
              </div>

              <div className="clinical-section-card" style={{ border: formData.admission_advised ? '2px solid #2563eb' : '' }}>
                 <div className="clinical-group-header">
                    <div className="clinical-group-title">Admission Plan</div>
                    <label className="checkbox-clinical-container" style={{ marginLeft: 'auto' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: formData.admission_advised ? '#2563eb' : '#64748b' }}>ADVISE ADMISSION?</span>
                      <input type="checkbox" className="clinical-checkbox" checked={formData.admission_advised} onChange={(e) => setFormData((prev: any) => ({ ...prev, admission_advised: e.target.checked }))} disabled={isLocked} />
                    </label>
                 </div>
                 
                 {formData.admission_advised && (
                   <div className="animate-slide-up" style={{ marginTop: '24px' }}>
                     <div className="leh-form-group">
                       <label className="clinical-label-premium">Reason for Admission</label>
                       <textarea className="clinical-textarea" name="admission_reason" value={formData.admission_reason} onChange={handleInputChange} placeholder="e.g. Post-op monitoring, intensive topical therapy..." />
                     </div>
                   </div>
                 )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };


   return (
    <div className="consultations-page-container no-print">
      
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
              <button className="leh-btn-outline" onClick={() => setShowHistoryModal(true)} style={{ background: 'white', borderColor: 'var(--leh-primary)', color: 'var(--leh-primary)' }}>
                 <ClipboardList size={16} />
                 <span style={{ fontSize: '11px' }}>VIEW HISTORY</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 20%) 1fr', flex: 1, overflow: 'hidden' }} className="no-print">
        
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
                      .filter(p => (p.full_name || p.patient_name)?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort((a, b) => new Date(a.checkin_at || 0).getTime() - new Date(b.checkin_at || 0).getTime())
                      .map(p => (
                       <div key={p.id} className="leh-table-row" style={{ padding: '20px 24px', borderBottom: '1px solid var(--leh-border-light)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--leh-bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: 'var(--leh-primary)' }}>{(p.full_name || p.patient_name)?.[0]}</div>
                          <div style={{ flex: 1 }}>
                             <div style={{ fontWeight: '800', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               {p.full_name || p.patient_name}
                               <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--leh-text-muted)', background: 'var(--leh-bg-light)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <Clock size={10} /> 
                                 {formatDateStandard(p.checkin_at)} • {new Date(p.checkin_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
          <div className="custom-scrollbar" style={{ 
            flex: 1, 
            overflow: 'auto', 
            background: '#f1f5f9', 
            padding: '48px', 
            display: 'block', 
            position: 'relative' 
          }}>
            {!selectedPatient ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <Stethoscope size={64} style={{ color: 'var(--leh-border)', marginBottom: '24px' }} />
                <h2 style={{ fontSize: '24px', fontWeight: '900' }}>Select Patient to Begin</h2>
                <p style={{ color: 'var(--leh-text-muted)', maxWidth: '400px', marginTop: '12px' }}>Choose a patient from the queue on the left to start their clinical consultation.</p>
              </div>
            ) : (
               <div className="leh-table-card animate-slide-up" style={{ padding: '48px', maxWidth: '1800px', minWidth: '1400px', width: 'fit-content', margin: '0', minHeight: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', borderRadius: '32px', border: '1px solid white', overflow: 'visible' }}>
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
           <div className="leh-modal-content" style={{ maxWidth: '600px' }}>
              <div className="leh-modal-header">
                 <div className="leh-modal-title">
                    <Activity size={28} />
                    <span>Baseline Triage Reference</span>
                 </div>
                 <div className="leh-modal-subtitle">Patient Vital Signs & Critical Alerts History</div>
                 <button className="leh-modal-close" onClick={() => setShowTriageModal(false)}><X size={20} /></button>
              </div>
              <div className="leh-modal-body" style={{ padding: '40px' }}>
                 {triageData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                       <div>
                          <div className="leh-form-section-title" style={{ marginBottom: '24px' }}>Physiological Vitals</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                             <div className="eye-card" style={{ padding: '20px' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Blood Pressure</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                   <span style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>{triageData.bp_systolic}/{triageData.bp_diastolic}</span>
                                   <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>mmHg</span>
                                </div>
                             </div>
                             <div className="eye-card" style={{ padding: '20px' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Pulse Rate</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                   <span style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>{triageData.pulse_rate}</span>
                                   <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>bpm</span>
                                </div>
                             </div>
                             <div className="eye-card" style={{ padding: '20px' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Body Temp</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                   <span style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>{triageData.temperature}</span>
                                   <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>°C</span>
                                </div>
                             </div>
                             <div className="eye-card" style={{ padding: '20px' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Body Weight</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                   <span style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>{triageData.weight}</span>
                                   <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>kg</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div style={{ padding: '24px', background: triageData.allergies ? '#fff1f2' : '#f8fafc', borderRadius: '20px', border: triageData.allergies ? '2px solid #fda4af' : '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                             <AlertTriangle size={20} color={triageData.allergies ? '#e11d48' : '#64748b'} />
                             <span style={{ fontSize: '12px', fontWeight: '900', color: triageData.allergies ? '#e11d48' : '#1e293b', textTransform: 'uppercase' }}>Clinical Alerts & Allergies</span>
                          </div>
                          <p style={{ color: triageData.allergies ? '#be123c' : '#475569', fontSize: '15px', fontWeight: triageData.allergies ? '700' : '500', lineHeight: '1.6', margin: 0 }}>
                             {triageData.allergies || 'Patient reports no known drug or environmental allergies.'}
                          </p>
                       </div>
                    </div>
                 ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                       <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                          <Info size={40} color="#cbd5e1" />
                       </div>
                       <p style={{ fontSize: '16px', fontWeight: '600', color: '#64748b' }}>No triage data available for this visit.</p>
                    </div>
                 )}
              </div>
              <div className="leh-modal-footer">
                 <button className="leh-btn-primary" style={{ width: '100%', height: '54px', borderRadius: '16px' }} onClick={() => setShowTriageModal(false)}>Acknowledge & Close</button>
              </div>
           </div>
        </div>
      )}

      {showSendBackModal && (
        <div className="leh-modal-overlay">
           <div className="leh-modal-content" style={{ maxWidth: '500px' }}>
              <div className="leh-modal-header">
                 <div className="leh-modal-title">
                    <RefreshCcw size={28} style={{ color: '#ef4444' }} />
                    <span>Revert to Triage</span>
                 </div>
                 <div className="leh-modal-subtitle">Patient Queue Reversion Protocol</div>
                 <button className="leh-modal-close" onClick={() => setShowSendBackModal(false)}><X size={20} /></button>
              </div>
              <div className="leh-modal-body" style={{ padding: '40px' }}>
                 <div style={{ display: 'flex', gap: '16px', padding: '20px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2', marginBottom: '32px' }}>
                    <AlertCircle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#991b1b', lineHeight: '1.5', margin: 0 }}>
                       You are about to revert <strong style={{ color: '#000' }}>{selectedPatient?.full_name}</strong> to the Triage Registry. This will reset their consultation status.
                    </p>
                 </div>
                 <div className="leh-form-group">
                    <label className="clinical-label-premium">Reason for Reversion</label>
                    <textarea 
                      className="clinical-textarea" 
                      value={sendBackNote} 
                      onChange={(e) => setSendBackNote(e.target.value)} 
                      placeholder="Specify clinical or administrative reason for reversion..." 
                      style={{ height: '140px' }} 
                    />
                 </div>
              </div>
              <div className="leh-modal-footer">
                 <button className="leh-btn-outline" style={{ flex: 1, height: '54px', borderRadius: '16px', border: '1px solid #e2e8f0' }} onClick={() => setShowSendBackModal(false)}>Cancel</button>
                 <button className="leh-btn-primary" style={{ flex: 1, height: '54px', borderRadius: '16px', background: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }} onClick={handleSendBack}>
                    Confirm Reversion
                 </button>
              </div>
           </div>
      {showHistoryModal && (
        <div className="leh-modal-overlay">
           <div className="leh-modal-content" style={{ maxWidth: '800px' }}>
              <div className="leh-modal-header">
                 <div className="leh-modal-title">
                    <HistoryIcon size={28} style={{ color: 'var(--leh-primary)' }} />
                    <span>Clinical Consultation History</span>
                 </div>
                 <div className="leh-modal-subtitle">Past clinical records for {selectedPatient?.full_name}</div>
                 <button className="leh-modal-close" onClick={() => setShowHistoryModal(false)}><X size={20} /></button>
              </div>
              <div className="leh-modal-body" style={{ padding: '0' }}>
                 {historyList && historyList.filter(h => h.visit_id !== selectedPatient?.visit_id).length > 0 ? (
                    <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '32px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {historyList
                            .filter(h => h.visit_id !== selectedPatient?.visit_id)
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((h, idx) => {
                               let cData: any = {};
                               try { cData = typeof h.clinical_data === 'string' ? JSON.parse(h.clinical_data) : (h.clinical_data || {}); } catch(e) {}
                               
                               return (
                                 <div key={idx} className="eye-card" style={{ padding: '24px', borderLeft: '4px solid var(--leh-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                                       <div>
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Visit Date</span>
                                          <p style={{ margin: 0, fontWeight: '900', color: '#1e293b' }}>{formatDateStandard(h.created_at)}</p>
                                       </div>
                                       <div style={{ textAlign: 'right' }}>
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Clinician</span>
                                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--leh-primary)' }}>{h.consultant_name}</p>
                                       </div>
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                       <span className="leh-label" style={{ fontSize: '10px' }}>PRIMARY DIAGNOSIS</span>
                                       <p style={{ margin: '2px 0 0 0', fontWeight: '800', color: '#059669' }}>{h.primary_diagnosis || 'None recorded'}</p>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                       <div>
                                          <span className="leh-label" style={{ fontSize: '10px' }}>CHIEF COMPLAINT</span>
                                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#475569' }}>{h.complaint || 'N/A'}</p>
                                       </div>
                                       <div>
                                          <span className="leh-label" style={{ fontSize: '10px' }}>MANAGEMENT PLAN</span>
                                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#475569' }}>{h.management_plan || 'N/A'}</p>
                                       </div>
                                    </div>
                                    {cData.plan_meds && cData.plan_meds.length > 0 && (
                                       <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                          <span className="leh-label" style={{ fontSize: '10px' }}>PRESCRIBED MEDICATIONS</span>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                             {cData.plan_meds.map((m: any, i: number) => (
                                                <span key={i} className="leh-status-badge blue" style={{ fontSize: '10px' }}>{m.drug_name} {m.strength} ({m.frequency})</span>
                                             ))}
                                          </div>
                                       </div>
                                    )}
                                 </div>
                               );
                            })
                          }
                       </div>
                    </div>
                 ) : (
                    <div style={{ textAlign: 'center', padding: '80px 32px' }}>
                       <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                          <HistoryIcon size={40} color="#cbd5e1" />
                       </div>
                       <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Previous History</h3>
                       <p style={{ margin: 0, color: '#64748b' }}>This appears to be the first consultation for this patient record.</p>
                    </div>
                 )}
              </div>
              <div className="leh-modal-footer">
                 <button className="leh-btn-primary" style={{ width: '100%', height: '54px', borderRadius: '16px' }} onClick={() => setShowHistoryModal(false)}>Acknowledge & Close</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
export default Consultations;
