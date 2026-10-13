import React, { useState } from 'react';
import { PlusCircle, RefreshCw, Trash2, ChevronDown, ChevronUp, Sparkles, Volume2 } from 'lucide-react';

interface VoiceReviewPanelProps {
  processedNote: string;
  rawTranscript: string;
  sessionId: number | null;
  audioUrl: string | null;
  duration?: number;
  onAppend: (text: string) => void;
  onReplace: (text: string) => void;
  onDiscard: () => void;
}

export const VoiceReviewPanel: React.FC<VoiceReviewPanelProps> = ({
  processedNote,
  rawTranscript,
  sessionId,
  audioUrl,
  duration,
  onAppend,
  onReplace,
  onDiscard
}) => {
  const [showRaw, setShowRaw] = useState(false);
  const [editedNote, setEditedNote] = useState(processedNote);

  const handleDiscard = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/voice/session/${sessionId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('[VOICE] Discard error:', err);
      }
    }
    onDiscard();
  };

  return (
    <div className="voice-panel" style={{ borderLeft: '4px solid var(--leh-primary, #0d9488)' }}>
      <div className="voice-review-box">
        <div className="voice-review-title">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#0d9488" />
            Transcribed Clinical Note (Review & Confirm)
          </span>
          {duration ? <span style={{ fontSize: 11, color: '#64748b' }}>{Math.round(duration)}s audio</span> : null}
        </div>

        <textarea
          style={{
            width: '100%',
            minHeight: '75px',
            border: '1px solid #99f6e4',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '13px',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            resize: 'vertical',
            background: '#ffffff',
            color: '#134e4a'
          }}
          value={editedNote}
          onChange={(e) => setEditedNote(e.target.value)}
          placeholder="Transcribed note content..."
        />

        {audioUrl && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Volume2 size={16} color="#0d9488" />
            <audio controls src={audioUrl} style={{ height: 28, flex: 1, maxWidth: 300 }} />
          </div>
        )}

        {rawTranscript && rawTranscript !== editedNote && (
          <div className="voice-raw-accordion" onClick={() => setShowRaw(!showRaw)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Compare with raw speech output</span>
              {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
            {showRaw && (
              <div style={{ marginTop: 6, fontStyle: 'italic', background: '#f1f5f9', padding: '6px 8px', borderRadius: 4, color: '#475569' }}>
                "{rawTranscript}"
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <button
          type="button"
          className="voice-btn-danger"
          onClick={handleDiscard}
          title="Discard audio recording and text"
        >
          <Trash2 size={13} />
          Discard
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="voice-btn-secondary"
            onClick={() => onReplace(editedNote)}
            title="Replace field text completely with this transcription"
          >
            <RefreshCw size={13} />
            Replace Content
          </button>

          <button
            type="button"
            className="voice-btn-primary"
            onClick={() => onAppend(editedNote)}
            title="Append this transcription to existing field text"
          >
            <PlusCircle size={14} />
            Append to Field
          </button>
        </div>
      </div>
    </div>
  );
};
