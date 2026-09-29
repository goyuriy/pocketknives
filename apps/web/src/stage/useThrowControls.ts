import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ThrowIntent } from '@pocketknives/core';
import type { GameUi, Stance } from '../state/useGame.js';
import {
  advanceStroke,
  aimFromPointer,
  dragReach,
  gripStroke,
  liftStroke,
  lookReach,
  pitchFromPointer,
  screenReach,
  type Sample,
  type Stroke,
} from '../input/throwStroke.js';
import { STANDING_STILL, walkFromStick, type WalkInput } from '../input/walk.js';
import type { ImpactSound } from '../audio/impactSound.js';
import type { HandInput } from './snapshot.js';
import { handSway } from '../input/handSway.js';

/**
 * Whether the mouse is captured for mouse-look right now.
 *
 * Never compare `document.pointerLockElement` with `null`: Safari on iPhone has
 * no Pointer Lock at all and reports it as `undefined`, which is `!== null` —
 * every touch then reads as a captured mouse, measured against a pointer that
 * does not exist, and no throw can ever be made.
 */
const mouseCaptured = (): boolean => Boolean(document.pointerLockElement);

/** Radians the body turns per pixel of mouse travel, with the mouse captured. */
const LOOK_RATE = 0.0035;
/** Radians of launch angle per pixel of vertical mouse travel, with the mouse captured. */
const PITCH_RATE = 0.0018;
/** On a touch screen, how much of the stage from the left is the walking stick's. */
const STICK_ZONE = 0.4;
/** How far, in pixels, the walking stick's knob travels for a full walk. */
export const STICK_REACH = 56;

/** The on-screen walking stick, in pixels relative to the stage: where the thumb landed, and where it is. */
export type StickView = { readonly origin: readonly [number, number]; readonly knob: readonly [number, number] };

export type ThrowControls = {
  readonly handlers: {
    readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    readonly onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    readonly onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    readonly onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  };
  /** The walking stick to draw, while a thumb is on it. */
  readonly stick: StickView | null;
  /** Whether the mouse is captured for mouse-look. */
  readonly looking: boolean;
};

/**
 * The player's hands on the stage — every way of pointing, walking and throwing.
 *
 * Built on what players already know from games that do this well:
 *
 * - **Mouse:** first-person mouse-look. The first click captures the pointer
 *   (Pointer Lock) — the standard in every browser shooter, because a visible
 *   cursor stops turning dead at the edge of the screen. Across turns you, up
 *   and down sets the angle, and holding the button turns up and down into the
 *   draw, as a golf game's swing does on PC. Across still turns you while drawn.
 *   Escape gives the mouse back.
 * - **Touch:** Brawl Stars' split. A thumb landing on the left of the stage
 *   becomes a walking stick, floating wherever it landed; anywhere else aims and
 *   throws with the drag gesture — aiming by how far it drags sideways, never
 *   by where it happened to land.
 * - **Keys and gamepad** walk too; they are read by the stage each frame.
 *
 * The stroke, the stance and the hand live in refs: they change on every
 * pointer event, and the scene reads them once a frame.
 */
