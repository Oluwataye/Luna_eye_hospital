import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import db from '../db';

const router = express.Router();

// Audio storage & configuration directory (pkg-safe)
const isPackaged = typeof (process as any).pkg !== 'undefined';
const serverRootDir = __dirname.includes('dist') ? path.join(__dirname, '..') : path.resolve(__dirname, '..');
const writableRootDir = isPackaged ? path.dirname(process.execPath) : serverRootDir;
const AUDIO_DIR = path.resolve(writableRootDir, 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Configuration file path
const CONFIG_FILE = path.resolve(writableRootDir, 'voice_config.json');

export interface VoiceConfig {
  active_whisper_model: string;
  device: string;
  compute_type: string;
  llm_postprocessing_enabled: boolean;
  ollama_base_url: string;
  ollama_model: string;
  llm_temperature: number;
  llm_prompt_template: string;
}

const DEFAULT_CONFIG: VoiceConfig = {
  active_whisper_model: 'base.en',
  device: 'auto',
  compute_type: 'auto',
  llm_postprocessing_enabled: false,
  ollama_base_url: 'http://127.0.0.1:11434',
  ollama_model: 'llama3.2:latest',
  llm_temperature: 0.1,
  llm_prompt_template:
    'You are an expert ophthalmic clinical scribe at Luna Eye Hospital. Clean and format the following dictated clinical notes into concise medical notation. Preserve all clinical findings, measurements, and eye designations (OD, OS, OU, VA, IOP, SLE, Fundus). Do not invent or assume information. Return ONLY the formatted clinical text with zero conversational remarks.'
};

function getVoiceConfig(): VoiceConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    console.warn('[VOICE] Could not read voice_config.json, using defaults:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function saveVoiceConfig(config: Partial<VoiceConfig>): VoiceConfig {
  const current = getVoiceConfig();
  const merged = { ...current, ...config };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[VOICE] Failed to write voice_config.json:', err);
  }
  return merged;
}

// Multer setup for direct audio uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    const visitId = req.body.visit_id || 'novisit';
    const fieldName = (req.body.field_name || 'field').replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${visitId}_${fieldName}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

const WHISPER_SERVICE_URL = process.env.WHISPER_URL || 'http://127.0.0.1:8765';

/**
 * Helper to call the local faster-whisper microservice
 */
async function callLocalWhisper(audioPath: string, timeoutMs: number = 30000): Promise<{ raw_transcript: string; processed_note: string; duration?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_path: audioPath }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Whisper service error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    return {
      raw_transcript: data.raw_transcript || '',
      processed_note: data.processed_note || data.raw_transcript || '',
      duration: data.duration
    };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Optional local LLM post-processing via Ollama
 */
async function formatWithLocalLLM(rawText: string, fieldName: string, config: VoiceConfig): Promise<string> {
  if (!config.llm_postprocessing_enabled || !rawText.trim()) {
    return rawText;
  }

  const prompt = `${config.llm_prompt_template}\n\nClinical Section: ${fieldName}\nDictation Input: "${rawText}"\n\nFormatted Output:`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout to keep UI snappy

  try {
    const res = await fetch(`${config.ollama_base_url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama_model,
        prompt,
        stream: false,
        options: {
          temperature: config.llm_temperature || 0.1
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[VOICE LLM] Ollama returned status ${res.status}, falling back to rule-based note.`);
      return rawText;
    }

    const data: any = await res.json();
    const result = (data.response || '').trim();
    return result || rawText;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn(`[VOICE LLM] Local LLM call skipped or timed out: ${err.message}. Using rule-based text.`);
    return rawText;
  }
}

/**
 * GET /api/voice/status
 * Check local Whisper service health and readiness
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const check = await fetch(`${WHISPER_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (check.ok) {
      const info = await check.json();
      return res.json({ available: true, status: 'online', engine: 'faster-whisper', details: info });
    }
    return res.json({ available: false, status: 'offline', error: 'Whisper service returned non-200' });
  } catch (err: any) {
    return res.json({ available: false, status: 'offline', error: err.message || 'Cannot connect to Whisper service' });
  }
});

/**
 * GET /api/voice/settings
 * Retrieve current voice AI configuration & Whisper engine model details
 */
