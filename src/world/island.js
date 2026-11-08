// 72x72 Multi-Room Playtime Co. Prank Factory & Lily Lovebraids' Dollhouse, Interactive Prank Stations, Jack-in-the-Box Chest, and Showdown Stage.

import * as THREE from '../../vendor/three.module.min.js';
import { BIOMES, FLOWERPOT_TIERS, HUB_LAYOUT, ISLAND_BOUNDS, TITANS } from '../data/catalog.js';
import { TILE_INDEX, createAtlasBoxGeometry, getAtlasUVRect } from './textures.js';
import { NAV_MAX, NAV_MIN, NAV_SPAN } from './nav.js';

const FACE_DEFS = [
  // +X
  {
    dir: [1, 0, 0],
    shade: 0.92,
    corners: [
      [0.5, 1, 0.5],
      [0.5, 1, -0.5],
      [0.5, 0, 0.5],
      [0.5, 0, -0.5],
    ],
  },
  // -X
  {
    dir: [-1, 0, 0],
    shade: 0.85,
    corners: [
      [-0.5, 1, -0.5],
      [-0.5, 1, 0.5],
      [-0.5, 0, -0.5],
      [-0.5, 0, 0.5],
    ],
  },
  // +Y
  {
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      [-0.5, 1, -0.5],
      [0.5, 1, -0.5],
      [-0.5, 1, 0.5],
      [0.5, 1, 0.5],
    ],
  },
  // -Y
  {
    dir: [0, -1, 0],
    shade: 0.65,
    corners: [
      [-0.5, 0, 0.5],
      [0.5, 0, 0.5],
      [-0.5, 0, -0.5],
      [0.5, 0, -0.5],
    ],
  },
  // +Z
  {
    dir: [0, 0, 1],
    shade: 0.95,
    corners: [
      [-0.5, 1, 0.5],
      [0.5, 1, 0.5],
      [-0.5, 0, 0.5],
      [0.5, 0, 0.5],
    ],
  },
  // -Z
  {
    dir: [0, 0, -1],
    shade: 0.82,
    corners: [
      [0.5, 1, -0.5],
      [-0.5, 1, -0.5],
      [0.5, 0, -0.5],
      [-0.5, 0, -0.5],
    ],
  },
];

function createGeometryCollector() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  let vertCount = 0;

  function addQuad(faceIdx, cx, y0, y1, cz, sx, sz, tileIdx, tintR = 1, tintG = 1, tintB = 1) {
    const face = FACE_DEFS[faceIdx];
    const { u0, v0, u1, v1 } = getAtlasUVRect(tileIdx);
    const dy = y1 - y0;
    if (dy <= 0.001 && faceIdx !== 2 && faceIdx !== 3) return;

    for (let i = 0; i < 4; i++) {
      const c = face.corners[i];
      positions.push(cx + c[0] * sx, y0 + c[1] * dy, cz + c[2] * sz);
      normals.push(face.dir[0], face.dir[1], face.dir[2]);
      const shade = face.shade * (faceIdx !== 2 && c[1] === 0 ? 0.92 : 1.0);
      colors.push(tintR * shade, tintG * shade, tintB * shade);
    }

    uvs.push(u0, v1, u1, v1, u0, v0, u1, v0);
    indices.push(
      vertCount + 0,
      vertCount + 2,
      vertCount + 1,
      vertCount + 1,
      vertCount + 2,
      vertCount + 3
    );
    vertCount += 4;
  }

  function addBox(cx, y0, y1, cz, sx, sz, faceTiles, tint = [1, 1, 1], skipBottom = true) {
    const [r, g, b] = tint;
    const side = faceTiles.side;
    addQuad(0, cx, y0, y1, cz, sx, sz, faceTiles.px ?? side, r, g, b);
    addQuad(1, cx, y0, y1, cz, sx, sz, faceTiles.nx ?? side, r, g, b);
    addQuad(2, cx, y0, y1, cz, sx, sz, faceTiles.top ?? side, r, g, b);
    if (!skipBottom) {
      addQuad(3, cx, y0, y1, cz, sx, sz, faceTiles.bottom ?? side, r, g, b);
    }
    addQuad(4, cx, y0, y1, cz, sx, sz, faceTiles.pz ?? faceTiles.front ?? side, r, g, b);
    addQuad(5, cx, y0, y1, cz, sx, sz, faceTiles.nz ?? side, r, g, b);
  }

  function build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  return { addQuad, addBox, build };
}

// Single-draw-call vertex-colored fallback 3D prank station & trophy builders
function buildMergedColorBoxes(specs, emissiveHex = 0x553300, emissiveIntensity = 0.28) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let vOffset = 0;
  const col = new THREE.Color();

  for (const s of specs) {
    const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
    if (s.ry) geo.rotateY(s.ry);
    geo.translate(s.x || 0, s.y || 0, s.z || 0);
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const idx = geo.index;
    col.setHex(s.color);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colors.push(col.r, col.g, col.b);
    }
    for (let i = 0; i < idx.count; i++) {
      indices.push(vOffset + idx.getX(i));
    }
    vOffset += p.count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: emissiveHex,
    emissiveIntensity,
    roughness: 0.48,
    metalness: 0.12,
  });
  return new THREE.Mesh(merged, mat);
}

function buildFallbackFlowerpot(tier) {
  const trayCol = tier >= 3 ? 0xae3ec9 : tier === 2 ? 0xf06595 : 0x339af0;
  const specs = [{ w: 0.94, h: 0.34, d: 0.94, y: 0.17, color: trayCol }];
  const layers = Math.min(3, Math.max(1, tier));
  const glowColors = [0xffd43b, 0xff85c0, 0x74c0fc];
  for (let i = 0; i < layers; i++) {
    const w = 0.74 - i * 0.18;
    specs.push({
      w,
      h: 0.32,
      d: w,
      y: 0.5 + i * 0.32,
      color: glowColors[(tier - 1 + i) % glowColors.length],
    });
  }
  return buildMergedColorBoxes(specs, 0xff85c0, 0.32);
}

function buildFallbackTrophy(titanId) {
  const spec = TITANS[titanId];
  const accent = spec ? spec.accentColor : 0xffd43b;
  return buildMergedColorBoxes(
    [
      { w: 0.64, h: 0.18, d: 0.64, y: 0.09, color: 0xffd43b },
      { w: 0.24, h: 0.36, d: 0.24, y: 0.36, color: 0xffe066 },
      { w: 0.56, h: 0.44, d: 0.56, y: 0.72, color: 0xffd43b },
      { w: 0.28, h: 0.28, d: 0.28, y: 1.06, ry: Math.PI * 0.25, color: accent },
    ],
    0xd99000,
    0.34
  );
}

