import { useEffect, type MutableRefObject } from 'react';
import type { Presence, Stance } from '@pocketknives/core';
import type { PresenceChannel } from '../session/session.js';
import type { HandInput } from './snapshot.js';

/**
 * How often this screen tells the others where its player is, milliseconds.
 * Ten a second is plenty for someone walking a yard; the others' screens
 * smooth between updates, and a lost one is replaced by the next.
 */
export const PRESENCE_INTERVAL = 100;

/** Where the player is this instant, as the others are told it. */
export const presenceOf = (stance: Stance, hand: HandInput): Presence => ({
  stance,
  aim: hand.aim,
  pitch: hand.pitch,
  draw: hand.draw,
});

/**
 * Tells the others where this screen's player stands and points, a few
 * times a second, while `playing` — on a hotseat table the channel goes
 * nowhere, and a spectator has no one to publish.
 *
 * Effectful: a timer, for as long as the component is mounted.
 */
export const usePublishPresence = (
  channel: PresenceChannel,
  stance: MutableRefObject<Stance>,
  hand: MutableRefObject<HandInput>,
  playing: boolean,
) => {
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => channel.publish(presenceOf(stance.current, hand.current)), PRESENCE_INTERVAL);
    return () => window.clearInterval(timer);
  }, [channel, stance, hand, playing]);
};
