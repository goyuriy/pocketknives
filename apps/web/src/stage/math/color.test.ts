import { describe, expect, it } from 'vitest';
import { mixHex } from './color.js';

describe('mixHex', () => {
  it('runs from one colour to the other', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#ff0000', '#0000ff', 0.5)).toBe('#800080');
  });
});
