import { TUNING } from './tuning.js';
import { rng } from './engine.js';

// Level pictures. Each character is one bead (see PALETTE in engine.js):
//   k liquorice  w snow  y sunshine  o tangerine  r cherry  p candyfloss
//   v violet  b ocean  c sky  g leaf  G forest  n cocoa  t biscuit  s pebble
//   . empty
// mirror: 'even' -> each row is the left half and gets mirrored.
// outline: draws a ring of that colour around the whole shape automatically.
// columns: how many columns of turrets in the tray.
// chunks: turret ammo sizes to pick from. noise: how jumbled the tray order is.
// mystery: chance a turret behind the front row is hidden as "?".
// locks: chance a turret gets a padlock. ice: chance a bead is frozen (iceColors limits which).
// topDocks: slots above the picture. stones: chance a bead is covered by a stone (needs a hammer).
// fog: chance a bead hides its colour until it's exposed.
// links: chance neighbouring turrets in a row are chained together (they go out as a pair).
// section / tip: menu heading, and a one-off explainer the first time the level is opened.
// dockOptions: slot counts the tuner may choose between (tools/tune-levels.mjs).

function rainbowRows() {
  const W = 26, H = 14;
  const bands = ['r', 'o', 'y', 'g', 'b', 'v'];
  const cx = (W - 1) / 2, cy = H - 0.5;
  const clouds = [[2.6, 12.3, 2.4], [5.6, 12, 2.6], [4, 9.9, 2], [W - 3.6, 12.3, 2.4], [W - 6.6, 12, 2.6], [W - 5, 9.9, 2]];
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const band = Math.floor(12.6 - Math.hypot(x - cx, (y - cy) * 1.05));
      let ch = band >= 0 && band < bands.length ? bands[band] : '.';
      for (const [px, py, r] of clouds) if (Math.hypot(x - px, y - py) < r) ch = 'w';
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

function sunflowerRows() {
  const W = 23, H = 26, cx = 11, cy = 9;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const inEllipse = (x, y, px, py, angle, a, b) => {
    const ux = x - px, uy = y - py;
    const along = ux * Math.cos(angle) + uy * Math.sin(angle);
    const across = -ux * Math.sin(angle) + uy * Math.cos(angle);
    return (along / a) ** 2 + (across / b) ** 2 < 1;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.3;
        if (inEllipse(x, y, cx + Math.cos(a) * 6.8, cy + Math.sin(a) * 6.8, a, 3.2, 1.7)) grid[y][x] = k % 2 ? 'o' : 'y';
      }
      const d = Math.hypot(x - cx, y - cy);
      if (d < 5.2) grid[y][x] = 'y';
      if (d < 4.4) grid[y][x] = 'n';
      if (y > 16 && (inEllipse(x, y, cx - 3.6, 21, 0.3, 3.4, 1.5) || inEllipse(x, y, cx + 3.6, 19.5, -0.3, 3.4, 1.5))) grid[y][x] = 'g';
      if (y > 16 && x === cx) grid[y][x] = 'G';
    }
  }
  for (const [x, y, c] of [[9, 8, 'k'], [13, 8, 'k'], [9, 10, 'k'], [10, 11, 'k'], [11, 11, 'k'], [12, 11, 'k'], [13, 10, 'k'], [8, 10, 'p'], [14, 10, 'p']])
    grid[y][x] = c;
  return grid.map((r) => r.join(''));
}


// Small helpers for drawing pictures with code.
function canvas(W, H) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  g.set = (x, y, ch) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };
  g.rows = () => g.map((r) => r.join(''));
  return g;
}

function inEllipse(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
}

function balloonRows() {
  const W = 21, H = 29, g = canvas(W, H);
  const cx = 10;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // a teardrop: round on top, narrowing towards the basket
      const rx = y < 10 ? 10 : 10 - (y - 10) * 0.55;
      if (y <= 19 && rx > 0 && inEllipse(x, y, cx, 10, rx + 0.4, 10.4)) {
        const gore = Math.floor(Math.abs(x - cx + 0.5) / 2.2);
        let ch = ['r', 'y', 'r', 'y', 'r'][gore] || 'r';
        if (y >= 8 && y <= 9) ch = 'w';
        if (y >= 13 && y <= 14) ch = 'b';
        g.set(x, y, ch);
      }
    }
  // ropes and basket
  for (let y = 20; y <= 23; y++) { g.set(7 + Math.floor((y - 20) / 2), y, 'n'); g.set(13 - Math.floor((y - 20) / 2), y, 'n'); }
  for (let y = 24; y <= 28; y++) for (let x = 7; x <= 13; x++) g.set(x, y, y % 2 ? 't' : 'n');
  return g.rows();
}

function watermelonRows() {
  const W = 25, H = 13, g = canvas(W, H);
  const cx = 12, R = 12.4;
  const seeds = [[6, 2], [10, 1], [14, 1], [18, 2], [8, 4], [12, 4], [16, 4], [10, 6], [14, 6], [12, 8], [4, 1], [20, 1]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y + 0.5);
      if (d > R) continue;
      let ch = d > R - 1 ? 'G' : d > R - 2 ? 'g' : d > R - 2.8 ? 'w' : 'r';
      g.set(x, y, ch);
    }
  for (const [x, y] of seeds) g.set(x, y, 'k');
  return g.rows();
}

function teapotRows() {
  const W = 27, H = 21, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inEllipse(x, y, 13, 13, 8.6, 6.8)) g.set(x, y, (x + y * 3) % 7 === 0 ? 'w' : 'c');
      // handle: a ring on the right
      const hd = Math.hypot(x - 21.5, y - 12.5);
      if (x > 20 && hd < 4.4 && hd > 2.4) g.set(x, y, 'b');
      // spout sloping up to the left
      if (x >= 1 && x <= 6 && y >= 6 && y <= 15 && Math.abs(y - (15 - (6 - x) * 1.5) + 1.5) < 1.6) g.set(x, y, 'b');
      // lid and knob
      if (y >= 5 && y <= 6 && x >= 9 && x <= 17) g.set(x, y, 'b');
      if (y >= 3 && y <= 4 && x >= 12 && x <= 14) g.set(x, y, 'y');
    }
  return g.rows();
}