router.get('/settings', async (_req: Request, res: Response) => {
  const config = getVoiceConfig();
  let whisperEngine: any = {
    available: false,
    current_model: config.active_whisper_model,
    current_device: config.device || 'cpu',
    current_compute_type: config.compute_type || 'int8',
    available_models: [config.active_whisper_model],
    hardware: null
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${WHISPER_SERVICE_URL}/models`, { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      const data: any = await response.json();
      whisperEngine = {
        available: true,
        current_model: data.current_model || config.active_whisper_model,
        current_device: data.current_device || config.device || 'cpu',
        current_compute_type: data.current_compute_type || config.compute_type || 'int8',
        available_models: data.available_models || [config.active_whisper_model],
        hardware: data.hardware || null
      };
    }
  } catch (_e) {
    // whisper service might still be booting up
  }

  return res.json({
    config,
    whisper_engine: whisperEngine
  });
});

/**
 * POST /api/voice/settings
 * Update voice AI configuration and optionally switch Whisper model dynamically
 */
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const {
      active_whisper_model,
      device,
      compute_type,
      llm_postprocessing_enabled,
      ollama_base_url,
      ollama_model,
      llm_temperature,
      llm_prompt_template
    } = req.body;

    const currentConfig = getVoiceConfig();
    let modelSwitchResult = null;

    const targetModel = active_whisper_model || currentConfig.active_whisper_model;
    const targetDevice = device || currentConfig.device || 'auto';
    const targetCompute = compute_type || currentConfig.compute_type || 'auto';

    // If model or device changed, instruct the Python Whisper service to switch
    if (
      (active_whisper_model && active_whisper_model !== currentConfig.active_whisper_model) ||
      (device && device !== currentConfig.device) ||
      (compute_type && compute_type !== currentConfig.compute_type)
    ) {
      try {
        const switchRes = await fetch(`${WHISPER_SERVICE_URL}/switch-model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: targetModel,
            device: targetDevice,
            compute_type: targetCompute
          })
        });
        if (switchRes.ok) {
          modelSwitchResult = await switchRes.json();
        } else {
          const errText = await switchRes.text();
          console.warn('[VOICE] Model switch error on whisper service:', errText);
        }
      } catch (switchErr: any) {
        console.warn('[VOICE] Whisper service not reachable for model switch:', switchErr.message);
      }
    }

    const updatedConfig = saveVoiceConfig({
      active_whisper_model: targetModel,
      device: targetDevice,
      compute_type: targetCompute,
      llm_postprocessing_enabled: typeof llm_postprocessing_enabled === 'boolean' ? llm_postprocessing_enabled : currentConfig.llm_postprocessing_enabled,
      ollama_base_url: ollama_base_url ?? currentConfig.ollama_base_url,
      ollama_model: ollama_model ?? currentConfig.ollama_model,
      llm_temperature: typeof llm_temperature === 'number' ? llm_temperature : currentConfig.llm_temperature,
      llm_prompt_template: llm_prompt_template ?? currentConfig.llm_prompt_template
    });

    return res.json({
      success: true,
      config: updatedConfig,
      whisper_switch: modelSwitchResult
    });
  } catch (err: any) {
    console.error('[VOICE] Error saving settings:', err);
    return res.status(500).json({ error: 'Failed to update settings', details: err.message });
  }
});

/**
 * POST /api/voice/test-llm
 * Live test connection to local Ollama instance
 */
router.post('/test-llm', async (req: Request, res: Response) => {
  const { ollama_base_url, ollama_model } = req.body;
  const baseUrl = (ollama_base_url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = ollama_model || 'llama3.2:latest';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const tagsRes = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);

    if (!tagsRes.ok) {
      return res.status(tagsRes.status).json({
        available: false,
        error: `Ollama returned status ${tagsRes.status}`
      });
    }

    const data: any = await tagsRes.json();
    const installedModels: string[] = (data.models || []).map((m: any) => m.name);
    const hasRequestedModel = installedModels.some(m => m === model || m.startsWith(model.split(':')[0]));

    return res.json({
      available: true,
      status: 'online',
      models: installedModels,
      model_found: hasRequestedModel,
      message: hasRequestedModel
        ? `Connected to Ollama. Model "${model}" is ready for clinical formatting.`
        : `Connected to Ollama, but model "${model}" was not found in installed models (${installedModels.join(', ') || 'none'}). You can pull it via 'ollama pull ${model}'.`
    });
  } catch (err: any) {
    clearTimeout(timer);
    return res.json({
      available: false,
      status: 'offline',
      error: `Could not connect to Ollama at ${baseUrl}: ${err.message}`
    });
  }
});

/**
 * POST /api/voice/process
 * Ingest audio (multipart file or base64) or raw text and process via local faster-whisper + optional LLM
 */
