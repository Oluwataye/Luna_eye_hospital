import 'dotenv/config';
process.env.UV_THREADPOOL_SIZE = '64'; // Scale up Node's internal thread pool for SQLite & bcrypt concurrency
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
const serverRootDir = __dirname.includes('dist') ? path.join(__dirname, '..') : __dirname;
const isPackaged = typeof (process as any).pkg !== 'undefined';
const writableRootDir = isPackaged ? path.dirname(process.execPath) : serverRootDir;
import multer from 'multer';
import dgram from 'dgram';
import os from 'os';
import cron from 'node-cron';
import db from './db';
import * as redis from './redis';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PatientStatus } from './constants';
import { validateRequest, LoginSchema, CreateUserSchema, UpdateUserSchema, ChangePasswordSchema, CreatePatientSchema, UpdatePatientSchema, CreateFamilySchema, UpdateFamilySchema, LinkPatientFamilySchema, AuditLogQuerySchema, PatientListQuerySchema, ReprintQuerySchema, PaginationQuerySchema, RequiredReportQuerySchema, CreateTransactionSchema } from './validation';
import { registerSwaggerDocs } from './openapi';

// Clean Architecture Imports
import { UserRepositorySqlite } from './src/adapters/repositories/user.repository.sqlite';
import { AuthUseCase } from './src/usecases/auth/auth.usecase';
import { AuthController } from './src/adapters/controllers/auth.controller';
import { createAuthMiddleware } from './src/infrastructure/web/middlewares/auth.middleware';
import { PatientRepositorySqlite } from './src/adapters/repositories/patient.repository.sqlite';
import { PatientUseCase } from './src/usecases/patient/patient.usecase';
import { PatientController } from './src/adapters/controllers/patient.controller';
import { FamilyRepositorySqlite } from './src/adapters/repositories/family.repository.sqlite';
import { FamilyUseCase } from './src/usecases/family/family.usecase';
import { FamilyController } from './src/adapters/controllers/family.controller';
import voiceRoutes from './routes/voice';
import printRoutes from './routes/print';
import { insuranceRouter } from './routes/insurance';
import { startAudioCleanupJob } from './jobs/audioCleanup';
import { sweepAndDispatchReadyBatches } from './src/services/ediBridge';
import { startQueueWorker } from './src/services/ediQueue';
import { setupVoiceWebSocket, broadcastWsVoiceStatus } from './websocket';
import { spawn } from 'child_process';

// Extend Express Request namespace for authenticateToken compatibility
declare global {
  namespace Express {
    interface Request {
      user?: any;
      sanitizedBody?: any;
      sanitizedQuery?: any;
      sanitizedParams?: any;
    }
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '80', 10); // Changed default to 80 for LAN accessibility
// Use JWT secret from environment or generate a secure random 256-bit one on startup to prevent hardcoded defaults
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET environment variable is not set. A random secret has been generated. Active sessions will invalidate on server restart.');
}

// --- AUDIT LOG HELPER ---
const logAudit = (user_id: any, user_name: any, user_role: any, action_type: string, module: string, details: string, status: string = 'Standard', ip_address: string = '127.0.0.1') => {
  db.run(
    'INSERT INTO audit_logs (user_id, user_name, user_role, action_type, module, details, status, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id, user_name, user_role, action_type, module, details, status, ip_address],
    (err) => { if (err) console.error('Audit Log Error:', err); }
  );
};

let sseClients: { id: number; role: string; res: any }[] = [];
let sseClientId = 0;

function broadcastToClients() {
  sseClients.forEach(client => {
    db.all(
      'SELECT * FROM notifications WHERE user_role = ? OR user_role = "All" ORDER BY created_at DESC LIMIT 50',
      [client.role],
      (err, rows) => {
        if (!err && rows) {
          client.res.write(`data: ${JSON.stringify(rows)}\n\n`);
        }
      }
    );
  });
}

// SSE Heartbeat Ping (Every 20 seconds to keep streams alive and prune stale clients)
setInterval(() => {
  const activeClients: typeof sseClients = [];
  sseClients.forEach(client => {
    try {
      client.res.write(': ping\n\n');
      activeClients.push(client);
    } catch (err) {
      console.warn(`[SSE] Cleaned up stale client connection: ID ${client.id}`);
    }
  });
  sseClients = activeClients;
}, 20000);

// Broadcast Voice AI status change instantly to all connected SSE workstations and WebSockets
export function broadcastVoiceAiStatus(ai_enabled: boolean) {
  const payload = JSON.stringify({ ai_enabled, timestamp: Date.now() });
  sseClients.forEach(client => {
    try {
      client.res.write(`event: voice_ai_status\ndata: ${payload}\n\n`);
    } catch (err) {
      console.warn(`[SSE] Cleaned up stale client connection: ID ${client.id}`);
    }
  });
  broadcastWsVoiceStatus(ai_enabled);
}

const notify = (user_role: string, message: string, module: string, patient_id: string | null = null) => {
  db.run(
    'INSERT INTO notifications (user_role, message, module, patient_id) VALUES (?, ?, ?, ?)',
    [user_role, message, module, patient_id],
    (err) => { 
      if (err) {
        console.error('Notification Error:', err); 
      } else {
        broadcastToClients();
      }
    }
  );
};

// Database file path
const dbPath = path.resolve(writableRootDir, 'luna_eye_hospital.db');
console.log(`[SERVER] Using database path: ${dbPath}`);

// ── SQLITE_BUSY retry helper ──
// Wraps db.run with exponential backoff retries on SQLITE_BUSY / SQLITE_LOCKED
const BUSY_MAX_RETRIES = 4;
const dbRun = (sql: string, params: any[] = [], retries = 0): Promise<any> => new Promise((resolve, reject) => {
  db.run(sql, params, function (this: any, err: Error | null) {
    if (err && (err.message.includes('SQLITE_BUSY') || err.message.includes('SQLITE_LOCKED')) && retries < BUSY_MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 50; // 50ms, 100ms, 200ms, 400ms
      console.warn(`[DB] BUSY retry ${retries + 1} in ${delay}ms for: ${sql.slice(0, 60)}`);
      setTimeout(() => dbRun(sql, params, retries + 1).then(resolve).catch(reject), delay);
    } else if (err) {
      reject(err);
    } else {
      resolve(this);
    }
  });
});

// ── CORS ──
const ENV_LAN_IP = process.env.LAN_IP || '';
const allowedOrigins = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:3200',
  'http://127.0.0.1:3200',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
  ...(ENV_LAN_IP ? [`http://${ENV_LAN_IP}`, `http://${ENV_LAN_IP}:3200`, `http://${ENV_LAN_IP}:3100`] : []),
  `http://${process.env.DOMAIN_NAME || 'lunaeyehospital'}`,
];
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (same-origin, mobile, curl) or localhost with any port
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]).trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown-ip';
};

const isLocalhost = (ip: string): boolean => {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

// ── Rate limiters ──
const loginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 5, // Maximum 5 attempts per 2 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 2 minutes before trying again.' },
  skip: (req) => {
    if (req.path !== '/api/login' && req.path !== '/login') return true;
    const ip = getClientIp(req);
    return isLocalhost(ip);
  },
});

const distributedLoginLimiter = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/api/login' && req.path !== '/login') {
    return next();
  }

  const ip = getClientIp(req);
  if (isLocalhost(ip)) {
    return next();
  }

  if (redis.isRedisAvailable()) {
    const key = `rate-limit:login:${ip}`;
    const attempts = await redis.incrRateLimit(key, 120);

    if (attempts > 5) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait 2 minutes before trying again.' });
    }
    return next();
  }

  return loginLimiter(req, res, next);
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => {
    const ip = getClientIp(req);
    return isLocalhost(ip);
  },
});

// ── Request timeout middleware (15 s) ──
const requestTimeout = (req: Request, res: Response, next: NextFunction) => {
  const TIMEOUT_MS = 15000;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[TIMEOUT] ${req.method} ${req.url} exceeded ${TIMEOUT_MS}ms`);
      res.status(408).json({ error: 'Request timed out. Please try again.' });
    }
  }, TIMEOUT_MS);
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
};

// ── Cookie & Password Helpers ──
// Inline cookie parser to avoid installing cookie-parser middleware
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
};

// Strict password strength validator: 8+ chars, uppercase, lowercase, digit, symbol
const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') return false;
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSymbol;
};

// ── Input Sanitization Helpers ──
const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;
  // Remove script tags and escape < and > to prevent HTML injection and XSS
  return str
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const sanitizeObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
  }
  return obj;
};

// ── Deep Clone Helper ──
const deepClone = (val: any): any => {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(deepClone);
  }
  const clone: any = {};
  for (const key in val) {
    if (Object.prototype.hasOwnProperty.call(val, key)) {
      clone[key] = deepClone(val[key]);
    }
  }
  return clone;
};

const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  req.sanitizedBody = req.body ? sanitizeObject(deepClone(req.body)) : req.body;
  req.sanitizedQuery = req.query ? sanitizeObject(deepClone(req.query)) : req.query;
  
  let valStore: any = undefined;
  Object.defineProperty(req, 'sanitizedParams', {
    get() {
      if (valStore !== undefined) return valStore;
      return this.params ? sanitizeObject(deepClone(this.params)) : this.params;
    },
    set(val) {
      valStore = val;
    },
    configurable: true,
    enumerable: true
  });
  next();
};

// ── Apply global middleware ──
// Secure Helmet CSP configuration permitting local SPA behavior
app.use(helmet({
  hsts: false, // Disable HSTS to prevent forcing HTTPS on local/LAN HTTP connections
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "ws:", "http://localhost:3200", "http://127.0.0.1:3200"],
      upgradeInsecureRequests: null // Disable auto-upgrading HTTP requests to HTTPS
    }
  }
}));
app.use(compression()); // gzip all responses
app.use(cors(corsOptions));

// Reject oversized payloads (JSON and URL-encoded limits set to 1MB)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Reject malformed payloads cleanly
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    console.warn('[SECURITY] Malformed JSON payload rejected');
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  next(err);
});

// Sanitize user inputs
app.use(sanitizeInput);

// Register Swagger OpenAPI Documentation UI
registerSwaggerDocs(app);

app.use(requestTimeout);
app.use(distributedLoginLimiter);
app.use(apiLimiter); // Apply rate limiting to all endpoints globally

// ── Request logger ──
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[REQ] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Dependency Injection / Clean Architecture Composition
const userRepository = new UserRepositorySqlite();
const authUseCase = new AuthUseCase(userRepository);
const authController = new AuthController(authUseCase);
const authMiddleware = createAuthMiddleware(authUseCase);

const patientRepository = new PatientRepositorySqlite();
const patientUseCase = new PatientUseCase(patientRepository);
const patientController = new PatientController(patientUseCase);

const familyRepository = new FamilyRepositorySqlite();
const familyUseCase = new FamilyUseCase(familyRepository, patientRepository);
const familyController = new FamilyController(familyUseCase);

const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    
    const userRole = (req.user.role || '').trim();
    const hasRole = allowedRoles.some(role => role.toLowerCase() === userRole.toLowerCase());
    
    if (!hasRole) {
      console.warn(`[RBAC] Access denied for user ${req.user.username} (${userRole}) on ${req.method} ${req.originalUrl}`);
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
};

// --- GLOBAL API SECURITY RULES (RLS / Role-Based Access Control) ---

// 1. Enforce token authentication globally on all /api routes (except open routes)
app.use('/api', authMiddleware);

// 2. Lock down administrative/financial groups to Admin role only
app.use('/api/reports', (req, res, next) => {
  if (req.originalUrl.split('?')[0] === '/api/reports/debtors/details') {
    return authorizeRoles(['Admin', 'Receptionist'])(req, res, next);
  }
  return authorizeRoles(['Admin'])(req, res, next);
});
app.use('/api/reprints', authorizeRoles(['Admin']));
app.use('/api/backups', authorizeRoles(['Admin']));
app.use('/api/restore', authorizeRoles(['Admin']));
app.use('/api/db-stats', authorizeRoles(['Admin']));
app.use('/api/users', authorizeRoles(['Admin']));

// Mount apiRouter for legacy endpoints
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Voice Dictation & Live Transcription Routes
app.set('broadcastVoiceAiStatus', broadcastVoiceAiStatus);
app.use('/api/voice', voiceRoutes);

// Direct Raw ESC/POS Thermal Printing Routes (Network Port 9100)
app.use('/api/print', printRoutes);

// Insurance & Claims Module (Admin only)
app.use('/api/insurance', authorizeRoles(['Admin']), insuranceRouter);

// --- LAN DOMAIN RESOLVER (NBNS/DNS) ---
// This allows other computers on the LAN to find this server by typing 'lunaeyehospital'

const DOMAIN_NAME = process.env.DOMAIN_NAME || 'lunaeyehospital';

function getAllLanIps() {
  const ips: { name: string; address: string }[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (ifaceList) {
      for (const iface of ifaceList) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push({ name, address: iface.address });
        }
      }
    }
  }
  return ips;
}

const ALL_IPS = getAllLanIps();
const LAN_IP = ALL_IPS.length > 0 ? ALL_IPS[0].address : '127.0.0.1';

// NBNS Responder (Port 137) - Crucial for Windows LAN resolution
const nbnsServer = dgram.createSocket('udp4');
nbnsServer.on('message', (msg, rinfo) => {
  if (msg.length < 12 || (msg[2] & 0x80) !== 0) return; // Not a query

  // NetBIOS name encoding: 'LUNAEYEHOSPITAL' becomes 'FEEBEBFA...'
  // We'll do a simple substring check for the encoded name to keep it lightweight
  const encodedName = 'FEFEEBEBFAEEFEEBFAFEFEEBEBEE'; // 'LUNAEYEHOSPITAL' in NBNS
  if (msg.toString('hex').toUpperCase().includes(encodedName)) {
    const response = Buffer.alloc(msg.length + 6);
    msg.copy(response);
    response[2] |= 0x84; // Response, Authoritative
    response[7] = 1; // 1 Answer
    
    const answer = Buffer.from([
      0x00, 0x01, // Type NB
      0x00, 0x01, // Class IN
      0x00, 0x00, 0x00, 0x3C, // TTL 60s
      0x00, 0x06, // Data length
      0x60, 0x00, // NB Flags
      ...LAN_IP.split('.').map(n => parseInt(n)) // Our IP
    ]);
    
    const finalResponse = Buffer.concat([response.slice(0, msg.length), answer]);
    nbnsServer.send(finalResponse, rinfo.port, rinfo.address);
  }
});

nbnsServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log('NBNS: Port 137 is already in use by System. LAN discovery may rely on existing Windows NetBIOS.');
  } else {
    console.log('NBNS Error:', err.message);
  }
});

try {
  nbnsServer.bind(137);
} catch (e) {}

// Basic DNS Responder (Port 53)
const dnsServer = dgram.createSocket('udp4');
dnsServer.on('message', (msg, rinfo) => {
  if (msg.length < 12) return;
  const id = msg.slice(0, 2);
  const response = Buffer.alloc(msg.length + 16);
  id.copy(response, 0);
  response[2] = 0x81; response[3] = 0x80; // Standard response, no error
  response[4] = 0; response[5] = 1; // 1 Question
  response[6] = 0; response[7] = 1; // 1 Answer
  msg.copy(response, 12, 12, msg.length); // Copy question
  
  const offset = msg.length;
  response[offset] = 0xc0; response[offset+1] = 0x0c; // Pointer to name
  response[offset+2] = 0; response[offset+3] = 1; // Type A
  response[offset+4] = 0; response[offset+5] = 1; // Class IN
  response[offset+6] = 0; response[offset+7] = 0; response[offset+8] = 0; response[offset+9] = 0x3c; // TTL
  response[offset+10] = 0; response[offset+11] = 4; // Length 4
  const ipParts = LAN_IP.split('.');
  for(let i=0; i<4; i++) response[offset+12+i] = parseInt(ipParts[i]);
  
  dnsServer.send(response.slice(0, offset+16), rinfo.port, rinfo.address);
});

dnsServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log('DNS: Port 53 is already in use. Skipping internal DNS responder.');
  } else {
    console.log('DNS Error:', err.message);
  }
});

try {
  dnsServer.bind(53);
} catch (e) {}

// --- Database Backup & Management Routes ---

// GET database stats
app.get('/api/db-stats', (req, res) => {
  fs.stat(dbPath, (err, stats) => {
    if (err) return res.status(500).json({ error: 'Could not read database file stats' });
    
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], async (err, rows: any[]) => {
      if (err) return res.status(500).json({ error: 'Could not query database tables' });
      
      try {
        const tableStats: any[] = [];
        for (const row of rows) {
          const countResult = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM "${row.name}"`, [], (err, result: any) => {
              if (err) reject(err);
              else resolve(result ? result.count : 0);
            });
          });
          tableStats.push({ name: row.name, rows: countResult });
        }
        
        res.json({
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          size_mb: (stats.size / (1024 * 1024)).toFixed(2),
          last_modified: stats.mtime,
          status: 'Healthy',
          tables: tableStats
        });
      } catch (dbErr) {
        res.status(500).json({ error: 'Failed to retrieve table row counts' });
      }
    });
  });
});


// GET download database backup
app.get('/api/backup', authorizeRoles(['Admin']), (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `luna_eye_hospital_backup_${timestamp}.db`;
  
  logAudit(req.user?.id, req.user?.username, req.user?.role, 'BACKUP', 'Database', 'Manual database backup downloaded', 'Standard');
  
  res.download(dbPath, backupFilename, (err) => {
    if (err) {
      console.error("Backup download failed:", err);
      // Ensure headers aren't already sent before sending error
      if (!res.headersSent) {
        res.status(500).send("Failed to download database backup.");
      }
    }
  });
});

// --- USER MANAGEMENT API ---

// GET all users
app.get('/api/users', authorizeRoles(['Admin']), (req, res) => {
  db.all('SELECT id, username, email, full_name, role, IFNULL(department, \'General\') as department, status FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new user
app.post('/api/users', authorizeRoles(['Admin']), validateRequest({ body: CreateUserSchema }), (req, res) => {
  const { username, email, password, full_name, role, department } = req.sanitizedBody;
  const lowercaseUsername = username.toLowerCase().trim();
  const normalizedEmail = email ? email.toLowerCase().trim() : `${lowercaseUsername}@lunaeye.com`;
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (username, email, password, full_name, role, department, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [lowercaseUsername, normalizedEmail, hashedPassword, full_name, role, department || 'General', 'Active'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: `Username "${username}" already exists. Please choose a different username.` });
        }
        return res.status(500).json({ error: err.message });
      }
      logAudit(req.user.id, req.user.username, req.user.role, 'USER_CREATE', 'Users', `Created new user: ${lowercaseUsername} (${role})`, 'Critical');
      res.status(201).json({ id: this.lastID, username: lowercaseUsername, email: normalizedEmail, full_name, role, department: department || 'General', status: 'Active' });
    }
  );
});

// PUT update user (role, status, password reset, department, username, email)
app.put('/api/users/:id', authorizeRoles(['Admin']), validateRequest({ body: UpdateUserSchema }), (req, res) => {
  const { id } = req.sanitizedParams;
  const { username, email, role, status, password, full_name, department } = req.sanitizedBody;
  
  let updates: string[] = [];
  let params: any[] = [];
  
  if (username) {
    updates.push('username = ?');
    params.push(username.toLowerCase().trim());
  }
  if (email !== undefined) {
    updates.push('email = ?');
    params.push(email ? email.toLowerCase().trim() : null);
  }
  if (role) { updates.push('role = ?'); params.push(role); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (password) { 
    updates.push('password = ?'); 
    params.push(bcrypt.hashSync(password, 10)); 
  }
  if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
  if (department !== undefined) { updates.push('department = ?'); params.push(department); }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
  
  params.push(id);
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  
  db.run(sql, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: `Username "${username}" already exists. Please choose a different username.` });
      }
      return res.status(500).json({ error: err.message });
    }
    logAudit(req.user.id, req.user.username, req.user.role, 'USER_UPDATE', 'Users', `Updated user ID ${id}: ${updates.join(', ')}`, 'Critical');
    res.json({ success: true });
  });
});

