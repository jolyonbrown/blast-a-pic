// Pure game logic: no DOM, no drawing. Shared by the game and by tools/ scripts.
//
// The picture is a grid of beads. Turrets sit below it, so a bead can only be
// hit when nothing is underneath it: each column is peeled from the bottom up.
//
// Extras for trickier levels:
//  - frozen beads need two hits (the first just cracks the ice)
//  - locked turrets can't be moved until enough other turrets have been used
//  - top slots: turrets above the picture fire downwards, peeling columns from the top
//  - stones cover some beads; only hammer turrets (a grey "colour") can smash them
//  - linked turrets are chained in pairs: both must be at the front, and they go
//    out together into two free slots on the same side
//  - fog beads hide their colour until they're exposed (purely visual; the rules don't change)
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
  P: { name: 'Peach', hex: '#f6c2a4' },
  R: { name: 'Rosewood', hex: '#cf7f72' },
  M: { name: 'Mushroom', hex: '#857262' },
  D: { name: 'Chocolate', hex: '#4a2e24' },
  C: { name: 'Copper', hex: '#c27843' },
  S: { name: 'Stone', hex: '#8f9199' }, // used for stones and hammer turrets, never drawn as beads
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
  const D = level.docks, T = level.topDocks || 0;
  const s = {
    W, H, D, T,
    cells: Int8Array.from(level.cells),
    hp: Uint8Array.from(level.hp), // hits each bead still needs (2 = frozen)
    stone: Uint8Array.from(level.stone || new Uint8Array(W * H)), // 1 = covered by a stone
    bottom: new Int16Array(W).fill(-1), // row of the lowest bead in each column
    top: new Int16Array(W).fill(-1), // row of the highest bead in each column
    beadsLeft: 0,
    placed: 0, // turrets sent to a slot so far (opens padlocks)
    colPos: new Array(level.columns.length).fill(0),
    docks: new Array(D + T).fill(null), // bottom slots first, then top slots
    level,
  };
  for (let i = 0; i < W * H; i++) if (s.cells[i] >= 0) s.beadsLeft++;
  for (let x = 0; x < W; x++) {
    s.bottom[x] = lowestBead(s, x, H - 1);
    s.top[x] = highestBead(s, x, 0);
  }
  return s;
}

