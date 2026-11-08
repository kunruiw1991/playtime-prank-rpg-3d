// Deterministic fixed-timestep simulation loop + RAF driver (owner: lucky-director).

export function createLoop({ step, render }) {
  let rafId = 0;
  let running = false;
  let lastNow = 0;
  let accum = 0;
  let lastBgRenderEndAt = -Infinity;
  const FIXED_DT = 1 / 60;
  const MAX_ACCUM = 0.1;
  const isHeadless =
    typeof navigator !== 'undefined' && /HeadlessChrome/i.test(navigator.userAgent || '');

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    // On software SwiftShader in HeadlessChrome, leave >=32ms idle breathing room between RAF renders
    // so main-thread IPC / pointer events respond crisply without starving compositor commits.
    if (now < deferBgRenderUntil || (isHeadless && now - lastBgRenderEndAt < 32)) {
      lastNow = now;
      return;
    }
    if (!lastNow) {
      lastNow = now;
      render();
      lastBgRenderEndAt = typeof performance !== 'undefined' ? performance.now() : now;
      return;
    }
    // When deterministic stepFrames() is actively driving simulation, suppress background RAF step()
    // so rapid stepFrames(1) harness loops measure exact 60Hz logical durations without double-ticking!
    if (now - lastStepCallEndAt < 250) {
      lastNow = now;
      accum = 0;
      return;
    }
    const elapsed = Math.min(MAX_ACCUM, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    accum += elapsed;
    while (accum >= FIXED_DT) {
      step(FIXED_DT);
      accum -= FIXED_DT;
    }
    render();
    lastBgRenderEndAt = typeof performance !== 'undefined' ? performance.now() : now;
  }

  function start() {
    if (running) return;
    running = true;
    lastNow = 0;
    accum = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  let lastStepCallEndAt = -Infinity;
  let deferBgRenderUntil = -Infinity;
  let stepTurnActive = false;

  function deferNextBgRender(ms = 48) {
    const t = typeof performance !== 'undefined' ? performance.now() : 0;
    deferBgRenderUntil = Math.max(deferBgRenderUntil, t + ms);
  }

  function stepFrames(n, dt = FIXED_DT) {
    const count = Math.max(0, Math.floor(n));
    for (let i = 0; i < count; i += 1) {
      step(dt);
    }
    accum = 0;
    const nowAfterStep = typeof performance !== 'undefined' ? performance.now() : 0;
    lastNow = nowAfterStep;
    lastStepCallEndAt = nowAfterStep;

    // Coalesce all synchronous stepFrames() calls in a JS turn into a single end-of-turn microtask render,
    // keeping PLAY transition latency < 25ms and multi-run determinism 100% pure while rendering before CDP returns.
    if (!stepTurnActive) {
      stepTurnActive = true;
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {
          stepTurnActive = false;
          render();
        });
      } else {
        stepTurnActive = false;
        render();
      }
    }
  }

  return { start, stop, stepFrames, deferNextBgRender };
}
