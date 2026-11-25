// Under the Sea pictures (the Fiendish set), drawn with code. Each returns rows
// of palette keys. Backgrounds are banded water rather than speckled, because
// lone beads buried deep in a background jam the slots.

function grid(W, H, fill = '.') {
  const g = Array.from({ length: H }, () => Array(W).fill(fill));
  g.set = (x, y, ch) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };
  g.get = (x, y) => g[y]?.[x];
  g.rows = () => g.map((r) => r.join(''));
  return g;
}

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

// Light water at the top, deeper water below, and sand along the bottom.
function sea(g, W, H, { light = 0.3, sand = 2 } = {}) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wave = Math.round(Math.sin(x * 0.7) * 0.6);
      let ch = y < H * light + wave ? 'c' : 'b';
      if (y >= H - sand + Math.round(Math.sin(x * 0.9 + 1) * 0.7)) ch = 't';
      g.set(x, y, ch);
    }
}

// A little cluster of bubbles (a ring, so it's never a lone bead).
function bubbles(g, x, y) {
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, -2], [3, -2], [2, -3], [3, -3]]) g.set(x + dx, y + dy, 'w');
}

// 50: a clownfish.
export function clownfishRows() {
  const W = 24, H = 18, g = grid(W, H);
  sea(g, W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const body = inEllipse(x, y, 12.5, 9, 8.5, 5);
      const tail = x >= 1 && x <= 4 && Math.abs(y - 9) <= (5 - x) * 0.8 + 1;
      const fin = inEllipse(x, y, 12, 3.6, 3, 1.5) || inEllipse(x, y, 11, 14.4, 2.2, 1.2);
      if (!(body || tail || fin)) continue;
      let ch = 'o';
      if (body) {
        for (const sx of [7.5, 12.5, 17.5]) {
          const d = Math.abs(x - sx - (y - 9) * 0.2);
          if (d < 0.8) ch = 'w';
          else if (d < 1.4 && ch === 'o') ch = 'k';
        }
      }
      if ((tail && x === 1) || (fin && !body && (y <= 2 || y >= 15))) ch = 'k';
      g.set(x, y, ch);
    }
  g.set(19, 7, 'w'); g.set(19, 8, 'k'); // eye
  g.set(21, 10, 'r'); // mouth
  bubbles(g, 20, 3);
  for (const x of [3, 4, 21, 22]) for (let y = H - 5; y < H - 1; y++) g.set(x, y, 'g'); // sea grass
  return g.rows();
}

