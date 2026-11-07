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
// locks: chance a turret gets a padlock. ice: chance a bead is frozen (iceColors limits which).
// section / tip: menu heading, and a one-off explainer the first time the level is opened.
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


// Small helpers for drawing pictures with code.
function canvas(W, H) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  g.set = (x, y, ch) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };
  g.rows = () => g.map((r) => r.join(''));
  return g;
}

function inEllipse(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
}

function balloonRows() {
  const W = 21, H = 29, g = canvas(W, H);
  const cx = 10;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // a teardrop: round on top, narrowing towards the basket
      const rx = y < 10 ? 10 : 10 - (y - 10) * 0.55;
      if (y <= 19 && rx > 0 && inEllipse(x, y, cx, 10, rx + 0.4, 10.4)) {
        const gore = Math.floor(Math.abs(x - cx + 0.5) / 2.2);
        let ch = ['r', 'y', 'r', 'y', 'r'][gore] || 'r';
        if (y >= 8 && y <= 9) ch = 'w';
        if (y >= 13 && y <= 14) ch = 'b';
        g.set(x, y, ch);
      }
    }
  // ropes and basket
  for (let y = 20; y <= 23; y++) { g.set(7 + Math.floor((y - 20) / 2), y, 'n'); g.set(13 - Math.floor((y - 20) / 2), y, 'n'); }
  for (let y = 24; y <= 28; y++) for (let x = 7; x <= 13; x++) g.set(x, y, y % 2 ? 't' : 'n');
  return g.rows();
}

function watermelonRows() {
  const W = 25, H = 13, g = canvas(W, H);
  const cx = 12, R = 12.4;
  const seeds = [[6, 2], [10, 1], [14, 1], [18, 2], [8, 4], [12, 4], [16, 4], [10, 6], [14, 6], [12, 8], [4, 1], [20, 1]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y + 0.5);
      if (d > R) continue;
      let ch = d > R - 1 ? 'G' : d > R - 2 ? 'g' : d > R - 2.8 ? 'w' : 'r';
      g.set(x, y, ch);
    }
  for (const [x, y] of seeds) g.set(x, y, 'k');
  return g.rows();
}

function teapotRows() {
  const W = 27, H = 21, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inEllipse(x, y, 13, 13, 8.6, 6.8)) g.set(x, y, (x + y * 3) % 7 === 0 ? 'w' : 'c');
      // handle: a ring on the right
      const hd = Math.hypot(x - 21.5, y - 12.5);
      if (x > 20 && hd < 4.4 && hd > 2.4) g.set(x, y, 'b');
      // spout sloping up to the left
      if (x >= 1 && x <= 6 && y >= 6 && y <= 15 && Math.abs(y - (15 - (6 - x) * 1.5) + 1.5) < 1.6) g.set(x, y, 'b');
      // lid and knob
      if (y >= 5 && y <= 6 && x >= 9 && x <= 17) g.set(x, y, 'b');
      if (y >= 3 && y <= 4 && x >= 12 && x <= 14) g.set(x, y, 'y');
    }
  return g.rows();
}

function hedgehogRows() {
  const W = 26, H = 16, g = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // spiky back with diagonal stripes
      if (inEllipse(x, y, 10.5, 8, 10.5, 7.6) && y < 14) g.set(x, y, (x + y) % 3 === 0 ? 't' : 'n');
      // face
      if (inEllipse(x, y, 19, 10, 5.5, 3.6)) g.set(x, y, 't');
      if (inEllipse(x, y, 23, 10.5, 2.2, 1.6)) g.set(x, y, 't');
    }
  g.set(25, 10, 'k'); g.set(25, 11, 'k');
  g.set(19, 8, 'k');
  g.set(20, 11, 'p');
  for (const fx of [6, 7, 14, 15]) { g.set(fx, 14, 'n'); g.set(fx, 15, 'n'); }
  // an apple caught on the spikes
  for (const [x, y] of [[8, 1], [9, 1], [7, 2], [8, 2], [9, 2], [10, 2], [8, 3], [9, 3]]) g.set(x, y, 'r');
  g.set(9, 0, 'G');
  return g.rows();
}

