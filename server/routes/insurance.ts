/**
 * Insurance & Claims Module — Express Router
 * All routes require Admin role (enforced by global /api/insurance middleware in index.ts)
 * Amounts stored as integers in kobo (NGN). 100 kobo = ₦1.
 */

import express, { Request, Response } from 'express';
import db from '../db';
import { transmitBatch, formatBatchPayload } from '../src/services/ediBridge';
import { enqueueBatchTransmission, getQueueJobForBatch, getQueueJobs, retryQueueJob } from '../src/services/ediQueue';

export const insuranceRouter = express.Router();

const dbGet = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));

const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (this: any, err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    })
  );

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Legal claim status transitions */
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT:              ['READY', 'CANCELLED'],
  READY:              ['SUBMITTED', 'CANCELLED'],
  SUBMITTED:          ['UNDER_REVIEW', 'QUERIED', 'REJECTED'],
  UNDER_REVIEW:       ['APPROVED', 'PARTIALLY_APPROVED', 'QUERIED', 'REJECTED'],
  QUERIED:            ['RESUBMITTED'],
  RESUBMITTED:        ['UNDER_REVIEW'],
  APPROVED:           ['PAID'],
  PARTIALLY_APPROVED: ['PARTIALLY_PAID'],
  PARTIALLY_PAID:     ['PAID'],
  REJECTED:           ['RESUBMITTED', 'WRITTEN_OFF'],
  PAID:               [],
  WRITTEN_OFF:        [],
  CANCELLED:          [],
};

/** Statuses where claim items and amounts are locked against edits */
const LOCKED_STATUSES = new Set([
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED',
  'PARTIALLY_PAID', 'PAID', 'WRITTEN_OFF',
]);

/** Statuses that require a mandatory reason string */
const REASON_REQUIRED = new Set(['REJECTED', 'QUERIED', 'CANCELLED', 'WRITTEN_OFF']);

function logInsuranceAudit(req: Request, action: string, detail: string) {
  const user = (req as any).user;
  db.run(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action_type, module, details, status)
     VALUES (?, ?, ?, ?, 'Insurance', ?, 'Standard')`,
    [user?.id, user?.username || 'Admin', user?.role || 'Admin', action, detail]
  );
}

function generateClaimNumber(cb: (num: string) => void) {
  db.get(`SELECT claim_number_prefix as pfx FROM insurance_settings WHERE id = 1`, [], (_e: any, row: any) => {
    const prefix = row?.pfx || 'CLM';
    const year = new Date().getFullYear();
    db.get(`SELECT COUNT(*) as cnt FROM claims WHERE claim_number LIKE ?`, [`${prefix}-${year}-%`], (_e2: any, r: any) => {
      const seq = String((r?.cnt || 0) + 1).padStart(5, '0');
      cb(`${prefix}-${year}-${seq}`);
    });
  });
}

function generateBatchNumber(payerId: number, cb: (num: string) => void) {
  db.get(`SELECT batch_number_prefix as pfx FROM insurance_settings WHERE id = 1`, [], (_e: any, row: any) => {
    const prefix = row?.pfx || 'BCH';
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    db.get(`SELECT COUNT(*) as cnt FROM claim_batches WHERE batch_number LIKE ? AND payer_id = ?`, [`${prefix}-${ym}-%`, payerId], (_e2: any, r: any) => {
      const seq = String((r?.cnt || 0) + 1).padStart(3, '0');
      cb(`${prefix}-${ym}-${seq}`);
    });
  });
}

function generateRemittanceNumber(cb: (num: string) => void) {
  const year = new Date().getFullYear();
  db.get(`SELECT COUNT(*) as cnt FROM remittances WHERE remittance_number LIKE ?`, [`RMT-${year}-%`], (_e: any, r: any) => {
    const seq = String((r?.cnt || 0) + 1).padStart(5, '0');
    cb(`RMT-${year}-${seq}`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// PAYERS
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/payers', (req: Request, res: Response) => {
  db.all(
    `SELECT p.*, COUNT(ip.id) as plan_count FROM payers p
     LEFT JOIN insurance_plans ip ON ip.payer_id = p.id AND ip.is_deleted = 0
     WHERE p.is_deleted = 0 GROUP BY p.id ORDER BY p.name`,
    [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }
  );
});

insuranceRouter.get('/payers/:id', (req: Request, res: Response) => {
  db.get(`SELECT * FROM payers WHERE id = ? AND is_deleted = 0`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Payer not found' });
    res.json(row);
  });
});

insuranceRouter.post('/payers', (req: Request, res: Response) => {
  const { name, type, code, contact_person, phone, email, address, billing_cycle_note, payment_terms_days } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const user = (req as any).user;
  db.run(
    `INSERT INTO payers (name, type, code, contact_person, phone, email, address, billing_cycle_note, payment_terms_days, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, type || 'HMO', code || null, contact_person || null, phone || null, email || null, address || null, billing_cycle_note || null, payment_terms_days || 30, user?.username],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logInsuranceAudit(req, 'PAYER_CREATE', `Created payer: ${name}`);
      res.status(201).json({ id: this.lastID, name });
    }
  );
});

insuranceRouter.put('/payers/:id', (req: Request, res: Response) => {
  const { name, type, code, contact_person, phone, email, address, billing_cycle_note, payment_terms_days, status } = req.body;
  const user = (req as any).user;
  db.run(
    `UPDATE payers SET name=?, type=?, code=?, contact_person=?, phone=?, email=?, address=?, billing_cycle_note=?, payment_terms_days=?, status=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=? AND is_deleted=0`,
    [name, type, code, contact_person, phone, email, address, billing_cycle_note, payment_terms_days, status || 'active', user?.username, req.params.id],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Payer not found' });
      logInsuranceAudit(req, 'PAYER_UPDATE', `Updated payer ID ${req.params.id}`);
      res.json({ success: true });
    }
  );
});

