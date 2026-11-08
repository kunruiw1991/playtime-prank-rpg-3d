// 3D Spinning Pickups, Parabolic Bounce, Auto-Magnet Vacuum, and Anti-Strand Collection
// for Lucky Block Titans 3D (owner: lucky-loot).

import * as THREE from '../../vendor/three.module.min.js';
import { LOOT_TABLE, MOVEMENT_TUNING } from '../data/catalog.js';
import { getGlowVoxelMaterial, mergeVoxelBoxes } from '../chars/props3d.js';
import { syncPlayerStats } from './combat.js';

const RAW_LOOT_MAP = Object.fromEntries(LOOT_TABLE.map((entry) => [entry.id, entry]));
const LOOT_BY_ID = Object.freeze({
  ...RAW_LOOT_MAP,
  star_gem_small: RAW_LOOT_MAP.drum_star_small || RAW_LOOT_MAP.star_gem_small,
  star_gem_cluster: RAW_LOOT_MAP.star_shower_jackpot || RAW_LOOT_MAP.star_gem_cluster,
  pot_seed: RAW_LOOT_MAP.totem_seed || RAW_LOOT_MAP.pot_seed,
  free_spin_chest: RAW_LOOT_MAP.free_spin_token || RAW_LOOT_MAP.free_spin_chest,
  surprise_titan: RAW_LOOT_MAP.surprise_boss || RAW_LOOT_MAP.surprise_titan,
});

const GRAVITY = 15.5;
const MAGNET_BASE_RADIUS = MOVEMENT_TUNING.pickupMagnetRadius; // 3.5b
const MAGNET_CAPE_RADIUS = MOVEMENT_TUNING.capeMagnetRadius; // 5.6b
const COLLECT_DIST = 0.68;
const AUTO_COLLECT_SLOPE_SEC = 4.2;
const AUTO_COLLECT_GENERAL_SEC = 4.2;
const SMALL_STAR_VO_COOLDOWN_SEC = 8.5;
const MAX_INSTANCED_RINGS = 48;
const MAX_INSTANCED_STARS = 48;

const DUPLICATE_GEAR_GEMS = Object.freeze({
  speedBoots: 10,
  helmet: 15,
  starCape: 10,
});

