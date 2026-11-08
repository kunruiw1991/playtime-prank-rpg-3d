// 3-Tier Magic Bonsai Flowerpot Star Gem Fountain system across the 4 Hub Pads
// for Lucky Block Titans 3D (owner: lucky-loot).

import { FLOWERPOT_TIERS, HUB_LAYOUT } from '../data/catalog.js';
import { syncPlayerStats } from './combat.js';

const MAX_POT_TIER = 3;
const MAX_HUB_AMBIENT_GEMS = 4;
const HUB_PROXIMITY_RADIUS = 8.5;
const GARDEN_LINGER_RADIUS = 5.8;
const FOUNTAIN_VO_COOLDOWN_SEC = 24.0;
const MAX_SUNSHINE_CHARGES = 6;

function playSfx(ctx, primary, fallback) {
  const fn = ctx?.sfx?.[primary] || (fallback ? ctx?.sfx?.[fallback] : null);
  if (typeof fn === 'function') {
    fn.call(ctx.sfx);
  }
}

function emitSparkles(ctx, x, y, z, color = '#ffd43b', count = 12) {
  const p = ctx?.particles;
  const fn =
    p?.spawnStarSparkles ||
    p?.starSparkles ||
    p?.spawnSparkles ||
    p?.emitSparkles ||
    p?.sparkle ||
    p?.burst;
  if (typeof fn === 'function') {
    fn.call(p, x, y, z, color, count);
  }
}