// DELETE deactivate user
app.delete('/api/users/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.run("UPDATE users SET status = 'Inactive' WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req.user?.id, req.user?.username, req.user?.role, 'USER_DEACTIVATE', 'Users', `Deactivated user ID ${id}`, 'Critical');
    res.json({ success: true });
  });
});

// --- PROFILE API ---

// GET current user profile
app.get('/api/profile/:id', (req, res) => {
  const { id } = req.sanitizedParams;
  db.get('SELECT id, username, email, full_name, role, phone_number, created_at FROM users WHERE id = ?', [id], (err, user: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.email && user.username) {
      user.email = `${user.username.toLowerCase()}@lunaeye.com`;
    }
    res.json(user);
  });
});

// PUT update profile (name, phone, and optional email)
app.put('/api/profile/:id', (req, res) => {
  const { id } = req.sanitizedParams;
  const { full_name, phone_number, email } = req.sanitizedBody;
  
  db.run(
    'UPDATE users SET full_name = ?, phone_number = ?, email = COALESCE(?, email) WHERE id = ?',
    [full_name, phone_number, email ? email.toLowerCase().trim() : null, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(id, null, 'User', 'PROFILE_UPDATE', 'Profile', `Updated profile for user ID ${id}`, 'Standard');
      res.json({ success: true });
    }
  );
});

// POST change password
app.post('/api/change-password', validateRequest({ body: ChangePasswordSchema }), (req, res) => {
  const { user_id, current_password, new_password } = req.sanitizedBody;
  
  db.get('SELECT password FROM users WHERE id = ?', [user_id], (err, user: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const isMatch = current_password === user.password || bcrypt.compareSync(current_password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }
    
    const hashedNew = bcrypt.hashSync(new_password, 10);
    
    db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNew, user_id],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        logAudit(user_id, null, 'User', 'PASSWORD_CHANGE', 'Profile', `User ID ${user_id} changed their password`);
        res.json({ success: true });
      }
    );
  });
});

// --- AUDIT LOGS API ---

app.get('/api/audit-logs', authorizeRoles(['Admin']), validateRequest({ query: AuditLogQuerySchema }), (req, res) => {
  const { user_id, action_type, start_date, end_date, limit, offset } = req.sanitizedQuery;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  let params: any[] = [];
  
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (action_type) { query += ' AND action_type = ?'; params.push(action_type); }
  if (start_date && end_date) {
    query += ' AND date(created_at) BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// Basic API routes

// POST login
// POST login
app.post('/api/login', validateRequest({ body: LoginSchema }), (req, res) => {
  authController.login(req, res);
});

// POST logout
app.post('/api/logout', (req, res) => {
  authController.logout(req, res);
});

// POST verify supervisor credentials for discount/override authorizations
app.post('/api/auth/verify-supervisor', (req, res) => {
  const { username, password } = req.sanitizedBody;
  if (!username || !password) {
    return res.status(400).json({ error: 'Supervisor username and password are required' });
  }

  db.get(
    'SELECT id, username, password, full_name, role, status FROM users WHERE LOWER(username) = LOWER(?)',
    [String(username).trim()],
    (err, supervisor: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!supervisor || supervisor.status !== 'Active') {
        return res.status(401).json({ error: 'Supervisor account not found or is inactive' });
      }

      const allowedSupervisorRoles = ['Admin', 'Consultant', 'Doctor'];
      if (!allowedSupervisorRoles.includes(supervisor.role)) {
        return res.status(403).json({ 
          error: `User "${supervisor.username}" (${supervisor.role}) is not authorized to approve supervisor overrides. Must be Admin, Consultant, or Doctor.` 
        });
      }

      const isMatch = bcrypt.compareSync(String(password), supervisor.password || '');
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid supervisor password' });
      }

      res.json({
        success: true,
        supervisor: {
          id: supervisor.id,
          username: supervisor.username,
          full_name: supervisor.full_name,
          role: supervisor.role
        }
      });
    }
  );
});

// GET active status
app.get('/api/status', (req, res) => {
  res.json({ status: 'active', version: '1.0.0', hospital: 'Luna Eye Hospital' });
});

// GET all patients - with today's visit status if available
app.get('/api/patients', validateRequest({ query: PatientListQuerySchema }), (req, res) => {
  patientController.getPatients(req, res);
});

// GET patient by number / query parameter (URL-safe, reverse-proxy friendly)
app.get('/api/patients/by-number', (req, res) => {
  patientController.getPatientById(req, res);
});

// GET patient by ID (supports file numbers with slashes like 0001/26/LEH or 0024/26/LEH)
app.get('/api/patients/{*id}', (req, res) => {
  patientController.getPatientById(req, res);
});

// POST new patient
app.post('/api/patients', authorizeRoles(['Admin', 'Receptionist']), validateRequest({ body: CreatePatientSchema }), (req, res) => {
  patientController.registerPatient(req, res);
});

// PUT update patient by query parameter (URL-safe)
app.put('/api/patients/by-number', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  patientController.updatePatient(req, res);
});

// PUT update patient (supports wildcard slash paths)
app.put('/api/patients/{*id}', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  patientController.updatePatient(req, res);
});

// ==========================================
// FAMILY HOUSEHOLD MANAGEMENT ENDPOINTS
// ==========================================

// GET all families (with search, pagination, members count)
app.get('/api/families', (req, res) => {
  familyController.getFamilies(req, res);
});

// GET family by ID or Card Number (includes all family members)
app.get('/api/families/:id', (req, res) => {
  familyController.getFamilyById(req, res);
});

// POST create new family household
app.post('/api/families', authorizeRoles(['Admin', 'Receptionist']), validateRequest({ body: CreateFamilySchema }), (req, res) => {
  familyController.createFamily(req, res);
});

// PUT update family household details
app.put('/api/families/:id', authorizeRoles(['Admin', 'Receptionist']), validateRequest({ body: UpdateFamilySchema }), (req, res) => {
  familyController.updateFamily(req, res);
});

// DELETE soft-deactivate family (protected: rejected if members have clinical history)
app.delete('/api/families/:id', authorizeRoles(['Admin']), (req, res) => {
  familyController.deactivateFamily(req, res);
});

// POST add a new member patient under this family
app.post('/api/families/:id/members', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  familyController.addMember(req, res);
});

// POST link existing patient to this family
app.post('/api/families/:id/link-patient', authorizeRoles(['Admin', 'Receptionist']), validateRequest({ body: LinkPatientFamilySchema }), (req, res) => {
  familyController.linkPatient(req, res);
});

// POST/DELETE detach member from family (preserves patient and medical history)
app.post('/api/families/:id/remove-member/:patientId', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  familyController.removeMember(req, res);
});
app.delete('/api/families/:id/members/:patientId', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  familyController.removeMember(req, res);
});

// POST check-in — routes existing today's visit to a target queue status
app.post('/api/check-in', authorizeRoles(['Admin', 'Receptionist', 'Nurse']), (req, res) => {
  const { patient_id, target, user_name } = req.sanitizedBody;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

  const statusMap = {
    triage: PatientStatus.WAITING_FOR_TRIAGE,
    consultation: PatientStatus.WAITING_FOR_CONSULTATION,
    billing: PatientStatus.AWAITING_BILLING
  };
  const newStatus = statusMap[target] || PatientStatus.WAITING_FOR_TRIAGE;
  const receptionist = user_name || 'System Receptionist';

  // Find today's most recent visit for this patient
  db.get(
    `SELECT v.id, v.status, p.full_name, p.id as patient_file_no
     FROM visits v
     JOIN patients p ON v.patient_id = p.id
     WHERE v.patient_id = ?
     AND date(v.visit_date, 'localtime') = date('now', 'localtime')
     ORDER BY v.id DESC LIMIT 1`,
    [patient_id],
    (err, visit: any) => {
      if (err) return res.status(500).json({ error: err.message });

      const processCheckIn = (visitId: any, patientData: any) => {
        // 1. Update visits table
        db.run('UPDATE visits SET status = ? WHERE id = ?', [newStatus, visitId], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // 2. Handle Queues
          if (target === 'triage') {
            db.run(`
              INSERT INTO triage_queue (patient_id, patient_name, file_number, visit_id, status, checkin_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [patient_id, patientData.full_name, patientData.patient_file_no, visitId, newStatus, receptionist]);
          } else if (target === 'consultation') {
            db.run(`
              INSERT INTO consultation_queue (patient_id, patient_name, file_number, visit_id, status, checkin_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [patient_id, patientData.full_name, patientData.patient_file_no, visitId, newStatus, receptionist]);
          }

          logAudit(null, receptionist, 'Receptionist', 'CHECK_IN', 'Patients',
            `Patient ${patient_id} routed to ${target} (visit ${visitId} → ${newStatus})`);
          
          res.json({ visit_id: visitId, status: newStatus, success: true });
        });
      };

      if (visit) {
        processCheckIn(visit.id, visit);
      } else {
        // No visit today — create fresh
        db.get('SELECT full_name, id as patient_file_no FROM patients WHERE id = ?', [patient_id], (errP, p: any) => {
          if (errP || !p) return res.status(404).json({ error: 'Patient not found' });
          
          db.run(
            'INSERT INTO visits (patient_id, status, department) VALUES (?, ?, ?)',
            [patient_id, newStatus, 'General'],
            function(this: any, err3) {
              if (err3) return res.status(500).json({ error: err3.message });
              processCheckIn(this.lastID, p);
            }
          );
        });
      }
    }
  );
});

// PUT update visit status — advances patient through the clinical workflow
app.put('/api/visits/:id/status', authorizeRoles(['Admin', 'Receptionist', 'Nurse', 'Optometrist', 'Consultant', 'Doctor']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { status, performed_by, reason } = req.sanitizedBody;
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    // 1. Update visits table
    db.run('UPDATE visits SET status = ? WHERE id = ?', [status, id], function(this: any, err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      // 2. Update clinical queues based on status
      if (status === PatientStatus.IN_CONSULTATION) {
        db.run(`
          UPDATE consultation_queue 
          SET status = ?, 
              started_at = CURRENT_TIMESTAMP,
              consultant_name = ?
          WHERE visit_id = ?
        `, [status, performed_by || 'Clinician', id]);

        // Auto-dismiss matching triage notification
        db.get('SELECT patient_id FROM visits WHERE id = ?', [id], (errV, visit: any) => {
          if (visit && visit.patient_id) {
            db.run(
              "DELETE FROM notifications WHERE patient_id = ? AND module = 'Patients'",
              [visit.patient_id]
            );
          }
        });
      } else if (status === PatientStatus.WAITING_FOR_CONSULTATION) {
          // If moving back to waiting, clear consultant
          db.run(`UPDATE consultation_queue SET status = ?, started_at = NULL, consultant_name = NULL WHERE visit_id = ?`, [status, id]);
      } else {
          // Remove from queue if status is anything else (Finished, Discharged, etc)
          db.run(`DELETE FROM consultation_queue WHERE visit_id = ?`, [id]);
      }
      
      db.run('COMMIT', () => {
        logAudit(null, performed_by || 'System', 'Clinical', 'VISIT_STATUS_CHANGE', 'Clinical', 
          `Visit ${id} status changed to ${status}${reason ? ' Reason: ' + reason : ''}`);
        res.json({ success: true, id, status });
      });
    });
  });
});

// GET patient queue & visits stats
app.get('/api/queue', (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // simple date matching
  
  db.all(`
    SELECT v.*, p.full_name, p.gender, p.dob
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    WHERE date(v.visit_date, 'localtime') = date('now', 'localtime')
    ORDER BY v.visit_date ASC
  `, [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`
      SELECT bp_systolic, bp_diastolic, pulse_rate, temperature
      FROM triage
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `, [], (errT, triageRows: any[]) => {
      let vitalAlerts = 0;
      if (!errT && triageRows) {
        triageRows.forEach(t => {
          const sys = parseFloat(t.bp_systolic);
          const dia = parseFloat(t.bp_diastolic);
          const pulse = parseFloat(t.pulse_rate);
          const temp = parseFloat(t.temperature);
          
          const hasAlert = 
            (sys && (sys > 140 || sys < 90)) ||
            (dia && (dia > 90 || dia < 60)) ||
            (pulse && (pulse > 100 || pulse < 60)) ||
            (temp && (temp > 38.0 || temp < 35.0));
            
          if (hasAlert) {
            vitalAlerts++;
          }
        });
      }
      
      const stats = {
        awaiting_payment: rows.filter(r => r.status === PatientStatus.AWAITING_BILLING),
        waiting: rows.filter(r => r.status === PatientStatus.REGISTERED || r.status === PatientStatus.WAITING_FOR_TRIAGE || r.status === PatientStatus.PAID),
        consulting: rows.filter(r => r.status === PatientStatus.IN_CONSULTATION),
        waiting_for_consultation: rows.filter(r => r.status === PatientStatus.WAITING_FOR_CONSULTATION || r.status === (PatientStatus as any).TRIAGE_COMPLETE),
        admitted: rows.filter(r => r.status === PatientStatus.ADMITTED),
        total_today: rows.length,
        vital_alerts: vitalAlerts
      };
      
      res.json(stats);
    });
  });
});

