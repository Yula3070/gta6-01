// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between screens: title, play, paused, failed, busted and wasted.
// ?seed=N fixes the world seed. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, renders it and
// sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { createGame, resizeGame, stepGame } from './world.js';
import { stageShot, stubInput, stubInputStill } from './shots.js';
import { createCar } from './vehicles.js';
import { damageGoon } from './combat.js';
import { addHeat } from './police.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const probe = params.get('probe');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : undefined;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(canvas, seed);

// ?debug=1 writes the live state into the title, so a headless run can read
// it back with --dump-dom.
if (params.get('debug')) {
  window.__game = game;
  window.setInterval(() => {
    const p = game.player;
    const car = p.inCar;
    document.title = `DBG ${window.innerWidth}x${window.innerHeight} p(${p.pos.x.toFixed(0)},${p.pos.z.toFixed(0)}) car:${car ? `${car.type}@${car.pos.z.toFixed(0)} hp${car.health.toFixed(0)}` : 'none'} screen:${game.screen} clock:${game.time.clock.toFixed(0)} shotCam:${game.shotCamera ? 'Y' : 'N'} cam(${game.camera.position.x.toFixed(0)},${game.camera.position.y.toFixed(0)},${game.camera.position.z.toFixed(0)}) carAngle:${car ? car.angle.toFixed(2) : '-'}`;
  }, 500);
}

function announce(message) {
  status.textContent = message;
}

