import { TUNING } from './tuning.js';

// Level pictures. Each character is one bead (see PALETTE in engine.js):
//   k liquorice  w snow  y sunshine  o tangerine  r cherry  p candyfloss
//   v violet  b ocean  c sky  g leaf  G forest  n cocoa  t biscuit  s pebble
//   . empty
// mirror: 'even' -> each row is the left half and gets mirrored.
// outline: draws a ring of that colour around the whole shape automatically.
// columns: how many columns of turrets in the tray.
// chunks: turret ammo sizes to pick from. noise: how jumbled the tray order is.
// mystery: chance a turret behind the front row is hidden as "?".
// dockOptions: slot counts the tuner may choose between (tools/tune-levels.mjs).

function rainbowRows() {
  const W = 26, H = 14;
  const bands = ['r', 'o', 'y', 'g', 'b', 'v'];
  const cx = (W - 1) / 2, cy = H - 0.5;
  const clouds = [[2.6, 12.3, 2.4], [5.6, 12, 2.6], [4, 9.9, 2], [W - 3.6, 12.3, 2.4], [W - 6.6, 12, 2.6], [W - 5, 9.9, 2]];
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const band = Math.floor(12.6 - Math.hypot(x - cx, (y - cy) * 1.05));
      let ch = band >= 0 && band < bands.length ? bands[band] : '.';
      for (const [px, py, r] of clouds) if (Math.hypot(x - px, y - py) < r) ch = 'w';
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

function sunflowerRows() {
  const W = 23, H = 26, cx = 11, cy = 9;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const inEllipse = (x, y, px, py, angle, a, b) => {
    const ux = x - px, uy = y - py;
    const along = ux * Math.cos(angle) + uy * Math.sin(angle);
    const across = -ux * Math.sin(angle) + uy * Math.cos(angle);
    return (along / a) ** 2 + (across / b) ** 2 < 1;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.3;
        if (inEllipse(x, y, cx + Math.cos(a) * 6.8, cy + Math.sin(a) * 6.8, a, 3.2, 1.7)) grid[y][x] = k % 2 ? 'o' : 'y';
      }
      const d = Math.hypot(x - cx, y - cy);
      if (d < 5.2) grid[y][x] = 'y';
      if (d < 4.4) grid[y][x] = 'n';
      if (y > 16 && (inEllipse(x, y, cx - 3.6, 21, 0.3, 3.4, 1.5) || inEllipse(x, y, cx + 3.6, 19.5, -0.3, 3.4, 1.5))) grid[y][x] = 'g';
      if (y > 16 && x === cx) grid[y][x] = 'G';
    }
  }
  for (const [x, y, c] of [[9, 8, 'k'], [13, 8, 'k'], [9, 10, 'k'], [10, 11, 'k'], [11, 11, 'k'], [12, 11, 'k'], [13, 10, 'k'], [8, 10, 'p'], [14, 10, 'p']])
    grid[y][x] = c;
  return grid.map((r) => r.join(''));
}