// 51: a seahorse.
export function seahorseRows() {
  const W = 20, H = 26, g = grid(W, H);
  sea(g, W, H, { light: 0.25 });
  const pts = [];
  for (let t = 0; t <= 1; t += 0.01) {
    // the spine: head at the top, curling tail at the bottom
    const y = 3 + t * 18;
    const x = 9 + Math.sin(t * 3.4) * 2.2 - t * 1.2;
    pts.push([x, y, 3.2 - t * 2.3]);
  }
  for (let a = 0; a < Math.PI * 1.6; a += 0.05) pts.push([7.5 + Math.cos(a) * 2.2, 21 + Math.sin(a) * 2.2, 0.9]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (pts.some(([px, py, r]) => Math.hypot(x - px, y - py) < r)) g.set(x, y, (y + Math.floor(x / 2)) % 4 === 0 ? 'o' : 'y');
  for (let x = 12; x <= 15; x++) g.set(x, 4, 'y'); // snout
  g.set(15, 3, 'o'); g.set(15, 5, 'o');
  g.set(10, 3, 'k');
  for (let y = 9; y <= 13; y++) g.set(13, y, 'p'); // fin
  for (let y = 9; y <= 12; y++) g.set(14, y, 'p');
  for (let x = 7; x <= 10; x++) g.set(x, 1, 'o'); // crown
  bubbles(g, 15, 15);
  for (const x of [1, 2, 17]) for (let y = H - 7; y < H - 1; y++) g.set(x, y, 'g');
  return g.rows();
}

// 52: a jellyfish drifting in deep water.
export function jellyfishRows() {
  const W = 22, H = 26, g = grid(W, H);
  sea(g, W, H, { light: 0.15, sand: 0 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y <= 10 && inEllipse(x, y, 10.5, 10, 8, 8) && y >= 3) g.set(x, y, y >= 9 ? 'v' : y <= 5 ? 'p' : (x + y) % 5 === 0 ? 'w' : 'p');
      if (y === 10 && x >= 3 && x <= 18) g.set(x, y, 'v');
    }
  // tentacles
  for (const [x0, ph] of [[5, 0], [8, 1.5], [11, 3], [14, 0.8], [16, 2.2]])
    for (let y = 11; y < H - 1; y++) {
      const x = Math.round(x0 + Math.sin(y * 0.6 + ph) * 1.2);
      g.set(x, y, y % 6 < 3 ? 'p' : 'v');
    }
  g.set(8, 6, 'k'); g.set(13, 6, 'k'); // eyes
  g.set(10, 8, 'r'); g.set(11, 8, 'r'); // smile
  bubbles(g, 17, 14);
  bubbles(g, 2, 20);
  return g.rows();
}

// 53: a red octopus with curly arms.
export function octopusRows() {
  const W = 24, H = 22, g = grid(W, H);
  sea(g, W, H, { light: 0.2 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (inEllipse(x, y, 12, 7, 6.5, 6)) g.set(x, y, 'r');
  for (const [x0, dir] of [[6, -1], [9, -1], [12, 1], [15, 1], [18, 1]]) {
    for (let t = 0; t < 1; t += 0.02) {
      const x = x0 + dir * Math.sin(t * 2.6) * 3.5 + (x0 - 12) * t * 0.6;
      const y = 11 + t * 8;
      const r = 1.3 - t * 0.6;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx - x, yy - y) <= r) g.set(xx, yy, 'r');
    }
  }
  for (const [x, y] of [[9, 6], [14, 6]]) { g.set(x, y, 'w'); g.set(x + 1, y, 'w'); g.set(x, y + 1, 'w'); g.set(x + 1, y + 1, 'k'); }
  for (let x = 10; x <= 14; x++) g.set(x, 10, 'p'); // spots and a smile
  g.set(12, 2, 'p'); g.set(13, 3, 'p'); g.set(9, 3, 'p');
  bubbles(g, 19, 2);
  return g.rows();
}

// 54: a spiky pufferfish.
export function pufferfishRows() {
  const W = 22, H = 22, g = grid(W, H);
  sea(g, W, H, { light: 0.35 });
  const cx = 10.5, cy = 10.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      const spike = d < 9.2 && d >= 7 && Math.cos(a * 10) > 0.75;
      if (d < 7) g.set(x, y, y > cy + 2 ? 'w' : (Math.round(x * 0.8 + y) % 6 === 0 ? 'o' : 'y'));
      else if (spike) g.set(x, y, 'n');
    }
  for (const [x, y] of [[7, 8], [13, 8]]) { g.set(x, y, 'w'); g.set(x + 1, y, 'w'); g.set(x, y + 1, 'w'); g.set(x + 1, y + 1, 'k'); }
  for (let x = 9; x <= 12; x++) g.set(x, 13, 'r'); // pouty lips
  g.set(10, 12, 'r'); g.set(11, 12, 'r');
  bubbles(g, 17, 2);
  return g.rows();
}

