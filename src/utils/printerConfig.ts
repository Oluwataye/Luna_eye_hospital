/**
 * Thermal Printer Configuration & Local Persistence Manager
 */

export interface PrinterSettings {
  mode: 'network' | 'webusb' | 'browser';
  networkIp: string;
  networkPort: number;
  paperWidth: '80mm' | '58mm';
  autoPrintOnPayment: boolean;
  cutPaper: boolean;
}

export const PRINTER_STORAGE_KEY = 'luna_printer_settings_v2';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  mode: 'network',               // Default to Network Port 9100 for LAN hospital workstations
  networkIp: '192.168.1.200',    // Standard static IP assigned to hospital thermal receipt printer
  networkPort: 9100,             // Standard JetDirect / RAW ESC/POS port
  paperWidth: '80mm',            // Standard 80mm roll (48 cols)
  autoPrintOnPayment: true,      // One-click silent instant printing
  cutPaper: true                 // Auto-cut at end of receipt
};

export const getPrinterSettings = (): PrinterSettings => {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === 'webusb' || parsed.mode === 'network' || parsed.mode === 'browser' ? parsed.mode : DEFAULT_PRINTER_SETTINGS.mode,
      networkIp: parsed.networkIp || DEFAULT_PRINTER_SETTINGS.networkIp,
      networkPort: parseInt(parsed.networkPort, 10) || DEFAULT_PRINTER_SETTINGS.networkPort,
      paperWidth: parsed.paperWidth === '58mm' ? '58mm' : '80mm',
      autoPrintOnPayment: parsed.autoPrintOnPayment ?? DEFAULT_PRINTER_SETTINGS.autoPrintOnPayment,
      cutPaper: parsed.cutPaper ?? DEFAULT_PRINTER_SETTINGS.cutPaper
    };
  } catch (err) {
    console.error('Failed to load printer settings:', err);
    return DEFAULT_PRINTER_SETTINGS;
  }
};

export const savePrinterSettings = (settings: Partial<PrinterSettings>): PrinterSettings => {
  const current = getPrinterSettings();
  const updated: PrinterSettings = {
    ...current,
    ...settings
  };
  try {
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save printer settings:', err);
  }
  return updated;
};
