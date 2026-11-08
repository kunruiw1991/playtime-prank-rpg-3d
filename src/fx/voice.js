// Pre-recorded neural voiceover player (68 edge-tts MP3s) with WebAudio -6 dB BGM ducking,
// lazy LRU AudioBuffer decoding, deterministic stepFrames() timer, 1-tap Replay,
// and 5-viewport zero-overlap #voice-subtitle placement (owner: lucky-vo-audio).

import { VOICE_SPEAKERS } from '../data/voice_catalog.js';
import { VOICE_MANIFEST } from '../data/voice_manifest.js';

const CORE_PREFETCH_IDS = Object.freeze([
  'guide_title',
  'guide_welcome',
  'guide_starter_pop',
  'guide_boing_hint',
]);

const MAX_BUFFER_CACHE = 28;
const MAX_RAW_CACHE = 16;
const SUBTITLE_DEBOUNCE_MS = 280;

const SPEAKER_BADGES = Object.freeze({
  narrator: { icon: '🌟', tag: 'ISLAND GUIDE' },
  cappuccina: { icon: '☕', tag: 'CAPPUCCINA' },
  bananini: { icon: '🍌', tag: 'BANANINI' },
  lirili: { icon: '🌵', tag: 'LIRILI' },
  sahur: { icon: '🥁', tag: 'TUNG SAHUR' },
  tralalero: { icon: '🦈', tag: 'TRALALERO' },
  bombardiro: { icon: '🐊', tag: 'BOMBARDIRO' },
  patapim: { icon: '🌳', tag: 'PATAPIM' },
  sahur_king: { icon: '👑', tag: 'SAHUR KING' },
  guide: { icon: '🥁', tag: 'TUNG SAHUR' },
  fairy: { icon: '☕', tag: 'CAPPUCCINA' },
  boss_moss: { icon: '🦈', tag: 'TRALALERO' },
  boss_snow: { icon: '🐊', tag: 'BOMBARDIRO' },
  boss_thunder: { icon: '🌳', tag: 'PATAPIM' },
  boss_king: { icon: '👑', tag: 'SAHUR KING' },
});

function rectsOverlapWithGap(a, b, gap = 6) {
  return !(
    a.right + gap <= b.left ||
    a.left >= b.right + gap ||
    a.bottom + gap <= b.top ||
    a.top >= b.bottom + gap
  );
}