// 55: a sea turtle swimming.
export function turtleRows() {
  const W = 26, H = 22, g = grid(W, H);
  sea(g, W, H, { light: 0.3 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // flippers
      if (inEllipse(x, y, 7, 5, 4, 2) || inEllipse(x, y, 7, 16, 4, 2) || inEllipse(x, y, 19, 6, 3, 1.6) || inEllipse(x, y, 19, 15, 3, 1.6)) g.set(x, y, 'g');
      if (inEllipse(x, y, 22.5, 10.5, 3, 2.4)) g.set(x, y, 'g'); // head
      if (inEllipse(x, y, 12.5, 10.5, 8, 6)) {
        // shell: hexagon-ish plates outlined in forest green
        const px = Math.round((x - 12.5) / 3.2), py = Math.round((y - 10.5 + (px % 2 ? 1.6 : 0)) / 3.2);
        const cx = 12.5 + px * 3.2, cy = 10.5 + py * 3.2 - (px % 2 ? 1.6 : 0);
        g.set(x, y, Math.hypot(x - cx, y - cy) < 1.2 ? 't' : 'G');
      }
    }
  g.set(23, 9, 'k'); g.set(24, 11, 'G');
  bubbles(g, 22, 3);
  return g.rows();
}

// 56: a happy whale with a spout.
export function whaleRows() {
  const W = 26, H = 22, g = grid(W, H);
  sea(g, W, H, { light: 0.4 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inEllipse(x, y, 10.5, 13, 9.5, 5.5)) g.set(x, y, y > 14 && x < 15 ? 'w' : 'v');
      // a tail sweeping up on the right, ending in two flukes
      if (x >= 18 && x <= 21 && y >= 9 && y <= 14 && Math.abs(y - (14 - (x - 18) * 1.4)) <= 1.2) g.set(x, y, 'v');
      if (inEllipse(x, y, 20.5, 6.5, 1.6, 1.1) || inEllipse(x, y, 23.5, 7.5, 1.6, 1.1)) g.set(x, y, 'v');
    }
  for (let x = 5; x <= 13; x += 2) g.set(x, 16, 'c'); // throat grooves
  g.set(5, 11, 'k'); g.set(4, 13, 'p'); g.set(6, 13, 'p');
  // spout
  for (let y = 2; y <= 7; y++) g.set(9, y, 'w');
  for (const [x, y] of [[7, 2], [8, 1], [10, 1], [11, 2], [6, 3], [12, 3]]) g.set(x, y, 'w');
  return g.rows();
}

// 57: a treasure chest on the sea bed.
export function treasureRows() {
  const W = 24, H = 22, g = grid(W, H);
  sea(g, W, H, { light: 0.25, sand: 5 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x >= 4 && x <= 19 && y >= 11 && y <= 18) g.set(x, y, y === 13 || x === 4 || x === 19 ? 'D' : 'n'); // box
      if (x >= 4 && x <= 19 && y >= 6 && y <= 10 && inEllipse(x, y, 11.5, 10.5, 8.2, 4.6)) g.set(x, y, y === 10 ? 'D' : 'n'); // lid
    }
  for (let x = 6; x <= 17; x++) for (let y = 9; y <= 12; y++) if (y >= 11 || (x + y) % 3) g.set(x, y, 'y'); // gold
  for (let y = 11; y <= 18; y++) { g.set(8, y, 's'); g.set(15, y, 's'); } // metal bands
  for (let x = 10; x <= 13; x++) for (let y = 14; y <= 16; y++) g.set(x, y, 'y'); // lock
  g.set(11, 15, 'k'); g.set(12, 15, 'k');
  g.set(9, 8, 'r'); g.set(14, 8, 'g'); // jewels
  bubbles(g, 19, 3);
  for (const x of [1, 22]) for (let y = 9; y < H - 3; y++) g.set(x, y, 'g');
  return g.rows();
}

// 58: a coral reef with a little fish.
export function reefRows() {
  const W = 26, H = 24, g = grid(W, H);
  sea(g, W, H, { light: 0.3, sand: 3 });
  // branching coral
  const branch = (x, y, len, ang, ch, depth) => {
    for (let t = 0; t < len; t += 0.4) g.set(Math.round(x + Math.cos(ang) * t), Math.round(y + Math.sin(ang) * t), ch);
    if (depth > 0) {
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      branch(ex, ey, len * 0.7, ang - 0.5, ch, depth - 1);
      branch(ex, ey, len * 0.7, ang + 0.5, ch, depth - 1);
    }
  };
  branch(5, 21, 4, -Math.PI / 2, 'p', 2);
  branch(19, 21, 4, -Math.PI / 2 + 0.2, 'v', 2);
  // brain coral and a sea fan
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inEllipse(x, y, 12, 19.5, 4, 2.6)) g.set(x, y, (x + y) % 3 ? 'o' : 'r');
    if (inEllipse(x, y, 23, 14, 2.2, 5)) g.set(x, y, 'r');
  }
  // a little yellow fish
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inEllipse(x, y, 13, 7, 3.4, 2)) g.set(x, y, 'y');
    if (x >= 16 && x <= 18 && Math.abs(y - 7) <= x - 15) g.set(x, y, 'y');
  }
  g.set(11, 6, 'k');
  bubbles(g, 7, 3);
  return g.rows();
}

// 59: an anglerfish with its glowing lure, deep in the dark.
export function anglerfishRows() {
  const W = 24, H = 24, g = grid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, y < 4 ? 'b' : 'k');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inEllipse(x, y, 12, 14, 8, 6.5)) g.set(x, y, 'n');
      if (x >= 18 && x <= 22 && Math.abs(y - 14) <= (x - 17) * 0.9) g.set(x, y, 'n'); // tail
      if (inEllipse(x, y, 13, 9, 3, 1.3)) g.set(x, y, 'C'); // fin on its back
    }
  // the big grinning mouth with pointy teeth
  for (let x = 3; x <= 13; x++) for (let y = 14; y <= 19; y++) if (inEllipse(x, y, 7.5, 16.5, 5, 2.6)) g.set(x, y, 'r');
  for (const x of [4, 6, 8, 10, 12]) g.set(x, 15, 'w');
  for (const x of [5, 7, 9, 11]) g.set(x, 18, 'w');
  for (const [x, y] of [[10, 11], [11, 11], [10, 12]]) g.set(x, y, 'w');
  g.set(11, 12, 'k'); // eye
  // the lure: a stalk arching forward to a glowing bulb
  for (let t = 0; t <= 1; t += 0.04) g.set(Math.round(12 - t * 8), Math.round(8 - Math.sin(t * Math.PI) * 3.5), 's');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 3.5, y - 9);
    if (d < 1.3) g.set(x, y, 'y');
    else if (d < 2.4) g.set(x, y, 'c');
  }
  return g.rows();
}
