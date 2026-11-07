// Builds every level exactly as the game will, confirms the solver can beat it,
// and reports how hard it is. Usage: node tools/check-levels.mjs [--art]
import { LEVELS } from '../js/levels.js';
import { buildLevel, parseArt } from '../js/engine.js';
import { winRate } from './sim.mjs';

const showArt = process.argv.includes('--art');
let ok = true;
for (const def of LEVELS) {
  const t0 = performance.now();
  try {
    if (showArt) console.log(parseArt(def).grid.map((r) => r.map((c) => c ?? '.').join('')).join('\n'));
    const level = buildLevel(def);
    const ms = (performance.now() - t0).toFixed(0);
    const beads = level.cells.filter((c) => c >= 0).length;
    const hidden = level.tiles.filter((t) => t.hidden).length;
    const locks = level.tiles.filter((t) => t.lock).length;
    const ice = level.hp.filter((h) => h > 1).length;
    if (def.attempt != null && level.attempt !== def.attempt) { ok = false; console.log(`  ! level ${def.id} layout drifted from tuning`); }
    console.log(
      `#${String(def.id).padStart(2)} ${def.name.padEnd(18)} ${level.W}x${level.H} beads=${beads} colours=${level.colors.length} ` +
      `slots=${level.docks} turrets=${level.tiles.length} ?=${hidden} locks=${locks} ice=${ice} build=${ms}ms random=${winRate(level, 'random')}% greedy=${winRate(level, 'greedy')}% smart=${winRate(level, 'smart', 60)}% solution=${level.solution.length} taps`
    );
  } catch (e) {
    ok = false;
    console.log(`#${def.id} ${def.name}: FAILED ${e.message}`);
  }
}
console.log(ok ? 'All levels OK' : 'PROBLEMS FOUND');
process.exit(ok ? 0 : 1);
