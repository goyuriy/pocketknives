import { describe, expect, it } from 'vitest';
import { impactVoice } from './impactVoice.js';

describe('impactVoice', () => {
  it('thunks and rings when the point goes in cleanly', () => {
    const voice = impactVoice({ kind: 'stick', strength: 0.6, clean: 0.9 });
    expect(voice.thump).not.toBeNull();
    expect(voice.ring).not.toBeNull();
  });

  it('barely rings after a scrappy stick', () => {
    expect(impactVoice({ kind: 'stick', strength: 0.6, clean: 0.1 }).ring).toBeNull();
  });

  it('thunks lower and louder the harder it lands', () => {
    const soft = impactVoice({ kind: 'stick', strength: 0.1, clean: 0.5 }).thump!;
    const hard = impactVoice({ kind: 'stick', strength: 0.9, clean: 0.5 }).thump!;
    expect(hard.from).toBeLessThan(soft.from);
    expect(hard.gain).toBeGreaterThan(soft.gain);
  });

  it('skitters once per bounce, each quieter, when it clatters', () => {
    const { noises, ring } = impactVoice({ kind: 'clatter', strength: 0.5, clean: 0 });
    expect(noises.length).toBeGreaterThan(1);
    expect(noises[1]!.gain).toBeLessThan(noises[0]!.gain);
    expect(noises[1]!.at).toBeGreaterThan(noises[0]!.at);
    expect(ring).toBeNull();
  });

  it('keeps every layer at a sane volume', () => {
    for (const kind of ['stick', 'clatter', 'tap'] as const) {
      const voice = impactVoice({ kind, strength: 1, clean: 1 });
      const gains = [voice.thump?.gain ?? 0, voice.ring?.gain ?? 0, ...voice.noises.map((n) => n.gain)];
      expect(Math.max(...gains)).toBeLessThanOrEqual(1);
    }
  });
});
