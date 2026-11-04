/**
 * ESC/POS Binary Command Generator for Thermal Receipt Printers (80mm / 58mm)
 * Pure TypeScript, zero external native dependencies.
 */

export interface EscposOptions {
  paperWidth?: '80mm' | '58mm';
  cutPaper?: boolean;
  isReprint?: boolean;
}

// Common ESC/POS Command Byte Sequences
export const ESCPOS = {
  INIT: [0x1B, 0x40],                     // ESC @ - Initialize printer
  ALIGN_LEFT: [0x1B, 0x61, 0x00],         // ESC a 0 - Align left
  ALIGN_CENTER: [0x1B, 0x61, 0x01],       // ESC a 1 - Align center
  ALIGN_RIGHT: [0x1B, 0x61, 0x02],        // ESC a 2 - Align right
  BOLD_ON: [0x1B, 0x45, 0x01],            // ESC E 1 - Bold font on
  BOLD_OFF: [0x1B, 0x45, 0x00],           // ESC E 0 - Bold font off
  DOUBLE_SIZE: [0x1D, 0x21, 0x11],        // GS ! 0x11 - 2x width & height
  DOUBLE_HEIGHT: [0x1D, 0x21, 0x01],      // GS ! 0x01 - 2x height
  NORMAL_SIZE: [0x1D, 0x21, 0x00],        // GS ! 0x00 - Normal size
  UNDERLINE_ON: [0x1B, 0x2D, 0x01],       // ESC - 1
  UNDERLINE_OFF: [0x1B, 0x2D, 0x00],      // ESC - 0
  FEED_LINES: (n: number) => [0x1B, 0x64, Math.max(1, Math.min(255, n))], // ESC d n
  CUT_FULL: [0x1D, 0x56, 0x41, 0x10],     // GS V 65 16 - Cut paper with 16-dot feed
  CUT_PARTIAL: [0x1D, 0x56, 0x42, 0x10],  // GS V 66 16 - Partial cut
};

/**
 * Encodes text into ASCII / Latin-1 bytes safe for ESC/POS printers.
 * Replaces Naira (₦) with 'N' or 'NGN' to avoid garbled printer characters.
 */
export const encodeAscii = (text: string): number[] => {
  const sanitized = text
    .replace(/₦/g, 'N')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  const bytes: number[] = [];
  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i);
    bytes.push(code > 127 ? 0x20 : code);
  }
  return bytes;
};

/**
 * Formats a two-column line (e.g. "Subtotal:            N5,000")
 * justified cleanly across the target paper character width.
 */
export const justifyBetween = (left: string, right: string, width: number): string => {
  const leftStr = left.trim();
  const rightStr = right.trim();
  const totalLen = leftStr.length + rightStr.length;

  if (totalLen >= width) {
    // If text exceeds width, truncate left slightly or stack
    const maxLeft = Math.max(4, width - rightStr.length - 1);
    const truncatedLeft = leftStr.slice(0, maxLeft);
    const spaces = Math.max(1, width - truncatedLeft.length - rightStr.length);
    return truncatedLeft + ' '.repeat(spaces) + rightStr;
  }

  const spaces = width - totalLen;
  return leftStr + ' '.repeat(spaces) + rightStr;
};

/**
 * Centers a text string within a specified column width.
 */
export const centerText = (text: string, width: number): string => {
  const trimmed = text.trim();
  if (trimmed.length >= width) return trimmed.slice(0, width);
  const leftPad = Math.floor((width - trimmed.length) / 2);
  const rightPad = width - trimmed.length - leftPad;
  return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
};

/**
 * Converts a Uint8Array into a base64 string for JSON payload delivery.
 */
export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Builds standard ESC/POS raw bytes for a Luna Eye Hospital receipt.
 */
