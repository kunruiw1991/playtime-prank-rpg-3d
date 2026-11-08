// Instanced breakable blocks, Starter Lucky Block, 4 Trembling 2x2x2 Mega Titan Blocks, and 12s/8s regrow loop (owner: lucky-world).

import * as THREE from '../../vendor/three.module.min.js';
import { BIOMES, HUB_LAYOUT } from '../data/catalog.js';
import { createRng } from '../core/rng.js';
import { TILE_INDEX, createAtlasBoxGeometry } from './textures.js';

const NORMAL_REGROW_SEC = 12.0;
const MEGA_REGROW_SEC = 8.0;

const BLOCK_SPECS = Object.freeze({
  lucky_block: {
    faces: { side: TILE_INDEX.lucky_block },
    maxHp: 20,
    isLucky: true,
    isTough: false,
    emissive: 0xffd43b,
    emissiveIntensity: 0.34,
    castShadow: true,
  },
  flower_red: {
    faces: { side: TILE_INDEX.flower_red_side, top: TILE_INDEX.flower_red_top, bottom: TILE_INDEX.grass_top },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0x33080e,
    emissiveIntensity: 0.12,
    castShadow: false,
  },
  flower_sun: {
    faces: { side: TILE_INDEX.flower_sun_side, top: TILE_INDEX.flower_sun_top, bottom: TILE_INDEX.grass_top },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0x3b2800,
    emissiveIntensity: 0.14,
    castShadow: false,
  },
  oak_log: {
    faces: { side: TILE_INDEX.oak_bark, top: TILE_INDEX.oak_top },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0x1a0f05,
    emissiveIntensity: 0.08,
    castShadow: false,
  },
  spruce_log: {
    faces: { side: TILE_INDEX.spruce_bark, top: TILE_INDEX.spruce_top },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0x120b06,
    emissiveIntensity: 0.08,
    castShadow: false,
  },
  hay_bale: {
    faces: { side: TILE_INDEX.hay_side, top: TILE_INDEX.hay_top },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0x332400,
    emissiveIntensity: 0.12,
    castShadow: false,
  },
  pumpkin: {
    faces: {
      side: TILE_INDEX.pumpkin_side,
      front: TILE_INDEX.pumpkin_front,
      back: TILE_INDEX.pumpkin_front,
      top: TILE_INDEX.pumpkin_top,
    },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0xffaa22,
    emissiveIntensity: 0.2,
    castShadow: false,
  },
  melon: {
    faces: { side: TILE_INDEX.melon_side, top: TILE_INDEX.melon_top },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0x0b2910,
    emissiveIntensity: 0.1,
    castShadow: false,
  },
  beehive: {
    faces: {
      side: TILE_INDEX.beehive_side,
      front: TILE_INDEX.beehive_front,
      back: TILE_INDEX.beehive_front,
      top: TILE_INDEX.beehive_top,
    },
    maxHp: 20,
    isLucky: false,
    isTough: false,
    emissive: 0xffa800,
    emissiveIntensity: 0.22,
    castShadow: false,
  },
  ice_crystal: {
    faces: { side: TILE_INDEX.ice_crystal },
    maxHp: 25,
    isLucky: false,
    isTough: true,
    emissive: 0x3de0ff,
    emissiveIntensity: 0.42,
    castShadow: false,
  },
  royal_furnace: {
    faces: {
      side: TILE_INDEX.furnace_side,
      front: TILE_INDEX.furnace_front,
      back: TILE_INDEX.furnace_front,
      top: TILE_INDEX.castle_brick,
    },
    maxHp: 25,
    isLucky: false,
    isTough: true,
    emissive: 0xff7b1c,
    emissiveIntensity: 0.36,
    castShadow: false,
  },
  amethyst: {
    faces: { side: TILE_INDEX.amethyst },
    maxHp: 25,
    isLucky: false,
    isTough: true,
    emissive: 0xb14dff,
    emissiveIntensity: 0.38,
    castShadow: false,
  },
  mega_titan: {
    faces: { side: TILE_INDEX.mega_titan_side, top: TILE_INDEX.mega_titan_top },
    maxHp: 50,
    isLucky: false,
    isTough: true,
    emissive: 0xffb703,
    emissiveIntensity: 0.38,
    castShadow: true,
  },
});

