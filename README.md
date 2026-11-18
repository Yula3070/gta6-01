# Solara Bay — an open-world crime game

An original open-world crime game in the spirit of GTA 6, built for the
make.fun **gta6-01** bounty. It runs offline in a desktop browser from static
files — no network request, no build step.

## The game

**Solara Bay** is a sun-soaked coastal city. You are **Nia Reyes**, an
ex-stunt driver turned courier, pulled into one last job by her old crew.
Five story missions take her from a lunch delivery to the casino heist of the
year — and the only clean getaway is **the Tide Run**: a causeway across the
bay that is only drivable at low tide. Police cruisers will not follow you
across the sandbar.

The city's own names, characters, streets, art, sounds and music were all
made for this game. Nothing comes from any commercial game.

## Play

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. Keyboard + mouse, offline.

| Action | Keys |
| --- | --- |
| Move / drive | WASD or arrows |
| Look (mouse) | click the game to capture the mouse |
| Run / handbrake | Shift / Space |
| Jump | Space (on foot) |
| Enter / leave car | E |
| Punch | F |
| Pistol | 2, click to shoot, R reload |
| Next mission / courier job | M |
| Street race (in a car, at the start line by the casino) | G |
| Pause | Esc |

## Systems

- **City**: a procedural grid city (downtown, old town, beach district), a
  plaza park, a beach, a bay, a tidal causeway and a lighthouse island.
- **On foot and by car**: third-person walking with mouse orbit, and arcade
  driving (sedan, taxi, hatch, sports, van, truck, police cruiser, armored van).
- **Traffic and pedestrians**: cars follow the road graph in right-hand
  lanes; pedestrians stroll the sidewalks and flee from gunfire.
- **Stealing cars**: take any car — a traffic car costs you a wanted star.
- **Wanted level and police**: 0–5 stars; cruisers chase and ram, foot cops
  close in; get busted standing still. Heat decays out of sight — or across
  the causeway at low tide.
- **Missions and story**: five missions with dialogue, objectives, timers
  and rewards, then endless courier side jobs — plus a street race at the
  casino strip (three checkpoints, $300) and 12 golden shells to collect
  (HUD counter, minimap dots, $100 bonus for all twelve).
- **Combat**: fists and a pistol, goons who shoot back (a tough bruiser, a
  fast runner, and regulars), health/armor/ammo pickups, golden shells hidden
  on the beach and island.
- **HUD and minimap**: health, armor, money, shell count, stars, clock, tide
  gauge, speed, weapon, mission objective, and a live minimap.
- **Start and save**: title screen, pause menu, settings, and a localStorage
  save (money, missions, position, stats).
- **Polish**: day/night cycle with sunset and streetlights, headlights,
  synthesized engine/siren/gunshot sounds and a procedural music loop,
  particles, muzzle flashes, tire smoke and screen shake.

## Layout

- `game/index.html` — page, HUD DOM, import map for three.js.
- `game/style.css` — HUD and menu styling.
- `game/vendor/three.module.min.js` — vendored three.js r160.
- `game/src/` — one file per job: `config`, `random`, `audio`, `input`,
  `city`, `vehicles`, `peds`, `player`, `police`, `combat`, `missions`,
  `hud`, `effects`, `world`, `shots`, `main`.
- `main.ts` — hands the game in (copies `game/` + `screenshots/` to
  `/output`, writes `dossier.json`).
- `screenshots/` — four real renders of the game in a browser.

## Status (round 2)

v2 is complete and playable with every system above present. Round 2 added:
an on-foot combat screenshot (the drive shot was replaced), deeper M4/M5
staging (goon variety, mid-fight dialogue, a third guard on the armored
van), a street race side activity, a shell counter + minimap dots, softer
palm canopies, and a verified Tide Run: the causeway is only crossable at
low tide, police never follow onto it, and the bay itself is not drivable
or walkable. A debug-only `?probe=` mode checks those mechanics headlessly.

## License

MIT — see `LICENSE`.