insuranceRouter.delete('/payers/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  db.run(`UPDATE payers SET is_deleted=1, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`, [user?.username, req.params.id], (_err) => {
    logInsuranceAudit(req, 'PAYER_DELETE', `Soft-deleted payer ID ${req.params.id}`);
    res.json({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// INSURANCE PLANS
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/plans', (req: Request, res: Response) => {
  const { payer_id } = req.query;
  let sql = `SELECT ip.*, p.name as payer_name FROM insurance_plans ip JOIN payers p ON p.id = ip.payer_id WHERE ip.is_deleted = 0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND ip.payer_id = ?`; params.push(payer_id); }
  sql += ` ORDER BY p.name, ip.plan_name`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.post('/plans', (req: Request, res: Response) => {
  const { payer_id, plan_name, plan_code, copay_type, copay_value, annual_limit_kobo, requires_referral, notes } = req.body;
  if (!payer_id || !plan_name) return res.status(400).json({ error: 'payer_id and plan_name required' });
  const user = (req as any).user;
  db.run(
    `INSERT INTO insurance_plans (payer_id, plan_name, plan_code, copay_type, copay_value, annual_limit_kobo, requires_referral, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [payer_id, plan_name, plan_code || null, copay_type || 'NONE', copay_value || 0, annual_limit_kobo || 0, requires_referral ? 1 : 0, notes || null, user?.username],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logInsuranceAudit(req, 'PLAN_CREATE', `Created plan: ${plan_name}`);
      res.status(201).json({ id: this.lastID });
    }
  );
});

insuranceRouter.put('/plans/:id', (req: Request, res: Response) => {
  const { plan_name, plan_code, copay_type, copay_value, annual_limit_kobo, requires_referral, notes, status } = req.body;
  const user = (req as any).user;
  db.run(
    `UPDATE insurance_plans SET plan_name=?, plan_code=?, copay_type=?, copay_value=?, annual_limit_kobo=?, requires_referral=?, notes=?, status=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=? AND is_deleted=0`,
    [plan_name, plan_code, copay_type, copay_value, annual_limit_kobo, requires_referral ? 1 : 0, notes, status || 'active', user?.username, req.params.id],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Plan not found' });
      res.json({ success: true });
    }
  );
});

insuranceRouter.delete('/plans/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  db.run(`UPDATE insurance_plans SET is_deleted=1, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`, [user?.username, req.params.id], (_err) => res.json({ success: true }));
});

// ═══════════════════════════════════════════════════════════════════
// TARIFFS
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/tariffs', (req: Request, res: Response) => {
  const { payer_id, plan_id, item_type } = req.query;
  let sql = `SELECT pt.*, p.name as payer_name, ip.plan_name FROM payer_tariffs pt JOIN payers p ON p.id=pt.payer_id LEFT JOIN insurance_plans ip ON ip.id=pt.plan_id WHERE pt.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND pt.payer_id=?`; params.push(payer_id); }
  if (plan_id) { sql += ` AND pt.plan_id=?`; params.push(plan_id); }
  if (item_type) { sql += ` AND pt.item_type=?`; params.push(item_type); }
  sql += ` ORDER BY p.name, pt.item_type`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/tariffs/lookup', (req: Request, res: Response) => {
  const { payer_id, plan_id, item_ref_id } = req.query;
  if (!payer_id || !item_ref_id) return res.status(400).json({ error: 'payer_id and item_ref_id required' });
  db.get(
    `SELECT * FROM payer_tariffs WHERE payer_id=? AND item_ref_id=? AND is_deleted=0 ORDER BY (CASE WHEN plan_id=? THEN 0 ELSE 1 END) LIMIT 1`,
    [payer_id, item_ref_id, plan_id || null],
    (err, row) => { if (err) return res.status(500).json({ error: err.message }); res.json(row || null); }
  );
});

insuranceRouter.get('/tariffs/template', (_req: Request, res: Response) => {
  const csvContent =
    'item_type,item_ref_id,item_description,payer_price_naira,covered,requires_preauth,quantity_limit\r\n' +
    'SERVICE,CONS-GEN,General Eye Consultation,3500,1,0,\r\n' +
    'SERVICE,SURG-CAT,Cataract Surgery (Phacoemulsification),85000,1,1,1\r\n' +
    'MEDICATION,MED-TIM,Timolol 0.5% Eye Drops 5ml,1500,1,0,2\r\n' +
    'MEDICATION,MED-CIP,Ciprofloxacin Eye Drops,2200,1,0,2\r\n' +
    'OPTICAL,OPT-CR39,Single Vision CR-39 Lenses,12000,1,1,1\r\n' +
    'LAB,LAB-FBC,Full Blood Count,3000,1,0,\r\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hmo_tariff_template.csv"');
  res.status(200).send(csvContent);
});

insuranceRouter.post('/tariffs/import', async (req: Request, res: Response) => {
  const { payer_id, plan_id, rows } = req.body;
  if (!payer_id) return res.status(400).json({ error: 'payer_id is required' });
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No tariff rows provided' });
  }

  const user = (req as any).user;
  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    await dbRun('BEGIN TRANSACTION');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const itemType = (row.item_type || 'SERVICE').toUpperCase().trim();
      const itemRefId = (row.item_ref_id || row.item_code || '').trim();
      const itemDesc = (row.item_description || row.description || itemRefId).trim();

      if (!itemRefId) {
        errorCount++;
        errors.push(`Row ${i + 1}: Missing item code/reference ID`);
        continue;
      }

      let priceKobo = 0;
      if (row.payer_price_kobo !== undefined && row.payer_price_kobo !== null) {
        priceKobo = Math.round(Number(row.payer_price_kobo));
      } else if (row.payer_price_naira !== undefined && row.payer_price_naira !== null) {
        priceKobo = Math.round(Number(row.payer_price_naira) * 100);
      } else if (row.price !== undefined && row.price !== null) {
        priceKobo = Math.round(Number(row.price) * 100);
      }

      const covered = row.covered === false || row.covered === 0 || row.covered === '0' || row.is_covered === false ? 0 : 1;
      const requiresPreauth = row.requires_preauth === true || row.requires_preauth === 1 || row.requires_preauth === '1' || row.requires_authorization === true ? 1 : 0;
      const quantityLimit = row.quantity_limit ? Number(row.quantity_limit) : null;

      try {
        let existing: any = null;
        if (plan_id) {
          existing = await dbGet(
            `SELECT id FROM payer_tariffs WHERE payer_id = ? AND item_ref_id = ? AND plan_id = ? AND is_deleted = 0 LIMIT 1`,
            [payer_id, itemRefId, plan_id]
          );
        } else {
          existing = await dbGet(
            `SELECT id FROM payer_tariffs WHERE payer_id = ? AND item_ref_id = ? AND plan_id IS NULL AND is_deleted = 0 LIMIT 1`,
            [payer_id, itemRefId]
          );
        }

        if (existing) {
          await dbRun(
            `UPDATE payer_tariffs 
             SET item_type = ?, item_description = COALESCE(?, item_description),
                 payer_price_kobo = ?, covered = ?, requires_preauth = ?, quantity_limit = ?,
                 updated_at = CURRENT_TIMESTAMP, updated_by = ?
             WHERE id = ?`,
            [itemType, itemDesc, priceKobo, covered, requiresPreauth, quantityLimit, user?.username || 'Admin', existing.id]
          );
          updatedCount++;
        } else {
          await dbRun(
            `INSERT INTO payer_tariffs 
             (payer_id, plan_id, item_type, item_ref_id, item_description, payer_price_kobo, covered, requires_preauth, quantity_limit, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payer_id, plan_id || null, itemType, itemRefId, itemDesc, priceKobo, covered, requiresPreauth, quantityLimit, user?.username || 'Admin']
          );
          createdCount++;
        }
      } catch (rowErr: any) {
        errorCount++;
        errors.push(`Row ${i + 1} (${itemRefId}): ${rowErr.message}`);
      }
    }

    await dbRun('COMMIT');
    logInsuranceAudit(req, 'TARIFF_BULK_IMPORT', `Bulk imported tariffs for payer ID ${payer_id}: ${createdCount} created, ${updatedCount} updated, ${errorCount} errors`);

    res.json({
      success: true,
      total: rows.length,
      created: createdCount,
      updated: updatedCount,
      failed: errorCount,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    try { await dbRun('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: 'Bulk tariff import failed: ' + err.message });
  }
});

insuranceRouter.post('/tariffs', (req: Request, res: Response) => {
  const { payer_id, plan_id, item_type, item_ref_id, item_description, payer_price_kobo, covered, requires_preauth, quantity_limit, effective_from, effective_to } = req.body;
  if (!payer_id || !item_type || !item_ref_id) return res.status(400).json({ error: 'payer_id, item_type, item_ref_id required' });
  const user = (req as any).user;
  db.run(
    `INSERT INTO payer_tariffs (payer_id, plan_id, item_type, item_ref_id, item_description, payer_price_kobo, covered, requires_preauth, quantity_limit, effective_from, effective_to, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [payer_id, plan_id || null, item_type, item_ref_id, item_description || null, payer_price_kobo || 0, covered !== false ? 1 : 0, requires_preauth ? 1 : 0, quantity_limit || null, effective_from || null, effective_to || null, user?.username],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logInsuranceAudit(req, 'TARIFF_CREATE', `Tariff added for item ${item_ref_id} payer ${payer_id}`);
      res.status(201).json({ id: this.lastID });
    }
  );
});

insuranceRouter.put('/tariffs/:id', (req: Request, res: Response) => {
  const { payer_price_kobo, covered, requires_preauth, quantity_limit, effective_from, effective_to, item_description } = req.body;
  const user = (req as any).user;
  db.run(
    `UPDATE payer_tariffs SET payer_price_kobo=?, covered=?, requires_preauth=?, quantity_limit=?, effective_from=?, effective_to=?, item_description=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=? AND is_deleted=0`,
    [payer_price_kobo, covered !== false ? 1 : 0, requires_preauth ? 1 : 0, quantity_limit || null, effective_from || null, effective_to || null, item_description || null, user?.username, req.params.id],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Tariff not found' });
      logInsuranceAudit(req, 'TARIFF_UPDATE', `Tariff ID ${req.params.id} updated`);
      res.json({ success: true });
    }
  );
});

insuranceRouter.delete('/tariffs/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  db.run(`UPDATE payer_tariffs SET is_deleted=1, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`, [user?.username, req.params.id], (_err) => res.json({ success: true }));
});

// ═══════════════════════════════════════════════════════════════════
// ENROLLEES
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/enrollees', (req: Request, res: Response) => {
  const { patient_id, payer_id } = req.query;
  let sql = `SELECT e.*, p.full_name as patient_name, py.name as payer_name, ip.plan_name FROM enrollees e JOIN patients p ON p.id=e.patient_id JOIN payers py ON py.id=e.payer_id LEFT JOIN insurance_plans ip ON ip.id=e.plan_id WHERE e.is_deleted=0`;
  const params: any[] = [];
  if (patient_id) { sql += ` AND e.patient_id=?`; params.push(patient_id); }
  if (payer_id) { sql += ` AND e.payer_id=?`; params.push(payer_id); }
  sql += ` ORDER BY e.created_at DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/enrollees/:id', (req: Request, res: Response) => {
  db.get(
    `SELECT e.*, p.full_name as patient_name, py.name as payer_name, ip.plan_name, ip.copay_type, ip.copay_value FROM enrollees e JOIN patients p ON p.id=e.patient_id JOIN payers py ON py.id=e.payer_id LEFT JOIN insurance_plans ip ON ip.id=e.plan_id WHERE e.id=? AND e.is_deleted=0`,
    [req.params.id], (err, row) => { if (err) return res.status(500).json({ error: err.message }); if (!row) return res.status(404).json({ error: 'Enrollee not found' }); res.json(row); }
  );
});

insuranceRouter.post('/enrollees', (req: Request, res: Response) => {
  const { patient_id, payer_id, plan_id, enrollee_number, relationship, principal_name, organisation, valid_from, valid_to, notes } = req.body;
  if (!patient_id || !payer_id || !enrollee_number) return res.status(400).json({ error: 'patient_id, payer_id, enrollee_number required' });
  const user = (req as any).user;
  db.get(`SELECT id FROM enrollees WHERE enrollee_number=? AND payer_id=? AND is_deleted=0`, [enrollee_number, payer_id], (err, existing: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: `Enrollee number already registered (ID ${existing.id})` });
    db.run(
      `INSERT INTO enrollees (patient_id, payer_id, plan_id, enrollee_number, relationship, principal_name, organisation, valid_from, valid_to, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, payer_id, plan_id || null, enrollee_number, relationship || 'PRINCIPAL', principal_name || null, organisation || null, valid_from || null, valid_to || null, notes || null, user?.username],
      function (this: any, err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        logInsuranceAudit(req, 'ENROLLEE_CREATE', `Enrollee ${enrollee_number} for patient ${patient_id}`);
        res.status(201).json({ id: this.lastID });
      }
    );
  });
});

insuranceRouter.put('/enrollees/:id', (req: Request, res: Response) => {
  const { plan_id, enrollee_number, relationship, principal_name, organisation, valid_from, valid_to, notes, is_active } = req.body;
  const user = (req as any).user;
  db.run(
    `UPDATE enrollees SET plan_id=?, enrollee_number=?, relationship=?, principal_name=?, organisation=?, valid_from=?, valid_to=?, notes=?, is_active=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=? AND is_deleted=0`,
    [plan_id || null, enrollee_number, relationship, principal_name, organisation, valid_from, valid_to, notes, is_active !== undefined ? (is_active ? 1 : 0) : 1, user?.username, req.params.id],
    function (this: any, err) { if (err) return res.status(500).json({ error: err.message }); if (this.changes === 0) return res.status(404).json({ error: 'Not found' }); res.json({ success: true }); }
  );
});

insuranceRouter.patch('/enrollees/:id/verify', (req: Request, res: Response) => {
  const { verification_status, notes } = req.body;
  if (!['VERIFIED', 'REJECTED', 'EXPIRED', 'UNVERIFIED'].includes(verification_status)) return res.status(400).json({ error: 'Invalid verification_status' });
  const user = (req as any).user;
  db.run(
    `UPDATE enrollees SET verification_status=?, verified_by=?, verified_at=CURRENT_TIMESTAMP, notes=COALESCE(?, notes), updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=? AND is_deleted=0`,
    [verification_status, user?.username, notes || null, user?.username, req.params.id],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      logInsuranceAudit(req, 'ENROLLEE_VERIFY', `Enrollee ${req.params.id} → ${verification_status} by ${user?.username}`);
      res.json({ success: true });
    }
  );
});

// ═══════════════════════════════════════════════════════════════════
// AUTHORIZATIONS
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/authorizations', (req: Request, res: Response) => {
  const { patient_id, payer_id, visit_id, status } = req.query;
  let sql = `SELECT a.*, p.full_name as patient_name, py.name as payer_name, e.enrollee_number FROM authorizations a JOIN patients p ON p.id=a.patient_id JOIN payers py ON py.id=a.payer_id JOIN enrollees e ON e.id=a.enrollee_id WHERE a.is_deleted=0`;
  const params: any[] = [];
  if (patient_id) { sql += ` AND a.patient_id=?`; params.push(patient_id); }
  if (payer_id) { sql += ` AND a.payer_id=?`; params.push(payer_id); }
  if (visit_id) { sql += ` AND a.visit_id=?`; params.push(visit_id); }
  if (status) { sql += ` AND a.status=?`; params.push(status); }
  sql += ` ORDER BY a.requested_at DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.post('/authorizations', (req: Request, res: Response) => {
  const { visit_id, patient_id, enrollee_id, payer_id, requested_services, notes } = req.body;
  if (!patient_id || !enrollee_id || !payer_id) return res.status(400).json({ error: 'patient_id, enrollee_id, payer_id required' });
  const user = (req as any).user;
  db.run(
    `INSERT INTO authorizations (visit_id, patient_id, enrollee_id, payer_id, requested_services, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [visit_id || null, patient_id, enrollee_id, payer_id, requested_services ? JSON.stringify(requested_services) : null, notes || null, user?.username],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logInsuranceAudit(req, 'AUTH_REQUEST', `Auth requested patient ${patient_id} visit ${visit_id}`);
      res.status(201).json({ id: this.lastID });
    }
  );
});

insuranceRouter.patch('/authorizations/:id/decision', (req: Request, res: Response) => {
  const { status, auth_code, approved_amount_kobo, valid_until, notes } = req.body;
  if (!['APPROVED', 'PARTIAL', 'DENIED', 'EXPIRED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const user = (req as any).user;
  db.run(
    `UPDATE authorizations SET status=?, auth_code=?, approved_amount_kobo=?, valid_until=?, notes=COALESCE(?,notes), decided_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=? AND is_deleted=0`,
    [status, auth_code || null, approved_amount_kobo || 0, valid_until || null, notes || null, user?.username, req.params.id],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      logInsuranceAudit(req, 'AUTH_DECISION', `Auth ${req.params.id}: ${status}`);
      res.json({ success: true });
    }
  );
});

// ═══════════════════════════════════════════════════════════════════
// CLAIMS LIST + SUMMARY
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/claims/summary', (_req: Request, res: Response) => {
  db.all(`SELECT status, COUNT(*) as count, SUM(claimed_amount_kobo) as total_kobo, SUM(outstanding_amount_kobo) as outstanding_kobo FROM claims WHERE is_deleted=0 GROUP BY status`, [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/claims', (req: Request, res: Response) => {
  const { payer_id, plan_id, status, date_from, date_to, claim_date_from, claim_date_to, patient_name, file_no, enrollee_number, claim_number, batch_id } = req.query;
  let sql = `SELECT c.*, py.name as payer_name, ip.plan_name, p.full_name as patient_full_name, p.id as file_no, e.enrollee_number, cb.batch_number,
     CAST((julianday('now')-julianday(c.submitted_at)) AS INTEGER) as days_since_submission,
     py.payment_terms_days,
     CASE WHEN c.status IN ('SUBMITTED','UNDER_REVIEW') AND (julianday('now')-julianday(c.submitted_at)) > py.payment_terms_days THEN 1 ELSE 0 END as is_overdue
     FROM claims c JOIN payers py ON py.id=c.payer_id LEFT JOIN insurance_plans ip ON ip.id=c.plan_id JOIN patients p ON p.id=c.patient_id JOIN enrollees e ON e.id=c.enrollee_id LEFT JOIN claim_batches cb ON cb.id=c.batch_id WHERE c.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND c.payer_id=?`; params.push(payer_id); }
  if (plan_id) { sql += ` AND c.plan_id=?`; params.push(plan_id); }
  if (status) { sql += ` AND c.status=?`; params.push(status); }
  if (date_from) { sql += ` AND c.service_date>=?`; params.push(date_from); }
  if (date_to) { sql += ` AND c.service_date<=?`; params.push(date_to); }
  if (claim_date_from) { sql += ` AND c.claim_date>=?`; params.push(claim_date_from); }
  if (claim_date_to) { sql += ` AND c.claim_date<=?`; params.push(claim_date_to); }
  if (patient_name) { sql += ` AND p.full_name LIKE ?`; params.push(`%${patient_name}%`); }
  if (file_no) { sql += ` AND p.id LIKE ?`; params.push(`%${file_no}%`); }
  if (enrollee_number) { sql += ` AND e.enrollee_number LIKE ?`; params.push(`%${enrollee_number}%`); }
  if (claim_number) { sql += ` AND c.claim_number LIKE ?`; params.push(`%${claim_number}%`); }
  if (batch_id) { sql += ` AND c.batch_id=?`; params.push(batch_id); }
  sql += ` ORDER BY c.created_at DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/claims/:id', (req: Request, res: Response) => {
  db.get(
    `SELECT c.*, py.name as payer_name, py.payment_terms_days, ip.plan_name, ip.copay_type, ip.copay_value,
     p.full_name as patient_name, p.id as file_no, e.enrollee_number, e.relationship, e.principal_name, e.verification_status,
     a.auth_code, a.status as auth_status, a.approved_amount_kobo as auth_approved_kobo, cb.batch_number
     FROM claims c JOIN payers py ON py.id=c.payer_id LEFT JOIN insurance_plans ip ON ip.id=c.plan_id
     JOIN patients p ON p.id=c.patient_id JOIN enrollees e ON e.id=c.enrollee_id
     LEFT JOIN authorizations a ON a.id=c.authorization_id LEFT JOIN claim_batches cb ON cb.id=c.batch_id
     WHERE c.id=? AND c.is_deleted=0`,
    [req.params.id],
    (err, claim: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!claim) return res.status(404).json({ error: 'Claim not found' });
      db.all(`SELECT * FROM claim_items WHERE claim_id=? ORDER BY id`, [req.params.id], (_e2, items) => {
        db.all(`SELECT * FROM claim_status_history WHERE claim_id=? ORDER BY changed_at ASC`, [req.params.id], (_e3, history) => {
          res.json({ ...claim, items: items || [], history: history || [] });
        });
      });
    }
  );
});

insuranceRouter.post('/claims', (req: Request, res: Response) => {
  const { payer_id, plan_id, enrollee_id, patient_id, visit_id, transaction_id, authorization_id, service_date, primary_diagnosis_code, primary_diagnosis_text, secondary_diagnosis_codes, notes, items } = req.body;
  if (!payer_id || !enrollee_id || !patient_id || !service_date) return res.status(400).json({ error: 'payer_id, enrollee_id, patient_id, service_date required' });
  db.get(`SELECT id FROM claims WHERE visit_id=? AND payer_id=? AND status NOT IN ('CANCELLED','WRITTEN_OFF') AND is_deleted=0 AND visit_id IS NOT NULL`, [visit_id, payer_id], (err, existing: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing && visit_id) return res.status(409).json({ error: `Claim already exists for this visit (ID ${existing.id})` });
    generateClaimNumber((claimNumber) => {
      const user = (req as any).user;
      const today = new Date().toISOString().split('T')[0];
      const totalBilled = (items || []).reduce((s: number, i: any) => s + (i.line_total_kobo || 0), 0);
      const claimed = (items || []).reduce((s: number, i: any) => s + (i.covered_amount_kobo || i.line_total_kobo || 0), 0);
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION');
        db.run(
          `INSERT INTO claims (claim_number, payer_id, plan_id, enrollee_id, patient_id, visit_id, transaction_id, authorization_id, claim_date, service_date, primary_diagnosis_code, primary_diagnosis_text, secondary_diagnosis_codes, total_billed_kobo, claimed_amount_kobo, outstanding_amount_kobo, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [claimNumber, payer_id, plan_id || null, enrollee_id, patient_id, visit_id || null, transaction_id || null, authorization_id || null, today, service_date, primary_diagnosis_code || null, primary_diagnosis_text || null, secondary_diagnosis_codes ? JSON.stringify(secondary_diagnosis_codes) : null, totalBilled, claimed, claimed, notes || null, user?.username],
          function (this: any, err2) {
            if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: err2.message }); }
            const claimId = this.lastID;
            const stmt = db.prepare(`INSERT INTO claim_items (claim_id, item_type, item_ref_id, description, quantity, unit_price_kobo, line_total_kobo, covered_amount_kobo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            (items || []).forEach((item: any) => { stmt.run(claimId, item.item_type || null, item.item_ref_id || null, item.description, item.quantity || 1, item.unit_price_kobo || 0, item.line_total_kobo || 0, item.covered_amount_kobo || item.line_total_kobo || 0); });
            stmt.finalize();
            db.run(`INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by, reason) VALUES (?, null, 'DRAFT', ?, 'Claim created')`, [claimId, user?.username]);
            if (transaction_id) db.run(`UPDATE transactions SET claim_id=? WHERE id=?`, [claimId, transaction_id]);
            db.run('COMMIT', (cErr) => {
              if (cErr) return res.status(500).json({ error: cErr.message });
              logInsuranceAudit(req, 'CLAIM_CREATE', `Created ${claimNumber} for patient ${patient_id}`);
              res.status(201).json({ id: claimId, claim_number: claimNumber });
            });
          }
        );
      });
    });
  });
});

insuranceRouter.put('/claims/:id', (req: Request, res: Response) => {
  const { primary_diagnosis_code, primary_diagnosis_text, secondary_diagnosis_codes, notes, authorization_id } = req.body;
  const user = (req as any).user;
  db.get(`SELECT status FROM claims WHERE id=? AND is_deleted=0`, [req.params.id], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (LOCKED_STATUSES.has(row.status)) return res.status(409).json({ error: `Claim locked (${row.status})` });
    db.run(
      `UPDATE claims SET primary_diagnosis_code=?, primary_diagnosis_text=?, secondary_diagnosis_codes=?, notes=?, authorization_id=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`,
      [primary_diagnosis_code, primary_diagnosis_text, secondary_diagnosis_codes ? JSON.stringify(secondary_diagnosis_codes) : null, notes, authorization_id || null, user?.username, req.params.id],
      (err2) => { if (err2) return res.status(500).json({ error: err2.message }); res.json({ success: true }); }
    );
  });
});

insuranceRouter.put('/claims/:id/items', (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
  db.get(`SELECT status FROM claims WHERE id=? AND is_deleted=0`, [req.params.id], (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (LOCKED_STATUSES.has(row.status)) return res.status(409).json({ error: `Claim locked (${row.status})` });
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      db.run(`DELETE FROM claim_items WHERE claim_id=?`, [req.params.id]);
      const stmt = db.prepare(`INSERT INTO claim_items (claim_id, item_type, item_ref_id, description, quantity, unit_price_kobo, line_total_kobo, covered_amount_kobo, rejection_reason_code, rejection_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      let totalBilled = 0; let claimed = 0;
      items.forEach((item: any) => { stmt.run(req.params.id, item.item_type, item.item_ref_id, item.description, item.quantity || 1, item.unit_price_kobo || 0, item.line_total_kobo || 0, item.covered_amount_kobo || 0, item.rejection_reason_code || null, item.rejection_note || null); totalBilled += item.line_total_kobo || 0; claimed += item.covered_amount_kobo || 0; });
      stmt.finalize();
      db.run(`UPDATE claims SET total_billed_kobo=?, claimed_amount_kobo=?, outstanding_amount_kobo=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [totalBilled, claimed, claimed, req.params.id], (err2) => {
        if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: err2.message }); }
        db.run('COMMIT', () => res.json({ success: true }));
      });
    });
  });
});

