// Deterministic game state & persistent kid preferences for Tung Tung Tung Sahur 3D (owner: sahur-director).
import {
  HUB_LAYOUT,
  MOVEMENT_TUNING,
  ROULETTE_COSTS,
  STORAGE_KEY,
  TITAN_ORDER,
  WEAPONS,
  resolveBossId,
  resolveWeaponId,
} from '../data/catalog.js';

const LEGACY_STORAGE_KEY = 'lucky_titan_progress';

function readRawStorage() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function writeRawStorage(payload) {
  try {
    if (typeof localStorage !== 'undefined') {
      const str = JSON.stringify(payload);
      localStorage.setItem(STORAGE_KEY, str);
      localStorage.setItem(LEGACY_STORAGE_KEY, str);
    }
  } catch (_err) {
    // Ignore storage quota or sandbox restrictions.
  }
}

export function loadPrefs() {
  const defaults = {
    musicOn: true,
    sfxOn: true,
    voiceOn: true,
    chaosMode: false,
    bestTrophies: 0,
  };
  const parsed = readRawStorage();
  if (!parsed || Object.keys(parsed).length === 0) return defaults;
  return {
    musicOn: parsed.musicOn !== false,
    sfxOn: parsed.sfxOn !== false,
    voiceOn: parsed.voiceOn !== false,
    chaosMode: Boolean(parsed.chaosMode),
    bestTrophies: Math.max(0, Number(parsed.bestTrophies) || 0),
  };
}

export function savePrefs(patch = {}) {
  const raw = readRawStorage();
  const nextPrefs = { ...loadPrefs(), ...patch };
  const merged = { ...raw, ...nextPrefs };
  writeRawStorage(merged);
  return nextPrefs;
}

export function loadSavedRun() {
  const parsed = readRawStorage();
  const run = parsed?.savedRun;
  if (!run || typeof run !== 'object') return null;
  const seed = (Number(run.seed) >>> 0) || 2026;
  const weaponId = resolveWeaponId(run.weaponId);
  const rawTiers = run.totemTiers || run.potTiers;
  const potTiers = Array.isArray(rawTiers)
    ? HUB_LAYOUT.totemPads.map((_, idx) => Math.max(0, Math.min(3, Number(rawTiers[idx]) || 0)))
    : [0, 0, 0, 0];
  const trophies = Array.isArray(run.trophies)
    ? run.trophies
        .map((id) => resolveBossId(id))
        .filter((id, idx, arr) => TITAN_ORDER.includes(id) && arr.indexOf(id) === idx)
    : [];
  return {
    seed,
    chaosMode: Boolean(run.chaosMode),
    starGems: Math.max(0, Math.round(Number(run.starGems) || 0)),
    potSeeds: Math.max(0, Math.round(Number(run.potSeeds) || 0)),
    freeSpins: Math.max(0, Math.round(Number(run.freeSpins) || 0)),
    weaponId,
    helmet: Boolean(run.helmet),
    speedBoots: Boolean(run.speedBoots),
    starCape: Boolean(run.starCape),
    latteBoostTimer: Math.max(0, Number(run.latteBoostTimer) || 0),
    shieldHearts: Math.max(3, Math.min(8, Math.round(Number(run.shieldHearts) || 3))),
    maxShieldHearts: Math.max(3, Math.min(8, Math.round(Number(run.maxShieldHearts) || 3))),
    blocksBroken: Math.max(0, Math.round(Number(run.blocksBroken) || 0)),
    spinsCount: Math.max(0, Math.round(Number(run.spinsCount) || 0)),
    potTiers,
    totemTiers: potTiers.slice(),
    trophies,
    victoryCelebrated: Boolean(run.victoryCelebrated),
  };
}

export function hasSavedRun() {
  const run = loadSavedRun();
  if (!run) return false;
  return (
    run.blocksBroken > 0 ||
    run.starGems > 0 ||
    run.trophies.length > 0 ||
    run.weaponId !== 'wooden_kentungan_bat' ||
    run.helmet ||
    run.speedBoots ||
    run.potTiers.some((t) => t > 0)
  );
}

