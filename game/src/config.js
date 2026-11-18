// Solara Bay — every tuning number, colour and name in one place.
// The city is a grid of roads on the x/z plane; +z is south, toward the bay.
// One unit is about one metre. The game runs a fixed 1/60 s step.
import * as THREE from 'three';

export const STEP = 1 / 60;

/** City layout: roads at these x and z lines, pitch 84, road width 14. */
export const ROADS = [-252, -168, -84, 0, 84, 168, 252];
export const ROAD_PITCH = 84;
export const ROAD_WIDTH = 14;
export const CITY_HALF = 294;

/** The bay: beach, water and the tidal causeway to the island. */
export const BEACH_Z = 294;
export const WATER_Z = 336;
export const CAUSEWAY = { x0: -7, x1: 7, z0: 294, z1: 560 };
export const ISLAND = { x: 0, z: 610, r: 52 };
export const HIDEOUT = new THREE.Vector3(0, 0, 612);

/** A game day lasts this long (seconds); the tide cycle is separate. */
export const DAY_LENGTH = 240;
export const TIDE_PERIOD = 180;
/** Causeway is drivable while the tide level is under this. */
export const TIDE_PASSABLE = 0.45;

export const PLAYER = {
  height: 1.8,
  radius: 0.45,
  walkSpeed: 5.2,
  runSpeed: 9.0,
  accel: 40,
  jumpSpeed: 7.5,
  health: 100,
};

export const CAR_TYPES = {
  sedan: { length: 4.3, width: 1.9, maxSpeed: 27, accel: 15, brake: 30, steer: 0.55, color: 0xb03a2e },
  taxi: { length: 4.3, width: 1.9, maxSpeed: 26, accel: 14, brake: 30, steer: 0.55, color: 0xf2c200 },
  hatch: { length: 3.9, width: 1.8, maxSpeed: 24, accel: 13, brake: 28, steer: 0.6, color: 0x2e86c1 },
  sports: { length: 4.4, width: 2.0, maxSpeed: 38, accel: 22, brake: 34, steer: 0.5, color: 0xf39c12 },
  van: { length: 5.0, width: 2.1, maxSpeed: 21, accel: 11, brake: 26, steer: 0.45, color: 0x7f8c8d },
  truck: { length: 6.4, width: 2.3, maxSpeed: 19, accel: 9, brake: 24, steer: 0.4, color: 0x6c3483 },
  police: { length: 4.5, width: 2.0, maxSpeed: 33, accel: 20, brake: 34, steer: 0.55, color: 0xf0f0f0 },
  armored: { length: 5.6, width: 2.3, maxSpeed: 23, accel: 12, brake: 28, steer: 0.42, color: 0x2c3e50 },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 18, range: 2.2, rate: 0.45, auto: false },
  pistol: { name: 'P9 Pistol', damage: 34, range: 60, rate: 0.28, mag: 12, reserve: 60, auto: false },
};

export const WANTED = {
  stealCar: 120,
  hitPed: 150,
  hitCop: 250,
  shoot: 80,
  killPed: 300,
  /** Heat lost per second while no police can see the player. */
  decay: 9,
  /** Heat per star. */
  perStar: 200,
  maxStars: 5,
};

/** Money, rewards and prices. */
export const ECONOMY = {
  startMoney: 250,
  missionRewards: [150, 300, 450, 600, 1500],
  shellValue: 50,
  bustedFine: 200,
  wastedFine: 150,
};

/** District palettes for the procedural buildings. */
export const DISTRICTS = {
  downtown: { colors: [0x5d6d7e, 0x2e4053, 0x707b7c, 0x1a5276], minH: 30, maxH: 78 },
  oldtown: { colors: [0xd98841, 0xc97c5d, 0xe8b04b, 0xa65d3a], minH: 10, maxH: 26 },
  beach: { colors: [0xf5e6c8, 0xf0c98f, 0x7fb3a3, 0xe8a0a0], minH: 8, maxH: 22 },
};

export const PALETTE = {
  skyDay: new THREE.Color(0x7ec8e3),
  skySunset: new THREE.Color(0xff9a56),
  skyNight: new THREE.Color(0x0b1026),
  fogDay: new THREE.Color(0x9fd4e8),
  fogNight: new THREE.Color(0x0d1428),
  sunDay: new THREE.Color(0xfff2d9),
  sunNight: new THREE.Color(0x8fa8ff),
  waterDay: new THREE.Color(0x1f8fb2),
  waterNight: new THREE.Color(0x0a2a44),
  sand: new THREE.Color(0xe8d5a8),
  road: new THREE.Color(0x2f3338),
  sidewalk: new THREE.Color(0x8a8f94),
  grass: new THREE.Color(0x5d8a4a),
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solara-bay.save.v1';
export const SETTINGS_KEY = 'solara-bay.settings.v1';

/** Story names — all original, none from any commercial game. */
export const NAMES = {
  city: 'Solara Bay',
  player: 'Nia Reyes',
  brother: 'Leo Reyes',
  giver: 'Mama Inez',
  fixer: 'Dax Fontaine',
  villain: 'Victor Kaine',
  gang: "Kaine's crew",
  diner: "Inez's Diner",
  garage: "Reyes Garage",
  casino: 'The Gilded Eel Casino',
  marina: 'Marina del Sol',
  causeway: 'Causeway del Sol',
  hideout: 'The Old Lighthouse',
};
