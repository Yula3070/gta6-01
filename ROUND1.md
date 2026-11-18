# Solara Bay — round 1 handover notes

Game "Solara Bay" (gta6-01) v1 is complete, verified and committed locally.
Do NOT push and do NOT submit — the parent handles the remote, the sealed
recording, `check` with transcripts, and the submit.

## What was verified (17 Nov 2026, headless Chromium, swiftshader)

- All 16 `game/src/*.js` modules parse (`node --check`); the game loads and
  plays with **zero console errors** and **zero network requests** (a logging
  server saw only local paths; the only three.js URL strings live in code
  comments, not loads). A `data:` favicon stops the browser's /favicon.ico 404.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` exits 0; `/output` holds `game/` +
  `screenshots/` (byte-identical to the repo) + `dossier.json`
  (schema `makefun/dossier/v1`, 549.700 bytes, 4 images, text 136.088 bytes).
- `makefun check --worktree` (no transcripts yet): competition_open,
  snapshot, license_osi, entrypoint all **pass**. The submission checks
  (repo_public, repo_owner, repo_created_after_open, commit_in_repo,
  duplicate_snapshot) fail until the parent pushes + publishes — expected.
- Gate limits: game/ = 19 files, 805.662 bytes (cap 993 / 48 MiB);
  index.html 4.996 bytes (cap 1 MiB); 0 symlinks. Screenshots: 4 JPEGs,
  1280x720, 63–96 KiB each (cap 256 KiB). `vendor/makefun-game.ts` is
  byte-identical to the kit.

## Bugs found during verification and fixed (do not regress)

1. **Player position was never synced to the car while driving**
   (`world.js`). It broke the minimap arrow (stuck at the garage), police
   targeting (cruisers chased the spawn point) and mission distance checks
   (missions could not complete while driving). Now `p.pos` tracks the car
   every step.
2. **Buildings nearly black**: the window texture's dark facade was
   multiplied by the district tint. Now the colour map uses a light facade
   and a separate black emissive map, so only lit windows glow at night.
3. **Collision damage drained every frame** while cars overlapped. Now a
   per-car 0.6–1.0 s crash cooldown, car–car damage rel*0.25 (threshold 10),
   building damage impact*0.4.
4. **Drive shot rear-ended stationary traffic** (two extra cars placed
   without road edges). Removed; the city's own traffic fills the road.
5. **Dialogue typewriter** showed a half-typed line in screenshots. Added
   `hud.finishDialogue()`; the mission shot calls it.
6. **Chase shot**: cruisers (max 33) can never catch the sports car
   (max 38), so they fell behind; the camera lerp made framing depend on
   frame rate. Now the chase uses a sedan (max 27), two cruisers staged
   20/26 units behind, and a snap (no-lerp) front-on camera 20 units ahead
   at y=3.2 looking back down the road.
7. **Headless screenshot is 807 px tall**, not 720: `--window-size=1280,807`
   gives a 1280x720 viewport plus an 87 px chrome band at the bottom.
   Capture at 1280x807, then crop the bottom 87 px to 1280x720.
8. **Mission shot**: clock 150 (bright day) and the mission advanced to
   step 2 (causeway escape), so the objective pill matches the action.

## Screenshot recipe (reproducible)

```sh
CH=~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome
$CH --headless=new --no-sandbox --disable-gpu --use-angle=swiftshader \
  --window-size=1280,807 --timeout=15000 \
  --screenshot=/tmp/final-<shot>.png "http://localhost:8090/?shot=<shot>&seed=1"
# then PIL: crop (0,0,1280,720), save JPEG quality 82
# shots: start, drive, chase, mission -> screenshots/1-start.jpg .. 4-mission.jpg
```

Serve with `node serve.ts` (port 8080) or any static server rooted at
`game/`. `?debug=1` writes live state (viewport, player/car pos, health,
screen, clock, shotCam, camera pos) into `document.title` — read it back
with `--virtual-time-budget=9000 --dump-dom`.

## Round 2 backlog

- **On-foot shot**: all four current shots are in a car (or the title).
  Criterion 1 is "city on foot AND by car" — consider an on-foot frame
  (walking, a ped, a punch or pistol moment) in place of one driving shot.
- Deepen missions (M4/M5 staging, more goon variety), more side activities
  (the courier job is the only one), tune chase/combat feel.
- The beach trees read as flat green slabs on sticks at dusk — soften the
  canopy shape if touched.
- The `#prompt` pill sits at bottom 15%; it hides behind the dialogue box
  when both show — acceptable (dialogue is temporary).
