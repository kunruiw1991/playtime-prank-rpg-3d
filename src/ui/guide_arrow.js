// 3D Bouncing Golden Guide Arrow + Pulsing Ground Beacon Ring (owner: lucky-ui).
// Points clearly above the single best next goal for a non-reading 5-year-old player!
// Strict Three.js r170 guardrails: metalness = 0 (<= 0.22), toneMapped = false, fog = false.

import * as THREE from '../../vendor/three.module.min.js';
import {
  BIOMES,
  FLOWERPOT_TIERS,
  HUB_LAYOUT,
  ROULETTE_COSTS,
  TITANS,
  TITAN_ORDER,
  resolveBossId,
} from '../data/catalog.js';

const GOAL_PALETTE = Object.freeze({
  starter: { main: 0xffd43b, ring: 0xffe066 },
  pad: { main: 0x51cf66, ring: 0x8ce99a },
  chest: { main: 0xffc038, ring: 0xffe066 },
  titan: { main: 0x39d5ff, ring: 0x99e9f2 },
  block: { main: 0xffd43b, ring: 0xfff3bf },
});

function hasTrophy(state, titanId) {
  const canonicalId = resolveBossId(titanId);
  const tr = state?.trophies;
  if (Array.isArray(tr)) {
    return tr.some((id) => resolveBossId(id) === canonicalId);
  }
  if (tr && typeof tr === 'object') {
    return Boolean(tr[canonicalId] || tr[titanId]);
  }
  return false;
}

function getSpinCost(state, ctx) {
  if (typeof ctx.roulette?.getSpinCost === 'function') {
    return Math.max(0, Number(ctx.roulette.getSpinCost()) || 0);
  }
  if ((Number(state?.player?.freeSpins) || 0) > 0) return 0;
  if (state?.roulette?.spinCost !== undefined) {
    return Math.max(0, Number(state.roulette.spinCost) || 0);
  }
  const idx = Math.min(
    Number(state?.roulette?.spinsCount) || 0,
    ROULETTE_COSTS.length - 1
  );
  return ROULETTE_COSTS[idx];
}

function findNextSeedPad(state) {
  const pads = Array.isArray(state?.flowerpots)
    ? state.flowerpots
    : Array.isArray(state?.flowerpots?.pads)
      ? state.flowerpots.pads
      : [];
  let best = null;
  let bestTier = 99;
  for (let i = 0; i < HUB_LAYOUT.flowerpotPads.length; i += 1) {
    const layoutPad = HUB_LAYOUT.flowerpotPads[i];
    const padState = pads[i];
    const tier =
      typeof padState === 'number'
        ? padState
        : Number(padState?.tier ?? 0);
    if (tier < 3 && tier < bestTier) {
      bestTier = tier;
      best = {
        padIdx: i,
        x: layoutPad.x,
        y: layoutPad.y,
        z: layoutPad.z,
        tier,
      };
    }
  }
  return best;
}

function findActiveTitan(state, ctx) {
  const m = ctx.titans?.getActive?.();
  if (m && !m.defeated && (m.hp === undefined || m.hp > 0)) return m;
  const s = state?.activeTitan || state?.titans?.active;
  if (s && !s.defeated && (s.hp === undefined || s.hp > 0)) return s;
  const list = Array.isArray(state?.titans) ? state.titans : null;
  if (list) {
    for (const item of list) {
      if (item && item.active !== false && !item.defeated && (item.hp ?? 1) > 0) {
        return item;
      }
    }
  }
  return null;
}

function findNearestBreakable(state, ctx) {
  const all = ctx.world?.getAllBreakables?.();
  const px = Number(state?.player?.x) || 0;
  const pz = Number(state?.player?.z) || 0;

  if (Array.isArray(all) && all.length > 0) {
    let bestLucky = null;
    let bestLuckyDist = Infinity;
    let bestAny = null;
    let bestAnyDist = Infinity;

    for (const b of all) {
      if (!b || b.broken || b.isMegaTitan) continue;
      const d = Math.hypot((b.x || 0) - px, (b.z || 0) - pz);
      if (b.isLucky && d < bestLuckyDist) {
        bestLuckyDist = d;
        bestLucky = b;
      }
      if (d < bestAnyDist) {
        bestAnyDist = d;
        bestAny = b;
      }
    }
    const chosen = bestLucky || bestAny;
    if (chosen) {
      return {
        x: chosen.x,
        y: chosen.y ?? 1,
        z: chosen.z,
      };
    }
  }

  return {
    x: HUB_LAYOUT.starterBlock.x,
    y: HUB_LAYOUT.starterBlock.y,
    z: HUB_LAYOUT.starterBlock.z,
  };
}

