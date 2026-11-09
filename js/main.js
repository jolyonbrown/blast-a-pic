import { LEVELS } from './levels.js';
import * as engine from './engine.js';
import { PALETTE, buildLevel, pictureOf, newState, cloneState, place, tick, isStuck, stuckReason, canAnyFire, firstFreeDock, freeSides, sidesFor, dockSide, frontTile, findTarget, lockLeft } from './engine.js';
import { beadSprite, iceSprite, stoneSprite, drawTurret, drawMystery, drawLock, drawPad, roundRect, clearSpriteCache } from './render.js';
import { sfx, unlockAudio, setMuted } from './audio.js';

// ================================================================ save data

const SAVE_KEY = 'blast-a-pic:v1';
const save = { done: [], speed: 1, muted: false, seenHelp: false, tips: [] };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch { /* private mode etc. */ }
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
setMuted(save.muted);

const isDone = (id) => save.done.includes(id);
// A level opens once the previous (non-secret) one is done.
function isUnlocked(i) {
  if (i === 0 || LEVELS[i].secret || isDone(LEVELS[i].id)) return true;
  const prev = LEVELS.slice(0, i).reverse().find((l) => !l.secret);
  return !prev || isDone(prev.id);
}
const SECRET = LEVELS.find((l) => l.secret);

// ================================================================ levels

const builtLevels = new Map();
function getLevel(id) {
  if (!builtLevels.has(id)) {
    const def = LEVELS.find((l) => l.id === id);
    const level = buildLevel(def);
    level.hex = level.colors.map((k) => PALETTE[k].hex);
    builtLevels.set(id, level);
  }
  return builtLevels.get(id);
}

// ================================================================ dom

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const hud = document.querySelector('.hud');
const speedBtn = $('btn-speed');
const undoBtn = $('btn-undo');

// ================================================================ game state

const TICK = 0.11; // seconds between volleys at 1x speed
const SHOT_TIME = 0.26;
const ARRIVE_TIME = 0.26;

let game = null;
let L = null; // layout
let dpr = 1;

function startLevel(id) {
  const level = getLevel(id);
  game = {
    level,
    state: newState(level),
    undo: [],
    shots: [],
    pending: new Map(), // cell -> colour of beads hit but not yet popped
    pendingIce: new Set(), // frozen beads whose ice hasn't visibly cracked yet
    pendingStone: new Set(), // stones hit by a hammer that hasn't landed yet
    choosing: -1, // column whose turret is waiting for you to pick a slot
    locked: new Set(), // padlocked turrets (to celebrate when they open)
    particles: [],
    vis: new Map(),
    departing: [],
    arrivals: [],
    tickAcc: 0,
    phase: 'play',
    stuckT: 0,
    winT: 0,
    shake: { col: -1, t: 0 },
    fronts: [],
    time: 0,
  };
  $('title').textContent = `${level.id}. ${level.name}`;
  showScreen('play');
  hideDialog();
  layout();
  // Turrets bounce in from below.
  for (const t of level.tiles) {
    const p = trayPos(t.id);
    if (p) game.vis.set(t.id, newVis(p.x, p.y + 300 + Math.random() * 120, 0.6));
  }
  game.fronts = level.columns.map((_, c) => frontTile(game.state, c)?.id ?? -1);
  trackLocks();
  updateHud();
  const def = LEVELS.find((l) => l.id === id);
  if (!save.seenHelp) {
    save.seenHelp = true;
    persist();
    showHelp();
  } else if (def.tip && !save.tips.includes(id)) {
    save.tips.push(id);
    persist();
    showDialog({ title: def.tip.title, text: def.tip.text, buttons: [{ label: 'Got it', primary: true, onClick: hideDialog }] });
  }
}

function trackLocks() {
  game.locked = new Set(game.level.tiles.filter((t) => lockLeft(game.state, t) > 0).map((t) => t.id));
}

function newVis(x, y, s = 1) {
  return { x, y, s, a: 1, aim: -Math.PI / 2, recoil: 0, blink: 0, nextBlink: 1 + Math.random() * 4, pop: 0 };
}

function snapshot() {
  return cloneState(game.state);
}

function doUndo() {
  if (!game || !game.undo.length) return;
  game.state = game.undo.pop();
  for (const d of game.state.docks) if (d) d.arriving = false;
  game.arrivals = [];
  game.shots = [];
  game.pending.clear();
  game.pendingIce.clear();
  game.pendingStone.clear();
  game.choosing = -1;
  trackLocks();
  game.departing = [];
  game.phase = 'play';
  game.stuckT = 0;
  game.fronts = game.level.columns.map((_, c) => frontTile(game.state, c)?.id ?? -1);
  hideDialog();
  sfx.undo();
  updateHud();
}

