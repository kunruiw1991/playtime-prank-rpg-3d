// Golden Sahur Drum Roulette Wheel odds, strict tier-climb guarantee, 2.4s strip roll,
// and instant auto-equip system for Tung Tung Tung Sahur 3D: Brainrot Rhythm Island!

import {
  HUB_LAYOUT,
  ROULETTE_COSTS,
  TITAN_ORDER,
  TITANS,
  WEAPON_ORDER,
  WEAPONS,
  resolveWeaponId,
} from '../data/catalog.js';
import { computePowerTier, syncPlayerStats } from './combat.js';

const SPIN_DURATION_SEC = 2.4;
const STRIP_LENGTH = 28;
const WINNER_INDEX = 22;
const MAX_TIER_JACKPOT_GEMS = 8;
const MAX_TIER_JACKPOT_SHIELD = 1;
const DUPLICATE_FORCED_GEMS = 10;

const WEAPONS_BY_TIER = Object.freeze({
  1: Object.freeze(['wooden_kentungan_bat']),
  2: Object.freeze(['bronze_temple_gong']),
  3: Object.freeze(['golden_sahur_mallet']),
  4: Object.freeze(['neon_thunder_taiko']),
  5: Object.freeze(['rainbow_mega_hammer']),
});

const SPIN_POOL_IDS = Object.freeze(
  WEAPON_ORDER.filter((id) => id !== 'wooden_kentungan_bat')
);

const READY_TITAN_VO = Object.freeze({
  tralalero_tralala: 'guide_ready_moss',
  bombardiro_crocodilo: 'guide_ready_snow',
  brr_brr_patapim: 'guide_ready_thunder',
  golden_sahur_king: 'guide_ready_king',
  moss_titan: 'guide_ready_moss',
  snow_titan: 'guide_ready_snow',
  thunder_titan: 'guide_ready_thunder',
  bedrock_king: 'guide_ready_king',
});

function playSfx(ctx, primary, fallback, ...args) {
  const fn = ctx?.sfx?.[primary] || (fallback ? ctx?.sfx?.[fallback] : null);
  if (typeof fn === 'function') {
    fn.call(ctx.sfx, ...args);
  }
}