// GET triage queue — all patients ready for nursing assessment
apiRouter.get('/triage-queue', (req, res) => {
  db.all(`
    SELECT q.*, p.full_name, p.gender, p.dob, p.phone, p.blood_group, p.allergies
    FROM triage_queue q
    JOIN patients p ON CAST(q.patient_id AS TEXT) = CAST(p.id AS TEXT)
    WHERE (
      date(q.checkin_at, 'localtime') = date('now', 'localtime')
      OR (strftime('%s','now') - strftime('%s', q.checkin_at)) < 86400
    )
    ORDER BY q.checkin_at ASC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET triage stats — average wait time, completed triages today, and urgent cases today
apiRouter.get('/triage-stats', (req, res) => {
  const queries = {
    triagedToday: `
      SELECT COUNT(*) as count 
      FROM triage 
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `,
    urgentCases: `
      SELECT COUNT(*) as count 
      FROM triage 
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
        AND (
          (CAST(bp_systolic AS INTEGER) >= 140 AND bp_systolic <> '') OR 
          (CAST(bp_diastolic AS INTEGER) >= 90 AND bp_diastolic <> '') OR 
          (CAST(temperature AS REAL) >= 38.0 AND temperature <> '') OR 
          (CAST(pulse_rate AS INTEGER) >= 100 AND pulse_rate <> '') OR 
          (CAST(pulse_rate AS INTEGER) <= 50 AND pulse_rate <> '')
        )
    `,
    todayWait: `
      SELECT COALESCE(AVG(strftime('%s', t.created_at) - strftime('%s', v.visit_date)), 0) as avg_wait
      FROM triage t
      JOIN visits v ON t.visit_id = v.id
      WHERE date(v.visit_date, 'localtime') = date('now', 'localtime')
        AND (strftime('%s', t.created_at) - strftime('%s', v.visit_date)) < 86400
        AND (strftime('%s', t.created_at) - strftime('%s', v.visit_date)) >= 0
    `,
    allTimeWait: `
      SELECT COALESCE(AVG(strftime('%s', t.created_at) - strftime('%s', v.visit_date)), 0) as avg_wait
      FROM triage t
      JOIN visits v ON t.visit_id = v.id
      WHERE (strftime('%s', t.created_at) - strftime('%s', v.visit_date)) < 86400
        AND (strftime('%s', t.created_at) - strftime('%s', v.visit_date)) >= 0
    `
  };

  db.get(queries.triagedToday, [], (err1, rToday: any) => {
    if (err1) return res.status(500).json({ error: err1.message });
    
    db.get(queries.urgentCases, [], (err2, rUrgent: any) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      db.get(queries.todayWait, [], (err3, rTodayWait: any) => {
        if (err3) return res.status(500).json({ error: err3.message });
        
        const sendResponse = (avgWaitSeconds: number) => {
          const waitMins = Math.round(avgWaitSeconds / 60);
          res.json({
            triagedToday: rToday.count,
            urgentCases: rUrgent.count,
            avgWaitTime: `${waitMins}m`
          });
        };

        if (rTodayWait.avg_wait > 0) {
          sendResponse(rTodayWait.avg_wait);
        } else {
          db.get(queries.allTimeWait, [], (err4, rAllWait: any) => {
            if (err4) return res.status(500).json({ error: err4.message });
            sendResponse(rAllWait ? rAllWait.avg_wait : 0);
          });
        }
      });
    });
  });
});

// GET consultation queue — all patients ready for clinician review or currently being seen
apiRouter.get('/consultation-queue', (req, res) => {
  db.all(`
    SELECT q.*, p.full_name, p.gender, p.dob, p.phone,
           COALESCE(t.complaint, q.patient_name) as complaint
    FROM consultation_queue q
    JOIN patients p ON CAST(q.patient_id AS TEXT) = CAST(p.id AS TEXT)
    LEFT JOIN triage t ON q.visit_id = t.visit_id
    WHERE (
      date(q.checkin_at, 'localtime') = date('now', 'localtime')
      OR (strftime('%s','now') - strftime('%s', q.checkin_at)) < 86400
    )
      AND q.status IN (?, ?)
    ORDER BY q.checkin_at ASC
  `, [PatientStatus.WAITING_FOR_CONSULTATION, PatientStatus.IN_CONSULTATION], (err, rows) => {
    if (err) {
      console.error('[API] Consultation Queue Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET awaiting payment queue (patients who are registered but not yet pushed to triage)
apiRouter.get('/awaiting-payment', (req, res) => {
  db.all(`
    SELECT v.id as visit_id, v.patient_id, v.status, v.visit_date,
           p.full_name, p.gender, p.dob, p.phone,
           (SELECT COUNT(*) FROM transactions t WHERE t.visit_id = v.id AND t.status IN ('Paid', 'Partial')) as payment_count
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    WHERE date(v.visit_date, 'localtime') = date('now', 'localtime')
      AND (v.status = ? OR v.status = ?)
    ORDER BY v.visit_date ASC
  `, [PatientStatus.AWAITING_BILLING, PatientStatus.PAID], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    const mapped = rows.map(r => ({ ...r, has_paid: r.payment_count > 0 }));
    res.json(mapped);
  });
});

// GET triage record for a specific visit
app.get('/api/triage/visit/:visitId', (req, res) => {
  const { visitId } = req.sanitizedParams;
  db.get(
    'SELECT * FROM triage WHERE visit_id = ? ORDER BY created_at DESC LIMIT 1',
    [visitId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

// GET all historical triage records for a patient
app.get('/api/triage/history/:patientId', (req, res) => {
  const { patientId } = req.sanitizedParams;
  db.all(
    `SELECT t.*, v.visit_date 
     FROM triage t 
     JOIN visits v ON t.visit_id = v.id 
     WHERE t.patient_id = ? 
     ORDER BY v.visit_date DESC`,
    [patientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST save triage — saves vitals and advances patient status to 'Waiting for Consultation'
app.post('/api/triage', authorizeRoles(['Admin', 'Nurse']), (req, res) => {
  const {
    patient_id, visit_id,
    bp_systolic, bp_diastolic, pulse_rate, temperature, weight,
    va_od_unaided, va_od_aided, va_od_pinhole, va_od_near_unaided, va_od_near_aided,
    va_os_unaided, va_os_aided, va_os_pinhole, va_os_near_unaided, va_os_near_aided,
    iop_od, iop_os, iop_method,
    complaint, triaged_by
  } = req.sanitizedBody;

  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');

    db.get('SELECT id FROM triage WHERE visit_id = ?', [visit_id], (err, existing: any) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      const finishTransaction = () => {
        const targetStatus = PatientStatus.WAITING_FOR_CONSULTATION;
        
        // 1. Update visits table
        const updateSql = visit_id
          ? `UPDATE visits SET status = ? WHERE id = ?`
          : `UPDATE visits SET status = ? WHERE patient_id = ? AND date(visit_date, 'localtime') = date('now', 'localtime')`;
        const updateParams = [targetStatus, visit_id || patient_id];

        db.run(updateSql, updateParams, function(this: any, err2) {
          if (err2) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err2.message });
          }

          // 2. Clear from triage_queue (remove entirely from active triage list)
          db.run('DELETE FROM triage_queue WHERE visit_id = ? OR (patient_id = ? AND date(checkin_at) = date("now"))', [visit_id, patient_id]);

          // 3. Populate consultation_queue (Use INSERT OR REPLACE to avoid duplicates)
          db.get('SELECT full_name, id as file_no FROM patients WHERE id = ?', [patient_id], (errP, p: any) => {
            const patientName = p ? p.full_name : 'Unknown';
            const fileNo = p ? p.file_no : patient_id;
            
            db.run(`
              INSERT OR REPLACE INTO consultation_queue (patient_id, patient_name, file_number, visit_id, status, checkin_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [patient_id, patientName, fileNo, visit_id, targetStatus, triaged_by]);

            db.run(
              'INSERT INTO notifications (user_role, message, module, patient_id) VALUES (?, ?, ?, ?)',
              ['Optometrist', `Patient ${patientName} (${fileNo}) is ready for consultation.`, 'Patients', patient_id]
            );
            db.run(
              'INSERT INTO notifications (user_role, message, module, patient_id) VALUES (?, ?, ?, ?)',
              ['Doctor', `Patient ${patientName} (${fileNo}) is ready for consultation.`, 'Patients', patient_id]
            );

            db.run('COMMIT', () => {
              logAudit(null, triaged_by || 'Nurse', 'Nurse', 'TRIAGE_COMPLETE', 'Nursing',
                `Triage complete for patient ${patient_id}. Visit ${visit_id} → ${targetStatus}`);
              res.status(201).json({ id: existing ? existing.id : null, patient_id, status: targetStatus, success: true });
            });
          });
        });
      };

      if (existing) {
        // UPDATE
        const stmt = db.prepare(`
          UPDATE triage SET
            bp_systolic = ?, bp_diastolic = ?, pulse_rate = ?, temperature = ?, weight = ?,
            va_od_unaided = ?, va_od_aided = ?, va_od_pinhole = ?, va_od_near_unaided = ?, va_od_near_aided = ?,
            va_os_unaided = ?, va_os_aided = ?, va_os_pinhole = ?, va_os_near_unaided = ?, va_os_near_aided = ?,
            iop_od = ?, iop_os = ?, iop_method = ?, complaint = ?, triaged_by = ?
          WHERE visit_id = ?
        `);
        stmt.run(
          bp_systolic, bp_diastolic, pulse_rate, temperature, weight,
          va_od_unaided, va_od_aided, va_od_pinhole, va_od_near_unaided, va_od_near_aided,
          va_os_unaided, va_os_aided, va_os_pinhole, va_os_near_unaided, va_os_near_aided,
          iop_od, iop_os, iop_method, complaint, triaged_by, visit_id,
          function(this: any, err3) {
            if (err3) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err3.message });
            }
            finishTransaction();
          }
        );
        stmt.finalize();
      } else {
        // INSERT
        const stmt = db.prepare(`
          INSERT INTO triage (
            patient_id, visit_id,
            bp_systolic, bp_diastolic, pulse_rate, temperature, weight,
            va_od_unaided, va_od_aided, va_od_pinhole, va_od_near_unaided, va_od_near_aided,
            va_os_unaided, va_os_aided, va_os_pinhole, va_os_near_unaided, va_os_near_aided,
            iop_od, iop_os, iop_method,
            complaint, triaged_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          patient_id, visit_id,
          bp_systolic, bp_diastolic, pulse_rate, temperature, weight,
          va_od_unaided, va_od_aided, va_od_pinhole, va_od_near_unaided, va_od_near_aided,
          va_os_unaided, va_os_aided, va_os_pinhole, va_os_near_unaided, va_os_near_aided,
          iop_od, iop_os, iop_method,
          complaint, triaged_by,
          function(this: any, err4) {
            if (err4) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err4.message });
            }
            finishTransaction();
          }
        );
        stmt.finalize();
      }
    });
  });
});

// Update visit status manually (e.g. sending back to triage)
app.put('/api/visits/:visitId/status', (req, res) => {
  const { visitId } = req.sanitizedParams;
  const { status, performed_by, reason } = req.sanitizedBody;
  
  db.get('SELECT * FROM visits WHERE id = ?', [visitId], (err, visit: any) => {
    if (err || !visit) return res.status(404).json({ error: 'Visit not found' });
    
    db.run('UPDATE visits SET status = ? WHERE id = ?', [status, visitId], function(this: any, err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      
      logAudit(null, performed_by || 'System', 'User', 'VISIT_STATUS_CHANGE', 'Consultations', `Visit ${visitId} status changed to ${status}${reason ? ' Reason: '+reason : ''}`);
      res.json({ success: true, status });
    });
  });
});

// GET all services
app.get('/api/services', (req, res) => {
  db.all('SELECT * FROM services ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new service (Admin only)
app.post('/api/services', authorizeRoles(['Admin']), (req, res) => {
  const { name, price, category, description } = req.sanitizedBody || req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Service name is required' });
  }
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice < 0) {
    return res.status(400).json({ error: 'Valid non-negative service price is required' });
  }
  const cleanName = name.trim();
  const cleanCategory = (category && typeof category === 'string' && category.trim()) ? category.trim() : 'Service';
  const cleanDescription = (description && typeof description === 'string') ? description.trim() : '';

  db.run(
    'INSERT INTO services (name, price, category, description) VALUES (?, ?, ?, ?)',
    [cleanName, numPrice, cleanCategory, cleanDescription],
    function (this: any, err: Error | null) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: `Service with name "${cleanName}" already exists` });
        }
        return res.status(500).json({ error: err.message });
      }
      const newId = this.lastID;
      logAudit(req.user?.id, req.user?.username || 'Admin', req.user?.role || 'Admin', 'SERVICE_CREATE', 'Settings', `Created service: ${cleanName} (₦${numPrice.toLocaleString()})`);
      res.status(201).json({ id: newId, name: cleanName, price: numPrice, category: cleanCategory, description: cleanDescription });
    }
  );
});

// PUT update service (Admin only)
app.put('/api/services/:id', authorizeRoles(['Admin']), (req, res) => {
  const serviceId = parseInt(req.params.id as string);
  if (isNaN(serviceId)) return res.status(400).json({ error: 'Invalid service ID' });

  const { name, price, category, description } = req.sanitizedBody || req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Service name is required' });
  }
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice < 0) {
    return res.status(400).json({ error: 'Valid non-negative service price is required' });
  }
  const cleanName = name.trim();
  const cleanCategory = (category && typeof category === 'string' && category.trim()) ? category.trim() : 'Service';
  const cleanDescription = (description && typeof description === 'string') ? description.trim() : '';

  db.run(
    'UPDATE services SET name = ?, price = ?, category = ?, description = ? WHERE id = ?',
    [cleanName, numPrice, cleanCategory, cleanDescription, serviceId],
    function (this: any, err: Error | null) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: `Another service with name "${cleanName}" already exists` });
        }
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Service not found' });
      logAudit(req.user?.id, req.user?.username || 'Admin', req.user?.role || 'Admin', 'SERVICE_UPDATE', 'Settings', `Updated service ID ${serviceId}: ${cleanName} (₦${numPrice.toLocaleString()})`);
      res.json({ id: serviceId, name: cleanName, price: numPrice, category: cleanCategory, description: cleanDescription });
    }
  );
});

// DELETE service (Admin only)
app.delete('/api/services/:id', authorizeRoles(['Admin']), (req, res) => {
  const serviceId = parseInt(req.params.id as string);
  if (isNaN(serviceId)) return res.status(400).json({ error: 'Invalid service ID' });

  db.get('SELECT name FROM services WHERE id = ?', [serviceId], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Service not found' });
    const serviceName = row.name;

    db.run('DELETE FROM services WHERE id = ?', [serviceId], function (this: any, delErr: Error | null) {
      if (delErr) return res.status(500).json({ error: delErr.message });
      logAudit(req.user?.id, req.user?.username || 'Admin', req.user?.role || 'Admin', 'SERVICE_DELETE', 'Settings', `Deleted service ID ${serviceId}: ${serviceName}`);
      res.json({ success: true, message: `Service "${serviceName}" deleted successfully` });
    });
  });
});


// GET all transactions
app.get('/api/transactions', (req, res) => {
  const limit = parseInt(req.sanitizedQuery.limit as string) || 200;
  db.all(`
    SELECT t.*, 
           CASE 
             WHEN t.billing_type = 'family' THEN COALESCE(f.family_name || ' Family', t.patient_id)
             WHEN t.billing_type = 'walk_in' THEN 'Walk-in Customer'
             ELSE COALESCE(p.full_name, f.family_name || ' Family', 'Walk-in Customer')
           END as patient_name 
    FROM transactions t 
    LEFT JOIN patients p ON t.patient_id = p.id 
    LEFT JOIN families f ON (t.family_id IS NOT NULL AND t.family_id = f.id) OR (t.family_id IS NULL AND t.patient_id = f.family_card_number)
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// POST new transaction with Role-Gated Maximum Discount and Ceiling enforcement
app.post('/api/transactions', authorizeRoles(['Admin', 'Receptionist']), validateRequest({ body: CreateTransactionSchema }), (req, res) => {
  const { 
    patient_id, visit_id, amount_paid, discount, 
    payment_method, payment_details, cashier, items,
    supervisor_username, supervisor_password,
    discount_reason, discount_note,
    billing_type: reqBillingType, family_id: reqFamilyId,
    is_insurance_bill, payer_id: reqPayerId, claim_id: reqClaimId,
    patient_portion: reqPatientPortion, payer_portion: reqPayerPortion
  } = req.sanitizedBody;
  
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items to bill' });
  
  // Recompute total and validate financial inputs
  const total_amount = items.reduce((sum: number, item: any) => sum + (item.qty * item.unit_price), 0);
  const final_discount = parseFloat(discount) || 0;
  const final_paid = parseFloat(amount_paid) || 0;
  const balance = total_amount - final_discount - final_paid;
  const status = balance <= 0 ? 'Paid' : (final_paid > 0 ? 'Partial' : 'Unpaid');

  // Async Entity Existence Verification: return clean HTTP 400 with details on invalid entity
  let effectiveBillingType: 'patient' | 'family' | 'walk_in' = reqBillingType || 'patient';
  let effectiveFamilyId: number | null = reqFamilyId ? parseInt(String(reqFamilyId)) : null;

  if (!reqBillingType && !reqFamilyId) {
    if (!patient_id || patient_id === 'Walk-in' || patient_id === 'OTC') {
      effectiveBillingType = 'walk_in';
    }
  }

  const verifyAndProceed = () => {
    if (effectiveBillingType === 'walk_in') {
      return runDiscountAndInsert();
    }

    if (effectiveBillingType === 'family') {
      const famQuery = effectiveFamilyId ? 'SELECT id FROM families WHERE id = ?' : 'SELECT id FROM families WHERE family_card_number = ?';
      const famParam = effectiveFamilyId || patient_id;
      return db.get(famQuery, [famParam], (errFam, famRow: any) => {
        if (errFam) return res.status(500).json({ error: errFam.message });
        if (!famRow) {
          return res.status(400).json({
            error: `Family record not found for reference "${famParam}".`,
            details: [{ field: 'family_id', message: `Family record not found in families registry.` }]
          });
        }
        effectiveFamilyId = famRow.id;
        runDiscountAndInsert();
      });
    }

    // Default: billing_type === 'patient'
    db.get('SELECT id FROM patients WHERE id = ?', [patient_id], (errP, pRow: any) => {
      if (errP) return res.status(500).json({ error: errP.message });
      if (pRow) {
        return runDiscountAndInsert();
      }

      // If not in patients, check if it is a family card number (auto-promotion fallback)
      db.get('SELECT id FROM families WHERE family_card_number = ?', [patient_id], (errF, famRow: any) => {
        if (errF) return res.status(500).json({ error: errF.message });
        if (famRow) {
          effectiveBillingType = 'family';
          effectiveFamilyId = famRow.id;
          return runDiscountAndInsert();
        }

        // Neither patient nor family exists
        return res.status(400).json({
          error: `Patient ID "${patient_id}" does not exist.`,
          details: [{ field: 'patient_id', message: `Patient ID "${patient_id}" does not exist in patients registry.` }]
        });
      });
    });
  };

  const runDiscountAndInsert = () => {
    // Retrieve configurable role discount caps from settings table
    db.all("SELECT key, value FROM settings WHERE key LIKE 'discount_cap_%'", [], (errSettings, settingRows: any[]) => {
    if (errSettings) return res.status(500).json({ error: errSettings.message });

    const capSettings: Record<string, number> = {
      receptionist: 10,
      nurse: 10,
      optometrist: 15,
      doctor: 25,
      consultant: 25,
      admin: 100,
      supervisor_ceiling: 50
    };

    if (settingRows) {
      settingRows.forEach(r => {
        const roleKey = r.key.replace('discount_cap_', '').toLowerCase();
        const parsed = parseFloat(r.value);
        if (!isNaN(parsed)) capSettings[roleKey] = parsed;
      });
    }

    const userRole = (req.user?.role || 'Receptionist').toLowerCase();
    const effective_pct = total_amount > 0 ? (final_discount / total_amount) * 100 : 0;

    // Check if discount is applied and requires validation
    if (effective_pct > 0.01 && userRole !== 'admin') {
      const userRoleCap = capSettings[userRole] ?? 10;
      const supervisorCeiling = capSettings['supervisor_ceiling'] ?? 50;

      // Rule 1: Absolute non-admin ceiling check
      if (effective_pct > supervisorCeiling) {
        return res.status(403).json({
          error: `Discount of ${effective_pct.toFixed(1)}% exceeds the hospital ceiling (${supervisorCeiling}%). Maximum non-admin discount permitted is ${supervisorCeiling}%.`,
          code: 'DISCOUNT_CEILING_EXCEEDED',
          ceiling: supervisorCeiling,
          effective_pct: Number(effective_pct.toFixed(1))
        });
      }

      // Rule 2: Exceeding current user's role cap requires Supervisor / Admin authorization
      if (effective_pct > userRoleCap) {
        if (!supervisor_username || !supervisor_password) {
          return res.status(403).json({
            error: `Discount of ${effective_pct.toFixed(1)}% exceeds your ${req.user?.role || 'user'} allowance (${userRoleCap}%). Supervisor authorization required.`,
            code: 'SUPERVISOR_AUTH_REQUIRED',
            requires_supervisor: true,
            role_cap: userRoleCap,
            effective_pct: Number(effective_pct.toFixed(1))
          });
        }

        // Verify supervisor credentials
        db.get(
          'SELECT id, username, password, full_name, role, status FROM users WHERE LOWER(username) = LOWER(?)',
          [String(supervisor_username).trim()],
          (supErr, supervisor: any) => {
            if (supErr) return res.status(500).json({ error: supErr.message });
            if (!supervisor || supervisor.status !== 'Active') {
              return res.status(401).json({ error: 'Supervisor user not found or inactive.' });
            }

            const allowedRoles = ['Admin', 'Consultant', 'Doctor'];
            if (!allowedRoles.includes(supervisor.role)) {
              return res.status(403).json({ 
                error: `User "${supervisor.username}" (${supervisor.role}) is not authorized to approve discount overrides.` 
              });
            }

            const isMatch = bcrypt.compareSync(String(supervisor_password), supervisor.password || '');
            if (!isMatch) {
              return res.status(401).json({ error: 'Incorrect supervisor password.' });
            }

            const supervisorCap = supervisor.role === 'Admin' ? 100 : (capSettings[supervisor.role.toLowerCase()] ?? 25);
            if (supervisor.role !== 'Admin' && effective_pct > supervisorCap) {
              return res.status(403).json({
                error: `Discount of ${effective_pct.toFixed(1)}% also exceeds approving supervisor's (${supervisor.role}) cap of ${supervisorCap}%.`
              });
            }

            // Record override in payment details and audit log
            const sanitizedReason = String(discount_reason || 'Not Specified').slice(0, 120);
            const sanitizedNote = String(discount_note || '').slice(0, 300);
            const updatedPaymentDetails = {
              ...(payment_details || {}),
              supervisor_override: {
                id: supervisor.id,
                username: supervisor.username,
                role: supervisor.role,
                timestamp: new Date().toISOString(),
                discount_reason: sanitizedReason,
                discount_note: sanitizedNote
              }
            };

            logAudit(
              supervisor.id,
              supervisor.username,
              supervisor.role,
              'DISCOUNT_OVERRIDE',
              'Billing',
              `Approved discount override of ${effective_pct.toFixed(1)}% (₦${final_discount.toLocaleString()}) for cashier ${req.user?.username || cashier} — Reason: ${sanitizedReason}${sanitizedNote ? ` | Note: ${sanitizedNote}` : ''}`,
              'Critical'
            );

            executeTransactionInsert(updatedPaymentDetails);
          }
        );
        return;
      }
    }

    // Execute transaction insert with active payment details
    executeTransactionInsert(payment_details || {});

    function executeTransactionInsert(activePaymentDetails: any) {
      // Generate Receipt No securely
      const receipt_no = `REC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;

      const isInsurance = is_insurance_bill ? 1 : 0;
      const finalPayerId = reqPayerId || null;
      const finalClaimId = reqClaimId || null;
      const finalPatientPortion = reqPatientPortion !== null && reqPatientPortion !== undefined ? reqPatientPortion : final_paid;
      const finalPayerPortion = reqPayerPortion !== null && reqPayerPortion !== undefined ? reqPayerPortion : (isInsurance ? (total_amount - final_paid) : 0);

      const triggerInsuranceAutoDraft = (txId: number) => {
        if (!isInsurance || !patient_id) return;
        db.get(
          `SELECT e.id as enrollee_id, e.payer_id, e.plan_id 
           FROM enrollees e 
           WHERE e.patient_id = ? AND e.status = 'ACTIVE' 
           ORDER BY e.created_at DESC LIMIT 1`,
          [patient_id],
          (enrErr: any, enr: any) => {
            if (enrErr || !enr) return;
            const payerIdToUse = finalPayerId || enr.payer_id;
            const planIdToUse = enr.plan_id;
            const enrolleeIdToUse = enr.enrollee_id;
            const serviceDate = new Date().toISOString().slice(0, 10);
            const claimNo = `CLM-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
            const totalClaimedKobo = Math.round(finalPayerPortion * 100);
            const totalBilledKobo = Math.round(total_amount * 100);
            const patientCopayKobo = Math.round(final_paid * 100);

            db.run(
              `INSERT INTO claims (
                claim_number, patient_id, enrollee_id, payer_id, plan_id, visit_id,
                service_date, total_billed, total_claimed, patient_copay, status, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
              [claimNo, patient_id, enrolleeIdToUse, payerIdToUse, planIdToUse, visit_id || null, serviceDate, totalBilledKobo, totalClaimedKobo, patientCopayKobo, cashier || 'System'],
              function(this: any, clmErr: any) {
                if (clmErr || !this.lastID) return;
                const newClaimId = this.lastID;
                db.run('UPDATE transactions SET claim_id = ? WHERE id = ?', [newClaimId, txId]);
                const clmItemStmt = db.prepare(`
                  INSERT INTO claim_items (
                    claim_id, item_type, item_code, description, quantity, 
                    unit_price, claimed_amount, status
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
                `);
                items.forEach((it: any) => {
                  const itCode = it.inventory_id || it.item_id || 'SVC';
                  const itQty = it.qty || 1;
                  const unitKobo = Math.round(it.unit_price * 100);
                  const claimedKobo = Math.round(unitKobo * itQty);
                  clmItemStmt.run(newClaimId, 'SERVICE', String(itCode), it.description || it.name || 'Item', itQty, unitKobo, claimedKobo);
                });
                clmItemStmt.finalize();
                db.run(
                  `INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by, notes)
                   VALUES (?, NULL, 'DRAFT', ?, 'Auto-created from Billing')`,
                  [newClaimId, cashier || 'System']
                );
              }
            );
          }
        );
      };
      
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION');
        
        const sql = `
          INSERT INTO transactions (
            receipt_no, patient_id, billing_type, family_id, visit_id, total_amount, amount_paid, 
            balance, discount, payment_method, payment_details, 
            cashier, status,
            payer_id, claim_id, patient_portion, payer_portion, is_insurance_bill
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
          receipt_no, patient_id, effectiveBillingType, effectiveFamilyId || null, visit_id || null, total_amount, final_paid, 
          balance, final_discount, payment_method, 
          JSON.stringify(activePaymentDetails || {}), 
          cashier, status,
          finalPayerId, finalClaimId, finalPatientPortion, finalPayerPortion, isInsurance
        ], function(this: any, err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      const transactionId = this.lastID;
      
      const itemStmt = db.prepare('INSERT INTO transaction_items (transaction_id, inventory_id, description, qty, unit_price) VALUES (?, ?, ?, ?, ?)');
      const invStmt = db.prepare(`
        UPDATE inventory 
        SET stock = CASE 
          WHEN category IN ('Test', 'Laboratory', 'lab test', 'diagnostic') THEN stock
          ELSE stock - ? 
        END
        WHERE id = ? AND (stock >= ? OR category IN ('Test', 'Laboratory', 'lab test', 'diagnostic'))
      `);
      
      let errorOccurred = false;
      let pending = items.length;
      
      items.forEach(item => {
        const invId = item.inventory_id || item.item_id || null;
        itemStmt.run(transactionId, invId, item.description, item.qty, item.unit_price, (err) => {
          if (err) {
            console.error('[Billing] Item Insertion Error:', err);
            errorOccurred = true;
          }
          
          if (invId && !errorOccurred) {
            db.run(
              `UPDATE investigations SET billing_status = 'Paid' 
               WHERE patient_id = ? AND inventory_id = ? AND billing_status = 'Unpaid'`,
              [patient_id, invId],
              (errInv) => {
                if (errInv) {
                  console.error('[Billing] Error updating investigation billing status:', errInv);
                }
              }
            );
          }
          
          // Only update inventory for items that have a valid inventory ID (e.g. starts with INV-)
          const isInventoryItem = invId && invId.startsWith('INV-');
          
          if (isInventoryItem && !errorOccurred) {
            invStmt.run(item.qty, invId, item.qty, function(this: any, err2) {
              if (err2) {
                console.error('[Billing] Inventory Update Error:', err2);
                errorOccurred = true;
              } else if (this.changes === 0) {
                console.error('[Billing] Insufficient stock for:', invId);
                errorOccurred = true; 
              }
              checkDone();
            });
          } else {
            checkDone();
          }
        });
      });
      
      function checkDone() {
        pending--;
        if (pending === 0) {
          itemStmt.finalize();
          invStmt.finalize();
          
          if (errorOccurred) {
            console.error('[Billing] Transaction failing due to previous errors. Rolling back.');
            db.run('ROLLBACK');
            return res.status(400).json({ error: 'Transaction failed. Check stock levels or item details.' });
          } else {
            // Update visit status if fully paid (Status is 'Paid')
            if (visit_id && status === 'Paid') {
              const vId = parseInt(visit_id);
              // Check current status to decide next step
              db.get('SELECT status FROM visits WHERE id = ?', [vId], (errV, v: any) => {
                let nextStatus: string = PatientStatus.WAITING_FOR_TRIAGE;
                if (v && v.status === PatientStatus.CONSULTATION_COMPLETE) {
                  nextStatus = PatientStatus.PAID;
                } else if (v && v.status === PatientStatus.AWAITING_BILLING) {
                  nextStatus = PatientStatus.PAID;
                }
                
                db.run('UPDATE visits SET status = ? WHERE id = ?', [nextStatus, vId], (errVisit) => {
                  if (errVisit) {
                    console.error('[Clinical Gate] Error updating visit status:', errVisit);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to update visit status' });
                  }
                  
                  logAudit(null, 'System', 'User', 'VISIT_STATUS_CHANGE', 'Consultations', `Visit ${vId} status changed to ${nextStatus}`);
                  
                  db.run('COMMIT', (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    logAudit(null, cashier, 'Staff', 'BILLING_CREATE', 'Billing', `New transaction ${receipt_no} for patient ID ${patient_id} (${effectiveBillingType}). Total: ${total_amount}`);
                    res.status(201).json({ receipt_no, transactionId, patient_id, billing_type: effectiveBillingType, family_id: effectiveFamilyId, total_amount, amount_paid: final_paid, balance, status });
                    triggerInsuranceAutoDraft(transactionId);
                  });
                });
              });
            } else {
              // Log why we didn't update status
              if (visit_id) {
                logAudit(null, 'System', 'User', 'VISIT_STATUS_SKIP', 'Consultations', `Skipped status update for Visit ${visit_id}. Reason: Status is ${status}`);
              }
              
              db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: err.message });
                logAudit(null, cashier, 'Staff', 'BILLING_CREATE', 'Billing', `New transaction ${receipt_no} for patient ID ${patient_id} (${effectiveBillingType}). Total: ${total_amount}`);
                res.status(201).json({ receipt_no, transactionId, patient_id, billing_type: effectiveBillingType, family_id: effectiveFamilyId, total_amount, amount_paid: final_paid, balance, status });
                triggerInsuranceAutoDraft(transactionId);
              });
            }
          }
        }
      }
        });
      });
    }
    });
  };

  // Kick off asynchronous verification and insertion pipeline
  verifyAndProceed();
});