// ══ STATE MACHINE TRANSITION ══
insuranceRouter.patch('/claims/:id/transition', (req: Request, res: Response) => {
  const { to_status, reason, per_line_decisions } = req.body;
  if (!to_status) return res.status(400).json({ error: 'to_status required' });
  const user = (req as any).user;
  db.get(`SELECT * FROM claims WHERE id=? AND is_deleted=0`, [req.params.id], (err, claim: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    const allowed = LEGAL_TRANSITIONS[claim.status] || [];
    if (!allowed.includes(to_status)) return res.status(422).json({ error: `Illegal transition: ${claim.status} → ${to_status}. Allowed: [${allowed.join(', ')}]` });
    if (REASON_REQUIRED.has(to_status) && !reason) return res.status(400).json({ error: `Reason mandatory for ${to_status}` });
    if (to_status === 'READY' && !claim.primary_diagnosis_code) return res.status(422).json({ error: 'primary_diagnosis_code required before READY' });

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      let approved = claim.approved_amount_kobo || 0;
      let rejected = claim.rejected_amount_kobo || 0;
      let outstanding = claim.outstanding_amount_kobo || 0;
      let finalStatus = to_status;

      if (Array.isArray(per_line_decisions) && ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'].includes(to_status)) {
        const updStmt = db.prepare(`UPDATE claim_items SET covered_amount_kobo=?, rejected_amount_kobo=?, rejection_reason_code=?, rejection_note=? WHERE id=? AND claim_id=?`);
        approved = 0; rejected = 0;
        per_line_decisions.forEach((d: any) => { updStmt.run(d.covered_amount_kobo || 0, d.rejected_amount_kobo || 0, d.rejection_reason_code || null, d.rejection_note || null, d.item_id, req.params.id); approved += d.covered_amount_kobo || 0; rejected += d.rejected_amount_kobo || 0; });
        updStmt.finalize();
        if (rejected === 0) finalStatus = 'APPROVED';
        else if (approved === 0) finalStatus = 'REJECTED';
        else finalStatus = 'PARTIALLY_APPROVED';
        outstanding = approved - (claim.paid_amount_kobo || 0);
      }

      db.run(
        `UPDATE claims SET status=?, approved_amount_kobo=?, rejected_amount_kobo=?, outstanding_amount_kobo=?,
         submitted_at=CASE WHEN ?='SUBMITTED' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
         submitted_by=CASE WHEN ?='SUBMITTED' THEN ? ELSE submitted_by END,
         decision_at=CASE WHEN ? IN ('APPROVED','PARTIALLY_APPROVED','REJECTED') THEN CURRENT_TIMESTAMP ELSE decision_at END,
         updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`,
        [finalStatus, approved, rejected, outstanding, to_status, to_status, user?.username, to_status, user?.username, req.params.id],
        (err2) => {
          if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: err2.message }); }
          db.run(`INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)`, [req.params.id, claim.status, finalStatus, user?.username, reason || null], (err3) => {
            if (err3) { db.run('ROLLBACK'); return res.status(500).json({ error: err3.message }); }
            db.run('COMMIT', () => {
              logInsuranceAudit(req, 'CLAIM_TRANSITION', `Claim ${claim.claim_number}: ${claim.status}→${finalStatus}`);
              res.json({ success: true, new_status: finalStatus, approved_amount_kobo: approved, rejected_amount_kobo: rejected, outstanding_amount_kobo: outstanding });
            });
          });
        }
      );
    });
  });
});

