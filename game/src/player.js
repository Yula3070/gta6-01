// Nia Reyes on foot: a third-person character with WASD movement, mouse
// orbit camera, run and jump, and a simple low-poly body whose limbs swing.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), jeans);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), jacket);
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.72;
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.4), hair);
  hairTop.position.y = 1.94;
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.1), hair);
  hairBack.position.set(0, 1.72, -0.18);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), jacket);
  armL.position.set(-0.4, 1.16, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(legL, legR, torso, head, hairTop, hairBack, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPlayer(game, x, z) {
  const mesh = buildPlayerMesh();
  mesh.position.set(x, 0, z);
  game.scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    angle: 0,
    camYaw: 0,
    camPitch: 0.32,
    velY: 0,
    onGround: true,
    health: PLAYER.health,
    armor: 0,
    money: 250,
    inCar: null,
    weapon: 'fists',
    ammo: { pistol: 60 },
    mag: { pistol: 12 },
    reloading: 0,
    fireTimer: 0,
    punchTimer: 0,
    lastDamage: -99,
    walkPhase: 0,
  };
}

/** On-foot movement, relative to the camera yaw. Returns horizontal speed. */
export function updatePlayerOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  const mouse = input.takeMouse();
  p.camYaw -= mouse.dx * 0.0028;
  p.camPitch = Math.max(0.05, Math.min(1.1, p.camPitch + mouse.dy * 0.0028));
  const mx = input.moveX();
  const my = input.moveY();
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(p.camYaw);
  const cos = Math.cos(p.camYaw);
  // Forward is where the camera looks; right is 90 degrees clockwise.
  let dx = -sin * my + cos * mx;
  let dz = -cos * my - sin * mx;
  const len = Math.hypot(dx, dz);
  if (len > 0.01) {
    dx /= len;
    dz /= len;
    const accel = PLAYER.accel * dt;
    p.pos.x += dx * speed * dt;
    p.pos.z += dz * speed * dt;
    const want = Math.atan2(dx, dz);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += Math.max(-10 * dt, Math.min(10 * dt, diff));
    p.walkPhase += dt * speed * 1.6;
  }
  const ud = p.mesh.userData;
  const moving = len > 0.01;
  const swing = moving ? Math.sin(p.walkPhase) * (run ? 0.8 : 0.55) : 0;
  ud.legL.rotation.x = swing;
  ud.legR.rotation.x = -swing;
  ud.armL.rotation.x = -swing * 0.7;
  ud.armR.rotation.x = swing * 0.7;
  if (input.wasPressedAny(['Space']) && p.onGround) {
    p.velY = PLAYER.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.velY -= 22 * dt;
    p.pos.y += p.velY * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.velY = 0;
      p.onGround = true;
    }
  }
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.angle;
  return moving ? speed : 0;
}
