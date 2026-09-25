import { describe, expect, it } from 'vitest';
import type { Launch } from './types.js';
import { simulateFlight, wrapAngle } from './flight.js';
import { aimedLaunch, standingPoint } from './launch.js';
import { stickVerdict, throwFromImpact } from './stick.js';
import { DEFAULT_CONFIG, spinRate, stickWindow } from './config.js';

const launch = (overrides: Partial<Launch> = {}): Launch => ({
  ...aimedLaunch([0, -12], Math.PI / 2, 0.5), // stood south, throwing north
  ...overrides,
});

describe('simulateFlight', () => {
  it('lands on the ground, never through it', () => {
    const { samples, impact } = simulateFlight(launch());
    const last = samples[samples.length - 1]!;

    expect(last.position[2]).toBeCloseTo(0, 9);
    expect(last.time).toBeCloseTo(impact.time, 9);
    expect(samples.every((s) => s.position[2] >= -1e-9)).toBe(true);
  });

  it('flies along the heading it was thrown on', () => {
    const { impact } = simulateFlight(launch({ heading: Math.PI / 2 }));
    expect(impact.point[0]).toBeCloseTo(0, 9); // no sideways drift
    expect(impact.point[1]).toBeGreaterThan(-12);
  });

  it('throws further the harder it is thrown', () => {
    const reach = (power: number) =>
      simulateFlight(aimedLaunch([0, -12], Math.PI / 2, power)).impact.point[1] + 12;
    expect(reach(1)).toBeGreaterThan(reach(0.5));
    expect(reach(0.5)).toBeGreaterThan(reach(0));
  });

  it('reaches the far side of the circle at full power, and not much beyond', () => {
    // Stood two units outside a circle of radius ten, so the far rim is 22 away.
    const full = simulateFlight(aimedLaunch(standingPoint(-Math.PI / 2, 10), Math.PI / 2, 1));
    const reach = full.impact.point[1] + 12;
    expect(reach).toBeGreaterThan(20);
    expect(reach).toBeLessThan(24);
  });

  it('tumbles forward — tip over the top — not backwards', () => {
    const { samples } = simulateFlight(launch({ spin: 10, bladeAngle: 0 }));
    const later = samples[samples.length - 1]!;
    // The tip's angle above the line of flight falls as the knife turns.
    expect(later.bladeAngle).toBeLessThan(0);
  });

  it('keeps tumbling at a steady rate the whole way', () => {
    const { samples } = simulateFlight(launch({ spin: 10, bladeAngle: 0.25 }));
    for (const sample of samples) {
      expect(sample.bladeAngle).toBeCloseTo(0.25 - 10 * sample.time, 9);
    }
  });

  it('is deterministic — the same throw always lands in the same place', () => {
    const first = simulateFlight(launch());
    const second = simulateFlight(launch());
    expect(JSON.stringify(first.impact)).toBe(JSON.stringify(second.impact));
  });

  it('comes down steeper than it went up', () => {
    const { impact } = simulateFlight(launch({ pitch: 0.35 }));
    expect(impact.descentAngle).toBeGreaterThan(0.35);
  });
});

