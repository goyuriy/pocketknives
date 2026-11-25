import { GameScreen } from './GameScreen.js';
import { useTable } from './state/useTable.js';
import { RoomNotice } from './ui/RoomNotice.js';

/**
 * The page: the practice table in this browser, or — when the address names a
 * room — that room's table, once the room server has let this screen in.
 */
export const App = () => {
  const table = useTable();
  if (table.kind === 'local') return <GameScreen />;
  if (table.kind === 'room') return <GameScreen room={{ code: table.room, session: table.session }} />;
  return <RoomNotice table={table} />;
};