function restart() {
  if (game) startLevel(game.level.id);
}

// Send the front turret of column c to a slot. With slots above and below the
// picture both free, the first tap picks the turret up and a second tap on a
// glowing slot puts it down (side/dock can be given directly, e.g. by tests).
function tapColumn(c, side, dock) {
  if (!game || game.phase !== 'play' || !(c >= 0 && c < game.level.columns.length)) return false;
  const st = game.state;
  const tile = frontTile(st, c);
  if (!tile) return false;
  const sides = sidesFor(st, c); // empty if locked, or linked and its partner isn't ready
  if (!sides.length || (side && !sides.includes(side))) {
    game.choosing = -1;
    sfx.bonk();
    game.shake = { col: c, t: 0.4 };
    return false;
  }
  if (!side) {
    if (sides.length > 1) {
      game.choosing = game.choosing === c ? -1 : c; // tap again to put it back
      sfx.select();
      return false;
    }
    side = sides[0];
  }
  game.choosing = -1;
  const d = dock ?? firstFreeDock(st, side);
  if (st.docks[d] || dockSide(st, d) !== side) return false;
  game.undo.push(snapshot());
  place(st, c, d, true);
  // a linked partner travels too
  st.docks.forEach((dk, i) => {
    if (!dk || !dk.arriving || (dk.tile !== tile.id && dk.tile !== tile.link)) return;
    game.arrivals.push({ dock: i, tile: dk.tile, t: ARRIVE_TIME });
    const v = game.vis.get(dk.tile);
    if (v) v.pop = 1;
  });
  sfx.place();
  updateHud();
  return true;
}

function updateHud() {
  undoBtn.disabled = !game || game.undo.length === 0;
  speedBtn.textContent = `${save.speed}×`;
}

// ================================================================ layout

function layout() {
  if (!game) return;
  const w = window.innerWidth, h = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  clearSpriteCache();

  const lvl = game.level;
  const D = lvl.docks, T = lvl.topDocks || 0, C = lvl.columns.length;
  const top = hud.getBoundingClientRect().bottom + 12;
  const pad = 16, bottomPad = 22;
  const portrait = h >= w * 1.05;
  let boardBox, dockBox, topBox = null, trayBox, u;

  if (portrait) {
    const avail = h - top - bottomPad;
    u = Math.min(110, ((w - 2 * pad) / Math.max(D, T)) * 0.9, avail * (T ? 0.1 : 0.13));
    // Slots above the picture take their space from the picture's share.
    const topH = T ? u + 10 : 0;
    if (T) topBox = { x: pad, y: top, w: w - 2 * pad, h: u };
    const boardH = avail * 0.5 - topH;
    boardBox = { x: pad, y: top + topH, w: w - 2 * pad, h: boardH };
    dockBox = { x: pad, y: boardBox.y + boardH + 14, w: w - 2 * pad, h: u };
    const ty = dockBox.y + u + 18;
    trayBox = { x: pad, y: ty, w: w - 2 * pad, h: h - ty - bottomPad };
  } else {
    // Landscape: picture with its slots underneath (and above) on the left, tray on the right.
    const leftW = w * 0.6;
    u = Math.min(100, ((leftW - 2 * pad) / Math.max(D, T)) * 0.86, h * (T ? 0.11 : 0.14));
    const topH = T ? u + 10 : 0;
    if (T) topBox = { x: pad, y: top, w: leftW - 2 * pad, h: u };
    boardBox = { x: pad, y: top + topH, w: leftW - 2 * pad, h: h - top - topH - bottomPad - u - 18 };
    dockBox = { x: pad, y: boardBox.y + boardBox.h + 12, w: leftW - 2 * pad, h: u };
    const rx = leftW + pad, rw = w - leftW - 2 * pad;
    trayBox = { x: rx, y: top + 8, w: rw, h: h - top - 8 - bottomPad };
  }

  const fp = 0.8; // frame padding in cells
  const cell = Math.min(boardBox.w / (lvl.W + fp * 2), boardBox.h / (lvl.H + fp * 2), 48);
  const bw = cell * (lvl.W + fp * 2), bh = cell * (lvl.H + fp * 2);
  const bx = boardBox.x + (boardBox.w - bw) / 2;
  const by = boardBox.y + (boardBox.h - bh) / 2;
  const t = Math.min(portrait ? u * 0.96 : 100, (trayBox.w / C) * 0.9);
  const rowH = t * 1.06;

  L = {
    board: { x: bx, y: by, w: bw, h: bh, cell, ox: bx + fp * cell, oy: by + fp * cell },
    u,
    // bottom slots first, then the ones above the picture (same order as state.docks)
    docks: [
      ...Array.from({ length: D }, (_, i) => ({ x: dockBox.x + (dockBox.w * (i + 0.5)) / D, y: dockBox.y + u / 2 })),
      ...Array.from({ length: T }, (_, i) => ({ x: topBox.x + (topBox.w * (i + 0.5)) / T, y: topBox.y + u / 2 })),
    ],
    t,
    rowH,
    rows: Math.max(1, Math.floor((trayBox.h - t * 0.2) / rowH)),
    cols: Array.from({ length: C }, (_, i) => ({ x: trayBox.x + (trayBox.w * (i + 0.5)) / C, y: trayBox.y + t / 2 })),
  };
  L.boardBg = renderBoardBackground();
}

