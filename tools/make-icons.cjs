// Regenerates icons/*.png from tools/icon.html. Needs: python3 -m http.server 8765
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.goto(`http://localhost:8765/tools/icon.html?size=${size}`);
    await page.waitForFunction(() => document.title === 'ready');
    await page.locator('#c').screenshot({ path: path.join(__dirname, '..', 'icons', `icon-${size}.png`) });
  }
  await browser.close();
})();
