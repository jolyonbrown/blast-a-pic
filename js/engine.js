// Pure game logic: no DOM, no drawing. Shared by the game and by tools/ scripts.
//
// The picture is a grid of beads. Turrets sit below it, so a bead can only be
// hit when nothing is underneath it: each column is peeled from the bottom up.
//
// Extras for trickier levels:
//  - frozen beads need two hits (the first just cracks the ice)
//  - locked turrets can't be moved until enough other turrets have been used
// Turrets sit in a small number of docks; each turret has a colour and an ammo
// count and fires at the nearest exposed bead of its colour. When its ammo runs
// out it leaves and frees the dock. Fill every dock with turrets that have
// nothing to shoot and you're stuck.

export const PALETTE = {
  k: { name: 'Liquorice', hex: '#3a3644' },
  w: { name: 'Snow', hex: '#f7f3ec' },
  y: { name: 'Sunshine', hex: '#ffd23f' },
  o: { name: 'Tangerine', hex: '#ff8a3d' },
  r: { name: 'Cherry', hex: '#e8434d' },
  p: { name: 'Candyfloss', hex: '#ff9fcb' },
  v: { name: 'Violet', hex: '#9a6be0' },
  b: { name: 'Ocean', hex: '#3d7ff0' },
  c: { name: 'Sky', hex: '#8ad9f5' },
  g: { name: 'Leaf', hex: '#5ec97f' },
  G: { name: 'Forest', hex: '#2e7a4f' },
  n: { name: 'Cocoa', hex: '#8a5a3c' },
  t: { name: 'Biscuit', hex: '#ecc89f' },
  s: { name: 'Pebble', hex: '#a6aab4' },
};

// ---------------------------------------------------------------- random

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- art

// Turn a level's art definition into a grid of palette keys (or null).
// Supports: mirror ('even' | 'odd'), patch [[x,y,ch]], outline (palette key).
export function parseArt(def) {
  let rows = typeof def.rows === 'function' ? def.rows() : def.rows.slice();
  if (def.mirror) {
    const bad = rows.findIndex((r) => r.length !== rows[0].length);
    if (bad >= 0) throw new Error(`${def.name}: mirrored row ${bad} is ${rows[bad].length} wide, expected ${rows[0].length}`);
  }
  if (def.mirror === 'even') rows = rows.map((r) => r + [...r].reverse().join(''));
  if (def.mirror === 'odd') rows = rows.map((r) => r + [...r.slice(0, -1)].reverse().join(''));
  let W = Math.max(...rows.map((r) => r.length));
  let H = rows.length;
  let grid = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      row.push(ch && ch !== '.' && ch !== ' ' ? ch : null);
    }
    grid.push(row);
  }
  for (const [x, y, ch] of def.patch || []) grid[y][x] = ch === '.' ? null : ch;
  // Trim empty rows and columns around the picture.
  while (grid.length && grid[0].every((c) => !c)) grid.shift();
  while (grid.length && grid[grid.length - 1].every((c) => !c)) grid.pop();
  while (grid[0].length && grid.every((r) => !r[0])) grid.forEach((r) => r.shift());
  while (grid[0].length && grid.every((r) => !r[r.length - 1])) grid.forEach((r) => r.pop());
  H = grid.length;
  W = grid[0].length;

  if (def.outline) {
    // Grow by one cell on every side and ring the shape with the outline colour.
    const g2 = [];
    for (let y = 0; y < H + 2; y++) {
      const row = [];
      for (let x = 0; x < W + 2; x++) {
        const v = grid[y - 1]?.[x - 1] ?? null;
        if (v) { row.push(v); continue; }
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (grid[y - 1 + dy]?.[x - 1 + dx]) { near = true; break; }
        row.push(near ? def.outline : null);
      }
      g2.push(row);
    }
    grid = g2;
    W += 2;
    H += 2;
  }
  for (const row of grid) for (const ch of row) if (ch && !PALETTE[ch]) throw new Error(`Unknown colour '${ch}' in ${def.name}`);
  return { W, H, grid };
}

// ---------------------------------------------------------------- state

// A level, once built, is: picture + colours + turret tiles laid out in columns.
// State is the mutable part of a play-through.

export function newState(level) {
  const { W, H } = level;
  const s = {
    W, H,
    D: level.docks,
    cells: Int8Array.from(level.cells),
    hp: Uint8Array.from(level.hp), // hits each bead still needs (2 = frozen)
    bottom: new Int16Array(W).fill(-1), // row of the lowest bead in each column
    beadsLeft: 0,
    placed: 0, // turrets sent to a slot so far (opens padlocks)
    colPos: new Array(level.columns.length).fill(0),
    docks: new Array(level.docks).fill(null),
    level,
  };
  for (let i = 0; i < W * H; i++) if (s.cells[i] >= 0) s.beadsLeft++;
  for (let x = 0; x < W; x++) s.bottom[x] = lowestBead(s, x, H - 1);
  return s;
}