function renderBoardBackground() {
  const { board } = L;
  const c = document.createElement('canvas');
  c.width = Math.ceil(board.w * dpr) + 20;
  c.height = Math.ceil(board.h * dpr) + 20;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(4, 2);
  g.fillStyle = 'rgba(140,95,50,0.18)';
  roundRect(g, 0, 5, board.w, board.h, board.cell * 0.9);
  g.fill();
  g.fillStyle = '#fbf3e8';
  roundRect(g, 0, 0, board.w, board.h, board.cell * 0.9);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.stroke();
  // pegs
  g.fillStyle = 'rgba(175,140,105,0.28)';
  const { cell } = board;
  const ox = board.ox - board.x, oy = board.oy - board.y;
  for (let y = 0; y < game.level.H; y++)
    for (let x = 0; x < game.level.W; x++) {
      g.beginPath();
      g.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.11, 0, Math.PI * 2);
      g.fill();
    }
  return c;
}

function beadCenter(i) {
  const W = game.level.W;
  return { x: L.board.ox + ((i % W) + 0.5) * L.board.cell, y: L.board.oy + (((i / W) | 0) + 0.5) * L.board.cell };
}

function trayPos(id) {
  const loc = game.level.tileLoc[id];
  const r = loc.k - game.state.colPos[loc.c];
  if (r < 0) return null;
  const col = L.cols[loc.c];
  return { x: col.x, y: col.y + r * L.rowH, row: r };
}

// ================================================================ simulation

function update(dt) {
  const g = game;
  g.time += dt;
  const speed = save.speed;

  // Turrets landing in their docks.
  for (const a of g.arrivals) a.t -= dt * Math.max(1, speed * 0.75);
  for (const a of g.arrivals.filter((a) => a.t <= 0)) {
    const d = g.state.docks[a.dock];
    if (d && d.tile === a.tile) d.arriving = false;
  }
  g.arrivals = g.arrivals.filter((a) => a.t > 0);

  // Volleys.
  if (g.phase === 'play') {
    g.tickAcc += dt * speed;
    let guard = 0;
    while (g.tickAcc >= TICK && guard++ < 5) {
      g.tickAcc -= TICK;
      fire(tick(g.state));
    }
    if (g.tickAcc > TICK) g.tickAcc = 0;
  }

  // Projectiles.
  for (const s of g.shots) {
    if (s.delay > 0) { s.delay -= dt; continue; }
    s.t += (dt * Math.max(1, speed * 0.8)) / SHOT_TIME;
    if (s.t >= 1) {
      if (s.popped) {
        g.pending.delete(s.cell);
        burst(s.x1, s.y1, s.hex, 6);
        sfx.pop();
      } else if (s.smashed) {
        g.pendingStone.delete(s.cell);
        burst(s.x1, s.y1, '#8f9199', 9);
        sfx.smash();
      } else {
        g.pendingIce.delete(s.cell);
        burst(s.x1, s.y1, '#dff4ff', 7);
        sfx.crack();
      }
    }
  }
  g.shots = g.shots.filter((s) => s.t < 1);

  // Columns revealing their next turret.
  g.level.columns.forEach((_, c) => {
    const f = frontTile(g.state, c);
    const id = f ? f.id : -1;
    if (id !== g.fronts[c]) {
      g.fronts[c] = id;
      if (f && f.hidden) {
        const p = trayPos(id);
        if (p) for (let i = 0; i < 10; i++) spark(p.x, p.y, g.level.hex[f.color]);
        sfx.sparkle();
      }
    }
  });

  // Padlocks opening.
  for (const id of [...g.locked]) {
    if (lockLeft(g.state, g.level.tiles[id]) > 0) continue;
    g.locked.delete(id);
    const v = g.vis.get(id);
    if (v && v.a > 0.3) {
      for (let i = 0; i < 12; i++) spark(v.x, v.y, '#f4b53f');
      sfx.unlock();
    }
  }

  // Out of moves?
  if (g.phase === 'play') {
    if (!g.shots.length && !g.arrivals.length && isStuck(g.state)) {
      g.stuckT += dt;
      if (g.stuckT > 0.7) showStuck();
    } else g.stuckT = 0;
    if (g.state.beadsLeft === 0 && !g.shots.length) startWin();
  }

  if (g.phase === 'winning') {
    const prev = g.winT;
    g.winT += dt;
    for (const b of g.rebuild) {
      if (b.at > prev && b.at <= g.winT) {
        if (Math.random() < 0.25) sfx.sparkle();
        if (Math.random() < 0.15) { const p = beadCenter(b.i); spark(p.x, p.y, '#ffffff'); }
      }
    }
    if (g.winT > g.rebuildEnd + 0.5) { g.phase = 'won'; showWin(); }
  }

  if (g.shake.t > 0) g.shake.t -= dt;

  // Particles.
  for (const p of g.particles) {
    p.life -= dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);

  for (const d of g.departing) d.t += dt;
  g.departing = g.departing.filter((d) => d.t < 0.5);

  updateVisuals(dt);
}