// ?probe=<name>&seed=N — debug-only scripted checks of the Tide Run
// mechanics. Runs synchronously at load, writes JSON results into the title,
// and never starts the game loop. The shipped game never uses it.
function runProbe(game, name) {
  const p = game.player;
  game.screen = 'play';
  game.hud.showScreen('play');
  const realInput = game.input;
  game.input = stubInput(); // holds W: drives straight ahead
  const results = { probe: name };
  const carAt = (x, z, angle, speed) => {
    const car = createCar(game, 'sedan', x, z, angle, { parked: true });
    car.isPlayer = true;
    car.isParked = false;
    car.speed = speed;
    p.inCar = car;
    p.mesh.visible = false;
    p.angle = angle;
    p.camYaw = angle + Math.PI;
    return car;
  };
  const stepSeconds = (s) => {
    for (let i = 0; i < Math.floor(s / STEP); i += 1) game.step(STEP);
  };
  if (name === 'tide-low' || name === 'tide-high' || name === 'tide-bypass') {
    game.setTidePhase(name === 'tide-high' ? 1.2 : 4.2);
    const x = name === 'tide-bypass' ? 50 : 0;
    const car = carAt(x, 280, 0, 12);
    const trace = [];
    for (let s = 0; s < 8; s += 1) {
      stepSeconds(1);
      trace.push(+p.pos.z.toFixed(1));
    }
    results.tide = +game.tide.level.toFixed(3);
    results.playerZ = +p.pos.z.toFixed(1);
    results.playerX = +p.pos.x.toFixed(1);
    results.speed = +car.speed.toFixed(1);
    results.health = +car.health.toFixed(0);
    results.trace = trace;
    if (name === 'tide-low') results.passed = p.pos.z > 400;
    else if (name === 'tide-high') results.passed = p.pos.z <= 296;
    else results.passed = p.pos.z <= 337; // must not drive around via the sea
  } else if (name === 'tide-cruiser') {
    game.setTidePhase(4.2); // low tide: the causeway is open to the player
    carAt(0, 420, 0, 0);
    addHeat(game, 500); // three stars
    stepSeconds(10);
    results.tide = +game.tide.level.toFixed(3);
    results.stars = game.police.stars;
    results.cruisers = game.police.cruisers.map((c) => ({ x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1) }));
    results.maxCruiserZ = results.cruisers.length ? Math.max(...results.cruisers.map((c) => c.z)) : -1;
    results.playerZ = +p.pos.z.toFixed(1);
    results.passed = results.cruisers.every((c) => c.z <= 296 || (c.z <= 336 && Math.abs(c.x) >= 9));
  } else if (name === 'roadblock') {
    const car = carAt(84, -100, 0, 0);
    p.pos.set(84, 0, -100);
    addHeat(game, 700); // four stars
    stepSeconds(2);
    const rb = game.police.roadblock;
    results.stars = game.police.stars;
    results.roadblock = !!rb;
    if (rb) {
      // Ram it head-on: line the car up on the first cruiser, 15 units out.
      const target = rb.cars[0];
      car.pos.set(target.pos.x, 0, target.pos.z - 15);
      p.pos.set(target.pos.x, 0, target.pos.z - 15);
      car.angle = 0;
      car.speed = 20;
      car.health = 100;
      car._crashCd = 0;
      for (const c of rb.cars) c._crashCd = 0;
      stepSeconds(1);
      results.healthAfter = +car.health.toFixed(0);
      results.speedAfter = +car.speed.toFixed(1);
      results.passed = results.stars >= 4 && results.healthAfter < 100 && results.speedAfter < 20;
    } else {
      results.passed = false;
    }
  } else if (name === 'm6') {
    const money0 = p.money;
    game.missions.start(5);
    results.started = !!game.missions.current;
    p.pos.set(-24, 0, 588); // step 1: reach the marina
    p.mesh.position.copy(p.pos);
    stepSeconds(0.2);
    const goons = game.missions.current
      ? [...game.missions.current.spawned.filter((s) => game.peds.includes(s))] : [];
    results.guards = goons.length;
    for (const g of goons) damageGoon(game, g, 999, p.pos); // step 2: guards down
    stepSeconds(0.2);
    const van = game.cars.find((c) => c.type === 'armored');
    if (van) { // step 3: steal the armored van
      van.isPlayer = true;
      van.isParked = false;
      p.inCar = van;
      p.mesh.visible = false;
    }
    stepSeconds(0.2);
    if (van) { // step 4: escape to the lighthouse
      van.pos.set(0, 0, 612);
      p.pos.set(0, 0, 612);
    }
    stepSeconds(0.2);
    results.done = game.missions.done.includes('m6');
    results.moneyDelta = Math.round(p.money - money0);
    results.passed = results.done && results.moneyDelta === 2500;
  } else if (name === 'race') {
    // Street race autopilot: W held, A/D steer at the next checkpoint
    // (the same steering law the police chase uses).
    const car = carAt(168, 168, -Math.PI / 2, 0);
    p.pos.set(168, 0, 168); // carAt does not sync the player position, and
    // raceEligible reads p.pos — sync it before the eligibility check.
    const money0 = p.money;
    game.missions.tryStartRace(game);
    results.started = !!game.missions.race;
    const raceInput = {
      ...stubInput(),
      isDown: (c) => {
        if (c === 'KeyW' || c === 'ArrowUp') return true;
        const r = game.missions.race;
        if (!r) return false;
        const cp = r.cps[r.idx];
        const want = Math.atan2(cp.x - car.pos.x, cp.z - car.pos.z);
        let diff = want - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 2.2));
        if (c === 'KeyA' || c === 'ArrowLeft') return steer > 0.05;
        if (c === 'KeyD' || c === 'ArrowRight') return steer < -0.05;
        return false;
      },
    };
    game.input = raceInput;
    stepSeconds(0.5); // let the HUD draw the minimap with the route line
    // Count route-line pixels on the minimap (route orange #ff5a3c; the
    // player arrow is the same colour, ~40 px, so >60 means the line drew).
    const mm = document.getElementById('minimap');
    const mctx = mm.getContext('2d');
    const img = mctx.getImageData(0, 0, 200, 200).data;
    let routePx = 0;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i] > 230 && img[i + 1] > 70 && img[i + 1] < 110 && img[i + 2] > 40 && img[i + 2] < 80) routePx += 1;
    }
    results.routeLinePixels = routePx;
    const t0 = game.time.elapsed;
    const cpsHit = [];
    const trace = [];
    let elapsed = 0;
    for (let s = 0; s < 150; s += 1) {
      const before = game.missions.race ? game.missions.race.idx : -1;
      const moneyBefore = p.money;
      stepSeconds(1);
      elapsed = +(game.time.elapsed - t0).toFixed(1);
      const r = game.missions.race;
      if (r && r.idx !== before) cpsHit.push({ cp: before + 1, t: elapsed });
      // The final checkpoint clears the race in the same step it pays
      // out, so r is null here — record it from the money jump instead.
      else if (!r && before === 2 && p.money > moneyBefore) cpsHit.push({ cp: 3, t: elapsed });
      if (s % 5 === 0) {
        trace.push({
          t: elapsed, x: +car.pos.x.toFixed(0), z: +car.pos.z.toFixed(0),
          speed: +car.speed.toFixed(1), health: +car.health.toFixed(0),
          stars: game.police.stars, idx: r ? r.idx : -1, screen: game.screen,
        });
      }
      if (!r) break;
    }
    results.checkpoints = cpsHit;
    results.trace = trace;
    results.elapsed = elapsed;
    results.moneyDelta = Math.round(p.money - money0);
    results.carHealth = +car.health.toFixed(0);
    results.playerPos = { x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1) };
    results.completed = cpsHit.length === 3 && results.moneyDelta >= 300;
    results.passed = results.completed && elapsed <= 150 && routePx > 60;
  } else if (name === 'shells') {
    // Teleport the player onto every shell in turn: the pickup check runs
    // every step, so each shell is collected on the first step after the hop.
    const money0 = p.money;
    const spots = game.pickups.filter((pk) => pk.type === 'shell').map((pk) => ({ x: pk.pos.x, z: pk.pos.z }));
    results.total = spots.length;
    for (const s of spots) {
      p.pos.set(s.x, 0, s.z);
      p.mesh.position.copy(p.pos);
      stepSeconds(0.2);
    }
    results.collected = game.stats.shells;
    results.moneyDelta = Math.round(p.money - money0);
    // 12 shells x $50 + $100 all-shells bonus = $700.
    results.passed = game.stats.shells === 12 && results.moneyDelta === 700;
  } else if (name === 'colliders') {
    // Debug: list every building collider in the garage staging area.
    results.colliders = game.city.colliders
      .filter((b) => b.x1 > -170 && b.x0 < -80 && b.z1 > -120 && b.z0 < -40)
      .map((b) => ({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 }));
  } else {
    results.error = `unknown probe ${name}`;
  }
  game.input = realInput;
  document.title = `PROBE ${JSON.stringify(results)}`;
  window.__probeResult = results;
}

