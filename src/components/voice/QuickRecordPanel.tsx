import React, { useState, useEffect, useRef } from 'react';
import { Square, Loader2, AlertCircle } from 'lucide-react';
import { useVoiceSession } from './useVoiceSession';
import { VoiceReviewPanel } from './VoiceReviewPanel';

interface QuickRecordPanelProps {
  fieldName: string;
  visitId: number | null;
  onDone: (text: string, action: 'append' | 'replace') => void;
  onCancel: () => void;
}

export const QuickRecordPanel: React.FC<QuickRecordPanelProps> = ({
  fieldName,
  visitId,
  onDone,
  onCancel
}) => {
  const { setRecordingDuration } = useVoiceSession();
  const [status, setStatus] = useState<'recording' | 'processing' | 'review' | 'error'>('recording');
  const [seconds, setSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

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
  const timerRef = useRef<any>(null);

  // Start recording on mount
  useEffect(() => {
    let isCancelled = false;

    async function initRecorder() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const options = { mimeType: 'audio/webm' };
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, options);
        } catch {
          recorder = new MediaRecorder(stream);
        }

        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(250); // Slice into 250ms chunks
        mediaRecorderRef.current = recorder;
        setStatus('recording');

        // Timer
        timerRef.current = setInterval(() => {
          setSeconds((prev) => {
            const next = prev + 1;
            setRecordingDuration(next);
            // 10 minute maximum limit
            if (next >= 600) {
              stopRecording();
            }
            return next;
          });
        }, 1000);
      } catch (err: any) {
        console.error('[VOICE] Microphone access failed:', err);
        setStatus('error');
        setErrorMessage(
          err.name === 'NotAllowedError'
            ? 'Microphone access was denied. Please allow microphone permissions in your browser settings.'
            : 'Could not initialize audio capture: ' + (err.message || 'Unknown error')
        );
      }
    }

    initRecorder();

    return () => {
      isCancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
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

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

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
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('field_name', fieldName);
        formData.append('mode', 'QUICK_RECORD');
        formData.append('duration_sec', seconds.toString());
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
          processedNote: data.processed_note || '',
          rawTranscript: data.raw_transcript || '',
          sessionId: data.session_id,
          audioUrl: data.audio_file_path || null,
          duration: seconds
        });
        setStatus('review');
      } catch (err: any) {
        console.error('[VOICE] Processing error:', err);
        setStatus('error');
        setErrorMessage('Failed to transcribe audio: ' + (err.message || 'Unknown network error'));
      }
    };

    mediaRecorderRef.current.stop();
  };

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

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
      {status === 'recording' && (
        <div className="voice-recording-card">
          <div className="voice-recording-header">
            <div className="voice-pulse-indicator">
              <span className="voice-dot-pulse" />
              <span>Recording Voice Dictation</span>
            </div>
            <div className={`voice-timer ${seconds > 580 ? 'warning' : ''}`}>
              {formatTimer(seconds)} {seconds > 580 ? '(Max limit approaching)' : ''}
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#64748b' }}>
            Speak clearly into your microphone. Say commands like "period", "comma", or "new line" to structure notes.
          </div>

          <div className="voice-action-row">
            <button type="button" className="voice-btn-primary" onClick={stopRecording}>
              <Square size={14} fill="currentColor" />
              Stop & Transcribe
            </button>
            <button type="button" className="voice-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#0f766e' }}>
          <Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Transcribing with local Whisper AI...</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Running offline inference on hospital server ({seconds}s audio)
          </div>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#b91c1c', marginBottom: 8 }}>
            <AlertCircle size={18} />
            <strong>Voice Capture Notice</strong>
          </div>
          <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>{errorMessage}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="voice-btn-secondary" onClick={onCancel}>
              Close & Return to Typing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
