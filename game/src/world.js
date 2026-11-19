// The world: renderer, camera, lights, day/night, tide; steps every
// system in fixed 1/60 s slices. Also owns cars, busted/wasted, saves.
import * as THREE from 'three';
import { CAUSEWAY, DAY_LENGTH, NAMES, PALETTE, SAVE_KEY, SETTINGS_KEY, STEP, TIDE_PASSABLE, TIDE_PERIOD, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { buildCity } from './city.js';
import { collideCars, collideCircleAABB, createCar, driveCar, nearestCar, spawnParkedCars, spawnTraffic, updateTraffic } from './vehicles.js';
import { createPed, scarePeds, spawnPeds, updatePeds } from './peds.js';
import { createPlayer, updatePlayerOnFoot } from './player.js';
import { addHeat, clearWanted, createPolice, updatePolice } from './police.js';
import { damageGoon, punch, shoot, spawnPickup, updateCombat, updatePickups } from './combat.js';
import { createEffects } from './effects.js';
import { createMissions, spawnShells } from './missions.js';
import { createHud } from './hud.js';

const CAUSEWAY_BOX = { x0: CAUSEWAY.x0, z0: CAUSEWAY.z0, x1: CAUSEWAY.x1, z1: CAUSEWAY.z1 };

export function createGame(canvas, seed) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyDay);
  scene.fog = new THREE.Fog(PALETTE.fogDay, 120, 700);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
  camera.position.set(-140, 40, -60);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d9, 2.4);
  sun.position.set(-200, 160, 120);
  scene.add(sun);
  const headlight = new THREE.SpotLight(0xffe9a8, 0, 46, 0.55, 0.5, 1.2);
  scene.add(headlight);
  scene.add(headlight.target);

  const game = {
    renderer,
    scene,
    camera,
    rng: createRandom(seed !== undefined ? seed : (Math.random() * 4294967296) >>> 0),
    input: createInput(canvas),
    audio: createAudio(),
    cars: [],
    peds: [],
    pickups: [],
    screen: 'title',
    time: { elapsed: 0, clock: 160, nightFactor: 0 },
    tide: { phase: 1.2, level: 0.97, toNext: '' },
    stats: { missionsDone: 0, shells: 0, carsStolen: 0, playTime: 0 },
    settings: { sfx: 0.7, music: 0.35, sensitivity: 1, muted: false },
    shake: 0,
    overReason: '',
  };
  game.city = buildCity(scene, game.rng);
  game.effects = createEffects(scene);
  game.player = createPlayer(game, -126, -30);
  game.police = createPolice(game);
  game.missions = createMissions(game);
  game.hud = createHud(game);


  createCar(game, 'sedan', -126, -18, Math.PI, { parked: true });
  spawnParkedCars(game, game.rng);
  spawnTraffic(game, 12, game.rng);
  spawnPeds(game, 18);
  spawnPickup(game, 'health', 206, -196);
  spawnPickup(game, 'health', -38, 112);
  spawnPickup(game, 'ammo', -120, -52);
  spawnPickup(game, 'ammo', 120, 116);
  game.shellTotal = spawnShells(game);

  game.setTidePhase = (phase) => {
    game.tide.phase = phase;
  };
  game.step = (dt) => stepGame(game, dt);
  game.damagePlayer = (amount, fromPos) => {
    const p = game.player;
    if (game.screen !== 'play' || p.health <= 0) return;
    const absorbed = Math.min(p.armor, amount * 0.6);
    p.armor -= absorbed;
    p.health -= amount - absorbed;
    p.lastDamage = game.time.elapsed;
    game.hud.damageFlash();
    game.shake = Math.min(1, game.shake + 0.35);
    if (p.health <= 0) {
      p.health = 0;
      game.wasted();
    }
  };
  game.busted = () => {
    if (game.screen !== 'play') return;
    game.screen = 'busted';
    game.audio.busted();
    game.audio.setSiren(false, 999);
    game.player.money = Math.max(0, game.player.money - 200);
    game.hud.showScreen('over');
    document.getElementById('over-title').textContent = 'BUSTED';
    document.getElementById('over-sub').textContent = 'The Solara PD got you. -$200 fine. Press Enter to walk free.';
    game.overReason = 'busted';
    if (game.missions.current) game.missions.fail(game, 'busted by the police');
    game.saveGame();
  };
  game.wasted = () => {
    if (game.screen !== 'play') return;
    game.screen = 'wasted';
    game.audio.busted();
    game.audio.setSiren(false, 999);
    game.player.money = Math.max(0, game.player.money - 150);
    game.hud.showScreen('over');
    document.getElementById('over-title').textContent = 'WASTED';
    document.getElementById('over-sub').textContent = 'You woke up at St. Marina Hospital. -$150. Press Enter to get back out there.';
    game.overReason = 'wasted';
    if (game.missions.current) game.missions.fail(game, 'wasted');
    game.saveGame();
  };
  game.saveGame = () => {
    try {
      const p = game.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: p.money,
        done: game.missions.done,
        index: game.missions.index,
        x: p.pos.x,
        z: p.pos.z,
        health: p.health,
        shells: game.stats.shells,
        missionsDone: game.stats.missionsDone,
        playTime: game.stats.playTime,
      }));
    } catch {

    }
  };
  game.loadGame = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      game.player.money = s.money ?? 250;
      game.player.health = s.health ?? 100;
      game.player.pos.set(s.x ?? -126, 0, s.z ?? -30);
      game.missions.done = s.done || [];
      game.missions.index = s.index ?? 0;
      game.stats.shells = s.shells || 0;
      game.stats.missionsDone = s.missionsDone || 0;
      game.stats.playTime = s.playTime || 0;
      return true;
    } catch {
      return false;
    }
  };
  game.loadSettings = () => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      Object.assign(game.settings, s);
      game.audio.setVolumes(game.settings.sfx, game.settings.music);
      game.audio.setMuted(game.settings.muted);
      game.input.setSensitivity(game.settings.sensitivity);
    } catch {

    }
  };
  game.saveSettings = () => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(game.settings));
    } catch {

    }
  };
  game.loadSettings();
  return game;
}