describe('the tumble decides the throw', () => {
  // Power is the only dial a player turns. These sweep it and ask what the
  // tumble does with it.
  const atPower = (power: number) => {
    const flight = simulateFlight(aimedLaunch([0, -12], Math.PI / 2, power));
    return { flight, verdict: stickVerdict(flight.impact) };
  };
  const sweep = (steps: number) =>
    Array.from({ length: steps }, (_, i) => atPower(i / (steps - 1)).verdict.stuck);

  it('sticks at some powers and skips at others', () => {
    const outcomes = sweep(80);
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it('offers more than one distance a player can reach reliably', () => {
    const outcomes = sweep(400);
    const bands = outcomes.filter((stuck, i) => stuck && !outcomes[i - 1]).length;
    expect(bands).toBeGreaterThanOrEqual(2);
  });

  it('leaves those bands wide enough to aim for', () => {
    const outcomes = sweep(400);
    const sticking = outcomes.filter(Boolean).length / outcomes.length;
    expect(sticking).toBeGreaterThan(0.15);
    expect(sticking).toBeLessThan(0.45);
  });

  it('keeps each band in one piece, so "a bit harder" means something', () => {
    // Sticking must not flicker on and off between neighbouring throws, or the
    // player has nothing to learn.
    const outcomes = sweep(400);
    const flips = outcomes.filter((stuck, i) => i > 0 && stuck !== outcomes[i - 1]).length;
    expect(flips).toBeLessThanOrEqual(6);
  });

  it('rates a knife that drives in along its path above one that barely bites', () => {
    const arriving = { ...atPower(0.5).flight.impact, entryAngle: 0.6 };
    const clean = stickVerdict({ ...arriving, misalignment: 0 });
    const scrappy = stickVerdict({
      ...arriving,
      misalignment: stickWindow(DEFAULT_CONFIG) * 0.9,
    });
    expect(clean.quality).toBeCloseTo(1, 6);
    expect(scrappy.quality).toBeLessThan(0.2);
    expect(scrappy.stuck).toBe(true);
  });

  it('refuses a knife that lands on its flat, however hard it was thrown', () => {
    const flung = simulateFlight(launch({ speed: 40 }));
    const flat = stickVerdict({ ...flung.impact, entryAngle: 0.6, misalignment: Math.PI / 2 });
    expect(flat).toMatchObject({ stuck: false, outcome: 'flat' });
  });

  it('refuses a knife that arrives tip-up, however well it is aligned', () => {
    // The bug this guards: a blade tipped above horizontal has its handle as the
    // lowest point, so the butt strikes first. Alignment with the path says
    // nothing about it — a steep path and a shallow knife can agree perfectly
    // and still land on the handle.
    const arriving = simulateFlight(launch()).impact;
    const tipUp = stickVerdict({ ...arriving, misalignment: 0, entryAngle: -0.2 });
    const barelyDown = stickVerdict({ ...arriving, misalignment: 0, entryAngle: 0.02 });

    expect(tipUp).toMatchObject({ stuck: false, outcome: 'handle_first' });
    expect(barelyDown).toMatchObject({ stuck: false, outcome: 'handle_first' });
    expect(stickVerdict({ ...arriving, misalignment: 0, entryAngle: 0.6 }).stuck).toBe(true);
  });

  it('never reports a stick for a knife whose butt is lower than its point', () => {
    // Swept across the whole power range against real flights, not fabricated
    // impacts: nothing that actually lands handle-down may come back stuck.
    for (let power = 0; power <= 1; power += 0.005) {
      const { impact } = simulateFlight(aimedLaunch([0, -12], Math.PI / 2, power));
      if (Math.sin(impact.bladeAngle) >= 0) {
        expect(stickVerdict(impact).stuck, `power ${power.toFixed(3)} landed tip-up`).toBe(false);
      }
    }
  });

  it('refuses a knife with no pace left in it', () => {
    const impact = {
      ...simulateFlight(launch()).impact,
      misalignment: 0,
      entryAngle: 0.6,
      speed: 1,
    };
    expect(stickVerdict(impact)).toMatchObject({ stuck: false, outcome: 'too_slow' });
  });
});

describe('throwFromImpact', () => {
  it('hands the rules a cut running along the line it was thrown', () => {
    const heading = Math.PI / 3;
    const { impact } = simulateFlight(launch({ heading }));
    const attempt = throwFromImpact(impact);

    expect(attempt.point).toEqual(impact.point);
    expect(Math.atan2(attempt.direction[1], attempt.direction[0])).toBeCloseTo(heading, 9);
  });
});

describe('wrapAngle', () => {
  it('brings any angle into [-π, π)', () => {
    expect(wrapAngle(0)).toBeCloseTo(0, 9);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI, 9);
    expect(wrapAngle(1.5 * Math.PI)).toBeCloseTo(-0.5 * Math.PI, 9);
  });

  it('measures the short way round, so a tumble past vertical reads as near', () => {
    expect(Math.abs(wrapAngle(-Math.PI / 2 - 2 * Math.PI))).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('samples finely enough to animate without stepping', () => {
    expect(DEFAULT_CONFIG.flight.sampleInterval).toBeLessThanOrEqual(1 / 60);
  });

  it('ships with the aim left exact — only the tumble and pace wobble', () => {
    expect(DEFAULT_CONFIG.scatter.heading).toBe(0);
  });

  it('derives the natural tumble the wrist settles near', () => {
    expect(spinRate(DEFAULT_CONFIG)).toBeCloseTo(30, 1);
  });
});