function fire(shots) {
  const g = game;
  shots.forEach((s, n) => {
    const v = g.vis.get(s.tile);
    const to = beadCenter(s.cell);
    const from = v ? { x: v.x, y: v.y - L.u * 0.08 } : L.docks[s.dock];
    const aim = Math.atan2(to.y - from.y, to.x - from.x);
    const reach = L.u * 0.44;
    const shot = {
      x0: from.x + Math.cos(aim) * reach, y0: from.y + Math.sin(aim) * reach,
      x1: to.x, y1: to.y, t: 0, delay: n * 0.012,
      cell: s.cell, hex: g.level.hex[s.color], popped: s.popped, smashed: s.smashed,
    };
    g.shots.push(shot);
    if (s.popped) g.pending.set(s.cell, s.color);
    else if (s.smashed) g.pendingStone.add(s.cell);
    else g.pendingIce.add(s.cell);
    if (v) { v.aim = aim; v.recoil = 1; }
    if (s.done) {
      g.departing.push({ tile: s.tile, t: -0.18, x: v ? v.x : from.x, y: v ? v.y : from.y, aim });
      g.vis.delete(s.tile);
      setTimeout(() => sfx.done(), 160);
    }
  });
  if (shots.length) sfx.shoot();
}

function startWin() {
  const g = game;
  g.phase = 'winning';
  g.winT = 0;
  if (!isDone(g.level.id)) { save.done.push(g.level.id); persist(); }
  const { W, H, cells } = g.level;
  g.rebuild = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) continue;
    const x = i % W, y = (i / W) | 0;
    g.rebuild.push({ i, at: 0.35 + ((H - 1 - y) / H) * 1.1 + (x / W) * 0.25 + Math.random() * 0.08 });
  }
  g.rebuildEnd = Math.max(...g.rebuild.map((b) => b.at)) + 0.3;
  setTimeout(() => sfx.win(), 200);
}

function updateVisuals(dt) {
  const g = game;
  const k = 1 - Math.exp(-dt * 14);
  const docked = new Map();
  g.state.docks.forEach((d, i) => d && docked.set(d.tile, i));
  for (const t of g.level.tiles) {
    let target;
    if (docked.has(t.id)) {
      const p = L.docks[docked.get(t.id)];
      target = { x: p.x, y: p.y, s: 1, a: 1 };
    } else {
      const p = trayPos(t.id);
      if (!p) { g.vis.delete(t.id); continue; }
      const visible = p.row < L.rows;
      target = { x: p.x, y: p.y, s: p.row === 0 ? 1 : 0.88, a: visible ? 1 : 0 };
      if (p.row === 0 && g.choosing === g.level.tileLoc[t.id].c) {
        target.y -= L.t * 0.22 + Math.sin(g.time * 6) * L.t * 0.04;
        target.s = 1.1;
      }
      if (g.shake.col === g.level.tileLoc[t.id].c && g.shake.t > 0 && p.row === 0)
        target.x += Math.sin(g.shake.t * 50) * 6 * (g.shake.t / 0.4);
    }
    let v = g.vis.get(t.id);
    if (!v) { v = newVis(target.x, target.y, 0); g.vis.set(t.id, v); }
    v.x += (target.x - v.x) * k;
    v.y += (target.y - v.y) * k;
    v.s += (target.s - v.s) * k;
    v.a += (target.a - v.a) * k;
    v.recoil = Math.max(0, v.recoil - dt * 6);
    v.pop = Math.max(0, v.pop - dt * 3);
    if (!docked.has(t.id)) v.aim += (-Math.PI / 2 - v.aim) * k * 0.5;
    else if (dockSide(g.state, docked.get(t.id)) === 'top' && v.recoil === 0) v.aim += (Math.PI / 2 - v.aim) * k * 0.25;
    v.nextBlink -= dt;
    if (v.nextBlink < 0) { v.blink = 1; v.nextBlink = 2 + Math.random() * 5; }
    v.blink = Math.max(0, v.blink - dt * 7);
  }
}