export const RAW_LEVELS = [
  {
    id: 1, name: 'Sweetheart', outline: 'k', columns: 3, chunks: [10, 15], noise: 0,
    rows: [
      '..rrr...rrr..',
      '.rrrrr.rrrrr.',
      'rrwwrrrrrrrrr',
      'rwwrrrrrrrrrr',
      'rwrrrrrrrrrrr',
      'rrrrrrrrrrrrr',
      '.rrrrrrrrrrr.',
      '..rrrrrrrrr..',
      '...rrrrrrr...',
      '....rrrrr....',
      '.....rrr.....',
      '......r......',
    ],
  },
  {
    id: 2, name: 'Mister Mushroom', outline: 'k', columns: 3, chunks: [10, 15, 20], noise: 0.6,
    rows: [
      '....rrrrrr....',
      '..rrwwrrrrrr..',
      '.rrwwwwrrwwrr.',
      '.rrwwwwrrwwwr.',
      'rrrrwwrrrrwwrr',
      'rwwrrrrrrrrrrr',
      'wwwwrrrwwrrrrr',
      'wwwrrrwwwwrrww',
      '.kkkkkkkkkkkk.',
      '....tttttt....',
      '....tkttkt....',
      '....tttttt....',
      '....ttkktt....',
      '....tttttt....',
    ],
  },
  {
    id: 3, name: 'Strawberry Patch', outline: 'k', mirror: 'even', columns: 4, chunks: [10, 20], noise: 1,
    rows: [
      '.......G',
      '....GG.G',
      '..GGGGGG',
      '.rrrGrGG',
      'rrrrrrrr',
      'rrryrrrr',
      'ryrrrryr',
      'rrrryrrr',
      '.ryrrrrr',
      '.rrrryrr',
      '..ryrrrr',
      '..rrrryr',
      '...rrrrr',
      '....ryrr',
      '.....rrr',
      '......rr',
    ],
    patch: [[3, 5, 'w'], [2, 6, 'w'], [2, 7, 'w']],
  },
  {
    id: 4, name: 'Marmalade the Cat', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20], noise: 1.5,
    rows: [
      'o........',
      'oo.......',
      'opo......',
      'oppoooooo',
      'ooooooooo',
      'ooooooooo',
      'oookwoooo',
      'oookkoooo',
      'ooooooooo',
      'opooowwwp',
      'ooooowwwk',
      'oooowwkwk',
      'ooooowwww',
      '.oooooooo',
      '...oooooo',
    ],
  },
  {
    id: 5, name: 'Scoop Dreams', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [10, 20], noise: 2, mystery: 0.15,
    rows: [
      '......r',
      '.....rr',
      '...pppp',
      '.pppppp',
      'ppwpcpp',
      'pwwpppp',
      'pppyppp',
      'ppppppg',
      'ppppppp',
      '.pp.ppp',
      '.tntntn',
      '..tntnt',
      '..ntntn',
      '...tntn',
      '...ntnt',
      '....tnt',
      '.....nt',
      '......n',
    ],
  },
  {
    id: 6, name: 'Freddie Frog', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 25], noise: 2, mystery: 0.2,
    rows: [
      '..gggg...',
      '.gwwwwg..',
      'gwwkkwwg.',
      'gwwkkwwgg',
      'gwwwwwwgg',
      '.gwwwwggg',
      'ggggggggg',
      'ggggggggg',
      'gppgggggg',
      'gppkggggg',
      'ggggkkkkk',
      'ggggggggg',
      '.gggggggg',
      '...gggggg',
    ],
    patch: [[4, 2, 'w'], [14, 2, 'w']],
  },
  {
    id: 7, name: 'Birthday Cupcake', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [10, 20], noise: 2.5, mystery: 0.25,
    rows: [
      '......rr',
      '......rr',
      '....pppp',
      '..pppppp',
      '.ppcppyp',
      'pppppppp',
      'pgpppcpp',
      'pppppppp',
      '.pppppp.',
      '.vcvcvcv',
      '.vcvcvcv',
      '..vcvcvc',
      '..vcvcvc',
      '...vcvcv',
    ],
  },
  {
    id: 8, name: 'Pip the Penguin', dockOptions: [5, 4], outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 30], noise: 3, mystery: 0.25,
    rows: [
      '.....bbb',
      '...bbbbb',
      '..bbbbbb',
      '..bbwwbw',
      '.bbwkwww',
      '.bbwwwwo',
      '.bpwwwww',
      'bbbwwwww',
      'bbbwwwww',
      'bbbwwwww',
      '.bbwwwww',
      '.bbwwwww',
      '..bbwwww',
      '...oo...',
    ],
  },
  {
    id: 9, name: 'Sunny Sunflower', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [15, 20, 30], noise: 3, mystery: 0.3,
    rows: sunflowerRows,
  },
  {
    id: 10, name: 'Bathtime Duck', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [20, 30], noise: 3, mystery: 0.3,
    rows: [
      '......yyyy........',
      '.....yyyyyy.......',
      '....yyyywkyy......',
      '....yyyyyyyyoo....',
      '....yyyyyyyoooo...',
      '.....yyyyyyoo.....',
      '......yyyyy.......',
      '.yy..yyyyyyyy.....',
      '.yyyyyyyyyyyyyy...',
      '.yyyyywyyyyyyyyy..',
      '.yyyywwyyyyyyyyy..',
      '..yyyyyyyyyyyyyy..',
      '..yyyyyyyyyyyyyy..',
      '...yyyyyyyyyyyy...',
      'cc.cccc.cccc.cccc.',
      'cccccccccccccccccc',
    ],
  },
  {
    id: 11, name: 'After the Rain', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [20, 30], noise: 3.5, mystery: 0.35,
    rows: rainbowRows,
  },
  {
    id: 12, name: 'Wanda the Whale', dockOptions: [5, 4], outline: 'k', columns: 5, chunks: [20, 30], noise: 4, mystery: 0.35,
    rows: [
      '.....c.c..............',
      '......c...............',
      '....bbbbbbb...........',
      '..bbbbbbbbbbbb......bb',
      '.bbbbbbbbbbbbbbb...bbb',
      'bbbkbbbbbbbbbbbbb.bbb.',
      'bbbbbbbbbbbbbbbbbbbb..',
      'bpbbbbbbbbbbbbbbbbb...',
      'bbccccccbbbbbbbbbb....',
      '.bccccccccccbbbbb.....',
      '..cccccccccccccc......',
      '....cccccccccc........',
    ],
  },
];

// Each level with its tuned tray layout (see tools/tune-levels.mjs) applied.
export const LEVELS = RAW_LEVELS.map((def) => ({ ...def, ...(TUNING[def.id] || {}) }));
