process.env.UV_THREADPOOL_SIZE = 64; // Scale up Node's internal thread pool for SQLite & bcrypt concurrency
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const dgram = require('dgram');
const os = require('os');
const cron = require('node-cron');
const db = require('./db');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PatientStatus } = require('./constants');

const app = express();
const PORT = process.env.PORT || 80; // Changed default to 80 for LAN accessibility
const JWT_SECRET = process.env.JWT_SECRET || 'luna_eye_hospital_secret_key_2026';

// --- AUDIT LOG HELPER ---
const logAudit = (user_id, user_name, user_role, action_type, module, details, status = 'Standard', ip_address = '127.0.0.1') => {
  db.run(
    'INSERT INTO audit_logs (user_id, user_name, user_role, action_type, module, details, status, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id, user_name, user_role, action_type, module, details, status, ip_address],
    (err) => { if (err) console.error('Audit Log Error:', err); }
  );
};

const notify = (user_role, message, module) => {
  db.run(
    'INSERT INTO notifications (user_role, message, module) VALUES (?, ?, ?)',
    [user_role, message, module],
    (err) => { if (err) console.error('Notification Error:', err); }
  );
};

// Database file path
const dbPath = path.resolve(__dirname, 'luna_eye_hospital.db');

// ── SQLITE_BUSY retry helper ──
// Wraps db.run with exponential backoff retries on SQLITE_BUSY / SQLITE_LOCKED
const BUSY_MAX_RETRIES = 4;
const dbRun = (sql, params = [], retries = 0) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err && (err.code === 'SQLITE_BUSY' || err.code === 'SQLITE_LOCKED') && retries < BUSY_MAX_RETRIES) {
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
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile, curl)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ── Rate limiters ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  skip: (req) => req.path !== '/api/login' && req.path !== '/login',
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// ── Request timeout middleware (15 s) ──
const requestTimeout = (req, res, next) => {
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

// ── Apply global middleware ──
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled — app serves its own SPA assets
app.use(compression()); // gzip all responses
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' })); // limit request body size
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(requestTimeout);
app.use(loginLimiter);
app.use('/api', apiLimiter);

// ── Request logger ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[REQ] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const authenticateToken = (req, res, next) => {
  // Handle both absolute and relative paths (for when used in a Router)
  const openRoutes = ['/api/login', '/api/status', '/login', '/status'];
  const path = req.path;
  
  if (openRoutes.includes(path)) return next();
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error(`[AUTH] Token error for ${path}: ${err.message}`);
      return res.status(401).json({ error: 'Token invalid or expired' });
    }
    req.user = user;
    next();
  });
};

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
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

const apiRouter = express.Router();
apiRouter.use(authenticateToken);
app.use('/api', apiRouter);

// --- LAN DOMAIN RESOLVER (NBNS/DNS) ---
// This allows other computers on the LAN to find this server by typing 'lunaeyehospital'

const DOMAIN_NAME = process.env.DOMAIN_NAME || 'lunaeyehospital';

function getAllLanIps() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
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

