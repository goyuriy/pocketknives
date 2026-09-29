import { useEffect, useRef, type MutableRefObject } from 'react';
import type { GameUi, Stance } from '../state/useGame.js';
import { advanceStroke, gripStroke, lookReach, type Stroke } from '../input/throwStroke.js';
import {
  PAD_PITCH_RATE,
  PAD_SCREEN,
  PAD_TURN_RATE,
  padGripY,
  padHandOf,
  padSample,
} from '../input/gamepadSwing.js';
import type { HandInput } from './snapshot.js';
import { throwPitchFor, tiltLook } from '../input/look.js';

/** Radians of aim per pixel of the made-up pointer while gripping — any value works, the rate is what counts. */
const RADIANS_PER_PIXEL = 0.003;
/** The longest step a frame may take, so a paused tab does not wake up having turned half a circle. */
const LONGEST_FRAME = 0.1;

/**
 * The gamepad's throwing hand: the right stick, and the right trigger to grip.
 *
 * The same hand as the mouse, on a stick. Released, the stick looks about —
 * across turns, up and down sets the angle, both at a steady rate while held
 * over. Gripped, it becomes a golf game's swing stick: pull it back to draw,
 * push it up through the grip point to throw, and across still turns. Letting
 * go of the trigger calls the throw off.
 *
 * Effectful: polls the Gamepad API once a frame (there are no gamepad events for
 * stick movement), and feeds the stick to the same stroke reader a mouse or a
 * finger uses — see `padSample` for how a stick becomes a pointer.
 */
export const useGamepadThrow = ({
  game,
  stance,
  hand,
}: {
  game: GameUi;
  stance: MutableRefObject<Stance>;
  hand: MutableRefObject<HandInput>;
}): void => {
  const latest = useRef(game);
  useEffect(() => {
    latest.current = game;
  });

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let stroke: Stroke | null = null;
    let across = 0;
    let gripFacing = 0;

    /** Ends a grip: whatever the stick turned while gripping becomes where the body faces. */
    const letGo = () => {
      stance.current = { ...stance.current, facing: gripFacing - hand.current.aim };
      hand.current = { ...hand.current, aim: 0, draw: null };
      stroke = null;
      latest.current.setDraw(null);
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      const seconds = Math.min((now - last) / 1000, LONGEST_FRAME);
      last = now;
      const pad = navigator.getGamepads?.().find((p) => p?.connected);
      if (!pad) return;

      const game = latest.current;
      const { config } = game;
      const { stick, grip } = padHandOf(pad);

      if (!stroke) {
        if (stick[0] !== 0 || stick[1] !== 0) {
          stance.current = { ...stance.current, facing: stance.current.facing - stick[0] * PAD_TURN_RATE * seconds };
          const look = tiltLook(hand.current.look ?? hand.current.pitch, stick[1] * PAD_PITCH_RATE * seconds);
          const pitch = throwPitchFor(look, config);
          hand.current = { ...hand.current, aim: 0, pitch, draw: null, look, viewFollowsAim: true };
          game.setPitch(pitch);
        }
        if (grip && game.phase.kind === 'ready') {
          across = 0;
          gripFacing = stance.current.facing;
          stroke = gripStroke({ x: 0, y: padGripY(config), t: now }, lookReach(0, RADIANS_PER_PIXEL), hand.current.pitch);
          hand.current = { ...hand.current, aim: 0, draw: 0, viewFollowsAim: true };
          game.setDraw(0);
        }
        return;
      }

      if (!grip) return letGo();

      across += (stick[0] * PAD_TURN_RATE * seconds) / RADIANS_PER_PIXEL;
      const { stroke: next, reading } = advanceStroke(stroke, [padSample(stick, across, now, config)], PAD_SCREEN, config);
      if (reading.thrown) {
        const from: Stance = { feet: stance.current.feet, facing: gripFacing };
        hand.current = { ...hand.current, aim: reading.thrown.aim };
        letGo();
        game.release(reading.thrown, from);
        return;
      }
      stroke = next;
      hand.current = { ...hand.current, aim: reading.aim, pitch: next.pitch, draw: reading.draw };
      game.setDraw(Math.max(0, reading.draw));
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stance, hand]);
};