export function saveRunSnapshot(state) {
  if (!state || !state.player) return;
  const raw = readRawStorage();
  const prefs = loadPrefs();
  const bestTrophies = Math.max(prefs.bestTrophies || 0, state.trophies?.length || 0);
  const potTiers = (state.flowerpots || []).map((p) => Math.max(0, Math.min(3, Number(p.tier) || 0)));
  const savedRun = {
    seed: (Number(state.seed) >>> 0) || 2026,
    chaosMode: Boolean(state.chaosMode),
    starGems: Math.max(0, Math.round(Number(state.player.starGems) || 0)),
    potSeeds: Math.max(0, Math.round(Number(state.player.potSeeds) || 0)),
    freeSpins: Math.max(0, Math.round(Number(state.player.freeSpins) || 0)),
    weaponId: resolveWeaponId(state.player.weaponId),
    helmet: Boolean(state.player.helmet),
    speedBoots: Boolean(state.player.speedBoots),
    starCape: Boolean(state.player.starCape),
    latteBoostTimer: Math.max(0, Number(state.player.latteBoostTimer) || 0),
    shieldHearts: Math.max(3, Math.round(Number(state.player.shieldHearts) || 3)),
    maxShieldHearts: Math.max(3, Math.round(Number(state.player.maxShieldHearts) || 3)),
    blocksBroken: Math.max(0, Math.round(Number(state.blocksBroken) || 0)),
    spinsCount: Math.max(0, Math.round(Number(state.roulette?.spinsCount) || 0)),
    potTiers,
    totemTiers: potTiers.slice(),
    trophies: Array.isArray(state.trophies) ? [...state.trophies] : [],
    victoryCelebrated: Boolean(state.victoryCelebrated),
  };
  writeRawStorage({
    ...raw,
    ...prefs,
    bestTrophies,
    savedRun,
  });
}

export function applySavedRunToState(state, savedRun) {
  if (!state || !savedRun) return state;
  state.seed = savedRun.seed;
  state.chaosMode = Boolean(savedRun.chaosMode);
  state.blocksBroken = savedRun.blocksBroken;
  state.victoryCelebrated = Boolean(savedRun.victoryCelebrated);
  state.player.starGems = savedRun.starGems;
  state.player.potSeeds = savedRun.potSeeds;
  state.player.freeSpins = savedRun.freeSpins;
  state.player.weaponId = resolveWeaponId(savedRun.weaponId);
  state.player.helmet = savedRun.helmet;
  state.player.speedBoots = savedRun.speedBoots;
  state.player.starCape = savedRun.starCape;
  state.player.latteBoostTimer = savedRun.latteBoostTimer || 0;
  state.player.shieldHearts = savedRun.shieldHearts;
  state.player.maxShieldHearts = savedRun.maxShieldHearts;
  state.roulette.spinsCount = savedRun.spinsCount;
  state.trophies = savedRun.trophies.map((id) => resolveBossId(id));
  for (let i = 0; i < state.flowerpots.length; i += 1) {
    state.flowerpots[i].tier = savedRun.potTiers[i] || 0;
    state.flowerpots[i].timer = 0;
  }
  recalcPlayerStats(state);
  return state;
}

