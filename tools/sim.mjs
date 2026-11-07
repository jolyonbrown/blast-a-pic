// Simulated players, used to measure how hard a level is.
import { newState, place, settle, isStuck, rng, frontTile, firstFreeDock, exposedCount } from '../js/engine.js';

// mode 'random': taps any front turret. mode 'greedy': taps the colour with most beads showing.
export function winRate(level, mode, trials = 200, seed = 1234) {
  let wins = 0;
  const rand = rng(seed);
  for (let t = 0; t < trials; t++) {
    const s = newState(level);
    while (s.beadsLeft > 0) {
      const opts = level.columns.map((_, c) => c).filter((c) => frontTile(s, c));
      if (!opts.length || firstFreeDock(s) < 0) break;
      let pick;
      if (mode === 'random') pick = opts[Math.floor(rand() * opts.length)];
      else pick = opts.map((c) => [exposedCount(s, frontTile(s, c).color) + rand(), c]).sort((a, b) => b[0] - a[0])[0][1];
      place(s, pick);
      settle(s);
      if (isStuck(s)) break;
    }
    if (s.beadsLeft === 0) wins++;
  }
  return Math.round((wins / trials) * 100);
}