// Write-off
insuranceRouter.patch('/claims/:id/write-off', (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason mandatory for write-off' });
  const user = (req as any).user;
  db.get(`SELECT * FROM claims WHERE id=? AND is_deleted=0`, [req.params.id], (err, claim: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!claim) return res.status(404).json({ error: 'Not found' });
    if (!(LEGAL_TRANSITIONS[claim.status] || []).includes('WRITTEN_OFF')) return res.status(422).json({ error: `Cannot write off from ${claim.status}` });
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      db.run(`UPDATE claims SET status='WRITTEN_OFF', outstanding_amount_kobo=0, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`, [user?.username, req.params.id], (err2) => {
        if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: err2.message }); }
        db.run(`INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by, reason) VALUES (?, ?, 'WRITTEN_OFF', ?, ?)`, [req.params.id, claim.status, user?.username, reason], () => {
          db.run('COMMIT', () => { logInsuranceAudit(req, 'CLAIM_WRITEOFF', `Claim ${claim.claim_number} written off: ${reason}`); res.json({ success: true }); });
        });
      });
    });
  });
});

insuranceRouter.post('/claims/:id/notes', (req: Request, res: Response) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note required' });
  db.run(`UPDATE claims SET notes=COALESCE(notes||char(10),'')|| ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [`[${new Date().toISOString()}] ${note}`, req.params.id], (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); });
});

// ═══════════════════════════════════════════════════════════════════
// BATCHES
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/batches', (req: Request, res: Response) => {
  const { payer_id, status } = req.query;
  let sql = `SELECT cb.*, p.name as payer_name FROM claim_batches cb JOIN payers p ON p.id=cb.payer_id WHERE 1=1`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND cb.payer_id=?`; params.push(payer_id); }
  if (status) { sql += ` AND cb.status=?`; params.push(status); }
  sql += ` ORDER BY cb.created_at DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.post('/batches', (req: Request, res: Response) => {
  const { payer_id, claim_ids, period_from, period_to } = req.body;
  if (!payer_id || !Array.isArray(claim_ids) || claim_ids.length === 0) return res.status(400).json({ error: 'payer_id and claim_ids required' });
  const user = (req as any).user;
  generateBatchNumber(Number(payer_id), (batchNumber) => {
    const ph = claim_ids.map(() => '?').join(',');
    db.all(`SELECT id, claimed_amount_kobo FROM claims WHERE id IN (${ph}) AND payer_id=? AND status='READY' AND is_deleted=0 AND batch_id IS NULL`, [...claim_ids, payer_id], (err, eligible: any[]) => {
      if (err) return res.status(500).json({ error: err.message });
      if (eligible.length === 0) return res.status(422).json({ error: 'No eligible READY claims found' });
      const totalClaimed = eligible.reduce((s, r) => s + (r.claimed_amount_kobo || 0), 0);
      db.run(`INSERT INTO claim_batches (batch_number, payer_id, period_from, period_to, claim_count, total_claimed_kobo, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [batchNumber, payer_id, period_from || null, period_to || null, eligible.length, totalClaimed, user?.username], function (this: any, err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        const batchId = this.lastID;
        const eligIds = eligible.map(r => r.id);
        db.run(`UPDATE claims SET batch_id=? WHERE id IN (${eligIds.map(() => '?').join(',')})`, [batchId, ...eligIds], () => {
          logInsuranceAudit(req, 'BATCH_CREATE', `Batch ${batchNumber}: ${eligible.length} claims`);
          res.status(201).json({ id: batchId, batch_number: batchNumber, claim_count: eligible.length, skipped: claim_ids.length - eligible.length });
        });
      });
    });
  });
});

