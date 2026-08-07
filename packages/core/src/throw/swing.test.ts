import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, spinRate, type ThrowConfig } from './config.js';
import { simulateFlight } from './flight.js';
import { stickVerdict } from './stick.js';
import { standingPoint } from './launch.js';
import { KNIVES, knifeById } from './knives.js';
import { isThrow, nearestStickingSpin, stickingSpins, swingLaunch, type SwingReading } from './swing.js';

const stand = standingPoint(-Math.PI / 2, 10);
const rest = Math.PI / 2;

const swing = (changes: Partial<SwingReading> = {}): SwingReading => ({
  speed: 1.4,
  curl: DEFAULT_CONFIG.gesture.referenceCurl,
  aimOffset: 0,
  ...changes,
});

describe('the hand, not a slider', () => {
  it('throws further the faster the hand moves', () => {
    const reach = (speed: number) =>
      simulateFlight(swingLaunch(stand, rest, swing({ speed }))).impact.point[1] + 12;
    expect(reach(2.6)).toBeGreaterThan(reach(1.4));
    expect(reach(1.4)).toBeGreaterThan(reach(0.5));
  });

  it('spins it harder the sharper the stroke turns', () => {
    const spin = (curl: number) => swingLaunch(stand, rest, swing({ curl })).spin;
    expect(spin(20)).toBeGreaterThan(spin(11));
    expect(spin(3)).toBeLessThan(spin(11));
  });

  it('reproduces the knife’s nominal tumble at the reference curl', () => {
    expect(swingLaunch(stand, rest, swing()).spin).toBeCloseTo(spinRate(DEFAULT_CONFIG), 6);
  });

  it('separates how far from how much it turns — the whole point of reading the hand', () => {
    // Same speed, different wrist: the knife lands in the same place having
    // rotated by different amounts. Under a single power dial this is impossible.
    const gentle = simulateFlight(swingLaunch(stand, rest, swing({ curl: 5 })));
    const sharp = simulateFlight(swingLaunch(stand, rest, swing({ curl: 18 })));

    expect(sharp.impact.point[1]).toBeCloseTo(gentle.impact.point[1], 9);
    expect(sharp.impact.bladeAngle).not.toBeCloseTo(gentle.impact.bladeAngle, 2);
  });

  it('follows through — a stroke to the right sends it right', () => {
    const right = swingLaunch(stand, rest, swing({ aimOffset: 0.4 })).heading;
    const left = swingLaunch(stand, rest, swing({ aimOffset: -0.4 })).heading;
    expect(right).toBeLessThan(rest);
    expect(left).toBeGreaterThan(rest);
  });

  it('ignores a hand that was resting rather than throwing', () => {
    expect(isThrow(swing({ speed: 0.05 }))).toBe(false);
    expect(isThrow(swing({ speed: 1.4 }))).toBe(true);
  });
});

describe('every distance is reachable with the right wrist', () => {
  // The claim that justifies the whole control scheme. Under the old power dial
  // only a couple of distances could ever stick.
  it('finds a tumble that sticks at any speed the hand can manage', () => {
    for (let speed = 0.6; speed <= 2.6; speed += 0.1) {
      const rough = simulateFlight(swingLaunch(stand, rest, swing({ speed })));
      const wanted = stickingSpins(rough.impact.time, -rough.impact.descentAngle);
      expect(wanted.length, `no sticking spin at speed ${speed.toFixed(1)}`).toBeGreaterThan(0);

      // Aim the wrist at one of them and the knife really does stick.
      const curl =
        (wanted[1] ?? wanted[0]!) *
        ((DEFAULT_CONFIG.gesture.referenceCurl * momentOfInertiaOf(DEFAULT_CONFIG)) /
          DEFAULT_CONFIG.style.spinImpulse);
      const aimed = simulateFlight(swingLaunch(stand, rest, swing({ speed, curl })));
      expect(stickVerdict(aimed.impact).stuck, `speed ${speed.toFixed(1)}`).toBe(true);
    }
  });

  it('reports the tumble a missed throw should have had', () => {
    const flight = simulateFlight(swingLaunch(stand, rest, swing({ curl: 4 })));
    const wanted = nearestStickingSpin(4, flight.impact.time, -flight.impact.descentAngle);
    expect(wanted).not.toBeNull();
    expect(wanted!).toBeGreaterThan(0);
  });
});

const momentOfInertiaOf = (config: ThrowConfig) =>
  config.style.spinImpulse / spinRate(config);

describe('the knives on offer', () => {
  it('are all genuinely different objects', () => {
    const shapes = KNIVES.map((k) => JSON.stringify(k.spec));
    expect(new Set(shapes).size).toBe(KNIVES.length);
  });

  it('turn the same flick into meaningfully different tumbles', () => {
    const tumble = (id: string) =>
      swingLaunch(stand, rest, swing(), {
        ...DEFAULT_CONFIG,
        knife: knifeById(id).spec,
      }).spin;

    expect(tumble('needle')).toBeGreaterThan(tumble('thrower') * 1.4);
    expect(tumble('cleaver')).toBeLessThan(tumble('thrower') * 0.7);
  });

  it('falls back to a sane knife when asked for one that does not exist', () => {
    expect(knifeById('nonesuch').id).toBe('thrower');
  });
});
