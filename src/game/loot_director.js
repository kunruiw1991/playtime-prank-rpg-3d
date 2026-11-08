// Deterministic Seeded Sahur Mystery Drum Director with Starter Guarantee, Smart Pity,
// Gear Milestones, Mega Boss Drums, and Chaos Mode for Tung Tung Tung Sahur 3D: Brainrot Rhythm Island!

import {
  BIOMES,
  LOOT_TABLE,
  TITAN_ORDER,
  TITANS,
  WEAPONS,
  resolveBossId,
  resolveWeaponId,
} from '../data/catalog.js';

const RAW_LOOT_MAP = Object.fromEntries(LOOT_TABLE.map((entry) => [entry.id, entry]));
const LOOT_BY_ID = Object.freeze({
  ...RAW_LOOT_MAP,
  star_gem_small: RAW_LOOT_MAP.drum_star_small || RAW_LOOT_MAP.star_gem_small,
  star_gem_cluster: RAW_LOOT_MAP.star_shower_jackpot || RAW_LOOT_MAP.star_gem_cluster,
  pot_seed: RAW_LOOT_MAP.totem_seed || RAW_LOOT_MAP.pot_seed,
  free_spin_chest: RAW_LOOT_MAP.free_spin_token || RAW_LOOT_MAP.free_spin_chest,
  surprise_titan: RAW_LOOT_MAP.surprise_boss || RAW_LOOT_MAP.surprise_titan,
});

const ROLLABLE_LOOT = Object.freeze(
  LOOT_TABLE.filter((entry) => entry.id !== 'surprise_titan' && entry.id !== 'surprise_boss' && !entry.isSurpriseBoss)
);

const POT_SEED_PITY_BLOCKS = 18;
const FREE_SPIN_PITY_BLOCKS = 45;
const BOOTS_GUARANTEE_BLOCK = 10;
const HELMET_GUARANTEE_BLOCK = 16; // P1-3: guaranteed before Thunder Chief Titan
const CAPE_GUARANTEE_BLOCK = 24;

function playSfx(ctx, primary, fallback) {
  const fn = ctx?.sfx?.[primary] || (fallback ? ctx?.sfx?.[fallback] : null);
  if (typeof fn === 'function') {
    fn.call(ctx.sfx);
  }
}

function inferBiomeFromPosition(x, z) {
  for (const key of ['meadow', 'snow', 'farm', 'castle']) {
    const b = BIOMES[key]?.bounds;
    if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return key;
    }
  }
  if (Math.hypot(x, z) <= 12) return 'hub';
  if (x < 0 && z >= 0) return 'meadow';
  if (x < 0 && z < 0) return 'snow';
  if (x >= 0 && z >= 0) return 'farm';
  return 'castle';
}

function resolveBlockBiomeTitan(block, ctx) {
  if (block?.titanId) {
    const resolved = resolveBossId(block.titanId);
    if (TITANS[resolved]) return resolved;
  }
  const bx = Number(block?.x) || 0;
  const bz = Number(block?.z) || 0;
  const biomeId =
    block?.biome ||
    ctx?.world?.getBiomeAt?.(bx, bz) ||
    inferBiomeFromPosition(bx, bz);
  const titanId = BIOMES[biomeId]?.titanId || null;
  const resolved = titanId ? resolveBossId(titanId) : null;
  return resolved && TITANS[resolved] ? resolved : null;
}

