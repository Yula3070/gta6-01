// The wanted system: heat from crimes, stars, police cruisers that chase and
// ram, foot cops that close in, a police helicopter with a searchlight at
// three stars and up, and getting busted when they catch the player standing
// still. Losing the heat (out of sight, or the tide causeway the cruisers
// will not follow) clears the stars.
import * as THREE from 'three';
import { CAUSEWAY, WANTED, WATER_Z } from './config.js';
import { createCar, driveCar, removeCar } from './vehicles.js';
import { createPed, removePed } from './peds.js';

export function createPolice(game) {
  return {
    heat: 0,
    stars: 0,
    cruisers: [],
    footCops: [],
    heli: null, // { group, rotor, beacon, angle } while stars >= 3
    bustedTimer: 0,
    lastSeenTimer: 0,
    sirenOn: false,
  };
}

/** Police helicopter: navy body, tail boom, spinning main rotor, a flashing
 * red beacon, and a searchlight cone that leans down onto the player. Built
 * from the same box/cylinder primitives as the cars — no new assets. */
function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a3a5c });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 5.2), bodyMat);
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.8), glassMat);
  cabin.position.set(0, 0.15, 1.6);
  g.add(cabin);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.2), bodyMat);
  tail.position.set(0, 0.25, -4.2);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 1.0), bodyMat);
  fin.position.set(0, 0.9, -6.0);
  g.add(fin);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4.0), darkMat);
  skidL.position.set(-0.9, -1.0, 0);
  const skidR = skidL.clone();
  skidR.position.x = 0.9;
  g.add(skidL, skidR);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), darkMat);
  mast.position.y = 1.1;
  g.add(mast);
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(9.5, 0.07, 0.45);
  const b1 = new THREE.Mesh(bladeGeo, darkMat);
  const b2 = new THREE.Mesh(bladeGeo, darkMat);
  b2.rotation.y = Math.PI / 2;
  rotor.add(b1, b2);
  rotor.position.y = 1.6;
  g.add(rotor);
  // Flashing red beacon on the roof.
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 1 }),
  );
  beacon.position.set(0, 0.85, -1.5);
  g.add(beacon);
  // Searchlight: a narrow shaft from the helicopter down onto the player
  // (orbit radius 20, height 15, so the beam leans atan(20/15) off vertical).
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 25, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.set(0, -7.5, 10);
  beam.rotation.x = -Math.atan2(20, 15);
  g.add(beam);
  return { group: g, rotor, beacon, angle: -Math.PI / 2 };
}

function spawnHeli(game) {
  const h = makeHeliMesh();
  const p = game.player;
  h.group.position.set(p.pos.x, 15, p.pos.z - 20);
  game.scene.add(h.group);
  return h;
}

function removeHeli(game) {
  const h = game.police.heli;
  if (!h) return;
  game.scene.remove(h.group);
  game.police.heli = null;
}

export function addHeat(game, amount) {
  const p = game.police;
  p.heat = Math.min(WANTED.perStar * WANTED.maxStars, p.heat + amount);
  const stars = Math.min(WANTED.maxStars, Math.floor(p.heat / WANTED.perStar) + (p.heat > 0 ? 1 : 0));
  if (stars > p.stars) {
    p.stars = stars;
    game.hud.flashWanted();
  } else {
    p.stars = stars;
  }
}

export function clearWanted(game) {
  const p = game.police;
  p.heat = 0;
  p.stars = 0;
  for (const c of [...p.cruisers]) removeCar(game, c);
  p.cruisers = [];
  for (const c of [...p.footCops]) removePed(game, c);
  p.footCops = [];
  removeHeli(game);
  p.bustedTimer = 0;
  game.audio.setSiren(false, 999);
}

function spawnCruiser(game) {
  const p = game.player;
  const a = Math.random() * Math.PI * 2;
  const d = 55 + Math.random() * 25;
  let x = p.pos.x + Math.cos(a) * d;
  let z = p.pos.z + Math.sin(a) * d;
  // Keep the spawn on a road: snap to the nearest intersection.
  const node = game.city.nearestNode(x, z);
  x = node.x;
  z = node.z;
  const car = createCar(game, 'police', x, z, Math.atan2(p.pos.x - x, p.pos.z - z), { police: true });
  car.targetSpeed = 30;
  game.police.cruisers.push(car);
  return car;
}

function spawnFootCop(game) {
  const p = game.player;
  const a = Math.random() * Math.PI * 2;
  const x = p.pos.x + Math.cos(a) * 14;
  const z = p.pos.z + Math.sin(a) * 14;
  const cop = createPed(game, x, z, { shirt: 0x1a3a5c, pants: 0x1a1a1a, speed: 4.4, cop: true });
  game.police.footCops.push(cop);
  return cop;
}

