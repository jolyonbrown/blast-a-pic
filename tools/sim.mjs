// Simulated players, used to measure how hard a level is.
import { newState, cloneState, place, settle, isStuck, rng, frontTile, sidesFor, firstFreeDock, freeSides, exposedOnSide } from '../js/engine.js';

// mode 'random': taps any front turret (and picks a side at random when there are slots above too).
// mode 'greedy': taps the colour with most beads showing on that side.
// mode 'smart': thinks one move ahead, like a careful person: never makes a move
// that gets stuck straight away, and prefers moves that clear the most and free slots.
const stonesLeft = (s) => { let n = 0; for (const v of s.stone) n += v; return n; };

export function winRate(level, mode, trials = 200, seed = 1234) {
  let wins = 0;
  const rand = rng(seed);
  for (let t = 0; t < trials; t++) {
    const s = newState(level);
    while (s.beadsLeft > 0) {
      const opts = [];
      for (const side of freeSides(s))
        for (let c = 0; c < level.columns.length; c++) if (sidesFor(s, c).includes(side)) opts.push({ c, side });
      if (!opts.length) break;
      let pick;
      if (mode === 'random') pick = opts[Math.floor(rand() * opts.length)];
      else if (mode === 'smart') {
        let best = -Infinity;
        for (const o of opts) {
          const s2 = cloneState(s);
          place(s2, o.c, firstFreeDock(s2, o.side));
          settle(s2);
          // progress = beads popped, plus stones smashed (a person knows that unblocks a column)
          const smashed = stonesLeft(s) - stonesLeft(s2);
          const score = isStuck(s2) ? -1e9 : (s.beadsLeft - s2.beadsLeft) + smashed + s2.docks.filter((d) => !d).length * 4 + rand();
          if (score > best) { best = score; pick = o; }
        }
      } else pick = opts.map((o) => [exposedOnSide(s, frontTile(s, o.c).color, o.side) + rand(), o]).sort((a, b) => b[0] - a[0])[0][1];
      place(s, pick.c, firstFreeDock(s, pick.side));
      settle(s);
      if (isStuck(s)) break;
    }
    if (s.beadsLeft === 0) wins++;
  }
  return Math.round((wins / trials) * 100);
}
