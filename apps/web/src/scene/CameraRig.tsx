import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Vec2 } from '@pocketknives/core';
import { toWorld } from './coords.js';

/**
 * Where the camera sits, and where it eases to.
 *
 * Two poses, and the whole feel of a throw lives in the move between them.
 * Aiming looks from behind the thrower, low and along the ground, so distance
 * is hard to judge and the arc has to be read. The moment the knife lands the
 * camera lifts and swings over the circle, because what the throw *won* is a
 * shape, and a shape is only legible from above.
 *
 * Nobody is drawn standing at the throwing position. The camera is the player.
 */
const AIM_SWING = 0.26;
const AIM_HEIGHT = 12;
const AIM_SETBACK = 19;
const OVER_HEIGHT = 30;
const OVER_SETBACK = 4;
/*
 * The HUD floats over the lower third of the screen, so the circle has to sit
 * high in frame to stay clear of it. Aiming the camera below the ground plane
 * tilts it down, which lifts everything above that point up the screen.
 */
const AIM_FOCUS_DROP = -4.5;

export const CameraRig = ({
  stand,
  overhead,
  arenaRadius,
}: {
  stand: Vec2;
  /** True once the knife has landed and the cut is what matters. */
  overhead: boolean;
  arenaRadius: number;
}) => {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  const focus = useRef(new Vector3());
  const placed = useRef(false);

  useFrame((_, delta) => {
    // Offset a little off the throwing line. Dead behind it the arc collapses to
    // a straight line — the one thing the player most needs to judge becomes
    // invisible — and a few degrees to the side restores its shape without
    // giving up the sense of standing behind the throw.
    const bearing = Math.atan2(stand[1], stand[0]) + (overhead ? 0 : AIM_SWING);
    const setback = overhead ? OVER_SETBACK : AIM_SETBACK;
    const height = overhead ? OVER_HEIGHT : AIM_HEIGHT;

    target.current.set(
      ...toWorld([
        Math.cos(bearing) * (arenaRadius + setback),
        Math.sin(bearing) * (arenaRadius + setback),
        height,
      ]),
    );
    // Aiming, the eye rests short of the middle so more of the far side is in
    // shot; overhead, it centres on the circle itself.
    focus.current.set(...toWorld([0, 0, overhead ? 0 : AIM_FOCUS_DROP]));

    if (placed.current) {
      // Framerate-independent easing: the same journey on a slow device as a
      // fast one, rather than a fixed fraction per frame.
      camera.position.lerp(target.current, 1 - Math.exp(-delta * (overhead ? 2.4 : 4)));
    } else {
      // Nothing to ease from on the first frame. Swooping in from whatever pose
      // the canvas was constructed with is a transition the player never asked
      // for, and on a slow first frame it is just a lurch.
      camera.position.copy(target.current);
      placed.current = true;
    }
    camera.lookAt(focus.current);
  });

  return null;
};