function hedgehogRows() {
  const W = 26, H = 16, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // spiky back with diagonal stripes
      if (inEllipse(x, y, 10.5, 8, 10.5, 7.6) && y < 14) g.set(x, y, (x + y) % 3 === 0 ? 't' : 'n');
      // face
      if (inEllipse(x, y, 19, 10, 5.5, 3.6)) g.set(x, y, 't');
      if (inEllipse(x, y, 23, 10.5, 2.2, 1.6)) g.set(x, y, 't');
    }
  g.set(25, 10, 'k'); g.set(25, 11, 'k');
  g.set(19, 8, 'k');
  g.set(20, 11, 'p');
  for (const fx of [6, 7, 14, 15]) { g.set(fx, 14, 'n'); g.set(fx, 15, 'n'); }
  // an apple caught on the spikes
  for (const [x, y] of [[8, 1], [9, 1], [7, 2], [8, 2], [9, 2], [10, 2], [8, 3], [9, 3]]) g.set(x, y, 'r');
  g.set(9, 0, 'G');
  return g.rows();
}

// Fills every empty cell with a background colour, so every column is deep.
function withBackground(rows, bg) {
  return rows.map((r) => r.replace(/\./g, bg));
}

function candyCaneRows() {
  const W = 17, H = 27, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 8, y - 7.5);
      const hook = d < 7 && d > 2.6 && (y <= 7.5 || (x > 8 && y <= 10));
      const shaft = x >= 1 && x <= 5 && y > 7 && y < H;
      if (hook || shaft) g.set(x, y, (x + y) % 4 < 2 ? 'r' : 'w');
    }
  return g.rows();
}

function puddingRows() {
  const W = 24, H = 21, g = canvas(W, H);
  const raisins = [[6, 12], [10, 14], [15, 12], [18, 15], [8, 16], [13, 17], [16, 9], [5, 15], [11, 10], [19, 11]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y >= 5 && y <= 18 && inEllipse(x, y, 11.5, 12, 11, 8.5)) g.set(x, y, 'n');
      // custard dripping over the top
      const drip = 7 + Math.round(Math.sin(x * 1.3) * 1.2 + (x % 5 === 0 ? 1.5 : 0));
      if (y >= 5 && y <= drip && inEllipse(x, y, 11.5, 12, 11, 8.5)) g.set(x, y, 'w');
      if (y >= 19 && x >= 1 && x <= 22) g.set(x, y, 's');
    }
  for (const [x, y] of raisins) g.set(x, y, 'v');
  // holly on top
  for (const [x, y] of [[8, 3], [9, 3], [10, 2], [7, 4], [8, 4], [14, 3], [15, 3], [13, 2], [16, 4], [15, 4]]) g.set(x, y, 'G');
  for (const [x, y] of [[11, 3], [12, 3], [11, 4], [12, 4], [11, 2]]) g.set(x, y, 'r');
  return g.rows();
}

function baubleRows() {
  const W = 23, H = 26, g = canvas(W, H);
  const cx = 11, cy = 14.5, R = 10.6;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, y - cy) < R) {
        let ch = 'r';
        const zig = 11 + Math.abs(((x + 100) % 4) - 2);
        if (y >= 8 && y <= 9) ch = 'y';
        if (y >= 10 && y < zig) ch = 'G';
        if (y >= zig && y <= zig + 2) ch = 'y';
        if (y > zig + 2 && y <= zig + 4) ch = 'G';
        if (y >= 20 && y <= 21) ch = 'y';
        if (ch === 'r' && (x * 3 + y * 5) % 11 === 0) ch = 'w';
        g.set(x, y, ch);
      }
      if (y >= 2 && y <= 3 && x >= 8 && x <= 14) g.set(x, y, 's');
      if (y === 1 && (x === 10 || x === 12)) g.set(x, y, 's');
      if (y === 0 && x === 11) g.set(x, y, 's');
    }
  return g.rows();
}

function snowflakeRows() {
  const N = 27, c = 13, g = canvas(N, N);
  const segs = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    segs.push([c, c, c + ux * 11.5, c + uy * 11.5]);
    for (const [t, len] of [[5, 3.2], [8.5, 2.4]])
      for (const s of [-1, 1]) {
        const b = a + (s * Math.PI) / 3;
        segs.push([c + ux * t, c + uy * t, c + ux * t + Math.cos(b) * len, c + uy * t + Math.sin(b) * len]);
      }
  }
  const near = (x, y, [x1, y1, x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t)) < 0.75;
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let ch = 'b';
      if (segs.some((s) => near(x, y, s))) ch = 'w';
      if (Math.hypot(x - c, y - c) < 2.2) ch = 'c';
      if (ch === 'b' && (x * 7 + y * 13) % 29 === 0) ch = 'y';
      g.set(x, y, ch);
    }
  return g.rows();
}

function presentRows() {
  const W = 22, H = 22, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y >= 7) {
        let ch = (x + y) % 4 < 2 ? 'r' : 'p';
        if (y === 7 || y === 8) ch = 'r'; // lid
        if (x >= 10 && x <= 11) ch = 'y';
        if (y >= 13 && y <= 14) ch = 'y';
        if (x >= 1 && x <= 20 && (y > 8 || x >= 0)) g.set(x, y, y >= 9 && (x < 2 || x > 19) ? '.' : ch);
      }
      // bow: two loops and a knot
      if (inEllipse(x, y, 7, 4, 3.6, 2.4) && !inEllipse(x, y, 7.4, 4, 1.4, 0.9)) g.set(x, y, 'y');
      if (inEllipse(x, y, 14, 4, 3.6, 2.4) && !inEllipse(x, y, 13.6, 4, 1.4, 0.9)) g.set(x, y, 'y');
      if (x >= 10 && x <= 11 && y >= 3 && y <= 6) g.set(x, y, 'o');
    }
  return g.rows();
}

