import { useCallback, useState } from 'react';

/**
 * A yes/no setting that survives a reload, kept in this browser only.
 *
 * Effectful: reads and writes `localStorage`. Storage can be missing, full or
 * forbidden (private windows, embedded views), so every access is guarded and
 * the flag simply falls back to `initial` and lives for the page's lifetime.
 */
export const useRememberedFlag = (key: string, initial: boolean): [boolean, (value: boolean) => void] => {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initial : stored === 'true';
    } catch {
      return initial;
    }
  });
  const remember = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Not remembered, but still applied for this visit.
      }
    },
    [key],
  );
  return [value, remember];
};
