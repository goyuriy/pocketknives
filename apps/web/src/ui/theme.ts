export const PLAYER_NAMES = ['Red', 'Blue', 'Gold', 'Mint'] as const;

export const PLAYER_COLORS: Record<string, string> = {
  Red: '#e2564a',
  Blue: '#4a86e2',
  Gold: '#e2b04a',
  Mint: '#4ac9a0',
};

export const colorOf = (playerId: string): string => PLAYER_COLORS[playerId] ?? '#888888';
