export const printElementId = (elementId: string, title: string = 'Document') => {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id ${elementId} not found for printing.`);
    return;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 20px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            h1, h2, h3 { color: #1e40af; }
            .no-print { display: none !important; }
            .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid #ccc; }
          }
        </style>
      </head>
      <body>
        ${el.outerHTML}
      </body>
    </html>
  `;
  
  printReceiptContent(html);
};

export const printReceiptContent = (receiptHtmlString: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);
  
  iframe.onload = function() {
    setTimeout(function() {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(function() {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      } catch (e) {
        console.error('Print iframe error:', e);
      }
    }, 1000);
  };

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(receiptHtmlString);
  iframeDoc.close();
};

export const buildReceiptHtml = (data: any, user: any, isReprint: boolean = false) => {
  const fmt = (val: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(val).replace('NGN', '₦');
  const formatDate = (date: any) => new Date(date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const subtotal = data.total_amount || 0;
  const discount = data.discount || 0;
  const netTotal = Math.max(0, subtotal - discount);
  const paid = data.amount_paid || 0;
  const balance = data.balance ?? (netTotal - paid);
  const now = new Date();

  const styles = `
    * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { padding: 0 !important; margin: 0 !important; background: #fff !important; width: 80mm !important; font-family: 'Courier New', Courier, monospace !important; }
    .receipt-container { width: 80mm !important; padding: 8mm 4mm !important; background: #fff !important; color: #000 !important; }
    .hospital-name { font-size: 20px !important; font-weight: 950 !important; text-align: center !important; margin: 0 0 5px 0 !important; text-transform: uppercase !important; }
    .hospital-info { font-size: 11px !important; text-align: center !important; margin-bottom: 12px !important; line-height: 1.4 !important; }
    .receipt-title { font-size: 14px !important; font-weight: 900 !important; text-align: center !important; margin: 10px 0 !important; border-top: 1.5px solid #000 !important; border-bottom: 1.5px solid #000 !important; padding: 6px 0 !important; letter-spacing: 1px !important; }
    .reprint-badge { text-align: center !important; background: #000 !important; color: #fff !important; font-weight: 900 !important; font-size: 12px !important; padding: 6px 12px !important; display: inline-block !important; margin: 5px 0 !important; text-transform: uppercase !important; }
    .reprint-badge-row { text-align: center !important; margin: 10px 0 !important; }
    .receipt-meta { font-size: 12px !important; margin-bottom: 4px !important; display: flex !important; justify-content: space-between !important; }
    .receipt-divider { border-top: 1px dashed #000 !important; margin: 12px 0 !important; }
    table { width: 100% !important; border-collapse: collapse !important; margin: 12px 0 !important; }
    th { font-size: 11px !important; text-align: left !important; border-bottom: 1px solid #000 !important; padding: 4px 0 !important; text-transform: uppercase !important; }
    td { font-size: 11px !important; padding: 6px 0 !important; vertical-align: top !important; }
    .right { text-align: right !important; }
    .center { text-align: center !important; }
    .total-row { display: flex !important; justify-content: space-between !important; font-size: 12px !important; margin-bottom: 6px !important; font-weight: 700 !important; }
    .grand-total { font-size: 18px !important; font-weight: 950 !important; border-top: 2px solid #000 !important; margin-top: 12px !important; padding-top: 8px !important; }
    .balance-row { font-size: 16px !important; font-weight: 950 !important; color: #000 !important; margin-top: 8px !important; }
    .footer { margin-top: 25px !important; text-align: center !important; font-size: 10px !important; line-height: 1.5 !important; border-top: 1px solid #eee !important; padding-top: 10px !important; }
    .audit-trail { font-size: 9px !important; font-style: italic !important; margin-top: 12px !important; color: #666 !important; text-align: center !important; }
  `;

  const itemsHtml = data.items?.map((item: any) => `
    <tr>
      <td style="width: 45%">${item.description}</td>
      <td class="center" style="width: 15%">${item.qty}</td>
      <td class="right" style="width: 20%">${item.unit_price?.toLocaleString()}</td>
      <td class="right" style="width: 20%">${(item.unit_price * item.qty)?.toLocaleString()}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="center">No items listed</td></tr>';

  // Handle payment details for Mixed mode
  let paymentDetailsHtml = '';
  if (data.payment_method === 'Mixed' && data.payment_details) {
    const details = typeof data.payment_details === 'string' ? JSON.parse(data.payment_details) : data.payment_details;
    paymentDetailsHtml = `
      <div style="font-size: 10px; margin-top: 4px; padding-left: 10px; border-left: 2px solid #000;">
        <div class="total-row" style="font-weight: normal;"><span>> Cash:</span><span>${fmt(details.cash || 0)}</span></div>
        <div class="total-row" style="font-weight: normal;"><span>> Bank/POS:</span><span>${fmt(details.bank || 0)}</span></div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${data.receipt_no}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="hospital-name">LUNA EYE HOSPITAL</div>
        <div class="hospital-info">
          13A, Behind Bomas Supermarket, Old Airport Road, Minna<br>
          Tel: 09044689558 | WhatsApp: 09114111418<br>
          Email: lunaeyehospital@gmail.com
        </div>

        <div class="receipt-title">OFFICIAL RECEIPT</div>

        ${isReprint ? `
        <div class="reprint-badge-row">
          <span class="reprint-badge">*** OFFICIAL REPRINT ***</span>
        </div>
        ` : ''}

        <div class="receipt-meta"><span>Receipt No:</span><strong>${data.receipt_no}</strong></div>
        <div class="receipt-meta"><span>Date:</span><strong>${formatDate(data.created_at)}</strong></div>
        <div class="receipt-meta"><span>Patient ID:</span><strong>#${data.patient_id}</strong></div>
        <div class="receipt-meta"><span>Name:</span><strong style="text-transform: uppercase;">${data.patient_name}</strong></div>

        <div class="receipt-divider"></div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="center">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="receipt-divider"></div>

        <div class="total-row"><span>Subtotal:</span><span>${fmt(subtotal)}</span></div>
        ${discount > 0 ? `<div class="total-row"><span>Discount:</span><span>-${fmt(discount)}</span></div>` : ''}
        <div class="total-row grand-total"><span>TOTAL PAYABLE:</span><span>${fmt(netTotal)}</span></div>
        
        <div class="receipt-divider"></div>

        <div class="total-row"><span>AMOUNT PAID:</span><span style="font-size: 16px;">${fmt(paid)}</span></div>
        <div class="total-row" style="font-size: 10px;"><span>Payment Mode:</span><span>${data.payment_method}</span></div>
        ${paymentDetailsHtml}

        <div class="total-row balance-row">
          <span>BALANCE DUE:</span>
          <span>${fmt(balance)}</span>
        </div>

        <div class="footer">
          <p>Served by: ${data.cashier || user?.full_name || 'Staff'}</p>
          <p style="font-weight: 900; margin-top: 10px; font-size: 12px;">THANK YOU FOR YOUR PATRONAGE!</p>
          <p>Your Vision, Our Priority.</p>
        </div>

        ${isReprint ? `
        <div class="audit-trail">
          Reprinted on ${formatDate(now)} by ${user?.full_name || 'Admin'}
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};