// GET inventory items
app.get('/api/inventory', (req, res) => {
  const { category } = req.sanitizedQuery;
  let query = 'SELECT * FROM inventory';
  let params: any[] = [];
  
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// POST new inventory item
app.post('/api/inventory', authorizeRoles(['Admin']), (req, res) => {
  const { name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attributes } = req.sanitizedBody;
  const id = `INV-${Date.now()}`;
  
  const attrString = attributes ? (typeof attributes === 'string' ? attributes : JSON.stringify(attributes)) : null;
  
  const sql = `
    INSERT INTO inventory (
      id, name, category, stock, reorder_level, price, 
      cost_price, expiry_date, supplier, batch_number, attributes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    db.run(sql, [id, name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attrString], function(this: any, err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      // Log initial stock as movement
      if (stock > 0) {
        db.run(
          'INSERT INTO stock_movements (item_id, type, quantity, reason, performed_by) VALUES (?, ?, ?, ?, ?)',
          [id, 'IN', stock, 'Initial Stock', 'Admin']
        );
      }
      
      db.run('COMMIT', () => {
        res.status(201).json({ id, name, category, stock, reorder_level, price, attributes });
      });
    });
  });
});

// PUT update inventory item details
app.put('/api/inventory/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attributes } = req.sanitizedBody;
  
  const attrString = attributes ? (typeof attributes === 'string' ? attributes : JSON.stringify(attributes)) : null;
  
  const sql = `
    UPDATE inventory 
    SET name = ?, category = ?, stock = ?, reorder_level = ?, price = ?, 
        cost_price = ?, expiry_date = ?, supplier = ?, batch_number = ?, attributes = ?
    WHERE id = ?
  `;
  
  db.run(sql, [name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attrString, id], function(this: any, err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Inventory item updated successfully', item: { id, name, category, stock, reorder_level, price, attributes } });
  });
});

// PUT update inventory stock (Deduct/Add/Adjust)
app.put('/api/inventory/:id/stock', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { quantity_change, reason, type, performed_by, reference_id } = req.sanitizedBody; 
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    // Check if resulting stock goes below 0
    db.get('SELECT stock FROM inventory WHERE id = ?', [id], (err, row: any) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }
      
      if (row.stock + quantity_change < 0) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient stock. Adjustment would cause stock to fall below zero.' });
      }

      db.run('UPDATE inventory SET stock = stock + ? WHERE id = ?', [quantity_change, id], function(this: any, err) {
        if (err || this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err ? err.message : 'Item not found' });
        }
      
      db.run(
        'INSERT INTO stock_movements (item_id, type, quantity, reason, performed_by, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, type || (quantity_change > 0 ? 'IN' : 'OUT'), Math.abs(quantity_change), reason || 'Stock Update', performed_by || 'Admin', reference_id || null],
        (err2) => {
          if (err2) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err2.message });
          }
          db.run('COMMIT', () => {
            logAudit(null, performed_by || 'Admin', 'Admin', 'STOCK_ADJUST', 'Inventory', `${type || (quantity_change > 0 ? 'IN' : 'OUT')} adjustment of ${Math.abs(quantity_change)} for item ${id}. Reason: ${reason}`);
            
            // Check for low stock alert
            db.get('SELECT name, stock, reorder_level, expiry_date FROM inventory WHERE id = ?', [id], (err3, item: any) => {
              if (item) {
                if (item.stock <= item.reorder_level) {
                  notify('Admin', `Low stock alert: ${item.name} (${item.stock} left)`, 'Inventory');
                }
                const expiry = new Date(item.expiry_date);
                const soon = new Date();
                soon.setMonth(soon.getMonth() + 3);
                if (expiry <= soon) {
                  notify('Admin', `Expiring inventory alert: ${item.name} expires on ${item.expiry_date}`, 'Inventory');
                }
              }
            });

            res.json({ success: true, id, quantity_change });
          });
        }
      );
    });
  });
});

});

// GET stock movement history for an item
app.get('/api/inventory/:id/history', (req, res) => {
  const { id } = req.sanitizedParams;
  db.all('SELECT * FROM stock_movements WHERE item_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// DELETE inventory item with dependency check
app.delete('/api/inventory/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  
  db.get('SELECT COUNT(*) as count FROM transaction_items WHERE inventory_id = ?', [id], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row.count > 0) {
      return res.status(409).json({ error: `Cannot delete item. It is referenced in ${row.count} past transactions.` });
    }
    
    db.run('DELETE FROM inventory WHERE id = ?', [id], function(this: any, err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
      res.json({ success: true });
    });
  });
});

// GET inventory valuation report
app.get('/api/inventory/valuation', (req, res) => {
  db.all(`
    SELECT category, 
           COUNT(*) as item_count, 
           SUM(stock) as total_stock,
           SUM(stock * cost_price) as total_cost_value,
           SUM(stock * price) as total_retail_value
    FROM inventory 
    GROUP BY category
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET consultations
app.get('/api/consultations', (req, res) => {
  const { patient_id } = req.sanitizedQuery;
  let query = 'SELECT * FROM consultations ORDER BY created_at DESC';
  let params: any[] = [];
  if (patient_id) {
    query = 'SELECT * FROM consultations WHERE patient_id = ? ORDER BY created_at DESC';
    params = [patient_id];
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new consultation – accepts full clinical JSON
app.post('/api/consultations', authorizeRoles(['Admin', 'Optometrist', 'Consultant', 'Doctor']), (req, res) => {
  const data = req.sanitizedBody;

  // Only enforce strict validation if we are finalizing the visit
  if (data.finalized && (!data.primary_diagnosis || !data.complaint)) {
    return res.status(400).json({ error: 'Presenting Complaint and Primary Diagnosis are required to finalize this clinical record.' });
  }

  // Store the full clinical record as JSON in the consultations table
  // We keep key structured columns for querying + a clinical_data JSON blob for the expanded template
  const stmt = db.prepare(`
    INSERT INTO consultations (
      patient_id, visit_id, bp, complaint,
      va_od_unaided, va_od_pinhole, va_od_near,
      va_os_unaided, va_os_pinhole, va_os_near,
      iop_od, iop_os,
      ref_od_sph, ref_od_cyl, ref_od_axis,
      ref_os_sph, ref_os_cyl, ref_os_axis,
      anterior_segment, pupils_dilated, dilation_agent, posterior_segment,
      primary_diagnosis, diagnosis_notes, management_plan,
      clinical_data, consultant_name
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    data.patient_id, data.visit_id || null, data.bp || '', data.complaint || '',
    data.va_od_unaided || '', data.va_od_pinhole || '', data.va_od_near || '',
    data.va_os_unaided || '', data.va_os_pinhole || '', data.va_os_near || '',
    data.iop_od || '', data.iop_os || '',
    data.ref_od_sph || '', data.ref_od_cyl || '', data.ref_od_axis || '',
    data.ref_os_sph || '', data.ref_os_cyl || '', data.ref_os_axis || '',
    data.anterior_segment || '', data.pupils_dilated ? 1 : 0, data.dilation_agent || '', data.posterior_segment || '',
    data.primary_diagnosis || '', data.diagnosis_notes || '', data.management_plan || '',
    JSON.stringify(data.clinical_data || {}), data.consultant_name || '',
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Advance visit status
      const clinicalData = data.clinical_data || {};
      const isFinalized = data.finalize || data.finalized;
      let newStatus: string = isFinalized ? PatientStatus.CONSULTATION_COMPLETE : PatientStatus.IN_CONSULTATION;
      
      // If surgery advised or admission, the state machine should handle routing
      if (isFinalized) {
        if (clinicalData.surgery_advised) {
          newStatus = PatientStatus.AWAITING_SURGERY;
        } else if (clinicalData.admission_advised) {
          newStatus = PatientStatus.ADMITTED;
        } else {
          // Default move to billing after consultation
          newStatus = PatientStatus.AWAITING_BILLING;
        }
      }
      
      const updateSql = data.visit_id 
        ? 'UPDATE visits SET status = ? WHERE id = ?'
        : `UPDATE visits SET status = ? WHERE patient_id = ? 
           AND date(visit_date) = date("now","localtime") 
           AND status IN (?, ?, ?, ?)`;
      const updateParams = data.visit_id 
        ? [newStatus, data.visit_id] 
        : [newStatus, data.patient_id, PatientStatus.REGISTERED, PatientStatus.WAITING_FOR_TRIAGE, PatientStatus.WAITING_FOR_CONSULTATION, PatientStatus.IN_CONSULTATION];

      db.run(updateSql, updateParams, function(this: any, err2) {
        if (err2) console.error("Status update error:", err2);
        
        // Auto-dismiss matching triage notification
        db.run(
          "DELETE FROM notifications WHERE patient_id = ? AND module = 'Patients'",
          [data.patient_id]
        );
        
        // Handle Automatic Admission Enlistment
        const clinicalData = data.clinical_data || {};
        if (clinicalData.admission_advised) {
          console.log(`[ADMISSION_AUTO] Creating admission request for patient ${data.patient_id}`);
          
          // Check if already requested to avoid duplicates
          db.get('SELECT id FROM admissions WHERE visit_id = ? OR (patient_id = ? AND status = "Admitted")', 
            [data.visit_id || -1, data.patient_id], (err3, existing: any) => {
            if (!existing && !err3) {
              const admSql = `
                INSERT INTO admissions (
                  patient_id, visit_id, ward_name, bed_number, 
                  admitting_doctor, reason, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
              `;
              db.run(admSql, [
                data.patient_id, 
                data.visit_id || null, 
                'Pending Assignment', 
                'TBD', 
                data.consultant_name || 'Consultant',
                clinicalData.admission_reason || 'Requested via Consultation',
                'Admitted'
              ], (err4) => {
                if (err4) console.error("Auto-admission error:", err4);
                else console.log(`[ADMISSION_AUTO] Successfully enlisted patient ${data.patient_id}`);
              });
            }
          });
        }
        
        // 3. Clear from consultation_queue if finalized
        if (isFinalized) {
          db.run('DELETE FROM consultation_queue WHERE visit_id = ? OR (patient_id = ? AND date(checkin_at) = date("now"))', [data.visit_id, data.patient_id]);
        } else {
          // If just saving draft, ensure status is IN_CONSULTATION in the queue
          db.run('UPDATE consultation_queue SET status = ? WHERE visit_id = ?', [PatientStatus.IN_CONSULTATION, data.visit_id]);
        }
      });
      
      logAudit(null, data.consultant_name || 'Optometrist', 'Optometrist', isFinalized ? 'CONSULTATION_FINALIZE' : 'CONSULTATION_SAVE', 'Clinical', `${isFinalized ? 'Finalized' : 'Saved draft'} consultation for patient ID: ${data.patient_id}. Status: ${newStatus}`);
      res.status(201).json({ id: this.lastID, patient_id: data.patient_id, status: newStatus });
    }
  );
  stmt.finalize();
});

// GET investigations
app.get('/api/investigations', (req, res) => {
  const { patient_id, status, billing_status } = req.sanitizedQuery;
  let query = `
    SELECT i.*, p.full_name as patient_name,
           (SELECT name FROM inventory WHERE id = i.inventory_id) as inventory_name,
           (SELECT price FROM inventory WHERE id = i.inventory_id) as price
    FROM investigations i
    JOIN patients p ON i.patient_id = p.id
    WHERE 1=1
  `;
  let params: any[] = [];
  
  if (patient_id) {
    query += ' AND i.patient_id = ?';
    params.push(patient_id);
  }
  
  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }

  if (billing_status) {
    query += ' AND i.billing_status = ?';
    params.push(billing_status);
  }
  
  query += ' ORDER BY i.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new investigation (requesting a test)
app.post('/api/investigations', authorizeRoles(['Admin', 'Optometrist', 'Consultant', 'Doctor', 'Nurse']), (req, res) => {
  const { patient_id, test_name, requested_by, inventory_id, unit, reference_range } = req.sanitizedBody;
  const stmt = db.prepare('INSERT INTO investigations (patient_id, test_name, requested_by, inventory_id, unit, reference_range) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(patient_id, test_name, requested_by, inventory_id || null, unit || null, reference_range || null, function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, patient_id, test_name, status: 'Pending', billing_status: 'Unpaid', requested_by });
  });
  stmt.finalize();
});

// PUT update investigation results
app.put('/api/investigations/:id', authorizeRoles(['Admin', 'Optometrist', 'Consultant', 'Doctor', 'Nurse']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { results_notes, status, test_value, medical_comments, billing_status, unit, reference_range } = req.sanitizedBody;
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (results_notes !== undefined) { updates.push('results_notes = ?'); params.push(results_notes); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (test_value !== undefined) { updates.push('test_value = ?'); params.push(test_value); }
  if (medical_comments !== undefined) { updates.push('medical_comments = ?'); params.push(medical_comments); }
  if (billing_status !== undefined) { updates.push('billing_status = ?'); params.push(billing_status); }
  if (unit !== undefined) { updates.push('unit = ?'); params.push(unit); }
  if (reference_range !== undefined) { updates.push('reference_range = ?'); params.push(reference_range); }
  
  if (status === 'Completed' || status === 'Reviewed') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }

  if (updates.length === 0) return res.json({ success: true, id });

  params.push(id);
  db.run(`UPDATE investigations SET ${updates.join(', ')} WHERE id = ?`, params, function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Investigation not found' });
    
    if (status === 'Completed') {
      db.get('SELECT test_name, patient_id FROM investigations WHERE id = ?', [id], (err2, inv: any) => {
        if (inv) {
          notify('Optometrist', `New investigation result: ${inv.test_name} for Patient ${inv.patient_id}`, 'Results');
        }
      });
    }

    res.json({ success: true, id });
  });
});

// --- INVESTIGATION TEMPLATES CRUD ---

// GET all templates
app.get('/api/settings/investigations/templates', (req, res) => {
  db.all('SELECT * FROM investigation_templates ORDER BY test_name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new template
app.post('/api/settings/investigations/templates', authorizeRoles(['Admin']), (req, res) => {
  const { test_name, default_unit, default_reference_range, template_content } = req.sanitizedBody;
  db.run(
    'INSERT INTO investigation_templates (test_name, default_unit, default_reference_range, template_content) VALUES (?, ?, ?, ?)',
    [test_name, default_unit, default_reference_range, template_content],
    function(this: any, err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: `A template for "${test_name}" already exists.` });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, test_name, default_unit, default_reference_range, template_content });
    }
  );
});

// PUT update template
app.put('/api/settings/investigations/templates/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.params;
  const { test_name, default_unit, default_reference_range, template_content } = req.sanitizedBody;
  db.run(
    'UPDATE investigation_templates SET test_name = ?, default_unit = ?, default_reference_range = ?, template_content = ? WHERE id = ?',
    [test_name, default_unit, default_reference_range, template_content, id],
    function(this: any, err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: `A template for "${test_name}" already exists.` });
        }
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Template not found' });
      res.json({ success: true, id });
    }
  );
});

// DELETE template
app.delete('/api/settings/investigations/templates/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM investigation_templates WHERE id = ?', [id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  });
});

// GET admissions
app.get('/api/admissions', (req, res) => {
  const { status } = req.sanitizedQuery;
  let query = `
    SELECT a.*, p.full_name as patient_name
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    WHERE 1=1
  `;
  let params: any[] = [];
  
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY a.admission_date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new admission
app.post('/api/admissions', authorizeRoles(['Admin', 'Optometrist', 'Consultant', 'Doctor', 'Nurse']), (req, res) => {
  const { patient_id, ward_name, bed_number, admitting_doctor, reason, notes } = req.sanitizedBody;
  console.log(`[ADMISSION] Attempting to admit patient ${patient_id} to ${ward_name}`);
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    const stmt = db.prepare('INSERT INTO admissions (patient_id, ward_name, bed_number, admitting_doctor, reason, notes) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(patient_id, ward_name, bed_number, admitting_doctor, reason, notes, function(this: any, err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      const admissionId = this.lastID;
      
      // Update visits status to Admitted
      db.run('UPDATE visits SET status = "Admitted" WHERE patient_id = ? AND status != "Discharged"', [patient_id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        db.run('COMMIT', () => {
          logAudit(null, admitting_doctor, 'Clinical', 'ADMISSION_CREATE', 'Wards', `Patient ${patient_id} admitted to ${ward_name} / ${bed_number}. Reason: ${reason}`);
          res.status(201).json({ id: admissionId, patient_id, status: 'Admitted' });
        });
      });
    });
    stmt.finalize();
  });
});

// PUT update admission (Discharge or Add Notes)
app.put('/api/admissions/:id', authorizeRoles(['Admin', 'Optometrist', 'Consultant', 'Doctor', 'Nurse']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { status, notes } = req.sanitizedBody;
  
  if (status === 'Discharged') {
    db.run(`
      UPDATE admissions 
      SET status = ?, notes = ?, discharge_date = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, notes, id], function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Also update visits table status
      db.get('SELECT patient_id FROM admissions WHERE id = ?', [id], (err2, adm: any) => {
        if (adm) {
          db.run('UPDATE visits SET status = "Discharged" WHERE patient_id = ? AND status = "Admitted"', [adm.patient_id]);
        }
      });
      
      logAudit(null, 'Clinical Staff', 'Clinical', 'ADMISSION_DISCHARGE', 'Wards', `Discharged admission record ID: ${id}`);
      res.json({ success: true, id, status: 'Discharged' });
    });
  } else {
    // Just update notes
    db.run(`
      UPDATE admissions 
      SET notes = ?
      WHERE id = ?
    `, [notes, id], function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(null, 'Clinical Staff', 'Clinical', 'ADMISSION_UPDATE', 'Wards', `Updated clinical notes for admission ID: ${id}`);
      res.json({ success: true, id });
    });
  }
});

// --- PROCUREMENT API ---

// GET all suppliers
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new supplier
app.post('/api/suppliers', authorizeRoles(['Admin']), (req, res) => {
  const { name, contact_person, phone, email, address, created_by } = req.sanitizedBody;
  const sql = 'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [name, contact_person, phone, email, address], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(null, created_by, 'Admin', 'SUPPLIER_CREATE', 'Procurement', `Created supplier ${name}`);
    res.status(201).json({ id: this.lastID, name, contact_person });
  });
});

// GET all purchase orders
app.get('/api/purchase-orders', (req, res) => {
  db.all(`
    SELECT po.*, s.name as supplier_name 
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    ORDER BY po.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new purchase order or procurement record
app.post('/api/purchase-orders', authorizeRoles(['Admin']), (req, res) => {
  const { supplier_id, items } = req.sanitizedBody;
  if (Array.isArray(items)) {
    const po_number = `PO-${Date.now()}`;
    const total_amount = items.reduce((sum: number, i: any) => sum + (i.qty * i.unit_cost), 0);
    
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      db.run('INSERT INTO purchase_orders (po_number, supplier_id, total_amount, status) VALUES (?, ?, ?, ?)', 
        [po_number, supplier_id, total_amount, 'Draft'], function(this: any, err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        const poId = this.lastID;
        const stmt = db.prepare('INSERT INTO purchase_order_items (po_id, inventory_id, description, qty, unit_cost) VALUES (?, ?, ?, ?, ?)');
        items.forEach((item: any) => {
          stmt.run(poId, item.inventory_id || null, item.description, item.qty, item.unit_cost);
        });
        stmt.finalize();
        
        db.run('COMMIT', () => {
          res.status(201).json({ id: poId, po_number, total_amount });
        });
      });
    });
  } else {
    const { 
      item_name, quantity_received, unit_cost, total_cost, 
      invoice_number, amount_paid, balance, status, purchase_date, received_by, notes 
    } = req.sanitizedBody;

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      
      db.run(`
        INSERT INTO procurement (
          supplier_id, item_name, quantity_received, unit_cost, total_cost, 
          invoice_number, amount_paid, balance, status, purchase_date, received_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        supplier_id, item_name, quantity_received, unit_cost, total_cost, 
        invoice_number, amount_paid || 0, balance || (total_cost - (amount_paid || 0)), 
        status || 'Unpaid', purchase_date, received_by, notes
      ], function(this: any, err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        const insertedId = this.lastID;
        // Update inventory stock if item exists
        db.run(
          'UPDATE inventory SET stock = stock + ? WHERE name = ?',
          [quantity_received, item_name],
          (err2: any) => {
            if (err2) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err2.message });
            }
            db.run('COMMIT', () => {
              res.status(201).json({ id: insertedId, success: true });
            });
          }
        );
      });
    });
  }
});

