# Solara Bay — Round 2 report

Round 2 (17 Nov 2026, ~23:30–00:10 WIB) closes the gaps noted in round 1:
a real on-foot screenshot, deeper M4/M5, a shell-hunt side activity, polished
beach palms, and a verified Tide Run mechanic.

## What changed

### Shot on-foot (priority 1) — `shots.js`, `shots.json`, `main.ts`
- `2-drive.jpg` is gone; **`2-onfoot.jpg`** shows Nia on foot at the garage
  during M4 ("Kaine's Men"): pistol drawn (P9, 12/60), the nearest goon 8
  units ahead with a red health bar and the crosshair on him, full HUD
  (health/armor, $1,250, shells 0/12, objective pill + timer, minimap,
  tide gauge, dialogue from Leo), garage as backdrop, city streets both sides.
- Staging: Nia at (-126,-80), angle 0; all four goons frozen (speed 0) and
  turned to face her; the nearest goon pulled from the garage ring to
  (-126,-72) so the standoff reads at a glance. A staged over-the-shoulder
  camera (`game.shotCamera`, 11 units back, 3.5 to the side, y 4.4) frames
  Nia lower-center with the goon and garage ahead.
- Two staging fixes found while framing: (1) the goons kept shooting Nia
  during the settle + paint loop, so her health bar was red — health is
  restored to 100 and their `shootTimer` held at 3600 after the settle;
  (2) the first frame put the garage sign over the whole top — the standoff
  was moved 16 units south into open ground (colliders checked first:
  the only buildings near are the garage and two houses ending at z=-113.7).
- `main.ts`: only the shot filename in the `shotNames` list changed
  (`2-drive.jpg` → `2-onfoot.jpg`); the build logic is untouched.
  `shots.json` updated the same way.

### Deeper missions — `missions.js`
- **M4 (Kaine's Men)**: goon variety — bruiser (150 HP, 2.8 speed, purple),
  runner (80 HP, 4.4 speed, red), 2 regulars (100 HP, 3.4); the escape van
  has 150 HP (was 120); a mid-fight dialogue from Leo when 2 goons remain
  ("Two down, Nia! The van's coming..."); Dax's line when the van is stolen
  in M5 ("The whole take is yours — now run!...").
- **M5 (The Take)**: a third guard added (enforcer, 150 HP).
- `spawnShells` now returns the count (12).

### Side activity: shell hunt — `combat.js`, `hud.js`, `world.js`, `index.html`, `style.css`
- The 12 shells already scattered on the beach are now a real activity:
  HUD counter `🐚 x/12` (top-left panel), gold dots for uncollected shells on
  the minimap, and a **+$100 bonus + toast when all 12 are found**.
- **Street race**: press **G** (or the M key flow) to start a short race —
  start (168,168), checkpoints [(-168,168), (-168,-168), (168,-168)],
  $300 reward, 150 s timer, shown in the mission timer. `raceEligible` /
  `tryStartRace` / `cancelRace` in `missions.js`; G key + prompt in `world.js`.
- How-to text and control hints updated (G, shells).

### Palm polish — `city.js`
- Beach palms no longer look like "a green board on a stick at dusk":
  the canopy is now a core box plus 5 rotated fronds (`mergeBoxes` gained
  `rotY` support), in two greens, with varied heights.

### Tide Run verified — `main.js` (probe mode), `police.js`, `world.js`
- New debug-only `?probe=` mode in `main.js` (runs a synchronous check at
  load, writes JSON to `document.title`, never runs the game loop).
- **Anomaly hunt**: the bypass probe stopped the car at z=332.2 and a
  cruiser at the same z — traced to round 1's own bay-wall colliders
  (z=334, gap at the causeway, south wall at z=664), which were already
  correct. My first water clamps were redundant against those colliders
  and were removed again; what was genuinely missing was the **cruiser
  corridor clamp** (`police.js`): cruisers may never enter the causeway
  corridor (|x|<9, z 294–560) at any tide. Foot cops got the same treatment
  (they don't run through the collider code). Dead reverse-at-high-tide code
  in `police.js` removed.
- Probe results (headless Chromium, zero console errors, all four):
  - **tide-low**: car crosses the causeway at low tide — z 280→488.6 in 8 s,
    speed 27, health 100. PASSED.
  - **tide-high**: car held at the causeway entrance — z 294 all 8 s.
    PASSED.
  - **tide-bypass**: car at x=50 hits the bay wall — stops at z=332.2
    (334 − car radius), health 89 from the one wall impact. The sea cannot
    be driven around. PASSED.
  - **tide-cruiser**: 3 stars, player escapes to z=602.2; cruisers at
    (44.5, 332.2) ×2 (bay wall) and (0, 294) (corridor clamp) — none in the
    causeway, none in the water. PASSED (criterion fixed: a cruiser is legal
    on the beach at the wall, z≤336 with |x|≥9, or clamped at the entrance).

## Verification (same bar as round 1)

- **Game runs**: local server on port 8090, headless Chromium
  (`--headless=new --no-sandbox --disable-gpu --use-angle=swiftshader`):
  all four probes + all four screenshots with **zero console errors**.
- **Network**: 211 requests during the probe runs, all local `200`s; no
  external references in the served files (grep over `game/src/*.js` +
  `index.html` finds no `http` outside comments).
- **Build**: `MAKEFUN_OUTPUT_DIR=out node main.ts` → **exit 0**;
  `out/dossier.json` schema `makefun/dossier/v1`, text 148,343 bytes
  (cap 163,840), 4 screenshots listed.
- **Caps**: game/ 19 files, 817,777 bytes (caps 993 / 48 MiB);
  screenshots 4 files, 339,569 bytes total, each 1280×720 and ≤256 KiB
  (1-start 97,556; 2-onfoot 99,658; 3-chase 69,393; 4-mission 72,962).
- **Untouched**: `vendor/makefun-game.ts` byte-identical to the kit
  (`git diff --exit-code` clean); game/ + screenshots/ structure unchanged.
- **Syntax**: `node --check` passes on all 16 `game/src/*.js` files.
- **Commit**: this round committed locally (17 files, +323/−35 vs round 1).

## Screenshots (final)

| File | Shot | What it shows |
| --- | --- | --- |
| `1-start.jpg` | start | Title screen over the city at golden hour |
| `2-onfoot.jpg` | onfoot | **NEW** Nia on foot, pistol vs a goon at the garage, full HUD + minimap |
| `3-chase.jpg` | chase | Night chase, 3 stars, cruiser lights behind the sedan, 97 km/h |
| `4-mission.jpg` | mission | The Tide Run: sedan on the causeway to the island at low tide |

## What is still open for a later round

- The chase shot's cruiser reads small/far; the staged cruisers could be
  pulled tighter behind the player car.
- The mission shot's dialogue box overlaps the road's center line slightly.
- The goon in the on-foot shot is small and dark; a closer camera (or a
  brighter goon jacket) would make the standoff pop more.
- No playtest with a real human yet — the race timer (150 s) and the shell
  bonus ($100) are untested for feel; the street race has no minimap route
  line, only the next-checkpoint prompt.
- The probe mode is debug-only; it stays in `main.js` behind `?probe=` and
  never affects normal play.
