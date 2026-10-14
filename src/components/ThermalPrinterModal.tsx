import React, { useState } from 'react';
import { Printer, Wifi, Usb, Sliders, CheckCircle2, AlertCircle, X, Loader2, Sparkles } from 'lucide-react';
import { api } from '../api';
import { getPrinterSettings, savePrinterSettings } from '../utils/printerConfig';
import type { PrinterSettings } from '../utils/printerConfig';
import { isWebUsbSupported, requestUsbPrinter, getPairedUsbPrinter, printViaWebUsb } from '../utils/webUsbPrinter';
import { ESCPOS, encodeAscii } from '../utils/escpos';

interface Props {
  onClose?: () => void;
  onSaved?: (settings: PrinterSettings) => void;
  embedded?: boolean;
}

export const ThermalPrinterModal: React.FC<Props> = ({ onClose, onSaved, embedded = false }) => {
  const [settings, setSettings] = useState<PrinterSettings>(getPrinterSettings());
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });
  const [isPairingUsb, setIsPairingUsb] = useState(false);
  const [usbDeviceName, setUsbDeviceName] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Check existing USB device on mount
  React.useEffect(() => {
    if (isWebUsbSupported()) {
      getPairedUsbPrinter().then(device => {
        if (device) setUsbDeviceName(device.productName || 'Paired USB Device');
      });
    }
  }, []);

  const handleSave = () => {
    savePrinterSettings(settings);
    if (onSaved) onSaved(settings);
    if (embedded) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else if (onClose) {
      onClose();
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestStatus({ type: 'idle', message: '' });

    try {
      if (settings.mode === 'network') {
        const res = await api.testNetworkPrinter({
          ip: settings.networkIp,
          port: settings.networkPort
        });
        setTestStatus({
          type: 'success',
          message: res.message || 'Test slip dispatched successfully to network printer!'
        });
      } else if (settings.mode === 'webusb') {
        const testBytes = new Uint8Array([
          ...ESCPOS.INIT,
          ...ESCPOS.ALIGN_CENTER,
          ...ESCPOS.BOLD_ON,
          ...encodeAscii('LUNA EYE HOSPITAL\n'),
          ...ESCPOS.NORMAL_SIZE,
          ...encodeAscii('USB THERMAL PRINTER TEST\n'),
          ...encodeAscii('--------------------------------\n'),
          ...encodeAscii('Status: USB CONNECTED OK\n'),
          ...encodeAscii(`Roll Width: ${settings.paperWidth}\n`),
          ...encodeAscii('--------------------------------\n'),
          ...ESCPOS.FEED_LINES(3),
          ...(settings.cutPaper ? ESCPOS.CUT_FULL : [])
        ]);

        const res = await printViaWebUsb(testBytes);
        setTestStatus({
          type: 'success',
          message: res.message
        });
      } else {
        setTestStatus({
          type: 'success',
          message: 'Browser mode uses system print dialog (standard PDF/dialog).'
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: err.message || 'Test print failed. Check printer connection and settings.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePairUsb = async () => {
    setIsPairingUsb(true);
    try {
      const dev = await requestUsbPrinter();
      setUsbDeviceName(dev.productName || 'Paired USB Thermal Printer');
      setTestStatus({
        type: 'success',
        message: `Successfully paired with ${dev.productName || 'USB Printer'}!`
      });
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setTestStatus({
          type: 'error',
          message: err.message || 'Failed to pair USB printer.'
        });
      }
    } finally {
      setIsPairingUsb(false);
    }
  };

  const content = (
    <div className="leh-modal-card" style={{
      background: '#ffffff',
      borderRadius: '16px',
      width: '100%',
      maxWidth: embedded ? '760px' : '540px',
      boxShadow: embedded ? '0 1px 3px rgba(0,0,0,0.05)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Printer size={22} color="#60a5fa" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px' }}>
              Thermal Receipt Printer
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              ESC/POS Raw Direct & Silent Printing (Under 1s)
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
              Connection Interface
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, mode: 'network' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: `2px solid ${settings.mode === 'network' ? '#3b82f6' : '#e2e8f0'}`,
                  background: settings.mode === 'network' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Wifi size={20} color={settings.mode === 'network' ? '#2563eb' : '#64748b'} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: settings.mode === 'network' ? '#1d4ed8' : '#334155' }}>
                  Network (TCP)
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Port 9100</span>
              </button>

              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, mode: 'webusb' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: `2px solid ${settings.mode === 'webusb' ? '#3b82f6' : '#e2e8f0'}`,
                  background: settings.mode === 'webusb' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Usb size={20} color={settings.mode === 'webusb' ? '#2563eb' : '#64748b'} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: settings.mode === 'webusb' ? '#1d4ed8' : '#334155' }}>
                  Direct USB
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>WebUSB API</span>
              </button>

              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, mode: 'browser' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: `2px solid ${settings.mode === 'browser' ? '#3b82f6' : '#e2e8f0'}`,
                  background: settings.mode === 'browser' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Sliders size={20} color={settings.mode === 'browser' ? '#2563eb' : '#64748b'} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: settings.mode === 'browser' ? '#1d4ed8' : '#334155' }}>
                  Browser Dialog
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>System Print</span>
              </button>
            </div>
          </div>

          {/* Network Settings Details */}
          {settings.mode === 'network' && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Printer IP Address
                  </label>
                  <input
                    type="text"
                    value={settings.networkIp}
                    onChange={e => setSettings(s => ({ ...s, networkIp: e.target.value }))}
                    placeholder="e.g. 192.168.1.200"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    RAW Port
                  </label>
                  <input
                    type="number"
                    value={settings.networkPort}
                    onChange={e => setSettings(s => ({ ...s, networkPort: parseInt(e.target.value, 10) || 9100 }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Default RAW port for Epson, Xprinter, Rongta, and POS-80 network receipt printers is <strong>9100</strong>.
              </p>
            </div>
          )}

          {/* WebUSB Settings Details */}
          {settings.mode === 'webusb' && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block' }}>
                    USB Device:
                  </span>
                  <span style={{ fontSize: '12px', color: usbDeviceName ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {usbDeviceName || 'No USB printer paired yet'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlePairUsb}
                  disabled={isPairingUsb}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isPairingUsb ? <Loader2 size={14} className="animate-spin" /> : <Usb size={14} />}
                  Pair Device
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Works in Chrome, Edge, and Opera. Requires selecting your USB printer once.
              </p>
            </div>
          )}

          {/* Paper Roll Width & Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                Paper Roll Width
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, paperWidth: '80mm' }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1.5px solid ${settings.paperWidth === '80mm' ? '#3b82f6' : '#e2e8f0'}`,
                    background: settings.paperWidth === '80mm' ? '#eff6ff' : '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: settings.paperWidth === '80mm' ? '#1d4ed8' : '#334155',
                    cursor: 'pointer'
                  }}
                >
                  80mm (48 cols)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, paperWidth: '58mm' }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1.5px solid ${settings.paperWidth === '58mm' ? '#3b82f6' : '#e2e8f0'}`,
                    background: settings.paperWidth === '58mm' ? '#eff6ff' : '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: settings.paperWidth === '58mm' ? '#1d4ed8' : '#334155',
                    cursor: 'pointer'
                  }}
                >
                  58mm (32 cols)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={settings.autoPrintOnPayment}
                  onChange={e => setSettings(s => ({ ...s, autoPrintOnPayment: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                />
                Auto-print immediately on payment
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={settings.cutPaper}
                  onChange={e => setSettings(s => ({ ...s, cutPaper: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                />
                Auto-cut paper at end (GS V)
              </label>
            </div>
          </div>

          {/* Test Status Banner */}
          {testStatus.type !== 'idle' && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: testStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testStatus.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: testStatus.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {testStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span style={{ flex: 1 }}>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} color="#f59e0b" />}
            Test Print Slip
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {savedSuccess && (
              <span style={{ fontSize: '13px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={15} /> Saved!
              </span>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
  );

  if (embedded) {
    return <div style={{ width: '100%', maxWidth: '760px' }}>{content}</div>;
  }

  return (
    <div className="leh-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      {content}
    </div>
  );
};

export default ThermalPrinterModal;
