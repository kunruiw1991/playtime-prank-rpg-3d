// Mystery Artifact Roulette Chest Modal (owner: lucky-ui).
// Inspired by 02:24-02:52 of the source video: horizontal illustrated weapon reel scrolling
// through a golden circular spotlight lens over ~2.4s cubic ease-out, auto-equipping on win.

import { ROULETTE_COSTS, WEAPONS, WEAPON_ORDER, resolveWeaponId } from '../data/catalog.js';
import { STRINGS, formatStarCost, formatTierBadge } from '../data/strings.js';
import { bindTap, markModalOpened } from './debounce.js';

const REEL_LENGTH = 30;
const WIN_CARD_INDEX = 24;
const START_CARD_INDEX = 2;

const PIXEL_ICON_CACHE = new Map();

// Crisp 16x16 pixel-art SVG dataURL fallback per weapon (zero <text> or 2D canvas fillText).
function buildPixelWeaponSvg(rawWeaponId) {
  const weaponId = resolveWeaponId(rawWeaponId || 'wooden_kentungan_bat');
  if (PIXEL_ICON_CACHE.has(weaponId)) {
    return PIXEL_ICON_CACHE.get(weaponId);
  }

  const px = (rects) =>
    rects
      .map(([x, y, w, h, fill]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`)
      .join('');

  let art = '';
  switch (weaponId) {
    case 'wooden_kentungan_bat':
    case 'wood_stick':
      art = px([
        [3, 11, 2, 2, '#6b4226'],
        [5, 9, 2, 2, '#8b5a2b'],
        [7, 7, 2, 2, '#a66e38'],
        [9, 5, 2, 2, '#b87c44'],
        [11, 3, 2, 2, '#c98d52'],
        [8, 2, 3, 2, '#51cf66'],
        [7, 4, 2, 1, '#37b24d'],
      ]);
      break;
    case 'bronze_temple_gong':
    case 'sparkle_sword':
    case 'gold_pickaxe':
      art = px([
        [2, 12, 2, 2, '#d97706'],
        [4, 10, 2, 2, '#8b5a2b'],
        [3, 8, 5, 2, '#ffd43b'],
        [6, 8, 2, 4, '#f59f00'],
        [6, 3, 6, 6, '#e67700'],
        [7, 4, 4, 4, '#ffd43b'],
        [8, 5, 2, 2, '#fff9db'],
      ]);
      break;
    case 'golden_sahur_mallet':
    case 'ocean_trident':
      art = px([
        [2, 12, 2, 2, '#b86200'],
        [4, 10, 2, 2, '#d97706'],
        [6, 8, 2, 2, '#f59f00'],
        [6, 2, 7, 5, '#ffd43b'],
        [7, 3, 5, 3, '#fff3bf'],
        [8, 4, 3, 2, '#39d5ff'],
      ]);
      break;
    case 'neon_thunder_taiko':
    case 'thunder_hammer':
      art = px([
        [2, 12, 2, 2, '#5f3dc4'],
        [4, 10, 2, 2, '#7048e8'],
        [6, 8, 2, 2, '#7950f2'],
        [6, 2, 7, 5, '#845ef7'],
        [7, 3, 5, 3, '#3bc9db'],
        [9, 3, 2, 3, '#ffe066'],
        [5, 3, 1, 4, '#5f3dc4'],
        [13, 3, 1, 4, '#5f3dc4'],
      ]);
      break;
    case 'rainbow_mega_hammer':
    case 'rainbow_blade':
    default:
      art = px([
        [2, 12, 2, 2, '#ffd43b'],
        [4, 10, 2, 2, '#fab005'],
        [3, 8, 5, 2, '#ff6b9d'],
        [6, 8, 2, 4, '#cc5de8'],
        [6, 6, 2, 2, '#ff6b6b'],
        [7, 5, 2, 2, '#ffd43b'],
        [8, 4, 2, 2, '#51cf66'],
        [9, 3, 2, 2, '#39d5ff'],
        [10, 2, 3, 3, '#cc5de8'],
        [12, 1, 2, 2, '#ffffff'],
      ]);
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${art}</svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  PIXEL_ICON_CACHE.set(weaponId, url);
  return url;
}

export function resolveWeaponIconUrl(rawWeaponId, ctx = {}) {
  const weaponId = resolveWeaponId(rawWeaponId || 'wooden_kentungan_bat');
  const custom =
    ctx.getWeaponIcon?.(weaponId) ||
    ctx.renderWeaponIconDataURL?.(weaponId, 96) ||
    null;
  return custom || buildPixelWeaponSvg(weaponId);
}

function computeSpinCost(state, ctx) {
  if (typeof ctx.roulette?.getSpinCost === 'function') {
    return Math.max(0, Number(ctx.roulette.getSpinCost()) || 0);
  }
  const freeSpins = Number(state?.player?.freeSpins) || 0;
  if (freeSpins > 0) return 0;
  if (state?.roulette?.spinCost !== undefined) {
    return Math.max(0, Number(state.roulette.spinCost) || 0);
  }
  const spinsCount = Number(state?.roulette?.spinsCount) || 0;
  return ROULETTE_COSTS[Math.min(spinsCount, ROULETTE_COSTS.length - 1)];
}

function computeCanSpin(state, ctx, spinCost) {
  if (typeof ctx.roulette?.canSpin === 'function') {
    return Boolean(ctx.roulette.canSpin());
  }
  const freeSpins = Number(state?.player?.freeSpins) || 0;
  const gems = Number(state?.player?.starGems) || 0;
  return freeSpins > 0 || gems >= spinCost;
}

export function createRouletteModal(ctx = {}) {
  const layer =
    (typeof document !== 'undefined' &&
      (document.getElementById('ui-layer') || document.body)) ||
    null;

  if (!layer) {
    return {
      el: null,
      open() {},
      close() {},
      isOpen: () => false,
      update() {},
      destroy() {},
    };
  }

  let modal = document.getElementById('roulette-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'roulette-modal';
    layer.appendChild(modal);
  }
  modal.className = 'ui-modal roulette-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', STRINGS.ROULETTE.title);

  modal.innerHTML = `
    <div class="ui-modal-card roulette-card">
      <div class="roulette-confetti" id="roulette-confetti" aria-hidden="true"></div>
      <div class="roulette-top-bar">
        <div class="roulette-title-wrap">
          <span class="modal-title-icon" aria-hidden="true">\uD83C\uDF81</span>
          <h2 class="modal-title">${STRINGS.ROULETTE.title}</h2>
        </div>
        <div class="roulette-stars-pill" id="roulette-stars-pill" aria-hidden="true">
          <span class="pill-star-icon">\u2B50</span>
          <span id="roulette-stars-val">0</span>
        </div>
      </div>

      <div class="roulette-hint" id="roulette-hint">${STRINGS.ROULETTE.hintReady}</div>

      <div class="roulette-stage" id="roulette-stage">
        <div class="roulette-spotlight-circle" aria-hidden="true"></div>
        <div class="roulette-pointer-top" aria-hidden="true">\u25BC</div>
        <div class="roulette-pointer-line" aria-hidden="true"></div>
        <div class="roulette-viewport" id="roulette-viewport">
          <div class="roulette-strip" id="roulette-strip"></div>
        </div>
        <div class="roulette-pointer-bottom" aria-hidden="true">\u25B2</div>
      </div>

      <div class="modal-actions-row roulette-actions-row">
        <button type="button" id="btn-roulette-spin" class="kid-btn kid-btn-gold roulette-spin-btn is-pulsing" aria-label="${STRINGS.ROULETTE.spinAria}">
          <span class="btn-icon" id="icon-roulette-spin" aria-hidden="true">\uD83C\uDFB0</span>
          <span class="btn-label" id="label-roulette-spin">${STRINGS.ROULETTE.spinBtn}</span>
          <span class="btn-badge" id="badge-roulette-cost">\u2B508</span>
        </button>
        <button type="button" id="btn-roulette-close" class="kid-btn kid-btn-sky roulette-close-btn" aria-label="${STRINGS.ROULETTE.closeAria}">
          <span class="btn-icon" aria-hidden="true">\u2716</span>
          <span class="btn-label">${STRINGS.ROULETTE.closeBtn}</span>
        </button>
      </div>
    </div>
  `;

  const cardEl = modal.querySelector('.roulette-card');
  const confettiEl = modal.querySelector('#roulette-confetti');
  const starsValEl = modal.querySelector('#roulette-stars-val');
  const hintEl = modal.querySelector('#roulette-hint');
  const viewportEl = modal.querySelector('#roulette-viewport');
  const stripEl = modal.querySelector('#roulette-strip');
  const spinBtn = modal.querySelector('#btn-roulette-spin');
  const spinIconEl = modal.querySelector('#icon-roulette-spin');
  const spinLabelEl = modal.querySelector('#label-roulette-spin');
  const spinBadgeEl = modal.querySelector('#badge-roulette-cost');
  const closeBtn = modal.querySelector('#btn-roulette-close');

  let localOpen = false;
  let phase = 'ready'; // 'ready' | 'spinning' | 'won'
  let reelWeaponIds = [];
  let reelEls = [];
  let activeWinnerId = 'bronze_temple_gong';
  let spinStartRawTimer = 0;
  let lastTickIdx = -1;
  let currentFloatIdx = START_CARD_INDEX;
  let wasExternalSpinning = false;

  // Pool comprises exciting Tier 2..5 drum-clubs so the spinning reel looks dazzling.
  const REEL_POOL = WEAPON_ORDER.filter((id) => id !== 'wooden_kentungan_bat');

  function buildReel(winnerWeaponId = 'bronze_temple_gong', seedOffset = 0) {
    const resolved = resolveWeaponId(winnerWeaponId);
    const cleanWinner = WEAPONS[resolved] ? resolved : 'bronze_temple_gong';
    activeWinnerId = cleanWinner;
    reelWeaponIds = [];

    for (let i = 0; i < REEL_LENGTH; i += 1) {
      if (i === WIN_CARD_INDEX) {
        reelWeaponIds.push(cleanWinner);
      } else {
        let pick = REEL_POOL[(i * 7 + seedOffset * 3 + 1) % REEL_POOL.length];
        if (i === WIN_CARD_INDEX - 1 && pick === cleanWinner) {
          pick = REEL_POOL[(REEL_POOL.indexOf(pick) + 1) % REEL_POOL.length];
        }
        reelWeaponIds.push(pick);
      }
    }

    stripEl.innerHTML = '';
    reelEls = reelWeaponIds.map((wId, idx) => {
      const wSpec = WEAPONS[wId] || WEAPONS.bronze_temple_gong;
      const wCopy = STRINGS.WEAPONS[wId] || { short: wSpec.shortName || 'GONG' };
      const item = document.createElement('div');
      item.className = 'roulette-item-card';
      item.dataset.weaponId = wId;
      item.dataset.reelIdx = String(idx);
      item.style.setProperty('--wpn-color', wSpec.color || '#ffd43b');
      item.style.setProperty('--wpn-accent', wSpec.accentColor || '#fff3bf');
      const iconUrl = resolveWeaponIconUrl(wId, ctx);
      item.innerHTML = `
        <span class="roulette-item-tier">${formatTierBadge(wSpec.tier)}</span>
        <img class="roulette-item-img" src="${iconUrl}" alt="" draggable="false" />
        <span class="roulette-item-name">${wCopy.short}</span>
      `;
      stripEl.appendChild(item);
      return item;
    });
  }

  function applyReelPosition(floatIndex) {
    currentFloatIdx = floatIndex;
    const firstCard = reelEls[0];
    const secondCard = reelEls[1];
    const vpWidth = viewportEl.clientWidth || 320;
    const cardWidth = firstCard ? firstCard.offsetWidth || 100 : 100;
    const stride =
      firstCard && secondCard
        ? Math.max(80, secondCard.offsetLeft - firstCard.offsetLeft)
        : cardWidth + 12;

    const targetCenter = floatIndex * stride + cardWidth * 0.5;
    const translateX = vpWidth * 0.5 - targetCenter;
    stripEl.style.transform = `translate3d(${translateX.toFixed(1)}px, 0, 0)`;

    const activeIdx = Math.round(floatIndex);
    for (let i = 0; i < reelEls.length; i += 1) {
      reelEls[i].classList.toggle('is-center', i === activeIdx);
      reelEls[i].classList.toggle('is-winner', phase === 'won' && i === WIN_CARD_INDEX);
    }
  }

  function burstConfetti() {
    confettiEl.innerHTML = '';
    const colors = ['#ffd43b', '#51cf66', '#39d5ff', '#ff6b9d', '#cc5de8', '#ff922b'];
    for (let i = 0; i < 16; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'confetti-bit';
      const angle = (i / 16) * Math.PI * 2;
      const dist = 64 + (i % 3) * 28;
      dot.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      dot.style.setProperty('--dy', `${Math.sin(angle) * dist - 14}px`);
      dot.style.background = colors[i % colors.length];
      confettiEl.appendChild(dot);
    }
  }

  function pickPreviewWeapon(state) {
    const nextTier = Math.min(5, (Number(state?.player?.weaponTier) || 1) + 1);
    const match = WEAPON_ORDER.find((id) => WEAPONS[id].tier === nextTier);
    return match || 'rainbow_mega_hammer';
  }

  function open() {
    localOpen = true;
    phase = 'ready';
    modal.hidden = false;
    confettiEl.innerHTML = '';
    markModalOpened(280);
    if (ctx.state) {
      ctx.state.roulette.open = true;
      if (ctx.state.mode === 'playing') {
        ctx.state.mode = 'roulette';
      }
    }
    ctx.roulette?.openModal?.();
    const previewId =
      ctx.state?.roulette?.selectedWeaponId || pickPreviewWeapon(ctx.state);
    buildReel(previewId, Number(ctx.state?.roulette?.spinsCount) || 0);
    applyReelPosition(START_CARD_INDEX);
    syncControls(ctx.state);
  }

  function close() {
    if (phase === 'spinning' && ctx.state?.roulette?.spinning) {
      return;
    }
    localOpen = false;
    phase = 'ready';
    modal.hidden = true;
    confettiEl.innerHTML = '';
    if (ctx.state) {
      ctx.state.roulette.open = false;
      if (ctx.state.mode === 'roulette') {
        ctx.state.mode = 'playing';
      }
    }
    ctx.roulette?.closeModal?.();
    ctx.actions?.closeRoulette?.();
  }

  function isOpen() {
    return !modal.hidden && localOpen;
  }

  function syncControls(state = ctx.state) {
    const gems = Math.max(0, Math.floor(Number(state?.player?.starGems) || 0));
    starsValEl.textContent = String(gems);

    const spinCost = computeSpinCost(state, ctx);
    const canSpin = computeCanSpin(state, ctx, spinCost);
    const freeSpins = Number(state?.player?.freeSpins) || 0;

    if (phase === 'spinning') {
      hintEl.textContent = STRINGS.ROULETTE.hintSpinning;
      spinIconEl.textContent = '\u2728';
      spinLabelEl.textContent = STRINGS.ROULETTE.spinningBtn;
      spinBadgeEl.hidden = true;
      spinBtn.className = 'kid-btn kid-btn-gold roulette-spin-btn is-disabled';
      spinBtn.setAttribute('aria-disabled', 'true');
      closeBtn.classList.add('is-disabled');
      closeBtn.setAttribute('aria-disabled', 'true');
      return;
    }

    closeBtn.classList.remove('is-disabled');
    closeBtn.setAttribute('aria-disabled', 'false');
    spinBtn.setAttribute('aria-disabled', 'false');

    if (phase === 'won') {
      const wSpec =
        WEAPONS[resolveWeaponId(activeWinnerId)] ||
        WEAPONS[resolveWeaponId(state?.player?.weaponId)] ||
        WEAPONS.bronze_temple_gong;
      const wCopy = STRINGS.WEAPONS[wSpec.id] || { title: wSpec.name.toUpperCase() };
      hintEl.textContent = `${wCopy.title} ${formatTierBadge(wSpec.tier)} ${STRINGS.ROULETTE.equippedBadge}`;
      spinIconEl.textContent = '\u2728';
      spinLabelEl.textContent = STRINGS.ROULETTE.awesomeBtn;
      spinBadgeEl.hidden = true;
      spinBtn.setAttribute('aria-label', STRINGS.ROULETTE.awesomeAria);
      spinBtn.className = 'kid-btn kid-btn-emerald roulette-spin-btn is-pulsing';
      return;
    }

    // phase === 'ready'
    spinBtn.setAttribute('aria-label', STRINGS.ROULETTE.spinAria);
    spinBadgeEl.hidden = freeSpins > 0 || spinCost <= 0;
    spinBadgeEl.textContent = formatStarCost(spinCost);

    if (freeSpins > 0) {
      hintEl.textContent = STRINGS.ROULETTE.hintFree;
      spinIconEl.textContent = '\uD83C\uDF81';
      spinLabelEl.textContent = STRINGS.ROULETTE.spinFreeBtn;
      spinBtn.className = 'kid-btn kid-btn-gold roulette-spin-btn is-pulsing';
    } else if (canSpin) {
      hintEl.textContent = STRINGS.ROULETTE.hintReady;
      spinIconEl.textContent = '\uD83C\uDFB0';
      spinLabelEl.textContent = STRINGS.ROULETTE.spinBtn;
      spinBtn.className = 'kid-btn kid-btn-gold roulette-spin-btn is-pulsing';
    } else {
      hintEl.textContent = STRINGS.ROULETTE.hintNeedStars;
      spinIconEl.textContent = '\uD83C\uDFB0';
      spinLabelEl.textContent = STRINGS.ROULETTE.spinBtn;
      spinBtn.className = 'kid-btn kid-btn-gold roulette-spin-btn is-dimmed';
    }
  }

  function beginSpinVisual(state) {
    const r = state?.roulette || {};
    const targetId =
      r.selectedWeaponId ||
      r.targetWeaponId ||
      r.winnerId ||
      pickPreviewWeapon(state);
    phase = 'spinning';
    confettiEl.innerHTML = '';
    cardEl.classList.remove('is-won');
    spinStartRawTimer = Number(r.spinTimer) || 0;
    lastTickIdx = START_CARD_INDEX;
    buildReel(targetId, Number(r.spinsCount) || 0);
    applyReelPosition(START_CARD_INDEX);
    syncControls(state);
  }

  function settleSpinVisual(state) {
    const r = state?.roulette || {};
    const finalWeaponId =
      r.selectedWeaponId ||
      r.targetWeaponId ||
      r.winnerId ||
      state?.player?.weaponId ||
      activeWinnerId;
    if (finalWeaponId && finalWeaponId !== activeWinnerId) {
      buildReel(finalWeaponId, Number(r.spinsCount) || 0);
    }
    phase = 'won';
    cardEl.classList.add('is-won');
    applyReelPosition(WIN_CARD_INDEX);
    burstConfetti();
    syncControls(state);
  }

  const unbindSpin = bindTap(
    spinBtn,
    () => {
      if (phase === 'spinning') return;
      if (phase === 'won') {
        close();
        return;
      }

      const state = ctx.state;
      const spinCost = computeSpinCost(state, ctx);
      const canSpin = computeCanSpin(state, ctx, spinCost);
      if (!canSpin) {
        cardEl.classList.remove('is-shake');
        void cardEl.offsetWidth;
        cardEl.classList.add('is-shake');
        ctx.voice?.speak?.('fairy_need_stars', { priority: 'interrupt' });
        return;
      }

      if (typeof ctx.actions?.spinChest === 'function') {
        ctx.actions.spinChest();
      } else if (typeof ctx.onSpin === 'function') {
        ctx.onSpin();
      } else if (typeof ctx.roulette?.startSpin === 'function') {
        ctx.roulette.startSpin();
      }

      // Immediately sync reel with newly selected weapon if spinning started.
      if (ctx.state?.roulette?.spinning) {
        wasExternalSpinning = true;
        beginSpinVisual(ctx.state);
      } else if (ctx.state) {
        // Instant-mode spin finished synchronously.
        settleSpinVisual(ctx.state);
      }
    },
    280
  );

  const unbindClose = bindTap(
    closeBtn,
    () => {
      if (phase === 'spinning') return;
      close();
    },
    { debounceMs: 280, guardModalOpen: true }
  );

  function update(dt = 1 / 60, state = ctx.state) {
    if (!state) return;
    const r = state.roulette || {};
    const shouldBeOpen = state.mode === 'roulette' || Boolean(r.open);

    if (shouldBeOpen && !localOpen) {
      open();
    } else if (!shouldBeOpen && localOpen && state.mode !== 'playing') {
      localOpen = false;
      modal.hidden = true;
    }

    const extSpinning = Boolean(r.spinning);
    if (extSpinning && !wasExternalSpinning) {
      wasExternalSpinning = true;
      if (!localOpen && shouldBeOpen) open();
      beginSpinVisual(state);
    } else if (!extSpinning && wasExternalSpinning) {
      wasExternalSpinning = false;
      if (localOpen) {
        settleSpinVisual(state);
      }
    }

    if (!localOpen || modal.hidden) return;

    if (extSpinning) {
      // Ensure winning weapon card stays synced if roulette system set selectedWeaponId after open.
      const targetId = r.selectedWeaponId || r.targetWeaponId || r.winnerId;
      if (targetId && targetId !== activeWinnerId && WEAPONS[targetId]) {
        buildReel(targetId, Number(r.spinsCount) || 0);
      }

      const dur = Math.max(0.2, Number(r.spinDuration ?? r.duration) || 2.4);
      let progress = 0;
      if (typeof r.progress === 'number') {
        progress = r.progress;
      } else {
        const rawT = Number(r.spinTimer ?? r.elapsed) || 0;
        // Auto-detect whether roulette.js counts spinTimer DOWN from 2.4 -> 0 or UP from 0 -> 2.4!
        progress = spinStartRawTimer > dur * 0.5 ? 1 - rawT / dur : rawT / dur;
      }
      progress = Math.max(0, Math.min(1, progress));

      // Cubic ease-out deceleration like a real arcade prize wheel.
      const eased = 1 - Math.pow(1 - progress, 3.2);
      const floatIdx =
        START_CARD_INDEX + (WIN_CARD_INDEX - START_CARD_INDEX) * eased;
      applyReelPosition(floatIdx);

      const tickIdx = Math.floor(floatIdx);
      if (tickIdx > lastTickIdx) {
        lastTickIdx = tickIdx;
        if (!r.emitsOwnTicks && r.tickIndex === undefined) {
          ctx.sfx?.rouletteTick?.(tickIdx - START_CARD_INDEX);
        }
      }
    } else {
      applyReelPosition(phase === 'won' ? WIN_CARD_INDEX : currentFloatIdx);
    }

    syncControls(state);
  }

  function destroy() {
    unbindSpin();
    unbindClose();
  }

  return {
    el: modal,
    open,
    close,
    isOpen,
    update,
    destroy,
  };
}
