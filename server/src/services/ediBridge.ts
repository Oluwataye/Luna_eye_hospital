import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import db from '../../db';

const serverRootDir = __dirname.includes('dist') ? path.join(__dirname, '..', '..') : path.join(__dirname, '..');
const defaultEdiDir = path.join(serverRootDir, 'edi_exports');

export interface EdiTransmissionResult {
  success: boolean;
  protocol: string;
  destination: string;
  message: string;
  filename?: string;
  error?: string;
  httpStatus?: number;
}

/**
 * Format batch claims into standardized JSON or CSV
 */
export async function formatBatchPayload(
  batchId: number,
  format: 'JSON' | 'CSV' | 'NHIA_XML' = 'JSON'
): Promise<{ payload: string; mimeType: string; filename: string }> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT b.*, p.name as payer_name, p.code as payer_code 
       FROM claim_batches b 
       JOIN payers p ON b.payer_id = p.id 
       WHERE b.id = ?`,
      [batchId],
      (err, batch: any) => {
        if (err || !batch) return reject(new Error('Batch not found'));

        db.all(
          `SELECT c.*, 
                  e.enrollee_number, e.relationship,
                  pat.full_name as patient_name, pat.phone as patient_phone, pat.gender as patient_gender, pat.dob as patient_dob
           FROM claims c
           JOIN enrollees e ON c.enrollee_id = e.id
           JOIN patients pat ON c.patient_id = pat.id
           WHERE c.batch_id = ?`,
          [batchId],
          async (errClaims, claims: any[]) => {
            if (errClaims) return reject(errClaims);

            // Fetch items for all claims
            const claimIds = claims.map((c) => c.id);
            let items: any[] = [];
            if (claimIds.length > 0) {
              const placeholders = claimIds.map(() => '?').join(',');
              items = await new Promise((resItems) => {
                db.all(
                  `SELECT * FROM claim_items WHERE claim_id IN (${placeholders})`,
                  claimIds,
                  (errItems, rows) => resItems(rows || [])
                );
              });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const cleanBatchNo = String(batch.batch_number).replace(/[^a-zA-Z0-9-_]/g, '_');

            if (format === 'CSV') {
              const headers = [
                'batch_number', 'payer_code', 'claim_number', 'service_date',
                'enrollee_number', 'patient_name', 'patient_gender', 'patient_dob',
                'item_type', 'item_code', 'item_description', 'quantity',
                'unit_price_kobo', 'claimed_amount_kobo'
              ];

              const rows: string[] = [headers.join(',')];
              claims.forEach((c) => {
                const claimItems = items.filter((it) => it.claim_id === c.id);
                if (claimItems.length === 0) {
                  rows.push([
                    `"${batch.batch_number}"`, `"${batch.payer_code}"`, `"${c.claim_number}"`, `"${c.service_date}"`,
                    `"${c.enrollee_number}"`, `"${c.patient_name || ''}"`, `"${c.patient_gender || ''}"`, `"${c.patient_dob || ''}"`,
                    '"SERVICE"', '"TOTAL"', '"Outpatient Encounter"', '1',
                    String(c.total_claimed || 0), String(c.total_claimed || 0)
                  ].join(','));
                } else {
                  claimItems.forEach((it) => {
                    rows.push([
                      `"${batch.batch_number}"`, `"${batch.payer_code}"`, `"${c.claim_number}"`, `"${c.service_date}"`,
                      `"${c.enrollee_number}"`, `"${c.patient_name || ''}"`, `"${c.patient_gender || ''}"`, `"${c.patient_dob || ''}"`,
                      `"${it.item_type || ''}"`, `"${it.item_code || ''}"`, `"${(it.description || '').replace(/"/g, '""')}"`,
                      String(it.quantity || 1), String(it.unit_price || 0), String(it.claimed_amount || 0)
                    ].join(','));
                  });
                }
              });

              return resolve({
                payload: rows.join('\n'),
                mimeType: 'text/csv',
                filename: `EDI_BATCH_${cleanBatchNo}_${timestamp}.csv`
              });
            }

            // Default JSON format
            const jsonObj = {
              hospital: {
                name: 'Luna Eye Hospital',
                location: 'Minna, Niger State',
                provider_code: 'LEH-MINNA'
              },
              transmission_metadata: {
                generated_at: new Date().toISOString(),
                format_version: '1.0'
              },
              batch: {
                id: batch.id,
                batch_number: batch.batch_number,
                payer_id: batch.payer_id,
                payer_name: batch.payer_name,
                payer_code: batch.payer_code,
                total_claims: claims.length,
                total_amount_kobo: claims.reduce((sum, c) => sum + (c.total_claimed || 0), 0),
                total_amount_naira: claims.reduce((sum, c) => sum + (c.total_claimed || 0), 0) / 100,
                claims: claims.map((c) => ({
                  claim_id: c.id,
                  claim_number: c.claim_number,
                  service_date: c.service_date,
                  primary_icd10: c.primary_icd10 || null,
                  auth_code: c.auth_code || null,
                  enrollee: {
                    number: c.enrollee_number,
                    relationship: c.relationship
                  },
                  patient: {
                    id: c.patient_id,
                    name: c.patient_name,
                    gender: c.patient_gender,
                    dob: c.patient_dob,
                    phone: c.patient_phone
                  },
                  financials: {
                    total_billed_kobo: c.total_billed,
                    patient_copay_kobo: c.patient_copay,
                    total_claimed_kobo: c.total_claimed
                  },
                  items: items
                    .filter((it) => it.claim_id === c.id)
                    .map((it) => ({
                      item_type: it.item_type,
                      item_code: it.item_code,
                      description: it.description,
                      quantity: it.quantity,
                      unit_price_kobo: it.unit_price,
                      claimed_amount_kobo: it.claimed_amount
                    }))
                }))
              }
            };

            resolve({
              payload: JSON.stringify(jsonObj, null, 2),
              mimeType: 'application/json',
              filename: `EDI_BATCH_${cleanBatchNo}_${timestamp}.json`
            });
          }
        );
      }
    );
  });
}

