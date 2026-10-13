import { useState, useRef, useEffect, useCallback } from 'react';

// Declare Web Speech API types
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [interimText, setInterimText] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef<boolean>(false);
  const langIndexRef = useRef<number>(0);
  const languages = ['en-NG', 'en-GB', 'en-US'];

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      setIsSupported(true);
    }
  }, []);

  const createRecognition = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return null;

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languages[langIndexRef.current] || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript + ' ';
        } else {
          interim += item[0].transcript;
        }
      }

      if (final) {
        setFinalText((prev) => (prev ? prev + ' ' + final.trim() : final.trim()));
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[SPEECH] Error occurred:', event.error);
      if (event.error === 'language-not-supported' && langIndexRef.current < languages.length - 1) {
        langIndexRef.current += 1;
        console.log('[SPEECH] Falling back to language:', languages[langIndexRef.current]);
      } else if (event.error !== 'no-speech') {
        setError(`Speech recognition: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Chrome automatically stops after ~60s of silence or audio stream
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    return recognition;
  }, []);

  const start = useCallback(() => {
    setError(null);
    shouldListenRef.current = true;
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = createRecognition();
      }
      recognitionRef.current?.start();
      setListening(true);
    } catch (e: any) {
      console.warn('[SPEECH] Start error:', e.message);
    }
  }, [createRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    setFinalText('');
    setInterimText('');
    setError(null);
  }, []);

  return {
    isSupported,
    listening,
    interimText,
    finalText,
    start,
    stop,
    reset,
    error
  };
}
