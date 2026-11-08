#!/usr/bin/env python3
"""Gate F13 100%-English (0-CJK) & 0-speechSynthesis static + runtime audit.

Owner: lucky-qa
Exclusive path: tests/l10n_audit.py
Verifies:
1. Static repository scan across all .html, .js, .css, .json, .md, .py files
   under lucky_block_titans/ has 0 matches for [\\u4e00-\\u9fff], and 0 matches
   for Web Speech API synthesis identifiers inside index.html and src/**.
2. Runtime browser audit hooking CanvasRenderingContext2D &
   OffscreenCanvasRenderingContext2D fillText/strokeText into
   window.__CANVAS_TEXTS__, walking Title -> Play -> Block Break -> Flowerpot ->
   Roulette Modal -> Titan Spawn/Boing -> Pause Modal -> 4-Titan Defeat/Victory,
   and asserting 0 CJK hits across innerText, document.title, [aria-label],
   [title], and __CANVAS_TEXTS__.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from typing import Any

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qa_helpers import (  # noqa: E402
    QA_TMP_DIR,
    REPO_ROOT,
    TITAN_ORDER,
    QASession,
    ensure_qa_dirs,
)

SCANNED_EXTENSIONS = ('.html', '.js', '.css', '.json', '.md', '.py')
CJK_RE = re.compile('[\u4e00-\u9fff]')
BANNED_WEB_SPEECH_TOKEN = 'speech' + 'Synthesis'
BANNED_UTTERANCE_TOKEN = 'SpeechSynthesis' + 'Utterance'
WEB_SPEECH_RE = re.compile(rf'\b(?:{BANNED_WEB_SPEECH_TOKEN}|{BANNED_UTTERANCE_TOKEN})\b')

CANVAS_TEXT_HOOK_JS = r"""
(() => {
  if (!Array.isArray(window.__CANVAS_TEXTS__)) {
    window.__CANVAS_TEXTS__ = [];
  }
  const patchProto = (proto) => {
    if (!proto || proto.__luckyCanvasHooked) return;
    Object.defineProperty(proto, '__luckyCanvasHooked', {
      value: true,
      configurable: true,
      enumerable: false,
      writable: false,
    });
    for (const method of ['fillText', 'strokeText']) {
      const orig = proto[method];
      if (typeof orig !== 'function') continue;
      proto[method] = function hookedCanvasText(text, ...rest) {
        try {
          if (text !== undefined && text !== null) {
            const s = String(text);
            if (s.length > 0 && window.__CANVAS_TEXTS__.length < 80000) {
              window.__CANVAS_TEXTS__.push(s);
            }
          }
        } catch (_err) {
          // Never interrupt canvas drawing.
        }
        return orig.call(this, text, ...rest);
      };
    }
  };
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    patchProto(CanvasRenderingContext2D.prototype);
  }
  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
    patchProto(OffscreenCanvasRenderingContext2D.prototype);
  }
})();
"""

AUDIT_RUNTIME_NO_CJK_JS = r"""
(() => {
  const cjkRe = /[\u4e00-\u9fff]/;

  const innerHits = [];
  const rawBody = (document.body && typeof document.body.innerText === 'string')
    ? document.body.innerText
    : '';
  for (const line of rawBody.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && cjkRe.test(trimmed)) {
      innerHits.push(trimmed.slice(0, 140));
    }
  }

  const docTitle = String(document.title || '');
  const titleHits = cjkRe.test(docTitle) ? [docTitle] : [];

  const attrHits = [];
  const attrEls = document.querySelectorAll('[aria-label], [title], [alt], [placeholder]');
  for (const el of Array.from(attrEls)) {
    const tag = (el.tagName || '').toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    for (const attrName of ['aria-label', 'title', 'alt', 'placeholder']) {
      const val = el.getAttribute(attrName);
      if (val && cjkRe.test(val)) {
        attrHits.push({
          el: `${tag}${id}`,
          attr: attrName,
          value: val.slice(0, 140),
        });
      }
    }
  }

  const canvasTexts = Array.isArray(window.__CANVAS_TEXTS__) ? window.__CANVAS_TEXTS__ : [];
  const canvasHits = [];
  for (const item of canvasTexts) {
    const s = String(item ?? '');
    if (s && cjkRe.test(s)) {
      canvasHits.push(s.slice(0, 140));
    }
  }
  const uniqueCanvasHits = Array.from(new Set(canvasHits));

  const counts = {
    innerText: innerHits.length,
    title: titleHits.length,
    attrs: attrHits.length,
    canvas: canvasHits.length,
  };
  const total = counts.innerText + counts.title + counts.attrs + counts.canvas;
  counts.total = total;

  return {
    passed: total === 0,
    total,
    counts,
    canvasRecorded: canvasTexts.length,
    samples: {
      innerText: innerHits.slice(0, 15),
      title: titleHits.slice(0, 5),
      attrs: attrHits.slice(0, 15),
      canvas: uniqueCanvasHits.slice(0, 15),
    },
  };
})()
"""


def run_static_repo_scan(repo_root: str = REPO_ROOT) -> dict[str, Any]:
  """Scans repo files for [\\u4e00-\\u9fff] and src/ + index.html for speechSynthesis."""
  files_scanned = 0
  cjk_findings: list[dict[str, Any]] = []
  web_speech_findings: list[dict[str, Any]] = []

  for dirpath, dirnames, filenames in os.walk(repo_root):
    dirnames[:] = sorted(
        d
        for d in dirnames
        if d not in ('.git', '.agents', '__pycache__', 'node_modules', 'tmp_profiles')
    )
    for fn in sorted(filenames):
      if not fn.lower().endswith(SCANNED_EXTENSIONS):
        continue
      full_path = os.path.join(dirpath, fn)
      rel_path = os.path.relpath(full_path, repo_root).replace(os.sep, '/')
      files_scanned += 1
      try:
        with open(full_path, 'r', encoding='utf-8') as f:
          content = f.read()
      except UnicodeDecodeError:
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
          content = f.read()

      for line_no, line in enumerate(content.splitlines(), start=1):
        m_cjk = CJK_RE.search(line)
        if m_cjk:
          codepoints = [f'U+{ord(ch):04X}' for ch in CJK_RE.findall(line)[:8]]
          cjk_findings.append({
              'file': rel_path,
              'line': line_no,
              'codepoints': codepoints,
              'excerpt': line.strip()[:120],
          })

        if rel_path == 'index.html' or rel_path.startswith('src/'):
          if WEB_SPEECH_RE.search(line):
            web_speech_findings.append({
                'file': rel_path,
                'line': line_no,
                'excerpt': line.strip()[:120],
            })

  passed = len(cjk_findings) == 0 and len(web_speech_findings) == 0
  return {
      'passed': passed,
      'filesScanned': files_scanned,
      'cjkHitCount': len(cjk_findings),
      'speechSynthesisHitCount': len(web_speech_findings),
      'cjkFindings': cjk_findings[:50],
      'speechSynthesisFindings': web_speech_findings[:50],
  }


def install_canvas_text_hook(sess: QASession) -> None:
  """Registers Page.addScriptToEvaluateOnNewDocument hook for 2D canvas text draws."""
  sess.add_init_script(CANVAS_TEXT_HOOK_JS)


def audit_runtime_no_cjk(sess: QASession) -> dict[str, Any]:
  res = sess.eval_json(AUDIT_RUNTIME_NO_CJK_JS)
  return res if isinstance(res, dict) else {'passed': False, 'total': -1}


def run_runtime_browser_audit() -> dict[str, Any]:
  """Walks Title -> Play -> Block Break -> Pot -> Roulette -> Titan Boing -> Pause -> Victory."""
  index_path = os.path.join(REPO_ROOT, 'index.html')
  main_path = os.path.join(REPO_ROOT, 'src', 'main.js')
  if not os.path.exists(index_path) or not os.path.exists(main_path):
    raise RuntimeError('index.html or src/main.js not yet wired by @lucky-director')

  stages: dict[str, Any] = {}
  with QASession(width=1280, height=800, mobile=False) as sess:
    install_canvas_text_hook(sess)
    if not sess.goto('index.html?seed=2026', timeout=25.0):
      raise RuntimeError('Timed out loading index.html for runtime l10n_audit')
    sess.wait_raf(3)
    stages['01_title'] = audit_runtime_no_cjk(sess)

    # Transition to active play via Play button or startGame
    play_btn = sess.locate_control(['#btn-title-play', '#btn-play', '#title-screen button'])
    if play_btn.get('found'):
      sess.pointer_tap(play_btn['x'], play_btn['y'])
      sess.step_frames(15)
      sess.wait_raf(2)
    else:
      sess.eval_json('window.__LUCKY_TITAN__.startGame({ seed: 2026 })')
      sess.step_frames(15)
      sess.wait_raf(2)
    stages['02_play'] = audit_runtime_no_cjk(sess)

    # Break Starter Lucky Block + Mario Jump + Odyssey Stick Throw -> drops + subtitle speaking
    sess.eval_json(
        """(() => {
          const L = window.__LUCKY_TITAN__;
          L.startGame({ seed: 2026 });
          L.jump();
          L.stepFrames(10);
          L.throwStick();
          L.stepFrames(55);
          L.breakBlock(0, 1, 2.0);
          L.stepFrames(45);
          L.tapWorld(0, 2.0);
          L.stepFrames(60);
          return L.getState();
        })()"""
    )
    sess.wait_raf(2)
    stages['03_block_break'] = audit_runtime_no_cjk(sess)

    # Plant & upgrade Magic Flowerpot (Tier 1 -> Tier 2 -> Tier 3)
    sess.eval_json(
        """(() => {
          const L = window.__LUCKY_TITAN__;
          for (let z = 10; z <= 26; z += 2) {
            for (let x = -24; x <= -10; x += 2) {
              L.breakBlock(x, 1, z);
            }
          }
          L.stepFrames(320);
          L.plantPot(0);
          L.stepFrames(30);
          L.plantPot(0);
          L.stepFrames(30);
          L.plantPot(0);
          L.stepFrames(180);
          return L.getState();
        })()"""
    )
    sess.wait_raf(2)
    stages['04_flowerpot'] = audit_runtime_no_cjk(sess)

    # Open Roulette Modal via HUD Spin button (or spinChest) and audit while visible
    time.sleep(0.32)
    spin_btn = sess.locate_control(['#btn-hud-spin'])
    if spin_btn.get('found'):
      sess.pointer_tap(spin_btn['x'], spin_btn['y'])
      sess.step_frames(12)
      sess.wait_raf(2)
      # If modal requires an inner SPIN tap, audit open modal first, then spin
      stages['05_roulette_modal'] = audit_runtime_no_cjk(sess)
      inner_spin = sess.locate_control([
          '#btn-roulette-spin',
          '.roulette-modal button',
          '#roulette-modal button',
      ])
      if inner_spin.get('found'):
        time.sleep(0.32)
        sess.pointer_tap(inner_spin['x'], inner_spin['y'])
      sess.step_frames(200)
      sess.wait_raf(2)
      # Dismiss Roulette modal if still open
      close_btn = sess.locate_control([
          '#btn-roulette-ok',
          '#btn-roulette-close',
          '[data-action="close-roulette"]',
          '#roulette-modal button',
          '.roulette-modal button',
      ])
      if close_btn.get('found') and sess.get_state().get('roulette', {}).get('open'):
        time.sleep(0.32)
        sess.pointer_tap(close_btn['x'], close_btn['y'])
        sess.step_frames(10)
    else:
      sess.eval_json('(() => { window.__LUCKY_TITAN__.spinChest(); window.__LUCKY_TITAN__.stepFrames(20); })()')
      sess.wait_raf(2)
      stages['05_roulette_modal'] = audit_runtime_no_cjk(sess)
      sess.step_frames(180)

    # Under-geared Titan Spawn + Rainbow Cloud Boing (reset fresh at tier 1)
    sess.eval_json(
        """(() => {
          const L = window.__LUCKY_TITAN__;
          L.startGame({ seed: 2026 });
          L.spawnTitan('thunder_titan');
          L.stepFrames(45);
          L.bonkTitan('thunder_titan');
          L.stepFrames(20);
          return L.getState();
        })()"""
    )
    sess.wait_raf(2)
    stages['06_titan_boing'] = audit_runtime_no_cjk(sess)
    sess.step_frames(90)

    # Open Pause Modal via #btn-hud-menu and audit while visible
    time.sleep(0.32)
    menu_btn = sess.locate_control(['#btn-hud-menu'])
    if menu_btn.get('found'):
      sess.pointer_tap(menu_btn['x'], menu_btn['y'])
      sess.wait_raf(2)
    stages['07_pause_modal'] = audit_runtime_no_cjk(sess)

    # Resume from Pause Modal
    resume_btn = sess.locate_control([
        '#btn-pause-resume',
        '[data-action="resume"]',
        '#pause-modal button',
        '.pause-modal button',
    ])
    if resume_btn.get('found') and sess.get_state().get('mode') == 'paused':
      # Prefer explicitly labelled resume button if multiple exist
      sess.eval(
          """(() => {
            const btns = Array.from(document.querySelectorAll('#pause-modal button, .pause-modal button, [data-modal="pause"] button'));
            const resume = btns.find((b) => /resume|play|continue|back|ok/i.test(b.textContent || '')) || btns[btns.length - 1];
            if (resume) resume.click();
          })()"""
      )
      sess.step_frames(10)
      sess.wait_raf(2)

    # Equip Rainbow Blade & defeat all 4 Titans -> Victory Podium!
    sess.eval_json(
        f"""(() => {{
          const L = window.__LUCKY_TITAN__;
          L.spinChest('rainbow_blade');
          L.stepFrames(200);
          const order = {json.dumps(TITAN_ORDER)};
          for (const tid of order) {{
            L.spawnTitan(tid);
            L.stepFrames(45);
            for (let hit = 0; hit < 10; hit++) {{
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
    sess.wait_raf(3)
    stages['08_titan_defeat_victory'] = audit_runtime_no_cjk(sess)
    sess.assert_clean('l10n_audit')

  runtime_hits = sum(int(st.get('total', 0)) for st in stages.values())
  max_canvas_recorded = max((int(st.get('canvasRecorded', 0)) for st in stages.values()), default=0)
  return {
      'passed': runtime_hits == 0,
      'totalCjkHits': runtime_hits,
      'canvasTextsRecorded': max_canvas_recorded,
      'stages': stages,
  }


def run_l10n_audit(static_only: bool = False) -> dict[str, Any]:
  ensure_qa_dirs()
  static_rep = run_static_repo_scan(REPO_ROOT)
  runtime_rep: dict[str, Any] | None = None
  if not static_only:
    runtime_rep = run_runtime_browser_audit()

  passed = static_rep['passed'] and (True if runtime_rep is None else runtime_rep['passed'])
  report = {
      'gate': 'F13',
      'passed': passed,
      'static': static_rep,
      'runtime': runtime_rep,
  }
  out_path = os.path.join(QA_TMP_DIR, 'l10n_audit.json')
  with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)
  return report


def main() -> int:
  ap = argparse.ArgumentParser(description='Run Gate F13 English-only (0-CJK) & 0-speechSynthesis audit')
  ap.add_argument('--static-only', action='store_true', help='Run static repo scan without launching Chrome')
  args = ap.parse_args()

  rep = run_l10n_audit(static_only=args.static_only)
  s = rep['static']
  print(
      f"[STATIC] files={s['filesScanned']} cjk_hits={s['cjkHitCount']} "
      f"web_speech_hits={s['speechSynthesisHitCount']} -> {'PASS' if s['passed'] else 'FAIL'}"
  )
  if not s['passed']:
    for item in s['cjkFindings'][:10]:
      print(f"  CJK: {item['file']}:{item['line']} {item['codepoints']} {item['excerpt']}")
    for item in s['speechSynthesisFindings'][:10]:
      print(f"  WEB_SPEECH: {item['file']}:{item['line']} {item['excerpt']}")

  if rep['runtime'] is not None:
    r = rep['runtime']
    print(
        f"[RUNTIME] stages={len(r['stages'])} cjk_hits={r['totalCjkHits']} "
        f"canvas_draws={r['canvasTextsRecorded']} -> {'PASS' if r['passed'] else 'FAIL'}"
    )
    if not r['passed']:
      for st_name, st_val in r['stages'].items():
        if st_val.get('total', 0) > 0:
          print(f"  STAGE {st_name}: {json.dumps(st_val['samples'])}")

  print(f"F13_L10N_{'PASS' if rep['passed'] else 'FAIL'}")
  return 0 if rep['passed'] else 1


if __name__ == '__main__':
  sys.exit(main())