export function updatePolice(game, dt) {
  const p = game.police;
  const player = game.player;
  const wanted = p.stars;
  // Spawn pressure follows the stars: one cruiser per star, foot cops at 2+.
  const wantCruisers = Math.min(wanted, 4);
  while (p.cruisers.length < wantCruisers) spawnCruiser(game);
  while (p.cruisers.length > wantCruisers) removeCar(game, p.cruisers.pop());
  const wantCops = wanted >= 2 ? wanted - 1 : 0;
  while (p.footCops.length < wantCops) spawnFootCop(game);
  while (p.footCops.length > wantCops) removePed(game, p.footCops.pop());

  // Police helicopter: joins at three stars, circles above the player with
  // its searchlight on, leaves when the heat drops below three.
  if (wanted >= 3 && !p.heli) p.heli = spawnHeli(game);
  if (wanted < 3 && p.heli) removeHeli(game);
  if (p.heli) {
    const h = p.heli;
    h.angle += dt * 0.32;
    const px = player.pos.x;
    const pz = player.pos.z;
    h.group.position.set(px + Math.cos(h.angle) * 20, 15, pz + Math.sin(h.angle) * 20);
    h.group.rotation.y = Math.atan2(px - h.group.position.x, pz - h.group.position.z);
    h.rotor.rotation.y += dt * 16;
    h.beacon.material.emissiveIntensity = Math.floor(game.time.elapsed * 3) % 2 === 0 ? 2.0 : 0.2;
  }

  // Heat decays only while no police is close enough to see the player.
  let nearest = Infinity;
  for (const c of p.cruisers) nearest = Math.min(nearest, Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z));
  for (const c of p.footCops) nearest = Math.min(nearest, Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z));
  if (wanted > 0) {
    if (nearest > 60) {
      p.heat = Math.max(0, p.heat - WANTED.decay * dt);
      p.stars = p.heat <= 0 ? 0 : Math.min(WANTED.maxStars, Math.floor(p.heat / WANTED.perStar) + 1);
      if (p.stars === 0) {
        for (const c of [...p.cruisers]) removeCar(game, c);
        p.cruisers = [];
        for (const c of [...p.footCops]) removePed(game, c);
        p.footCops = [];
      }
    }
    p.lastSeenTimer = nearest < 45 ? 0 : p.lastSeenTimer + dt;
  }

  // Cruisers chase: steer at the player, ram, and never follow across the
  // causeway or into the bay.
  for (const c of p.cruisers) {
    const dx = player.pos.x - c.pos.x;
    const dz = player.pos.z - c.pos.z;
    const d = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    let throttle = 1;
    if (d < 6) throttle = 0.6;
    driveCar(game, c, throttle, steer, dt);
    // The causeway is a wall for cruisers, at any tide: the tide is the
    // player's escape. (The bay walls stop them at the waterline elsewhere.)
    if (c.pos.z > CAUSEWAY.z0 && c.pos.z < CAUSEWAY.z1 && Math.abs(c.pos.x) < CAUSEWAY.x1 + 2) {
      c.pos.z = CAUSEWAY.z0;
      c.speed *= 0.3;
    }
    // Ramming the player on foot hurts.
    if (!player.inCar && d < 2.6 && Math.abs(c.speed) > 4) {
      game.damagePlayer(game, 12, c.pos);
    }
  }

  // Foot cops run at the player and grab them.
  for (const cop of p.footCops) {
    const dx = player.pos.x - cop.pos.x;
    const dz = player.pos.z - cop.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      cop.angle = Math.atan2(dx, dz);
      cop.pos.x += Math.sin(cop.angle) * cop.speed * dt;
      cop.pos.z += Math.cos(cop.angle) * cop.speed * dt;
      cop.mesh.rotation.y = cop.angle;
      cop.walkPhase += dt * 12;
      const ud = cop.mesh.userData;
      const swing = Math.sin(cop.walkPhase) * 0.7;
      ud.legL.rotation.x = swing;
      ud.legR.rotation.x = -swing;
    }
    // Foot cops wait at the shore too: no following onto the causeway or bay.
    if (cop.pos.z > CAUSEWAY.z0 && cop.pos.z < CAUSEWAY.z1 && Math.abs(cop.pos.x) < CAUSEWAY.x1 + 2) {
      cop.pos.z = CAUSEWAY.z0;
    } else if (cop.pos.z > WATER_Z && cop.pos.z < CAUSEWAY.z1 && Math.abs(cop.pos.x) >= CAUSEWAY.x1 + 1) {
      cop.pos.z = WATER_Z;
    }
    if (d < 2.2 && !player.inCar) {
      game.damagePlayer(game, 6 * dt, cop.pos);
    }
  }

  // Busted: a cop close by while the player is slow or on foot.
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
  const standingStill = player.inCar ? playerSpeed < 1.5 : true;
  if (wanted > 0 && nearest < 5 && standingStill) {
    p.bustedTimer += dt;
    if (p.bustedTimer > 2.5) game.busted(game);
  } else {
    p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
  }

  // Siren volume follows the nearest cruiser.
  const sirenOn = p.cruisers.length > 0;
  if (sirenOn !== p.sirenOn) {
    p.sirenOn = sirenOn;
    game.audio.setSiren(sirenOn, nearest);
  } else if (sirenOn) {
    game.audio.setSiren(true, nearest);
  }
}
