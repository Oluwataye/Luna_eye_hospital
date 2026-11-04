import db from '../../db';
import { transmitBatch } from './ediBridge';
import { broadcastEdiQueueUpdate } from '../../websocket';

export interface EdiJob {
  id: number;
  batch_id: number;
  payer_id: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  batch_number?: string;
  payer_name?: string;
}

// Exponential backoff delays in seconds: attempt 1 -> 30s, attempt 2 -> 120s (2m), attempt 3 -> 600s (10m)
const BACKOFF_DELAYS_SEC = [30, 120, 600];

let isWorkerActive = false;
let pollingIntervalHandle: NodeJS.Timeout | null = null;

function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: any, err: any) {
      if (err) reject(err);
      else resolve({ lastID: this?.lastID || 0, changes: this?.changes || 0 });
    });
  });
}

function notifyTransition(
  event: 'JOB_ENQUEUED' | 'JOB_STARTED' | 'JOB_COMPLETED' | 'JOB_FAILED' | 'JOB_RETRIED',
  job: any,
  batchId?: number
) {
  try {
    broadcastEdiQueueUpdate({
      event,
      job,
      batch_id: batchId || job?.batch_id,
    });
  } catch (err: any) {
    console.warn('[EDI Queue] WebSocket broadcast error:', err.message);
  }
}

/**
 * Enqueue a batch for asynchronous EDI clearinghouse transmission
 */
export async function enqueueBatchTransmission(
  batchId: number,
  triggeredBy = 'Admin',
  options: { forceRetry?: boolean } = {}
): Promise<{ jobId: number; status: string; message: string }> {
  const batch = await dbGet<{ id: number; payer_id: number; status: string }>(
    `SELECT id, payer_id, status FROM claim_batches WHERE id = ?`,
    [batchId]
  );
  if (!batch) {
    throw new Error(`Claim batch #${batchId} not found`);
  }

  // Look for existing job
  const existing = await dbGet<EdiJob>(
    `SELECT * FROM edi_job_queue WHERE batch_id = ? ORDER BY id DESC LIMIT 1`,
    [batchId]
  );

  if (existing) {
    // If job is already pending or actively processing and not a forced retry, return existing
    if ((existing.status === 'PENDING' || existing.status === 'PROCESSING') && !options.forceRetry) {
      return {
        jobId: existing.id,
        status: existing.status,
        message: `Batch #${batchId} is already ${existing.status.toLowerCase()} in queue`,
      };
    }

    // If completed and not forced retry, reject re-enqueuing already completed transmission
    if (existing.status === 'COMPLETED' && !options.forceRetry) {
      return {
        jobId: existing.id,
        status: existing.status,
        message: `Batch #${batchId} has already completed transmission`,
      };
    }

    // Reset existing job for retry
    await dbRun(
      `UPDATE edi_job_queue 
       SET status = 'PENDING', attempts = 0, next_run_at = CURRENT_TIMESTAMP, 
           last_error = NULL, updated_at = CURRENT_TIMESTAMP, completed_at = NULL
       WHERE id = ?`,
      [existing.id]
    );

    notifyTransition('JOB_ENQUEUED', { id: existing.id, batch_id: batchId, status: 'PENDING', attempts: 0 }, batchId);
    triggerWorker();
    return {
      jobId: existing.id,
      status: 'PENDING',
      message: `Batch #${batchId} queued for re-transmission`,
    };
  }

  // Insert fresh job
  const res = await dbRun(
    `INSERT INTO edi_job_queue (batch_id, payer_id, status, attempts, max_attempts, next_run_at)
     VALUES (?, ?, 'PENDING', 0, 3, CURRENT_TIMESTAMP)`,
    [batch.id, batch.payer_id]
  );

  notifyTransition('JOB_ENQUEUED', { id: res.lastID, batch_id: batch.id, status: 'PENDING', attempts: 0 }, batch.id);
  triggerWorker();
  return {
    jobId: res.lastID,
    status: 'PENDING',
    message: `Batch #${batchId} successfully queued for transmission`,
  };
}

/**
 * Immediate non-blocking trigger for worker loop
 */
export function triggerWorker(): void {
  setImmediate(() => {
    processQueue().catch((err) => {
      console.error('[EDI Queue Worker] Error during queue execution:', err);
    });
  });
}

/**
 * Worker execution loop: processes pending jobs due for execution
 */