function collidePlayer(game) {
  const p = game.player;
  const r = 0.45;
  const boxes = game.city.colliders;
  for (const box of boxes) {
    const hit = collideCircleAABB(p.pos.x, p.pos.z, r, box);
    if (hit) {
      p.pos.x += hit.nx * hit.depth;
      p.pos.z += hit.nz * hit.depth;
    }
  }

  if (p.pos.z > 540) {
    const dx = p.pos.x;
    const dz = p.pos.z - 610;
    const d = Math.hypot(dx, dz);
    if (d > 54) {
      p.pos.x = (dx / d) * 54;
      p.pos.z = 610 + (dz / d) * 54;
    }
  }

  if (game.tide.level > TIDE_PASSABLE) {
    if (Math.abs(p.pos.x) < CAUSEWAY.x1 + 1) {
      if (p._prevZ <= CAUSEWAY.z0 && p.pos.z > CAUSEWAY.z0) p.pos.z = CAUSEWAY.z0;
      else if (p._prevZ >= CAUSEWAY.z1 && p.pos.z < CAUSEWAY.z1) p.pos.z = CAUSEWAY.z1;
    }
  }
  // The bay walls stop the player at the waterline; only the causeway
  // gap and the island are crossable.
}

function enterCar(game) {
  const p = game.player;
  const car = nearestCar(game, p.pos.x, p.pos.z, 4.5);
  if (!car) return;
  const step = game.missions.current?.def.steps[game.missions.current.step];
  const isMissionCar = step && step.type === 'enterCar' && car.type === step.carType;
  if (car.isTraffic) {
    addHeat(game, WANTED.stealCar);
    game.stats.carsStolen += 1;
    game.hud.toast('Car stolen! The PD is on to you.');
    game.audio.crash();
  } else if (isMissionCar) {
    addHeat(game, WANTED.stealCar);
    game.hud.toast('Alarm! The PD is on to you.');
  }
  car.isPlayer = true;
  car.isTraffic = false;
  car.isParked = false;
  p.inCar = car;
  p.mesh.visible = false;
  game.audio.unlock();
}

