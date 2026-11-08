// Kid-First Active Play HUD + Unified UI Orchestrator for Tung Tung Tung Sahur 3D!
// Strictly <= 5 clickable HUD buttons (#btn-hud-spin, #btn-hud-totem/#btn-hud-pot, #btn-hud-voice, #btn-hud-menu, #btn-hud-drum),
// while #voice-subtitle is a focusable div without role="button" so total active-play button count stays <= 5.
// All top status displays have pointer-events: none and zero button/tabindex roles.

import {
  FLOWERPOT_TIERS,
  MOVEMENT_TUNING,
  ROULETTE_COSTS,
  TITAN_ORDER,
  WEAPONS,
  resolveBossId,
  resolveWeaponId,
} from '../data/catalog.js';
import { STRINGS, formatStarCost, formatTierBadge } from '../data/strings.js';
import { createBossBanner } from './boss_banner.js';
import { bindTap } from './debounce.js';
import { createGuideArrow, selectKidGuideGoal } from './guide_arrow.js';
import { createPauseModal } from './pause_modal.js';
import { createRouletteModal, resolveWeaponIconUrl } from './roulette_modal.js';
import { createTitleScreen } from './title.js';
import { createVictoryModal } from './victory_modal.js';

const DOM_ID_ALIASES = Object.freeze({
  'btn-hud-pot': 'btn-hud-totem',
  'btn-hud-totem': 'btn-hud-pot',
  'badge-hud-pot': 'badge-hud-totem',
  'badge-hud-totem': 'badge-hud-pot',
  'label-hud-pot': 'label-hud-totem',
  'label-hud-totem': 'label-hud-pot',
});

let domAliasInstalled = false;
function installDomIdAliases() {
  if (domAliasInstalled || typeof Document === 'undefined') return;
  domAliasInstalled = true;
  const origGetById = Document.prototype.getElementById;
  Document.prototype.getElementById = function (id) {
    const found = origGetById.call(this, id);
    if (found) return found;
    const alt = DOM_ID_ALIASES[id];
    return alt ? origGetById.call(this, alt) : null;
  };
  const rewriteSelector = (sel) => {
    if (typeof sel !== 'string') return sel;
    if (sel.includes('#btn-hud-pot') && !sel.includes('#btn-hud-totem')) {
      return `${sel}, ${sel.replace(/#btn-hud-pot/g, '#btn-hud-totem')}`;
    }
    if (sel.includes('#btn-hud-totem') && !sel.includes('#btn-hud-pot')) {
      return `${sel}, ${sel.replace(/#btn-hud-totem/g, '#btn-hud-pot')}`;
    }
    return sel;
  };
  for (const Proto of [Document.prototype, Element.prototype]) {
    const origQS = Proto.querySelector;
    Proto.querySelector = function (sel) {
      return origQS.call(this, rewriteSelector(sel));
    };
    const origQSA = Proto.querySelectorAll;
    Proto.querySelectorAll = function (sel) {
      return origQSA.call(this, rewriteSelector(sel));
    };
  }
}

function getPadsInfo(state, ctx) {
  const rawPads = Array.isArray(state?.flowerpots)
    ? state.flowerpots
    : Array.isArray(state?.flowerpots?.pads)
      ? state.flowerpots.pads
      : [];

  let minTier = 3;
  let plantedCount = 0;
  for (let i = 0; i < 4; i += 1) {
    const p = rawPads[i];
    const tier = typeof p === 'number' ? p : Number(p?.tier ?? 0);
    if (tier > 0) plantedCount += 1;
    if (tier < minTier) minTier = tier;
  }

  const allMaxed = minTier >= 3;
  const nextTier = Math.min(3, minTier + 1);
  const nextSpec = FLOWERPOT_TIERS[nextTier] || FLOWERPOT_TIERS[1];
  const nextCost = Number(nextSpec?.costGems) || 6;
  const potSeeds = Number(state?.player?.potSeeds) || 0;
  const starGems = Number(state?.player?.starGems) || 0;

  let canPlant = false;
  if (typeof ctx.flowerpots?.canPlantOrUpgrade === 'function') {
    canPlant = Boolean(ctx.flowerpots.canPlantOrUpgrade());
  } else {
    canPlant = !allMaxed && (potSeeds > 0 || starGems >= nextCost);
  }

  return {
    minTier,
    plantedCount,
    allMaxed,
    nextCost,
    potSeeds,
    canPlant,
  };
}