function getPickupBoxes(kind) {
  switch (kind) {
    case 'star_gem_cluster':
    case 'star_shower_jackpot':
      return {
        emissive: 0xffb830,
        intensity: 0.36,
        scale: 1.22,
        boxes: [
          { s: [0.42, 0.42, 0.18], p: [0, 0, 0], r: [0, 0, Math.PI / 4], c: 0xffd43b, glow: true },
          { s: [0.3, 0.3, 0.15], p: [-0.26, 0.16, 0.08], r: [0, 0, Math.PI / 6], c: 0xff6b9d, glow: true },
          { s: [0.3, 0.3, 0.15], p: [0.26, 0.16, -0.08], r: [0, 0, -Math.PI / 6], c: 0x39d5ff, glow: true },
        ],
      };
    case 'pot_seed':
    case 'totem_seed':
      return {
        emissive: 0x40c057,
        intensity: 0.3,
        scale: 1.0,
        boxes: [
          { s: [0.56, 0.22, 0.56], p: [0, -0.12, 0], c: 0x20c997, glow: true },
          { s: [0.16, 0.32, 0.16], p: [0, 0.08, 0], c: 0x9c6644 },
          { s: [0.42, 0.26, 0.42], p: [0, 0.28, 0], c: 0x51cf66, glow: true },
          { s: [0.3, 0.3, 0.15], p: [0, 0.48, 0], r: [0, 0, Math.PI / 4], c: 0xffd43b, glow: true },
        ],
      };
    case 'free_spin_chest':
    case 'free_spin_token':
      return {
        emissive: 0xffb830,
        intensity: 0.34,
        scale: 1.12,
        boxes: [
          { s: [0.56, 0.36, 0.46], p: [0, -0.06, 0], c: 0xfcc419, glow: true },
          { s: [0.58, 0.18, 0.48], p: [0, 0.2, 0], c: 0xffd43b, glow: true },
          { s: [0.14, 0.16, 0.08], p: [0, 0.12, 0.25], c: 0x39d5ff, glow: true },
        ],
      };
    case 'giant_apple':
    case 'croissant_smoothie':
    case 'croissant_mango_feast':
    case 'latte_speed_boost':
      return {
        emissive: 0xff922b,
        intensity: 0.3,
        scale: 1.05,
        boxes: [
          { s: [0.48, 0.34, 0.36], p: [-0.12, 0, 0], c: 0xf08c00, glow: true },
          { s: [0.28, 0.46, 0.28], p: [0.18, 0.06, 0], c: 0xffd43b, glow: true },
          { s: [0.08, 0.24, 0.08], p: [0.18, 0.34, 0], c: 0xff6b9d, glow: true },
        ],
      };
    case 'bouncy_cake':
    case 'silly_whoopee_cushion':
    case 'silly_cushion_toot':
    case 'confetti_fireworks':
    case 'confetti_fireworks_pop':
      return {
        emissive: 0xff8fab,
        intensity: 0.3,
        scale: 1.0,
        boxes: [
          { s: [0.56, 0.24, 0.56], p: [0, -0.08, 0], c: 0xff6b9d, glow: true },
          { s: [0.5, 0.18, 0.5], p: [0, 0.12, 0], c: 0xfff5f5, glow: true },
          { s: [0.14, 0.16, 0.08], p: [0, 0.28, 0], c: 0xff5252, glow: true },
        ],
      };
    case 'speed_boots':
      return {
        emissive: 0x39d5ff,
        intensity: 0.34,
        scale: 1.15,
        boxes: [
          { s: [0.24, 0.34, 0.36], p: [-0.16, 0, 0], c: 0x39d5ff, glow: true },
          { s: [0.24, 0.34, 0.36], p: [0.16, 0, 0], c: 0x39d5ff, glow: true },
          { s: [0.08, 0.24, 0.26], p: [-0.31, 0.1, -0.04], c: 0xfff5f5, glow: true },
          { s: [0.08, 0.24, 0.26], p: [0.31, 0.1, -0.04], c: 0xfff5f5, glow: true },
        ],
      };
    case 'gold_helmet':
      return {
        emissive: 0xffc038,
        intensity: 0.38,
        scale: 1.22,
        boxes: [
          { s: [0.58, 0.44, 0.58], p: [0, 0, 0], c: 0xffd43b, glow: true },
          { s: [0.14, 0.28, 0.14], p: [-0.32, 0.24, 0], r: [0, 0, 0.35], c: 0xfcc419, glow: true },
          { s: [0.14, 0.28, 0.14], p: [0.32, 0.24, 0], r: [0, 0, -0.35], c: 0xfcc419, glow: true },
          { s: [0.14, 0.16, 0.08], p: [0, 0.08, 0.31], c: 0x39d5ff, glow: true },
        ],
      };
    case 'star_cape':
      return {
        emissive: 0xcc5de8,
        intensity: 0.34,
        scale: 1.18,
        boxes: [
          { s: [0.56, 0.62, 0.12], p: [0, 0, 0], r: [0.22, 0, 0], c: 0xcc5de8, glow: true },
          { s: [0.3, 0.3, 0.15], p: [0, 0.22, 0.1], r: [0, 0, Math.PI / 4], c: 0xffd43b, glow: true },
        ],
      };
    case 'star_gem_small':
    default:
      return {
        emissive: 0xffb830,
        intensity: 0.36,
        scale: 1.0,
        boxes: [
          { s: [0.42, 0.42, 0.18], p: [0, 0, 0], c: 0xffd43b, glow: true },
          { s: [0.42, 0.42, 0.18], p: [0, 0, 0], r: [0, 0, Math.PI / 4], c: 0xffec99, glow: true },
        ],
      };
  }
}

