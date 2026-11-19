// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// sets up a real, seeded game state and plays it forward a few seconds with
// a scripted driver (cars start exactly on a road centreline and drive
// straight, so no steering is needed), so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import * as THREE from 'three';
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { addHeat } from './police.js';

export function stubInput() {
  return {
    moveX: () => 0,
    moveY: () => 1,
    isDown: (c) => c === 'KeyW' || c === 'ArrowUp',
    wasPressedAny: () => false,
    wasPressed: () => false,
    takeMouse: () => ({ dx: 0, dy: 0 }),
    takeClick: () => false,
    endFrame: () => {},
    lockPointer: () => {},
    unlockPointer: () => {},
    setSensitivity: () => {},
    pointerLocked: false,
    mouseHeld: false,
    axis: () => 0,
  };
}

/** Like stubInput, but standing still: for the on-foot shot, where the
 * player must hold her ground facing a goon instead of walking away. */
export function stubInputStill() {
  const s = stubInput();
  s.moveX = () => 0;
  s.moveY = () => 0;
  s.isDown = () => false;
  return s;
}

function putPlayerInCar(game, type, x, z, angle, speed) {
  const car = createCar(game, type, x, z, angle, { parked: true });
  car.isPlayer = true;
  car.isParked = false;
  car.speed = speed;
  const p = game.player;
  p.inCar = car;
  p.mesh.visible = false;
  p.angle = angle;
  p.camYaw = angle + Math.PI;
  return car;
}

function settle(game, seconds, stub) {
  // Play the world forward with the stub input so traffic and police settle
  // into frame before the screenshot is taken.
  const realInput = game.input;
  game.input = stub || stubInput();
  for (let i = 0; i < Math.floor(seconds / STEP); i += 1) {
    // The stub holds W, so the player car drives straight down its road.
    game.step(STEP);
  }
  game.input = realInput;
}