export const buildEscposReceipt = (
  data: any,
  user: any,
  options: EscposOptions = {}
): Uint8Array => {
  const paperWidth = options.paperWidth || '80mm';
  const cols = paperWidth === '58mm' ? 32 : 48;
  const cutPaper = options.cutPaper !== false;
  const isReprint = Boolean(options.isReprint);

  const bytes: number[] = [];

  const addBytes = (...arrs: (number[] | number)[]) => {
    for (const item of arrs) {
      if (Array.isArray(item)) {
        bytes.push(...item);
      } else {
        bytes.push(item);
      }
    }
  };

  const addLine = (text: string = '', newline: boolean = true) => {
    addBytes(encodeAscii(text + (newline ? '\n' : '')));
  };

  const fmtCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val || 0);
    return `N${formatted}`;
  };

  const subtotal = data.total_amount || 0;
  const discount = data.discount || 0;
  const netTotal = Math.max(0, subtotal - discount);
  const paid = data.amount_paid || 0;
  const balance = data.balance ?? (netTotal - paid);
  const divider = '-'.repeat(cols);

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

  const clinicName = String(data.clinic?.name || 'LUNA EYE HOSPITAL').toUpperCase();
  const receiptNo = String(data.receipt_no || '384591');
  const patientName = String(data.patient_name || 'PATIENT').toUpperCase();
  const patientId = String(data.patient_id || data.file_no || '11025');

  // 1. Initialize Printer
  addBytes(ESCPOS.INIT);

  // 2. Hospital Header
  addBytes(ESCPOS.ALIGN_CENTER);
  addBytes(ESCPOS.BOLD_ON);
  addLine(clinicName);
  addLine(divider);
  addLine(`BAT. NO.: ${receiptNo}`);
  addLine(divider);

  // 3. Patient Line
  addBytes(ESCPOS.ALIGN_LEFT);
  addLine(`${patientName}(${patientId})`);
  addLine(divider);

  if (isReprint) {
    addBytes(ESCPOS.ALIGN_CENTER);
    addLine('*** OFFICIAL REPRINT (DUPLICATE) ***');
    addLine(divider);
    addBytes(ESCPOS.ALIGN_LEFT);
  }

  // 4. Items Table Header
  if (cols >= 48) {
    addLine('RevFund   Name            Qty Freq        price');
  } else {
    addLine('RevFund  Name        Qty  price');
  }
  addLine(divider);

  // Items Rows
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    addLine(centerText('No items listed', cols));
  } else {
    for (const item of items) {
      const rev = getRevFund(item);
      const name = String(item.description || item.name || 'Item');
      const qty = String(item.qty || 1);
      const freq = String(item.freq || item.frequency || '');
      const lineTotal = fmtCurrency((item.unit_price || 0) * (item.qty || 1)).replace('₦', '');

      if (cols >= 48) {
        const revCol = rev.length > 9 ? rev.slice(0, 9) : rev.padEnd(9, ' ');
        const nameCol = name.length > 15 ? name.slice(0, 15) : name.padEnd(15, ' ');
        const qtyCol = qty.padStart(3, ' ');
        const freqCol = freq.padStart(4, ' ');
        const priceCol = lineTotal.padStart(12, ' ');
        addLine(`${revCol} ${nameCol} ${qtyCol} ${freqCol} ${priceCol}`);
      } else {
        const revCol = rev.length > 8 ? rev.slice(0, 8) : rev.padEnd(8, ' ');
        const nameCol = name.length > 11 ? name.slice(0, 11) : name.padEnd(11, ' ');
        const qtyCol = qty.padStart(3, ' ');
        const priceCol = lineTotal.padStart(8, ' ');
        addLine(`${revCol} ${nameCol} ${qtyCol} ${priceCol}`);
      }
    }
  }

  addLine(divider);

  // 5. Financial Totals
  addLine(justifyBetween('Sub Total:', fmtCurrency(subtotal).replace('₦', ''), cols));
  if (discount > 0) {
    addLine(justifyBetween('Discount:', `-${fmtCurrency(discount).replace('₦', '')}`, cols));
    addLine(justifyBetween('Net Total:', fmtCurrency(netTotal).replace('₦', ''), cols));
  }
  if (paid !== undefined && paid !== netTotal) {
    addLine(justifyBetween('Amount Paid:', fmtCurrency(paid).replace('₦', ''), cols));
  }
  if (balance > 0) {
    addLine(justifyBetween('Balance Due:', fmtCurrency(balance).replace('₦', ''), cols));
  }
  addLine(divider);

  // 6. Audit Trail
  const cashierName = String(data.cashier || user?.full_name || 'cashier cashier');
  const cashierEmail = String(data.cashier_email || user?.email || 'cashier@healthrevolve.com');
  const printedByName = String(user?.full_name || data.cashier || 'cashier cashier');
  const printedByEmail = String(user?.email || data.cashier_email || 'cashier@healthrevolve.com');
  const timestampStr = formatAuditDate(new Date());

  addBytes(ESCPOS.ALIGN_LEFT);
  addLine(`BilledBy: ${cashierName} (${cashierEmail})`);
  addLine(`Processed/Printed By: ${printedByName}(${printedByEmail})`);
  addLine(`on the ${timestampStr}`);
  addLine(divider);

  // 7. Footer Branding
  addBytes(ESCPOS.ALIGN_CENTER);
  addBytes(ESCPOS.BOLD_ON);
  addLine('--POWERED');
  addLine('BY T-TECH SOLUTION--');
  addBytes(ESCPOS.BOLD_OFF);

  // 7. Feed lines & Cut
  addBytes(ESCPOS.FEED_LINES(cols >= 48 ? 4 : 3));

  if (cutPaper) {
    addBytes(ESCPOS.CUT_FULL);
  }

  return new Uint8Array(bytes);
};
