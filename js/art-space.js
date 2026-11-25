// Space pictures, drawn with code. Each function returns rows of palette keys
// (see PALETTE in engine.js); '.' is empty.
import { rng } from './engine.js';

function grid(W, H, fill = '.') {
  const g = Array.from({ length: H }, () => Array(W).fill(fill));
  g.set = (x, y, ch) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };
  g.rows = () => g.map((r) => r.join(''));
  return g;
}

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

// A scatter of stars over a background colour.
function starry(g, W, H, bg, seed, density = 0.06) {
  const rand = rng(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, rand() < density ? (rand() < 0.7 ? 'w' : 'y') : bg);
}

// 40: a red and white rocket with a round window and a flame.
export function rocketRows() {
  const W = 17, H = 27, g = grid(W, H), c = 8;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - c);
      if (y >= 1 && y <= 6 && dx <= (y - 1) * 0.75 + 0.4) g.set(x, y, 'r'); // nose cone
      if (y >= 7 && y <= 18 && dx <= 4) g.set(x, y, y === 15 || y === 16 ? 'r' : 'w'); // body with a stripe
      if (y >= 14 && y <= 21 && dx > 4 && dx <= 4 + Math.min(3, (y - 13) * 0.6)) g.set(x, y, 'r'); // fins
      if (y >= 19 && y <= 20 && dx <= 2.5) g.set(x, y, 's'); // nozzle
      const fw = 2.6 - (y - 21) * 0.5;
      if (y >= 21 && dx <= fw) g.set(x, y, dx <= fw - 1.1 ? 'y' : 'o'); // flame
    }
  for (let y = 8; y <= 13; y++) for (let x = 4; x <= 12; x++) {
    const d = Math.hypot(x - c, y - 10.5);
    if (d < 2.9) g.set(x, y, d < 2 ? 'c' : 's'); // porthole
  }
  g.set(7, 9, 'w');
  return g.rows();
}

// 41: a stripy planet with a ring around it.
export function ringedPlanetRows() {
  const W = 28, H = 19, g = grid(W, H), cx = 13.5, cy = 9;
  const ring = (x, y) => inEllipse(x, y, cx, cy + 0.5, 13.4, 3.6) && !inEllipse(x, y, cx, cy + 0.5, 9.6, 2.1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (ring(x, y) && y < cy) g.set(x, y, 'v'); // back of the ring, behind the planet
      if (Math.hypot(x - cx, y - cy) < 7.2) g.set(x, y, ['o', 'y', 'o', 't', 'n', 't', 'o'][Math.floor((y - cy + 7.2) / 2.1)] || 'o');
      if (ring(x, y) && y >= cy) g.set(x, y, 'v'); // front of the ring
    }
  return g.rows();
}

// 42: a sleepy crescent-cheeked moon in a nightcap.
export function sleepyMoonRows() {
  const W = 24, H = 24, g = grid(W, H), cx = 11.5, cy = 13;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, y - cy) < 10.2) g.set(x, y, 'y');
      for (const [px, py, r] of [[6, 10, 1.6], [16.5, 17.5, 1.9], [15, 8, 1.2], [7.5, 18, 1.1]])
        if (Math.hypot(x - px, y - py) < r) g.set(x, y, 't'); // craters
      // nightcap flopping over to the right, with a pompom
      if (y <= 5 && y >= 0 && x >= 6 + y * 0.2 && x <= 17 - (5 - y) * 1.3 && y >= 5 - (x - 6) * 0.6) g.set(x, y, 'b');
      if (y === 5 && x >= 4 && x <= 19) g.set(x, y, 'w');
      if (Math.hypot(x - 19.5, y - 1.5) < 1.6) g.set(x, y, 'w');
    }
  // closed sleepy eyes, a smile, rosy cheeks
  for (const [x, y] of [[7, 12], [8, 13], [9, 13], [10, 12], [13, 12], [14, 13], [15, 13], [16, 12]]) g.set(x, y, 'k');
  for (const [x, y] of [[9, 17], [10, 18], [11, 18], [12, 18], [13, 18], [14, 17]]) g.set(x, y, 'k');
  for (const [x, y] of [[6, 15], [7, 15], [16, 15], [17, 15]]) g.set(x, y, 'p');
  return g.rows();
}