export function createRouletteSystem(ctx) {
  let pendingOutcome = null;

  function ensureRouletteState() {
    if (!ctx.state) {
      ctx.state = {};
    }
    if (!ctx.state.player) {
      ctx.state.player = {
        weaponId: 'wooden_kentungan_bat',
        weaponTier: 1,
        powerTier: 1,
        starGems: 0,
        freeSpins: 0,
        shieldHearts: 3,
        maxShieldHearts: 3,
      };
    }
    if (!ctx.state.roulette) {
      ctx.state.roulette = {
        open: false,
        spinning: false,
        settled: false,
        spinTimer: 0,
        spinDuration: SPIN_DURATION_SEC,
        progress: 0,
        easedProgress: 0,
        spinCost: ROULETTE_COSTS[0],
        selectedWeaponId: null,
        winnerId: null,
        spinsCount: 0,
        strip: [],
        winnerIndex: WINNER_INDEX,
        tickIndex: 0,
        lastResult: null,
      };
    }
    const r = ctx.state.roulette;
    if (typeof r.spinDuration !== 'number') r.spinDuration = SPIN_DURATION_SEC;
    if (!Array.isArray(r.strip)) r.strip = [];
    if (typeof r.winnerIndex !== 'number') r.winnerIndex = WINNER_INDEX;
    if (typeof r.tickIndex !== 'number') r.tickIndex = 0;
    if (typeof r.progress !== 'number') r.progress = 0;
    if (typeof r.easedProgress !== 'number') r.easedProgress = 0;
    return r;
  }

  function getSpinCost() {
    const r = ensureRouletteState();
    const freeSpins = Number(ctx.state.player?.freeSpins) || 0;
    if (freeSpins > 0) {
      r.spinCost = 0;
      return 0;
    }
    const idx = Math.min(Math.max(0, Number(r.spinsCount) || 0), ROULETTE_COSTS.length - 1);
    const cost = ROULETTE_COSTS[idx];
    r.spinCost = cost;
    return cost;
  }

  function canSpin() {
    const r = ensureRouletteState();
    if (r.spinning) return false;
    const player = ctx.state.player;
    if ((Number(player.freeSpins) || 0) > 0) return true;
    return (Number(player.starGems) || 0) >= getSpinCost();
  }

  function chooseWinningWeapon(forcedWeaponId = null) {
    const player = ctx.state.player;
    const currentId = resolveWeaponId(player.weaponId || 'wooden_kentungan_bat');
    const currentSpec = WEAPONS[currentId] || WEAPONS.wooden_kentungan_bat;
    const currentTier = currentSpec.tier;

    const resolvedForced = forcedWeaponId ? resolveWeaponId(forcedWeaponId) : null;
    if (resolvedForced && WEAPONS[resolvedForced]) {
      return {
        winnerId: resolvedForced,
        isJackpotBonus: false,
        forced: true,
      };
    }

    // Once at Rainbow Mega Sahur Hammer (Tier 5), spins celebrate with a +8 Star Jackpot + Shield Heart!
    if (currentTier >= 5) {
      return {
        winnerId: 'rainbow_mega_hammer',
        isJackpotBonus: true,
        forced: false,
      };
    }

    // Strict step-by-step Tier Climb: 1 -> 2 -> 3 -> 4 (Neon Thunder Taiko) -> 5 (Rainbow Mega Hammer)
    // so every drum-club tier is experienced and Tier 4 is never skipped!
    const targetTier = Math.min(5, currentTier + 1);
    const candidates = WEAPONS_BY_TIER[targetTier] || WEAPONS_BY_TIER[5];
    const winnerId =
      candidates.length === 1
        ? candidates[0]
        : ctx?.rng
          ? ctx.rng.pick(candidates)
          : candidates[0];

    return {
      winnerId,
      isJackpotBonus: false,
      forced: false,
    };
  }

  function buildStrip(winnerId) {
    const strip = new Array(STRIP_LENGTH);
    let prev = null;
    for (let i = 0; i < STRIP_LENGTH; i += 1) {
      if (i === WINNER_INDEX) {
        strip[i] = winnerId;
        prev = winnerId;
        continue;
      }
      const choices = SPIN_POOL_IDS.filter(
        (id) => id !== prev && (i !== WINNER_INDEX - 1 && i !== WINNER_INDEX + 1 ? true : id !== winnerId)
      );
      const picked = ctx?.rng ? ctx.rng.pick(choices) : choices[i % choices.length];
      strip[i] = picked || 'bronze_temple_gong';
      prev = strip[i];
    }
    return strip;
  }

  function findNewlyUnlockedTitanVo(prevPowerTier, nextPowerTier) {
    if (nextPowerTier <= prevPowerTier) return null;
    const trophies = Array.isArray(ctx?.state?.trophies) ? ctx.state.trophies : [];
    for (const titanId of TITAN_ORDER) {
      if (trophies.includes(titanId)) continue;
      const spec = TITANS[titanId];
      if (spec && spec.requiredTier > prevPowerTier && spec.requiredTier <= nextPowerTier) {
        return READY_TITAN_VO[titanId] || null;
      }
    }
    return null;
  }

  function finishSpin() {
    const r = ensureRouletteState();
    if (!pendingOutcome && !r.spinning) {
      return r.lastResult;
    }

    const player = ctx.state.player;
    const prevWeaponId = resolveWeaponId(player.weaponId || 'wooden_kentungan_bat');
    const prevSpec = WEAPONS[prevWeaponId] || WEAPONS.wooden_kentungan_bat;
    const prevPowerTier = computePowerTier(player);

    const winnerId = resolveWeaponId(pendingOutcome?.winnerId || r.selectedWeaponId || 'bronze_temple_gong');
    const winnerSpec = WEAPONS[winnerId] || WEAPONS.bronze_temple_gong;
    const isJackpotBonus = Boolean(pendingOutcome?.isJackpotBonus);
    pendingOutcome = null;

    r.spinning = false;
    r.settled = true;
    r.spinTimer = r.spinDuration;
    r.progress = 1;
    r.easedProgress = 1;
    r.tickIndex = r.winnerIndex;
    r.selectedWeaponId = winnerId;
    r.winnerId = winnerId;

    let upgraded = false;
    let bonusGems = 0;
    let bonusShield = 0;

    if (isJackpotBonus) {
      bonusGems = MAX_TIER_JACKPOT_GEMS;
      bonusShield = MAX_TIER_JACKPOT_SHIELD;
      player.starGems = (Number(player.starGems) || 0) + bonusGems;
      player.maxShieldHearts = Math.min(5, Math.max(Number(player.maxShieldHearts) || 3, (Number(player.shieldHearts) || 0) + bonusShield));
      player.shieldHearts = Math.min(5, (Number(player.shieldHearts) || 0) + bonusShield);
    } else {
      const canEquipWithoutDowngrade =
        winnerSpec.tier > prevSpec.tier ||
        (winnerSpec.tier === prevSpec.tier && winnerSpec.damage >= prevSpec.damage);

      if (canEquipWithoutDowngrade) {
        upgraded = winnerId !== prevWeaponId;
        player.weaponId = winnerId;
        player.weaponTier = winnerSpec.tier;
      } else {
        // Never downgrade equipped weapon! Grant bonus Star Gems instead.
        bonusGems = DUPLICATE_FORCED_GEMS;
        player.starGems = (Number(player.starGems) || 0) + bonusGems;
      }
    }

    syncPlayerStats(ctx);
    getSpinCost();

    const nextPowerTier = computePowerTier(player);

    playSfx(ctx, 'rouletteJackpot', 'rouletteWin');
    const p = ctx?.particles;
    const sparkleFn =
      p?.spawnStarSparkles ||
      p?.starSparkles ||
      p?.spawnSparkles ||
      p?.emitSparkles ||
      p?.sparkle ||
      p?.burst;
    if (typeof sparkleFn === 'function') {
      sparkleFn.call(
        p,
        HUB_LAYOUT.rouletteChest.x,
        HUB_LAYOUT.rouletteChest.y + 1.4,
        HUB_LAYOUT.rouletteChest.z,
        winnerSpec.color || '#ffd43b',
        22
      );
    }

    if (isJackpotBonus) {
      ctx?.voice?.speak?.('fairy_bonus_stars', { priority: 'interrupt' });
    } else if (winnerSpec.voId) {
      ctx?.voice?.speak?.(winnerSpec.voId, { priority: 'interrupt' });
      const readyTitanVo = findNewlyUnlockedTitanVo(prevPowerTier, nextPowerTier);
      if (readyTitanVo) {
        ctx?.voice?.speak?.(readyTitanVo, { priority: 'queue' });
      }
    }

    const result = {
      ok: true,
      weaponId: player.weaponId,
      rolledWeaponId: winnerId,
      previousWeaponId: prevWeaponId,
      weaponTier: player.weaponTier,
      powerTier: nextPowerTier,
      upgraded,
      isJackpotBonus,
      bonusGems,
      bonusShield,
    };

    r.lastResult = result;
    ctx?.ui?.onRouletteSettled?.(result);
    ctx?.onRouletteFinish?.(result);
    return result;
  }

  function openModal() {
    const r = ensureRouletteState();
    r.open = true;
    getSpinCost();
    if (ctx.state.mode === 'playing') {
      ctx.state.mode = 'roulette';
    }
    ctx?.world?.setChestOpen?.(true);
    ctx?.voice?.speak?.('fairy_chest_open', { priority: 'ifIdle' });
    return r;
  }

  function closeModal() {
    const r = ensureRouletteState();
    if (r.spinning) return false;
    r.open = false;
    if (ctx.state.mode === 'roulette') {
      ctx.state.mode = 'playing';
    }
    ctx?.world?.setChestOpen?.(false);
    return true;
  }

  function startSpin(forcedWeaponId = null, { instant = false } = {}) {
    const r = ensureRouletteState();
    if (r.spinning) {
      return { ok: false, reason: 'already_spinning' };
    }

    const player = ctx.state.player;
    const resolvedForcedId = forcedWeaponId ? resolveWeaponId(forcedWeaponId) : null;
    const isForcedValid = Boolean(resolvedForcedId && WEAPONS[resolvedForcedId]);
    const cost = getSpinCost();

    if ((Number(player.freeSpins) || 0) > 0) {
      player.freeSpins = Math.max(0, Number(player.freeSpins) - 1);
    } else if ((Number(player.starGems) || 0) >= cost) {
      player.starGems = Math.max(0, Number(player.starGems) - cost);
    } else if (!isForcedValid) {
      ctx?.voice?.speak?.('fairy_need_stars', { priority: 'ifIdle' });
      return { ok: false, reason: 'not_enough_stars', cost };
    }

    const chosen = chooseWinningWeapon(isForcedValid ? resolvedForcedId : null);
    pendingOutcome = chosen;

    r.spinsCount = (Number(r.spinsCount) || 0) + 1;
    if (ctx.state.feedback) {
      ctx.state.feedback.chestsOpened = (Number(ctx.state.feedback.chestsOpened) || 0) + 1;
    }

    r.strip = buildStrip(chosen.winnerId);
    r.winnerIndex = WINNER_INDEX;
    r.tickIndex = 0;
    r.spinDuration = SPIN_DURATION_SEC;
    r.spinTimer = 0;
    r.progress = 0;
    r.easedProgress = 0;
    r.spinning = true;
    r.settled = false;
    r.selectedWeaponId = chosen.winnerId;
    r.winnerId = null;

    getSpinCost();
    ctx?.world?.setChestOpen?.(true);

    if (instant) {
      return finishSpin();
    }

    playSfx(ctx, 'rouletteTick', 'tapGround', 0);
    ctx?.voice?.speak?.('fairy_spinning', { priority: 'interrupt' });
    ctx?.ui?.onRouletteStart?.(r);

    return {
      ok: true,
      spinning: true,
      duration: r.spinDuration,
      selectedWeaponId: chosen.winnerId,
      strip: r.strip.slice(),
      winnerIndex: r.winnerIndex,
    };
  }

  function update(dt) {
    const r = ensureRouletteState();
    if (!r.spinning) return;

    const step = Math.max(0, Number(dt) || 0);
    r.spinTimer = Math.min(r.spinDuration, (Number(r.spinTimer) || 0) + step);
    const t = r.spinDuration > 0 ? Math.min(1, r.spinTimer / r.spinDuration) : 1;
    const eased = 1 - Math.pow(1 - t, 3);

    r.progress = t;
    r.easedProgress = eased;

    const nextTick = Math.min(r.winnerIndex, Math.floor(eased * r.winnerIndex));
    while (r.tickIndex < nextTick) {
      r.tickIndex += 1;
      playSfx(ctx, 'rouletteTick', null, r.tickIndex);
      ctx?.onRouletteTick?.(r.tickIndex, r.strip[r.tickIndex]);
    }

    if (r.spinTimer >= r.spinDuration) {
      finishSpin();
    }
  }

  function getSnapshot() {
    const r = ensureRouletteState();
    return {
      open: Boolean(r.open),
      spinning: Boolean(r.spinning),
      settled: Boolean(r.settled),
      spinTimer: Number((Number(r.spinTimer) || 0).toFixed(3)),
      spinDuration: r.spinDuration,
      progress: Number((Number(r.progress) || 0).toFixed(4)),
      easedProgress: Number((Number(r.easedProgress) || 0).toFixed(4)),
      spinCost: getSpinCost(),
      canSpin: canSpin(),
      spinsCount: Number(r.spinsCount) || 0,
      selectedWeaponId: r.selectedWeaponId || null,
      winnerId: r.winnerId || null,
      winnerIndex: r.winnerIndex,
      tickIndex: r.tickIndex,
      strip: Array.isArray(r.strip) ? r.strip.slice() : [],
      lastResult: r.lastResult ? { ...r.lastResult } : null,
    };
  }

  function reset() {
    pendingOutcome = null;
    const r = ensureRouletteState();
    r.open = false;
    r.spinning = false;
    r.settled = false;
    r.spinTimer = 0;
    r.spinDuration = SPIN_DURATION_SEC;
    r.progress = 0;
    r.easedProgress = 0;
    r.spinsCount = 0;
    r.selectedWeaponId = null;
    r.winnerId = null;
    r.strip = [];
    r.tickIndex = 0;
    r.lastResult = null;
    getSpinCost();
    ctx?.world?.setChestOpen?.(false);
  }

  return {
    getSpinCost,
    canSpin,
    openModal,
    closeModal,
    startSpin,
    finishSpin,
    completeSpin: finishSpin,
    update,
    getSnapshot,
    reset,
  };
}