function createSharedAssets(group) {
  const geoCache = new Map();
  const matCache = new Map();

  function getMergedKindAsset(kind) {
    const key = kind || 'star_gem_small';
    if (!geoCache.has(key)) {
      const spec = getPickupBoxes(key);
      const geo = mergeVoxelBoxes(spec.boxes);
      const mat = getGlowVoxelMaterial(spec.emissive, spec.intensity);
      geoCache.set(key, { geo, scale: spec.scale });
      matCache.set(key, mat);
    }
    return {
      geo: geoCache.get(key).geo,
      scale: geoCache.get(key).scale,
      mat: matCache.get(key),
    };
  }

  // 1-draw-call InstancedMesh for all floor glow rings!
  const ringGeo = new THREE.RingGeometry(0.22, 0.42, 16);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const ringInstanced = new THREE.InstancedMesh(ringGeo, ringMat, MAX_INSTANCED_RINGS);
  ringInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ringInstanced.count = 0;
  ringInstanced.visible = false;
  ringInstanced.frustumCulled = false;
  group.add(ringInstanced);

  // 1-draw-call InstancedMeshes for common Star Gem pickups (eliminates 60+ Hub draw calls!)
  const smallAsset = getMergedKindAsset('star_gem_small');
  const smallStarInstanced = new THREE.InstancedMesh(
    smallAsset.geo,
    smallAsset.mat,
    MAX_INSTANCED_STARS
  );
  smallStarInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smallStarInstanced.count = 0;
  smallStarInstanced.visible = false;
  smallStarInstanced.frustumCulled = false;
  group.add(smallStarInstanced);

  const clusterAsset = getMergedKindAsset('star_gem_cluster');
  const clusterStarInstanced = new THREE.InstancedMesh(
    clusterAsset.geo,
    clusterAsset.mat,
    MAX_INSTANCED_STARS
  );
  clusterStarInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  clusterStarInstanced.count = 0;
  clusterStarInstanced.visible = false;
  clusterStarInstanced.frustumCulled = false;
  group.add(clusterStarInstanced);

  return {
    getMergedKindAsset,
    ringInstanced,
    smallStarInstanced,
    clusterStarInstanced,
  };
}

function buildPickupMesh(kind, shared) {
  if (kind === 'star_gem_small' || kind === 'drum_star_small') {
    const asset = shared.getMergedKindAsset('star_gem_small');
    return { root: null, visual: null, instancedKind: 'star_gem_small', baseScale: asset.scale };
  }
  if (kind === 'star_gem_cluster' || kind === 'star_shower_jackpot') {
    const asset = shared.getMergedKindAsset('star_gem_cluster');
    return { root: null, visual: null, instancedKind: 'star_gem_cluster', baseScale: asset.scale };
  }

  const asset = shared.getMergedKindAsset(kind);
  const root = new THREE.Group();
  const visual = new THREE.Mesh(asset.geo, asset.mat);
  visual.scale.setScalar(asset.scale);
  root.add(visual);
  return { root, visual, instancedKind: null, baseScale: asset.scale };
}

function playSfx(ctx, primary, fallback) {
  const fn = ctx?.sfx?.[primary] || (fallback ? ctx?.sfx?.[fallback] : null);
  if (typeof fn === 'function') {
    fn.call(ctx.sfx);
  }
}