insuranceRouter.patch('/batches/:id/submit', (req: Request, res: Response) => {
  const user = (req as any).user;
  db.get(`SELECT * FROM claim_batches WHERE id=?`, [req.params.id], (err, batch: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'OPEN') return res.status(409).json({ error: 'Batch already submitted or closed' });
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');
      db.run(`UPDATE claims SET status='SUBMITTED', submitted_at=CURRENT_TIMESTAMP, submitted_by=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE batch_id=? AND status='READY' AND is_deleted=0`, [user?.username, user?.username, req.params.id], function (this: any, err2) {
        if (err2) { db.run('ROLLBACK'); return res.status(500).json({ error: err2.message }); }
        const changed = this.changes;
        db.run(`UPDATE claim_batches SET status='SUBMITTED', submitted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`, [user?.username, req.params.id]);
        db.all(`SELECT id FROM claims WHERE batch_id=? AND status='SUBMITTED'`, [req.params.id], (_e, rows: any[]) => {
          rows.forEach(r => db.run(`INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by, reason) VALUES (?, 'READY','SUBMITTED',?,'Batch submission')`, [r.id, user?.username]));
        });
        db.run('COMMIT', () => { logInsuranceAudit(req, 'BATCH_SUBMIT', `Batch ${batch.batch_number}: ${changed} claims submitted`); res.json({ success: true, claims_submitted: changed }); });
      });
    });
  });
});

