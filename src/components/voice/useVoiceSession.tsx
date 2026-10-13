import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type VoiceMode = 'TYPE' | 'QUICK_RECORD' | 'LIVE_TRANSCRIBE';

interface VoiceSessionContextType {
  activeField: string | null;
  activeMode: VoiceMode;
  isRecording: boolean;
  recordingSeconds: number;
  startSession: (fieldName: string, mode: VoiceMode) => boolean;
  endSession: (fieldName: string) => void;
  setRecordingDuration: (seconds: number) => void;
  pauseActiveSession: () => void;
}

const VoiceSessionContext = createContext<VoiceSessionContextType>({
  activeField: null,
  activeMode: 'TYPE',
  isRecording: false,
  recordingSeconds: 0,
  startSession: () => false,
  endSession: () => {},
  setRecordingDuration: () => {},
  pauseActiveSession: () => {}
});

export const VoiceSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<VoiceMode>('TYPE');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const activeSessionRef = useRef<{ field: string | null; mode: VoiceMode }>({ field: null, mode: 'TYPE' });

  const startSession = useCallback((fieldName: string, mode: VoiceMode): boolean => {
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

  return (
    <VoiceSessionContext.Provider
      value={{
        activeField,
        activeMode,
        isRecording,
        recordingSeconds,
        startSession,
        endSession,
        setRecordingDuration,
        pauseActiveSession
      }}
    >
      {children}
    </VoiceSessionContext.Provider>
  );
};

export const useVoiceSession = () => useContext(VoiceSessionContext);
