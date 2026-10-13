import React, { useState, useEffect, useRef } from 'react';
import { Square, Loader2, AlertCircle } from 'lucide-react';
import { useVoiceSession } from './useVoiceSession';
import { useSpeechRecognition } from './useSpeechRecognition';
import { VoiceReviewPanel } from './VoiceReviewPanel';

interface LiveTranscribePanelProps {
  fieldName: string;
  visitId: number | null;
  onDone: (text: string, action: 'append' | 'replace') => void;
  onCancel: () => void;
}

export const LiveTranscribePanel: React.FC<LiveTranscribePanelProps> = ({
  fieldName,
  visitId,
  onDone,
  onCancel
}) => {
  const { setRecordingDuration } = useVoiceSession();
  const { interimText, finalText, start, stop, error: speechError } = useSpeechRecognition();

  const [status, setStatus] = useState<'listening' | 'processing' | 'review' | 'error'>('listening');
  const [seconds, setSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [wsLiveText, setWsLiveText] = useState<string>('');
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  const [reviewData, setReviewData] = useState<{
    processedNote: string;
    rawTranscript: string;
    sessionId: number | null;
    audioUrl: string | null;
    duration: number;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function initLiveCapture() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        audioChunksRef.current = [];

        // 1. Establish WebSocket connection to backend for offline streaming
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}/api/voice/live-ws`;
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            if (!isCancelled) {
              setIsWsConnected(true);
              ws.send(JSON.stringify({ type: 'start' }));
            }
          };

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'partial' || msg.type === 'final') {
                const text = msg.text || '';
                if (text && !isCancelled) {
                  setWsLiveText(text);
                }
              }
            } catch {}
          };

          ws.onerror = () => {
            setIsWsConnected(false);
          };

          ws.onclose = () => {
            setIsWsConnected(false);
          };
        } catch (wsErr) {
          console.warn('[VOICE WS] Could not open WebSocket, falling back to speech recognition:', wsErr);
        }

        // 2. Initialize MediaRecorder
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined
        });

        recorder.ondataavailable = async (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
            // Stream audio chunk to WebSocket
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              try {
                const arrayBuf = await e.data.arrayBuffer();
                wsRef.current.send(arrayBuf);
              } catch {}
            }
          }
        };

        // Stream audio chunks every 750ms for smooth live updates
        recorder.start(750);
        mediaRecorderRef.current = recorder;

        // Also start browser speech recognition as concurrent fallback
        start();
        setStatus('listening');

        // Timer
        timerRef.current = setInterval(() => {
          setSeconds((prev) => {
            const next = prev + 1;
            setRecordingDuration(next);
            if (next >= 1800) {
              // 30 min max limit
              handleStop();
            }
            return next;
          });
        }, 1000);
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(
          err.name === 'NotAllowedError'
            ? 'Microphone permission denied.'
            : 'Live audio capture error: ' + (err.message || 'Unknown error')
        );
      }
    }

    initLiveCapture();

    return () => {
      isCancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      stop();
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'stop' }));
          }
          wsRef.current.close();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Auto-scroll transcript container
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalText, interimText, wsLiveText]);

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stop();

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      finalizeWithText(finalText || interimText);
      return;
    }

    setStatus('processing');

    mediaRecorderRef.current.onstop = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm'
      });

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'live_transcribe.webm');
        formData.append('field_name', fieldName);
        formData.append('mode', 'LIVE_TRANSCRIBE');
        formData.append('duration_sec', seconds.toString());
        const effectiveText = (wsLiveText || (finalText + ' ' + interimText)).trim();
        formData.append('raw_transcript', effectiveText);
        if (visitId) formData.append('visit_id', visitId.toString());

        const res = await fetch('/api/voice/process', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        setReviewData({
          processedNote: data.processed_note || effectiveText,
          rawTranscript: data.raw_transcript || effectiveText,
          sessionId: data.session_id,
          audioUrl: data.audio_file_path || null,
          duration: seconds
        });
        setStatus('review');
      } catch (err: any) {
        console.warn('[VOICE] Process fallback to live text:', err);
        finalizeWithText((wsLiveText || (finalText + ' ' + interimText)).trim());
      }
    };

    mediaRecorderRef.current.stop();
  };

  const finalizeWithText = (text: string) => {
    setReviewData({
      processedNote: text,
      rawTranscript: text,
      sessionId: null,
      audioUrl: null,
      duration: seconds
    });
    setStatus('review');
  };

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const currentDisplay = wsLiveText || (finalText + ' ' + interimText).trim();
  const wordCount = currentDisplay.split(/\s+/).filter(Boolean).length;

  if (status === 'review' && reviewData) {
    return (
      <VoiceReviewPanel
        processedNote={reviewData.processedNote}
        rawTranscript={reviewData.rawTranscript}
        sessionId={reviewData.sessionId}
        audioUrl={reviewData.audioUrl}
        duration={reviewData.duration}
        onAppend={(text) => onDone(text, 'append')}
        onReplace={(text) => onDone(text, 'replace')}
        onDiscard={onCancel}
      />
    );
  }

  return (
    <div className="voice-panel">
      {status === 'listening' && (
        <div className="voice-recording-card">
          <div className="voice-recording-header">
            <div className="voice-pulse-indicator">
              <span className="voice-dot-pulse" />
              <span>Live Dictation Active</span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10,
                background: isWsConnected ? '#ecfdf5' : '#eff6ff',
                color: isWsConnected ? '#059669' : '#0284c7',
                border: `1px solid ${isWsConnected ? '#a7f3d0' : '#bfdbfe'}`,
                marginLeft: 4
              }}>
                {isWsConnected ? 'Local Faster-Whisper Stream' : 'Browser Engine'}
              </span>
            </div>
            <div className="voice-timer">{formatTimer(seconds)}</div>
          </div>

          <div
            ref={scrollRef}
            className="voice-transcript-stream"
          >
            {wsLiveText ? (
              <span style={{ color: '#0f172a' }}>{wsLiveText}</span>
            ) : (
              <>
                {finalText ? <span style={{ color: '#0f172a' }}>{finalText} </span> : null}
                {interimText ? <span className="voice-interim-text">{interimText}</span> : null}
              </>
            )}
            {!currentDisplay && (
              <span style={{ color: '#94a3b8' }}>Listening... Speak into microphone.</span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {wordCount} words captured
            </span>
            <div className="voice-action-row">
              <button type="button" className="voice-btn-primary" onClick={handleStop}>
                <Square size={14} fill="currentColor" />
                Finish & Review
              </button>
              <button type="button" className="voice-btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#0f766e' }}>
          <Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Finalizing transcription...</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Formatting clinical notes with offline AI
          </div>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#b91c1c', marginBottom: 8 }}>
            <AlertCircle size={18} />
            <strong>Speech Recognition Unavailable</strong>
          </div>
          <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>{errorMessage || speechError}</div>
          <button type="button" className="voice-btn-secondary" onClick={onCancel}>
            Close & Return to Typing
          </button>
        </div>
      )}
    </div>
  );
};
