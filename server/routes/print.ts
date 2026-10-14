import { Router, Request, Response } from 'express';
import net from 'net';

const router = Router();

// Validate IP / Hostname helper
const isValidHost = (host: string): boolean => {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  // Valid IPv4 format or standard hostname
  const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const hostnamePattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$|^[a-zA-Z0-9\-]+$/;
  return ipv4Pattern.test(trimmed) || hostnamePattern.test(trimmed);
};

// Helper: send raw buffer to TCP printer on port 9100
const sendBufferToTcpPrinter = (
  host: string,
  port: number,
  buffer: Buffer,
  timeoutMs: number = 4000
): Promise<{ success: boolean; bytesWritten: number }> => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let hasEnded = false;

    const cleanup = () => {
      if (!socket.destroyed) {
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.write(buffer, (err) => {
        if (err) {
          cleanup();
          return reject(new Error(`Failed to transmit data to printer: ${err.message}`));
        }
        // Gracefully finish transmission
        socket.end(() => {
          hasEnded = true;
          cleanup();
          resolve({ success: true, bytesWritten: buffer.length });
        });
      });
    });

    socket.on('timeout', () => {
      cleanup();
      reject(new Error(`Printer at ${host}:${port} timed out after ${timeoutMs}ms. Please check if the printer is powered on and connected to the local network.`));
    });

    socket.on('error', (err: any) => {
      cleanup();
      let msg = err.message || 'TCP socket communication error';
      if (err.code === 'ECONNREFUSED') {
        msg = `Connection refused by printer at ${host}:${port}. Verify port 9100 is enabled in printer RAW/JetDirect settings.`;
      } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
        msg = `Network path unreachable to ${host}. Ensure the server host and thermal printer share the same subnet or router.`;
      } else if (err.code === 'ETIMEDOUT') {
        msg = `Connection to ${host}:${port} timed out. Device did not respond.`;
      }
      reject(new Error(msg));
    });

    // Initiate TCP connection
    socket.connect(port, host);
  });
};

/**
 * POST /api/print/network
 * Sends raw ESC/POS bytes directly to a network thermal printer on Port 9100
 */
router.post('/network', async (req: Request, res: Response) => {
  try {
    const { ip, port = 9100, dataBase64, rawBytes } = req.body || {};

    if (!ip || !isValidHost(ip)) {
      return res.status(400).json({ error: 'Valid printer IP address or hostname is required (e.g. 192.168.1.200).' });
    }

    const targetPort = parseInt(port, 10) || 9100;
    if (targetPort < 1 || targetPort > 65535) {
      return res.status(400).json({ error: 'Port must be between 1 and 65535 (standard: 9100).' });
    }

    let buffer: Buffer;
    if (dataBase64 && typeof dataBase64 === 'string') {
      buffer = Buffer.from(dataBase64, 'base64');
    } else if (Array.isArray(rawBytes)) {
      buffer = Buffer.from(rawBytes);
    } else {
      return res.status(400).json({ error: 'Receipt data must be provided as dataBase64 or rawBytes array.' });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty print payload provided.' });
    }

    const result = await sendBufferToTcpPrinter(ip.trim(), targetPort, buffer);
    return res.json({
      success: true,
      message: `Receipt dispatched silently to ${ip.trim()}:${targetPort} (${result.bytesWritten} bytes).`,
      bytesWritten: result.bytesWritten
    });
  } catch (err: any) {
    console.error('[PRINTER ERROR]', err.message);
    return res.status(502).json({ error: err.message || 'Failed to print to network thermal printer.' });
  }
});

/**
 * POST /api/print/test
 * Sends a lightweight diagnostic test slip with Luna Eye Hospital branding and cut
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { ip, port = 9100 } = req.body || {};

    if (!ip || !isValidHost(ip)) {
      return res.status(400).json({ error: 'Valid printer IP address is required (e.g. 192.168.1.200).' });
    }

    const targetPort = parseInt(port, 10) || 9100;
    const now = new Date().toLocaleString('en-GB');

    // Build raw ESC/POS test packet
    // ESC @ (Init)
    // ESC a 1 (Center)
    // ESC E 1 (Bold ON)
    // GS ! 0x11 (Double size)
    const headerBytes = [
      0x1B, 0x40,             // Init
      0x1B, 0x61, 0x01,       // Center align
      0x1D, 0x21, 0x11,       // Double width + height
      ...Buffer.from('LUNA EYE HOSPITAL\n', 'ascii'),
      0x1D, 0x21, 0x00,       // Normal size
      0x1B, 0x45, 0x01,       // Bold on
      ...Buffer.from('THERMAL PRINTER TEST\n', 'ascii'),
      0x1B, 0x45, 0x00,       // Bold off
      ...Buffer.from('--------------------------------\n', 'ascii'),
      ...Buffer.from(`Status: ONLINE (Port ${targetPort})\n`, 'ascii'),
      ...Buffer.from(`Date: ${now}\n`, 'ascii'),
      ...Buffer.from(`Target IP: ${ip}\n`, 'ascii'),
      ...Buffer.from('Raw ESC/POS communication: OK\n', 'ascii'),
      ...Buffer.from('--------------------------------\n', 'ascii'),
      0x1B, 0x64, 0x03,       // Feed 3 lines
      0x1D, 0x56, 0x41, 0x10  // Cut paper
    ];

    const testBuffer = Buffer.from(headerBytes);
    await sendBufferToTcpPrinter(ip.trim(), targetPort, testBuffer);

    return res.json({
      success: true,
      message: `Diagnostic test slip successfully printed at ${ip.trim()}:${targetPort}!`
    });
  } catch (err: any) {
    console.error('[PRINTER TEST ERROR]', err.message);
    return res.status(502).json({ error: err.message || 'Failed to reach network thermal printer.' });
  }
});

export default router;
