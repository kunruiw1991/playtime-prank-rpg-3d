// 280ms pointerup -> pointerup tactile debounce helper (owner: lucky-ui).
// Prevents rapid kid double-taps from double-spending stars or closing newly opened modals,
// while supporting keyboard Enter/Space and programmatic .click() in tests.

const DEFAULT_DEBOUNCE_MS = 280;
const COORD_SHIELD_RADIUS_PX = 44;

let lastPointerCoordAt = -Infinity;
let lastPointerX = -9999;
let lastPointerY = -9999;
let modalShieldUntil = -Infinity;

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function markModalOpened(shieldMs = DEFAULT_DEBOUNCE_MS) {
  modalShieldUntil = nowMs() + Math.max(0, Number(shieldMs) || 0);
}

export function resetTapDebounce() {
  lastPointerCoordAt = -Infinity;
  lastPointerX = -9999;
  lastPointerY = -9999;
  modalShieldUntil = -Infinity;
}

/**
 * Binds a kid-safe debounced tap handler on `el` using `pointerup` as primary trigger,
 * plus keyboard (`Enter` / `Space`) and synthetic `.click()` fallback.
 *
 * @param {HTMLElement} el
 * @param {(ev: Event) => void} handler
 * @param {number | { debounceMs?: number, guardModalOpen?: boolean }} [options]
 * @returns {() => void} cleanup function
 */
export function bindTap(el, handler, options = DEFAULT_DEBOUNCE_MS) {
  if (!el || typeof handler !== 'function') {
    return () => {};
  }

  const debounceMs =
    typeof options === 'number'
      ? options
      : Number(options?.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  const guardModalOpen =
    typeof options === 'object' && options !== null ? Boolean(options.guardModalOpen) : false;

  let lastFireAt = -Infinity;
  let lastPointerEventAt = -Infinity;
  let lastPointerDownAt = -Infinity;
  let activePointerId = null;

  function clearPressed() {
    activePointerId = null;
    el.classList.remove('is-pressed');
  }

  function isDisabled() {
    return (
      el.disabled === true ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.classList.contains('is-disabled')
    );
  }

  function tryInvoke(ev, hasPointerCoords, clientX, clientY) {
    if (isDisabled()) return false;
    const t = nowMs();
    // Anchor rapid tap window to pointerdown when available so main-thread/CDP delays between
    // pointerdown and pointerup never let a <280ms double-tap slip past the 280ms gate.
    const gestureStart =
      hasPointerCoords && lastPointerDownAt >= lastFireAt ? lastPointerDownAt : t;

    // Per-button 280ms gate: prevents rapid double-tap on the same control.
    if (gestureStart - lastFireAt < debounceMs || t - lastFireAt < debounceMs) {
      return false;
    }

    // Same-spot coordinate 280ms gate: if a tap just swapped screens/modals underneath the finger,
    // a second tap within 280ms at the same screen location will not trigger the newly revealed button.
    const coordStart =
      hasPointerCoords && lastPointerDownAt >= lastPointerCoordAt ? lastPointerDownAt : t;
    if (hasPointerCoords && (coordStart - lastPointerCoordAt < debounceMs || t - lastPointerCoordAt < debounceMs)) {
      const dist = Math.hypot(clientX - lastPointerX, clientY - lastPointerY);
      if (dist <= COORD_SHIELD_RADIUS_PX) {
        return false;
      }
    }

    // Optional extra guard for modal dismiss/backdrop buttons right after modal opens via pointer.
    if (guardModalOpen && hasPointerCoords && gestureStart < modalShieldUntil) {
      return false;
    }

    lastFireAt = t;
    if (hasPointerCoords) {
      lastPointerCoordAt = t;
      lastPointerX = clientX;
      lastPointerY = clientY;
    }

    handler(ev);
    return true;
  }

  function onPointerDown(ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.stopPropagation();
    lastPointerDownAt = nowMs();
    if (isDisabled()) return;
    activePointerId = ev.pointerId;
    el.classList.add('is-pressed');
  }

  function onPointerUp(ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.stopPropagation();
    lastPointerEventAt = nowMs();
    clearPressed();

    // Verify pointer released within reasonably generous slop around element bounds.
    const rect = el.getBoundingClientRect();
    const slop = 14;
    const cx = Number(ev.clientX);
    const cy = Number(ev.clientY);
    const hasCoords = Number.isFinite(cx) && Number.isFinite(cy) && (cx !== 0 || cy !== 0);
    if (hasCoords && rect.width > 0 && rect.height > 0) {
      if (
        cx < rect.left - slop ||
        cx > rect.right + slop ||
        cy < rect.top - slop ||
        cy > rect.bottom + slop
      ) {
        return;
      }
    }

    tryInvoke(ev, hasCoords, cx, cy);
  }

  function onPointerCancel() {
    clearPressed();
  }

  function onClick(ev) {
    ev.stopPropagation();
    const t = nowMs();
    // Ignore native follow-up click emitted right after pointerup (whether fired or debounced).
    if (t - lastPointerEventAt < 340) {
      ev.preventDefault();
      return;
    }
    const cx = Number(ev.clientX) || 0;
    const cy = Number(ev.clientY) || 0;
    const hasCoords = ev.detail > 0 && (cx !== 0 || cy !== 0);
    tryInvoke(ev, hasCoords, cx, cy);
  }

  function onKeyDown(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.repeat) return;
    tryInvoke(ev, false, 0, 0);
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('pointerleave', onPointerCancel);
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKeyDown);

  if (activePointerId !== null) {
    clearPressed();
  }

  return function unbind() {
    clearPressed();
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
    el.removeEventListener('pointerleave', onPointerCancel);
    el.removeEventListener('click', onClick);
    el.removeEventListener('keydown', onKeyDown);
  };
}
