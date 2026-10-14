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

  const formatDate = (date: any) => {
    try {
      return new Date(date).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(date || '');
    }
  };

  const subtotal = data.total_amount || 0;
  const discount = data.discount || 0;
  const netTotal = Math.max(0, subtotal - discount);
  const paid = data.amount_paid || 0;
  const balance = data.balance ?? (netTotal - paid);
  const divider = '-'.repeat(cols);
  const doubleDivider = '='.repeat(cols);

  // 1. Initialize Printer
  addBytes(ESCPOS.INIT);

  // 2. Hospital Header (Centered, bold, double height)
  addBytes(ESCPOS.ALIGN_CENTER);
  addBytes(ESCPOS.BOLD_ON);
  if (cols >= 48) {
    addBytes(ESCPOS.DOUBLE_SIZE);
    addLine('LUNA EYE HOSPITAL');
    addBytes(ESCPOS.NORMAL_SIZE);
  } else {
    addBytes(ESCPOS.DOUBLE_HEIGHT);
    addLine('LUNA EYE HOSPITAL');
    addBytes(ESCPOS.NORMAL_SIZE);
  }
  addBytes(ESCPOS.BOLD_OFF);

  // Subtitle / Address Info
  addLine('Behind Bomas Supermarket,');
  addLine('Old Airport Road, Minna');
  addLine('Tel: 09044689558 | WhatsApp: 09114111418');
  addLine('lunaeyehospital@gmail.com');

  // Title Box
  addLine(divider);
  addBytes(ESCPOS.BOLD_ON);
  addLine(isReprint ? '*** DUPLICATE REPRINT ***' : 'OFFICIAL PAYMENT RECEIPT');
  addBytes(ESCPOS.BOLD_OFF);
  addLine(divider);

  // 3. Metadata (Left-aligned)
  addBytes(ESCPOS.ALIGN_LEFT);
  addLine(justifyBetween('Receipt No:', String(data.receipt_no || 'N/A'), cols));
  addLine(justifyBetween('Date/Time:', formatDate(data.created_at || new Date()), cols));
  addLine(justifyBetween('Patient ID:', `#${data.patient_id || 'Walk-In'}`, cols));
  addLine(justifyBetween('Patient Name:', String(data.patient_name || 'Walk-In Patient').toUpperCase(), cols));
  if (data.cashier || user?.full_name) {
    addLine(justifyBetween('Cashier:', String(data.cashier || user?.full_name), cols));
  }
  addLine(divider);

  // 4. Items Table Header
  if (cols >= 48) {
    // 80mm table: Desc (22), Qty (4), Rate (10), Total (12)
    addLine('Item                   Qty      Rate       Total');
  } else {
    // 58mm table: Desc (13), Qty (3), Rate (7), Total (9)
    addLine('Item          Qty   Rate   Total');
  }
  addLine(divider);

  // Items Rows
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    addLine(centerText('No items listed', cols));
  } else {
    for (const item of items) {
      const desc = String(item.description || 'Service/Item');
      const qty = String(item.qty || 1);
      const rate = fmtCurrency(item.unit_price || 0);
      const rowTotal = fmtCurrency((item.unit_price || 0) * (item.qty || 1));

      if (cols >= 48) {
        // Truncate desc if needed
        const descCol = desc.length > 21 ? desc.slice(0, 21) : desc.padEnd(21, ' ');
        const qtyCol = qty.padStart(4, ' ');
        const rateCol = rate.padStart(10, ' ');
        const totalCol = rowTotal.padStart(12, ' ');
        addLine(`${descCol} ${qtyCol} ${rateCol} ${totalCol}`);
      } else {
        const descCol = desc.length > 13 ? desc.slice(0, 13) : desc.padEnd(13, ' ');
        const qtyCol = qty.padStart(3, ' ');
        const rateCol = rate.padStart(7, ' ');
        const totalCol = rowTotal.padStart(8, ' ');
        addLine(`${descCol} ${qtyCol} ${rateCol} ${totalCol}`);
      }
    }
  }

  addLine(divider);

  // 5. Financial Totals
  addLine(justifyBetween('Subtotal:', fmtCurrency(subtotal), cols));
  if (discount > 0) {
    addLine(justifyBetween('Discount Applied:', `-${fmtCurrency(discount)}`, cols));
  }

  addLine(doubleDivider);
  addBytes(ESCPOS.BOLD_ON);
  if (cols >= 48) {
    addBytes(ESCPOS.DOUBLE_HEIGHT);
  }
  addLine(justifyBetween('TOTAL PAYABLE:', fmtCurrency(netTotal), cols));
  addBytes(ESCPOS.NORMAL_SIZE);
  addBytes(ESCPOS.BOLD_OFF);
  addLine(doubleDivider);

  // Payment Breakdown
  addBytes(ESCPOS.BOLD_ON);
  addLine(justifyBetween('AMOUNT PAID:', fmtCurrency(paid), cols));
  addBytes(ESCPOS.BOLD_OFF);
  addLine(justifyBetween('Payment Mode:', String(data.payment_method || 'Cash'), cols));

  if (data.payment_method === 'Mixed' && data.payment_details) {
    try {
      const details = typeof data.payment_details === 'string'
        ? JSON.parse(data.payment_details)
        : data.payment_details;
      if (details.cash) addLine(justifyBetween('  - Cash:', fmtCurrency(details.cash), cols));
      if (details.bank) addLine(justifyBetween('  - Bank/POS:', fmtCurrency(details.bank), cols));
    } catch {
      // Ignore JSON parse errors for details
    }
  }

  addBytes(ESCPOS.BOLD_ON);
  addLine(justifyBetween('BALANCE DUE:', fmtCurrency(balance), cols));
  addBytes(ESCPOS.BOLD_OFF);
  addLine(divider);

  // 6. Footer (Centered)
  addBytes(ESCPOS.ALIGN_CENTER);
  addLine('THANK YOU FOR YOUR PATRONAGE!');
  addLine('Your Vision, Our Priority.');

  if (isReprint) {
    const printTime = formatDate(new Date());
    addLine(`Reprinted on ${printTime}`);
    addLine(`Operator: ${user?.full_name || 'Admin'}`);
  }

  // 7. Feed lines & Cut
  addBytes(ESCPOS.FEED_LINES(cols >= 48 ? 4 : 3));

  if (cutPaper) {
    addBytes(ESCPOS.CUT_FULL);
  }

  return new Uint8Array(bytes);
};
