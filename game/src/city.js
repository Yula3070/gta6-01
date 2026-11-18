// Solara Bay itself: a procedural coastal city on a road grid, a beach and a
// bay to the south, a tidal causeway to a lighthouse island, and the named
// landmarks the story uses. Geometry is merged into a few meshes per material
// so the scene stays fast. Also owns the road graph traffic drives on.
import * as THREE from 'three';
import { BEACH_Z, CAUSEWAY, CITY_HALF, DISTRICTS, ISLAND, NAMES, PALETTE, ROADS, ROAD_PITCH, ROAD_WIDTH, WATER_Z } from './config.js';

// ---- merged-box helper: one BufferGeometry from many tinted boxes --------
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function mergeBoxes(parts) {
  const pos = [];
  const norm = [];
  const uv = [];
  const col = [];
  const idx = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let base = 0;
  for (const part of parts) {
    q.setFromAxisAngle(up, part.rotY || 0);
    s.set(part.sx, part.sy, part.sz);
    p.set(part.x, part.y, part.z);
    m.compose(p, q, s);
    const g = UNIT_BOX.clone().applyMatrix4(m);
    const pa = g.attributes.position.array;
    const na = g.attributes.normal.array;
    const ua = g.attributes.uv.array;
    const ia = g.index.array;
    for (let i = 0; i < pa.length; i += 1) pos.push(pa[i]);
    for (let i = 0; i < na.length; i += 1) norm.push(na[i]);
    for (let i = 0; i < ua.length; i += 1) uv.push(ua[i]);
    const c = new THREE.Color(part.color ?? 0xffffff);
    const n = pa.length / 3;
    for (let i = 0; i < n; i += 1) col.push(c.r, c.g, c.b);
    for (let i = 0; i < ia.length; i += 1) idx.push(ia[i] + base);
    base += n;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

function windowTexture(litRatio) {
  // Two canvases share one window layout: a light facade for the colour map
  // (the district tint multiplies it) and a black one for the emissive map,
  // so only lit windows glow at night.
  const mapC = document.createElement('canvas');
  mapC.width = 128;
  mapC.height = 256;
  const emC = document.createElement('canvas');
  emC.width = 128;
  emC.height = 256;
  const g = mapC.getContext('2d');
  const e = emC.getContext('2d');
  g.fillStyle = '#c3c7ce';
  g.fillRect(0, 0, 128, 256);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, 128, 256);
  // A plain band at the top so the roof face reads as roof, not windows.
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(0, 0, 128, 10);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#33405c';
      g.fillRect(10 + col * 19, 18 + row * 19, 12, 13);
      if (lit) {
        e.fillStyle = '#ffb84d';
        e.fillRect(10 + col * 19, 18 + row * 19, 12, 13);
      }
    }
  }
  const map = new THREE.CanvasTexture(mapC);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissive = new THREE.CanvasTexture(emC);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