function $(id) {
  return document.getElementById(id);
}

function showTitle() {
  game.screen = 'title';
  game.hud.showScreen('title');
  game.input.unlockPointer();
  const save = readSaveSummary();
  $('btn-continue').disabled = !save;
  $('continue-info').textContent = save
    ? `Continue — $${save.money} • ${save.done.length} mission${save.done.length === 1 ? '' : 's'} done`
    : 'No save yet';
  announce('Solara Bay. Press Enter or click New Game to start.');
}

function readSaveSummary() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function newGame() {
  const p = game.player;
  p.money = 250;
  p.health = 100;
  p.armor = 0;
  p.pos.set(-126, 0, -30);
  p.angle = 0;
  p.camYaw = Math.PI;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.angle;
  p.mesh.visible = true;
  if (p.inCar) {
    p.inCar.isPlayer = false;
    p.inCar = null;
  }
  game.missions.done = [];
  game.missions.index = 0;
  game.missions.current = null;
  game.stats.missionsDone = 0;
  game.stats.shells = 0;
  game.stats.playTime = 0;
  game.police.heat = 0;
  game.police.stars = 0;
  game.screen = 'play';
  game.hud.showScreen('play');
  game.audio.unlock();
  game.missions.start(0);
  announce('Playing. Follow the gold marker.');
}

function continueGame() {
  if (!game.loadGame()) return;
  game.screen = 'play';
  game.hud.showScreen('play');
  game.hud.setObjective(game.missions.index < game.missions.list.length
    ? 'Free roam — press M for the next mission'
    : 'Free roam — press M for a courier job');
  game.audio.unlock();
  announce('Playing. Welcome back to Solara Bay.');
}

function respawn() {
  const p = game.player;
  if (p.inCar) {
    p.inCar.isPlayer = false;
    p.inCar = null;
  }
  if (game.overReason === 'busted') p.pos.set(-42, 0, 112);
  else p.pos.set(206, 0, -196);
  p.health = 100;
  p.armor = 0;
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  p.pos.y = 0;
  game.police.heat = 0;
  game.police.stars = 0;
  game.screen = 'play';
  game.hud.showScreen('play');
  game.audio.unlock();
  announce('Playing.');
}

