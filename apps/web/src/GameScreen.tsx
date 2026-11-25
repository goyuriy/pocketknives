import { Stage } from './stage/Stage.js';
import { SandboxHud } from './ui/SandboxHud.js';
import { TuningPanel } from './ui/TuningPanel.js';
import { RoomBar } from './ui/RoomBar.js';
import { useGame } from './state/useGame.js';
import { useRememberedFlag } from './ui/useRememberedFlag.js';
import { useComfort } from './state/useComfort.js';
import type { Session } from './session/session.js';

/** The room this screen has joined: its code, and the session that talks to it. */
export type JoinedRoom = { readonly code: string; readonly session: Session };

/**
 * The game on screen: the stage, the HUD, and the tools for working on it.
 * At a room's table the session is the room's; otherwise `useGame` opens the
 * practice table in this browser.
 */
export const GameScreen = ({ room }: { room?: JoinedRoom }) => {
  const game = useGame(4, room ? () => room.session : undefined);
  const comfort = useComfort();
  // The tuning panel and sandbox controls, for working on the game rather
  // than playing it. Hidden, the screen is just the game — as it always is in
  // a room, where the match is a real one and nothing is tunable.
  const [wantsDebug, setDebug] = useRememberedFlag('pocketknives.debug', true);
  const debug = wantsDebug && !room;

  return (
    <div className="app">
      <Stage game={game} comfort={comfort.comfort} />
      {debug && <TuningPanel config={game.config} onChange={game.setTuning} />}
      {!debug && !room && (
        <button type="button" className="debug-toggle" onClick={() => setDebug(true)}>
          Debug
        </button>
      )}
      <RoomBar game={game} room={room?.code ?? null} />
      <SandboxHud game={game} comfort={comfort} debug={debug} onHideDebug={() => setDebug(false)} />
    </div>
  );
};
