import { useCallback, useState } from 'react';

/**
 * A number setting that survives a reload, kept in this browser only, and
 * always within `[min, max]` — a stored value from an older version, or one
 * edited by hand, cannot put a setting out of range.
 *
 * Effectful: reads and writes `localStorage`. Storage can be missing, full or
 * forbidden, so every access is guarded and the setting falls back to
 * `initial` for the page's lifetime.
 */
export const useRememberedNumber = (
  key: string,
  initial: number,
  min: number,
  max: number,
): [number, (value: number) => void] => {
  const within = (value: number) => Math.min(max, Math.max(min, value));
  const [value, setValue] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(key));
      return window.localStorage.getItem(key) === null || !Number.isFinite(stored) ? initial : within(stored);
    } catch {
      return initial;
    }
  });
  const remember = useCallback(
    (next: number) => {
      const kept = Math.min(max, Math.max(min, next));
      setValue(kept);
      try {
        window.localStorage.setItem(key, String(kept));
      } catch {
        // Not remembered, but still applied for this visit.
      }
    },
    [key, min, max],
  );
  return [value, remember];
};
