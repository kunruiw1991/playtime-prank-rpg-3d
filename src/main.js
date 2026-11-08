// Master Entry & Integration Orchestrator for Lucky Block Titans 3D (owner: lucky-director).
// Zero-build ES2022 module wiring Three.js r170 world, characters, loot/economy, neural VO, UI, and seam.

import * as THREE from '../vendor/three.module.min.js';
import {
  HUB_LAYOUT,
  MOVEMENT_TUNING,
  TITAN_ORDER,
  TITANS,
  WEAPONS,
  resolveBossId,
  resolveWeaponId,
} from './data/catalog.js';
import { createRng } from './core/rng.js';
import {
  applySavedRunToState,
  createGameState,
  hasSavedRun,
  loadPrefs,
  loadSavedRun,
  recalcPlayerStats,
  savePrefs,
  saveRunSnapshot,
} from './core/state.js';
import { createSceneContext, enforceMaterialGuardrails } from './core/scene.js';
import { createCameraController } from './core/camera.js';
import { createInputController } from './core/input.js';
import { createLoop } from './core/loop.js';
import { installSeam } from './core/seam.js';
import { createAudioManager } from './fx/audio.js';
import { createMusic } from './fx/music.js';
import { createSfx } from './fx/sfx.js';
import { createVoice } from './fx/voice.js';
import { createParticles } from './fx/particles.js';
import { createWorld } from './world/world.js';
import * as props3d from './chars/props3d.js';
import { createHero } from './chars/hero.js';
import { createCritterManager } from './chars/critters.js';
import { createTitanManager } from './chars/titans.js';
import { createPickupManager } from './game/pickups.js';
import { createFlowerpotSystem } from './game/flowerpots.js';
import { createRouletteSystem } from './game/roulette.js';
import { createCombatSystem } from './game/combat.js';
import { createLootDirector } from './game/loot_director.js';
import { createUI } from './ui/hud.js';

function parseInitialSeed() {
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('seed');
      if (raw !== null && raw !== '') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          return (parsed >>> 0) || 2026;
        }
      }
    }
  } catch (_err) {
    // Ignore malformed query params.
  }
  return 2026;
}