// POST receive goods for PO
app.post('/api/purchase-orders/:id/receive', authorizeRoles(['Admin']), (req, res) => {
  const poId = req.sanitizedParams.id;
  const { received_items } = req.sanitizedBody; // Array of { item_id (po_item_id), inventory_id, qty_received, cost_price }

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    // Update PO items received qty
    const updatePOItem = db.prepare('UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?');
    const updateInventory = db.prepare('UPDATE inventory SET stock = stock + ?, cost_price = ? WHERE id = ?');
    const logMovement = db.prepare('INSERT INTO stock_movements (item_id, type, quantity, reason, reference_id) VALUES (?, ?, ?, ?, ?)');

    received_items.forEach(item => {
      updatePOItem.run(item.qty_received, item.item_id);
      if (item.inventory_id) {
        updateInventory.run(item.qty_received, item.cost_price, item.inventory_id);
        logMovement.run(item.inventory_id, 'IN', item.qty_received, 'Procurement (PO Receipt)', poId);
      }
    });

    updatePOItem.finalize();
    updateInventory.finalize();
    logMovement.finalize();

    // Check if PO is fully received
    db.get(`
      SELECT SUM(qty) as total_ordered, SUM(received_qty) as total_received 
      FROM purchase_order_items WHERE po_id = ?
    `, [poId], (err, row: any) => {
      const newStatus = row.total_received >= row.total_ordered ? 'Received' : 'Partial';
      db.run('UPDATE purchase_orders SET status = ? WHERE id = ?', [newStatus, poId]);
      
      // Update supplier balance
      db.get('SELECT supplier_id, total_amount FROM purchase_orders WHERE id = ?', [poId], (err2, poRow: any) => {
        db.run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [poRow.total_amount, poRow.supplier_id]);
        
        db.run('COMMIT', () => {
          res.json({ success: true, status: newStatus });
        });
      });
    });
  });
});

// GET procurement stats
app.get('/api/procurement/stats', (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const queries = {
    total_procured: "SELECT SUM(total_cost) as total FROM procurement WHERE purchase_date LIKE ?",
    total_payables: "SELECT SUM(balance) as total FROM procurement WHERE status IN ('Partial', 'Unpaid')",
    total_suppliers: "SELECT COUNT(*) as count FROM suppliers",
    po_this_month: "SELECT COUNT(*) as count FROM procurement WHERE purchase_date LIKE ?"
  };

  Promise.all([
    new Promise(resolve => db.get(queries.total_procured, [`${currentMonth}%`], (err, row: any) => resolve(row?.total || 0))),
    new Promise(resolve => db.get(queries.total_payables, [], (err, row: any) => resolve(row?.total || 0))),
    new Promise(resolve => db.get(queries.total_suppliers, [], (err, row: any) => resolve(row?.count || 0))),
    new Promise(resolve => db.get(queries.po_this_month, [`${currentMonth}%`], (err, row: any) => resolve(row?.count || 0)))
  ]).then(([procured, payables, suppliersCount, poCount]) => {
    res.json({
      total_procured: procured,
      total_payables: payables,
      total_suppliers: suppliersCount,
      po_this_month: poCount
    });
  }).catch(err => res.status(500).json({ error: err.message }));
});


// ─── NIGERIA PAYE TAX ENGINE ───────────────────────────────────────────────
// Computes annual PAYE per Nigeria Personal Income Tax Act (PITA as amended) & FIRS regulations.
// Expects monthly basic, transport, housing, and other allowances.
// Annualizes figures to compute CRA (higher of ₦200,000 or 1% of gross + 20% of gross),
// statutory deductions (pension 8%, NHF 2.5%), applies graduated tax bands,
// checks minimum tax (1% of gross), and resolves to monthly PAYE deduction.
const computeNigeriaPAYE = (basic: number, transport: number, housing: number, others: number) => {
  const monthlyGross = (basic || 0) + (transport || 0) + (housing || 0) + (others || 0);
  const monthlyPensionable = (basic || 0) + (transport || 0) + (housing || 0);
  const monthlyPensionEmployee = Math.round(monthlyPensionable * 0.08); // 8% employee contribution
  const monthlyPensionEmployer = Math.round(monthlyPensionable * 0.10); // 10% employer contribution
  const monthlyNhf = Math.round((basic || 0) * 0.025);                  // 2.5% NHF on basic

  // Annualized values for FIRS tax computation
  const annualGross = monthlyGross * 12;
  const annualPensionEmployee = monthlyPensionEmployee * 12;
  const annualNhf = monthlyNhf * 12;

  // Consolidated Relief Allowance (CRA): Higher of ₦200,000 or 1% of gross, PLUS 20% of gross
  const higherOf200kOr1Pct = Math.max(200000, annualGross * 0.01);
  const cra = higherOf200kOr1Pct + (0.20 * annualGross);

  // Annual Chargeable Income
  const annualChargeable = Math.max(0, annualGross - cra - annualPensionEmployee - annualNhf);

  // FIRS graduated tax bands (annual)
  const bands = [
    { limit: 300000,   rate: 0.07 },
    { limit: 300000,   rate: 0.11 },
    { limit: 500000,   rate: 0.15 },
    { limit: 500000,   rate: 0.19 },
    { limit: 1600000,  rate: 0.21 },
    { limit: Infinity, rate: 0.24 },
  ];

  let remaining = annualChargeable;
  let annualTax = 0;
  for (const band of bands) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, band.limit);
    annualTax += taxable * band.rate;
    remaining -= taxable;
  }

  // Minimum tax rule: 1% of gross income if computed tax is lower (applies to taxable earners)
  if (annualGross > 360000 && annualTax < (annualGross * 0.01)) {
    annualTax = annualGross * 0.01;
  }

  const paye_annual = Math.round(annualTax);
  const paye_monthly = Math.round(paye_annual / 12);

  return {
    gross: monthlyGross,
    pensionable: monthlyPensionable,
    sra: Math.round(cra / 12),
    cra_annual: Math.round(cra),
    nhf: monthlyNhf,
    pensionEmployee: monthlyPensionEmployee,
    pensionEmployer: monthlyPensionEmployer,
    chargeableIncome: Math.round(annualChargeable / 12),
    chargeableIncome_annual: Math.round(annualChargeable),
    paye_annual,
    paye_monthly,
  };
};

// ─── EXPENSES CRUD ──────────────────────────────────────────────────────────

// GET expenses with filtering
app.get('/api/expenses', authorizeRoles(['Admin']), (req, res) => {
  const { start_date, end_date, category, expense_type } = req.sanitizedQuery;
  let sql = `SELECT e.*, u.full_name as staff_name FROM expenses e LEFT JOIN users u ON e.staff_id = u.id WHERE 1=1`;
  const params: any[] = [];
  if (start_date && end_date) { sql += ' AND date(e.date) BETWEEN ? AND ?'; params.push(start_date, end_date); }
  if (category) { sql += ' AND e.category = ?'; params.push(category); }
  if (expense_type) { sql += ' AND e.expense_type = ?'; params.push(expense_type); }
  sql += ' ORDER BY e.date DESC, e.id DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST create expense
app.post('/api/expenses', authorizeRoles(['Admin']), (req, res) => {
  const { date, category, expense_type, description, amount, recorded_by, approved_by, payment_ref, staff_id, month_year, notes } = req.sanitizedBody;
  if (!description || !amount || !category) return res.status(400).json({ error: 'category, description and amount are required' });
  db.run(
    `INSERT INTO expenses (date, category, expense_type, description, amount, recorded_by, approved_by, payment_ref, staff_id, month_year, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date || new Date().toISOString(), category, expense_type || 'Overhead', description, parseFloat(amount), recorded_by, approved_by, payment_ref, staff_id || null, month_year || null, notes],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'EXPENSE_CREATE', 'Finance', `Recorded expense: ${category} - ${description} = ₦${amount}`, 'Financial');
      res.status(201).json({ id: this.lastID, success: true });
    }
  );
});

// PUT update expense
app.put('/api/expenses/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { date, category, expense_type, description, amount, recorded_by, approved_by, payment_ref, notes } = req.sanitizedBody;
  db.run(
    `UPDATE expenses SET date=?, category=?, expense_type=?, description=?, amount=?, recorded_by=?, approved_by=?, payment_ref=?, notes=? WHERE id=?`,
    [date, category, expense_type || 'Overhead', description, parseFloat(amount), recorded_by, approved_by, payment_ref, notes, id],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'EXPENSE_UPDATE', 'Finance', `Updated expense ID ${id}`, 'Financial');
      res.json({ success: true });
    }
  );
});

// DELETE expense
app.delete('/api/expenses/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.run('DELETE FROM expenses WHERE id = ?', [id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req.user?.id, req.user?.username, req.user?.role, 'EXPENSE_DELETE', 'Finance', `Deleted expense ID ${id}`, 'Critical');
    res.json({ success: true });
  });
});

// ─── STAFF SALARIES ─────────────────────────────────────────────────────────

// GET staff salary schedules with optional status filter (active, archived, all)
app.get('/api/staff-salaries', authorizeRoles(['Admin']), (req, res) => {
  const { status } = req.sanitizedQuery;
  let whereClause = 'WHERE ss.is_active = 1';
  if (status === 'archived') {
    whereClause = 'WHERE ss.is_active = 0';
  } else if (status === 'all') {
    whereClause = '';
  }
  db.all(`
    SELECT ss.*, u.full_name, u.username, u.role, u.department, u.status as user_status,
           (ss.basic_salary + ss.transport_allowance + ss.housing_allowance + ss.other_allowances) as gross_salary
    FROM staff_salaries ss
    JOIN users u ON ss.user_id = u.id
    ${whereClause}
    ORDER BY ss.is_active DESC, u.full_name ASC, ss.effective_from DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Attach PAYE preview to each row
    const enriched = (rows as any[]).map((r: any) => {
      const tax = computeNigeriaPAYE(r.basic_salary, r.transport_allowance, r.housing_allowance, r.other_allowances);
      return { ...r, ...tax };
    });
    res.json(enriched);
  });
});

// POST create/update staff salary record
app.post('/api/staff-salaries', authorizeRoles(['Admin']), (req, res) => {
  const { user_id, basic_salary, transport_allowance, housing_allowance, other_allowances, effective_from } = req.sanitizedBody;
  if (!user_id || !basic_salary || !effective_from) return res.status(400).json({ error: 'user_id, basic_salary and effective_from are required' });
  db.serialize(() => {
    // Deactivate previous record
    db.run('UPDATE staff_salaries SET is_active = 0, effective_to = ? WHERE user_id = ? AND is_active = 1', [effective_from, user_id]);
    db.run(
      `INSERT INTO staff_salaries (user_id, basic_salary, transport_allowance, housing_allowance, other_allowances, effective_from, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, parseFloat(basic_salary), parseFloat(transport_allowance || 0), parseFloat(housing_allowance || 0), parseFloat(other_allowances || 0), effective_from, req.user?.username],
      function(this: any, err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.user?.id, req.user?.username, req.user?.role, 'SALARY_SET', 'Payroll', `Set salary schedule for user_id=${user_id}: basic=₦${basic_salary}`, 'Critical');
        res.status(201).json({ id: this.lastID, success: true });
      }
    );
  });
});

// PUT update existing salary record
app.put('/api/staff-salaries/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { basic_salary, transport_allowance, housing_allowance, other_allowances, effective_from } = req.sanitizedBody;
  if (!basic_salary) return res.status(400).json({ error: 'basic_salary is required' });
  db.run(
    'UPDATE staff_salaries SET basic_salary=?, transport_allowance=?, housing_allowance=?, other_allowances=?, effective_from=COALESCE(?, effective_from) WHERE id=?',
    [parseFloat(basic_salary), parseFloat(transport_allowance || 0), parseFloat(housing_allowance || 0), parseFloat(other_allowances || 0), effective_from || null, id],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'SALARY_UPDATE', 'Payroll', `Updated salary schedule ID ${id}`, 'Critical');
      res.json({ success: true });
    }
  );
});

// DELETE soft-delete (archive) staff salary record
app.delete('/api/staff-salaries/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const today = new Date().toISOString().split('T')[0];
  db.run(
    'UPDATE staff_salaries SET is_active = 0, effective_to = COALESCE(effective_to, ?) WHERE id = ?',
    [today, id],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'SALARY_ARCHIVE', 'Payroll', `Archived salary schedule ID ${id}`, 'Critical');
      res.json({ success: true, archived: this.changes });
    }
  );
});

// PUT restore archived staff salary record
app.put('/api/staff-salaries/:id/restore', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.get('SELECT ss.user_id, u.full_name FROM staff_salaries ss JOIN users u ON ss.user_id = u.id WHERE ss.id = ?', [id], (err, row: any) => {
    if (err || !row) return res.status(404).json({ error: 'Salary record not found' });
    const today = new Date().toISOString().split('T')[0];
    db.serialize(() => {
      // Deactivate any currently active schedule for this user
      db.run('UPDATE staff_salaries SET is_active = 0, effective_to = ? WHERE user_id = ? AND is_active = 1', [today, row.user_id]);
      // Reactivate this schedule
      db.run('UPDATE staff_salaries SET is_active = 1, effective_to = NULL WHERE id = ?', [id], function(this: any, err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        logAudit(req.user?.id, req.user?.username, req.user?.role, 'SALARY_RESTORE', 'Payroll', `Restored salary schedule ID ${id} for ${row.full_name}`, 'Critical');
        res.json({ success: true });
      });
    });
  });
});

// ─── PAYROLL ─────────────────────────────────────────────────────────────────

// GET payroll runs (with optional month filter)
app.get('/api/payroll', authorizeRoles(['Admin']), (req, res) => {
  const { month_year } = req.sanitizedQuery;
  let sql = `SELECT pr.*, u.username, u.role, u.department FROM payroll_runs pr JOIN users u ON pr.user_id = u.id`;
  const params: any[] = [];
  if (month_year) { sql += ' WHERE pr.month_year = ?'; params.push(month_year); }
  sql += ' ORDER BY pr.month_year DESC, pr.full_name ASC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST run payroll for a given month — computes PAYE/NHF/pension for all active staff with salary schedule
app.post('/api/payroll/run', authorizeRoles(['Admin']), (req, res) => {
  const { month_year } = req.sanitizedBody;
  if (!month_year || !/^\d{4}-\d{2}$/.test(month_year)) {
    return res.status(400).json({ error: 'month_year is required in YYYY-MM format' });
  }
  // Check if payroll already exists for this month
  db.get('SELECT COUNT(*) as cnt FROM payroll_runs WHERE month_year = ?', [month_year], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row.cnt > 0) return res.status(409).json({ error: `Payroll for ${month_year} has already been processed. Delete or void it first.` });

    db.all(`
      SELECT ss.*, u.id as user_id, u.full_name, u.username, u.role, u.status as user_status
      FROM staff_salaries ss
      JOIN users u ON ss.user_id = u.id
      WHERE ss.is_active = 1 AND u.status = 'Active'
    `, [], (err2, salaries: any[]) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!salaries.length) return res.status(404).json({ error: 'No active staff salary schedules found.' });

      const processed = req.user?.username || 'Admin';
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION');
        const stmt = db.prepare(`
          INSERT INTO payroll_runs (month_year, user_id, full_name, basic_salary, transport_allowance, housing_allowance, other_allowances,
            gross_salary, pensionable_salary, paye_annual, paye_monthly, pension_employee, pension_employer, nhf, total_deductions, net_salary, processed_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const taxRows: any[] = [];
        salaries.forEach((s: any) => {
          const tax = computeNigeriaPAYE(s.basic_salary, s.transport_allowance, s.housing_allowance, s.other_allowances);
          const totalDed = tax.paye_monthly + tax.nhf + tax.pensionEmployee;
          const net = tax.gross - totalDed;
          stmt.run(month_year, s.user_id, s.full_name, s.basic_salary, s.transport_allowance, s.housing_allowance, s.other_allowances,
            tax.gross, tax.pensionable, tax.paye_annual, tax.paye_monthly, tax.pensionEmployee, tax.pensionEmployer, tax.nhf, totalDed, net);
          taxRows.push({ user_id: s.user_id, name: s.full_name, ...tax, total_deductions: totalDed, net });
        });
        stmt.finalize();
        // Post PAYE tax records
        const taxStmt = db.prepare(`
          INSERT INTO tax_records (tax_type, reference_type, vendor_name, gross_amount, tax_rate, tax_amount, period, status, recorded_by)
          VALUES (?, 'payroll', ?, ?, ?, ?, ?, 'Accrued', ?)
        `);
        taxRows.forEach(t => {
          if (t.paye_monthly > 0) taxStmt.run('PAYE', t.name, t.gross, 0, t.paye_monthly, month_year, processed);
          if (t.nhf > 0) taxStmt.run('NHF', t.name, t.basic_salary, 2.5, t.nhf, month_year, processed);
          if (t.pensionEmployee > 0) taxStmt.run('PENSION_EMPLOYEE', t.name, t.pensionable, 8, t.pensionEmployee, month_year, processed);
          if (t.pensionEmployer > 0) taxStmt.run('PENSION_EMPLOYER', t.name, t.pensionable, 10, t.pensionEmployer, month_year, processed);
        });
        taxStmt.finalize();
        db.run('COMMIT', (commitErr) => {
          if (commitErr) { db.run('ROLLBACK'); return res.status(500).json({ error: commitErr.message }); }
          logAudit(req.user?.id, req.user?.username, req.user?.role, 'PAYROLL_RUN', 'Payroll', `Processed payroll for ${month_year}: ${salaries.length} staff`, 'Critical');
          res.json({ success: true, month_year, count: salaries.length, entries: taxRows });
        });
      });
    });
  });
});