// Exact biome recipes summing to 112 ordinary/lucky blocks + 1 Starter + 4 Mega Titans = 117 breakables
const BIOME_QUOTAS = Object.freeze({
  hub: [
    { type: 'lucky_block', count: 4 },
    { type: 'flower_red', count: 3 },
    { type: 'flower_sun', count: 3 },
  ],
  meadow: [
    { type: 'lucky_block', count: 5 },
    { type: 'flower_red', count: 8 },
    { type: 'flower_sun', count: 5 },
    { type: 'oak_log', count: 5 },
    { type: 'hay_bale', count: 3 },
  ],
  snow: [
    { type: 'lucky_block', count: 5 },
    { type: 'ice_crystal', count: 9 },
    { type: 'spruce_log', count: 7 },
    { type: 'amethyst', count: 4 },
  ],
  farm: [
    { type: 'lucky_block', count: 5 },
    { type: 'pumpkin', count: 7 },
    { type: 'melon', count: 5 },
    { type: 'beehive', count: 5 },
    { type: 'hay_bale', count: 4 },
  ],
  castle: [
    { type: 'lucky_block', count: 5 },
    { type: 'royal_furnace', count: 9 },
    { type: 'amethyst', count: 7 },
    { type: 'flower_sun', count: 4 },
  ],
});