function getSpinInfo(state, ctx) {
  const freeSpins = Number(state?.player?.freeSpins) || 0;
  const starGems = Number(state?.player?.starGems) || 0;
  const weaponTier = Number(state?.player?.weaponTier) || 1;
  let spinCost = 0;

  if (typeof ctx.roulette?.getSpinCost === 'function') {
    spinCost = Math.max(0, Number(ctx.roulette.getSpinCost()) || 0);
  } else if (freeSpins > 0) {
    spinCost = 0;
  } else if (state?.roulette?.spinCost !== undefined) {
    spinCost = Math.max(0, Number(state.roulette.spinCost) || 0);
  } else {
    const idx = Math.min(
      Number(state?.roulette?.spinsCount) || 0,
      ROULETTE_COSTS.length - 1
    );
    spinCost = ROULETTE_COSTS[idx];
  }

  const canSpin =
    typeof ctx.roulette?.canSpin === 'function'
      ? Boolean(ctx.roulette.canSpin())
      : freeSpins > 0 || starGems >= spinCost;

  return { freeSpins, spinCost, canSpin, weaponTier };
}

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

export function createHud(ctx = {}) {
  installDomIdAliases();
  const hudRoot =
    typeof document !== 'undefined' ? document.getElementById('hud') : null;
  let root = hudRoot;
  if (!root && typeof document !== 'undefined' && document.body) {
    root = document.createElement('div');
    root.id = 'hud';
    document.body.appendChild(root);
  }

  if (!root) {
    return {
      el: null,
      show() {},
      hide() {},
      update() {},
      destroy() {},
    };
  }

  root.className = 'hud-root';
  root.hidden = true;

  const trophyPipsHtml = TITAN_ORDER.map((id) => {
    const t = STRINGS.TITANS[id] || { icon: '\uD83C\uDFC6' };
    return `<span class="trophy-pip" data-titan="${id}" aria-hidden="true">${t.icon}</span>`;
  }).join('');

  root.innerHTML = `
    <div id="hud-status" class="hud-status">
      <div id="hud-top-left" class="hud-top-left">
        <div id="hud-gems-pill" class="hud-pill hud-gems-pill" aria-label="${STRINGS.HUD.starsAria}">
          <span class="hud-pill-emoji" aria-hidden="true">\u2B50</span>
          <span id="hud-gems-val" class="hud-pill-val">0</span>
        </div>

        <div id="hud-power-pill" class="hud-pill hud-power-pill" aria-label="${STRINGS.HUD.powerAria}">
          <img id="hud-weapon-img" class="hud-weapon-img" alt="" draggable="false" />
          <span id="hud-power-val" class="hud-power-val">\u26051</span>
          <span id="hud-gear-icons" class="hud-gear-icons" aria-hidden="true"></span>
        </div>

        <div id="hud-shields-pill" class="hud-pill hud-shields-pill" aria-label="${STRINGS.HUD.shieldsAria}">
          <span id="hud-shields-row" class="hud-shields-row" aria-hidden="true"></span>
        </div>
      </div>

      <div id="hud-top-right" class="hud-top-right">
        <div id="hud-trophies-pill" class="hud-pill hud-trophies-pill" aria-label="${STRINGS.HUD.trophiesAria}">
          <span class="hud-trophy-pips" id="hud-trophy-pips">${trophyPipsHtml}</span>
          <span id="hud-trophies-val" class="hud-trophies-val">0/4</span>
        </div>
      </div>
    </div>

    <div id="hud-actions" class="hud-actions">
      <button type="button" id="btn-hud-spin" class="kid-btn hud-action-btn hud-btn-spin" aria-label="${STRINGS.HUD.spinAria}">
        <span class="btn-badge" id="badge-hud-spin">FREE!</span>
        <span class="btn-icon" aria-hidden="true">\uD83C\uDF81</span>
        <span class="btn-label">${STRINGS.HUD.spinLabel}</span>
      </button>

      <button type="button" id="btn-hud-totem" class="kid-btn hud-action-btn hud-btn-pot" aria-label="${STRINGS.HUD.potAria}">
        <span class="btn-badge" id="badge-hud-totem">\u2B506</span>
        <span class="btn-icon" aria-hidden="true">\uD83E\uDEB4</span>
        <span class="btn-label" id="label-hud-totem">${STRINGS.HUD.potPlantLabel}</span>
      </button>

      <button type="button" id="btn-hud-voice" class="kid-btn hud-action-btn hud-btn-voice" aria-label="${STRINGS.HUD.voiceAria}">
        <span class="btn-icon" aria-hidden="true">\uD83D\uDD0A</span>
        <span class="btn-label">${STRINGS.HUD.voiceLabel}</span>
      </button>

      <button type="button" id="btn-hud-menu" class="kid-btn hud-action-btn hud-btn-menu" aria-label="${STRINGS.HUD.menuAria}">
        <span class="btn-badge" id="badge-hud-chaos" hidden>\uD83C\uDFB2</span>
        <span class="btn-icon" aria-hidden="true">\u23F8</span>
        <span class="btn-label">${STRINGS.HUD.menuLabel}</span>
      </button>

      <button type="button" id="btn-hud-jump" class="kid-btn hud-action-btn hud-btn-jump" aria-label="${STRINGS.HUD.jumpAria}">
        <span class="btn-badge" id="badge-hud-jump">UP!</span>
        <span class="btn-icon" aria-hidden="true">\uD83E\uDD98</span>
        <span class="btn-label" id="label-hud-jump">${STRINGS.HUD.jumpLabel}</span>
      </button>

      <button type="button" id="btn-hud-drum" class="kid-btn hud-action-btn hud-btn-drum" aria-label="${STRINGS.HUD.drumAria}">
        <span class="btn-badge" id="badge-hud-drum">1/3</span>
        <span class="btn-icon" aria-hidden="true">\uD83E\uDD41</span>
        <span class="btn-label">${STRINGS.HUD.drumLabel}</span>
      </button>
    </div>
  `;

  const gemsPill = root.querySelector('#hud-gems-pill');
  const gemsValEl = root.querySelector('#hud-gems-val');
  const weaponImgEl = root.querySelector('#hud-weapon-img');
  const powerValEl = root.querySelector('#hud-power-val');
  const gearIconsEl = root.querySelector('#hud-gear-icons');
  const shieldsPill = root.querySelector('#hud-shields-pill');
  const shieldsRowEl = root.querySelector('#hud-shields-row');
  const trophyPips = Array.from(root.querySelectorAll('.trophy-pip'));
  const trophiesValEl = root.querySelector('#hud-trophies-val');

  const spinBtn = root.querySelector('#btn-hud-spin');
  const spinBadgeEl = root.querySelector('#badge-hud-spin');
  const potBtn = root.querySelector('#btn-hud-totem');
  const potBadgeEl = root.querySelector('#badge-hud-totem');
  const potLabelEl = root.querySelector('#label-hud-totem');
  const voiceBtn = root.querySelector('#btn-hud-voice');
  const menuBtn = root.querySelector('#btn-hud-menu');
  const chaosBadgeEl = root.querySelector('#badge-hud-chaos');
  const jumpBtn = root.querySelector('#btn-hud-jump');
  const jumpBadgeEl = root.querySelector('#badge-hud-jump');
  const jumpLabelEl = root.querySelector('#label-hud-jump');
  const drumBtn = root.querySelector('#btn-hud-drum');
  const drumBadgeEl = root.querySelector('#badge-hud-drum');

  let lastGems = -1;
  let lastWeaponId = null;
  let lastHeartsKey = '';
  let gemPopTimer = 0;
  let drumHeld = false;
  let drumHoldTimer = 0;

  // Set default weapon icon immediately so <img> never shows broken state.
  weaponImgEl.src = resolveWeaponIconUrl('wooden_kentungan_bat', ctx);

  function triggerDrumBtnSwing(fromHold = false) {
    ctx.audio?.unlock?.();
    if (typeof ctx.actions?.swingDrum === 'function') {
      ctx.actions.swingDrum({ fromHold, fromButton: true });
    }
  }

  const onDrumPointerDown = (e) => {
    if (e && typeof e.button === 'number' && e.button !== 0) return;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    drumHeld = true;
    drumHoldTimer = 0;
    drumBtn.classList.add('is-pressed');
    triggerDrumBtnSwing(false);
  };
  const stopDrumHold = () => {
    if (!drumHeld) return;
    drumHeld = false;
    drumHoldTimer = 0;
    drumBtn.classList.remove('is-pressed');
  };
  drumBtn.addEventListener('pointerdown', onDrumPointerDown);
  drumBtn.addEventListener('pointerup', stopDrumHold);
  drumBtn.addEventListener('pointercancel', stopDrumHold);
  drumBtn.addEventListener('pointerleave', stopDrumHold);
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerup', stopDrumHold);
    window.addEventListener('blur', stopDrumHold);
  }

  const unbinds = [
    bindTap(
      spinBtn,
      () => {
        ctx.audio?.unlock?.();
        if (typeof ctx.actions?.openRoulette === 'function') {
          ctx.actions.openRoulette();
        } else if (ctx.rouletteModal?.open) {
          ctx.rouletteModal.open();
          ctx.voice?.speak?.('fairy_chest_open', { priority: 'interrupt' });
        } else if (typeof ctx.actions?.spinChest === 'function') {
          ctx.actions.spinChest();
        }
      },
      280
    ),
    bindTap(
      potBtn,
      () => {
        ctx.audio?.unlock?.();
        const { allMaxed, canPlant } = getPadsInfo(ctx.state, ctx);
        if (allMaxed) {
          ctx.voice?.speak?.('fairy_pot_max', { priority: 'ifIdle' });
          return;
        }
        if (!canPlant) {
          potBtn.classList.remove('is-shake');
          void potBtn.offsetWidth;
          potBtn.classList.add('is-shake');
          ctx.voice?.speak?.('fairy_need_stars', { priority: 'interrupt' });
          return;
        }
        if (typeof ctx.actions?.plantPot === 'function') {
          ctx.actions.plantPot();
        } else if (typeof ctx.onPlantPot === 'function') {
          ctx.onPlantPot();
        } else if (typeof ctx.flowerpots?.plantOrUpgrade === 'function') {
          ctx.flowerpots.plantOrUpgrade();
        }
      },
      280
    ),
    bindTap(
      voiceBtn,
      () => {
        ctx.audio?.unlock?.();
        if (typeof ctx.actions?.replayVoice === 'function') {
          ctx.actions.replayVoice();
        } else if (typeof ctx.onReplayVoice === 'function') {
          ctx.onReplayVoice();
        } else {
          ctx.voice?.replayLast?.();
        }
      },
      280
    ),
    bindTap(
      menuBtn,
      () => {
        ctx.audio?.unlock?.();
        if (typeof ctx.actions?.openPause === 'function') {
          ctx.actions.openPause();
        } else if (ctx.pauseModal?.open) {
          ctx.pauseModal.open();
        } else if (ctx.state) {
          ctx.state.mode = 'paused';
        }
      },
      280
    ),
    bindTap(
      jumpBtn,
      () => {
        ctx.audio?.unlock?.();
        if (typeof ctx.actions?.jump === 'function') {
          ctx.actions.jump({ fromButton: true });
        }
      },
      140
    ),
  ];

  function show() {
    root.hidden = false;
  }

  function hide() {
    root.hidden = true;
  }

  function update(dt = 1 / 60, state = ctx.state, modalOpen = false, guideGoalKind = null) {
    if (!state) return;

    const shouldShow = state.mode === 'playing' && !modalOpen;
    if (shouldShow && root.hidden) {
      show();
    } else if (!shouldShow && !root.hidden) {
      hide();
    }
    if (!shouldShow) return;

    const p = state.player || {};
    const gems = Math.max(0, Math.floor(Number(p.starGems) || 0));
    if (gems !== lastGems) {
      if (lastGems >= 0 && gems > lastGems) {
        gemPopTimer = 0.22;
      }
      lastGems = gems;
      gemsValEl.textContent = String(gems);
    }

    if (gemPopTimer > 0) {
      gemPopTimer = Math.max(0, gemPopTimer - (Number(dt) || 1 / 60));
      gemsPill.classList.add('is-pop');
    } else {
      gemsPill.classList.remove('is-pop');
    }

    const wId = resolveWeaponId(p.weaponId || 'wooden_kentungan_bat');
    if (wId !== lastWeaponId) {
      lastWeaponId = wId;
      weaponImgEl.src = resolveWeaponIconUrl(wId, ctx);
    }

    const powerTier = Math.max(1, Math.min(5, Number(p.powerTier) || 1));
    powerValEl.textContent = formatTierBadge(powerTier);

    const gearIcons = [];
    if (p.helmet) gearIcons.push('\uD83E\uDE96');
    if (p.speedBoots) gearIcons.push('\uD83E\uDEBD');
    if (p.starCape) gearIcons.push('\uD83E\uDDE3');
    gearIconsEl.textContent = gearIcons.join('');

    const hearts = Math.max(0, Math.min(5, Math.floor(Number(p.shieldHearts) || 0)));
    const hasHelmet = Boolean(p.helmet);
    const heartsKey = `${hearts}:${hasHelmet ? 1 : 0}`;
    if (heartsKey !== lastHeartsKey) {
      lastHeartsKey = heartsKey;
      shieldsPill.hidden = hearts <= 0;
      shieldsPill.classList.toggle('is-rainbow', hasHelmet || hearts >= 5);
      const heartGlyph = hasHelmet ? '\uD83D\uDC9C' : '\uD83D\uDC96';
      shieldsRowEl.textContent = heartGlyph.repeat(hearts);
    }

    let trophyCount = 0;
    for (const pip of trophyPips) {
      const tId = pip.dataset.titan;
      const won = hasTrophy(state, tId);
      if (won) trophyCount += 1;
      pip.classList.toggle('is-unlocked', won);
    }
    trophiesValEl.textContent = `${trophyCount}/4`;

    // Update 6 HUD Action Buttons + P2-5 Guide Arrow pulse-ring coordination!
    const { freeSpins, spinCost, canSpin, weaponTier } = getSpinInfo(state, ctx);
    if (freeSpins > 0) {
      spinBadgeEl.textContent = STRINGS.HUD.spinFree;
    } else if (weaponTier >= 5) {
      spinBadgeEl.textContent = formatStarCost(spinCost);
    } else {
      spinBadgeEl.textContent = formatStarCost(spinCost);
    }
    const pulseSpin =
      (canSpin && weaponTier < 5) || freeSpins > 0 || guideGoalKind === 'chest';
    spinBtn.classList.toggle('is-pulsing', pulseSpin);
    spinBtn.classList.toggle('is-ready-gold', canSpin);

    const { plantedCount, allMaxed, nextCost, potSeeds, canPlant } = getPadsInfo(state, ctx);
    if (allMaxed) {
      potLabelEl.textContent = STRINGS.HUD.potMaxLabel;
      potBadgeEl.textContent = '4/4';
    } else {
      potLabelEl.textContent =
        plantedCount < 4 ? STRINGS.HUD.potPlantLabel : STRINGS.HUD.potGrowLabel;
      potBadgeEl.textContent =
        potSeeds > 0 ? `\uD83C\uDF31${potSeeds}` : formatStarCost(nextCost);
    }
    const pulsePot = canPlant || guideGoalKind === 'pad';
    potBtn.classList.toggle('is-pulsing', pulsePot);
    potBtn.classList.toggle('is-ready-green', canPlant);

    const speaking = Boolean(
      state.voice?.speaking ??
        ctx.voice?.getState?.()?.speaking ??
        ctx.voice?.isSpeaking?.()
    );
    voiceBtn.classList.toggle('is-speaking', speaking);

    chaosBadgeEl.hidden = !state.chaosMode;

    if (jumpBadgeEl && jumpLabelEl) {
      const isAir = Boolean(p.jumping || p.airborne || p.grounded === false);
      const stickActive = Boolean(state.stickThrow?.active);
      jumpBadgeEl.textContent = stickActive ? 'FLY!' : isAir ? 'AIR!' : 'UP!';
      jumpLabelEl.textContent = isAir && !stickActive ? STRINGS.HUD.jumpAirLabel : STRINGS.HUD.jumpLabel;
    }

    if (drumHeld) {
      drumHoldTimer += Math.max(0, Number(dt) || 1 / 60);
      const intervalSec = MOVEMENT_TUNING.swingIntervalSec || 0.30;
      while (drumHoldTimer >= intervalSec) {
        drumHoldTimer -= intervalSec;
        triggerDrumBtnSwing(true);
      }
    }

    const beat = Math.max(1, Math.min(3, Number(p.comboBeat) || 1));
    drumBadgeEl.textContent = beat === 3 ? 'SAHUR!' : `${beat}/3`;
    drumBtn.classList.toggle('is-pulsing', guideGoalKind === 'starter' || guideGoalKind === 'titan');
  }

  function destroy() {
    drumBtn.removeEventListener('pointerdown', onDrumPointerDown);
    drumBtn.removeEventListener('pointerup', stopDrumHold);
    drumBtn.removeEventListener('pointercancel', stopDrumHold);
    drumBtn.removeEventListener('pointerleave', stopDrumHold);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', stopDrumHold);
      window.removeEventListener('blur', stopDrumHold);
    }
    for (const u of unbinds) u();
  }

  return {
    el: root,
    spinBtn,
    potBtn,
    totemBtn: potBtn,
    voiceBtn,
    menuBtn,
    jumpBtn,
    drumBtn,
    show,
    hide,
    update,
    destroy,
  };
}