// ================================================================ particles

function burst(x, y, hex, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 160;
    game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 700,
      life: 0.35 + Math.random() * 0.2, max: 0.55, r: L.board.cell * (0.1 + Math.random() * 0.12),
      hex, rot: 0, vr: 0, kind: 'dot',
    });
  }
}

function spark(x, y, hex) {
  const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
  game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0.6, max: 0.6, r: 3 + Math.random() * 3, hex, rot: 0, vr: 0, kind: 'star' });
}

function confetti() {
  const colours = ['#ff8a3d', '#ffd23f', '#5ec97f', '#3d7ff0', '#ff9fcb', '#9a6be0', '#e8434d'];
  const w = window.innerWidth;
  for (let i = 0; i < 120; i++) {
    game.particles.push({
      x: Math.random() * w, y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 160, g: 60,
      life: 3 + Math.random(), max: 4, r: 5 + Math.random() * 5,
      hex: colours[i % colours.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, kind: 'confetti',
    });
  }
}

// ================================================================ drawing

function draw() {
  const g = game;
  const w = window.innerWidth, h = window.innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // board
  const { board } = L;
  ctx.drawImage(L.boardBg, board.x - 4, board.y - 2, L.boardBg.width / dpr, L.boardBg.height / dpr);
  const cell = board.cell;
  const sprites = g.level.hex.map((hex) => beadSprite(hex, cell * dpr));
  const { W } = g.level;
  if (g.phase === 'winning' || g.phase === 'won') {
    for (const b of g.rebuild) {
      const age = g.winT - b.at;
      if (age < 0) continue;
      const s = age < 0.25 ? easeOutBack(age / 0.25) : 1;
      const p = beadCenter(b.i);
      const sz = cell * s;
      ctx.drawImage(sprites[g.level.cells[b.i]], p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
  } else {
    const cells = g.state.cells;
    for (let i = 0; i < cells.length; i++) {
      let c = cells[i];
      if (c < 0) { c = g.pending.get(i); if (c === undefined) continue; }
      ctx.drawImage(sprites[c], board.ox + (i % W) * cell, board.oy + ((i / W) | 0) * cell, cell, cell);
    }
    const ice = iceSprite(cell * dpr);
    const hp = g.state.hp;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] >= 0 && (hp[i] > 1 || g.pendingIce.has(i)))
        ctx.drawImage(ice, board.ox + (i % W) * cell, board.oy + ((i / W) | 0) * cell, cell, cell);
    }
    const rock = stoneSprite(cell * dpr);
    const stone = g.state.stone;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] >= 0 && (stone[i] || g.pendingStone.has(i)))
        ctx.drawImage(rock, board.ox + (i % W) * cell, board.oy + ((i / W) | 0) * cell, cell, cell);
    }
  }

  // pads
  for (const d of L.docks) drawPad(ctx, d.x, d.y, L.u, 'dock');
  // While a turret is picked up, the free slots glow to show where it can go.
  if (g.choosing >= 0) {
    const glow = 0.55 + Math.sin(g.time * 6) * 0.35;
    const ok = sidesFor(g.state, g.choosing);
    g.state.docks.forEach((d, i) => {
      if (d || !ok.includes(dockSide(g.state, i))) return;
      const p = L.docks[i], sz = L.u * 0.94;
      ctx.save();
      ctx.strokeStyle = `rgba(123,92,196,${glow})`;
      ctx.lineWidth = 4;
      roundRect(ctx, p.x - sz / 2, p.y - sz / 2, sz, sz, sz * 0.2);
      ctx.stroke();
      ctx.restore();
    });
  }
  for (const c of L.cols) drawPad(ctx, c.x, c.y, L.t, 'tray');

  // tray turrets, back rows first
  const docked = new Set(g.state.docks.filter(Boolean).map((d) => d.tile));
  const trayItems = [];
  for (const t of g.level.tiles) {
    if (docked.has(t.id)) continue;
    const v = g.vis.get(t.id);
    const p = trayPos(t.id);
    if (!v || !p || v.a < 0.02) continue;
    trayItems.push({ t, v, row: p.row });
  }
  trayItems.sort((a, b) => b.row - a.row);
  // chains between linked turrets
  const drawn = new Set();
  for (const { t, v } of trayItems) {
    if (t.link == null || drawn.has(t.id)) continue;
    const w = g.vis.get(t.link);
    if (!w || docked.has(t.link) || Math.min(v.a, w.a) < 0.05) continue;
    drawn.add(t.link);
    drawChain(v.x, v.y - L.t * 0.05, w.x, w.y - L.t * 0.05, Math.min(v.a, w.a));
  }
  for (const { t, v, row } of trayItems) {
    ctx.save();
    ctx.globalAlpha = v.a * (row === 0 ? 1 : 0.62);
    const u = L.t * v.s;
    const locked = lockLeft(g.state, t);
    if (locked) ctx.globalAlpha *= 0.8;
    if (t.hidden && row > 0) drawMystery(ctx, v.x, v.y, u);
    else drawTurret(ctx, v.x, v.y, u, g.level.hex[t.color], { count: t.count, blink: v.blink, aim: v.aim, hammer: t.color === g.level.stoneColor });
    ctx.restore();
    if (locked && v.a > 0.02) {
      ctx.save();
      ctx.globalAlpha = v.a * (row === 0 ? 1 : 0.75);
      drawLock(ctx, v.x + u * 0.3, v.y - u * 0.26, u * 0.42, locked);
      ctx.restore();
    }
  }
  // "+3 more" under columns that go deeper than we can show
  ctx.fillStyle = 'rgba(74,63,85,0.55)';
  ctx.font = `800 ${Math.round(L.t * 0.2)}px ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  g.level.columns.forEach((col, c) => {
    const left = col.length - g.state.colPos[c] - L.rows;
    if (left > 0) ctx.fillText(`+${left}`, L.cols[c].x, L.cols[c].y + (L.rows - 0.5) * L.rowH + L.t * 0.08);
  });

  // docked turrets
  g.state.docks.forEach((d, i) => {
    if (!d) return;
    const v = g.vis.get(d.tile);
    if (!v) return;
    const u = L.u * v.s * (1 + v.pop * 0.12);
    drawTurret(ctx, v.x, v.y, u, g.level.hex[d.color], { count: d.count, aim: v.aim, recoil: v.recoil, blink: v.blink, hammer: d.color === g.level.stoneColor });
    const top = dockSide(g.state, i) === 'top';
    if (!d.arriving && g.phase === 'play' && findTarget(g.state, i, d.color) < 0 && !g.shots.length) drawWaiting(v.x, v.y + (top ? 0.55 : -0.55) * u, u);
  });

  // departing turrets hop off
  for (const d of g.departing) {
    const t = Math.max(0, d.t);
    const s = 1 + Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.25 - t * 1.6;
    if (s <= 0.05) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t * 2);
    const tile = g.level.tiles[d.tile];
    drawTurret(ctx, d.x, d.y - t * 60, L.u * s, g.level.hex[tile.color], { aim: d.aim, count: 0, hammer: tile.color === g.level.stoneColor });
    ctx.restore();
  }

  // projectiles
  for (const s of g.shots) {
    if (s.delay > 0) continue;
    const t = s.t;
    const arc = Math.sin(t * Math.PI) * cell * 1.2;
    const x = s.x0 + (s.x1 - s.x0) * t, y = s.y0 + (s.y1 - s.y0) * t - arc;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, cell * 0.28), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.hex;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, cell * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }

  // particles
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
    ctx.fillStyle = p.hex;
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    } else if (p.kind === 'star') {
      drawStar(p.x, p.y, p.r);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawChain(x1, y1, x2, y2, alpha) {
  const n = Math.max(3, Math.round(Math.hypot(x2 - x1, y2 - y1) / (L.t * 0.12)));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(2, L.t * 0.045);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * L.t * 0.12;
    ctx.strokeStyle = i % 2 ? '#8d8f97' : '#b9bbc3';
    ctx.beginPath();
    ctx.ellipse(x, y, L.t * 0.07, L.t * 0.045, i % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaiting(x, y, u) {
  const r = u * 0.05;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, x - u * 0.2, y - u * 0.09, u * 0.4, u * 0.18, u * 0.09);
  ctx.fill();
  ctx.fillStyle = '#8a7a8f';
  const phase = (game.time * 3) % 3;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = Math.floor(phase) === i ? 1 : 0.4;
    ctx.beginPath();
    ctx.arc(x + (i - 1) * u * 0.11, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStar(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.4 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ================================================================ loop

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game && !$('play').classList.contains('hidden')) {
    update(dt);
    draw();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ================================================================ input

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (!game || game.phase !== 'play') return;
  const x = e.clientX, y = e.clientY;
  if (game.choosing >= 0) {
    for (let d = 0; d < L.docks.length; d++) {
      const p = L.docks[d];
      if (!game.state.docks[d] && sidesFor(game.state, game.choosing).includes(dockSide(game.state, d))
        && Math.abs(x - p.x) < L.u * 0.5 && Math.abs(y - p.y) < L.u * 0.5) {
        tapColumn(game.choosing, dockSide(game.state, d), d);
        return;
      }
    }
  }
  for (let c = 0; c < L.cols.length; c++) {
    const col = L.cols[c];
    const half = L.t * 0.5;
    if (Math.abs(x - col.x) < half && y > col.y - half && y < col.y + half) {
      tapColumn(c);
      return;
    }
    // tapping a turret further back gives a gentle "not yet" wiggle
    if (Math.abs(x - col.x) < half && y >= col.y + half && y < col.y + L.rows * L.rowH) {
      sfx.bonk();
      game.shake = { col: c, t: 0.3 };
      return;
    }
  }
  game.choosing = -1; // tapped somewhere else: put the turret back
});

$('btn-home').addEventListener('click', () => { unlockAudio(); showMenu(); });
undoBtn.addEventListener('click', () => { unlockAudio(); doUndo(); });
$('btn-restart').addEventListener('click', () => { unlockAudio(); restart(); });
speedBtn.addEventListener('click', () => {
  unlockAudio();
  save.speed = save.speed >= 3 ? 1 : save.speed + 1;
  persist();
  updateHud();
});

window.addEventListener('resize', () => layout());
// iOS sometimes reports the old size straight after rotating.
window.addEventListener('orientationchange', () => setTimeout(layout, 250));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ================================================================ screens & dialogs

function showScreen(name) {
  for (const id of ['menu', 'play', 'about']) $(id).classList.toggle('hidden', name !== id);
}

function showAbout() {
  hideDialog();
  const done = isDone(SECRET.id);
  showScreen('about');
  $('secret-caption').textContent = done ? 'You blasted the maker! Thank you for playing.' : 'Psst… tap me, if you dare.';
  requestAnimationFrame(() => drawThumb($('secret-art'), SECRET.id, done ? 'colour' : 'silhouette'));
}

function showMenu() {
  hideDialog();
  renderMenu();
  showScreen('menu');
}

function renderMenu() {
  const box = $('levels');
  box.innerHTML = '';
  const nextIdx = LEVELS.findIndex((l, i) => isUnlocked(i) && !isDone(l.id));
  LEVELS.forEach((def, i) => {
    if (def.secret) return;
    const unlocked = isUnlocked(i);
    const done = isDone(def.id);
    if (def.section) {
      const h = document.createElement('h2');
      h.className = 'section';
      h.textContent = def.section;
      box.append(h);
    }
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card' + (done ? ' done' : '') + (unlocked ? '' : ' locked') + (i === nextIdx ? ' next' : '');
    const cv = document.createElement('canvas');
    card.append(cv);
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = unlocked ? def.name : 'Locked';
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = done ? `★ Level ${def.id}` : `Level ${def.id}`;
    card.append(name, num);
    card.addEventListener('click', () => {
      unlockAudio();
      if (unlocked) startLevel(def.id);
      else sfx.bonk();
    });
    box.append(card);
    requestAnimationFrame(() => drawThumb(cv, def.id, done ? 'colour' : unlocked ? 'silhouette' : 'locked'));
  });
  $('sound-menu').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
}

const pictures = new Map();
function getPicture(id) {
  if (!pictures.has(id)) {
    const pic = pictureOf(LEVELS.find((l) => l.id === id));
    pic.hex = pic.colors.map((k) => PALETTE[k].hex);
    pictures.set(id, pic);
  }
  return pictures.get(id);
}

function drawThumb(cv, id, mode) {
  const level = getPicture(id);
  const size = cv.clientWidth || 140;
  const r = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(size * r);
  const g = cv.getContext('2d');
  g.scale(r, r);
  const cell = Math.min(size / (level.W + 1), size / (level.H + 1));
  const ox = (size - cell * level.W) / 2, oy = (size - cell * level.H) / 2;
  for (let i = 0; i < level.cells.length; i++) {
    const c = level.cells[i];
    if (c < 0) continue;
    g.fillStyle = mode === 'colour' ? level.hex[c] : mode === 'silhouette' ? '#d9cbbb' : '#e6dcd0';
    g.beginPath();
    g.arc(ox + ((i % level.W) + 0.5) * cell, oy + (((i / level.W) | 0) + 0.5) * cell, cell * 0.44, 0, Math.PI * 2);
    g.fill();
  }
  if (mode !== 'colour') {
    g.fillStyle = mode === 'locked' ? '#b9a99a' : '#fffaf3';
    g.font = `900 ${size * 0.3}px ui-rounded, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(mode === 'locked' ? '🔒' : '?', size / 2, size / 2);
  }
}

