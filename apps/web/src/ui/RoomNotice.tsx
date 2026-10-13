import type { Table } from '../state/useTable.js';

/** What the screen says while it is not at a table: on the way into a room, or cut off from one. */
export const RoomNotice = ({ table }: { table: Extract<Table, { kind: 'joining' | 'lost' }> }) => (
  <div className="room-notice">
    {table.kind === 'joining' ? (
      <p>Joining room {table.room}…</p>
    ) : (
      <>
        <p>Not in room {table.room}: {table.reason}.</p>
        <p className="room-notice-actions">
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
          <a href={window.location.pathname}>Practise alone</a>
        </p>
      </>
    )}
  </div>
);