export function createBreakableBlocks({ textures, island, nav, ctx = {} }) {
  const group = new THREE.Group();
  group.name = 'BreakableBlocksGroup';

  // Count fixed slot capacity per blockType so GPU InstancedMeshes never reallocate on reset(seed)
  const countsByType = {};
  for (const key of Object.keys(BLOCK_SPECS)) countsByType[key] = 0;
  countsByType.lucky_block += 1; // Starter Lucky Block
  countsByType.mega_titan = 4; // 4 Biome Mega Titan Blocks
  for (const list of Object.values(BIOME_QUOTAS)) {
    for (const item of list) {
      countsByType[item.type] += item.count;
    }
  }

  const instancedMeshes = {};
  const raycastTargets = [];
  // Map (mesh.uuid + ':' + instanceId) -> blockObj for instant O(1) raycast resolution
  const meshInstanceToBlock = new Map();

  for (const [type, count] of Object.entries(countsByType)) {
    if (count <= 0) continue;
    const spec = BLOCK_SPECS[type];
    const isMega = type === 'mega_titan';
    const geo = createAtlasBoxGeometry(spec.faces, 1, 1, 1);
    const emissiveMap =
      type === 'lucky_block' ||
      type === 'pumpkin' ||
      type === 'beehive' ||
      type === 'ice_crystal' ||
      type === 'royal_furnace' ||
      type === 'amethyst' ||
      isMega
        ? textures.emissiveAtlasTexture
        : null;
    const mat = ctx?.isSoftwareGpu
      ? new THREE.MeshLambertMaterial({
          map: textures.atlasTexture,
          emissive: spec.emissive,
          emissiveMap,
          emissiveIntensity: spec.emissiveIntensity,
        })
      : new THREE.MeshStandardMaterial({
          map: textures.atlasTexture,
          emissive: spec.emissive,
          emissiveMap,
          emissiveIntensity: spec.emissiveIntensity,
          roughness: 0.68,
          metalness: 0.08,
        });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.name = `Blocks_${type}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = Boolean(spec.castShadow);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, white);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    group.add(mesh);
    instancedMeshes[type] = mesh;
    raycastTargets.push(mesh);
  }

  // Floating golden Crown / Exclamation aura topper above the 4 Mega Titan Blocks (1 draw call)
  const topperGeo = new THREE.OctahedronGeometry(0.46, 0);
  const topperMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    toneMapped: false,
    fog: false,
  });
  const megaTopperMesh = new THREE.InstancedMesh(topperGeo, topperMat, 4);
  megaTopperMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  megaTopperMesh.frustumCulled = false;
  group.add(megaTopperMesh);

  let blocks = [];
  const blocksByKey = new Map();
  const defeatedTitanIds = new Set();

  function isReservedClearZone(cx, cz) {
    // Spawn & central sightline corridor from Hero Spawn -> Starter Block -> Roulette Chest
    if (Math.abs(cx) <= 2.4 && cz >= -3.2 && cz <= 6.8) return true;
    if (Math.hypot(cx - HUB_LAYOUT.spawn.x, cz - HUB_LAYOUT.spawn.z) < 2.8) return true;
    if (Math.hypot(cx - HUB_LAYOUT.boingLanding.x, cz - HUB_LAYOUT.boingLanding.z) < 2.4) return true;
    if (Math.hypot(cx - HUB_LAYOUT.rouletteChest.x, cz - HUB_LAYOUT.rouletteChest.z) < 2.8) return true;

    // North Hub Trophy Stage clearance
    if (cz <= -5.5 && Math.abs(cx) <= 7.2) return true;

    // 4 Flowerpot Pads clearance
    for (const pad of HUB_LAYOUT.flowerpotPads) {
      if (Math.hypot(cx - pad.x, cz - pad.z) < 2.35) return true;
    }

    // 4 Mega Titan Boss Arenas clearance
    for (const bKey of ['meadow', 'snow', 'farm', 'castle']) {
      const mp = BIOMES[bKey].megaTitanPos;
      if (Math.hypot(cx - mp.x, cz - mp.z) < 3.8) return true;
    }

    return false;
  }

  function collectBiomeCandidates(biomeId, rng) {
    const candidates = [];
    for (let cz = -31; cz <= 31; cz++) {
      for (let cx = -31; cx <= 31; cx++) {
        if (!nav.isCellPassable(cx, cz, true)) continue;
        const y = island.getSurfaceY(cx, cz);
        // Never block half-step terrace ramps (y === 1.5) or cells directly bordering ramps
        if (!Number.isFinite(y) || Math.abs(y - 1.5) < 0.1) continue;
        if (
          Math.abs(island.getSurfaceY(cx + 1, cz) - 1.5) < 0.1 ||
          Math.abs(island.getSurfaceY(cx - 1, cz) - 1.5) < 0.1 ||
          Math.abs(island.getSurfaceY(cx, cz + 1) - 1.5) < 0.1 ||
          Math.abs(island.getSurfaceY(cx, cz - 1) - 1.5) < 0.1
        ) {
          continue;
        }

        const cellIdx = (cz - -36) * 73 + (cx - -36);
        if (island.isPathCell[cellIdx]) continue;
        if (isReservedClearZone(cx, cz)) continue;

        const r = Math.hypot(cx, cz);
        if (biomeId === 'hub') {
          if (r >= 8.0 && r <= 11.0 && cz > -5.2) {
            candidates.push({ cx, cz, y });
          }
        } else {
          if (r < 11.8) continue;
          if (island.getBiomeAt(cx, cz) !== biomeId) continue;
          // Ensure neighbor margin from ocean cliff so pickups stay comfortably on land
          if (
            !Number.isFinite(island.getSurfaceY(cx + 1, cz)) ||
            !Number.isFinite(island.getSurfaceY(cx - 1, cz)) ||
            !Number.isFinite(island.getSurfaceY(cx, cz + 1)) ||
            !Number.isFinite(island.getSurfaceY(cx, cz - 1))
          ) {
            continue;
          }
          candidates.push({ cx, cz, y });
        }
      }
    }

    // Deterministic Fisher-Yates shuffle using seeded PRNG
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    return candidates;
  }

  function populateBlocks(seed = 2026) {
    const rng = createRng(((Number(seed) >>> 0) ^ 0x5bd1e995) >>> 0);
    blocks = [];
    blocksByKey.clear();
    meshInstanceToBlock.clear();
    nav.clearDynamicBlockers();

    const typeCursor = {};
    for (const k of Object.keys(BLOCK_SPECS)) typeCursor[k] = 0;

    let nextId = 0;
    const placedPositions = [];

    function registerBlock({
      key,
      x,
      y,
      z,
      blockType,
      biome,
      size = 1,
      scale = 1,
      isStarter = false,
      isMegaTitan = false,
      titanId = null,
      megaIndex = -1,
    }) {
      const spec = BLOCK_SPECS[blockType];
      const mesh = instancedMeshes[blockType];
      const instanceId = typeCursor[blockType]++;
      const block = {
        id: nextId++,
        key,
        x,
        y,
        z,
        size,
        scale,
        baseScale: scale,
        blockType,
        biome,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        isTough: spec.isTough,
        isStarter,
        isLucky: Boolean(spec.isLucky || isStarter),
        isMegaTitan,
        titanId: titanId || BIOMES[biome]?.titanId || null,
        broken: false,
        sleepPokes: 0,
        sleepGemDrops: 0,
        regrowTimer: 0,
        regrowPop: 1,
        hitFlash: 0,
        phase: rng.range(0, Math.PI * 2),
        mesh,
        instanceId,
        megaIndex,
      };
      blocks.push(block);
      blocksByKey.set(key, block);
      meshInstanceToBlock.set(`${mesh.uuid}:${instanceId}`, block);
      placedPositions.push({ x, z, minSep: isMegaTitan ? 2.8 : 2.0 });
      nav.setDynamicBlocked(x, z, size, true);
      return block;
    }

    // 1. Starter Lucky Block at (0, 1, 2.0) — 1.35x scale!
    registerBlock({
      key: 'starter_lucky',
      x: HUB_LAYOUT.starterBlock.x,
      y: HUB_LAYOUT.starterBlock.y,
      z: HUB_LAYOUT.starterBlock.z,
      blockType: 'lucky_block',
      biome: 'hub',
      size: 1,
      scale: 1.35,
      isStarter: true,
      isMegaTitan: false,
      titanId: null,
    });

    // 2. The 4 Trembling 2x2x2 Mega Titan Mystery Blocks at BIOMES[b].megaTitanPos
    const megaBiomes = ['meadow', 'snow', 'farm', 'castle'];
    for (let m = 0; m < megaBiomes.length; m++) {
      const bKey = megaBiomes[m];
      const bInfo = BIOMES[bKey];
      const mp = bInfo.megaTitanPos;
      registerBlock({
        key: `mega_${bKey}`,
        x: mp.x,
        y: mp.y,
        z: mp.z,
        blockType: 'mega_titan',
        biome: bKey,
        size: 2,
        scale: 2.0,
        isStarter: false,
        isMegaTitan: true,
        titanId: bInfo.titanId,
        megaIndex: m,
      });
    }

    // 3. Populate Hub outer ring + 4 Pocket Biomes (~112 blocks)
    for (const [biomeId, quotas] of Object.entries(BIOME_QUOTAS)) {
      const pool = collectBiomeCandidates(biomeId, rng);
      const typesToPlace = [];
      for (const q of quotas) {
        for (let k = 0; k < q.count; k++) typesToPlace.push(q.type);
      }
      // Interleave Lucky Blocks evenly across biome
      for (let i = typesToPlace.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const t = typesToPlace[i];
        typesToPlace[i] = typesToPlace[j];
        typesToPlace[j] = t;
      }

      let poolCursor = 0;
      for (let tIdx = 0; tIdx < typesToPlace.length; tIdx++) {
        const bType = typesToPlace[tIdx];
        let chosen = null;

        // First pass: comfortable 2.05-block spacing; fallback pass: 1.45-block spacing
        for (const minDist of [2.05, 1.45]) {
          for (let attempt = 0; attempt < pool.length; attempt++) {
            const cand = pool[(poolCursor + attempt) % pool.length];
            let tooClose = false;
            for (let p = 0; p < placedPositions.length; p++) {
              const prev = placedPositions[p];
              if (Math.hypot(cand.cx - prev.x, cand.cz - prev.z) < Math.max(minDist, prev.minSep)) {
                tooClose = true;
                break;
              }
            }
            if (!tooClose) {
              chosen = cand;
              poolCursor = (poolCursor + attempt + 1) % Math.max(1, pool.length);
              break;
            }
          }
          if (chosen) break;
        }

        if (chosen) {
          registerBlock({
            key: `blk_${biomeId}_${tIdx}_${chosen.cx}_${chosen.cz}`,
            x: chosen.cx,
            y: chosen.y,
            z: chosen.cz,
            blockType: bType,
            biome: biomeId,
            size: 1,
            scale: 1.0,
          });
        }
      }
    }

    updateVisuals(0, 0);
  }

  function isTitanConquered(titanId) {
    if (!titanId) return false;
    if (defeatedTitanIds.has(titanId)) return true;
    const stateTrophies = ctx?.state?.trophies;
    if (Array.isArray(stateTrophies) && stateTrophies.includes(titanId)) return true;
    return false;
  }

  function markTitanDefeated(titanId, defeated = true) {
    if (!titanId) return;
    if (defeated) {
      defeatedTitanIds.add(titanId);
      // Keep conquered biome's Mega Titan Block cleared
      for (const b of blocks) {
        if (b.isMegaTitan && b.titanId === titanId) {
          b.broken = true;
          b.hp = 0;
          b.regrowTimer = 0;
          nav.setDynamicBlocked(b.x, b.z, b.size, false);
        }
      }
    } else {
      defeatedTitanIds.delete(titanId);
    }
  }

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const MEGA_ACCENTS = [0xc0ff8c, 0x99f6ff, 0xffe066, 0xffb3c6];

  function updateVisuals(dt, time) {
    const dirtyMeshes = new Set();
    const dirtyColors = new Set();

    const heroX = ctx?.state?.player?.x;
    const heroZ = ctx?.state?.player?.z;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];

      if (b.broken) {
        if (b.isMegaTitan && isTitanConquered(b.titanId)) {
          // Conquered Mega Titan block stays cleared permanently
          b.regrowTimer = 0;
        } else if (dt > 0) {
          b.regrowTimer -= dt;
          if (b.regrowTimer <= 0) {
            const playerStandingOnSpot =
              Number.isFinite(heroX) &&
              Number.isFinite(heroZ) &&
              Math.hypot(heroX - b.x, heroZ - b.z) < b.size * 0.5 + 0.55;

            if (playerStandingOnSpot) {
              b.regrowTimer = 0.25;
            } else {
              b.broken = false;
              b.hp = b.maxHp;
              b.sleepPokes = 0;
              b.sleepGemDrops = 0;
              b.regrowTimer = 0;
              b.regrowPop = 0.01;
              b.hitFlash = 0;
              if (b.key === 'starter_lucky') {
                // Subsequent regrows act as regular rainbow Lucky Blocks
                b.isStarter = false;
                b.scale = 1.15;
              }
              nav.setDynamicBlocked(b.x, b.z, b.size, true);
            }
          }
        }
      }

      const liveSpotTitan = b.isMegaTitan ? ctx?.titans?.getTitan?.(b.titanId) : null;
      const titanAwakeOnSpot = Boolean(
        liveSpotTitan && liveSpotTitan.active && !liveSpotTitan.defeated && (liveSpotTitan.hp ?? 1) > 0
      );

      if (b.broken || titanAwakeOnSpot) {
        dummy.position.set(0, -500, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
        dummy.updateMatrix();
        b.mesh.setMatrixAt(b.instanceId, dummy.matrix);
        dirtyMeshes.add(b.mesh);

        if (b.isMegaTitan && b.megaIndex >= 0) {
          megaTopperMesh.setMatrixAt(b.megaIndex, dummy.matrix);
        }
        continue;
      }

      // Advance bouncy regrow scale-in & hit flash decay
      if (b.regrowPop < 1) {
        b.regrowPop = Math.min(1, b.regrowPop + dt * 2.8);
      }
      if (b.hitFlash > 0) {
        b.hitFlash = Math.max(0, b.hitFlash - dt * 5.5);
      }

      let popMul = 1.0;
      if (b.regrowPop < 1) {
        popMul =
          b.regrowPop < 0.72
            ? (b.regrowPop / 0.72) * 1.18
            : 1.18 - ((b.regrowPop - 0.72) / 0.28) * 0.18;
      }

      let hopY = 0;
      let rotX = 0;
      let rotY = 0;
      let rotZ = 0;
      let sx = b.scale * popMul;
      let sy = b.scale * popMul;
      let sz = b.scale * popMul;

      if (b.key === 'starter_lucky' && b.isStarter) {
        hopY = Math.abs(Math.sin(time * 3.3)) * 0.16;
        rotY = Math.sin(time * 2.0) * 0.12;
        rotZ = Math.cos(time * 2.6) * 0.05;
      } else if (b.isMegaTitan) {
        // Trembling 2x2x2 Mega Titan Mystery Block wobble — escalates dramatically as hp drops!
        const dmgFrac = Math.max(0, Math.min(1, 1 - (Number(b.hp) || b.maxHp) / Math.max(1, b.maxHp)));
        const freqBoost = 1 + dmgFrac * 1.45;
        const ampBoost = 1 + dmgFrac * 1.85;
        hopY = Math.abs(Math.sin(time * 6.8 * freqBoost + b.phase)) * (0.1 * ampBoost);
        rotZ = Math.sin(time * 24.0 * freqBoost + b.phase) * (0.048 * ampBoost);
        rotX = Math.cos(time * 20.0 * freqBoost + b.phase) * (0.036 * ampBoost);
        const pulse = 1.0 + Math.sin(time * 6.8 * freqBoost + b.phase) * (0.035 * ampBoost);
        sx *= pulse;
        sz *= pulse;
      } else if (b.isLucky) {
        hopY = Math.abs(Math.sin(time * 2.4 + b.phase)) * 0.06;
        rotY = Math.sin(time * 1.4 + b.phase) * 0.05;
      }

      if (b.hitFlash > 0) {
        const wob = Math.sin(b.hitFlash * Math.PI * 3) * 0.14 * b.hitFlash;
        rotZ += wob;
        sx *= 1 + 0.14 * b.hitFlash;
        sz *= 1 + 0.14 * b.hitFlash;
        sy *= 1 - 0.12 * b.hitFlash;
      }

      dummy.position.set(b.x, b.y + sy * 0.5 + hopY, b.z);
      dummy.rotation.set(rotX, rotY, rotZ);
      dummy.scale.set(Math.max(0.01, sx), Math.max(0.01, sy), Math.max(0.01, sz));
      dummy.updateMatrix();
      b.mesh.setMatrixAt(b.instanceId, dummy.matrix);
      dirtyMeshes.add(b.mesh);

      // Update per-instance damage/flash/accent tint
      if (b.hitFlash > 0.01) {
        tmpColor.setRGB(1.45, 1.35, 1.05);
        b.mesh.setColorAt(b.instanceId, tmpColor);
        dirtyColors.add(b.mesh);
      } else if (b.hp < b.maxHp) {
        tmpColor.setRGB(1.12, 0.8, 0.68);
        b.mesh.setColorAt(b.instanceId, tmpColor);
        dirtyColors.add(b.mesh);
      } else if (b.isMegaTitan && b.megaIndex >= 0) {
        tmpColor.setHex(MEGA_ACCENTS[b.megaIndex]);
        b.mesh.setColorAt(b.instanceId, tmpColor);
        dirtyColors.add(b.mesh);
      } else {
        tmpColor.setHex(0xffffff);
        b.mesh.setColorAt(b.instanceId, tmpColor);
        dirtyColors.add(b.mesh);
      }

      if (b.isMegaTitan && b.megaIndex >= 0) {
        dummy.position.set(b.x, b.y + sy + 0.68 + Math.sin(time * 4.5 + b.megaIndex) * 0.16, b.z);
        dummy.rotation.set(0, time * 2.4 + b.megaIndex, 0);
        const ts = 0.9 + Math.sin(time * 5.2 + b.megaIndex) * 0.12;
        dummy.scale.set(ts, ts * 1.35, ts);
        dummy.updateMatrix();
        megaTopperMesh.setMatrixAt(b.megaIndex, dummy.matrix);
      }
    }

    for (const m of dirtyMeshes) {
      m.instanceMatrix.needsUpdate = true;
    }
    for (const m of dirtyColors) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    megaTopperMesh.instanceMatrix.needsUpdate = true;
  }

  function getBreakableByKey(keyOrObj) {
    if (!keyOrObj) return null;
    if (typeof keyOrObj === 'object' && keyOrObj.key) {
      return blocksByKey.get(keyOrObj.key) || null;
    }
    if (typeof keyOrObj === 'number') {
      return blocks[keyOrObj] || null;
    }
    return blocksByKey.get(String(keyOrObj)) || null;
  }

  function getBreakableAt(x, y, z, radius = 1.6) {
    // Support both (x, y, z, radius) and (x, z) convenience calls
    let qx = Number(x);
    let qy = Number(y);
    let qz = Number(z);
    let rad = Number(radius);
    if (z === undefined && Number.isFinite(qx) && Number.isFinite(qy)) {
      qz = qy;
      qy = NaN;
      rad = 1.6;
    }
    if (!Number.isFinite(rad) || rad <= 0) rad = 1.6;

    let best = null;
    let bestDist = Infinity;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.broken) continue;
      const half = (b.size - 1) * 0.5;
      const horizDist = Math.max(0, Math.hypot(qx - b.x, qz - b.z) - half);
      if (horizDist > rad) continue;

      if (Number.isFinite(qy)) {
        const minY = b.y - 0.85;
        const maxY = b.y + b.scale + 0.85;
        if (qy < minY || qy > maxY) {
          const vertExcess = qy < minY ? minY - qy : qy - maxY;
          if (vertExcess > rad) continue;
        }
      }

      if (horizDist < bestDist) {
        bestDist = horizDist;
        best = b;
      }
    }
    return best;
  }

  function hitBlock(key, damage = 10) {
    const b = getBreakableByKey(key);
    if (!b || b.broken) {
      return { hit: false, broken: false, block: b || null };
    }

    const dmg = Math.max(1, Number(damage) || 10);
    b.hp = Math.max(0, b.hp - dmg);
    b.hitFlash = 1.0;

    if (b.hp <= 0) {
      b.broken = true;
      b.regrowTimer = b.isMegaTitan ? MEGA_REGROW_SEC : NORMAL_REGROW_SEC;
      nav.setDynamicBlocked(b.x, b.z, b.size, false);
      updateVisuals(0, ctx?.state?.time || 0);
      return { hit: true, broken: true, block: b };
    }

    return { hit: true, broken: false, block: b };
  }

  function resolveRaycastBlock(intersection) {
    if (!intersection || intersection.instanceId === undefined) return null;
    const b = meshInstanceToBlock.get(`${intersection.object.uuid}:${intersection.instanceId}`);
    if (!b || b.broken) return null;
    return b;
  }

  function getRingVisibility() {
    const starter = blocksByKey.get('starter_lucky');
    const megaKeys = ['mega_meadow', 'mega_snow', 'mega_farm', 'mega_castle'];
    return {
      starterVisible: Boolean(starter && !starter.broken),
      megaVisible: megaKeys.map((k) => {
        const mb = blocksByKey.get(k);
        return Boolean(mb && !mb.broken);
      }),
    };
  }

  function getAllBreakables() {
    return blocks;
  }

  function reset(seed = 2026) {
    defeatedTitanIds.clear();
    populateBlocks(seed);
  }

  populateBlocks(ctx?.state?.seed ?? 2026);

  return {
    group,
    raycastTargets,
    getBreakableAt,
    getBreakableByKey,
    getAllBreakables,
    hitBlock,
    resolveRaycastBlock,
    markTitanDefeated,
    getRingVisibility,
    update: updateVisuals,
    reset,
  };
}
