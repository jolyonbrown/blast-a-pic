# Blast-a-Pic

A calm bead-blasting puzzle for the iPad. **No ads, no lives, no timers, no "watch a video to continue".**

Each level is a picture made of ironing beads. Tap a turret at the front of the tray to send it to a
slot under the picture; it fires at beads of its colour. The catch is that turrets can only hit beads
they can see **from below**, so every column of the picture peels from the bottom up. When a turret
runs out of ammo it hops away and frees its slot. Fill every slot with turrets that can't see their
colour and you're stuck. Undo as often as you like.

Every level is checked by a solver before it ships, so it can always be beaten.

## Playing it on the iPad

It's a web app: plain HTML, CSS and JavaScript with no build step. Once it's hosted somewhere:

1. Open the address in **Safari** on the iPad.
2. Tap **Share → Add to Home Screen**.
3. Open it from the new icon. It runs full-screen, works offline and remembers progress.

Updates arrive automatically: after you publish a change, the app picks it up in the background and
shows it the next time it's opened.

### Hosting options (all free)

The repository is private, so:

- **Cloudflare Pages** or **Netlify**: connect the GitHub repo, set no build command, and set the
  output directory to `/`. Works with private repos on the free plans.
- **GitHub Pages**: Settings → Pages → Deploy from branch `main`, folder `/`. This needs a paid GitHub
  plan for private repos, or the repo made public.

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

Then pick a solvable, suitably tricky tray layout and check everything:

```sh
node tools/tune-levels.mjs 13      # writes js/tuning.js
node tools/check-levels.mjs --art  # every level builds, is solvable, prints difficulty
```

Difficulty is measured by simulated players: how often someone tapping at random wins, and how
often a "tap whatever colour is showing most" player wins. The targets per level are in
`tools/tune-levels.mjs`.

## Tests

```sh
python3 -m http.server 8765 &
node tools/smoke-test.cjs   # plays every level in a headless browser (iPad + phone sizes)
node tools/make-icons.cjs   # regenerate icons from tools/icon.html
```

When you change any game file, bump `VERSION` in `sw.js` so installed copies refresh their cache.