// POST post payroll to expenses (bulk — marks all as expense entries)
app.post('/api/payroll/post-to-expenses', authorizeRoles(['Admin']), (req, res) => {
  const { month_year } = req.sanitizedBody;
  if (!month_year) return res.status(400).json({ error: 'month_year is required' });
  db.all('SELECT * FROM payroll_runs WHERE month_year = ? AND expense_id IS NULL', [month_year], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'No unposted payroll entries found for this month.' });
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      let posted = 0;
      rows.forEach(r => {
        db.run(
          `INSERT INTO expenses (date, category, expense_type, description, amount, recorded_by, month_year, staff_id, notes)
           VALUES (date('now'), 'Salary', 'Salary', ?, ?, ?, ?, ?, 'Payroll auto-posted')`,
          [`Salary - ${r.full_name} (${month_year})`, r.net_salary, req.user?.username, month_year, r.user_id, `PAYE:₦${r.paye_monthly} | NHF:₦${r.nhf} | Pension:₦${r.pension_employee}`],
          function(this: any, err2) {
            if (!err2) {
              db.run('UPDATE payroll_runs SET expense_id = ?, payment_status = ? WHERE id = ?', [this.lastID, 'Paid', r.id]);
              posted++;
            }
          }
        );
      });
      db.run('COMMIT', () => {
        logAudit(req.user?.id, req.user?.username, req.user?.role, 'PAYROLL_POST', 'Payroll', `Posted ${posted} payroll entries for ${month_year} to expenses`, 'Critical');
        res.json({ success: true, posted });
      });
    });
  });
});

// PUT mark single payroll entry as paid
app.put('/api/payroll/:id/pay', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { payment_date, payment_ref, payment_method } = req.sanitizedBody;
  db.run(
    'UPDATE payroll_runs SET payment_status=?, payment_date=?, payment_ref=?, payment_method=? WHERE id=?',
    ['Paid', payment_date || new Date().toISOString().split('T')[0], payment_ref, payment_method, id],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'PAYROLL_PAY', 'Payroll', `Marked payroll entry ${id} as paid`, 'Financial');
      res.json({ success: true });
    }
  );
});

// DELETE payroll run for a month (admin void)
app.delete('/api/payroll/:month_year', authorizeRoles(['Admin']), (req, res) => {
  const { month_year } = req.sanitizedParams;
  db.serialize(() => {
    db.run('DELETE FROM tax_records WHERE reference_type=? AND period=?', ['payroll', month_year]);
    db.run('DELETE FROM payroll_runs WHERE month_year=?', [month_year], function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'PAYROLL_DELETE', 'Payroll', `Voided payroll for ${month_year}`, 'Critical');
      res.json({ success: true, deleted: this.changes });
    });
  });
});

// GET payroll summary by month
app.get('/api/payroll/summary', authorizeRoles(['Admin']), (req, res) => {
  const { month_year } = req.sanitizedQuery;
  const period = month_year || new Date().toISOString().slice(0, 7);
  db.get(`
    SELECT
      COUNT(*) as staff_count,
      SUM(gross_salary) as total_gross,
      SUM(paye_monthly) as total_paye,
      SUM(pension_employee) as total_pension_ee,
      SUM(pension_employer) as total_pension_er,
      SUM(nhf) as total_nhf,
      SUM(net_salary) as total_net,
      SUM(total_deductions) as total_deductions,
      SUM(CASE WHEN payment_status='Paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN payment_status='Pending' THEN 1 ELSE 0 END) as pending_count
    FROM payroll_runs WHERE month_year = ?
  `, [period], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ month_year: period, ...(row || {}) });
  });
});

// ─── TAX RECORDS ─────────────────────────────────────────────────────────────

// GET tax records with filter
app.get('/api/tax-records', authorizeRoles(['Admin']), (req, res) => {
  const { tax_type, period, status } = req.sanitizedQuery;
  let sql = 'SELECT * FROM tax_records WHERE 1=1';
  const params: any[] = [];
  if (tax_type) { sql += ' AND tax_type = ?'; params.push(tax_type); }
  if (period) { sql += ' AND period = ?'; params.push(period); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET tax summary for a period (for dashboard)
app.get('/api/tax-records/summary', authorizeRoles(['Admin']), (req, res) => {
  const { period } = req.sanitizedQuery;
  const p = period || new Date().toISOString().slice(0, 7);
  db.all(`
    SELECT tax_type, SUM(tax_amount) as total, SUM(CASE WHEN status='Remitted' THEN tax_amount ELSE 0 END) as remitted,
           SUM(CASE WHEN status='Accrued' THEN tax_amount ELSE 0 END) as accrued, COUNT(*) as count
    FROM tax_records WHERE period = ?
    GROUP BY tax_type
  `, [p], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ period: p, breakdown: rows });
  });
});

// PUT mark tax record as remitted
app.put('/api/tax-records/:id/remit', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { remittance_date, remittance_ref } = req.sanitizedBody;
  db.run(
    "UPDATE tax_records SET status='Remitted', remittance_date=?, remittance_ref=?, remitted_by=? WHERE id=?",
    [remittance_date || new Date().toISOString().split('T')[0], remittance_ref, req.user?.username, id],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'TAX_REMIT', 'Finance', `Remitted tax record ID ${id}`, 'Financial');
      res.json({ success: true });
    }
  );
});

// PUT update payment status on procurement (supplier payment)
app.put('/api/procurement/:id/payment', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { amount_paid, payment_ref, notes } = req.sanitizedBody;
  db.get('SELECT * FROM procurement WHERE id = ?', [id], (err, p: any) => {
    if (err || !p) return res.status(404).json({ error: 'Procurement record not found' });
    const newPaid = (p.amount_paid || 0) + parseFloat(amount_paid);
    const newBalance = Math.max(0, p.total_cost - newPaid);
    const newStatus = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Unpaid');
    db.run(
      'UPDATE procurement SET amount_paid=?, balance=?, status=?, notes=COALESCE(notes||? ,?) WHERE id=?',
      [newPaid, newBalance, newStatus, notes ? ` | ${notes}` : '', notes || '', id],
      function(this: any, err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        logAudit(req.user?.id, req.user?.username, req.user?.role, 'PROCUREMENT_PAY', 'Procurement', `Payment of ₦${amount_paid} recorded for procurement ID ${id}. New status: ${newStatus}`, 'Financial');
        res.json({ success: true, new_balance: newBalance, new_status: newStatus });
      }
    );
  });
});

// GET single procurement record
app.get('/api/procurement/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.get(`SELECT p.*, s.name as supplier_name FROM procurement p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

// PUT full edit of a procurement record
app.put('/api/procurement/:id/edit', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { supplier_id, item_name, quantity_received, unit_cost, amount_paid, invoice_number, purchase_date, received_by, notes } = req.sanitizedBody;
  db.get('SELECT * FROM procurement WHERE id = ?', [id], (err, p: any) => {
    if (err || !p) return res.status(404).json({ error: 'Procurement record not found' });
    const qty = parseFloat(quantity_received) || p.quantity_received;
    const uc = parseFloat(unit_cost) || p.unit_cost;
    const total = qty * uc;
    const paid = (amount_paid !== undefined && amount_paid !== null && String(amount_paid) !== '') ? parseFloat(amount_paid) : p.amount_paid;
    const balance = Math.max(0, total - paid);
    const status = balance <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid');
    db.run(
      `UPDATE procurement SET supplier_id=?, item_name=?, quantity_received=?, unit_cost=?, total_cost=?,
       amount_paid=?, balance=?, status=?, invoice_number=?, purchase_date=?, received_by=?, notes=? WHERE id=?`,
      [
        supplier_id || p.supplier_id,
        item_name || p.item_name,
        qty, uc, total, paid, balance, status,
        (invoice_number !== undefined && invoice_number !== null) ? invoice_number : p.invoice_number,
        purchase_date || p.purchase_date,
        received_by || p.received_by,
        (notes !== undefined && notes !== null) ? notes : p.notes,
        id
      ],
      function(this: any, err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        logAudit(req.user?.id, req.user?.username, req.user?.role, 'PROCUREMENT_EDIT', 'Procurement',
          `Edited procurement ID ${id}: ${item_name || p.item_name}`, 'Financial');
        res.json({ success: true });
      }
    );
  });
});

// DELETE procurement record
app.delete('/api/procurement/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.get('SELECT * FROM procurement WHERE id = ?', [id], (err, p: any) => {
    if (err || !p) return res.status(404).json({ error: 'Procurement record not found' });
    db.run('DELETE FROM procurement WHERE id = ?', [id], function(this: any, err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      logAudit(req.user?.id, req.user?.username, req.user?.role, 'PROCUREMENT_DELETE', 'Procurement',
        `Deleted procurement ID ${id}: ${p.item_name}`, 'Critical');
      res.json({ success: true });
    });
  });
});

