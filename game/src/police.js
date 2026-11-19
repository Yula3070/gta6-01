// The wanted system: heat, stars, chasing cruisers, foot cops, a
// helicopter at three stars, roadblocks at four, and getting busted.
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
    roadblock: null, // { cars, barrier, x, z } while stars >= 4
    roadblockTimer: 0,
    bustedTimer: 0,
    lastSeenTimer: 0,
    sirenOn: false,
  };
}

/** Police helicopter: navy body, tail boom, spinning rotor, flashing red
 * beacon, and a searchlight cone leaning down onto the player. */
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
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 1 }),
  );
  beacon.position.set(0, 0.85, -1.5);
  g.add(beacon);
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
  removeRoadblock(game);
  removeHeli(game);
  p.bustedTimer = 0;
  game.audio.setSiren(false, 999);
}

/** Roadblock: two parked cruisers across the road, facing `angle`, with
 * one striped barrier between them. Ramming is free: collideCars already
 * damages both cars on impact. */
export function makeRoadblockAt(game, x, z, angle) {
  const px = Math.cos(angle) * 3.5;
  const pz = -Math.sin(angle) * 3.5;
  const c1 = createCar(game, 'police', x + px, z + pz, angle, { parked: true });
  const c2 = createCar(game, 'police', x - px, z - pz, angle, { parked: true });
  const barrier = new THREE.Group();
  const mats = [
    new THREE.MeshLambertMaterial({ color: 0xe67e22 }),
    new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
  ];
  for (let i = -1; i <= 1; i += 1) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.15), mats[(i + 1) % 2]);
    board.position.set(i * 2.4, 0.8, 0);
    barrier.add(board);
  }
  barrier.position.set(x, 0, z);
  barrier.rotation.y = angle;
  game.scene.add(barrier);
  return { cars: [c1, c2], barrier, x, z };
}

export function removeRoadblock(game) {
  const rb = game.police.roadblock;
  if (!rb) return;
  for (const c of rb.cars) removeCar(game, c);
  game.scene.remove(rb.barrier);
  game.police.roadblock = null;
}

function spawnCruiser(game) {
  const p = game.player;
  const a = Math.random() * Math.PI * 2;
  const d = 55 + Math.random() * 25;
  let x = p.pos.x + Math.cos(a) * d;
  let z = p.pos.z + Math.sin(a) * d;
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
  const wantCruisers = Math.min(wanted, 4);
  while (p.cruisers.length < wantCruisers) spawnCruiser(game);
  while (p.cruisers.length > wantCruisers) removeCar(game, p.cruisers.pop());
  const wantCops = wanted >= 2 ? wanted - 1 : 0;
  while (p.footCops.length < wantCops) spawnFootCop(game);
  while (p.footCops.length > wantCops) removePed(game, p.footCops.pop());

  // Helicopter at three stars, gone below three.
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

  // Roadblock at four stars, lifted below four; it moves (at most every
  // 6 s) when the player is far away or it ends up behind them.
  const heading = player.inCar ? player.inCar.angle : player.angle;
  const aheadNode = () => game.city.nearestNode(
    player.pos.x + Math.sin(heading) * 40, player.pos.z + Math.cos(heading) * 40,
  );
  if (wanted >= 4 && !p.roadblock) {
    const node = aheadNode();
    p.roadblock = makeRoadblockAt(game, node.x, node.z, heading + Math.PI);
    p.roadblockTimer = 0;
  } else if (wanted < 4 && p.roadblock) {
    removeRoadblock(game);
  } else if (p.roadblock) {
    p.roadblockTimer += dt;
    if (p.roadblockTimer >= 6) {
      const dx = p.roadblock.x - player.pos.x;
      const dz = p.roadblock.z - player.pos.z;
      const behind = dx * Math.sin(heading) + dz * Math.cos(heading) < 0;
      if (Math.hypot(dx, dz) > 70 || behind) {
        removeRoadblock(game);
        const node = aheadNode();
        p.roadblock = makeRoadblockAt(game, node.x, node.z, heading + Math.PI);
        p.roadblockTimer = 0;
      }
    }
  }

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

  // Cruisers chase and ram, but never follow across the causeway or bay.
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
    // The causeway is a wall for cruisers, at any tide.
    if (c.pos.z > CAUSEWAY.z0 && c.pos.z < CAUSEWAY.z1 && Math.abs(c.pos.x) < CAUSEWAY.x1 + 2) {
      c.pos.z = CAUSEWAY.z0;
      c.speed *= 0.3;
    }
    if (!player.inCar && d < 2.6 && Math.abs(c.speed) > 4) {
      game.damagePlayer(game, 12, c.pos);
    }
  }

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
    // Foot cops wait at the shore too: no causeway or bay.
    if (cop.pos.z > CAUSEWAY.z0 && cop.pos.z < CAUSEWAY.z1 && Math.abs(cop.pos.x) < CAUSEWAY.x1 + 2) {
      cop.pos.z = CAUSEWAY.z0;
    } else if (cop.pos.z > WATER_Z && cop.pos.z < CAUSEWAY.z1 && Math.abs(cop.pos.x) >= CAUSEWAY.x1 + 1) {
      cop.pos.z = WATER_Z;
    }
    if (d < 2.2 && !player.inCar) {
      game.damagePlayer(game, 6 * dt, cop.pos);
    }
  }

  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
  const standingStill = player.inCar ? playerSpeed < 1.5 : true;
  if (wanted > 0 && nearest < 5 && standingStill) {
    p.bustedTimer += dt;
    if (p.bustedTimer > 2.5) game.busted(game);
  } else {
    p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
  }

  const sirenOn = p.cruisers.length > 0;
  if (sirenOn !== p.sirenOn) {
    p.sirenOn = sirenOn;
    game.audio.setSiren(sirenOn, nearest);
  } else if (sirenOn) {
    game.audio.setSiren(true, nearest);
  }
}