export function createIsland(textures, ctx = {}) {
  const group = new THREE.Group();
  group.name = 'IslandGroup';

  const totalCells = NAV_SPAN * NAV_SPAN;
  const heights = new Float32Array(totalCells);
  const isLand = new Uint8Array(totalCells);
  const staticWalkable = new Uint8Array(totalCells);
  const isPathCell = new Uint8Array(totalCells);

  function toIdx(cx, cz) {
    return (cz - NAV_MIN) * NAV_SPAN + (cx - NAV_MIN);
  }

  function inGrid(cx, cz) {
    return cx >= NAV_MIN && cx <= NAV_MAX && cz >= NAV_MIN && cz <= NAV_MAX;
  }

  function getBiomeAt(x, z) {
    const r = Math.hypot(x, z);
    if (r <= ISLAND_BOUNDS.hubRadius) return 'hub';
    if (x < 0 && z >= 0) return 'meadow';
    if (x < 0 && z < 0) return 'snow';
    if (x >= 0 && z >= 0) return 'farm';
    return 'castle';
  }

  // Evaluate Playtime Co. Multi-Room Factory & Dollhouse floor layout within [-33, 33]
  function computeCellLandHeight(cx, cz) {
    if (Math.abs(cx) > 33 || Math.abs(cz) > 33) return 0;

    const rHub = Math.hypot(cx, cz);
    const ang = Math.atan2(cz, cx);
    const wave = Math.sin(ang * 4) * 0.7 + Math.cos(ang * 7) * 0.45;

    const inHub = rHub <= 12.4 + wave * 0.35;
    const inRingBridge =
      (Math.abs(cx) <= 18.5 && Math.abs(Math.abs(cz) - 16.5) <= 2.8) ||
      (Math.abs(cz) <= 18.5 && Math.abs(Math.abs(cx) - 16.5) <= 2.8);

    const dMeadow = Math.hypot(cx - -19, cz - 19);
    const dSnow = Math.hypot(cx - -19, cz - -19);
    const dFarm = Math.hypot(cx - 19, cz - 19);
    const dCastle = Math.hypot(cx - 19.5, cz - -19.5);

    const inMeadow = dMeadow <= 14.3 + wave * 0.5;
    const inSnow = dSnow <= 14.4 + wave * 0.5;
    const inFarm = dFarm <= 14.3 + wave * 0.5;
    const inCastle = dCastle <= 14.6 + wave * 0.45;

    const diag1 = Math.abs(cx - cz) <= 4.2 && Math.hypot(cx, cz) <= 24.5;
    const diag2 = Math.abs(cx + cz) <= 4.2 && Math.hypot(cx, cz) <= 24.5;

    if (!(inHub || inRingBridge || inMeadow || inSnow || inFarm || inCastle || diag1 || diag2)) {
      return 0;
    }

    // Hub is strictly flat y = 1
    if (rHub <= 10.8) return 1.0;

    // NW CatNap & Fridge Lab Terrace: smooth 0.5-step ramp -> y = 2.0 plateau
    if (cx < 0 && cz < 0) {
      if (cx <= -11 && cz <= -11 && !(cx === -11 && cz === -11)) {
        return 2.0;
      }
      if ((cx === -10 && cz <= -10) || (cz === -10 && cx <= -10) || (cx === -11 && cz === -11)) {
        return 1.5;
      }
      return 1.0;
    }

    // NE Stained-Glass Spider-Mech Workshop Terrace: smooth 0.5-step ramp -> y = 2.0 courtyard
    if (cx > 0 && cz < 0) {
      if (cx >= 11 && cz <= -11 && !(cx === 11 && cz === -11)) {
        return 2.0;
      }
      if ((cx === 10 && cz <= -10) || (cz === -10 && cx >= 10) || (cx === 11 && cz === -11)) {
        return 1.5;
      }
      return 1.0;
    }

    // SW Factory Showroom & SE Soccer Pitch: flat y = 1.0 with outer rim at y = 2.0 behind boss arenas
    if (cx <= -27 && cz >= 27 && dMeadow <= 13.8) return 2.0;
    if (cx >= 27 && cz >= 27 && dFarm <= 13.8) return 2.0;

    return 1.0;
  }

  for (let cz = NAV_MIN; cz <= NAV_MAX; cz++) {
    for (let cx = NAV_MIN; cx <= NAV_MAX; cx++) {
      const idx = toIdx(cx, cz);
      const h = computeCellLandHeight(cx, cz);
      heights[idx] = h;
      if (h > 0) {
        isLand[idx] = 1;
        staticWalkable[idx] = 1;

        const r = Math.hypot(cx, cz);
        const onRingRoad =
          (Math.abs(cx) <= 18 && Math.abs(Math.abs(cz) - 16.5) <= 1.6) ||
          (Math.abs(cz) <= 18 && Math.abs(Math.abs(cx) - 16.5) <= 1.6);
        const onDiag =
          (Math.abs(cx - cz) <= 2.3 && r >= 5.2 && r <= 20.5) ||
          (Math.abs(cx + cz) <= 2.3 && r >= 5.2 && r <= 20.5);
        if (onRingRoad || onDiag) {
          isPathCell[idx] = 1;
        }
      }
    }
  }

  // Mark Prank Chest & 4 Trophy Pedestal centers non-walkable for A* while keeping land height intact
  function markPropFootprint(fx, fz, radius = 0.6) {
    const minX = Math.round(fx - radius);
    const maxX = Math.round(fx + radius);
    const minZ = Math.round(fz - radius);
    const maxZ = Math.round(fz + radius);
    for (let cz = minZ; cz <= maxZ; cz++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (inGrid(cx, cz)) {
          staticWalkable[toIdx(cx, cz)] = 0;
        }
      }
    }
  }

  markPropFootprint(HUB_LAYOUT.rouletteChest.x, HUB_LAYOUT.rouletteChest.z, 0.45);
  for (const ped of HUB_LAYOUT.trophyPedestals) {
    markPropFootprint(ped.x, ped.z, 0.35);
  }

  // Build exposed-face terrain mesh + Playtime Co. Civil War Prank Landmarks into 2 merged BufferGeometries
  const opaqueBuilder = createGeometryCollector();
  const glowBuilder = createGeometryCollector();
  const shorelinePositions = [];

  function chooseTopTile(cx, cz, h, biome) {
    // Heroic boss arena circle around each Mega Titan position
    for (const key of ['meadow', 'snow', 'farm', 'castle']) {
      const mp = BIOMES[key].megaTitanPos;
      const dm = Math.hypot(cx - mp.x, cz - mp.z);
      if (dm <= 3.6) {
        return dm >= 2.5 ? TILE_INDEX.bedrock_gold : TILE_INDEX.castle_brick;
      }
    }

    // Center Red & Gold VIP Prank Carpet Corridor (Math.abs(cx) <= 1 or Math.abs(cz) <= 1)
    if (Math.abs(cx) <= 1 || Math.abs(cz) <= 1) {
      return TILE_INDEX.path_gold;
    }

    // Prank Station Pad frames: West pads sit on GrabPack Crate Tile, East pads sit on Rainbow Stained-Glass Tile
    for (const pad of HUB_LAYOUT.flowerpotPads) {
      if (Math.hypot(cx - pad.x, cz - pad.z) <= 1.65) {
        return pad.x < 0 ? TILE_INDEX.spruce_top : TILE_INDEX.castle_brick;
      }
    }

    // Multi-Room Playtime Co. Factory & Dollhouse Floor Layout:
    // West Wings (cx < -1):
    if (cx < -1) {
      // Northwest CatNap & Fridge Wing (cx < -1, cz <= -8): Royal Purple Lab Tile
      if (cz <= -8 || biome === 'snow') {
        return TILE_INDEX.snow_top;
      }
      // West Factory Wing (cx < -1, cz > -8): Playtime Co. Blue & Yellow Factory Showroom Floor + Pink Capsule Pod Lab accents
      return (Math.abs(cx + cz) % 7 === 0) ? TILE_INDEX.ice_crystal : TILE_INDEX.grass_top;
    }

    // East Wings (cx > 1):
    // Northeast Stained-Glass Spider-Mech Workshop (cx > 1, cz <= -8): Rainbow Stained-Glass Mosaic
    if (cz <= -8 || biome === 'castle') {
      return TILE_INDEX.castle_brick;
    }
    // East Dollhouse & Soccer Wing (cx > 1, cz > -8):
    // Green Indoor Soccer Pitch Turf in SE (cz > 7), Lily's Lavender & Pink Diamond Dollhouse Parlor in hub (cz <= 7)
    if (cz > 7 || biome === 'farm') {
      return TILE_INDEX.farm_soil;
    }
    return TILE_INDEX.hub_plaza;
  }

  function chooseSideTile(biome, isUpperBand) {
    if (!isUpperBand) {
      return biome === 'castle' ? TILE_INDEX.castle_brick : TILE_INDEX.dirt;
    }
    if (biome === 'snow') return TILE_INDEX.snow_side;
    if (biome === 'castle') return TILE_INDEX.bedrock_gold;
    if (biome === 'farm') return TILE_INDEX.bedrock_gold;
    return TILE_INDEX.grass_side;
  }

  for (let cz = NAV_MIN; cz <= NAV_MAX; cz++) {
    for (let cx = NAV_MIN; cx <= NAV_MAX; cx++) {
      const idx = toIdx(cx, cz);
      if (!isLand[idx]) {
        // Surround the multi-room floor with flush Playtime Co. Factory & Dollhouse Atrium flooring (y = 0.96)
        if (Math.abs(cx) <= 34 && Math.abs(cz) <= 34) {
          const outerTile =
            Math.abs(cx) <= 1 || Math.abs(cz) <= 1
              ? TILE_INDEX.path_gold
              : cx < -1
                ? (cz <= -8 ? TILE_INDEX.snow_top : TILE_INDEX.grass_top)
                : (cz <= -8 ? TILE_INDEX.castle_brick : cz > 7 ? TILE_INDEX.farm_soil : TILE_INDEX.hub_plaza);
          opaqueBuilder.addQuad(2, cx, 0, 0.96, cz, 1, 1, outerTile, 0.9, 0.9, 0.94);
        }
        continue;
      }
      const h = heights[idx];
      const biome = getBiomeAt(cx, cz);
      const topTile = chooseTopTile(cx, cz, h, biome);

      // Top walkable surface quad
      opaqueBuilder.addQuad(2, cx, 0, h, cz, 1, 1, topTile);

      // Neighbor exposed cliff / curb faces (+X, -X, +Z, -Z)
      const neighbors = [
        { face: 0, nx: cx + 1, nz: cz },
        { face: 1, nx: cx - 1, nz: cz },
        { face: 4, nx: cx, nz: cz + 1 },
        { face: 5, nx: cx, nz: cz - 1 },
      ];
      let touchesOcean = false;
      for (const nb of neighbors) {
        const nh = inGrid(nb.nx, nb.nz) && isLand[toIdx(nb.nx, nb.nz)] ? heights[toIdx(nb.nx, nb.nz)] : 0;
        if (nh === 0) touchesOcean = true;
        if (nh < h) {
          const bottomY = nh === 0 ? 0.54 : nh;
          const midY = Math.max(bottomY, h - 1.0);
          opaqueBuilder.addQuad(nb.face, cx, midY, h, cz, 1, 1, chooseSideTile(biome, true));
          if (midY > bottomY + 0.01) {
            opaqueBuilder.addQuad(nb.face, cx, bottomY, midY, cz, 1, 1, chooseSideTile(biome, false));
          }
        }
      }
      if (touchesOcean) {
        shorelinePositions.push({ x: cx, z: cz });
      }
    }
  }

  // Decorative static 3D Playtime Co. Civil War Prank Landmarks
  function addOakTree(tx, tz) {
    if (!inGrid(tx, tz) || !isLand[toIdx(tx, tz)]) return;
    const by = heights[toIdx(tx, tz)];
    markPropFootprint(tx, tz, 0.45);
    if (tx < 0) {
      // West Factory GrabPack Crate & Glowing Pink Toy Capsule Pillar
      opaqueBuilder.addBox(tx, by, by + 2.2, tz, 1.5, 1.5, {
        side: TILE_INDEX.spruce_bark,
        top: TILE_INDEX.spruce_top,
      });
      glowBuilder.addBox(tx, by + 2.2, by + 4.3, tz, 1.35, 1.35, {
        side: TILE_INDEX.ice_crystal,
        top: TILE_INDEX.lantern_glow,
      });
    } else {
      // East Soccer Pitch & Tea-Party Crumpet Tower
      opaqueBuilder.addBox(tx, by, by + 2.4, tz, 1.55, 1.55, {
        side: TILE_INDEX.hay_side,
        top: TILE_INDEX.hay_top,
      });
      opaqueBuilder.addBox(tx, by + 2.4, by + 4.0, tz, 1.95, 1.95, {
        side: TILE_INDEX.flower_sun_side,
        top: TILE_INDEX.flower_sun_top,
      });
      glowBuilder.addBox(tx, by + 4.0, by + 4.9, tz, 1.15, 1.15, {
        side: TILE_INDEX.lantern_glow,
        top: TILE_INDEX.lantern_glow,
      });
    }
  }

  function addSpruceTree(tx, tz) {
    // NW CatNap & Stocked Factory Fridge Pillar (33:19)
    if (!inGrid(tx, tz) || !isLand[toIdx(tx, tz)]) return;
    const by = heights[toIdx(tx, tz)];
    markPropFootprint(tx, tz, 0.45);
    opaqueBuilder.addBox(tx, by, by + 2.7, tz, 1.75, 1.75, {
      side: TILE_INDEX.beehive_side,
      front: TILE_INDEX.beehive_front,
      top: TILE_INDEX.beehive_top,
    });
    opaqueBuilder.addBox(tx, by + 2.7, by + 4.0, tz, 1.35, 1.35, {
      side: TILE_INDEX.oak_bark,
      top: TILE_INDEX.oak_top,
    });
    glowBuilder.addBox(tx, by + 4.0, by + 4.8, tz, 0.85, 0.85, {
      side: TILE_INDEX.ice_crystal,
      top: TILE_INDEX.lantern_glow,
    });
  }

  function addGiantMushroom(mx, mz) {
    // Chum Chompkins Snack Pillar (West) or Breezy-Bake Pink Toy Oven (East)
    if (!inGrid(mx, mz) || !isLand[toIdx(mx, mz)]) return;
    const by = heights[toIdx(mx, mz)];
    markPropFootprint(mx, mz, 0.45);
    if (mx < 0) {
      opaqueBuilder.addBox(mx, by, by + 1.5, mz, 1.2, 1.2, { side: TILE_INDEX.spruce_bark });
      opaqueBuilder.addBox(mx, by + 1.5, by + 2.9, mz, 1.75, 1.75, {
        side: TILE_INDEX.pumpkin_side,
        front: TILE_INDEX.pumpkin_front,
        top: TILE_INDEX.pumpkin_top,
      });
    } else {
      opaqueBuilder.addBox(mx, by, by + 2.4, mz, 1.5, 1.5, {
        side: TILE_INDEX.melon_side,
        top: TILE_INDEX.melon_top,
      });
    }
  }

  function addLanternPost(lx, lz, heightScale = 1.0) {
    const cx = Math.round(lx);
    const cz = Math.round(lz);
    if (!inGrid(cx, cz) || !isLand[toIdx(cx, cz)]) return;
    const by = heights[toIdx(cx, cz)];
    markPropFootprint(lx, lz, 0.35);
    const postH = 2.1 * heightScale;
    const isFactoryWest = lx < 0;
    opaqueBuilder.addBox(lx, by, by + postH, lz, 0.48, 0.48, {
      side: isFactoryWest ? TILE_INDEX.oak_bark : TILE_INDEX.bedrock_gold,
    });
    glowBuilder.addBox(lx, by + postH, by + postH + 0.75, lz, 0.84, 0.84, {
      side: isFactoryWest ? TILE_INDEX.ice_crystal : TILE_INDEX.lantern_glow,
      top: TILE_INDEX.lantern_glow,
    });
    opaqueBuilder.addBox(lx, by + postH + 0.75, by + postH + 1.0, lz, 0.98, 0.98, {
      side: isFactoryWest ? TILE_INDEX.spruce_bark : TILE_INDEX.mushroom_red,
    });
  }

  function addCastleTurret(tx, tz) {
    // NE Prototype's Rainbow Stained-Glass & Jester-Crown Tower (40:00)
    if (!inGrid(tx, tz) || !isLand[toIdx(tx, tz)]) return;
    const by = heights[toIdx(tx, tz)];
    markPropFootprint(tx, tz, 0.9);
    opaqueBuilder.addBox(tx, by, by + 3.8, tz, 2.05, 2.05, {
      side: TILE_INDEX.castle_brick,
      top: TILE_INDEX.castle_brick,
    });
    opaqueBuilder.addBox(tx, by + 3.8, by + 4.7, tz, 2.35, 2.35, {
      side: TILE_INDEX.amethyst,
      top: TILE_INDEX.bedrock_gold,
    });
    glowBuilder.addBox(tx, by + 4.7, by + 5.7, tz, 1.15, 1.15, {
      side: TILE_INDEX.lantern_glow,
      top: TILE_INDEX.ice_crystal,
    });
  }

  function addCrystalObelisk(ox, oz, tileIdx) {
    if (!inGrid(ox, oz) || !isLand[toIdx(ox, oz)]) return;
    const by = heights[toIdx(ox, oz)];
    markPropFootprint(ox, oz, 0.4);
    opaqueBuilder.addBox(ox, by, by + 0.65, oz, 1.05, 1.05, { side: TILE_INDEX.bedrock_gold });
    glowBuilder.addBox(ox, by + 0.65, by + 2.6, oz, 0.78, 0.78, { side: tileIdx });
  }

  // North Hub Showdown Stage + 4 Pedestal Columns
  opaqueBuilder.addBox(-3.1, 1.0, 1.28, -7.9, 6.1, 2.3, {
    side: TILE_INDEX.spruce_bark,
    top: TILE_INDEX.grass_top,
  });
  opaqueBuilder.addBox(3.1, 1.0, 1.28, -7.9, 6.1, 2.3, {
    side: TILE_INDEX.bedrock_gold,
    top: TILE_INDEX.hub_plaza,
  });

  // ============================================================================
  // NORTH BACKDROP (z = -9.1): Rainbow Stained-Glass Showdown Wall & Smiling Critters Soccer Goalpost (30:49 & 40:00)
  // ============================================================================
  // Left Backdrop: White Smiling Critters Soccer Goal Frame + Green Turf Pitch Netting + Soccer Ball Topper (30:49)
  opaqueBuilder.addBox(-4.2, 1.0, 1.45, -9.2, 3.8, 1.1, {
    side: TILE_INDEX.farm_soil,
    top: TILE_INDEX.farm_soil,
  });
  // White Left & Right Goalposts + Crossbar
  opaqueBuilder.addBox(-5.8, 1.0, 4.1, -9.1, 0.42, 0.42, {
    side: TILE_INDEX.beehive_side,
    top: TILE_INDEX.beehive_top,
  });
  opaqueBuilder.addBox(-2.6, 1.0, 4.1, -9.1, 0.42, 0.42, {
    side: TILE_INDEX.beehive_side,
    top: TILE_INDEX.beehive_top,
  });
  opaqueBuilder.addBox(-4.2, 3.75, 4.15, -9.1, 3.65, 0.45, {
    side: TILE_INDEX.beehive_side,
    top: TILE_INDEX.beehive_top,
  });
  // Soccer Ball Prank Trophy perched on the crossbar!
  opaqueBuilder.addBox(-4.2, 4.15, 5.05, -9.1, 0.95, 0.95, {
    side: TILE_INDEX.hay_side,
    top: TILE_INDEX.hay_top,
  });

  // Center Backdrop: Giant Jester-Crown & GrabPack Prank Emblem Pillar
  opaqueBuilder.addBox(0, 1.0, 3.7, -9.2, 1.75, 1.15, {
    side: TILE_INDEX.amethyst,
    front: TILE_INDEX.spruce_bark,
    top: TILE_INDEX.bedrock_gold,
  });
  glowBuilder.addBox(0, 3.7, 4.75, -9.2, 1.45, 1.05, {
    side: TILE_INDEX.mega_titan_side,
    top: TILE_INDEX.lantern_glow,
  });
  // Three Jester-Crown Golden Prongs on Center Backdrop
  glowBuilder.addBox(-0.65, 4.75, 5.45, -9.2, 0.42, 0.42, { side: TILE_INDEX.lantern_glow });
  glowBuilder.addBox(0, 4.75, 5.65, -9.2, 0.46, 0.46, { side: TILE_INDEX.ice_crystal });
  glowBuilder.addBox(0.65, 4.75, 5.45, -9.2, 0.42, 0.42, { side: TILE_INDEX.lantern_glow });

  // Right Backdrop: Rainbow Stained-Glass Showdown Window Wall (40:00 Prototype Showdown!)
  opaqueBuilder.addBox(4.2, 1.0, 3.8, -9.2, 3.9, 0.95, {
    side: TILE_INDEX.castle_brick,
    front: TILE_INDEX.castle_brick,
    top: TILE_INDEX.bedrock_gold,
  });
  glowBuilder.addBox(4.2, 2.0, 3.5, -8.72, 2.8, 0.22, {
    side: TILE_INDEX.castle_brick,
    front: TILE_INDEX.castle_brick,
  });
  opaqueBuilder.addBox(4.2, 3.8, 4.3, -9.0, 4.3, 1.25, {
    side: TILE_INDEX.mushroom_red,
    top: TILE_INDEX.bedrock_gold,
  });
  // Stained-Glass Rose Finial & Twin Spires on Right Backdrop
  glowBuilder.addBox(3.2, 4.3, 5.35, -9.1, 0.55, 0.55, { side: TILE_INDEX.ice_crystal });
  glowBuilder.addBox(4.2, 4.3, 5.65, -9.1, 0.95, 0.55, { side: TILE_INDEX.lantern_glow });
  glowBuilder.addBox(5.2, 4.3, 5.35, -9.1, 0.55, 0.55, { side: TILE_INDEX.ice_crystal });

  for (const ped of HUB_LAYOUT.trophyPedestals) {
    const isEastPed = ped.x > 0;
    opaqueBuilder.addBox(ped.x, 1.0, 1.72, ped.z, 1.08, 1.08, {
      side: isEastPed ? TILE_INDEX.bedrock_gold : TILE_INDEX.spruce_bark,
      top: isEastPed ? TILE_INDEX.castle_brick : TILE_INDEX.grass_top,
    });
    glowBuilder.addBox(ped.x, 1.54, 1.74, ped.z, 1.14, 1.14, {
      side: isEastPed ? TILE_INDEX.ice_crystal : TILE_INDEX.lantern_glow,
      top: TILE_INDEX.hub_plaza,
    });
  }

  // Hub Prank Lantern Pillars
  addLanternPost(-7.5, -5.5, 1.15);
  addLanternPost(7.5, -5.5, 1.15);
  addLanternPost(-7.8, 5.2, 1.05);
  addLanternPost(7.8, 5.2, 1.05);

  // ============================================================================
  // WEST LANDMARK (x = -8.4, z = -0.6): The 24:14 Pink Toy Capsule Pod & Blue Factory Office Door (23:36)
  // ============================================================================
  // Blue Factory Office Wing where Hoppy, Baba & Kickin knock (23:36)
  opaqueBuilder.addBox(-8.5, 1.0, 3.3, -1.7, 2.2, 2.4, {
    side: TILE_INDEX.leaves_frost,
    front: TILE_INDEX.snowman_face,
    top: TILE_INDEX.bedrock_gold,
  });
  // Prominent Blue Office Door facing the Hub (+X)
  opaqueBuilder.addBox(-7.32, 1.0, 2.85, -1.7, 0.24, 1.35, {
    side: TILE_INDEX.snowman_face,
    front: TILE_INDEX.snowman_face,
  });
  // 24:14 Glowing Translucent Pink Toy Capsule Pod Cylinder next to the Blue Office Door!
  opaqueBuilder.addBox(-8.3, 1.0, 1.45, 0.9, 2.1, 2.1, {
    side: TILE_INDEX.bedrock_gold,
    top: TILE_INDEX.bedrock_gold,
  });
  glowBuilder.addBox(-8.3, 1.45, 3.85, 0.9, 1.72, 1.72, {
    side: TILE_INDEX.ice_crystal,
    front: TILE_INDEX.ice_crystal,
    top: TILE_INDEX.ice_crystal,
  });
  opaqueBuilder.addBox(-8.3, 3.85, 4.25, 0.9, 2.15, 2.15, {
    side: TILE_INDEX.bedrock_gold,
    top: TILE_INDEX.spruce_top,
  });
  // Giant Tea-Party Hat & Teacup Sign on the Factory Roof (27:43 "I love tea parties and crumpets!")
  opaqueBuilder.addBox(-8.4, 3.3, 3.75, -1.7, 2.5, 2.7, {
    side: TILE_INDEX.spruce_bark,
    top: TILE_INDEX.bedrock_gold,
  });
  opaqueBuilder.addBox(-8.4, 3.75, 4.2, -1.7, 1.95, 1.95, {
    side: TILE_INDEX.flower_sun_side,
    top: TILE_INDEX.flower_sun_top,
  });
  glowBuilder.addBox(-8.4, 4.2, 5.25, -1.7, 1.25, 1.25, {
    side: TILE_INDEX.ice_crystal,
    top: TILE_INDEX.lantern_glow,
  });
  glowBuilder.addBox(-8.4, 5.25, 5.75, -1.7, 0.55, 0.55, {
    side: TILE_INDEX.lantern_glow,
    top: TILE_INDEX.lantern_glow,
  });

  // ============================================================================
  // EAST LANDMARK (x = +8.4, z = -0.6): Lily Lovebraids' 2-Story Pink & Lavender Dollhouse & Breezy-Bake Kitchen (32:47)
  // ============================================================================
  // 1st Story: Pink & Lavender Dollhouse Parlor + Breezy-Bake Oven Kitchen
  opaqueBuilder.addBox(8.4, 1.0, 2.75, -0.6, 2.4, 4.6, {
    side: TILE_INDEX.leaves_lush,
    front: TILE_INDEX.melon_side,
    top: TILE_INDEX.bedrock_gold,
  });
  // Giant Stocked Factory Fridge (33:19) beside the Dollhouse Kitchen
  opaqueBuilder.addBox(7.25, 1.0, 2.95, 1.15, 0.95, 1.15, {
    side: TILE_INDEX.beehive_side,
    front: TILE_INDEX.beehive_front,
    top: TILE_INDEX.beehive_top,
  });
  // Tea-Party Crumpet Table in front of the Dollhouse Parlor
  opaqueBuilder.addBox(7.15, 1.0, 1.85, -1.85, 1.05, 1.05, {
    side: TILE_INDEX.flower_sun_side,
    top: TILE_INDEX.flower_sun_top,
  });
  // 2nd Story: Lavender Dollhouse Balcony & Rainbow Makeup Studio
  opaqueBuilder.addBox(8.4, 2.75, 4.15, -0.6, 2.3, 4.4, {
    side: TILE_INDEX.mushroom_red,
    front: TILE_INDEX.leaves_lush,
    top: TILE_INDEX.bedrock_gold,
  });
  // Pink & Lavender Striped Dollhouse Roof Cornice
  opaqueBuilder.addBox(8.2, 4.15, 4.6, -0.6, 2.7, 4.9, {
    side: TILE_INDEX.mushroom_red,
    top: TILE_INDEX.hub_plaza,
  });
  // Twin Braided Purple Roof Towers with Gold Star Hair Clips!
  opaqueBuilder.addBox(8.2, 4.6, 6.0, -1.75, 0.95, 0.95, {
    side: TILE_INDEX.oak_bark,
    top: TILE_INDEX.oak_top,
  });
  glowBuilder.addBox(8.2, 6.0, 6.55, -1.75, 0.55, 0.55, {
    side: TILE_INDEX.lantern_glow,
    top: TILE_INDEX.lantern_glow,
  });
  opaqueBuilder.addBox(8.2, 4.6, 6.0, 0.55, 0.95, 0.95, {
    side: TILE_INDEX.oak_bark,
    top: TILE_INDEX.oak_top,
  });
  glowBuilder.addBox(8.2, 6.0, 6.55, 0.55, 0.55, 0.55, {
    side: TILE_INDEX.lantern_glow,
    top: TILE_INDEX.lantern_glow,
  });

  // SW West Factory Showroom Capsule Pillars & Chum Chompkins Snack Boxes (outer perimeter)
  addOakTree(-28, 21);
  addOakTree(-21, 28);
  addOakTree(-28, 28);
  addGiantMushroom(-26, 13);
  addGiantMushroom(-13, 27);

  // NW CatNap & Stocked Fridge Wing Pillars & Capsule Obelisks
  addSpruceTree(-28, -21);
  addSpruceTree(-21, -28);
  addSpruceTree(-28, -28);
  addCrystalObelisk(-12, -9, TILE_INDEX.beehive_front);
  addCrystalObelisk(-9, -12, TILE_INDEX.beehive_front);
  if (isLand[toIdx(-26, -13)]) {
    const sy = heights[toIdx(-26, -13)];
    markPropFootprint(-26, -13, 0.5);
    opaqueBuilder.addBox(-26, sy, sy + 1.4, -13, 1.35, 1.35, {
      side: TILE_INDEX.beehive_side,
      front: TILE_INDEX.beehive_front,
    });
    opaqueBuilder.addBox(-26, sy + 1.4, sy + 2.3, -13, 1.05, 1.05, {
      side: TILE_INDEX.oak_bark,
      front: TILE_INDEX.snowman_face,
    });
    glowBuilder.addBox(-26, sy + 2.3, sy + 2.8, -13, 0.75, 0.75, { side: TILE_INDEX.ice_crystal });
  }

  // SE Smiling Critters Soccer Pitch & Tea-Party Crumpet Towers
  addOakTree(28, 14);
  addOakTree(14, 28);
  addLanternPost(11, 8, 1.15);
  addLanternPost(8, 11, 1.15);
  if (isLand[toIdx(28, 28)]) {
    const fy = heights[toIdx(28, 28)];
    markPropFootprint(28, 28, 0.9);
    opaqueBuilder.addBox(28, fy, fy + 3.0, 28, 2.1, 2.1, {
      side: TILE_INDEX.hay_side,
      top: TILE_INDEX.hay_top,
    });
    opaqueBuilder.addBox(28, fy + 3.0, fy + 3.9, 28, 2.4, 2.4, { side: TILE_INDEX.mushroom_red });
    glowBuilder.addBox(28, fy + 3.9, fy + 4.7, 28, 0.9, 0.9, { side: TILE_INDEX.lantern_glow });
  }

  // NE Prototype's Stained-Glass Spider-Mech Workshop Turrets & Jester Obelisks
  addCastleTurret(29, -29);
  addCastleTurret(29, -14);
  addCastleTurret(14, -29);
  addCrystalObelisk(12, -9, TILE_INDEX.ice_crystal);
  addCrystalObelisk(9, -12, TILE_INDEX.amethyst);

  const makeSurfaceMat = (opts) => {
    if (ctx?.isSoftwareGpu) {
      const lambertOpts = { map: opts.map };
      if (opts.color !== undefined) lambertOpts.color = opts.color;
      if (opts.vertexColors) lambertOpts.vertexColors = true;
      if (opts.emissive !== undefined) lambertOpts.emissive = opts.emissive;
      if (opts.emissiveMap) lambertOpts.emissiveMap = opts.emissiveMap;
      if (opts.emissiveIntensity !== undefined) lambertOpts.emissiveIntensity = opts.emissiveIntensity;
      return new THREE.MeshLambertMaterial(lambertOpts);
    }
    return new THREE.MeshStandardMaterial(opts);
  };

  const terrainOpaqueMat = makeSurfaceMat({
    map: textures.atlasTexture,
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.06,
  });
  const terrainOpaqueMesh = new THREE.Mesh(opaqueBuilder.build(), terrainOpaqueMat);
  terrainOpaqueMesh.name = 'TerrainOpaque';
  terrainOpaqueMesh.castShadow = true;
  terrainOpaqueMesh.receiveShadow = true;
  terrainOpaqueMesh.matrixAutoUpdate = false;
  terrainOpaqueMesh.updateMatrix();
  group.add(terrainOpaqueMesh);

  const terrainGlowMat = makeSurfaceMat({
    map: textures.atlasTexture,
    emissive: 0xffffff,
    emissiveMap: textures.emissiveAtlasTexture,
    emissiveIntensity: 0.76,
    vertexColors: true,
    roughness: 0.44,
    metalness: 0.08,
  });
  const terrainGlowMesh = new THREE.Mesh(glowBuilder.build(), terrainGlowMat);
  terrainGlowMesh.name = 'TerrainGlow';
  terrainGlowMesh.castShadow = false;
  terrainGlowMesh.receiveShadow = false;
  terrainGlowMesh.matrixAutoUpdate = false;
  terrainGlowMesh.updateMatrix();
  group.add(terrainGlowMesh);

  // Surrounding Playcare Atrium Floor Grid (1 draw call) + Golden Prank Curb Lights (1 InstancedMesh draw call)
  textures.tiles.water.repeat.set(38, 38);
  const waterGeo = new THREE.PlaneGeometry(176, 176, 1, 1);
  waterGeo.rotateX(-Math.PI * 0.5);
  const waterMat = makeSurfaceMat({
    map: textures.tiles.water,
    color: 0xffffff,
    emissive: 0x2b154d,
    emissiveIntensity: 0.28,
    roughness: 0.62,
    metalness: 0.06,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.52;
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  const foamGeo = new THREE.BoxGeometry(1.14, 0.12, 1.14);
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xff85c0,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const foamMesh = new THREE.InstancedMesh(foamGeo, foamMat, shorelinePositions.length);
  foamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(foamMesh);

  // 4 Interactive Glowing Prank Station Pads (1 InstancedMesh + 4 anchor groups)
  const padGeo = createAtlasBoxGeometry(
    { side: TILE_INDEX.bedrock_gold, top: TILE_INDEX.hub_plaza },
    1.56,
    0.24,
    1.56
  );
  const padMat = new THREE.MeshStandardMaterial({
    map: textures.atlasTexture,
    emissive: 0xff85c0,
    emissiveIntensity: 0.22,
    roughness: 0.55,
    metalness: 0.1,
  });
  const padBaseMesh = new THREE.InstancedMesh(padGeo, padMat, HUB_LAYOUT.flowerpotPads.length);
  padBaseMesh.name = 'FlowerpotPads';
  padBaseMesh.receiveShadow = true;
  group.add(padBaseMesh);

  const padStates = HUB_LAYOUT.flowerpotPads.map((p, idx) => {
    const anchor = new THREE.Group();
    anchor.position.set(p.x, p.y + 0.24, p.z);
    group.add(anchor);
    return {
      padIdx: p.padIdx ?? idx,
      x: p.x,
      y: p.y,
      z: p.z,
      tier: 0,
      anchor,
      popAnim: 0,
    };
  });

  // Center Polka-Dot Jack-in-the-Box Prank Contraption Chest at HUB_LAYOUT.rouletteChest (0, 1, -1.6)
  const chestGroup = new THREE.Group();
  chestGroup.name = 'RouletteChest';
  chestGroup.position.set(
    HUB_LAYOUT.rouletteChest.x,
    HUB_LAYOUT.rouletteChest.y,
    HUB_LAYOUT.rouletteChest.z
  );
  group.add(chestGroup);

  const chestBodyGeo = createAtlasBoxGeometry(
    {
      side: TILE_INDEX.chest_side,
      front: TILE_INDEX.chest_front,
      back: TILE_INDEX.chest_side,
      top: TILE_INDEX.lantern_glow,
      bottom: TILE_INDEX.chest_top,
    },
    1.58,
    0.86,
    1.18
  );
  const chestMat = new THREE.MeshStandardMaterial({
    map: textures.atlasTexture,
    emissive: 0xae3ec9,
    emissiveIntensity: 0.22,
    roughness: 0.52,
    metalness: 0.14,
  });
  const chestBaseMesh = new THREE.Mesh(chestBodyGeo, chestMat);
  chestBaseMesh.position.y = 0.43;
  chestBaseMesh.castShadow = true;
  chestBaseMesh.receiveShadow = true;
  chestGroup.add(chestBaseMesh);

  const chestLidPivot = new THREE.Group();
  chestLidPivot.position.set(0, 0.84, -0.56);
  chestGroup.add(chestLidPivot);

  const chestLidGeo = createAtlasBoxGeometry(
    {
      side: TILE_INDEX.chest_side,
      front: TILE_INDEX.chest_front,
      back: TILE_INDEX.chest_side,
      top: TILE_INDEX.chest_top,
      bottom: TILE_INDEX.lantern_glow,
    },
    1.64,
    0.46,
    1.24
  );
  const chestLidMesh = new THREE.Mesh(chestLidGeo, chestMat);
  chestLidMesh.position.set(0, 0.22, 0.56);
  chestLidMesh.castShadow = true;
  chestLidPivot.add(chestLidMesh);

  let chestOpen = false;
  let chestOpenAngle = 0;

  // 4 Trophy Pedestal Anchors
  const trophyStates = HUB_LAYOUT.trophyPedestals.map((ped) => {
    const anchor = new THREE.Group();
    anchor.position.set(ped.x, 1.74, ped.z);
    group.add(anchor);
    return {
      idx: ped.idx,
      titanId: ped.titanId,
      x: ped.x,
      y: ped.y,
      z: ped.z,
      unlocked: false,
      anchor,
      popAnim: 0,
    };
  });

  // Shared Floor Aura Rings InstancedMesh (14 rings -> 1 draw call; toneMapped: false, fog: false)
  // [0..3]: 4 Pads, [4]: Starter Block, [5]: Roulette Chest, [6..9]: 4 Mega Titans, [10..13]: 4 Trophies
  const RING_COUNT = 14;
  const ringGeo = new THREE.PlaneGeometry(1, 1);
  ringGeo.rotateX(-Math.PI * 0.5);
  const ringMat = new THREE.MeshBasicMaterial({
    map: textures.ringGlowTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, RING_COUNT);
  ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ringMesh.frustumCulled = false;
  group.add(ringMesh);

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  function refreshPadColors() {
    for (let i = 0; i < padStates.length; i++) {
      const p = padStates[i];
      dummy.position.set(p.x, p.y + 0.12, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      padBaseMesh.setMatrixAt(i, dummy.matrix);

      if (p.tier === 0) tmpColor.setHex(p.x < 0 ? 0x74c0fc : 0xf783ac);
      else if (p.tier === 1) tmpColor.setHex(0xffd43b);
      else if (p.tier === 2) tmpColor.setHex(0x69db7c);
      else tmpColor.setHex(0xe599f7);
      padBaseMesh.setColorAt(i, tmpColor);

      const ringColor =
        p.tier === 0
          ? p.x < 0
            ? 0x4dabf7
            : 0xff85c0
          : p.tier === 1
            ? 0xffd43b
            : p.tier === 2
              ? 0x51cf66
              : 0xcc5de8;
      ringMesh.setColorAt(i, tmpColor.setHex(ringColor));
    }
    padBaseMesh.instanceMatrix.needsUpdate = true;
    if (padBaseMesh.instanceColor) padBaseMesh.instanceColor.needsUpdate = true;

    ringMesh.setColorAt(4, tmpColor.setHex(0xff85c0)); // Starter Prank Box ring
    ringMesh.setColorAt(5, tmpColor.setHex(0xffd43b)); // Jack-in-the-Box Chest spotlight ring

    const biomeOrder = ['meadow', 'snow', 'farm', 'castle'];
    const titanRingCols = [0x4dabf7, 0xae3ec9, 0x51cf66, 0xff6b6b];
    for (let i = 0; i < 4; i++) {
      ringMesh.setColorAt(6 + i, tmpColor.setHex(titanRingCols[i]));
      const tr = trophyStates[i];
      ringMesh.setColorAt(10 + i, tmpColor.setHex(tr.unlocked ? 0xffd43b : 0x7950f2));
    }
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    void biomeOrder;
  }

  refreshPadColors();

  function setPadVisual(padIdx, tier, potMeshBuilder) {
    const idx = Number(padIdx);
    const pad = padStates[idx];
    if (!pad) return;
    const clampedTier = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
    pad.tier = clampedTier;

    while (pad.anchor.children.length > 0) {
      pad.anchor.remove(pad.anchor.children[0]);
    }

    if (clampedTier > 0) {
      let mesh = null;
      if (typeof potMeshBuilder === 'function') {
        mesh = potMeshBuilder(clampedTier);
      } else if (potMeshBuilder && potMeshBuilder.isObject3D) {
        mesh = potMeshBuilder;
      } else if (typeof ctx?.buildFlowerpotMesh === 'function') {
        mesh = ctx.buildFlowerpotMesh(clampedTier);
      } else {
        mesh = buildFallbackFlowerpot(clampedTier);
      }
      if (mesh) {
        pad.anchor.add(mesh);
        pad.popAnim = 0.001;
      }
    }
    void FLOWERPOT_TIERS;
    refreshPadColors();
  }

  function setTrophyVisual(idx, titanId, unlocked, trophyMeshBuilder) {
    let slot = trophyStates[Number(idx)];
    if (!slot && titanId) {
      slot = trophyStates.find((t) => t.titanId === titanId);
    }
    if (!slot) return;

    slot.unlocked = Boolean(unlocked);
    const effectiveId = titanId || slot.titanId;

    while (slot.anchor.children.length > 0) {
      slot.anchor.remove(slot.anchor.children[0]);
    }

    if (slot.unlocked) {
      let mesh = null;
      if (typeof trophyMeshBuilder === 'function') {
        mesh = trophyMeshBuilder(effectiveId);
      } else if (trophyMeshBuilder && trophyMeshBuilder.isObject3D) {
        mesh = trophyMeshBuilder;
      } else if (typeof ctx?.buildTrophyMesh === 'function') {
        mesh = ctx.buildTrophyMesh(effectiveId);
      } else {
        mesh = buildFallbackTrophy(effectiveId);
      }
      if (mesh) {
        slot.anchor.add(mesh);
        slot.popAnim = 0.001;
      }
    }
    refreshPadColors();
  }

  function setChestOpen(open) {
    chestOpen = Boolean(open);
  }

  function getSurfaceY(x, z) {
    const cx = Math.round(x);
    const cz = Math.round(z);
    if (!inGrid(cx, cz) || !isLand[toIdx(cx, cz)]) return -Infinity;
    return heights[toIdx(cx, cz)];
  }

  function update(dt = 1 / 60, time = 0, ringVisibility = {}) {
    const clampedDt = Math.min(0.05, Math.max(0, dt));

    // Playcare Atrium floor shimmer & Pink/Gold Curb Lights pulse
    textures.tiles.water.offset.x = (time * 0.06) % 1;
    textures.tiles.water.offset.y = -(time * 0.11) % 1;
    waterMesh.position.y = 0.48;

    for (let i = 0; i < shorelinePositions.length; i++) {
      const sp = shorelinePositions[i];
      const wave = 0.92 + Math.sin(time * 3.0 + sp.x * 0.45 + sp.z * 0.45) * 0.12;
      dummy.position.set(sp.x, 0.58, sp.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(wave, 1, wave);
      dummy.updateMatrix();
      foamMesh.setMatrixAt(i, dummy.matrix);
    }
    foamMesh.instanceMatrix.needsUpdate = true;

    // Jack-in-the-Box Prank Contraption Chest bob + smooth hinged lid open/close
    const targetAngle = chestOpen ? -1.16 : 0;
    chestOpenAngle += (targetAngle - chestOpenAngle) * Math.min(1, clampedDt * 11);
    chestLidPivot.rotation.x = chestOpenAngle;
    const chestBob = chestOpen ? 0.04 : Math.abs(Math.sin(time * 2.3)) * 0.05;
    chestGroup.position.y = HUB_LAYOUT.rouletteChest.y + chestBob;
    const chestScale = 1.24 + Math.sin(time * 3.1) * 0.025;
    chestGroup.scale.set(chestScale, chestScale, chestScale);

    // Animate planted prank stations & unlocked trophies
    for (let i = 0; i < padStates.length; i++) {
      const p = padStates[i];
      if (p.popAnim > 0 && p.popAnim < 1) {
        p.popAnim = Math.min(1, p.popAnim + clampedDt * 3.4);
        const s =
          p.popAnim < 0.7
            ? (p.popAnim / 0.7) * 1.18
            : 1.18 - ((p.popAnim - 0.7) / 0.3) * 0.18;
        p.anchor.scale.setScalar(Math.max(0.01, s));
      } else if (p.tier > 0) {
        const pulse = 1.0 + Math.sin(time * 2.6 + i) * 0.03;
        p.anchor.scale.setScalar(pulse);
      }
    }

    for (let i = 0; i < trophyStates.length; i++) {
      const tr = trophyStates[i];
      if (tr.unlocked) {
        tr.anchor.rotation.y = time * 1.1 + i * 0.8;
        if (tr.popAnim > 0 && tr.popAnim < 1) {
          tr.popAnim = Math.min(1, tr.popAnim + clampedDt * 3.0);
          const s =
            tr.popAnim < 0.7
              ? (tr.popAnim / 0.7) * 1.22
              : 1.22 - ((tr.popAnim - 0.7) / 0.3) * 0.22;
          tr.anchor.scale.setScalar(Math.max(0.01, s));
        }
      }
    }

    // Update all 14 floor glow rings in 1 InstancedMesh
    for (let i = 0; i < 4; i++) {
      const p = padStates[i];
      const rScale = (p.tier > 0 ? 2.35 : 2.05) + Math.sin(time * 3.2 + i) * 0.14;
      dummy.position.set(p.x, p.y + 0.03, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(rScale, 1, rScale);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(i, dummy.matrix);
    }

    // Starter Prank Box floor ring
    if (ringVisibility.starterVisible !== false) {
      const sScale = 2.35 + Math.sin(time * 4.2) * 0.22;
      dummy.position.set(
        HUB_LAYOUT.starterBlock.x,
        HUB_LAYOUT.starterBlock.y + 0.03,
        HUB_LAYOUT.starterBlock.z
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sScale, 1, sScale);
    } else {
      dummy.position.set(0, -500, 0);
      dummy.scale.set(0.001, 0.001, 0.001);
    }
    dummy.updateMatrix();
    ringMesh.setMatrixAt(4, dummy.matrix);

    // Jack-in-the-Box Chest spotlight ring
    const cScale = (chestOpen ? 3.5 : 2.95) + Math.sin(time * 2.8) * 0.18;
    dummy.position.set(
      HUB_LAYOUT.rouletteChest.x,
      HUB_LAYOUT.rouletteChest.y + 0.03,
      HUB_LAYOUT.rouletteChest.z
    );
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(cScale, 1, cScale);
    dummy.updateMatrix();
    ringMesh.setMatrixAt(5, dummy.matrix);

    // 4 Mega Titan floor rings
    const biomeKeys = ['meadow', 'snow', 'farm', 'castle'];
    for (let i = 0; i < 4; i++) {
      const bKey = biomeKeys[i];
      const mp = BIOMES[bKey].megaTitanPos;
      const showMega = ringVisibility.megaVisible ? ringVisibility.megaVisible[i] : true;
      if (showMega) {
        const mScale = 3.6 + Math.sin(time * 5.0 + i) * 0.28;
        dummy.position.set(mp.x, mp.y + 0.04, mp.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(mScale, 1, mScale);
      } else {
        dummy.position.set(0, -500, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      }
      dummy.updateMatrix();
      ringMesh.setMatrixAt(6 + i, dummy.matrix);
    }

    // 4 Trophy Pedestal rings
    for (let i = 0; i < 4; i++) {
      const tr = trophyStates[i];
      const tScale = tr.unlocked ? 1.85 + Math.sin(time * 3.5 + i) * 0.14 : 1.35;
      dummy.position.set(tr.x, 1.26, tr.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(tScale, 1, tScale);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(10 + i, dummy.matrix);
    }

    ringMesh.instanceMatrix.needsUpdate = true;
  }

  function reset() {
    chestOpen = false;
    chestOpenAngle = 0;
    for (let i = 0; i < padStates.length; i++) {
      setPadVisual(i, 0, null);
    }
    for (let i = 0; i < trophyStates.length; i++) {
      setTrophyVisual(i, trophyStates[i].titanId, false, null);
    }
  }

  update(0, 0);

  return {
    group,
    heights,
    isLand,
    staticWalkable,
    isPathCell,
    terrainOpaqueMesh,
    waterMesh,
    padBaseMesh,
    padStates,
    chestGroup,
    chestBaseMesh,
    chestLidMesh,
    trophyStates,
    getBiomeAt,
    getSurfaceY,
    setPadVisual,
    setTrophyVisual,
    setChestOpen,
    update,
    reset,
  };
}