export function createPickupManager(ctx) {
  const group = new THREE.Group();
  group.name = 'PickupsGroup';
  if (ctx?.scene && typeof ctx.scene.add === 'function') {
    ctx.scene.add(group);
  }

  const shared = createSharedAssets(group);
  const active = [];
  let nextId = 1;
  let lastSmallStarVoAt = -20;

  const _dummy = new THREE.Object3D();

  function recordDropTypeSeen(dropId, source) {
    if (!dropId || source === 'pot_ambient' || source === 'pot_celebration' || source === 'critter_pat') {
      return;
    }
    const fb = ctx?.state?.feedback;
    if (!fb) return;
    if (!Array.isArray(fb.dropTypesSeen)) {
      fb.dropTypesSeen = [];
    }
    if (!fb.dropTypesSeen.includes(dropId)) {
      fb.dropTypesSeen.push(dropId);
    }
  }

  function syncInstancedVisuals() {
    let ringSlot = 0;
    let smallSlot = 0;
    let clusterSlot = 0;

    for (let i = 0; i < active.length; i += 1) {
      const item = active[i];
      const bobOffset =
        !item.magnetized && item.settled
          ? Math.sin(item.age * 4.4 + item.bobPhase) * 0.13
          : 0;
      const drawY = item.y + bobOffset;

      if (ringSlot < MAX_INSTANCED_RINGS) {
        _dummy.position.set(item.x, drawY - 0.3, item.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        shared.ringInstanced.setMatrixAt(ringSlot++, _dummy.matrix);
      }

      if (item.instancedKind === 'star_gem_small' && smallSlot < MAX_INSTANCED_STARS) {
        _dummy.position.set(item.x, drawY, item.z);
        _dummy.rotation.set(0, item.spinY, 0);
        _dummy.scale.setScalar(item.baseScale);
        _dummy.updateMatrix();
        shared.smallStarInstanced.setMatrixAt(smallSlot++, _dummy.matrix);
      } else if (item.instancedKind === 'star_gem_cluster' && clusterSlot < MAX_INSTANCED_STARS) {
        _dummy.position.set(item.x, drawY, item.z);
        _dummy.rotation.set(0, item.spinY, 0);
        _dummy.scale.setScalar(item.baseScale);
        _dummy.updateMatrix();
        shared.clusterStarInstanced.setMatrixAt(clusterSlot++, _dummy.matrix);
      } else if (item.root && item.visual) {
        item.root.position.set(item.x, drawY, item.z);
        item.visual.rotation.y = item.spinY;
      }
    }

    shared.ringInstanced.count = ringSlot;
    shared.ringInstanced.visible = ringSlot > 0;
    if (ringSlot > 0) shared.ringInstanced.instanceMatrix.needsUpdate = true;

    shared.smallStarInstanced.count = smallSlot;
    shared.smallStarInstanced.visible = smallSlot > 0;
    if (smallSlot > 0) shared.smallStarInstanced.instanceMatrix.needsUpdate = true;

    shared.clusterStarInstanced.count = clusterSlot;
    shared.clusterStarInstanced.visible = clusterSlot > 0;
    if (clusterSlot > 0) shared.clusterStarInstanced.instanceMatrix.needsUpdate = true;
  }

  function resolveGround(x, z, fallbackY = 1) {
    if (typeof ctx?.world?.clampToWalkable === 'function') {
      const c = ctx.world.clampToWalkable(x, z);
      if (c && Number.isFinite(c.x) && Number.isFinite(c.z)) {
        return {
          x: c.x,
          y: Number.isFinite(c.y) ? c.y : fallbackY,
          z: c.z,
        };
      }
    }
    const gy = ctx?.world?.getGroundY?.(x, z);
    if (Number.isFinite(gy) && gy > -50) {
      return { x, y: gy, z };
    }
    return { x, y: fallbackY, z };
  }

  function syncActiveDropsState() {
    if (!ctx?.state) return;
    ctx.state.activeDrops = active.map((item) => ({
      uid: item.uid,
      id: item.id,
      gems: item.gems,
      gear: item.gear,
      shield: item.shield,
      source: item.source,
      x: Number(item.x.toFixed(3)),
      y: Number(item.y.toFixed(3)),
      z: Number(item.z.toFixed(3)),
      magnetized: item.magnetized,
    }));
  }

  function spawn(dropSpecOrId, x = 0, y = 1, z = 0, opts = {}) {
    const baseSpec =
      typeof dropSpecOrId === 'string'
        ? LOOT_BY_ID[dropSpecOrId] || LOOT_BY_ID.star_gem_small
        : dropSpecOrId || LOOT_BY_ID.star_gem_small;

    const rng = ctx?.rng;
    const totalInBurst = Math.max(1, Number(opts.total) || 1);
    const idxInBurst = Math.max(0, Number(opts.index) || 0);

    const baseAngle =
      totalInBurst > 1
        ? (idxInBurst / totalInBurst) * Math.PI * 2 + (rng ? rng.range(-0.3, 0.3) : 0.15)
        : rng
          ? rng.range(0, Math.PI * 2)
          : 0.7;

    const horizSpeed =
      typeof opts.horizSpeed === 'number'
        ? opts.horizSpeed
        : rng
          ? rng.range(1.7, 3.1)
          : 2.2;

    const vy =
      typeof opts.vy === 'number' ? opts.vy : rng ? rng.range(4.5, 6.0) : 5.1;

    const safeStart = resolveGround(Number(x) || 0, Number(z) || 0, Number(y) || 1);
    const predictedEnd = resolveGround(
      safeStart.x + Math.cos(baseAngle) * horizSpeed * 0.55,
      safeStart.z + Math.sin(baseAngle) * horizSpeed * 0.55,
      safeStart.y
    );

    const onSlope = Math.abs(predictedEnd.y - safeStart.y) > 0.15;
    const built = buildPickupMesh(baseSpec.id, shared);
    const spawnY = Math.max(safeStart.y + 0.48, (Number(y) || safeStart.y) + 0.48);
    if (built.root) {
      built.root.position.set(safeStart.x, spawnY, safeStart.z);
      group.add(built.root);
    }

    const source = opts.source || 'block';
    const itemId = baseSpec.id || 'star_gem_small';
    recordDropTypeSeen(itemId, source);

    const item = {
      uid: nextId++,
      id: itemId,
      gems: typeof opts.gems === 'number' ? opts.gems : Number(baseSpec.gems) || 0,
      shield: typeof opts.shield === 'number' ? opts.shield : Number(baseSpec.shield) || 0,
      gear: baseSpec.gear || null,
      label: opts.label || baseSpec.label || '+STARS!',
      color: opts.color || baseSpec.color || '#ffd43b',
      voId: opts.silentVo ? null : opts.voId !== undefined ? opts.voId : baseSpec.voId || null,
      isStarterDrop: Boolean(opts.isStarterDrop),
      source,
      x: safeStart.x,
      y: spawnY,
      z: safeStart.z,
      vx: Math.cos(baseAngle) * horizSpeed,
      vy,
      vz: Math.sin(baseAngle) * horizSpeed,
      groundY: safeStart.y,
      onSlope,
      settled: false,
      magnetized: false,
      magnetDelay: typeof opts.magnetDelay === 'number' ? opts.magnetDelay : 0.16,
      age: 0,
      spinY: 0,
      bobPhase: rng ? rng.range(0, Math.PI * 2) : idxInBurst * 1.3,
      root: built.root,
      visual: built.visual,
      instancedKind: built.instancedKind,
      baseScale: built.baseScale || 1.0,
    };

    active.push(item);
    syncInstancedVisuals();
    syncActiveDropsState();
    return item;
  }

  function applyPickup(item, nowSec = 0) {
    const state = ctx?.state;
    const player = state?.player;
    if (!player) return;

    recordDropTypeSeen(item.id, item.source);

    let gemsAwarded = Math.max(0, Number(item.gems) || 0);
    let label = item.label;
    let equippedNewGear = false;

    if (item.id === 'pot_seed' || item.id === 'totem_seed') {
      player.potSeeds = (Number(player.potSeeds) || 0) + 1;
      player.totemSeeds = player.potSeeds;
      if (ctx?.flowerpots?.allMaxed?.()) {
        gemsAwarded += 6;
      }
    } else if (item.id === 'free_spin_chest' || item.id === 'free_spin_token') {
      player.freeSpins = (Number(player.freeSpins) || 0) + 1;
    } else if (
      item.id === 'giant_apple' ||
      item.id === 'croissant_smoothie' ||
      item.id === 'croissant_mango_feast' ||
      item.id === 'latte_speed_boost'
    ) {
      player.appleBoostTimer = 2.5;
    }

    if (item.shield > 0) {
      const nextMax = Math.min(5, Math.max(Number(player.maxShieldHearts) || 3, (Number(player.shieldHearts) || 0) + item.shield));
      player.maxShieldHearts = nextMax;
      player.shieldHearts = Math.min(5, (Number(player.shieldHearts) || 0) + item.shield);
    }

    if (item.gear) {
      if (player[item.gear]) {
        const dupBonus = DUPLICATE_GEAR_GEMS[item.gear] || 10;
        gemsAwarded += dupBonus;
        label = `+${gemsAwarded} STARS!`;
      } else {
        player[item.gear] = true;
        equippedNewGear = true;
        if (item.gear === 'helmet' || item.gear === 'speedBoots') {
          player.maxShieldHearts = 5;
          player.shieldHearts = 5;
        }
      }
    }

    if (gemsAwarded > 0) {
      player.starGems = (Number(player.starGems) || 0) + gemsAwarded;
    }

    syncPlayerStats(ctx);

    if (equippedNewGear) {
      playSfx(ctx, 'gearEquip', 'luckyPop');
    } else if (item.id === 'pot_seed' || item.id === 'free_spin_chest' || item.id === 'star_gem_cluster') {
      playSfx(ctx, 'luckyPop', 'starPickup');
    } else {
      playSfx(ctx, 'starPickup', 'gemPickup');
    }

    const p = ctx?.particles;
    const sparkleFn =
      p?.spawnStarSparkles ||
      p?.starSparkles ||
      p?.spawnSparkles ||
      p?.emitSparkles ||
      p?.sparkle ||
      p?.burst;
    if (typeof sparkleFn === 'function') {
      sparkleFn.call(p, item.x, item.y + 0.3, item.z, item.color, equippedNewGear ? 18 : 8);
    }

    if (item.source !== 'pot_ambient') {
      ctx?.ui?.spawnWorldPopup?.(label, item.x, item.y + 0.85, item.z, item.color);
      ctx?.onPopup?.({ text: label, x: item.x, y: item.y + 0.85, z: item.z, color: item.color });
    }

    // Trigger appropriate VO without cutting off Starter Block onboarding speech!
    if (item.voId && !item.isStarterDrop) {
      if (equippedNewGear) {
        ctx?.voice?.speak?.(item.voId, { priority: 'interrupt' });
      } else if (
        item.id === 'pot_seed' ||
        item.id === 'free_spin_chest' ||
        item.id === 'bouncy_cake' ||
        item.id === 'star_gem_cluster'
      ) {
        ctx?.voice?.speak?.(item.voId, { priority: 'queue' });
      } else if (item.id === 'star_gem_small') {
        if (nowSec - lastSmallStarVoAt >= SMALL_STAR_VO_COOLDOWN_SEC) {
          lastSmallStarVoAt = nowSec;
          ctx?.voice?.speak?.(item.voId, { priority: 'ifIdle' });
        }
      } else {
        ctx?.voice?.speak?.(item.voId, { priority: 'ifIdle' });
      }
    }

    ctx?.onPickupCollected?.(item);
  }

  function removeAt(idx) {
    const [removed] = active.splice(idx, 1);
    if (removed?.root) {
      group.remove(removed.root);
    }
    return removed;
  }

  function collectAllNear(x, z, radius = MAGNET_BASE_RADIUS) {
    const rSq = radius * radius;
    const nowSec = Number(ctx?.state?.time) || 0;
    let count = 0;
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const item = active[i];
      const dx = item.x - x;
      const dz = item.z - z;
      if (dx * dx + dz * dz <= rSq) {
        removeAt(i);
        applyPickup(item, nowSec);
        count += 1;
      }
    }
    if (count > 0) {
      syncInstancedVisuals();
      syncActiveDropsState();
    }
    return count;
  }

  function hasActiveGear(gearKey) {
    return active.some((item) => item.gear === gearKey);
  }

  function countBySource(source) {
    let n = 0;
    for (const item of active) {
      if (item.source === source) n += 1;
    }
    return n;
  }

  function collectOldestBySource(source) {
    const idx = active.findIndex((item) => item.source === source);
    if (idx === -1) return false;
    const item = removeAt(idx);
    applyPickup(item, Number(ctx?.state?.time) || 0);
    syncInstancedVisuals();
    syncActiveDropsState();
    return true;
  }

  function update(dt, time = 0) {
    const step = Math.max(0, Number(dt) || 0);
    if (step === 0 || active.length === 0) return;

    const player = ctx?.state?.player;
    const heroX = Number(player?.x) || 0;
    const heroY = (Number(player?.y) || 1) + 0.72;
    const heroZ = Number(player?.z) || 0;
    const magnetRadius = player?.starCape ? MAGNET_CAPE_RADIUS : MAGNET_BASE_RADIUS;
    const magnetRadiusSq = magnetRadius * magnetRadius;
    const nowSec = Number(ctx?.state?.time) || time || 0;

    let changed = false;

    for (let i = active.length - 1; i >= 0; i -= 1) {
      const item = active[i];
      item.age += step;

      // Spin & cheerful bob
      item.spinY += step * 2.85;

      const heroNearHub = Math.hypot(heroX, heroZ) <= 13.5;
      const forceAntiStrand =
        (item.onSlope && item.age >= AUTO_COLLECT_SLOPE_SEC) ||
        (item.source !== 'pot_ambient' && item.age >= AUTO_COLLECT_GENERAL_SEC) ||
        (item.source === 'pot_ambient' && heroNearHub && item.age >= 2.25);

      if (!item.magnetized && item.age >= item.magnetDelay) {
        const dx = heroX - item.x;
        const dz = heroZ - item.z;
        const dy = heroY - item.y;
        const distSq = dx * dx + dz * dz + dy * dy * 0.35;
        if (distSq <= magnetRadiusSq || forceAntiStrand) {
          item.magnetized = true;
        }
      }

      if (item.magnetized) {
        const dx = heroX - item.x;
        const dy = heroY - item.y;
        const dz = heroZ - item.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist <= COLLECT_DIST || item.age >= AUTO_COLLECT_GENERAL_SEC + 0.75) {
          removeAt(i);
          applyPickup(item, nowSec);
          changed = true;
          continue;
        }

        const pullSpeed = Math.min(26, 12.5 + item.age * 6.5);
        const move = Math.min(dist, pullSpeed * step);
        item.x += (dx / dist) * move;
        item.y += (dy / dist) * move;
        item.z += (dz / dist) * move;
        changed = true;
        continue;
      }

      if (!item.settled) {
        const nextX = item.x + item.vx * step;
        const nextZ = item.z + item.vz * step;
        const ground = resolveGround(nextX, nextZ, item.groundY);
        if (Math.abs(ground.y - item.groundY) > 0.15) {
          item.onSlope = true;
        }
        item.x = ground.x;
        item.z = ground.z;
        item.groundY = ground.y;
        item.vy -= GRAVITY * step;
        item.y += item.vy * step;

        const floorY = item.groundY + 0.44;
        if (item.y <= floorY && item.vy < 0) {
          item.y = floorY;
          if (Math.abs(item.vy) > 1.45) {
            item.vy = -item.vy * 0.38;
            item.vx *= 0.45;
            item.vz *= 0.45;
          } else {
            item.vy = 0;
            item.vx = 0;
            item.vz = 0;
            item.settled = true;
          }
        }
        changed = true;
      }
    }

    syncInstancedVisuals();
    if (changed) {
      syncActiveDropsState();
    }
  }

  function getSnapshot() {
    return active.map((item) => ({
      uid: item.uid,
      id: item.id,
      gems: item.gems,
      gear: item.gear,
      shield: item.shield,
      source: item.source,
      x: Number(item.x.toFixed(3)),
      y: Number(item.y.toFixed(3)),
      z: Number(item.z.toFixed(3)),
      magnetized: item.magnetized,
    }));
  }

  function reset() {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i]?.root) {
        group.remove(active[i].root);
      }
    }
    active.length = 0;
    nextId = 1;
    lastSmallStarVoAt = -20;
    syncInstancedVisuals();
    if (ctx?.state) {
      ctx.state.activeDrops = [];
    }
  }

  return {
    group,
    spawn,
    collectAllNear,
    hasActiveGear,
    countBySource,
    collectOldestBySource,
    update,
    getSnapshot,
    reset,
  };
}
