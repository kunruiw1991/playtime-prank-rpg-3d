// Shared WebAudio manager, GainNode buses, iPad gesture unlock, -6 dB voice ducking,
// and localStorage['lucky_titan_progress'] persistence (owner: lucky-vo-audio).

import { STORAGE_KEY } from '../data/catalog.js';

const DUCK_MULTIPLIER = 0.5; // Exact -6.02 dB ducking on musicGain when voice speaks
const DUCK_RAMP_SEC = 0.06;  // Smooth 60 ms ramp

function readStoredAudioPrefs() {
  const defaults = {
    masterOn: true,
    musicOn: true,
    sfxOn: true,
    voiceOn: true,
  };
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      masterOn: parsed.masterOn !== false,
      musicOn: parsed.musicOn !== false && parsed.musicEnabled !== false,
      sfxOn: parsed.sfxOn !== false && parsed.sfxEnabled !== false,
      voiceOn: parsed.voiceOn !== false && parsed.voiceEnabled !== false,
    };
  } catch (_err) {
    return defaults;
  }
}

function writeStoredAudioPrefs(patch) {
  try {
    if (typeof localStorage === 'undefined') return;
    let base = {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        base = parsed;
      }
    }
    const next = { ...base, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_err) {
    // Ignore storage quota or sandbox errors safely.
  }
}

