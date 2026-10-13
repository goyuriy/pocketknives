import { useState } from 'react';
import type { RoomRejection } from '@pocketknives/core';
import { newRoomCode, roomLinkFor } from '../session/roomLink.js';
import type { GameUi } from '../state/useGame.js';
import { colorOf } from './theme.js';

/** Why a command was turned down, said to the player who sent it. Only the ones a player can run into in a room. */
const REFUSALS: Partial<Record<RoomRejection, string>> = {
  not_your_turn: 'Not your turn.',
  not_yours: 'That seat is someone else’s.',
  not_seated: 'You are watching this match.',
  off_your_ground: 'Stand on your own ground to throw.',
  match_over: 'The match is over.',
  host_only: 'Only the host can do that.',
  sandbox_only: 'Not in a real match.',
};

/**
 * Playing with other people: at the practice table, the way into a room; in a
 * room, which one it is, who this screen plays for, the link to send a friend,
 * and anything the room has just said no to.
 */
export const RoomBar = ({ game, room }: { game: GameUi; room: string | null }) => {
  const [copied, setCopied] = useState(false);

  if (!room) {
    return (
      <a className="room-bar" href={roomLinkFor(window.location.href, newRoomCode(Math.random))}>
        Play with friends
      </a>
    );
  }

  const seats = game.session.controls();
  const copyLink = async () => {
    await navigator.clipboard?.writeText(roomLinkFor(window.location.href, room));
    setCopied(true);
  };
  return (
    <div className="room-bar">
      <span>Room {room}</span>
      {seats.length > 0 ? (
        seats.map((seat) => (
          <strong key={seat} style={{ color: colorOf(seat) }}>
            You are {seat}
          </strong>
        ))
      ) : (
        <strong>Watching</strong>
      )}
      {!game.yourTurn && <span>Waiting for {game.currentPlayer}</span>}
      <button type="button" onClick={copyLink}>
        {copied ? 'Link copied' : 'Copy invite link'}
      </button>
      {game.refusal && REFUSALS[game.refusal] && <em>{REFUSALS[game.refusal]}</em>}
    </div>
  );
};
