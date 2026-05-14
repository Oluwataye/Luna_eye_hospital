import React from 'react';
import './PrintConsultation.css';
import { Footer } from './Footer';

interface PrintConsultationProps {
  patient: any;
  formData: any;
  consultantName: string;
  settings?: any;
}

export const PrintConsultation: React.FC<PrintConsultationProps> = ({ patient, formData, consultantName, settings }) => {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const clinicName = settings?.clinic_name || 'LUNA EYE HOSPITAL';
  const clinicAddress = settings?.clinic_address || '13A, Behind Bomas Supermarket, Old Airport Road, Minna';
  const clinicPhone = settings?.clinic_phone || '09044687558';
  const clinicWhatsapp = settings?.clinic_whatsapp || '09114111418';
  const clinicEmail = settings?.clinic_email || 'lunaeyehospital@gmail.com';

  return (
    <div className="print-consultation-container" id="print-consultation-area">
      {/* Hospital Header */}
      <div className="hospital-header">
        <div className="header-left">
          <h1>{clinicName}</h1>
          <p className="hospital-address">{clinicAddress}</p>
          <p className="hospital-contact">
            Phone: {clinicPhone} | WhatsApp: {clinicWhatsapp}
          </p>
          <p className="hospital-email">Email: {clinicEmail}</p>
        </div>
        <div className="header-right">
          <div className="report-title">CLINICAL CONSULTATION REPORT</div>
          <div className="report-date">Date: {today}</div>
        </div>
      </div>

      <div className="divider"></div>

      {/* Patient Bio */}
      <div className="patient-bio-grid">
        <div className="bio-item"><strong>Patient Name:</strong> {patient?.full_name}</div>
        <div className="bio-item"><strong>Patient ID:</strong> {patient?.id}</div>
        <div className="bio-item"><strong>Gender:</strong> {patient?.gender}</div>
        <div className="bio-item"><strong>DOB/Age:</strong> {patient?.dob}</div>
      </div>

      <div className="divider"></div>

      {/* Clinical Findings */}
      <div className="report-section">
        <h3>1. Clinical History & Complaint</h3>
        <p><strong>Chief Complaint:</strong> {formData.complaint || 'N/A'}</p>
        <p><strong>History:</strong> {formData.history || 'N/A'}</p>
      </div>

      <div className="report-section">
        <h3>2. Vital Signs</h3>
        <div className="vitals-row">
          <span><strong>BP:</strong> {formData.bp || 'N/A'} mmHg</span>
          <span><strong>Pulse:</strong> {formData.pulse || 'N/A'} bpm</span>
          <span><strong>Temp:</strong> {formData.temp || 'N/A'} °C</span>
          <span><strong>Weight:</strong> {formData.weight || 'N/A'} kg</span>
        </div>
      </div>

      <div className="report-section">
        <h3>3. Visual Acuity (VA)</h3>
        <table className="va-print-table">
          <thead>
            <tr>
              <th>Eye</th>
              <th>Unaided (Dist)</th>
              <th>Aided (Dist)</th>
              <th>Pinhole</th>
              <th>Unaided (Near)</th>
              <th>Aided (Near)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Right (OD)</strong></td>
              <td>{formData.va_od_unaided || '-'}</td>
              <td>{formData.va_od_aided || '-'}</td>
              <td>{formData.va_od_pinhole || '-'}</td>
              <td>{formData.va_od_near_unaided || '-'}</td>
              <td>{formData.va_od_near_aided || '-'}</td>
            </tr>
            <tr>
              <td><strong>Left (OS)</strong></td>
              <td>{formData.va_os_unaided || '-'}</td>
              <td>{formData.va_os_aided || '-'}</td>
              <td>{formData.va_os_pinhole || '-'}</td>
              <td>{formData.va_os_near_unaided || '-'}</td>
              <td>{formData.va_os_near_aided || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>4. Intraocular Pressure (IOP)</h3>
        <p>
          <strong>OD:</strong> {formData.iop_od || '-'} mmHg | 
          <strong> OS:</strong> {formData.iop_os || '-'} mmHg 
          <span className="ml-4">({formData.iop_method})</span>
        </p>
      </div>

      <div className="report-section">
        <h3>5. Subjective Refraction</h3>
        <table className="va-print-table">
          <thead>
            <tr>
              <th>Eye</th>
              <th>SPH</th>
              <th>CYL</th>
              <th>AXIS</th>
              <th>VA</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>OD</strong></td>
              <td>{formData.ref_od_sph || '-'}</td>
              <td>{formData.ref_od_cyl || '-'}</td>
              <td>{formData.ref_od_axis || '-'}</td>
              <td>{formData.ref_od_va || '-'}</td>
            </tr>
            <tr>
              <td><strong>OS</strong></td>
              <td>{formData.ref_os_sph || '-'}</td>
              <td>{formData.ref_os_cyl || '-'}</td>
              <td>{formData.ref_os_axis || '-'}</td>
              <td>{formData.ref_os_va || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>6. Clinical Examination</h3>
        <div className="exam-print-grid">
          <div>
            <h4>Anterior Segment</h4>
            <p><strong>OD:</strong> {formData.anterior_od}</p>
            <p><strong>OS:</strong> {formData.anterior_os}</p>
          </div>
          <div>
            <h4>Posterior Segment</h4>
            <p><strong>OD:</strong> {formData.posterior_od}</p>
            <p><strong>OS:</strong> {formData.posterior_os}</p>
            {formData.is_dilated && (
              <p className="text-sm italic">Pupils Dilated with {formData.dilation_agent} at {formData.dilation_time}</p>
            )}
          </div>
        </div>
      </div>

      <div className="report-section">
        <h3>7. Diagnosis & Plan</h3>
        <p><strong>Primary Diagnosis:</strong> {formData.primary_diagnosis || 'Pending'} {formData.icd10 ? `(${formData.icd10})` : ''}</p>
        <p><strong>Management Plan:</strong> {formData.management_plan || 'N/A'}</p>
        {formData.surgery_advised && (
          <div className="surgery-box">
            <strong>SURGERY ADVISED:</strong> {formData.surgery_type}
          </div>
        )}
      </div>

      {formData.medications && formData.medications.length > 0 && (
        <div className="report-section">
          <h3>8. Prescribed Medications</h3>
          <table className="va-print-table">
            <thead>
              <tr>
                <th>Drug Name</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {formData.medications.map((med: any, i: number) => (
                <tr key={i}>
                  <td>{med.name}</td>
                  <td>{med.dosage}</td>
                  <td>{med.frequency}</td>
                  <td>{med.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formData.follow_up_date && (
        <div className="report-section">
          <p><strong>Follow-up Scheduled:</strong> {formData.follow_up_date} ({formData.follow_up_period})</p>
        </div>
      )}

      <div className="signature-area">
        <div className="sig-line">
          <p>Clinician Signature & Stamp</p>
          <div className="sig-name">{consultantName}</div>
        </div>
        <div className="sig-date">
          <p>Date</p>
          <div className="sig-val">{today}</div>
        </div>
      </div>

      <Footer />
    </div>
  );
};
