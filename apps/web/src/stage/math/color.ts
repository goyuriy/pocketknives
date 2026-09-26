/**
 * Mixes two `#rrggbb` colours: `t` of the way from `from` to `to`.
 *
 * Used to paint ground as if it were a translucent wash over dirt without
 * actually drawing anything translucent — transparency has to be sorted, costs
 * a phone real fill rate, and buys nothing for a surface that is flat anyway.
 */
export const mixHex = (from: string, to: string, t: number): string => {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};