/**
 * Transmit a batch to its configured HMO clearinghouse endpoint
 */
export async function transmitBatch(
  batchId: number,
  operator = 'System'
): Promise<EdiTransmissionResult> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT b.*, c.protocol, c.is_enabled, c.local_folder_path, c.webhook_url, 
              c.webhook_auth_header, c.sftp_host, c.sftp_port, c.sftp_username, 
              c.sftp_remote_path, c.format
       FROM claim_batches b
       LEFT JOIN payer_edi_configs c ON b.payer_id = c.payer_id
       WHERE b.id = ?`,
      [batchId],
      async (err, row: any) => {
        if (err || !row) return reject(new Error('Batch not found'));

        const protocol = row.protocol || 'LOCAL_FOLDER';
        const format = (row.format || 'JSON').toUpperCase();

        try {
          const { payload, filename } = await formatBatchPayload(batchId, format as any);

          // ── PROTOCOL: LOCAL FOLDER DROP ─────────────────────────────────────
          if (protocol === 'LOCAL_FOLDER') {
            const targetDir = row.local_folder_path && fs.existsSync(row.local_folder_path)
              ? row.local_folder_path
              : defaultEdiDir;

            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            const targetFilePath = path.join(targetDir, filename);
            fs.writeFileSync(targetFilePath, payload, 'utf8');

            const destination = targetFilePath;
            recordTransmission(batchId, row.payer_id, protocol, destination, 'SUCCESS', 'File written to EDI folder', null, operator);
            markBatchSubmitted(batchId, operator);

            return resolve({
              success: true,
              protocol,
              destination,
              filename,
              message: `Batch packaged and saved to ${targetFilePath}`
            });
          }

          // ── PROTOCOL: REST WEBHOOK / API ────────────────────────────────────
          if (protocol === 'REST_WEBHOOK') {
            if (!row.webhook_url) {
              const errMsg = 'Webhook URL is missing in Payer EDI Configuration';
              recordTransmission(batchId, row.payer_id, protocol, 'None', 'FAILED', null, errMsg, operator);
              return resolve({
                success: false,
                protocol,
                destination: 'None',
                message: errMsg,
                error: errMsg
              });
            }

            const targetUrl = new URL(row.webhook_url);
            const isHttps = targetUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            const reqOptions = {
              hostname: targetUrl.hostname,
              port: targetUrl.port || (isHttps ? 443 : 80),
              path: targetUrl.pathname + targetUrl.search,
              method: 'POST',
              headers: {
                'Content-Type': format === 'CSV' ? 'text/csv' : 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...(row.webhook_auth_header ? { Authorization: row.webhook_auth_header } : {})
              },
              timeout: 15000 // 15 seconds timeout
            };

            const req = client.request(reqOptions, (res) => {
              let responseBody = '';
              res.on('data', (chunk) => (responseBody += chunk));
              res.on('end', () => {
                const isSuccess = (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300;
                const status = isSuccess ? 'SUCCESS' : 'FAILED';
                const errMsg = isSuccess ? null : `HTTP Error ${res.statusCode}: ${responseBody.slice(0, 200)}`;

                recordTransmission(batchId, row.payer_id, protocol, row.webhook_url, status, responseBody.slice(0, 500), errMsg, operator);

                if (isSuccess) {
                  markBatchSubmitted(batchId, operator);
                }

                resolve({
                  success: isSuccess,
                  protocol,
                  destination: row.webhook_url,
                  httpStatus: res.statusCode,
                  message: isSuccess ? 'Dispatched to HMO webhook successfully' : `HMO webhook responded with status ${res.statusCode}`,
                  error: errMsg || undefined
                });
              });
            });

            req.on('error', (reqErr) => {
              const errMsg = `Webhook Network Error: ${reqErr.message}`;
              recordTransmission(batchId, row.payer_id, protocol, row.webhook_url, 'FAILED', null, errMsg, operator);
              resolve({
                success: false,
                protocol,
                destination: row.webhook_url,
                message: errMsg,
                error: errMsg
              });
            });

            req.on('timeout', () => {
              req.destroy();
              const errMsg = 'Webhook request timed out after 15 seconds';
              recordTransmission(batchId, row.payer_id, protocol, row.webhook_url, 'FAILED', null, errMsg, operator);
              resolve({
                success: false,
                protocol,
                destination: row.webhook_url,
                message: errMsg,
                error: errMsg
              });
            });

            req.write(payload);
            req.end();
            return;
          }

          // ── PROTOCOL: SFTP / QUEUE ──────────────────────────────────────────
          if (protocol === 'SFTP') {
            // Drop to outbox queue directory for SFTP transfer agent
            const sftpOutbox = path.join(defaultEdiDir, 'sftp_outbox');
            if (!fs.existsSync(sftpOutbox)) {
              fs.mkdirSync(sftpOutbox, { recursive: true });
            }
            const queueFile = path.join(sftpOutbox, filename);
            fs.writeFileSync(queueFile, payload, 'utf8');

            const destination = `sftp://${row.sftp_username || 'user'}@${row.sftp_host || 'localhost'}:${row.sftp_remote_path || '/'}`;
            recordTransmission(batchId, row.payer_id, protocol, destination, 'SUCCESS', 'Queued in sftp_outbox directory', null, operator);
            markBatchSubmitted(batchId, operator);

            return resolve({
              success: true,
              protocol,
              destination,
              filename,
              message: `Batch packaged and queued for SFTP delivery to ${destination}`
            });
          }

          resolve({
            success: false,
            protocol,
            destination: 'Unknown',
            message: `Unsupported protocol ${protocol}`
          });
        } catch (ex: any) {
          recordTransmission(batchId, row.payer_id, protocol, 'Unknown', 'FAILED', null, ex.message, operator);
          reject(ex);
        }
      }
    );
  });
}

