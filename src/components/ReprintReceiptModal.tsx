import React, { useState, useEffect } from 'react';
import { X, Printer, RefreshCcw } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { dispatchReceiptPrint } from '../utils/thermalPrinter';
import './PrintReceipt.css';

interface ReprintReceiptModalProps {
  receipt_number: string;
  onClose: () => void;
}

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

      const printRes = await dispatchReceiptPrint(data, user, { isReprint: true });
      if (printRes.fallbackUsed) {
        notify('info', printRes.message);
      } else {
        notify('success', 'Reprint dispatched to printer successfully');
      }
    } catch (error) {
      console.error('Reprint logging error:', error);
      notify('error', 'Failed to log reprint activity');
    }
  };

  if (loading) return null;
  if (isRestricted || !data) return null;

  const now = new Date();
  const grandTotal = Math.max(0, (data.total_amount || 0) - (data.discount || 0));

  const getRevFund = (item: any) => {
    if (item.category && String(item.category).trim()) return String(item.category).trim();
    if (item.rev_fund && String(item.rev_fund).trim()) return String(item.rev_fund).trim();
    if (item.department && String(item.department).trim()) return String(item.department).trim();
    const desc = (item.description || item.name || '').toLowerCase();
    if (desc.includes('wound') || desc.includes('dress') || desc.includes('inject') || desc.includes('nurs') || desc.includes('stitch')) return 'Nursing Services';
    if (desc.includes('consult') || desc.includes('registration') || desc.includes('card') || desc.includes('review') || desc.includes('triage')) return 'Consultation';
    if (desc.includes('lens') || desc.includes('frame') || desc.includes('glass') || desc.includes('opt') || desc.includes('spectacle')) return 'Optical';
    if (desc.includes('drop') || desc.includes('tab') || desc.includes('cap') || desc.includes('syrup') || desc.includes('cream') || desc.includes('ointment')) return 'Pharmacy';
    if (desc.includes('scan') || desc.includes('test') || desc.includes('lab') || desc.includes('fundus') || desc.includes('visual') || desc.includes('pachymetry') || desc.includes('biometry')) return 'Laboratory';
    return 'Services';
  };

  const formatAuditDate = (date: any) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date || '');
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
    } catch {
      return String(date || '');
    }
  };

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
        
        <div className="leh-modal-body" style={{ background: '#f1f5f9', overflowY: 'auto', padding: '24px' }}>
           <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fffbeb', color: '#92400e', borderRadius: '99px', border: '1px solid #fde68a', fontWeight: '900', fontSize: '11px', letterSpacing: '0.05em' }}>
                 <RefreshCcw size={14} className="animate-spin-slow" />
                 OFFICIAL AUDIT REPRINT
              </div>
           </div>

           <div className="pos-receipt-printable" style={{ 
             background: 'white', 
             padding: '0', 
             boxShadow: '0 10px 30px rgba(0,0,0,0.1)', 
             maxWidth: '380px',
             margin: '0 auto',
             border: '2px solid #000',
             color: '#000',
             fontFamily: 'Arial, Helvetica, sans-serif'
           }}>
             <div style={{
               fontSize: '13px',
               fontWeight: '900',
               textAlign: 'center',
               padding: '8px 4px',
               borderBottom: '2px solid #000',
               textTransform: 'uppercase',
               letterSpacing: '0.5px'
             }}>
               {data.clinic?.name || 'LUNA EYE HOSPITAL'}
             </div>

             <div style={{
               fontSize: '12px',
               fontWeight: '900',
               textAlign: 'center',
               padding: '5px 4px',
               borderBottom: '2px solid #000',
               letterSpacing: '0.5px'
             }}>
               BAT. NO.: {data.receipt_no}
             </div>

             <div style={{
               fontSize: '11px',
               fontWeight: '900',
               textAlign: 'left',
               padding: '6px 8px',
               borderBottom: '2px solid #000',
               textTransform: 'uppercase'
             }}>
               {(data.patient_name || 'WALK-IN PATIENT').toUpperCase()}({data.patient_id || data.file_number || '11025'})
             </div>

             <div style={{ padding: '8px' }}>
               <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', border: '1px solid #000' }}>
                 <thead>
                   <tr>
                     <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'left', width: '27%' }}>RevFund</th>
                     <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'left', width: '33%' }}>Name</th>
                     <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', width: '10%' }}>Qty</th>
                     <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', width: '10%' }}>Freq</th>
                     <th style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'right', width: '20%' }}>price</th>
                   </tr>
                 </thead>
                 <tbody>
                   {data.items?.map((item: any, i: number) => (
                     <tr key={i}>
                       <td style={{ border: '1px solid #000', padding: '4px 2px', fontWeight: '600' }}>{getRevFund(item)}</td>
                       <td style={{ border: '1px solid #000', padding: '4px 2px', fontWeight: '600' }}>{item.description || item.name}</td>
                       <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', fontWeight: '600' }}>{item.qty || 1}</td>
                       <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center' }}>{item.freq || ''}</td>
                       <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'right', fontWeight: '600' }}>{Number(item.unit_price * (item.qty || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     </tr>
                   ))}
                   <tr>
                     <td colSpan={4} style={{ border: '1px solid #000', padding: '5px 4px', fontWeight: '900' }}>Sub Total:</td>
                     <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{Number(data.total_amount || grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                   </tr>
                   {data.discount > 0 && (
                     <tr>
                       <td colSpan={4} style={{ border: '1px solid #000', padding: '4px', fontWeight: '900' }}>Discount:</td>
                       <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: '900' }}>-{Number(data.discount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>

             <div style={{ padding: '4px 8px 10px 8px', fontSize: '10px', lineHeight: '1.4', fontWeight: '600' }}>
               <div>BilledBy: {data.cashier || user?.full_name || 'cashier cashier'} ({data.cashier_email || user?.email || 'cashier@healthrevolve.com'})</div>
               <div>Processed/Printed By: {user?.full_name || 'cashier cashier'}({user?.email || 'cashier@healthrevolve.com'})</div>
               <div>on the {formatAuditDate(now)}</div>
             </div>

             <div style={{
               fontSize: '15px',
               fontWeight: '900',
               textAlign: 'center',
               padding: '12px 4px 16px',
               letterSpacing: '0.5px',
               lineHeight: '1.25'
             }}>
               --POWERED<br/>
               BY T-TECH SOLUTION--
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
