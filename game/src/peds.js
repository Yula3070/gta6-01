// Pedestrians: they stroll the sidewalks, cross at intersections, and flee
// from gunfire and speeding cars. A few carry guns when a mission arms them.
import * as THREE from 'three';
import { ROADS, ROAD_WIDTH } from './config.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];
const SKINS = [0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d, 0xe0ac69];
const PANTS = [0x2c3e50, 0x34495e, 0x5d6d7e, 0x1a1a1a];

export function buildPedMesh(shirt, skin, pants) {
  const g = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.7;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.4, 1.16, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(legL, legR, torso, head, armL, armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export function createPed(game, x, z, opts = {}) {
  const rng = game.rng;
  const mesh = buildPedMesh(
    opts.shirt ?? SHIRTS[Math.floor(rng.next() * SHIRTS.length)],
    opts.skin ?? SKINS[Math.floor(rng.next() * SKINS.length)],
    opts.pants ?? PANTS[Math.floor(rng.next() * PANTS.length)],
  );
  mesh.position.set(x, 0, z);
  game.scene.add(mesh);
  const ped = {
    mesh,
    pos: mesh.position,
    angle: rng.range(0, Math.PI * 2),
    speed: opts.speed || rng.range(1.2, 2.2),
    target: null,
    state: 'walk',
    fleeFrom: null,
    health: opts.health || 100,
    armed: !!opts.armed,
    isGoon: !!opts.goon,
    isCop: !!opts.cop,
    shootTimer: 0,
    walkPhase: rng.range(0, Math.PI * 2),
    bar: null,
  };
  if (opts.goon || opts.armed) {
    // A small health bar above the head, two thin boxes.
    const bg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    const fg = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.07, 0.03), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    bg.position.y = 2.15;
    fg.position.y = 2.15;
    fg.position.z = 0.02;
    mesh.add(bg, fg);
    ped.bar = fg;
  }
  game.peds.push(ped);
  return ped;
}

export function removePed(game, ped) {
  game.scene.remove(ped.mesh);
  const i = game.peds.indexOf(ped);
  if (i >= 0) game.peds.splice(i, 1);
}

function pickSidewalkTarget(game, ped) {
  // A random point on a sidewalk: beside a random road, at a random spot.
  const road = ROADS[Math.floor(Math.random() * ROADS.length)];
  const along = (Math.random() * 2 - 1) * 280;
  const side = Math.random() < 0.5 ? -1 : 1;
  const off = ROAD_WIDTH / 2 + 2.5 + Math.random() * 2;
  if (Math.random() < 0.5) return { x: road + side * off, z: along };
  return { x: along, z: road + side * off };
}

export function updatePeds(game, dt) {
  for (const ped of game.peds) {
    const ud = ped.mesh.userData;
    let tx = ped.pos.x;
    let tz = ped.pos.z;
    let speed = ped.speed;
    if (ped.state === 'flee' && ped.fleeFrom) {
      const dx = ped.pos.x - ped.fleeFrom.x;
      const dz = ped.pos.z - ped.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = ped.pos.x + (dx / d) * 20;
      tz = ped.pos.z + (dz / d) * 20;
      speed = 5.2;
      if (d > 40) {
        ped.state = 'walk';
        ped.target = null;
      }
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z) < 1.5) {
        ped.target = pickSidewalkTarget(game, ped);
      }
      tx = ped.target.x;
      tz = ped.target.z;
    }
    const dx = tx - ped.pos.x;
    const dz = tz - ped.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const want = Math.atan2(dx, dz);
      let diff = want - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      ped.pos.x += Math.sin(ped.angle) * speed * dt;
      ped.pos.z += Math.cos(ped.angle) * speed * dt;
      ped.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ud.legL.rotation.x = swing;
      ud.legR.rotation.x = -swing;
      ud.armL.rotation.x = -swing * 0.7;
      ud.armR.rotation.x = swing * 0.7;
    } else {
      ud.legL.rotation.x = 0;
      ud.legR.rotation.x = 0;
      ud.armL.rotation.x = 0;
      ud.armR.rotation.x = 0;
    }
    ped.mesh.rotation.y = ped.angle;
    if (ped.bar) {
      ped.bar.scale.x = Math.max(0.01, ped.health / 100);
      ped.bar.position.x = -(1 - ped.health / 100) * 0.48;
    }
  }
}

/** Make nearby peds run from a point (gunshot, crash). */
export function scarePeds(game, x, z, radius) {
  for (const ped of game.peds) {
    if (ped.isGoon || ped.isCop) continue;
    const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeFrom = { x, z };
    }
  }
}

export function spawnPeds(game, count) {
  for (let i = 0; i < count; i += 1) {
    const road = ROADS[Math.floor(game.rng.next() * ROADS.length)];
    const along = game.rng.range(-270, 270);
    const side = game.rng.chance(0.5) ? -1 : 1;
    const off = ROAD_WIDTH / 2 + 2.5 + game.rng.range(0, 2);
    if (game.rng.chance(0.5)) createPed(game, road + side * off, along);
    else createPed(game, along, road + side * off);
  }
}