function recordTransmission(
  batchId: number,
  payerId: number,
  protocol: string,
  destination: string,
  status: 'SUCCESS' | 'FAILED',
  responsePayload: string | null,
  errorMessage: string | null,
  transmittedBy: string
) {
  db.run(
    `INSERT INTO edi_transmissions (
      batch_id, payer_id, protocol, destination, status, 
      response_payload, error_message, transmitted_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [batchId, payerId, protocol, destination, status, responsePayload, errorMessage, transmittedBy]
  );
}

function markBatchSubmitted(batchId: number, operator: string) {
  db.run(
    `UPDATE claim_batches 
     SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP, submitted_by = ? 
     WHERE id = ?`,
    [operator, batchId]
  );

  // Transition all claims in batch to SUBMITTED
  db.all('SELECT id FROM claims WHERE batch_id = ?', [batchId], (err, claims: any[]) => {
    if (!err && claims) {
      claims.forEach((c) => {
        db.run(`UPDATE claims SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [c.id]);
        db.run(
          `INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by, notes)
           VALUES (?, 'READY', 'SUBMITTED', ?, 'Submitted via EDI Clearinghouse Bridge')`,
          [c.id, operator]
        );
      });
    }
  });
}

/**
 * Background worker task: sweeps OPEN batches for payers with auto_dispatch = 1
 */
export async function sweepAndDispatchReadyBatches() {
  db.all(
    `SELECT b.id, b.batch_number, c.payer_id 
     FROM claim_batches b
     JOIN payer_edi_configs c ON b.payer_id = c.payer_id
     WHERE b.status = 'OPEN' AND c.auto_dispatch = 1 AND c.is_enabled = 1`,
    [],
    async (err, rows: any[]) => {
      if (err || !rows || rows.length === 0) return;
      console.log(`[EDI Bridge] Sweeping ${rows.length} ready batch(es) for auto-dispatch...`);
      for (const row of rows) {
        try {
          const res = await transmitBatch(row.id, 'EDI-Cron-Worker');
          console.log(`[EDI Bridge] Batch #${row.batch_number} dispatch: ${res.success ? 'OK' : 'FAILED - ' + res.error}`);
        } catch (dispatchErr: any) {
          console.error(`[EDI Bridge] Error auto-dispatching batch #${row.batch_number}:`, dispatchErr.message);
        }
      }
    }
  );
}
