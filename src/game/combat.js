// Kid-safe Power-Tier calculation, Giant Brainrot Boss spawning, Cappuccino Foam Spring Cloud boing,
// and rhythmic Sahur Drum-Club combat system for Tung Tung Tung Sahur 3D: Brainrot Rhythm Island!

import * as THREE from '../../vendor/three.module.min.js';
import { buildRainbowSpringCloudMesh } from '../chars/props3d.js';
import {
  HUB_LAYOUT,
  LOOT_TABLE,
  MOVEMENT_TUNING,
  TITAN_ORDER,
  TITANS,
  WEAPONS,
  resolveBossId,
  resolveWeaponId,
} from '../data/catalog.js';

const LOOT_BY_ID = Object.freeze(
  Object.fromEntries(LOOT_TABLE.map((entry) => [entry.id, entry]))
);

const COMIC_WORDS = Object.freeze(['TUNG!', 'BONK!', 'SAHUR!']);
const BOING_DURATION_SEC = 1.05;
const BOING_ARC_HEIGHT = 7.4;
const HIT_STOP_SEC = 0.045;
const CONSOLATION_BOING_GEMS = 3;

export function computePowerTier(player) {
  const weaponId = resolveWeaponId(player?.weaponId || 'wooden_kentungan_bat');
  const wpn = WEAPONS[weaponId] || WEAPONS.wooden_kentungan_bat;
  const helmetFloor = player?.helmet ? 2 : 1;
  return Math.max(1, Math.min(5, Math.max(wpn.tier, helmetFloor)));
}

export function syncPlayerStats(ctx) {
  const state = ctx?.state;
  const player = state?.player;
  if (!player) return null;

  if (typeof ctx.recalcStats === 'function') {
    ctx.recalcStats(state);
  }

  player.weaponId = resolveWeaponId(player.weaponId || 'wooden_kentungan_bat');
  const wpn = WEAPONS[player.weaponId] || WEAPONS.wooden_kentungan_bat;
  player.weaponTier = wpn.tier;
  player.powerTier = computePowerTier(player);

  if (player.helmet) {
    player.speed = MOVEMENT_TUNING.helmetSpeed;
    player.maxShieldHearts = Math.max(5, Number(player.maxShieldHearts) || 5);
    player.shieldHearts = Math.min(5, Math.max(Number(player.shieldHearts) || 0, 5));
  } else if (player.speedBoots) {
    player.speed = MOVEMENT_TUNING.bootsSpeed;
    player.maxShieldHearts = Math.max(5, Number(player.maxShieldHearts) || 5);
    player.shieldHearts = Math.min(5, Math.max(Number(player.shieldHearts) || 0, 5));
  } else {
    player.speed = MOVEMENT_TUNING.baseSpeed;
    player.maxShieldHearts = Math.min(5, Math.max(3, Number(player.maxShieldHearts) || 3));
    player.shieldHearts = Math.min(5, Math.max(0, Number(player.shieldHearts) || 0));
  }

  player.magnetRadius = player.starCape
    ? MOVEMENT_TUNING.capeMagnetRadius
    : MOVEMENT_TUNING.pickupMagnetRadius;

  const trophyCount = Array.isArray(state.trophies) ? state.trophies.length : 0;
  player.crown = Boolean(player.crown || trophyCount >= 4);

  ctx?.hero?.setEquipment?.({
    weaponId: player.weaponId,
    helmet: Boolean(player.helmet),
    speedBoots: Boolean(player.speedBoots),
    starCape: Boolean(player.starCape),
    crown: Boolean(player.crown),
  });

  return player;
}

