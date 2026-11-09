# Blast-a-Pic

A calm bead-blasting puzzle for the iPad. **No ads, no lives, no timers, no "watch a video to continue".**

Each level is a picture made of ironing beads. Tap a turret at the front of the tray to send it to a
slot under the picture; it fires at beads of its colour. The catch is that turrets can only hit beads
they can see **from below**, so every column of the picture peels from the bottom up. When a turret
runs out of ammo it hops away and frees its slot. Fill every slot with turrets that can't see their
colour and you're stuck. Undo as often as you like.

There are three sets of pictures:

- **Warm-up** (1–12) teaches the idea.
- **Tricky** (13–24) has fewer slots, more "?" turrets, stripy pictures, **padlocked turrets**
  that can't move until you've used a certain number of other turrets, and **frozen beads** that
  need two hits.
- **Expert** (25–34) is festive and fiendish, and gets harder with every picture. The later ones
  have full backgrounds, so every column of beads is deep.
- **Elite** (36 onwards) adds **slots above the picture**: turrets up there fire downwards, so a
  column can be opened from either end. When both rows have room, tap a turret to pick it up,
  then tap the glowing slot you want. Elite also has **stones**, which cover beads until a grey
  **hammer** turret smashes them (hammers reach either end of a column), and **linked turrets** chained in pairs that go out together.
  The last of them adds **fog beads**, lavender "?" beads that show their colour once they're
  uncovered. Starring Nelly, Lana and Juno.

There's also a **secret level** on the About page (tap the mystery portrait). It's the hardest in
the game. It's a bead portrait drawn by hand from a photo; the photo itself isn't in the repo.

Every level is checked by a solver before it ships, so it can always be beaten.

## Playing it on the iPad

It's a web app: plain HTML, CSS and JavaScript with no build step. Once it's hosted somewhere:

1. Open the address in **Safari** on the iPad.
2. Tap **Share → Add to Home Screen**.
3. Open it from the new icon. It runs full-screen, works offline and remembers progress.

Updates arrive automatically. Whenever the app comes back to the foreground it checks for a new
version, downloads it in the background, and switches over the next time she's on the picture
menu, never in the middle of a level. Progress is kept.

### Hosting on GitHub Pages (free)

1. Make the repo public: **Settings → General → Danger Zone → Change visibility**.
2. **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`
   (or the feature branch), folder `/ (root)`, **Save**.
3. After a minute or so it's live at **https://jolyonbrown.github.io/blast-a-pic/**.

It's designed for portrait. Landscape still works if the iPad gets turned, because a web app can't
force iPadOS to stay in portrait.

## Running it locally

```sh
python3 -m http.server 8765
# then open http://localhost:8765
```

To try it on the iPad without hosting, run that on a computer on the same Wi-Fi and open
`http://<computer-ip>:8765` in Safari. Offline mode and Add to Home Screen need HTTPS, so that's
best kept for quick testing.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html`, `css/style.css` | Page, menus, dialogs |
| `js/main.js` | The game: layout, animation, input, screens |
| `js/engine.js` | Pure game rules, level builder and solver (no DOM, runs in Node too) |
| `js/render.js` | Drawing beads and turrets |
| `js/audio.js` | Synthesised sound effects |
| `js/levels.js` | **The pictures**: edit or add levels here |
| `js/tuning.js` | Generated: which tray layout each level uses |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home Screen / offline support |
| `tools/` | Level checking, difficulty tuning, smoke test, icon generator |

## Adding a picture

Add an entry to `RAW_LEVELS` in `js/levels.js`. Each character is one bead (`.` is empty):

```js
{
  id: 13, name: 'Lucky Clover', outline: 'k', mirror: 'even', columns: 4,
  chunks: [15, 20], noise: 3, mystery: 0.3, dockOptions: [5, 4],
  rows: [
    '..gg....',
    '.gggg...',
    // ...left half only when mirror is 'even'
  ],
},
```

Colours: `k` liquorice, `w` snow, `y` sunshine, `o` tangerine, `r` cherry, `p` candyfloss,
`v` violet, `b` ocean, `c` sky, `g` leaf, `G` forest, `n` cocoa, `t` biscuit, `s` pebble.
`outline: 'k'` draws the dark border for you.

Optional extras: `fog: 0.18` (chance a bead hides its colour until exposed), `links: 0.2` (chance neighbouring turrets are chained into pairs), `topDocks: 2` (slots above the picture), `stones: 0.08` (chance a bead is
covered by a stone; hammer turrets are added automatically), `secret: true` (left out of the picture grid; the About page opens it),
`locks: 0.2` (chance a turret is padlocked), `ice: 0.15` (chance a bead is
frozen; `iceColors: 'w'` limits it to certain colours), `section: 'Name'` (a heading in the
menu), and `tip: { title, text }` (shown once, the first time the level is opened).

Then pick a solvable, suitably tricky tray layout and check everything:

```sh
node tools/tune-levels.mjs 13      # writes js/tuning.js
node tools/check-levels.mjs --art  # every level builds, is solvable, prints difficulty
```

Difficulty is measured by three simulated players: one tapping at random, one that always taps
whatever colour is showing most, and a careful one that thinks a move ahead. Tricky levels are
tuned so random tapping almost never wins and the obvious move often fails, but the careful
player still wins a fair share of the time, so levels need planning rather than one hidden
trick. The targets per level are in `tools/tune-levels.mjs`.

## Tests

```sh
python3 -m http.server 8765 &
node tools/smoke-test.cjs   # plays every level in a headless browser (iPad + phone sizes)
node tools/make-icons.cjs   # regenerate icons from tools/icon.html
```

When you change any game file, bump `VERSION` in `sw.js` so installed copies refresh their cache.
