import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const sqlite = sqlite3.verbose();

const findRootDir = () => {
  let current = __dirname;
  // Walk up to find the server folder
  while (!current.endsWith('server') && path.dirname(current) !== current) {
    current = path.dirname(current);
  }
  return current;
};

const serverRootDir = findRootDir();
const isPackaged = typeof (process as any).pkg !== 'undefined';
const dbDir = isPackaged ? path.dirname(process.execPath) : serverRootDir;
const dbPath = path.resolve(dbDir, 'luna_eye_hospital.db');
console.log(`[DB] Database path: ${dbPath} (Packaged: ${isPackaged})`);


const db = new sqlite.Database(dbPath, (err: Error | null) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database (Clean Architecture).');

    // ── Performance & reliability PRAGMAs ──
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA cache_size = -16000');
    db.run('PRAGMA temp_store = MEMORY');
    db.run('PRAGMA mmap_size = 134217728');
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA busy_timeout = 10000');
    console.log('[DB] PRAGMAs set: WAL mode, 16 MB cache, memory temp store, busy timeout 10s');
    
    // Create required tables
    db.serialize(() => {
      // Token blacklist table (invalidated sessions)
      db.run(`CREATE TABLE IF NOT EXISTS token_blacklist (
        token TEXT PRIMARY KEY,
        expires_at INTEGER
      )`);

      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT,
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
        expiry_date TEXT,
        attributes TEXT
      )`);

      // Run column migration dynamically for existing databases
      db.run("ALTER TABLE inventory ADD COLUMN attributes TEXT", (err: Error | null) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("Migration error (adding attributes column to inventory):", err.message);
        }
      });

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
        billing_type TEXT DEFAULT 'patient', -- patient, family, walk_in
        family_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
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

      // Triage table - vitals recorded by Nurse
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

      // Consultation Queue table
      db.run(`CREATE TABLE IF NOT EXISTS consultation_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        patient_name TEXT,
        file_number TEXT,
        visit_id INTEGER,
        status TEXT,
        checkin_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checkin_by TEXT,
        started_at DATETIME,
        consultant_name TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )`);

      // Investigations/Results table
      db.run(`CREATE TABLE IF NOT EXISTS investigations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        inventory_id TEXT,
        test_name TEXT,
        status TEXT DEFAULT 'Pending', -- Pending, Completed
        test_value TEXT,
        unit TEXT,
        reference_range TEXT,
        results_notes TEXT,
        medical_comments TEXT,
        billing_status TEXT DEFAULT 'Unpaid',
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
        attribute_template TEXT DEFAULT 'NONE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Migration: Add attribute_template column to inventory_categories if it doesn't exist
      db.run("ALTER TABLE inventory_categories ADD COLUMN attribute_template TEXT DEFAULT 'NONE'", (err: Error | null) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("Migration error (adding attribute_template column to inventory_categories):", err.message);
        }
      });

      // Seed default categories if they do not exist
      const defaultCategories = [
        { name: 'Drugs', description: 'Medicines and pharmaceutical drugs', template: 'DRUGS' },
        { name: 'Test', description: 'Diagnostic tests and procedures', template: 'TEST' },
        { name: 'Laboratory', description: 'Laboratory tests, reagents, and equipment', template: 'LABORATORY' },
        { name: 'Frames', description: 'Eyeglass frames', template: 'FRAMES' },
        { name: 'Lenses', description: 'Eyeglass lenses', template: 'LENSES' }
      ];
      
      defaultCategories.forEach(cat => {
        db.get('SELECT * FROM inventory_categories WHERE name = ?', [cat.name], (err: Error | null, row: any) => {
          if (!err && !row) {
            db.run('INSERT INTO inventory_categories (name, description, attribute_template) VALUES (?, ?, ?)', [cat.name, cat.description, cat.template], (err2: Error | null) => {
              if (!err2) {
                console.log(`Migration: Seeded default category: ${cat.name}`);
              }
            });
          } else if (!err && row && (!row.attribute_template || row.attribute_template === 'NONE')) {
            db.run('UPDATE inventory_categories SET attribute_template = ? WHERE name = ?', [cat.template, cat.name]);
          }
        });
      });

      // Services table (Clinic Services & Registration Cards)
      db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        price REAL DEFAULT 0,
        category TEXT DEFAULT 'Service',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run("ALTER TABLE services ADD COLUMN description TEXT", (err: Error | null) => {
        if (err && !err.message.includes("duplicate column name")) {
          // Ignore duplicate column name
        }
      });

      const defaultServices = [
        { name: 'Individual Card', price: 3000, category: 'Registration', description: 'Standard individual clinical identity & registration card' },
        { name: 'Family Card', price: 10000, category: 'Registration', description: 'Comprehensive family clinical identity & folder card' },
        { name: 'Consultation', price: 2000, category: 'Service', description: 'Ophthalmic / Medical Consultation' },
        { name: 'VA Test', price: 500, category: 'Service', description: 'Visual Acuity Assessment' },
        { name: 'Refraction', price: 1000, category: 'Service', description: 'Comprehensive Subjective & Objective Refraction' },
        { name: 'IOP Measurement', price: 1000, category: 'Service', description: 'Intraocular Pressure Tonometry' },
        { name: 'Dilation', price: 500, category: 'Service', description: 'Pupil Dilation Protocol' },
        { name: 'Fundoscopy', price: 2000, category: 'Service', description: 'Direct / Indirect Fundus Examination' },
        { name: 'Surgery (Cataract)', price: 150000, category: 'Surgery', description: 'Standard Cataract Extraction with IOL' }
      ];

      defaultServices.forEach(srv => {
        db.get('SELECT id, price FROM services WHERE LOWER(TRIM(name)) = LOWER(?)', [srv.name.trim()], (sErr: Error | null, row: any) => {
          if (!sErr && !row) {
            db.run(
              'INSERT INTO services (name, price, category, description) VALUES (?, ?, ?, ?)',
              [srv.name, srv.price, srv.category, srv.description]
            );
          } else if (!sErr && row) {
            if (srv.name === 'Individual Card' && row.price !== 3000) {
              db.run('UPDATE services SET price = 3000 WHERE id = ?', [row.id]);
            }
            if (srv.name === 'Family Card' && row.price !== 10000) {
              db.run('UPDATE services SET price = 10000 WHERE id = ?', [row.id]);
            }
          }
        });
      });

      // Expenses table
      db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        category TEXT, -- Salary, Utility, Medical, Admin, Other, Rent, Equipment, Maintenance
        expense_type TEXT DEFAULT 'Overhead', -- Overhead, Salary, Capital
        description TEXT,
        amount REAL,
        recorded_by TEXT,
        approved_by TEXT,
        payment_ref TEXT,
        staff_id INTEGER,       -- links to users table for salary entries
        month_year TEXT,        -- 'YYYY-MM' for payroll period grouping
        notes TEXT,
        FOREIGN KEY(staff_id) REFERENCES users(id)
      )`);

      // Migration: add new columns to expenses table if they don't exist
      const expenseCols = [
        { name: 'expense_type', type: "TEXT DEFAULT 'Overhead'" },
        { name: 'approved_by', type: 'TEXT' },
        { name: 'payment_ref', type: 'TEXT' },
        { name: 'staff_id', type: 'INTEGER' },
        { name: 'month_year', type: 'TEXT' },
      ];
      expenseCols.forEach(col => {
        db.run(`ALTER TABLE expenses ADD COLUMN ${col.name} ${col.type}`, (err: Error | null) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error(`Migration error (expenses.${col.name}):`, err.message);
          }
        });
      });

      // Staff Salaries — salary schedule per staff member
      db.run(`CREATE TABLE IF NOT EXISTS staff_salaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        basic_salary REAL NOT NULL DEFAULT 0,
        transport_allowance REAL DEFAULT 0,
        housing_allowance REAL DEFAULT 0,
        other_allowances REAL DEFAULT 0,
        effective_from TEXT NOT NULL,
        effective_to TEXT,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);
      db.run('CREATE INDEX IF NOT EXISTS idx_staff_salaries_user ON staff_salaries(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_staff_salaries_active ON staff_salaries(is_active)');

      // Payroll Runs — monthly payroll computation & posting
      db.run(`CREATE TABLE IF NOT EXISTS payroll_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month_year TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        basic_salary REAL DEFAULT 0,
        transport_allowance REAL DEFAULT 0,
        housing_allowance REAL DEFAULT 0,
        other_allowances REAL DEFAULT 0,
        gross_salary REAL NOT NULL,
        pensionable_salary REAL DEFAULT 0,
        paye_annual REAL DEFAULT 0,
        paye_monthly REAL DEFAULT 0,
        pension_employee REAL DEFAULT 0,
        pension_employer REAL DEFAULT 0,
        nhf REAL DEFAULT 0,
        total_deductions REAL DEFAULT 0,
        net_salary REAL NOT NULL,
        payment_status TEXT DEFAULT 'Pending',
        payment_date TEXT,
        payment_ref TEXT,
        payment_method TEXT,
        processed_by TEXT,
        expense_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(expense_id) REFERENCES expenses(id)
      )`);
      db.run('CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll_runs(month_year)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payroll_user ON payroll_runs(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll_runs(payment_status)');

      // Tax Records — WHT on procurement, PAYE accruals
      db.run(`CREATE TABLE IF NOT EXISTS tax_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_type TEXT NOT NULL,        -- 'WHT', 'PAYE', 'PENSION_EMPLOYEE', 'PENSION_EMPLOYER', 'NHF'
        reference_type TEXT,           -- 'procurement', 'payroll'
        reference_id INTEGER,
        vendor_name TEXT,
        gross_amount REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        period TEXT,                   -- 'YYYY-MM'
        status TEXT DEFAULT 'Accrued', -- Accrued, Remitted
        remittance_date TEXT,
        remittance_ref TEXT,
        remitted_by TEXT,
        recorded_by TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run('CREATE INDEX IF NOT EXISTS idx_tax_records_type ON tax_records(tax_type)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tax_records_period ON tax_records(period)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tax_records_status ON tax_records(status)');

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

      // Voice Sessions table
      db.run(`CREATE TABLE IF NOT EXISTS voice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id INTEGER,
        field_name TEXT NOT NULL,
        voice_mode TEXT,
        audio_file_path TEXT,
        raw_transcript TEXT,
        ai_filter_applied INTEGER DEFAULT 0,
        ai_processing_ms INTEGER,
        recording_duration_sec INTEGER,
        recording_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        audio_deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Procurement table
      db.run(`CREATE TABLE IF NOT EXISTS procurement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        item_name TEXT,
        procurement_category TEXT DEFAULT 'Goods',
        quantity_received INTEGER,
        unit_cost REAL,
        total_cost REAL,
        wht_rate REAL DEFAULT 5,
        wht_amount REAL DEFAULT 0,
        tax_record_id INTEGER,
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

      // Migration: add new columns to procurement table if they don't exist
      const procCols = [
        { name: 'procurement_category', type: "TEXT DEFAULT 'Goods'" },
        { name: 'wht_rate', type: 'REAL DEFAULT 5' },
        { name: 'wht_amount', type: 'REAL DEFAULT 0' },
        { name: 'tax_record_id', type: 'INTEGER' }
      ];
      procCols.forEach(col => {
        db.run(`ALTER TABLE procurement ADD COLUMN ${col.name} ${col.type}`, (err: Error | null) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error(`Migration error (procurement.${col.name}):`, err.message);
          }
        });
      });

      // Notifications table
      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_role TEXT, -- Role intended for
        message TEXT,
        module TEXT,
        is_read INTEGER DEFAULT 0,
        patient_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Migration: Add patient_id column to notifications dynamically
      db.run("ALTER TABLE notifications ADD COLUMN patient_id TEXT", (err: Error | null) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("Migration error (adding patient_id to notifications):", err.message);
        } else {
          db.run("CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON notifications (patient_id)");
        }
      });

      // Reprint Logs table
      db.run(`CREATE TABLE IF NOT EXISTS reprint_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        bill_id INTEGER,
        patient_id TEXT,
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
      db.get('SELECT COUNT(*) as count FROM reprint_settings', (err: Error | null, row: any) => {
        if (!err && row && row.count === 0) {
          db.run('INSERT INTO reprint_settings (daily_reprint_threshold) VALUES (5)');
          console.log('Default reprint settings initialized.');
        }
      });

      // Investigation Templates table
      db.run(`CREATE TABLE IF NOT EXISTS investigation_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_name TEXT UNIQUE,
        default_unit TEXT,
        default_reference_range TEXT,
        template_content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Seed default templates for RBS & FBS
      const defaultTemplates = [
        {
          test_name: 'Random Blood Sugar',
          default_unit: 'mmol/L',
          default_reference_range: '< 7.8',
          template_content: 'RANDOM BLOOD SUGAR (RBS) REPORT\n--------------------------------\nTime of Last Meal: ________ hours ago\nMethodology: Enzymatic Glucose Oxidase\n\nClinical Interpretation:\n[ ] Normal (< 7.8 mmol/L / < 140 mg/dL)\n[ ] Pre-diabetic (7.8 - 11.0 mmol/L / 140 - 199 mg/dL)\n[ ] Diabetic (>= 11.1 mmol/L / >= 200 mg/dL)\n\nQuality Control: Pass'
        },
        {
          test_name: 'RBS',
          default_unit: 'mmol/L',
          default_reference_range: '< 7.8',
          template_content: 'RANDOM BLOOD SUGAR (RBS) REPORT\n--------------------------------\nTime of Last Meal: ________ hours ago\nMethodology: Enzymatic Glucose Oxidase\n\nClinical Interpretation:\n[ ] Normal (< 7.8 mmol/L / < 140 mg/dL)\n[ ] Pre-diabetic (7.8 - 11.0 mmol/L / 140 - 199 mg/dL)\n[ ] Diabetic (>= 11.1 mmol/L / >= 200 mg/dL)\n\nQuality Control: Pass'
        },
        {
          test_name: 'Fasting Blood Sugar',
          default_unit: 'mmol/L',
          default_reference_range: '3.9 - 5.6',
          template_content: 'FASTING BLOOD SUGAR (FBS) REPORT\n--------------------------------\nPatient State: Fasting (8-12 hours)\nMethodology: Enzymatic Glucose Oxidase\n\nClinical Interpretation:\n[ ] Normal (< 5.6 mmol/L / < 100 mg/dL)\n[ ] Impaired Fasting Glucose (5.6 - 6.9 mmol/L / 100 - 125 mg/dL)\n[ ] Diabetic (>= 7.0 mmol/L / >= 126 mg/dL)\n\nQuality Control: Pass'
        },
        {
          test_name: 'FBS',
          default_unit: 'mmol/L',
          default_reference_range: '3.9 - 5.6',
          template_content: 'FASTING BLOOD SUGAR (FBS) REPORT\n--------------------------------\nPatient State: Fasting (8-12 hours)\nMethodology: Enzymatic Glucose Oxidase\n\nClinical Interpretation:\n[ ] Normal (< 5.6 mmol/L / < 100 mg/dL)\n[ ] Impaired Fasting Glucose (5.6 - 6.9 mmol/L / 100 - 125 mg/dL)\n[ ] Diabetic (>= 7.0 mmol/L / >= 126 mg/dL)\n\nQuality Control: Pass'
        }
      ];

      defaultTemplates.forEach(tpl => {
        db.get('SELECT id FROM investigation_templates WHERE test_name = ?', [tpl.test_name], (err, row) => {
          if (!err && !row) {
            db.run('INSERT INTO investigation_templates (test_name, default_unit, default_reference_range, template_content) VALUES (?, ?, ?, ?)',
              [tpl.test_name, tpl.default_unit, tpl.default_reference_range, tpl.template_content],
              (err2) => {
                if (err2) console.error('Error seeding default template:', tpl.test_name, err2.message);
                else console.log('Seeded default investigation template:', tpl.test_name);
              }
            );
          }
        });
      });

      // Insert default Admin user if none exists
      db.get('SELECT * FROM users WHERE role = "Admin"', (err: Error | null, row: any) => {
        if (!err && !row) {
          const hashedPassword = bcrypt.hashSync('admin', 10);
          const stmt = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
          stmt.run('admin', hashedPassword, 'System Administrator', 'Admin');
          stmt.finalize();
          console.log('Default admin user created (hashed).');
        }
      });

      // Migration: Hash any legacy plain text passwords in the database
      db.all('SELECT id, username, password FROM users', [], (err: Error | null, rows: any[]) => {
        if (!err && rows) {
          const bcryptRegex = /^\$2[ayb]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/;
          rows.forEach(row => {
            if (!bcryptRegex.test(row.password)) {
              const hashedPassword = bcrypt.hashSync(row.password, 10);
              db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, row.id], (err2: Error | null) => {
                if (!err2) {
                  console.log(`Migration: Hashed legacy password for user: ${row.username}`);
                }
              });
            }
          });
        }
      });

      // PRAGMA column updates
      db.all("PRAGMA table_info(users)", (err: Error | null, columns: any[]) => {
        if (err || !columns) return;
        const hasPhone = columns.some(c => c.name === 'phone_number');
        const hasCreatedAt = columns.some(c => c.name === 'created_at');
        
        if (!hasPhone) db.run("ALTER TABLE users ADD COLUMN phone_number TEXT");
        if (!hasCreatedAt) db.run("ALTER TABLE users ADD COLUMN created_at DATETIME");
        
        const hasDepartment = columns.some(c => c.name === 'department');
        const hasStatus = columns.some(c => c.name === 'status');
        const hasEmail = columns.some(c => c.name === 'email');
        if (!hasDepartment) db.run("ALTER TABLE users ADD COLUMN department TEXT DEFAULT 'General'");
        if (!hasStatus) db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'");
        if (!hasEmail) {
          db.run("ALTER TABLE users ADD COLUMN email TEXT", () => {
            db.run("UPDATE users SET email = LOWER(username) || '@lunaeye.com' WHERE email IS NULL OR TRIM(email) = ''");
          });
        } else {
          db.run("UPDATE users SET email = LOWER(username) || '@lunaeye.com' WHERE email IS NULL OR TRIM(email) = ''");
        }
      });

      db.all("PRAGMA table_info(purchase_orders)", (err: Error | null, columns: any[]) => {
        if (err || !columns) return;
        if (!columns.some(c => c.name === 'amount_paid')) db.run("ALTER TABLE purchase_orders ADD COLUMN amount_paid REAL DEFAULT 0");
        if (!columns.some(c => c.name === 'balance')) db.run("ALTER TABLE purchase_orders ADD COLUMN balance REAL DEFAULT 0");
      });

      db.all("PRAGMA table_info(visits)", (err: Error | null, columns: any[]) => {
        if (err || !columns) return;
        if (!columns.some(c => c.name === 'department')) db.run("ALTER TABLE visits ADD COLUMN department TEXT DEFAULT 'General'");
      });

      db.all("PRAGMA table_info(inventory)", (err: Error | null, cols: any[]) => {
        if (err || !cols) return;
        if (!cols.some(c => c.name === 'cost_price')) db.run("ALTER TABLE inventory ADD COLUMN cost_price REAL");
        if (!cols.some(c => c.name === 'supplier')) db.run("ALTER TABLE inventory ADD COLUMN supplier TEXT");
        if (!cols.some(c => c.name === 'batch_number')) db.run("ALTER TABLE inventory ADD COLUMN batch_number TEXT");
      });

      db.all("PRAGMA table_info(transaction_items)", (err: Error | null, cols: any[]) => {
        if (err || !cols) return;
        if (!cols.some(c => c.name === 'inventory_id')) db.run("ALTER TABLE transaction_items ADD COLUMN inventory_id TEXT");
      });

      db.all("PRAGMA table_info(consultations)", (err: Error | null, cols: any[]) => {
        if (err || !cols) return;
        if (!cols.some(c => c.name === 'visit_id')) db.run("ALTER TABLE consultations ADD COLUMN visit_id INTEGER");
        if (!cols.some(c => c.name === 'consultant_name')) db.run("ALTER TABLE consultations ADD COLUMN consultant_name TEXT");
        if (!cols.some(c => c.name === 'clinical_data')) db.run("ALTER TABLE consultations ADD COLUMN clinical_data TEXT");
        if (!cols.some(c => c.name === 'additional_notes')) db.run("ALTER TABLE consultations ADD COLUMN additional_notes TEXT");
      });

      db.all("PRAGMA table_info(triage)", (err: Error | null, cols: any[]) => {
        if (err || !cols) return;
        if (!cols.some(c => c.name === 'iop_od')) db.run("ALTER TABLE triage ADD COLUMN iop_od TEXT");
        if (!cols.some(c => c.name === 'iop_os')) db.run("ALTER TABLE triage ADD COLUMN iop_os TEXT");
        if (!cols.some(c => c.name === 'iop_method')) db.run("ALTER TABLE triage ADD COLUMN iop_method TEXT");
      });

      db.all("PRAGMA table_info(admissions)", (err: Error | null, cols: any[]) => {
        if (err || !cols) return;
        if (!cols.some(c => c.name === 'visit_id')) db.run("ALTER TABLE admissions ADD COLUMN visit_id INTEGER");
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
        { name: 'payment_category', type: 'TEXT' },
        { name: 'family_id', type: 'INTEGER' },
        { name: 'relationship_to_family', type: 'TEXT' },
        { name: 'registration_type', type: "TEXT DEFAULT 'INDIVIDUAL'" },
        { name: 'tribe', type: 'TEXT' },
        { name: 'religion', type: 'TEXT' },
        { name: 'state_of_origin', type: 'TEXT' },
        { name: 'next_of_kin_address', type: 'TEXT' }
      ];

      patientCols.forEach(col => {
        db.all(`PRAGMA table_info(patients)`, (err: Error | null, columns: any[]) => {
          if (!err && columns && !columns.some(c => c.name === col.name)) {
            db.run(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
          }
        });
      });

      // Families Table
      db.run(`CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_card_number TEXT UNIQUE NOT NULL,
        family_name TEXT NOT NULL,
        contact_person_name TEXT NOT NULL,
        contact_person_phone TEXT NOT NULL,
        residential_address TEXT,
        tribe TEXT,
        state_of_origin TEXT,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        updated_by TEXT
      )`);
      db.run("CREATE INDEX IF NOT EXISTS idx_families_card ON families(family_card_number)");
      db.run("CREATE INDEX IF NOT EXISTS idx_families_name ON families(family_name)");
      db.run("CREATE INDEX IF NOT EXISTS idx_families_phone ON families(contact_person_phone)");
      db.run("CREATE INDEX IF NOT EXISTS idx_patients_family ON patients(family_id)");


      // Investigations Expansion Migration
      const invCols = [
        { name: 'inventory_id', type: 'TEXT' },
        { name: 'test_value', type: 'TEXT' },
        { name: 'unit', type: 'TEXT' },
        { name: 'reference_range', type: 'TEXT' },
        { name: 'medical_comments', type: 'TEXT' },
        { name: 'billing_status', type: 'TEXT DEFAULT "Unpaid"' }
      ];

      invCols.forEach(col => {
        db.all(`PRAGMA table_info(investigations)`, (err: Error | null, columns: any[]) => {
          if (!err && columns && !columns.some(c => c.name === col.name)) {
            db.run(`ALTER TABLE investigations ADD COLUMN ${col.name} ${col.type}`);
          }
        });
      });

      // Consultation Queue Expansion Migration
      const queueCols = [
        { name: 'started_at', type: 'DATETIME' },
        { name: 'consultant_name', type: 'TEXT' }
      ];

      queueCols.forEach(col => {
        db.all(`PRAGMA table_info(consultation_queue)`, (err: Error | null, columns: any[]) => {
          if (!err && columns && !columns.some(c => c.name === col.name)) {
            db.run(`ALTER TABLE consultation_queue ADD COLUMN ${col.name} ${col.type}`);
          }
        });
      });
      // Transactions FK Migration (allows family card, walk-in, and OTC retail billing)
      db.all("PRAGMA foreign_key_list(transactions)", [], (fkErr: Error | null, fks: any[]) => {
        if (!fkErr && fks && fks.some((f: any) => f.table === 'patients')) {
          console.log('[Migration] Migrating transactions table to remove restrictive patients FK constraint...');
          db.serialize(() => {
            db.run('PRAGMA foreign_keys = OFF');
            db.run('BEGIN TRANSACTION');
            db.run(`
              CREATE TABLE transactions_migrated (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_no TEXT UNIQUE,
                patient_id TEXT,
                amount REAL,
                payment_method TEXT,
                cashier TEXT,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_amount REAL,
                discount REAL DEFAULT 0,
                amount_paid REAL,
                balance REAL,
                payment_details TEXT,
                visit_id INTEGER
              )
            `);
            db.run(`
              INSERT INTO transactions_migrated (
                id, receipt_no, patient_id, amount, payment_method, cashier, status,
                created_at, total_amount, discount, amount_paid, balance, payment_details, visit_id
              ) SELECT 
                id, receipt_no, patient_id, amount, payment_method, cashier, status,
                created_at, total_amount, discount, amount_paid, balance, payment_details, visit_id
              FROM transactions
            `);
            db.run('DROP TABLE transactions');
            db.run('ALTER TABLE transactions_migrated RENAME TO transactions');
            db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at)');
            db.run('CREATE INDEX IF NOT EXISTS idx_transactions_patient ON transactions(patient_id)');
            db.run('COMMIT', (cErr) => {
              db.run('PRAGMA foreign_keys = ON');
              if (cErr) console.error('[Migration] Failed to migrate transactions table:', cErr);
              else console.log('[Migration] Successfully migrated transactions table.');
            });
          });
        }
      });

      // Reprint Logs FK Migration
      db.all("PRAGMA foreign_key_list(reprint_logs)", [], (fkErr: Error | null, fks: any[]) => {
        if (!fkErr && fks && fks.some((f: any) => f.table === 'patients')) {
          console.log('[Migration] Migrating reprint_logs table to remove restrictive patients FK constraint...');
          db.serialize(() => {
            db.run('PRAGMA foreign_keys = OFF');
            db.run('BEGIN TRANSACTION');
            db.run(`
              CREATE TABLE reprint_logs_migrated (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_number TEXT,
                bill_id INTEGER,
                patient_id TEXT,
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
                FOREIGN KEY(reprinted_by_user_id) REFERENCES users(id)
              )
            `);
            db.run(`INSERT INTO reprint_logs_migrated SELECT * FROM reprint_logs`);
            db.run('DROP TABLE reprint_logs');
            db.run('ALTER TABLE reprint_logs_migrated RENAME TO reprint_logs');
            db.run('COMMIT', (cErr) => {
              db.run('PRAGMA foreign_keys = ON');
              if (cErr) console.error('[Migration] Failed to migrate reprint_logs table:', cErr);
              else console.log('[Migration] Successfully migrated reprint_logs table.');
            });
          });
        }
      });

      // Polymorphic Billing Columns Migration (billing_type, family_id)
      db.all("PRAGMA table_info(transactions)", [], (errCols: Error | null, cols: any[]) => {
        if (!errCols && cols) {
          const addBillingType = !cols.some(c => c.name === 'billing_type');
          const addFamilyId = !cols.some(c => c.name === 'family_id');

          const ensureIndexesAndBackfill = () => {
            db.run('CREATE INDEX IF NOT EXISTS idx_transactions_billing_type ON transactions(billing_type)');
            db.run('CREATE INDEX IF NOT EXISTS idx_transactions_family_id ON transactions(family_id)');

            // Backfill existing records: link family card transactions
            db.run(`
              UPDATE transactions 
              SET billing_type = 'family', 
                  family_id = (SELECT id FROM families WHERE family_card_number = transactions.patient_id)
              WHERE patient_id IN (SELECT family_card_number FROM families)
                AND (billing_type IS NULL OR billing_type = 'patient')
            `, (bErr) => {
              if (!bErr) console.log('[Migration] Backfilled family billing transactions.');
            });

            // Backfill walk-in records (including legacy WALKIN-* patterns)
            db.run(`
              UPDATE transactions 
              SET billing_type = 'walk_in'
              WHERE (patient_id IS NULL OR patient_id = '' OR patient_id = 'Walk-in' OR patient_id LIKE 'WALKIN-%')
                AND (billing_type IS NULL OR billing_type = 'patient')
            `);

            // Compound Foreign Key Triggers: enforce referential integrity at the engine level
            db.run(`
              CREATE TRIGGER IF NOT EXISTS trg_validate_transaction_entity_insert
              BEFORE INSERT ON transactions
              FOR EACH ROW
              BEGIN
                SELECT CASE
                  WHEN NEW.billing_type = 'patient' AND (NEW.patient_id IS NULL OR NEW.patient_id NOT IN (SELECT id FROM patients)) THEN
                    RAISE(ABORT, 'Validation failed: patient_id does not exist in patients table for billing_type = ''patient''')
                  WHEN NEW.billing_type = 'family' AND (
                    (NEW.family_id IS NULL AND (NEW.patient_id IS NULL OR NEW.patient_id NOT IN (SELECT family_card_number FROM families)))
                    OR
                    (NEW.family_id IS NOT NULL AND NEW.family_id NOT IN (SELECT id FROM families))
                  ) THEN
                    RAISE(ABORT, 'Validation failed: family_id or family_card_number does not exist in families table for billing_type = ''family''')
                END;
              END;
            `);

            db.run(`
              CREATE TRIGGER IF NOT EXISTS trg_validate_transaction_entity_update
              BEFORE UPDATE OF billing_type, patient_id, family_id ON transactions
              FOR EACH ROW
              BEGIN
                SELECT CASE
                  WHEN NEW.billing_type = 'patient' AND (NEW.patient_id IS NULL OR NEW.patient_id NOT IN (SELECT id FROM patients)) THEN
                    RAISE(ABORT, 'Validation failed: patient_id does not exist in patients table for billing_type = ''patient''')
                  WHEN NEW.billing_type = 'family' AND (
                    (NEW.family_id IS NULL AND (NEW.patient_id IS NULL OR NEW.patient_id NOT IN (SELECT family_card_number FROM families)))
                    OR
                    (NEW.family_id IS NOT NULL AND NEW.family_id NOT IN (SELECT id FROM families))
                  ) THEN
                    RAISE(ABORT, 'Validation failed: family_id or family_card_number does not exist in families table for billing_type = ''family''')
                END;
              END;
            `);
          };

          if (addBillingType && addFamilyId) {
            db.run("ALTER TABLE transactions ADD COLUMN billing_type TEXT DEFAULT 'patient'", () => {
              db.run("ALTER TABLE transactions ADD COLUMN family_id INTEGER REFERENCES families(id)", () => {
                console.log('[Migration] Added billing_type and family_id columns to transactions.');
                ensureIndexesAndBackfill();
              });
            });
          } else if (addBillingType) {
            db.run("ALTER TABLE transactions ADD COLUMN billing_type TEXT DEFAULT 'patient'", () => {
              console.log('[Migration] Added billing_type column to transactions.');
              ensureIndexesAndBackfill();
            });
          } else if (addFamilyId) {
            db.run("ALTER TABLE transactions ADD COLUMN family_id INTEGER REFERENCES families(id)", () => {
              console.log('[Migration] Added family_id column to transactions.');
              ensureIndexesAndBackfill();
            });
          } else {
            ensureIndexesAndBackfill();
          }
        }
      });

      // ══════════════════════════════════════════════════════════════════
      // INSURANCE & CLAIMS MODULE — additive tables (never alters existing)
      // ══════════════════════════════════════════════════════════════════

      // Payers (HMOs, NHIA, corporates, private insurers)
      db.run(`CREATE TABLE IF NOT EXISTS payers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'HMO', -- HMO | NHIA | CORPORATE | PRIVATE
        code TEXT UNIQUE,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        billing_cycle_note TEXT,
        payment_terms_days INTEGER DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'active', -- active | inactive
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0
      )`);

      // Insurance plans under a payer
      db.run(`CREATE TABLE IF NOT EXISTS insurance_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payer_id INTEGER NOT NULL,
        plan_name TEXT NOT NULL,
        plan_code TEXT,
        copay_type TEXT NOT NULL DEFAULT 'NONE', -- NONE | PERCENT | FIXED
        copay_value REAL DEFAULT 0,
        annual_limit_kobo INTEGER DEFAULT 0,
        requires_referral INTEGER DEFAULT 0,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);

      // Payer-specific tariffs (price list per service/drug/frame/lens/theatre item)
      db.run(`CREATE TABLE IF NOT EXISTS payer_tariffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payer_id INTEGER NOT NULL,
        plan_id INTEGER,
        item_type TEXT NOT NULL, -- SERVICE | DRUG | FRAME | LENS | THEATRE
        item_ref_id TEXT NOT NULL, -- inventory id or service id
        item_description TEXT,
        payer_price_kobo INTEGER NOT NULL DEFAULT 0,
        covered INTEGER DEFAULT 1,
        requires_preauth INTEGER DEFAULT 0,
        quantity_limit INTEGER,
        effective_from TEXT,
        effective_to TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY(payer_id) REFERENCES payers(id),
        FOREIGN KEY(plan_id) REFERENCES insurance_plans(id)
      )`);

      // Enrollees — a patient's membership under a payer/plan
      db.run(`CREATE TABLE IF NOT EXISTS enrollees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT NOT NULL,
        payer_id INTEGER NOT NULL,
        plan_id INTEGER,
        enrollee_number TEXT NOT NULL,
        relationship TEXT NOT NULL DEFAULT 'PRINCIPAL', -- PRINCIPAL | SPOUSE | CHILD | OTHER
        principal_name TEXT,
        organisation TEXT,
        valid_from TEXT,
        valid_to TEXT,
        verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED', -- UNVERIFIED | VERIFIED | EXPIRED | REJECTED
        verified_by TEXT,
        verified_at DATETIME,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(payer_id) REFERENCES payers(id),
        FOREIGN KEY(plan_id) REFERENCES insurance_plans(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollees_patient ON enrollees(patient_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollees_number ON enrollees(enrollee_number, payer_id)`);

      // Pre-authorizations
      db.run(`CREATE TABLE IF NOT EXISTS authorizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id INTEGER,
        patient_id TEXT NOT NULL,
        enrollee_id INTEGER NOT NULL,
        payer_id INTEGER NOT NULL,
        auth_code TEXT,
        requested_services TEXT, -- JSON
        approved_amount_kobo INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'REQUESTED', -- REQUESTED | APPROVED | PARTIAL | DENIED | EXPIRED
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        decided_at DATETIME,
        valid_until TEXT,
        attachment_path TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(enrollee_id) REFERENCES enrollees(id),
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_authorizations_visit ON authorizations(visit_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_authorizations_patient ON authorizations(patient_id)`);

      // Claims — one claim per visit+payer
      db.run(`CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_number TEXT UNIQUE NOT NULL,
        payer_id INTEGER NOT NULL,
        plan_id INTEGER,
        enrollee_id INTEGER NOT NULL,
        patient_id TEXT NOT NULL,
        visit_id INTEGER,
        transaction_id INTEGER,
        authorization_id INTEGER,
        claim_date TEXT NOT NULL,
        service_date TEXT NOT NULL,
        primary_diagnosis_code TEXT,
        primary_diagnosis_text TEXT,
        secondary_diagnosis_codes TEXT, -- JSON array
        total_billed_kobo INTEGER DEFAULT 0,
        copay_collected_kobo INTEGER DEFAULT 0,
        claimed_amount_kobo INTEGER DEFAULT 0,
        approved_amount_kobo INTEGER DEFAULT 0,
        rejected_amount_kobo INTEGER DEFAULT 0,
        paid_amount_kobo INTEGER DEFAULT 0,
        outstanding_amount_kobo INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        batch_id INTEGER,
        submitted_at DATETIME,
        submitted_by TEXT,
        decision_at DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY(payer_id) REFERENCES payers(id),
        FOREIGN KEY(plan_id) REFERENCES insurance_plans(id),
        FOREIGN KEY(enrollee_id) REFERENCES enrollees(id),
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_payer ON claims(payer_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_number ON claims(claim_number)`);

      // Claim line items
      db.run(`CREATE TABLE IF NOT EXISTS claim_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER NOT NULL,
        item_type TEXT,
        item_ref_id TEXT,
        description TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price_kobo INTEGER DEFAULT 0,
        line_total_kobo INTEGER DEFAULT 0,
        covered_amount_kobo INTEGER DEFAULT 0,
        rejected_amount_kobo INTEGER DEFAULT 0,
        rejection_reason_code TEXT,
        rejection_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(claim_id) REFERENCES claims(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claim_items_claim ON claim_items(claim_id)`);

      // Claim batches (groups of claims submitted together to a payer)
      db.run(`CREATE TABLE IF NOT EXISTS claim_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_number TEXT UNIQUE NOT NULL,
        payer_id INTEGER NOT NULL,
        period_from TEXT,
        period_to TEXT,
        claim_count INTEGER DEFAULT 0,
        total_claimed_kobo INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | SUBMITTED | CLOSED
        submitted_at DATETIME,
        export_file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);

      // Claim status history (audit trail for every status transition)
      db.run(`CREATE TABLE IF NOT EXISTS claim_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        FOREIGN KEY(claim_id) REFERENCES claims(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claim_history_claim ON claim_status_history(claim_id)`);

      // Remittances — payments received from payers
      db.run(`CREATE TABLE IF NOT EXISTS remittances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remittance_number TEXT UNIQUE NOT NULL,
        payer_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        amount_kobo INTEGER NOT NULL DEFAULT 0,
        method TEXT DEFAULT 'BANK_TRANSFER', -- BANK_TRANSFER | CHEQUE | OTHER
        reference TEXT,
        evidence_attachment_path TEXT,
        unallocated_amount_kobo INTEGER DEFAULT 0,
        recorded_by TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_remittances_payer ON remittances(payer_id)`);

      // Remittance allocations — how a remittance is split across claims
      db.run(`CREATE TABLE IF NOT EXISTS remittance_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remittance_id INTEGER NOT NULL,
        claim_id INTEGER NOT NULL,
        amount_kobo INTEGER NOT NULL DEFAULT 0,
        allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        allocated_by TEXT,
        FOREIGN KEY(remittance_id) REFERENCES remittances(id),
        FOREIGN KEY(claim_id) REFERENCES claims(id)
      )`);

      // Rejection reason codes (seeded)
      db.run(`CREATE TABLE IF NOT EXISTS rejection_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        active INTEGER DEFAULT 1
      )`);

      // Seed rejection reasons
      const rejectionReasons = [
        { code: 'NOT_COVERED', description: 'Not covered under plan' },
        { code: 'NO_AUTH', description: 'No valid authorization' },
        { code: 'EXPIRED_ENROLLMENT', description: 'Expired enrollment' },
        { code: 'DUPLICATE', description: 'Duplicate claim' },
        { code: 'WRONG_TARIFF', description: 'Incorrect tariff applied' },
        { code: 'MISSING_DOC', description: 'Missing documentation' },
        { code: 'BEYOND_LIMIT', description: 'Beyond annual/quantity limit' },
        { code: 'OTHER', description: 'Other (see notes)' }
      ];
      rejectionReasons.forEach(r => {
        db.run(`INSERT OR IGNORE INTO rejection_reasons (code, description) VALUES (?, ?)`, [r.code, r.description]);
      });

      // ICD-10 codes table (importable via CSV)
      db.run(`CREATE TABLE IF NOT EXISTS icd10_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        chapter TEXT,
        active INTEGER DEFAULT 1
      )`);

      // Insurance settings (single-row config)
      db.run(`CREATE TABLE IF NOT EXISTS insurance_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        claim_number_prefix TEXT DEFAULT 'CLM',
        batch_number_prefix TEXT DEFAULT 'BCH',
        default_payment_terms_days INTEGER DEFAULT 30,
        export_template TEXT, -- JSON
        updated_at DATETIME,
        updated_by TEXT
      )`);

      // Payer EDI Clearinghouse Configs (Multi-Protocol: Local Folder, Webhook, SFTP)
      db.run(`CREATE TABLE IF NOT EXISTS payer_edi_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payer_id INTEGER NOT NULL UNIQUE,
        protocol TEXT NOT NULL DEFAULT 'LOCAL_FOLDER',
        is_enabled INTEGER DEFAULT 1,
        local_folder_path TEXT,
        webhook_url TEXT,
        webhook_auth_header TEXT,
        sftp_host TEXT,
        sftp_port INTEGER DEFAULT 22,
        sftp_username TEXT,
        sftp_password TEXT,
        sftp_remote_path TEXT,
        format TEXT DEFAULT 'JSON',
        auto_dispatch INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);

      // EDI Batch Transmission Audit Logs
      db.run(`CREATE TABLE IF NOT EXISTS edi_transmissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        payer_id INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        destination TEXT NOT NULL,
        status TEXT NOT NULL,
        response_payload TEXT,
        error_message TEXT,
        transmitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        transmitted_by TEXT,
        FOREIGN KEY(batch_id) REFERENCES claim_batches(id),
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_edi_tx_batch ON edi_transmissions(batch_id)`);

      // EDI Transmission Asynchronous Job Queue (Backoff retries & Dead-Letter queueing)
      db.run(`CREATE TABLE IF NOT EXISTS edi_job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        payer_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY(batch_id) REFERENCES claim_batches(id),
        FOREIGN KEY(payer_id) REFERENCES payers(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_edi_queue_status_run ON edi_job_queue(status, next_run_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_edi_queue_batch ON edi_job_queue(batch_id)`);

      db.run(`INSERT OR IGNORE INTO insurance_settings (id) VALUES (1)`);

      // ── Additive nullable columns on existing tables ──

      // visits: link to active enrollee and payer for this visit
      const visitInsCols = [
        { name: 'enrollee_id', type: 'INTEGER' },
        { name: 'payer_id',    type: 'INTEGER' },
        { name: 'is_insurance_visit', type: 'INTEGER DEFAULT 0' }
      ];
      visitInsCols.forEach(col => {
        db.all(`PRAGMA table_info(visits)`, (err: Error | null, columns: any[]) => {
          if (!err && columns && !columns.some(c => c.name === col.name)) {
            db.run(`ALTER TABLE visits ADD COLUMN ${col.name} ${col.type}`, (e: Error | null) => {
              if (e) console.error(`[Insurance Migration] visits.${col.name}:`, e.message);
              else console.log(`[Insurance Migration] Added visits.${col.name}`);
            });
          }
        });
      });

      // transactions: link to claim and split patient vs payer portion
      const txInsCols = [
        { name: 'payer_id',          type: 'INTEGER' },
        { name: 'claim_id',          type: 'INTEGER' },
        { name: 'patient_portion',   type: 'REAL DEFAULT 0' },
        { name: 'payer_portion',     type: 'REAL DEFAULT 0' },
        { name: 'is_insurance_bill', type: 'INTEGER DEFAULT 0' }
      ];
      txInsCols.forEach(col => {
        db.all(`PRAGMA table_info(transactions)`, (err: Error | null, columns: any[]) => {
          if (!err && columns && !columns.some(c => c.name === col.name)) {
            db.run(`ALTER TABLE transactions ADD COLUMN ${col.name} ${col.type}`, (e: Error | null) => {
              if (e) console.error(`[Insurance Migration] transactions.${col.name}:`, e.message);
              else console.log(`[Insurance Migration] Added transactions.${col.name}`);
            });
          }
        });
      });

      console.log('[DB] Insurance & Claims module tables ensured.');
    });
  }
});

// Performance indexes
db.serialize(() => {
  db.run('CREATE INDEX IF NOT EXISTS idx_inventory_category    ON inventory(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_inventory_name        ON inventory(name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_patients_name         ON patients(full_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_patient        ON visits(patient_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_status         ON visits(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_notifications_role    ON notifications(user_role)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stock_movements_item  ON stock_movements(item_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON audit_logs(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON audit_logs(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_patient  ON transactions(patient_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(created_at)');
  console.log('[DB] Indexes ensured (Clean Architecture).');
});

export default db;
