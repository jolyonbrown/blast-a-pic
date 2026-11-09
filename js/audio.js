// Tiny synthesised sound effects (no audio files needed).

let ctx = null;
let master = null;
let muted = false;
const lastPlayed = {};

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
}

function ready(name, minGapMs = 0) {
  if (muted || !ctx || ctx.state !== 'running') return false;
  const now = performance.now();
  if (minGapMs && now - (lastPlayed[name] || 0) < minGapMs) return false;
  lastPlayed[name] = now;
  return true;
}

function tone({ type = 'sine', from, to = from, dur = 0.1, vol = 0.3, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  pop() {
    if (!ready('pop', 35)) return;
    const f = 500 + Math.random() * 350;
    tone({ type: 'sine', from: f, to: f * 1.9, dur: 0.07, vol: 0.18 });
  },
  shoot() {
    if (!ready('shoot', 45)) return;
    tone({ type: 'triangle', from: 260, to: 120, dur: 0.06, vol: 0.08 });
  },
  place() {
    if (!ready('place')) return;
    tone({ type: 'triangle', from: 330, to: 520, dur: 0.12, vol: 0.22 });
  },
  done() {
    if (!ready('done', 60)) return;
    tone({ type: 'sine', from: 700, to: 1100, dur: 0.12, vol: 0.18 });
    tone({ type: 'sine', from: 1100, to: 1500, dur: 0.12, vol: 0.14, delay: 0.07 });
  },
  crack() {
    if (!ready('crack', 40)) return;
    tone({ type: 'square', from: 2400, to: 1600, dur: 0.05, vol: 0.05 });
    tone({ type: 'sine', from: 3200, to: 2600, dur: 0.08, vol: 0.06, delay: 0.02 });
  },
  unlock() {
    if (!ready('unlock', 100)) return;
    tone({ type: 'triangle', from: 660, dur: 0.09, vol: 0.18 });
    tone({ type: 'triangle', from: 990, dur: 0.16, vol: 0.18, delay: 0.08 });
  },
  select() {
    if (!ready('select', 60)) return;
    tone({ type: 'sine', from: 520, to: 700, dur: 0.08, vol: 0.14 });
  },
  smash() {
    if (!ready('smash', 50)) return;
    tone({ type: 'square', from: 140, to: 60, dur: 0.12, vol: 0.1 });
    tone({ type: 'triangle', from: 900, to: 300, dur: 0.06, vol: 0.06 });
  },
  bonk() {
    if (!ready('bonk', 120)) return;
    tone({ type: 'square', from: 180, to: 140, dur: 0.12, vol: 0.08 });
  },
  undo() {
    if (!ready('undo')) return;
    tone({ type: 'triangle', from: 520, to: 300, dur: 0.14, vol: 0.18 });
  },
  stuck() {
    if (!ready('stuck')) return;
    tone({ type: 'triangle', from: 392, to: 370, dur: 0.25, vol: 0.18 });
    tone({ type: 'triangle', from: 330, to: 300, dur: 0.35, vol: 0.18, delay: 0.22 });
  },
  sparkle() {
    if (!ready('sparkle', 25)) return;
    const notes = [1047, 1175, 1319, 1568, 1760, 2093];
    tone({ type: 'sine', from: notes[Math.floor(Math.random() * notes.length)], dur: 0.15, vol: 0.06 });
  },
  win() {
    if (!ready('win')) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.28, vol: 0.2, delay: i * 0.09 }));
  },
};
