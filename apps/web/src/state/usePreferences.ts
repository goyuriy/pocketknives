import { useState } from 'react';
import { isCameraView } from '../stage/math/cameraPose.js';
import { useRememberedChoice } from '../ui/useRememberedChoice.js';
import { useRememberedFlag } from '../ui/useRememberedFlag.js';

/** How fast a throw plays back to begin with, as a share of real time. Slow, because the knife's turn is worth watching. */
const DESIGNED_PLAYBACK_SCALE = 0.55;

/**
 * This device's own choices about what it shows. They never reach the game —
 * two players at one table can each watch the same throw their own way.
 */
export const usePreferences = () => {
  // Whether the edge of the thrower's reach is chalked on the ground. On by
  // default; switched off only to see the ground bare while debugging.
  const [showReach, setShowReach] = useRememberedFlag('pocketknives.reachLine', true);
  // Where the camera is: through the thrower's eyes to play, or one of the
  // debug views to look at the scene. `?camera=side` in the address picks one.
  const [cameraView, setCameraView] = useRememberedChoice('pocketknives.camera', 'camera', isCameraView, 'eyes');
  const [playbackScale, setPlaybackScale] = useState(DESIGNED_PLAYBACK_SCALE);
  return { showReach, setShowReach, cameraView, setCameraView, playbackScale, setPlaybackScale };
};
