import React from 'react';
import { Footer } from './Footer';

interface PrintDischargeProps {
  admission: {
    patient_name: string;
    patient_id: string;
    ward_name: string;
    bed_number: string;
    admitting_doctor: string;
    admission_date: string;
    discharge_date: string;
    reason: string;
    notes: string;
    stay_length: number;
  };
}

export const PrintDischarge: React.FC<PrintDischargeProps> = ({ admission }) => {
  return (
    <div className="clinical-report" style={{ padding: '50px', fontFamily: 'serif' }}>
      <div className="receipt-header" style={{ borderBottom: '3px solid #1e40af', paddingBottom: '20px', textAlign: 'center' }}>
        <h1 style={{ color: '#1e40af', margin: 0, fontSize: '32px', letterSpacing: '2px' }}>LUNA EYE HOSPITAL</h1>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>13A, Behind Bomas Supermarket, Old Airport Road, Minna</p>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>Tel: 09044687558 | Email: lunaeyehospital@gmail.com</p>
        <h2 style={{ margin: '20px 0 0 0', textDecoration: 'underline' }}>DISCHARGE SUMMARY</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px', borderBottom: '1px solid #ddd', paddingBottom: '20px' }}>
        <div>
          <p><strong>PATIENT NAME:</strong> {admission.patient_name}</p>
          <p><strong>HOSPITAL ID:</strong> {admission.patient_id}</p>
          <p><strong>WARD/BED:</strong> {admission.ward_name} / {admission.bed_number}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p><strong>ADMISSION DATE:</strong> {new Date(admission.admission_date).toLocaleDateString()}</p>
          <p><strong>DISCHARGE DATE:</strong> {new Date(admission.discharge_date).toLocaleDateString()}</p>
          <p><strong>LENGTH OF STAY:</strong> {admission.stay_length} Day(s)</p>
          <p><strong>ATTENDING CLINICIAN:</strong> {admission.admitting_doctor}</p>
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Reason for Admission</h3>
        <p style={{ minHeight: '60px' }}>{admission.reason}</p>

        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '30px' }}>Clinical Notes & Treatment Summary</h3>
        <div style={{ minHeight: '300px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
          {admission.notes}
        </div>
      </div>

      <div style={{ marginTop: '100px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid black', width: '200px', paddingTop: '5px' }}>
            <p>Medical Officer Signature</p>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid black', width: '200px', paddingTop: '5px' }}>
            <p>Patient/Guardian Signature</p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};
