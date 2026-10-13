import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PenLine, Mic, Radio, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVoiceSession, type VoiceMode } from './useVoiceSession';
import { QuickRecordPanel } from './QuickRecordPanel';
import { LiveTranscribePanel } from './LiveTranscribePanel';
import { VoiceNoticeModal } from './VoiceNoticeModal';
import './voice.css';

interface VoiceInputWrapperProps {
  fieldName: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  visitId?: number | null;
  children: React.ReactNode;
}

export const VoiceInputWrapper: React.FC<VoiceInputWrapperProps> = ({
  fieldName,
  value,
  onChange,
  disabled = false,
  visitId = null,
  children
}) => {
  const { user } = useAuth();
  const { activeField, startSession, endSession } = useVoiceSession();

  const [mode, setMode] = useState<VoiceMode>('TYPE');
  const [showNoticeModal, setShowNoticeModal] = useState<boolean>(false);
  const [pendingMode, setPendingMode] = useState<VoiceMode | null>(null);

  // 60-second Undo State
  const [undoSnapshot, setUndoSnapshot] = useState<string | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState<boolean>(false);

  // Ref to the wrapper div – used to detect if this field has focus
  const wrapperRef = useRef<HTMLDivElement>(null);

  // If another field becomes active, revert this field's mode to TYPE
  useEffect(() => {
    if (activeField && activeField !== fieldName && mode !== 'TYPE') {
      setMode('TYPE');
    }
  }, [activeField, fieldName, mode]);

  // Undo banner timer
  useEffect(() => {
    if (showUndoBanner) {
      const timer = setTimeout(() => {
        setShowUndoBanner(false);
        setUndoSnapshot(null);
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [showUndoBanner]);

  // Role Guard: Nurses do not use clinical voice dictation in consultation
  const userRole = (user?.role || '').toLowerCase();
  const canUseVoice = userRole !== 'nurse';

  // ── Global Dictation Hotkey listener ─────────────────────────────────────
  // We listen for the custom 'voice:hotkey-trigger' event fired by
  // useGlobalDictationHotkey. The field that contains (or is closest to)
  // the currently focused element wins the dictation session.
  const handleHotkeyTrigger = useCallback(() => {
    if (!canUseVoice || disabled) return;

    const focused = document.activeElement;
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    // Accept hotkey if: this wrapper contains the focused element, OR
    // if no field is currently focused (body / null) AND no session is active.
    const hasFocus = wrapperEl.contains(focused);
    const noSessionActive = !activeField;
    const isFocusedOnBody = !focused || focused === document.body;

    if (!hasFocus && !(isFocusedOnBody && noSessionActive)) return;

    if (mode === 'QUICK_RECORD') {
      // Second hotkey press = stop recording (handled by panel itself via
      // the mode change back to TYPE)
      handlePanelCancel();
    } else if (mode === 'TYPE') {
      handleModeChange('QUICK_RECORD');
    }
  }, [canUseVoice, disabled, mode, activeField]);

  useEffect(() => {
    if (!canUseVoice) return;
    window.addEventListener('voice:hotkey-trigger', handleHotkeyTrigger as EventListener);
    return () => window.removeEventListener('voice:hotkey-trigger', handleHotkeyTrigger as EventListener);
  }, [canUseVoice, handleHotkeyTrigger]);
  // ─────────────────────────────────────────────────────────────────────────

  if (!canUseVoice) {
    return <>{children}</>;
  }

  const handleModeChange = (targetMode: VoiceMode) => {
    if (disabled || targetMode === mode) return;

    if (targetMode === 'TYPE') {
      endSession(fieldName);
      setMode('TYPE');
      return;
    }

    // Check one-time notice acceptance
    const accepted = localStorage.getItem('voice_notice_acknowledged');
    if (!accepted) {
      setPendingMode(targetMode);
      setShowNoticeModal(true);
      return;
    }

    startSession(fieldName, targetMode);
    setMode(targetMode);
  };

  const handleNoticeAccept = () => {
    localStorage.setItem('voice_notice_acknowledged', 'true');
    setShowNoticeModal(false);
    if (pendingMode) {
      startSession(fieldName, pendingMode);
      setMode(pendingMode);
      setPendingMode(null);
    }
  };

  const handleNoticeCancel = () => {
    setShowNoticeModal(false);
    setPendingMode(null);
    setMode('TYPE');
  };

  const handleTextCommit = (text: string, action: 'append' | 'replace') => {
    if (!text.trim()) {
      setMode('TYPE');
      endSession(fieldName);
      return;
    }

    // Store undo snapshot
    const prev = value || '';
    setUndoSnapshot(prev);
    setShowUndoBanner(true);

    if (action === 'replace') {
      onChange(text);
    } else {
      const appended = prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text;
      onChange(appended);
    }

    setMode('TYPE');
    endSession(fieldName);
  };

  const handleUndo = () => {
    if (undoSnapshot !== null) {
      onChange(undoSnapshot);
      setShowUndoBanner(false);
      setUndoSnapshot(null);
    }
  };

  const handlePanelCancel = () => {
    setMode('TYPE');
    endSession(fieldName);
  };

  return (
    <div className="voice-wrapper" ref={wrapperRef} data-voice-field={fieldName}>
      <div className="voice-toolbar">
        <div className="voice-mode-group">
          <button
            type="button"
            className={`voice-mode-btn ${mode === 'TYPE' ? 'active' : ''}`}
            onClick={() => handleModeChange('TYPE')}
            disabled={disabled}
            title="Standard typing mode"
          >
            <PenLine size={13} />
            <span>Type</span>
          </button>

          <button
            type="button"
            className={`voice-mode-btn ${mode === 'QUICK_RECORD' ? 'active' : ''}`}
            onClick={() => handleModeChange('QUICK_RECORD')}
            disabled={disabled}
            title="Record audio dictation and transcribe with local Whisper AI"
          >
            <Mic size={13} />
            <span>Quick Record</span>
          </button>

          <button
            type="button"
            className={`voice-mode-btn ${mode === 'LIVE_TRANSCRIBE' ? 'active' : ''}`}
            onClick={() => handleModeChange('LIVE_TRANSCRIBE')}
            disabled={disabled}
            title="Real-time continuous speech transcription"
          >
            <Radio size={13} />
            <span>Live Transcribe</span>
          </button>
        </div>

        <span className="voice-toolbar-status">
          {mode === 'TYPE' && (() => {
            try {
              const cfg = JSON.parse(localStorage.getItem('voice_hotkey_config') || '{}');
              if (cfg.enabled === false) return null;
              const parts: string[] = [];
              if (cfg.ctrl)  parts.push('Ctrl');
              if (cfg.alt)   parts.push('Alt');
              if (cfg.shift) parts.push('Shift');
              const k = cfg.key === ' ' ? 'Space' : (cfg.key || 'Space');
              parts.push(k);
              return <span style={{ opacity: 0.55, fontStyle: 'italic' }}>⌨️ {parts.join('+')} to dictate</span>;
            } catch { return null; }
          })()}
          {mode === 'QUICK_RECORD' && '🎙️ Push-to-talk'}
          {mode === 'LIVE_TRANSCRIBE' && '⚡ Live stream'}
        </span>
      </div>

      {showUndoBanner && (
        <div className="voice-undo-banner">
          <span>Voice text added to field.</span>
          <button type="button" className="voice-undo-action" onClick={handleUndo}>
            <RotateCcw size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />
            Undo action (60s)
          </button>
        </div>
      )}

      {mode === 'QUICK_RECORD' && (
        <QuickRecordPanel
          fieldName={fieldName}
          visitId={visitId}
          onDone={handleTextCommit}
          onCancel={handlePanelCancel}
        />
      )}

      {mode === 'LIVE_TRANSCRIBE' && (
        <LiveTranscribePanel
          fieldName={fieldName}
          visitId={visitId}
          onDone={handleTextCommit}
          onCancel={handlePanelCancel}
        />
      )}

      <VoiceNoticeModal
        isOpen={showNoticeModal}
        onAccept={handleNoticeAccept}
        onCancel={handleNoticeCancel}
      />

      {children}
    </div>
  );
};
