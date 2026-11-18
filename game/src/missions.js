// The story of Solara Bay: five missions from courier to crew legend, plus
// endless courier side jobs once the story is done. Missions are data — a
// list of steps — driven by one small controller.
import * as THREE from 'three';
import { ECONOMY, NAMES } from './config.js';
import { addHeat } from './police.js';
import { createCar, driveCar } from './vehicles.js';
import { createPed, removePed } from './peds.js';
import { spawnPickup } from './combat.js';

const GARAGE = { x: -126, z: -42 };
const DINER = { x: 42, z: -126 };
const CASINO = { x: 126, z: 126 };
const MARINA = { x: -24, z: 588 };
const HIDEOUT = { x: 0, z: 612 };

/** Street race: start line by the casino, three checkpoints around the city. */
const RACE_START = { x: 168, z: 168 };
const RACE_CPS = [
  { x: -168, z: 168 },
  { x: -168, z: -168 },
  { x: 168, z: -168 },
];
const RACE_REWARD = 300;
const RACE_TIME = 150;

export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Delivery',
    giver: NAMES.giver,
    intro: "Nia, love — the lunch rush is on and my delivery scooter died. Take your sedan, get this order to the marina kiosk before it goes cold. Drive careful, the PD is twitchy today.",
    outro: "Hot food, happy customer. You've got a steady hand, Nia. Come back when you want real work.",
    steps: [{ type: 'goto', x: -210, z: 210, radius: 10, label: 'Deliver the order to the marina' }],
    timeLimit: 150,
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    giver: NAMES.brother,
    intro: "That yellow sports car outside the casino? It's mine now — long story. Boost it and bring it to the garage. The alarm will scream, so expect company.",
    outro: "She purrs. Kaine's boys will be looking for this one — keep your head down.",
    steps: [
      { type: 'enterCar', carType: 'sports', x: 126, z: 104, radius: 12, label: 'Steal the yellow sports car at the casino' },
      { type: 'deliver', x: GARAGE.x, z: GARAGE.z, radius: 12, label: 'Deliver the car to Reyes Garage', carType: 'sports' },
    ],
    timeLimit: 180,
  },
  {
    id: 'm3',
    title: 'The Tide Run',
    giver: NAMES.fixer,
    intro: "A package is waiting at the marina. Kaine's men want it too. Grab it, then run the causeway at low tide — the cruisers can't follow you across the sandbar. Watch the tide gauge.",
    outro: "Clean. The tide did the running for you. Kaine's going to hate this.",
    steps: [
      { type: 'goto', x: MARINA.x, z: MARINA.z, radius: 8, label: 'Reach the marina pickup' },
      { type: 'pickup', x: MARINA.x, z: MARINA.z, radius: 4, label: 'Press E to grab the package' },
      { type: 'goto', x: HIDEOUT.x, z: HIDEOUT.z, radius: 10, label: 'Escape across the causeway to the hideout' },
    ],
    timeLimit: 210,
  },
  {
    id: 'm4',
    title: "Kaine's Men",
    giver: NAMES.brother,
    intro: "They came for the garage, Nia. Four of Kaine's goons, armed. Hold them off — and when their van runs, chase it down and wreck it. No mercy, they've earned it.",
    outro: "Garage is still standing. Kaine just lost four men and a van. He's coming for us now.",
    steps: [
      { type: 'defeat', count: 4, label: 'Defend the garage — take down 4 goons' },
      { type: 'chase', label: 'Chase the getaway van and wreck it' },
    ],
    timeLimit: 300,
  },
  {
    id: 'm5',
    title: 'The Big One',
    giver: NAMES.fixer,
    intro: "Kaine's armored van leaves the casino at dusk, full of the week's take. Take it. Every cruiser in Solara will be on you — so take the causeway and don't stop. This is the one, Nia.",
    outro: "It's done. The whole take, and Kaine can't touch us. You're a legend of Solara Bay now, Nia Reyes.",
    steps: [
      { type: 'enterCar', carType: 'armored', x: 150, z: 148, radius: 12, label: 'Steal the armored van at the casino' },
      { type: 'deliver', x: HIDEOUT.x, z: HIDEOUT.z, radius: 12, label: 'Escape to the hideout with the take', carType: 'armored' },
    ],
    timeLimit: 300,
  },
];

