import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../../api';

export type VoiceMode = 'TYPE' | 'QUICK_RECORD' | 'LIVE_TRANSCRIBE';

interface VoiceSessionContextType {
  activeField: string | null;
  activeMode: VoiceMode;
  isRecording: boolean;
  recordingSeconds: number;
  isAiAvailable: boolean;
  startSession: (fieldName: string, mode: VoiceMode) => boolean;
  endSession: (fieldName: string) => void;
  setRecordingDuration: (seconds: number) => void;
  pauseActiveSession: () => void;
  refreshVoiceSettings: () => Promise<void>;
}

const VoiceSessionContext = createContext<VoiceSessionContextType>({
  activeField: null,
  activeMode: 'TYPE',
  isRecording: false,
  recordingSeconds: 0,
  isAiAvailable: true,
  startSession: () => false,
  endSession: () => {},
  setRecordingDuration: () => {},
  pauseActiveSession: () => {},
  refreshVoiceSettings: async () => {}
});

export const VoiceSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<VoiceMode>('TYPE');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isAiAvailable, setIsAiAvailable] = useState<boolean>(true);
  const activeSessionRef = useRef<{ field: string | null; mode: VoiceMode }>({ field: null, mode: 'TYPE' });

  const refreshVoiceSettings = useCallback(async () => {
    try {
      const data = await api.getVoiceSettings();
      if (data?.config && typeof data.config.ai_enabled === 'boolean') {
        setIsAiAvailable(data.config.ai_enabled);
      } else if (data?.config && data.config.ai_enabled !== undefined) {
        setIsAiAvailable(data.config.ai_enabled !== false);
      }
    } catch {}
  }, []);

  const endSession = useCallback((fieldName: string) => {
    if (activeSessionRef.current.field === fieldName) {
      activeSessionRef.current = { field: null, mode: 'TYPE' };
      setActiveField(null);
      setActiveMode('TYPE');
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  }, []);

  const pauseActiveSession = useCallback(() => {
    setIsRecording(false);
  }, []);

  const setRecordingDuration = useCallback((seconds: number) => {
    setRecordingSeconds(seconds);
  }, []);

  React.useEffect(() => {
    refreshVoiceSettings();

    // Instant real-time listener: updates state across all open workstations without polling delay
    const handleVoiceStatusUpdate = (e: any) => {
      if (typeof e?.detail?.ai_enabled === 'boolean') {
        const enabled = e.detail.ai_enabled;
        setIsAiAvailable(enabled);
        if (!enabled && activeSessionRef.current.field) {
          // Immediately terminate recording if AI is paused while speaking
          endSession(activeSessionRef.current.field);
        }
      }
    };

    window.addEventListener('voice-ai-status-change', handleVoiceStatusUpdate);

    // Fallback polling every 30 seconds for network reconnection resilience
    const interval = setInterval(refreshVoiceSettings, 30000);
    return () => {
      window.removeEventListener('voice-ai-status-change', handleVoiceStatusUpdate);
      clearInterval(interval);
    };
  }, [refreshVoiceSettings, endSession]);

  const startSession = useCallback((fieldName: string, mode: VoiceMode): boolean => {
    // If AI is paused by admin and doctor tries to record, block session
    if (!isAiAvailable && mode !== 'TYPE') {
      return false;
    }

    // If another field is currently recording, stop/switch
    if (activeSessionRef.current.field && activeSessionRef.current.field !== fieldName) {
      console.warn(`[VOICE] Switching active session from ${activeSessionRef.current.field} to ${fieldName}`);
    }

    activeSessionRef.current = { field: fieldName, mode };
    setActiveField(fieldName);
    setActiveMode(mode);
    setIsRecording(mode !== 'TYPE');
    setRecordingSeconds(0);
    return true;
  }, [isAiAvailable]);

  return (
    <VoiceSessionContext.Provider
      value={{
        activeField,
        activeMode,
        isRecording,
        recordingSeconds,
        isAiAvailable,
        startSession,
        endSession,
        setRecordingDuration,
        pauseActiveSession,
        refreshVoiceSettings
      }}
    >
      {children}
    </VoiceSessionContext.Provider>
  );
};

export const useVoiceSession = () => useContext(VoiceSessionContext);