function runGame() {
  $('btn-new').addEventListener('click', () => {
    game.audio.unlock();
    game.audio.click();
    newGame();
  });
  $('btn-continue').addEventListener('click', () => {
    game.audio.unlock();
    game.audio.click();
    continueGame();
  });
  $('btn-howto').addEventListener('click', () => {
    game.audio.click();
    $('howto').classList.toggle('hidden');
  });
  $('btn-resume').addEventListener('click', () => {
    game.audio.click();
    game.screen = 'play';
    game.hud.showScreen('play');
  });
  $('btn-restart-mission').addEventListener('click', () => {
    game.audio.click();
    if (game.missions.current) {
      const idx = game.missions.index;
      game.missions.fail(game, 'restarted');
      game.hud.hideFailed();
      game.screen = 'play';
      game.hud.showScreen('play');
      game.missions.start(idx);
    } else if (game.missions.index < game.missions.list.length) {
      game.screen = 'play';
      game.hud.showScreen('play');
      game.missions.start(game.missions.index);
    } else {
      game.screen = 'play';
      game.hud.showScreen('play');
    }
  });
  $('btn-settings').addEventListener('click', () => {
    game.audio.click();
    $('settings').classList.toggle('hidden');
  });
  $('btn-quit-title').addEventListener('click', () => {
    game.audio.click();
    game.saveGame();
    showTitle();
  });
  $('btn-retry').addEventListener('click', () => {
    game.audio.click();
    game.hud.hideFailed();
    game.screen = 'play';
    game.hud.showScreen('play');
    game.missions.start(game.missions.index);
  });
  $('btn-freeroam').addEventListener('click', () => {
    game.audio.click();
    game.hud.hideFailed();
    game.screen = 'play';
    game.hud.showScreen('play');
    game.hud.setObjective('Free roam — press M for a courier job');
  });
  $('btn-over-ok').addEventListener('click', () => {
    game.audio.click();
    respawn();
  });
  $('set-sfx').addEventListener('input', (e) => {
    game.settings.sfx = Number(e.target.value);
    game.audio.setVolumes(game.settings.sfx, game.settings.music);
    game.saveSettings();
  });
  $('set-music').addEventListener('input', (e) => {
    game.settings.music = Number(e.target.value);
    game.audio.setVolumes(game.settings.sfx, game.settings.music);
    game.saveSettings();
  });
  $('set-sens').addEventListener('input', (e) => {
    game.settings.sensitivity = Number(e.target.value);
    game.input.setSensitivity(game.settings.sensitivity);
    game.saveSettings();
  });
  $('set-mute').addEventListener('change', (e) => {
    game.settings.muted = e.target.checked;
    game.audio.setMuted(game.settings.muted);
    game.saveSettings();
  });
  $('set-sfx').value = game.settings.sfx;
  $('set-music').value = game.settings.music;
  $('set-sens').value = game.settings.sensitivity;
  $('set-mute').checked = game.settings.muted;

  canvas.addEventListener('click', () => {
    if (game.screen === 'play') {
      game.input.lockPointer();
      game.audio.unlock();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.screen === 'title') newGame();
      else if (game.screen === 'busted' || game.screen === 'wasted') respawn();
      else if (game.screen === 'failed') {
        game.hud.hideFailed();
        game.screen = 'play';
        game.hud.showScreen('play');
        game.missions.start(game.missions.index);
      }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      game.hud.showScreen('pause');
      game.input.unlockPointer();
      game.audio.setEngine(0, 0);
    }
  });
  window.addEventListener('resize', () => resizeGame(game));

  showTitle();
  announce('Solara Bay. Press Enter or click New Game to start.');
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      stepGame(game, STEP);
      accumulator -= STEP;
    }
    game.renderer.render(game.scene, game.camera);
  }
  requestAnimationFrame(frame);
}

if (probe) {
  runProbe(game, probe);
} else if (shot) {
  const scene = stageShot(shot, game);
  game.hud.showScreen(scene.screen === 'title' ? 'title' : 'play');
  // The on-foot shot holds its ground; the driving shots hold W.
  game.input = shot === 'onfoot' ? stubInputStill() : stubInput();
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    stepGame(game, STEP);
    game.renderer.render(game.scene, game.camera);
    painted += 1;
    if (painted >= 2) window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  runGame();
}
