import { Stage } from './stage/Stage.js';
import { SandboxHud } from './ui/SandboxHud.js';
import { TuningPanel } from './ui/TuningPanel.js';
import { useSandbox } from './state/useSandbox.js';

export const App = () => {
  const game = useSandbox(4);

  return (
    <div className="app">
      <Stage game={game} />
      <TuningPanel config={game.config} onChange={game.setTuning} />
      <SandboxHud game={game} />
    </div>
  );
};