function exitCar(game) {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  car.isPlayer = false;
  p.inCar = null;
  const rx = Math.cos(car.angle);
  const rz = -Math.sin(car.angle);
  p.pos.set(car.pos.x + rx * 2.8, 0, car.pos.z + rz * 2.8);
  p.angle = car.angle;
  p.camYaw = car.angle + Math.PI;
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.angle;
}

function updateCamera(game, dt) {
  const p = game.player;
  const cam = game.camera;
  // A staged screenshot may pin the camera (chase shot: front-on).
  if (game.shotCamera) {
    const shot = game.shotCamera(game);
    if (shot) {

      cam.position.copy(shot.pos);
      cam.lookAt(shot.look);
      return;
    }
  }
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  if (game.screen === 'title') {
    const t = game.time.elapsed * 0.045;
    target.set(Math.cos(t) * 200, 62, Math.sin(t) * 200 - 40);
    look.set(0, 8, 20);
  } else if (p.inCar) {
    const car = p.inCar;
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    const dist = 8.5 + Math.abs(car.speed) * 0.09;
    target.set(car.pos.x - fx * dist, 3.6, car.pos.z - fz * dist);
    look.set(car.pos.x + fx * 9, 1.4, car.pos.z + fz * 9);
    cam.fov += ((62 + Math.abs(car.speed) * 0.35) - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
  } else {
    const mouse = game.input.takeMouse();
    p.camYaw -= mouse.dx * 0.0028;
    p.camPitch = Math.max(0.05, Math.min(1.1, p.camPitch + mouse.dy * 0.0028));
    const dist = 6.5;
    const ox = Math.sin(p.camYaw);
    const oz = Math.cos(p.camYaw);
    target.set(p.pos.x + ox * dist, 2.6 + p.camPitch * 2.2, p.pos.z + oz * dist);
    look.set(p.pos.x - ox * 2, 1.6, p.pos.z - oz * 2);
    cam.fov += (62 - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
  }

  const k = 1 - Math.exp(-dt * (game.screen === 'title' ? 1.2 : 9));
  cam.position.lerp(target, k);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 1.4);
    const s = game.shake * game.shake * 0.5;
    cam.position.x += (Math.random() - 0.5) * s;
    cam.position.y += (Math.random() - 0.5) * s;
    cam.position.z += (Math.random() - 0.5) * s;
  }
  cam.lookAt(look);
}

function updateSky(game) {
  const dayFrac = (game.time.clock / DAY_LENGTH) % 1;
  const theta = (dayFrac - 0.25) * Math.PI * 2;
  const elev = Math.sin(theta);
  const night = Math.max(0, Math.min(1, (0.12 - elev) / 0.3));
  game.time.nightFactor = night;
  const sky = game.scene.background;
  const fog = game.scene.fog.color;
  if (elev > 0.28) {
    sky.copy(PALETTE.skyDay);
    fog.copy(PALETTE.fogDay);
  } else if (elev > -0.06) {
    const t = (0.28 - elev) / 0.34;
    sky.copy(PALETTE.skyDay).lerp(PALETTE.skySunset, t);
    fog.copy(PALETTE.fogDay).lerp(PALETTE.skySunset, t);
  } else {
    const t = Math.min(1, (-0.06 - elev) / 0.2);
    sky.copy(PALETTE.skySunset).lerp(PALETTE.skyNight, t);
    fog.copy(PALETTE.skySunset).lerp(PALETTE.fogNight, t);
  }
  const sun = game.scene.children.find((o) => o.isDirectionalLight);
  if (sun) {
    sun.position.set(Math.cos(theta) * 320, Math.max(30, elev * 320), 140);
    sun.intensity = 2.4 * (1 - night) + 0.12 * night;
    sun.color.copy(PALETTE.sunDay).lerp(PALETTE.sunNight, night);
  }
  const hemi = game.scene.children.find((o) => o.isHemisphereLight);
  if (hemi) hemi.intensity = 0.9 * (1 - night) + 0.22 * night;
}

