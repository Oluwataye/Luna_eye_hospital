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
import './Consultations.css';

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

const getAcuitySeverity = (val: string) => {
  if (!val) return { label: 'Not Tested', color: '#64748b', bg: '#f1f5f9' };
  
  // Near Vision Options
  if (val.startsWith('N')) {
    const num = parseInt(val.substring(1), 10);
    if (num <= 6) return { label: 'Normal Near', color: '#10b981', bg: '#ecfdf5' };
    if (num <= 12) return { label: 'Mild Impairment', color: '#f59e0b', bg: '#fffbeb' };
    if (num <= 24) return { label: 'Mod Impairment', color: '#f97316', bg: '#fff7ed' };
    return { label: 'Severe Impairment', color: '#ef4444', bg: '#fef2f2' };
  }
  
  // Snellen Distance Options
  if (val === '6/6') return { label: 'Normal Vision', color: '#10b981', bg: '#ecfdf5' };
  if (val === '6/9' || val === '6/12') return { label: 'Mild Impairment', color: '#f59e0b', bg: '#fffbeb' };
  if (val === '6/18' || val === '6/24' || val === '6/36') return { label: 'Mod Impairment', color: '#f97316', bg: '#fff7ed' };
  if (val === '6/60' || val === '3/60' || val === '1/60') return { label: 'Severe Impairment', color: '#ef4444', bg: '#fef2f2' };
  if (['CF', 'HM', 'PL', 'NPL'].includes(val)) return { label: 'Profound Impairment', color: '#7c3aed', bg: '#f5f3ff' };
  
  return { label: 'Custom', color: '#64748b', bg: '#f1f5f9' };
};