function showDialog({ title, text, html, art, buttons }) {
  $('dialog-title').textContent = title;
  const p = $('dialog-text');
  if (html) p.innerHTML = html; else p.textContent = text || '';
  const cv = $('dialog-art');
  cv.classList.toggle('none', !art);
  if (art) requestAnimationFrame(() => drawThumb(cv, art, 'colour'));
  const box = $('dialog-buttons');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.label;
    if (b.primary) el.className = 'primary';
    el.addEventListener('click', () => { unlockAudio(); b.onClick(); });
    box.append(el);
  }
  $('dialog').classList.remove('hidden');
}

function hideDialog() {
  $('dialog').classList.add('hidden');
}

function showStuck() {
  game.phase = 'stuck';
  sfx.stuck();
  const full = stuckReason(game.state) === 'full';
  showDialog({
    title: full ? 'Out of room!' : 'All locked up!',
    text: full
      ? "Every slot is full and none of those turrets can see their colour. Undo a move or two and try a different order. You've got as many undos as you like."
      : "The turrets that could help are still padlocked. Undo a move or two and try a different order. You've got as many undos as you like.",
    buttons: [
      { label: 'Start again', onClick: restart },
      { label: 'Undo', primary: true, onClick: doUndo },
    ],
  });
}

const CHEERS = ['Lovely!', 'Beautiful!', 'Gorgeous!', 'Nailed it!', 'Brilliant!', 'Ta-da!'];

