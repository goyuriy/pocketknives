import { useMemo } from 'react';
import { useRememberedNumber } from '../ui/useRememberedNumber.js';

/**
 * How the view moves, for players it makes queasy — the settings every
 * first-person game is expected to have (Xbox Accessibility Guideline 117).
 */
export type Comfort = {
  /** How hard impacts shake the view, 0 (not at all) to 1 (as designed). */
  readonly shake: number;
  /** How wide the view is, as a share of the designed field of view. Wider is calmer for many. */
  readonly view: number;
};

export const DESIGNED_COMFORT: Comfort = { shake: 1, view: 1 };

/** The narrowest and widest the view can be set, as shares of the designed field of view. */
export const VIEW_RANGE = { min: 0.85, max: 1.3 } as const;

/** The player's comfort settings, remembered in this browser. Effectful: reads and writes storage. */
export const useComfort = () => {
  const [shake, setShake] = useRememberedNumber('pocketknives.comfort.shake', DESIGNED_COMFORT.shake, 0, 1);
  const [view, setView] = useRememberedNumber('pocketknives.comfort.view', DESIGNED_COMFORT.view, VIEW_RANGE.min, VIEW_RANGE.max);
  const comfort = useMemo<Comfort>(() => ({ shake, view }), [shake, view]);
  return { comfort, setShake, setView };
};

export type ComfortState = ReturnType<typeof useComfort>;
