// Bright, cheerful procedural marimba + plucked bass + light wooden shaker adventure BGM
// in C-major / G-major (116 BPM) with soft warm lowpass timbre so neural VO sits crisp on top.

const BPM = 116;
const EIGHTH_SEC = 60 / BPM / 2; // ~0.25862 s per eighth note
const SCHEDULE_INTERVAL_MS = 80;
const LOOKAHEAD_SEC = 0.24;

// MIDI -> Hz helper
function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 4-section, 32-bar (256 eighth-note) non-repetitive toy-island progression in C-major / G-major.
// Each bar has 8 eighth-note slots: root bass MIDI, chord triad MIDIs, and playful marimba melody MIDIs (0 = rest).
const SONG_BARS = [
  // Section A: Sunny Star Garden (C - G - Am - F - C - G - F - G)
  { bass: 48, chord: [60, 64, 67], mel: [72, 0, 76, 79, 76, 0, 74, 72] },
  { bass: 43, chord: [59, 62, 67], mel: [74, 0, 79, 0, 76, 74, 71, 0] },
  { bass: 45, chord: [60, 64, 69], mel: [72, 74, 76, 0, 81, 0, 79, 76] },
  { bass: 41, chord: [60, 65, 69], mel: [77, 0, 76, 74, 72, 0, 69, 0] },
  { bass: 48, chord: [60, 64, 67], mel: [76, 0, 79, 84, 79, 0, 76, 74] },
  { bass: 43, chord: [59, 62, 67], mel: [74, 76, 79, 0, 83, 0, 79, 0] },
  { bass: 41, chord: [60, 65, 69], mel: [81, 0, 79, 77, 76, 0, 74, 72] },
  { bass: 43, chord: [59, 62, 67], mel: [74, 0, 79, 0, 74, 0, 0, 0] },

  // Section B: Bouncy Meadow & Farm Lift in G-major (G - D - Em - C - G - D - C - D)
  { bass: 43, chord: [59, 62, 67], mel: [79, 0, 83, 79, 74, 0, 76, 79] },
  { bass: 50, chord: [62, 66, 69], mel: [78, 0, 81, 0, 78, 76, 74, 0] },
  { bass: 40, chord: [59, 64, 67], mel: [76, 79, 83, 0, 79, 0, 76, 74] },
  { bass: 48, chord: [60, 64, 67], mel: [76, 0, 74, 72, 74, 0, 76, 0] },
  { bass: 43, chord: [59, 62, 67], mel: [79, 81, 83, 0, 86, 0, 83, 79] },
  { bass: 50, chord: [62, 66, 69], mel: [81, 0, 78, 74, 76, 0, 78, 0] },
  { bass: 48, chord: [60, 64, 67], mel: [79, 0, 76, 72, 74, 76, 79, 0] },
  { bass: 50, chord: [62, 66, 69], mel: [78, 0, 81, 0, 79, 0, 74, 0] },

  // Section A': Sparkle Flowerpot Bloom Variation
  { bass: 48, chord: [60, 64, 67], mel: [84, 0, 79, 76, 79, 0, 81, 79] },
  { bass: 43, chord: [59, 62, 67], mel: [79, 76, 74, 0, 79, 0, 74, 0] },
  { bass: 45, chord: [60, 64, 69], mel: [76, 0, 81, 84, 81, 0, 79, 76] },
  { bass: 41, chord: [60, 65, 69], mel: [77, 79, 81, 0, 76, 0, 72, 0] },
  { bass: 48, chord: [60, 64, 67], mel: [72, 76, 79, 0, 84, 0, 79, 76] },
  { bass: 40, chord: [59, 64, 67], mel: [79, 0, 76, 74, 71, 0, 74, 76] },
  { bass: 41, chord: [60, 65, 69], mel: [77, 0, 81, 0, 79, 76, 74, 0] },
  { bass: 43, chord: [59, 62, 67], mel: [74, 79, 83, 0, 79, 0, 72, 0] },

  // Section C: Cozy Rainbow Bridge (F - C - Dm - G - Em - Am - Dm - G)
  { bass: 41, chord: [60, 65, 69], mel: [77, 0, 81, 77, 72, 0, 76, 77] },
  { bass: 48, chord: [60, 64, 67], mel: [76, 0, 79, 0, 76, 74, 72, 0] },
  { bass: 50, chord: [62, 65, 69], mel: [74, 77, 81, 0, 77, 0, 74, 72] },
  { bass: 43, chord: [59, 62, 67], mel: [74, 0, 79, 0, 83, 79, 74, 0] },
  { bass: 40, chord: [59, 64, 67], mel: [79, 0, 76, 71, 76, 0, 79, 0] },
  { bass: 45, chord: [60, 64, 69], mel: [81, 0, 76, 72, 76, 0, 81, 0] },
  { bass: 50, chord: [62, 65, 69], mel: [77, 79, 81, 0, 76, 77, 79, 0] },
  { bass: 43, chord: [59, 62, 67], mel: [79, 0, 74, 79, 84, 0, 0, 0] },
];