export function cloneState(s) {
  return {
    W: s.W, H: s.H, D: s.D,
    cells: Int8Array.from(s.cells),
    hp: Uint8Array.from(s.hp),
    bottom: Int16Array.from(s.bottom),
    beadsLeft: s.beadsLeft,
    placed: s.placed,
    colPos: s.colPos.slice(),
    docks: s.docks.map((d) => (d ? { ...d } : null)),
    level: s.level,
  };
}

function lowestBead(s, x, fromY) {
  for (let y = fromY; y >= 0; y--) if (s.cells[y * s.W + x] >= 0) return y;
  return -1;
}

// Turrets sit below the picture, so a bead can only be hit when nothing is
// underneath it: each column of the picture is peeled from the bottom up.
export function isExposed(s, i) {
  return s.cells[i] >= 0 && s.bottom[i % s.W] === ((i / s.W) | 0);
}

function removeBead(s, i) {
  const x = i % s.W, y = (i / s.W) | 0;
  s.cells[i] = -1;
  s.beadsLeft--;
  s.bottom[x] = lowestBead(s, x, y - 1);
}

// Where a dock "is" in grid coordinates (just below the picture) for targeting.
function dockPoint(s, d) {
  return [((d + 0.5) / s.D) * s.W - 0.5, s.H + 1.5];
}

export function findTarget(s, d, color) {
  const [px, py] = dockPoint(s, d);
  const { W } = s;
  let best = -1, bestDist = Infinity;
  for (let x = 0; x < W; x++) {
    const y = s.bottom[x];
    if (y < 0 || s.cells[y * W + x] !== color) continue;
    const dist = (x - px) ** 2 + (y - py) ** 2;
    if (dist < bestDist) { bestDist = dist; best = y * W + x; }
  }
  return best;
}

export function exposedCount(s, color) {
  let n = 0;
  for (let x = 0; x < s.W; x++) {
    const y = s.bottom[x];
    if (y >= 0 && s.cells[y * s.W + x] === color) n++;
  }
  return n;
}

export function firstFreeDock(s) {
  return s.docks.indexOf(null);
}

export function frontTile(s, col) {
  const column = s.level.columns[col];
  return s.colPos[col] < column.length ? s.level.tiles[column[s.colPos[col]]] : null;
}

// How many more turrets must be used before this one's padlock opens.
export function lockLeft(s, tile) {
  return Math.max(0, (tile.lock || 0) - s.placed);
}

export function canPlace(s, col) {
  const tile = frontTile(s, col);
  return !!tile && lockLeft(s, tile) === 0;
}

// Move the front turret of a column into a dock. Returns the tile, or null.
export function place(s, col, dock = firstFreeDock(s), arriving = false) {
  const tile = frontTile(s, col);
  if (!tile || lockLeft(s, tile) > 0 || dock < 0 || s.docks[dock]) return null;
  s.colPos[col]++;
  s.placed++;
  s.docks[dock] = { tile: tile.id, color: tile.color, count: tile.count, arriving };
  return tile;
}

// One round of fire: every ready turret takes one shot if it can.
export function tick(s) {
  const shots = [];
  for (let d = 0; d < s.docks.length; d++) {
    const dock = s.docks[d];
    if (!dock || dock.arriving) continue;
    const t = findTarget(s, d, dock.color);
    if (t < 0) continue;
    let popped = true;
    if (s.hp[t] > 1) { s.hp[t]--; popped = false; } // crack the ice
    else removeBead(s, t);
    dock.count--;
    const done = dock.count === 0;
    shots.push({ dock: d, cell: t, color: dock.color, tile: dock.tile, done, popped });
    if (done) s.docks[d] = null;
  }
  return shots;
}

export function settle(s) {
  let n = 0;
  while (tick(s).length) n++;
  return n;
}

export function canAnyFire(s) {
  return s.docks.some((d, i) => d && !d.arriving && findTarget(s, i, d.color) >= 0);
}

// Nothing can fire, and either every slot is full or every turret you could
// send is still padlocked.
export function isStuck(s) {
  if (s.beadsLeft === 0 || s.docks.some((d) => d && d.arriving) || canAnyFire(s)) return false;
  if (firstFreeDock(s) < 0) return true;
  return !s.level.columns.some((_, c) => canPlace(s, c));
}

export function stuckReason(s) {
  return firstFreeDock(s) < 0 ? 'full' : 'locked';
}

export function trayEmpty(s) {
  return s.level.columns.every((c, i) => s.colPos[i] >= c.length);
}

// ---------------------------------------------------------------- solver

function hashBoard(s) {
  let h = 2166136261;
  for (let i = 0; i < s.cells.length; i++) h = Math.imul(h ^ (s.cells[i] + 2 + s.hp[i] * 64), 16777619);
  return h >>> 0;
}