function showWin() {
  confetti();
  const idx = LEVELS.findIndex((l) => l.id === game.level.id);
  const next = LEVELS.slice(idx + 1).find((l) => !l.secret);
  const secret = LEVELS[idx].secret;
  showDialog({
    title: secret ? 'You blasted the maker!' : CHEERS[Math.floor(Math.random() * CHEERS.length)],
    text: secret
      ? 'That was the hardest level in the game. Seriously impressive.'
      : next ? `“${game.level.name}” is finished and added to your collection.` : `That's every picture done. You're a bead-blasting legend! (Is there anything on the About page…?)`,
    art: game.level.id,
    buttons: [
      { label: 'Pictures', onClick: showMenu },
      next ? { label: 'Next picture', primary: true, onClick: () => startLevel(next.id) } : { label: 'Play again', primary: true, onClick: restart },
    ],
  });
}

function showHelp() {
  showDialog({
    title: 'How to play',
    html: `<ol>
      <li>Tap a turret at the front of the tray to send it to an empty slot.</li>
      <li>It fires at beads of its colour, but only ones it can see from below.</li>
      <li>When its ammo runs out it hops away and frees up the slot.</li>
      <li>Fill every slot with turrets that can't see their colour and you're stuck. Undo as often as you like.</li>
      <li><b>?</b> turrets show their colour when they reach the front.</li>
      <li>Later on: <b>padlocked</b> turrets and <b>frozen</b> beads that need two hits.</li>
    </ol>`,
    buttons: [{ label: "Let's go!", primary: true, onClick: hideDialog }],
  });
}

