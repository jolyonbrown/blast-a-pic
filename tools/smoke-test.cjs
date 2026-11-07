// Plays levels in a headless browser using the solver's moves and checks the
// win screen appears. Needs a local server: python3 -m http.server 8765
// Usage: node tools/smoke-test.cjs [outDir-for-screenshots]
const { chromium, devices } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8765/';
const out = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let failed = false;
  const views = [
    ['ipad-portrait', devices['iPad (gen 7)']],
    ['ipad-landscape', devices['iPad (gen 7) landscape']],
    ['phone', devices['iPhone 13']],
  ];
  for (const [name, device] of views) {
    const ctx = await browser.newContext({ ...device, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    await page.goto(BASE);
    await page.evaluate(() => localStorage.setItem('blast-a-pic:v1', JSON.stringify({ seenHelp: true, speed: 3, done: [], tips: Array.from({ length: 100 }, (_, i) => i + 1) })));
    await page.reload();

    const levels = name === 'ipad-portrait' ? await page.evaluate(() => window.__blast.levelIds) : [1];
    for (const id of levels) {
      await page.evaluate((id) => window.__blast.startLevel(id), id);
      await page.waitForTimeout(400);
      const moves = await page.evaluate(() => window.__blast.game.level.solution);
      for (const c of moves) {
        // Like a patient player: wait until the turrets have finished what they can do.
        await page.waitForFunction(() => window.__blast.idle || window.__blast.game.phase !== 'play');
        const ok = await page.evaluate((c) => window.__blast.tapColumn(c), c);
        if (!ok) { console.log(`${name} level ${id}: tap on column ${c} refused`); failed = true; break; }
      }
      try {
        await page.waitForSelector('#dialog:not(.hidden) #dialog-title', { timeout: 20000 });
        const title = await page.textContent('#dialog-title');
        const won = await page.evaluate(() => window.__blast.game.phase === 'won');
        console.log(`${name} level ${id}: ${won ? 'WON' : 'NOT WON'} (${title})`);
        if (!won) failed = true;
        if (out && (id === 1 || id === 24)) await page.screenshot({ path: `${out}/${name}-win-${id}.png` });
      } catch {
        console.log(`${name} level ${id}: no dialog appeared`);
        failed = true;
      }
    }

    // Get deliberately stuck on the last level, then undo out of it.
    await page.evaluate(() => window.__blast.startLevel(24));
    await page.waitForTimeout(300);
    let stuck = false;
    for (let i = 0; i < 40 && !stuck; i++) {
      await page.evaluate(() => {
        const g = window.__blast.game;
        const { frontTile, exposedCount } = window.__blast.engine;
        // the worst possible move: a turret whose colour is least visible
        const cols = g.level.columns.map((_, c) => c).filter((c) => frontTile(g.state, c))
          .sort((a, b) => exposedCount(g.state, frontTile(g.state, a).color) - exposedCount(g.state, frontTile(g.state, b).color));
        if (cols.length) window.__blast.tapColumn(cols[0]);
      });
      await page.waitForTimeout(500);
      stuck = await page.evaluate(() => window.__blast.game.phase === 'stuck');
    }
    if (stuck) {
      if (out) await page.screenshot({ path: `${out}/${name}-stuck.png` });
      await page.click('#dialog-buttons .primary');
      const phase = await page.evaluate(() => window.__blast.game.phase);
      console.log(`${name}: got stuck, undo -> ${phase}`);
      if (phase !== 'play') failed = true;
    } else console.log(`${name}: (did not manage to get stuck)`);
    if (out) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${name}-play.png` });
      await page.evaluate(() => document.getElementById('dialog').classList.add('hidden'));
      await page.click('#btn-home');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${name}-menu.png` });
    }
    await ctx.close();
  }
  await browser.close();
  if (errors.length) { console.log('Errors:\n' + errors.join('\n')); failed = true; }
  console.log(failed ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED');
  process.exit(failed ? 1 : 0);
})();