function makeBeacon(game) {
  const group = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  cyl.position.y = 30;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd700 }),
  );
  gem.position.y = 6;
  group.add(cyl, gem);
  group.visible = false;
  game.scene.add(group);
  return { group, gem, cyl };
}

export function createMissions(game) {
  const beacon = makeBeacon(game);
  return {
    list: MISSIONS,
    index: 0,
    done: [],
    current: null,
    beacon,
    sideJob: null,
    race: null, // { cps, idx, timer, reward } while a street race runs
    marker: null, // {x, z} for the minimap
    start(index) {
      const def = MISSIONS[index];
      if (!def) return false;
      const current = { def, step: 0, timer: def.timeLimit, goonsLeft: 0, van: null, spawned: [] };
      this.current = current;
      game.hud.showDialogue(def.giver, def.intro);
      game.hud.setObjective(`${def.title}: ${def.steps[0].label}`);
      game.audio.missionDone();
      this.setupStep(game);
      return true;
    },
    setupStep(game) {
      const c = this.current;
      if (!c) return;
      const step = c.def.steps[c.step];
      if (!step) return;
      if (step.type === 'defeat') {
        c.goonsLeft = step.count;
        // Goon variety: a tough bruiser, a fast runner, two regulars.
        const VARIETY = [
          { shirt: 0x5b2c6f, health: 150, speed: 2.8 },
          { shirt: 0x7b241c, health: 80, speed: 4.4 },
          { shirt: 0x1a1a1a, health: 100, speed: 3.4 },
          { shirt: 0x1f618d, health: 100, speed: 3.4 },
        ];
        for (let i = 0; i < step.count; i += 1) {
          const a = (i / step.count) * Math.PI * 2;
          const v = VARIETY[i % VARIETY.length];
          const goon = createPed(game, GARAGE.x + Math.cos(a) * 14, GARAGE.z + Math.sin(a) * 14, {
            shirt: v.shirt, pants: 0x1a1a1a, armed: true, goon: true, health: v.health, speed: v.speed,
          });
          c.spawned.push(goon);
        }
      }
      if (step.type === 'chase') {
        const van = createCar(game, 'van', GARAGE.x + 26, GARAGE.z - 18, 0, { traffic: true, targetSpeed: 20 });
        van.health = 150;
        van.isTraffic = true;
        // Point it at the nearest road and let traffic AI drive it away.
        const node = game.city.nearestNode(van.pos.x, van.pos.z);
        const edge = node.edges[0];
        van.edge = edge;
        van.fromA = edge.a === node;
        van.progress = 0;
        c.van = van;
        c.spawned.push(van);
      }
      if (c.def.id === 'm5' && step.type === 'enterCar') {
        const van = createCar(game, 'armored', 150, 148, Math.PI / 2, { parked: true });
        c.spawned.push(van);
        // Three guards: a runner, a regular, and a tough enforcer.
        const GUARDS = [
          { x: 146, z: 142, shirt: 0x7b241c, health: 80, speed: 4.4 },
          { x: 152, z: 142, shirt: 0x1a1a1a, health: 100, speed: 3.4 },
          { x: 149, z: 154, shirt: 0x5b2c6f, health: 150, speed: 2.8 },
        ];
        for (const g of GUARDS) {
          const goon = createPed(game, g.x, g.z, { shirt: g.shirt, pants: 0x1a1a1a, armed: true, goon: true, health: g.health, speed: g.speed });
          c.spawned.push(goon);
        }
        c.goonsLeft = 3;
      }
      if (c.def.id === 'm3' && c.step === 0) {
        game.setTidePhase(3.0); // low tide starts a few seconds in
      }
      this.updateMarker(game);
    },
    updateMarker(game) {
      const c = this.current;
      if (!c) {
        this.marker = null;
        this.beacon.group.visible = false;
        return;
      }
      const step = c.def.steps[c.step];
      if (!step || step.type === 'defeat' || step.type === 'chase') {
        this.marker = null;
        this.beacon.group.visible = false;
        return;
      }
      this.marker = { x: step.x, z: step.z };
      this.beacon.group.position.set(step.x, 0, step.z);
      this.beacon.group.visible = true;
    },
    advance(game) {
      const c = this.current;
      if (!c) return;
      const prevStep = c.step;
      c.step += 1;
      if (c.step >= c.def.steps.length) {
        this.complete(game);
        return;
      }
      const step = c.def.steps[c.step];
      game.hud.setObjective(`${c.def.title}: ${step.label}`);
      game.hud.toast('Objective updated');
      // M5: the van is taken — the fixer warns the whole city is coming.
      if (c.def.id === 'm5' && prevStep === 0) {
        game.hud.showDialogue(NAMES.fixer, "The whole take is yours — now run! Every cruiser in Solara will be on you. Take the causeway and don't stop!");
      }
      this.setupStep(game);
    },
    complete(game) {
      const c = this.current;
      const reward = ECONOMY.missionRewards[this.index] || 200;
      game.player.money += reward;
      game.audio.missionDone();
      game.hud.showDialogue(c.def.giver, `${c.def.outro} (+$${reward})`);
      game.hud.setObjective('Mission complete — press M for the next job');
      this.done.push(c.def.id);
      this.current = null;
      this.index += 1;
      this.updateMarker(game);
      game.stats.missionsDone += 1;
      game.saveGame();
    },
    fail(game, reason) {
      const c = this.current;
      if (!c) return;
      for (const s of c.spawned) {
        if (game.peds.includes(s)) removePed(game, s);
        else if (game.cars.includes(s)) {
          const i = game.cars.indexOf(s);
          if (i >= 0) game.cars.splice(i, 1);
          game.scene.remove(s.mesh);
        }
      }
      this.current = null;
      this.updateMarker(game);
      game.audio.missionFail();
      game.hud.showDialogue('Solara Bay', `Mission failed — ${reason}. Press M to try again.`);
      game.hud.setObjective('Mission failed — press M to retry');
      // A busted/wasted screen already owns the overlay; don't cover it.
      if (game.screen === 'play') {
        game.screen = 'failed';
        game.hud.showFailed(reason);
      }
    },
    onGoonDown(game, ped) {
      const c = this.current;
      if (!c) return;
      if (c.def.id === 'm4' && c.step === 0) {
        c.goonsLeft -= 1;
        game.hud.setObjective(`${c.def.title}: ${c.goonsLeft} goons left`);
        // Mid-fight checkpoint: Leo warns the getaway van is coming.
        if (c.goonsLeft === 2) {
          game.hud.showDialogue(NAMES.brother, "Two down, Nia! The van's coming — get ready to run it down!");
        }
        if (c.goonsLeft <= 0) this.advance(game);
      } else if (c.def.id === 'm5' && c.step === 0) {
        c.goonsLeft -= 1;
      }
    },
    startSideJob(game) {
      const a = game.city.nearestNode((Math.random() * 2 - 1) * 240, (Math.random() * 2 - 1) * 240);
      const b = game.city.nearestNode((Math.random() * 2 - 1) * 240, (Math.random() * 2 - 1) * 240);
      const reward = 80 + Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / 10);
      this.sideJob = { ax: a.x, az: a.z, bx: b.x, bz: b.z, reward, timer: 150, phase: 'pickup' };
      this.marker = { x: a.x, z: a.z };
      this.beacon.group.position.set(a.x, 0, a.z);
      this.beacon.group.visible = true;
      game.hud.setObjective(`Courier run: pick up the package ($${reward})`);
      game.hud.toast('New courier job — press M to cancel');
    },
    /** Street race: in a car, at the start line by the casino, no other job. */
    raceEligible(game) {
      const p = game.player;
      return !!p.inCar && !this.current && !this.sideJob && !this.race
        && Math.hypot(p.pos.x - RACE_START.x, p.pos.z - RACE_START.z) < 12;
    },
    tryStartRace(game) {
      if (this.race || !this.raceEligible(game)) return;
      this.race = { cps: RACE_CPS, idx: 0, timer: RACE_TIME, reward: RACE_REWARD };
      this.marker = { x: RACE_CPS[0].x, z: RACE_CPS[0].z };
      this.beacon.group.position.set(RACE_CPS[0].x, 0, RACE_CPS[0].z);
      this.beacon.group.visible = true;
      game.hud.setObjective(`Street race: checkpoint 1/${RACE_CPS.length} — $${RACE_REWARD}`);
      game.hud.toast('Street race — hit the gold markers!');
      game.audio.missionDone();
    },
    cancelRace(game) {
      if (!this.race) return;
      this.race = null;
      this.updateMarker(game);
      game.hud.setObjective('Free roam — press M for a courier job');
      game.hud.toast('Race cancelled');
    },
    update(game, dt) {
      // Beacon pulse.
      if (this.beacon.group.visible) {
        this.beacon.gem.rotation.y += dt * 2;
        this.beacon.gem.position.y = 6 + Math.sin(game.time.elapsed * 2.5) * 0.8;
      }
      const c = this.current;
      if (c) {
        c.timer -= dt;
        if (c.timer <= 0) {
          this.fail(game, 'out of time');
          return;
        }
        const p = game.player;
        const step = c.def.steps[c.step];
        if (!step) return;
        if (step.type === 'goto') {
          const inRadius = Math.hypot(p.pos.x - step.x, p.pos.z - step.z) < step.radius;
          if (inRadius) this.advance(game);
        } else if (step.type === 'pickup') {
          const inRadius = Math.hypot(p.pos.x - step.x, p.pos.z - step.z) < step.radius;
          game.hud.setPrompt(inRadius ? 'E — Grab the package' : '');
          if (inRadius && game.input.wasPressedAny(['KeyE'])) {
            if (c.def.id === 'm3') addHeat(game, 400); // the call goes out
            this.advance(game);
          }
        } else if (step.type === 'enterCar') {
          if (p.inCar && p.inCar.type === step.carType) this.advance(game);
        } else if (step.type === 'deliver') {
          if (p.inCar && p.inCar.type === step.carType && Math.hypot(p.pos.x - step.x, p.pos.z - step.z) < step.radius) {
            this.advance(game);
          }
        } else if (step.type === 'chase') {
          const van = c.van;
          if (van && van.health <= 0) {
            game.effects.spawnSmoke(game, van.pos.x, 1.4, van.pos.z, 6);
            this.advance(game);
          }
        }
      } else if (this.sideJob) {
        const j = this.sideJob;
        j.timer -= dt;
        const p = game.player;
        if (j.timer <= 0) {
          this.sideJob = null;
          this.updateMarker(game);
          game.hud.setObjective('Courier job expired — press M for a new one');
          return;
        }
        if (j.phase === 'pickup') {
          if (Math.hypot(p.pos.x - j.ax, p.pos.z - j.az) < 8) {
            j.phase = 'deliver';
            this.marker = { x: j.bx, z: j.bz };
            this.beacon.group.position.set(j.bx, 0, j.bz);
            game.hud.setObjective(`Courier run: deliver the package ($${j.reward})`);
            game.audio.pickup();
          }
        } else if (Math.hypot(p.pos.x - j.bx, p.pos.z - j.bz) < 10) {
          p.money += j.reward;
          game.audio.cash();
          game.hud.toast(`Delivered +$${j.reward}`);
          this.sideJob = null;
          this.updateMarker(game);
          game.hud.setObjective('Free roam — press M for a courier job');
          game.saveGame();
        }
      } else if (this.race) {
        const r = this.race;
        r.timer -= dt;
        const p = game.player;
        if (r.timer <= 0) {
          this.race = null;
          this.updateMarker(game);
          game.hud.setObjective('Street race failed — out of time');
          game.audio.missionFail();
          return;
        }
        const cp = r.cps[r.idx];
        if (Math.hypot(p.pos.x - cp.x, p.pos.z - cp.z) < 12) {
          r.idx += 1;
          game.audio.pickup();
          if (r.idx >= r.cps.length) {
            p.money += r.reward;
            game.audio.cash();
            game.hud.toast(`Race won +$${r.reward}`);
            this.race = null;
            this.updateMarker(game);
            game.hud.setObjective('Free roam — press M for a courier job');
            game.saveGame();
          } else {
            this.marker = { x: r.cps[r.idx].x, z: r.cps[r.idx].z };
            this.beacon.group.position.set(r.cps[r.idx].x, 0, r.cps[r.idx].z);
            game.hud.setObjective(`Street race: checkpoint ${r.idx + 1}/${r.cps.length} — $${r.reward}`);
          }
        }
      }
    },
  };
}

/** Golden shells hidden around the beach and island — free-roam collectibles. Returns the total. */
export function spawnShells(game) {
  const spots = [
    [-260, 310], [-180, 318], [-90, 312], [90, 316], [180, 310], [250, 314],
    [0, 380], [0, 460], [0, 520], [24, 640], [-34, 632], [10, 566],
  ];
  for (const [x, z] of spots) spawnPickup(game, 'shell', x, z);
  return spots.length;
}