export function cloneState(s) {
  return {
    W: s.W, H: s.H, D: s.D, T: s.T,
    cells: Int8Array.from(s.cells),
    hp: Uint8Array.from(s.hp),
    stone: Uint8Array.from(s.stone),
    bottom: Int16Array.from(s.bottom),
    top: Int16Array.from(s.top),
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

function highestBead(s, x, fromY) {
  for (let y = fromY; y < s.H; y++) if (s.cells[y * s.W + x] >= 0) return y;
  return -1;
}

export const dockSide = (s, d) => (d < s.D ? 'bottom' : 'top');

// Turrets below the picture can only hit a bead with nothing underneath it;
// turrets above can only hit one with nothing on top of it.
export function isExposed(s, i) {
  if (s.cells[i] < 0) return false;
  const x = i % s.W, y = (i / s.W) | 0;
  return s.bottom[x] === y || (s.T > 0 && s.top[x] === y);
}

function removeBead(s, i) {
  const x = i % s.W, y = (i / s.W) | 0;
  s.cells[i] = -1;
  s.beadsLeft--;
  if (s.bottom[x] === y) s.bottom[x] = lowestBead(s, x, y - 1);
  if (s.top[x] === y) s.top[x] = highestBead(s, x, y + 1);
}

// Where a dock "is" in grid coordinates (just below or above the picture) for targeting.
function dockPoint(s, d) {
  if (d < s.D) return [((d + 0.5) / s.D) * s.W - 0.5, s.H + 1.5];
  return [((d - s.D + 0.5) / s.T) * s.W - 0.5, -2.5];
}

// Can a turret of this colour hit bead i? Hammers only hit stones; colours
// only hit uncovered beads of their own colour.
function hits(s, i, color) {
  if (color === s.level.stoneColor) return s.stone[i] === 1;
  return s.cells[i] === color && !s.stone[i];
}

export function findTarget(s, d, color) {
  const [px, py] = dockPoint(s, d);
  const { W } = s;
  // Hammers lob over the picture: they can smash a stone at either end of a
  // column, whichever row of slots they're in. Colours only reach their own end.
  const hammer = color === s.level.stoneColor;
  const ends = hammer && s.T > 0 ? [s.bottom, s.top] : [d < s.D ? s.bottom : s.top];
  let best = -1, bestDist = Infinity;
  for (const end of ends)
    for (let x = 0; x < W; x++) {
      const y = end[x];
      if (y < 0 || !hits(s, y * W + x, color)) continue;
      const dist = (x - px) ** 2 + (y - py) ** 2;
      if (dist < bestDist) { bestDist = dist; best = y * W + x; }
    }
  return best;
}

// How many beads of this colour the slots on one side could hit right now.
export function exposedOnSide(s, color, side) {
  if (color === s.level.stoneColor) return exposedCount(s, color); // hammers reach both ends
  const ends = side === 'bottom' ? s.bottom : s.top;
  let n = 0;
  for (let x = 0; x < s.W; x++) if (ends[x] >= 0 && hits(s, ends[x] * s.W + x, color)) n++;
  return n;
}

// How many beads of this colour could be hit right now (from either side).
export function exposedCount(s, color) {
  let n = 0;
  for (let x = 0; x < s.W; x++) {
    const y = s.bottom[x];
    if (y >= 0 && hits(s, y * s.W + x, color)) n++;
    const t = s.top[x];
    if (s.T > 0 && t >= 0 && t !== y && hits(s, t * s.W + x, color)) n++;
  }
  return n;
}

export function firstFreeDock(s, side = 'bottom') {
  const [from, to] = side === 'bottom' ? [0, s.D] : [s.D, s.D + s.T];
  for (let d = from; d < to; d++) if (!s.docks[d]) return d;
  return -1;
}

const anyFreeDock = (s) => s.docks.includes(null);

// The sides that currently have a free slot.
export function freeSides(s) {
  const sides = [];
  if (firstFreeDock(s, 'bottom') >= 0) sides.push('bottom');
  if (s.T > 0 && firstFreeDock(s, 'top') >= 0) sides.push('top');
  return sides;
}

export function frontTile(s, col) {
  const column = s.level.columns[col];
  return s.colPos[col] < column.length ? s.level.tiles[column[s.colPos[col]]] : null;
}

// How many more turrets must be used before this one's padlock opens.
export function lockLeft(s, tile) {
  return Math.max(0, (tile.lock || 0) - s.placed);
}

// A linked turret's partner, if it's also at the front of its column.
export function partnerAtFront(s, tile) {
  if (tile.link == null) return null;
  const loc = s.level.tileLoc[tile.link];
  return s.colPos[loc.c] === loc.k ? s.level.tiles[tile.link] : null;
}

// Can the front turret of this column be sent somewhere right now (ignoring slots)?
export function canPlace(s, col) {
  const tile = frontTile(s, col);
  if (!tile || lockLeft(s, tile) > 0) return false;
  if (tile.link == null) return true;
  const partner = partnerAtFront(s, tile);
  return !!partner && lockLeft(s, partner) === 0;
}

const freeCount = (s, side) => {
  const [from, to] = side === 'bottom' ? [0, s.D] : [s.D, s.D + s.T];
  let n = 0;
  for (let d = from; d < to; d++) if (!s.docks[d]) n++;
  return n;
};

// The sides this column's front turret (and its partner, if linked) could go to.
export function sidesFor(s, col) {
  if (!canPlace(s, col)) return [];
  const need = frontTile(s, col).link == null ? 1 : 2;
  return freeSides(s).filter((side) => freeCount(s, side) >= need);
}

// Move the front turret of a column into a dock. Returns the tile, or null.
// A linked partner goes into the next free slot on the same side.
export function place(s, col, dock = firstFreeDock(s), arriving = false) {
  const tile = frontTile(s, col);
  if (!tile || !canPlace(s, col) || dock < 0 || s.docks[dock]) return null;
  const side = dockSide(s, dock);
  if (tile.link != null && freeCount(s, side) < 2) return null;
  s.colPos[col]++;
  s.placed++;
  s.docks[dock] = { tile: tile.id, color: tile.color, count: tile.count, arriving };
  if (tile.link != null) {
    const partner = s.level.tiles[tile.link];
    const loc = s.level.tileLoc[partner.id];
    s.colPos[loc.c]++;
    s.placed++;
    s.docks[firstFreeDock(s, side)] = { tile: partner.id, color: partner.color, count: partner.count, arriving };
  }
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
    let popped = true, smashed = false;
    if (dock.color === s.level.stoneColor) { s.stone[t] = 0; popped = false; smashed = true; } // smash the stone
    else if (s.hp[t] > 1) { s.hp[t]--; popped = false; } // crack the ice
    else removeBead(s, t);
    dock.count--;
    const done = dock.count === 0;
    shots.push({ dock: d, cell: t, color: dock.color, tile: dock.tile, done, popped, smashed });
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
  if (!anyFreeDock(s)) return true;
  return !s.level.columns.some((_, c) => sidesFor(s, c).length > 0);
}

export function stuckReason(s) {
  return anyFreeDock(s) ? 'locked' : 'full';
}

export function trayEmpty(s) {
  return s.level.columns.every((c, i) => s.colPos[i] >= c.length);
}

// ---------------------------------------------------------------- solver

function hashBoard(s) {
  let h = 2166136261;
  for (let i = 0; i < s.cells.length; i++) h = Math.imul(h ^ (s.cells[i] + 2 + s.hp[i] * 64 + s.stone[i] * 256), 16777619);
  return h >>> 0;
}

// Depth-first search over "send a front turret to a side, then wait until things settle".
// Moves are { c: column, side: 'bottom' | 'top' }.
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
    const sides = freeSides(s);
    if (!sides.length) return false;
    const cands = [];
    for (const side of sides) {
      const sigs = new Set();
      for (let c = 0; c < s.level.columns.length; c++) {
        const tile = frontTile(s, c);
        if (!tile || !sidesFor(s, c).includes(side)) continue;
        const sig = tile.link == null ? tile.color + ':' + tile.count : 'link' + Math.min(tile.id, tile.link);
        if (sigs.has(sig)) continue;
        sigs.add(sig);
        let score = exposedOnSide(s, tile.color, side) - tile.count * 0.01;
        if (tile.link != null) score += exposedOnSide(s, s.level.tiles[tile.link].color, side);
        cands.push({ c, side, score });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    for (const { c, side } of cands) {
      const s2 = cloneState(s);
      place(s2, c, firstFreeDock(s2, side));
      settle(s2);
      if (isStuck(s2)) continue;
      moves.push({ c, side });
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

// How deep each bead sits in its column, counted from the bottom (or from
// whichever end is nearer, when there are slots above the picture too).
function peelLayers(level) {
  const { W, H, cells } = level;
  const layer = new Int16Array(W * H).fill(-1);
  let depth = 0;
  for (let x = 0; x < W; x++) {
    let k = 0;
    for (let y = H - 1; y >= 0; y--) if (cells[y * W + x] >= 0) layer[y * W + x] = k++;
    if (level.topDocks) {
      let t = 0;
      for (let y = 0; y < H; y++) if (cells[y * W + x] >= 0) { layer[y * W + x] = Math.min(layer[y * W + x], t); t++; }
      k = Math.ceil(k / 2);
    }
    depth = Math.max(depth, k);
  }
  return { layer, depth };
}

function chunkSizes(n, options, rand, minRest = 5) {
  const sizes = [];
  let left = n;
  while (left > 0) {
    let size = Math.min(left, options[Math.floor(rand() * options.length)]);
    if (left - size < minRest) size = left;
    sizes.push(size);
    left -= size;
  }
  return sizes;
}

// Just the picture: a grid of colour indexes plus the colours used. Cheap,
// so it's what menu thumbnails use.
export function pictureOf(def) {
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
  return { W: art.W, H: art.H, cells, colors };
}

// Build a playable level from its definition. Tries seeds until the solver
// confirms it can be beaten.
export function buildLevel(def) {
  const art = pictureOf(def);
  const { colors, cells } = art;
  // Frozen beads: a fixed sprinkling per picture (doesn't change with the tray layout).
  const hp = new Uint8Array(art.W * art.H);
  const iceRand = rng(def.id * 7717 + 3);
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) continue;
    const ch = colors[cells[i]];
    const eligible = def.iceColors ? def.iceColors.includes(ch) : ch !== def.outline;
    hp[i] = def.ice && eligible && iceRand() < def.ice ? 2 : 1;
  }
  // Stones: also fixed per picture, never on frozen beads or the outline, and
  // only near the ends of columns (stoneDepth) so hammers clear them early
  // instead of sitting in a slot for ages waiting for buried ones.
  const stone = new Uint8Array(art.W * art.H);
  let stoneColor = -1;
  if (def.stones) {
    const stoneRand = rng(def.id * 5113 + 7);
    const { layer: depthOf } = peelLayers({ W: art.W, H: art.H, cells, topDocks: def.topDocks ?? 0 });
    const maxDepth = def.stoneDepth ?? Infinity;
    for (let i = 0; i < cells.length; i++)
      if (cells[i] >= 0 && hp[i] === 1 && colors[cells[i]] !== def.outline && depthOf[i] <= maxDepth && stoneRand() < def.stones) stone[i] = 1;
    if (stone.includes(1)) { stoneColor = colors.length; colors.push('S'); }
  }
  // Fog: which beads keep their colour secret until they're exposed.
  const fog = new Uint8Array(art.W * art.H);
  if (def.fog) {
    const fogRand = rng(def.id * 3331 + 11);
    for (let i = 0; i < cells.length; i++) if (cells[i] >= 0 && fogRand() < def.fog) fog[i] = 1;
  }
  const base = {
    id: def.id, name: def.name, W: art.W, H: art.H, cells, hp, colors, stone, stoneColor, fog,
    docks: def.docks ?? 5,
    topDocks: def.topDocks ?? 0,
  };
  const { layer, depth } = peelLayers(base);
  const ncols = def.columns ?? 4;

  for (let attempt = def.attempt ?? 0; attempt < 60; attempt++) {
    const noise = (def.noise ?? 1) * 0.6 ** Math.floor(attempt / 15); // can't make it? calm it down
    const rand = rng((def.seed ?? def.id * 7919) + attempt * 104729);
    const tiles = [];
    colors.forEach((_, ci) => {
      const hammer = ci === stoneColor;
      const beads = [];
      for (let i = 0; i < cells.length; i++) if (hammer ? stone[i] : cells[i] === ci) beads.push(i);
      beads.sort((a, b) => layer[a] - layer[b]);
      // frozen beads take two shots; a hammer takes one swing per stone
      const hits = hammer ? beads : beads.flatMap((i) => Array(hp[i]).fill(i));
      let at = 0;
      const sizes = hammer ? chunkSizes(hits.length, def.hammerChunks ?? [2, 3, 4], rand, 1) : chunkSizes(hits.length, def.chunks ?? [10, 20], rand);
      for (const size of sizes) {
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
      // Chain some neighbouring turrets in this row together.
      if (def.links) {
        for (let c = 0; c + 1 < ncols; c++) {
          const a = tiles[columns[c][r]], b = tiles[columns[c + 1][r]];
          if (!a || !b || a.link != null || b.link != null || rand() >= def.links) continue;
          a.link = b.id;
          b.link = a.id;
          a.lock = b.lock = Math.max(a.lock, b.lock); // a pair opens together
          c++;
        }
      }
    }
    const level = { ...base, tiles, columns, attempt };
    level.tileLoc = [];
    columns.forEach((col, c) => col.forEach((id, k) => (level.tileLoc[id] = { c, k })));
    const result = solve(newState(level));
    if (result.solved) return { ...level, solution: result.moves };
  }
  throw new Error(`Could not build a solvable layout for level ${def.id} (${def.name})`);
}
