// Cars: boxy original models, arcade driving, and the traffic that
// follows the road graph. Police cruisers are cars too.
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';

const WHEEL_R = 0.36;

function lam(color, emissive = 0, intensity = 0) {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity });
}

export function buildCarMesh(type) {
  const spec = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = lam(spec.color);
  const glassMat = lam(0x1a2530);
  const darkMat = lam(0x1c1f24);
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.62, spec.length), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.25, 0.55, spec.length * 0.5), glassMat);
  cabin.position.set(0, 1.12, -spec.length * 0.06);
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.1, 0.18, spec.length * 0.22), bodyMat);
  hood.position.set(0, 0.92, spec.length * 0.36);
  g.add(hood);

  const front = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.22, 0.18), darkMat);
  front.position.set(0, 0.42, spec.length / 2);
  g.add(front);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.22, 0.18), darkMat);
  rear.position.set(0, 0.42, -spec.length / 2);
  g.add(rear);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lam(0xffffff, 0xfff6c8, 0.9));
  hl.position.set(-spec.width / 2 + 0.35, 0.62, spec.length / 2 + 0.02);
  const hr = hl.clone();
  hr.position.x = spec.width / 2 - 0.35;
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lam(0xcc2222, 0xff2222, 0.7));
  tl.position.set(-spec.width / 2 + 0.35, 0.62, -spec.length / 2 - 0.02);
  const tr = tl.clone();
  tr.position.x = spec.width / 2 - 0.35;
  g.add(hl, hr, tl, tr);

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), lam(0xf2c200, 0xf2c200, 0.4));
    sign.position.set(0, 1.5, 0);
    g.add(sign);
  }

  let lightBar = null;
  if (type === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lam(0xaa0000, 0xff0000, 1));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lam(0x0000aa, 0x2244ff, 1));
    blue.position.x = 0.35;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.48, 0);
    g.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.02, 0.3, spec.length * 0.7), lam(0x1a1a2e));
    stripe.position.y = 0.62;
    g.add(stripe);
  }

  const wheels = [];
  const steerWheels = [];
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 10);
  const wheelMat = lam(0x14161a);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
  const hubMat = lam(0x9aa0a8);
  const positions = [
    [-spec.width / 2, spec.length * 0.32, true],
    [spec.width / 2, spec.length * 0.32, true],
    [-spec.width / 2, -spec.length * 0.32, false],
    [spec.width / 2, -spec.length * 0.32, false],
  ];
  for (const [x, z, front] of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(tire, hub);
    g.add(pivot);
    wheels.push({ pivot, tire, hub });
    if (front) steerWheels.push(pivot);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return { group: g, wheels, steerWheels, lightBar, spec };
}

export function createCar(game, type, x, z, angle, opts = {}) {
  const built = buildCarMesh(type);
  built.group.position.set(x, 0, z);
  built.group.rotation.y = angle;
  game.scene.add(built.group);
  const car = {
    type,
    spec: CAR_TYPES[type],
    mesh: built.group,
    wheels: built.wheels,
    steerWheels: built.steerWheels,
    lightBar: built.lightBar,
    pos: built.group.position,
    angle,
    speed: 0,
    steer: 0,
    health: 100,
    isPlayer: false,
    isPolice: !!opts.police,
    isTraffic: !!opts.traffic,
    isParked: !!opts.parked,
    driver: opts.driver || null,
    edge: opts.edge || null,
    fromA: opts.fromA !== false,
    progress: 0,
    targetSpeed: opts.targetSpeed || 12,
    stuck: 0,
    smoke: 0,
  };
  game.cars.push(car);
  return car;
}

export function removeCar(game, car) {
  game.scene.remove(car.mesh);
  const i = game.cars.indexOf(car);
  if (i >= 0) game.cars.splice(i, 1);
}

/** Arcade driving: throttle -1..1, steer -1..1. */
export function driveCar(game, car, throttle, steerInput, dt) {
  const s = car.spec;
  const maxF = s.maxSpeed;
  const maxR = 10;
  if (throttle > 0) car.speed += s.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= s.brake * dt;
    else car.speed += s.accel * 0.7 * throttle * dt;
  } else {
    car.speed -= car.speed * 0.6 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
  const steerTarget = steerInput * s.steer * (1 - Math.min(0.55, Math.abs(car.speed) / maxF) * 0.6);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  if (Math.abs(car.speed) > 0.1) {
    const yaw = (car.speed / 2.6) * Math.tan(car.steer) * dt;
    car.angle += yaw * (car.speed >= 0 ? 1 : -1);
  }
  const fx = Math.sin(car.angle);
  const fz = Math.cos(car.angle);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  car.mesh.rotation.y = car.angle;

  for (const w of car.wheels) {
    w.tire.rotation.x += (car.speed / WHEEL_R) * dt;
    w.hub.rotation.x += (car.speed / WHEEL_R) * dt;
  }
  for (const p of car.steerWheels) p.rotation.y = car.steer;

  car.smoke = Math.max(0, car.smoke - dt);
  if (car.health < 40 && Math.abs(car.speed) > 2 && Math.random() < dt * 8) {
    car.smoke = 0.4;
    game.effects.spawnSmoke(game, car.pos.x, 1.4, car.pos.z, 1);
  }
  if (car.lightBar) {
    const on = Math.floor(game.time.elapsed * 6) % 2 === 0;
    car.lightBar.children[0].material.emissiveIntensity = on ? 2.2 : 0.2;
    car.lightBar.children[1].material.emissiveIntensity = on ? 0.2 : 2.2;
  }
}