router.post('/process', upload.single('audio'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  let audioFilePath: string | null = null;
  const visitId = req.body.visit_id ? parseInt(req.body.visit_id, 10) : null;
  const fieldName = req.body.field_name || 'unknown_field';
  const mode = req.body.mode || 'QUICK_RECORD';
  const durationSec = req.body.duration_sec ? parseInt(req.body.duration_sec, 10) : 0;
  let rawTranscript = (req.body.raw_transcript || '').trim();
  let processedNote = rawTranscript;
  let aiFilterApplied = 0;

  const config = getVoiceConfig();

  try {
    // 1. Resolve Audio File Path (from multer upload or base64)
    if (req.file) {
      audioFilePath = req.file.path;
    } else if (req.body.audio_b64) {
      let b64Data = req.body.audio_b64;
      if (b64Data.includes(',')) {
        b64Data = b64Data.split(',')[1];
      }
      const buffer = Buffer.from(b64Data, 'base64');
      const filename = `${visitId || 'novisit'}_${fieldName.replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}.webm`;
      audioFilePath = path.join(AUDIO_DIR, filename);
      fs.writeFileSync(audioFilePath, buffer);
    }

    // 2. Transcribe via local faster-whisper if audio is available
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      try {
        const whisperResult = await callLocalWhisper(audioFilePath);
        if (whisperResult.raw_transcript) {
          rawTranscript = whisperResult.raw_transcript;
          processedNote = whisperResult.processed_note;
          aiFilterApplied = 1;
        }
      } catch (whisperErr: any) {
        console.warn('[VOICE] Local Whisper transcription failed or offline:', whisperErr.message);
        if (!rawTranscript) {
          processedNote = rawTranscript;
        }
      }
    } else if (rawTranscript) {
      // If only text provided (e.g. from continuous SpeechRecognition)
      processedNote = rawTranscript;
    }

    // 3. Optional local LLM clinical formatting (Ollama / Llama.cpp)
    if (processedNote && config.llm_postprocessing_enabled) {
      try {
        const formatted = await formatWithLocalLLM(processedNote, fieldName, config);
        if (formatted) {
          processedNote = formatted;
        }
      } catch (llmErr: any) {
        console.warn('[VOICE] LLM formatting error, keeping whisper output:', llmErr.message);
      }
    }

    const processingMs = Date.now() - startTime;

    // 4. Save session in SQLite
    // Guard: ensure we never call res.json() twice (e.g. if client timed out
    // and outer catch already responded before the db callback fires).
    let responseSent = false;

    db.run(
      `INSERT INTO voice_sessions 
        (visit_id, field_name, voice_mode, audio_file_path, raw_transcript, ai_filter_applied, ai_processing_ms, recording_duration_sec) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [visitId, fieldName, mode, audioFilePath, rawTranscript, aiFilterApplied, processingMs, durationSec],
      function (this: any, err: Error | null) {
        if (responseSent || res.writableEnded) return; // already responded
        responseSent = true;

        if (err) {
          console.error('[VOICE] Error saving voice session to DB:', err);
          return res.status(500).json({ error: 'Database save failed', details: err.message });
        }

        const sessionId = this.lastID;
        return res.json({
          session_id: sessionId,
          raw_transcript: rawTranscript,
          processed_note: processedNote,
          ai_filter_applied: aiFilterApplied === 1,
          ai_processing_ms: processingMs,
          audio_file_path: audioFilePath ? `/api/voice/audio/${sessionId}` : null
        });
      }
    );
  } catch (err: any) {
    console.error('[VOICE] Error in /api/voice/process:', err);
    // Only respond if we haven't already (the db callback may have already responded)
    if (!res.writableEnded) {
      return res.status(500).json({ error: 'Voice processing failed', details: err.message });
    }
  }
});


/**
 * GET /api/voice/audio/:sessionId
 * Stream audio recording for review or audit (Role guarded)
 */
router.get('/audio/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  db.get('SELECT * FROM voice_sessions WHERE id = ?', [sessionId], (err: Error | null, session: any) => {
    if (err || !session) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    if (!session.audio_file_path || session.audio_deleted_at || !fs.existsSync(session.audio_file_path)) {
      return res.status(404).json({ error: 'Audio record has expired or was removed' });
    }

    const stat = fs.statSync(session.audio_file_path);
    res.writeHead(200, {
      'Content-Type': 'audio/webm',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes'
    });

    const readStream = fs.createReadStream(session.audio_file_path);
    readStream.pipe(res);
  });
});

/**
 * DELETE /api/voice/session/:sessionId
 * Discard/delete audio recording file immediately
 */
router.delete('/session/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  db.get('SELECT * FROM voice_sessions WHERE id = ?', [sessionId], (err: Error | null, session: any) => {
    if (err || !session) {
      return res.status(404).json({ error: 'Voice session not found' });
    }

    if (session.audio_file_path && fs.existsSync(session.audio_file_path)) {
      try {
        fs.unlinkSync(session.audio_file_path);
      } catch (delErr) {
        console.error('[VOICE] Error unlinking audio file:', delErr);
      }
    }

    db.run(
      `UPDATE voice_sessions 
       SET audio_file_path = NULL, raw_transcript = NULL, audio_deleted_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [sessionId],
      (updateErr: Error | null) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update session record' });
        }
        return res.json({ success: true, message: 'Audio discarded and session cleared' });
      }
    );
  });
});

export default router;
