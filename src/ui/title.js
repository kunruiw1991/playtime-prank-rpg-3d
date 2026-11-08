// Title Screen overlay over the live sunlit 3D voxel island (owner: lucky-ui).
// Adopts #title-screen from index.html for instant first paint and zero shader hitch on PLAY.

import { STRINGS } from '../data/strings.js';
import { bindTap } from './debounce.js';

export function createTitleScreen(ctx = {}) {
  const rootParent =
    (typeof document !== 'undefined' &&
      (document.getElementById('ui-layer')?.parentElement || document.body)) ||
    null;

  let root = typeof document !== 'undefined' ? document.getElementById('title-screen') : null;
  if (!root && rootParent) {
    root = document.createElement('div');
    root.id = 'title-screen';
    root.className = 'title-screen';
    rootParent.appendChild(root);
  }
  if (!root) {
    return {
      el: null,
      show() {},
      hide() {},
      isVisible: () => false,
      update() {},
      destroy() {},
    };
  }

  root.classList.add('title-screen');

  let banner = root.querySelector('#title-banner') || root.querySelector('.title-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'title-banner';
    banner.className = 'title-banner';
    root.appendChild(banner);
  }

  let kicker = banner.querySelector('.title-kicker');
  if (!kicker) {
    kicker = document.createElement('div');
    kicker.className = 'title-kicker';
    banner.prepend(kicker);
  }
  kicker.textContent = STRINGS.TITLE.kicker;

  let heading = banner.querySelector('.title-heading');
  if (!heading) {
    heading = document.createElement('h1');
    heading.className = 'title-heading';
    banner.appendChild(heading);
  }
  heading.textContent = STRINGS.TITLE.heading;

  let sub = banner.querySelector('.title-sub');
  if (!sub) {
    sub = document.createElement('div');
    sub.className = 'title-sub';
    banner.appendChild(sub);
  }
  sub.textContent = STRINGS.TITLE.sub;

  // Non-interactive visual story strip showing the 3 kid steps with big >= 34px icons.
  let storyRow = banner.querySelector('.title-story-icons');
  if (!storyRow) {
    storyRow = document.createElement('div');
    storyRow.className = 'title-story-icons';
    storyRow.setAttribute('aria-hidden', 'true');
    storyRow.innerHTML = [
      '<span class="story-chip"><span class="story-emoji">\u2753</span></span>',
      '<span class="story-arrow">\u27A1\uFE0F</span>',
      '<span class="story-chip"><span class="story-emoji">\uD83E\uDEB4</span></span>',
      '<span class="story-arrow">\u27A1\uFE0F</span>',
      '<span class="story-chip"><span class="story-emoji">\uD83C\uDF81</span></span>',
      '<span class="story-arrow">\u27A1\uFE0F</span>',
      '<span class="story-chip"><span class="story-emoji">\uD83D\uDC51</span></span>',
    ].join('');
    banner.appendChild(storyRow);
  }

  let actions = root.querySelector('#title-actions') || root.querySelector('.title-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'title-actions';
    actions.className = 'title-actions';
    root.appendChild(actions);
  }

  let playBtn = root.querySelector('#btn-title-play');
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'btn-title-play';
    actions.appendChild(playBtn);
  }
  playBtn.className = 'kid-btn kid-btn-play is-pulsing';
  playBtn.setAttribute('aria-label', STRINGS.TITLE.playAria);
  playBtn.innerHTML = `
    <span class="btn-icon" aria-hidden="true">\u25B6</span>
    <span class="btn-label">${STRINGS.TITLE.playBtn}</span>
  `;

  let continueBtn = root.querySelector('#btn-title-continue');
  if (!continueBtn) {
    continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.id = 'btn-title-continue';
    actions.appendChild(continueBtn);
  }
  continueBtn.style.order = '-1';
  continueBtn.className = 'kid-btn kid-btn-gold title-continue-btn is-pulsing';
  continueBtn.setAttribute('aria-label', STRINGS.TITLE.continueAria);
  continueBtn.hidden = true;
  continueBtn.innerHTML = `
    <span class="btn-icon" aria-hidden="true">\uD83C\uDFDD\uFE0F</span>
    <span class="btn-label">${STRINGS.TITLE.continueBtn}</span>
  `;

  let voiceBtn = root.querySelector('#btn-title-voice');
  if (!voiceBtn) {
    voiceBtn = document.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.id = 'btn-title-voice';
    actions.appendChild(voiceBtn);
  }
  voiceBtn.className = 'kid-btn kid-btn-sky title-voice-btn';
  voiceBtn.setAttribute('aria-label', STRINGS.TITLE.voiceAria);
  voiceBtn.innerHTML = `
    <span class="btn-icon" aria-hidden="true">\uD83D\uDD0A</span>
    <span class="btn-label">${STRINGS.TITLE.voiceBtn}</span>
  `;

  const unbindContinue = bindTap(
    continueBtn,
    () => {
      ctx.audio?.unlock?.();
      if (typeof ctx.actions?.continueGame === 'function') {
        ctx.actions.continueGame();
      } else if (typeof ctx.actions?.startGame === 'function') {
        ctx.actions.startGame();
      }
    },
    280
  );

  const unbindPlay = bindTap(
    playBtn,
    () => {
      ctx.audio?.unlock?.();
      if (typeof ctx.actions?.startGame === 'function') {
        ctx.actions.startGame();
      } else if (typeof ctx.onPlay === 'function') {
        ctx.onPlay();
      } else if (typeof ctx.startGame === 'function') {
        ctx.startGame();
      }
    },
    280
  );

  const unbindVoice = bindTap(
    voiceBtn,
    () => {
      ctx.audio?.unlock?.();
      if (typeof ctx.actions?.playTitleVoice === 'function') {
        ctx.actions.playTitleVoice();
      } else if (ctx.voice?.speak) {
        ctx.voice.speak('guide_title', { priority: 'interrupt', forceUnmute: true });
      } else if (typeof ctx.actions?.replayVoice === 'function') {
        ctx.actions.replayVoice();
      } else {
        ctx.voice?.replayLast?.();
      }
    },
    280
  );

  function show() {
    root.hidden = false;
    root.classList.remove('is-hidden');
  }

  function hide() {
    root.hidden = true;
    root.classList.add('is-hidden');
  }

  function isVisible() {
    return !root.hidden && !root.classList.contains('is-hidden');
  }

  function update(state) {
    if (!state) return;
    if (state.mode === 'title') {
      if (!isVisible()) show();
    } else if (isVisible()) {
      hide();
    }
    const canContinue = Boolean(ctx.actions?.hasSavedRun?.());
    continueBtn.hidden = !canContinue;
    root.classList.toggle('has-continue', canContinue);
    playBtn.classList.toggle('is-pulsing', !canContinue);

    const speaking = Boolean(
      state.voice?.speaking ??
        ctx.voice?.getState?.()?.speaking ??
        ctx.voice?.isSpeaking?.()
    );
    voiceBtn.classList.toggle('is-speaking', speaking);
  }

  function destroy() {
    unbindContinue();
    unbindPlay();
    unbindVoice();
  }

  return {
    el: root,
    continueBtn,
    playBtn,
    voiceBtn,
    show,
    hide,
    isVisible,
    update,
    destroy,
  };
}
