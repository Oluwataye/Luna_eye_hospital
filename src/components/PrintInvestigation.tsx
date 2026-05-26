import React from 'react';
import { Footer } from './Footer';
import './PrintReceipt.css'; // Reusing some base print styles or using a dedicated one

interface PrintInvestigationProps {
  investigation: {
    test_name: string;
    patient_name: string;
    patient_id: string;
    results_notes: string;
    requested_by: string;
    completed_at: string;
    created_at: string;
    test_value?: string;
    unit?: string;
    reference_range?: string;
    medical_comments?: string;
  };
}

export const PrintInvestigation: React.FC<PrintInvestigationProps> = ({ investigation }) => {
  return (
    <div className="clinical-report pos-receipt" style={{ width: '100%', maxWidth: '800px', padding: '40px', fontFamily: 'serif' }}>
      <div className="receipt-header" style={{ borderBottom: '2px solid #2563eb', paddingBottom: '20px' }}>
        <h1 style={{ color: '#2563eb', margin: 0, fontSize: '28px' }}>LUNA EYE HOSPITAL</h1>
        <p style={{ margin: '5px 0' }}>13A, Behind Bomas Supermarket, Old Airport Road, Minna</p>
        <p style={{ margin: '5px 0' }}>Tel: 09044687558 | WhatsApp: 09114111418</p>
        <p style={{ margin: '5px 0' }}>Email: lunaeyehospital@gmail.com</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
        <div>
          <p style={{ margin: '2px 0' }}><strong>PATIENT NAME:</strong> {investigation.patient_name}</p>
          <p style={{ margin: '2px 0' }}><strong>HOSPITAL ID:</strong> {investigation.patient_id}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '2px 0' }}><strong>DATE:</strong> {new Date(investigation.completed_at).toLocaleDateString()}</p>
          <p style={{ margin: '2px 0' }}><strong>REQUESTED BY:</strong> {investigation.requested_by}</p>
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '20px', textDecoration: 'underline', marginBottom: '20px' }}>INVESTIGATION REPORT: {investigation.test_name}</h2>
        
        {investigation.unit && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', padding: '15px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>TEST VALUE</p>
              <p style={{ margin: 0, fontSize: '18px' }}>{investigation.test_value || 'N/A'} {investigation.unit}</p>
              {investigation.reference_range && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>Ref: {investigation.reference_range}</p>}
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>MEDICAL COMMENTS</p>
              <p style={{ margin: 0, fontSize: '16px' }}>{investigation.medical_comments || 'None'}</p>
            </div>
          </div>
        )}

        <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '300px', fontSize: '16px', lineHeight: '1.6' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {investigation.results_notes}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ borderTop: '1px solid black', width: '250px', paddingTop: '5px', textAlign: 'center' }}>
          <p style={{ margin: 0 }}>Technician Signature</p>
        </div>
        <div style={{ borderTop: '1px solid black', width: '250px', paddingTop: '5px', textAlign: 'center' }}>
          <p style={{ margin: 0 }}>Date & Time</p>
        </div>
      </div>

      <Footer />
    </div>
  );
};
