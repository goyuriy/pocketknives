import { Sandbox } from './scene/Sandbox.js';
import { SandboxHud } from './ui/SandboxHud.js';
import { TuningPanel } from './ui/TuningPanel.js';
import { useSandbox } from './state/useSandbox.js';

export const App = () => {
  const game = useSandbox(4);

  return (
    <div className="app">
      <Sandbox game={game} />
      <TuningPanel config={game.config} onChange={game.setConfig} bands={game.bands} />
      <SandboxHud game={game} />
    </div>
  );
};
