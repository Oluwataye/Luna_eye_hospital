import React from 'react';
import { Mic, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface VoiceNoticeModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export const VoiceNoticeModal: React.FC<VoiceNoticeModalProps> = ({ isOpen, onAccept, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="voice-modal-backdrop">
      <div className="voice-modal-content">
        <div className="voice-modal-header">
          <div style={{ background: '#f0fdfa', padding: 8, borderRadius: 8, color: '#0d9488' }}>
            <Mic size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Luna Eye Hospital — Clinical Voice Assistant
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Offline & Privacy-Preserving Voice Dictation
            </p>
          </div>
        </div>

        <div className="voice-modal-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <ShieldCheck size={20} color="#0d9488" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#0f172a' }}>100% Local & Confidential</strong>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                All audio is transcribed locally using our in-house Whisper AI engine on the hospital server. No patient audio or data ever leaves this network.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <CheckCircle2 size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#0f172a' }}>Clinician Verification Required</strong>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Voice dictation generates clinical drafts. You maintain full professional oversight and must review and verify all text before saving.
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: 11, color: '#64748b' }}>
            💡 Audio files are automatically pruned after 7 days in accordance with Luna Eye Hospital clinical privacy and data retention standards.
          </div>
        </div>

        <div className="voice-modal-footer">
          <button className="voice-btn-secondary" onClick={onCancel}>
            Not Now
          </button>
          <button className="voice-btn-primary" onClick={onAccept}>
            I Understand & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