function textTexture(text, bg, fg, sub) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 52 : 64);
  if (sub) {
    g.font = '28px system-ui, sans-serif';
    g.fillText(sub, 256, 96);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function districtAt(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  if (d < 110) return DISTRICTS.downtown;
  if (z > 200) return DISTRICTS.beach;
  return DISTRICTS.oldtown;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const lightHeads = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- ground: grass, then roads, sidewalks and markings (merged) -------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 700, CITY_HALF * 2 + 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 120);
  ground.receiveShadow = false;
  group.add(ground);

  const roadParts = [];
  const walkParts = [];
  const markParts = [];
  for (const r of ROADS) {
    // Vertical road (along z) and horizontal road (along x).
    roadParts.push({ x: r, y: 0, z: 0, sx: ROAD_WIDTH, sy: 0.1, sz: CITY_HALF * 2, color: PALETTE.road });
    roadParts.push({ x: 0, y: 0, z: r, sx: CITY_HALF * 2, sy: 0.1, sz: ROAD_WIDTH, color: PALETTE.road });
    walkParts.push({ x: r - ROAD_WIDTH / 2 - 2.5, y: 0.02, z: 0, sx: 5, sy: 0.08, sz: CITY_HALF * 2, color: PALETTE.sidewalk });
    walkParts.push({ x: r + ROAD_WIDTH / 2 + 2.5, y: 0.02, z: 0, sx: 5, sy: 0.08, sz: CITY_HALF * 2, color: PALETTE.sidewalk });
    walkParts.push({ x: 0, y: 0.02, z: r - ROAD_WIDTH / 2 - 2.5, sx: CITY_HALF * 2, sy: 0.08, sz: 5, color: PALETTE.sidewalk });
    walkParts.push({ x: 0, y: 0.02, z: r + ROAD_WIDTH / 2 + 2.5, sx: CITY_HALF * 2, sy: 0.08, sz: 5, color: PALETTE.sidewalk });
    // Dashed centre lines.
    for (let t = -CITY_HALF + 14; t < CITY_HALF - 10; t += 16) {
      markParts.push({ x: r, y: 0.08, z: t, sx: 0.5, sy: 0.02, sz: 8, color: 0xf5d76e });
      markParts.push({ x: t, y: 0.08, z: r, sx: 8, sy: 0.02, sz: 0.5, color: 0xf5d76e });
    }
  }
  const roadMesh = new THREE.Mesh(mergeBoxes(roadParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  const walkMesh = new THREE.Mesh(mergeBoxes(walkParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  const markMesh = new THREE.Mesh(mergeBoxes(markParts), new THREE.MeshBasicMaterial({ vertexColors: true }));
  group.add(roadMesh, walkMesh, markMesh);

  // ---- buildings (merged, tinted, one window texture) --------------------
  const winTex = windowTexture(0.28);
  const buildingParts = [];
  const roofParts = [];
  const signs = [];
  function addBuilding(x, z, w, d, h, color) {
    buildingParts.push({ x, y: h / 2, z, sx: w, sy: h, sz: d, color });
    roofParts.push({ x, y: h + 0.4, z, sx: w + 1.2, sy: 0.8, sz: d + 1.2, color: 0x23272e });
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  }
  const landmarkDefs = [
    { name: 'garage', x: -126, z: -42, w: 34, d: 22, h: 12, color: 0x2e86c1, sign: NAMES.garage, sub: 'REPAIRS • 24H' },
    { name: 'diner', x: 42, z: -126, w: 26, d: 18, h: 10, color: 0xd98841, sign: NAMES.diner, sub: 'EAT • COFFEE • PIE' },
    { name: 'casino', x: 126, z: 126, w: 44, d: 30, h: 34, color: 0x8e6b1f, sign: NAMES.casino, sub: 'SLOTS • TABLES • GOLD' },
    { name: 'police', x: -42, z: 126, w: 30, d: 22, h: 16, color: 0x2c4a6b, sign: 'SOLARA PD', sub: 'POLICE STATION' },
    { name: 'hospital', x: 210, z: -210, w: 36, d: 26, h: 22, color: 0xe8e8e8, sign: 'ST. MARINA HOSPITAL', sub: 'EMERGENCY' },
    { name: 'marina', x: -210, z: 210, w: 24, d: 16, h: 9, color: 0x7fb3a3, sign: NAMES.marina, sub: 'BOATS • BAIT • FUEL' },
  ];
  const landmarks = {};
  for (const def of landmarkDefs) {
    addBuilding(def.x, def.z, def.w, def.d, def.h, def.color);
    landmarks[def.name] = new THREE.Vector3(def.x, 0, def.z);
    const tex = textTexture(def.sign, '#14181f', '#ffd98a', def.sub);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(def.w * 0.8, def.w * 0.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
    );
    sign.position.set(def.x, def.h * 0.72, def.z - def.d / 2 - 0.15);
    sign.rotation.y = Math.PI;
    group.add(sign);
    signs.push(sign);
  }

  // Fill the remaining blocks with procedural buildings; the (0,0) block is a park.
  for (let ix = 0; ix < ROADS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROADS.length - 1; iz += 1) {
      const bx0 = ROADS[ix] + ROAD_WIDTH / 2 + 3;
      const bz0 = ROADS[iz] + ROAD_WIDTH / 2 + 3;
      const bx1 = ROADS[ix + 1] - ROAD_WIDTH / 2 - 3;
      const bz1 = ROADS[iz + 1] - ROAD_WIDTH / 2 - 3;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      if (Math.abs(cx) < 1 && Math.abs(cz) < 1) continue; // the plaza park
      if (bz0 > BEACH_Z - 10) continue; // beach row stays open
      // Skip blocks that hold a landmark.
      let taken = false;
      for (const def of landmarkDefs) {
        if (def.x > bx0 - 20 && def.x < bx1 + 20 && def.z > bz0 - 20 && def.z < bz1 + 20) taken = true;
      }
      if (taken) continue;
      const district = districtAt(cx, cz);
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i += 1) {
        const w = rng.range(14, 26);
        const d = rng.range(14, 26);
        const x = rng.range(bx0 + w / 2, bx1 - w / 2);
        const z = rng.range(bz0 + d / 2, bz1 - d / 2);
        const h = rng.range(district.minH, district.maxH);
        addBuilding(x, z, w, d, h, rng.pick(district.colors));
      }
    }
  }
  const buildings = new THREE.Mesh(
    mergeBoxes(buildingParts),
    new THREE.MeshLambertMaterial({ map: winTex.map, vertexColors: true, emissive: 0xffc46b, emissiveMap: winTex.emissive, emissiveIntensity: 0 }),
  );
  const roofs = new THREE.Mesh(mergeBoxes(roofParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(buildings, roofs);

  // ---- plaza park at (0,0): fountain, trees, benches ---------------------
  const parkParts = [];
  const treeParts = [];
  const trunkParts = [];
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 10, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9db8c4 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * 26;
    const z = Math.sin(a) * 26;
    trunkParts.push({ x, y: 2, z, sx: 0.7, sy: 4, sz: 0.7, color: 0x6b4a2f });
    treeParts.push({ x, y: 5.6, z, sx: 3.6, sy: 3.2, sz: 3.6, color: 0x3f7a34 });
  }
  const trees = new THREE.Mesh(mergeBoxes(treeParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  const trunks = new THREE.Mesh(mergeBoxes(trunkParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(trees, trunks);
  parkParts.push({ x: 0, y: 0.1, z: 0, sx: 60, sy: 0.2, sz: 60, color: 0x6a9a52 });
  const park = new THREE.Mesh(mergeBoxes(parkParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(park);

  // ---- streetlights at intersections -------------------------------------
  const poleParts = [];
  const headGeo = new THREE.BoxGeometry(1.6, 0.5, 0.7);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0xffe9a8, emissiveIntensity: 0 });
  for (const x of ROADS) {
    for (const z of ROADS) {
      if (Math.abs(x) < 1 && Math.abs(z) < 1) continue;
      poleParts.push({ x: x + ROAD_WIDTH / 2 + 1, y: 3, z: z + ROAD_WIDTH / 2 + 1, sx: 0.35, sy: 6, sz: 0.35, color: 0x2c313a });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x + ROAD_WIDTH / 2 + 1, 6.1, z + ROAD_WIDTH / 2 + 1);
      group.add(head);
      lightHeads.push(head);
    }
  }
  const poles = new THREE.Mesh(mergeBoxes(poleParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(poles);

  // ---- palms along the beach ----------------------------------------------
  // Crown: a core plus five drooping fronds in two greens, each fanned out
  // and slightly varied, so the palm reads as a tree at dusk instead of a
  // green slab on a stick.
  const palmTrunks = [];
  const palmTops = [];
  for (let x = -CITY_HALF; x <= CITY_HALF; x += 42) {
    const z = BEACH_Z + 12 + rng.range(-4, 4);
    const h = rng.range(5.4, 6.8);
    palmTrunks.push({ x, y: h / 2, z, sx: 0.8, sy: h, sz: 0.8, color: 0x7a5a35 });
    palmTops.push({ x, y: h + 0.9, z, sx: 2.6, sy: 1.1, sz: 2.6, color: 0x2e8b57 });
    for (let f = 0; f < 5; f += 1) {
      const a = (f / 5) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const len = rng.range(2.8, 3.8);
      palmTops.push({
        x: x + Math.cos(a) * 1.9,
        y: h + 0.6 + rng.range(-0.35, 0.15),
        z: z + Math.sin(a) * 1.9,
        sx: len, sy: 0.55, sz: 1.5, rotY: -a,
        color: f % 2 ? 0x2e8b57 : 0x3aa564,
      });
    }
  }
  group.add(new THREE.Mesh(mergeBoxes(palmTrunks), new THREE.MeshLambertMaterial({ vertexColors: true })));
  group.add(new THREE.Mesh(mergeBoxes(palmTops), new THREE.MeshLambertMaterial({ vertexColors: true })));

  // ---- beach, water, causeway, island ------------------------------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 200, WATER_Z - BEACH_Z + 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, (BEACH_Z + WATER_Z) / 2);
  group.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.waterDay, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, WATER_Z + 350);
  group.add(water);

  const causewayMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CAUSEWAY.x1 - CAUSEWAY.x0, 0.3, CAUSEWAY.z1 - CAUSEWAY.z0),
    new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }),
  );
  causewayMesh.position.set(0, 0.15, (CAUSEWAY.z0 + CAUSEWAY.z1) / 2);
  group.add(causewayMesh);
  // Flood water over the causeway, shown at high tide.
  const flood = new THREE.Mesh(
    new THREE.PlaneGeometry(CAUSEWAY.x1 - CAUSEWAY.x0 + 4, CAUSEWAY.z1 - CAUSEWAY.z0),
    new THREE.MeshLambertMaterial({ color: PALETTE.waterDay, transparent: true, opacity: 0.85 }),
  );
  flood.rotation.x = -Math.PI / 2;
  flood.position.set(0, 0.55, (CAUSEWAY.z0 + CAUSEWAY.z1) / 2);
  flood.visible = false;
  group.add(flood);

  // Island: sand disc, lighthouse, a couple of shacks, docks.
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND.r, ISLAND.r + 6, 2.4, 24),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  island.position.set(ISLAND.x, 0.4, ISLAND.z);
  group.add(island);
  colliders.push({ x0: ISLAND.x - 6, z0: ISLAND.z - 6, x1: ISLAND.x + 6, z1: ISLAND.z + 6 });
  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.2, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf0e6d2 }),
  );
  tower.position.y = 13;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xfff2b0, emissiveIntensity: 0.9 }),
  );
  lamp.position.y = 27.5;
  lighthouse.add(tower, lamp);
  lighthouse.position.set(ISLAND.x - 18, 1.6, ISLAND.z - 14);
  group.add(lighthouse);
  addBuilding(ISLAND.x + 16, ISLAND.z + 8, 16, 12, 7, 0x7fb3a3);
  addBuilding(ISLAND.x - 4, ISLAND.z + 18, 12, 10, 6, 0xd98841);
  // Docks reaching into the water.
  const dockParts = [];
  for (let i = 0; i < 3; i += 1) {
    dockParts.push({ x: -30 + i * 30, y: 0.4, z: ISLAND.z - ISLAND.r - 8, sx: 6, sy: 0.6, sz: 18, color: 0x8a6f4d });
  }
  group.add(new THREE.Mesh(mergeBoxes(dockParts), new THREE.MeshLambertMaterial({ vertexColors: true })));

  // City-edge walls (invisible to the eye, keep the player inside).
  colliders.push({ x0: -CITY_HALF - 20, z0: -CITY_HALF - 20, x1: -CITY_HALF, z1: CITY_HALF + 400 });
  colliders.push({ x0: CITY_HALF, z0: -CITY_HALF - 20, x1: CITY_HALF + 20, z1: CITY_HALF + 400 });
  colliders.push({ x0: -CITY_HALF - 20, z0: -CITY_HALF - 20, x1: CITY_HALF + 20, z1: -CITY_HALF });
  // Water edge: only the causeway crosses. The colliders stop at the island's
  // north shore so the island itself stays walkable.
  colliders.push({ x0: -800, z0: WATER_Z - 2, x1: CAUSEWAY.x0, z1: ISLAND.z - ISLAND.r - 2 });
  colliders.push({ x0: CAUSEWAY.x1, z0: WATER_Z - 2, x1: 800, z1: ISLAND.z - ISLAND.r - 2 });
  colliders.push({ x0: -800, z0: ISLAND.z + ISLAND.r + 2, x1: 800, z1: 1200 });

  // ---- road graph for traffic --------------------------------------------
  const nodes = new Map();
  function nodeAt(x, z) {
    const key = `${x},${z}`;
    if (!nodes.has(key)) nodes.set(key, { x, z, edges: [] });
    return nodes.get(key);
  }
  const edges = [];
  for (let i = 0; i < ROADS.length; i += 1) {
    for (let j = 0; j < ROADS.length - 1; j += 1) {
      const a = nodeAt(ROADS[i], ROADS[j]);
      const b = nodeAt(ROADS[i], ROADS[j + 1]);
      const e = { a, b, axis: 'z', at: ROADS[i] };
      a.edges.push(e);
      b.edges.push(e);
      edges.push(e);
      const c = nodeAt(ROADS[j], ROADS[i]);
      const d = nodeAt(ROADS[j + 1], ROADS[i]);
      const e2 = { a: c, b: d, axis: 'x', at: ROADS[i] };
      c.edges.push(e2);
      d.edges.push(e2);
      edges.push(e2);
    }
  }

  return {
    group,
    colliders,
    landmarks,
    buildings,
    water,
    flood,
    lightHeads,
    nodes,
    edges,
    /** The nearest intersection node to a point. */
    nearestNode(x, z) {
      let best = null;
      let bestD = Infinity;
      for (const node of nodes.values()) {
        const d = (node.x - x) ** 2 + (node.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = node;
        }
      }
      return best;
    },
    /** Right-hand lane offset for an edge travelled a -> b. */
    laneOffset(edge, fromA) {
      const dx = fromA ? edge.b.x - edge.a.x : edge.a.x - edge.b.x;
      const dz = fromA ? edge.b.z - edge.a.z : edge.a.z - edge.b.z;
      const len = Math.hypot(dx, dz) || 1;
      // Right of the direction of travel.
      return { x: (-dz / len) * 3.5, z: (dx / len) * 3.5 };
    },
    update(dt, time, nightFactor) {
      buildings.material.emissiveIntensity = nightFactor * 0.55;
      headMat.emissiveIntensity = nightFactor * 1.6;
      water.position.y = -0.4 + Math.sin(time * 0.5) * 0.08;
      water.material.color.copy(PALETTE.waterDay).lerp(PALETTE.waterNight, nightFactor);
    },
  };
}