function playSfx(ctx, primary, fallback, ...args) {
  const fn = ctx?.sfx?.[primary] || (fallback ? ctx?.sfx?.[fallback] : null);
  if (typeof fn === 'function') {
    fn.call(ctx.sfx, ...args);
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

function emitPinataBurst(ctx, x, y, z) {
  const p = ctx?.particles;
  const fn =
    p?.spawnPinataExplosion ||
    p?.pinataBurst ||
    p?.spawnPinata ||
    p?.spawnConfetti ||
    p?.burst;
  if (typeof fn === 'function') {
    fn.call(p, x, y, z, '#ffd43b', 36);
  }
}

function emitFireworks(ctx, x = 0, y = 7, z = -6) {
  const p = ctx?.particles;
  const fn =
    p?.spawnVictoryFireworks ||
    p?.spawnFirework ||
    p?.spawnFireworks ||
    p?.triggerFireworks ||
    p?.triggerVictoryFireworks ||
    p?.fireworks;
  if (typeof fn === 'function') {
    fn.call(p, x, y, z);
  }
}

function buildSpringCloudMesh() {
  const group = buildRainbowSpringCloudMesh();
  group.name = 'RainbowSpringCloud';
  group.visible = false;
  return group;
}

function getSafeWalkablePos(ctx, x, z, fallbackY = 1) {
  if (typeof ctx?.world?.clampToWalkable === 'function') {
    const clamped = ctx.world.clampToWalkable(x, z);
    if (clamped && Number.isFinite(clamped.x) && Number.isFinite(clamped.z)) {
      return {
        x: clamped.x,
        y: Number.isFinite(clamped.y) ? clamped.y : fallbackY,
        z: clamped.z,
      };
    }
  }
  const gy = ctx?.world?.getGroundY?.(x, z);
  return {
    x,
    y: Number.isFinite(gy) && gy > -50 ? gy : fallbackY,
    z,
  };
}

export function createCombatSystem(ctx) {
  const group = new THREE.Group();
  group.name = 'CombatFXGroup';
  const springCloudMesh = buildSpringCloudMesh();
  group.add(springCloudMesh);
  if (ctx?.scene && typeof ctx.scene.add === 'function') {
    ctx.scene.add(group);
  }

  const fallbackTitans = new Map();
  const defeatedIds = new Set();
  let lastShieldSparkleAt = -10;
  let lastComicWord = null;

  function ensureState() {
    if (!ctx.state) {
      ctx.state = {};
    }
    if (!ctx.state.player) {
      ctx.state.player = {
        x: HUB_LAYOUT.spawn.x,
        y: HUB_LAYOUT.spawn.y,
        z: HUB_LAYOUT.spawn.z,
        weaponId: 'wooden_kentungan_bat',
        weaponTier: 1,
        powerTier: 1,
        helmet: false,
        speedBoots: false,
        starCape: false,
        crown: false,
        shieldHearts: 3,
        maxShieldHearts: 3,
        starGems: 0,
        potSeeds: 0,
        freeSpins: 0,
        state: 'idle',
        path: [],
        target: null,
        boingArc: null,
      };
    }
    if (!Array.isArray(ctx.state.trophies)) {
      ctx.state.trophies = [];
    }
    if (!ctx.state.feedback) {
      ctx.state.feedback = {
        taps: 0,
        deadTaps: 0,
        boings: 0,
        bonks: 0,
        chestsOpened: 0,
        crittersPetted: 0,
      };
    }
    return ctx.state;
  }

  function resolveLiveTitan(rawTitanId) {
    const titanId = rawTitanId ? resolveBossId(rawTitanId) : null;
    if (titanId && typeof ctx?.titans?.getTitan === 'function') {
      const found = ctx.titans.getTitan(titanId);
      if (found) return found;
    }
    if (typeof ctx?.titans?.getActive === 'function') {
      const active = ctx.titans.getActive();
      if (active && (!titanId || resolveBossId(active.id || active.titanId) === titanId)) {
        return active;
      }
    }
    if (titanId && fallbackTitans.has(titanId)) {
      return fallbackTitans.get(titanId);
    }
    if (!titanId) {
      for (const t of fallbackTitans.values()) {
        if (t.active && !t.defeated) return t;
      }
    }
    return null;
  }

  function spawnBiomeTitan(rawTitanId, pos = null, opts = {}) {
    const state = ensureState();
    const titanId = resolveBossId(rawTitanId || 'tralalero_tralala');
    const spec = TITANS[titanId];
    if (!spec) return null;

    const existing = resolveLiveTitan(titanId);
    if (existing && existing.active && !existing.defeated && existing.hp > 0) {
      state.activeTitanId = titanId;
      if (typeof ctx?.titans?.focus === 'function') {
        ctx.titans.focus(titanId);
      }
      return existing;
    }

    const rawX = Number.isFinite(pos?.x) ? pos.x : spec.spawnPos.x;
    const rawZ = Number.isFinite(pos?.z) ? pos.z : spec.spawnPos.z;
    const rawY = Number.isFinite(pos?.y) ? pos.y : spec.spawnPos.y;
    const spawnPos = getSafeWalkablePos(ctx, rawX, rawZ, rawY);

    let titanObj = null;
    if (typeof ctx?.titans?.spawn === 'function') {
      titanObj = ctx.titans.spawn(titanId, spawnPos, opts);
    }
    if (!titanObj || typeof titanObj !== 'object') {
      titanObj = {
        id: titanId,
        titanId,
        name: spec.name,
        shortName: spec.shortName,
        biome: spec.biome,
        requiredTier: spec.requiredTier,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        rewardGems: spec.rewardGems,
        x: spawnPos.x,
        y: spawnPos.y,
        z: spawnPos.z,
        active: true,
        defeated: false,
      };
    } else {
      if (typeof titanObj.hp !== 'number') titanObj.hp = spec.maxHp;
      if (typeof titanObj.maxHp !== 'number') titanObj.maxHp = spec.maxHp;
      if (typeof titanObj.requiredTier !== 'number') titanObj.requiredTier = spec.requiredTier;
      if (!titanObj.id) titanObj.id = titanId;
      titanObj.active = true;
      titanObj.defeated = false;
    }

    defeatedIds.delete(titanId);
    fallbackTitans.set(titanId, titanObj);
    state.activeTitanId = titanId;

    playSfx(ctx, 'titanSpawnFanfare', 'titanSpawn');
    emitSparkles(ctx, spawnPos.x, spawnPos.y + 1.2, spawnPos.z, '#ffd43b', 20);

    if (opts?.surprise) {
      ctx?.voice?.speak?.(spec.voSpawn, { priority: 'queue' });
    } else {
      ctx?.voice?.speak?.(spec.voSpawn, { priority: 'interrupt' });
    }

    ctx?.ui?.showBossBanner?.(titanObj);
    ctx?.bossBanner?.show?.(titanObj);
    ctx?.onTitanSpawn?.(titanObj);

    return titanObj;
  }

  function emitComicWord(word, x, y, z, color) {
    lastComicWord = word;
    if (typeof ctx?.ui?.spawnComicBurst === 'function') {
      ctx.ui.spawnComicBurst(word, x, y, z, color);
    } else {
      ctx?.bossBanner?.spawnComicBurst?.(word, null, null, color);
    }
    ctx?.onComicBurst?.({ text: word, x, y, z, color });
  }

  function spawnPinataStarFountain(spec, titanX, titanY, titanZ, player) {
    const totalGems = Math.max(6, Number(spec.rewardGems) || 20);
    const hasPickupSpawner = typeof ctx?.pickups?.spawn === 'function';

    if (!hasPickupSpawner) {
      player.starGems = (Number(player.starGems) || 0) + totalGems;
      return;
    }

    // Credit half immediately for responsive progression and fountain 5 juicy star bursts for the rest!
    const directGems = Math.floor(totalGems * 0.5);
    const fountainGems = totalGems - directGems;
    player.starGems = (Number(player.starGems) || 0) + directGems;

    const pieces = 5;
    const basePerPiece = Math.floor(fountainGems / pieces);
    let remainder = fountainGems - basePerPiece * pieces;

    const centerX = Number.isFinite(player.x) ? (player.x + titanX) * 0.5 : titanX;
    const centerZ = Number.isFinite(player.z) ? (player.z + titanZ) * 0.5 : titanZ;
    const centerY = Math.max(1, Number.isFinite(titanY) ? titanY : 1) + 0.9;

    for (let i = 0; i < pieces; i += 1) {
      const val = basePerPiece + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      if (val <= 0) continue;
      ctx.pickups.spawn(
        {
          id: val >= 6 ? 'star_gem_cluster' : 'star_gem_small',
          gems: val,
          label: `+${val} STARS!`,
          color: i % 2 === 0 ? '#ffd43b' : '#ff922b',
          voId: null,
        },
        centerX,
        centerY,
        centerZ,
        {
          index: i,
          total: pieces,
          magnetDelay: 0.1,
          horizSpeed: 2.1,
          silentVo: true,
          source: 'pinata_burst',
        }
      );
    }
  }

  function ensureGuaranteedPinataGear(rawTitanId, trophyCountAfter, player, titanX, titanY, titanZ) {
    const titanId = resolveBossId(rawTitanId);
    const needBoots =
      !player.speedBoots &&
      !ctx?.pickups?.hasActiveGear?.('speedBoots') &&
      (titanId === 'tralalero_tralala' || trophyCountAfter >= 1);

    const needHelmet =
      !player.helmet &&
      !ctx?.pickups?.hasActiveGear?.('helmet') &&
      (titanId === 'tralalero_tralala' || trophyCountAfter >= 1);

    const needCape =
      !player.starCape &&
      !ctx?.pickups?.hasActiveGear?.('starCape') &&
      (titanId === 'bombardiro_crocodilo' || trophyCountAfter >= 2);

    const dropX = Number.isFinite(player.x) ? player.x : titanX;
    const dropY = (Number.isFinite(player.y) ? player.y : titanY) + 0.6;
    const dropZ = Number.isFinite(player.z) ? player.z : titanZ;

    if (needBoots && LOOT_BY_ID.speed_boots) {
      if (typeof ctx?.pickups?.spawn === 'function') {
        ctx.pickups.spawn(LOOT_BY_ID.speed_boots, dropX, dropY, dropZ, {
          magnetDelay: 0.03,
          horizSpeed: 0.5,
          vy: 3.6,
          source: 'pinata_gear',
        });
      } else {
        player.speedBoots = true;
        player.maxShieldHearts = 5;
        player.shieldHearts = 5;
        syncPlayerStats(ctx);
      }
    }

    if (needHelmet && LOOT_BY_ID.gold_helmet) {
      if (typeof ctx?.pickups?.spawn === 'function') {
        ctx.pickups.spawn(LOOT_BY_ID.gold_helmet, dropX, dropY, dropZ, {
          magnetDelay: 0.04,
          horizSpeed: 0.6,
          vy: 3.8,
          source: 'pinata_gear',
        });
      } else {
        player.helmet = true;
        player.maxShieldHearts = 5;
        player.shieldHearts = 5;
        syncPlayerStats(ctx);
      }
    }

    if (needCape && LOOT_BY_ID.star_cape) {
      if (typeof ctx?.pickups?.spawn === 'function') {
        ctx.pickups.spawn(LOOT_BY_ID.star_cape, dropX, dropY, dropZ, {
          magnetDelay: 0.06,
          horizSpeed: 0.8,
          vy: 4.0,
          source: 'pinata_gear',
        });
      } else {
        player.starCape = true;
        syncPlayerStats(ctx);
      }
    }
  }

  function handleTitanDefeat(titanId, spec, titan, state, player) {
    if (defeatedIds.has(titanId)) return;
    defeatedIds.add(titanId);

    titan.hp = 0;
    titan.defeated = true;
    titan.active = false;
    if (state.activeTitanId === titanId) {
      state.activeTitanId = null;
    }

    const tx = Number.isFinite(titan.x) ? titan.x : spec.spawnPos.x;
    const ty = Number.isFinite(titan.y) ? titan.y : spec.spawnPos.y;
    const tz = Number.isFinite(titan.z) ? titan.z : spec.spawnPos.z;

    playSfx(ctx, 'titanPinataPop', 'titanPinata');
    emitPinataBurst(ctx, tx, ty + 2.8, tz);
    spawnPinataStarFountain(spec, tx, ty, tz, player);

    if (!state.trophies.includes(titanId)) {
      state.trophies.push(titanId);
    }

    ensureGuaranteedPinataGear(titanId, state.trophies.length, player, tx, ty, tz);

    const pedestal = HUB_LAYOUT.trophyPedestals.find((p) => p.titanId === titanId);
    if (pedestal) {
      ctx?.world?.setTrophyVisual?.(
        pedestal.idx,
        titanId,
        true,
        ctx?.buildTrophyMesh || ctx?.props3d?.buildTrophyMesh
      );
    }

    ctx?.hero?.triggerCheer?.();
    ctx?.ui?.hideBossBanner?.(titanId);
    ctx?.bossBanner?.hide?.(titanId);

    const wonAllFour =
      TITAN_ORDER.every((id) => state.trophies.includes(id)) || state.trophies.length >= 4;

    if (wonAllFour) {
      state.mode = 'victory';
      state.victoryCelebrated = true;
      player.crown = true;
      player.state = 'celebrating';
      syncPlayerStats(ctx);
      playSfx(ctx, 'victoryFireworks', 'victoryFanfare');
      emitFireworks(ctx, 0, 7.5, -7.5);
      ctx?.voice?.speak?.('vo_finale_parade', { priority: 'interrupt' });
      ctx?.voice?.speak?.(spec.voCheer, { priority: 'queue' });
      ctx?.ui?.showVictory?.();
      ctx?.onVictory?.(state);
    } else {
      syncPlayerStats(ctx);
      ctx?.voice?.speak?.(spec.voDefeat, { priority: 'interrupt' });
      ctx?.voice?.speak?.(spec.voCheer, { priority: 'queue' });
    }

    ctx?.onTitanDefeated?.(titanId, state.trophies.slice());
  }

  function bonkTitan(requestedTitanId = null) {
    const state = ensureState();
    const player = state.player;

    if (player.boingArc && player.boingArc.active) {
      return { ok: false, reason: 'boinging' };
    }

    let titan = resolveLiveTitan(requestedTitanId);
    const rawTitanId = requestedTitanId || titan?.id || titan?.titanId || state.activeTitanId;
    const titanId = rawTitanId ? resolveBossId(rawTitanId) : null;
    const spec = titanId ? TITANS[titanId] : null;
    if (!spec) {
      return { ok: false, reason: 'unknown_titan' };
    }

    if (defeatedIds.has(titanId) && (!titan || titan.defeated || titan.hp <= 0)) {
      return { ok: false, reason: 'already_defeated', titanId };
    }

    if (!titan || (!titan.active && !titan.defeated)) {
      titan = spawnBiomeTitan(titanId, spec.spawnPos);
    }
    if (!titan || titan.defeated || titan.hp <= 0) {
      return { ok: false, reason: 'already_defeated', titanId };
    }

    const powerTier = computePowerTier(player);
    player.powerTier = powerTier;
    ctx?.hero?.triggerSwing?.();

    const tx = Number.isFinite(titan.x) ? titan.x : spec.spawnPos.x;
    const ty = Number.isFinite(titan.y) ? titan.y : spec.spawnPos.y;
    const tz = Number.isFinite(titan.z) ? titan.z : spec.spawnPos.z;

    // --- Kid-Safe Under-Geared Path: Rainbow Spring Cloud Boing! ---
    if (powerTier < spec.requiredTier) {
      ctx?.titans?.hit?.(titanId, 0, false);
      ctx?.hero?.triggerBoing?.();

      const startX = Number.isFinite(player.x) ? player.x : tx;
      const startY = Number.isFinite(player.y) ? player.y : ty;
      const startZ = Number.isFinite(player.z) ? player.z : tz;
      const landing = getSafeWalkablePos(
        ctx,
        HUB_LAYOUT.boingLanding.x,
        HUB_LAYOUT.boingLanding.z,
        HUB_LAYOUT.boingLanding.y
      );

      player.vx = 0;
      player.vz = 0;
      player.path = [];
      player.target = null;
      player.state = 'boinging';
      player.boingArc = {
        active: true,
        titanId,
        elapsed: 0,
        duration: BOING_DURATION_SEC,
        arcHeight: BOING_ARC_HEIGHT,
        startX,
        startY,
        startZ,
        endX: landing.x,
        endY: landing.y,
        endZ: landing.z,
      };

      springCloudMesh.visible = true;
      springCloudMesh.position.set(startX, startY - 0.15, startZ);
      springCloudMesh.scale.set(1.25, 0.7, 1.25);

      ctx?.particles?.spawnSpringCloud?.(startX, startY, startZ);
      playSfx(ctx, 'cloudBoing', 'luckyPop');
      emitComicWord('BOING!', tx, ty + 3.8, tz, '#39d5ff');

      // Consolation +3 Star Gems on the first under-geared boing with zero health/item/gem loss!
      const isFirstBoing = (Number(state.feedback.boings) || 0) === 0;
      const boingBonus = isFirstBoing ? CONSOLATION_BOING_GEMS : 0;
      player.starGems = (Number(player.starGems) || 0) + boingBonus;
      state.feedback.boings = (Number(state.feedback.boings) || 0) + 1;

      ctx?.voice?.speak?.(spec.voBoing, { priority: 'interrupt' });
      ctx?.voice?.speak?.('guide_boing_hint', { priority: 'queue' });

      return {
        ok: true,
        outcome: 'boing',
        canBeat: false,
        titanId,
        powerTier,
        requiredTier: spec.requiredTier,
        consolationGems: boingBonus,
        landing,
      };
    }

    // --- Powered-Up Geared Path: Juicy Hit-Stop + Comic Bonk! ---
    const wpn = WEAPONS[resolveWeaponId(player.weaponId)] || WEAPONS.wooden_kentungan_bat;
    const baseDamage = wpn.damage;
    const damage = player.helmet ? Math.round(baseDamage * 1.25) : baseDamage;

    const hpBefore = typeof titan.hp === 'number' ? titan.hp : spec.maxHp;
    const hitRes = ctx?.titans?.hit?.(titanId, damage, true);
    const liveAfter = resolveLiveTitan(titanId) || titan;

    let hpAfter =
      typeof hitRes?.hp === 'number'
        ? hitRes.hp
        : typeof liveAfter?.hp === 'number'
          ? liveAfter.hp
          : hpBefore;

    if (hpAfter >= hpBefore) {
      hpAfter = Math.max(0, hpBefore - damage);
    } else {
      hpAfter = Math.max(0, hpAfter);
    }
    liveAfter.hp = hpAfter;
    titan.hp = hpAfter;

    state.hitStopTimer = HIT_STOP_SEC;
    state.feedback.bonks = (Number(state.feedback.bonks) || 0) + 1;

    const word = COMIC_WORDS[(state.feedback.bonks - 1) % COMIC_WORDS.length];
    emitComicWord(word, tx, ty + 4.1, tz, '#ffd43b');
    playSfx(ctx, 'titanBonk', 'blockHit');
    emitSparkles(ctx, tx, ty + 2.6, tz, '#ffd43b', 14);

    if ((Number(player.shieldHearts) || 0) > 0) {
      const now = Number(state.time) || 0;
      if (now - lastShieldSparkleAt >= 0.25) {
        lastShieldSparkleAt = now;
        emitSparkles(
          ctx,
          Number(player.x) || tx,
          (Number(player.y) || 1) + 1.0,
          Number(player.z) || tz,
          '#ff6b9d',
          8
        );
        ctx?.hero?.flashShield?.();
      }
    }

    ctx?.ui?.updateBossBanner?.(liveAfter);
    ctx?.bossBanner?.update?.(liveAfter);

    if (hpAfter <= 0) {
      handleTitanDefeat(titanId, spec, liveAfter, state, player);
      return {
        ok: true,
        outcome: 'defeated',
        canBeat: true,
        titanId,
        damage,
        hp: 0,
        maxHp: spec.maxHp,
        word,
        trophies: state.trophies.slice(),
      };
    }

    const cheerLine = state.feedback.bonks % 2 === 0 ? 'vo_bonk_cheer1' : spec.voOuch;
    ctx?.voice?.speak?.(cheerLine, { priority: 'ifIdle' });

    return {
      ok: true,
      outcome: 'bonk',
      canBeat: true,
      titanId,
      damage,
      hp: hpAfter,
      maxHp: spec.maxHp,
      word,
    };
  }

  function update(dt, time = 0) {
    const state = ensureState();
    const step = Math.max(0, Number(dt) || 0);

    if (state.hitStopTimer > 0) {
      state.hitStopTimer = Math.max(0, state.hitStopTimer - step);
    }

    const player = state.player;
    const arc = player?.boingArc;
    if (arc && arc.active) {
      arc.elapsed = Math.min(arc.duration, (Number(arc.elapsed) || 0) + step);
      const t = arc.duration > 0 ? Math.min(1, arc.elapsed / arc.duration) : 1;

      const nx = arc.startX + (arc.endX - arc.startX) * t;
      const nz = arc.startZ + (arc.endZ - arc.startZ) * t;
      const baseY = arc.startY + (arc.endY - arc.startY) * t;
      const ny = baseY + Math.sin(t * Math.PI) * arc.arcHeight;

      player.x = nx;
      player.y = ny;
      player.z = nz;
      player.yaw = Math.atan2(arc.endX - arc.startX, arc.endZ - arc.startZ);

      springCloudMesh.visible = true;
      springCloudMesh.position.set(nx, ny - 0.32, nz);
      const springStretch = 1 + Math.sin(t * Math.PI * 3) * 0.16;
      springCloudMesh.scale.set(1 / Math.sqrt(springStretch), springStretch, 1 / Math.sqrt(springStretch));
      springCloudMesh.rotation.y = time * 2.2;

      if (t >= 1) {
        const landed = getSafeWalkablePos(ctx, arc.endX, arc.endZ, arc.endY);
        player.x = landed.x;
        player.y = landed.y;
        player.z = landed.z;
        player.boingArc = null;
        if (player.state === 'boinging') {
          player.state = 'idle';
        }
        springCloudMesh.visible = false;
        emitSparkles(ctx, landed.x, landed.y + 0.5, landed.z, '#39d5ff', 12);
      }
    } else if (springCloudMesh.visible) {
      springCloudMesh.visible = false;
    }
  }

  function getSnapshot() {
    const state = ensureState();
    const active = resolveLiveTitan(null);
    return {
      powerTier: computePowerTier(state.player),
      hitStopTimer: Number(state.hitStopTimer) || 0,
      boinging: Boolean(state.player?.boingArc?.active),
      lastComicWord,
      activeTitan: active
        ? {
            id: active.id || active.titanId,
            hp: active.hp,
            maxHp: active.maxHp,
            requiredTier: active.requiredTier,
            x: active.x,
            y: active.y,
            z: active.z,
          }
        : null,
      trophies: state.trophies.slice(),
    };
  }

  function reset() {
    fallbackTitans.clear();
    defeatedIds.clear();
    lastShieldSparkleAt = -10;
    lastComicWord = null;
    springCloudMesh.visible = false;
    if (ctx?.state) {
      ctx.state.hitStopTimer = 0;
      ctx.state.activeTitanId = null;
      if (ctx.state.player) {
        ctx.state.player.boingArc = null;
        if (ctx.state.player.state === 'boinging') {
          ctx.state.player.state = 'idle';
        }
        syncPlayerStats(ctx);
      }
    }
  }

  return {
    group,
    computePowerTier,
    syncPlayerStats: () => syncPlayerStats(ctx),
    spawnBiomeTitan,
    bonkTitan,
    engageTitan: bonkTitan,
    isBoinging: () => Boolean(ctx?.state?.player?.boingArc?.active),
    isHitStopped: () => (Number(ctx?.state?.hitStopTimer) || 0) > 0,
    getActiveTitan: () => resolveLiveTitan(null),
    update,
    getSnapshot,
    reset,
  };
}
