import { useEffect, useReducer, useState } from 'react';
import { nextChangeAt, startPlaying, type Playing } from '../playback/throwPlayback.js';
import type { Session } from '../session/session.js';

/**
 * The throw this screen is playing back, if any: every `thrown` event the
 * session hears starts one, at `scale` of real time, and a new match ends it.
 *
 * It also re-renders its component the moment the playback reaches its next
 * part (`nextChangeAt`) — the one moment the answers derived from it change.
 * One timer for the next mark, never a chain of timers that each decide
 * something: the playback itself is a pure function of the clock.
 *
 * Effectful: listens to the session, and keeps that one timer.
 */
export const usePlayback = (session: Session, scale: number) => {
  const [playing, setPlaying] = useState<Playing | null>(null);
  useEffect(
    () =>
      session.subscribe(({ events }) => {
        for (const event of events) {
          if (event.type === 'thrown') setPlaying(startPlaying(event.record, event.boardBefore, performance.now(), scale));
          else if (event.type === 'matchStarted') setPlaying(null);
        }
      }),
    [session, scale],
  );

  const [, moveOn] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const at = nextChangeAt(playing, performance.now());
    if (at === null) return;
    const wait = window.setTimeout(moveOn, Math.max(0, at - performance.now()) + 1);
    return () => window.clearTimeout(wait);
  });

  return {
    playing,
    /** Cuts the playback short — the table was reset or the turn handed on, so what it showed no longer stands. */
    stopPlaying: () => setPlaying(null),
  };
};