nbnsServer.on('error', (err) => {
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

dnsServer.on('error', (err) => {
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
    
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Could not query database tables' });
      
      try {
        const tableStats = [];
        for (const row of rows) {
          const countResult = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM "${row.name}"`, [], (err, result) => {
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
  db.all('SELECT id, username, full_name, role, IFNULL(department, \'General\') as department, status FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new user
app.post('/api/users', authorizeRoles(['Admin']), (req, res) => {
  const { username, password, full_name, role, department } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'username, password, full_name, and role are required' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (username, password, full_name, role, department, status) VALUES (?, ?, ?, ?, ?, ?)',
    [username, hashedPassword, full_name, role, department || 'General', 'Active'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: `Username "${username}" already exists. Please choose a different username.` });
        }
        return res.status(500).json({ error: err.message });
      }
      logAudit(req.user.id, req.user.username, req.user.role, 'USER_CREATE', 'Users', `Created new user: ${username} (${role})`, 'Critical');
      res.status(201).json({ id: this.lastID, username, full_name, role, department: department || 'General', status: 'Active' });
    }
  );
});

// PUT update user (role, status, password reset, department)
app.put('/api/users/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.params;
  const { role, status, password, full_name, department } = req.body;
  
  let updates = [];
  let params = [];
  
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
    if (err) return res.status(500).json({ error: err.message });
    logAudit(null, 'Admin', 'Admin', 'USER_UPDATE', 'Users', `Updated user ID ${id}: ${updates.join(', ')}`, 'Critical');
    res.json({ success: true });
  });
});

// DELETE deactivate user
app.delete('/api/users/:id', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.params;
  db.run("UPDATE users SET status = 'Inactive' WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req.user?.id, req.user?.username, req.user?.role, 'USER_DEACTIVATE', 'Users', `Deactivated user ID ${id}`, 'Critical');
    res.json({ success: true });
  });
});

// --- PROFILE API ---

// GET current user profile
app.get('/api/profile/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT id, username, full_name, role, phone_number, created_at FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// PUT update profile (name and phone)
app.put('/api/profile/:id', (req, res) => {
  const { id } = req.params;
  const { full_name, phone_number } = req.body;
  
  db.run(
    'UPDATE users SET full_name = ?, phone_number = ? WHERE id = ?',
    [full_name, phone_number, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(id, null, 'User', 'PROFILE_UPDATE', 'Profile', `Updated profile for user ID ${id}`, 'Standard');
      res.json({ success: true });
    }
  );
});

// POST change password
app.post('/api/change-password', (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  
  db.get('SELECT password FROM users WHERE id = ?', [user_id], (err, user) => {
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

app.get('/api/audit-logs', authorizeRoles(['Admin']), (req, res) => {
  const { user_id, action_type, start_date, end_date } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  let params = [];
  
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (action_type) { query += ' AND action_type = ?'; params.push(action_type); }
  if (start_date && end_date) {
    query += ' AND date(created_at) BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// Basic API routes

// POST login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
        logAudit(null, username, 'Guest', 'LOGIN_FAILED', 'Auth', `Login attempt for non-existent user: ${username}`);
        return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const isMatch = password === user.password || bcrypt.compareSync(password, user.password);
    
    if (!isMatch) {
        logAudit(null, username, 'Guest', 'LOGIN_FAILED', 'Auth', `Failed login attempt for user: ${username}`);
        return res.status(401).json({ error: 'Invalid username or password' });
    }
      
    logAudit(user.id, user.username, user.role, 'LOGIN', 'Auth', `User ${user.username} logged in.`);
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name }, 
      JWT_SECRET, 
      { expiresIn: '12h' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        full_name: user.full_name,
        phone_number: user.phone_number,
        created_at: user.created_at
      } 
    });
  });
});

// GET active status
app.get('/api/status', (req, res) => {
  res.json({ status: 'active', version: '1.0.0', hospital: 'Luna Eye Hospital' });
});

// GET all patients - with today's visit status if available
app.get('/api/patients', (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  const sql = `
    SELECT p.*, v.status as current_status, v.id as current_visit_id
    FROM patients p
    LEFT JOIN visits v ON p.id = v.patient_id 
      AND date(v.visit_date, 'localtime') = date('now', 'localtime')
    GROUP BY p.id
    ORDER BY p.created_at DESC 
    LIMIT ${limit}
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST new patient
app.post('/api/patients', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  console.log('REGISTRATION_ATTEMPT:', JSON.stringify(req.body));
  const { 
    full_name, gender, dob, phone, alternate_phone, address, 
    occupation, next_of_kin, next_of_kin_phone, marital_status, 
    blood_group, genotype, allergies, medical_alerts, 
    payment_category, department 
  } = req.body;
  
  // Check for duplicates
  db.get('SELECT * FROM patients WHERE full_name = ? AND (phone = ? OR dob = ?)', [full_name, phone, dob], (err, duplicate) => {
    if (err) return res.status(500).json({ error: err.message });
    if (duplicate) {
      return res.status(409).json({ 
        error: 'Duplicate patient detected', 
        message: `A patient named ${full_name} with similar details already exists (ID: ${duplicate.id}).` 
      });
    }

    // Generate ID: 0001/26/LETH
    const currentYear = new Date().getFullYear().toString().slice(-2);
    db.get("SELECT id FROM patients WHERE id LIKE ? ORDER BY id DESC LIMIT 1", [`%/${currentYear}/LETH`], (err, lastPatient) => {
      if (err) return res.status(500).json({ error: err.message });
      
      let nextNumber = 1;
      if (lastPatient) {
        const lastIdParts = lastPatient.id.split('/');
        nextNumber = parseInt(lastIdParts[0]) + 1;
      }
      
      const paddedCount = String(nextNumber).padStart(4, '0');
      const id = `${paddedCount}/${currentYear}/LETH`;
      console.log(`Generating Patient ID: ${id} (Previous: ${lastPatient ? lastPatient.id : 'None'})`);
      
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION');
        
        const stmt = db.prepare(`
          INSERT INTO patients (
            id, full_name, gender, dob, phone, alternate_phone, address, 
            occupation, next_of_kin, next_of_kin_phone, marital_status, 
            blood_group, genotype, allergies, medical_alerts, payment_category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          id, full_name, gender, dob, phone, alternate_phone, address, 
          occupation, next_of_kin, next_of_kin_phone, marital_status, 
          blood_group, genotype, allergies, medical_alerts, payment_category, 
          function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          
          // Automatically add to today's visit queue
          db.run('INSERT INTO visits (patient_id, status, department) VALUES (?, ?, ?)', [id, PatientStatus.REGISTERED, department || 'General'], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            db.run('COMMIT', () => {
              logAudit(req.user?.id, req.user?.username, req.user?.role, 'PATIENT_CREATE', 'Patients', `Registered new patient: ${full_name} (ID: ${id})`);
              notify('Admin', `New patient registered: ${full_name}`, 'Patients');
              notify('Receptionist', `New patient registered: ${full_name}`, 'Patients');
              res.status(201).json({ id, full_name, gender, dob, phone, created_at: new Date() });
            });
          });
        });
        stmt.finalize();
      });
    });
  });
});

// PUT update patient
app.put('/api/patients/:id', (req, res) => {
  const { id } = req.params;
  const { 
    full_name, gender, dob, phone, alternate_phone, address, 
    occupation, next_of_kin, next_of_kin_phone, marital_status, 
    blood_group, genotype, allergies, medical_alerts, payment_category 
  } = req.body;
  
  const stmt = db.prepare(`
    UPDATE patients 
    SET full_name = ?, gender = ?, dob = ?, phone = ?, alternate_phone = ?, address = ?, 
        occupation = ?, next_of_kin = ?, next_of_kin_phone = ?, marital_status = ?, 
        blood_group = ?, genotype = ?, allergies = ?, medical_alerts = ?, payment_category = ?
    WHERE id = ?
  `);
  
  stmt.run(
    full_name, gender, dob, phone, alternate_phone, address, 
    occupation, next_of_kin, next_of_kin_phone, marital_status, 
    blood_group, genotype, allergies, medical_alerts, payment_category, id, 
    function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json({ success: true, id });
  });
  stmt.finalize();
});

// POST check-in — routes existing today's visit to a target queue status
app.post('/api/check-in', authorizeRoles(['Admin', 'Receptionist', 'Nurse']), (req, res) => {
  const { patient_id, target, user_name } = req.body;
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
    (err, visit) => {
      if (err) return res.status(500).json({ error: err.message });

      const processCheckIn = (visitId, patientData) => {
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
        db.get('SELECT full_name, id as patient_file_no FROM patients WHERE id = ?', [patient_id], (errP, p) => {
          if (errP || !p) return res.status(404).json({ error: 'Patient not found' });
          
          db.run(
            'INSERT INTO visits (patient_id, status, department) VALUES (?, ?, ?)',
            [patient_id, newStatus, 'General'],
            function(err3) {
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
app.put('/api/visits/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, performed_by, reason } = req.body;
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    // 1. Update visits table
    db.run('UPDATE visits SET status = ? WHERE id = ?', [status, id], function(err) {
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
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const stats = {
      awaiting_payment: rows.filter(r => r.status === PatientStatus.AWAITING_BILLING),
      waiting: rows.filter(r => r.status === PatientStatus.REGISTERED || r.status === PatientStatus.WAITING_FOR_TRIAGE || r.status === PatientStatus.PAID),
      consulting: rows.filter(r => r.status === PatientStatus.IN_CONSULTATION),
      waiting_for_consultation: rows.filter(r => r.status === PatientStatus.WAITING_FOR_CONSULTATION || r.status === PatientStatus.TRIAGE_COMPLETE),
      admitted: rows.filter(r => r.status === PatientStatus.ADMITTED),
      total_today: rows.length
    };
    
    res.json(stats);
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
  `, [PatientStatus.AWAITING_BILLING, PatientStatus.PAID], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const mapped = rows.map(r => ({ ...r, has_paid: r.payment_count > 0 }));
    res.json(mapped);
  });
});

// GET triage record for a specific visit
app.get('/api/triage/visit/:visitId', (req, res) => {
  const { visitId } = req.params;
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
  const { patientId } = req.params;
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
  } = req.body;

  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');

    db.get('SELECT id FROM triage WHERE visit_id = ?', [visit_id], (err, existing) => {
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

        db.run(updateSql, updateParams, function(err2) {
          if (err2) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err2.message });
          }

          // 2. Clear from triage_queue (remove entirely from active triage list)
          db.run('DELETE FROM triage_queue WHERE visit_id = ? OR (patient_id = ? AND date(checkin_at) = date("now"))', [visit_id, patient_id]);

          // 3. Populate consultation_queue (Use INSERT OR REPLACE to avoid duplicates)
          db.get('SELECT full_name, id as file_no FROM patients WHERE id = ?', [patient_id], (errP, p) => {
            const patientName = p ? p.full_name : 'Unknown';
            const fileNo = p ? p.file_no : patient_id;
            
            db.run(`
              INSERT OR REPLACE INTO consultation_queue (patient_id, patient_name, file_number, visit_id, status, checkin_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [patient_id, patientName, fileNo, visit_id, targetStatus, triaged_by]);

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
          function(err3) {
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
          function(err4) {
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
  const { visitId } = req.params;
  const { status, performed_by, reason } = req.body;
  
  db.get('SELECT * FROM visits WHERE id = ?', [visitId], (err, visit) => {
    if (err || !visit) return res.status(404).json({ error: 'Visit not found' });
    
    db.run('UPDATE visits SET status = ? WHERE id = ?', [status, visitId], function(err2) {
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

// GET all transactions
app.get('/api/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  db.all(`
    SELECT t.*, p.full_name as patient_name 
    FROM transactions t 
    LEFT JOIN patients p ON t.patient_id = p.id 
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// POST new transaction
app.post('/api/transactions', authorizeRoles(['Admin', 'Receptionist']), (req, res) => {
  const { 
    patient_id, visit_id, amount_paid, discount, 
    payment_method, payment_details, cashier, items 
  } = req.body;
  
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items to bill' });
  
  // Recompute total and validate financial inputs
  const total_amount = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
  const final_discount = parseFloat(discount) || 0;
  const final_paid = parseFloat(amount_paid) || 0;
  const balance = total_amount - final_discount - final_paid;
  const status = balance <= 0 ? 'Paid' : (final_paid > 0 ? 'Partial' : 'Unpaid');
  
  // Generate Receipt No securely
  const receipt_no = `REC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    const sql = `
      INSERT INTO transactions (
        receipt_no, patient_id, visit_id, total_amount, amount_paid, 
        balance, discount, payment_method, payment_details, 
        cashier, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [
      receipt_no, patient_id, visit_id || null, total_amount, final_paid, 
      balance, final_discount, payment_method, 
      JSON.stringify(payment_details || {}), 
      cashier, status
    ], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      const transactionId = this.lastID;
      
      const itemStmt = db.prepare('INSERT INTO transaction_items (transaction_id, inventory_id, description, qty, unit_price) VALUES (?, ?, ?, ?, ?)');
      const invStmt = db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?');
      
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
            invStmt.run(item.qty, invId, item.qty, function(err2) {
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
            // Update visit status if fully paid (Status is 'Paid')
            if (visit_id && status === 'Paid') {
              const vId = parseInt(visit_id);
              // Check current status to decide next step
              db.get('SELECT status FROM visits WHERE id = ?', [vId], (errV, v) => {
                let nextStatus = PatientStatus.WAITING_FOR_TRIAGE;
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
                    logAudit(null, cashier, 'Staff', 'BILLING_CREATE', 'Billing', `New transaction ${receipt_no} for patient ID ${patient_id}. Total: ${total_amount}`);
                    res.status(201).json({ receipt_no, transactionId, patient_id, total_amount, amount_paid: final_paid, balance, status });
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
                logAudit(null, cashier, 'Staff', 'BILLING_CREATE', 'Billing', `New transaction ${receipt_no} for patient ID ${patient_id}. Total: ${total_amount}`);
                res.status(201).json({ receipt_no, transactionId, patient_id, total_amount, amount_paid: final_paid, balance, status });
              });
            }
          }
        }
      }
    });
  });
});

// GET inventory items
app.get('/api/inventory', (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM inventory';
  let params = [];
  
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
  const { name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attributes } = req.body;
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
    db.run(sql, [id, name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attrString], function(err) {
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
  const { id } = req.params;
  const { name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attributes } = req.body;
  
  const attrString = attributes ? (typeof attributes === 'string' ? attributes : JSON.stringify(attributes)) : null;
  
  const sql = `
    UPDATE inventory 
    SET name = ?, category = ?, stock = ?, reorder_level = ?, price = ?, 
        cost_price = ?, expiry_date = ?, supplier = ?, batch_number = ?, attributes = ?
    WHERE id = ?
  `;
  
  db.run(sql, [name, category, stock, reorder_level, price, cost_price, expiry_date, supplier, batch_number, attrString, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Inventory item updated successfully', item: { id, name, category, stock, reorder_level, price, attributes } });
  });
});

// PUT update inventory stock (Deduct/Add/Adjust)
app.put('/api/inventory/:id/stock', authorizeRoles(['Admin']), (req, res) => {
  const { id } = req.params;
  const { quantity_change, reason, type, performed_by, reference_id } = req.body; 
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    // Check if resulting stock goes below 0
    db.get('SELECT stock FROM inventory WHERE id = ?', [id], (err, row) => {
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

      db.run('UPDATE inventory SET stock = stock + ? WHERE id = ?', [quantity_change, id], function(err) {
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
            db.get('SELECT name, stock, reorder_level, expiry_date FROM inventory WHERE id = ?', [id], (err3, item) => {
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
  const { id } = req.params;
  db.all('SELECT * FROM stock_movements WHERE item_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// DELETE inventory item with dependency check
app.delete('/api/inventory/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT COUNT(*) as count FROM transaction_items WHERE inventory_id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row.count > 0) {
      return res.status(409).json({ error: `Cannot delete item. It is referenced in ${row.count} past transactions.` });
    }
    
    db.run('DELETE FROM inventory WHERE id = ?', [id], function(err2) {
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
  const { patient_id } = req.query;
  let query = 'SELECT * FROM consultations ORDER BY created_at DESC';
  let params = [];
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
  const data = req.body;

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
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Advance visit status
      const clinicalData = data.clinical_data || {};
      const isFinalized = data.finalize || data.finalized;
      let newStatus = isFinalized ? PatientStatus.CONSULTATION_COMPLETE : PatientStatus.IN_CONSULTATION;
      
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

      db.run(updateSql, updateParams, function(err2) {
        if (err2) console.error("Status update error:", err2);
        
        // Handle Automatic Admission Enlistment
        const clinicalData = data.clinical_data || {};
        if (clinicalData.admission_advised) {
          console.log(`[ADMISSION_AUTO] Creating admission request for patient ${data.patient_id}`);
          
          // Check if already requested to avoid duplicates
          db.get('SELECT id FROM admissions WHERE visit_id = ? OR (patient_id = ? AND status = "Admitted")', 
            [data.visit_id || -1, data.patient_id], (err3, existing) => {
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
  const { patient_id, status, billing_status } = req.query;
  let query = `
    SELECT i.*, p.full_name as patient_name,
           (SELECT name FROM inventory WHERE id = i.inventory_id) as inventory_name,
           (SELECT price FROM inventory WHERE id = i.inventory_id) as price
    FROM investigations i
    JOIN patients p ON i.patient_id = p.id
    WHERE 1=1
  `;
  let params = [];
  
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
app.post('/api/investigations', (req, res) => {
  const { patient_id, test_name, requested_by, inventory_id, unit, reference_range } = req.body;
  const stmt = db.prepare('INSERT INTO investigations (patient_id, test_name, requested_by, inventory_id, unit, reference_range) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(patient_id, test_name, requested_by, inventory_id || null, unit || null, reference_range || null, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, patient_id, test_name, status: 'Pending', billing_status: 'Unpaid', requested_by });
  });
  stmt.finalize();
});

// PUT update investigation results
app.put('/api/investigations/:id', (req, res) => {
  const { id } = req.params;
  const { results_notes, status, test_value, medical_comments, billing_status } = req.body;
  
  const updates = [];
  const params = [];
  
  if (results_notes !== undefined) { updates.push('results_notes = ?'); params.push(results_notes); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (test_value !== undefined) { updates.push('test_value = ?'); params.push(test_value); }
  if (medical_comments !== undefined) { updates.push('medical_comments = ?'); params.push(medical_comments); }
  if (billing_status !== undefined) { updates.push('billing_status = ?'); params.push(billing_status); }
  
  if (status === 'Completed' || status === 'Reviewed') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }

  if (updates.length === 0) return res.json({ success: true, id });

  params.push(id);
  db.run(`UPDATE investigations SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Investigation not found' });
    
    if (status === 'Completed') {
      db.get('SELECT test_name, patient_id FROM investigations WHERE id = ?', [id], (err2, inv) => {
        if (inv) {
          notify('Optometrist', `New investigation result: ${inv.test_name} for Patient ${inv.patient_id}`, 'Results');
        }
      });
    }

    res.json({ success: true, id });
  });
});

// GET admissions
app.get('/api/admissions', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT a.*, p.full_name as patient_name
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    WHERE 1=1
  `;
  let params = [];
  
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
app.post('/api/admissions', (req, res) => {
  const { patient_id, ward_name, bed_number, admitting_doctor, reason, notes } = req.body;
  console.log(`[ADMISSION] Attempting to admit patient ${patient_id} to ${ward_name}`);
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    const stmt = db.prepare('INSERT INTO admissions (patient_id, ward_name, bed_number, admitting_doctor, reason, notes) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(patient_id, ward_name, bed_number, admitting_doctor, reason, notes, function(err) {
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
app.put('/api/admissions/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  if (status === 'Discharged') {
    db.run(`
      UPDATE admissions 
      SET status = ?, notes = ?, discharge_date = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, notes, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Also update visits table status
      db.get('SELECT patient_id FROM admissions WHERE id = ?', [id], (err2, adm) => {
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
    `, [notes, id], function(err) {
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
app.post('/api/suppliers', (req, res) => {
  const { name, contact_person, phone, email, address, created_by } = req.body;
  const sql = 'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [name, contact_person, phone, email, address], function(err) {
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

// POST new purchase order
app.post('/api/purchase-orders', (req, res) => {
  const { supplier_id, items } = req.body;
  const po_number = `PO-${Date.now()}`;
  const total_amount = items.reduce((sum, i) => sum + (i.qty * i.unit_cost), 0);
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    db.run('INSERT INTO purchase_orders (po_number, supplier_id, total_amount, status) VALUES (?, ?, ?, ?)', 
      [po_number, supplier_id, total_amount, 'Draft'], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      const poId = this.lastID;
      const stmt = db.prepare('INSERT INTO purchase_order_items (po_id, inventory_id, description, qty, unit_cost) VALUES (?, ?, ?, ?, ?)');
      items.forEach(item => {
        stmt.run(poId, item.inventory_id || null, item.description, item.qty, item.unit_cost);
      });
      stmt.finalize();
      
      db.run('COMMIT', () => {
        res.status(201).json({ id: poId, po_number, total_amount });
      });
    });
  });
});

// POST receive goods for PO
app.post('/api/purchase-orders/:id/receive', (req, res) => {
  const poId = req.params.id;
  const { received_items } = req.body; // Array of { item_id (po_item_id), inventory_id, qty_received, cost_price }

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
    `, [poId], (err, row) => {
      const newStatus = row.total_received >= row.total_ordered ? 'Received' : 'Partial';
      db.run('UPDATE purchase_orders SET status = ? WHERE id = ?', [newStatus, poId]);
      
      // Update supplier balance
      db.get('SELECT supplier_id, total_amount FROM purchase_orders WHERE id = ?', [poId], (err2, poRow) => {
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
  db.get(`
    SELECT 
      (SELECT SUM(total_amount) FROM purchase_orders) as total_procured,
      (SELECT SUM(balance) FROM suppliers) as total_payables
  `, [], (err, row) => {
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
    let results = {};
    db.get(queries.todaySales, [], (err, row) => {
      results.todaySales = row?.total || 0;
      db.get(queries.monthSales, [], (err, row) => {
        results.monthSales = row?.total || 0;
        db.get(queries.monthTransactions, [], (err, row) => {
          results.monthTransactions = row?.count || 0;
          db.get(queries.outstandingDebts, [], (err, row) => {
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
  const { id } = req.params;
  db.all(`
    SELECT * FROM transaction_items WHERE transaction_id = ?
  `, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reports/sales', (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  
  db.all(`
    SELECT t.*, p.full_name as patient_name, p.id as file_no, t.cashier as cashier_name,
           (SELECT GROUP_CONCAT(description, ', ') FROM transaction_items WHERE transaction_id = t.id) as items_summary
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE date(t.created_at) BETWEEN ? AND ?
    ORDER BY t.created_at DESC
  `, [start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Patient Debtors Report (Detailed)
app.get('/api/reports/debtors/details', (req, res) => {
  const sql = `
    SELECT t.id as transaction_id, p.id as file_no, p.full_name as patient_name, p.phone, 
           date(t.created_at) as visit_date, t.total_amount, t.amount_paid, t.discount,
           (t.total_amount - t.amount_paid - t.discount) as balance_due,
           CAST((julianday('now') - julianday(t.created_at)) AS INTEGER) as days_outstanding
    FROM transactions t
    JOIN patients p ON t.patient_id = p.id
    WHERE (t.total_amount - t.amount_paid - t.discount) > 0
    ORDER BY days_outstanding DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PATCH record payment against debt
app.patch('/api/transactions/:id/payment', (req, res) => {
  const { id } = req.params;
  const { amount_paid, payment_method, cashier } = req.body;
  
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');
    
    db.get('SELECT total_amount, discount, amount_paid, patient_id, receipt_no FROM transactions WHERE id = ?', [id], (err, row) => {
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
          logAudit(null, cashier || 'Admin', 'Admin', 'BILLING_PAYMENT', 'Billing', `Recorded additional payment of ₦${additional_payment.toLocaleString()} for ${row.receipt_no}. New balance: ₦${new_balance.toLocaleString()}`, 'Financial');
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
      (SELECT (total_amount - amount_paid - discount) || ' - ' || p.full_name 
       FROM transactions t2 JOIN patients p ON t2.patient_id = p.id 
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
  const { start_date, end_date } = req.query;
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
app.get('/api/reports/expenses', (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  
  db.all(`
    SELECT * FROM expenses 
    WHERE date(date) BETWEEN ? AND ?
    ORDER BY date DESC
  `, [start_date, end_date], (err, rows) => {
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
  const { start_date, end_date } = req.query;
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
  db.get('SELECT COUNT(*) as count FROM expenses', [], (err, row) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO expenses (category, description, amount, recorded_by, notes) VALUES 
        ('Salary', 'Staff Salary - April 2024', 2500000, 'Admin', 'Monthly payroll'),
        ('Utility', 'PHCN Electricity Bill', 45000, 'Accountant', 'March consumption'),
        ('Medical', 'Oxygen Cylinder Refills', 120000, 'Store Manager', 'Emergency stock'),
        ('Admin', 'Internet Subscription', 25000, 'Admin', 'Fiber monthly')`);
    }
  });
  
  db.get('SELECT COUNT(*) as count FROM audit_logs', [], (err, row) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO audit_logs (user_name, user_role, action_type, module, details, ip_address) VALUES 
        ('System Administrator', 'Admin', 'LOGIN', 'Auth', 'Successful login from secure IP', '192.168.1.1'),
        ('Dr. Sarah', 'Optometrist', 'PATIENT_EDIT', 'Records', 'Updated clinical history for 0012/26/LETH', '192.168.1.45'),
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
  const { start_date, end_date } = req.query;
  const sql = `
    SELECT poi.*, po.po_number as invoice_no, date(po.created_at) as date, 
           s.name as supplier_name, po.status as po_status,
           po.total_amount, po.amount_paid, (po.total_amount - po.amount_paid) as balance
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.po_id = po.id
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE date(po.created_at) BETWEEN ? AND ?
    ORDER BY date DESC
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
  const { start_date, end_date } = req.query;
  
  db.serialize(() => {
    // 1. Get Summary Stats
    db.get(`
      SELECT 
        (SELECT SUM(amount_paid) FROM transactions WHERE date(created_at) BETWEEN ? AND ?) as revenue,
        (SELECT SUM(total_amount) FROM purchase_orders WHERE status = 'Received' AND date(created_at) BETWEEN ? AND ?) as procurement_cost
    `, [start_date, end_date, start_date, end_date], (err, summary) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 2. Get Detailed Rows
      db.all(`
        SELECT date(t.created_at) as date, i.category, i.name as description, 
               (ti.qty * ti.unit_price) as revenue, (ti.qty * IFNULL(i.cost_price, 0)) as cost,
               ((ti.qty * ti.unit_price) - (ti.qty * IFNULL(i.cost_price, 0))) as gross_profit
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        LEFT JOIN inventory i ON ti.inventory_id = i.id
        WHERE date(t.created_at) BETWEEN ? AND ?
        ORDER BY t.created_at DESC
      `, [start_date, end_date], (err2, details) => {
        if (err2) return res.status(500).json({ error: err2.message });
        
        res.json({
          summary: {
            revenue: summary.revenue || 0,
            procurement: summary.procurement_cost || 0,
            expenses: (summary.procurement_cost || 0) * 0.2 // Placeholder for overheads (20% of procurement)
          },
          details: details || []
        });
      });
    });
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
  const { start_date, end_date } = req.query;
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

// --- SETTINGS API ---

app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  });
});

app.put('/api/settings', (req, res) => {
  const settings = req.body;
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
  const { performed_by } = req.body;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups_history');
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
  destination: (req, file, cb) => cb(null, __dirname),
  filename: (req, file, cb) => cb(null, 'database_restore.sqlite')
});
const upload = multer({ storage });

app.post('/api/restore', upload.single('backup'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const restorePath = path.join(__dirname, 'database_restore.sqlite');
  
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
  const backupDir = path.join(__dirname, 'backups_history');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const filename = `auto_backup_${timestamp}.sqlite`;
  fs.copyFileSync(dbPath, path.join(backupDir, filename));
  db.run('INSERT INTO backups (filename, performed_by, status) VALUES (?, ?, ?)', [filename, 'SYSTEM', 'Success']);
  console.log(`[CRON] Auto-backup completed: ${filename}`);
});

// --- WARDS MANAGEMENT ---
app.get('/api/wards', (req, res) => {
  db.all('SELECT * FROM wards ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/wards', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO wards (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, description });
  });
});

app.put('/api/wards/:id', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  db.run('UPDATE wards SET name = ?, description = ? WHERE id = ?', [name, description, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/wards/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM wards WHERE id = ?', [id], function(err) {
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

app.post('/api/discounts', (req, res) => {
  const { name, value, type, requires_auth } = req.body;
  db.run('INSERT INTO discounts (name, value, type, requires_auth) VALUES (?, ?, ?, ?)', 
    [name, value, type, requires_auth ? 1 : 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, value, type, requires_auth });
  });
});

app.put('/api/discounts/:id', (req, res) => {
  const { id } = req.params;
  const { name, value, type, requires_auth, is_active } = req.body;
  db.run('UPDATE discounts SET name = ?, value = ?, type = ?, requires_auth = ?, is_active = ? WHERE id = ?', 
    [name, value, type, requires_auth ? 1 : 0, is_active ? 1 : 0, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/discounts/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM discounts WHERE id = ?', [id], function(err) {
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

app.post('/api/inventory-categories', (req, res) => {
  const { name, description, attribute_template } = req.body;
  db.run('INSERT INTO inventory_categories (name, description, attribute_template) VALUES (?, ?, ?)', [name, description, attribute_template || 'NONE'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, description, attribute_template: attribute_template || 'NONE' });
  });
});

app.put('/api/inventory-categories/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, attribute_template } = req.body;
  db.run('UPDATE inventory_categories SET name = ?, description = ?, attribute_template = ? WHERE id = ?', [name, description, attribute_template || 'NONE', id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/inventory/count', (req, res) => {
  const { category } = req.query;
  if (!category) return res.status(400).json({ error: 'Category name required' });
  
  db.get('SELECT COUNT(*) as count FROM inventory WHERE category = ?', [category], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row.count || 0 });
  });
});

app.delete('/api/inventory-categories/:id', (req, res) => {
  const { id } = req.params;

  // Verify category exists
  db.get('SELECT * FROM inventory_categories WHERE id = ?', [id], (err, category) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!category) return res.status(404).json({ error: 'Inventory category not found' });

    // Check if items exist under this category
    // Note: Items are linked by category name in the inventory table
    db.get('SELECT COUNT(*) as count FROM inventory WHERE category = ?', [category.name], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (row && row.count > 0) {
        return res.status(400).json({ 
          error: `Cannot delete this category. ${row.count} inventory item(s) are currently assigned to it. Reassign or remove those items first before deleting this category.` 
        });
      }

      // Proceed with deletion
      db.run('DELETE FROM inventory_categories WHERE id = ?', [id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, message: 'Inventory category deleted successfully' });
      });
    });
  });
});

// --- NOTIFICATIONS API ---
app.get('/api/notifications', (req, res) => {
  const { role } = req.query;
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
  const { id } = req.params;
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- REPRINT MANAGEMENT API ---

// Endpoint 1: Log a reprint
app.post('/api/reprints/log', (req, res) => {
  const { receipt_number, bill_id, patient_id, reprinted_by_user_id } = req.body;
  
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
  `, [reprinted_by_user_id, bill_id], (err, data) => {
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
    ], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      
      const logId = this.lastID;
      
      // Insert into audit_logs
      const auditDetails = `Receipt #${receipt_number} reprinted by ${data.staff_name} (${data.staff_role}) for patient ${data.patient_name}.`;
      logAudit(reprinted_by_user_id, data.staff_name, data.staff_role, 'Receipt Reprint', 'Billing', auditDetails, 'Financial');

      db.get('SELECT * FROM reprint_logs WHERE id = ?', [logId], (err3, row) => {
        res.status(201).json(row);
      });
    });
  });
});

// Endpoint 2: Get reprint logs (Admin only)
app.get('/api/reprints', (req, res) => {
  const { from_date, to_date, user_name, search, flagged_only } = req.query;
  let query = 'SELECT * FROM reprint_logs WHERE 1=1';
  const params = [];

  if (from_date) { query += ' AND reprint_date >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND reprint_date <= ?'; params.push(to_date); }
  if (user_name) { query += ' AND reprinted_by_name LIKE ?'; params.push(`%${user_name}%`); }
  if (flagged_only === 'true' || flagged_only === true) { query += ' AND is_flagged = 1'; }
  if (search) {
    query += ' AND (receipt_number LIKE ? OR patient_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY reprint_timestamp DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint 3: Get reprint stats (Admin only)
app.get('/api/reprints/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = today.substring(0, 8) + '01';

  const stats = {
    total_reprints_today: 0,
    total_reprints_this_month: 0,
    most_active_reprinter: { name: 'N/A', count: 0 },
    flagged_high_volume_users: 0
  };

  db.serialize(() => {
    // Today's total
    db.get('SELECT COUNT(*) as count FROM reprint_logs WHERE reprint_date = ?', [today], (err, row) => {
      if (!err) stats.total_reprints_today = row.count;
    });

    // Month's total
    db.get('SELECT COUNT(*) as count FROM reprint_logs WHERE reprint_date >= ?', [firstDayOfMonth], (err, row) => {
      if (!err) stats.total_reprints_this_month = row.count;
    });

    // Most active reprinter
    db.get(`
      SELECT reprinted_by_name as name, COUNT(*) as count 
      FROM reprint_logs 
      GROUP BY reprinted_by_user_id 
      ORDER BY count DESC 
      LIMIT 1
    `, [], (err, row) => {
      if (!err && row) stats.most_active_reprinter = row;
    });

    // High volume users (Admin Alert)
    db.get('SELECT daily_reprint_threshold FROM reprint_settings LIMIT 1', [], (err, setting) => {
      const threshold = setting ? setting.daily_reprint_threshold : 5;
      db.get(`
        SELECT COUNT(*) as count FROM (
          SELECT reprinted_by_user_id 
          FROM reprint_logs 
          WHERE reprint_date = ? 
          GROUP BY reprinted_by_user_id 
          HAVING COUNT(*) > ?
        )
      `, [today, threshold], (err2, row) => {
        if (!err2) stats.flagged_high_volume_users = row.count;
        res.json(stats);
      });
    });
  });
});

// Endpoint 4: Flag or unflag a reprint entry
app.patch('/api/reprints/:id/flag', (req, res) => {
  const { id } = req.params;
  const { is_flagged, flag_reason } = req.body;

  db.run(
    'UPDATE reprint_logs SET is_flagged = ?, flag_reason = ? WHERE id = ?',
    [is_flagged ? 1 : 0, flag_reason || null, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM reprint_logs WHERE id = ?', [id], (err2, row) => {
        res.json(row);
      });
    }
  );
});

// Endpoint 5: Get reprint restriction status
app.get('/api/reprints/restrictions/:user_id', (req, res) => {
  const { user_id } = req.params;
  db.get(
    'SELECT * FROM reprint_restrictions WHERE user_id = ? AND is_active = 1',
    [user_id],
    (err, row) => {
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
  const { user_id, user_name, admin_id, is_active, restriction_reason } = req.body;

  if (is_active) {
    db.run(`
      INSERT INTO reprint_restrictions (user_id, user_name, restricted_by_admin_id, restriction_reason, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [user_id, user_name, admin_id, restriction_reason], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, success: true });
    });
  } else {
    db.run(`
      UPDATE reprint_restrictions 
      SET is_active = 0, lifted_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND is_active = 1
    `, [user_id], function(err) {
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
  const { daily_reprint_threshold, updated_by } = req.body;
  db.run(
    'UPDATE reprint_settings SET daily_reprint_threshold = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP',
    [daily_reprint_threshold, updated_by],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM reprint_settings LIMIT 1', [], (err2, row) => {
        res.json(row);
      });
    }
  );
});

// Endpoint 8b: Search receipts for reprint
app.get('/api/reprints/search-receipts', (req, res) => {
  const { search, start_date, end_date } = req.query;
  let query = `
    SELECT t.*, COALESCE(p.full_name, 'Walk-in Patient') as patient_name, p.id as patient_file_id
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];

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
  const { receipt_number } = req.params;
  
  db.get(`
    SELECT t.*, p.full_name as patient_name, p.dob, p.gender, p.phone as patient_phone, p.address as patient_address
    FROM transactions t
    LEFT JOIN patients p ON t.patient_id = p.id
    WHERE t.receipt_no = ?
  `, [receipt_number], (err, transaction) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transaction) return res.status(404).json({ error: 'Receipt not found' });

    db.all('SELECT * FROM transaction_items WHERE transaction_id = ?', [transaction.id], (err2, items) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      // Get clinic settings for header
      db.all('SELECT * FROM settings', [], (err3, settingsRows) => {
        const settings = {};
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
const DIST_PATH = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get(/^(?!\/api).+/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
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
  const { id } = req.params;
  
  db.get('SELECT name FROM wards WHERE id = ?', [id], (err, ward) => {
    if (err || !ward) return res.status(404).json({ error: 'Ward not found' });
    
    db.get('SELECT COUNT(*) as count FROM admissions WHERE ward_name = ? AND status = "Admitted"', [ward.name], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (row.count > 0) return res.status(409).json({ error: `Cannot delete. ${row.count} patients are currently admitted in this ward.` });
      
      db.run('DELETE FROM wards WHERE id = ?', [id], function(err3) {
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
app.post('/api/suppliers', (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;
  db.run(
    'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
    [name, contact_person, phone, email, address],
    function(err) {
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
app.post('/api/purchase-orders', (req, res) => {
  const { 
    supplier_id, item_name, quantity_received, unit_cost, total_cost, 
    invoice_number, amount_paid, balance, status, purchase_date, received_by, notes 
  } = req.body;

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
    ], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      // Update inventory stock
      db.run(
        'UPDATE inventory SET stock = stock + ? WHERE name = ?',
        [quantity_received, item_name],
        (err2) => {
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
    new Promise(resolve => db.get(queries.total_procured, [`${currentMonth}%`], (err, row) => resolve(row?.total || 0))),
    new Promise(resolve => db.get(queries.total_payables, [], (err, row) => resolve(row?.total || 0))),
    new Promise(resolve => db.get(queries.total_suppliers, [], (err, row) => resolve(row?.count || 0))),
    new Promise(resolve => db.get(queries.po_this_month, [`${currentMonth}%`], (err, row) => resolve(row?.count || 0)))
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
db.get('SELECT COUNT(*) as count FROM suppliers', (err, row) => {
  if (row && row.count === 0) {
    db.run("INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ('MedDirect Pharm', 'John Doe', '08012345678', 'sales@meddirect.com', '12 Medical Way, Lagos')");
    db.run("INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ('Vision Optics Ltd', 'Sarah Smith', '08098765432', 'info@visionoptics.com', '45 Lens Street, Abuja')");
  }
});

db.get('SELECT COUNT(*) as count FROM procurement', (err, row) => {
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
