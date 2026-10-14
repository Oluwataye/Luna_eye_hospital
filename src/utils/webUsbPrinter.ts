/**
 * WebUSB Direct Printing Driver for USB ESC/POS Thermal Printers
 * Communicates directly with USB endpoint without native OS drivers.
 */

export const isWebUsbSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
};

// Returns previously paired USB device if still accessible
export const getPairedUsbPrinter = async (): Promise<any | null> => {
  if (!isWebUsbSupported()) return null;
  try {
    const devices = await (navigator as any).usb.getDevices();
    if (devices && devices.length > 0) {
      return devices[0];
    }
    return null;
  } catch (err) {
    console.warn('Could not query paired USB devices:', err);
    return null;
  }
};

/**
 * Opens browser USB device picker to pair a thermal receipt printer
 */
export const requestUsbPrinter = async (): Promise<any> => {
  if (!isWebUsbSupported()) {
    throw new Error('WebUSB is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Network TCP mode.');
  }

  // Request any USB device with printer interface class (7) or generic vendor class
  return await (navigator as any).usb.requestDevice({
    filters: [
      { classCode: 7 } // USB Printer class
    ]
  }).catch(async () => {
    // Fallback: allow cashier to select any connected USB receipt printer
    return await (navigator as any).usb.requestDevice({ filters: [] });
  });
};

/**
 * Transmits raw ESC/POS binary data to the connected USB printer
 */
export const printViaWebUsb = async (
  bytes: Uint8Array,
  targetDevice?: any
): Promise<{ success: boolean; message: string }> => {
  if (!isWebUsbSupported()) {
    throw new Error('WebUSB is not supported in this browser.');
  }

  let device = targetDevice;
  if (!device) {
    device = await getPairedUsbPrinter() || undefined;
  }

  if (!device) {
    // Prompt cashier to select their USB printer
    device = await requestUsbPrinter();
  }

  if (!device) {
    throw new Error('No USB thermal printer selected.');
  }

  try {
    if (!device.opened) {
      await device.open();
    }

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Locate interface and OUT endpoint
    let selectedInterfaceNumber = 0;
    let outEndpointNumber: number | null = null;

    const configuration = device.configuration;
    if (configuration) {
      for (const iface of configuration.interfaces) {
        for (const alt of iface.alternates) {
          // Check for OUT bulk/interrupt endpoint
          const outEp = alt.endpoints.find((ep: any) => ep.direction === 'out');
          if (outEp) {
            selectedInterfaceNumber = iface.interfaceNumber;
            outEndpointNumber = outEp.endpointNumber;
            break;
          }
        }
        if (outEndpointNumber !== null) break;
      }
    }

    if (outEndpointNumber === null) {
      // Default standard endpoint 1 for typical POS printers
      outEndpointNumber = 1;
    }

    await device.claimInterface(selectedInterfaceNumber);

    // Send binary chunk
    const transferResult = await device.transferOut(outEndpointNumber, bytes.buffer);

    if (transferResult.status !== 'ok') {
      throw new Error(`USB transfer failed with status: ${transferResult.status}`);
    }

    return {
      success: true,
      message: `Printed successfully via USB (${device.productName || 'Thermal Printer'}).`
    };
  } catch (err: any) {
    console.error('[WebUSB Error]', err);
    throw new Error(err.message || 'Failed to print via WebUSB device.');
  }
};