function treeRows() {
  const W = 25, H = 31, g = canvas(W, H);
  const c = 12;
  const baubles = { '10,9': 'r', '14,11': 'y', '9,14': 'p', '15,16': 'r', '12,13': 'c', '7,19': 'y', '17,20': 'p', '11,18': 'r', '13,22': 'y', '6,24': 'c', '18,24': 'r', '10,23': 'p' };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ch = (x * 5 + y * 11) % 23 === 0 ? 'w' : 'b'; // night sky with snowflakes
      // three tiers
      for (const [top, bottom, half] of [[3, 11, 6], [8, 18, 8.5], [14, 26, 11]]) {
        if (y >= top && y <= bottom && Math.abs(x - c) <= ((y - top + 1) / (bottom - top + 1)) * half) ch = (y + Math.abs(x - c)) % 5 === 0 ? 'g' : 'G';
      }
      if (y >= 27 && y <= 28 && x >= 11 && x <= 13) ch = 'n';
      if (y >= 29) ch = 'w';
      if (baubles[`${x},${y}`]) ch = baubles[`${x},${y}`];
      g.set(x, y, ch);
    }
  for (const [x, y] of [[12, 0], [11, 1], [12, 1], [13, 1], [10, 2], [12, 2], [14, 2]]) g.set(x, y, 'y');
  return g.rows();
}

function cottageRows() {
  const W = 30, H = 27, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ch = y < 18 ? ((x * 7 + y * 3) % 31 === 0 ? 'w' : 'v') : 'w'; // dusk sky, snowy ground
      if (Math.hypot(x - 24, y - 4) < 2.6) ch = 'y'; // moon
      // pine trees either side
      for (const tx of [3, 27]) if (y >= 7 && y <= 19 && Math.abs(x - tx) <= (y - 7) * 0.32 + 0.3) ch = (y % 3 === 0 && Math.abs(x - tx) > (y - 7) * 0.2) ? 'w' : 'G';
      // house
      if (y >= 12 && y <= 21 && x >= 8 && x <= 21) ch = (y % 2 === 0) ? 'n' : 't';
      if (y >= 5 && y <= 11 && Math.abs(x - 14.5) <= (y - 4) * 1.15) ch = y <= 6 || Math.abs(x - 14.5) > (y - 4) * 1.15 - 1.2 ? 'w' : 'r';
      if (x >= 18 && x <= 19 && y >= 3 && y <= 7) ch = 's'; // chimney
      if ((x >= 10 && x <= 12 || x >= 17 && x <= 19) && y >= 14 && y <= 16) ch = (x === 11 || x === 18 || y === 15) ? 'o' : 'y';
      if (x >= 14 && x <= 15 && y >= 17 && y <= 21) ch = 'G';
      if (y >= 22) ch = (x + y) % 9 === 0 ? 'c' : 'w';
      g.set(x, y, ch);
    }
  return g.rows();
}

// Nelly in profile, looking up and to the left.
function nellyProfileRows() {
  const W = 30, H = 30, g = canvas(W, H);
  const inRot = (x, y, cx, cy, rx, ry, a) => {
    const ux = x - cx, uy = y - cy;
    const al = ux * Math.cos(a) + uy * Math.sin(a), ac = -ux * Math.sin(a) + uy * Math.cos(a);
    return (al / rx) ** 2 + (ac / ry) ** 2 < 1;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ch = 'c';
      const head = inRot(x, y, 17.5, 10, 8.2, 7, 0.1);
      const snout = inRot(x, y, 8.5, 10, 7.4, 4.1, 0.18);
      const neck = inRot(x, y, 18, 23, 8.5, 11, 0) && y >= 12;
      if (head || snout || neck) ch = 'D';
      // the underside of the muzzle and the chin have gone grey
      if (snout && !head && y - 10 > (x - 8.5) * 0.18 + 1.2) ch = 's';
      if (inRot(x, y, 11, 13.6, 3.6, 1.5, 0.2)) ch = 's';
      // a lighter stripe along the top of the nose
      if (snout && !head && Math.abs(y - (10 + (x - 8.5) * 0.18) + 2.6) < 0.6) ch = 'n';
      // white chest
      if (inRot(x, y, 14.5, 26.5, 2.6, 4.6, 0.15) && neck) ch = 'w';
      // the big curly ear: chocolate, cocoa and biscuit curls
      if (inRot(x, y, 22.5, 19, 5.4, 10.5, -0.15) && y > 8) ch = (x * 2 + y) % 5 === 0 ? 't' : (x + y) % 3 === 0 ? 'D' : 'n';
      g.set(x, y, ch);
    }
  // nose and eye (with a glint)
  for (const [x, y] of [[1, 7], [2, 7], [1, 8], [2, 8], [3, 8], [2, 6], [1, 9]]) g.set(x, y, 'k');
  for (const [x, y] of [[15, 7], [16, 7], [15, 8], [16, 8], [17, 8], [17, 7]]) g.set(x, y, 'k');
  g.set(15, 7, 'w');
  g.set(10, 6, 'D'); // close the gap between snout and forehead
  return g.rows();
}

