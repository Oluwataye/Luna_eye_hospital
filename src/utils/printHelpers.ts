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
  const fmtPrice = (val: number) => {
    return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const subtotal = data.total_amount || 0;
  const discount = data.discount || 0;
  const netTotal = Math.max(0, subtotal - discount);
  const paid = data.amount_paid !== undefined ? data.amount_paid : netTotal;
  const balance = data.balance !== undefined ? data.balance : Math.max(0, netTotal - paid);

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

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsHtml = items.length > 0 ? items.map((item: any) => {
    const revFund = getRevFund(item);
    const name = item.description || item.name || 'Item';
    const qty = item.qty || 1;
    const freq = item.freq || item.frequency || '';
    const lineTotal = item.unit_price ? (item.unit_price * qty) : (item.amount || 0);

    return `
      <tr>
        <td class="pos-cell rev-col">${revFund}</td>
        <td class="pos-cell name-col">${name}</td>
        <td class="pos-cell qty-col">${qty}</td>
        <td class="pos-cell freq-col">${freq}</td>
        <td class="pos-cell price-col">${fmtPrice(lineTotal)}</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="5" class="pos-cell" style="text-align: center; padding: 10px 4px;">No items listed</td>
    </tr>
  `;

  const cashierName = data.cashier || user?.full_name || 'cashier cashier';
  const cashierEmail = data.cashier_email || user?.email || 'cashier@healthrevolve.com';
  const printedByName = user?.full_name || data.cashier || 'cashier cashier';
  const printedByEmail = user?.email || data.cashier_email || 'cashier@healthrevolve.com';
  const timestampStr = formatAuditDate(new Date());

  const clinicName = (data.clinic?.name || 'LUNA EYE HOSPITAL').toUpperCase();
  const receiptNo = data.receipt_no || '384591';
  const patientName = (data.patient_name || 'PATIENT').toUpperCase();
  const patientId = data.patient_id || data.file_no || '11025';

  const styles = `
    * { 
      box-sizing: border-box !important; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    @page {
      margin: 2mm !important;
      size: auto !important;
    }
    body { 
      padding: 0 !important; 
      margin: 0 !important; 
      background: #fff !important; 
      width: 80mm !important; 
      font-family: Arial, Helvetica, sans-serif !important; 
      color: #000 !important;
      -webkit-font-smoothing: antialiased;
    }
    .pos-receipt-box { 
      width: 76mm !important; 
      margin: 2mm auto !important; 
      border: 1.5px solid #000 !important; 
      background: #fff !important; 
      color: #000 !important;
      padding: 0 !important;
    }
    .pos-header-title { 
      font-size: 13px !important; 
      font-weight: 900 !important; 
      text-align: center !important; 
      padding: 6px 4px !important; 
      border-bottom: 1.5px solid #000 !important; 
      text-transform: uppercase !important; 
      letter-spacing: 0.5px !important;
      line-height: 1.2 !important;
    }
    .pos-header-bat { 
      font-size: 12.5px !important; 
      font-weight: 900 !important; 
      text-align: center !important; 
      padding: 4px !important; 
      border-bottom: 1.5px solid #000 !important; 
      letter-spacing: 0.5px !important;
      text-transform: uppercase !important;
    }
    .pos-header-patient { 
      font-size: 11.5px !important; 
      font-weight: 900 !important; 
      text-align: left !important; 
      padding: 4px 6px !important; 
      border-bottom: 1.5px solid #000 !important; 
      text-transform: uppercase !important;
      letter-spacing: 0.2px !important;
      word-break: break-word !important;
    }
    .pos-reprint-banner {
      font-size: 10px !important;
      font-weight: 900 !important;
      text-align: center !important;
      padding: 3px !important;
      border-bottom: 1px dashed #000 !important;
      background: #f4f4f4 !important;
    }
    .pos-table-container {
      padding: 6px 6px 0 6px !important;
    }
    table.pos-grid-table { 
      width: 100% !important; 
      border-collapse: collapse !important; 
      border: 1px solid #000 !important; 
      margin: 0 !important;
    }
    table.pos-grid-table th { 
      font-size: 9.5px !important; 
      font-weight: 800 !important; 
      border: 1px solid #000 !important; 
      padding: 3px 2px !important; 
      background: #fff !important;
      color: #000 !important;
    }
    table.pos-grid-table td.pos-cell { 
      font-size: 9.5px !important; 
      font-weight: 600 !important;
      border: 1px solid #000 !important; 
      padding: 3px 2px !important; 
      vertical-align: top !important; 
      color: #000 !important;
    }
    .rev-col { width: 27% !important; text-align: left !important; word-break: break-word !important; }
    .name-col { width: 33% !important; text-align: left !important; word-break: break-word !important; }
    .qty-col { width: 9% !important; text-align: center !important; }
    .freq-col { width: 9% !important; text-align: center !important; }
    .price-col { width: 22% !important; text-align: right !important; white-space: nowrap !important; }

    .pos-subtotal-row td {
      border: 1px solid #000 !important;
      padding: 4px 4px !important;
      font-size: 11px !important;
      font-weight: 900 !important;
    }

    .pos-audit-block {
      padding: 8px 6px 4px 6px !important;
      font-size: 10.5px !important;
      font-weight: 600 !important;
      line-height: 1.35 !important;
      color: #000 !important;
      word-break: break-word !important;
    }

    .pos-powered-by {
      font-size: 15px !important;
      font-weight: 900 !important;
      text-align: center !important;
      padding: 12px 6px 14px 6px !important;
      letter-spacing: 0.5px !important;
      line-height: 1.25 !important;
      text-transform: uppercase !important;
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${receiptNo}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="pos-receipt-box">
        <div class="pos-header-title">${clinicName}</div>
        <div class="pos-header-bat">BAT. NO.: ${receiptNo}</div>
        <div class="pos-header-patient">${patientName}(${patientId})</div>

        ${isReprint ? `<div class="pos-reprint-banner">*** OFFICIAL REPRINT (DUPLICATE) ***</div>` : ''}

        <div class="pos-table-container">
          <table class="pos-grid-table">
            <thead>
              <tr>
                <th class="rev-col">RevFund</th>
                <th class="name-col">Name</th>
                <th class="qty-col">Qty</th>
                <th class="freq-col">Freq</th>
                <th class="price-col">price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="pos-subtotal-row">
                <td colspan="4" style="text-align: left;">Sub Total:</td>
                <td style="text-align: right;">${fmtPrice(subtotal)}</td>
              </tr>
              ${discount > 0 ? `
              <tr class="pos-subtotal-row">
                <td colspan="4" style="text-align: left;">Discount:</td>
                <td style="text-align: right;">-${fmtPrice(discount)}</td>
              </tr>
              <tr class="pos-subtotal-row">
                <td colspan="4" style="text-align: left;">Net Total:</td>
                <td style="text-align: right;">${fmtPrice(netTotal)}</td>
              </tr>
              ` : ''}
              ${paid !== undefined && paid !== netTotal ? `
              <tr class="pos-subtotal-row">
                <td colspan="4" style="text-align: left;">Amount Paid:</td>
                <td style="text-align: right;">${fmtPrice(paid)}</td>
              </tr>
              ` : ''}
              ${balance > 0 ? `
              <tr class="pos-subtotal-row">
                <td colspan="4" style="text-align: left;">Balance Due:</td>
                <td style="text-align: right;">${fmtPrice(balance)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <div class="pos-audit-block">
          <div>BilledBy: ${cashierName} (${cashierEmail})</div>
          <div>Processed/Printed By: ${printedByName}(${printedByEmail})</div>
          <div>on the ${timestampStr}</div>
        </div>

        <div class="pos-powered-by">
          --POWERED<br/>
          BY T-TECH SOLUTION--
        </div>
      </div>
    </body>
    </html>
  `;
};