// GET procurement report with WHT data
app.get('/api/reports/procurement/wht-summary', authorizeRoles(['Admin']), (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;
  db.get(`
    SELECT
      SUM(total_cost) as total_procurement,
      SUM(wht_amount) as total_wht_accrued,
      COUNT(*) as transaction_count,
      SUM(CASE WHEN status='Paid' THEN total_cost ELSE 0 END) as total_paid
    FROM procurement
    WHERE date(purchase_date) BETWEEN ? AND ?
  `, [start_date || '2000-01-01', end_date || '2099-12-31'], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// --- REPORTS API ---

// Sales Report
// Sales & Revenue Report Summary

app.get('/api/reports/sales/summary', (req, res) => {
  const queries = {
    todaySales: `SELECT SUM(amount_paid) as total FROM transactions WHERE date(created_at, 'localtime') = date('now', 'localtime') AND status IN ('Paid', 'Partial')`,
    monthSales: `SELECT SUM(amount_paid) as total FROM transactions WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime') AND status IN ('Paid', 'Partial')`,
    monthTransactions: `SELECT COUNT(*) as count FROM transactions WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`,
    outstandingDebts: `SELECT SUM(balance) as total FROM transactions WHERE status IN ('Unpaid', 'Partial')`
  };

  db.serialize(() => {
    let results: any = {};
    db.get(queries.todaySales, [], (err, row: any) => {
      results.todaySales = row?.total || 0;
      db.get(queries.monthSales, [], (err, row: any) => {
        results.monthSales = row?.total || 0;
        db.get(queries.monthTransactions, [], (err, row: any) => {
          results.monthTransactions = row?.count || 0;
          db.get(queries.outstandingDebts, [], (err, row: any) => {
            results.outstandingDebts = row?.total || 0;
            res.json(results);
          });
        });
      });
    });
  });
});

// Transaction Details for Modal
app.get('/api/transactions/:id/items', (req, res) => {
  const { id } = req.sanitizedParams;
  db.all(`
    SELECT * FROM transaction_items WHERE transaction_id = ?
  `, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reports/sales', validateRequest({ query: RequiredReportQuerySchema }), (req, res) => {
  const { start_date, end_date, limit, offset, cashier } = req.sanitizedQuery;
  
  let sql = `
    SELECT t.*, 
           CASE 
             WHEN t.billing_type = 'family' THEN COALESCE(f.family_name || ' Family', t.patient_id)
             WHEN t.billing_type = 'walk_in' THEN 'Walk-in Customer'
             ELSE COALESCE(p.full_name, f.family_name || ' Family', 'Walk-in Customer')
           END as patient_name, 
           COALESCE(p.id, f.family_card_number, t.patient_id) as file_no, 
           t.cashier as cashier_name,
           (SELECT GROUP_CONCAT(description, ', ') FROM transaction_items WHERE transaction_id = t.id) as items_summary
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    LEFT JOIN families f ON (t.family_id IS NOT NULL AND t.family_id = f.id) OR (t.family_id IS NULL AND t.patient_id = f.family_card_number)
    WHERE date(t.created_at) BETWEEN ? AND ?
  `;
  const params: any[] = [start_date, end_date];
  
  if (cashier) {
    sql += ` AND t.cashier = ?`;
    params.push(cashier);
  }
  
  sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Patient Debtors Report (Detailed)
app.get('/api/reports/debtors/details', (req, res) => {
  const sql = `
    SELECT t.id as transaction_id, t.receipt_no, t.billing_type, t.family_id,
           COALESCE(p.id, f.family_card_number, t.patient_id) as file_no, 
           CASE 
             WHEN t.billing_type = 'family' THEN COALESCE(f.family_name || ' Family', t.patient_id)
             WHEN t.billing_type = 'walk_in' THEN 'Walk-in Customer'
             ELSE COALESCE(p.full_name, f.family_name || ' Family', 'Unregistered / Walk-in Patient')
           END as patient_name, 
           COALESCE(p.phone, f.contact_person_phone, 'N/A') as phone, 
           date(t.created_at) as visit_date, t.total_amount, t.amount_paid, t.discount,
           (t.total_amount - t.amount_paid - t.discount) as balance_due,
           CAST((julianday('now') - julianday(t.created_at)) AS INTEGER) as days_outstanding
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    LEFT JOIN families f ON (t.family_id IS NOT NULL AND t.family_id = f.id) OR (t.family_id IS NULL AND t.patient_id = f.family_card_number)
    WHERE (t.total_amount - t.amount_paid - t.discount) > 0
      AND (t.is_insurance_bill = 0 OR t.is_insurance_bill IS NULL)
    ORDER BY days_outstanding DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PATCH record payment against debt
app.patch('/api/transactions/:id/payment', (req, res) => {
  const { id } = req.sanitizedParams;
  const { amount_paid, payment_method, cashier } = req.sanitizedBody;
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    db.get('SELECT total_amount, discount, amount_paid, patient_id, receipt_no FROM transactions WHERE id = ?', [id], (err, row: any) => {
      if (err || !row) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      const additional_payment = parseFloat(amount_paid);
      const new_total_paid = (row.amount_paid || 0) + additional_payment;
      const new_balance = row.total_amount - (row.discount || 0) - new_total_paid;
      const new_status = new_balance <= 0 ? 'Paid' : 'Partial';
      
      db.run(`
        UPDATE transactions 
        SET amount_paid = ?, balance = ?, status = ?, payment_method = ?
        WHERE id = ?
      `, [new_total_paid, new_balance, new_status, payment_method, id], (err2) => {
        if (err2) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err2.message });
        }
        
        db.run('COMMIT', () => {
          logAudit(
            req.user?.id,
            cashier || req.user?.username || 'Admin',
            req.user?.role || 'Admin',
            'BILLING_PAYMENT',
            'Billing',
            `Recorded additional payment of ₦${additional_payment.toLocaleString()} for ${row.receipt_no}. New balance: ₦${new_balance.toLocaleString()}`,
            'Financial'
          );
          res.json({ success: true, new_balance, new_status });
        });
      });
    });
  });
});

// Debtors Summary Stats
app.get('/api/reports/debtors/summary', (req, res) => {
  const thisMonth = new Date().toISOString().substring(0, 7);
  db.get(`
    SELECT 
      SUM(total_amount - amount_paid - discount) as total_outstanding,
      COUNT(DISTINCT patient_id) as number_of_debtors,
      (SELECT (total_amount - amount_paid - discount) || ' - ' || COALESCE(p.full_name, f.family_name || ' Family', t2.patient_id) 
       FROM transactions t2 
       LEFT JOIN patients p ON t2.patient_id = p.id 
       LEFT JOIN families f ON t2.patient_id = f.family_card_number
       WHERE (total_amount - amount_paid - discount) > 0 
       ORDER BY (total_amount - amount_paid - discount) DESC LIMIT 1) as highest_debt,
      (SELECT SUM(amount_paid) FROM transactions WHERE date(created_at) LIKE ?) as cleared_this_month
  `, [thisMonth + '%'], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// Patient Visit Report (Unified Activity)
app.get('/api/reports/patients/activity', (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  
  const sql = `
    SELECT v.id as encounter_id, date(v.visit_date) as date, p.full_name as patient_name, p.id as file_no, p.gender, p.dob as age, p.phone,
           c.consultant_name as clinician, c.primary_diagnosis as diagnosis, 'Visited' as status
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    LEFT JOIN consultations c ON v.id = c.visit_id
    WHERE date(v.visit_date) BETWEEN ? AND ?
    
    UNION ALL
    
    SELECT a.id as encounter_id, date(a.admission_date) as date, p.full_name as patient_name, p.id as file_no, p.gender, p.dob as age, p.phone,
           a.admitting_doctor as clinician, a.reason as diagnosis, a.status
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    WHERE date(a.admission_date) BETWEEN ? AND ?
    
    ORDER BY date DESC
  `;
  db.all(sql, [start_date, end_date, start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Patient Summary Stats
app.get('/api/reports/patients/summary', (req, res) => {
  db.get(`
    SELECT 
      (SELECT COUNT(*) FROM patients) as total_registered,
      (SELECT COUNT(*) FROM visits WHERE date(visit_date, 'localtime') = date('now', 'localtime')) as visits_today,
      (SELECT COUNT(*) FROM admissions WHERE status = 'Admitted') as currently_admitted,
      (SELECT COUNT(*) FROM admissions WHERE status = 'Discharged' AND strftime('%Y-%m', discharge_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime')) as discharged_this_month
  `, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// Expenses & Salaries Report
app.get('/api/reports/expenses', validateRequest({ query: RequiredReportQuerySchema }), (req, res) => {
  const { start_date, end_date, limit, offset } = req.sanitizedQuery;
  
  db.all(`
    SELECT * FROM expenses 
    WHERE date(date) BETWEEN ? AND ?
    ORDER BY date DESC LIMIT ? OFFSET ?
  `, [start_date, end_date, limit, offset], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reports/expenses/summary', (req, res) => {
  db.get(`
    SELECT 
      SUM(CASE WHEN category != 'Salary' THEN amount ELSE 0 END) as total_expenses,
      SUM(CASE WHEN category = 'Salary' THEN amount ELSE 0 END) as total_salaries,
      COUNT(*) as entry_count
    FROM expenses 
    WHERE strftime('%Y-%m', date, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
  `, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || { total_expenses: 0, total_salaries: 0, entry_count: 0 });
  });
});

// Audit Log Report
app.get('/api/reports/audit', (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;
  db.all(`
    SELECT * FROM audit_logs 
    WHERE date(created_at) BETWEEN ? AND ?
    ORDER BY created_at DESC
  `, [start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reports/audit/summary', (req, res) => {
  db.get(`
    SELECT 
      (SELECT COUNT(*) FROM audit_logs WHERE date(created_at, 'localtime') = date('now', 'localtime')) as today_count,
      (SELECT COUNT(*) FROM audit_logs WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')) as month_count,
      (SELECT COUNT(DISTINCT user_name) FROM audit_logs WHERE date(created_at, 'localtime') = date('now', 'localtime')) as active_users,
      (SELECT COUNT(*) FROM audit_logs WHERE 
        action_type IN ('Billing Void', 'Stock Adjustment', 'Backup Restore', 'User Deletion', 'Password Reset')
        OR status = 'Critical'
      ) as flagged_count
  `, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || { today_count: 0, month_count: 0, active_users: 0, flagged_count: 0 });
  });
});

// Seed data if empty
db.serialize(() => {
  db.get('SELECT COUNT(*) as count FROM expenses', [], (err, row: any) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO expenses (category, description, amount, recorded_by, notes) VALUES 
        ('Salary', 'Staff Salary - April 2024', 2500000, 'Admin', 'Monthly payroll'),
        ('Utility', 'PHCN Electricity Bill', 45000, 'Accountant', 'March consumption'),
        ('Medical', 'Oxygen Cylinder Refills', 120000, 'Store Manager', 'Emergency stock'),
        ('Admin', 'Internet Subscription', 25000, 'Admin', 'Fiber monthly')`);
    }
  });
  
  db.get('SELECT COUNT(*) as count FROM audit_logs', [], (err, row: any) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO audit_logs (user_name, user_role, action_type, module, details, ip_address) VALUES 
        ('System Administrator', 'Admin', 'LOGIN', 'Auth', 'Successful login from secure IP', '192.168.1.1'),
        ('Dr. Sarah', 'Optometrist', 'PATIENT_EDIT', 'Records', 'Updated clinical history for 0012/26/LEH', '192.168.1.45'),
        ('Nurse Joy', 'Nurse', 'TRIAGE', 'Nursing', 'Recorded vitals for new patient', '192.168.1.22')`);
    }
  });
});

// Inventory Aging/Expiry Report
app.get('/api/reports/expiry', (req, res) => {
  db.all(`
    SELECT * FROM inventory 
    WHERE expiry_date IS NOT NULL 
    AND expiry_date != ''
    ORDER BY expiry_date ASC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Low Stock Report
app.get('/api/reports/low-stock', (req, res) => {
  db.all('SELECT * FROM inventory WHERE stock <= reorder_level', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Procurement Report (Itemized)
app.get('/api/reports/procurement', (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;
  const sql = `
    SELECT p.*, s.name as supplier_name
    FROM procurement p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE date(p.purchase_date) BETWEEN ? AND ?
    ORDER BY p.purchase_date DESC, p.id DESC
  `;
  db.all(sql, [start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Procurement Summary Stats
app.get('/api/reports/procurement/summary', (req, res) => {
  db.get(`
    SELECT 
      (SELECT SUM(total_amount) FROM purchase_orders WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')) as total_this_month,
      (SELECT SUM(balance) FROM suppliers) as total_payables,
      (SELECT COUNT(*) FROM suppliers) as total_suppliers,
      (SELECT COUNT(*) FROM purchase_orders WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')) as pos_this_month
  `, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// Profit & Loss Summary (Detailed)
app.get('/api/reports/profit-loss', (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;

  db.serialize(() => {
    // 1. Revenue
    db.get(`
      SELECT
        SUM(amount_paid) as revenue,
        SUM(total_amount) as billed,
        SUM(discount) as total_discounts
      FROM transactions
      WHERE date(created_at) BETWEEN ? AND ?
        AND status IN ('Paid', 'Partial', 'Unpaid')
    `, [start_date, end_date], (err, revRow: any) => {
      if (err) return res.status(500).json({ error: err.message });

      // 2. Cost of Goods Sold (from transaction items x inventory cost price)
      db.get(`
        SELECT SUM(ti.qty * COALESCE(i.cost_price, 0)) as cogs
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        LEFT JOIN inventory i ON ti.inventory_id = i.id
        WHERE date(t.created_at) BETWEEN ? AND ?
          AND i.category NOT IN ('Test', 'Service', 'Registration')
      `, [start_date, end_date], (err2, cogsRow: any) => {
        if (err2) return res.status(500).json({ error: err2.message });

        // 3. Procurement costs in period
        db.get(`
          SELECT SUM(total_cost) as procurement_cost
          FROM procurement
          WHERE date(purchase_date) BETWEEN ? AND ?
        `, [start_date, end_date], (err3, procRow: any) => {
          if (err3) return res.status(500).json({ error: err3.message });

          // 4. Real overhead expenses (non-salary)
          db.get(`
            SELECT SUM(amount) as total_overhead
            FROM expenses
            WHERE date(date) BETWEEN ? AND ?
              AND (expense_type != 'Salary' OR expense_type IS NULL)
              AND category != 'Salary'
          `, [start_date, end_date], (err4, ovRow: any) => {
            if (err4) return res.status(500).json({ error: err4.message });

            // 5. Salary/payroll expenses in period
            db.get(`
              SELECT SUM(amount) as total_salaries
              FROM expenses
              WHERE date(date) BETWEEN ? AND ?
                AND (expense_type = 'Salary' OR category = 'Salary')
            `, [start_date, end_date], (err5, salRow: any) => {
              if (err5) return res.status(500).json({ error: err5.message });

              // 6. Tax accruals in period (PAYE + WHT)
              db.get(`
                SELECT
                  SUM(CASE WHEN tax_type='PAYE' THEN tax_amount ELSE 0 END) as paye_accrued,
                  SUM(CASE WHEN tax_type='WHT' THEN tax_amount ELSE 0 END) as wht_accrued,
                  SUM(CASE WHEN tax_type='NHF' THEN tax_amount ELSE 0 END) as nhf_accrued,
                  SUM(CASE WHEN tax_type LIKE 'PENSION%' THEN tax_amount ELSE 0 END) as pension_accrued
                FROM tax_records
                WHERE period BETWEEN substr(?,1,7) AND substr(?,1,7)
              `, [start_date, end_date], (err6, taxRow: any) => {
                if (err6) return res.status(500).json({ error: err6.message });

                // 7. Expense breakdown by category
                db.all(`
                  SELECT category, expense_type, SUM(amount) as total
                  FROM expenses
                  WHERE date(date) BETWEEN ? AND ?
                  GROUP BY category, expense_type
                  ORDER BY total DESC
                `, [start_date, end_date], (err7, expBreak: any[]) => {
                  if (err7) return res.status(500).json({ error: err7.message });

                  // 8. Detailed transaction-level rows
                  db.all(`
                    SELECT date(t.created_at) as date, i.category, i.name as description,
                           (ti.qty * ti.unit_price) as revenue,
                           (ti.qty * COALESCE(i.cost_price, 0)) as cost,
                           ((ti.qty * ti.unit_price) - (ti.qty * COALESCE(i.cost_price, 0))) as gross_profit
                    FROM transaction_items ti
                    JOIN transactions t ON ti.transaction_id = t.id
                    LEFT JOIN inventory i ON ti.inventory_id = i.id
                    WHERE date(t.created_at) BETWEEN ? AND ?
                    ORDER BY t.created_at DESC
                    LIMIT 500
                  `, [start_date, end_date], (err8, details) => {
                    if (err8) return res.status(500).json({ error: err8.message });

                    const revenue = revRow?.revenue || 0;
                    const cogs = cogsRow?.cogs || 0;
                    const procurement_cost = procRow?.procurement_cost || 0;
                    const total_overhead = ovRow?.total_overhead || 0;
                    const total_salaries = salRow?.total_salaries || 0;
                    const paye_accrued = taxRow?.paye_accrued || 0;
                    const wht_accrued = taxRow?.wht_accrued || 0;
                    const nhf_accrued = taxRow?.nhf_accrued || 0;
                    const pension_accrued = taxRow?.pension_accrued || 0;
                    const gross_profit = revenue - cogs;
                    const total_expenses = total_overhead + total_salaries;
                    const net_profit = gross_profit - total_expenses;

                    res.json({
                      summary: {
                        revenue,
                        billed: revRow?.billed || 0,
                        total_discounts: revRow?.total_discounts || 0,
                        cogs,
                        procurement_cost,
                        gross_profit,
                        gross_margin_pct: revenue > 0 ? Math.round((gross_profit / revenue) * 1000) / 10 : 0,
                        total_overhead,
                        total_salaries,
                        total_expenses,
                        paye_accrued,
                        wht_accrued,
                        nhf_accrued,
                        pension_accrued,
                        net_profit,
                        net_margin_pct: revenue > 0 ? Math.round((net_profit / revenue) * 1000) / 10 : 0,
                        // Legacy compat field
                        expenses: total_expenses,
                        procurement: procurement_cost,
                      },
                      details: details || [],
                      expenses_breakdown: expBreak || [],
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});


// P&L Monthly Trend (rolling 12 months)
app.get('/api/reports/profit-loss/monthly-trend', authorizeRoles(['Admin']), (req, res) => {
  const { months } = req.sanitizedQuery;
  const numMonths = Math.min(Math.max(parseInt(months as string) || 12, 3), 24);

  db.all(`
    WITH RECURSIVE months(m) AS (
      SELECT strftime('%Y-%m', date('now', 'localtime', '-${numMonths - 1} months'))
      UNION ALL
      SELECT strftime('%Y-%m', m || '-01', '+1 month')
      FROM months WHERE m < strftime('%Y-%m', date('now', 'localtime'))
    )
    SELECT
      m.m AS period,
      COALESCE(rev.revenue, 0) AS revenue,
      COALESCE(cogs.cogs, 0) AS cogs,
      COALESCE(oh.overhead, 0) AS overhead,
      COALESCE(sal.salaries, 0) AS salaries,
      COALESCE(proc.procurement, 0) AS procurement_cost,
      COALESCE(rev.revenue, 0) - COALESCE(cogs.cogs, 0) AS gross_profit,
      COALESCE(rev.revenue, 0) - COALESCE(cogs.cogs, 0) - COALESCE(oh.overhead, 0) - COALESCE(sal.salaries, 0) AS net_profit
    FROM months m
    LEFT JOIN (
      SELECT strftime('%Y-%m', created_at, 'localtime') as period, SUM(amount_paid) as revenue
      FROM transactions WHERE status IN ('Paid','Partial','Unpaid')
      GROUP BY 1
    ) rev ON rev.period = m.m
    LEFT JOIN (
      SELECT strftime('%Y-%m', t.created_at, 'localtime') as period,
             SUM(ti.qty * COALESCE(i.cost_price, 0)) as cogs
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      LEFT JOIN inventory i ON ti.inventory_id = i.id
      WHERE i.category NOT IN ('Test','Service','Registration')
      GROUP BY 1
    ) cogs ON cogs.period = m.m
    LEFT JOIN (
      SELECT strftime('%Y-%m', date, 'localtime') as period, SUM(amount) as overhead
      FROM expenses
      WHERE expense_type != 'Salary' AND category != 'Salary'
      GROUP BY 1
    ) oh ON oh.period = m.m
    LEFT JOIN (
      SELECT strftime('%Y-%m', date, 'localtime') as period, SUM(amount) as salaries
      FROM expenses
      WHERE expense_type = 'Salary' OR category = 'Salary'
      GROUP BY 1
    ) sal ON sal.period = m.m
    LEFT JOIN (
      SELECT strftime('%Y-%m', purchase_date, 'localtime') as period, SUM(total_cost) as procurement
      FROM procurement
      GROUP BY 1
    ) proc ON proc.period = m.m
    ORDER BY m.m ASC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Supplier Creditors
app.get('/api/reports/creditors', (req, res) => {
  db.all(`
    SELECT s.name as supplier_name, s.email, SUM(po.total_amount) as total_payable
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.status = 'Pending'
    GROUP BY s.id
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admission & Discharge Report
app.get('/api/reports/admissions', (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;
  db.all(`
    SELECT a.*, p.full_name as patient_name
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    WHERE date(a.admission_date) BETWEEN ? AND ?
    ORDER BY a.admission_date DESC
  `, [start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET discounts & waivers audit report
app.get('/api/reports/discounts', (req, res) => {
  const { start_date, end_date } = req.sanitizedQuery;
  const start = start_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];

  db.all(`
    SELECT 
      t.id, t.receipt_no, t.created_at,
      p.full_name AS patient_name, p.id AS file_no,
      t.total_amount, t.discount, t.amount_paid, t.balance, t.status,
      t.payment_method, t.cashier, t.payment_details,
      ROUND(CASE WHEN t.total_amount > 0 THEN (t.discount * 100.0 / t.total_amount) ELSE 0 END, 1) AS discount_pct
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.discount > 0
      AND date(t.created_at) BETWEEN ? AND ?
    ORDER BY t.created_at DESC
  `, [start, end], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    const enriched = (rows || []).map(row => {
      let pd: any = {};
      try { pd = JSON.parse(row.payment_details || '{}'); } catch {}
      const override = pd.supervisor_override || null;
      return {
        ...row,
        supervisor_username: override?.username || null,
        supervisor_role: override?.role || null,
        discount_reason: override?.discount_reason || null,
        discount_note: override?.discount_note || null,
        override_timestamp: override?.timestamp || null,
        requires_override: !!override
      };
    });
    res.json(enriched);
  });
});

// --- SETTINGS API ---

app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM settings', [], (err, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings: any = {};
    rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  });
});

app.put('/api/settings', (req, res) => {
  const settings = req.sanitizedBody;
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    Object.entries(settings).forEach(([key, value]) => {
      stmt.run(key, String(value));
    });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(null, 'Admin', 'Admin', 'SETTINGS_UPDATE', 'Admin', 'Clinic settings updated', 'Critical');
      res.json({ success: true });
    });
  });
});

// --- BACKUP & RESTORE API ---

app.get('/api/backups', (req, res) => {
  db.all('SELECT * FROM backups ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Manual backup trigger (server-side file creation)
app.post('/api/backups', (req, res) => {
  const { performed_by } = req.sanitizedBody;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(writableRootDir, 'backups_history');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  
  const filename = `backup_${timestamp}.sqlite`;
  const destPath = path.join(backupDir, filename);
  
  fs.copyFile(dbPath, destPath, (err) => {
    const status = err ? 'Failed' : 'Success';
    db.run(
      'INSERT INTO backups (filename, performed_by, status) VALUES (?, ?, ?)',
      [filename, performed_by || 'Admin', status],
      () => {
        if (err) return res.status(500).json({ error: 'Backup failed' });
        logAudit(null, performed_by || 'Admin', 'Admin', 'BACKUP_CREATE', 'Admin', `Manual backup created: ${filename}`, 'Critical');
        res.json({ success: true, filename });
      }
    );
  });
});

// Restore Logic
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, writableRootDir),
  filename: (req, file, cb) => cb(null, 'database_restore.sqlite')
});
const upload = multer({ storage });

app.post('/api/restore', upload.single('backup'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const restorePath = path.join(writableRootDir, 'database_restore.sqlite');
  
  // Close DB connection, replace file, and restart
  db.close((err) => {
    if (err) return res.status(500).json({ error: 'Failed to close DB for restore' });
    
    fs.rename(restorePath, dbPath, (err2) => {
      if (err2) return res.status(500).json({ error: 'Failed to replace DB file' });
      
      // In a real Node app, you might want to restart the process or re-initialize the DB helper
      // For this implementation, we assume the user will restart the server or the next request will fail/re-init
      // We will re-require/re-open the db in our case (though db.js usually opens it immediately)
      process.exit(0); // Simple way to trigger a restart if managed by nodemon/pm2
    });
  });
});

// CRON: Automatic backup daily at midnight
cron.schedule('0 0 * * *', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(writableRootDir, 'backups_history');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const filename = `auto_backup_${timestamp}.sqlite`;
  fs.copyFileSync(dbPath, path.join(backupDir, filename));
  db.run('INSERT INTO backups (filename, performed_by, status) VALUES (?, ?, ?)', [filename, 'SYSTEM', 'Success']);
  console.log(`[CRON] Auto-backup completed: ${filename}`);
});

// CRON: Clean up expired blacklisted tokens every hour
cron.schedule('0 * * * *', () => {
  const nowUnix = Math.floor(Date.now() / 1000);
  db.run('DELETE FROM token_blacklist WHERE expires_at < ?', [nowUnix], (err) => {
    if (err) {
      console.error('[CRON] Blacklist cleanup failed:', err.message);
    } else {
      console.log('[CRON] Expired blacklisted tokens cleaned up successfully.');
    }
  });
});

// --- WARDS MANAGEMENT ---
app.get('/api/wards', (req, res) => {
  db.all('SELECT * FROM wards ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/wards', authorizeRoles(['Admin']), (req, res) => {
  const { name, description } = req.sanitizedBody;
  db.run('INSERT INTO wards (name, description) VALUES (?, ?)', [name, description], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, description });
  });
});

app.put('/api/wards/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { name, description } = req.sanitizedBody;
  db.run('UPDATE wards SET name = ?, description = ? WHERE id = ?', [name, description, id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/wards/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.run('DELETE FROM wards WHERE id = ?', [id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- DISCOUNTS MANAGEMENT ---
app.get('/api/discounts', (req, res) => {
  db.all('SELECT * FROM discounts ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/discounts', authorizeRoles(['Admin']), (req, res) => {
  const { name, value, type, requires_auth } = req.sanitizedBody;
  db.run('INSERT INTO discounts (name, value, type, requires_auth) VALUES (?, ?, ?, ?)', 
    [name, value, type, requires_auth ? 1 : 0], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, value, type, requires_auth });
  });
});

app.put('/api/discounts/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { name, value, type, requires_auth, is_active } = req.sanitizedBody;
  db.run('UPDATE discounts SET name = ?, value = ?, type = ?, requires_auth = ?, is_active = ? WHERE id = ?', 
    [name, value, type, requires_auth ? 1 : 0, is_active ? 1 : 0, id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/discounts/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  db.run('DELETE FROM discounts WHERE id = ?', [id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- INVENTORY CATEGORIES MANAGEMENT ---
app.get('/api/inventory-categories', (req, res) => {
  db.all('SELECT * FROM inventory_categories ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/inventory-categories', authorizeRoles(['Admin']), (req, res) => {
  const { name, description, attribute_template } = req.sanitizedBody;
  db.run('INSERT INTO inventory_categories (name, description, attribute_template) VALUES (?, ?, ?)', [name, description, attribute_template || 'NONE'], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, description, attribute_template: attribute_template || 'NONE' });
  });
});

app.put('/api/inventory-categories/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;
  const { name, description, attribute_template } = req.sanitizedBody;
  
  // First update the associated items in inventory using the old category name via subquery
  db.run(
    'UPDATE inventory SET category = ? WHERE category = (SELECT name FROM inventory_categories WHERE id = ?)',
    [name, id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Then update the category details
      db.run(
        'UPDATE inventory_categories SET name = ?, description = ?, attribute_template = ? WHERE id = ?',
        [name, description, attribute_template || 'NONE', id],
        function(this: any, err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true });
        }
      );
    }
  );
});

app.get('/api/inventory/count', (req, res) => {
  const { category } = req.sanitizedQuery;
  if (!category) return res.status(400).json({ error: 'Category name required' });
  
  db.get('SELECT COUNT(*) as count FROM inventory WHERE category = ?', [category], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row.count || 0 });
  });
});

app.delete('/api/inventory-categories/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.sanitizedParams;

  // Verify category exists
  db.get('SELECT * FROM inventory_categories WHERE id = ?', [id], (err, category: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!category) return res.status(404).json({ error: 'Inventory category not found' });

    // Check if items exist under this category
    // Note: Items are linked by category name in the inventory table
    db.get('SELECT COUNT(*) as count FROM inventory WHERE category = ?', [category.name], (err, row: any) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (row && row.count > 0) {
        return res.status(400).json({ 
          error: `Cannot delete this category. ${row.count} inventory item(s) are currently assigned to it. Reassign or remove those items first before deleting this category.` 
        });
      }

      // Proceed with deletion
      db.run('DELETE FROM inventory_categories WHERE id = ?', [id], function(this: any, err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, message: 'Inventory category deleted successfully' });
      });
    });
  });
});

// --- NOTIFICATIONS API ---
app.get('/api/notifications/stream', (req, res) => {
  const role = req.query.role as string;
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx/IIS proxies
  res.setHeader('x-no-compression', 'true'); // Bypass Express compression buffering
  res.flushHeaders();

  const id = ++sseClientId;
  sseClients.push({ id, role, res });

  // Initial push of current notifications
  db.all(
    'SELECT * FROM notifications WHERE user_role = ? OR user_role = "All" ORDER BY created_at DESC LIMIT 50',
    [role],
    (err, rows) => {
      if (!err && rows) {
        res.write(`data: ${JSON.stringify(rows)}\n\n`);
      }
    }
  );

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== id);
  });
});

app.get('/api/notifications', (req, res) => {
  const { role } = req.sanitizedQuery;
  db.all(
    'SELECT * FROM notifications WHERE user_role = ? OR user_role = "All" ORDER BY created_at DESC LIMIT 50',
    [role],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.sanitizedParams;
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
    broadcastToClients();
  });
});

app.delete('/api/notifications/:id', (req, res) => {
  const { id } = req.sanitizedParams;
  // Get notification message first for audit log before deletion
  db.get('SELECT message FROM notifications WHERE id = ?', [id], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    const message = row ? row.message : `Unknown (ID: ${id})`;

    db.run('DELETE FROM notifications WHERE id = ?', [id], function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
      broadcastToClients();
      logAudit(
        req.user?.id,
        req.user?.username,
        req.user?.role,
        'NOTIFICATION_DISMISS',
        'Notifications',
        `Dismissed alert: "${message}"`,
        'Standard'
      );
    });
  });
});

app.delete('/api/notifications', (req, res) => {
  const { role } = req.sanitizedQuery;
  if (!role) return res.status(400).json({ error: 'Role is required' });
  db.run('DELETE FROM notifications WHERE user_role = ? OR user_role = "All"', [role], function(this: any, err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
    broadcastToClients();
    logAudit(
      req.user?.id,
      req.user?.username,
      req.user?.role,
      'NOTIFICATION_CLEAR_ALL',
      'Notifications',
      `Cleared all notifications for role: ${role}`,
      'Standard'
    );
  });
});

// --- REPRINT MANAGEMENT API ---

// Endpoint 1: Log a reprint
app.post('/api/reprints/log', (req, res) => {
  const { receipt_number, bill_id, patient_id, reprinted_by_user_id } = req.sanitizedBody;
  
  if (!receipt_number || !bill_id || !patient_id || !reprinted_by_user_id) {
    return res.status(400).json({ error: 'Missing required reprint logging data' });
  }

  // Fetch original transaction, patient, and user data for full log entry
  db.get(`
    SELECT 
      t.created_at as original_date, t.total_amount as original_amount,
      COALESCE(p.full_name, 'Walk-in Patient') as patient_name, 
      COALESCE(p.id, t.patient_id) as file_number,
      u.full_name as staff_name, u.role as staff_role
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    JOIN users u ON u.id = ?
    WHERE t.id = ?
  `, [reprinted_by_user_id, bill_id], (err, data: any) => {
    if (err || !data) {
      return res.status(500).json({ error: 'Failed to retrieve original transaction data for logging' });
    }

    const now = new Date();
    const reprint_date = now.toISOString().split('T')[0];
    const reprint_time = now.toTimeString().split(' ')[0];

    db.run(`
      INSERT INTO reprint_logs (
        receipt_number, bill_id, patient_id, patient_name, file_number,
        original_transaction_date, original_amount,
        reprinted_by_user_id, reprinted_by_name, reprinted_by_role,
        reprint_date, reprint_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      receipt_number, bill_id, patient_id, data.patient_name, data.file_number,
      data.original_date, data.original_amount,
      reprinted_by_user_id, data.staff_name, data.staff_role,
      reprint_date, reprint_time
    ], function(this: any, err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      
      const logId = this.lastID;
      
      // Insert into audit_logs
      const auditDetails = `Receipt #${receipt_number} reprinted by ${data.staff_name} (${data.staff_role}) for patient ${data.patient_name}.`;
      logAudit(reprinted_by_user_id, data.staff_name, data.staff_role, 'Receipt Reprint', 'Billing', auditDetails, 'Financial');

      db.get('SELECT * FROM reprint_logs WHERE id = ?', [logId], (err3, row: any) => {
        res.status(201).json(row);
      });
    });
  });
});

// Endpoint 2: Get reprint logs (Admin only)
app.get('/api/reprints', validateRequest({ query: ReprintQuerySchema }), (req, res) => {
  const { from_date, to_date, user_name, search, flagged_only, limit, offset } = req.sanitizedQuery;
  let query = 'SELECT * FROM reprint_logs WHERE 1=1';
  const params: any[] = [];

  if (from_date) { query += ' AND reprint_date >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND reprint_date <= ?'; params.push(to_date); }
  if (user_name) { query += ' AND reprinted_by_name LIKE ?'; params.push(`%${user_name}%`); }
  if (flagged_only) { query += ' AND is_flagged = 1'; }
  if (search) {
    query += ' AND (receipt_number LIKE ? OR patient_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY reprint_timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint 3: Get reprint stats (Admin only)
app.get('/api/reprints/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = today.substring(0, 8) + '01';

  const stats: any = {
    total_reprints_today: 0,
    total_reprints_this_month: 0,
    most_active_reprinter: { name: 'N/A', count: 0 },
    flagged_high_volume_users: 0
  };

  db.serialize(() => {
    // Today's total
    db.get('SELECT COUNT(*) as count FROM reprint_logs WHERE reprint_date = ?', [today], (err, row: any) => {
      if (!err) stats.total_reprints_today = row.count;
    });

    // Month's total
    db.get('SELECT COUNT(*) as count FROM reprint_logs WHERE reprint_date >= ?', [firstDayOfMonth], (err, row: any) => {
      if (!err) stats.total_reprints_this_month = row.count;
    });

    // Most active reprinter
    db.get(`
      SELECT reprinted_by_name as name, COUNT(*) as count 
      FROM reprint_logs 
      GROUP BY reprinted_by_user_id 
      ORDER BY count DESC 
      LIMIT 1
    `, [], (err, row: any) => {
      if (!err && row) stats.most_active_reprinter = row;
    });

    // High volume users (Admin Alert)
    db.get('SELECT daily_reprint_threshold FROM reprint_settings LIMIT 1', [], (err, setting: any) => {
      const threshold = setting ? setting.daily_reprint_threshold : 5;
      db.get(`
        SELECT COUNT(*) as count FROM (
          SELECT reprinted_by_user_id 
          FROM reprint_logs 
          WHERE reprint_date = ? 
          GROUP BY reprinted_by_user_id 
          HAVING COUNT(*) > ?
        )
      `, [today, threshold], (err2, row: any) => {
        if (!err2) stats.flagged_high_volume_users = row.count;
        res.json(stats);
      });
    });
  });
});

// Endpoint 4: Flag or unflag a reprint entry
app.patch('/api/reprints/:id/flag', (req, res) => {
  const { id } = req.sanitizedParams;
  const { is_flagged, flag_reason } = req.sanitizedBody;

  db.run(
    'UPDATE reprint_logs SET is_flagged = ?, flag_reason = ? WHERE id = ?',
    [is_flagged ? 1 : 0, flag_reason || null, id],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM reprint_logs WHERE id = ?', [id], (err2, row: any) => {
        res.json(row);
      });
    }
  );
});

// Endpoint 5: Get reprint restriction status
app.get('/api/reprints/restrictions/:user_id', (req, res) => {
  const { user_id } = req.sanitizedParams;
  db.get(
    'SELECT * FROM reprint_restrictions WHERE user_id = ? AND is_active = 1',
    [user_id],
    (err, row: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ is_restricted: !!row, restriction: row || null });
    }
  );
});

app.get('/api/reprints/restrictions', (req, res) => {
  db.all(`
    SELECT r.*, u.role, u.full_name as user_name
    FROM reprint_restrictions r
    JOIN users u ON r.user_id = u.id
    WHERE r.is_active = 1
    ORDER BY r.restricted_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint 6: Set or lift reprint restriction
app.post('/api/reprints/restrictions', (req, res) => {
  const { user_id, user_name, admin_id, is_active, restriction_reason } = req.sanitizedBody;

  if (is_active) {
    db.run(`
      INSERT INTO reprint_restrictions (user_id, user_name, restricted_by_admin_id, restriction_reason, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [user_id, user_name, admin_id, restriction_reason], function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, success: true });
    });
  } else {
    db.run(`
      UPDATE reprint_restrictions 
      SET is_active = 0, lifted_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND is_active = 1
    `, [user_id], function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  }
});

// Endpoint 7: Get reprint settings
app.get('/api/reprints/settings', (req, res) => {
  db.get('SELECT * FROM reprint_settings LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// Endpoint 8: Update reprint threshold
app.patch('/api/reprints/settings', (req, res) => {
  const { daily_reprint_threshold, updated_by } = req.sanitizedBody;
  db.run(
    'UPDATE reprint_settings SET daily_reprint_threshold = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP',
    [daily_reprint_threshold, updated_by],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM reprint_settings LIMIT 1', [], (err2, row: any) => {
        res.json(row);
      });
    }
  );
});

// Endpoint 8b: Search receipts for reprint
app.get('/api/reprints/search-receipts', (req, res) => {
  const { search, start_date, end_date } = req.sanitizedQuery;
  let query = `
    SELECT t.*, COALESCE(p.full_name, 'Walk-in Patient') as patient_name, p.id as patient_file_id
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ' AND (t.receipt_no LIKE ? OR p.full_name LIKE ? OR t.patient_id LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (start_date && end_date) {
    query += ' AND date(t.created_at) BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }

  query += ' ORDER BY t.created_at DESC LIMIT 100';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint 9: Get receipt data for reprint
app.get('/api/billing/receipts/:receipt_number', (req, res) => {
  const { receipt_number } = req.sanitizedParams;
  
  db.get(`
    SELECT t.*, p.full_name as patient_name, p.dob, p.gender, p.phone as patient_phone, p.address as patient_address
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.receipt_no = ?
  `, [receipt_number], (err, transaction: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transaction) return res.status(404).json({ error: 'Receipt not found' });

    db.all('SELECT * FROM transaction_items WHERE transaction_id = ?', [transaction.id], (err2, items) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      // Get clinic settings for header
      db.all('SELECT * FROM settings', [], (err3, settingsRows: any[]) => {
        const settings: any = {};
        if (!err3) settingsRows.forEach(row => settings[row.key] = row.value);
        
        res.json({
          ...transaction,
          items,
          clinic: {
            name: settings.clinicName || 'Luna Eye Hospital',
            address: settings.clinicAddress || 'Lagos, Nigeria',
            phone: settings.clinicPhone || '0800-LUNA-EYE',
            email: settings.clinicEmail || 'info@lunaeye.com'
          }
        });
      });
    });
  });
});




// --- SERVE FRONTEND ---
let DIST_PATH = path.join(serverRootDir, '..', 'dist');
if (isPackaged) {
  const diskDist = path.join(writableRootDir, 'dist');
  const parentDiskDist = path.join(writableRootDir, '..', 'dist');
  if (fs.existsSync(diskDist)) {
    DIST_PATH = diskDist;
  } else if (fs.existsSync(parentDiskDist)) {
    DIST_PATH = parentDiskDist;
  }
}
console.log(`[SERVER] Serving frontend static assets from: ${DIST_PATH}`);
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get(/^(?!\/api).+/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

// --- MANAGEMENT API ---
app.get('/api/settings/wards', (req, res) => {
  db.all('SELECT * FROM wards', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/settings/wards/:id', (req, res) => {
  const { id } = req.sanitizedParams;
  
  db.get('SELECT name FROM wards WHERE id = ?', [id], (err, ward: any) => {
    if (err || !ward) return res.status(404).json({ error: 'Ward not found' });
    
    db.get('SELECT COUNT(*) as count FROM admissions WHERE ward_name = ? AND status = "Admitted"', [ward.name], (err2, row: any) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (row.count > 0) return res.status(409).json({ error: `Cannot delete. ${row.count} patients are currently admitted in this ward.` });
      
      db.run('DELETE FROM wards WHERE id = ?', [id], function(this: any, err3) {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ success: true });
      });
    });
  });
});

// --- PROCUREMENT API ---

// GET all suppliers
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new supplier
app.post('/api/suppliers', authorizeRoles(['Admin']), (req, res) => {
  const { name, contact_person, phone, email, address } = req.sanitizedBody;
  db.run(
    'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
    [name, contact_person, phone, email, address],
    function(this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, contact_person });
    }
  );
});

// GET all procurement records (Purchase Orders)
app.get('/api/purchase-orders', (req, res) => {
  db.all(`
    SELECT p.*, s.name as supplier_name 
    FROM procurement p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.purchase_date DESC, p.id DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new procurement record
app.post('/api/purchase-orders', authorizeRoles(['Admin']), (req, res) => {
  const { 
    supplier_id, item_name, quantity_received, unit_cost, total_cost, 
    invoice_number, amount_paid, balance, status, purchase_date, received_by, notes 
  } = req.sanitizedBody;

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    db.run(`
      INSERT INTO procurement (
        supplier_id, item_name, quantity_received, unit_cost, total_cost, 
        invoice_number, amount_paid, balance, status, purchase_date, received_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      supplier_id, item_name, quantity_received, unit_cost, total_cost, 
      invoice_number, amount_paid || 0, balance || (total_cost - (amount_paid || 0)), 
      status || 'Unpaid', purchase_date, received_by, notes
    ], function(this: any, err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      // Update inventory stock
      db.run(
        'UPDATE inventory SET stock = stock + ? WHERE name = ?',
        [quantity_received, item_name],
        (err2: any) => {
          if (err2) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err2.message });
          }
          db.run('COMMIT', () => {
            res.status(201).json({ id: this.lastID, success: true });
          });
        }
      );
    });
  });
});

// GET procurement stats
app.get('/api/procurement-stats', (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const queries = {
    total_procured: "SELECT SUM(total_cost) as total FROM procurement WHERE purchase_date LIKE ?",
    total_payables: "SELECT SUM(balance) as total FROM procurement WHERE status IN ('Partial', 'Unpaid')",
    total_suppliers: "SELECT COUNT(*) as count FROM suppliers",
    po_this_month: "SELECT COUNT(*) as count FROM procurement WHERE purchase_date LIKE ?"
  };

  Promise.all([
    new Promise(resolve => db.get(queries.total_procured, [`${currentMonth}%`], (err, row: any) => resolve(row?.total || 0))),
    new Promise(resolve => db.get(queries.total_payables, [], (err, row: any) => resolve(row?.total || 0))),
    new Promise(resolve => db.get(queries.total_suppliers, [], (err, row: any) => resolve(row?.count || 0))),
    new Promise(resolve => db.get(queries.po_this_month, [`${currentMonth}%`], (err, row: any) => resolve(row?.count || 0)))
  ]).then(([procured, payables, suppliersCount, poCount]) => {
    res.json({
      total_procured: procured,
      total_payables: payables,
      total_suppliers: suppliersCount,
      po_this_month: poCount
    });
  }).catch(err => res.status(500).json({ error: err.message }));
});

// Seed sample data if empty
db.get('SELECT COUNT(*) as count FROM suppliers', (err, row: any) => {
  if (row && row.count === 0) {
    db.run("INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ('MedDirect Pharm', 'John Doe', '08012345678', 'sales@meddirect.com', '12 Medical Way, Lagos')");
    db.run("INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ('Vision Optics Ltd', 'Sarah Smith', '08098765432', 'info@visionoptics.com', '45 Lens Street, Abuja')");
  }
});

db.get('SELECT COUNT(*) as count FROM procurement', (err, row: any) => {
  if (row && row.count === 0) {
    const today = new Date().toISOString().split('T')[0];
    db.run(`INSERT INTO procurement (supplier_id, item_name, quantity_received, unit_cost, total_cost, invoice_number, amount_paid, balance, status, purchase_date, received_by) 
            VALUES (1, 'Paracetamol 500mg', 100, 50, 5000, 'INV-001', 5000, 0, 'Paid', ?, 'Admin')`, [today]);
    db.run(`INSERT INTO procurement (supplier_id, item_name, quantity_received, unit_cost, total_cost, invoice_number, amount_paid, balance, status, purchase_date, received_by) 
            VALUES (2, 'Blue Frame TR90', 20, 2500, 50000, 'INV-002', 20000, 30000, 'Partial', ?, 'Admin')`, [today]);
  }
});

// ── Start server ──
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`--------------------------------------------------`);
  console.log(`Luna Eye Hospital Server: ACTIVE`);
  console.log(`Port: ${PORT}`);
  console.log(`Available IPs:`);
  ALL_IPS.forEach(ip => console.log(`  - ${ip.name}: http://${ip.address}/`));
  console.log(`Domain: http://${DOMAIN_NAME}/`);
  console.log(`--------------------------------------------------`);

  // Start nightly voice audio cleanup cron
  try {
    startAudioCleanupJob();
  } catch (cronErr) {
    console.error('[CRON] Failed to start audio cleanup job:', cronErr);
  }

  // EDI Clearinghouse Bridge — auto-dispatch batches every 30 minutes
  try {
    cron.schedule('*/30 * * * *', async () => {
      try {
        await sweepAndDispatchReadyBatches();
      } catch (ediErr: any) {
        console.error('[EDI CRON] Sweep error:', ediErr.message);
      }
    });
    console.log('[EDI CRON] Auto-dispatch scheduler started (every 30 minutes)');
  } catch (cronErr) {
    console.error('[CRON] Failed to start EDI dispatch job:', cronErr);
  }

  // Start EDI asynchronous transmission queue worker
  try {
    startQueueWorker();
  } catch (queueErr) {
    console.error('[EDI QUEUE] Failed to start queue worker:', queueErr);
  }

  // Attach real-time Voice Dictation WebSocket server
  try {
    setupVoiceWebSocket(server);
  } catch (wsErr) {
    console.error('[VOICE WS] Failed to initialize WebSocket server:', wsErr);
  }

  // Ensure local faster-whisper microservice is running
  const startWhisperService = () => {
    let venvPython = path.join(writableRootDir, 'whisper_service', '.venv', 'Scripts', 'python.exe');
    let whisperScript = path.join(writableRootDir, 'whisper_service', 'whisper_service.py');
    if (!fs.existsSync(venvPython)) {
      const altVenv = path.join(writableRootDir, '..', 'server', 'whisper_service', '.venv', 'Scripts', 'python.exe');
      const altScript = path.join(writableRootDir, '..', 'server', 'whisper_service', 'whisper_service.py');
      if (fs.existsSync(altVenv)) {
        venvPython = altVenv;
        whisperScript = altScript;
      }
    }
    if (fs.existsSync(venvPython) && fs.existsSync(whisperScript)) {
      fetch('http://127.0.0.1:8765/health')
        .then(() => console.log('[WHISPER] Local faster-whisper service is online at http://127.0.0.1:8765'))
        .catch(() => {
          console.log('[WHISPER] Spawning local faster-whisper background microservice...');
          const pyProc = spawn(venvPython, [whisperScript], {
            cwd: path.dirname(whisperScript),
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          });
          pyProc.unref();
          console.log('[WHISPER] faster-whisper service process started.');
        });
    }
  };
  startWhisperService();
});

// ── 404 catch-all (must be after all routes) ──
app.use((req, res) => {
  console.log(`[404] NOT FOUND: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// ── Global error handler (must be last, 4 args) ──
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── Graceful shutdown ──
const shutdown = (signal) => {
  console.log(`\n[SHUTDOWN] ${signal} received — draining connections…`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed.');
    db.close((err) => {
      if (err) console.error('[SHUTDOWN] DB close error:', err);
      else console.log('[SHUTDOWN] Database connection closed cleanly.');
      process.exit(0);
    });
  });
  // Force exit after 10 s if drain takes too long
  setTimeout(() => {
    console.error('[SHUTDOWN] Force exit after timeout.');
    process.exit(1);
  }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