export const RAW_LEVELS = [
  {
    section: 'Warm-up',
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

  // ------------------------------------------------------------ Tricky
  // Stricter: fewer slots, more "?" turrets, padlocked turrets, frozen beads,
  // and stripy pictures that make you juggle colours.
  {
    section: 'Tricky',
    id: 13, name: 'Lighthouse', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20], noise: 3, mystery: 0.35, locks: 0.15, dockOptions: [5, 4],
    rows: [
      '.....r',
      '....rr',
      '...rrr',
      '..ssss',
      '..cyyy',
      '..cyyy',
      '.sssss',
      '...rrr',
      '...rrr',
      '...www',
      '...www',
      '..rrrr',
      '..rrrr',
      '..wwww',
      '..wwww',
      '.rrrrr',
      '.rrrrr',
      '.wwwwn',
      '.wwwwn',
      'ssssss',
      'bcbbbb',
      'bbbbcb',
    ],
  },
  {
    tip: {
      title: 'Locked turrets',
      text: 'Turrets with a padlock can’t move yet. The number on the lock is how many other turrets you need to use first.',
    },
    id: 14, name: 'Busy Bee', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20], noise: 3, mystery: 0.35, locks: 0.15, dockOptions: [5, 4],
    rows: [
      '......yyy',
      '.....ykyy',
      '.....yyyy',
      '.ww..nnnn',
      'wwww.nnnn',
      'wccwwyyyy',
      'wccwwyyyy',
      '.wwwwnnnn',
      '..wwwnnnn',
      '.....yyyy',
      '.....yyyy',
      '......nnn',
      '......nnn',
      '.......yy',
      '........k',
    ],
  },
  {
    tip: {
      title: 'Frozen beads',
      text: 'Icy beads need two hits: the first cracks the ice, the second pops the bead. Turrets carry enough ammo for both.',
    },
    id: 15, name: 'Frosty', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 25], noise: 3, mystery: 0.35, locks: 0.1,
    ice: 0.35, iceColors: 'w', dockOptions: [4, 3],
    rows: [
      '.....bbb',
      '.....bbb',
      '.....bbb',
      '...bbbbb',
      '.....www',
      '....wwww',
      '....wkww',
      '....wwwo',
      '....wwww',
      '...rrrrr',
      '...rrrrr',
      '...wwwww',
      '..wwwwww',
      'nn.wwwwk',
      '..nwwwww',
      '..wwwwww',
      '.wwwwwwk',
      '.wwwwwww',
      '.wwwwwww',
      '..wwwwww',
      '...wwwww',
    ],
  },
  {
    id: 16, name: 'Up and Away', outline: 'k', columns: 4, chunks: [15, 20, 30], noise: 3.5, mystery: 0.4, locks: 0.15, ice: 0.12, dockOptions: [4, 3],
    rows: balloonRows,
  },
  {
    id: 17, name: 'Summer Slice', outline: 'k', columns: 4, chunks: [15, 20], noise: 3.5, mystery: 0.4, locks: 0.15, ice: 0.15, dockOptions: [4, 3],
    rows: watermelonRows,
  },
  {
    id: 18, name: 'Fennel the Fox', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 30], noise: 3.5, mystery: 0.4, locks: 0.15, ice: 0.12, dockOptions: [4, 3],
    rows: [
      'o........',
      'oo.......',
      'ono......',
      'onno.....',
      'onnoooooo',
      'ooooooooo',
      'ooookoooo',
      'woookoooo',
      'wwooooooo',
      'wwwoooooo',
      '.wwwwoooo',
      '..wwwwwoo',
      '...wwwwww',
      '....wwwwk',
      '......www',
    ],
  },
  {
    id: 19, name: 'Time for Tea', outline: 'k', columns: 4, chunks: [20, 30], noise: 4, mystery: 0.4, locks: 0.2, ice: 0.15, dockOptions: [4, 3],
    rows: teapotRows,
  },
  {
    id: 20, name: 'Flutterby', outline: 'k', mirror: 'even', columns: 4, chunks: [15, 20, 30], noise: 4, mystery: 0.45, locks: 0.2, ice: 0.15, dockOptions: [4, 3],
    rows: [
      '.......n..',
      '........n.',
      '.vvv.....n',
      'vvvvv....n',
      'vvpvvv...n',
      'vpppvvv..n',
      'vvpvvvvv.n',
      'vvvvvvvvvn',
      '.vvvvvvvvn',
      '..vvvvvvvn',
      '...yyyyyyn',
      '..yyyoyyyn',
      '..yyooyyyn',
      '...yyyyyyn',
      '....yyyy.n',
      '.........n',
    ],
  },
  {
    id: 21, name: 'Professor Owl', outline: 'k', mirror: 'even', columns: 4, chunks: [20, 30], noise: 4, mystery: 0.45, locks: 0.2, ice: 0.15, dockOptions: [4, 3],
    rows: [
      'nn.......',
      'nnn......',
      'nnnnnnnnn',
      'nnwwwnnnn',
      'nwwwwwnnn',
      'nwwkkwnnn',
      'nwwkkwnno',
      'nnwwwnnno',
      'nnnnnnnnn',
      'nnntttttt',
      'nnttntttn',
      'nntntntnt',
      'nnttntttn',
      'nntntntnt',
      'nnttttttt',
      '.nnnttttt',
      '....oo...',
    ],
  },
  {
    id: 22, name: 'Plain Sailing', outline: 'k', columns: 5, chunks: [20, 30], noise: 4.5, mystery: 0.45, locks: 0.2, ice: 0.18, dockOptions: [4, 3],
    rows: [
      '..........r...........',
      '..........nr..........',
      '..........nrr.........',
      '.........wnrrr........',
      '........wwnwwww.......',
      '.......wwwnwwwww......',
      '......wwwwnrrrrrr.....',
      '.....wwwwwnwwwwwww....',
      '....wwwwwwnwwwwwwww...',
      '...rrrrrrrnrrrrrrrrr..',
      '..........n...........',
      '.nnnnnnnnnnnnnnnnnnnn.',
      '..nnynnnnnnnnnnnnynn..',
      '...nnnnnnnnnnnnnnnn...',
      'bbcbbbbcbbbbbcbbbbcbbb',
      'bbbbbbbbbbbbbbbbbbbbbb',
    ],
  },
  {
    id: 23, name: 'Prickly Pete', outline: 'k', mirror: 'even', columns: 4, chunks: [20, 30], noise: 4.5, mystery: 0.5, locks: 0.25, ice: 0.18, dockOptions: [4, 3],
    rows: [
      '......pp',
      '.....ppy',
      '......pp',
      '.....gGg',
      '.....gGg',
      '.g...gGg',
      'gGg..gGg',
      'gGg..gGg',
      'gGggggGg',
      '.ggg.gGg',
      '.....gGg',
      '.....gGg',
      '..oooooo',
      '..oooooo',
      '...nnnnn',
      '...ooooo',
      '....oooo',
    ],
  },
  {
    id: 24, name: 'Hazel the Hedgehog', outline: 'k', columns: 5, chunks: [20, 30], noise: 5, mystery: 0.5, locks: 0.25, ice: 0.2, dockOptions: [4, 3],
    rows: hedgehogRows,
  },
];

// Each level with its tuned tray layout (see tools/tune-levels.mjs) applied.
export const LEVELS = RAW_LEVELS.map((def) => ({ ...def, ...(TUNING[def.id] || {}) }));
