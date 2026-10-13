import { useState, useRef, useCallback } from 'react';

export interface UseLiveVoiceWebSocketOptions {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (err: string) => void;
}

export function useLiveVoiceWebSocket(options?: UseLiveVoiceWebSocketOptions) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setLiveTranscript('');

    try {
      // 1. Establish microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Open WebSocket to backend
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/voice/live-ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsStreaming(true);
        ws.send(JSON.stringify({ type: 'start' }));

        // 3. Initialize MediaRecorder once socket is open
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : undefined
        });

        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await e.data.arrayBuffer();
            ws.send(arrayBuffer);
          }
        };

        // Chunk audio every 1000ms for continuous streaming passes
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'partial' || msg.type === 'final') {
            const text = msg.text || '';
            setLiveTranscript(text);
            if (msg.type === 'partial' && options?.onPartial) {
              options.onPartial(text);
            }
            if (msg.type === 'final' && options?.onFinal) {
              options.onFinal(text);
            }
          }
        } catch {}
      };

      ws.onerror = (_e) => {
        const errMsg = 'Local WebSocket audio streaming disconnected';
        setError(errMsg);
        if (options?.onError) options.onError(errMsg);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsStreaming(false);
      };
    } catch (err: any) {
      const msg = err.message || 'Microphone or WebSocket connection failed';
      setError(msg);
      if (options?.onError) options.onError(msg);
    }
  }, [options]);

  const stop = useCallback(() => {
    setIsStreaming(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
        wsRef.current.close();
      } catch {}
    }

    setIsConnected(false);
  }, []);

  return {
    start,
    stop,
    isConnected,
    isStreaming,
    liveTranscript,
    error
  };
}