// Lana: a blue merle Aussie, head on, tongue out, on the grass.
function lanaRows() {
  const W = 28, H = 32, g = canvas(W, H);
  const cx = 13.5;
  const rand = rng(1234);
  // merle splodges: a fixed scatter of black blobs
  const blobs = Array.from({ length: 26 }, () => [rand() * W, rand() * 22, 0.8 + rand() * 1.6]);
  const inRot = (x, y, px, py, rx, ry, a) => {
    const ux = x - px, uy = y - py;
    const al = ux * Math.cos(a) + uy * Math.sin(a), ac = -ux * Math.sin(a) + uy * Math.cos(a);
    return (al / rx) ** 2 + (ac / ry) ** 2 < 1;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ch = 'g';
      const head = inEllipse(x, y, cx, 12.5, 8.6, 9.2);
      const ears = inRot(x, y, 4.2, 9, 3.3, 5.6, 0.5) || inRot(x, y, 22.8, 9, 3.3, 5.6, -0.5);
      const bib = inEllipse(x, y, cx, 31, 11.5, 11) && y > 19;
      if (head || ears || bib) {
        ch = 's';
        if (blobs.some(([bx, by, r]) => Math.hypot(x - bx, y - by) < r)) ch = 'k';
        if ((x * 7 + y * 3) % 11 === 0) ch = 'w'; // silvery flecks
      }
      if (bib && Math.abs(x - cx) < 8.5) ch = 'w';
      // copper cheeks and eyebrows
      if (inEllipse(x, y, 8.2, 16.5, 2.3, 3) || inEllipse(x, y, 18.8, 16.5, 2.3, 3)) ch = 'C';
      if (inEllipse(x, y, 9.2, 9.6, 1.3, 0.8) || inEllipse(x, y, 17.8, 9.6, 1.3, 0.8)) ch = 'C';
      // white blaze up the middle and a white muzzle
      if (head && Math.abs(x - cx) < 1 + Math.max(0, y - 11) * 0.35 && y >= 3) ch = 'w';
      if (inEllipse(x, y, cx, 19, 4.6, 3.6)) ch = 'w';
      // tongue
      if (inEllipse(x, y, cx, 23.8, 2.2, 2.6) && y >= 22) ch = 'p';
      g.set(x, y, ch);
    }
  // pale blue eyes with dark pupils and a dark rim
  for (const ex of [9, 17]) {
    for (const [dx, dy, ch] of [[0, 0, 'c'], [1, 0, 'c'], [0, 1, 'c'], [1, 1, 'k'], [-1, 0, 'k'], [-1, 1, 'k'], [2, 0, 'k']]) g.set(ex + dx, 12 + dy, ch);
  }
  // nose with its pink patch, and the mouth
  for (let x = 12; x <= 15; x++) for (let y = 17; y <= 19; y++) g.set(x, y, 'k');
  g.set(13, 17, 'p'); g.set(14, 17, 'p'); g.set(12, 17, 'p');
  for (const x of [10, 11, 12, 15, 16, 17]) g.set(x, 21, 'k');
  g.set(9, 20, 'k'); g.set(18, 20, 'k');
  return g.rows();
}

// Juno: a black tri Aussie with one blue eye and one brown, and her red ball.
function junoRows() {
  const W = 28, H = 32, g = canvas(W, H);
  const cx = 13.5;
  const inRot = (x, y, px, py, rx, ry, a) => {
    const ux = x - px, uy = y - py;
    const al = ux * Math.cos(a) + uy * Math.sin(a), ac = -ux * Math.sin(a) + uy * Math.cos(a);
    return (al / rx) ** 2 + (ac / ry) ** 2 < 1;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ch = 'y';
      const head = inEllipse(x, y, cx, 12.5, 8.6, 9.2);
      const ears = inRot(x, y, 4.4, 7.5, 3.2, 5.2, 0.7) || inRot(x, y, 22.6, 7.5, 3.2, 5.2, -0.7);
      const ruff = inEllipse(x, y, cx, 30, 12.5, 11.5) && y > 18;
      if (head || ears || ruff) ch = 'k';
      if (ruff && Math.abs(x - cx) < 8.5 - Math.max(0, 24 - y) * 0.6) ch = 'w'; // the big white bib
      // copper cheeks and eyebrows
      if (inEllipse(x, y, 7.8, 16.8, 2.4, 3.2) || inEllipse(x, y, 19.2, 16.8, 2.4, 3.2)) ch = 'C';
      if (inEllipse(x, y, 9.4, 9.4, 1.4, 0.8) || inEllipse(x, y, 17.6, 9.4, 1.4, 0.8)) ch = 'C';
      // white blaze, widening into the muzzle
      if (head && Math.abs(x - cx) < 1.3 + Math.max(0, y - 9) * 0.45 && y >= 2) ch = 'w';
      if (inEllipse(x, y, cx, 19, 5, 3.8)) ch = 'w';
      if (inEllipse(x, y, cx, 23.8, 2.2, 2.4) && y >= 22) ch = 'p'; // tongue
      // the red ball, bottom right
      if (Math.hypot(x - 23.5, y - 28) < 3.3) ch = Math.hypot(x - 22.4, y - 26.7) < 1 ? 'w' : 'r';
      g.set(x, y, ch);
    }
  // one ice-blue eye and one brown, both with dark rims
  for (const [ex, iris] of [[9, 'c'], [17, 'n']])
    for (const [dx, dy, ch] of [[0, 0, iris], [1, 0, iris], [0, 1, iris], [1, 1, 'k'], [-1, 0, 'k'], [-1, 1, 'k'], [2, 0, 'k'], [2, 1, 'k']]) g.set(ex + dx, 12 + dy, ch);
  for (let x = 12; x <= 15; x++) for (let y = 17; y <= 19; y++) g.set(x, y, 'k');
  for (const x of [10, 11, 12, 15, 16, 17]) g.set(x, 21, 'k');
  g.set(9, 20, 'k'); g.set(18, 20, 'k');
  return g.rows();
}