export function createMusic(audio) {
  let playing = false;
  let mood = 'island'; // 'island' | 'titan' | 'victory'
  let stepIndex = 0;
  let nextNoteTime = 0;
  let timerId = null;

  let mixBus = null;
  let warmthFilter = null;
  let shakerBuffer = null;

  function ensureGraph() {
    const ctx = audio.ctx;
    if (!ctx) return null;
    if (mixBus && warmthFilter) return ctx;

    // Gentle 2.4 kHz lowpass keeps wooden marimba & bass cozy and leaves 2.5-5 kHz wide open for VO!
    warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = 2450;
    warmthFilter.Q.value = 0.55;

    mixBus = ctx.createGain();
    mixBus.gain.value = 0.24;

    warmthFilter.connect(mixBus);
    mixBus.connect(audio.musicGain);

    // Pre-bake reusable 45 ms soft shaker noise buffer once.
    const frames = Math.max(256, Math.floor(ctx.sampleRate * 0.045));
    shakerBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = shakerBuffer.getChannelData(0);
    let seed = 1337;
    for (let i = 0; i < frames; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 2147483648) - 1;
      const env = Math.sin((i / frames) * Math.PI);
      data[i] = white * env * 0.65;
    }

    return ctx;
  }

  function playMarimba(ctx, when, midi, gainAmt = 0.24, dur = 0.22) {
    const freq = midiToHz(midi);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);

    const woody = ctx.createOscillator();
    woody.type = 'triangle';
    woody.frequency.setValueAtTime(freq * 2, when);

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, when);
    noteGain.gain.linearRampToValueAtTime(gainAmt, when + 0.007);
    noteGain.gain.exponentialRampToValueAtTime(0.0008, when + dur);

    const woodyGain = ctx.createGain();
    woodyGain.gain.setValueAtTime(0.0001, when);
    woodyGain.gain.linearRampToValueAtTime(gainAmt * 0.25, when + 0.004);
    woodyGain.gain.exponentialRampToValueAtTime(0.0005, when + Math.min(0.055, dur * 0.4));

    osc.connect(noteGain);
    woody.connect(woodyGain);
    woodyGain.connect(noteGain);
    noteGain.connect(warmthFilter);

    osc.start(when);
    woody.start(when);
    osc.stop(when + dur + 0.015);
    woody.stop(when + Math.min(0.07, dur) + 0.01);
  }

  function playPluckedBass(ctx, when, midi, gainAmt = 0.26, dur = 0.25) {
    const freq = midiToHz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, when);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(460, when);
    lp.frequency.exponentialRampToValueAtTime(210, when + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gainAmt, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);

    osc.connect(lp);
    lp.connect(g);
    g.connect(warmthFilter);

    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function playShaker(ctx, when, accent = false) {
    if (!shakerBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = shakerBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(accent ? 4400 : 3800, when);
    bp.Q.value = 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.045 : 0.026, when);

    src.connect(bp);
    bp.connect(g);
    g.connect(mixBus);

    src.start(when);
  }

  function scheduleStep(ctx, step, when) {
    const barIdx = Math.floor(step / 8) % SONG_BARS.length;
    const slot = step % 8;
    const bar = SONG_BARS[barIdx];
    const pitchShift = mood === 'victory' ? 2 : 0;

    // Plucked bouncy root-fifth bass on beats 1, 2&, 3, 4
    if (slot === 0 || slot === 4) {
      playPluckedBass(ctx, when, bar.bass + pitchShift, 0.26, 0.24);
    } else if (slot === 3 || slot === 6) {
      const fifth = bar.bass + 7 + pitchShift;
      playPluckedBass(ctx, when, fifth, 0.16, 0.17);
    }

    // Warm off-beat kalimba chord plucks
    if (slot === 2 || slot === 6) {
      const chordNote = bar.chord[(slot === 2 ? 1 : 2) % bar.chord.length] + pitchShift;
      playMarimba(ctx, when, chordNote, 0.09, 0.16);
    }

    // Cheerful lead wooden marimba
    const melMidi = bar.mel[slot];
    if (melMidi > 0) {
      const swingOffset = slot % 2 === 1 ? 0.012 : 0;
      const vel = slot % 2 === 0 ? 0.22 : 0.17;
      playMarimba(ctx, when + swingOffset, melMidi + pitchShift, vel, 0.23);
    }

    // Light wooden shaker on eighth pulses (stronger on off-beats)
    if (slot % 2 === 1) {
      playShaker(ctx, when + 0.01, slot === 3 || slot === 7);
    } else if (mood === 'titan' || mood === 'victory') {
      playShaker(ctx, when, false);
    }
  }

  function pumpScheduler() {
    if (!playing || !audio.musicEnabled || !audio.masterEnabled) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const ctx = ensureGraph();
    if (!ctx || ctx.state !== 'running') return;

    const tempoScale = mood === 'titan' ? 0.94 : mood === 'victory' ? 0.92 : 1.0;
    const stepDur = EIGHTH_SEC * tempoScale;

    if (nextNoteTime < ctx.currentTime - 0.05) {
      nextNoteTime = ctx.currentTime + 0.03;
    }

    while (nextNoteTime < ctx.currentTime + LOOKAHEAD_SEC) {
      scheduleStep(ctx, stepIndex, nextNoteTime);
      nextNoteTime += stepDur;
      stepIndex = (stepIndex + 1) % (SONG_BARS.length * 8);
    }
  }

  function start() {
    playing = true;
    const ctx = ensureGraph();
    if (ctx && ctx.state === 'running') {
      nextNoteTime = Math.max(nextNoteTime, ctx.currentTime + 0.04);
    }
    if (!timerId && typeof setInterval === 'function') {
      timerId = setInterval(pumpScheduler, SCHEDULE_INTERVAL_MS);
    }
    pumpScheduler();
    return playing;
  }

  function stop() {
    playing = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    return playing;
  }

  function setMood(nextMood = 'island') {
    if (nextMood === 'island' || nextMood === 'titan' || nextMood === 'victory') {
      mood = nextMood;
    }
    return mood;
  }

  function update(_dt) {
    if (playing) {
      pumpScheduler();
    }
  }

  const offUnlock = audio.onUnlock(() => {
    if (playing) {
      const ctx = ensureGraph();
      if (ctx) {
        nextNoteTime = ctx.currentTime + 0.04;
        pumpScheduler();
      }
    }
  });

  function getState() {
    return {
      playing,
      bpm: BPM,
      mood,
      stepIndex,
      ducked: audio.bgmDucked,
      duckMultiplier: audio.duckMultiplier,
    };
  }

  function dispose() {
    stop();
    offUnlock();
  }

  return {
    start,
    stop,
    setMood,
    update,
    isPlaying: () => playing,
    getState,
    dispose,
  };
}