export function createGameState({ seed = 2026, chaosMode = false, mode = 'title' } = {}) {
  const cleanSeed = (Number(seed) >>> 0) || 2026;
  const pads = HUB_LAYOUT.totemPads.map((p) => ({
    padIdx: p.padIdx,
    id: p.id,
    name: p.name,
    helperId: p.helperId,
    helperName: p.helperName,
    x: p.x,
    y: p.y,
    z: p.z,
    tier: 0,
    timer: 0,
    totalSpawned: 0,
  }));

  return {
    mode, // 'title' | 'playing' | 'roulette' | 'paused' | 'victory'
    seed: cleanSeed,
    time: 0,
    chaosMode: Boolean(chaosMode),
    hitStopTimer: 0,
    victoryCelebrated: false,

    player: {
      x: HUB_LAYOUT.spawn.x,
      y: HUB_LAYOUT.spawn.y,
      groundY: HUB_LAYOUT.spawn.y,
      jumpY: 0,
      z: HUB_LAYOUT.spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
      airborne: false,
      jumping: false,
      jumpCount: 0,
      jumpApexY: HUB_LAYOUT.spawn.y,
      landSquashTimer: 0,
      yaw: Math.PI, // Facing north (-Z) toward Starter Mystery Drum & Roulette Wheel
      baseSpeed: MOVEMENT_TUNING.baseSpeed,
      speed: MOVEMENT_TUNING.baseSpeed,
      weaponId: 'wooden_kentungan_bat',
      weaponTier: 1,
      powerTier: 1,
      comboBeat: 0, // Cycles 1 ("TUNG!") -> 2 ("TUNG! TUNG!") -> 3 ("TUNG! TUNG! TUNG! SAHUR!")
      comboCount: 0,
      latteBoostTimer: 0,
      helmet: false,
      speedBoots: false,
      starCape: false,
      crown: false,
      shieldHearts: 3,
      maxShieldHearts: 3,
      starGems: 0,
      potSeeds: 0,
      freeSpins: 0,
      state: 'idle', // 'idle' | 'walking' | 'swinging' | 'boinging' | 'celebrating'
      swingCooldown: 0,
      path: [],
      target: null,
      boingArc: null,
    },

    stickThrow: {
      active: false,
      phase: 'idle', // 'idle' | 'outbound' | 'hover' | 'returning'
      weaponId: 'wooden_kentungan_bat',
      x: HUB_LAYOUT.spawn.x,
      y: HUB_LAYOUT.spawn.y + 0.92,
      z: HUB_LAYOUT.spawn.z,
      startX: HUB_LAYOUT.spawn.x,
      startY: HUB_LAYOUT.spawn.y + 0.92,
      startZ: HUB_LAYOUT.spawn.z,
      apexX: HUB_LAYOUT.spawn.x,
      apexY: HUB_LAYOUT.spawn.y + 0.92,
      apexZ: HUB_LAYOUT.spawn.z - 6.2,
      dirX: 0,
      dirZ: -1,
      range: 6.2,
      spinAngle: 0,
      distFromHero: 0,
      maxDistReached: 0,
      elapsed: 0,
      hits: 0,
      hitCount: 0,
      hitTargets: [],
      throwCount: 0,
      returnCount: 0,
    },

    blocksBroken: 0,
    luckyBlocksCount: 0,

    flowerpots: pads,
    totems: pads,

    trophies: [],

    roulette: {
      open: false,
      spinning: false,
      spinTimer: 0,
      spinDuration: 2.4,
      spinCost: ROULETTE_COSTS[0],
      selectedWeaponId: null,
      spinsCount: 0,
    },

    feedback: {
      taps: 0,
      deadTaps: 0,
      boings: 0,
      bonks: 0,
      drumSwings: 0,
      comboShockwaves: 0,
      chestsOpened: 0,
      crittersPetted: 0,
      jumps: 0,
      stickThrows: 0,
      stickHits: 0,
      stickReturns: 0,
      dropTypesSeen: [],
    },

    perf: {
      playStartMs: 0,
      drawCalls: 0,
      triangles: 0,
      maxMetalness: 0,
      cameraRoll: 0,
    },
  };
}

export function recalcPlayerStats(state) {
  const p = state.player;
  p.weaponId = resolveWeaponId(p.weaponId);
  const wpn = WEAPONS[p.weaponId] || WEAPONS.wooden_kentungan_bat;
  p.weaponTier = wpn.tier;
  // Power tier follows weaponTier (1..5), with Golden Crescent Crown (helmet) guaranteeing >= Tier 2
  p.powerTier = Math.max(1, Math.min(5, Math.max(wpn.tier, p.helmet ? 2 : 1)));

  // Any of Blue Sneaker Speed Boots, Golden Crescent Crown (helmet), Ballerina Cappuccina Cottage (pad 0 >= 1), or Latte Boost reaches 10.8 blocks/s!
  const hasCappuccinaLatteZoom = Boolean(
    (p.latteBoostTimer && p.latteBoostTimer > 0) ||
      (Array.isArray(state.flowerpots) && (state.flowerpots[0]?.tier || 0) >= 2)
  );
  if (p.speedBoots || p.helmet || hasCappuccinaLatteZoom) {
    p.speed = MOVEMENT_TUNING.bootsSpeed; // 10.8 blocks/s
  } else {
    p.speed = MOVEMENT_TUNING.baseSpeed; // 8.5 blocks/s
  }

  if (p.speedBoots || p.helmet) {
    p.maxShieldHearts = Math.max(5, p.maxShieldHearts);
    p.shieldHearts = Math.max(p.shieldHearts, 5);
  }

  p.crown = Boolean(p.helmet || state.trophies.length >= 4);
  const costIdx = Math.min(state.roulette.spinsCount, ROULETTE_COSTS.length - 1);
  state.roulette.spinCost = p.freeSpins > 0 ? 0 : ROULETTE_COSTS[costIdx];
  return p;
}