// Depth-first search over "tap a front turret, then wait until things settle".
// Returns { solved, moves, nodes } or { solved: false, aborted: true } past budget.
export function solve(start, budget = 30000) {
  const seen = new Set();
  const moves = [];
  let nodes = 0;
  let aborted = false;

  function dfs(s) {
    if (s.beadsLeft === 0) return true;
    if (++nodes > budget) { aborted = true; return false; }
    const key = s.colPos.join(',') + '|' + s.docks.map((d) => (d ? d.color + ':' + d.count : '-')).join(',') + '|' + hashBoard(s);
    if (seen.has(key)) return false;
    seen.add(key);
    const dock = firstFreeDock(s);
    if (dock < 0) return false;
    const cands = [];
    const sigs = new Set();
    for (let c = 0; c < s.level.columns.length; c++) {
      const tile = frontTile(s, c);
      if (!tile || lockLeft(s, tile) > 0) continue;
      const sig = tile.color + ':' + tile.count;
      if (sigs.has(sig)) continue;
      sigs.add(sig);
      cands.push({ c, score: exposedCount(s, tile.color) - tile.count * 0.01 });
    }
    cands.sort((a, b) => b.score - a.score);
    for (const { c } of cands) {
      const s2 = cloneState(s);
      place(s2, c, dock);
      settle(s2);
      if (isStuck(s2)) continue;
      moves.push(c);
      if (dfs(s2)) return true;
      moves.pop();
      if (aborted) return false;
    }
    return false;
  }

  const solved = dfs(cloneState(start));
  return { solved, aborted, moves: solved ? moves : null, nodes };
}

// ---------------------------------------------------------------- level building

// How deep each bead sits in its column, counted from the bottom.
function peelLayers(level) {
  const { W, H, cells } = level;
  const layer = new Int16Array(W * H).fill(-1);
  let depth = 0;
  for (let x = 0; x < W; x++) {
    let k = 0;
    for (let y = H - 1; y >= 0; y--) if (cells[y * W + x] >= 0) layer[y * W + x] = k++;
    depth = Math.max(depth, k);
  }
  return { layer, depth };
}

function chunkSizes(n, options, rand) {
  const sizes = [];
  let left = n;
  while (left > 0) {
    let size = Math.min(left, options[Math.floor(rand() * options.length)]);
    if (left - size < 5) size = left;
    sizes.push(size);
    left -= size;
  }
  return sizes;
}

// Build a playable level from its definition. Tries seeds until the solver
// confirms it can be beaten.
export function buildLevel(def) {
  const art = parseArt(def);
  const colors = [];
  const cells = new Int8Array(art.W * art.H).fill(-1);
  for (let y = 0; y < art.H; y++)
    for (let x = 0; x < art.W; x++) {
      const ch = art.grid[y][x];
      if (!ch) continue;
      let ci = colors.indexOf(ch);
      if (ci < 0) { ci = colors.length; colors.push(ch); }
      cells[y * art.W + x] = ci;
    }
  // Frozen beads: a fixed sprinkling per picture (doesn't change with the tray layout).
  const hp = new Uint8Array(art.W * art.H);
  const iceRand = rng(def.id * 7717 + 3);
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) continue;
    const ch = colors[cells[i]];
    const eligible = def.iceColors ? def.iceColors.includes(ch) : ch !== def.outline;
    hp[i] = def.ice && eligible && iceRand() < def.ice ? 2 : 1;
  }
  const base = {
    id: def.id, name: def.name, W: art.W, H: art.H, cells, hp, colors,
    docks: def.docks ?? 5,
  };
  const { layer, depth } = peelLayers(base);
  const ncols = def.columns ?? 4;

  for (let attempt = def.attempt ?? 0; attempt < 60; attempt++) {
    const noise = (def.noise ?? 1) * 0.6 ** Math.floor(attempt / 15); // can't make it? calm it down
    const rand = rng((def.seed ?? def.id * 7919) + attempt * 104729);
    const tiles = [];
    colors.forEach((_, ci) => {
      const beads = [];
      for (let i = 0; i < cells.length; i++) if (cells[i] === ci) beads.push(i);
      beads.sort((a, b) => layer[a] - layer[b]);
      const hits = beads.flatMap((i) => Array(hp[i]).fill(i)); // frozen beads take two shots
      let at = 0;
      for (const size of chunkSizes(hits.length, def.chunks ?? [10, 20], rand)) {
        tiles.push({ id: 0, color: ci, count: size, hidden: false, lock: 0, key: layer[hits[at]] + rand() * noise * depth * 0.25 });
        at += size;
      }
    });
    tiles.sort((a, b) => a.key - b.key);
    tiles.forEach((t, i) => { t.id = i; delete t.key; });

    // Deal out row by row so earlier tiles sit nearer the front.
    const columns = Array.from({ length: ncols }, () => []);
    for (let r = 0; r * ncols < tiles.length; r++) {
      const row = tiles.slice(r * ncols, r * ncols + ncols);
      const slots = shuffle([...Array(ncols).keys()], rand);
      row.forEach((t, j) => {
        columns[slots[j]].push(t.id);
        if (r > 0 && rand() < (def.mystery ?? 0)) t.hidden = true;
        // A padlock that opens a few turrets after this one would reach the front.
        if (def.locks && rand() < def.locks) t.lock = r * ncols + 2 + Math.floor(rand() * 4);
      });
    }
    const level = { ...base, tiles, columns, attempt };
    const result = solve(newState(level));
    if (result.solved) return { ...level, solution: result.moves };
  }
  throw new Error(`Could not build a solvable layout for level ${def.id} (${def.name})`);
}
