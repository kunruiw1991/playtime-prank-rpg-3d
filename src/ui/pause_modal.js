// Kid-Friendly Pause & Settings Sheet (owner: lucky-ui).
// Big >= 76x76 px visual icon tiles (>= 34px icons) for Music, Sound, Voice, Lucky Chaos Mode, Resume & New Island.

import { loadPrefs, savePrefs } from '../core/state.js';
import { STRINGS } from '../data/strings.js';
import { bindTap, markModalOpened } from './debounce.js';

export function createPauseModal(ctx = {}) {
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

  let modal = document.getElementById('pause-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pause-modal';
    layer.appendChild(modal);
  }
  modal.className = 'ui-modal pause-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', STRINGS.PAUSE.title);

  modal.innerHTML = `
    <div class="ui-modal-card pause-card">
      <div class="modal-header-row">
        <span class="modal-title-icon" aria-hidden="true">\u23F8</span>
        <h2 class="modal-title">${STRINGS.PAUSE.title}</h2>
      </div>
      <div class="pause-grid">
        <button type="button" id="btn-pause-music" class="kid-btn toggle-tile is-on" aria-label="${STRINGS.PAUSE.musicAria}">
          <span class="btn-icon" aria-hidden="true">\uD83C\uDFB5</span>
          <span class="btn-label">${STRINGS.PAUSE.musicLabel}</span>
          <span class="toggle-pill" id="pill-pause-music">${STRINGS.PAUSE.stateOn}</span>
        </button>
        <button type="button" id="btn-pause-sound" class="kid-btn toggle-tile is-on" aria-label="${STRINGS.PAUSE.soundAria}">
          <span class="btn-icon" aria-hidden="true">\uD83D\uDD14</span>
          <span class="btn-label">${STRINGS.PAUSE.soundLabel}</span>
          <span class="toggle-pill" id="pill-pause-sound">${STRINGS.PAUSE.stateOn}</span>
        </button>
        <button type="button" id="btn-pause-voice" class="kid-btn toggle-tile is-on" aria-label="${STRINGS.PAUSE.voiceAria}">
          <span class="btn-icon" aria-hidden="true">\uD83D\uDDE3\uFE0F</span>
          <span class="btn-label">${STRINGS.PAUSE.voiceLabel}</span>
          <span class="toggle-pill" id="pill-pause-voice">${STRINGS.PAUSE.stateOn}</span>
        </button>
        <button type="button" id="btn-pause-chaos" class="kid-btn toggle-tile toggle-chaos" aria-label="${STRINGS.PAUSE.chaosAria}">
          <span class="btn-icon" aria-hidden="true">\uD83C\uDFB2</span>
          <span class="btn-label">${STRINGS.PAUSE.chaosLabel}</span>
          <span class="toggle-pill" id="pill-pause-chaos">${STRINGS.PAUSE.stateOff}</span>
        </button>
      </div>
      <div class="modal-actions-row pause-actions-row">
        <button type="button" id="btn-pause-resume" class="kid-btn kid-btn-emerald pause-action-btn" aria-label="${STRINGS.PAUSE.resumeAria}">
          <span class="btn-icon" aria-hidden="true">\u25B6</span>
          <span class="btn-label">${STRINGS.PAUSE.resumeBtn}</span>
        </button>
        <button type="button" id="btn-pause-new" class="kid-btn kid-btn-gold pause-action-btn" aria-label="${STRINGS.PAUSE.newIslandAria}">
          <span class="btn-icon" aria-hidden="true">\uD83C\uDFDD\uFE0F</span>
          <span class="btn-label">${STRINGS.PAUSE.newIslandBtn}</span>
        </button>
      </div>
    </div>
  `;

  const musicBtn = modal.querySelector('#btn-pause-music');
  const soundBtn = modal.querySelector('#btn-pause-sound');
  const voiceBtn = modal.querySelector('#btn-pause-voice');
  const chaosBtn = modal.querySelector('#btn-pause-chaos');
  const resumeBtn = modal.querySelector('#btn-pause-resume');
  const newBtn = modal.querySelector('#btn-pause-new');

  const musicPill = modal.querySelector('#pill-pause-music');
  const soundPill = modal.querySelector('#pill-pause-sound');
  const voicePill = modal.querySelector('#pill-pause-voice');
  const chaosPill = modal.querySelector('#pill-pause-chaos');

  let localOpen = false;
  let prefs = loadPrefs();

  function readAudioFlags(state) {
    const audioState = ctx.audio?.getState?.() || state?.audio || {};
    const musicOn =
      audioState.musicEnabled ?? audioState.musicOn ?? prefs.musicOn !== false;
    const sfxOn =
      audioState.sfxEnabled ?? audioState.sfxOn ?? prefs.sfxOn !== false;
    const voiceOn =
      audioState.voiceEnabled ?? audioState.voiceOn ?? prefs.voiceOn !== false;
    const chaosOn = Boolean(state?.chaosMode ?? prefs.chaosMode);
    return { musicOn, sfxOn, voiceOn, chaosOn };
  }

  function applyToggleVisual(btn, pill, enabled) {
    btn.classList.toggle('is-on', enabled);
    btn.classList.toggle('is-off', !enabled);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    pill.textContent = enabled ? STRINGS.PAUSE.stateOn : STRINGS.PAUSE.stateOff;
  }

  function syncVisuals(state = ctx.state) {
    const { musicOn, sfxOn, voiceOn, chaosOn } = readAudioFlags(state);
    applyToggleVisual(musicBtn, musicPill, musicOn);
    applyToggleVisual(soundBtn, soundPill, sfxOn);
    applyToggleVisual(voiceBtn, voicePill, voiceOn);
    applyToggleVisual(chaosBtn, chaosPill, chaosOn);
  }

  function open() {
    localOpen = true;
    prefs = loadPrefs();
    modal.hidden = false;
    markModalOpened(280);
    if (ctx.state && ctx.state.mode === 'playing') {
      ctx.state.mode = 'paused';
    }
    ctx.actions?.onPauseChange?.(true);
    syncVisuals(ctx.state);
  }

  function close() {
    localOpen = false;
    modal.hidden = true;
    if (ctx.state && ctx.state.mode === 'paused') {
      ctx.state.mode = 'playing';
    }
    ctx.actions?.onPauseChange?.(false);
    ctx.actions?.closePause?.();
  }

  function isOpen() {
    return !modal.hidden && localOpen;
  }

  const unbinds = [
    bindTap(musicBtn, () => {
      const { musicOn } = readAudioFlags(ctx.state);
      const next = !musicOn;
      prefs = savePrefs({ musicOn: next });
      if (typeof ctx.actions?.toggleMusic === 'function') {
        ctx.actions.toggleMusic(next);
      } else {
        ctx.audio?.setMusicEnabled?.(next);
      }
      syncVisuals(ctx.state);
    }),
    bindTap(soundBtn, () => {
      const { sfxOn } = readAudioFlags(ctx.state);
      const next = !sfxOn;
      prefs = savePrefs({ sfxOn: next });
      if (typeof ctx.actions?.toggleSfx === 'function') {
        ctx.actions.toggleSfx(next);
      } else {
        ctx.audio?.setSfxEnabled?.(next);
      }
      syncVisuals(ctx.state);
    }),
    bindTap(voiceBtn, () => {
      const { voiceOn } = readAudioFlags(ctx.state);
      const next = !voiceOn;
      prefs = savePrefs({ voiceOn: next });
      if (typeof ctx.actions?.toggleVoice === 'function') {
        ctx.actions.toggleVoice(next);
      } else {
        ctx.audio?.setVoiceEnabled?.(next);
      }
      syncVisuals(ctx.state);
    }),
    bindTap(chaosBtn, () => {
      const { chaosOn } = readAudioFlags(ctx.state);
      const next = !chaosOn;
      prefs = savePrefs({ chaosMode: next });
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
      syncVisuals(ctx.state);
    }),
    bindTap(
      resumeBtn,
      () => {
        close();
        ctx.actions?.resumeGame?.();
      },
      { debounceMs: 280, guardModalOpen: true }
    ),
    bindTap(
      newBtn,
      () => {
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
    if (state.mode === 'paused' && !localOpen) {
      localOpen = true;
      modal.hidden = false;
    } else if (state.mode !== 'paused' && localOpen && state.mode !== 'playing') {
      localOpen = false;
      modal.hidden = true;
    }
    if (!modal.hidden) {
      syncVisuals(state);
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
    update,
    destroy,
  };
}