insuranceRouter.get('/batches/:id/claims', (req: Request, res: Response) => {
  db.all(`SELECT c.*, p.full_name as patient_name, e.enrollee_number FROM claims c JOIN patients p ON p.id=c.patient_id JOIN enrollees e ON e.id=c.enrollee_id WHERE c.batch_id=? AND c.is_deleted=0`, [req.params.id], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

// ═══════════════════════════════════════════════════════════════════
// REMITTANCES
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/remittances', (req: Request, res: Response) => {
  const { payer_id } = req.query;
  let sql = `SELECT r.*, p.name as payer_name FROM remittances r JOIN payers p ON p.id=r.payer_id WHERE r.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND r.payer_id=?`; params.push(payer_id); }
  sql += ` ORDER BY r.payment_date DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/remittances/:id', (req: Request, res: Response) => {
  db.get(`SELECT r.*, p.name as payer_name FROM remittances r JOIN payers p ON p.id=r.payer_id WHERE r.id=? AND r.is_deleted=0`, [req.params.id], (err, rem: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rem) return res.status(404).json({ error: 'Not found' });
    db.all(`SELECT ra.*, c.claim_number, pat.full_name as patient_name FROM remittance_allocations ra JOIN claims c ON c.id=ra.claim_id JOIN patients pat ON pat.id=c.patient_id WHERE ra.remittance_id=?`, [req.params.id], (err2, allocs) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ...rem, allocations: allocs });
    });
  });
});

insuranceRouter.post('/remittances', (req: Request, res: Response) => {
  const { payer_id, payment_date, amount_kobo, method, reference, notes } = req.body;
  if (!payer_id || !payment_date || !amount_kobo) return res.status(400).json({ error: 'payer_id, payment_date, amount_kobo required' });
  const user = (req as any).user;
  generateRemittanceNumber((remNum) => {
    db.run(`INSERT INTO remittances (remittance_number, payer_id, payment_date, amount_kobo, method, reference, notes, unallocated_amount_kobo, recorded_by, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [remNum, payer_id, payment_date, amount_kobo, method || 'BANK_TRANSFER', reference || null, notes || null, amount_kobo, user?.username, user?.username],
      function (this: any, err) {
        if (err) return res.status(500).json({ error: err.message });
        logInsuranceAudit(req, 'REMITTANCE_CREATE', `Remittance ${remNum}: ₦${(amount_kobo / 100).toLocaleString()}`);
        res.status(201).json({ id: this.lastID, remittance_number: remNum });
      }
    );
  });
});

