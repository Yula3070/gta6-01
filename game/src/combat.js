// Combat: fists and a pistol, goons who shoot back, and pickups.
// Shooting is a raycast from the camera; goons use timed, inaccurate fire.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { scarePeds } from './peds.js';

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

function muzzlePos(game) {
  const p = game.player;
  if (p.inCar) return new THREE.Vector3(p.inCar.pos.x, 1.4, p.inCar.pos.z);
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  return new THREE.Vector3(p.pos.x + fx * 0.7, 1.45, p.pos.z + fz * 0.7);
}

function tracer(game, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  game.scene.add(line);
  game.effects._tracers = game.effects._tracers || [];
  game.effects._tracers.push({ line, t: 0.07 });
}

export function shoot(game) {
  const p = game.player;
  if (p.weapon !== 'pistol') return;
  if (p.fireTimer > 0 || p.reloading > 0) return;
  if (p.mag.pistol <= 0) {
    game.audio.click();
    p.reloading = 1.2;
    return;
  }
  p.fireTimer = WEAPONS.pistol.rate;
  p.mag.pistol -= 1;
  game.audio.shoot();
  game.camera.getWorldDirection(_dir);
  _ray.set(game.camera.position, _dir);
  _ray.far = WEAPONS.pistol.range;
  const targets = [];
  for (const ped of game.peds) if (ped.isGoon) targets.push(ped.mesh);
  for (const car of game.cars) targets.push(car.mesh);
  targets.push(game.city.buildings);
  const hits = _ray.intersectObjects(targets, true);
  const from = muzzlePos(game);
  game.effects.muzzleFlash(from.x, from.y, from.z);
  if (!hits.length) {
    tracer(game, from, from.clone().add(_dir.clone().multiplyScalar(60)));
    return;
  }
  const hit = hits[0];
  tracer(game, from, hit.point);
  game.effects.spawnSparks(game, hit.point.x, hit.point.y, hit.point.z, 5);
  // Walk up the hit object to its ped or car.
  let obj = hit.object;
  let ped = null;
  let car = null;
  while (obj) {
    for (const q of game.peds) if (q.mesh === obj) ped = q;
    for (const c of game.cars) if (c.mesh === obj) car = c;
    obj = obj.parent;
  }
  if (ped) {
    damageGoon(game, ped, WEAPONS.pistol.damage, p.pos);
  } else if (car) {
    car.health -= WEAPONS.pistol.damage;
    if (car.health <= 0 && car.isTraffic) {
      car.isTraffic = false;
      car.targetSpeed = 0;
      game.effects.spawnSmoke(game, car.pos.x, 1.4, car.pos.z, 4);
    }
  }
  scarePeds(game, p.pos.x, p.pos.z, 30);
}

export function punch(game) {
  const p = game.player;
  if (p.punchTimer > 0) return;
  p.punchTimer = WEAPONS.fists.rate;
  game.audio.punch();
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  for (const ped of game.peds) {
    if (!ped.isGoon && !ped.isCop) continue;
    const dx = ped.pos.x - p.pos.x;
    const dz = ped.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < WEAPONS.fists.range && dx * fx + dz * fz > 0) {
      damageGoon(game, ped, WEAPONS.fists.damage, p.pos);
      ped.pos.x += (dx / (d || 1)) * 0.8;
      ped.pos.z += (dz / (d || 1)) * 0.8;
    }
  }
}

export function damageGoon(game, ped, amount, fromPos) {
  ped.health -= amount;
  game.effects.spawnSparks(game, ped.pos.x, 1.4, ped.pos.z, 4);
  game.audio.hit();
  if (ped.health <= 0) {
    game.missions.onGoonDown(game, ped);
    spawnPickup(game, Math.random() < 0.5 ? 'cash' : 'ammo', ped.pos.x, ped.pos.z);
    const idx = game.peds.indexOf(ped);
    if (idx >= 0) {
      game.scene.remove(ped.mesh);
      game.peds.splice(idx, 1);
    }
  } else {
    // A hurt goon turns and shoots back.
    ped.state = 'flee';
    ped.fleeFrom = fromPos;
    ped.shootTimer = 0.4;
  }
}

const PICKUP_COLORS = { health: 0x2ecc71, ammo: 0xf1c40f, cash: 0x27ae60, shell: 0xffd700 };
export function spawnPickup(game, type, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: PICKUP_COLORS[type] || 0xffffff, emissive: PICKUP_COLORS[type] || 0xffffff, emissiveIntensity: 0.5 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
  mesh.position.set(x, 0.7, z);
  mesh.rotation.y = Math.PI / 4;
  game.scene.add(mesh);
  game.pickups.push({ type, mesh, pos: mesh.position, spin: 0 });
}

export function updatePickups(game, dt) {
  const p = game.player;
  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const pk = game.pickups[i];
    pk.spin += dt * 2;
    pk.mesh.rotation.y = pk.spin;
    pk.mesh.position.y = 0.7 + Math.sin(pk.spin * 2) * 0.12;
    const d = Math.hypot(pk.pos.x - p.pos.x, pk.pos.z - p.pos.z);
    if (d < 1.6 && p.pos.y < 2) {
      if (pk.type === 'health') p.health = Math.min(100, p.health + 40);
      else if (pk.type === 'ammo') p.ammo.pistol += 24;
      else if (pk.type === 'cash') {
        p.money += 100;
        game.audio.cash();
      } else if (pk.type === 'shell') {
        p.money += 50;
        game.stats.shells += 1;
        game.audio.cash();
        if (game.stats.shells >= (game.shellTotal || 12)) {
          p.money += 100;
          game.hud.toast('All shells found +$100 bonus!');
        } else {
          game.hud.toast('Golden shell +$50');
        }
      }
      if (pk.type !== 'cash' && pk.type !== 'shell') game.audio.pickup();
      game.scene.remove(pk.mesh);
      game.pickups.splice(i, 1);
      if (pk.type !== 'shell') {
        game.hud.toast(pk.type === 'health' ? '+40 health' : pk.type === 'ammo' ? '+24 ammo' : '+$100');
      }
    }
  }
}

/** Goons fire back with timed, inaccurate shots; reload/fire timers tick. */
export function updateCombat(game, dt) {
  const p = game.player;
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = WEAPONS.pistol.mag - p.mag.pistol;
      const take = Math.min(need, p.ammo.pistol);
      p.mag.pistol += take;
      p.ammo.pistol -= take;
    }
  }
  for (const ped of [...game.peds]) {
    if (!ped.isGoon || ped.health <= 0) continue;
    ped.shootTimer -= dt;
    const d = Math.hypot(ped.pos.x - p.pos.x, ped.pos.z - p.pos.z);
    if (ped.shootTimer <= 0 && d < 38) {
      ped.shootTimer = 0.9 + Math.random() * 0.7;
      const from = new THREE.Vector3(ped.pos.x, 1.45, ped.pos.z);
      game.audio.shoot();
      tracer(game, from, new THREE.Vector3(p.pos.x, 1.3, p.pos.z));
      // Inaccurate: closer goons hit more often.
      if (Math.random() < Math.max(0.12, 0.5 - d / 90)) {
        game.damagePlayer(game, 7, ped.pos);
      }
      scarePeds(game, ped.pos.x, ped.pos.z, 20);
    }
  }
  // Fade tracers.
  const tracers = game.effects._tracers || [];
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const t = tracers[i];
    t.t -= dt;
    t.line.material.opacity = Math.max(0, t.t / 0.07) * 0.9;
    if (t.t <= 0) {
      game.scene.remove(t.line);
      tracers.splice(i, 1);
    }
  }
}
