import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import db from '../db';

/**
 * Nightly cron job to purge recorded audio files older than 7 days
 * and nullify raw transcripts for privacy/retention compliance.
 */
export function startAudioCleanupJob() {
  console.log('[AUDIO_CLEANUP] Scheduled nightly audio cleanup job (runs at 02:00 AM).');

  cron.schedule('0 2 * * *', () => {
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString();

    db.all(
      `SELECT * FROM voice_sessions 
       WHERE audio_file_path IS NOT NULL 
       AND audio_deleted_at IS NULL 
       AND recording_timestamp < ?`,
      [cutoffDate],
      (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('[AUDIO_CLEANUP] Query error:', err);
          return;
        }

        if (!rows || rows.length === 0) {
          return;
        }

        for (const session of rows) {
          try {
            if (session.audio_file_path && fs.existsSync(session.audio_file_path)) {
              fs.unlinkSync(session.audio_file_path);
            }
            db.run(
              `UPDATE voice_sessions 
               SET audio_file_path = NULL, raw_transcript = NULL, audio_deleted_at = CURRENT_TIMESTAMP 
               WHERE id = ?`,
              [session.id]
            );
            console.log(`[AUDIO_CLEANUP] Purged audio for session ${session.id} (visit: ${session.visit_id})`);
          } catch (delErr) {
            console.error(`[AUDIO_CLEANUP] Failed to purge session ${session.id}:`, delErr);
          }
        }
      }
    );
  });
}