function updateTide(game, dt) {
  game.tide.phase += (dt * Math.PI * 2) / TIDE_PERIOD;
  const level = (Math.sin(game.tide.phase) + 1) / 2;
  game.tide.level = level;
  game.city.flood.visible = level > TIDE_PASSABLE;

  let toNext = 0;
  for (let s = 5; s <= TIDE_PERIOD; s += 5) {
    const l = (Math.sin(game.tide.phase + (s * Math.PI * 2) / TIDE_PERIOD) + 1) / 2;
    if ((level < TIDE_PASSABLE && l >= TIDE_PASSABLE) || (level >= TIDE_PASSABLE && l < TIDE_PASSABLE)) {
      toNext = s;
      break;
    }
  }
  const m = Math.floor(toNext / 60);
  const sec = String(toNext % 60).padStart(2, '0');
  game.tide.toNext = `${m}:${sec}`;
}

export function stepGame(game, dt) {
  const p = game.player;
  game.time.elapsed += dt;
  if (game.screen === 'title') {
    game.time.clock = (game.time.clock + dt) % DAY_LENGTH;
    updateSky(game);
    updateTide(game, dt);
    updateTraffic(game, dt);
    updatePeds(game, dt);
    game.city.update(dt, game.time.elapsed, game.time.nightFactor);
    game.effects.update(dt);
    updateCamera(game, dt);
    game.input.endFrame();
    return;
  }
  if (game.screen !== 'play') {
    game.effects.update(dt);
    updateCamera(game, dt);
    game.input.endFrame();
    return;
  }
  game.time.clock = (game.time.clock + dt) % DAY_LENGTH;
  game.stats.playTime += dt;
  p._prevZ = p.pos.z;
  const prevCarZ = p.inCar ? p.inCar.pos.z : 0;


  if (game.input.wasPressedAny(['Escape', 'KeyP'])) {
    game.screen = 'paused';
    game.hud.showScreen('pause');
    game.input.unlockPointer();
    game.audio.setEngine(0, 0);
    game.input.endFrame();
    return;
  }
  if (game.input.wasPressedAny(['KeyM'])) {
    if (game.missions.current) {

    } else if (game.missions.race) {
      game.missions.cancelRace(game);
    } else if (game.missions.index < game.missions.list.length) {
      game.missions.start(game.missions.index);
    } else if (!game.missions.sideJob) {
      game.missions.startSideJob(game);
    } else {
      game.missions.sideJob = null;
      game.missions.updateMarker(game);
      game.hud.setObjective('Free roam — press M for a courier job');
    }
  }
  if (game.input.wasPressedAny(['KeyG'])) {
    game.missions.tryStartRace(game);
  }
  if (game.input.wasPressedAny(['KeyE'])) {
    if (p.inCar) exitCar(game);
    else enterCar(game);
  }
  if (game.input.wasPressedAny(['Digit1'])) p.weapon = 'fists';
  if (game.input.wasPressedAny(['Digit2'])) {
    p.weapon = 'pistol';
    game.audio.unlock();
  }
  if (game.input.wasPressedAny(['KeyR']) && p.weapon === 'pistol' && p.mag.pistol < 12 && p.ammo.pistol > 0) {
    p.reloading = 1.2;
  }
  if (game.input.wasPressedAny(['KeyF'])) punch(game);
  if (game.input.takeClick() && p.weapon === 'pistol') shoot(game);
  if (game.input.isDown('KeyH') && p.inCar) {

    if (Math.random() < dt * 2) game.audio.click();
  }


  if (p.inCar) {
    const car = p.inCar;
    const throttle = (game.input.isDown('KeyW') || game.input.isDown('ArrowUp') ? 1 : 0)
      - (game.input.isDown('KeyS') || game.input.isDown('ArrowDown') ? 1 : 0);
    const steer = (game.input.isDown('KeyA') || game.input.isDown('ArrowLeft') ? 1 : 0)
      - (game.input.isDown('KeyD') || game.input.isDown('ArrowRight') ? 1 : 0);
    const handbrake = game.input.isDown('Space');
    driveCar(game, car, handbrake ? (car.speed > 0 ? -1 : 0) : throttle, steer, dt);
    // The player rides with the car, so the position must track it.
    p.pos.x = car.pos.x;
    p.pos.z = car.pos.z;
    p.angle = car.angle;

    if (game.tide.level > TIDE_PASSABLE && Math.abs(car.pos.x) < CAUSEWAY.x1 + 1) {
      if (prevCarZ <= CAUSEWAY.z0 && car.pos.z > CAUSEWAY.z0) {
        car.pos.z = CAUSEWAY.z0;
        car.speed *= 0.3;
      } else if (prevCarZ >= CAUSEWAY.z1 && car.pos.z < CAUSEWAY.z1) {
        car.pos.z = CAUSEWAY.z1;
        car.speed *= 0.3;
      }
    }
    // The bay walls stop cars at the waterline; only the causeway gap
    // is crossable, at low tide.
    game.audio.setEngine(Math.abs(car.speed) / car.spec.maxSpeed, Math.abs(throttle));

    const headlight = game.scene.children.find((o) => o.isSpotLight);
    if (headlight) {
      const fx = Math.sin(car.angle);
      const fz = Math.cos(car.angle);
      headlight.position.set(car.pos.x + fx * 2, 1.2, car.pos.z + fz * 2);
      headlight.target.position.set(car.pos.x + fx * 30, 0.4, car.pos.z + fz * 30);
      headlight.intensity = game.time.nightFactor * 160;
    }

    for (const ped of [...game.peds]) {
      if (ped.isCop || ped.isGoon) continue;
      const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
      if (d < 2.4 && Math.abs(car.speed) > 4 && !ped._hitCooldown) {
        ped._hitCooldown = 1.5;
        ped.health -= 60;
        ped.pos.x += (ped.pos.x - car.pos.x) * 0.8;
        ped.pos.z += (ped.pos.z - car.pos.z) * 0.8;
        ped.state = 'flee';
        ped.fleeFrom = { x: car.pos.x, z: car.pos.z };
        if (ped.health <= 0) {
          addHeat(game, WANTED.killPed);
          game.scene.remove(ped.mesh);
          game.peds.splice(game.peds.indexOf(ped), 1);
        } else {
          addHeat(game, WANTED.hitPed);
        }
        game.audio.crash();
        game.effects.spawnSparks(game, ped.pos.x, 1.2, ped.pos.z, 6);
        scarePeds(game, car.pos.x, car.pos.z, 25);
      }
    }
  } else {
    updatePlayerOnFoot(game, dt);
    game.audio.setEngine(0, 0);
    const headlight = game.scene.children.find((o) => o.isSpotLight);
    if (headlight) headlight.intensity = 0;
  }
  for (const ped of game.peds) {
    if (ped._hitCooldown) ped._hitCooldown = Math.max(0, ped._hitCooldown - dt);
  }


  collidePlayer(game);
  for (const car of game.cars) {
    if (car.isPlayer) continue;

    if (!p.inCar && Math.abs(car.speed) > 4) {
      const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
      if (d < 2.2) game.damagePlayer(game, 14, car.pos);
    }
  }
  const hardHit = collideCars(game, dt);
  if (hardHit && p.inCar) {
    game.audio.crash();
    game.shake = Math.min(1, game.shake + 0.3);

    for (const c of game.police.cruisers) {
      if (Math.hypot(c.pos.x - p.inCar.pos.x, c.pos.z - p.inCar.pos.z) < 4) {
        addHeat(game, WANTED.hitCop);
        break;
      }
    }
  }

  if (p.inCar && p.inCar.health <= 0) {
    p.inCar.speed = 0;
    p.inCar.isTraffic = false;
    game.hud.toast('Your car is wrecked!');
    exitCar(game);
  }
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateCombat(game, dt);
  game.missions.update(game, dt);
  updatePickups(game, dt);
  game.effects.update(dt);


  if (game.time.elapsed - p.lastDamage > 8 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 2 * dt);
  }

  if (!p.inCar) {
    const car = nearestCar(game, p.pos.x, p.pos.z, 4.5);
    game.hud.setPrompt(car ? (car.isTraffic ? 'E — Steal car' : 'E — Enter car') : '');
  } else {
    game.hud.setPrompt('E — Leave car');
  }
  if (game.missions.raceEligible(game)) game.hud.setPrompt('G — Street race ($300)');

  updateSky(game);
  updateTide(game, dt);
  game.city.update(dt, game.time.elapsed, game.time.nightFactor);
  updateCamera(game, dt);
  game.hud.update(dt);
  game.input.endFrame();
}

export function resizeGame(game) {
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
  game.renderer.setSize(window.innerWidth, window.innerHeight);
}
