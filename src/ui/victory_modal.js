// Grand 4-Trophy Crown Fireworks Victory Podium Modal (owner: lucky-ui).
// Celebrates defeating all 4 Voxel Titans, with >= 84px buttons for Free Play, Lucky Chaos Mode, and New Map.

import { TITAN_ORDER } from '../data/catalog.js';
import { savePrefs } from '../core/state.js';
import { STRINGS } from '../data/strings.js';
import { bindTap, markModalOpened } from './debounce.js';

export function createVictoryModal(ctx = {}) {
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
      resetDismissed() {},
      update() {},
      destroy() {},
    };
  }

  let modal = document.getElementById('victory-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'victory-modal';
    layer.appendChild(modal);
  }
  modal.className = 'ui-modal victory-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', STRINGS.VICTORY.title);

  const trophyBadgesHtml = TITAN_ORDER.map((id) => {
    const t = STRINGS.TITANS[id] || { icon: '\uD83C\uDFC6', badge: 'TITAN' };
    return `
      <div class="victory-trophy-card" data-titan="${id}">
        <span class="victory-trophy-cup" aria-hidden="true">\uD83C\uDFC6</span>
        <span class="victory-trophy-icon" aria-hidden="true">${t.icon}</span>
        <span class="victory-trophy-name">${t.badge}</span>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="ui-modal-card victory-card">
      <div class="victory-kicker">${STRINGS.VICTORY.crownBadge}</div>
      <div class="victory-header-row">
        <span class="victory-crown" aria-hidden="true">\uD83D\uDC51</span>
        <h2 class="victory-title">${STRINGS.VICTORY.title}</h2>
        <span class="victory-crown" aria-hidden="true">\uD83C\uDF86</span>
      </div>
      <div class="victory-trophies-row" aria-hidden="true">
        ${trophyBadgesHtml}
      </div>
      <div class="modal-actions-row victory-actions-row">
        <button type="button" id="btn-victory-continue" class="kid-btn kid-btn-emerald victory-btn-main is-pulsing" aria-label="${STRINGS.VICTORY.playMoreAria}">
          <span class="btn-icon" aria-hidden="true">\u25B6</span>
          <span class="btn-label">${STRINGS.VICTORY.playMoreBtn}</span>
        </button>
        <button type="button" id="btn-victory-chaos" class="kid-btn kid-btn-purple victory-btn-sub" aria-label="${STRINGS.VICTORY.chaosAria}">
          <span class="btn-icon" aria-hidden="true">\uD83C\uDFB2</span>
          <span class="btn-label" id="label-victory-chaos">${STRINGS.VICTORY.chaosOffBtn}</span>
        </button>
        <button type="button" id="btn-victory-new" class="kid-btn kid-btn-gold victory-btn-sub" aria-label="${STRINGS.VICTORY.newIslandAria}">
          <span class="btn-icon" aria-hidden="true">\uD83C\uDFDD\uFE0F</span>
          <span class="btn-label">${STRINGS.VICTORY.newIslandBtn}</span>
        </button>
      </div>
    </div>
  `;

  const continueBtn = modal.querySelector('#btn-victory-continue');
  const chaosBtn = modal.querySelector('#btn-victory-chaos');
  const chaosLabel = modal.querySelector('#label-victory-chaos');
  const newBtn = modal.querySelector('#btn-victory-new');

  let localOpen = false;
  let dismissedForCurrentSeed = null;

  function syncChaos(state = ctx.state) {
    const chaosOn = Boolean(state?.chaosMode);
    chaosBtn.classList.toggle('is-on', chaosOn);
    chaosBtn.setAttribute('aria-pressed', chaosOn ? 'true' : 'false');
    chaosLabel.textContent = chaosOn ? STRINGS.VICTORY.chaosOnBtn : STRINGS.VICTORY.chaosOffBtn;
  }

  function open() {
    localOpen = true;
    modal.hidden = false;
    markModalOpened(280);
    syncChaos(ctx.state);
  }

  function close() {
    localOpen = false;
    modal.hidden = true;
  }

  function resetDismissed() {
    dismissedForCurrentSeed = null;
  }

  function isOpen() {
    return !modal.hidden && localOpen;
  }

  const unbinds = [
    bindTap(
      continueBtn,
      () => {
        if (ctx.state) {
          dismissedForCurrentSeed = ctx.state.seed;
          if (ctx.state.mode === 'victory') {
            ctx.state.mode = 'playing';
          }
        }
        close();
        if (typeof ctx.actions?.continueFreePlay === 'function') {
          ctx.actions.continueFreePlay();
        } else {
          ctx.voice?.speak?.('vo_keep_playing', { priority: 'interrupt' });
        }
      },
      { debounceMs: 280, guardModalOpen: true }
    ),
    bindTap(chaosBtn, () => {
      const next = !Boolean(ctx.state?.chaosMode);
      savePrefs({ chaosMode: next });
      if (ctx.state) {
        ctx.state.chaosMode = next;
      }
      if (typeof ctx.actions?.toggleChaos === 'function') {
        ctx.actions.toggleChaos(next);
      } else if (typeof ctx.setChaosMode === 'function') {
        ctx.setChaosMode(next);
      }
      if (next) {
        ctx.voice?.speak?.('vo_chaos_on', { priority: 'interrupt' });
      }
      syncChaos(ctx.state);
    }),
    bindTap(
      newBtn,
      () => {
        dismissedForCurrentSeed = null;
        close();
        if (typeof ctx.actions?.newIsland === 'function') {
          ctx.actions.newIsland();
        } else if (typeof ctx.startGame === 'function') {
          const nextSeed = ((Number(ctx.state?.seed) || 2026) + 1) >>> 0;
          ctx.startGame({ seed: nextSeed, chaosMode: Boolean(ctx.state?.chaosMode) });
        }
      },
      { debounceMs: 280, guardModalOpen: true }
    ),
  ];

  function update(state = ctx.state) {
    if (!state) return;
    if (dismissedForCurrentSeed !== null && state.trophies?.length < 4) {
      dismissedForCurrentSeed = null;
    }

    if (state.mode === 'victory') {
      if (!localOpen && dismissedForCurrentSeed !== state.seed) {
        open();
      }
      syncChaos(state);
    } else if (localOpen) {
      close();
    }
  }

  function destroy() {
    for (const u of unbinds) u();
  }

  return {
    el: modal,
    open,
    close,
    isOpen,
    resetDismissed,
    update,
    destroy,
  };
}