insuranceRouter.post('/remittances/:id/allocate', (req: Request, res: Response) => {
  const { allocations } = req.body;
  if (!Array.isArray(allocations) || allocations.length === 0) return res.status(400).json({ error: 'allocations array required [{claim_id, amount_kobo}]' });
  const user = (req as any).user;
  db.get(`SELECT * FROM remittances WHERE id=? AND is_deleted=0`, [req.params.id], (err, rem: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rem) return res.status(404).json({ error: 'Remittance not found' });
    db.get(`SELECT COALESCE(SUM(amount_kobo),0) as already FROM remittance_allocations WHERE remittance_id=?`, [req.params.id], (_e, existing: any) => {
      const alreadyAllocated = existing?.already || 0;
      const newTotal = allocations.reduce((s: number, a: any) => s + (a.amount_kobo || 0), 0);
      if (alreadyAllocated + newTotal > rem.amount_kobo) return res.status(422).json({ error: `Over-allocation. Available: ₦${((rem.amount_kobo - alreadyAllocated) / 100).toLocaleString()}` });
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION');
        let pending = allocations.length; let errorOccurred = false;
        allocations.forEach((alloc: any) => {
          db.run(`INSERT INTO remittance_allocations (remittance_id, claim_id, amount_kobo, allocated_by) VALUES (?, ?, ?, ?)`, [req.params.id, alloc.claim_id, alloc.amount_kobo, user?.username], (err2) => {
            if (err2) errorOccurred = true;
            else {
              db.run(`UPDATE claims SET paid_amount_kobo=paid_amount_kobo+?, outstanding_amount_kobo=outstanding_amount_kobo-?,
                status=CASE WHEN (outstanding_amount_kobo-?)<=0 THEN 'PAID' WHEN status IN ('APPROVED','PARTIALLY_APPROVED') AND (outstanding_amount_kobo-?)>0 THEN 'PARTIALLY_PAID' ELSE status END,
                updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=?`,
                [alloc.amount_kobo, alloc.amount_kobo, alloc.amount_kobo, alloc.amount_kobo, user?.username, alloc.claim_id]);
            }
            pending--;
            if (pending === 0) {
              if (errorOccurred) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Allocation failed' }); }
              db.run(`UPDATE remittances SET unallocated_amount_kobo=amount_kobo-(SELECT COALESCE(SUM(amount_kobo),0) FROM remittance_allocations WHERE remittance_id=?), updated_at=CURRENT_TIMESTAMP WHERE id=?`, [req.params.id, req.params.id], () => {
                db.run('COMMIT', () => { logInsuranceAudit(req, 'REMITTANCE_ALLOCATE', `Allocated ₦${(newTotal / 100).toLocaleString()} across ${allocations.length} claims`); res.json({ success: true, allocated_kobo: newTotal }); });
              });
            }
          });
        });
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// LOOKUP / REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/rejection-reasons', (_req: Request, res: Response) => {
  db.all(`SELECT * FROM rejection_reasons WHERE active=1 ORDER BY description`, [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/icd10', (req: Request, res: Response) => {
  const { q } = req.query;
  let sql = `SELECT code, description, chapter FROM icd10_codes WHERE active=1`;
  const params: any[] = [];
  if (q) { sql += ` AND (code LIKE ? OR description LIKE ?)`; params.push(`%${q}%`, `%${q}%`); }
  sql += ` ORDER BY code LIMIT 100`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.post('/icd10/import', (req: Request, res: Response) => {
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length === 0) return res.status(400).json({ error: 'codes array required' });
  const stmt = db.prepare(`INSERT OR REPLACE INTO icd10_codes (code, description, chapter) VALUES (?, ?, ?)`);
  let count = 0;
  codes.forEach((c: any) => { if (c.code && c.description) { stmt.run(c.code, c.description, c.chapter || null); count++; } });
  stmt.finalize(() => { logInsuranceAudit(req, 'ICD10_IMPORT', `Imported ${count} codes`); res.json({ success: true, imported: count }); });
});

insuranceRouter.get('/settings', (_req: Request, res: Response) => {
  db.get(`SELECT * FROM insurance_settings WHERE id=1`, [], (err, row) => { if (err) return res.status(500).json({ error: err.message }); res.json(row || {}); });
});

insuranceRouter.put('/settings', (req: Request, res: Response) => {
  const { claim_number_prefix, batch_number_prefix, default_payment_terms_days, export_template } = req.body;
  const user = (req as any).user;
  db.run(`UPDATE insurance_settings SET claim_number_prefix=?, batch_number_prefix=?, default_payment_terms_days=?, export_template=?, updated_at=CURRENT_TIMESTAMP, updated_by=? WHERE id=1`,
    [claim_number_prefix || 'CLM', batch_number_prefix || 'BCH', default_payment_terms_days || 30, export_template ? JSON.stringify(export_template) : null, user?.username],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }
  );
});

// ═══════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/reports/claims-register', (req: Request, res: Response) => {
  const { payer_id, date_from, date_to } = req.query;
  let sql = `SELECT c.claim_number, c.service_date, c.claim_date, c.status, p.full_name as patient_name, p.id as file_no, e.enrollee_number, py.name as payer_name, ip.plan_name, c.total_billed_kobo, c.claimed_amount_kobo, c.approved_amount_kobo, c.paid_amount_kobo, c.outstanding_amount_kobo, c.primary_diagnosis_code FROM claims c JOIN patients p ON p.id=c.patient_id JOIN payers py ON py.id=c.payer_id LEFT JOIN insurance_plans ip ON ip.id=c.plan_id JOIN enrollees e ON e.id=c.enrollee_id WHERE c.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND c.payer_id=?`; params.push(payer_id); }
  if (date_from) { sql += ` AND c.service_date>=?`; params.push(date_from); }
  if (date_to) { sql += ` AND c.service_date<=?`; params.push(date_to); }
  sql += ` ORDER BY py.name, c.service_date DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/reports/ageing', (_req: Request, res: Response) => {
  db.all(`SELECT py.name as payer_name, py.id as payer_id,
     SUM(CASE WHEN (julianday('now')-julianday(c.submitted_at))<=30 THEN c.outstanding_amount_kobo ELSE 0 END) as "0_30",
     SUM(CASE WHEN (julianday('now')-julianday(c.submitted_at)) BETWEEN 31 AND 60 THEN c.outstanding_amount_kobo ELSE 0 END) as "31_60",
     SUM(CASE WHEN (julianday('now')-julianday(c.submitted_at)) BETWEEN 61 AND 90 THEN c.outstanding_amount_kobo ELSE 0 END) as "61_90",
     SUM(CASE WHEN (julianday('now')-julianday(c.submitted_at))>90 THEN c.outstanding_amount_kobo ELSE 0 END) as "over_90",
     SUM(c.outstanding_amount_kobo) as total_outstanding
     FROM claims c JOIN payers py ON py.id=c.payer_id
     WHERE c.outstanding_amount_kobo>0 AND c.is_deleted=0 AND c.status NOT IN ('CANCELLED','WRITTEN_OFF','DRAFT','READY')
     GROUP BY py.id ORDER BY total_outstanding DESC`, [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/reports/rejections', (req: Request, res: Response) => {
  const { payer_id, date_from, date_to } = req.query;
  let sql = `SELECT ci.rejection_reason_code, rr.description as reason_description, py.name as payer_name, COUNT(*) as line_count, SUM(ci.rejected_amount_kobo) as rejected_kobo FROM claim_items ci JOIN claims c ON c.id=ci.claim_id JOIN payers py ON py.id=c.payer_id LEFT JOIN rejection_reasons rr ON rr.code=ci.rejection_reason_code WHERE ci.rejected_amount_kobo>0 AND c.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND c.payer_id=?`; params.push(payer_id); }
  if (date_from) { sql += ` AND c.service_date>=?`; params.push(date_from); }
  if (date_to) { sql += ` AND c.service_date<=?`; params.push(date_to); }
  sql += ` GROUP BY ci.rejection_reason_code, py.id ORDER BY rejected_kobo DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/reports/payer-reconciliation', (_req: Request, res: Response) => {
  db.all(`SELECT py.name as payer_name, py.id as payer_id, COUNT(c.id) as claim_count, SUM(c.claimed_amount_kobo) as total_claimed, SUM(c.approved_amount_kobo) as total_approved, SUM(c.paid_amount_kobo) as total_paid, SUM(c.outstanding_amount_kobo) as total_outstanding, SUM(c.rejected_amount_kobo) as total_rejected FROM claims c JOIN payers py ON py.id=c.payer_id WHERE c.is_deleted=0 AND c.status NOT IN ('DRAFT','CANCELLED') GROUP BY py.id ORDER BY total_outstanding DESC`, [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/reports/authorizations', (req: Request, res: Response) => {
  const { payer_id, date_from, date_to } = req.query;
  let sql = `SELECT a.*, p.full_name as patient_name, py.name as payer_name, e.enrollee_number FROM authorizations a JOIN patients p ON p.id=a.patient_id JOIN payers py ON py.id=a.payer_id JOIN enrollees e ON e.id=a.enrollee_id WHERE a.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND a.payer_id=?`; params.push(payer_id); }
  if (date_from) { sql += ` AND a.requested_at>=?`; params.push(date_from); }
  if (date_to) { sql += ` AND a.requested_at<=?`; params.push(date_to); }
  sql += ` ORDER BY a.requested_at DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/reports/revenue-split', (req: Request, res: Response) => {
  const { date_from, date_to } = req.query;
  const dateWhere = date_from && date_to ? ` AND date(created_at) BETWEEN '${date_from}' AND '${date_to}'` : '';
  const dateWhere2 = date_from && date_to ? ` AND service_date BETWEEN '${date_from}' AND '${date_to}'` : '';
  db.get(`SELECT SUM(amount_paid) as cash_revenue FROM transactions WHERE (is_insurance_bill=0 OR is_insurance_bill IS NULL) AND status IN ('Paid','Partial')${dateWhere}`, [], (_e1, cash: any) => {
    db.get(`SELECT SUM(patient_portion) as ins_patient, SUM(payer_portion) as ins_payer FROM transactions WHERE is_insurance_bill=1 AND status IN ('Paid','Partial')${dateWhere}`, [], (_e2, ins: any) => {
      db.get(`SELECT SUM(paid_amount_kobo) as payer_paid, SUM(outstanding_amount_kobo) as payer_outstanding FROM claims WHERE status NOT IN ('DRAFT','CANCELLED')${dateWhere2}`, [], (_e3, cl: any) => {
        res.json({ cash_revenue: cash?.cash_revenue || 0, insurance_patient_portion: ins?.ins_patient || 0, insurance_payer_portion: ins?.ins_payer || 0, payer_paid_kobo: cl?.payer_paid || 0, payer_outstanding_kobo: cl?.payer_outstanding || 0 });
      });
    });
  });
});

insuranceRouter.get('/reports/remittances', (req: Request, res: Response) => {
  const { payer_id, date_from, date_to } = req.query;
  let sql = `SELECT r.*, p.name as payer_name, (SELECT COALESCE(SUM(amount_kobo),0) FROM remittance_allocations WHERE remittance_id=r.id) as allocated_kobo FROM remittances r JOIN payers p ON p.id=r.payer_id WHERE r.is_deleted=0`;
  const params: any[] = [];
  if (payer_id) { sql += ` AND r.payer_id=?`; params.push(payer_id); }
  if (date_from) { sql += ` AND r.payment_date>=?`; params.push(date_from); }
  if (date_to) { sql += ` AND r.payment_date<=?`; params.push(date_to); }
  sql += ` ORDER BY r.payment_date DESC`;
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

insuranceRouter.get('/reports/dashboard-cards', (_req: Request, res: Response) => {
  db.get(`SELECT SUM(outstanding_amount_kobo) as total_outstanding_kobo, COUNT(*) as total_claims, SUM(CASE WHEN status IN ('DRAFT','READY') THEN 1 ELSE 0 END) as awaiting_action, SUM(CASE WHEN status IN ('SUBMITTED','UNDER_REVIEW') THEN 1 ELSE 0 END) as under_review FROM claims WHERE is_deleted=0 AND status NOT IN ('CANCELLED','WRITTEN_OFF')`, [], (err, row) => { if (err) return res.status(500).json({ error: err.message }); res.json(row || {}); });
});

insuranceRouter.get('/reports/overdue-claims', (_req: Request, res: Response) => {
  db.all(`SELECT c.claim_number, c.status, c.submitted_at, py.name as payer_name, py.payment_terms_days, CAST((julianday('now')-julianday(c.submitted_at)) AS INTEGER) as days_since_submission FROM claims c JOIN payers py ON py.id=c.payer_id WHERE c.status IN ('SUBMITTED','UNDER_REVIEW') AND c.is_deleted=0 AND (julianday('now')-julianday(c.submitted_at))>py.payment_terms_days ORDER BY days_since_submission DESC`, [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

// ═══════════════════════════════════════════════════════════════════
// EDI / CLEARINGHOUSE BRIDGE
// ═══════════════════════════════════════════════════════════════════

insuranceRouter.get('/edi/configs', (_req: Request, res: Response) => {
  db.all(
    `SELECT c.*, p.name as payer_name, p.code as payer_code 
     FROM payer_edi_configs c 
     JOIN payers p ON p.id = c.payer_id 
     WHERE p.is_deleted = 0
     ORDER BY p.name`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

insuranceRouter.get('/edi/configs/:payer_id', (req: Request, res: Response) => {
  db.get(
    `SELECT c.*, p.name as payer_name 
     FROM payer_edi_configs c 
     JOIN payers p ON p.id = c.payer_id 
     WHERE c.payer_id = ?`,
    [req.params.payer_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

insuranceRouter.put('/edi/configs/:payer_id', (req: Request, res: Response) => {
  const payerId = Number(req.params.payer_id);
  const {
    protocol,
    is_enabled,
    local_folder_path,
    webhook_url,
    webhook_auth_header,
    sftp_host,
    sftp_port,
    sftp_username,
    sftp_password,
    sftp_remote_path,
    format,
    auto_dispatch,
  } = req.body;

  db.run(
    `INSERT INTO payer_edi_configs (
      payer_id, protocol, is_enabled, local_folder_path, webhook_url,
      webhook_auth_header, sftp_host, sftp_port, sftp_username, sftp_password,
      sftp_remote_path, format, auto_dispatch, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(payer_id) DO UPDATE SET
      protocol = excluded.protocol,
      is_enabled = excluded.is_enabled,
      local_folder_path = excluded.local_folder_path,
      webhook_url = excluded.webhook_url,
      webhook_auth_header = excluded.webhook_auth_header,
      sftp_host = excluded.sftp_host,
      sftp_port = excluded.sftp_port,
      sftp_username = excluded.sftp_username,
      sftp_password = excluded.sftp_password,
      sftp_remote_path = excluded.sftp_remote_path,
      format = excluded.format,
      auto_dispatch = excluded.auto_dispatch,
      updated_at = CURRENT_TIMESTAMP`,
    [
      payerId,
      protocol || 'LOCAL_FOLDER',
      is_enabled !== false ? 1 : 0,
      local_folder_path || null,
      webhook_url || null,
      webhook_auth_header || null,
      sftp_host || null,
      sftp_port ? Number(sftp_port) : 22,
      sftp_username || null,
      sftp_password || null,
      sftp_remote_path || null,
      format || 'JSON',
      auto_dispatch ? 1 : 0,
    ],
    function (this: any, err) {
      if (err) return res.status(500).json({ error: err.message });
      logInsuranceAudit(req, 'EDI_CONFIG_UPDATE', `Configured EDI settings for payer ${payerId}`);
      res.json({ success: true });
    }
  );
});

insuranceRouter.post('/edi/transmit/:batch_id', async (req: Request, res: Response) => {
  const batchId = Number(req.params.batch_id);
  const user = (req as any).user;
  const operator = user?.username || 'Admin';
  const isSync = req.query.sync === 'true';

  try {
    if (isSync) {
      // Synchronous fallback if explicitly requested
      const result = await transmitBatch(batchId, operator);
      logInsuranceAudit(req, 'EDI_TRANSMIT_SYNC', `Batch #${batchId} dispatched synchronously: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      return res.json(result);
    }

    // Default: Decoupled asynchronous transmission queue with backoff & dead-letter
    const queueResult = await enqueueBatchTransmission(batchId, operator);
    logInsuranceAudit(req, 'EDI_TRANSMIT_ENQUEUED', `Batch #${batchId} enqueued for async transmission (Job #${queueResult.jobId})`);
    res.json({
      success: true,
      enqueued: true,
      jobId: queueResult.jobId,
      status: queueResult.status,
      message: queueResult.message,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to enqueue transmission' });
  }
});

insuranceRouter.get('/edi/jobs/:batch_id', async (req: Request, res: Response) => {
  const batchId = Number(req.params.batch_id);
  try {
    const job = await getQueueJobForBatch(batchId);
    res.json(job || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get job status' });
  }
});

insuranceRouter.get('/edi/jobs', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  try {
    const jobs = await getQueueJobs(limit);
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get queue jobs' });
  }
});

insuranceRouter.post('/edi/jobs/:job_id/retry', async (req: Request, res: Response) => {
  const jobId = Number(req.params.job_id);
  try {
    const result = await retryQueueJob(jobId);
    logInsuranceAudit(req, 'EDI_JOB_RETRY', `Retried EDI queue job #${jobId}`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retry job' });
  }
});

insuranceRouter.get('/edi/preview/:batch_id', async (req: Request, res: Response) => {
  const batchId = Number(req.params.batch_id);
  const format = (req.query.format as any) || 'JSON';

  try {
    const preview = await formatBatchPayload(batchId, format);
    res.json(preview);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to preview batch' });
  }
});

insuranceRouter.get('/edi/transmissions', (_req: Request, res: Response) => {
  db.all(
    `SELECT t.*, b.batch_number, p.name as payer_name 
     FROM edi_transmissions t 
     LEFT JOIN claim_batches b ON b.id = t.batch_id 
     LEFT JOIN payers p ON p.id = t.payer_id 
     ORDER BY t.transmitted_at DESC LIMIT 100`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

export default insuranceRouter;

