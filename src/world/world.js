// Master World facade for Lucky Block Titans 3D implementing DESIGN.md section 5.1 (owner: lucky-world).

import * as THREE from '../../vendor/three.module.min.js';
import { HUB_LAYOUT } from '../data/catalog.js';
import { createWorldTextures } from './textures.js';
import { createSky } from './sky.js';
import { createIsland } from './island.js';
import { createNavGrid } from './nav.js';
import { createBreakableBlocks } from './blocks.js';

export function createWorld(ctx = {}) {
  const group = new THREE.Group();
  group.name = 'LuckyWorld';

  const textures = createWorldTextures();
  const sky = createSky(textures);
  const island = createIsland(textures, ctx);

  const nav = createNavGrid({
    staticWalkable: island.staticWalkable,
    heights: island.heights,
    getSurfaceY: island.getSurfaceY,
  });

  const blocks = createBreakableBlocks({
    textures,
    island,
    nav,
    ctx,
  });

  group.add(sky.group);
  group.add(island.group);
  group.add(blocks.group);

  if (ctx?.scene && typeof ctx.scene.add === 'function') {
    ctx.scene.add(group);
  }

  let internalTime = 0;
  const raycaster = new THREE.Raycaster();
  const ndcVec = new THREE.Vector2();
  const fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
  const tmpHit = new THREE.Vector3();
  const tmpBox = new THREE.Box3();

  function update(dt = 1 / 60, time) {
    const safeDt = Math.min(0.1, Math.max(0, Number(dt) || 0));
    internalTime = Number.isFinite(time) ? time : internalTime + safeDt;

    sky.update(safeDt, internalTime);
    blocks.update(safeDt, internalTime);
    island.update(safeDt, internalTime, blocks.getRingVisibility());
  }

  function getGroundY(x, z) {
    return island.getSurfaceY(Number(x), Number(z));
  }

  function getBiomeAt(x, z) {
    return island.getBiomeAt(Number(x), Number(z));
  }

  function clampToWalkable(x, z) {
    return nav.clampToWalkable(Number(x), Number(z));
  }

  function findPath(sx, sz, tx, tz) {
    return nav.findPath(Number(sx), Number(sz), Number(tx), Number(tz));
  }

  function getBreakableAt(x, y, z, radius = 1.6) {
    return blocks.getBreakableAt(x, y, z, radius);
  }

  function getBreakableByKey(key) {
    return blocks.getBreakableByKey(key);
  }

  function getAllBreakables() {
    return blocks.getAllBreakables();
  }

  function hitBlock(key, damage = 10) {
    return blocks.hitBlock(key, damage);
  }

  function setPadVisual(padIdx, tier, potMeshBuilder) {
    island.setPadVisual(padIdx, tier, potMeshBuilder);
  }

  function setTrophyVisual(idx, titanId, unlocked, trophyMeshBuilder) {
    const ped = HUB_LAYOUT.trophyPedestals[Number(idx)];
    const effectiveTitanId = titanId || ped?.titanId || null;
    island.setTrophyVisual(idx, effectiveTitanId, unlocked, trophyMeshBuilder);
    if (effectiveTitanId) {
      blocks.markTitanDefeated(effectiveTitanId, Boolean(unlocked));
    }
  }

  function setChestOpen(open) {
    island.setChestOpen(open);
  }

  function raycastTap(ndcX, ndcY, camera) {
    const activeCam = camera || ctx?.camera;
    if (!activeCam) {
      const fallback = clampToWalkable(0, 4.5);
      return {
        kind: 'ground',
        target: fallback,
        point: new THREE.Vector3(fallback.x, fallback.y, fallback.z),
      };
    }

    activeCam.updateMatrixWorld();
    group.updateMatrixWorld();

    ndcVec.set(
      Math.max(-1, Math.min(1, Number(ndcX) || 0)),
      Math.max(-1, Math.min(1, Number(ndcY) || 0))
    );
    raycaster.setFromCamera(ndcVec, activeCam);
    const ray = raycaster.ray;

    let bestInteractive = null;
    let bestInteractiveDist = Infinity;

    // 1. Check Giant Golden Roulette Chest generous hitbox
    const cx = HUB_LAYOUT.rouletteChest.x;
    const cy = HUB_LAYOUT.rouletteChest.y;
    const cz = HUB_LAYOUT.rouletteChest.z;
    tmpBox.min.set(cx - 1.12, cy - 0.05, cz - 0.88);
    tmpBox.max.set(cx + 1.12, cy + 1.85, cz + 0.88);
    if (ray.intersectBox(tmpBox, tmpHit)) {
      const d = ray.origin.distanceTo(tmpHit);
      if (d < bestInteractiveDist) {
        bestInteractiveDist = d;
        bestInteractive = {
          kind: 'chest',
          target: { x: cx, y: cy, z: cz },
          point: tmpHit.clone(),
        };
      }
    }

    // 2. Check 4 Hub Flowerpot Pads generous hitboxes
    for (let i = 0; i < island.padStates.length; i++) {
      const p = island.padStates[i];
      const topH = p.tier > 0 ? 1.85 : 0.68;
      tmpBox.min.set(p.x - 0.94, p.y - 0.05, p.z - 0.94);
      tmpBox.max.set(p.x + 0.94, p.y + topH, p.z + 0.94);
      if (ray.intersectBox(tmpBox, tmpHit)) {
        const d = ray.origin.distanceTo(tmpHit);
        if (d < bestInteractiveDist) {
          bestInteractiveDist = d;
          bestInteractive = {
            kind: 'pad',
            target: { padIdx: p.padIdx, idx: p.padIdx, id: p.padIdx, x: p.x, y: p.y, z: p.z, tier: p.tier },
            point: tmpHit.clone(),
          };
        }
      }
    }

    // 3. Check Instanced Breakable Blocks & 2x2x2 Mega Titan Blocks
    const blockHits = raycaster.intersectObjects(blocks.raycastTargets, false);
    for (let i = 0; i < blockHits.length; i++) {
      const hit = blockHits[i];
      if (hit.distance >= bestInteractiveDist) break;
      const b = blocks.resolveRaycastBlock(hit);
      if (b) {
        bestInteractiveDist = hit.distance;
        bestInteractive = {
          kind: 'block',
          target: b,
          point: hit.point.clone(),
        };
        break;
      }
    }

    // 4. Intersect island terrain mesh to check occlusion vs interactive hit & resolve ground taps
    const terrainHits = raycaster.intersectObject(island.terrainOpaqueMesh, false);
    const terrainHit = terrainHits.length > 0 ? terrainHits[0] : null;

    if (bestInteractive) {
      // Allow 0.45 grace margin so tapping near a block/pad/chest base selects the interactive prop
      if (!terrainHit || bestInteractiveDist <= terrainHit.distance + 0.45) {
        return bestInteractive;
      }
    }

    if (terrainHit) {
      // Fat-finger assist: if tapping ground right against the base of an unbroken block, lock onto it
      const nearBlock = blocks.getBreakableAt(terrainHit.point.x, terrainHit.point.y, terrainHit.point.z, 0.52);
      if (nearBlock) {
        return {
          kind: 'block',
          target: nearBlock,
          point: terrainHit.point.clone(),
        };
      }
      const clamped = clampToWalkable(terrainHit.point.x, terrainHit.point.z);
      return {
        kind: 'ground',
        target: clamped,
        point: new THREE.Vector3(clamped.x, clamped.y, clamped.z),
      };
    }

    // 5. Fallback for ocean, cliff edge, or sky horizon taps -> project & clamp to walkable island (0 dead taps!)
    if (ray.direction.y < -0.02 && ray.intersectPlane(fallbackPlane, tmpHit)) {
      const clamped = clampToWalkable(tmpHit.x, tmpHit.z);
      return {
        kind: 'ground',
        target: clamped,
        point: new THREE.Vector3(clamped.x, clamped.y, clamped.z),
      };
    }

    const horizLen = Math.hypot(ray.direction.x, ray.direction.z) || 1;
    const projX = ray.origin.x + (ray.direction.x / horizLen) * 32;
    const projZ = ray.origin.z + (ray.direction.z / horizLen) * 32;
    const clamped = clampToWalkable(projX, projZ);
    return {
      kind: 'ground',
      target: clamped,
      point: new THREE.Vector3(clamped.x, clamped.y, clamped.z),
    };
  }

  function reset(seed = 2026) {
    internalTime = 0;
    island.reset();
    blocks.reset(seed);
    island.update(0, 0, blocks.getRingVisibility());
  }

  return {
    group,
    textures,
    update,
    getGroundY,
    getBiomeAt,
    clampToWalkable,
    findPath,
    getBreakableAt,
    getBreakableByKey,
    getAllBreakables,
    hitBlock,
    raycastTap,
    setPadVisual,
    setTrophyVisual,
    setChestOpen,
    reset,
  };
}
