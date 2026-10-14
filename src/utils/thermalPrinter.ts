/**
 * Unified Thermal Receipt Dispatcher
 * Bridges raw ESC/POS network sockets, WebUSB direct connections, and browser print fallback.
 */

import { api } from '../api';
import { buildReceiptHtml, printReceiptContent } from './printHelpers';
import { buildEscposReceipt, uint8ArrayToBase64 } from './escpos';
import { getPrinterSettings } from './printerConfig';
import type { PrinterSettings } from './printerConfig';
import { printViaWebUsb } from './webUsbPrinter';

export interface PrintReceiptResult {
  success: boolean;
  mode: 'network' | 'webusb' | 'browser';
  fallbackUsed?: boolean;
  message: string;
}

/**
 * Dispatches an official payment receipt or reprint to the configured thermal printer.
 * If silent direct raw printing fails, smoothly falls back to browser print dialog.
 */
export const dispatchReceiptPrint = async (
  receiptData: any,
  user: any,
  options: { isReprint?: boolean; forceBrowser?: boolean } = {}
): Promise<PrintReceiptResult> => {
  const settings: PrinterSettings = getPrinterSettings();
  const isReprint = Boolean(options.isReprint);

  // If user explicitly chose browser print or mode is browser, use iframe
  if (options.forceBrowser || settings.mode === 'browser') {
    const html = buildReceiptHtml(receiptData, user, isReprint);
    printReceiptContent(html);
    return {
      success: true,
      mode: 'browser',
      message: 'Opened browser print dialog.'
    };
  }

  // Generate ESC/POS raw binary
  const escposBytes = buildEscposReceipt(receiptData, user, {
    paperWidth: settings.paperWidth,
    cutPaper: settings.cutPaper,
    isReprint
  });

  // Mode 1: Network ESC/POS (Port 9100) via backend proxy
  if (settings.mode === 'network') {
    try {
      const base64Data = uint8ArrayToBase64(escposBytes);
      const res = await api.printNetworkRaw({
        ip: settings.networkIp,
        port: settings.networkPort,
        dataBase64: base64Data
      });

      return {
        success: true,
        mode: 'network',
        message: res.message || `Dispatched to network printer at ${settings.networkIp}:${settings.networkPort}`
      };
    } catch (err: any) {
      console.warn('[Thermal Printer] Network raw print failed, falling back to browser print:', err);
      // Fallback to browser iframe print dialog
      const html = buildReceiptHtml(receiptData, user, isReprint);
      printReceiptContent(html);
      return {
        success: true,
        mode: 'browser',
        fallbackUsed: true,
        message: `Network printer unreachable (${err.message}). Opened browser print dialog as fallback.`
      };
    }
  }

  // Mode 2: Client WebUSB direct
  if (settings.mode === 'webusb') {
    try {
      const res = await printViaWebUsb(escposBytes);
      return {
        success: true,
        mode: 'webusb',
        message: res.message
      };
    } catch (err: any) {
      console.warn('[Thermal Printer] WebUSB print failed, falling back to browser print:', err);
      const html = buildReceiptHtml(receiptData, user, isReprint);
      printReceiptContent(html);
      return {
        success: true,
        mode: 'browser',
        fallbackUsed: true,
        message: `USB print failed (${err.message}). Opened browser print dialog as fallback.`
      };
    }
  }

  // Catch-all
  const html = buildReceiptHtml(receiptData, user, isReprint);
  printReceiptContent(html);
  return {
    success: true,
    mode: 'browser',
    message: 'Opened browser print dialog.'
  };
};
