# Round 5 — The Last Tide (M6) + police roadblocks

R3 sits at #131 (judge 99,01%), R4 fell to #1509 (98,5953%) — same 12W/0L
provisional band, so the score is a Bayesian rating from pairwise judge
comparisons of cover + dossier text, and the R4 cover did not move the
needle. The leaderboard study says the top-100 titles all advertise 7–18
story missions, 5-star police, helicopter, roadblocks, radio, saves,
garage, shops, safehouses, races and collectibles, with a distinctive hook.
Our gaps were the two cheapest to close: a sixth mission and roadblocks.
R5 closes both and re-stages the cover on the new finale at 5 stars.

## What changed

### M6 "The Last Tide" — `missions.js`, `config.js`
- Data-driven, same pattern as M1–M5: Dax Fontaine sends Nia to the marina
  — Kaine is leaving on the night boat with the ledger. Four steps:
  goto the marina → defeat 3 guards → steal the armored van → deliver
  across the causeway to the lighthouse. 360 s, $2,500 reward (6th entry
  in `ECONOMY.missionRewards`).
- `setupStep`: the `defeat` spawn now rings the step's own x/z when the
  step has one (M6: the marina), else the garage as before — M4 unchanged.
  M6 step 3 spawns the armored van parked at the marina like M5's casino
  hook (no extra guards; the defeat step already spawned them). M6 start
  sets low tide like M3.
- `onGoonDown` generalized: any current step of type `defeat` decrements
  `goonsLeft`, updates the objective, and advances at 0; M4's mid-fight
  Leo dialogue at `goonsLeft == 2` and M5's silent step-0 guard counting
  behave exactly as before.
- Bug found by the probe and fixed: `start(index)` never set
  `this.index`, so `complete()` paid `missionRewards[this.index]` — the
  mission played only matched the reward when played in order. `start`
  now sets `this.index = index`, so the reward follows the mission
  actually played.

### Police roadblocks at 4+ stars — `police.js`
- `createPolice` gains `roadblock` / `roadblockTimer`. `makeRoadblockAt`
  (exported for `shots.js`): two parked police cruisers across the road,
  facing the player (offsets ±3.5), plus one striped orange/white barrier
  (3 thin boxes, ~7 units wide) between them. `removeRoadblock` pulls the
  cars out of `game.cars` and the barrier out of the scene.
- Live behavior in `updatePolice`: at 4+ stars with no block, one spawns
  40 units ahead of the player along their heading, snapped to the
  nearest road node; below 4 stars it lifts; it repositions (at most
  every 6 s) when the player is >70 units away or it ends up behind them.
  `clearWanted` also removes it. Ramming is free: `collideCars` already
  damages both cars on a hard hit — no new collision code.

### Cover re-stage — `shots.js`
- `1-start.jpg` is now the M6 finale at dusk (clock 178): mission 6
  started, jumped to step 4 (deliver), intro dialogue hidden, objective
  set to the step label; armored van at (84,-140), speed 22;
  `addHeat(game, 900)` for 5 stars; two flanking cruisers as in R4;
  helicopter parked due north as in R4. The live roadblock spawned
  during the settle is far behind the van by then (and was rammed
  through), so it is lifted and a fresh one is staged 22 units beyond
  the van on the avenue, facing it — close enough that the two cruisers
  and the striped barrier read in frame. Mission card reads
  MISSION 6/6 · THE LAST TIDE, STEP 4/4 (hud.js already uses
  `list.length`; verified, no hud change needed).

### Text — `index.html`, `README.md`
- Title story and README: "five missions" → "six missions". Howto gains
  one line: "Roadblocks wait at four stars — swerve or smash through."
  README gains one Systems bullet for roadblocks. Nothing else.

### Byte budget — dossier text
- First build came in at 163,837 / 163,840 bytes with the tail of
  `style.css` cut from the judge's view — the new code was ~5,600 bytes
  gross. Trimmed ~3,900 bytes of comments (police, shots, city, world,
  hud, vehicles — comment-only, zero behavior change) plus tighter probe
  code and shorter M6 dialogue. Final: **dossier text 161,296 /
  163,840 bytes** (headroom 2,544; net growth vs R4's 159,525 is
  1,771 bytes, nothing truncated). Dossier file 612,377 bytes.

## Verification (headless Chromium, seed 1)

- Probes (final run, all PASS, 0 console errors, 0 external requests):
  - `roadblock` PASS — 4 stars, block spawns; head-on ram at 20 u/s:
    car health 100 → 93, speed 20 → 7.
  - `m6` PASS — all 4 steps teleported through, mission completes,
    money +$2,500 exactly (first run FAILED at +$150: the `start` /
    `index` reward bug above; fixed, re-ran, PASS).
  - `race` PASS — 3/3 checkpoints in 37 s, +$300, route line 183 px
    (no flake this round; two clean runs).
  - `shells` PASS — 12/12, +$700. `tide-low` / `tide-high` /
    `tide-bypass` / `tide-cruiser` all PASS (unchanged code, re-run).
- Screenshots: all 4 viewed. Cover: dusk sky, armored van 83 km/h,
  5 stars, helicopter + searchlight beam, roadblock (two cruisers +
  striped barrier) beyond the van, M6 card STEP 4/4, minimap with the
  lighthouse marker. On-foot: Reyes Garage, orange-jacket goon, M4 card
  4/6, Leo dialogue. Drive: sports car 137 km/h, taxi + traffic,
  pedestrian. Mission: causeway, M3 card 3/6, Dax dialogue, LOW TIDE.
  Each ≤256 KiB (86,607 / 92,280 / 83,118 / 72,281 bytes), 1280×720.
- Zero console errors, zero network requests (no external refs in
  `game/`, all loads local; the headless driver also recorded none).
- Build: `MAKEFUN_OUTPUT_DIR=out node main.ts` exit 0.

## Known weaknesses (not fixed)

- The roadblock barrier has no collision: the cruisers stop a rammer
  (health + speed loss, verified), but the striped barrier itself is
  visual only — a car drives through the boards. Fixing it needs a
  collider with lifetime tied to the block; out of the byte budget.
- The staged cover roadblock sits 22 units beyond the van, not at the
  literal (84,-175) of the brief: after the 4 s settle the van has
  driven ~90 units south, so a block at the van's start-relative
  position would be ~120 units behind the frame. Staging relative to
  the van's final position keeps it in frame.
- The dossier text is a Bayesian-rating input, not a score itself:
  nothing here guarantees a band jump; the bet is that a 6-mission,
  5-star, roadblock cover + dossier reads stronger than R4's 5-mission
  M5 cover. If R5 also lands in the same band, the next lever is a
  7th mission or a distinct hook (radio/safehouse), not another cover.