export function selectKidGuideGoal(state, ctx = {}) {
  if (!state || !state.player) {
    return {
      kind: 'starter',
      x: HUB_LAYOUT.starterBlock.x,
      y: HUB_LAYOUT.starterBlock.y + 2.4,
      groundY: HUB_LAYOUT.starterBlock.y,
      z: HUB_LAYOUT.starterBlock.z,
    };
  }

  const p = state.player;
  const blocksBroken = Number(state.blocksBroken) || 0;

  // 1) Starter Lucky Block right in front of spawn if blocksBroken === 0.
  if (blocksBroken === 0) {
    return {
      kind: 'starter',
      x: HUB_LAYOUT.starterBlock.x,
      y: HUB_LAYOUT.starterBlock.y + 2.5,
      groundY: HUB_LAYOUT.starterBlock.y,
      z: HUB_LAYOUT.starterBlock.z,
    };
  }

  // 2) Next Hub Flowerpot Pad if hero holds a Magic Flowerpot Seed.
  const potSeeds = Number(p.potSeeds) || 0;
  if (potSeeds > 0) {
    const nextPad = findNextSeedPad(state);
    if (nextPad) {
      return {
        kind: 'pad',
        padIdx: nextPad.padIdx,
        x: nextPad.x,
        y: nextPad.y + 2.4,
        groundY: nextPad.y,
        z: nextPad.z,
      };
    }
  }

  // 3) Hub Roulette Chest if freeSpins > 0 or (starGems >= spinCost and weaponTier < 4).
  const freeSpins = Number(p.freeSpins) || 0;
  const starGems = Number(p.starGems) || 0;
  const weaponTier = Number(p.weaponTier) || 1;
  const spinCost = getSpinCost(state, ctx);
  if (freeSpins > 0 || (starGems >= spinCost && weaponTier < 4)) {
    return {
      kind: 'chest',
      x: HUB_LAYOUT.rouletteChest.x,
      y: HUB_LAYOUT.rouletteChest.y + 2.9,
      groundY: HUB_LAYOUT.rouletteChest.y,
      z: HUB_LAYOUT.rouletteChest.z,
    };
  }

  // 4) Active Titan (if powerTier >= requiredTier) OR next awake Mega Titan Block <= powerTier.
  const powerTier = Number(p.powerTier) || weaponTier;
  const maxPotTier = Array.isArray(state.flowerpots)
    ? state.flowerpots.reduce((m, fp) => Math.max(m, Number(fp?.tier) || 0), 0)
    : 0;
  const activeTitan = findActiveTitan(state, ctx);
  if (activeTitan) {
    const tId = resolveBossId(activeTitan.id || activeTitan.titanId || 'tralalero_tralala');
    const spec = TITANS[tId] || TITANS.tralalero_tralala;
    const req = Number(activeTitan.requiredTier ?? spec.requiredTier) || 1;
    if (powerTier >= req) {
      const tx = Number(activeTitan.x ?? spec.spawnPos.x) || 0;
      const ty = Number(activeTitan.y ?? spec.spawnPos.y) || 1;
      const tz = Number(activeTitan.z ?? spec.spawnPos.z) || 0;
      return {
        kind: 'titan',
        titanId: tId,
        x: tx,
        y: ty + 8.6,
        groundY: ty,
        z: tz,
      };
    }
  } else {
    for (const titanId of TITAN_ORDER) {
      if (hasTrophy(state, titanId)) continue;
      const spec = TITANS[titanId];
      if (!spec || powerTier < spec.requiredTier) continue;
      const reqPotTier = Math.max(0, spec.requiredTier - 1);
      if (maxPotTier < reqPotTier) {
        const nextPad = findNextSeedPad(state);
        const nextSpec = FLOWERPOT_TIERS[Math.min(3, (nextPad?.tier ?? 0) + 1)] || FLOWERPOT_TIERS[1];
        if (nextPad && starGems >= (Number(nextSpec?.costGems) || 6)) {
          return {
            kind: 'pad',
            padIdx: nextPad.padIdx,
            x: nextPad.x,
            y: nextPad.y + 2.4,
            groundY: nextPad.y,
            z: nextPad.z,
          };
        }
        break;
      }
      const biomeSpec = BIOMES[spec.biome];
      const pos = biomeSpec?.megaTitanPos || spec.spawnPos;
      return {
        kind: 'titan',
        titanId,
        x: pos.x,
        y: pos.y + 4.2,
        groundY: pos.y,
        z: pos.z,
      };
    }
  }

  // 5) Hub Flowerpot Pad if child has enough Star Gems to plant/upgrade!
  const nextPad = findNextSeedPad(state);
  if (nextPad) {
    const nextSpec = FLOWERPOT_TIERS[Math.min(3, nextPad.tier + 1)] || FLOWERPOT_TIERS[1];
    if (starGems >= (Number(nextSpec?.costGems) || 6)) {
      return {
        kind: 'pad',
        padIdx: nextPad.padIdx,
        x: nextPad.x,
        y: nextPad.y + 2.4,
        groundY: nextPad.y,
        z: nextPad.z,
      };
    }
  }

  // 5) Nearest juicy unbroken Lucky Block!
  const nearBlock = findNearestBreakable(state, ctx);
  return {
    kind: 'block',
    x: nearBlock.x,
    y: nearBlock.y + 2.4,
    groundY: nearBlock.y,
    z: nearBlock.z,
  };
}

