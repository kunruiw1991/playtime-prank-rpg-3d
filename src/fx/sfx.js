// Tactile procedural WebAudio sound effects for Lucky Block Titans 3D (owner: lucky-vo-audio).
// Cozy wooden pops, sparkling chimes, rising roulette ticks, goofy Titan spring boings, and fanfare.

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function createSfx(audio) {
  let noiseBuf = null;
  let playedCount = 0;
  let lastSfx = null;
  const lastTriggerMs = new Map();

  function nowWallMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function canFire(name, minGapMs = 28) {
    const t = nowWallMs();
    const prev = lastTriggerMs.get(name) || -1e9;
    if (t - prev < minGapMs) return false;
    lastTriggerMs.set(name, t);
    playedCount += 1;
    lastSfx = name;
    return true;
  }

  function getReadyCtx() {
    if (!audio.sfxEnabled || !audio.masterEnabled) return null;
    const ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    if (!noiseBuf) {
      const len = Math.max(512, Math.floor(ctx.sampleRate * 0.25));
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      let s = 987654321;
      for (let i = 0; i < len; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        ch[i] = (s / 2147483648) - 1;
      }
    }
    return ctx;
  }

  function playTone(ctx, {
    type = 'sine',
    freqStart = 440,
    freqEnd = null,
    when = ctx.currentTime,
    dur = 0.14,
    gain = 0.22,
    attack = 0.005,
  }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freqStart), when);
    if (freqEnd !== null && freqEnd > 20) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, when + dur);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);

    osc.connect(g);
    g.connect(audio.sfxGain);

    osc.start(when);
    osc.stop(when + dur + 0.015);
  }

  function playNoiseBurst(ctx, {
    when = ctx.currentTime,
    dur = 0.08,
    gain = 0.16,
    filterType = 'bandpass',
    freq = 1400,
    q = 1.2,
  }) {
    if (!noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, when);
    filter.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(audio.sfxGain);

    src.start(when);
    src.stop(when + dur + 0.01);
  }

  function tapGround() {
    if (!canFire('tapGround', 35)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(ctx, { type: 'sine', freqStart: 420, freqEnd: 640, when: t, dur: 0.065, gain: 0.16 });
  }

  function blockHit(comboIdx = 0) {
    if (!canFire('blockHit', 35)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const lift = Math.min(8, Math.max(0, Number(comboIdx) || 0)) * 18;
    playTone(ctx, { type: 'triangle', freqStart: 220 + lift, freqEnd: 125, when: t, dur: 0.075, gain: 0.25 });
    playNoiseBurst(ctx, { when: t, dur: 0.045, gain: 0.14, freq: 1150 + lift * 2, q: 1.5 });
  }

  function blockBreak() {
    if (!canFire('blockBreak', 35)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playNoiseBurst(ctx, { when: t, dur: 0.09, gain: 0.20, freq: 950, q: 0.9 });
    playTone(ctx, { type: 'triangle', freqStart: 260, freqEnd: 520, when: t, dur: 0.09, gain: 0.24 });
    playTone(ctx, { type: 'sine', freqStart: 523.25, freqEnd: 659.25, when: t + 0.045, dur: 0.12, gain: 0.22 });
  }

  function luckyPop() {
    if (!canFire('luckyPop', 40)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [72, 76, 79, 84]; // C5 E5 G5 C6
    notes.forEach((m, idx) => {
      playTone(ctx, {
        type: 'sine',
        freqStart: midiToHz(m),
        freqEnd: midiToHz(m) * 1.02,
        when: t + idx * 0.042,
        dur: 0.16,
        gain: 0.20,
      });
    });
  }

  function starPickup(comboIdx = 0) {
    if (!canFire('starPickup', 22)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const semi = Math.min(7, Math.max(0, Number(comboIdx) || 0));
    const f1 = midiToHz(83 + semi); // B5+
    const f2 = midiToHz(88 + semi); // E6+
    playTone(ctx, { type: 'sine', freqStart: f1, when: t, dur: 0.08, gain: 0.18 });
    playTone(ctx, { type: 'sine', freqStart: f2, when: t + 0.045, dur: 0.16, gain: 0.20 });
  }

  function potPlant() {
    if (!canFire('potPlant', 60)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(ctx, { type: 'triangle', freqStart: 165, freqEnd: 110, when: t, dur: 0.09, gain: 0.24 });
    [60, 64, 67, 71, 72].forEach((m, i) => {
      playTone(ctx, {
        type: 'sine',
        freqStart: midiToHz(m),
        when: t + 0.04 + i * 0.048,
        dur: 0.18,
        gain: 0.19,
      });
    });
  }

  function potFountain() {
    if (!canFire('potFountain', 55)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [79, 83, 86, 91].forEach((m, i) => {
      playTone(ctx, {
        type: 'sine',
        freqStart: midiToHz(m),
        when: t + i * 0.04,
        dur: 0.17,
        gain: 0.15,
      });
    });
  }

  function rouletteTick(pitchIdx = 0) {
    if (!canFire('rouletteTick', 18)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const step = Math.max(0, Math.min(24, Number(pitchIdx) || 0));
    const scaleOffsets = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const semi = scaleOffsets[step % scaleOffsets.length] + Math.floor(step / scaleOffsets.length) * 5;
    const hz = midiToHz(67 + Math.min(24, semi));
    playTone(ctx, { type: 'triangle', freqStart: hz, freqEnd: hz * 0.72, when: t, dur: 0.055, gain: 0.21, attack: 0.002 });
    playNoiseBurst(ctx, { when: t, dur: 0.02, gain: 0.08, freq: 2400, q: 2.0 });
  }

  function rouletteJackpot() {
    if (!canFire('rouletteJackpot', 80)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const fanfare = [
      { m: 72, dt: 0.0, d: 0.12 },
      { m: 76, dt: 0.09, d: 0.12 },
      { m: 79, dt: 0.18, d: 0.14 },
      { m: 84, dt: 0.28, d: 0.38 },
      { m: 88, dt: 0.36, d: 0.42 },
    ];
    for (const n of fanfare) {
      playTone(ctx, { type: 'triangle', freqStart: midiToHz(n.m), when: t + n.dt, dur: n.d, gain: 0.24 });
      playTone(ctx, { type: 'sine', freqStart: midiToHz(n.m + 12), when: t + n.dt + 0.01, dur: n.d * 0.8, gain: 0.11 });
    }
  }

  function gearEquip() {
    if (!canFire('gearEquip', 60)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [65, 69, 72, 77, 81].forEach((m, i) => {
      playTone(ctx, { type: 'triangle', freqStart: midiToHz(m), when: t + i * 0.045, dur: 0.2, gain: 0.20 });
    });
  }

  function critterHappy(kind = 'piggy') {
    if (!canFire('critterHappy', 50)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'bee') {
      playTone(ctx, { type: 'triangle', freqStart: 540, freqEnd: 740, when: t, dur: 0.09, gain: 0.18 });
      playTone(ctx, { type: 'sine', freqStart: 780, freqEnd: 980, when: t + 0.08, dur: 0.11, gain: 0.18 });
    } else if (kind === 'chick') {
      playTone(ctx, { type: 'sine', freqStart: 920, freqEnd: 1240, when: t, dur: 0.07, gain: 0.18 });
      playTone(ctx, { type: 'sine', freqStart: 980, freqEnd: 1360, when: t + 0.085, dur: 0.08, gain: 0.18 });
    } else {
      // Bouncy piggy giggle pop
      playTone(ctx, { type: 'triangle', freqStart: 310, freqEnd: 470, when: t, dur: 0.085, gain: 0.22 });
      playTone(ctx, { type: 'triangle', freqStart: 350, freqEnd: 560, when: t + 0.095, dur: 0.10, gain: 0.22 });
    }
  }

  function titanTremor() {
    if (!canFire('titanTremor', 80)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      playTone(ctx, {
        type: 'triangle',
        freqStart: 92 - (i % 2) * 14,
        freqEnd: 58,
        when: t + i * 0.075,
        dur: 0.11,
        gain: 0.24,
      });
    }
    playNoiseBurst(ctx, { when: t, dur: 0.35, gain: 0.12, filterType: 'lowpass', freq: 280, q: 0.8 });
  }

  function titanSpawnFanfare() {
    if (!canFire('titanSpawnFanfare', 90)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Playful cartoon timpani bounce + toy trumpet fanfare
    playTone(ctx, { type: 'triangle', freqStart: 120, freqEnd: 65, when: t, dur: 0.18, gain: 0.28 });
    const brass = [
      { m: 55, dt: 0.06, d: 0.12 },
      { m: 60, dt: 0.17, d: 0.12 },
      { m: 64, dt: 0.28, d: 0.14 },
      { m: 67, dt: 0.40, d: 0.34 },
    ];
    for (const b of brass) {
      playTone(ctx, { type: 'triangle', freqStart: midiToHz(b.m), when: t + b.dt, dur: b.d, gain: 0.25 });
      playTone(ctx, { type: 'sine', freqStart: midiToHz(b.m + 12), when: t + b.dt, dur: b.d, gain: 0.15 });
    }
  }

  function titanBonk(comboIdx = 0) {
    if (!canFire('titanBonk', 40)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const boost = Math.min(6, Math.max(0, Number(comboIdx) || 0)) * 22;
    // Meaty rubber mallet thump + comical hollow coconut pop
    playTone(ctx, { type: 'sine', freqStart: 175, freqEnd: 64, when: t, dur: 0.13, gain: 0.32, attack: 0.003 });
    playTone(ctx, { type: 'triangle', freqStart: 390 + boost, freqEnd: 640 + boost, when: t + 0.015, dur: 0.095, gain: 0.24 });
    playNoiseBurst(ctx, { when: t, dur: 0.05, gain: 0.16, freq: 900, q: 1.2 });
  }

  function cloudBoing() {
    if (!canFire('cloudBoing', 80)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Classic cartoon spring BOING with pitch wobble!
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, t);
    osc.frequency.exponentialRampToValueAtTime(690, t + 0.22);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.34);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.52);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(24, t);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(42, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.56);

    osc.connect(g);
    g.connect(audio.sfxGain);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.58);
    lfo.stop(t + 0.58);
  }

  function titanPinataPop() {
    if (!canFire('titanPinataPop', 90)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Balloon stretch -> giant confetti pop -> candy star cascade!
    playTone(ctx, { type: 'sine', freqStart: 240, freqEnd: 680, when: t, dur: 0.16, gain: 0.24 });
    playNoiseBurst(ctx, { when: t + 0.15, dur: 0.16, gain: 0.28, freq: 1350, q: 0.7 });
    playTone(ctx, { type: 'triangle', freqStart: 150, freqEnd: 58, when: t + 0.15, dur: 0.20, gain: 0.30 });
    [72, 76, 79, 84, 88, 91].forEach((m, i) => {
      playTone(ctx, {
        type: 'sine',
        freqStart: midiToHz(m),
        when: t + 0.18 + i * 0.045,
        dur: 0.24,
        gain: 0.20,
      });
    });
  }

  function victoryFireworks() {
    if (!canFire('victoryFireworks', 120)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Rising firework whistle + soft pop + grand C-major royal chord cascade
    playTone(ctx, { type: 'sine', freqStart: 420, freqEnd: 1380, when: t, dur: 0.24, gain: 0.16 });
    playNoiseBurst(ctx, { when: t + 0.24, dur: 0.20, gain: 0.22, freq: 1600, q: 0.8 });
    const fanfare = [60, 64, 67, 72, 76, 79, 84];
    fanfare.forEach((m, i) => {
      playTone(ctx, {
        type: 'triangle',
        freqStart: midiToHz(m),
        when: t + 0.12 + i * 0.065,
        dur: 0.42,
        gain: 0.21,
      });
    });
  }

  function uiTap() {
    if (!canFire('uiTap', 30)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    playTone(ctx, { type: 'sine', freqStart: 520, freqEnd: 740, when: ctx.currentTime, dur: 0.055, gain: 0.16 });
  }

  function jump() {
    if (!canFire('jump', 55)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Classic cheerful Mario-style upward spring whistle
    playTone(ctx, { type: 'square', freqStart: 240, freqEnd: 560, when: t, dur: 0.12, gain: 0.16 });
    playTone(ctx, { type: 'sine', freqStart: 420, freqEnd: 880, when: t + 0.03, dur: 0.14, gain: 0.22 });
  }

  function land() {
    if (!canFire('land', 45)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(ctx, { type: 'triangle', freqStart: 170, freqEnd: 78, when: t, dur: 0.075, gain: 0.20 });
    playNoiseBurst(ctx, { when: t, dur: 0.05, gain: 0.09, filterType: 'lowpass', freq: 480, q: 0.9 });
  }

  function stickThrow() {
    if (!canFire('stickThrow', 60)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Spinning wooden Kentungan Sahur stick whoosh + rhythmic chime
    playNoiseBurst(ctx, { when: t, dur: 0.16, gain: 0.16, filterType: 'bandpass', freq: 1120, q: 1.4 });
    playTone(ctx, { type: 'triangle', freqStart: 360, freqEnd: 680, when: t, dur: 0.11, gain: 0.22 });
    playTone(ctx, { type: 'sine', freqStart: 540, freqEnd: 860, when: t + 0.08, dur: 0.11, gain: 0.18 });
  }

  function stickCatch() {
    if (!canFire('stickCatch', 45)) return;
    const ctx = getReadyCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Crisp wooden catch pop + bright confirmation sparkle
    playTone(ctx, { type: 'triangle', freqStart: 480, freqEnd: 760, when: t, dur: 0.075, gain: 0.21 });
    playTone(ctx, { type: 'sine', freqStart: 760, freqEnd: 1040, when: t + 0.04, dur: 0.085, gain: 0.18 });
  }

  function getState() {
    return {
      playedCount,
      lastSfx,
    };
  }

  return {
    tapGround,
    blockHit,
    blockBreak,
    luckyPop,
    starPickup,
    gemPickup: starPickup,
    potPlant,
    potFountain,
    rouletteTick,
    rouletteJackpot,
    rouletteWin: rouletteJackpot,
    gearEquip,
    critterHappy,
    titanTremor,
    titanSpawnFanfare,
    titanSpawn: titanSpawnFanfare,
    titanBonk,
    cloudBoing,
    titanPinataPop,
    titanPinata: titanPinataPop,
    victoryFireworks,
    victoryFanfare: victoryFireworks,
    uiTap,
    jump,
    land,
    jumpLand: land,
    stickThrow,
    stickCatch,
    swing: () => blockHit(0),
    getState,
  };
}
