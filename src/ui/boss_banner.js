// Non-interactive Titan Boss HP Banner + Comic POW!/BONK!/BOING! popups (owner: lucky-ui).
// Strictly pointer-events: none so active-play clickable control count stays <= 5.

import { TITANS, resolveBossId } from '../data/catalog.js';
import { STRINGS, formatTierBadge } from '../data/strings.js';

const MAX_ACTIVE_BURSTS = 8;
const BURST_LIFETIME_SEC = 0.78;

function resolveActiveTitan(state, ctx) {
  const fromManager = ctx.titans?.getActive?.();
  if (fromManager && !fromManager.defeated && (fromManager.hp === undefined || fromManager.hp > 0)) {
    return fromManager;
  }
  const t = state?.activeTitan || state?.titans?.active || null;
  if (t && !t.defeated && (t.hp === undefined || t.hp > 0)) {
    return t;
  }
  const list = Array.isArray(state?.titans)
    ? state.titans
    : Array.isArray(state?.titans?.list)
      ? state.titans.list
      : null;
  if (list) {
    for (const item of list) {
      if (item && item.active !== false && !item.defeated && (item.hp ?? 1) > 0) {
        return item;
      }
    }
  }
  return null;
}

export function createBossBanner(ctx = {}) {
  const layer =
    (typeof document !== 'undefined' &&
      (document.getElementById('ui-layer') || document.body)) ||
    null;

  if (!layer) {
    return {
      el: null,
      burstLayer: null,
      spawnComicBurst() {},
      spawnComicBurstWorld() {},
      update() {},
      hide() {},
      destroy() {},
    };
  }

  let banner = document.getElementById('boss-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'boss-banner';
    layer.appendChild(banner);
  }
  banner.className = 'boss-banner';
  banner.hidden = true;
  banner.setAttribute('aria-live', 'polite');

  banner.innerHTML = `
    <div class="boss-header-row">
      <span class="boss-icon" id="boss-icon" aria-hidden="true">\uD83C\uDF3F</span>
      <span class="boss-name" id="boss-name">MOSS TITAN</span>
      <span class="boss-gate-pill" id="boss-gate-pill">\u26051 BONK!</span>
    </div>
    <div class="boss-hp-track">
      <div class="boss-hp-trail" id="boss-hp-trail"></div>
      <div class="boss-hp-fill" id="boss-hp-fill"></div>
      <span class="boss-hp-text" id="boss-hp-text">40 / 40</span>
    </div>
  `;

  let burstLayer = document.getElementById('comic-burst-layer');
  if (!burstLayer) {
    burstLayer = document.createElement('div');
    burstLayer.id = 'comic-burst-layer';
    burstLayer.className = 'comic-burst-layer';
    burstLayer.setAttribute('aria-hidden', 'true');
    layer.appendChild(burstLayer);
  }

  const iconEl = banner.querySelector('#boss-icon');
  const nameEl = banner.querySelector('#boss-name');
  const gateEl = banner.querySelector('#boss-gate-pill');
  const fillEl = banner.querySelector('#boss-hp-fill');
  const trailEl = banner.querySelector('#boss-hp-trail');
  const hpTextEl = banner.querySelector('#boss-hp-text');

  const activeBursts = [];
  let lastTitanId = null;
  let lastHp = null;
  let trailPct = 100;
  let hitShakeTimer = 0;
  let lastBonkCount = 0;
  let lastBoingCount = 0;
  let lastManualBurstMs = -Infinity;
  let wordCycle = 0;

  const nowMs = () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  function clampScreenPos(x, y) {
    const vw = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
    const padX = Math.min(86, Math.max(66, vw * 0.17));
    let minY = vh < 560 ? 148 : 132;
    let maxY = vh - (vh < 560 ? 156 : 210);

    if (typeof document !== 'undefined') {
      const statusEl = document.getElementById('hud-status');
      if (statusEl) {
        const sr = statusEl.getBoundingClientRect();
        if (sr.height > 0) {
          minY = Math.max(minY, sr.bottom + 54);
        }
      }
      if (banner && !banner.hidden) {
        const br = banner.getBoundingClientRect();
        if (br.height > 0) {
          minY = Math.max(minY, br.bottom + 54);
        }
      }
      const subEl = document.getElementById('voice-subtitle');
      if (subEl && !subEl.hidden) {
        const subR = subEl.getBoundingClientRect();
        if (subR.height > 0 && subR.top > vh * 0.42) {
          maxY = Math.min(maxY, subR.top - 32);
        }
      }
      const actEl = document.getElementById('hud-actions');
      if (actEl) {
        const actR = actEl.getBoundingClientRect();
        if (actR.height > 0) {
          maxY = Math.min(maxY, actR.top - 32);
        }
      }
    }
    if (maxY < minY) {
      maxY = minY;
    }
    return {
      x: Math.max(padX, Math.min(vw - padX, Number.isFinite(x) ? x : vw * 0.5)),
      y: Math.max(minY, Math.min(maxY, Number.isFinite(y) ? y : (minY + maxY) * 0.5)),
    };
  }

  function clearBursts() {
    while (activeBursts.length > 0) {
      const b = activeBursts.pop();
      b?.el?.remove();
    }
  }

  function spawnComicBurst(text = 'POW!', screenX = null, screenY = null, color = '#ffd43b', opts = {}) {
    if (!burstLayer || typeof document === 'undefined') return null;
    if (!opts.autoFromState) {
      lastManualBurstMs = nowMs();
    }

    while (activeBursts.length >= MAX_ACTIVE_BURSTS) {
      const oldest = activeBursts.shift();
      oldest?.el?.remove();
    }

    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const jitterX = (((wordCycle * 37) % 5) - 2) * 14;
    const jitterY = (((wordCycle * 23) % 3) - 1) * 10;
    wordCycle += 1;

    const rawX = screenX == null ? vw * 0.5 + jitterX : Number(screenX);
    const rawY = screenY == null ? vh * 0.4 + jitterY : Number(screenY);
    const pos = clampScreenPos(rawX, rawY);

    const el = document.createElement('div');
    const cleanText = String(text || STRINGS.COMIC.hitWords[0]).toUpperCase();
    const isBoing = cleanText.includes('BOING');
    el.className = `comic-burst${isBoing ? ' is-boing' : ''}`;
    el.textContent = cleanText;
    el.style.left = `${pos.x.toFixed(1)}px`;
    el.style.top = `${pos.y.toFixed(1)}px`;
    if (color) {
      el.style.setProperty('--burst-bg', color);
    }

    burstLayer.appendChild(el);
    const record = {
      el,
      age: 0,
      duration: BURST_LIFETIME_SEC,
      baseX: pos.x,
      baseY: pos.y,
      tiltDeg: ((wordCycle % 5) - 2) * 4,
    };
    activeBursts.push(record);
    return el;
  }

  function spawnComicBurstWorld(text, wx, wy, wz, camera, color = '#ffd43b') {
    const cam = camera || ctx.camera;
    if (cam && typeof cam.updateMatrixWorld === 'function' && cam.matrixWorldInverse && cam.projectionMatrix) {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      // Project 3D point via camera view-projection without allocating Three.js Vector3 if unavailable.
      const me = cam.matrixWorldInverse.elements;
      const pe = cam.projectionMatrix.elements;
      const vx = me[0] * wx + me[4] * wy + me[8] * wz + me[12];
      const vy = me[1] * wx + me[5] * wy + me[9] * wz + me[13];
      const vz = me[2] * wx + me[6] * wy + me[10] * wz + me[14];
      const vwHom = me[3] * wx + me[7] * wy + me[11] * wz + me[15];
      const cx = pe[0] * vx + pe[4] * vy + pe[8] * vz + pe[12] * vwHom;
      const cy = pe[1] * vx + pe[5] * vy + pe[9] * vz + pe[13] * vwHom;
      const cw = pe[3] * vx + pe[7] * vy + pe[11] * vz + pe[15] * vwHom;
      if (cw > 0.05) {
        const ndcX = cx / cw;
        const ndcY = cy / cw;
        const sx = (ndcX * 0.5 + 0.5) * vw;
        const sy = (-ndcY * 0.5 + 0.5) * vh;
        return spawnComicBurst(text, sx, sy, color);
      }
    }
    return spawnComicBurst(text, null, null, color);
  }

  function updateBursts(dt) {
    for (let i = activeBursts.length - 1; i >= 0; i -= 1) {
      const b = activeBursts[i];
      b.age += dt;
      const p = Math.min(1, b.age / b.duration);
      if (p >= 1) {
        b.el.remove();
        activeBursts.splice(i, 1);
        continue;
      }
      const popScale =
        p < 0.22
          ? 0.45 + (p / 0.22) * 0.72
          : p < 0.45
            ? 1.17 - ((p - 0.22) / 0.23) * 0.17
            : 1.0 - ((p - 0.45) / 0.55) * 0.12;
      const clamped = clampScreenPos(b.baseX, b.baseY);
      b.el.style.left = `${clamped.x.toFixed(1)}px`;
      b.el.style.top = `${clamped.y.toFixed(1)}px`;
      const risePx = p * 24;
      const alpha = p < 0.68 ? 1 : Math.max(0, 1 - (p - 0.68) / 0.32);
      b.el.style.opacity = alpha.toFixed(2);
      b.el.style.transform = `translate(-50%, calc(-50% - ${risePx.toFixed(1)}px)) scale(${popScale.toFixed(3)}) rotate(${b.tiltDeg}deg)`;
    }
  }

  function hide() {
    banner.hidden = true;
    banner.classList.remove('is-hit', 'is-undergeared');
    clearBursts();
    if (burstLayer) burstLayer.hidden = true;
  }

  function update(dt = 1 / 60, state = ctx.state, modalOpen = false) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 1 / 60));

    if (!state || state.mode !== 'playing' || modalOpen) {
      hide();
      return;
    }

    if (burstLayer) burstLayer.hidden = false;
    updateBursts(safeDt);

    // Auto-emit comic bursts if state.feedback counters incremented without a manual call.
    const bonks = Number(state.feedback?.bonks) || 0;
    const boings = Number(state.feedback?.boings) || 0;
    const recentManual = nowMs() - lastManualBurstMs < 110;
    if (bonks > lastBonkCount) {
      if (!recentManual && state.mode === 'playing') {
        const words = STRINGS.COMIC.hitWords;
        const word = words[bonks % words.length];
        spawnComicBurst(word, null, null, '#ffd43b', { autoFromState: true });
      }
      lastBonkCount = bonks;
    } else if (bonks < lastBonkCount) {
      lastBonkCount = bonks;
    }

    if (boings > lastBoingCount) {
      if (!recentManual && state.mode === 'playing') {
        spawnComicBurst(STRINGS.COMIC.boingWord, null, null, '#74c0fc', { autoFromState: true });
      }
      lastBoingCount = boings;
    } else if (boings < lastBoingCount) {
      lastBoingCount = boings;
    }

    const active = resolveActiveTitan(state, ctx);
    if (!active) {
      lastTitanId = null;
      lastHp = null;
      banner.hidden = true;
      banner.classList.remove('is-hit', 'is-undergeared');
      return;
    }

    const rawTitanId = active.id || active.titanId || 'tralalero_tralala';
    const titanId = resolveBossId(rawTitanId);
    const spec = TITANS[titanId] || TITANS.tralalero_tralala;
    const copy = STRINGS.TITANS[titanId] || STRINGS.TITANS.tralalero_tralala;
    const maxHp = Math.max(1, Number(active.maxHp ?? spec.maxHp) || 40);
    const hp = Math.max(0, Math.min(maxHp, Number(active.hp ?? maxHp)));
    const reqTier = Math.max(1, Number(active.requiredTier ?? spec.requiredTier) || 1);
    const powerTier = Math.max(1, Number(state.player?.powerTier) || 1);
    const canBeat = powerTier >= reqTier;

    banner.hidden = false;
    iconEl.textContent = copy.icon;
    nameEl.textContent = `${copy.short} ${formatTierBadge(reqTier)}`;

    if (canBeat) {
      gateEl.textContent = `${STRINGS.BOSS.readyTag}`;
      gateEl.className = 'boss-gate-pill is-ready';
      banner.classList.remove('is-undergeared');
    } else {
      gateEl.textContent = `${STRINGS.BOSS.needPrefix} ${formatTierBadge(reqTier)}!`;
      gateEl.className = 'boss-gate-pill is-need';
      banner.classList.add('is-undergeared');
    }

    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    if (titanId !== lastTitanId) {
      lastTitanId = titanId;
      lastHp = hp;
      trailPct = hpPct;
    } else if (lastHp !== null && hp < lastHp) {
      hitShakeTimer = 0.22;
      lastHp = hp;
    } else {
      lastHp = hp;
    }

    if (trailPct > hpPct) {
      trailPct = Math.max(hpPct, trailPct - safeDt * 65);
    } else {
      trailPct = hpPct;
    }

    if (hitShakeTimer > 0) {
      hitShakeTimer = Math.max(0, hitShakeTimer - safeDt);
      banner.classList.add('is-hit');
    } else {
      banner.classList.remove('is-hit');
    }

    fillEl.style.width = `${hpPct.toFixed(1)}%`;
    trailEl.style.width = `${trailPct.toFixed(1)}%`;
    hpTextEl.textContent = `${Math.ceil(hp)} / ${Math.round(maxHp)}`;
  }

  function destroy() {
    for (const b of activeBursts) {
      b.el.remove();
    }
    activeBursts.length = 0;
  }

  return {
    el: banner,
    burstLayer,
    spawnComicBurst,
    spawnComicBurstWorld,
    update,
    hide,
    destroy,
  };
}
