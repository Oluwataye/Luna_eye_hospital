import React, { useState, useEffect } from 'react';
import { X, Printer, RefreshCcw } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { buildReceiptHtml, printReceiptContent } from '../utils/printHelpers';
import './PrintReceipt.css';

interface ReprintReceiptModalProps {
  receipt_number: string;
  onClose: () => void;
}

const fmt = (val: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  })
    .format(val)
    .replace('NGN', '₦ ');

const ReprintReceiptModal: React.FC<ReprintReceiptModalProps> = ({ receipt_number, onClose }) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRestricted, setIsRestricted] = useState(false);

  useEffect(() => {
    checkRestrictionAndFetch();
  }, [receipt_number]);

  const checkRestrictionAndFetch = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const restrictionRes = await api.getReprintRestrictions(user.id);
      if (restrictionRes.is_restricted) {
        setIsRestricted(true);
        notify('error', 'Your reprint access has been restricted by the administrator. Please contact Admin.');
        onClose();
        return;
      }

      const receiptData = await api.getReceiptForReprint(receipt_number);
      setData(receiptData);
    } catch (error) {
      console.error('Reprint fetch error:', error);
      notify('error', 'Failed to fetch receipt data');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!data || !user) return;

    try {
      await api.logReprint({
        receipt_number: data.receipt_no,
        bill_id: data.id,
        patient_id: data.patient_id,
        reprinted_by_user_id: user.id
      });

      const receiptHtml = buildReceiptHtml(data, user, true);
      printReceiptContent(receiptHtml);
      
      notify('success', 'Reprint logged and sent to printer');
    } catch (error) {
      console.error('Reprint logging error:', error);
      notify('error', 'Failed to log reprint activity');
    }
  };

  if (loading) return null;
  if (isRestricted || !data) return null;

  const grandTotal = Math.max(0, data.total_amount - data.discount);
  const change = data.amount_paid - grandTotal;
  const now = new Date();

  return (
    <div className="leh-modal-overlay">
      <div className="leh-modal-content" style={{ maxWidth: '680px', maxHeight: '92vh' }}>
        <div className="leh-modal-header">
           <div className="leh-modal-title">
             <Printer style={{ color: 'var(--leh-primary)' }} />
             <span>Receipt Reprint Preview</span>
           </div>
           <button className="leh-modal-close" onClick={onClose}>
             <X size={20} />
           </button>
        </div>
        
        <div className="leh-modal-body" style={{ background: 'var(--leh-bg-light)', overflowY: 'auto', padding: '40px' }}>
           <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#fffbeb', color: '#92400e', borderRadius: '99px', border: '1px solid #fde68a', fontWeight: '900', fontSize: '11px', letterSpacing: '0.05em' }}>
                 <RefreshCcw size={14} className="animate-spin-slow" />
                 OFFICIAL AUDIT REPRINT
              </div>
           </div>

           <div className="pos-receipt-printable" style={{ 
             background: 'white', 
             padding: '40px', 
             boxShadow: '0 20px 50px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)', 
             borderRadius: '16px',
             position: 'relative',
             maxWidth: '440px',
             margin: '0 auto',
             border: '1px solid #fff'
           }}>
              {/* Watermark Overlay */}
             <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.05, pointerEvents: 'none', transform: 'rotate(-35deg)', fontSize: '48px', fontWeight: '900', textAlign: 'center', color: '#be123c', zIndex: 0 }}>
               DUPLICATE COPY
             </div>

             <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '0 0 6px', fontFamily: 'Outfit, sans-serif' }}>{data.clinic?.name || 'LUNA EYE HOSPITAL'}</h1>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{data.clinic?.address}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '20px 0', borderTop: '2px dashed #e2e8f0', borderBottom: '2px dashed #e2e8f0', marginBottom: '32px' }}>
                   <div>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', margin: '0 0 4px 0' }}>RECEIPT NO</p>
                      <p style={{ fontSize: '13px', fontWeight: '900', margin: 0 }}>{data.receipt_no}</p>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', margin: '0 0 4px 0' }}>DATE</p>
                      <p style={{ fontSize: '13px', fontWeight: '900', margin: 0 }}>{new Date(data.created_at).toLocaleDateString()}</p>
                   </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                   <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px' }}>BILLING RECIPIENT</p>
                   <p style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: 0 }}>{data.patient_name}</p>
                   <p style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginTop: '4px' }}>Patient Registry ID: {data.patient_id}</p>
                </div>

                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '32px' }}>
                   <thead>
                     <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                       <th style={{ textAlign: 'left', padding: '12px 0', color: '#94a3b8', fontWeight: '800', fontSize: '10px' }}>DESCRIPTION</th>
                       <th style={{ textAlign: 'right', padding: '12px 0', color: '#94a3b8', fontWeight: '800', fontSize: '10px' }}>AMOUNT</th>
                     </tr>
                   </thead>
                   <tbody>
                     {data.items?.map((item: any, i: number) => (
                       <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                         <td style={{ padding: '12px 0', fontWeight: '700' }}>{item.description} <span style={{ color: '#94a3b8', fontWeight: '600' }}>x{item.qty}</span></td>
                         <td style={{ textAlign: 'right', padding: '12px 0', fontWeight: '800', color: '#0f172a' }}>{fmt(item.unit_price * item.qty)}</td>
                       </tr>
                     ))}
                   </tbody>
                </table>

                <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', color: 'var(--leh-primary)' }}>
                     <span>NET TOTAL PAID</span>
                     <span>{fmt(grandTotal)}</span>
                   </div>
                </div>

                <div style={{ marginTop: '40px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
                   <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', lineHeight: '1.6', margin: 0 }}>
                      SECURITY AUDIT TRAIL<br/>
                      Reprinted: {now.toLocaleString()}<br/>
                      Authorized By: {user?.full_name.toUpperCase()}
                   </p>
                </div>
             </div>
           </div>
        </div>

        <div className="leh-modal-footer">
          <button className="leh-btn-outline" style={{ height: '52px', padding: '0 24px' }} onClick={onClose}>
            CLOSE PREVIEW
          </button>
          <button className="leh-btn-primary" style={{ height: '52px', padding: '0 32px' }} onClick={handlePrint}>
            <Printer size={18} />
            <span>AUTHORIZE PRINT</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReprintReceiptModal;