// 43: a little green alien with three eyes and wobbly antennae.
export function alienRows() {
  const W = 24, H = 26, g = grid(W, H), cx = 11.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inEllipse(x, y, cx, 11, 9.5, 7.5)) g.set(x, y, 'g'); // big round head
      if (y >= 17 && y <= 25 && inEllipse(x, y, cx, 24, 6.5, 7.5)) g.set(x, y, y === 20 ? 'y' : 'v'); // suit with a belt
      if (y >= 18 && y <= 22 && (Math.abs(x - 3.5) < 1.2 || Math.abs(x - 19.5) < 1.2) && y >= 18 + Math.abs(x - cx) * 0) g.set(x, y, 'g'); // arms
    }
  // antennae
  for (const [x, y] of [[7, 3], [6, 2], [16, 3], [17, 2]]) g.set(x, y, 'G');
  for (const [x, y] of [[5, 0], [6, 0], [5, 1], [6, 1], [17, 0], [18, 0], [17, 1], [18, 1]]) g.set(x, y, 'p');
  // three eyes
  for (const ex of [6.5, 11.5, 16.5])
    for (let y = 7; y <= 11; y++) for (let x = 3; x <= 20; x++) {
      const d = Math.hypot(x - ex, y - 9);
      if (d < 2.3) g.set(x, y, d < 1 ? 'k' : 'w');
    }
  // big smile
  for (const [x, y] of [[8, 14], [9, 15], [10, 15], [11, 15], [12, 15], [13, 15], [14, 15], [15, 14]]) g.set(x, y, 'G');
  return g.rows();
}

// 44: a flying saucer with a glass dome, a passenger, lights and a tractor beam.
export function ufoRows() {
  const W = 28, H = 22, g = grid(W, H), cx = 13.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y >= 12 && Math.abs(x - cx) <= 2 + (y - 12) * 0.8) g.set(x, y, 'y'); // beam
      if (y <= 8 && inEllipse(x, y, cx, 8, 6, 6.5)) g.set(x, y, 'c'); // glass dome
      if (inEllipse(x, y, cx, 9.5, 13.5, 3.2)) g.set(x, y, y >= 10 ? 's' : 'w'); // saucer
      if (inEllipse(x, y, cx, 12, 7, 1.6)) g.set(x, y, 'v'); // underside
    }
  // passenger peeking out
  for (let y = 4; y <= 8; y++) for (let x = 10; x <= 17; x++) if (inEllipse(x, y, cx, 7, 2.6, 2.8)) g.set(x, y, 'g');
  g.set(12, 6, 'k'); g.set(15, 6, 'k');
  // lights around the rim
  for (const x of [3, 7, 11, 16, 20, 24]) g.set(x, 10, 'r');
  return g.rows();
}

// 45: an astronaut with a shiny visor.
export function astronautRows() {
  const W = 26, H = 30, g = grid(W, H), cx = 12.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, y - 8) < 8) g.set(x, y, 'w'); // helmet
      if (inEllipse(x, y, cx, 8.5, 5.8, 4.6)) g.set(x, y, 'b'); // visor
      if (y >= 15 && y <= 26 && Math.abs(x - cx) <= 6) g.set(x, y, 'w'); // body
      if (y >= 15 && y <= 22 && (Math.abs(x - 4.5) <= 1.6 || Math.abs(x - 20.5) <= 1.6)) g.set(x, y, 'w'); // arms
      if (y >= 26 && y <= 29 && (Math.abs(x - 9.5) <= 2 || Math.abs(x - 15.5) <= 2)) g.set(x, y, 's'); // boots
      if (y >= 14 && y <= 15 && Math.abs(x - cx) <= 4) g.set(x, y, 's'); // neck ring
    }
  // gloves
  for (const x of [3, 4, 5, 20, 21, 22]) g.set(x, 23, 's');
  // visor reflections
  for (const [x, y] of [[9, 6], [10, 6], [9, 7], [15, 10], [16, 9]]) g.set(x, y, 'c');
  // chest control panel
  for (let y = 17; y <= 20; y++) for (let x = 10; x <= 15; x++) g.set(x, y, 's');
  g.set(11, 18, 'r'); g.set(13, 18, 'y'); g.set(14, 19, 'g'); g.set(11, 19, 'b');
  return g.rows();
}