function bootLuckyBlockTitans() {
  const canvas =
    document.getElementById('game-canvas') || document.querySelector('canvas');
  if (!canvas) {
    throw new Error('Missing #game-canvas element in index.html');
  }

  const initialSeed = parseInitialSeed();
  const initialPrefs = loadPrefs();

  let rng = createRng(initialSeed);
  let state = createGameState({
    seed: initialSeed,
    chaosMode: initialPrefs.chaosMode,
    mode: 'title',
  });

  const sceneCtx = createSceneContext(canvas);
  const cameraCtrl = createCameraController();
  cameraCtrl.onResize(window.innerWidth || 1280, window.innerHeight || 800);

  const audio = createAudioManager();
  const music = createMusic(audio);
  const sfx = createSfx(audio);
  const voice = createVoice(audio, {
    onSubtitleTap: () => {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
    },
  });
  const particles = createParticles(sceneCtx.scene);

  // Shared context passed across world, characters, gameplay systems, and UI.
  const ctx = {
    canvas,
    scene: sceneCtx.scene,
    camera: cameraCtrl.camera,
    renderer: sceneCtx.renderer,
    isSoftwareGpu: Boolean(sceneCtx.isSoftwareGpu),
    get state() {
      return state;
    },
    set state(next) {
      state = next;
    },
    get rng() {
      return rng;
    },
    recalcStats: recalcPlayerStats,
    audio,
    music,
    sfx,
    voice,
    particles,
    props3d,
    buildWeaponMesh: props3d.buildWeaponMesh,
    buildFlowerpotMesh: props3d.buildFlowerpotMesh,
    buildTrophyMesh: props3d.buildTrophyMesh,
    renderWeaponIconDataURL: props3d.renderWeaponIconDataURL,
    world: null,
    hero: null,
    critters: null,
    titans: null,
    pickups: null,
    flowerpots: null,
    roulette: null,
    combat: null,
    lootDirector: null,
    ui: null,
    bossBanner: null,
    actions: {},
    onTitanSpawn(titanObj) {
      music.setMood('titan');
      cameraCtrl.triggerHop(0.08);
      refreshMaterialGuardrails();
      return titanObj;
    },
    onTitanDefeated(_titanId, trophies) {
      worldDirty = true;
      const best = Math.max(loadPrefs().bestTrophies || 0, trophies.length);
      if (best >= 4) {
        music.setMood('victory');
      } else if (!titans.getActive()) {
        music.setMood('island');
      }
      cameraCtrl.triggerHop(0.11);
      refreshMaterialGuardrails();
      saveRunSnapshot(state);
    },
    onVictory() {
      music.setMood('victory');
      victoryFireworkTimer = 0.25;
      // Place crowned hero right in front of the 4-Pedestal Golden Trophy Stage for grand celebration!
      const stageFront = world.clampToWalkable(0, -4.4);
      state.player.x = stageFront.x;
      state.player.y = stageFront.y;
      state.player.z = stageFront.z;
      state.player.vx = 0;
      state.player.vz = 0;
      state.player.yaw = 0;
      state.player.path = [];
      state.player.target = null;
      particles.spawnVictoryFireworks(-2.6, 6.8, -7.2);
      particles.spawnVictoryFireworks(2.6, 7.1, -7.2);
      sceneCtx.renderer.shadowMap.needsUpdate = true;
      saveRunSnapshot(state);
    },
    onPickupCollected() {
      worldDirty = true;
      saveRunSnapshot(state);
    },
    onPotChanged() {
      worldDirty = true;
      refreshMaterialGuardrails();
      saveRunSnapshot(state);
    },
    onRouletteFinish() {
      if (!state.roulette?.open) {
        world.setChestOpen(false);
      }
      refreshMaterialGuardrails();
      saveRunSnapshot(state);
    },
  };

  const world = createWorld(ctx);
  ctx.world = world;
  world.reset(initialSeed);

  const hero = createHero(ctx);
  ctx.hero = hero;

  const critters = createCritterManager(ctx);
  ctx.critters = critters;

  const titans = createTitanManager(ctx);
  ctx.titans = titans;

  const pickups = createPickupManager(ctx);
  ctx.pickups = pickups;

  const flowerpots = createFlowerpotSystem(ctx);
  ctx.flowerpots = flowerpots;

  const roulette = createRouletteSystem(ctx);
  ctx.roulette = roulette;

  const combat = createCombatSystem(ctx);
  ctx.combat = combat;

  const lootDirector = createLootDirector(ctx);
  ctx.lootDirector = lootDirector;

  let victoryFireworkTimer = 0;
  let autoPatCooldown = 0;
  let worldDirty = false;
  const tapRaycaster = new THREE.Raycaster();
  const tapNdcVec = new THREE.Vector2();

  function refreshMaterialGuardrails() {
    const maxMet = enforceMaterialGuardrails(sceneCtx.scene);
    if (state?.perf) {
      state.perf.maxMetalness = Number(maxMet.toFixed(3));
    }
    return maxMet;
  }

  function syncHeroToSpawn() {
    const sp = HUB_LAYOUT.spawn;
    const clamped = world.clampToWalkable(sp.x, sp.z);
    const groundY = Number.isFinite(clamped.y) ? clamped.y : sp.y;
    state.player.x = clamped.x;
    state.player.y = groundY;
    state.player.groundY = groundY;
    state.player.jumpY = 0;
    state.player.z = clamped.z;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
    state.player.grounded = true;
    state.player.airborne = false;
    state.player.jumping = false;
    state.player.jumpApexY = groundY;
    state.player.landSquashTimer = 0;
    state.player.yaw = Math.PI;
    state.player.state = 'idle';
    state.player.path = [];
    state.player.target = null;
    state.player.boingArc = null;
    state.player.swingCooldown = 0;
    if (state.stickThrow) {
      state.stickThrow.active = false;
      state.stickThrow.phase = 'idle';
      state.stickThrow.weaponId = resolveWeaponId(state.player.weaponId);
      state.stickThrow.x = state.player.x;
      state.stickThrow.y = state.player.y + 0.92;
      state.stickThrow.z = state.player.z;
      state.stickThrow.distFromHero = 0;
      state.stickThrow.spinAngle = 0;
      state.stickThrow.elapsed = 0;
      state.stickThrow.hitTargets = [];
    }
    combat.syncPlayerStats();
    hero.update(0, 0, {
      x: state.player.x,
      y: state.player.y,
      groundY: state.player.groundY,
      z: state.player.z,
      yaw: state.player.yaw,
      vy: 0,
      jumping: false,
      landSquash: 0,
      speedRatio: 0,
      swinging: false,
      boinging: false,
      stickProjectile: state.stickThrow,
    });
  }

  function isDirectLineClear(sx, sz, tx, tz) {
    const dx = tx - sx;
    const dz = tz - sz;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.45) return true;

    const steps = Math.max(2, Math.ceil(dist / 0.45));
    let prevY = world.getGroundY(sx, sz);
    if (!Number.isFinite(prevY) || prevY < -20) return false;

    for (let i = 1; i <= steps; i += 1) {
      const u = i / steps;
      const px = sx + dx * u;
      const pz = sz + dz * u;
      const gy = world.getGroundY(px, pz);
      if (!Number.isFinite(gy) || gy < -20) return false;
      if (Math.abs(gy - prevY) > 0.65) return false;
      prevY = gy;

      // Allow approaching the final 0.85b of a targeted block/prop without self-blocking.
      if (dist - dist * u > 0.85) {
        const blocker = world.getBreakableAt(px, gy, pz, 0.56);
        if (blocker && !blocker.broken) {
          return false;
        }
      }
    }
    return true;
  }

  function assignWalkPath(tx, tz) {
    const clamped = world.clampToWalkable(tx, tz);
    const p = state.player;
    if (isDirectLineClear(p.x, p.z, clamped.x, clamped.z)) {
      p.path = [{ x: clamped.x, y: clamped.y, z: clamped.z }];
      return clamped;
    }

    const found = world.findPath(p.x, p.z, clamped.x, clamped.z);
    if (Array.isArray(found) && found.length > 0) {
      // Drop starting cell if hero is already standing inside it.
      const trimmed =
        found.length > 1 &&
        Math.hypot(found[0].x - p.x, found[0].z - p.z) < 0.45
          ? found.slice(1)
          : found.slice();
      trimmed[trimmed.length - 1] = {
        x: clamped.x,
        y: clamped.y,
        z: clamped.z,
      };
      p.path = trimmed;
    } else {
      p.path = [{ x: clamped.x, y: clamped.y, z: clamped.z }];
    }
    return clamped;
  }

  function computeMineDamage(block) {
    // Starter Rainbow Block pops in 1 joyful tap or Space swing!
    if (block?.isStarter) {
      return Math.max(20, Number(block?.maxHp) || 20);
    }
    // 2x2x2 Mega Titan Mystery Blocks always take 5 juicy hits (1.7s escalating tremor anticipation!)
    if (block?.isMegaTitan) {
      return 10;
    }
    const wpn = WEAPONS[resolveWeaponId(state.player.weaponId)] || WEAPONS.wooden_kentungan_bat;
    const hitsNeeded = block?.isTough
      ? Math.max(1, Number(wpn.mineHitsTough) || 1)
      : Math.max(1, Number(wpn.mineHitsNormal) || 1);
    const maxHp = Math.max(10, Number(block?.maxHp) || 20);
    return Math.ceil(maxHp / hitsNeeded);
  }

  function advanceDrumCombo(originX, originY, originZ, { fromSeam = false, showAirWord = false } = {}) {
    const p = state.player;
    const currentBeat = Math.max(1, Math.min(3, Number(p.comboBeat) || 1));
    const ox = Number.isFinite(originX) ? originX : p.x;
    const oy = Number.isFinite(originY) ? originY : p.y;
    const oz = Number.isFinite(originZ) ? originZ : p.z;

    if (currentBeat === 1) {
      particles.spawnTapRipple(ox, oy + 0.08, oz, 0xffd43b);
      if (showAirWord) {
        ui.spawnComicBurst('TUNG!', ox, oy + 1.9, oz, '#ffd43b');
      }
      p.comboBeat = 2;
      return { beat: 1, shockwave: false };
    }

    if (currentBeat === 2) {
      particles.spawnTapRipple(ox, oy + 0.08, oz, 0xff922b);
      particles.spawnStarSparkles(ox, oy + 0.7, oz, '#ffd43b', 6);
      if (showAirWord) {
        ui.spawnComicBurst('TUNG! TUNG!', ox, oy + 2.0, oz, '#ff922b');
      }
      p.comboBeat = 3;
      return { beat: 2, shockwave: false };
    }

    // Beat 3: "TUNG! TUNG! TUNG! SAHUR!" giant rainbow shockwave (r = 4.0 blocks)!
    p.comboBeat = 1;
    state.feedback.combosCompleted = (Number(state.feedback.combosCompleted) || 0) + 1;
    particles.spawnTapRipple(ox, oy + 0.1, oz, 0x39d5ff);
    particles.spawnLuckyBurst(ox, oy + 0.75, oz);
    if (showAirWord) {
      ui.spawnComicBurst('TUNG! SAHUR!', ox, oy + 2.2, oz, '#39d5ff');
    }
    if (!fromSeam && (Number(state.feedback.combosCompleted) || 0) % 4 === 1) {
      voice.speak('sahur_combo_3', { priority: 'ifIdle' });
    }
    return { beat: 3, shockwave: true, radius: MOVEMENT_TUNING.comboShockwaveRadius || 4.0 };
  }

  function applyBlockHitAndLoot(block, damage, { fromSeam = false } = {}) {
    if (!block || block.broken) {
      return { hit: false, broken: false };
    }
    worldDirty = true;

    // Sleeping Mega Block gate: later Bosses wake in sequence once the previous Boss trophy is won!
    // (Under-geared curious pokes STILL wake the Boss for a funny Cloud Boing!)
    if (block.isMegaTitan && !fromSeam && damage < 500) {
      const canonicalTitanId = resolveBossId(block.titanId);
      const spec = TITANS[canonicalTitanId];
      const tIdx = TITAN_ORDER.indexOf(canonicalTitanId);
      const powerTier = Number(state.player?.powerTier) || 1;
      if (spec && tIdx > 0 && powerTier >= spec.requiredTier) {
        const hasPrev = state.trophies.some((id) => resolveBossId(id) === TITAN_ORDER[tIdx - 1]);
        const prevTrophy =
          hasPrev &&
          (canonicalTitanId !== 'golden_sahur_king' || (Number(state.time) || 0) >= 246);
        if (!prevTrophy) {
          block.sleepPokes = (Number(block.sleepPokes) || 0) + 1;
          block.hitFlash = 0.7;
          hero.triggerSwing();
          state.player.swingCooldown = MOVEMENT_TUNING.swingIntervalSec;
          sfx.blockHit(0);
          particles.spawnBlockBurst(block.x, block.y + 1.0, block.z, 0x74c0fc, 8);
          ui.spawnComicBurst(
            'ZZZ! NEXT BOSS!',
            block.x,
            block.y + 2.4,
            block.z,
            '#74c0fc'
          );
          voice.speak('fairy_need_stars', { priority: 'ifIdle' });
          if (block.sleepPokes % 3 === 0 && (Number(block.sleepGemDrops) || 0) < 4) {
            block.sleepGemDrops = (Number(block.sleepGemDrops) || 0) + 1;
            pickups.spawn(
              {
                id: 'star_gem_small',
                gems: 2,
                label: '+2 STARS!',
                color: '#ffd43b',
                voId: null,
              },
              block.x,
              block.y + 1.2,
              block.z,
              { horizSpeed: 2.0, vy: 4.8, magnetDelay: 0.1, silentVo: true, source: 'block' }
            );
          }
          if (block.sleepPokes >= 2 && state.player.target?.key === block.key) {
            state.player.target = null;
          }
          return { hit: true, broken: false, sleeping: true };
        }
      }
    }

    const res = world.hitBlock(block.key, damage);
    if (!res.hit) return res;

    hero.triggerSwing();
    state.player.swingCooldown = MOVEMENT_TUNING.swingIntervalSec;
    advanceDrumCombo(block.x, block.y, block.z, { fromSeam, showAirWord: false });

    if (res.broken) {
      state.blocksBroken = (Number(state.blocksBroken) || 0) + 1;
      sfx.blockBreak();
      if (block.isLucky || block.isStarter) {
        particles.spawnLuckyBurst(block.x, block.y + 0.6, block.z);
      } else {
        particles.spawnBlockBurst(block.x, block.y + 0.5, block.z, 0xffd43b, 14);
      }
      cameraCtrl.triggerHop(block.isMegaTitan ? 0.09 : 0.04);
      const targetBlock = res.block || block;
      targetBlock.fromSeam = Boolean(fromSeam);
      const lootRes = lootDirector.onBlockBroken(targetBlock);
      targetBlock.fromSeam = false;
      // When digging a block pops a Surprise Titan right in front of the swinging hero,
      // auto-engage the Titan so the goofy over-tier Rainbow Cloud Boing triggers naturally!
      if (!fromSeam && !block.isMegaTitan && lootRes?.spawnedTitanId) {
        const liveT = titans.getTitan(lootRes.spawnedTitanId);
        state.player.target = {
          kind: 'titan',
          titanId: lootRes.spawnedTitanId,
          x: liveT ? liveT.x : block.x,
          z: liveT ? liveT.z : block.z,
        };
      }
      refreshMaterialGuardrails();
      saveRunSnapshot(state);
    } else if (block.isMegaTitan) {
      const hitStep = Math.min(4, Math.max(0, Math.round((block.maxHp - (res.block?.hp ?? block.hp)) / 10)));
      sfx.blockHit(hitStep);
      sfx.titanTremor?.();
      cameraCtrl.triggerHop(0.03 + hitStep * 0.01);
      particles.spawnBlockBurst(block.x, block.y + 1.0, block.z, 0xffe066, 10);
    } else {
      sfx.blockHit(0);
      particles.spawnBlockBurst(block.x, block.y + 0.5, block.z, 0xfff3bf, 6);
    }
    return res;
  }

  function executeCritterPat(critterIdOrObj) {
    const petRes = critters.pet(critterIdOrObj);
    if (!petRes) return null;

    state.feedback.crittersPetted = (Number(state.feedback.crittersPetted) || 0) + 1;
    hero.triggerCheer();
    sfx.critterHappy();
    particles.spawnStarSparkles(petRes.x, petRes.y + 0.9, petRes.z, '#ff6b9d', 12);
    if (petRes.voId) {
      voice.speak(petRes.voId, { priority: 'ifIdle' });
    }

    const patIndex = Number(state.feedback.crittersPetted) || 1;
    const totalBonus =
      patIndex === 1
        ? Math.max(4, Number(petRes.bonusGems) || 4)
        : patIndex === 2
          ? 1
          : 0;
    const immediateGems = Math.ceil(totalBonus * 0.5);
    const dropGems = totalBonus - immediateGems;
    if (immediateGems > 0) {
      state.player.starGems = (Number(state.player.starGems) || 0) + immediateGems;
    }

    if (dropGems > 0) {
      pickups.spawn(
        {
          id: 'star_gem_small',
          gems: dropGems,
          label: `+${totalBonus} STARS!`,
          color: '#ffd43b',
          voId: null,
        },
        petRes.x,
        petRes.y + 0.5,
        petRes.z,
        {
          horizSpeed: 1.1,
          vy: 4.0,
          magnetDelay: 0.04,
          silentVo: true,
          source: 'critter_pat',
        }
      );
    }
    return petRes;
  }

  function openRouletteInteractive() {
    if (state.mode === 'title') return null;
    ui.openRoulette();
    return roulette.getSnapshot();
  }

  function plantPotAction(padIdx = null) {
    const res = flowerpots.plantOrUpgrade(padIdx);
    if (res?.ok) {
      cameraCtrl.triggerHop(0.05);
    }
    return res;
  }

  function resolveWorldTap(rawX, rawZ, { fromCanvas = false } = {}) {
    if (state.mode === 'title') {
      startGame({ seed: state.seed, chaosMode: state.chaosMode });
    } else if (state.mode === 'roulette' && !state.roulette?.spinning && !fromCanvas) {
      ui.closeRoulette();
    } else if (state.mode === 'paused' && !fromCanvas) {
      ui.closePause();
    }

    state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;

    const x = Number.isFinite(rawX) ? rawX : 0;
    const z = Number.isFinite(rawZ) ? rawZ : 0;
    const p = state.player;
    if (p.boingArc?.active) {
      return { ok: true, kind: 'boinging' };
    }

    // 1. Active Giant Titan within generous tap radius
    const nearTitan = titans.findNear(x, z, 3.6);
    if (nearTitan && nearTitan.active && !nearTitan.defeated) {
      p.target = {
        kind: 'titan',
        titanId: nearTitan.id || nearTitan.titanId,
        x: nearTitan.x,
        z: nearTitan.z,
      };
      assignWalkPath(nearTitan.x, nearTitan.z);
      particles.spawnTapRipple(nearTitan.x, nearTitan.y + 0.06, nearTitan.z, 0xffd43b);
      return { ok: true, kind: 'titan', titanId: p.target.titanId };
    }

    // 2. Giant Golden Mystery Roulette Chest in Hub
    const chestPos = HUB_LAYOUT.rouletteChest;
    if (Math.hypot(x - chestPos.x, z - chestPos.z) <= 1.85) {
      const standZ = chestPos.z + 1.45;
      p.target = {
        kind: 'chest',
        openModalOnArrive: Boolean(fromCanvas),
        x: chestPos.x,
        z: standZ,
      };
      assignWalkPath(chestPos.x, standZ);
      particles.spawnTapRipple(chestPos.x, chestPos.y + 0.05, chestPos.z, 0xffd43b);
      sfx.tapGround();
      return { ok: true, kind: 'chest' };
    }

    // 3. Hub Magic Flowerpot Pads
    for (const pad of HUB_LAYOUT.flowerpotPads) {
      if (Math.hypot(x - pad.x, z - pad.z) <= 1.45) {
        p.target = {
          kind: 'pad',
          padIdx: pad.padIdx,
          triggerPlantOnArrive: Boolean(fromCanvas),
          x: pad.x,
          z: pad.z,
        };
        assignWalkPath(pad.x, pad.z);
        particles.spawnTapRipple(pad.x, pad.y + 0.05, pad.z, 0x51cf66);
        sfx.tapGround();
        return { ok: true, kind: 'pad', padIdx: pad.padIdx };
      }
    }

    // 4 & 5. Unbroken Breakable Block / Mega Titan Block vs Bouncy Island Critter
    // Prefer direct block taps (<= 1.25 blocks or closer than critter) so wandering critters never hijack mining!
    const nearCritter = critters.findNear(x, z, 2.55);
    const nearBlock = world.getBreakableAt(x, NaN, z, 1.85);
    const hasBlock = Boolean(nearBlock && !nearBlock.broken);
    const dBlock = hasBlock ? Math.hypot(x - nearBlock.x, z - nearBlock.z) : Infinity;
    const dCritter = nearCritter ? Math.hypot(x - nearCritter.x, z - nearCritter.z) : Infinity;

    if (hasBlock && (dBlock <= 1.25 || dBlock <= dCritter)) {
      p.target = {
        kind: 'block',
        key: nearBlock.key,
        x: nearBlock.x,
        y: nearBlock.y,
        z: nearBlock.z,
      };
      assignWalkPath(nearBlock.x, nearBlock.z);
      particles.spawnTapRipple(nearBlock.x, nearBlock.y + 0.05, nearBlock.z, 0xffd43b);
      sfx.tapGround();
      return { ok: true, kind: 'block', key: nearBlock.key };
    }

    if (nearCritter) {
      p.target = {
        kind: 'critter',
        id: nearCritter.id,
        x: nearCritter.x,
        z: nearCritter.z,
      };
      assignWalkPath(nearCritter.x, nearCritter.z);
      particles.spawnTapRipple(nearCritter.x, nearCritter.y + 0.05, nearCritter.z, 0xff6b9d);
      sfx.tapGround();
      return { ok: true, kind: 'critter', id: nearCritter.id };
    }

    // 6. Walkable Island Ground (or clamped ocean/cliff tap -> 0 dead taps!)
    const clamped = assignWalkPath(x, z);
    p.target = {
      kind: 'ground',
      x: clamped.x,
      y: clamped.y,
      z: clamped.z,
    };
    particles.spawnTapRipple(clamped.x, clamped.y + 0.05, clamped.z, 0x39d5ff);
    sfx.tapGround();
    return { ok: true, kind: 'ground', target: clamped };
  }

  function handleCanvasTap({ ndcX, ndcY }) {
    if (state.mode !== 'playing') return;
    if (ui.isAnyOverlayOpen(state)) return;

    cameraCtrl.camera.updateMatrixWorld();
    tapNdcVec.set(ndcX, ndcY);
    tapRaycaster.setFromCamera(tapNdcVec, cameraCtrl.camera);

    const titanHit = titans.raycast(tapRaycaster);
    if (titanHit && titanHit.titanId) {
      const t = titans.getTitan(titanHit.titanId);
      if (t && t.active && !t.defeated) {
        resolveWorldTap(t.x, t.z, { fromCanvas: true });
        return;
      }
    }

    const critterHit = critters.raycast(tapRaycaster);
    if (critterHit && critterHit.critter) {
      resolveWorldTap(critterHit.critter.x, critterHit.critter.z, { fromCanvas: true });
      return;
    }

    const worldHit = world.raycastTap(ndcX, ndcY, cameraCtrl.camera);
    if (worldHit) {
      if (worldHit.kind === 'chest') {
        resolveWorldTap(HUB_LAYOUT.rouletteChest.x, HUB_LAYOUT.rouletteChest.z, {
          fromCanvas: true,
        });
      } else if (worldHit.kind === 'pad' && worldHit.target) {
        resolveWorldTap(worldHit.target.x, worldHit.target.z, { fromCanvas: true });
      } else if (worldHit.kind === 'block' && worldHit.target) {
        resolveWorldTap(worldHit.target.x, worldHit.target.z, { fromCanvas: true });
      } else if (worldHit.target) {
        resolveWorldTap(worldHit.target.x, worldHit.target.z, { fromCanvas: true });
      }
    }
  }

  function swingDrum(opts = {}) {
    if (state.mode === 'title') {
      startGame({ seed: state.seed, chaosMode: state.chaosMode });
      return { ok: true, kind: 'started' };
    }
    if (state.mode !== 'playing' || state.player.boingArc?.active) {
      return { ok: false, reason: 'busy' };
    }
    if (!opts.fromHold) {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
    }
    state.feedback.drumSwings = (Number(state.feedback.drumSwings) || 0) + 1;

    // When triggered from the HUD BONK! button or action key, also launch the Odyssey-style returning Sahur stick if idle!
    if ((opts.fromButton || opts.fromKey) && !opts.fromHold && !state.stickThrow?.active) {
      throwStick({ fromDrum: true, fromButton: opts.fromButton, fromKey: opts.fromKey });
    }

    const p = state.player;
    const nearTitan = titans.findNear(p.x, p.z, MOVEMENT_TUNING.titanMeleeRange + 0.8);
    if (nearTitan && nearTitan.active && !nearTitan.defeated) {
      advanceDrumCombo(nearTitan.x, nearTitan.y, nearTitan.z, { fromSeam: false, showAirWord: false });
      return combat.bonkTitan(nearTitan.id || nearTitan.titanId);
    }

    const nearBlock = world.getBreakableAt(p.x, p.groundY ?? p.y, p.z, MOVEMENT_TUNING.interactRange + 0.45);
    if (nearBlock && !nearBlock.broken) {
      p.yaw = Math.atan2(nearBlock.x - p.x, nearBlock.z - p.z);
      return applyBlockHitAndLoot(nearBlock, computeMineDamage(nearBlock));
    }

    if (!opts.fromHold) {
      const nearCritter = critters.findNear(p.x, p.z, 2.5);
      if (nearCritter) {
        return executeCritterPat(nearCritter.id);
      }

      for (const pad of HUB_LAYOUT.flowerpotPads) {
        if (Math.hypot(p.x - pad.x, p.z - pad.z) <= 2.35 && flowerpots.canPlantOrUpgrade(pad.padIdx)) {
          return plantPotAction(pad.padIdx);
        }
      }

      if (
        Math.hypot(
          p.x - HUB_LAYOUT.rouletteChest.x,
          p.z - HUB_LAYOUT.rouletteChest.z
        ) <= 2.6
      ) {
        return openRouletteInteractive();
      }
    }

    hero.triggerSwing();
    state.player.swingCooldown = MOVEMENT_TUNING.swingIntervalSec;
    sfx.swing();
    const combo = advanceDrumCombo(p.x, p.y, p.z, { fromSeam: false, showAirWord: true });
    return { ok: true, kind: 'air_swing', beat: combo.beat, shockwave: combo.shockwave };
  }

  function triggerJump(opts = {}) {
    if (state.mode === 'title') {
      startGame({ seed: state.seed, chaosMode: state.chaosMode });
    }
    if (state.mode !== 'playing' || state.player.boingArc?.active) {
      return { ok: false, reason: 'busy' };
    }
    if (!opts.fromSeam) {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
    }

    const p = state.player;
    if (!Number.isFinite(p.groundY)) {
      const gy = world.getGroundY(p.x, p.z);
      p.groundY = Number.isFinite(gy) && gy > -20 ? gy : p.y;
    }

    if (!p.jumping && p.grounded !== false) {
      p.vy = Number(opts.velocity) > 0 ? Number(opts.velocity) : (MOVEMENT_TUNING.jumpVelocity || 11.5);
      p.jumping = true;
      p.grounded = false;
      p.airborne = true;
      p.jumpCount = (Number(p.jumpCount) || 0) + 1;
      p.jumpApexY = Math.max(Number(p.jumpApexY) || p.groundY, p.y);
      p.landSquashTimer = 0;
      p.state = 'jumping';
      state.feedback.jumps = (Number(state.feedback.jumps) || 0) + 1;

      hero.triggerJump?.();
      sfx.jump?.();
      particles.spawnTapRipple(p.x, p.groundY + 0.05, p.z, 0x66d9e8);
      particles.spawnStarSparkles(p.x, p.groundY + 0.25, p.z, '#66d9e8', 8);
      ui.spawnComicBurst(
        p.jumpCount % 2 === 1 ? 'YAHOO!' : 'JUMP!',
        p.x,
        p.y + 1.85,
        p.z,
        '#66d9e8'
      );
      return {
        ok: true,
        kind: 'jump',
        jumpCount: p.jumpCount,
        vy: p.vy,
        groundY: p.groundY,
      };
    }

    // Mid-air press of JUMP! button or Space/KeyJ/KeyZ launches the Odyssey Sahur Stick if not already in flight!
    if ((opts.fromButton || opts.fromKey || opts.allowAirThrow) && !state.stickThrow?.active) {
      const throwRes = throwStick({
        fromAirJump: true,
        fromButton: opts.fromButton,
        fromKey: opts.fromKey,
      });
      return {
        ...throwRes,
        kind: 'air_stick_throw',
      };
    }

    return { ok: false, reason: 'airborne', jumping: true };
  }

  function throwStick(opts = {}) {
    if (state.mode === 'title') {
      startGame({ seed: state.seed, chaosMode: state.chaosMode });
    }
    if (state.mode !== 'playing' || state.player.boingArc?.active) {
      return { ok: false, reason: 'busy' };
    }
    const st = state.stickThrow;
    if (!st) {
      return { ok: false, reason: 'no_state' };
    }
    if (st.active) {
      return { ok: false, reason: 'already_active', phase: st.phase };
    }

    if (!opts.fromSeam && !opts.fromDrum && !opts.fromAirJump) {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
    }

    const p = state.player;
    let dirX = Math.sin(Number(p.yaw) || 0);
    let dirZ = Math.cos(Number(p.yaw) || 0);

    if (Number.isFinite(opts.targetX) && Number.isFinite(opts.targetZ)) {
      const dx = Number(opts.targetX) - p.x;
      const dz = Number(opts.targetZ) - p.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-4) {
        dirX = dx / len;
        dirZ = dz / len;
        p.yaw = Math.atan2(dirX, dirZ);
      }
    } else if (Number.isFinite(opts.dirX) && Number.isFinite(opts.dirZ)) {
      const dx = Number(opts.dirX);
      const dz = Number(opts.dirZ);
      const len = Math.hypot(dx, dz);
      if (len > 1e-4) {
        dirX = dx / len;
        dirZ = dz / len;
        p.yaw = Math.atan2(dirX, dirZ);
      }
    } else if (Number.isFinite(opts.yaw)) {
      p.yaw = Number(opts.yaw);
      dirX = Math.sin(p.yaw);
      dirZ = Math.cos(p.yaw);
    } else {
      const dLen = Math.hypot(dirX, dirZ);
      if (dLen > 1e-4) {
        dirX /= dLen;
        dirZ /= dLen;
      } else {
        dirX = 0;
        dirZ = -1;
      }
    }

    const range = Math.max(
      2.5,
      Math.min(10.0, Number(opts.range) || MOVEMENT_TUNING.stickThrowRange || 6.2)
    );
    const handY = p.y + 0.92;

    st.active = true;
    st.phase = 'outbound';
    st.weaponId = resolveWeaponId(p.weaponId || 'wooden_kentungan_bat');
    st.startX = p.x;
    st.startY = handY;
    st.startZ = p.z;
    st.x = p.x + dirX * 0.45;
    st.y = handY;
    st.z = p.z + dirZ * 0.45;
    st.dirX = dirX;
    st.dirZ = dirZ;
    st.range = range;
    st.apexX = p.x + dirX * range;
    st.apexY = handY + 0.08;
    st.apexZ = p.z + dirZ * range;
    st.spinAngle = 0;
    st.distFromHero = Math.hypot(st.x - p.x, st.z - p.z);
    if (st.distFromHero > (Number(st.maxDistReached) || 0)) {
      st.maxDistReached = st.distFromHero;
    }
    st.elapsed = 0;
    st.hitTargets = [];
    st.throwCount = (Number(st.throwCount) || 0) + 1;

    state.feedback.stickThrows = (Number(state.feedback.stickThrows) || 0) + 1;

    hero.triggerSwing();
    p.swingCooldown = MOVEMENT_TUNING.swingIntervalSec;
    if (hero.weaponSocket) hero.weaponSocket.visible = false;
    if (hero.thrownStickGroup) {
      hero.thrownStickGroup.visible = true;
      hero.thrownStickGroup.position.set(st.x, st.y, st.z);
    }

    sfx.stickThrow?.();
    particles.spawnStarSparkles(st.x, st.y, st.z, '#ffd43b', 10);
    ui.spawnComicBurst('TUNG! THROW!', p.x, p.y + 1.95, p.z, '#ffd43b');

    return {
      ok: true,
      phase: st.phase,
      weaponId: st.weaponId,
      throwCount: st.throwCount,
      apexX: Number(st.apexX.toFixed(3)),
      apexZ: Number(st.apexZ.toFixed(3)),
    };
  }

  function sweepStickCollisions(prevX, prevY, prevZ, curX, curY, curZ) {
    const st = state.stickThrow;
    const p = state.player;
    if (!st || !st.active) return;

    const samples = [0.5, 1.0];
    for (let sIdx = 0; sIdx < samples.length; sIdx += 1) {
      const u = samples[sIdx];
      const sx = prevX + (curX - prevX) * u;
      const sy = prevY + (curY - prevY) * u;
      const sz = prevZ + (curZ - prevZ) * u;

      // 1. Breakable blocks along flight path
      const nearBlock =
        world.getBreakableAt(sx, sy - 0.5, sz, 1.35) ||
        world.getBreakableAt(sx, NaN, sz, 1.25);
      if (nearBlock && !nearBlock.broken && Math.abs(sy - (nearBlock.y + 0.6)) <= 2.2) {
        const tag = `block:${nearBlock.key}`;
        if (!st.hitTargets.includes(tag)) {
          st.hitTargets.push(tag);
          st.hits = (Number(st.hits) || 0) + 1;
          st.hitCount = st.hits;
          state.feedback.stickHits = (Number(state.feedback.stickHits) || 0) + 1;
          applyBlockHitAndLoot(nearBlock, computeMineDamage(nearBlock), { fromSeam: false });
          particles.spawnStarSparkles(nearBlock.x, nearBlock.y + 0.8, nearBlock.z, '#ffe066', 8);
        }
      }

      // 2. Active Giant Titans along flight path
      const nearTitan = titans.findNear(sx, sz, 2.85);
      if (nearTitan && nearTitan.active && !nearTitan.defeated) {
        const tId = nearTitan.id || nearTitan.titanId;
        const tag = `titan:${tId}`;
        if (!st.hitTargets.includes(tag)) {
          st.hitTargets.push(tag);
          st.hits = (Number(st.hits) || 0) + 1;
          st.hitCount = st.hits;
          state.feedback.stickHits = (Number(state.feedback.stickHits) || 0) + 1;
          const reqTier = Number(nearTitan.requiredTier) || 2;
          if ((Number(p.powerTier) || 1) >= reqTier) {
            advanceDrumCombo(nearTitan.x, nearTitan.y, nearTitan.z, {
              fromSeam: false,
              showAirWord: false,
            });
            combat.bonkTitan(tId);
          } else {
            // Under-geared ranged stick hit bounces the stick back harmlessly without throwing the hero onto a cloud!
            sfx.cloudBoing?.();
            particles.spawnStarSparkles(nearTitan.x, nearTitan.y + 1.8, nearTitan.z, '#74c0fc', 10);
            ui.spawnComicBurst(
              'BOING! NEED STARS!',
              nearTitan.x,
              nearTitan.y + 2.5,
              nearTitan.z,
              '#74c0fc'
            );
            st.phase = 'returning';
            st.apexX = curX;
            st.apexY = curY;
            st.apexZ = curZ;
            st.elapsed = 0;
          }
        }
      }

      // 3. Friendly Island Critters along flight path (gentle ranged tummy-pat!)
      const nearCritter = critters.findNear(sx, sz, 1.65);
      if (nearCritter) {
        const tag = `critter:${nearCritter.id}`;
        if (!st.hitTargets.includes(tag)) {
          st.hitTargets.push(tag);
          st.hits = (Number(st.hits) || 0) + 1;
          st.hitCount = st.hits;
          state.feedback.stickHits = (Number(state.feedback.stickHits) || 0) + 1;
          executeCritterPat(nearCritter.id);
        }
      }

      // 4. Collect Star Gem / Seed / Gear pickups along flight path
      pickups.collectAllNear?.(sx, sz, 2.15);
    }
  }

  function updateStickThrow(dt) {
    const st = state.stickThrow;
    const p = state.player;
    if (!st || !st.active) return;

    const outboundSec = MOVEMENT_TUNING.stickOutboundSec || 0.32;
    const hoverSec = MOVEMENT_TUNING.stickHoverSec || 0.16;
    const returnSec = MOVEMENT_TUNING.stickReturnSec || 0.34;

    const prevX = st.x;
    const prevY = st.y;
    const prevZ = st.z;

    const prevSpin = st.spinAngle;
    st.elapsed += dt;
    st.spinAngle += dt * 28.0;
    st.weaponId = resolveWeaponId(p.weaponId || st.weaponId || 'wooden_kentungan_bat');

    if (st.phase === 'outbound') {
      const u = Math.min(1, st.elapsed / outboundSec);
      const ease = 1 - Math.pow(1 - u, 2.2);
      st.x = st.startX + (st.apexX - st.startX) * ease;
      st.y = st.startY + (st.apexY - st.startY) * ease + Math.sin(u * Math.PI) * 0.28;
      st.z = st.startZ + (st.apexZ - st.startZ) * ease;

      sweepStickCollisions(prevX, prevY, prevZ, st.x, st.y, st.z);

      if (st.phase === 'outbound' && st.elapsed >= outboundSec) {
        st.phase = 'hover';
        st.elapsed = 0;
        st.hitTargets = [];
        particles.spawnTapRipple(
          st.x,
          (Number.isFinite(p.groundY) ? p.groundY : p.y) + 0.08,
          st.z,
          0xffe066
        );
      }
    } else if (st.phase === 'hover') {
      const u = Math.min(1, st.elapsed / hoverSec);
      st.x = st.apexX + Math.cos(u * Math.PI * 2) * 0.18;
      st.y = st.apexY + Math.sin(u * Math.PI) * 0.12;
      st.z = st.apexZ + Math.sin(u * Math.PI * 2) * 0.18;

      sweepStickCollisions(prevX, prevY, prevZ, st.x, st.y, st.z);

      if (st.elapsed >= hoverSec) {
        st.phase = 'returning';
        st.elapsed = 0;
        st.hitTargets = [];
      }
    } else if (st.phase === 'returning') {
      const handX = p.x;
      const handY = p.y + 0.92;
      const handZ = p.z;
      const u = Math.min(1, st.elapsed / returnSec);
      const ease = u * u * (3 - 2 * u);
      st.x = st.apexX + (handX - st.apexX) * ease;
      st.y = st.apexY + (handY - st.apexY) * ease + Math.sin(u * Math.PI) * 0.22;
      st.z = st.apexZ + (handZ - st.apexZ) * ease;

      sweepStickCollisions(prevX, prevY, prevZ, st.x, st.y, st.z);

      const distToHand = Math.hypot(st.x - handX, st.z - handZ);
      if (st.elapsed >= returnSec || (u >= 0.65 && distToHand <= 0.55)) {
        st.active = false;
        st.phase = 'idle';
        st.x = handX;
        st.y = handY;
        st.z = handZ;
        st.distFromHero = 0;
        st.spinAngle = 0;
        st.elapsed = 0;
        st.hitTargets = [];
        st.returnCount = (Number(st.returnCount) || 0) + 1;
        state.feedback.stickReturns = (Number(state.feedback.stickReturns) || 0) + 1;
        if (hero.weaponSocket) hero.weaponSocket.visible = true;
        if (hero.thrownStickGroup) hero.thrownStickGroup.visible = false;
        sfx.stickCatch?.();
        particles.spawnStarSparkles(handX, handY, handZ, '#ffe066', 6);
        return;
      }
    }

    st.distFromHero = Math.hypot(st.x - p.x, st.z - p.z);
    if (st.distFromHero > (Number(st.maxDistReached) || 0)) {
      st.maxDistReached = st.distFromHero;
    }

    if (Math.floor(st.spinAngle / (Math.PI * 0.6)) !== Math.floor(prevSpin / (Math.PI * 0.6))) {
      particles.spawnStarSparkles(st.x, st.y, st.z, '#ffe066', 2);
    }
  }

  function handleActionKey() {
    swingDrum({ fromHold: false, fromKey: true });
  }

  function handleJumpKey() {
    if (state.mode === 'title') {
      startGame({ seed: state.seed, chaosMode: state.chaosMode });
      return;
    }
    if (state.mode !== 'playing' || ui.isAnyOverlayOpen(state)) return;
    triggerJump({ fromKey: true });
  }

  function handleThrowKey() {
    if (state.mode === 'title') {
      startGame({ seed: state.seed, chaosMode: state.chaosMode });
      return;
    }
    if (state.mode !== 'playing' || ui.isAnyOverlayOpen(state)) return;
    swingDrum({ fromHold: false, fromKey: true });
  }

  function updatePlayerMovementAndActions(dt) {
    const p = state.player;
    if (p.swingCooldown > 0) {
      p.swingCooldown = Math.max(0, p.swingCooldown - dt);
    }
    if (p.landSquashTimer > 0) {
      p.landSquashTimer = Math.max(0, p.landSquashTimer - dt);
    }
    if (!Number.isFinite(p.groundY)) {
      p.groundY = p.y;
    }

    // While airborne on the Rainbow Spring Cloud, combat.update owns hero trajectory!
    if (p.boingArc?.active) {
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.jumping = false;
      p.grounded = false;
      p.airborne = true;
      p.state = 'boinging';
      return;
    }

    let movedDist = 0;
    const axes = input.getMoveAxes();

    if (axes.active) {
      // Laptop WASD / Arrow Keys relative to camera yaw
      p.path = [];
      p.target = null;
      const camYaw = cameraCtrl.getYaw();
      const fwdX = -Math.sin(camYaw);
      const fwdZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);

      const moveDirX = fwdX * axes.forward + rightX * axes.right;
      const moveDirZ = fwdZ * axes.forward + rightZ * axes.right;
      const len = Math.hypot(moveDirX, moveDirZ) || 1;
      const nx = moveDirX / len;
      const nz = moveDirZ / len;

      const stepDist = p.speed * dt;
      const candX = p.x + nx * stepDist;
      const candZ = p.z + nz * stepDist;
      const clamped = world.clampToWalkable(candX, candZ);
      const blocker = world.getBreakableAt(clamped.x, clamped.y, clamped.z, 0.52);

      if (!blocker || blocker.broken) {
        movedDist = Math.hypot(clamped.x - p.x, clamped.z - p.z);
        p.vx = (clamped.x - p.x) / Math.max(1e-4, dt);
        p.vz = (clamped.z - p.z) / Math.max(1e-4, dt);
        p.x = clamped.x;
        p.groundY = clamped.y;
        if (!p.jumping) {
          p.y = p.groundY;
        }
        p.z = clamped.z;
      } else {
        p.vx = 0;
        p.vz = 0;
      }
      p.yaw = Math.atan2(nx, nz);
    } else {
      // Refresh dynamic target coordinates (moving Critter or active Titan)
      if (p.target?.kind === 'critter') {
        const snap = critters.getSnapshot().find((c) => c.id === p.target.id);
        if (snap) {
          p.target.x = snap.x;
          p.target.z = snap.z;
          if (p.path.length === 0 || Math.hypot(p.path[p.path.length - 1].x - snap.x, p.path[p.path.length - 1].z - snap.z) > 0.65) {
            assignWalkPath(snap.x, snap.z);
          }
        } else {
          p.target = null;
          p.path = [];
        }
      } else if (p.target?.kind === 'titan') {
        const liveT = titans.getTitan(p.target.titanId);
        if (!liveT || !liveT.active || liveT.defeated) {
          p.target = null;
          p.path = [];
        }
      } else if (p.target?.kind === 'block') {
        const b = world.getBreakableByKey(p.target.key);
        if (!b || b.broken) {
          p.target = null;
          p.path = [];
        }
      }

      // Check arrival / interaction range BEFORE walking closer so hero doesn't walk inside blocks/Titans
      let stopMovementForInteraction = false;
      if (p.target) {
        if (p.target.kind === 'block') {
          const b = world.getBreakableByKey(p.target.key);
          if (b && !b.broken) {
            const half = ((b.size || 1) - 1) * 0.5;
            const edgeDist = Math.max(0, Math.hypot(b.x - p.x, b.z - p.z) - half);
            if (edgeDist <= 2.15) {
              stopMovementForInteraction = true;
              p.path = [];
              p.yaw = Math.atan2(b.x - p.x, b.z - p.z);
              if (p.swingCooldown <= 0) {
                const res = applyBlockHitAndLoot(b, computeMineDamage(b));
                if (res.broken) {
                  p.target = null;
                }
              }
            }
          }
        } else if (p.target.kind === 'critter') {
          const d = Math.hypot(p.target.x - p.x, p.target.z - p.z);
          if (d <= 2.35) {
            stopMovementForInteraction = true;
            p.path = [];
            p.yaw = Math.atan2(p.target.x - p.x, p.target.z - p.z);
            executeCritterPat(p.target.id);
            p.target = null;
          }
        } else if (p.target.kind === 'titan') {
          const liveT = titans.getTitan(p.target.titanId);
          if (liveT && liveT.active && !liveT.defeated) {
            const d = Math.hypot(liveT.x - p.x, liveT.z - p.z);
            if (d <= MOVEMENT_TUNING.titanMeleeRange) {
              stopMovementForInteraction = true;
              p.path = [];
              p.yaw = Math.atan2(liveT.x - p.x, liveT.z - p.z);
              if (p.swingCooldown <= 0) {
                p.swingCooldown = MOVEMENT_TUNING.swingIntervalSec;
                const bonkRes = combat.bonkTitan(liveT.id || liveT.titanId);
                cameraCtrl.triggerHop(bonkRes?.outcome === 'boing' ? 0.12 : 0.08);
                if (bonkRes?.outcome === 'defeated' || bonkRes?.outcome === 'boing') {
                  p.target = null;
                }
              }
            }
          }
        } else if (p.target.kind === 'pad') {
          const d = Math.hypot(p.target.x - p.x, p.target.z - p.z);
          if (d <= 1.85) {
            stopMovementForInteraction = true;
            p.path = [];
            if (p.target.triggerPlantOnArrive && flowerpots.canPlantOrUpgrade(p.target.padIdx)) {
              plantPotAction(p.target.padIdx);
            }
            p.target = null;
          }
        } else if (p.target.kind === 'chest') {
          const d = Math.hypot(p.target.x - p.x, p.target.z - p.z);
          if (d <= 1.55) {
            stopMovementForInteraction = true;
            p.path = [];
            p.yaw = Math.atan2(
              HUB_LAYOUT.rouletteChest.x - p.x,
              HUB_LAYOUT.rouletteChest.z - p.z
            );
            if (p.target.openModalOnArrive) {
              openRouletteInteractive();
            }
            p.target = null;
          }
        }
      }

      if (!stopMovementForInteraction && Array.isArray(p.path) && p.path.length > 0) {
        let budget = p.speed * dt;
        const startX = p.x;
        const startZ = p.z;

        while (budget > 1e-5 && p.path.length > 0) {
          const wp = p.path[0];
          const dx = wp.x - p.x;
          const dz = wp.z - p.z;
          const segDist = Math.hypot(dx, dz);

          if (segDist <= 0.04) {
            p.x = wp.x;
            p.z = wp.z;
            p.path.shift();
            if (p.path.length > 1) {
              const goal = p.path[p.path.length - 1];
              if (isDirectLineClear(p.x, p.z, goal.x, goal.z)) {
                p.path = [goal];
              }
            }
            continue;
          }

          if (segDist <= budget) {
            p.x = wp.x;
            p.z = wp.z;
            p.yaw = Math.atan2(dx, dz);
            budget -= segDist;
            p.path.shift();
            if (p.path.length > 1) {
              const goal = p.path[p.path.length - 1];
              if (isDirectLineClear(p.x, p.z, goal.x, goal.z)) {
                p.path = [goal];
              }
            }
          } else {
            const stepRatio = budget / segDist;
            p.x += dx * stepRatio;
            p.z += dz * stepRatio;
            p.yaw = Math.atan2(dx, dz);
            budget = 0;
          }
        }

        const groundY = world.getGroundY(p.x, p.z);
        if (Number.isFinite(groundY) && groundY > -20) {
          p.groundY = groundY;
          if (!p.jumping) {
            p.y = groundY;
          }
        } else {
          const safe = world.clampToWalkable(p.x, p.z);
          p.x = safe.x;
          p.groundY = safe.y;
          if (!p.jumping) {
            p.y = safe.y;
          }
          p.z = safe.z;
          p.path = [];
        }

        movedDist = Math.hypot(p.x - startX, p.z - startZ);
        p.vx = (p.x - startX) / Math.max(1e-4, dt);
        p.vz = (p.z - startZ) / Math.max(1e-4, dt);

        if (p.path.length === 0 && p.target?.kind === 'ground') {
          p.target = null;
        }
      } else {
        p.vx = 0;
        p.vz = 0;
      }
    }

    // Mario-style vertical jump arc & landing physics
    if (p.jumping) {
      const grav =
        p.vy > 0
          ? (MOVEMENT_TUNING.jumpGravityUp || 28.0)
          : (MOVEMENT_TUNING.jumpGravityDown || 38.0);
      p.vy -= grav * dt;
      p.y += p.vy * dt;
      if (p.y > (Number(p.jumpApexY) || p.groundY)) {
        p.jumpApexY = p.y;
      }

      // Head-bonk overhead/adjacent Lucky Blocks while rising!
      if (p.vy > 0) {
        const headBlock = world.getBreakableAt(p.x, p.y + 0.9, p.z, 1.35);
        if (headBlock && !headBlock.broken && headBlock.y >= p.groundY - 0.1) {
          applyBlockHitAndLoot(headBlock, computeMineDamage(headBlock));
          p.vy = -Math.min(4.2, p.vy * 0.45);
        }
      }

      if (p.y <= p.groundY) {
        p.y = p.groundY;
        p.vy = 0;
        p.jumping = false;
        p.grounded = true;
        p.airborne = false;
        p.jumpY = 0;
        p.landSquashTimer = 0.16;
        hero.triggerLand?.();
        sfx.land?.();
        particles.spawnTapRipple(p.x, p.groundY + 0.05, p.z, 0xffe066);
        pickups.collectAllNear?.(p.x, p.z, 2.4);
      } else {
        p.grounded = false;
        p.airborne = true;
        p.jumpY = Math.max(0, p.y - p.groundY);
      }
    } else {
      p.y = p.groundY;
      p.vy = 0;
      p.grounded = true;
      p.airborne = false;
      p.jumpY = 0;
    }

    // Friendly proximity auto-pat: when hero jogs right past a happy island critter, give it a cheerful wave & pat!
    if (autoPatCooldown > 0) {
      autoPatCooldown = Math.max(0, autoPatCooldown - dt);
    } else if (movedDist > 0.002 && !p.boingArc?.active && p.target?.kind !== 'critter') {
      const closeCritter = critters.findNear(p.x, p.z, 1.35);
      if (closeCritter) {
        executeCritterPat(closeCritter.id);
        autoPatCooldown = 20.0;
      }
    }

    if (state.mode === 'victory') {
      p.state = 'celebrating';
    } else if (p.jumping) {
      p.state = 'jumping';
    } else if (p.swingCooldown > MOVEMENT_TUNING.swingIntervalSec * 0.35) {
      p.state = 'swinging';
    } else if (movedDist > 0.002) {
      p.state = 'walking';
    } else {
      p.state = 'idle';
    }
  }

  function syncSavedVisualsToScene() {
    for (let i = 0; i < state.flowerpots.length; i += 1) {
      const pad = state.flowerpots[i];
      world.setPadVisual(pad.padIdx, Number(pad.tier) || 0, props3d.buildFlowerpotMesh);
    }
    for (let i = 0; i < HUB_LAYOUT.trophyPedestals.length; i += 1) {
      const ped = HUB_LAYOUT.trophyPedestals[i];
      const unlocked = state.trophies.some((id) => resolveBossId(id) === resolveBossId(ped.titanId));
      world.setTrophyVisual(ped.idx, ped.titanId, unlocked, props3d.buildTrophyMesh);
    }
    roulette.getSpinCost();
    combat.syncPlayerStats();
  }

  function startGame(opts = {}) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prefs = loadPrefs();
    const nextSeed =
      opts.seed !== undefined
        ? (Number(opts.seed) >>> 0) || 2026
        : (Number(state?.seed) >>> 0) || 2026;
    const nextChaos =
      opts.chaosMode !== undefined ? Boolean(opts.chaosMode) : Boolean(prefs.chaosMode);

    const prevMaxMetalness = state?.perf?.maxMetalness || 0;
    const needsWorldRebuild =
      worldDirty ||
      state?.seed !== nextSeed ||
      (state?.blocksBroken || 0) > 0 ||
      (state?.trophies?.length || 0) > 0;

    rng = createRng(nextSeed);
    state = createGameState({
      seed: nextSeed,
      chaosMode: nextChaos,
      mode: 'playing',
    });
    state.perf.maxMetalness = prevMaxMetalness;
    autoPatCooldown = 0;

    input.clearKeys();
    if (needsWorldRebuild) {
      world.reset(nextSeed);
      critters.reset(nextSeed);
      for (let i = 0; i < HUB_LAYOUT.trophyPedestals.length; i += 1) {
        const ped = HUB_LAYOUT.trophyPedestals[i];
        world.setTrophyVisual(ped.idx, ped.titanId, false, props3d.buildTrophyMesh);
      }
      worldDirty = false;
    }
    titans.reset();
    pickups.reset();
    flowerpots.reset();
    roulette.reset();
    combat.reset();
    lootDirector.reset();
    particles.reset();
    voice.reset();
    ui.reset();

    syncHeroToSpawn();
    cameraCtrl.setYaw(0, true);
    cameraCtrl.snapToPlayer(state);
    if (needsWorldRebuild) {
      sceneCtx.renderer.shadowMap.needsUpdate = true;
    }

    music.setMood('island');
    if (audio.musicEnabled) {
      music.start();
    }

    if (!prevMaxMetalness) {
      refreshMaterialGuardrails();
    }
    // Hide Title overlay and sync HUD rects BEFORE speaking welcome VO so subtitle placement sees live HUD!
    ui.update(0, 0);
    voice.speak('guide_welcome', { priority: 'interrupt' });
    state.voice = buildVoiceSnapshot();
    state.audio = buildAudioSnapshot();
    if (typeof document !== 'undefined') {
      document.getElementById('btn-hud-voice')?.classList.toggle('is-speaking', Boolean(state.voice.speaking));
    }

    const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    state.perf.playStartMs = Number(Math.max(0.01, elapsedMs).toFixed(2));
    loop.deferNextBgRender?.(42);
    return buildStateSnapshot();
  }

  function continueGame() {
    const saved = loadSavedRun();
    if (!saved) {
      return startGame();
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prevMaxMetalness = state?.perf?.maxMetalness || 0;

    rng = createRng(saved.seed);
    state = createGameState({
      seed: saved.seed,
      chaosMode: saved.chaosMode,
      mode: 'playing',
    });
    state.perf.maxMetalness = prevMaxMetalness;
    autoPatCooldown = 0;

    input.clearKeys();
    world.reset(saved.seed);
    critters.reset(saved.seed);
    titans.reset();
    pickups.reset();
    flowerpots.reset();
    roulette.reset();
    combat.reset();
    lootDirector.reset();
    particles.reset();
    voice.reset();
    ui.reset();

    applySavedRunToState(state, saved);
    worldDirty = true;
    if ((Number(state.blocksBroken) || 0) >= 1) {
      const starter = world.getBreakableByKey('starter_lucky');
      if (starter) {
        starter.isStarter = false;
        starter.scale = 1.15;
      }
    }
    syncSavedVisualsToScene();
    syncHeroToSpawn();
    cameraCtrl.setYaw(0, true);
    cameraCtrl.snapToPlayer(state);
    sceneCtx.renderer.shadowMap.needsUpdate = true;

    music.setMood(state.trophies.length >= 4 ? 'victory' : 'island');
    if (audio.musicEnabled) {
      music.start();
    }

    refreshMaterialGuardrails();
    ui.update(0, 0);
    voice.speak('vo_keep_playing', { priority: 'interrupt' });
    ui.update(0, 0);

    const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    state.perf.playStartMs = Number(Math.max(0.01, elapsedMs).toFixed(2));
    loop.deferNextBgRender?.(42);
    return buildStateSnapshot();
  }

  // Wire UI actions BEFORE creating UI so all bindTap handlers resolve immediately.
  ctx.actions = {
    startGame: (opts = {}) => startGame(opts),
    continueGame: () => continueGame(),
    hasSavedRun: () => hasSavedRun(),
    playTitleVoice: () =>
      voice.speak('guide_title', { priority: 'interrupt', forceUnmute: true }),
    openRoulette: () => {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
      return openRouletteInteractive();
    },
    spinChest: (forcedWeaponId = null) => roulette.startSpin(forcedWeaponId),
    plantPot: (padIdx = null) => {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
      return plantPotAction(padIdx);
    },
    swingDrum: (opts = {}) => swingDrum(opts),
    jump: (opts = {}) => triggerJump(opts),
    throwStick: (opts = {}) => throwStick(opts),
    replayVoice: () => {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
      return voice.replayLast();
    },
    openPause: () => {
      state.feedback.taps = (Number(state.feedback.taps) || 0) + 1;
      return ui.openPause();
    },
    resumeGame: () => {
      if (state.mode === 'paused') state.mode = 'playing';
    },
    toggleMusic: (on) => {
      audio.setMusicEnabled(Boolean(on));
      if (on && state.mode !== 'title') {
        music.start();
      }
      state.audio = buildAudioSnapshot();
    },
    toggleSfx: (on) => {
      audio.setSfxEnabled(Boolean(on));
      state.audio = buildAudioSnapshot();
    },
    toggleVoice: (on) => {
      audio.setVoiceEnabled(Boolean(on));
      state.audio = buildAudioSnapshot();
      state.voice = buildVoiceSnapshot();
    },
    toggleChaos: (on) => {
      state.chaosMode = Boolean(on);
      savePrefs({ chaosMode: state.chaosMode });
    },
    continueFreePlay: () => {
      state.mode = 'playing';
      music.setMood('island');
      voice.speak('vo_keep_playing', { priority: 'interrupt' });
    },
    newIsland: () => {
      const nextSeed = ((Number(state.seed) || 2026) + 1) >>> 0;
      startGame({ seed: nextSeed, chaosMode: Boolean(state.chaosMode) });
    },
  };

  const rawUi = createUI(ctx);
  // Bridge 3D world-space comic bursts from combat.js (word, wx, wy, wz, color) cleanly to screen projection!
  const ui = {
    ...rawUi,
    spawnComicBurst(word, a, b, c, d) {
      if (typeof c === 'number') {
        return rawUi.spawnComicBurstWorld(word, a, b, c, cameraCtrl.camera, d || '#ffd43b');
      }
      return rawUi.spawnComicBurst(word, a, b, c);
    },
    showVictory() {
      return rawUi.openVictory();
    },
    hideBossBanner() {
      return rawUi.bossBanner.hide();
    },
  };
  ctx.ui = ui;

  const input = createInputController(canvas, {
    onTapCanvas: handleCanvasTap,
    onHoldAutoBonk: () => {
      if (state.mode === 'playing' && !ui.isAnyOverlayOpen(state)) {
        swingDrum({ fromHold: true });
      }
    },
    onDragYaw: (deltaRad) => {
      if (state.mode === 'playing' && !ui.isAnyOverlayOpen(state)) {
        cameraCtrl.addYaw(deltaRad);
      }
    },
    onActionKey: handleActionKey,
    onJumpKey: handleJumpKey,
    onThrowKey: handleThrowKey,
    onUnlockAudio: () => {
      audio.unlock();
      if (state.mode !== 'title' && audio.musicEnabled && !music.isPlaying()) {
        music.start();
      }
    },
  });

  function step(dt) {
    const safeDt = Math.min(0.05, Math.max(0, Number(dt) || 1 / 60));

    // Voice & roulette timers always advance deterministically during stepFrames().
    voice.update(safeDt);
    music.update(safeDt);

    if (state.mode === 'title') {
      state.time = Number((state.time + safeDt).toFixed(6));
      world.update(safeDt, state.time);
      critters.update(safeDt, state.time);
      particles.update(safeDt);
      hero.update(safeDt, state.time, {
        x: state.player.x,
        y: state.player.y,
        groundY: state.player.groundY ?? state.player.y,
        z: state.player.z,
        yaw: state.player.yaw,
        vy: 0,
        jumping: false,
        landSquash: 0,
        speedRatio: 0,
        stickProjectile: state.stickThrow,
      });
      cameraCtrl.update(safeDt, state, null);
      ui.update(safeDt, state.time);
      return;
    }

    if (state.mode === 'paused') {
      state.audio = buildAudioSnapshot();
      state.voice = buildVoiceSnapshot();
      cameraCtrl.update(0, state, titans.getActive());
      ui.update(safeDt, state.time);
      return;
    }

    state.time = Number((state.time + safeDt).toFixed(6));

    // Roulette roll progresses whether triggered from modal ('roulette') or headless seam ('playing').
    roulette.update(safeDt);

    if (state.mode === 'playing' || state.mode === 'victory') {
      // Brief 45ms hit-stop freezes world/titan motion on juicy bonks while keeping particles & camera crisp!
      const hitStopped = combat.isHitStopped();
      combat.update(safeDt, state.time);

      const worldDt = hitStopped ? safeDt * 0.15 : safeDt;
      world.update(worldDt, state.time);
      flowerpots.update(safeDt, state.time);

      if (state.mode === 'playing' && !hitStopped) {
        updatePlayerMovementAndActions(safeDt);
        updateStickThrow(safeDt);
      } else if (state.mode === 'playing') {
        updateStickThrow(safeDt);
      } else if (state.mode === 'victory') {
        state.player.vx = 0;
        state.player.vz = 0;
        state.player.state = 'celebrating';
        updateStickThrow(safeDt);
        victoryFireworkTimer -= safeDt;
        if (victoryFireworkTimer <= 0) {
          victoryFireworkTimer = 1.35;
          const fxOffset = ((Math.round(state.time * 10) % 5) - 2) * 2.2;
          particles.spawnVictoryFireworks(fxOffset, 7.2, -7.2);
        }
      }

      pickups.update(safeDt, state.time);
      critters.update(worldDt, state.time);
      titans.update(worldDt, state.time, state.player);
    } else if (state.mode === 'roulette') {
      world.update(safeDt, state.time);
      updateStickThrow(safeDt);
      pickups.update(safeDt, state.time);
      critters.update(safeDt, state.time);
      titans.update(safeDt, state.time, state.player);
    }

    particles.update(safeDt);

    const speedMag = Math.hypot(state.player.vx || 0, state.player.vz || 0);
    hero.update(safeDt, state.time, {
      x: state.player.x,
      y: state.player.y,
      groundY: state.player.groundY ?? state.player.y,
      z: state.player.z,
      yaw: state.player.yaw,
      vy: state.player.vy || 0,
      jumping: Boolean(state.player.jumping),
      landSquash: state.player.landSquashTimer || 0,
      speedRatio: speedMag / Math.max(1, MOVEMENT_TUNING.baseSpeed),
      swinging: state.player.state === 'swinging',
      boinging: Boolean(state.player.boingArc?.active),
      stickProjectile: state.stickThrow,
    });

    cameraCtrl.update(safeDt, state, titans.getActive());
    state.perf.cameraRoll = Number(Math.abs(cameraCtrl.camera.rotation.z).toFixed(6));

    // Attach live voice & titan snapshots on state so UI components read fresh status.
    state.voice = buildVoiceSnapshot();
    state.audio = buildAudioSnapshot();
    ui.update(safeDt, state.time);
  }

  function render() {
    sceneCtx.renderer.render(sceneCtx.scene, cameraCtrl.camera);
    state.perf.drawCalls = sceneCtx.renderer.info.render.calls;
    state.perf.triangles = sceneCtx.renderer.info.render.triangles;
    state.perf.cameraRoll = Number(Math.abs(cameraCtrl.camera.rotation.z).toFixed(6));
  }

  function buildVoiceSnapshot() {
    const v = voice.getState();
    return {
      speaking: v.speaking,
      currentId: v.currentId,
      lastId: v.lastId,
      speaker: v.speaker,
      text: v.text,
      remainingSec: v.remainingSec,
      bgmDucked: v.bgmDucked,
      duckDb: v.duckDb,
      duckMultiplier: v.duckMultiplier,
      queueLength: v.queueLength,
      requestedCount: v.requestedCount,
      playedCount: v.playedCount,
      replayCount: v.replayCount,
      totalManifestClips: v.totalManifestClips,
    };
  }

  function buildAudioSnapshot() {
    const a = audio.getState();
    return {
      unlocked: a.unlocked,
      masterOn: a.masterOn,
      musicOn: a.musicOn,
      sfxOn: a.sfxOn,
      voiceOn: a.voiceOn,
      masterEnabled: a.masterEnabled,
      musicEnabled: a.musicEnabled,
      sfxEnabled: a.sfxEnabled,
      voiceEnabled: a.voiceEnabled,
      bgmDucked: a.bgmDucked,
      duckMultiplier: a.duckMultiplier,
      duckDb: a.duckDb,
      musicGainTarget: a.musicGainTarget,
    };
  }

  function buildStateSnapshot() {
    combat.syncPlayerStats();
    const titanSnaps = titans.getSnapshot().map((t) => ({
      ...t,
      defeated: Boolean(
        t.defeated || state.trophies.some((id) => resolveBossId(id) === resolveBossId(t.id))
      ),
    }));
    const preferredActive = titans.getActive();
    const activeTitan =
      (preferredActive &&
        titanSnaps.find((t) => t.id === preferredActive.id && t.active && !t.defeated && t.hp > 0)) ||
      titanSnaps.find((t) => t.active && !t.defeated && t.hp > 0) ||
      null;
    const potSnaps = flowerpots.getSnapshot();
    const critterSnaps = critters.getSnapshot();
    const st = state.stickThrow || {};
    const stickSnap = {
      active: Boolean(st.active),
      phase: st.phase || 'idle',
      weaponId: st.weaponId || state.player.weaponId,
      x: Number((st.x ?? state.player.x).toFixed(3)),
      y: Number((st.y ?? (state.player.y + 0.92)).toFixed(3)),
      z: Number((st.z ?? state.player.z).toFixed(3)),
      spinAngle: Number((st.spinAngle || 0).toFixed(3)),
      distFromHero: Number((st.distFromHero || 0).toFixed(3)),
      maxDistReached: Number((st.maxDistReached || 0).toFixed(3)),
      hits: Number(st.hits) || 0,
      hitCount: Number(st.hitCount ?? st.hits) || 0,
      throwCount: Number(st.throwCount) || 0,
      returnCount: Number(st.returnCount) || 0,
    };
    const groundY = Number.isFinite(state.player.groundY)
      ? state.player.groundY
      : state.player.y;
    const jumpY = Math.max(0, state.player.y - groundY);
    const playerSnap = {
      x: Number(state.player.x.toFixed(3)),
      y: Number(state.player.y.toFixed(3)),
      groundY: Number(groundY.toFixed(3)),
      jumpY: Number(jumpY.toFixed(3)),
      z: Number(state.player.z.toFixed(3)),
      vx: Number((state.player.vx || 0).toFixed(3)),
      vy: Number((state.player.vy || 0).toFixed(3)),
      vz: Number((state.player.vz || 0).toFixed(3)),
      grounded: Boolean(state.player.grounded !== false && !state.player.jumping),
      airborne: Boolean(state.player.airborne || state.player.jumping),
      jumping: Boolean(state.player.jumping),
      jumpCount: Number(state.player.jumpCount) || 0,
      jumpApexY: Number((state.player.jumpApexY ?? groundY).toFixed(3)),
      yaw: Number((state.player.yaw || 0).toFixed(3)),
      baseSpeed: state.player.baseSpeed,
      speed: state.player.speed,
      weaponId: state.player.weaponId,
      weaponTier: state.player.weaponTier,
      powerTier: state.player.powerTier,
      comboBeat: state.player.comboBeat || 1,
      helmet: Boolean(state.player.helmet),
      speedBoots: Boolean(state.player.speedBoots),
      starCape: Boolean(state.player.starCape),
      crown: Boolean(state.player.crown),
      shieldHearts: state.player.shieldHearts,
      maxShieldHearts: state.player.maxShieldHearts,
      starGems: state.player.starGems,
      potSeeds: state.player.potSeeds,
      drumSeeds: state.player.potSeeds,
      freeSpins: state.player.freeSpins,
      state: state.player.state,
      stickProjectile: stickSnap,
    };

    return {
      mode: state.mode,
      seed: state.seed,
      time: Number(state.time.toFixed(4)),
      chaosMode: Boolean(state.chaosMode),
      victoryCelebrated: Boolean(state.victoryCelebrated),
      player: playerSnap,
      hero: playerSnap,
      stickThrow: stickSnap,
      blocksBroken: state.blocksBroken,
      drumsBroken: state.blocksBroken,
      luckyBlocksCount: state.luckyBlocksCount,
      activeDrops: pickups.getSnapshot(),
      flowerpots: potSnaps,
      totems: potSnaps,
      critters: critterSnaps,
      pets: critterSnaps,
      titans: titanSnaps,
      bosses: titanSnaps,
      activeTitan,
      activeBoss: activeTitan,
      trophies: state.trophies.slice(),
      roulette: roulette.getSnapshot(),
      voice: buildVoiceSnapshot(),
      audio: buildAudioSnapshot(),
      feedback: {
        ...state.feedback,
        dropTypesSeen: Array.isArray(state.feedback?.dropTypesSeen)
          ? state.feedback.dropTypesSeen.slice()
          : [],
      },
      perf: { ...state.perf },
    };
  }

  // Seam methods for window.__SAHUR_ISLAND__ (and alias window.__LUCKY_TITAN__)
  function seamBreakBlock(x, y, z) {
    const qx = Number(x) || 0;
    const qy = Number(y);
    const qz = Number(z) || 0;

    // Inspect all blocks (including regrowing ones) so repeated calls at a broken spot
    // wait cleanly for regrowth instead of jumping to a neighbor block!
    const all = world.getAllBreakables();
    let nearest = null;
    let bestDist = 1.55;
    for (let i = 0; i < all.length; i += 1) {
      const b = all[i];
      const half = ((b.size || 1) - 1) * 0.5;
      const d = Math.max(0, Math.hypot(qx - b.x, qz - b.z) - half);
      if (d > bestDist) continue;
      if (Number.isFinite(qy) && Math.abs(qy - b.y) > 2.2) continue;
      bestDist = d;
      nearest = b;
    }

    if (!nearest || nearest.broken) {
      return { ok: false, broken: false, reason: nearest ? 'regrowing' : 'not_found' };
    }
    return applyBlockHitAndLoot(nearest, nearest.hp + 999, { fromSeam: true });
  }

  function seamSpawnTitan(titanId) {
    const resolved = titanId ? resolveBossId(titanId) : TITAN_ORDER[0];
    const cleanId = TITANS[resolved] ? resolved : TITAN_ORDER[0];
    const spawned = combat.spawnBiomeTitan(cleanId, TITANS[cleanId].spawnPos);
    world.update(0, state.time);
    refreshMaterialGuardrails();
    return spawned;
  }

  function seamBonkTitan(titanId) {
    const resolved = titanId ? resolveBossId(titanId) : null;
    const cleanId =
      resolved && TITANS[resolved]
        ? resolved
        : resolveBossId(state.activeTitanId || titans.getActive()?.id || TITAN_ORDER[0]);
    let live = titans.getTitan(cleanId);
    if (
      !live ||
      (!live.active && !live.defeated && !state.trophies.some((id) => resolveBossId(id) === cleanId))
    ) {
      live = seamSpawnTitan(cleanId);
    }
    // Position hero within melee range if invoked from afar so 3D bonk & spring-cloud arc look natural!
    if (live && !state.player.boingArc?.active) {
      const d = Math.hypot(live.x - state.player.x, live.z - state.player.z);
      if (d > MOVEMENT_TUNING.titanMeleeRange + 0.5) {
        const approach = world.clampToWalkable(live.x, live.z + 2.4);
        state.player.x = approach.x;
        state.player.groundY = approach.y;
        if (!state.player.jumping) {
          state.player.y = approach.y;
        }
        state.player.z = approach.z;
        state.player.yaw = Math.atan2(live.x - approach.x, live.z - approach.z);
      }
    }
    advanceDrumCombo(live ? live.x : state.player.x, live ? live.y : state.player.y, live ? live.z : state.player.z, {
      fromSeam: true,
    });
    const res = combat.bonkTitan(cleanId);
    cameraCtrl.triggerHop(res?.outcome === 'boing' ? 0.12 : 0.08);
    return res;
  }

  const loop = createLoop({ step, render });

  window.addEventListener('resize', () => {
    const { w, h } = sceneCtx.resize();
    cameraCtrl.onResize(w, h);
    voice.positionSubtitle();
    render();
  });

  // Pre-warm all materials, shaders & WebAudio graph behind Title Screen so PLAY is < 25ms!
  // Also preview any saved Hub Flowerpots, Trophies & Hero gear behind Title without mutating localStorage!
  audio.ensureContext();
  if (hasSavedRun()) {
    const bootSaved = loadSavedRun();
    if (bootSaved) {
      worldDirty = true;
      applySavedRunToState(state, bootSaved);
      syncSavedVisualsToScene();
    }
  }
  syncHeroToSpawn();
  for (const wId of Object.keys(WEAPONS)) {
    try {
      props3d.renderWeaponIconDataURL(wId);
    } catch (_err) {
      // Ignore icon warmup fallback.
    }
  }
  refreshMaterialGuardrails();
  cameraCtrl.snapToPlayer(state);
  try {
    sceneCtx.renderer.compile(sceneCtx.scene, cameraCtrl.camera);
  } catch (_err) {
    // Fallback gracefully if driver skips eager shader compile.
  }
  cameraCtrl.update(0, state, null);
  if (ui.hud?.el) {
    ui.hud.el.hidden = false;
    void ui.hud.el.offsetHeight;
    ui.hud.el.hidden = true;
  }
  ui.update(0, 0);
  render();

  installSeam({
    startGame,
    tapWorld: (x, z) => resolveWorldTap(x, z, { fromCanvas: false }),
    breakBlock: seamBreakBlock,
    plantPot: (padIdx = 0) => plantPotAction(padIdx),
    spinChest: (forcedWeaponId = null) => roulette.startSpin(forcedWeaponId),
    spawnTitan: seamSpawnTitan,
    bonkTitan: seamBonkTitan,
    swingDrum: (opts = {}) => swingDrum(opts),
    jump: (opts = {}) => triggerJump({ ...opts, fromSeam: opts.fromSeam !== false }),
    throwStick: (opts = {}) => throwStick({ ...opts, fromSeam: opts.fromSeam !== false }),
    replayVoice: () => voice.replayLast(),
    stepFrames: (n, dt) => loop.stepFrames(n, dt),
    buildStateSnapshot,
  });

  loop.start();
}

bootLuckyBlockTitans();
