import { describe, expect, it } from 'vitest';
import { isRoomCode, newRoomCode, roomCodeIn, roomLinkFor, roomSocketUrl } from './roomLink.js';

describe('room links', () => {
  it('makes codes the server will take', () => {
    let n = 0;
    const code = newRoomCode(() => (n++ * 0.137) % 1);
    expect(code).toHaveLength(6);
    expect(isRoomCode(code)).toBe(true);
  });

  it('reads the room out of an address, and ignores nonsense', () => {
    expect(roomCodeIn('?room=yard42')).toBe('yard42');
    expect(roomCodeIn('?camera=side&room=YARD')).toBe('yard');
    expect(roomCodeIn('?room=a%20b')).toBeNull();
    expect(roomCodeIn('?camera=side')).toBeNull();
  });

  it('writes the link to send a friend, dropping this screen’s own settings', () => {
    expect(roomLinkFor('http://192.168.0.4:4173/?camera=side#x', 'yard42')).toBe('http://192.168.0.4:4173/?room=yard42');
  });

  it('finds the room server beside the page, or where it is told', () => {
    expect(roomSocketUrl({ protocol: 'http:', hostname: '192.168.0.4' }, 'yard', 4)).toBe('ws://192.168.0.4:8787/rooms/yard?seats=4');
    expect(roomSocketUrl({ protocol: 'https:', hostname: 'knives.example' }, 'yard', 2)).toBe('wss://knives.example:8787/rooms/yard?seats=2');
    expect(roomSocketUrl({ protocol: 'https:', hostname: 'x' }, 'yard', 3, 'wss://rooms.example/')).toBe('wss://rooms.example/rooms/yard?seats=3');
  });
});