// 46: a shooting star with a rainbow tail, on a starry night.
export function shootingStarRows() {
  const W = 28, H = 22, g = grid(W, H);
  starry(g, W, H, 'b', 4601, 0.05);
  const sx = 20.5, sy = 6.5;
  // the tail: rainbow stripes trailing down to the left
  const bands = ['r', 'o', 'y', 'g', 'c', 'v'];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const along = ((sx - x) + (y - sy)) / Math.SQRT2; // distance back along the tail
      const across = ((x - sx) + (y - sy)) / Math.SQRT2; // sideways from the tail's centre line
      const half = 3.2 - along * 0.09;
      if (along > 0 && along < 22 && Math.abs(across) < half) g.set(x, y, bands[Math.min(5, Math.floor(((across + half) / (2 * half)) * 6))]);
    }
  // a five-pointed star
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = Math.atan2(y - sy, x - sx) + Math.PI / 2, d = Math.hypot(x - sx, y - sy);
      const r = 2.2 + 2.6 * Math.max(0, Math.cos(a * 5)) ** 2;
      if (d < r) g.set(x, y, d < 1.5 ? 'w' : 'y');
    }
  return g.rows();
}

// 47: planet Earth hanging in space, with clouds.
export function earthRows() {
  const W = 28, H = 28, g = grid(W, H), cx = 13.5, cy = 13.5;
  // Plain black: stars buried in the dark corners made the level far too hard.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, 'k');
  const rand = rng(4702);
  const blobs = Array.from({ length: 9 }, () => [cx - 8 + rand() * 16, cy - 8 + rand() * 16, 1.8 + rand() * 2.6]);
  const clouds = Array.from({ length: 6 }, () => [cx - 9 + rand() * 18, cy - 9 + rand() * 18, 2.5 + rand() * 2, 0.7 + rand() * 0.5]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 11.2) continue;
      let ch = 'b';
      const land = blobs.findIndex(([bx, by, r]) => Math.hypot(x - bx, y - by) < r);
      if (land >= 0) ch = land % 3 === 0 ? 'G' : 'g'; // forests and grassland
      if (clouds.some(([bx, by, rx, ry]) => inEllipse(x, y, bx, by, rx, ry))) ch = 'w';
      if (d > 10.4) ch = 'c'; // a thin glow of atmosphere
      g.set(x, y, ch);
    }
  return g.rows();
}

// 48: the sun and its planets in a row.
export function solarSystemRows() {
  const W = 30, H = 22, g = grid(W, H);
  starry(g, W, H, 'k', 4801, 0.04);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 4, y - 11);
      if (d < 10) g.set(x, y, d < 8 ? 'y' : 'o'); // the sun peeking in from the left
    }
  const planets = [[9, 11, 1.4, 's'], [12.5, 10, 1.9, 'p'], [16.5, 12, 2, 'b'], [20.5, 10, 1.6, 'r'], [26, 12, 3.4, 'C']];
  for (const [px, py, r, ch] of planets)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - px, y - py) < r) g.set(x, y, ch);
  for (let x = 22; x < 30; x++) if (Math.abs(x - 26) <= 4) g.set(x, 12, 't'); // a ring on the big one
  g.set(17, 11, 'g'); g.set(16, 12, 'g'); // a little land on the blue one
  return g.rows();
}

// 49: a spiral galaxy, glowing in the dark.
export function galaxyRows() {
  const W = 30, H = 30, g = grid(W, H), cx = 14.5, cy = 14.5;
  starry(g, W, H, 'k', 4901, 0.05);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = (y - cy) * 1.15;
      const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (r > 14) continue;
      // two arms winding outwards
      const arm = Math.cos(2 * (a - Math.log(r + 1) * 1.9));
      if (arm > 0.35) g.set(x, y, r < 6 ? 'p' : r < 10 ? 'v' : 'b');
      else if (arm > 0.05 && r < 12) g.set(x, y, 'c');
      if (r < 3.2) g.set(x, y, r < 1.8 ? 'w' : 'y'); // bright core
    }
  return g.rows();
}
