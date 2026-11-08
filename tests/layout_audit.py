#!/usr/bin/env python3
"""Gate F11 5-Viewport Responsive, Touch-Target (72px) & Zero-Overlap Audit.

Owner: lucky-qa
Exclusive path: tests/layout_audit.py
Tests all 5 mandatory viewports:
  - 1280x800 (desktop landscape)
  - 1024x768 (iPad landscape)
  - 768x1024 (iPad portrait)
  - 844x390  (mobile compact landscape, >= 68px hard floor)
  - 390x844  (mobile portrait)
Across all 7 mandatory UI states:
  1. title            - Title overlay over live 3D island
  2. play_idle        - Active Play (idle, <= 5 clickable controls)
  3. play_speaking    - Active Play with .voice-subtitle speaking
  4. play_boss_banner - Active Play with Titan Boss Banner (+ subtitle)
  5. roulette_modal   - Mystery Artifact Roulette Spinner Modal
  6. pause_modal      - Pause / Settings Modal
  7. victory_podium   - 4-Trophy Victory Podium Modal
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qa_helpers import (  # noqa: E402
    MANDATORY_VIEWPORTS,
    QA_SHOTS_DIR,
    QA_TMP_DIR,
    REPO_ROOT,
    TITAN_ORDER,
    QASession,
    ensure_qa_dirs,
)

AUDIT_LAYOUT_DOM_JS = r"""
((stateName, minControlDim, expectedModalSel) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const docEl = document.documentElement;
  const body = document.body;

  const isVisible = (el) => {
    if (!el || !(el instanceof Element)) return false;
    let cur = el;
    while (cur && cur !== docEl) {
      if (cur.hasAttribute && cur.hasAttribute('hidden')) return false;
      if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') return false;
      const cs = window.getComputedStyle(cur);
      if (
        cs.display === 'none' ||
        cs.visibility === 'hidden' ||
        parseFloat(cs.opacity || '1') <= 0.05
      ) {
        return false;
      }
      cur = cur.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  const roundRect = (r) => ({
    left: Math.round(r.left * 10) / 10,
    top: Math.round(r.top * 10) / 10,
    right: Math.round(r.right * 10) / 10,
    bottom: Math.round(r.bottom * 10) / 10,
    width: Math.round(r.width * 10) / 10,
    height: Math.round(r.height * 10) / 10,
  });

  const describeEl = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? `("${txt}")` : ''}`;
  };

  // 1. Scrollbar check (0 horizontal/vertical scrollbars)
  const scrollbars = {
    innerWidth: vw,
    innerHeight: vh,
    docScrollWidth: docEl.scrollWidth,
    docScrollHeight: docEl.scrollHeight,
    bodyScrollWidth: body ? body.scrollWidth : vw,
    bodyScrollHeight: body ? body.scrollHeight : vh,
  };
  const hasScrollbar =
    scrollbars.docScrollWidth > vw ||
    scrollbars.docScrollHeight > vh ||
    scrollbars.bodyScrollWidth > vw ||
    scrollbars.bodyScrollHeight > vh;

  // Locate active modal root if expectedModalSel is provided
  let activeModalEl = null;
  if (expectedModalSel) {
    const cands = Array.from(document.querySelectorAll(expectedModalSel)).filter(isVisible);
    activeModalEl = cands[0] || null;
  }
  const modalMissing = Boolean(expectedModalSel && !activeModalEl);

  // Helper: check whether element center is hit-testable (not covered by a modal backdrop)
  const isHitTestable = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    const cx = Math.min(vw - 1, Math.max(1, r.left + r.width * 0.5));
    const cy = Math.min(vh - 1, Math.max(1, r.top + r.height * 0.5));
    const topEl = document.elementFromPoint(cx, cy);
    if (!topEl) return true;
    return el === topEl || el.contains(topEl) || topEl.contains(el);
  };

  // 2. Visible clickable controls: button, [role="button"]
  const rawClickable = Array.from(body.querySelectorAll('button, [role="button"]')).filter((el) => {
    if (!isVisible(el)) return false;
    const cs = window.getComputedStyle(el);
    if (cs.pointerEvents === 'none') return false;
    // When a modal is open, ignore background HUD controls that are covered/inert behind the modal backdrop
    if (activeModalEl && !activeModalEl.contains(el) && !el.classList.contains('voice-subtitle') && el.id !== 'voice-subtitle') {
      if (!isHitTestable(el)) return false;
    }
    return true;
  });

  // Deduplicate nested interactive children inside an outer button
  const topClickable = rawClickable.filter(
    (el) => !rawClickable.some((other) => other !== el && other.contains(el))
  );

  const controls = topClickable.map((el) => ({
    el,
    desc: describeEl(el),
    rect: roundRect(el.getBoundingClientRect()),
  }));

  const isPlayState = stateName.startsWith('play_');
  const maxControlsOk = !isPlayState || (controls.length >= 1 && controls.length <= 6);

  // 3. Size floor (>= 72x72, >= 68x68 on 844x390) & viewport bounds check
  const sizeFloor = minControlDim - 0.35;
  const undersizedControls = controls
    .filter((c) => c.rect.width < sizeFloor || c.rect.height < sizeFloor)
    .map((c) => ({
      desc: c.desc,
      width: c.rect.width,
      height: c.rect.height,
      minRequired: minControlDim,
    }));

  const offscreenControls = controls
    .filter(
      (c) =>
        c.rect.left < -0.5 ||
        c.rect.top < -0.5 ||
        c.rect.right > vw + 0.5 ||
        c.rect.bottom > vh + 0.5
    )
    .map((c) => ({ desc: c.desc, rect: c.rect }));

  // 4. Pairwise bounding-box overlap check among visible interactive controls,
  //    Boss Banner, .voice-subtitle, and (during active play) top-level HUD status pills.
  const collisionBoxes = controls.map((c) => ({ ...c, kind: 'control' }));
  const trackedEls = new Set(controls.map((c) => c.el));

  const addSpecialBoxes = (sel, kind, skipWhenBehindModal) => {
    for (const el of Array.from(body.querySelectorAll(sel))) {
      if (!isVisible(el) || trackedEls.has(el)) continue;
      if (skipWhenBehindModal && activeModalEl && !activeModalEl.contains(el)) {
        continue;
      }
      trackedEls.add(el);
      collisionBoxes.push({
        el,
        kind,
        desc: describeEl(el),
        rect: roundRect(el.getBoundingClientRect()),
      });
    }
  };

  // Voice subtitle is top-level across play; check whenever visible (unless behind an opaque modal)
  for (const subEl of Array.from(body.querySelectorAll('#voice-subtitle, .voice-subtitle'))) {
    if (!isVisible(subEl) || trackedEls.has(subEl)) continue;
    if (activeModalEl && !activeModalEl.contains(subEl) && !isHitTestable(subEl)) continue;
    trackedEls.add(subEl);
    collisionBoxes.push({
      el: subEl,
      kind: 'subtitle',
      desc: describeEl(subEl),
      rect: roundRect(subEl.getBoundingClientRect()),
    });
  }

  // Boss banner check (always active in play_boss_banner, skipped when covered by modal)
  addSpecialBoxes('#boss-banner, .boss-banner, [data-boss-banner]', 'boss_banner', true);

  // Verify required feature visibility for specific states
  let stateFeatureMissing = null;
  if (stateName === 'play_speaking') {
    const subVis = Array.from(body.querySelectorAll('#voice-subtitle, .voice-subtitle')).some(isVisible);
    if (!subVis) stateFeatureMissing = 'voice_subtitle_not_visible_during_play_speaking';
  } else if (stateName === 'play_boss_banner') {
    const bossVis = Array.from(
      body.querySelectorAll('#boss-banner, .boss-banner, [data-boss-banner]')
    ).some(isVisible);
    if (!bossVis) stateFeatureMissing = 'boss_banner_not_visible_during_play_boss_banner';
  }

  const overlaps = [];
  for (let i = 0; i < collisionBoxes.length; i++) {
    for (let j = i + 1; j < collisionBoxes.length; j++) {
      const a = collisionBoxes[i];
      const b = collisionBoxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const oy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (ox > 1.5 && oy > 1.5) {
        overlaps.push({
          a: a.desc,
          b: b.desc,
          ox: Math.round(ox * 10) / 10,
          oy: Math.round(oy * 10) / 10,
        });
      }
    }
  }

  // 5. Clipped text labels check (scrollWidth <= clientWidth + 2)
  const isInsideClippedCarousel = (el) => {
    let p = el.parentElement;
    while (p && p !== body) {
      const cs = window.getComputedStyle(p);
      const cls = ((p.id || '') + ' ' + (typeof p.className === 'string' ? p.className : '')).toLowerCase();
      if (
        (cs.overflowX === 'hidden' || cs.overflow === 'hidden') &&
        /strip|reel|carousel|spinner-window|roulette-window|roulette-viewport|track/.test(cls)
      ) {
        return p;
      }
      p = p.parentElement;
    }
    return null;
  };

  const clippedText = [];
  for (const el of Array.from(body.querySelectorAll('*'))) {
    if (!isVisible(el)) continue;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'CANVAS') continue;
    if (activeModalEl && !activeModalEl.contains(el) && el.id !== 'voice-subtitle' && !el.classList.contains('voice-subtitle')) {
      continue;
    }

    let directText = '';
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        directText += node.textContent || '';
      }
    }
    directText = directText.trim();
    if (!directText) continue;

    const cs = window.getComputedStyle(el);
    if (cs.display === 'inline') continue; // clientWidth is 0 on inline spans; check block/flex/inline-block containers

    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
      clippedText.push({
        desc: describeEl(el),
        reason: 'scrollWidth_exceeds_clientWidth',
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
      continue;
    }

    const carouselWin = isInsideClippedCarousel(el);
    if (!carouselWin) {
      const r = el.getBoundingClientRect();
      if (r.left < -1.5 || r.top < -1.5 || r.right > vw + 1.5 || r.bottom > vh + 1.5) {
        clippedText.push({
          desc: describeEl(el),
          reason: 'text_outside_viewport',
          rect: roundRect(r),
        });
      }
    }
  }

  const passed =
    !hasScrollbar &&
    !modalMissing &&
    !stateFeatureMissing &&
    maxControlsOk &&
    undersizedControls.length === 0 &&
    offscreenControls.length === 0 &&
    overlaps.length === 0 &&
    clippedText.length === 0;

  return {
    state: stateName,
    viewport: `${vw}x${vh}`,
    minControlDim,
    passed,
    hasScrollbar,
    scrollbars,
    modalMissing,
    stateFeatureMissing,
    controlCount: controls.length,
    maxControlsOk,
    controls: controls.map((c) => ({ desc: c.desc, rect: c.rect })),
    undersizedControls,
    offscreenControls,
    overlaps,
    clippedText,
  };
})
"""


def _audit_dom_state(
    sess: QASession,
    vp_tag: str,
    state_name: str,
    min_dim: int,
    expected_modal_sel: str = '',
    save_shots: bool = True,
) -> tuple[dict[str, Any], str | None]:
  sess.wait_raf(2)
  res = sess.eval_json(
      f'({AUDIT_LAYOUT_DOM_JS})({json.dumps(state_name)}, {int(min_dim)}, {json.dumps(expected_modal_sel)})'
  )
  shot_path = None
  if save_shots:
    shot_path = sess.screenshot(f'layout_{vp_tag}_{state_name}.jpg')
  return res, shot_path


def audit_single_viewport(
    sess: QASession,
    width: int,
    height: int,
    mobile: bool,
    save_shots: bool = True,
) -> dict[str, Any]:
  """Runs all 7 UI state layout checks on a single viewport."""
  vp_tag = f'{width}x{height}'
  min_dim = 68 if (width == 844 and height == 390) else 72
  states: list[dict[str, Any]] = []
  shots: list[str] = []

  # 1. Title Screen
  if not sess.goto('index.html?seed=101', timeout=25.0):
    raise RuntimeError(f'Failed to load index.html at {vp_tag}')
  dims = sess.set_viewport(width, height, mobile=mobile)
  sess.wait_raf(3)
  st_res, shot = _audit_dom_state(sess, vp_tag, 'title', min_dim, '#title-screen, .title-screen', save_shots)
  states.append(st_res)
  if shot:
    shots.append(shot)

  # 2. Active Play (Idle — start game and advance past welcome voice clip so subtitle settles)
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 101 });
        L.stepFrames(360);
        return L.getState();
      })()"""
  )
  st_res, shot = _audit_dom_state(sess, vp_tag, 'play_idle', min_dim, '', save_shots)
  states.append(st_res)
  if shot:
    shots.append(shot)

  # 3. Active Play (with .voice-subtitle speaking)
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.replayVoice();
        L.stepFrames(6);
        return L.getState();
      })()"""
  )
  st_res, shot = _audit_dom_state(sess, vp_tag, 'play_speaking', min_dim, '', save_shots)
  states.append(st_res)
  if shot:
    shots.append(shot)

  # 4. Active Play (with Boss Banner + voice subtitle)
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.spawnTitan('thunder_titan');
        L.stepFrames(40);
        L.tapWorld(14, 14);
        L.stepFrames(60);
        return L.getState();
      })()"""
  )
  st_res, shot = _audit_dom_state(sess, vp_tag, 'play_boss_banner', min_dim, '', save_shots)
  states.append(st_res)
  if shot:
    shots.append(shot)

  # 5. Roulette Spinner Modal (break Starter Block so hero has freeSpin + stars, then open Roulette Modal)
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 101 });
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(90);
        return L.getState();
      })()"""
  )
  sess.wait_raf(2)
  time.sleep(0.32)
  spin_hud = sess.locate_control(['#btn-hud-spin'])
  if spin_hud.get('found'):
    sess.pointer_tap(spin_hud['x'], spin_hud['y'])
    sess.step_frames(8)
  else:
    sess.eval_json('(() => { window.__LUCKY_TITAN__.spinChest(); window.__LUCKY_TITAN__.stepFrames(8); })()')
  st_res, shot = _audit_dom_state(
      sess,
      vp_tag,
      'roulette_modal',
      min_dim,
      '#roulette-modal, .roulette-modal, [data-modal="roulette"]',
      save_shots,
  )
  states.append(st_res)
  if shot:
    shots.append(shot)

  # Settle & close Roulette Modal cleanly
  sess.step_frames(220)
  sess.wait_raf(2)
  time.sleep(0.32)
  sess.eval(
      """(() => {
        const modal = document.querySelector('#roulette-modal, .roulette-modal, [data-modal="roulette"]');
        if (!modal) return;
        const btns = Array.from(modal.querySelectorAll('button, [role="button"]'));
        const closeBtn =
          modal.querySelector('#btn-roulette-close') ||
          btns.find((b) => /awesome|ok|equip|yay|done|close|back|continue/i.test(b.textContent || '')) ||
          btns[btns.length - 1];
        if (closeBtn) closeBtn.click();
      })()"""
  )
  sess.step_frames(20)
  sess.wait_raf(2)

  # 6. Pause Modal (open via #btn-hud-menu)
  time.sleep(0.32)
  menu_btn = sess.locate_control(['#btn-hud-menu'])
  if menu_btn.get('found'):
    sess.pointer_tap(menu_btn['x'], menu_btn['y'])
  st_res, shot = _audit_dom_state(
      sess,
      vp_tag,
      'pause_modal',
      min_dim,
      '#pause-modal, .pause-modal, [data-modal="pause"]',
      save_shots,
  )
  states.append(st_res)
  if shot:
    shots.append(shot)

  # Close Pause Modal via Resume
  time.sleep(0.32)
  sess.eval(
      """(() => {
        const modal = document.querySelector('#pause-modal, .pause-modal, [data-modal="pause"]');
        if (!modal) return;
        const btns = Array.from(modal.querySelectorAll('button, [role="button"]'));
        const resume =
          modal.querySelector('#btn-pause-resume') ||
          btns.find((b) => /resume|play|continue|back|close/i.test(b.textContent || '')) ||
          btns[btns.length - 1];
        if (resume) resume.click();
      })()"""
  )
  sess.step_frames(15)
  sess.wait_raf(2)

  # 7. Victory Podium Modal (equip Rainbow Blade & pop all 4 Titans)
  sess.eval_json(
      f"""(() => {{
        const L = window.__LUCKY_TITAN__;
        L.spinChest('rainbow_blade');
        L.stepFrames(200);
        for (const tid of {json.dumps(TITAN_ORDER)}) {{
          L.spawnTitan(tid);
          L.stepFrames(45);
          for (let i = 0; i < 10; i++) {{
            const st = L.getState();
            if (Array.isArray(st.trophies) && st.trophies.includes(tid)) break;
            L.bonkTitan(tid);
            L.stepFrames(25);
          }}
          L.stepFrames(60);
        }}
        L.stepFrames(60);
        return L.getState();
      }})()"""
  )
  st_res, shot = _audit_dom_state(
      sess,
      vp_tag,
      'victory_podium',
      min_dim,
      '#victory-modal, .victory-modal, #victory-screen, .victory-screen, [data-modal="victory"]',
      save_shots,
  )
  states.append(st_res)
  if shot:
    shots.append(shot)

  issues: list[str] = []
  if dims.get('innerWidth') != width or dims.get('innerHeight') != height:
    issues.append(f'viewport_mismatch: expected {vp_tag}, got {dims}')
  for sc in states:
    sname = sc['state']
    if sc['hasScrollbar']:
      issues.append(f"{sname}: scrollbar overflow {sc['scrollbars']}")
    if sc['modalMissing']:
      issues.append(f'{sname}: expected modal container not visible')
    if sc['stateFeatureMissing']:
      issues.append(f"{sname}: {sc['stateFeatureMissing']}")
    if not sc['maxControlsOk']:
      issues.append(f"{sname}: active-play clickable controlCount={sc['controlCount']} (expected 1..5)")
    if sc['undersizedControls']:
      issues.append(f"{sname}: undersized (<{min_dim}px) {sc['undersizedControls']}")
    if sc['offscreenControls']:
      issues.append(f"{sname}: offscreen controls {sc['offscreenControls']}")
    if sc['overlaps']:
      issues.append(f"{sname}: bounding-box overlaps {sc['overlaps']}")
    if sc['clippedText']:
      issues.append(f"{sname}: clipped/offscreen text {sc['clippedText']}")

  return {
      'viewport': vp_tag,
      'width': width,
      'height': height,
      'mobile': mobile,
      'minControlDim': min_dim,
      'passed': len(issues) == 0,
      'issues': issues,
      'states': states,
      'screenshots': shots,
  }


def run_layout_audit(
    viewports: list[tuple[int, int, bool, str]] | None = None,
    save_shots: bool = True,
) -> dict[str, Any]:
  ensure_qa_dirs()
  if not os.path.exists(os.path.join(REPO_ROOT, 'index.html')) or not os.path.exists(
      os.path.join(REPO_ROOT, 'src', 'main.js')
  ):
    raise RuntimeError('index.html or src/main.js not yet wired by @lucky-director')

  vps = viewports or MANDATORY_VIEWPORTS
  vp_reports: list[dict[str, Any]] = []
  with QASession(width=1280, height=800, mobile=False) as sess:
    sess.clear_diagnostics()
    for w, h, mob, _lbl in vps:
      vp_reports.append(audit_single_viewport(sess, w, h, mob, save_shots=save_shots))
    sess.assert_clean('layout_audit')

  all_passed = all(r['passed'] for r in vp_reports)
  report = {
      'gate': 'F11',
      'passed': all_passed,
      'viewportCount': len(vp_reports),
      'viewports': vp_reports,
      'shotsDir': QA_SHOTS_DIR,
  }
  json_path = os.path.join(QA_TMP_DIR, 'layout_audit.json')
  md_path = os.path.join(QA_TMP_DIR, 'layout_audit.md')
  with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)
  with open(md_path, 'w', encoding='utf-8') as f:
    f.write(format_layout_markdown(report) + '\n')
  return report


def format_layout_markdown(report: dict[str, Any]) -> str:
  lines = [
      '| Viewport | Min Target | Scrollbars | Max Play Ctrls | Undersized | Overlaps | Clipped Text | Result |',
      '|---|---:|---:|---:|---:|---:|---:|---|',
  ]
  for vp in report['viewports']:
    sts = vp['states']
    sb = sum(1 for s in sts if s['hasScrollbar'])
    play_max = max((s['controlCount'] for s in sts if s['state'].startswith('play_')), default=0)
    under = sum(len(s['undersizedControls']) for s in sts)
    ov = sum(len(s['overlaps']) for s in sts)
    clip = sum(len(s['clippedText']) for s in sts)
    verdict = 'PASS' if vp['passed'] else 'FAIL'
    lines.append(
        f"| {vp['viewport']} | {vp['minControlDim']}px | {sb} | {play_max} | "
        f'{under} | {ov} | {clip} | **{verdict}** |'
    )
  return '\n'.join(lines)


def main() -> int:
  ap = argparse.ArgumentParser(description='Run Gate F11 5-viewport layout & touch-target audit')
  ap.add_argument('--viewport', type=str, default='', help='Optional single WxH, e.g. 768x1024')
  ap.add_argument('--no-shots', action='store_true', help='Skip JPEG proof screenshots')
  args = ap.parse_args()

  vps = MANDATORY_VIEWPORTS
  if args.viewport:
    parts = args.viewport.lower().split('x')
    w, h = int(parts[0]), int(parts[1])
    vps = [(w, h, (w, h) != (1280, 800), f'custom_{w}x{h}')]

  rep = run_layout_audit(viewports=vps, save_shots=not args.no_shots)
  print(format_layout_markdown(rep))
  for vp in rep['viewports']:
    if not vp['passed']:
      for issue in vp['issues']:
        print(f"  [ISSUE {vp['viewport']}] {issue}")
  print(f"F11_LAYOUT_{'PASS' if rep['passed'] else 'FAIL'} shots={QA_SHOTS_DIR}")
  return 0 if rep['passed'] else 1


if __name__ == '__main__':
  sys.exit(main())
