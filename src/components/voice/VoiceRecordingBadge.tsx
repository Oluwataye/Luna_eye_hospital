import React from 'react';
import { useVoiceSession } from './useVoiceSession';

interface VoiceRecordingBadgeProps {
  className?: string;
}

export const VoiceRecordingBadge: React.FC<VoiceRecordingBadgeProps> = ({ className = '' }) => {
  const { isRecording, activeField, recordingSeconds } = useVoiceSession();

  if (!isRecording || !activeField) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const readableFieldName = activeField
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`voice-global-badge ${className}`} title={`Recording audio for ${readableFieldName}`}>
      <span className="voice-dot-pulse" />
      <span>Recording: {readableFieldName} ({formatTime(recordingSeconds)})</span>
    </div>
  );
};
