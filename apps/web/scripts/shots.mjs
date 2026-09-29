/**
 * Screenshots of the running game from every debug camera, for debugging by
 * looking.
 *
 *   pnpm --filter @pocketknives/web preview      # in one terminal
 *   pnpm --filter @pocketknives/web shots        # in another
 *
 * Options, all optional:
 *   --url=http://localhost:4173/   the page to open
 *   --out=shots                    where to put the PNGs
 *   --views=side,hand              which camera views (default: all)
 *   --knife=cleaver                pick a knife first
 *   --walk=900                     hold W this many ms before the shots
 *   --draw                         hold the button and pull back before the shots
 *   --throw=0.4                    throw at this draw (through window.pocketknives)
 *   --wait=1200                    ms after the throw before the shot
 *
 * Uses Playwright, which is not a dependency of the game: install it with
 * `npm i -g playwright` (or point PLAYWRIGHT at an installed copy's
 * index.mjs), and a Chromium it can drive.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const VIEWS = ['eyes', 'behind', 'side', 'front', 'hand', 'top', 'arena'];

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);
const url = options.url ?? 'http://localhost:4173/';
const out = resolve(options.out ?? 'shots');
const views = options.views ? String(options.views).split(',') : VIEWS;

const load = async () => {
  for (const source of [process.env.PLAYWRIGHT, 'playwright'].filter(Boolean)) {
    try {
      return await import(source);
    } catch {
      // try the next one
    }
  }
  console.error('Playwright not found: npm i -g playwright, or set PLAYWRIGHT to its index.mjs.');
  process.exit(1);
};

const { chromium } = await load();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];

for (const view of views) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  // A headless browser cannot lock the pointer, and the game's first click
  // asks for it rather than throwing. Without Pointer Lock the mouse aims with
  // its cursor instead, as on an iPad with a trackpad, and the draw works.
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = undefined;
  });
  page.on('pageerror', (error) => errors.push(`${view}: ${error.message}`));
  const address = new URL(url);
  address.searchParams.set('camera', view);
  await page.goto(address.toString());
  // The character loads after the first frame.
  await page.waitForTimeout(3500);
  if (options.knife) {
    await page.getByRole('button', { name: new RegExp(`^${options.knife}$`, 'i') }).click();
    await page.evaluate(() => document.activeElement?.blur());
  }
  await page.mouse.move(640, 450);
  if (options.walk) {
    await page.keyboard.down('w');
    await page.waitForTimeout(Number(options.walk));
  }
  if (options.draw) {
    await page.mouse.down();
    for (let i = 0; i < 15; i++) {
      await page.mouse.move(640, 450 + i * 12);
      await page.waitForTimeout(16);
    }
  }
  if (options.throw) {
    await page.evaluate((draw) => {
      window.pocketknives.throw({ aim: 0, pitch: 0.35, draw, drift: 0 });
    }, Number(options.throw));
    await page.waitForTimeout(Number(options.wait ?? 1200));
  }
  await page.waitForTimeout(600);
  const file = `${out}/${view}.png`;
  await page.screenshot({ path: file });
  console.log(file);
  await page.close();
}

await browser.close();
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