export function stageShot(name, game) {
  const p = game.player;
  if (name === 'drive') {
    game.time.clock = 150;
    putPlayerInCar(game, 'sports', 0, -200, 0, 24);
    // The city's own traffic (spawned at boot) already fills the road ahead.
    p.money = 1250;
    game.hud.setObjective('Free roam — explore Solara Bay');
    game.screen = 'play';
    settle(game, 2.5);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    game.time.clock = 178; // dusk: low orange sun, headlights on
    // The Big One: the casino take is ours, every cruiser in Solara on us.
    // Start mission 5, then jump to the escape step — the van is taken.
    game.missions.start(4);
    game.missions.current.step = 1;
    game.missions.setupStep(game);
    // The intro dialogue would typewriter over the road; the mission card
    // tells the story instead, so hide it outright.
    document.getElementById('dialogue').classList.add('hidden');
    game.hud.setObjective(`The Big One: ${game.missions.current.def.steps[1].label}`);
    // Armored van, southbound on the avenue, already running.
    putPlayerInCar(game, 'armored', 84, -140, 0, 22);
    addHeat(game, 700); // four stars — the helicopter joins at three
    p.money = 1250;
    game.screen = 'play';
    // Two cruisers staged flanking the player, close behind: from the
    // front-on camera they read big and clearly beside the van, not as
    // a speck on the horizon. (The wanted system spawns the rest.)
    const lead = createCar(game, 'police', 78, -150, 0, { police: true });
    lead.targetSpeed = 30;
    lead.speed = 30;
    const wing = createCar(game, 'police', 90, -152, 0, { police: true });
    wing.targetSpeed = 30;
    wing.speed = 28;
    game.police.cruisers.push(lead, wing);
    // Traffic on the avenue behind the van, so the street reads busy
    // instead of empty. (Edges set the way the mission van does it.)
    const t1 = createCar(game, 'taxi', 84, -160, 0, { traffic: true, targetSpeed: 14 });
    const t2 = createCar(game, 'sedan', 78, -190, 0, { traffic: true, targetSpeed: 12 });
    const t3 = createCar(game, 'hatch', 90, -150, 0, { traffic: true, targetSpeed: 16 });
    for (const tc of [t1, t2, t3]) {
      const node = game.city.nearestNode(tc.pos.x, tc.pos.z);
      const edge = node.edges[0];
      tc.edge = edge;
      tc.fromA = edge.a === node;
      tc.progress = 0;
    }
    // Front-on camera, closer in: the van fills more of the frame and
    // the flanking cruisers sit ~25 units from the lens, not ~40.
    game.shotCamera = (g) => {
      const car = g.player.inCar;
      if (!car) return null;
      const fx = Math.sin(car.angle);
      const fz = Math.cos(car.angle);
      return {
        pos: new THREE.Vector3(car.pos.x + fx * 14, 2.6, car.pos.z + fz * 14),
        look: new THREE.Vector3(car.pos.x - fx * 10, 1.2, car.pos.z - fz * 10),
      };
    };
    settle(game, 4);
    // Park the helicopter due north of the van, high in the frame, its
    // searchlight beam falling on the van.
    if (game.police.heli) game.police.heli.angle = -Math.PI / 2;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    game.time.clock = 150; // bright afternoon: the causeway, water and island read
    game.missions.start(2); // The Tide Run (its setup sets the tide; we re-set it low below)
    // Skip to the escape step: the package is "grabbed" and the car is
    // already running the causeway to the hideout.
    game.missions.current.step = 2;
    game.missions.setupStep(game);
    game.hud.setObjective(`The Tide Run: ${game.missions.current.def.steps[2].label}`);
    game.setTidePhase(4.2); // low tide: the causeway is open
    putPlayerInCar(game, 'sedan', 0, 220, 0, 22);
    p.money = 860;
    game.hud.finishDialogue(); // show the whole briefing line at once
    // The briefing box sits over the road's centre line at the bottom of
    // the frame; lift it into the empty sky under the objective pill.
    document.getElementById('dialogue').classList.add('top');
    game.screen = 'play';
    settle(game, 2);
    return { screen: 'play' };
  }
  if (name === 'onfoot') {
    game.time.clock = 155; // warm late afternoon: red jacket, gold light
    game.missions.start(3); // Kaine's Men — four varied goons ring the garage
    // Nia on foot in the open ground south of the garage, pistol drawn,
    // facing the nearest goon 8 units ahead; the garage is the backdrop,
    // not the whole frame. The goons hold their ground and face her.
    p.pos.set(-126, 0, -80);
    p.angle = 0;
    p.camYaw = Math.PI;
    p.camPitch = 0.32;
    p.weapon = 'pistol';
    p.mag.pistol = 12;
    p.ammo.pistol = 60;
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.angle;
    for (const goon of game.missions.current.spawned) {
      goon.speed = 0;
      goon.target = { x: p.pos.x, z: p.pos.z }; // face her, don't wander
      goon.angle = Math.atan2(p.pos.x - goon.pos.x, p.pos.z - goon.pos.z);
      goon.mesh.rotation.y = goon.angle;
    }
    // Pull the nearest goon out of the garage ring into the open, 5 units
    // in front of Nia, so the standoff reads at a glance.
    const nearest = game.missions.current.spawned.reduce((a, b) =>
      (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) <
        Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) ? a : b));
    nearest.pos.set(-126, 0, -75);
    nearest.angle = Math.atan2(p.pos.x - nearest.pos.x, p.pos.z - nearest.pos.z);
    nearest.mesh.position.copy(nearest.pos);
    nearest.mesh.rotation.y = nearest.angle;
    // The standoff's subject must read at a glance: give the nearest goon
    // a bright orange jacket — distinct from Nia's red one, loud against
    // the grass and the garage (staging only, mission variety untouched).
    const nud = nearest.mesh.userData;
    nud.torso.material.color.set(0xe67e22);
    nud.armL.material.color.set(0xe67e22);
    p.money = 1250;
    game.hud.finishDialogue(); // show the whole briefing line at once
    game.screen = 'play';
    // Over-the-shoulder, pulled in close: Nia lower-center, the goon big
    // enough to read (red jacket, health bar) with the garage behind him.
    game.shotCamera = (g) => {
      const pl = g.player;
      const fx = Math.sin(pl.angle);
      const fz = Math.cos(pl.angle);
      const rx = Math.cos(pl.angle);
      const rz = -Math.sin(pl.angle);
      return {
        pos: new THREE.Vector3(pl.pos.x - fx * 8 + rx * 2.5, 3.6, pl.pos.z - fz * 8 + rz * 2.5),
        look: new THREE.Vector3(pl.pos.x + fx * 8, 1.4, pl.pos.z + fz * 8),
      };
    };
    settle(game, 2, stubInputStill());
    // The goons fired during the settle: restore Nia to full health and
    // hold their fire, so the frame shows the standoff, not a losing fight.
    p.health = 100;
    for (const goon of game.missions.current.spawned) goon.shootTimer = 3600;
    return { screen: 'play' };
  }
  // start: the title screen over the city at golden hour.
  game.time.clock = 160;
  p.pos.set(-118, 0, -26);
  p.angle = Math.PI * 0.75;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.angle;
  game.screen = 'title';
  settle(game, 1);
  return { screen: 'title' };
}