export const RAW_LEVELS = [
  {
    section: 'Warm-up',
    id: 1, name: 'Sweetheart', outline: 'k', columns: 3, chunks: [10, 15], noise: 0,
    rows: [
      '..rrr...rrr..',
      '.rrrrr.rrrrr.',
      'rrwwrrrrrrrrr',
      'rwwrrrrrrrrrr',
      'rwrrrrrrrrrrr',
      'rrrrrrrrrrrrr',
      '.rrrrrrrrrrr.',
      '..rrrrrrrrr..',
      '...rrrrrrr...',
      '....rrrrr....',
      '.....rrr.....',
      '......r......',
    ],
  },
  {
    id: 2, name: 'Mister Mushroom', outline: 'k', columns: 3, chunks: [10, 15, 20], noise: 0.6,
    rows: [
      '....rrrrrr....',
      '..rrwwrrrrrr..',
      '.rrwwwwrrwwrr.',
      '.rrwwwwrrwwwr.',
      'rrrrwwrrrrwwrr',
      'rwwrrrrrrrrrrr',
      'wwwwrrrwwrrrrr',
      'wwwrrrwwwwrrww',
      '.kkkkkkkkkkkk.',
      '....tttttt....',
      '....tkttkt....',
      '....tttttt....',
      '....ttkktt....',
      '....tttttt....',
    ],
  },
  {
    id: 3, name: 'Strawberry Patch', outline: 'k', mirror: 'even', columns: 4, chunks: [10, 20], noise: 1,
    rows: [
      '.......G',
      '....GG.G',
      '..GGGGGG',
      '.rrrGrGG',
      'rrrrrrrr',
      'rrryrrrr',
      'ryrrrryr',
      'rrrryrrr',
      '.ryrrrrr',
      '.rrrryrr',
      '..ryrrrr',
      '..rrrryr',
      '...rrrrr',
      '....ryrr',
      '.....rrr',
      '......rr',
    ],
    patch: [[3, 5, 'w'], [2, 6, 'w'], [2, 7, 'w']],
  },
  {
    id: 4, name: 'Marmalade the Cat', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20], noise: 1.5,
    rows: [
      'o........',
      'oo.......',
      'opo......',
      'oppoooooo',
      'ooooooooo',
      'ooooooooo',
      'oookwoooo',
      'oookkoooo',
      'ooooooooo',
      'opooowwwp',
      'ooooowwwk',
      'oooowwkwk',
      'ooooowwww',
      '.oooooooo',
      '...oooooo',
    ],
  },
  {
    id: 5, name: 'Scoop Dreams', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [10, 20], noise: 2, mystery: 0.15,
    rows: [
      '......r',
      '.....rr',
      '...pppp',
      '.pppppp',
      'ppwpcpp',
      'pwwpppp',
      'pppyppp',
      'ppppppg',
      'ppppppp',
      '.pp.ppp',
      '.tntntn',
      '..tntnt',
      '..ntntn',
      '...tntn',
      '...ntnt',
      '....tnt',
      '.....nt',
      '......n',
    ],
  },
  {
    id: 6, name: 'Freddie Frog', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 25], noise: 2, mystery: 0.2,
    rows: [
      '..gggg...',
      '.gwwwwg..',
      'gwwkkwwg.',
      'gwwkkwwgg',
      'gwwwwwwgg',
      '.gwwwwggg',
      'ggggggggg',
      'ggggggggg',
      'gppgggggg',
      'gppkggggg',
      'ggggkkkkk',
      'ggggggggg',
      '.gggggggg',
      '...gggggg',
    ],
    patch: [[4, 2, 'w'], [14, 2, 'w']],
  },
  {
    id: 7, name: 'Birthday Cupcake', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [10, 20], noise: 2.5, mystery: 0.25,
    rows: [
      '......rr',
      '......rr',
      '....pppp',
      '..pppppp',
      '.ppcppyp',
      'pppppppp',
      'pgpppcpp',
      'pppppppp',
      '.pppppp.',
      '.vcvcvcv',
      '.vcvcvcv',
      '..vcvcvc',
      '..vcvcvc',
      '...vcvcv',
    ],
  },
  {
    id: 8, name: 'Pip the Penguin', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 30], noise: 3, mystery: 0.25,
    rows: [
      '.....bbb',
      '...bbbbb',
      '..bbbbbb',
      '..bbwwbw',
      '.bbwkwww',
      '.bbwwwwo',
      '.bpwwwww',
      'bbbwwwww',
      'bbbwwwww',
      'bbbwwwww',
      '.bbwwwww',
      '.bbwwwww',
      '..bbwwww',
      '...oo...',
    ],
  },
  {
    id: 9, name: 'Sunny Sunflower', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [15, 20, 30], noise: 3, mystery: 0.3,
    rows: sunflowerRows,
  },
  {
    id: 10, name: 'Bathtime Duck', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [20, 30], noise: 3, mystery: 0.3,
    rows: [
      '......yyyy........',
      '.....yyyyyy.......',
      '....yyyywkyy......',
      '....yyyyyyyyoo....',
      '....yyyyyyyoooo...',
      '.....yyyyyyoo.....',
      '......yyyyy.......',
      '.yy..yyyyyyyy.....',
      '.yyyyyyyyyyyyyy...',
      '.yyyyywyyyyyyyyy..',
      '.yyyywwyyyyyyyyy..',
      '..yyyyyyyyyyyyyy..',
      '..yyyyyyyyyyyyyy..',
      '...yyyyyyyyyyyy...',
      'cc.cccc.cccc.cccc.',
      'cccccccccccccccccc',
    ],
  },
  {
    id: 11, name: 'After the Rain', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [20, 30], noise: 3.5, mystery: 0.35,
    rows: rainbowRows,
  },
  {
    id: 12, name: 'Wanda the Whale', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [20, 30], noise: 4, mystery: 0.35,
    rows: [
      '.....c.c..............',
      '......c...............',
      '....bbbbbbb...........',
      '..bbbbbbbbbbbb......bb',
      '.bbbbbbbbbbbbbbb...bbb',
      'bbbkbbbbbbbbbbbbb.bbb.',
      'bbbbbbbbbbbbbbbbbbbb..',
      'bpbbbbbbbbbbbbbbbbb...',
      'bbccccccbbbbbbbbbb....',
      '.bccccccccccbbbbb.....',
      '..cccccccccccccc......',
      '....cccccccccc........',
    ],
  },

  // ------------------------------------------------------------ Tricky
  // Stricter: fewer slots, more "?" turrets, padlocked turrets, frozen beads,
  // and stripy pictures that make you juggle colours.
  {
    section: 'Tricky',
    id: 13, name: 'Lighthouse', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20], noise: 3, mystery: 0.35, locks: 0.15, dockOptions: [5, 4],
    rows: [
      '.....r',
      '....rr',
      '...rrr',
      '..ssss',
      '..cyyy',
      '..cyyy',
      '.sssss',
      '...rrr',
      '...rrr',
      '...www',
      '...www',
      '..rrrr',
      '..rrrr',
      '..wwww',
      '..wwww',
      '.rrrrr',
      '.rrrrr',
      '.wwwwn',
      '.wwwwn',
      'ssssss',
      'bcbbbb',
      'bbbbcb',
    ],
  },
  {
    tip: {
      title: 'Locked turrets',
      text: 'Turrets with a padlock can’t move yet. The number on the lock is how many other turrets you need to use first.',
    },
    id: 14, name: 'Busy Bee', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20], noise: 3, mystery: 0.35, locks: 0.15, dockOptions: [5, 4],
    rows: [
      '......yyy',
      '.....ykyy',
      '.....yyyy',
      '.ww..nnnn',
      'wwww.nnnn',
      'wccwwyyyy',
      'wccwwyyyy',
      '.wwwwnnnn',
      '..wwwnnnn',
      '.....yyyy',
      '.....yyyy',
      '......nnn',
      '......nnn',
      '.......yy',
      '........k',
    ],
  },
  {
    tip: {
      title: 'Frozen beads',
      text: 'Icy beads need two hits: the first cracks the ice, the second pops the bead. Turrets carry enough ammo for both.',
    },
    id: 15, name: 'Frosty', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 25], noise: 3, mystery: 0.35, locks: 0.1,
    ice: 0.35, iceColors: 'w', dockOptions: [4, 3],
    rows: [
      '.....bbb',
      '.....bbb',
      '.....bbb',
      '...bbbbb',
      '.....www',
      '....wwww',
      '....wkww',
      '....wwwo',
      '....wwww',
      '...rrrrr',
      '...rrrrr',
      '...wwwww',
      '..wwwwww',
      'nn.wwwwk',
      '..nwwwww',
      '..wwwwww',
      '.wwwwwwk',
      '.wwwwwww',
      '.wwwwwww',
      '..wwwwww',
      '...wwwww',
    ],
  },
  {
    id: 16, name: 'Up and Away', outline: 'k', columns: 4, chunks: [15, 20, 30], noise: 3.5, mystery: 0.4, locks: 0.15, ice: 0.12, dockOptions: [4, 3],
    rows: balloonRows,
  },
  {
    id: 17, name: 'Summer Slice', outline: 'k', columns: 4, chunks: [15, 20], noise: 3.5, mystery: 0.4, locks: 0.15, ice: 0.15, dockOptions: [4, 3],
    rows: watermelonRows,
  },
  {
    id: 18, name: 'Fennel the Fox', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 30], noise: 3.5, mystery: 0.4, locks: 0.15, ice: 0.12, dockOptions: [4, 3],
    rows: [
      'o........',
      'oo.......',
      'ono......',
      'onno.....',
      'onnoooooo',
      'ooooooooo',
      'ooookoooo',
      'woookoooo',
      'wwooooooo',
      'wwwoooooo',
      '.wwwwoooo',
      '..wwwwwoo',
      '...wwwwww',
      '....wwwwk',
      '......www',
    ],
  },
  {
    id: 19, name: 'Time for Tea', outline: 'k', columns: 4, chunks: [20, 30], noise: 4, mystery: 0.4, locks: 0.2, ice: 0.15, dockOptions: [4, 3],
    rows: teapotRows,
  },
  {
    id: 20, name: 'Flutterby', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 30], noise: 4, mystery: 0.45, locks: 0.2, ice: 0.15, dockOptions: [4, 3],
    rows: [
      '.......n..',
      '........n.',
      '.vvv.....n',
      'vvvvv....n',
      'vvpvvv...n',
      'vpppvvv..n',
      'vvpvvvvv.n',
      'vvvvvvvvvn',
      '.vvvvvvvvn',
      '..vvvvvvvn',
      '...yyyyyyn',
      '..yyyoyyyn',
      '..yyooyyyn',
      '...yyyyyyn',
      '....yyyy.n',
      '.........n',
    ],
  },
  {
    id: 21, name: 'Professor Owl', outline: 'k', mirror: 'even', columns: 4, chunks: [20, 30], noise: 4, mystery: 0.45, locks: 0.2, ice: 0.15, dockOptions: [4, 3],
    rows: [
      'nn.......',
      'nnn......',
      'nnnnnnnnn',
      'nnwwwnnnn',
      'nwwwwwnnn',
      'nwwkkwnnn',
      'nwwkkwnno',
      'nnwwwnnno',
      'nnnnnnnnn',
      'nnntttttt',
      'nnttntttn',
      'nntntntnt',
      'nnttntttn',
      'nntntntnt',
      'nnttttttt',
      '.nnnttttt',
      '....oo...',
    ],
  },
  {
    id: 22, name: 'Plain Sailing', outline: 'k', columns: 5, chunks: [20, 30], noise: 4.5, mystery: 0.45, locks: 0.2, ice: 0.18, dockOptions: [4, 3],
    rows: [
      '..........r...........',
      '..........nr..........',
      '..........nrr.........',
      '.........wnrrr........',
      '........wwnwwww.......',
      '.......wwwnwwwww......',
      '......wwwwnrrrrrr.....',
      '.....wwwwwnwwwwwww....',
      '....wwwwwwnwwwwwwww...',
      '...rrrrrrrnrrrrrrrrr..',
      '..........n...........',
      '.nnnnnnnnnnnnnnnnnnnn.',
      '..nnynnnnnnnnnnnnynn..',
      '...nnnnnnnnnnnnnnnn...',
      'bbcbbbbcbbbbbcbbbbcbbb',
      'bbbbbbbbbbbbbbbbbbbbbb',
    ],
  },
  {
    id: 23, name: 'Prickly Pete', outline: 'k', mirror: 'even', columns: 4, chunks: [20, 30], noise: 4.5, mystery: 0.5, locks: 0.25, ice: 0.18, dockOptions: [4, 3],
    rows: [
      '......pp',
      '.....ppy',
      '......pp',
      '.....gGg',
      '.....gGg',
      '.g...gGg',
      'gGg..gGg',
      'gGg..gGg',
      'gGggggGg',
      '.ggg.gGg',
      '.....gGg',
      '.....gGg',
      '..oooooo',
      '..oooooo',
      '...nnnnn',
      '...ooooo',
      '....oooo',
    ],
  },
  {
    id: 24, name: 'Hazel the Hedgehog', outline: 'k', columns: 5, chunks: [20, 30], noise: 5, mystery: 0.5, locks: 0.25, ice: 0.2, dockOptions: [4, 3],
    rows: hedgehogRows,
  },

  // ------------------------------------------------------------ Expert
  // Festive and fiendish: three slots, lots of locks, ice and "?" turrets,
  // and from Snowflake on, full backgrounds so every column is deep.
  {
    section: 'Expert',
    id: 25, name: 'Candy Cane', outline: 'k', columns: 4, chunks: [20, 30], noise: 5, mystery: 0.5, locks: 0.25, ice: 0.2, dockOptions: [4, 3],
    rows: candyCaneRows,
  },
  {
    id: 26, name: 'Gingerbread Gent', outline: 'k', mirror: 'even', columns: 4, chunks: [20, 30], noise: 5, mystery: 0.5, locks: 0.25, ice: 0.22, dockOptions: [4, 3],
    rows: [
      '......nnn',
      '.....nnnn',
      '.....nknn',
      '.....pnnn',
      '.....nwww',
      '......nnn',
      '.nnnnnnnn',
      'nwnnnnnnn',
      'nwnnnnnnr',
      '.nnnnnnnn',
      '.....nnnn',
      '.....nnnr',
      '....nnnnn',
      '....nnnnn',
      '...nnnn..',
      '..nnnn...',
      '..nwnn...',
      '..nnn....',
    ],
  },
  {
    id: 27, name: 'Figgy Pudding', outline: 'k', columns: 5, chunks: [20, 30], noise: 5, mystery: 0.5, locks: 0.28, ice: 0.22, dockOptions: [4, 3],
    rows: puddingRows,
  },
  {
    id: 28, name: 'Bauble', outline: 'k', columns: 5, chunks: [20, 30], noise: 5.5, mystery: 0.55, locks: 0.28, ice: 0.25, dockOptions: [4, 3],
    rows: baubleRows,
  },
  {
    id: 29, name: 'Snowflake', columns: 5, chunks: [20, 30, 40], noise: 5.5, mystery: 0.55, locks: 0.3, ice: 0.2, dockOptions: [4, 3],
    rows: snowflakeRows,
  },
  {
    id: 30, name: 'Rockin’ Robin', outline: 'k', columns: 5, chunks: [20, 30, 40], noise: 6, mystery: 0.55, locks: 0.3, ice: 0.25, dockOptions: [4, 3],
    rows: () => withBackground([
      '..........nnnnn.........',
      '........nnnnnnnnn.......',
      '.......nnnnnnnnknn......',
      '.......nnnnnnnnnnnyy....',
      '......nnnnnnoooonnyyy...',
      '......nnnnnooooooon.....',
      '.....nnnnnooooooooon....',
      '....nnnnnooooooooooon...',
      '...nnnnnnoooooooooooon..',
      '..nnnnnnnoooooooooooon..',
      '.nnnnnnnnoooooooooooon..',
      'nnnnnnnnnwooooooooooon..',
      'nnnnnnnnnwwwoooooooon...',
      '.nnnnnnnnwwwwwwwwwwwn...',
      '..nnnnnnnwwwwwwwwwwn....',
      '....nnnnnnwwwwwwwnn.....',
      '.......nnnnnnnnnn.......',
      '..........s...s.........',
      'nnnnnnnnnnnnnnnnnnnnnnnn',
      '..GGr..........rGG......',
    ], 'c'),
  },
  {
    id: 31, name: 'Rudolph', outline: 'k', mirror: 'even', columns: 5, chunks: [20, 30, 40], noise: 6, mystery: 0.6, locks: 0.3, ice: 0.25, dockOptions: [4, 3],
    rows: [
      '.t..t.....',
      '.t.tt.....',
      '.ttt..t...',
      '..tt.tt...',
      '...ttt....',
      '....tt....',
      'nnn..nnnnn',
      '.nnnnnnnnn',
      '...nnnnnnn',
      '...nnknnnn',
      '...nnnnnnn',
      '....nnnnnn',
      '....nnnttt',
      '....nnttrr',
      '....nnttrr',
      '.....ntttt',
      '......tttt',
    ],
  },
  {
    id: 32, name: 'Under the Tree', outline: 'k', columns: 5, chunks: [20, 30, 40], noise: 6.5, mystery: 0.6, locks: 0.32, ice: 0.28, dockOptions: [4, 3],
    rows: presentRows,
  },
  {
    id: 33, name: 'Oh Christmas Tree', columns: 5, chunks: [20, 30, 40], noise: 6.5, mystery: 0.6, locks: 0.32, ice: 0.25, dockOptions: [4, 3],
    rows: treeRows,
  },
  {
    id: 34, name: 'Snowed In', columns: 5, chunks: [20, 30, 40], noise: 7, mystery: 0.6, locks: 0.35, ice: 0.25, dockOptions: [4, 3],
    rows: cottageRows,
  },

  // ------------------------------------------------------------ Secret
  // Only reachable from the About page. The hardest one of all.
  {
    secret: true,
    id: 35, name: 'The Maker', mirror: 'even', columns: 5, chunks: [30, 40], noise: 7, mystery: 0.6, locks: 0.35, ice: 0.35, iceColors: 'ck', dockOptions: [3],
    rows: [
      'cccccccccccccc',
      'cccccccccccccc',
      'ccccccccMMMMMM',
      'cccccMMMMMMMMM',
      'ccccMMMMMPPPPP',
      'cccMMMMPPPPPPP',
      'cccMMMPPPPPPPP',
      'cccMMPPPPPPPPP',
      'cccMMPPPPPPPPP',
      'cccMMPPPPPPPPP',
      'cccMPPPPPPPPPP',
      'cccMPMMMMMPPPP',
      'ccPPPPPPPPPPPP',
      'ccPPwskswPPPPP',
      'ccPPPPPPPPPPPP',
      'ccRPPPPPPPPPPP',
      'cccPPPPPPPPPRP',
      'cccPPPPPPPPPRP',
      'cccsPPPPPPPPRR',
      'cccsMPPPPPPPPP',
      'cccsMMPPPPMMMM',
      'cccsMMPPPPRRRR',
      'cccsMMMPPMMMMM',
      'ccccsMMMMMsMMM',
      'ccccsMMMMsMMMM',
      'cccccsMMMMMMMM',
      'cccccccsMMMMMM',
      'ccccccccPPPPPP',
      'ccccccccPPPPPP',
      'ccccckkkkPPPPP',
      'cckkkkkkkkPPPP',
      'ckkkkkkkkkkkPP',
      'kkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkk',
    ],
  },

  // ------------------------------------------------------------ Elite
  // Slots above the picture too, stones and hammers. Starring Nelly.
  {
    section: 'Elite',
    tip: {
      title: 'Slots up top',
      text: 'There are slots above the picture now. Turrets up there fire downwards, so you can work on a column from either end. Tap a turret, then tap the slot you want.',
    },
    id: 36, name: 'Nelly', mirror: 'even', columns: 5, chunks: [20, 30, 40], noise: 6, mystery: 0.5, locks: 0.25, ice: 0.18,
    iceColors: 'cDn', topDocks: 2, dockOptions: [3],
    rows: [
      'cccccccccccccc',
      'ccccccccDDDDDD',
      'ccccccDDDDDDDD',
      'cccccDDDDDDDDD',
      'ccccDDDDDDDDDD',
      'cccnDDDDDDDDDD',
      'ccnnDDDDDDDDDD',
      'cnDnnDDDDDDDDD',
      'cnnDnDDDDDDDDD',
      'nDnnDnDDDDDDDD',
      'nnDnnDDkkkDDDD',
      'nDnnDnDkwkDDDD',
      'nnDnnDDkkkDDDD',
      'DnnDnnDDDDDDnD',
      'nDnnDnDDDDDDnn',
      'nnDnnDnDDDDsnn',
      'DnnDnnDDDDssnn',
      'nDnnDnDDDsssss',
      'nnDnnDnDsssskk',
      'DnnDnnDDssskkk',
      'nDnnDnnDssskkk',
      'nnDnnDnDsssskk',
      'DnnDnnDDDsssss',
      'nDnnDnnDDDssww',
      'nnDnnDnDDDDwww',
      'cnnDnnDDDDDDww',
      'cnDnnDnDDDDDww',
      'ccnnDnnDDDDwww',
      'cccnnDDDDDwwww',
      'ccccDDDDDwwwww',
    ],
  },
  {
    tip: {
      title: 'Stones and hammers',
      text: 'Some beads are hidden under stones. Only a grey hammer turret can smash a stone, and then the bead underneath needs its own colour as usual.',
    },
    id: 37, name: 'Nelly Looks Up', columns: 5, chunks: [20, 30, 40], noise: 6, mystery: 0.5, locks: 0.25, ice: 0.12,
    iceColors: 'cD', stones: 0.08, topDocks: 2, dockOptions: [3],
    rows: nellyProfileRows,
  },
  {
    tip: {
      title: 'Linked turrets',
      text: 'Turrets joined by a chain go out together. Both need to be at the front, and you need two free slots on the same row.',
    },
    id: 38, name: 'Lana', columns: 5, chunks: [20, 30, 40], noise: 6, mystery: 0.5, locks: 0.2, ice: 0.12,
    iceColors: 'gs', links: 0.2, topDocks: 2, dockOptions: [3],
    rows: lanaRows,
  },
  {
    tip: {
      title: 'Fog beads',
      text: 'Grey beads with a “?” are hiding their colour. They show what they really are once they reach the top or bottom of their column.',
    },
    id: 39, name: 'Juno', columns: 5, chunks: [20, 30, 40], noise: 6.5, mystery: 0.5, locks: 0.25, ice: 0.14,
    iceColors: 'yk', stones: 0.05, links: 0.15, fog: 0.18, topDocks: 2, dockOptions: [3],
    rows: junoRows,
  },
];

// Each level with its tuned tray layout (see tools/tune-levels.mjs) applied.
export const LEVELS = RAW_LEVELS.map((def) => ({ ...def, ...(TUNING[def.id] || {}) }));
