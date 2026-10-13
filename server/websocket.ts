import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const WHISPER_SERVICE_URL = process.env.WHISPER_URL || 'http://127.0.0.1:8765';

interface LiveSession {
  id: string;
  ws: WebSocket;
  chunks: Buffer[];
  isTranscribing: boolean;
  hasPendingPass: boolean;
  lastTranscript: string;
  tempFilePath: string;
}

export function setupVoiceWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/api/voice/live-ws' });

  const tempDir = path.resolve(__dirname.includes('dist') ? path.join(__dirname, '..') : __dirname, 'audio', 'live_tmp');
  if (!fs.existsSync(tempDir)) {
    try {
      fs.mkdirSync(tempDir, { recursive: true });
    } catch {}
  }

  wss.on('connection', (ws: WebSocket) => {
    const sessionId = crypto.randomUUID();
    const tempFilePath = path.join(tempDir, `live_${sessionId}.webm`);

    const session: LiveSession = {
      id: sessionId,
      ws,
      chunks: [],
      isTranscribing: false,
      hasPendingPass: false,
      lastTranscript: '',
      tempFilePath
    };

    const runTranscriptionPass = async (isFinal = false) => {
      if (session.chunks.length === 0 || !fs.existsSync(session.tempFilePath)) {
        return;
      }

      if (session.isTranscribing && !isFinal) {
        session.hasPendingPass = true;
        return;
      }

      session.isTranscribing = true;

      try {
        const endpoint = isFinal ? `${WHISPER_SERVICE_URL}/transcribe` : `${WHISPER_SERVICE_URL}/stream-transcribe`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_path: session.tempFilePath })
        });

        if (res.ok) {
          const data: any = await res.json();
          const transcript = data.raw_transcript || data.text || '';
          if (transcript && transcript !== session.lastTranscript) {
            session.lastTranscript = transcript;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: isFinal ? 'final' : 'partial',
                text: transcript,
                processed_note: data.processed_note || transcript
              }));
            }
          }
        }
      } catch (err: any) {
        console.warn(`[VOICE WS] Transcription error for session ${session.id}:`, err.message);
      } finally {
        session.isTranscribing = false;
        if (session.hasPendingPass && !isFinal) {
          session.hasPendingPass = false;
          runTranscriptionPass(false);
        }
      }
    };

    ws.on('message', async (data: any, isBinary: boolean) => {
      try {
        if (isBinary) {
          // Audio chunk from browser MediaRecorder
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          session.chunks.push(buffer);

          // Append chunk to temp file
          fs.appendFileSync(session.tempFilePath, buffer);

          // Trigger throttled transcription pass
          runTranscriptionPass(false);
        } else {
          // JSON control frame
          const text = data.toString();
          const msg = JSON.parse(text);

          if (msg.type === 'start') {
            session.chunks = [];
            session.lastTranscript = '';
            if (fs.existsSync(session.tempFilePath)) {
              try { fs.unlinkSync(session.tempFilePath); } catch {}
            }
            ws.send(JSON.stringify({ type: 'ready', sessionId: session.id }));
          } else if (msg.type === 'stop') {
            await runTranscriptionPass(true);
            ws.send(JSON.stringify({
              type: 'complete',
              text: session.lastTranscript,
              sessionId: session.id
            }));
          }
        }
      } catch (err: any) {
        console.error('[VOICE WS] Error handling message:', err);
      }
    });

    const cleanup = () => {
      if (fs.existsSync(session.tempFilePath)) {
        try {
          fs.unlinkSync(session.tempFilePath);
        } catch {}
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  console.log('[VOICE WS] WebSocket live transcription service listening on /api/voice/live-ws');
  return wss;
}