$('howto').addEventListener('click', () => { unlockAudio(); showHelp(); });
$('about-btn').addEventListener('click', () => { unlockAudio(); showAbout(); });
$('about-back').addEventListener('click', () => { unlockAudio(); showMenu(); });
$('secret').addEventListener('click', () => { unlockAudio(); sfx.sparkle(); startLevel(SECRET.id); });
$('sound-menu').addEventListener('click', () => {
  unlockAudio();
  save.muted = !save.muted;
  setMuted(save.muted);
  persist();
  $('sound-menu').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
});

// ================================================================ boot

showMenu();

// Updates: check whenever the app comes back to the foreground (iPadOS rarely
// restarts Home Screen apps), and switch to the new version once she's on the
// picture menu, never in the middle of a level.
let updateReady = false;
function applyUpdateIfIdle() {
  if (updateReady && $('play').classList.contains('hidden') && $('dialog').classList.contains('hidden')) location.reload();
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, nothing to refresh
    updateReady = true;
    applyUpdateIfIdle();
  });
  setInterval(applyUpdateIfIdle, 2000);
}

// Handy for testing from the console.
window.__blast = {
  get game() { return game; },
  get layout() { return L; },
  // true once every turret has done all it can and the player needs to act
  get idle() { return !!game && !game.shots.length && !game.arrivals.length && !canAnyFire(game.state); },
  levelIds: LEVELS.map((l) => l.id),
  showAbout,
  startLevel, tapColumn, doUndo, getLevel, engine,
};