function isElementVisible(el) {
  if (!el || el.hidden) return false;
  if (typeof window === 'undefined') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

export function createVoice(audio, { onSubtitleChange, onSubtitleTap } = {}) {
  const clips = VOICE_MANIFEST.clips || {};

  // LRU caches: decoded AudioBuffers + prefetched raw ArrayBuffers (decoded lazily on demand)
  const audioBufferCache = new Map();
  const rawBytesCache = new Map();
  const inflightRaw = new Map();

  let currentSource = null;
  let playToken = 0;

  let speaking = false;
  let currentId = null;
  let lastId = null;
  let remainingSec = 0;
  let bgmDucked = false;

  let requestedCount = 0;
  let playedCount = 0;
  let replayCount = 0;
  const queue = [];

  let subtitleEl = null;
  let iconEl = null;
  let textEl = null;
  let lastSubtitleTapMs = -1e9;
  let layoutAccumSec = 0;
  let lastLayoutKey = '';
  let needsDeferredMeasure = false;

  let lastExternalUpdateMs = typeof performance !== 'undefined' ? performance.now() : 0;
  let fallbackTimerId = null;

  function touchCache(map, key, val, limit) {
    if (map.has(key)) map.delete(key);
    map.set(key, val);
    while (map.size > limit) {
      const oldestKey = map.keys().next().value;
      map.delete(oldestKey);
    }
  }

  function fetchRawMp3(id) {
    const clip = clips[id];
    if (!clip) return Promise.resolve(null);
    if (rawBytesCache.has(id)) {
      const buf = rawBytesCache.get(id);
      touchCache(rawBytesCache, id, buf, MAX_RAW_CACHE);
      return Promise.resolve(buf);
    }
    if (inflightRaw.has(id)) {
      return inflightRaw.get(id);
    }
    if (typeof fetch !== 'function') {
      return Promise.resolve(null);
    }

    const url = new URL(`../../${clip.file}`, import.meta.url).href;
    const p = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((ab) => {
        inflightRaw.delete(id);
        if (ab && ab.byteLength > 256) {
          touchCache(rawBytesCache, id, ab, MAX_RAW_CACHE);
          return ab;
        }
        return null;
      })
      .catch(() => {
        inflightRaw.delete(id);
        return null;
      });

    inflightRaw.set(id, p);
    return p;
  }

  async function loadDecodedBuffer(id) {
    if (audioBufferCache.has(id)) {
      const cached = audioBufferCache.get(id);
      touchCache(audioBufferCache, id, cached, MAX_BUFFER_CACHE);
      return cached;
    }
    const ctx = audio.ensureContext();
    if (!ctx) return null;

    const raw = await fetchRawMp3(id);
    if (!raw) return null;

    try {
      // Slice copy because decodeAudioData detaches the passed ArrayBuffer.
      const copy = raw.slice(0);
      const decoded = await ctx.decodeAudioData(copy);
      if (decoded) {
        touchCache(audioBufferCache, id, decoded, MAX_BUFFER_CACHE);
      }
      return decoded;
    } catch (_err) {
      return null;
    }
  }

  function scheduleGentlePrefetch() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    CORE_PREFETCH_IDS.forEach((id, idx) => {
      setTimeout(() => {
        if (clips[id] && !audioBufferCache.has(id)) {
          loadDecodedBuffer(id);
        }
      }, 20 + idx * 45);
    });
  }

  function ensureSubtitleDom() {
    if (typeof document === 'undefined' || !document.body) return null;
    if (subtitleEl && subtitleEl.isConnected) return subtitleEl;

    let el = document.getElementById('voice-subtitle');
    if (el && el.tagName === 'BUTTON') {
      const replacement = document.createElement('div');
      replacement.id = 'voice-subtitle';
      el.replaceWith(replacement);
      el = replacement;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'voice-subtitle';
      document.body.appendChild(el);
    }

    el.classList.add('voice-subtitle');
    el.removeAttribute('role');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Replay voice');
    el.hidden = true;

    // Inline baseline guarantees >= 72px touch target, crisp readability, and zero text clipping
    // even before or alongside styles/main.css rules.
    Object.assign(el.style, {
      position: 'fixed',
      left: '12px',
      top: '12px',
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
      margin: '0',
      minHeight: '74px',
      minWidth: '200px',
      maxWidth: 'min(90vw, 560px)',
      padding: '10px 18px',
      boxSizing: 'border-box',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      borderRadius: '22px',
      border: '4px solid #ffd43b',
      background: 'rgba(20, 34, 62, 0.92)',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: 'clamp(17px, 2.2vw, 22px)',
      fontWeight: '800',
      lineHeight: '1.22',
      textAlign: 'left',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'manipulation',
      boxShadow: '0 6px 0 rgba(10, 18, 36, 0.55), 0 10px 24px rgba(0, 0, 0, 0.32)',
      zIndex: '9500',
      overflow: 'visible',
      whiteSpace: 'normal',
    });

    el.innerHTML = '';
    iconEl = document.createElement('span');
    iconEl.className = 'voice-subtitle-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    Object.assign(iconEl.style, {
      fontSize: '28px',
      lineHeight: '1',
      flexShrink: '0',
    });

    textEl = document.createElement('span');
    textEl.className = 'voice-subtitle-text';
    Object.assign(textEl.style, {
      display: 'block',
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      wordBreak: 'normal',
      overflow: 'visible',
    });

    el.appendChild(iconEl);
    el.appendChild(textEl);

    const onActivate = (evt) => {
      if (evt) {
        evt.stopPropagation();
      }
      onSubtitleTap?.();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastSubtitleTapMs < SUBTITLE_DEBOUNCE_MS) return;
      lastSubtitleTapMs = now;
      replayLast();
    };

    el.addEventListener('pointerup', onActivate);
    el.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        onActivate(evt);
      }
    });
    // Prevent pointerdown on subtitle from triggering 3D canvas ground taps underneath.
    el.addEventListener('pointerdown', (evt) => evt.stopPropagation());
    el.addEventListener('click', (evt) => evt.stopPropagation());

    subtitleEl = el;
    return subtitleEl;
  }

  function collectObstacleRects() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return [];
    const obstacles = [];
    const nodes = document.querySelectorAll(
      'button, [role="button"], #hud-status, #hud .hud-pill, #hud-actions, #boss-banner, .boss-banner, [data-boss-banner], #title-banner, .title-banner, .ui-modal-card'
    );
    for (const node of nodes) {
      if (node === subtitleEl || (subtitleEl && subtitleEl.contains(node))) continue;
      if (!isElementVisible(node)) continue;
      const r = node.getBoundingClientRect();
      obstacles.push({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      });
    }
    return obstacles;
  }

  function applyViewportTypography(vw, vh, isModalOpen) {
    if (!subtitleEl || !iconEl) return;
    const isShortLandscape = vh <= 480;
    const isNarrowPortrait = vw <= 480;

    if (isShortLandscape && !isModalOpen) {
      // P2-4: 844x390 active-play compact 1-line pill (18px, <= 70vw) docked above HUD buttons
      subtitleEl.style.minHeight = '72px';
      subtitleEl.style.padding = '5px 14px';
      subtitleEl.style.gap = '8px';
      subtitleEl.style.fontSize = '18px';
      subtitleEl.style.lineHeight = '1.14';
      iconEl.style.fontSize = '22px';
    } else if (isShortLandscape && isModalOpen) {
      subtitleEl.style.minHeight = '72px';
      subtitleEl.style.padding = '6px 14px';
      subtitleEl.style.gap = '8px';
      subtitleEl.style.fontSize = '17.5px';
      subtitleEl.style.lineHeight = '1.15';
      iconEl.style.fontSize = '22px';
    } else if (isNarrowPortrait) {
      subtitleEl.style.minHeight = '74px';
      subtitleEl.style.padding = '8px 14px';
      subtitleEl.style.gap = '8px';
      subtitleEl.style.fontSize = '18px';
      subtitleEl.style.lineHeight = '1.18';
      iconEl.style.fontSize = '24px';
    } else {
      subtitleEl.style.minHeight = '74px';
      subtitleEl.style.padding = '9px 18px';
      subtitleEl.style.gap = '10px';
      subtitleEl.style.fontSize = 'clamp(18px, 2.1vw, 21px)';
      subtitleEl.style.lineHeight = '1.2';
      iconEl.style.fontSize = '26px';
    }
  }

  function computeLayoutKey() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return '';
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const modal = document.body?.classList.contains('ui-modal-open') ? 1 : 0;
    const hudVis = document.getElementById('hud')?.hidden === false ? 1 : 0;
    const bossEl = document.getElementById('boss-banner');
    const bossVis = bossEl && !bossEl.hidden && bossEl.style.display !== 'none' ? 1 : 0;
    const shieldVis = document.getElementById('hud-shields-pill')?.hidden === false ? 1 : 0;
    const titleEl = document.getElementById('title-screen');
    const titleVis = titleEl && !titleEl.hidden && titleEl.style.display !== 'none' ? 1 : 0;
    const roulVis = document.getElementById('roulette-modal')?.hidden === false ? 1 : 0;
    const pauseVis = document.getElementById('pause-modal')?.hidden === false ? 1 : 0;
    const vicVis = document.getElementById('victory-modal')?.hidden === false ? 1 : 0;
    return `${currentId || ''}|${vw}x${vh}|${modal}${hudVis}${bossVis}${shieldVis}${titleVis}${roulVis}${pauseVis}${vicVis}`;
  }

  function positionSubtitle(force = false) {
    if (!speaking || !subtitleEl || subtitleEl.hidden) return;
    if (typeof window === 'undefined') return;
    const key = computeLayoutKey();
    if (!force && !needsDeferredMeasure && key && key === lastLayoutKey) return;
    lastLayoutKey = key;
    needsDeferredMeasure = false;

    const vw = Math.max(320, window.innerWidth || 1280);
    const vh = Math.max(320, window.innerHeight || 800);
    const edgePad = 8;
    const obstacleGap = 6;
    const isModalOpen =
      typeof document !== 'undefined' &&
      document.body &&
      document.body.classList.contains('ui-modal-open');
    const isShortLandscape = vh <= 480;

    const maxAllowedW =
      isShortLandscape && !isModalOpen
        ? Math.min(Math.floor(vw * 0.7), 590)
        : Math.min(560, vw - edgePad * 2);

    // Batch all style writes BEFORE reading any getBoundingClientRect() to prevent double reflow!
    applyViewportTypography(vw, vh, isModalOpen);
    subtitleEl.style.maxWidth = `${Math.max(200, Math.floor(maxAllowedW))}px`;

    const obstacles = collectObstacleRects();

    // Measure live HUD status bottom and HUD action-row top so active-play subtitles
    // ALWAYS dock cleanly above the bottom HUD buttons and NEVER intrude over top status pills!
    let minSafeTop = edgePad;
    let hudActionsTop = vh - (isShortLandscape ? 88 : 98);
    if (!isModalOpen && typeof document !== 'undefined') {
      const statusEl = document.getElementById('hud-status');
      if (statusEl && isElementVisible(statusEl)) {
        const sr = statusEl.getBoundingClientRect();
        minSafeTop = Math.max(minSafeTop, Math.ceil(sr.bottom + 8));
      }
      for (const pill of document.querySelectorAll('#hud-status .hud-pill')) {
        if (!isElementVisible(pill)) continue;
        const pr = pill.getBoundingClientRect();
        minSafeTop = Math.max(minSafeTop, Math.ceil(pr.bottom + 8));
      }
      const actionsEl = document.getElementById('hud-actions');
      if (actionsEl && isElementVisible(actionsEl)) {
        hudActionsTop = Math.min(hudActionsTop, Math.floor(actionsEl.getBoundingClientRect().top));
      }
      for (const btn of document.querySelectorAll('#hud-actions button')) {
        if (!isElementVisible(btn)) continue;
        hudActionsTop = Math.min(hudActionsTop, Math.floor(btn.getBoundingClientRect().top));
      }
    }

    const widthProfiles = [
      maxAllowedW,
      Math.min(360, maxAllowedW),
      Math.max(200, Math.min(240, maxAllowedW)),
    ];

    for (let pIdx = 0; pIdx < widthProfiles.length; pIdx += 1) {
      const maxW = widthProfiles[pIdx];
      if (pIdx > 0) {
        subtitleEl.style.maxWidth = `${Math.max(200, Math.floor(maxW))}px`;
      }

      const rect = subtitleEl.getBoundingClientRect();
      const minH = isShortLandscape ? 72 : 74;
      const w = Math.max(minH, Math.ceil(rect.width));
      const h = Math.max(minH, Math.ceil(rect.height));
      if (w > vw - edgePad * 2 || h > vh - edgePad * 2) continue;

      const centerX = Math.round((vw - w) / 2);
      const xCandidates = [
        centerX,
        edgePad,
        vw - w - edgePad,
        Math.round(vw * 0.25),
        Math.round(vw * 0.75 - w),
      ].map((x) => Math.max(edgePad, Math.min(vw - w - edgePad, x)));

      const yCandidates = [];
      if (isModalOpen) {
        if (vh <= 559) {
          yCandidates.push(6, 8, vh - h - 8);
        } else {
          yCandidates.push(vh - h - 10, vh - h - 14, edgePad);
        }
        for (let y = vh - h - edgePad; y >= edgePad; y -= 12) {
          yCandidates.push(y);
        }
      } else {
        // Active play: dock right above #hud-actions first, then step upward, NEVER above minSafeTop!
        const dockY = Math.floor(hudActionsTop - h - 9);
        yCandidates.push(dockY, dockY - 6, dockY - 14);
        for (let y = dockY - 22; y >= minSafeTop; y -= 12) {
          yCandidates.push(y);
        }
        yCandidates.push(minSafeTop);
      }

      const topFloor = isModalOpen ? (vh <= 559 ? 4 : edgePad) : minSafeTop;
      for (const rawY of yCandidates) {
        const y = Math.max(topFloor, Math.min(vh - h - 4, Math.round(rawY)));
        for (const x of xCandidates) {
          const box = { left: x, top: y, right: x + w, bottom: y + h };
          let hit = false;
          for (const obs of obstacles) {
            if (rectsOverlapWithGap(box, obs, obstacleGap)) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            subtitleEl.style.left = `${x}px`;
            subtitleEl.style.top = `${y}px`;
            return;
          }
        }
      }
    }

    // Safe non-status fallback anchor inside viewport.
    const fallbackTop = isModalOpen ? (vh <= 559 ? 6 : Math.max(edgePad, vh - 84)) : minSafeTop;
    subtitleEl.style.left = `${edgePad}px`;
    subtitleEl.style.top = `${fallbackTop}px`;
  }

  function renderSubtitleState() {
    const el = ensureSubtitleDom();
    if (!el) return;

    if (!speaking || !currentId || !clips[currentId]) {
      lastLayoutKey = '';
      needsDeferredMeasure = false;
      el.hidden = true;
      el.style.display = 'none';
      el.classList.remove('is-speaking');
      if (typeof onSubtitleChange === 'function') {
        onSubtitleChange({ visible: false, id: null, speaker: null, text: '' });
      }
      return;
    }

    const clip = clips[currentId];
    const badge = SPEAKER_BADGES[clip.speaker] || SPEAKER_BADGES.guide;
    const cleanText = String(clip.text || '').trim();

    iconEl.textContent = `🔊 ${badge.icon}`;
    textEl.textContent = cleanText;

    const vw = typeof window !== 'undefined' ? Math.max(320, window.innerWidth || 1280) : 1280;
    const vh = typeof window !== 'undefined' ? Math.max(320, window.innerHeight || 800) : 800;
    const isModalOpen =
      typeof document !== 'undefined' &&
      document.body &&
      document.body.classList.contains('ui-modal-open');
    applyViewportTypography(vw, vh, isModalOpen);
    const initMaxW =
      vh <= 480 && !isModalOpen ? Math.min(Math.floor(vw * 0.7), 590) : Math.min(560, vw - 16);
    el.style.maxWidth = `${Math.max(200, initMaxW)}px`;
    const estW = Math.min(initMaxW, Math.max(240, cleanText.length * 11 + 84));
    el.style.left = `${Math.max(8, Math.round((vw - estW) / 2))}px`;
    el.style.top = `${
      isModalOpen ? (vh <= 559 ? 6 : Math.max(8, vh - 86)) : Math.max(84, vh - (vh <= 480 ? 168 : 182))
    }px`;

    el.hidden = false;
    el.style.display = 'flex';
    el.classList.add('is-speaking');
    lastLayoutKey = '';
    needsDeferredMeasure = true;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (speaking && needsDeferredMeasure) {
          positionSubtitle(true);
        }
      });
    }

    if (typeof onSubtitleChange === 'function') {
      onSubtitleChange({
        visible: true,
        id: currentId,
        speaker: clip.speaker,
        speakerRole: VOICE_SPEAKERS[clip.speaker]?.role || clip.speaker,
        text: cleanText,
      });
    }
  }

  function stopActiveSource() {
    if (!currentSource) return;
    const src = currentSource;
    currentSource = null;
    try {
      src.onended = null;
      src.stop(0);
      src.disconnect();
    } catch (_err) {
      // Ignore already-stopped node.
    }
  }

  async function playWebAudioClip(id, token) {
    if (!audio.voiceEnabled || !audio.masterEnabled) return;
    const buf = await loadDecodedBuffer(id);
    if (!buf || token !== playToken || !speaking || currentId !== id) return;

    const ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return;

    stopActiveSource();
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(audio.voiceGain);
      currentSource = src;
      src.onended = () => {
        if (currentSource === src) {
          currentSource = null;
        }
      };
      src.start(0);
    } catch (_err) {
      currentSource = null;
    }
  }

  function startClipImmediate(id) {
    const clip = clips[id];
    if (!clip) return false;

    playToken += 1;
    const token = playToken;
    stopActiveSource();

    currentId = id;
    lastId = id;
    speaking = true;
    playedCount += 1;
    remainingSec = Math.max(0.4, Number(clip.duration) || 1.8);
    bgmDucked = true;
    audio.duckMusic(true);

    renderSubtitleState();
    playWebAudioClip(id, token);
    return true;
  }

  function finishCurrentClip() {
    stopActiveSource();
    if (queue.length > 0 && audio.voiceEnabled && audio.masterEnabled) {
      const nextId = queue.shift();
      if (clips[nextId]) {
        startClipImmediate(nextId);
        return;
      }
    }

    speaking = false;
    currentId = null;
    remainingSec = 0;
    bgmDucked = false;
    audio.duckMusic(false);
    renderSubtitleState();
  }

  function speak(id, { priority = 'interrupt', forceUnmute = false } = {}) {
    if (!id || !clips[id]) {
      return {
        accepted: false,
        speaking,
        currentId,
        lastId,
        bgmDucked,
      };
    }

    requestedCount += 1;

    if (forceUnmute) {
      if (!audio.masterEnabled) audio.setMasterEnabled(true);
      if (!audio.voiceEnabled) audio.setVoiceEnabled(true);
      audio.unlock();
    }

    if (!audio.voiceEnabled || !audio.masterEnabled) {
      // Remember lastId so 1-tap Replay plays what the child missed!
      lastId = id;
      return {
        accepted: false,
        muted: true,
        speaking,
        currentId,
        lastId,
        bgmDucked,
      };
    }

    if (priority === 'ifIdle' && speaking) {
      return {
        accepted: false,
        busy: true,
        speaking,
        currentId,
        lastId,
        bgmDucked,
      };
    }

    if (priority === 'queue' && speaking) {
      if (currentId !== id && queue[queue.length - 1] !== id && queue.length < 3) {
        queue.push(id);
      }
      return {
        accepted: true,
        queued: true,
        speaking,
        currentId,
        lastId,
        bgmDucked,
      };
    }

    // Default 'interrupt': clear stale queued items and speak immediately.
    queue.length = 0;
    startClipImmediate(id);
    return {
      accepted: true,
      speaking,
      currentId,
      lastId,
      bgmDucked,
    };
  }

  function replayLast() {
    const targetId = lastId && clips[lastId] ? lastId : 'guide_welcome';
    if (!audio.masterEnabled) {
      audio.setMasterEnabled(true);
    }
    if (!audio.voiceEnabled) {
      audio.setVoiceEnabled(true);
    }
    audio.unlock();

    queue.length = 0;
    replayCount += 1;
    requestedCount += 1;
    startClipImmediate(targetId);

    return {
      replayedId: targetId,
      speaking: true,
      bgmDucked: true,
      replayCount,
    };
  }

  function stop() {
    playToken += 1;
    queue.length = 0;
    stopActiveSource();
    speaking = false;
    currentId = null;
    remainingSec = 0;
    bgmDucked = false;
    audio.duckMusic(false);
    renderSubtitleState();
  }

  function reset() {
    stop();
    lastId = null;
    requestedCount = 0;
    playedCount = 0;
    replayCount = 0;
  }

  function advanceLogicalClock(dt, fromExternalLoop = true) {
    if (fromExternalLoop && typeof performance !== 'undefined') {
      lastExternalUpdateMs = performance.now();
    }
    const step = Math.max(0, Number(dt) || 0);
    if (!speaking) return;

    // If user muted voice mid-clip via Pause modal, stop cleanly.
    if (!audio.voiceEnabled || !audio.masterEnabled) {
      stop();
      return;
    }

    remainingSec -= step;
    layoutAccumSec += step;
    if (remainingSec <= 0) {
      finishCurrentClip();
    } else if (needsDeferredMeasure || layoutAccumSec >= 0.12) {
      layoutAccumSec = 0;
      positionSubtitle();
    }
  }

  function update(dt = 1 / 60) {
    advanceLogicalClock(dt, true);
  }

  // Real-time fallback ticker ONLY when external update(dt) is paused (e.g., modal/title idle).
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      if (speaking) positionSubtitle(true);
    });

    fallbackTimerId = setInterval(() => {
      if (!speaking) return;
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      if (now - lastExternalUpdateMs > 280) {
        advanceLogicalClock(0.1, false);
      }
    }, 100);
  }

  // If browser unlocks audio while a clip is already logically speaking (e.g. Title greeting),
  // start WebAudio playback seamlessly if within the start of the clip!
  const offUnlock = audio.onUnlock(() => {
    if (speaking && currentId && !currentSource && remainingSec > 0.35) {
      playWebAudioClip(currentId, playToken);
    }
  });

  ensureSubtitleDom();
  scheduleGentlePrefetch();

  function getState() {
    const clip = currentId ? clips[currentId] : null;
    return {
      speaking,
      currentId,
      lastId,
      speaker: clip ? clip.speaker : null,
      text: clip ? String(clip.text).trim() : '',
      remainingSec: speaking ? Number(Math.max(0, remainingSec).toFixed(3)) : 0,
      bgmDucked,
      duckDb: bgmDucked ? -6 : 0,
      duckMultiplier: bgmDucked ? 0.5 : 1.0,
      queueLength: queue.length,
      requestedCount,
      playedCount,
      replayCount,
      totalManifestClips: VOICE_MANIFEST.totalClips,
      cachedCount: audioBufferCache.size,
    };
  }

  function dispose() {
    stop();
    offUnlock();
    if (fallbackTimerId) {
      clearInterval(fallbackTimerId);
      fallbackTimerId = null;
    }
    if (subtitleEl && subtitleEl.parentNode) {
      subtitleEl.parentNode.removeChild(subtitleEl);
      subtitleEl = null;
    }
  }

  return {
    speak,
    replayLast,
    stop,
    reset,
    update,
    positionSubtitle,
    hasClip: (id) => Boolean(clips[id]),
    getClipInfo: (id) => clips[id] || null,
    getManifest: () => VOICE_MANIFEST,
    getState,
    dispose,
  };
}
