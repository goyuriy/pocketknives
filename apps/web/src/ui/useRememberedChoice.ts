import { useCallback, useState } from 'react';

/**
 * One of a fixed set of choices that survives a reload, kept in this browser
 * only — and that a `?name=value` in the page's address overrides, so a link
 * or a screenshot script can ask for it outright.
 *
 * Effectful: reads the address and `localStorage`, and writes the latter.
 * Storage can be missing or forbidden, so every access is guarded and the
 * choice falls back to `initial`.
 */
export const useRememberedChoice = <T extends string>(
  key: string,
  param: string,
  isChoice: (value: unknown) => value is T,
  initial: T,
): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const asked = new URLSearchParams(window.location.search).get(param);
      if (isChoice(asked)) return asked;
      const stored = window.localStorage.getItem(key);
      return isChoice(stored) ? stored : initial;
    } catch {
      return initial;
    }
  });
  const remember = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not remembered, but still applied for this visit.
      }
    },
    [key],
  );
  return [value, remember];
};
