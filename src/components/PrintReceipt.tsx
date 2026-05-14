import React from 'react';
import './PrintReceipt.css';

interface ReceiptItem {
  description: string;
  qty: number;
  unit_price: number;
  unit?: string;
}

interface PaymentDetail {
  mode: string;
  amount: number;
}

export interface ReceiptData {
  receipt_no: string;
  patient_id: string;
  patient_name: string;
  clinician?: string;
  items: ReceiptItem[];
  total_amount: number;      // subtotal before discount
  amount_paid: number;
  balance: number;
  discount: number;          // total discount applied
  payment_method: string;
  payment_details?: PaymentDetail[];
  cashier: string;
  created_at: string;
}

interface PrintReceiptProps {
  receipt: ReceiptData;
}

const CLINIC_NAME    = 'LUNA EYE HOSPITAL';
const CLINIC_ADDRESS = '13A, Behind Bomas Supermarket, Old Airport Road, Minna';
const CLINIC_PHONE   = '09044689558';
const CLINIC_WA      = '09114111418';
const CLINIC_EMAIL   = 'lunaeyehospital@gmail.com';

const fmt = (val: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  })
    .format(val)
    .replace('NGN', '₦');

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ receipt }) => {
  const grandTotal = Math.max(0, receipt.total_amount - receipt.discount);
  const tendered = (receipt as any).amount_tendered ?? receipt.amount_paid;
  const change = tendered - grandTotal;

  // Build a readable payment method string
  const paymentStr =
    receipt.payment_details && receipt.payment_details.length > 1
      ? receipt.payment_details
          .map((p) => `${p.mode} (${fmt(p.amount)})`)
          .join(' + ')
      : receipt.payment_method || 'Cash';

  return (
    /* The id="receipt-print-root" is what @media print targets.
       It must be present in the DOM when window.print() fires. */
    <div id="receipt-print-root" className="pos-receipt-printable receipt-print-content">

      {/* ── Header ───────────────────────────── */}
      <div className="receipt-header-branding">
        <h1 className="hospital-name">{CLINIC_NAME}</h1>
        <p className="hospital-address">{CLINIC_ADDRESS}</p>
        <div className="contact-grid">
          <span><strong>Tel:</strong> {CLINIC_PHONE}</span>
          <span><strong>WhatsApp:</strong> {CLINIC_WA}</span>
          <span><strong>Email:</strong> {CLINIC_EMAIL}</span>
        </div>
      </div>

      <hr className="receipt-divider" />

      {/* ── Transaction Meta ─────────────────── */}
      <div className="receipt-meta-info">
        <div className="meta-row">
          <span><strong>Receipt No:</strong> {receipt.receipt_no || 'N/A'}</span>
          <span><strong>Date:</strong> {new Date(receipt.created_at).toLocaleString()}</span>
        </div>
        <div className="meta-row">
          <span>
            <strong>Patient:</strong>{' '}
            {receipt.patient_name || 'Walk-in Customer'}{' '}
            ({receipt.patient_id || 'WALK-IN'})
          </span>
        </div>
        {receipt.clinician && (
          <div className="meta-row">
            <span><strong>Attending Clinician:</strong> {receipt.clinician}</span>
          </div>
        )}
        <div className="meta-row">
          <span><strong>Cashier:</strong> {receipt.cashier || 'Staff'}</span>
        </div>
      </div>

      <hr className="receipt-divider" />

      {/* ── Items Table ──────────────────────── */}
      <div className="receipt-table-container">
        <table className="receipt-items-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items && receipt.items.length > 0 ? (
              receipt.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'left' }}>
                    {item.description}
                    {item.unit && (
                      <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.7 }}>
                        {item.unit}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(item.unit_price * item.qty)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <hr className="receipt-divider" />

      {/* ── Summary ──────────────────────────── */}
      <div className="receipt-summary-section">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>{fmt(receipt.total_amount)}</span>
        </div>

        {receipt.discount > 0 && (
          <div className="summary-row">
            <span>Discount:</span>
            <span>-{fmt(receipt.discount)}</span>
          </div>
        )}

        <div className="summary-row grand-total-row">
          <span>TOTAL DUE:</span>
          <span>{fmt(grandTotal)}</span>
        </div>

        <div className="payment-details-breakdown">
          <div className="summary-row">
            <span>{change >= 0 ? 'Amount Tendered:' : 'Amount Paid:'}</span>
            <span>{fmt(tendered)}</span>
          </div>

          {change >= 0 ? (
            <div className="summary-row">
              <span>Change Due:</span>
              <span>{fmt(change)}</span>
            </div>
          ) : (
            <div className="summary-row">
              <span>Balance Due:</span>
              <span>{fmt(Math.abs(change))}</span>
            </div>
          )}

          <div className="summary-row" style={{ marginTop: '0.25rem' }}>
            <span>Payment Method:</span>
            <span className="uppercase-text">{paymentStr}</span>
          </div>
        </div>
      </div>

      <hr className="receipt-divider" />

      {/* ── Footer ───────────────────────────── */}
      <div className="receipt-footer-note">
        <p className="vision-priority">
          Thank you for choosing Luna Eye Hospital.<br />
          Your vision is our priority.
        </p>
        <p className="copyright-tag">© T-Tech Solutions</p>
      </div>

    </div>
  );
};
