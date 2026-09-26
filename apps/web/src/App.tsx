import { Stage } from './stage/Stage.js';
import { SandboxHud } from './ui/SandboxHud.js';
import { TuningPanel } from './ui/TuningPanel.js';
import { useSandbox } from './state/useSandbox.js';
import { useRememberedFlag } from './ui/useRememberedFlag.js';

export const App = () => {
  const game = useSandbox(4);
  // The tuning panel and sandbox controls, for working on the game rather
  // than playing it. Hidden, the screen is just the game.
  const [debug, setDebug] = useRememberedFlag('pocketknives.debug', true);

  return (
    <div className="app">
      <Stage game={game} />
      {debug ? (
        <TuningPanel config={game.config} onChange={game.setTuning} />
      ) : (
        <button type="button" className="debug-toggle" onClick={() => setDebug(true)}>
          Debug
        </button>
      )}
      <SandboxHud game={game} debug={debug} onHideDebug={() => setDebug(false)} />
    </div>
  );
};
