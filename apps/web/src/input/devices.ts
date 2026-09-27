import { combineWalks, isWalkKey, walkFromKeys, walkFromStick, STANDING_STILL, type WalkInput } from './walk.js';
import { isTurnKey, turnFromKeys } from './turn.js';

export type WalkDevices = {
  /** The walk every connected device is asking for right now. Cheap: call it once a frame. */
  readonly read: () => WalkInput;
  /** How hard the keys ask the body to turn right now, -1 to 1, positive right — see `turn.ts`. */
  readonly turn: () => number;
  readonly dispose: () => void;
};

/**
 * The keyboard and any gamepad, as one source of walking — and the keyboard's
 * Q and E, for turning.
 *
 * Effectful: listens to key events on the window and polls the Gamepad API.
 * Keys are ignored while a form control has focus — the HUD's sliders take the
 * arrow keys, and nudging a slider should not also walk the player off.
 */
export const createWalkDevices = (target: Window = window): WalkDevices => {
  const held = new Set<string>();

  const typing = (event: KeyboardEvent) =>
    event.target instanceof HTMLElement && event.target.closest('input, select, textarea') !== null;

  const down = (event: KeyboardEvent) => {
    if (!(isWalkKey(event.code) || isTurnKey(event.code)) || typing(event)) return;
    held.add(event.code);
    // Arrows would otherwise scroll the page.
    event.preventDefault();
  };
  const up = (event: KeyboardEvent) => held.delete(event.code);
  // A key released while the window was not looking would otherwise stay held forever.
  const forget = () => held.clear();

  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', forget);

  return {
    read: () => combineWalks(walkFromKeys(held), gamepadWalk(target.navigator)),
    turn: () => turnFromKeys(held),
    dispose: () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', forget);
    },
  };
};

/** The first connected gamepad's left stick. */
const gamepadWalk = (navigator: Navigator): WalkInput => {
  const pad = navigator.getGamepads?.().find((p) => p?.connected);
  if (!pad || pad.axes.length < 2) return STANDING_STILL;
  return walkFromStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
};