export async function processQueue(): Promise<void> {
  if (isWorkerActive) return;
  isWorkerActive = true;

  try {
    while (true) {
      // Pick next eligible pending job due at or before now
      const job = await dbGet<EdiJob>(
        `SELECT q.*, b.batch_number 
         FROM edi_job_queue q
         JOIN claim_batches b ON q.batch_id = b.id
         WHERE q.status = 'PENDING' AND datetime(q.next_run_at) <= datetime('now')
         ORDER BY q.id ASC
         LIMIT 1`
      );

      if (!job) {
        break; // No eligible pending jobs right now
      }

      // Mark status as PROCESSING
      await dbRun(
        `UPDATE edi_job_queue 
         SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [job.id]
      );

      notifyTransition('JOB_STARTED', { ...job, status: 'PROCESSING', attempts: job.attempts + 1 }, job.batch_id);
      console.log(`[EDI Queue Worker] Processing Job #${job.id} (Batch #${job.batch_id}, attempt ${job.attempts + 1}/${job.max_attempts})...`);

      try {
        const transmitResult = await transmitBatch(job.batch_id, 'EDI-Async-Queue');

        if (transmitResult.success) {
          // Success: Mark completed
          await dbRun(
            `UPDATE edi_job_queue 
             SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = NULL 
             WHERE id = ?`,
            [job.id]
          );
          notifyTransition('JOB_COMPLETED', { ...job, status: 'COMPLETED', completed_at: new Date().toISOString() }, job.batch_id);
          console.log(`[EDI Queue Worker] Job #${job.id} COMPLETED successfully for batch #${job.batch_id}`);
        } else {
          // Handled transmission error (protocol failure, HTTP 4xx/5xx, SFTP auth)
          await handleJobFailure(job, transmitResult.error || transmitResult.message || 'Transmission failed');
        }
      } catch (err: any) {
        // Unexpected thrown error
        await handleJobFailure(job, err.message || 'Unexpected worker error');
      }
    }
  } finally {
    isWorkerActive = false;
  }
}

/**
 * Calculate backoff and update job status to either PENDING (retry scheduled) or DEAD_LETTER
 */
async function handleJobFailure(job: EdiJob, errorMessage: string): Promise<void> {
  const nextAttempt = job.attempts + 1;
  const isDeadLetter = nextAttempt >= job.max_attempts;

  if (isDeadLetter) {
    console.error(`[EDI Queue Worker] Job #${job.id} EXCEEDED max attempts (${job.max_attempts}). Moving to DEAD_LETTER. Error: ${errorMessage}`);
    await dbRun(
      `UPDATE edi_job_queue 
       SET status = 'DEAD_LETTER', attempts = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nextAttempt, errorMessage, job.id]
    );
    notifyTransition('JOB_FAILED', { ...job, status: 'DEAD_LETTER', attempts: nextAttempt, last_error: errorMessage }, job.batch_id);
  } else {
    const delaySec = BACKOFF_DELAYS_SEC[job.attempts] || 300;
    console.warn(`[EDI Queue Worker] Job #${job.id} failed (attempt ${nextAttempt}/${job.max_attempts}). Retrying in ${delaySec}s. Error: ${errorMessage}`);
    await dbRun(
      `UPDATE edi_job_queue 
       SET status = 'PENDING', attempts = ?, 
           next_run_at = datetime('now', '+' || ? || ' seconds'), 
           last_error = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nextAttempt, delaySec, errorMessage, job.id]
    );
    notifyTransition('JOB_FAILED', { ...job, status: 'PENDING', attempts: nextAttempt, last_error: errorMessage }, job.batch_id);
  }
}

/**
 * Retrieve queue status for a specific batch
 */
export async function getQueueJobForBatch(batchId: number): Promise<EdiJob | null> {
  return dbGet<EdiJob>(
    `SELECT q.*, b.batch_number, p.name as payer_name
     FROM edi_job_queue q
     JOIN claim_batches b ON q.batch_id = b.id
     JOIN payers p ON q.payer_id = p.id
     WHERE q.batch_id = ?
     ORDER BY q.id DESC LIMIT 1`,
    [batchId]
  );
}

/**
 * Retrieve recent queue jobs with batch and payer details
 */
export async function getQueueJobs(limit = 50): Promise<EdiJob[]> {
  return dbAll<EdiJob>(
    `SELECT q.*, b.batch_number, p.name as payer_name
     FROM edi_job_queue q
     JOIN claim_batches b ON q.batch_id = b.id
     JOIN payers p ON q.payer_id = p.id
     ORDER BY q.id DESC 
     LIMIT ?`,
    [limit]
  );
}

/**
 * Manually retry a DEAD_LETTER or FAILED job
 */
export async function retryQueueJob(jobId: number): Promise<{ success: boolean; message: string }> {
  const job = await dbGet<EdiJob>(`SELECT * FROM edi_job_queue WHERE id = ?`, [jobId]);
  if (!job) {
    throw new Error(`Job #${jobId} not found`);
  }

  await dbRun(
    `UPDATE edi_job_queue 
     SET status = 'PENDING', attempts = 0, next_run_at = CURRENT_TIMESTAMP, 
         last_error = NULL, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [jobId]
  );

  notifyTransition('JOB_RETRIED', { id: jobId, batch_id: job.batch_id, status: 'PENDING', attempts: 0 }, job.batch_id);
  triggerWorker();
  return { success: true, message: `Job #${jobId} reset to PENDING and triggered for processing` };
}

/**
 * Start the background polling ticker (every 15s) to pick up retry-eligible jobs
 */
export function startQueueWorker(): void {
  if (pollingIntervalHandle) return;
  console.log('[EDI Queue Worker] Starting background queue ticker (15s interval)...');
  pollingIntervalHandle = setInterval(() => {
    processQueue().catch((err) => {
      console.error('[EDI Queue Worker] Polling ticker error:', err);
    });
  }, 15000);

  // Initial trigger
  triggerWorker();
}
