// Simulated players, used to measure how hard a level is.
import { newState, cloneState, place, settle, isStuck, rng, frontTile, canPlace, firstFreeDock, exposedCount } from '../js/engine.js';

// mode 'random': taps any front turret. mode 'greedy': taps the colour with most beads showing.
// mode 'smart': thinks one move ahead, like a careful person: never makes a move
// that gets stuck straight away, and prefers moves that clear the most and free slots.
export function winRate(level, mode, trials = 200, seed = 1234) {
  let wins = 0;
  const rand = rng(seed);
  for (let t = 0; t < trials; t++) {
    const s = newState(level);
    while (s.beadsLeft > 0) {
      const opts = level.columns.map((_, c) => c).filter((c) => canPlace(s, c));
      if (!opts.length || firstFreeDock(s) < 0) break;
      let pick;
      if (mode === 'random') pick = opts[Math.floor(rand() * opts.length)];
      else if (mode === 'smart') {
        let best = -Infinity;
        for (const c of opts) {
          const s2 = cloneState(s);
          place(s2, c);
          settle(s2);
          const score = isStuck(s2) ? -1e9 : (s.beadsLeft - s2.beadsLeft) + s2.docks.filter((d) => !d).length * 4 + rand();
          if (score > best) { best = score; pick = c; }
        }
      } else pick = opts.map((c) => [exposedCount(s, frontTile(s, c).color) + rand(), c]).sort((a, b) => b[0] - a[0])[0][1];
      place(s, pick);
      settle(s);
      if (isStuck(s)) break;
    }
    if (s.beadsLeft === 0) wins++;
  }
  return Math.round((wins / trials) * 100);
}
