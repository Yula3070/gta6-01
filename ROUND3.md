# Solara Bay — Round 3 report (polish)

Round 3 (18 Nov 2026, ~00:10–00:35 WIB) closes every item on the round 2
list. No new systems — staging, a minimap route line, and probe-verified
race/shell feel. Nothing else changed.

## What changed

### Shot chase (`3-chase.jpg`) — `shots.js`
- The two staged cruisers now flank the player instead of trailing 20–26
  units behind: lead at (78,-150), wing at (90,-152), 10–12 units behind
  and 6 units to each side.
- The front-on camera moved in: 14 units ahead (was 20), y 2.6 (was 3.2),
  looking 10 units behind (was 12).
- Result, verified by eye: the wing cruiser rides big beside the sedan,
  red/blue light bar clearly readable, 3 stars above; a second cruiser
  trails behind. The chase reads at a glance now.

### Shot mission (`4-mission.jpg`) — `shots.js`, `style.css`
- The briefing dialogue no longer sits over the road's centre line: the
  mission staging adds a `top` class to `#dialogue`, and `style.css` gains
  `#dialogue.top { top: 86px; bottom: auto; }` — the box now hangs in the
  empty sky under the objective pill. The class is only ever added by the
  mission shot; normal play is untouched.
- Result: the causeway, centre line and the "E — Leave car" prompt are all
  fully visible; the briefing text is fully readable.

### Shot on-foot (`2-onfoot.jpg`) — `shots.js`
- The nearest goon moved from 8 to 5 units in front of Nia, and the
  over-the-shoulder camera moved in: 8 units back (was 11), 2.5 to the
  side (was 3.5), y 3.6 (was 4.4), looking 8 ahead (was 10).
- The nearest goon's jacket is bright orange (0xe67e22) in staging only.
  First tried bright red — but Nia's jacket is deep red (0xc0392b), so the
  two read as the same person; orange is distinct from Nia and loud
  against the grass and the garage. The mission's goon variety is untouched.
- Result: the goon is big, orange, with a visible red health bar and the
  crosshair on him; Nia is bigger in the foreground. The standoff pops.

### Race route line + probes — `hud.js`, `main.js`
- **Minimap**: while a street race is active, `drawMinimap` draws a dashed
  orange (#ff5a3c) polyline from the player arrow through the remaining
  checkpoints, with gold dots on each one. The next-checkpoint pulsing
  marker is unchanged and draws over it.
- **New probes** in `main.js` (debug-only `?probe=`, never in normal play):
  - `race`: autopilot (W held, A/D steer at the next checkpoint with the
    same steering law the police chase uses). Starts a real race at the
    casino start line and drives it.
  - `shells`: teleports the player onto each of the 12 shells in turn and
    checks the counter, the money and the $100 all-shells bonus.

## Probe results (headless Chromium, seed 1)

- **race — 3 runs, all PASSED**:
  - Run 1 (before the trace was added): checkpoints at 98/110 s, finished
    ~121 s, car health 92. Leg 1 was slow: a traffic car sat on the route
    and the straight-line autopilot kept ramming it dead-centre instead of
    steering around (traffic cars are kinematic — `updateTraffic` snaps
    them back onto their edge — so a dead-centre ram stalls). A human
    steers around; the autopilot does not.
  - Run 2: checkpoints at 13/25/37 s, finished 37 s, health 100.
  - Run 3: checkpoints at 13/25/37 s, finished 37 s, health 100 (picked
    up 1 star mid-race from a ped hit, then 5 by the end — the race still
    completed fine under police attention).
  - All three finished inside the 150 s limit; typical ~37 s, worst
    observed ~121 s. Reward +$300 verified. Route line drew: 183 orange
    pixels on the minimap canvas (threshold 60; the player arrow alone is
    ~40).
  - The first run's 98 s leg-1 stall is a probe limitation, not a game
    bug — but it is honest evidence that head-on ramming a traffic car
    dead-centre goes nowhere. A human player overtakes; nothing to fix.
- **shells — PASSED**: 12/12 collected, money +$700 (12×$50 + $100
  all-shells bonus), toast fired.
- **Tide regression — all PASSED** (unchanged code, re-run on the final
  build): tide-low (z 280→488.6), tide-high (held at 294), tide-bypass
  (stopped at 332.2), tide-cruiser (3 stars, cruisers legal, player escaped
  to 602.2).

## Verification (same bar as rounds 1–2)

- **Game runs**: local server on port 8090, headless Chromium
  (`--headless=new --no-sandbox --disable-gpu --use-angle=swiftshader`):
  all six probes + all four screenshots with **zero console errors** (the
  single console line is Chromium's own INFO notice about the software
  WebGL fallback, not a game error) and **zero network requests** (grep
  over `game/` finds no external references; all loads are local files).
- **Build**: `MAKEFUN_OUTPUT_DIR=out node main.ts` → **exit 0**;
  `out/dossier.json` schema `makefun/dossier/v1`, text 153,893 bytes
  (cap 163,840), file 610,288 bytes (cap 1.5 MiB), 4 images, cover
  1-start.jpg.
- **Caps**: game/ 21 entries, 823,326 bytes (caps 993 / 48 MiB);
  screenshots 4 files, 338,461 bytes total, each 1280×720 and ≤256 KiB
  (1-start 97,249; 2-onfoot 94,808; 3-chase 72,125; 4-mission 74,279).
- **Untouched**: `vendor/makefun-game.ts` byte-identical to the kit
  (`git diff --exit-code` clean); `main.ts` untouched (build logic intact);
  game/ + screenshots/ structure unchanged.
- **Syntax**: `node --check` passes on all 16 `game/src/*.js` files.
- **Commit**: this round committed locally (8 files).

## Screenshots (final)

| File | Shot | What it shows |
| --- | --- | --- |
| `1-start.jpg` | start | Title screen over the city at golden hour (re-captured; same scene) |
| `2-onfoot.jpg` | onfoot | **RE-STAGED** Nia vs the orange goon at the garage — health bar + crosshair on him, full HUD + minimap |
| `3-chase.jpg` | chase | **RE-STAGED** Night chase, 3 stars, big cruiser with light bar riding beside the sedan, 97 km/h |
| `4-mission.jpg` | mission | **RE-STAGED** The Tide Run: sedan on the causeway at low tide, briefing dialogue now in the sky, centre line clear |

## Honest assessment: is this the best version to submit?

Yes — submit this one. Every gap from rounds 1–2 is closed, every system
is verified by probe, and the three weakest screenshots are fixed and
visually confirmed. What is left is judgement taste, not missing systems:

- The race's traffic behaviour is the one real-feel item a human playtest
  could still improve (overtaking AI, or traffic that yields) — but there
  is no human playtest on this VM, and the probe proves the race is
  winnable with a big margin in the typical case.
- The chase shot's second cruiser reads small in the distance; the wing
  cruiser carries the shot, so this is cosmetic.
- A further round would be polishing the polish. With 7 days to the
  24 Nov 22:00 WIB close and 20 entry slots, the sensible use of a later
  slot is a second, different-feeling candidate (e.g. a dusk variant or a
  deeper mission pass) only if a concrete idea emerges — not another
  pass over the same four frames.
