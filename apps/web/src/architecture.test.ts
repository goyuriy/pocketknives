import { describe, expect, it } from 'vitest';

/*
 * The architecture's rules, checked (ARCHITECTURE.md). Cheap to run and they
 * catch the slow drift that code review misses: one Math.random in the rules
 * and a server and a client can no longer agree on a throw.
 */
const core = import.meta.glob('../../../packages/core/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const web = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const source = (files: Record<string, string>) =>
  Object.entries(files).filter(([path]) => !path.endsWith('.test.ts') && !path.endsWith('.d.ts'));

/** The code with comments taken out, so a rule may be written about in prose. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const offenders = (files: Record<string, string>, pattern: RegExp) =>
  source(files)
    .filter(([, text]) => pattern.test(code(text)))
    .map(([path]) => path);

describe('the architecture', () => {
  it('reads every source file it is meant to check', () => {
    expect(source(core).length).toBeGreaterThan(20);
    expect(source(web).length).toBeGreaterThan(40);
  });

  it('keeps the core deterministic: no randomness, no clocks', () => {
    // Randomness comes in as a seed, stamped by the authority; time comes in as an argument.
    expect(offenders(core, /Math\.random|Date\.now|performance\.now|new Date\(/)).toEqual([]);
  });

  it('keeps the core free of the browser and the engine', () => {
    expect(offenders(core, /\b(window|document|localStorage|navigator)\./)).toEqual([]);
    expect(offenders(core, /from '(react|@babylonjs\/[^']+)'/)).toEqual([]);
  });

  it('lets only the core change the game: nothing outside it constructs a new game state by hand', () => {
    expect(offenders(web, /\bthrows:\s*\[\s*\.\.\./)).toEqual([]);
  });

  it('declares no classes: data is plain, behaviour is functions', () => {
    expect(offenders(core, /^\s*(export\s+)?(abstract\s+)?class\s/m)).toEqual([]);
    expect(offenders(web, /^\s*(export\s+)?(abstract\s+)?class\s/m)).toEqual([]);
  });
});
