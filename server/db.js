const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (creates a new file if it doesn't exist)
const dbPath = path.resolve(__dirname, 'luna_eye_hospital.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    // Create required tables
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        role TEXT,
        department TEXT
      )`);

      // Patients table
      db.run(`CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY, -- Format: 0001/26/LEH
        full_name TEXT,
        gender TEXT,
        dob TEXT,
        phone TEXT,
        alternate_phone TEXT,
        address TEXT,
        occupation TEXT,
        next_of_kin TEXT,
        next_of_kin_phone TEXT,
        marital_status TEXT,
        blood_group TEXT,
        genotype TEXT,
        allergies TEXT,
        medical_alerts TEXT,
        payment_category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Visits table
      db.run(`CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT, -- Waiting, In Consultation, Admitted, Discharged
        department TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )`);

      // Inventory table
      db.run(`CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT, -- Drugs, Lenses, Frames, Consumables
        stock INTEGER,
        reorder_level INTEGER,
        price REAL,
        cost_price REAL,
        supplier TEXT,
        batch_number TEXT,
        expiry_date TEXT
      )`);

      // Stock Movements table
      db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT,
        type TEXT,
        quantity INTEGER,
        reason TEXT,
        performed_by TEXT,
        reference_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(item_id) REFERENCES inventory(id)
      )`);

      // Transactions table for Billing
      db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_no TEXT UNIQUE,
        patient_id TEXT,
        visit_id INTEGER,
        total_amount REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        payment_method TEXT,
        payment_details TEXT, -- JSON
        cashier TEXT, -- Cashier name
        status TEXT, -- Paid, Unpaid, Partial, Voided
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )`);

      // Transaction items table
      db.run(`CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER,
        inventory_id TEXT,
        description TEXT,
        qty INTEGER,
        unit_price REAL,
        FOREIGN KEY(transaction_id) REFERENCES transactions(id),
        FOREIGN KEY(inventory_id) REFERENCES inventory(id)
      )`);

      // Triage table - standalone vitals recorded by Nurse before consultation
      db.run(`CREATE TABLE IF NOT EXISTS triage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        visit_id INTEGER,
        bp_systolic TEXT,
        bp_diastolic TEXT,
        pulse_rate TEXT,
        temperature TEXT,
        weight TEXT,
        va_od_unaided TEXT,
        va_od_aided TEXT,
        va_od_pinhole TEXT,
        va_od_near_unaided TEXT,
        va_od_near_aided TEXT,
        va_os_unaided TEXT,
        va_os_aided TEXT,
        va_os_pinhole TEXT,
        va_os_near_unaided TEXT,
        va_os_near_aided TEXT,
        iop_od TEXT,
        iop_os TEXT,
        iop_method TEXT,
        complaint TEXT,
        triaged_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )`);

      // Consultations table
      db.run(`CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        visit_id INTEGER,
        consultant_name TEXT,
        bp TEXT,
        complaint TEXT,
        va_od_unaided TEXT, va_od_pinhole TEXT, va_od_near TEXT,
        va_os_unaided TEXT, va_os_pinhole TEXT, va_os_near TEXT,
        iop_od TEXT, iop_os TEXT,
        ref_od_sph TEXT, ref_od_cyl TEXT, ref_od_axis TEXT,
        ref_os_sph TEXT, ref_os_cyl TEXT, ref_os_axis TEXT,
        anterior_segment TEXT,
        pupils_dilated INTEGER,
        dilation_agent TEXT,
        posterior_segment TEXT,
        primary_diagnosis TEXT,
        diagnosis_notes TEXT,
        additional_notes TEXT,
        management_plan TEXT,
        clinical_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS triage_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        patient_name TEXT,
        file_number TEXT,
        visit_id INTEGER,
        status TEXT,
        checkin_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checkin_by TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )`);

      // Consultation Queue table - for tracking patients waiting to see a doctor
      db.run(`CREATE TABLE IF NOT EXISTS consultation_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        patient_name TEXT,
        file_number TEXT,
        visit_id INTEGER,
        status TEXT,
        checkin_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checkin_by TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )`);

      // Investigations/Results table
      db.run(`CREATE TABLE IF NOT EXISTS investigations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        test_name TEXT,
        status TEXT DEFAULT 'Pending', -- Pending, Completed
        results_notes TEXT,
        requested_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )`);

      // Admissions table
      db.run(`CREATE TABLE IF NOT EXISTS admissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        visit_id INTEGER,
        ward_name TEXT,
        bed_number TEXT,
        admitting_doctor TEXT,
        reason TEXT,
        status TEXT DEFAULT 'Admitted', -- Admitted, Discharged
        notes TEXT,
        admission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        discharge_date DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )`);

      // Suppliers table
      db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Purchase Orders table
      db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE,
        supplier_id INTEGER,
        total_amount REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        status TEXT DEFAULT 'Draft', -- Draft, Partial, Received, Paid
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
      )`);

      // Purchase Order Items table
      db.run(`CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER,
        inventory_id TEXT,
        description TEXT,
        qty INTEGER,
        unit_cost REAL,
        received_qty INTEGER DEFAULT 0,
        FOREIGN KEY(po_id) REFERENCES purchase_orders(id)
      )`);

      // New Management Tables
      db.run(`CREATE TABLE IF NOT EXISTS wards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        value REAL,
        type TEXT, -- fixed, percentage
        requires_auth INTEGER DEFAULT 0, -- 0 for no, 1 for yes
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inventory_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Expenses table
      db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        category TEXT, -- Salary, Utility, Medical, Admin, Other
        description TEXT,
        amount REAL,
        recorded_by TEXT,
        notes TEXT
      )`);

      // Audit Logs table
      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        user_name TEXT,
        user_role TEXT,
        action_type TEXT,
        module TEXT,
        details TEXT,
        status TEXT, -- Critical, Standard, Financial
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Procurement table (flat records for reporting)
      db.run(`CREATE TABLE IF NOT EXISTS procurement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        item_name TEXT,
        quantity_received INTEGER,
        unit_cost REAL,
        total_cost REAL,
        invoice_number TEXT,
        amount_paid REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        status TEXT, -- Paid, Partial, Unpaid
        purchase_date TEXT,
        received_by TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
      )`);

      // Notifications table
      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_role TEXT, -- Role intended for (Admin, Optometrist, etc.)
        message TEXT,
        module TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // --- REPRINT MANAGEMENT TABLES ---
      
      // Reprint Logs table
      db.run(`CREATE TABLE IF NOT EXISTS reprint_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        bill_id INTEGER, -- Refers to transactions.id
        patient_id TEXT, -- Refers to patients.id
        patient_name TEXT,
        file_number TEXT,
        original_transaction_date DATETIME,
        original_amount REAL,
        reprinted_by_user_id INTEGER,
        reprinted_by_name TEXT,
        reprinted_by_role TEXT,
        reprint_date DATE,
        reprint_time TIME,
        reprint_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_flagged INTEGER DEFAULT 0,
        flag_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bill_id) REFERENCES transactions(id),
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(reprinted_by_user_id) REFERENCES users(id)
      )`);

      // Reprint Restrictions table
      db.run(`CREATE TABLE IF NOT EXISTS reprint_restrictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        restricted_by_admin_id INTEGER,
        restricted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        restriction_reason TEXT,
        is_active INTEGER DEFAULT 1,
        lifted_at DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(restricted_by_admin_id) REFERENCES users(id)
      )`);

      // Reprint Settings table
      db.run(`CREATE TABLE IF NOT EXISTS reprint_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_reprint_threshold INTEGER DEFAULT 5,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(updated_by) REFERENCES users(id)
      )`);

      // Initialize default reprint settings
      db.get('SELECT COUNT(*) as count FROM reprint_settings', (err, row) => {
        if (!err && row.count === 0) {
          db.run('INSERT INTO reprint_settings (daily_reprint_threshold) VALUES (5)');
          console.log('Default reprint settings initialized.');
        }
      });

      // Insert default Admin user if none exists
      db.get('SELECT * FROM users WHERE role = "Admin"', (err, row) => {
        if (!row) {
          const stmt = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
          // Password should be hashed in production, but leaving plain for MVP/demo simplicity
          stmt.run('admin', 'admin', 'System Administrator', 'Admin');
          stmt.finalize();
          console.log('Default admin user created.');
        }
      });

      // Migration: Add phone_number and created_at to users if they don't exist
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) return;
        const hasPhone = columns.some(c => c.name === 'phone_number');
        const hasCreatedAt = columns.some(c => c.name === 'created_at');
        
        if (!hasPhone) {
          db.run("ALTER TABLE users ADD COLUMN phone_number TEXT");
        }
        if (!hasCreatedAt) {
          db.run("ALTER TABLE users ADD COLUMN created_at DATETIME");
        }
        const hasDepartment = columns.some(c => c.name === 'department');
        const hasStatus = columns.some(c => c.name === 'status');
        if (!hasDepartment) {
          db.run("ALTER TABLE users ADD COLUMN department TEXT DEFAULT 'General'");
          console.log("Migration: Added 'department' column to users table.");
        }
        if (!hasStatus) {
          db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'");
          console.log("Migration: Added 'status' column to users table.");
        }
      });

      // Migration for purchase_orders (adding missing columns)
      db.all("PRAGMA table_info(purchase_orders)", (err, columns) => {
        if (err) return;
        if (!columns.some(c => c.name === 'amount_paid')) {
          db.run("ALTER TABLE purchase_orders ADD COLUMN amount_paid REAL DEFAULT 0");
        }
        if (!columns.some(c => c.name === 'balance')) {
          db.run("ALTER TABLE purchase_orders ADD COLUMN balance REAL DEFAULT 0");
        }
      });

      // Migration for visits (adding department column)
      db.all("PRAGMA table_info(visits)", (err, columns) => {
        if (err || !columns) return;
        if (!columns.some(c => c.name === 'department')) {
          db.run("ALTER TABLE visits ADD COLUMN department TEXT DEFAULT 'General'");
          console.log("Migration: Added 'department' column to visits table.");
        }
      });

      // Migrations for missing schema columns
      db.all("PRAGMA table_info(inventory)", (err, cols) => {
        if (!err && cols) {
          if (!cols.some(c => c.name === 'cost_price')) db.run("ALTER TABLE inventory ADD COLUMN cost_price REAL");
          if (!cols.some(c => c.name === 'supplier')) db.run("ALTER TABLE inventory ADD COLUMN supplier TEXT");
          if (!cols.some(c => c.name === 'batch_number')) db.run("ALTER TABLE inventory ADD COLUMN batch_number TEXT");
        }
      });

      db.all("PRAGMA table_info(transaction_items)", (err, cols) => {
        if (!err && cols && !cols.some(c => c.name === 'inventory_id')) {
          db.run("ALTER TABLE transaction_items ADD COLUMN inventory_id TEXT");
        }
      });

      db.all("PRAGMA table_info(consultations)", (err, cols) => {
        if (!err && cols) {
          if (!cols.some(c => c.name === 'visit_id')) db.run("ALTER TABLE consultations ADD COLUMN visit_id INTEGER");
          if (!cols.some(c => c.name === 'consultant_name')) db.run("ALTER TABLE consultations ADD COLUMN consultant_name TEXT");
          if (!cols.some(c => c.name === 'clinical_data')) db.run("ALTER TABLE consultations ADD COLUMN clinical_data TEXT");
          if (!cols.some(c => c.name === 'additional_notes')) db.run("ALTER TABLE consultations ADD COLUMN additional_notes TEXT");
        }
      });

      // Migration: Add IOP columns to triage table if missing
      db.all("PRAGMA table_info(triage)", (err, cols) => {
        if (!err && cols) {
          if (!cols.some(c => c.name === 'iop_od')) {
            db.run("ALTER TABLE triage ADD COLUMN iop_od TEXT");
            console.log("Migration: Added 'iop_od' column to triage table.");
          }
          if (!cols.some(c => c.name === 'iop_os')) {
            db.run("ALTER TABLE triage ADD COLUMN iop_os TEXT");
            console.log("Migration: Added 'iop_os' column to triage table.");
          }
          if (!cols.some(c => c.name === 'iop_method')) {
            db.run("ALTER TABLE triage ADD COLUMN iop_method TEXT");
            console.log("Migration: Added 'iop_method' column to triage table.");
          }
        }
      });

      db.all("PRAGMA table_info(admissions)", (err, cols) => {
        if (!err && cols && !cols.some(c => c.name === 'visit_id')) {
          db.run("ALTER TABLE admissions ADD COLUMN visit_id INTEGER");
        }
      });
      
      // Create Indexes
      db.run("CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name)");
      db.run("CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone)");
      db.run("CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date)");
      db.run("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at)");
      db.run("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)");
      
      // Patient Table Expansion Migration
      const patientCols = [
        { name: 'alternate_phone', type: 'TEXT' },
        { name: 'occupation', type: 'TEXT' },
        { name: 'next_of_kin_phone', type: 'TEXT' },
        { name: 'marital_status', type: 'TEXT' },
        { name: 'genotype', type: 'TEXT' },
        { name: 'medical_alerts', type: 'TEXT' },
        { name: 'payment_category', type: 'TEXT' }
      ];

      patientCols.forEach(col => {
        db.all(`PRAGMA table_info(patients)`, (err, columns) => {
          if (!err && columns && !columns.some(c => c.name === col.name)) {
            db.run(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
            console.log(`Migration: Added '${col.name}' column to patients table.`);
          }
        });
      });
    });
  }
});

module.exports = db;