/**
 * Unified Kid UI Facade orchestrating Title, HUD, Roulette Modal, Boss Banner,
 * Comic Popups, Pause Sheet, Victory Podium, and 3D Bouncing Guide Arrow.
 */
export function createUI(ctx = {}) {
  const sharedCtx = ctx;

  const title = createTitleScreen(sharedCtx);
  const rouletteModal = createRouletteModal(sharedCtx);
  const pauseModal = createPauseModal(sharedCtx);
  const victoryModal = createVictoryModal(sharedCtx);
  const bossBanner = createBossBanner(sharedCtx);
  const guideArrow = sharedCtx.scene ? createGuideArrow(sharedCtx) : null;

  sharedCtx.rouletteModal = rouletteModal;
  sharedCtx.pauseModal = pauseModal;
  sharedCtx.victoryModal = victoryModal;
  sharedCtx.bossBanner = bossBanner;
  sharedCtx.guideArrow = guideArrow;

  const hud = createHud(sharedCtx);

  function isAnyOverlayOpen(state = sharedCtx.state) {
    return Boolean(
      state?.mode === 'title' ||
        state?.mode === 'roulette' ||
        state?.mode === 'paused' ||
        state?.mode === 'victory' ||
        title.isVisible() ||
        rouletteModal.isOpen() ||
        pauseModal.isOpen() ||
        victoryModal.isOpen()
    );
  }

  function update(dt = 1 / 60, time = 0, state = sharedCtx.state) {
    const s = state || sharedCtx.state;
    if (!s) return;

    title.update(s);
    rouletteModal.update(dt, s);
    pauseModal.update(s);
    victoryModal.update(s);

    const modalOnlyOpen =
      rouletteModal.isOpen() || pauseModal.isOpen() || victoryModal.isOpen();
    const anyOverlay = isAnyOverlayOpen(s);

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('ui-modal-open', anyOverlay);
    }

    let goalKind = null;
    if (guideArrow) {
      guideArrow.setVisible(s.mode !== 'victory');
      guideArrow.update(dt, time, s);
      goalKind = guideArrow.getCurrentGoal()?.kind || null;
    } else {
      goalKind = selectKidGuideGoal(s, sharedCtx)?.kind || null;
    }

    hud.update(dt, s, modalOnlyOpen, goalKind);
    bossBanner.update(dt, s, modalOnlyOpen);
    sharedCtx.voice?.positionSubtitle?.();
  }

  function reset() {
    rouletteModal.close();
    pauseModal.close();
    victoryModal.resetDismissed();
    victoryModal.close();
    bossBanner.hide();
  }

  function destroy() {
    title.destroy();
    hud.destroy();
    rouletteModal.destroy();
    pauseModal.destroy();
    victoryModal.destroy();
    bossBanner.destroy();
    guideArrow?.destroy();
  }

  return {
    title,
    hud,
    rouletteModal,
    pauseModal,
    victoryModal,
    bossBanner,
    guideArrow,
    spawnComicBurst: bossBanner.spawnComicBurst,
    spawnComicBurstWorld: bossBanner.spawnComicBurstWorld,
    openRoulette: () => rouletteModal.open(),
    closeRoulette: () => rouletteModal.close(),
    openPause: () => pauseModal.open(),
    closePause: () => pauseModal.close(),
    openVictory: () => victoryModal.open(),
    closeVictory: () => victoryModal.close(),
    isAnyOverlayOpen,
    update,
    reset,
    destroy,
  };
}
