// Draws the itch.io cover (630x500), the README banner and GitHub social preview (1280x640) with the
// game's own beads and turrets, from a real mid-game moment.
// Needs a local server: python3 -m http.server 8765. Usage: node tools/make-cover.cjs
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = path.join(__dirname, '..', 'docs');

async function render(page, kind, S) {
  return page.evaluate(async ([kind, S]) => {
    const { LEVELS } = await import('./js/levels.js');
    const E = await import('./js/engine.js');
    const R = await import('./js/render.js');
    await document.fonts.ready;

    const wide = kind === 'banner';
    const W = wide ? 1280 : 630, H = wide ? 640 : 500;
    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    document.body.innerHTML = '';
    document.body.append(cv);
    const g = cv.getContext('2d');
    g.scale(S, S);

    // background: the game's warm paper, with soft glows
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f9ecd9'); bg.addColorStop(1, '#f1d9bb');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const [x, y, r, c] of [[W * 0.15, H * 0.2, H * 0.6, 'rgba(255,255,255,0.55)'], [W * 0.9, H * 0.9, H * 0.7, 'rgba(255,190,140,0.25)']]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }

    // a real mid-game moment on Marmalade the Cat
    const def = LEVELS.find((l) => l.id === 4);
    const level = E.buildLevel(def);
    const st = E.newState(level);
    const moves = E.solve(E.newState(level)).moves;
    // early on: three turrets in, a few volleys fired, the picture still clear
    // spread across the slots so the shots fan out
    moves.slice(0, 3).forEach((m, n) => E.place(st, m.c, [0, 2, 3][n]));
    for (let i = 0; i < 3; i++) E.tick(st);
    const hex = level.colors.map((k) => E.PALETTE[k].hex);

    // layout
    const board = wide ? { x: 700, y: 70, w: 480, h: 420 } : { x: 135, y: 128, w: 360, h: 272 };
    const fp = 0.8;
    const cell = Math.min(board.w / (level.W + fp * 2), board.h / (level.H + fp * 2));
    const bw = cell * (level.W + fp * 2), bh = cell * (level.H + fp * 2);
    const bx = board.x + (board.w - bw) / 2, by = board.y + (board.h - bh) / 2;
    const ox = bx + fp * cell, oy = by + fp * cell;
    const u = wide ? 92 : 62;
    const dockY = by + bh + (wide ? 70 : 44);
    const docks = Array.from({ length: level.docks }, (_, i) => ({ x: bx + (bw * (i + 0.5)) / level.docks, y: dockY }));

    // board card
    g.fillStyle = 'rgba(140,95,50,0.18)'; R.roundRect(g, bx + 4, by + 7, bw, bh, cell * 0.9); g.fill();
    g.fillStyle = '#fbf3e8'; R.roundRect(g, bx, by, bw, bh, cell * 0.9); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(175,140,105,0.28)';
    for (let y = 0; y < level.H; y++) for (let x = 0; x < level.W; x++) { g.beginPath(); g.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.11, 0, 7); g.fill(); }
    const sprites = hex.map((h) => R.beadSprite(h, cell * S));
    for (let i = 0; i < st.cells.length; i++) {
      if (st.cells[i] < 0) continue;
      g.drawImage(sprites[st.cells[i]], ox + (i % level.W) * cell, oy + ((i / level.W) | 0) * cell, cell, cell);
    }

    // slots, turrets, and shots in flight
    const centre = (i) => ({ x: ox + ((i % level.W) + 0.5) * cell, y: oy + (((i / level.W) | 0) + 0.5) * cell });
    for (const d of docks) R.drawPad(g, d.x, d.y, u, 'dock');
    st.docks.forEach((d, i) => {
      if (!d) return;
      const p = docks[i];
      const t = E.findTarget(st, i, d.color);
      const to = t >= 0 ? centre(t) : { x: p.x, y: p.y - 100 };
      const aim = Math.atan2(to.y - p.y, to.x - p.x);
      R.drawTurret(g, p.x, p.y, u, hex[d.color], { count: d.count, aim, recoil: 0.4 });
      if (t < 0) return;
      // a shot on its way, with a fading trail, and a pop of colour where the last one landed
      const from = { x: p.x + Math.cos(aim) * u * 0.45, y: p.y - u * 0.08 + Math.sin(aim) * u * 0.45 };
      const at = (k) => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * cell * 1.6 });
      for (let k = 0.2; k < 0.6; k += 0.04) {
        const q = at(k);
        g.globalAlpha = (k - 0.15) * 1.6;
        g.fillStyle = hex[d.color]; g.beginPath(); g.arc(q.x, q.y, cell * 0.12, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      const q = at(0.62);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, cell * 0.42, 0, 7); g.fill();
      g.fillStyle = hex[d.color]; g.beginPath(); g.arc(q.x, q.y, cell * 0.3, 0, 7); g.fill();
      const below = { x: to.x, y: to.y + cell };
      for (let n = 0; n < 7; n++) {
        const a = (n / 7) * Math.PI * 2 + i, r = cell * (0.5 + (n % 3) * 0.25);
        g.beginPath(); g.arc(below.x + Math.cos(a) * r, below.y + Math.sin(a) * r * 0.8, cell * (0.12 + (n % 2) * 0.06), 0, 7); g.fill();
      }
    });

    // title, tagline and promises
    const title = (x, y, size, align) => {
      g.font = `900 ${size}px Nunito, ui-rounded, sans-serif`;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const parts = [['Blast', '#7b5cc4'], ['·', '#ff8a3d'], ['a', '#7b5cc4'], ['·', '#ff8a3d'], ['Pic', '#7b5cc4']];
      const widths = parts.map(([t]) => g.measureText(t).width + (t === '·' ? size * 0.06 : 0));
      const total = widths.reduce((a, b) => a + b, 0);
      let cx = align === 'center' ? x - total / 2 : x;
      parts.forEach(([t, c], n) => {
        const tx = cx + (t === '·' ? size * 0.03 : 0);
        g.fillStyle = 'rgba(123,92,196,0.22)'; g.fillText(t, tx, y + size * 0.1);
        g.fillStyle = '#fff'; g.fillText(t, tx, y + size * 0.05);
        g.fillStyle = c; g.fillText(t, tx, y);
        cx += widths[n];
      });
    };
    const pill = (x, y, text, size, align) => {
      g.font = `800 ${size}px Nunito, ui-rounded, sans-serif`;
      const w = g.measureText(text).width + size * 1.6, h = size * 2;
      const px = align === 'center' ? x - w / 2 : x;
      g.fillStyle = 'rgba(150,105,60,0.16)'; R.roundRect(g, px, y + 3, w, h, h / 2); g.fill();
      g.fillStyle = '#fffaf3'; R.roundRect(g, px, y, w, h, h / 2); g.fill();
      g.fillStyle = '#4a3f55'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, px + w / 2, y + h / 2 + 1);
      return w;
    };

    if (wide) {
      title(80, 210, 112, 'left');
      g.font = '700 32px Nunito, ui-rounded, sans-serif'; g.fillStyle = '#8a7a8f'; g.textAlign = 'left';
      g.fillText('Pop the beads, one colour at a time.', 86, 270);
      let px = 84;
      for (const t of ['No ads', 'No timers', 'No lives']) px += pill(px, 304, t, 22, 'left') + 14;
      // a strip of finished pictures
      const picks = [40, 50, 8, 9, 6, 52];
      picks.forEach((id, n) => {
        const pic = E.pictureOf(LEVELS.find((l) => l.id === id));
        const size = 92, x0 = 84 + n * 100, y0 = 430;
        g.fillStyle = 'rgba(150,105,60,0.14)'; R.roundRect(g, x0 + 2, y0 + 4, size, size, 18); g.fill();
        g.fillStyle = '#fffaf3'; R.roundRect(g, x0, y0, size, size, 18); g.fill();
        const c = Math.min((size - 14) / pic.W, (size - 14) / pic.H);
        const ax = x0 + (size - c * pic.W) / 2, ay = y0 + (size - c * pic.H) / 2;
        pic.cells.forEach((ci, i) => {
          if (ci < 0) return;
          g.fillStyle = E.PALETTE[pic.colors[ci]].hex;
          g.beginPath(); g.arc(ax + ((i % pic.W) + 0.5) * c, ay + (((i / pic.W) | 0) + 0.5) * c, c * 0.44, 0, 7); g.fill();
        });
      });
      g.font = '700 20px Nunito, ui-rounded, sans-serif'; g.fillStyle = '#8a7a8f'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('59 pictures to blast, from a sweetheart to the deep sea.', 86, 560);
    } else {
      title(W / 2, 78, 64, 'center');
      g.font = '700 19px Nunito, ui-rounded, sans-serif'; g.fillStyle = '#8a7a8f'; g.textAlign = 'center';
      g.fillText('Pop the beads, one colour at a time.', W / 2, 112);
    }
    return cv.toDataURL('image/jpeg', 0.92);
  }, [kind, S]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 700 } })).newPage();
  await page.goto(BASE);
  await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=block' }).catch(() => {});
  await page.evaluate(() => Promise.all(['900 64px Nunito', '800 22px Nunito', '700 20px Nunito'].map((f) => document.fonts.load(f))));
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });
  // 2x for sharp screens; the social preview is GitHub's 1280x640 (under its 1MB limit)
  for (const [kind, S, file] of [['cover', 2, 'itch-cover.jpg'], ['banner', 2, 'banner.jpg'], ['banner', 1, 'social-preview.jpg']]) {
    const data = await render(page, kind, S);
    fs.writeFileSync(path.join(OUT, file), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote docs/' + file);
  }
  await browser.close();
})();