export function createGuideArrow(ctx = {}) {
  const group = new THREE.Group();
  group.name = 'KidGuideArrow';

  const arrowPivot = new THREE.Group();
  group.add(arrowPivot);

  // Unlit bright material (metalness = 0, toneMapped = false, fog = false) -> crisp sunlit gold!
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xffd43b,
    toneMapped: false,
    fog: false,
  });

  const rimMat = new THREE.MeshBasicMaterial({
    color: 0xfff9db,
    toneMapped: false,
    fog: false,
  });

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });

  // Chunky voxel-style downward chevron arrow: shaft + inverted 4-sided pyramid tip + bright core highlight.
  const shaftGeo = new THREE.BoxGeometry(0.42, 0.72, 0.42);
  const shaftMesh = new THREE.Mesh(shaftGeo, arrowMat);
  shaftMesh.position.set(0, 0.62, 0);
  arrowPivot.add(shaftMesh);

  const headGeo = new THREE.ConeGeometry(0.68, 0.78, 4);
  const headMesh = new THREE.Mesh(headGeo, arrowMat);
  headMesh.rotation.x = Math.PI;
  headMesh.rotation.y = Math.PI * 0.25;
  headMesh.position.set(0, 0.0, 0);
  arrowPivot.add(headMesh);

  const starCoreGeo = new THREE.BoxGeometry(0.5, 0.16, 0.5);
  const starCoreMesh = new THREE.Mesh(starCoreGeo, rimMat);
  starCoreMesh.position.set(0, 0.98, 0);
  arrowPivot.add(starCoreMesh);

  // Glowing ground ring sitting just above walkable ground under the target.
  const ringGeo = new THREE.RingGeometry(0.75, 1.12, 24);
  ringGeo.rotateX(-Math.PI * 0.5);
  const groundRing = new THREE.Mesh(ringGeo, ringMat);
  groundRing.position.set(0, 0.08, 0);
  group.add(groundRing);

  // Place initially at Starter Lucky Block so boot shader pre-compile warms these materials too!
  let curX = HUB_LAYOUT.starterBlock.x;
  let curY = HUB_LAYOUT.starterBlock.y + 2.5;
  let curGroundY = HUB_LAYOUT.starterBlock.y;
  let curZ = HUB_LAYOUT.starterBlock.z;
  let initialized = false;
  let currentGoal = {
    kind: 'starter',
    x: curX,
    y: curY,
    groundY: curGroundY,
    z: curZ,
  };

  group.position.set(curX, 0, curZ);
  arrowPivot.position.set(0, curY, 0);
  groundRing.position.set(0, curGroundY + 0.08, 0);

  if (ctx.scene && typeof ctx.scene.add === 'function') {
    ctx.scene.add(group);
  }

  function update(dt = 1 / 60, time = 0, state = ctx.state) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 1 / 60));
    const goal = selectKidGuideGoal(state, ctx);
    currentGoal = goal;

    const palette = GOAL_PALETTE[goal.kind] || GOAL_PALETTE.starter;
    arrowMat.color.setHex(palette.main);
    ringMat.color.setHex(palette.ring);

    const jumpDist = Math.hypot(goal.x - curX, goal.z - curZ);
    if (!initialized || jumpDist > 36) {
      curX = goal.x;
      curY = goal.y;
      curGroundY = goal.groundY;
      curZ = goal.z;
      initialized = true;
    } else {
      const alpha = 1 - Math.exp(-10 * safeDt);
      curX += (goal.x - curX) * alpha;
      curY += (goal.y - curY) * alpha;
      curGroundY += (goal.groundY - curGroundY) * alpha;
      curZ += (goal.z - curZ) * alpha;
    }

    const bob = Math.sin(time * 5.2) * 0.34;
    const pulse = 1 + Math.sin(time * 6.0) * 0.12;

    group.position.set(curX, 0, curZ);
    arrowPivot.position.set(0, curY + bob, 0);
    arrowPivot.rotation.y = time * 2.2;

    const groundSurface =
      typeof ctx.world?.getGroundY === 'function'
        ? ctx.world.getGroundY(curX, curZ)
        : null;
    const ringY =
      Number.isFinite(groundSurface) && groundSurface > -50
        ? Math.max(curGroundY, groundSurface)
        : curGroundY;
    groundRing.position.set(0, ringY + 0.08, 0);
    groundRing.scale.set(pulse, 1, pulse);
    ringMat.opacity = 0.58 + Math.sin(time * 6.0) * 0.2;
  }

  function getCurrentGoal() {
    return currentGoal;
  }

  function setVisible(v) {
    group.visible = Boolean(v);
  }

  function destroy() {
    group.parent?.remove(group);
    shaftGeo.dispose();
    headGeo.dispose();
    starCoreGeo.dispose();
    ringGeo.dispose();
    arrowMat.dispose();
    rimMat.dispose();
    ringMat.dispose();
  }

  return {
    group,
    update,
    getCurrentGoal,
    setVisible,
    destroy,
  };
}