const VisualAcuitySelector = ({ options, value, onChange, disabled }: { options: string[]; value: string; onChange: (val: string) => void; disabled?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const severity = getAcuitySeverity(value);
  
  // Decide which quick-select options to display based on the type of options list
  const isNear = options.some(opt => /^N\d+/.test(opt));
  const quickOptions = isNear 
    ? ['N5', 'N8', 'N12', 'N18'] 
    : ['6/6', '6/12', '6/60', 'CF', 'NPL'];

  return (
    <div className="va-selector-container">
      {/* Quick Select Chips */}
      <div className="va-chips-wrapper">
        {quickOptions.map(opt => {
          const isSelected = value === opt;
          const optSeverity = getAcuitySeverity(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={`va-quick-chip ${isSelected ? 'active' : ''}`}
              style={{
                '--chip-active-color': optSeverity.color,
                '--chip-active-bg': optSeverity.bg
              } as React.CSSProperties}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Custom Dropdown */}
      <div className="va-dropdown-container">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`va-dropdown-trigger ${isOpen ? 'open' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span 
              className="clinical-indicator-dot" 
              style={{ 
                backgroundColor: severity.color,
                margin: 0,
                width: '10px',
                height: '10px',
                boxShadow: `0 0 6px ${severity.color}80` 
              }} 
            />
            <span style={{ fontWeight: 800, fontSize: '13px' }}>
              {value || 'Not Tested'}
            </span>
            <span className="va-severity-badge" style={{ backgroundColor: severity.bg, color: severity.color }}>
              {severity.label}
            </span>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="chevron-icon"
            style={{ 
              transition: 'transform 0.2s ease', 
              transform: isOpen ? 'rotate(180deg)' : 'none',
              marginLeft: 'auto',
              color: '#94a3b8'
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              style={{ 
                position: 'fixed', 
                inset: 0, 
                zIndex: 999, 
                cursor: 'default' 
              }} 
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }} 
            />
            
            {/* Dropdown Menu */}
            <div className="va-dropdown-menu custom-scrollbar">
              <div className="va-dropdown-header">Select Acuity Value</div>
              
              {options.map(opt => {
                const isItemSel = value === opt;
                const itemSeverity = getAcuitySeverity(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`va-dropdown-item ${isItemSel ? 'active' : ''}`}
                  >
                    <span 
                      className="clinical-indicator-dot" 
                      style={{ 
                        backgroundColor: itemSeverity.color, 
                        margin: 0,
                        width: '8px',
                        height: '8px'
                      }} 
                    />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                      {opt}
                    </span>
                    <span className="va-severity-badge" style={{ backgroundColor: itemSeverity.bg, color: itemSeverity.color, marginLeft: 'auto' }}>
                      {itemSeverity.label}
                    </span>
                  </button>
                );
              })}
              
              <div style={{ padding: '8px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="va-dropdown-clear-btn"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

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
    { id: 'Vision', label: '1. Visual Acuity', icon: Eye },
    { id: 'OcularExam', label: '2. Ocular Examination', icon: Eye },
    { id: 'Refraction', label: '3. Refraction', icon: Glasses },
    { id: 'DilatedFunduscopy', label: '4. Dilated Funduscopy', icon: Droplets },
    { id: 'CVF', label: '5. Confrontation Fields (CVF)', icon: Eye },
    { id: 'Pachymetry', label: '6. Pachymetry', icon: Target },
    { id: 'Investigations', label: '7. Investigations', icon: ClipboardList },
    { id: 'Diagnosis', label: '8. Clinical Diagnosis', icon: Target },
    { id: 'Plan', label: '9. Treatment Plan', icon: Pill },
    { id: 'Surgery', label: '10. Surgery & Admission', icon: Scissors }
  ];
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [triageData, setTriageData] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [sendBackNote, setSendBackNote] = useState('');

  const [labTests, setLabTests] = useState<any[]>([]);
  const [patientInvestigations, setPatientInvestigations] = useState<any[]>([]);
  const [selectedLabTestId, setSelectedLabTestId] = useState<string>('');
  const [commentsState, setCommentsState] = useState<{ [key: number]: string }>({});
  const [isDispatching, setIsDispatching] = useState(false);

  const [drugInventory, setDrugInventory] = useState<any[]>([]);
  const [activeDrugSearchIdx, setActiveDrugSearchIdx] = useState<number | null>(null);
  const [activeSelectionIndex, setActiveSelectionIndex] = useState<number>(0);

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
    investigations_notes: '',
    notes_internal: '', notes_reception: '', notes_nurse: '',
    surgery_advised: false, surgery_type: '', surgery_urgency: 'Elective', surgery_notes: '',
    surgery_date: '', surgery_surgeon: '', surgery_preop: '', surgery_counselled: false, surgery_counsel_notes: '',
    admission_advised: false, admission_reason: '', admission_urgency: 'Routine',
    exam_gonioscopy_od: 'Open Angle (Grade 4)', exam_gonioscopy_os: 'Open Angle (Grade 4)', exam_gonioscopy_notes: '',
    exam_fundus_od: 'Normal', exam_fundus_os: 'Normal', exam_fundus_notes: '',
    cvf_od: 'Full', cvf_os: 'Full', cvf_notes: '',
    pachymetry_od: '', pachymetry_os: '', pachymetry_notes: '',
    investigations_fbs: '', investigations_rbs: '', investigations_hba1c: '', investigations_rvs: 'Not Done'
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
        if ((savedData as any).va_od_unaided_dv) status['Vision'] = true;
        if ((savedData as any).as_lids_od || (savedData as any).iop_od || (savedData as any).exam_gonioscopy_od) status['OcularExam'] = true;
        if ((savedData as any).ref_od_sph) status['Refraction'] = true;
        if ((savedData as any).dil_adequate || (savedData as any).fs_disc_cdr_od) status['DilatedFunduscopy'] = true;
        if ((savedData as any).cvf_od) status['CVF'] = true;
        if ((savedData as any).pachymetry_od) status['Pachymetry'] = true;
        if ((savedData as any).investigations_fbs || (savedData as any).patientInvestigations?.length > 0) status['Investigations'] = true;
        if ((savedData as any).diagnosis_primary) status['Diagnosis'] = true;
        if ((savedData as any).plan_meds?.length > 0) status['Plan'] = true;
        if ((savedData as any).surgery_advised || (savedData as any).admission_advised) status['Surgery'] = true;
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

  // Load lab/diagnostic & drug inventory items
  useEffect(() => {
    api.getInventory().then((items: any[]) => {
      const tests = items.filter((i: any) =>
        ['laboratory', 'test', 'lab test', 'diagnostic'].includes((i.category || '').toLowerCase())
      );
      setLabTests(tests);
      const drugs = items.filter((i: any) =>
        ['drugs', 'medication', 'drug', 'pharmacy'].includes((i.category || '').toLowerCase())
      );
      setDrugInventory(drugs);
    }).catch(console.warn);
  }, []);

  const loadPatientInvestigations = useCallback(async (patientId: string) => {
    try {
      const data = await api.getInvestigations(patientId);
      const list = Array.isArray(data) ? data : [];
      setPatientInvestigations(list);
      // Seed local comment state from saved medical_comments
      const seed: { [key: number]: string } = {};
      list.forEach((inv: any) => { seed[inv.id] = inv.medical_comments || ''; });
      setCommentsState(seed);
    } catch (err) {
      console.warn('Failed to load patient investigations:', err);
    }
  }, []);

  const handleDispatchTest = async () => {
    if (!selectedLabTestId || !selectedPatient) return;
    const test = labTests.find((t: any) => String(t.id) === String(selectedLabTestId));
    if (!test) return;
    setIsDispatching(true);
    try {
      await api.requestInvestigation({
        patient_id: selectedPatient.patient_id || selectedPatient.id,
        test_name: test.name,
        requested_by: user?.full_name || 'Clinician',
        inventory_id: test.id,
        unit: test.unit || '',
        reference_range: test.reference_range || ''
      });
      notify('success', `Test dispatched to LIS: ${test.name}`);
      setSelectedLabTestId('');
      await loadPatientInvestigations(selectedPatient.patient_id || selectedPatient.id);
    } catch (err: any) {
      notify('error', `Failed to dispatch test: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSaveComment = async (invId: number) => {
    try {
      await api.updateInvestigationResult(invId, { medical_comments: commentsState[invId] || '' });
      notify('success', 'Clinician comment saved');
      if (selectedPatient) {
        await loadPatientInvestigations(selectedPatient.patient_id || selectedPatient.id);
      }
    } catch (err: any) {
      notify('error', `Failed to save comment: ${err.message}`);
    }
  };

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
      setSelectedLabTestId(''); // Reset test selection
      await loadPatientInvestigations(p.patient_id || p.id);
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
    if (section === 'OcularExam') {
      normalValues.as_lids_od = 'Normal'; normalValues.as_lids_os = 'Normal';
      normalValues.as_conj_od = 'Normal'; normalValues.as_conj_os = 'Normal';
      normalValues.as_cornea_od = 'Clear'; normalValues.as_cornea_os = 'Clear';
      normalValues.as_ac_depth_od = 'Normal'; normalValues.as_ac_depth_os = 'Normal';
      normalValues.as_ac_cells_od = 'None'; normalValues.as_ac_cells_os = 'None';
      normalValues.as_iris_od = 'Normal'; normalValues.as_iris_os = 'Normal';
      normalValues.as_lens_od = 'Clear'; normalValues.as_lens_os = 'Clear';
      normalValues.exam_gonioscopy_od = 'Open Angle (Grade 4)'; normalValues.exam_gonioscopy_os = 'Open Angle (Grade 4)';
      normalValues.exam_fundus_od = 'Normal'; normalValues.exam_fundus_os = 'Normal';
    } else if (section === 'DilatedFunduscopy') {
      normalValues.dil_adequate = 'Adequate';
      normalValues.dil_od = 'Yes'; normalValues.dil_os = 'Yes';
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
         missing.push('Section 1: Chief Complaint (min 5 chars)');
       }
        if (!formData.diagnosis_primary?.trim()) {
          missing.push('Section 8: Primary Diagnosis');
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
                   <select className="clinical-input" name="va_method" value={formData.va_method} onChange={handleInputChange} style={{ height: '40px', width: '180px' }} disabled={isLocked}>
                      <option>Snellen Chart</option>
                      <option>LogMAR</option>
                      <option>Allen Pictures</option>
                      <option>LEA Symbols</option>
                   </select>
                </div>
              </div>

              <ODSideBySide 
                childrenOD={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <span className="clinical-label-premium" style={{ fontSize: '12px', color: 'var(--leh-primary)', marginBottom: '8px', display: 'block' }}>DISTANCE VISION</span>
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Unaided (DV)</label>
                          <VisualAcuitySelector 
                            options={SNELLEN_OPTIONS} 
                            value={formData.va_od_unaided_dv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_od_unaided_dv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Aided (DV)</label>
                          <VisualAcuitySelector 
                            options={SNELLEN_OPTIONS} 
                            value={formData.va_od_aided_dv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_od_aided_dv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <span className="clinical-label-premium" style={{ fontSize: '12px', color: 'var(--leh-primary)', marginBottom: '8px', display: 'block' }}>NEAR VISION</span>
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Unaided (NV)</label>
                          <VisualAcuitySelector 
                            options={['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48']} 
                            value={formData.va_od_unaided_nv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_od_unaided_nv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Aided (NV)</label>
                          <VisualAcuitySelector 
                            options={['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48']} 
                            value={formData.va_od_aided_nv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_od_aided_nv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <span className="clinical-label-premium" style={{ fontSize: '12px', color: 'var(--leh-primary)', marginBottom: '8px', display: 'block' }}>PINHOLE (PH)</span>
                      <VisualAcuitySelector 
                        options={SNELLEN_OPTIONS} 
                        value={formData.va_od_ph} 
                        onChange={(val) => {
                          setFormData((prev: any) => ({ ...prev, va_od_ph: val }));
                          setIsDirty(true);
                        }}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                }
                childrenOS={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <span className="clinical-label-premium" style={{ fontSize: '12px', color: 'var(--leh-primary)', marginBottom: '8px', display: 'block' }}>DISTANCE VISION</span>
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Unaided (DV)</label>
                          <VisualAcuitySelector 
                            options={SNELLEN_OPTIONS} 
                            value={formData.va_os_unaided_dv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_os_unaided_dv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Aided (DV)</label>
                          <VisualAcuitySelector 
                            options={SNELLEN_OPTIONS} 
                            value={formData.va_os_aided_dv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_os_aided_dv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <span className="clinical-label-premium" style={{ fontSize: '12px', color: 'var(--leh-primary)', marginBottom: '8px', display: 'block' }}>NEAR VISION</span>
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Unaided (NV)</label>
                          <VisualAcuitySelector 
                            options={['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48']} 
                            value={formData.va_os_unaided_nv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_os_unaided_nv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                        <div>
                          <label className="clinical-label-premium" style={{ fontSize: '10px', color: '#64748b' }}>Aided (NV)</label>
                          <VisualAcuitySelector 
                            options={['N5', 'N6', 'N8', 'N10', 'N12', 'N14', 'N18', 'N24', 'N36', 'N48']} 
                            value={formData.va_os_aided_nv} 
                            onChange={(val) => {
                              setFormData((prev: any) => ({ ...prev, va_os_aided_nv: val }));
                              setIsDirty(true);
                            }}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <span className="clinical-label-premium" style={{ fontSize: '12px', color: 'var(--leh-primary)', marginBottom: '8px', display: 'block' }}>PINHOLE (PH)</span>
                      <VisualAcuitySelector 
                        options={SNELLEN_OPTIONS} 
                        value={formData.va_os_ph} 
                        onChange={(val) => {
                          setFormData((prev: any) => ({ ...prev, va_os_ph: val }));
                          setIsDirty(true);
                        }}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                }
              />

              <div className="leh-form-group" style={{ marginTop: '32px' }}>
                <label className="clinical-label-premium">Visual Acuity Clinical Notes</label>
                <textarea 
                  className="clinical-textarea" 
                  name="va_notes" 
                  value={formData.va_notes} 
                  onChange={handleInputChange} 
                  placeholder="Enter any notes on visual acuity, test behaviors, anomalies..."
                  disabled={isLocked}
                  style={{ height: '80px' }}
                />
              </div>

            </div>
          </div>
        );
      case 'OcularExam':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 2: Ocular Examination" icon={Eye} onMarkNormal={() => markSectionNormal('OcularExam')} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Slit Lamp Biomicroscopy</div>
              </div>
              
              <div style={{ display: 'grid', gap: '32px' }}>
                <ODSideBySide label="LIDS & ADNEXA" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lids_od" value={formData.as_lids_od} onChange={handleInputChange} disabled={isLocked}>{LIDS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lids_notes_od" value={formData.as_lids_notes_od} onChange={handleInputChange} placeholder="Lid notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lids_os" value={formData.as_lids_os} onChange={handleInputChange} disabled={isLocked}>{LIDS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lids_notes_os" value={formData.as_lids_notes_os} onChange={handleInputChange} placeholder="Lid notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />
                <ODSideBySide label="CONJUNCTIVA / SCLERA" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_conj_od" value={formData.as_conj_od} onChange={handleInputChange} disabled={isLocked}>{CONJ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_conj_notes_od" value={formData.as_conj_notes_od} onChange={handleInputChange} placeholder="Conj notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_conj_os" value={formData.as_conj_os} onChange={handleInputChange} disabled={isLocked}>{CONJ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_conj_notes_os" value={formData.as_conj_notes_os} onChange={handleInputChange} placeholder="Conj notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />
                <ODSideBySide label="CORNEA / TEAR FILM" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_cornea_od" value={formData.as_cornea_od} onChange={handleInputChange} disabled={isLocked}>{CORNEA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_cornea_notes_od" value={formData.as_cornea_notes_od} onChange={handleInputChange} placeholder="Cornea notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_cornea_os" value={formData.as_cornea_os} onChange={handleInputChange} disabled={isLocked}>{CORNEA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_cornea_notes_os" value={formData.as_cornea_notes_os} onChange={handleInputChange} placeholder="Cornea notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />
                <ODSideBySide label="ANTERIOR CHAMBER" 
                  childrenOD={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <ClinicalField label="Depth"><select className="clinical-input" name="as_ac_depth_od" value={formData.as_ac_depth_od} onChange={handleInputChange} disabled={isLocked}>{AC_DEPTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      <ClinicalField label="Cells"><select className="clinical-input" name="as_ac_cells_od" value={formData.as_ac_cells_od} onChange={handleInputChange} disabled={isLocked}>{AC_CELLS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                  childrenOS={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <ClinicalField label="Depth"><select className="clinical-input" name="as_ac_depth_os" value={formData.as_ac_depth_os} onChange={handleInputChange} disabled={isLocked}>{AC_DEPTH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      <ClinicalField label="Cells"><select className="clinical-input" name="as_ac_cells_os" value={formData.as_ac_cells_os} onChange={handleInputChange} disabled={isLocked}>{AC_CELLS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                />
                <ODSideBySide label="IRIS / PUPIL" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_iris_od" value={formData.as_iris_od} onChange={handleInputChange} disabled={isLocked}>{IRIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_iris_notes_od" value={formData.as_iris_notes_od} onChange={handleInputChange} placeholder="Iris notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_iris_os" value={formData.as_iris_os} onChange={handleInputChange} disabled={isLocked}>{IRIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_iris_notes_os" value={formData.as_iris_notes_os} onChange={handleInputChange} placeholder="Iris notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />
                <ODSideBySide label="LENS (Cataract Grading)" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lens_od" value={formData.as_lens_od} onChange={handleInputChange} disabled={isLocked}>{LENS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lens_notes_od" value={formData.as_lens_notes_od} onChange={handleInputChange} placeholder="Lens notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="as_lens_os" value={formData.as_lens_os} onChange={handleInputChange} disabled={isLocked}>{LENS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="as_lens_notes_os" value={formData.as_lens_notes_os} onChange={handleInputChange} placeholder="Lens notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />

                <div className="clinical-group-header" style={{ marginTop: '40px', marginBottom: '32px' }}>
                  <div className="clinical-group-title">Tonometry & IOP</div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>METHOD:</span>
                     <select className="clinical-input" name="iop_method" value={formData.iop_method} onChange={handleInputChange} style={{ height: '40px', width: '220px' }} disabled={isLocked}>
                        <option>Non-contact Tonometer</option>
                        <option>Goldmann Applanation</option>
                        <option>Tono-Pen</option>
                        <option>iCare</option>
                     </select>
                  </div>
                </div>
                
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
                      <input type="number" className="clinical-input" name="iop_os" value={formData.iop_os} onChange={handleInputChange} placeholder="0" style={{ border: formData.iop_os > 21 ? '2px solid #ef4444' : '', background: formData.iop_os > 21 ? '#fff1f2' : '', paddingRight: '60px' }} disabled={isLocked} />
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>mmHg</span>
                      {formData.iop_os > 21 && <div className="clinical-indicator-dot dot-elevated" style={{ position: 'absolute', right: '4px', top: '4px' }}></div>}
                    </div>
                  }
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px' }}>
                   <div className="leh-form-group">
                      <label className="clinical-label-premium">Time of Measurement</label>
                      <input type="time" className="clinical-input" name="iop_time" value={formData.iop_time} onChange={handleInputChange} disabled={isLocked} />
                   </div>
                   <div className="leh-form-group">
                      <label className="clinical-label-premium">Tonometry Observations</label>
                      <input type="text" className="clinical-input" name="iop_notes" value={formData.iop_notes} onChange={handleInputChange} placeholder="Asymmetry, corneal thickness corrections..." disabled={isLocked} />
                   </div>
                </div>

                <div className="clinical-group-header" style={{ marginTop: '40px', marginBottom: '32px' }}>
                  <div className="clinical-group-title">Gonioscopy</div>
                </div>
                <ODSideBySide label="GONIOSCOPY" 
                  childrenOD={
                    <select className="clinical-input" name="exam_gonioscopy_od" value={formData.exam_gonioscopy_od} onChange={handleInputChange} disabled={isLocked}>
                      <option value="">Select Grade/Findings</option>
                      <option value="Open Angle (Grade 4)">Open Angle (Grade 4)</option>
                      <option value="Open Angle (Grade 3)">Open Angle (Grade 3)</option>
                      <option value="Narrow Angle (Grade 2)">Narrow Angle (Grade 2)</option>
                      <option value="Narrow Angle (Grade 1)">Narrow Angle (Grade 1)</option>
                      <option value="Closed Angle (Grade 0)">Closed Angle (Grade 0)</option>
                      <option value="PAS (Peripheral Anterior Synechiae)">PAS (Peripheral Anterior Synechiae)</option>
                      <option value="Neovascularization">Neovascularization</option>
                      <option value="Other">Other</option>
                    </select>
                  }
                  childrenOS={
                    <select className="clinical-input" name="exam_gonioscopy_os" value={formData.exam_gonioscopy_os} onChange={handleInputChange} disabled={isLocked}>
                      <option value="">Select Grade/Findings</option>
                      <option value="Open Angle (Grade 4)">Open Angle (Grade 4)</option>
                      <option value="Open Angle (Grade 3)">Open Angle (Grade 3)</option>
                      <option value="Narrow Angle (Grade 2)">Narrow Angle (Grade 2)</option>
                      <option value="Narrow Angle (Grade 1)">Narrow Angle (Grade 1)</option>
                      <option value="Closed Angle (Grade 0)">Closed Angle (Grade 0)</option>
                      <option value="PAS (Peripheral Anterior Synechiae)">PAS (Peripheral Anterior Synechiae)</option>
                      <option value="Neovascularization">Neovascularization</option>
                      <option value="Other">Other</option>
                    </select>
                  }
                />
                <div className="leh-form-group" style={{ marginTop: '16px' }}>
                   <label className="clinical-label-premium">Gonioscopy Notes</label>
                   <input type="text" className="clinical-input" name="exam_gonioscopy_notes" value={formData.exam_gonioscopy_notes} onChange={handleInputChange} placeholder="Angle structure details, pigmentation, etc..." disabled={isLocked} />
                </div>

                <div className="clinical-group-header" style={{ marginTop: '40px', marginBottom: '32px' }}>
                  <div className="clinical-group-title">Undilated Fundus Examination</div>
                </div>
                <ODSideBySide label="FUNDUS FINDINGS" 
                  childrenOD={
                    <select className="clinical-input" name="exam_fundus_od" value={formData.exam_fundus_od} onChange={handleInputChange} disabled={isLocked}>
                      <option value="Normal">Normal</option>
                      <option value="Optic Disc Cupping">Optic Disc Cupping</option>
                      <option value="Macular Degeneration">Macular Degeneration</option>
                      <option value="Retinal Hemorrhage">Retinal Hemorrhage</option>
                      <option value="Exudates">Exudates</option>
                      <option value="Drusen">Drusen</option>
                      <option value="Vessel Attenuation">Vessel Attenuation</option>
                      <option value="Other">Other</option>
                    </select>
                  }
                  childrenOS={
                    <select className="clinical-input" name="exam_fundus_os" value={formData.exam_fundus_os} onChange={handleInputChange} disabled={isLocked}>
                      <option value="Normal">Normal</option>
                      <option value="Optic Disc Cupping">Optic Disc Cupping</option>
                      <option value="Macular Degeneration">Macular Degeneration</option>
                      <option value="Retinal Hemorrhage">Retinal Hemorrhage</option>
                      <option value="Exudates">Exudates</option>
                      <option value="Drusen">Drusen</option>
                      <option value="Vessel Attenuation">Vessel Attenuation</option>
                      <option value="Other">Other</option>
                    </select>
                  }
                />
                <div className="leh-form-group" style={{ marginTop: '16px' }}>
                   <label className="clinical-label-premium">Undilated Fundus Notes</label>
                   <input type="text" className="clinical-input" name="exam_fundus_notes" value={formData.exam_fundus_notes} onChange={handleInputChange} placeholder="General posterior pole observations..." disabled={isLocked} />
                </div>

              </div>
            </div>
          </div>
        );
      case 'Refraction':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 3: Refraction (Objective/Subjective)" icon={Glasses} onSave={() => handleSave(false)} isSaving={isSaving} />
            
            <div style={{ display: 'grid', gap: '32px' }}>
              <div className="clinical-section-card">
                <div className="clinical-group-header" style={{ marginBottom: '24px' }}>
                   <div className="clinical-group-title">Objective Refraction (AR/K)</div>
                </div>
                <ODSideBySide label="REFRACTION (Sph / Cyl x Axis)" 
                   childrenOD={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input className="clinical-input" name="ref_od_sph" value={formData.ref_od_sph} onChange={handleInputChange} placeholder="SPH" disabled={isLocked} />
                      <input className="clinical-input" name="ref_od_cyl" value={formData.ref_od_cyl} onChange={handleInputChange} placeholder="CYL" disabled={isLocked} />
                      <input className="clinical-input" name="ref_od_axis" value={formData.ref_od_axis} onChange={handleInputChange} placeholder="AXIS" disabled={isLocked} />
                    </div>
                   }
                   childrenOS={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input className="clinical-input" name="ref_os_sph" value={formData.ref_os_sph} onChange={handleInputChange} placeholder="SPH" disabled={isLocked} />
                      <input className="clinical-input" name="ref_os_cyl" value={formData.ref_os_cyl} onChange={handleInputChange} placeholder="CYL" disabled={isLocked} />
                      <input className="clinical-input" name="ref_os_axis" value={formData.ref_os_axis} onChange={handleInputChange} placeholder="AXIS" disabled={isLocked} />
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
                      childrenOD={<div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px' }}><input className="clinical-input" name="ref_od_subjective_dv" value={formData.ref_od_subjective_dv} onChange={handleInputChange} placeholder="OD RX" disabled={isLocked} /><input className="clinical-input" name="ref_od_va" value={formData.ref_od_va} onChange={handleInputChange} placeholder="VA" disabled={isLocked} /></div>}
                      childrenOS={<div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px' }}><input className="clinical-input" name="ref_os_subjective_dv" value={formData.ref_os_subjective_dv} onChange={handleInputChange} placeholder="OS RX" disabled={isLocked} /><input className="clinical-input" name="ref_os_va" value={formData.ref_os_va} onChange={handleInputChange} placeholder="VA" disabled={isLocked} /></div>}
                   />
                   <ODSideBySide label="NEAR ADDITION" 
                      childrenOD={<input className="clinical-input" name="ref_od_near_add" value={formData.ref_od_near_add} onChange={handleInputChange} placeholder="OD Add" disabled={isLocked} />}
                      childrenOS={<input className="clinical-input" name="ref_os_near_add" value={formData.ref_os_near_add} onChange={handleInputChange} placeholder="OS Add" disabled={isLocked} />}
                   />
                </div>
              </div>
            </div>
          </div>
        );
      case 'DilatedFunduscopy':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 4: Dilated Funduscopy" icon={Droplets} onMarkNormal={() => markSectionNormal('DilatedFunduscopy')} onSave={() => handleSave(false)} isSaving={isSaving} />
            
            {/* Dilation Details */}
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Mydriatic Administration</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
                <div className="leh-form-group">
                   <label className="clinical-label-premium">Dilation Drops Used</label>
                   <select className="clinical-input" name="dil_agent" value={formData.dil_agent} onChange={handleInputChange} disabled={isLocked}>
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
                   <input type="time" className="clinical-input" name="dil_time_od" value={formData.dil_time_od} onChange={handleInputChange} disabled={isLocked} />
                </div>
              </div>
              <div style={{ marginTop: '32px' }}>
                <ODSideBySide label="DILATED?" 
                   childrenOD={
                    <select className="clinical-input" name="dil_od" value={formData.dil_od} onChange={handleInputChange} disabled={isLocked}>
                       <option value="No">No</option><option value="Yes">Yes</option>
                    </select>
                   }
                   childrenOS={
                    <select className="clinical-input" name="dil_os" value={formData.dil_os} onChange={handleInputChange} disabled={isLocked}>
                       <option value="No">No</option><option value="Yes">Yes</option>
                    </select>
                   }
                />
              </div>
              <div style={{ marginTop: '32px' }}>
                <ODSideBySide label="DILATED VA" 
                   childrenOD={
                    <input className="clinical-input" name="dil_va_od" value={formData.dil_va_od} onChange={handleInputChange} placeholder="OD VA" disabled={isLocked} />
                   }
                   childrenOS={
                    <input className="clinical-input" name="dil_va_os" value={formData.dil_va_os} onChange={handleInputChange} placeholder="OS VA" disabled={isLocked} />
                   }
                />
              </div>
              <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
                <div className="leh-form-group">
                  <label className="clinical-label-premium">Dilation Adequacy</label>
                  <select className="clinical-input" name="dil_adequate" value={formData.dil_adequate} onChange={handleInputChange} disabled={isLocked}>
                    <option value="Adequate">Adequate</option>
                    <option value="Inadequate">Inadequate</option>
                  </select>
                </div>
                <div className="leh-form-group">
                  <label className="clinical-label-premium">Dilation Notes</label>
                  <input type="text" className="clinical-input" name="dil_notes" value={formData.dil_notes} onChange={handleInputChange} placeholder="Reaction details, drop frequency, etc..." disabled={isLocked} />
                </div>
              </div>
            </div>

            {/* Fundoscopy findings */}
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Posterior Segment Evaluation</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>METHOD:</span>
                   <select className="clinical-input" name="fs_method" value={formData.fs_method} onChange={handleInputChange} style={{ height: '40px', width: '220px' }} disabled={isLocked}>
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
                        <ClinicalField label="CDR"><input className="clinical-input" name="fs_disc_cdr_od" value={formData.fs_disc_cdr_od} onChange={handleInputChange} placeholder="0.3" disabled={isLocked} /></ClinicalField>
                        <ClinicalField label="Margin"><select className="clinical-input" name="fs_disc_margins_od" value={formData.fs_disc_margins_od} onChange={handleInputChange} disabled={isLocked}>{DISC_MARGIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      </div>
                      <ClinicalField label="Color"><select className="clinical-input" name="fs_disc_color_od" value={formData.fs_disc_color_od} onChange={handleInputChange} disabled={isLocked}>{DISC_COLOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                  childrenOS={
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <ClinicalField label="CDR"><input className="clinical-input" name="fs_disc_cdr_os" value={formData.fs_disc_cdr_os} onChange={handleInputChange} placeholder="0.3" disabled={isLocked} /></ClinicalField>
                        <ClinicalField label="Margin"><select className="clinical-input" name="fs_disc_margins_os" value={formData.fs_disc_margins_os} onChange={handleInputChange} disabled={isLocked}>{DISC_MARGIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                      </div>
                      <ClinicalField label="Color"><select className="clinical-input" name="fs_disc_color_os" value={formData.fs_disc_color_os} onChange={handleInputChange} disabled={isLocked}>{DISC_COLOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></ClinicalField>
                    </div>
                  }
                />
                <ODSideBySide label="MACULA / FOVEA" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_macula_od" value={formData.fs_macula_od} onChange={handleInputChange} disabled={isLocked}>{MACULA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="fs_macula_notes_od" value={formData.fs_macula_notes_od} onChange={handleInputChange} placeholder="Macula notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_macula_os" value={formData.fs_macula_os} onChange={handleInputChange} disabled={isLocked}>{MACULA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><input className="clinical-input" name="fs_macula_notes_os" value={formData.fs_macula_notes_os} onChange={handleInputChange} placeholder="Macula notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />
                <ODSideBySide label="RETINAL VESSELS" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><input className="clinical-input" name="fs_vessels_av_od" value={formData.fs_vessels_av_od} onChange={handleInputChange} placeholder="A/V 2:3" disabled={isLocked} /><select className="clinical-input" name="fs_vessels_nipping_od" value={formData.fs_vessels_nipping_od} onChange={handleInputChange} disabled={isLocked}><option value="Absent">AV Nipping: Absent</option><option value="Present">AV Nipping: Present</option></select></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><input className="clinical-input" name="fs_vessels_av_os" value={formData.fs_vessels_av_os} onChange={handleInputChange} placeholder="A/V 2:3" disabled={isLocked} /><select className="clinical-input" name="fs_vessels_nipping_os" value={formData.fs_vessels_nipping_os} onChange={handleInputChange} disabled={isLocked}><option value="Absent">AV Nipping: Absent</option><option value="Present">AV Nipping: Present</option></select></div>}
                />
                <ODSideBySide label="PERIPHERY" 
                  childrenOD={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_periph_od" value={formData.fs_periph_od} onChange={handleInputChange} disabled={isLocked}><option value="Normal">Normal</option><option value="Break/Tear">Break/Tear</option><option value="Detachment">Detachment</option><option value="Lattice">Lattice</option><option value="Other">Other</option></select><input className="clinical-input" name="fs_periph_notes_od" value={formData.fs_periph_notes_od} onChange={handleInputChange} placeholder="Periph notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                  childrenOS={<div style={{ display: 'grid', gap: '8px' }}><select className="clinical-input" name="fs_periph_os" value={formData.fs_periph_os} onChange={handleInputChange} disabled={isLocked}><option value="Normal">Normal</option><option value="Break/Tear">Break/Tear</option><option value="Detachment">Detachment</option><option value="Lattice">Lattice</option><option value="Other">Other</option></select><input className="clinical-input" name="fs_periph_notes_os" value={formData.fs_periph_notes_os} onChange={handleInputChange} placeholder="Periph notes..." style={{ height: '38px', fontSize: '12px' }} disabled={isLocked} /></div>}
                />
                <div className="leh-form-group">
                   <label className="clinical-label-premium">Posterior Segment Summary</label>
                   <textarea className="clinical-textarea" name="fs_summary" value={formData.fs_summary} onChange={handleInputChange} placeholder="Overall posterior pole assessment..." style={{ height: '80px' }} disabled={isLocked} />
                </div>
              </div>
            </div>
          </div>
        );
      case 'CVF':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 5: Confrontation Visual Field (CVF)" icon={Eye} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Confrontation Fields</div>
              </div>
              <ODSideBySide label="CONFRONTATION FIELDS" 
                childrenOD={
                  <select className="clinical-input" name="cvf_od" value={formData.cvf_od} onChange={handleInputChange} disabled={isLocked}>
                    <option value="Full">Full / Normal</option>
                    <option value="Temporal Hemianopia">Temporal Hemianopia</option>
                    <option value="Nasal Defect">Nasal Defect</option>
                    <option value="Altitudinal Defect">Altitudinal Defect</option>
                    <option value="Scotoma">Scotoma</option>
                    <option value="Constricted">Constricted</option>
                    <option value="Other">Other</option>
                  </select>
                }
                childrenOS={
                  <select className="clinical-input" name="cvf_os" value={formData.cvf_os} onChange={handleInputChange} disabled={isLocked}>
                    <option value="Full">Full / Normal</option>
                    <option value="Temporal Hemianopia">Temporal Hemianopia</option>
                    <option value="Nasal Defect">Nasal Defect</option>
                    <option value="Altitudinal Defect">Altitudinal Defect</option>
                    <option value="Scotoma">Scotoma</option>
                    <option value="Constricted">Constricted</option>
                    <option value="Other">Other</option>
                  </select>
                }
              />
              <div className="leh-form-group" style={{ marginTop: '24px' }}>
                 <label className="clinical-label-premium">CVF Clinical Notes</label>
                 <textarea className="clinical-textarea" name="cvf_notes" value={formData.cvf_notes} onChange={handleInputChange} placeholder="Describe any field defects or visual field details..." style={{ height: '80px' }} disabled={isLocked} />
              </div>
            </div>
          </div>
        );
      case 'Pachymetry':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 6: Corneal Pachymetry" icon={Target} onSave={() => handleSave(false)} isSaving={isSaving} />
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '32px' }}>
                <div className="clinical-group-title">Central Corneal Thickness (CCT)</div>
              </div>
              <ODSideBySide label="CORNEAL THICKNESS (µm)" 
                childrenOD={
                  <div style={{ position: 'relative' }}>
                    <input type="number" className="clinical-input" name="pachymetry_od" value={formData.pachymetry_od} onChange={handleInputChange} placeholder="e.g. 545" style={{ paddingRight: '50px' }} disabled={isLocked} />
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>µm</span>
                  </div>
                }
                childrenOS={
                  <div style={{ position: 'relative' }}>
                    <input type="number" className="clinical-input" name="pachymetry_os" value={formData.pachymetry_os} onChange={handleInputChange} placeholder="e.g. 545" style={{ paddingRight: '50px' }} disabled={isLocked} />
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>µm</span>
                  </div>
                }
              />
              <div className="leh-form-group" style={{ marginTop: '24px' }}>
                 <label className="clinical-label-premium">Pachymetry Clinical Notes</label>
                 <textarea className="clinical-textarea" name="pachymetry_notes" value={formData.pachymetry_notes} onChange={handleInputChange} placeholder="Enter any notes on corneal thickness or glaucoma corrections..." style={{ height: '80px' }} disabled={isLocked} />
              </div>
            </div>
          </div>
        );
      case 'Investigations':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 7: Investigations & Laboratory" icon={ClipboardList} onSave={() => handleSave(false)} isSaving={isSaving} />

            {/* Point-of-Care / Rapid Tests */}
            <div className="clinical-section-card" style={{ marginBottom: '24px' }}>
              <div className="clinical-group-header">
                <div className="clinical-group-title">Point-of-Care / Rapid Investigations</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '16px' }}>
                <div className="leh-form-group">
                  <label className="clinical-label-premium">FBS (Fasting Blood Sugar)</label>
                  <input type="text" className="clinical-input" name="investigations_fbs" value={formData.investigations_fbs} onChange={handleInputChange} placeholder="e.g. 95 mg/dL" disabled={isLocked} />
                </div>
                <div className="leh-form-group">
                  <label className="clinical-label-premium">RBS (Random Blood Sugar)</label>
                  <input type="text" className="clinical-input" name="investigations_rbs" value={formData.investigations_rbs} onChange={handleInputChange} placeholder="e.g. 120 mg/dL" disabled={isLocked} />
                </div>
                <div className="leh-form-group">
                  <label className="clinical-label-premium">HbA1c</label>
                  <input type="text" className="clinical-input" name="investigations_hba1c" value={formData.investigations_hba1c} onChange={handleInputChange} placeholder="e.g. 5.7%" disabled={isLocked} />
                </div>
                <div className="leh-form-group">
                  <label className="clinical-label-premium">RVS (Retroviral Screening)</label>
                  <select className="clinical-input" name="investigations_rvs" value={formData.investigations_rvs} onChange={handleInputChange} disabled={isLocked}>
                    <option value="Not Done">Not Done</option>
                    <option value="Non-Reactive">Non-Reactive</option>
                    <option value="Reactive">Reactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Dispatch Panel ── */}
            <div className="clinical-section-card" style={{ marginBottom: '24px' }}>
              <div className="clinical-group-header">
                <div className="clinical-group-title">Dispatch Lab Test to LIS</div>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--leh-text-muted)' }}>
                  {labTests.length === 0 ? 'No lab items found in inventory — add items under category "Laboratory"' : `${labTests.length} test(s) available`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="clinical-label-premium">Select Test</label>
                  <select
                    className="clinical-input"
                    value={selectedLabTestId}
                    onChange={(e) => setSelectedLabTestId(e.target.value)}
                    disabled={isLocked || labTests.length === 0}
                  >
                    <option value="">-- Choose a lab test --</option>
                    {labTests.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}{t.selling_price ? ` — ₦${Number(t.selling_price).toLocaleString()}` : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="leh-btn-primary"
                  onClick={handleDispatchTest}
                  disabled={!selectedLabTestId || isDispatching || isLocked}
                  style={{ height: '44px', padding: '0 24px', whiteSpace: 'nowrap' }}
                >
                  {isDispatching ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  DISPATCH TEST
                </button>
                <button
                  className="leh-btn-outline"
                  onClick={() => selectedPatient && loadPatientInvestigations(selectedPatient.patient_id || selectedPatient.id)}
                  style={{ height: '44px', padding: '0 14px' }}
                  title="Refresh investigations list"
                >
                  <RefreshCcw size={16} />
                </button>
              </div>
            </div>

            {/* ── Investigations Table ── */}
            <div className="clinical-section-card">
              <div className="clinical-group-header" style={{ marginBottom: '16px' }}>
                <div className="clinical-group-title">Requested Investigations</div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--leh-text-muted)' }}>
                  {patientInvestigations.length} test(s) on record
                </span>
              </div>

              {patientInvestigations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--leh-text-muted)' }}>
                  <ClipboardList size={40} style={{ opacity: 0.25, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px' }}>No investigations requested for this patient yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {patientInvestigations.map((inv: any) => {
                    const isPaid = inv.billing_status === 'Paid';
                    const isCompleted = inv.status === 'Completed';
                    const canComment = user?.role === 'Admin' || user?.role === 'Optometrist';
                    const borderColor = isPaid ? (isCompleted ? '#10b981' : '#2563eb') : '#f59e0b';
                    return (
                      <div
                        key={inv.id}
                        className="eye-card"
                        style={{ padding: '20px', borderLeft: `4px solid ${borderColor}`, position: 'relative' }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>
                          {/* Test Info */}
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--leh-text-dark)', marginBottom: '4px' }}>
                              {inv.test_name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>
                              Requested: {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'} &middot; By: {inv.requested_by || '—'}
                            </div>
                            {inv.test_value && (
                              <div style={{ marginTop: '8px', padding: '6px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                                Result: {inv.test_value}{inv.unit ? ` ${inv.unit}` : ''}
                                {inv.reference_range && <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '400' }}> (Ref: {inv.reference_range})</span>}
                              </div>
                            )}
                          </div>

                          {/* Test Status */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span className="clinical-label-premium" style={{ fontSize: '9px' }}>TEST STATUS</span>
                            <span style={{
                              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', display: 'inline-block',
                              background: isCompleted ? '#d1fae5' : '#fef3c7',
                              color: isCompleted ? '#065f46' : '#92400e'
                            }}>
                              {inv.status || 'Pending'}
                            </span>
                          </div>

                          {/* Billing Status */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span className="clinical-label-premium" style={{ fontSize: '9px' }}>BILLING</span>
                            <span style={{
                              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', display: 'inline-block',
                              background: isPaid ? '#d1fae5' : '#fee2e2',
                              color: isPaid ? '#065f46' : '#991b1b'
                            }}>
                              {isPaid ? '✓ Paid' : '⚠ Unpaid'}
                            </span>
                            {!isPaid && <span style={{ fontSize: '10px', color: '#ef4444' }}>Go to Billing to pay</span>}
                          </div>

                          {/* LIS Notes */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="clinical-label-premium" style={{ fontSize: '9px' }}>LIS NOTES</span>
                            <span style={{ fontSize: '12px', color: 'var(--leh-text-muted)', fontStyle: 'italic' }}>
                              {inv.results_notes || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Clinician Comment (only for completed tests, Admin/Optometrist) */}
                        {isCompleted && canComment && (
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--leh-border-light)' }}>
                            <label className="clinical-label-premium">Clinician Comment on Result</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                              <textarea
                                className="clinical-textarea"
                                style={{ height: '64px', flex: 1 }}
                                placeholder="Add clinical interpretation or follow-up note..."
                                value={commentsState[inv.id] ?? (inv.medical_comments || '')}
                                onChange={(e) => setCommentsState((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                              />
                              <button
                                className="leh-btn-primary"
                                style={{ height: '64px', padding: '0 16px', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                onClick={() => handleSaveComment(inv.id)}
                              >
                                <Save size={14} />
                                SAVE
                              </button>
                            </div>
                            {inv.medical_comments && (
                              <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                Last saved: "{inv.medical_comments}"
                              </div>
                            )}
                          </div>
                        )}
                        {isCompleted && !canComment && (
                          <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} />
                            Only Optometrists and Admins can add clinical comments.
                          </div>
                        )}
                        {!isCompleted && !isPaid && (
                          <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef3c7', borderRadius: '8px', fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={14} />
                            Awaiting payment in Billing before the LIS can process this test.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* General Notes */}
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--leh-border-light)' }}>
                <ClinicalField label="General Investigation Notes" fullWidth>
                  <textarea
                    className="clinical-textarea"
                    name="investigations_notes"
                    value={formData.investigations_notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes on investigations ordered..."
                    style={{ height: '80px' }}
                    disabled={isLocked}
                  />
                </ClinicalField>
              </div>
            </div>
          </div>
        );
      case 'Diagnosis':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 8: Clinical Diagnosis" icon={Target} onSave={() => handleSave(false)} isSaving={isSaving} />
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
            <SectionHeader title="Section 9: Treatment Plan" icon={Pill} onSave={() => handleSave(false)} isSaving={isSaving} />
            
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
                    {(formData.plan_meds || []).map((med: Medication, idx: number) => {
                      const filteredDrugs = drugInventory.filter((d: any) =>
                        d.name.toLowerCase().includes((med.drug_name || '').toLowerCase())
                      );
                      return (
                        <div key={idx} className="medication-terminal-row" style={{ overflow: 'visible' }}>
                           <ClinicalField label="Drug Name">
                              <div style={{ position: 'relative' }}>
                                 <input
                                    className="clinical-input"
                                    value={med.drug_name}
                                    onChange={(e) => {
                                       updateMedication(idx, 'drug_name', e.target.value);
                                       setActiveDrugSearchIdx(idx);
                                       setActiveSelectionIndex(0);
                                    }}
                                    onFocus={() => {
                                       setActiveDrugSearchIdx(idx);
                                       setActiveSelectionIndex(0);
                                    }}
                                    onBlur={() => {
                                       setTimeout(() => {
                                          setActiveDrugSearchIdx(prev => prev === idx ? null : prev);
                                       }, 200);
                                    }}
                                    onKeyDown={(e) => {
                                       if (activeDrugSearchIdx === idx) {
                                          if (e.key === 'ArrowDown') {
                                             e.preventDefault();
                                             setActiveSelectionIndex(prev => Math.min(prev + 1, filteredDrugs.length - 1));
                                          } else if (e.key === 'ArrowUp') {
                                             e.preventDefault();
                                             setActiveSelectionIndex(prev => Math.max(prev - 1, 0));
                                          } else if (e.key === 'Enter') {
                                             e.preventDefault();
                                             if (filteredDrugs[activeSelectionIndex]) {
                                                updateMedication(idx, 'drug_name', filteredDrugs[activeSelectionIndex].name);
                                                setActiveDrugSearchIdx(null);
                                             }
                                          } else if (e.key === 'Escape') {
                                             e.preventDefault();
                                             setActiveDrugSearchIdx(null);
                                          }
                                       }
                                    }}
                                    placeholder="e.g. G. Timolol"
                                 />
                                 {activeDrugSearchIdx === idx && (
                                    <div className="va-dropdown-menu custom-scrollbar" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '320px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                       {filteredDrugs.length === 0 ? (
                                          <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>No matching drugs found</div>
                                       ) : (
                                          filteredDrugs.map((drug: any, dIdx: number) => (
                                             <button
                                                key={drug.id}
                                                type="button"
                                                onMouseDown={() => {
                                                   updateMedication(idx, 'drug_name', drug.name);
                                                   setActiveDrugSearchIdx(null);
                                                }}
                                                className={`va-dropdown-item ${dIdx === activeSelectionIndex ? 'active' : ''}`}
                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textTransform: 'none', background: dIdx === activeSelectionIndex ? '#eff6ff' : 'transparent' }}
                                             >
                                                <span style={{ fontWeight: 600 }}>{drug.name}</span>
                                                <span style={{ fontSize: '11px', color: '#64748b', opacity: 0.8 }}>
                                                   Stock: {drug.stock} | Price: ₦{drug.price.toLocaleString()}
                                                </span>
                                             </button>
                                          ))
                                       )}
                                    </div>
                                 )}
                              </div>
                           </ClinicalField>
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
                      );
                   })}
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
      case 'Surgery':
        return (
          <div className="animate-slide-up">
            <SectionHeader title="Section 10: Surgery & Admission" icon={Scissors} onSave={() => handleSave(false)} isSaving={isSaving} />
            
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


   return (<div className="consultations-page-container no-print">
      
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 20%) 1fr', height: 'calc(100vh - 80px)', minHeight: '650px', overflow: 'hidden' }} className="no-print">
        
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
               <div className="leh-table-card animate-slide-up" style={{ padding: '48px', maxWidth: '1800px', minWidth: '100%', width: '100%', margin: '0', minHeight: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', borderRadius: '32px', border: '1px solid white', overflow: 'visible' }}>
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
              
              {/* Section A: History & Complaint */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>A. HISTORY & CHIEF COMPLAINT</h3>
                <div style={{ fontSize: '10px', lineHeight: '1.4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Chief Complaint:</strong> {formData.complaint || 'N/A'}</div>
                  {formData.hpi && <div style={{ gridColumn: '1 / -1' }}><strong>History of Present Illness (HPI):</strong> {formData.hpi}</div>}
                  {formData.ocular_history && <div><strong>Ocular History:</strong> {formData.ocular_history}</div>}
                  {formData.medical_history && <div><strong>Medical/Systemic History:</strong> {formData.medical_history}</div>}
                  {formData.drug_history && <div><strong>Drug History:</strong> {formData.drug_history}</div>}
                  {formData.allergies && <div style={{ color: '#dc2626' }}><strong>Allergies:</strong> {formData.allergies}</div>}
                  {formData.family_history && <div style={{ gridColumn: '1 / -1' }}><strong>Family History:</strong> {formData.family_history}</div>}
                </div>
              </div>

              {/* Section B: Vitals Review */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>B. VITAL SIGNS REVIEW</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '10px' }}>
                  <div><strong>Blood Pressure:</strong> {formData.vitals_bp_systolic || triageData?.bp_systolic || '--'}/{formData.vitals_bp_diastolic || triageData?.bp_diastolic || '--'} mmHg</div>
                  <div><strong>Pulse Rate:</strong> {formData.vitals_pulse || triageData?.pulse_rate || '--'} bpm</div>
                  <div><strong>Body Temp:</strong> {formData.vitals_temp || triageData?.temperature || '--'} °C</div>
                  <div><strong>Body Weight:</strong> {formData.vitals_weight || triageData?.weight || '--'} kg</div>
                  {formData.vitals_notes && <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}><strong>Observation Notes:</strong> {formData.vitals_notes}</div>}
                </div>
              </div>

              {/* Section C: Visual Acuity */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>C. 1. VISUAL ACUITY ({formData.va_method || 'Snellen Chart'})</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>EYE</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>DISTANCE (Unaided)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>NEAR (Unaided)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>PINHOLE (PH)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>AIDED (DV)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>AIDED (NV)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>OD (Right)</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_od_unaided_dv || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_od_unaided_nv || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_od_ph || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_od_aided_dv || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_od_aided_nv || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>OS (Left)</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_os_unaided_dv || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_os_unaided_nv || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_os_ph || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_os_aided_dv || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.va_os_aided_nv || '—'}</td>
                    </tr>
                  </tbody>
                </table>
                {formData.va_notes && <div style={{ fontSize: '10px', marginTop: '6px' }}><strong>VA Notes:</strong> {formData.va_notes}</div>}
              </div>

              {/* Section D: Ocular Examination */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>D. 2. OCULAR EXAMINATION (Slit Lamp & IOP)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '8px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left', width: '20%' }}>STRUCTURE</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left', width: '40%' }}>RIGHT EYE (OD)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left', width: '40%' }}>LEFT EYE (OS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Lids & Adnexa</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_lids_od} {formData.as_lids_notes_od ? `— ${formData.as_lids_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_lids_os} {formData.as_lids_notes_os ? `— ${formData.as_lids_notes_os}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Conjunctiva / Sclera</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_conj_od} {formData.as_conj_notes_od ? `— ${formData.as_conj_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_conj_os} {formData.as_conj_notes_os ? `— ${formData.as_conj_notes_os}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Cornea / Tear Film</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_cornea_od} {formData.as_cornea_notes_od ? `— ${formData.as_cornea_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_cornea_os} {formData.as_cornea_notes_os ? `— ${formData.as_cornea_notes_os}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Anterior Chamber</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>
                        Depth: {formData.as_ac_depth_od} | Cells: {formData.as_ac_cells_od} | Flare: {formData.as_ac_flare_od || 'None'}
                      </td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>
                        Depth: {formData.as_ac_depth_os} | Cells: {formData.as_ac_cells_os} | Flare: {formData.as_ac_flare_os || 'None'}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Iris / Pupil</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_iris_od} {formData.as_iris_notes_od ? `— ${formData.as_iris_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_iris_os} {formData.as_iris_notes_os ? `— ${formData.as_iris_notes_os}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Lens</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_lens_od} {formData.as_lens_notes_od ? `— ${formData.as_lens_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.as_lens_os} {formData.as_lens_notes_os ? `— ${formData.as_lens_notes_os}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>IOP ({formData.iop_method})</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.iop_od ? `${formData.iop_od} mmHg` : '—'} {formData.iop_time ? `@ ${formData.iop_time}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.iop_os ? `${formData.iop_os} mmHg` : '—'} {formData.iop_time ? `@ ${formData.iop_time}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Gonioscopy</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.exam_gonioscopy_od || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.exam_gonioscopy_os || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Undilated Fundus</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.exam_fundus_od || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.exam_fundus_os || '—'}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ fontSize: '9px', lineHeight: '1.3' }}>
                  {formData.iop_notes && <p style={{ margin: '2px 0' }}><strong>IOP Notes:</strong> {formData.iop_notes}</p>}
                  {formData.exam_gonioscopy_notes && <p style={{ margin: '2px 0' }}><strong>Gonioscopy Notes:</strong> {formData.exam_gonioscopy_notes}</p>}
                  {formData.exam_fundus_notes && <p style={{ margin: '2px 0' }}><strong>Undilated Fundus Notes:</strong> {formData.exam_fundus_notes}</p>}
                  {formData.as_comments && <p style={{ margin: '2px 0' }}><strong>Slit Lamp Comments:</strong> {formData.as_comments}</p>}
                </div>
              </div>

              {/* Section E: Refraction */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>E. 3. REFRACTION</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ border: '1px solid #e2e8f0', padding: '6px', borderRadius: '4px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '0 0 4px 0', borderBottom: '1px solid #eee', paddingBottom: '2px' }}>Objective Refraction (AR/K)</p>
                    <div style={{ fontSize: '9px', lineHeight: '1.4' }}>
                      <p><strong>OD:</strong> {formData.ref_od_sph || '0.00'} / {formData.ref_od_cyl || '0.00'} x {formData.ref_od_axis || '0'}</p>
                      <p><strong>OS:</strong> {formData.ref_os_sph || '0.00'} / {formData.ref_os_cyl || '0.00'} x {formData.ref_os_axis || '0'}</p>
                    </div>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', padding: '6px', borderRadius: '4px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '0 0 4px 0', borderBottom: '1px solid #eee', paddingBottom: '2px' }}>Subjective Refraction (Best Corrected)</p>
                    <div style={{ fontSize: '9px', lineHeight: '1.4' }}>
                      <p><strong>OD:</strong> {formData.ref_od_subjective_dv || '—'} {formData.ref_od_va ? `(VA: ${formData.ref_od_va})` : ''} {formData.ref_od_near_add ? `[Near Add: ${formData.ref_od_near_add}]` : ''}</p>
                      <p><strong>OS:</strong> {formData.ref_os_subjective_dv || '—'} {formData.ref_os_va ? `(VA: ${formData.ref_os_va})` : ''} {formData.ref_os_near_add ? `[Near Add: ${formData.ref_os_near_add}]` : ''}</p>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '9px', marginTop: '6px', display: 'flex', gap: '15px' }}>
                  {formData.ref_pd && <div><strong>Pupillary Distance (PD):</strong> {formData.ref_pd} mm</div>}
                  {formData.ref_notes && <div><strong>Refraction Notes:</strong> {formData.ref_notes}</div>}
                </div>
              </div>

              {/* Section F: Dilated Funduscopy */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>F. 4. DILATED FUNDUSCOPY</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '9px', marginBottom: '8px', border: '1px solid #eee', padding: '6px', borderRadius: '4px' }}>
                  <div><strong>Mydriatic Agent:</strong> {formData.dil_agent || '—'}</div>
                  <div><strong>Time Administered:</strong> {formData.dil_time_od || '—'}</div>
                  <div><strong>Adequacy:</strong> {formData.dil_adequate || 'Adequate'}</div>
                  <div><strong>OD Dilated:</strong> {formData.dil_od || 'No'} {formData.dil_va_od ? `(Dilated VA: ${formData.dil_va_od})` : ''}</div>
                  <div><strong>OS Dilated:</strong> {formData.dil_os || 'No'} {formData.dil_va_os ? `(Dilated VA: ${formData.dil_va_os})` : ''}</div>
                  {formData.dil_notes && <div style={{ gridColumn: '1 / -1' }}><strong>Dilation Notes:</strong> {formData.dil_notes}</div>}
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left', width: '20%' }}>POSTERIOR SEGMENT ({formData.fs_method || 'Slit Lamp & 90D'})</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left', width: '40%' }}>RIGHT EYE (OD)</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left', width: '40%' }}>LEFT EYE (OS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Optic Disc (CDR)</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>CDR: {formData.fs_disc_cdr_od || '—'} | Margins: {formData.fs_disc_margins_od} | Color: {formData.fs_disc_color_od}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>CDR: {formData.fs_disc_cdr_os || '—'} | Margins: {formData.fs_disc_margins_os} | Color: {formData.fs_disc_color_os}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Macula / Fovea</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.fs_macula_od} {formData.fs_macula_notes_od ? `— ${formData.fs_macula_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.fs_macula_os} {formData.fs_macula_notes_os ? `— ${formData.fs_macula_notes_os}` : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Retinal Vessels</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>A/V: {formData.fs_vessels_av_od || '—'} | Nipping: {formData.fs_vessels_nipping_od || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>A/V: {formData.fs_vessels_av_os || '—'} | Nipping: {formData.fs_vessels_nipping_os || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>Periphery</strong></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.fs_periph_od} {formData.fs_periph_notes_od ? `— ${formData.fs_periph_notes_od}` : ''}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.fs_periph_os} {formData.fs_periph_notes_os ? `— ${formData.fs_periph_notes_os}` : ''}</td>
                    </tr>
                  </tbody>
                </table>
                {formData.fs_summary && <div style={{ fontSize: '9px', marginTop: '6px' }}><strong>Posterior Segment Summary:</strong> {formData.fs_summary}</div>}
              </div>

              {/* Section G: Confrontation Fields (CVF) */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>G. 5. CONFRONTATION VISUAL FIELD (CVF)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '10px' }}>
                   <div><strong>OD (Right Eye):</strong> {formData.cvf_od || 'Full'}</div>
                   <div><strong>OS (Left Eye):</strong> {formData.cvf_os || 'Full'}</div>
                   {formData.cvf_notes && <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}><strong>CVF Clinical Notes:</strong> {formData.cvf_notes}</div>}
                </div>
              </div>

              {/* Section H: Pachymetry */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>H. 6. CORNEAL PACHYMETRY</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '10px' }}>
                   <div><strong>OD (Right Corneal Thickness):</strong> {formData.pachymetry_od ? `${formData.pachymetry_od} µm` : '—'}</div>
                   <div><strong>OS (Left Corneal Thickness):</strong> {formData.pachymetry_os ? `${formData.pachymetry_os} µm` : '—'}</div>
                   {formData.pachymetry_notes && <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}><strong>Pachymetry Clinical Notes:</strong> {formData.pachymetry_notes}</div>}
                </div>
              </div>

              {/* Section I: Investigations */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>I. 7. INVESTIGATIONS & LABORATORY</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '10px', marginBottom: '8px', border: '1px solid #eee', padding: '6px', borderRadius: '4px' }}>
                  <div><strong>FBS:</strong> {formData.investigations_fbs || '—'}</div>
                  <div><strong>RBS:</strong> {formData.investigations_rbs || '—'}</div>
                  <div><strong>HbA1c:</strong> {formData.investigations_hba1c || '—'}</div>
                  <div><strong>RVS:</strong> {formData.investigations_rvs || 'Not Done'}</div>
                </div>
                
                {patientInvestigations && patientInvestigations.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>TEST NAME</th>
                        <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>STATUS</th>
                        <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>RESULT</th>
                        <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>CLINICIAN COMMENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientInvestigations.map((inv: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{inv.test_name}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{inv.status} ({inv.billing_status})</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{inv.test_value ? `${inv.test_value} ${inv.unit || ''}` : '—'}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{inv.medical_comments || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: '9px', color: '#64748b', margin: '2px 0' }}>No laboratory investigations ordered for this visit.</p>
                )}
                {formData.investigations_notes && <div style={{ fontSize: '9px', marginTop: '6px' }}><strong>General Investigation Notes:</strong> {formData.investigations_notes}</div>}
              </div>

              {/* Section J: Clinical Diagnosis */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>J. 8. CLINICAL DIAGNOSIS</h3>
                <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
                  <p><strong>Primary Diagnosis:</strong> {formData.diagnosis_primary || 'Pending'}</p>
                  {formData.diagnosis_secondary && <p><strong>Secondary Diagnosis:</strong> {formData.diagnosis_secondary}</p>}
                  {formData.diagnosis_notes && <p><strong>Diagnostic Notes (ICD-10/Staging):</strong> {formData.diagnosis_notes}</p>}
                </div>
              </div>

              {/* Section K: Treatment Plan */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>K. 9. TREATMENT PLAN</h3>
                <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
                  {formData.plan_meds && formData.plan_meds.length > 0 ? (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>Prescribed Medications:</p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '8px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>DRUG NAME</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>STRENGTH</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>DOSE & FREQ</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>DURATION</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>INSTRUCTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.plan_meds.map((m: any, i: number) => (
                            <tr key={i}>
                              <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{m.drug_name}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{m.strength}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{m.dose} ({m.frequency})</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{m.duration}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{m.instructions || 'As directed'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {/* Glasses prescription */}
                  {(formData.plan_glasses_od?.sph || formData.plan_glasses_os?.sph || formData.plan_glasses_od?.cyl || formData.plan_glasses_os?.cyl) ? (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>Spectacles Prescription:</p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '4px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>EYE</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>SPHERICAL</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>CYLINDRICAL</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>AXIS</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>NEAR ADD</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'left' }}>PRISM</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>OD (Right)</strong></td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_od?.sph || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_od?.cyl || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_od?.axis || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_od?.add || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_od?.prism || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>OS (Left)</strong></td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_os?.sph || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_os?.cyl || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_os?.axis || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_os?.add || '—'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{formData.plan_glasses_os?.prism || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '9px', marginTop: '4px' }}>
                        <div><strong>PD:</strong> {formData.plan_glasses_pd || '—'} mm</div>
                        <div><strong>Frame:</strong> {formData.plan_frame || '—'}</div>
                        <div><strong>Lens Type:</strong> {formData.plan_lens_type || '—'}</div>
                        <div><strong>Lens Material:</strong> {formData.plan_lens_material || '—'}</div>
                        {formData.plan_special_instructions && <div style={{ gridColumn: '1 / -1' }}><strong>Dispensing Notes:</strong> {formData.plan_special_instructions}</div>}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                    <div><strong>Follow-up Date:</strong> {formData.plan_followup_date ? formatDateStandard(formData.plan_followup_date) : 'As needed'}</div>
                    <div><strong>Patient Instructions:</strong> {formData.plan_instructions || 'Follow prescribed treatment plan.'}</div>
                  </div>
                </div>
              </div>

              {/* Section L: Surgery & Admission */}
              <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b' }}>L. 10. SURGERY & ADMISSION</h3>
                <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
                  {formData.surgery_advised ? (
                    <div style={{ border: '1px solid #fca5a5', padding: '8px', borderRadius: '6px', background: '#fff5f5', marginBottom: '8px' }}>
                      <p style={{ fontWeight: 'bold', color: '#dc2626', margin: '0 0 4px 0' }}>Surgery Advised:</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '9px' }}>
                        <div><strong>Procedure:</strong> {formData.surgery_type}</div>
                        <div><strong>Urgency:</strong> {formData.surgery_urgency}</div>
                        <div><strong>Proposed Date:</strong> {formData.surgery_date ? formatDateStandard(formData.surgery_date) : 'TBD'}</div>
                        <div><strong>Surgeon:</strong> {formData.surgery_surgeon || '—'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Pre-Op Prep / Counselor Notes:</strong> {formData.surgery_notes || '—'} {formData.surgery_counsel_notes ? `| Counsel Notes: ${formData.surgery_counsel_notes}` : ''}</div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: '0 0 4px 0' }}><strong>Surgery Advised:</strong> No</p>
                  )}

                  {formData.admission_advised ? (
                    <div style={{ border: '1px solid #93c5fd', padding: '8px', borderRadius: '6px', background: '#eff6ff' }}>
                      <p style={{ fontWeight: 'bold', color: '#2563eb', margin: '0 0 4px 0' }}>Admission Advised:</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '9px' }}>
                        <div><strong>Reason:</strong> {formData.admission_reason}</div>
                        <div><strong>Urgency:</strong> {formData.admission_urgency}</div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: '0' }}><strong>Admission Advised:</strong> No</p>
                  )}
                </div>
              </div>

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
        </div>
      )}

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