export function collideCircleAABB(x, z, r, box) {
  const cx = Math.max(box.x0, Math.min(x, box.x1));
  const cz = Math.max(box.z0, Math.min(z, box.z1));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, nz: dz / d, depth: r - d };
  }

  const pl = x - box.x0;
  const pr = box.x1 - x;
  const pt = z - box.z0;
  const pb = box.z1 - z;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { nx: -1, nz: 0, depth: pl + r };
  if (m === pr) return { nx: 1, nz: 0, depth: pr + r };
  if (m === pt) return { nx: 0, nz: -1, depth: pt + r };
  return { nx: 0, nz: 1, depth: pb + r };
}

/** Push cars out of buildings and each other; returns true on a hard hit. */
export function collideCars(game, dt) {
  let hardHit = false;
  for (const car of game.cars) {
    car._crashCd = Math.max(0, (car._crashCd || 0) - dt);
    const r = car.spec.length * 0.42;
    for (const box of game.city.colliders) {
      const hit = collideCircleAABB(car.pos.x, car.pos.z, r, box);
      if (!hit) continue;
      car.pos.x += hit.nx * hit.depth;
      car.pos.z += hit.nz * hit.depth;
      const impact = Math.abs(car.speed);
      if (impact > 6) {
        car.speed *= 0.45;
        if (car._crashCd <= 0) {
          car.health -= impact * 0.4;
          car._crashCd = 0.6;
        }
        hardHit = true;
        game.effects.spawnSparks(game, car.pos.x, 0.8, car.pos.z, 6);
      } else {
        car.speed *= 0.92;
      }
    }

    if (car.pos.z > 540) {
      const dx = car.pos.x - 0;
      const dz = car.pos.z - 610;
      const d = Math.hypot(dx, dz);
      if (d > 54) {
        car.pos.x = (dx / d) * 54;
        car.pos.z = 610 + (dz / d) * 54;
        car.speed *= 0.5;
      }
    }
  }
  for (let i = 0; i < game.cars.length; i += 1) {
    for (let j = i + 1; j < game.cars.length; j += 1) {
      const a = game.cars[i];
      const b = game.cars[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 2.4;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 10) {
          a.speed *= 0.7;
          b.speed *= 0.7;
          if ((a._crashCd || 0) <= 0) {
            a.health -= rel * 0.25;
            a._crashCd = 1.0;
          }
          if ((b._crashCd || 0) <= 0) {
            b.health -= rel * 0.25;
            b._crashCd = 1.0;
          }
          hardHit = true;
        }
      }
    }
  }
  return hardHit;
}

/** Traffic: follow the road graph, right-hand lane, slow for cars ahead. */
export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (!car.isTraffic || car.isPlayer || car.isPolice) continue;
    if (!car.edge) continue;
    const edge = car.edge;
    const from = car.fromA ? edge.a : edge.b;
    const to = car.fromA ? edge.b : edge.a;
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    // Slow for a car ahead on the same edge.
    let want = car.targetSpeed;
    for (const other of game.cars) {
      if (other === car || other.isParked) continue;
      const ox = other.pos.x - car.pos.x;
      const oz = other.pos.z - car.pos.z;
      const fx = Math.sin(car.angle);
      const fz = Math.cos(car.angle);
      const ahead = ox * fx + oz * fz;
      const side = Math.abs(ox * fz - oz * fx);
      if (ahead > 0 && ahead < 11 && side < 3.2) want = Math.min(want, Math.max(0, (ahead - 5) * 0.8));
    }
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    car.progress += car.speed * dt;
    const off = game.city.laneOffset(edge, car.fromA);
    const t = Math.min(1, car.progress / len);
    car.pos.x = from.x + (to.x - from.x) * t + off.x;
    car.pos.z = from.z + (to.z - from.z) * t + off.z;
    car.angle = Math.atan2(to.x - from.x, to.z - from.z);
    car.mesh.rotation.y = car.angle;
    for (const w of car.wheels) {
      w.tire.rotation.x += (car.speed / WHEEL_R) * dt;
      w.hub.rotation.x += (car.speed / WHEEL_R) * dt;
    }
    if (car.progress >= len) {
      // Pick a new edge at the node we reached.
      const node = to;
      const options = node.edges.filter((e) => e !== edge);
      const next = options.length ? options[Math.floor(Math.random() * options.length)] : edge;
      car.edge = next;
      car.fromA = next.a === node;
      car.progress = 0;
    }
  }
}

export function nearestCar(game, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car.isPolice) continue;
    const d = Math.hypot(car.pos.x - x, car.pos.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function spawnTraffic(game, count, rng) {
  const types = ['sedan', 'taxi', 'hatch', 'sports', 'van'];
  for (let i = 0; i < count; i += 1) {
    const edge = game.city.edges[Math.floor(rng.next() * game.city.edges.length)];
    const fromA = rng.chance(0.5);
    const car = createCar(game, rng.pick(types), 0, 0, 0, {
      traffic: true,
      edge,
      fromA,
      targetSpeed: rng.range(9, 15),
    });
    car.progress = rng.range(0, 60);
  }
}

export function spawnParkedCars(game, rng) {
  const spots = [
    [-126, -20, 'sedan'],
    [42, -104, 'hatch'],
    [126, 104, 'sports'],
    [-42, 104, 'van'],
    [210, -188, 'sedan'],
    [-210, 232, 'truck'],
  ];
  for (const [x, z, type] of spots) {
    const car = createCar(game, type, x, z, rng.range(0, Math.PI * 2), { parked: true });
    car.speed = 0;
  }
}
