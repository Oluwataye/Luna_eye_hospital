/**
 * useGlobalDictationHotkey
 * -------------------------
 * Registers a window-level keydown listener for the configured dictation
 * hotkey (default: Ctrl+Space). When fired it dispatches a custom DOM event
 * `voice:hotkey-trigger` so that whichever VoiceInputWrapper currently wraps
 * the focused field can pick it up and activate Quick Record dictation.
 *
 * Hotkey config is persisted in localStorage under 'voice_hotkey_config'.
 */

import { useEffect, useCallback } from 'react';

export interface HotkeyConfig {
  /** Primary key – e.g. ' ' (Space), 'F8', 'F9' */
  key: string;
  /** Whether Ctrl / Meta must be held */
  ctrl: boolean;
  /** Whether Alt must be held */
  alt: boolean;
  /** Whether Shift must be held */
  shift: boolean;
  /** Enabled toggle */
  enabled: boolean;
}

export const DEFAULT_HOTKEY: HotkeyConfig = {
  key: ' ',   // Space
  ctrl: true,
  alt: false,
  shift: false,
  enabled: true,
};

export const HOTKEY_STORAGE_KEY = 'voice_hotkey_config';

/** Load config from localStorage, fallback to DEFAULT_HOTKEY */
export function loadHotkeyConfig(): HotkeyConfig {
  try {
    const raw = localStorage.getItem(HOTKEY_STORAGE_KEY);
    if (raw) return { ...DEFAULT_HOTKEY, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt storage
  }
  return { ...DEFAULT_HOTKEY };
}

/** Save config to localStorage */
export function saveHotkeyConfig(config: HotkeyConfig): void {
  localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(config));
}

/** Returns a human-readable label, e.g. "Ctrl + Space" */
export function hotkeyLabel(cfg: HotkeyConfig): string {
  const parts: string[] = [];
  if (cfg.ctrl)  parts.push('Ctrl');
  if (cfg.alt)   parts.push('Alt');
  if (cfg.shift) parts.push('Shift');

  const keyName = cfg.key === ' ' ? 'Space' : cfg.key;
  parts.push(keyName);
  return parts.join(' + ');
}

/**
 * Hook – call once near the root of the authenticated app (e.g. App.tsx or
 * a root layout component). It reads hotkey config from localStorage on each
 * mount and re-reads it if `configVersion` changes.
 */
export function useGlobalDictationHotkey(configVersion?: number) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const cfg = loadHotkeyConfig();
    if (!cfg.enabled) return;

    const ctrlMatch  = cfg.ctrl  ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
    const altMatch   = cfg.alt   ? e.altKey   : !e.altKey;
    const shiftMatch = cfg.shift ? e.shiftKey : !e.shiftKey;
    const keyMatch   = e.key === cfg.key;

    if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
      // Prevent default (e.g. browser scroll on Ctrl+Space)
      e.preventDefault();
      e.stopPropagation();

      // Dispatch custom event; VoiceInputWrapper listeners pick this up
      window.dispatchEvent(new CustomEvent('voice:hotkey-trigger', {
        bubbles: true,
        detail: { timestamp: Date.now() }
      }));
    }
  }, [configVersion]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}