export function createAudioManager(options = {}) {
  const initial = readStoredAudioPrefs();

  let ctx = null;
  let compressor = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let voiceGain = null;

  let unlocked = false;
  let masterEnabled = initial.masterOn;
  let musicEnabled = initial.musicOn;
  let sfxEnabled = initial.sfxOn;
  let voiceEnabled = initial.voiceOn;
  let bgmDucked = false;

  const unlockListeners = new Set();
  const changeListeners = new Set();
  if (typeof options.onChange === 'function') {
    changeListeners.add(options.onChange);
  }

  function computeTargetMusicGain() {
    if (!musicEnabled) return 0;
    return bgmDucked ? DUCK_MULTIPLIER : 1.0;
  }

  function applyGainTargets(immediate = false) {
    if (!ctx || !masterGain || !musicGain || !sfxGain || !voiceGain) return;
    const now = ctx.currentTime;
    const targetMaster = masterEnabled ? 1.0 : 0.0;
    const targetMusic = computeTargetMusicGain();
    const targetSfx = sfxEnabled ? 1.0 : 0.0;
    const targetVoice = voiceEnabled ? 1.0 : 0.0;

    try {
      masterGain.gain.cancelScheduledValues(now);
      musicGain.gain.cancelScheduledValues(now);
      sfxGain.gain.cancelScheduledValues(now);
      voiceGain.gain.cancelScheduledValues(now);

      if (immediate) {
        masterGain.gain.setValueAtTime(targetMaster, now);
        musicGain.gain.setValueAtTime(targetMusic, now);
        sfxGain.gain.setValueAtTime(targetSfx, now);
        voiceGain.gain.setValueAtTime(targetVoice, now);
      } else {
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.03);

        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.linearRampToValueAtTime(targetMusic, now + DUCK_RAMP_SEC);

        sfxGain.gain.setValueAtTime(sfxGain.gain.value, now);
        sfxGain.gain.linearRampToValueAtTime(targetSfx, now + 0.025);

        voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
        voiceGain.gain.linearRampToValueAtTime(targetVoice, now + 0.025);
      }
    } catch (_err) {
      masterGain.gain.value = targetMaster;
      musicGain.gain.value = targetMusic;
      sfxGain.gain.value = targetSfx;
      voiceGain.gain.value = targetVoice;
    }
  }

  function ensureContext() {
    if (ctx) return ctx;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      ctx = new AudioCtx();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 14;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.14;
      compressor.connect(ctx.destination);

      masterGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      voiceGain = ctx.createGain();

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      voiceGain.connect(masterGain);
      masterGain.connect(compressor);

      applyGainTargets(true);
      if (ctx.state === 'running') {
        unlocked = true;
      }
    } catch (_err) {
      ctx = null;
    }
    return ctx;
  }

  function notifyChange() {
    const snap = getState();
    for (const fn of changeListeners) {
      try {
        fn(snap);
      } catch (_err) {
        // Ignore listener errors.
      }
    }
  }

  function persistPrefs() {
    writeStoredAudioPrefs({
      masterOn: masterEnabled,
      musicOn: musicEnabled,
      sfxOn: sfxEnabled,
      voiceOn: voiceEnabled,
    });
  }

  function unlock() {
    const audioCtx = ensureContext();
    if (!audioCtx) return false;

    const markUnlocked = () => {
      if (unlocked) return;
      unlocked = true;
      applyGainTargets(true);
      for (const fn of unlockListeners) {
        try {
          fn(audioCtx);
        } catch (_err) {
          // Ignore callback error.
        }
      }
      notifyChange();
    };

    try {
      if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
        const p = audioCtx.resume();
        if (p && typeof p.then === 'function') {
          p.then(markUnlocked).catch(() => {});
        }
      }
      // Play a 1-sample silent buffer for iOS/iPadOS WebKit unlock reliability.
      const silent = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = silent;
      src.connect(masterGain);
      src.start(0);
      if (audioCtx.state === 'running') {
        markUnlocked();
      }
    } catch (_err) {
      // Ignore autoplay policy rejections prior to gesture.
    }
    return unlocked;
  }

  const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'click'];
  function handleUserGesture() {
    unlock();
    if (unlocked && ctx && ctx.state === 'running') {
      removeGestureListeners();
    }
  }

  function addGestureListeners() {
    if (typeof window === 'undefined') return;
    for (const evt of GESTURE_EVENTS) {
      window.addEventListener(evt, handleUserGesture, { capture: true, passive: true });
    }
  }

  function removeGestureListeners() {
    if (typeof window === 'undefined') return;
    for (const evt of GESTURE_EVENTS) {
      window.removeEventListener(evt, handleUserGesture, { capture: true });
    }
  }

  addGestureListeners();

  function setMasterEnabled(enabled, { persist = true } = {}) {
    masterEnabled = Boolean(enabled);
    applyGainTargets(false);
    if (persist) persistPrefs();
    notifyChange();
    return masterEnabled;
  }

  function setMusicEnabled(enabled, { persist = true } = {}) {
    musicEnabled = Boolean(enabled);
    applyGainTargets(false);
    if (persist) persistPrefs();
    notifyChange();
    return musicEnabled;
  }

  function setSfxEnabled(enabled, { persist = true } = {}) {
    sfxEnabled = Boolean(enabled);
    applyGainTargets(false);
    if (persist) persistPrefs();
    notifyChange();
    return sfxEnabled;
  }

  function setVoiceEnabled(enabled, { persist = true } = {}) {
    voiceEnabled = Boolean(enabled);
    applyGainTargets(false);
    if (persist) persistPrefs();
    notifyChange();
    return voiceEnabled;
  }

  function duckMusic(active) {
    const next = Boolean(active);
    if (bgmDucked === next && ctx && musicGain) {
      return bgmDucked;
    }
    bgmDucked = next;
    applyGainTargets(false);
    notifyChange();
    return bgmDucked;
  }

  function syncFromPrefs() {
    const prefs = readStoredAudioPrefs();
    masterEnabled = prefs.masterOn;
    musicEnabled = prefs.musicOn;
    sfxEnabled = prefs.sfxOn;
    voiceEnabled = prefs.voiceOn;
    applyGainTargets(false);
    notifyChange();
    return getState();
  }

  function onUnlock(fn) {
    if (typeof fn !== 'function') return () => {};
    unlockListeners.add(fn);
    if (unlocked && ctx) {
      try {
        fn(ctx);
      } catch (_err) {
        // Ignore callback error.
      }
    }
    return () => unlockListeners.delete(fn);
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    changeListeners.add(fn);
    return () => changeListeners.delete(fn);
  }

  function getState() {
    const targetMusic = computeTargetMusicGain();
    return {
      unlocked,
      contextState: ctx ? ctx.state : 'uninitialized',
      masterOn: masterEnabled,
      musicOn: musicEnabled,
      sfxOn: sfxEnabled,
      voiceOn: voiceEnabled,
      masterEnabled,
      musicEnabled,
      sfxEnabled,
      voiceEnabled,
      bgmDucked,
      duckMultiplier: bgmDucked ? DUCK_MULTIPLIER : 1.0,
      duckDb: bgmDucked ? -6 : 0,
      musicGainTarget: targetMusic,
      musicGainValue: musicGain ? Number(musicGain.gain.value.toFixed(4)) : targetMusic,
    };
  }

  function dispose() {
    removeGestureListeners();
    unlockListeners.clear();
    changeListeners.clear();
  }

  return {
    get ctx() {
      return ctx;
    },
    get masterGain() {
      ensureContext();
      return masterGain;
    },
    get musicGain() {
      ensureContext();
      return musicGain;
    },
    get sfxGain() {
      ensureContext();
      return sfxGain;
    },
    get voiceGain() {
      ensureContext();
      return voiceGain;
    },
    get unlocked() {
      return unlocked;
    },
    get masterEnabled() {
      return masterEnabled;
    },
    get musicEnabled() {
      return musicEnabled;
    },
    get sfxEnabled() {
      return sfxEnabled;
    },
    get voiceEnabled() {
      return voiceEnabled;
    },
    get musicOn() {
      return musicEnabled;
    },
    get sfxOn() {
      return sfxEnabled;
    },
    get voiceOn() {
      return voiceEnabled;
    },
    get bgmDucked() {
      return bgmDucked;
    },
    get duckMultiplier() {
      return bgmDucked ? DUCK_MULTIPLIER : 1.0;
    },
    get duckDb() {
      return bgmDucked ? -6 : 0;
    },
    ensureContext,
    unlock,
    onUnlock,
    onChange,
    setMasterEnabled,
    setMusicEnabled,
    setSfxEnabled,
    setVoiceEnabled,
    toggleMusic: () => setMusicEnabled(!musicEnabled),
    toggleSfx: () => setSfxEnabled(!sfxEnabled),
    toggleVoice: () => setVoiceEnabled(!voiceEnabled),
    duckMusic,
    syncFromPrefs,
    getState,
    dispose,
  };
}