export function createLootDirector(ctx) {
  let localBrokenCount = 0;
  let starterDelivered = false;
  let surprisePityDelivered = false;
  let blocksSincePotSeed = 0;
  let blocksSinceSpinChest = 0;
  const gearPityTriggered = {
    speedBoots: false,
    helmet: false,
    starCape: false,
  };

  function recordDropSeen(id) {
    if (!id) return;
    const fb = ctx?.state?.feedback;
    if (!fb) return;
    if (!Array.isArray(fb.dropTypesSeen)) {
      fb.dropTypesSeen = [];
    }
    if (!fb.dropTypesSeen.includes(id)) {
      fb.dropTypesSeen.push(id);
    }
  }

  function pickOverTierSurpriseTitan(powerTier, trophies) {
    const pTier = Math.max(1, Number(powerTier) || 1);
    const won = Array.isArray(trophies) ? trophies : [];
    for (const tid of TITAN_ORDER) {
      if (won.includes(tid)) continue;
      const spec = TITANS[tid];
      if (spec && spec.requiredTier > pTier) {
        return tid;
      }
    }
    return null;
  }

  function hasGearOwnedOrActive(gearKey) {
    if (ctx?.state?.player?.[gearKey]) return true;
    if (ctx?.pickups?.hasActiveGear?.(gearKey)) return true;
    return false;
  }

  function anyFlowerpotBelowMax() {
    if (typeof ctx?.flowerpots?.allMaxed === 'function') {
      return !ctx.flowerpots.allMaxed();
    }
    const pads = ctx?.state?.flowerpots;
    if (!Array.isArray(pads) || pads.length === 0) return true;
    return pads.some((p) => (Number(p.tier) || 0) < 3);
  }

  function isAnyTitanActive() {
    if (ctx?.titans?.getActive?.()) return true;
    if (ctx?.combat?.getActiveTitan?.()) return true;
    return false;
  }

  function spawnDropEntry(spec, bx, by, bz, opts = {}) {
    recordDropSeen(spec.id);
    if (spec.critter) {
      const offsetX = ctx?.rng ? ctx.rng.range(-0.65, 0.65) : 0.4;
      const offsetZ = ctx?.rng ? ctx.rng.range(-0.65, 0.65) : -0.4;
      ctx?.critters?.spawn?.(spec.critter, bx + offsetX, by, bz + offsetZ);
      playSfx(ctx, 'critterHappy', 'luckyPop');
      if (spec.voId) {
        ctx?.voice?.speak?.(spec.voId, { priority: 'ifIdle' });
      }
      return ctx?.pickups?.spawn?.(
        {
          id: 'star_gem_small',
          gems: Math.max(1, Number(spec.gems) || 2),
          label: spec.label || '+2 STARS!',
          color: spec.color || '#ffd43b',
          voId: null,
        },
        bx,
        by,
        bz,
        { ...opts, silentVo: true }
      );
    }

    return ctx?.pickups?.spawn?.(spec, bx, by, bz, opts);
  }

  function onBlockBroken(block = {}) {
    const state = ctx?.state;
    const player = state?.player;
    const bx = Number(block?.x) || 0;
    const by = Number(block?.y) || 1;
    const bz = Number(block?.z) || 0;

    // Works identically whether main.js increments state.blocksBroken before or after onBlockBroken!
    const stateBroken = Number(state?.blocksBroken) || 0;
    const brokenCount =
      stateBroken >= localBrokenCount + 1 ? stateBroken : localBrokenCount + 1;
    localBrokenCount = brokenCount;
    if (state && stateBroken < brokenCount) {
      state.blocksBroken = brokenCount;
    }
    if (state && block?.isLucky) {
      state.luckyBlocksCount = (Number(state.luckyBlocksCount) || 0) + 1;
    }
    ctx?.flowerpots?.onBlockBroken?.();

    // --- 1. Starter Lucky Block Guarantee ---
    if (block?.isStarter || (!starterDelivered && brokenCount === 1)) {
      starterDelivered = true;
      blocksSincePotSeed = 0;
      blocksSinceSpinChest = 0;

      const starterDrops = [
        LOOT_BY_ID.star_gem_cluster,
        LOOT_BY_ID.pot_seed,
        LOOT_BY_ID.free_spin_chest,
      ];

      starterDrops.forEach((spec, index) => {
        spawnDropEntry(spec, bx, by, bz, {
          index,
          total: starterDrops.length,
          isStarterDrop: true,
          magnetDelay: 0.14,
        });
      });

      playSfx(ctx, 'luckyPop', 'blockBreak');
      ctx?.voice?.speak?.('guide_starter_pop', { priority: 'interrupt' });

      return {
        drops: starterDrops,
        spawnedTitanId: null,
        isStarter: true,
        brokenCount,
      };
    }

    // --- 2. Trembling Mega Titan Mystery Block ---
    if (block?.isMegaTitan) {
      const titanId = resolveBlockBiomeTitan(block, ctx) || 'tralalero_tralala';
      ctx?.combat?.spawnBiomeTitan?.(titanId, { x: bx, y: by, z: bz });

      const gemSpec = LOOT_BY_ID.star_gem_small;
      spawnDropEntry(gemSpec, bx, by, bz, {
        index: 0,
        total: 1,
        silentVo: true,
      });

      return {
        drops: [gemSpec],
        spawnedTitanId: titanId,
        isMegaTitan: true,
        brokenCount,
      };
    }

    // --- 3. Ordinary & Lucky Blocks (with Smart Pity + Gear Milestones + Chaos Mode) ---
    const wpn =
      WEAPONS[resolveWeaponId(player?.weaponId || 'wooden_kentungan_bat')] ||
      WEAPONS.wooden_kentungan_bat;
    if (player && wpn.bonusGems > 0) {
      player.starGems = (Number(player.starGems) || 0) + wpn.bonusGems;
    }

    const chaosMode = Boolean(state?.chaosMode);
    blocksSincePotSeed += 1;
    blocksSinceSpinChest += 1;

    const forcedDrops = [];
    const needPots = anyFlowerpotBelowMax();
    const weaponTier = wpn.tier;

    if (needPots && blocksSincePotSeed >= POT_SEED_PITY_BLOCKS) {
      forcedDrops.push(LOOT_BY_ID.pot_seed);
    }

    const spinsDone = Number(state?.roulette?.spinsCount) || 0;
    const freeSpinsHeld = Number(player?.freeSpins) || 0;
    const hasFreeSpinActive =
      Array.isArray(state?.activeDrops) &&
      state.activeDrops.some((d) => d && (d.id === 'free_spin_chest' || d.id === 'free_spin_token'));
    if (
      !starterDelivered &&
      spinsDone === 0 &&
      freeSpinsHeld === 0 &&
      !hasFreeSpinActive &&
      weaponTier < 2 &&
      blocksSinceSpinChest >= FREE_SPIN_PITY_BLOCKS
    ) {
      forcedDrops.push(LOOT_BY_ID.free_spin_chest);
    }

    if (
      brokenCount >= BOOTS_GUARANTEE_BLOCK &&
      !gearPityTriggered.speedBoots &&
      !hasGearOwnedOrActive('speedBoots')
    ) {
      gearPityTriggered.speedBoots = true;
      forcedDrops.push(LOOT_BY_ID.speed_boots);
    }

    if (
      brokenCount >= HELMET_GUARANTEE_BLOCK &&
      !gearPityTriggered.helmet &&
      !hasGearOwnedOrActive('helmet')
    ) {
      gearPityTriggered.helmet = true;
      forcedDrops.push(LOOT_BY_ID.gold_helmet);
    }

    if (
      brokenCount >= CAPE_GUARANTEE_BLOCK &&
      !gearPityTriggered.starCape &&
      !hasGearOwnedOrActive('starCape')
    ) {
      gearPityTriggered.starCape = true;
      forcedDrops.push(LOOT_BY_ID.star_cape);
    }

    // Signature Bilibili Twist: Digging up an over-tier SURPRISE TITAN!
    let spawnedTitanId = null;
    const trophies = Array.isArray(state?.trophies) ? state.trophies : [];
    const powerTier = Number(player?.powerTier) || wpn.tier || 1;
    const overTierTitanId = pickOverTierSurpriseTitan(powerTier, trophies);
    if (
      !block?.fromSeam &&
      brokenCount >= 5 &&
      overTierTitanId &&
      !isAnyTitanActive()
    ) {
      const surpriseChance = chaosMode ? 0.35 : 0.28;
      const roll = ctx?.rng ? ctx.rng.next() : 0.99;
      const shouldPitySurprise =
        !surprisePityDelivered &&
        (Number(state?.feedback?.boings) || 0) === 0 &&
        brokenCount >= 6;
      if ((block?.isLucky && roll < surpriseChance) || shouldPitySurprise) {
        surprisePityDelivered = true;
        spawnedTitanId = overTierTitanId;
        recordDropSeen('surprise_titan');
        playSfx(ctx, 'titanTremor', 'luckyPop');
        ctx?.voice?.speak?.('vo_titan_alert', { priority: 'interrupt' });
        ctx?.combat?.spawnBiomeTitan?.(
          overTierTitanId,
          { x: bx, y: by, z: bz },
          { surprise: true }
        );
      }
    }

    const rolledCount = chaosMode
      ? ctx?.rng
        ? ctx.rng.int(2, 4)
        : 3
      : block?.isLucky
        ? 2
        : 1;

    const targetCount = Math.max(rolledCount, forcedDrops.length);
    const chosenDrops = forcedDrops.slice();
    const chosenGearInBurst = new Set(
      chosenDrops.filter((d) => d.gear).map((d) => d.gear)
    );

    while (chosenDrops.length < targetCount) {
      const pick = ctx?.rng
        ? ctx.rng.weightedPick(ROLLABLE_LOOT, (entry) => {
            let w = entry.weight;
            if (entry.gear && chosenGearInBurst.has(entry.gear)) return 0;
            if (entry.gear && hasGearOwnedOrActive(entry.gear)) {
              w *= 0.25;
            }
            if ((entry.id === 'pot_seed' || entry.id === 'totem_seed') && !needPots) {
              w *= 0.2;
            }
            if (entry.id === 'free_spin_chest' || entry.id === 'free_spin_token') {
              if (
                !chaosMode &&
                (starterDelivered ||
                  spinsDone >= 1 ||
                  freeSpinsHeld >= 1 ||
                  hasFreeSpinActive)
              ) {
                return 0;
              }
              if (weaponTier >= 5) w *= 0.2;
            }
            if (chaosMode && (entry.critter || entry.gear || entry.id === 'star_gem_cluster' || entry.id === 'star_shower_jackpot')) {
              w *= 3.0;
            }
            return w;
          })
        : LOOT_BY_ID.star_gem_small;

      const selected = pick || LOOT_BY_ID.star_gem_small;
      chosenDrops.push(selected);
      if (selected.gear) {
        chosenGearInBurst.add(selected.gear);
      }
    }

    for (let i = 0; i < chosenDrops.length; i += 1) {
      const d = chosenDrops[i];
      if (d.id === 'pot_seed' || d.id === 'totem_seed') blocksSincePotSeed = 0;
      if (d.id === 'free_spin_chest' || d.id === 'free_spin_token') blocksSinceSpinChest = 0;
      if (d.gear) gearPityTriggered[d.gear] = true;

      spawnDropEntry(d, bx, by, bz, {
        index: i,
        total: chosenDrops.length,
        silentVo: Boolean(spawnedTitanId),
      });
    }

    if (block?.isLucky || chosenDrops.length > 1) {
      playSfx(ctx, 'luckyPop', 'blockBreak');
    }

    return {
      drops: chosenDrops,
      spawnedTitanId,
      isStarter: false,
      brokenCount,
    };
  }

  function getSnapshot() {
    return {
      localBrokenCount,
      starterDelivered,
      surprisePityDelivered,
      blocksSincePotSeed,
      blocksSinceSpinChest,
      gearPityTriggered: { ...gearPityTriggered },
    };
  }

  function reset() {
    localBrokenCount = 0;
    starterDelivered = false;
    surprisePityDelivered = false;
    blocksSincePotSeed = 0;
    blocksSinceSpinChest = 0;
    gearPityTriggered.speedBoots = false;
    gearPityTriggered.helmet = false;
    gearPityTriggered.starCape = false;
  }

  return {
    onBlockBroken,
    getSnapshot,
    reset,
  };
}
