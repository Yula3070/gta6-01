// Solara Bay, handed in: a Node 22 program, standard library only, that
// copies the game and its screenshots to /output and writes the dossier the
// judge reads. The game itself is plain static files under game/; the
// screenshots are real renders of it in a browser.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  throw new Error(`solara-bay main.ts: ${message}`);
}

if (!existsSync(join(here, 'game', 'index.html'))) fail('game/index.html is missing');
if (!existsSync(join(here, 'screenshots'))) fail('screenshots/ is missing');

const shotNames = ['1-start.jpg', '2-onfoot.jpg', '3-chase.jpg', '4-mission.jpg'];
for (const name of shotNames) {
  const file = join(here, 'screenshots', name);
  if (!existsSync(file)) fail(`screenshots/${name} is missing`);
  if (statSync(file).size > 262144) fail(`screenshots/${name} is over 256 KiB`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: game/ at most 993 files and 48 MiB, index.html at
// most 1 MiB, screenshots at most 4 files of 256 KiB each.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