export function createFlowerpotSystem(ctx) {
  let totalPlantsAndUpgrades = 0;
  let lastFountainVoAt = -30;
  let sunshineCharges = 0;
  let gardenLingerSec = 0;

  function ensurePads() {
    if (!ctx.state) {
      ctx.state = {};
    }
    if (!ctx.state.player) {
      ctx.state.player = { starGems: 0, potSeeds: 0, freeSpins: 0 };
    }
    if (!Array.isArray(ctx.state.flowerpots) || ctx.state.flowerpots.length < 4) {
      ctx.state.flowerpots = HUB_LAYOUT.flowerpotPads.map((p) => ({
        padIdx: p.padIdx,
        x: p.x,
        y: p.y,
        z: p.z,
        tier: 0,
        timer: 0,
        totalSpawned: 0,
      }));
    }
    return ctx.state.flowerpots;
  }

  function findLowestUpgradeablePad(pads) {
    let best = null;
    for (const pad of pads) {
      if ((Number(pad.tier) || 0) >= MAX_POT_TIER) continue;
      if (!best || pad.tier < best.tier || (pad.tier === best.tier && pad.padIdx < best.padIdx)) {
        best = pad;
      }
    }
    return best;
  }

  function resolveTargetPad(padIdx = null) {
    const pads = ensurePads();
    if (padIdx !== null && padIdx !== undefined) {
      const idx = Number(padIdx);
      if (Number.isInteger(idx) && idx >= 0 && idx < pads.length) {
        if ((Number(pads[idx].tier) || 0) < MAX_POT_TIER) {
          return pads[idx];
        }
        // Seamless fallback when seam.plantPot(padIdx = 0) or a child taps an already-maxed pad!
        return findLowestUpgradeablePad(pads);
      }
    }
    return findLowestUpgradeablePad(pads);
  }

  function allMaxed() {
    const pads = ensurePads();
    return pads.every((p) => (Number(p.tier) || 0) >= MAX_POT_TIER);
  }

  function getNextCost(padIdx = null) {
    const target = resolveTargetPad(padIdx);
    if (!target) return null;
    const seeds = Number(ctx?.state?.player?.potSeeds) || 0;
    if (seeds > 0) return 0;
    const nextTier = Math.min(MAX_POT_TIER, (Number(target.tier) || 0) + 1);
    return FLOWERPOT_TIERS[nextTier]?.costGems ?? 6;
  }

  function canPlantOrUpgrade(padIdx = null) {
    const target = resolveTargetPad(padIdx);
    if (!target || (Number(target.tier) || 0) >= MAX_POT_TIER) {
      return false;
    }
    const player = ctx.state.player;
    if ((Number(player.potSeeds) || 0) > 0) {
      return true;
    }
    const nextTier = (Number(target.tier) || 0) + 1;
    const cost = FLOWERPOT_TIERS[nextTier]?.costGems ?? 6;
    return (Number(player.starGems) || 0) >= cost;
  }

  function spawnCelebrationGems(pad, count = 2, gemsEach = 1) {
    const player = ctx.state.player;
    if (typeof ctx?.pickups?.spawn === 'function') {
      for (let i = 0; i < count; i += 1) {
        ctx.pickups.spawn(
          {
            id: 'star_gem_small',
            gems: gemsEach,
            label: `+${gemsEach} STAR!`,
            color: '#ffd43b',
            voId: null,
          },
          pad.x,
          pad.y + 0.85,
          pad.z,
          {
            index: i,
            total: count,
            horizSpeed: 1.9,
            vy: 4.8,
            magnetDelay: 0.14,
            silentVo: true,
            source: 'pot_celebration',
          }
        );
      }
    } else {
      player.starGems = (Number(player.starGems) || 0) + count * gemsEach;
    }
  }

  function plantOrUpgrade(padIdx = null) {
    ensurePads();
    const target = resolveTargetPad(padIdx);
    if (!target || (Number(target.tier) || 0) >= MAX_POT_TIER) {
      const player = ctx?.state?.player;
      if (player && (Number(player.potSeeds) || 0) > 0) {
        player.potSeeds = Math.max(0, Number(player.potSeeds) - 1);
        player.starGems = (Number(player.starGems) || 0) + 6;
        const pad0 = ensurePads()[0];
        if (pad0) {
          emitSparkles(ctx, pad0.x, pad0.y + 1.0, pad0.z, '#ffd43b', 12);
        }
        playSfx(ctx, 'potFountain', 'starPickup');
        syncPlayerStats(ctx);
        return {
          ok: true,
          padIdx: 0,
          tier: MAX_POT_TIER,
          usedSeed: true,
          spentGems: 0,
        };
      }
      return { ok: false, reason: 'all_maxed' };
    }

    const player = ctx.state.player;
    const nextTier = (Number(target.tier) || 0) + 1;
    const tierSpec = FLOWERPOT_TIERS[nextTier];
    const costGems = tierSpec.costGems;

    let usedSeed = false;
    let spentGems = 0;

    if ((Number(player.potSeeds) || 0) > 0) {
      player.potSeeds = Math.max(0, Number(player.potSeeds) - 1);
      usedSeed = true;
    } else if ((Number(player.starGems) || 0) >= costGems) {
      player.starGems = Math.max(0, Number(player.starGems) - costGems);
      spentGems = costGems;
    } else {
      ctx?.voice?.speak?.('fairy_need_stars', { priority: 'ifIdle' });
      return {
        ok: false,
        reason: 'not_enough_stars',
        padIdx: target.padIdx,
        needed: costGems,
      };
    }

    target.tier = nextTier;
    target.timer = 0;
    const activeAfter = ensurePads().filter((p) => (Number(p.tier) || 0) > 0).length;
    target.freshBlooms = activeAfter <= 1 ? 1 : 0;
    totalPlantsAndUpgrades += 1;

    syncPlayerStats(ctx);

    ctx?.world?.setPadVisual?.(
      target.padIdx,
      nextTier,
      ctx?.buildFlowerpotMesh || ctx?.props3d?.buildFlowerpotMesh
    );

    playSfx(ctx, 'potPlant', 'luckyPop');
    emitSparkles(ctx, target.x, target.y + 0.95, target.z, tierSpec.color || '#51cf66', 16);

    // Pop 1 immediate celebratory Star Gem right out of the very first planted bonsai pot!
    if (totalPlantsAndUpgrades === 1) {
      spawnCelebrationGems(target, 1, 1);
    }

    if (allMaxed()) {
      ctx?.voice?.speak?.('fairy_pot_max', { priority: 'interrupt' });
    } else if (tierSpec.voId) {
      ctx?.voice?.speak?.(tierSpec.voId, { priority: 'interrupt' });
    }

    // Gentle onboarding bridge: after planting the very first pot, nudge the Golden Chest if free spin is ready!
    if (
      totalPlantsAndUpgrades === 1 &&
      (Number(ctx?.state?.roulette?.spinsCount) || 0) === 0 &&
      ((Number(player.freeSpins) || 0) > 0 || (Number(player.starGems) || 0) >= 8)
    ) {
      ctx?.voice?.speak?.('guide_try_chest', { priority: 'queue' });
    }

    ctx?.onPotChanged?.(target);

    return {
      ok: true,
      padIdx: target.padIdx,
      tier: nextTier,
      usedSeed,
      spentGems,
    };
  }

  function emitPotFountain(pad, tierSpec, heroNearHub, nowSec, activePadCount, isTendingGarden = false) {
    let gemYield = 1;
    if ((Number(pad.freshBlooms) || 0) > 0) {
      pad.freshBlooms = Math.max(0, Number(pad.freshBlooms) - 1);
      gemYield = tierSpec.gemYield;
    } else if (activePadCount <= 1) {
      const soloTending = isTendingGarden && (Number(ctx?.state?.blocksBroken) || 0) <= 1;
      gemYield = soloTending ? 3 : pad.tier === 1 ? tierSpec.gemYield : Math.min(tierSpec.gemYield, 3);
    } else if (isTendingGarden) {
      gemYield = Math.min(tierSpec.gemYield, 4);
    } else {
      gemYield = 1;
    }

    const player = ctx.state.player;
    pad.totalSpawned = (Number(pad.totalSpawned) || 0) + gemYield;

    if (typeof ctx?.pickups?.spawn !== 'function') {
      player.starGems = (Number(player.starGems) || 0) + gemYield;
      return;
    }

    if (heroNearHub) {
      const firstVal = Math.ceil(gemYield / 2);
      const secondVal = gemYield - firstVal;
      const vals = secondVal > 0 ? [firstVal, secondVal] : [firstVal];

      for (let i = 0; i < vals.length; i += 1) {
        if ((ctx.pickups.countBySource?.('pot_ambient') || 0) >= MAX_HUB_AMBIENT_GEMS) {
          ctx.pickups.collectOldestBySource?.('pot_ambient');
        }
        ctx.pickups.spawn(
          {
            id: vals[i] >= 4 ? 'star_gem_cluster' : 'star_gem_small',
            gems: vals[i],
            label: `+${vals[i]} STARS!`,
            color: tierSpec.color || '#ffd43b',
            voId: null,
          },
          pad.x,
          pad.y + 0.9,
          pad.z,
          {
            index: i,
            total: vals.length,
            horizSpeed: 1.55,
            vy: 4.7,
            magnetDelay: 0.2,
            silentVo: true,
            source: 'pot_ambient',
          }
        );
      }

      playSfx(ctx, 'potFountain', 'starPickup');
      emitSparkles(ctx, pad.x, pad.y + 1.0, pad.z, tierSpec.color || '#ffd43b', 8);

      if (nowSec - lastFountainVoAt >= FOUNTAIN_VO_COOLDOWN_SEC) {
        lastFountainVoAt = nowSec;
        ctx?.voice?.speak?.('fairy_pot_fountain', { priority: 'ifIdle' });
      }
    } else {
      // Hero is exploring a biome: spawn up to MAX_HUB_AMBIENT_GEMS waiting visual gems around Hub pads
      // so returning to Hub feels rewarding without flooding passive off-screen gems!
      const ambientCount = ctx.pickups.countBySource?.('pot_ambient') || 0;
      if (ambientCount < MAX_HUB_AMBIENT_GEMS) {
        ctx.pickups.spawn(
          {
            id: 'star_gem_small',
            gems: 1,
            label: '+1 STAR!',
            color: tierSpec.color || '#ffd43b',
            voId: null,
          },
          pad.x,
          pad.y + 0.85,
          pad.z,
          {
            horizSpeed: 1.35,
            vy: 4.3,
            magnetDelay: 0.2,
            silentVo: true,
            source: 'pot_ambient',
          }
        );
      }
    }
  }

  function update(dt, time = 0) {
    const pads = ensurePads();
    const step = Math.max(0, Number(dt) || 0);
    if (step === 0) return;

    const player = ctx.state.player;
    const heroDistToHub = Math.hypot(Number(player?.x) || 0, Number(player?.z) || 0);
    const heroNearHub = heroDistToHub <= HUB_PROXIMITY_RADIUS;
    if (heroNearHub && (ctx?.pickups?.countBySource?.('pot_ambient') || 0) > 0) {
      while ((ctx?.pickups?.countBySource?.('pot_ambient') || 0) > 0) {
        if (!ctx.pickups.collectOldestBySource?.('pot_ambient')) break;
      }
    }
    const inGardenTendingZone = heroDistToHub <= GARDEN_LINGER_RADIUS;
    if (inGardenTendingZone) {
      gardenLingerSec = Math.min(6.0, gardenLingerSec + step);
    } else {
      gardenLingerSec = Math.max(0, gardenLingerSec - step * 2.5);
    }
    const isTendingGarden = gardenLingerSec >= 1.8;
    const nowSec = Number(ctx?.state?.time) || time || 0;
    const activePadCount = pads.filter((p) => (Number(p.tier) || 0) > 0).length;
    const pace =
      activePadCount <= 1
        ? 1.0
        : isTendingGarden
          ? 1.0
          : heroNearHub
            ? 1.0 / (1.0 + 1.15 * (activePadCount - 1))
            : 0.16;

    for (const pad of pads) {
      const tier = Number(pad.tier) || 0;
      if (tier <= 0) continue;
      const tierSpec = FLOWERPOT_TIERS[tier];
      if (!tierSpec || tierSpec.intervalSec <= 0) continue;

      pad.timer = (Number(pad.timer) || 0) + step * pace;
      while (pad.timer >= tierSpec.intervalSec) {
        pad.timer -= tierSpec.intervalSec;
        emitPotFountain(pad, tierSpec, heroNearHub, nowSec, activePadCount, isTendingGarden);
      }
    }
  }

  function onBlockBroken() {
    sunshineCharges = Math.min(MAX_SUNSHINE_CHARGES, sunshineCharges + 1);
  }

  function getSnapshot() {
    return ensurePads().map((p) => ({
      padIdx: p.padIdx,
      x: p.x,
      y: p.y,
      z: p.z,
      tier: p.tier,
      timer: Number((Number(p.timer) || 0).toFixed(3)),
      totalSpawned: Number(p.totalSpawned) || 0,
    }));
  }

  function reset() {
    totalPlantsAndUpgrades = 0;
    lastFountainVoAt = -30;
    sunshineCharges = 0;
    gardenLingerSec = 0;
    const pads = ensurePads();
    for (let i = 0; i < pads.length; i += 1) {
      pads[i].tier = 0;
      pads[i].timer = 0;
      pads[i].freshBlooms = 0;
      pads[i].totalSpawned = 0;
      ctx?.world?.setPadVisual?.(
        pads[i].padIdx,
        0,
        ctx?.buildFlowerpotMesh || ctx?.props3d?.buildFlowerpotMesh
      );
    }
  }

  return {
    canPlantOrUpgrade,
    getNextCost,
    getNextUpgradePadIdx: () => resolveTargetPad(null)?.padIdx ?? null,
    allMaxed,
    plantOrUpgrade,
    onBlockBroken,
    update,
    getSnapshot,
    reset,
  };
}