export const useThrowControls = ({
  game,
  canvas,
  stance,
  hand,
  touchWalk,
  sound,
}: {
  game: GameUi;
  canvas: MutableRefObject<HTMLCanvasElement | null>;
  stance: MutableRefObject<Stance>;
  hand: MutableRefObject<HandInput>;
  touchWalk: MutableRefObject<WalkInput>;
  sound: MutableRefObject<ImpactSound | null>;
}): ThrowControls => {
  const { phase, setDraw, setPitch, release } = game;
  const stroke = useRef<Stroke | null>(null);
  // Mouse-look has no pointer position, only motion: this is the motion summed,
  // a place for the stroke reader to measure draws and pushes in.
  const look = useRef({ x: 0, y: 0 });
  // The facing the grip began from; the hand's aim is measured from it.
  const gripFacing = useRef(0);
  // Whether the grip's aim should become the body's facing when it ends: yes
  // for mouse-look and touch, where the hand turned the player; no for a free
  // mouse cursor, whose aim is simply wherever the cursor rests.
  const turnsBody = useRef(false);
  const stickId = useRef<number | null>(null);
  // Where the stick's thumb landed. Kept in a ref as well as in state: a move
  // can arrive before React has re-rendered with the new stick, and must not be
  // lost for want of it.
  const stickOrigin = useRef<readonly [number, number]>([0, 0]);
  const [stick, setStick] = useState<StickView | null>(null);
  const [looking, setLooking] = useState(false);
  const canThrow = phase.kind === 'ready';

  const point = (aim: number, pitch: number, draw: number | null) => {
    hand.current = { aim, pitch, draw };
    setPitch(pitch);
  };

  /**
   * Ends a grip without throwing, or after one; the turn made while gripping is
   * kept, so the player goes on facing — and walking — the way they last aimed.
   */
  const letGo = () => {
    if (stroke.current && turnsBody.current) {
      stance.current = { ...stance.current, facing: gripFacing.current - hand.current.aim };
      hand.current = { ...hand.current, aim: 0 };
    }
    stroke.current = null;
    hand.current = { ...hand.current, draw: null };
    setDraw(null);
  };

  useEffect(() => {
    const changed = () => {
      const captured = document.pointerLockElement === canvas.current;
      setLooking(captured);
      if (!captured && stroke.current) letGo();
      if (!captured) hand.current = { ...hand.current, aim: 0 };
    };
    document.addEventListener('pointerlockchange', changed);
    return () => document.removeEventListener('pointerlockchange', changed);
  });

  /** Every pointer update in this event, including the ones the browser batched into it. */
  const updatesOf = (event: React.PointerEvent<HTMLElement>): PointerEvent[] => {
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    return coalesced.length > 0 ? coalesced : [event.nativeEvent];
  };

  /** Samples for the stroke reader: screen positions normally, summed motion when looking. */
  const samplesOf = (event: React.PointerEvent<HTMLElement>): Sample[] => {
    const now = event.timeStamp || performance.now();
    return updatesOf(event).map((update) => {
      if (!mouseCaptured()) return { x: update.clientX, y: update.clientY, t: update.timeStamp || now };
      look.current = { x: look.current.x + update.movementX, y: look.current.y + update.movementY };
      return { ...look.current, t: update.timeStamp || now };
    });
  };

  const box = (event: React.PointerEvent<HTMLElement>) => event.currentTarget.getBoundingClientRect();

  /**
   * Keeps a pointer's events coming here even when it strays off the stage.
   * Best effort: capture can be refused (a pointer already lifted, a synthetic
   * one), and a refused capture must never cost the player their throw.
   */
  const capture = (event: React.PointerEvent<HTMLElement>) => {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Without capture, events still arrive while the pointer is over the stage.
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    sound.current?.unlock();
    const area = box(event);

    if (event.pointerType === 'touch' && event.clientX < area.left + area.width * STICK_ZONE) {
      stickId.current = event.pointerId;
      capture(event);
      const origin = [event.clientX - area.left, event.clientY - area.top] as const;
      stickOrigin.current = origin;
      setStick({ origin, knob: origin });
      return;
    }
    if (!canThrow || event.button > 0) return;
    // The first click takes the mouse; it does not also throw. Where there is no
    // Pointer Lock (an iPad with a trackpad), the cursor aims as it is.
    if (event.pointerType === 'mouse' && !mouseCaptured() && typeof canvas.current?.requestPointerLock === 'function') {
      void canvas.current.requestPointerLock();
      return;
    }

    const captured = mouseCaptured();
    if (!captured) capture(event);
    const at: Sample = captured
      ? { ...look.current, t: event.timeStamp }
      : { x: event.clientX, y: event.clientY, t: event.timeStamp };
    // A finger has no hover, so its angle is wherever it came down.
    const pitch =
      event.pointerType === 'touch'
        ? pitchFromPointer(event.clientY, area.top, area.height, game.config)
        : hand.current.pitch;
    const touch = event.pointerType === 'touch';
    // Mouse-look turns with motion; a finger aims by dragging sideways from
    // where it landed; a free mouse cursor aims wherever it rests.
    const reach = captured
      ? lookReach(at.x, LOOK_RATE)
      : touch
        ? dragReach(at.x, area.width, game.config)
        : screenReach(area.left, area.width, game.config);

    gripFacing.current = stance.current.facing;
    turnsBody.current = captured || touch;
    stroke.current = gripStroke(at, reach, pitch);
    point(captured || touch ? 0 : aimFromPointer(event.clientX, area.left, area.width, game.config), pitch, 0);
    setDraw(0);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (stickId.current === event.pointerId) {
      const origin = stickOrigin.current;
      const area = box(event);
      const [dx, dy] = [event.clientX - area.left - origin[0], event.clientY - area.top - origin[1]];
      touchWalk.current = walkFromStick(dx / STICK_REACH, dy / STICK_REACH);
      const travel = Math.min(1, STICK_REACH / Math.max(1, Math.hypot(dx, dy)));
      setStick({ origin, knob: [origin[0] + dx * travel, origin[1] + dy * travel] });
      return;
    }

    if (!stroke.current) {
      if (mouseCaptured()) {
        // Looking about: across turns the body, up and down sets the angle.
        const moved = updatesOf(event).reduce<[number, number]>(
          (sum, u) => [sum[0] + u.movementX, sum[1] + u.movementY],
          [0, 0],
        );
        stance.current = { ...stance.current, facing: stance.current.facing - moved[0] * LOOK_RATE };
        const { minPitch, maxPitch } = game.config.gesture;
        const pitch = Math.min(maxPitch, Math.max(minPitch, hand.current.pitch - moved[1] * PITCH_RATE));
        point(0, pitch, null);
      } else if (event.pointerType !== 'touch') {
        const area = box(event);
        point(
          aimFromPointer(event.clientX, area.left, area.width, game.config),
          pitchFromPointer(event.clientY, area.top, area.height, game.config),
          null,
        );
      }
      return;
    }

    const { stroke: next, reading } = advanceStroke(
      stroke.current,
      samplesOf(event),
      event.currentTarget.clientHeight,
      game.config,
    );
    if (reading.thrown) return throwIt(reading.thrown, next.samples.at(-1)!.t);
    stroke.current = next;
    hand.current = { aim: reading.aim, pitch: next.pitch, draw: reading.draw };
    setDraw(Math.max(0, reading.draw));
  };

  const endStick = () => {
    stickId.current = null;
    touchWalk.current = STANDING_STILL;
    setStick(null);
  };

  /** The system took the touch — a scroll, a gesture, a notification. Nothing throws; everything lets go. */
  const onPointerCancel = (event: React.PointerEvent<HTMLElement>) => {
    if (stickId.current === event.pointerId) return endStick();
    letGo();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (stickId.current === event.pointerId) return endStick();
    // Letting go in the middle of a push throws — the phone flick.
    const lift = stroke.current ? samplesOf(event).at(-1) : undefined;
    const thrown =
      stroke.current && lift ? liftStroke(stroke.current, lift, event.currentTarget.clientHeight, game.config) : null;
    if (thrown) return throwIt(thrown, lift!.t);
    letGo();
  };

  /**
   * A throw leaves the hand: from where the thrower stands, facing the way they
   * gripped. The aim they chose becomes their facing afterwards — the hand's own
   * waver, thrown with it, does not, or every throw would turn them a hair.
   */
  const throwIt = (thrown: ThrowIntent, at: number) => {
    const from: Stance = { feet: stance.current.feet, facing: gripFacing.current };
    hand.current = { ...hand.current, aim: thrown.aim - handSway(at / 1000) };
    letGo();
    release(thrown, from);
  };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    stick,
    looking,
  };
};
