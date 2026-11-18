// Cheap particles: one THREE.Points cloud per burst type, recycled.
// Sparks for impacts, smoke for damaged cars, and a muzzle flash light.
import * as THREE from 'three';

export function createEffects(scene) {
  const pools = [];
  function makePool(color, size, count) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    const pool = { points, vel: new Float32Array(count * 3), life: new Float32Array(count), count, next: 0 };
    pools.push(pool);
    return pool;
  }
  const sparks = makePool(0xffc46b, 0.32, 240);
  const smoke = makePool(0x888888, 1.1, 160);
  const flash = new THREE.PointLight(0xffe9a8, 0, 14, 1.8);
  scene.add(flash);
  let flashTimer = 0;

  function spawn(pool, x, y, z, n, spread, up) {
    for (let k = 0; k < n; k += 1) {
      const i = pool.next;
      pool.next = (pool.next + 1) % pool.count;
      pool.life[i] = 0.5 + Math.random() * 0.4;
      pool.points.geometry.attributes.position.array[i * 3] = x;
      pool.points.geometry.attributes.position.array[i * 3 + 1] = y;
      pool.points.geometry.attributes.position.array[i * 3 + 2] = z;
      pool.vel[i * 3] = (Math.random() - 0.5) * spread;
      pool.vel[i * 3 + 1] = Math.random() * up;
      pool.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    pool.points.geometry.attributes.position.needsUpdate = true;
  }

  return {
    spawnSparks(game, x, y, z, n) {
      spawn(sparks, x, y, z, n || 8, 7, 4);
    },
    spawnSmoke(game, x, y, z, n) {
      spawn(smoke, x, y, z, n || 1, 1.2, 1.6);
    },
    muzzleFlash(x, y, z) {
      flash.position.set(x, y, z);
      flash.intensity = 26;
      flashTimer = 0.06;
    },
    update(dt) {
      for (const pool of pools) {
        const pa = pool.points.geometry.attributes.position.array;
        for (let i = 0; i < pool.count; i += 1) {
          if (pool.life[i] <= 0) {
            pa[i * 3 + 1] = -100;
            continue;
          }
          pool.life[i] -= dt;
          pa[i * 3] += pool.vel[i * 3] * dt;
          pa[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
          pa[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
          pool.vel[i * 3 + 1] -= 4 * dt;
        }
        pool.points.geometry.attributes.position.needsUpdate = true;
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) flash.intensity = 0;
      }
    },
  };
}
