#!/usr/bin/env python3
"""Shared QA helper utilities, CDP session wrapper, and canonical constants.

Owner: lucky-qa
Exclusive path: tests/qa_helpers.py
All temporary profiles, JSON/Markdown reports, and JPEG screenshots live
strictly under /tmp/bv1a5s/ (never in repo root or CitC).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from typing import Any

sys.dont_write_bytecode = True

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP_ROOT = os.environ.get('SAHUR_QA_ROOT', '/tmp/playtime_prank_rpg_3d/tmp_profiles')
PROFILES_DIR = os.environ.setdefault('LUCKY_TMP', os.path.join(TMP_ROOT, 'profiles'))
QA_TMP_DIR = os.path.join(TMP_ROOT, 'qa')
QA_SHOTS_DIR = os.path.join(TMP_ROOT, 'shots', 'qa')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Browser  # noqa: E402

STORAGE_KEY = 'sahur_island_progress'

# All 5 mandatory viewports from docs/DESIGN.md section 2.4 & 7 (F11):
# (width, height, mobile_touch, label)
MANDATORY_VIEWPORTS: list[tuple[int, int, bool, str]] = [
    (1280, 800, False, 'desktop_1280x800'),
    (1024, 768, True, 'ipad_landscape_1024x768'),
    (768, 1024, True, 'ipad_portrait_768x1024'),
    (844, 390, True, 'mobile_landscape_844x390'),
    (390, 844, True, 'mobile_portrait_390x844'),
]

HUB_LAYOUT: dict[str, Any] = {
    'spawn': {'x': 0.0, 'y': 1.0, 'z': 4.5},
    'starterBlock': {'x': 0.0, 'y': 1.0, 'z': 2.0},
    'boingLanding': {'x': 0.0, 'y': 1.0, 'z': 3.4},
    'rouletteChest': {'x': 0.0, 'y': 1.0, 'z': -1.6},
    'flowerpotPads': [
        {'padIdx': 0, 'x': -4.5, 'y': 1.0, 'z': 1.6},
        {'padIdx': 1, 'x': 4.5, 'y': 1.0, 'z': 1.6},
        {'padIdx': 2, 'x': -4.5, 'y': 1.0, 'z': -2.6},
        {'padIdx': 3, 'x': 4.5, 'y': 1.0, 'z': -2.6},
    ],
    'trophyPedestals': [
        {'idx': 0, 'titanId': 'tralalero_tralala', 'x': -4.8, 'y': 1.0, 'z': -7.5},
        {'idx': 1, 'titanId': 'bombardiro_crocodilo', 'x': -1.6, 'y': 1.0, 'z': -8.2},
        {'idx': 2, 'titanId': 'brr_brr_patapim', 'x': 1.6, 'y': 1.0, 'z': -8.2},
        {'idx': 3, 'titanId': 'golden_sahur_king', 'x': 4.8, 'y': 1.0, 'z': -7.5},
    ],
}

WEAPON_ORDER: list[str] = [
    'wooden_kentungan_bat',
    'bronze_temple_gong',
    'golden_sahur_mallet',
    'neon_thunder_taiko',
    'rainbow_mega_hammer',
]

WEAPON_TIERS: dict[str, int] = {
    'wooden_kentungan_bat': 1,
    'bronze_temple_gong': 2,
    'golden_sahur_mallet': 3,
    'neon_thunder_taiko': 4,
    'rainbow_mega_hammer': 5,
}

TITAN_ORDER: list[str] = [
    'tralalero_tralala',
    'bombardiro_crocodilo',
    'brr_brr_patapim',
    'golden_sahur_king',
]

TITAN_SPECS: dict[str, dict[str, Any]] = {
    'tralalero_tralala': {
        'id': 'tralalero_tralala',
        'biome': 'meadow',
        'requiredTier': 1,
        'maxHp': 40,
        'spawnPos': {'x': -18.0, 'y': 1.0, 'z': 18.0},
    },
    'bombardiro_crocodilo': {
        'id': 'bombardiro_crocodilo',
        'biome': 'snow',
        'requiredTier': 2,
        'maxHp': 80,
        'spawnPos': {'x': -18.0, 'y': 2.0, 'z': -18.0},
    },
    'brr_brr_patapim': {
        'id': 'brr_brr_patapim',
        'biome': 'farm',
        'requiredTier': 3,
        'maxHp': 140,
        'spawnPos': {'x': 18.0, 'y': 1.0, 'z': 18.0},
    },
    'golden_sahur_king': {
        'id': 'golden_sahur_king',
        'biome': 'castle',
        'requiredTier': 4,
        'maxHp': 220,
        'spawnPos': {'x': 20.0, 'y': 2.0, 'z': -20.0},
    },
}

SEAM_METHODS: list[str] = [
    'startGame',
    'tapWorld',
    'jump',
    'throwStick',
    'breakBlock',
    'plantPot',
    'spinChest',
    'spawnTitan',
    'bonkTitan',
    'replayVoice',
    'stepFrames',
    'getState',
]

HUD_BUTTON_IDS: list[str] = [
    'btn-hud-spin',
    'btn-hud-totem',
    'btn-hud-voice',
    'btn-hud-menu',
    'btn-hud-jump',
    'btn-hud-drum',
]


def ensure_qa_dirs() -> None:
  os.makedirs(PROFILES_DIR, exist_ok=True)
  os.makedirs(QA_TMP_DIR, exist_ok=True)
  os.makedirs(QA_SHOTS_DIR, exist_ok=True)


def owner_for_area(area: str) -> str:
  mapping = {
      'boot': '@lucky-director',
      'seam': '@lucky-director',
      'scene': '@lucky-director',
      'camera': '@lucky-director',
      'world': '@lucky-world',
      'chars': '@lucky-chars',
      'loot': '@lucky-loot',
      'flowerpots': '@lucky-loot',
      'roulette': '@lucky-loot / @lucky-ui',
      'combat': '@lucky-loot / @lucky-chars',
      'ui': '@lucky-ui',
      'layout': '@lucky-ui',
      'voice': '@lucky-vo-audio',
      'audio': '@lucky-vo-audio',
      'l10n': '@lucky-ui / @lucky-director',
  }
  return mapping.get(area, '@lucky-director')


def parse_voice_catalog_entries() -> list[dict[str, str]]:
  """Parses (id, speaker, text) entries from src/data/voice_catalog.js."""
  cat_path = os.path.join(REPO_ROOT, 'src', 'data', 'voice_catalog.js')
  if not os.path.exists(cat_path):
    return []
  with open(cat_path, 'r', encoding='utf-8') as f:
    src = f.read()
  entries: list[dict[str, str]] = []
  obj_pattern = re.compile(
      r"""id\s*:\s*(['"])([a-zA-Z0-9_]+)\1\s*,\s*speaker\s*:\s*(['"])([a-zA-Z0-9_]+)\3\s*,\s*text\s*:\s*(['"])((?:\\.|(?!\5).)*)\5"""
  )
  for m in obj_pattern.finditer(src):
    clip_id = m.group(2)
    speaker = m.group(4)
    raw_text = m.group(6).replace("\\'", "'").replace('\\"', '"')
    entries.append({'id': clip_id, 'speaker': speaker, 'text': raw_text})
  if entries:
    return entries
  pattern = re.compile(
      r"""\[\s*(['"])([a-zA-Z0-9_]+)\1\s*,\s*(['"])([a-zA-Z0-9_]+)\3\s*,\s*(['"])((?:\\.|(?!\5).)*)\5\s*\]"""
  )
  for m in pattern.finditer(src):
    clip_id = m.group(2)
    speaker = m.group(4)
    raw_text = m.group(6).replace("\\'", "'").replace('\\"', '"')
    entries.append({'id': clip_id, 'speaker': speaker, 'text': raw_text})
  return entries


def ffprobe_mp3(mp3_path: str) -> dict[str, Any]:
  """Validates a single MP3 file via ffprobe, returning duration, codec, and size."""
  if not os.path.exists(mp3_path):
    return {'ok': False, 'error': 'missing_file', 'path': mp3_path}
  size_bytes = os.path.getsize(mp3_path)
  if size_bytes <= 0:
    return {'ok': False, 'error': 'empty_file', 'bytes': size_bytes, 'path': mp3_path}
  cmd = [
      'ffprobe',
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate,channels:format=duration',
      '-of',
      'json',
      mp3_path,
  ]
  try:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10, check=False)
  except Exception as exc:
    return {'ok': False, 'error': f'ffprobe_exec_failed: {exc}', 'path': mp3_path}
  if proc.returncode != 0:
    return {
        'ok': False,
        'error': f'ffprobe_nonzero({proc.returncode}): {proc.stderr.strip()[:160]}',
        'bytes': size_bytes,
        'path': mp3_path,
    }
  try:
    info = json.loads(proc.stdout or '{}')
  except json.JSONDecodeError as exc:
    return {'ok': False, 'error': f'invalid_json: {exc}', 'path': mp3_path}
  streams = info.get('streams') or []
  fmt = info.get('format') or {}
  codec = (streams[0].get('codec_name') if streams else '') or ''
  try:
    duration = float(fmt.get('duration') or 0.0)
  except (TypeError, ValueError):
    duration = 0.0
  ok = codec == 'mp3' and duration >= 0.30 and size_bytes >= 1500
  return {
      'ok': ok,
      'codec': codec,
      'duration': round(duration, 3),
      'bytes': size_bytes,
      'sample_rate': int(streams[0].get('sample_rate') or 0) if streams else 0,
      'channels': int(streams[0].get('channels') or 0) if streams else 0,
      'path': mp3_path,
  }


def extract_pad_tiers(state: dict[str, Any]) -> list[int]:
  """Extracts the 4 Hub Flowerpot Pad tiers [0..3] from getState()."""
  pots = state.get('flowerpots')
  if isinstance(pots, dict):
    pots = pots.get('pads') or pots.get('list') or []
  if isinstance(pots, list):
    out: list[int] = []
    for item in pots:
      if isinstance(item, dict):
        out.append(int(item.get('tier') or 0))
      else:
        out.append(int(item or 0))
    return out
  return [0, 0, 0, 0]


def extract_trophies(state: dict[str, Any]) -> list[str]:
  """Extracts unlocked Titan trophy IDs from getState()."""
  tr = state.get('trophies')
  if isinstance(tr, list):
    out: list[str] = []
    for item in tr:
      if isinstance(item, str):
        out.append(item)
      elif isinstance(item, dict) and item.get('unlocked', True) and item.get('titanId'):
        out.append(str(item['titanId']))
    return out
  if isinstance(tr, dict):
    return [k for k, v in tr.items() if v]
  return []


def extract_player_gems(state: dict[str, Any]) -> int:
  p = state.get('player') or {}
  for k in ('starGems', 'gems', 'stars'):
    if k in p and p[k] is not None:
      return int(p[k])
  if 'starGems' in state and state['starGems'] is not None:
    return int(state['starGems'])
  return 0


def extract_pot_seeds(state: dict[str, Any]) -> int:
  p = state.get('player') or {}
  if 'potSeeds' in p and p['potSeeds'] is not None:
    return int(p['potSeeds'])
  return int(state.get('potSeeds') or 0)


def extract_free_spins(state: dict[str, Any]) -> int:
  p = state.get('player') or {}
  if 'freeSpins' in p and p['freeSpins'] is not None:
    return int(p['freeSpins'])
  r = state.get('roulette') or {}
  if 'freeSpins' in r and r['freeSpins'] is not None:
    return int(r['freeSpins'])
  return int(state.get('freeSpins') or 0)


LOCATE_CONTROL_RECT_JS = r"""
((selectors) => {
  const docEl = document.documentElement;
  const isVis = (el) => {
    if (!el || !(el instanceof Element)) return false;
    let cur = el;
    while (cur && cur !== docEl) {
      if (cur.hasAttribute && cur.hasAttribute('hidden')) return false;
      const cs = window.getComputedStyle(cur);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') <= 0.05) {
        return false;
      }
      cur = cur.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const selList = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of selList) {
    if (!sel) continue;
    const nodes = Array.from(document.querySelectorAll(sel)).filter(isVis);
    if (nodes.length > 0) {
      const el = nodes[0];
      const r = el.getBoundingClientRect();
      return {
        found: true,
        selector: sel,
        id: el.id || '',
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48),
        x: r.left + r.width * 0.5,
        y: r.top + r.height * 0.5,
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    }
  }
  return { found: false };
})
"""


class QASession:
  """Context-managed wrapper over tests/cdp.py Browser with Kid-UX & Three.js helpers."""

  def __init__(self, width: int = 1280, height: int = 800, mobile: bool = False):
    ensure_qa_dirs()
    self._browser = Browser(width=width, height=height, root=REPO_ROOT, mobile=mobile)
    self.b: Browser | None = None
    self._init_scripts: list[str] = []

  def __enter__(self) -> 'QASession':
    self.b = self._browser.__enter__()
    for script in self._init_scripts:
      self.b.add_init_script(script)
    return self

  def __exit__(self, *exc: Any) -> None:
    self._browser.__exit__(*exc)

  @property
  def width(self) -> int:
    return self.b.width if self.b else self._browser.width

  @property
  def height(self) -> int:
    return self.b.height if self.b else self._browser.height

  @property
  def mobile(self) -> bool:
    return self.b.mobile if self.b else self._browser.mobile

  def add_init_script(self, source: str) -> None:
    self._init_scripts.append(source)
    if self.b is not None:
      self.b.add_init_script(source)
      try:
        self.b.eval(source)
      except Exception:
        pass

  def goto(
      self,
      path: str = 'index.html',
      wait_expr: str = 'window.__LUCKY_TITAN__ !== undefined',
      timeout: float = 25.0,
  ) -> bool:
    assert self.b is not None
    return self.b.goto(path, wait_expr=wait_expr, timeout=timeout)

  def reload(
      self,
      wait_expr: str = 'window.__LUCKY_TITAN__ !== undefined',
      timeout: float = 25.0,
  ) -> bool:
    assert self.b is not None
    self.b.cmd('Page.reload', ignoreCache=True)
    t0 = time.time()
    while time.time() - t0 < timeout:
      try:
        if self.eval(f'!!({wait_expr})'):
          return True
      except RuntimeError:
        pass
      time.sleep(0.12)
    return False

  def eval(self, expr: str, await_promise: bool = True) -> Any:
    assert self.b is not None
    return self.b.eval(expr, await_promise=await_promise)

  def eval_json(self, expr: str) -> Any:
    assert self.b is not None
    raw = self.b.eval(
        f'(async () => JSON.stringify(await (\n{expr}\n)))()',
        await_promise=True,
    )
    return json.loads(raw) if raw is not None else None

  def get_state(self) -> dict[str, Any]:
    res = self.eval_json('window.__LUCKY_TITAN__.getState()')
    return res if isinstance(res, dict) else {}

  def step_frames(self, n: int = 1, dt: float = 1.0 / 60.0) -> dict[str, Any]:
    res = self.eval_json(
        f'(() => {{ window.__LUCKY_TITAN__.stepFrames({int(n)}, {float(dt)}); '
        f'return window.__LUCKY_TITAN__.getState(); }})()'
    )
    return res if isinstance(res, dict) else {}

  def wait_raf(self, frames: int = 2) -> None:
    n = max(1, int(frames))
    self.eval(
        f"""(async () => {{
          for (let i = 0; i < {n}; i++) {{
            await new Promise((r) => requestAnimationFrame(r));
          }}
          return true;
        }})()"""
    )

  def set_viewport(self, width: int, height: int, mobile: bool = False) -> dict[str, int]:
    assert self.b is not None
    self.b.set_viewport(width, height, mobile=mobile)
    if not mobile:
      self.b.cmd('Emulation.setTouchEmulationEnabled', enabled=False, maxTouchPoints=1)
    dims = self.eval_json(
        """(async () => {
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
        })()"""
    )
    return dims if isinstance(dims, dict) else {'innerWidth': width, 'innerHeight': height}

  def mouse_tap(self, x: float, y: float) -> None:
    assert self.b is not None
    xf, yf = float(x), float(y)
    self.b.cmd(
        'Input.dispatchMouseEvent',
        type='mousePressed',
        x=xf,
        y=yf,
        button='left',
        buttons=1,
        clickCount=1,
    )
    time.sleep(0.008)
    self.b.cmd(
        'Input.dispatchMouseEvent',
        type='mouseReleased',
        x=xf,
        y=yf,
        button='left',
        buttons=0,
        clickCount=1,
    )

  def touch_tap(self, x: float, y: float) -> None:
    assert self.b is not None
    pt = [{
        'x': round(float(x), 1),
        'y': round(float(y), 1),
        'radiusX': 6,
        'radiusY': 6,
        'force': 1.0,
        'id': 1,
    }]
    self.b.cmd('Input.dispatchTouchEvent', type='touchStart', touchPoints=pt)
    time.sleep(0.015)
    self.b.cmd('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])

  def pointer_tap(self, x: float, y: float) -> None:
    if self.mobile:
      self.touch_tap(x, y)
    else:
      self.mouse_tap(x, y)

  def pointer_drag(self, x0: float, y0: float, x1: float, y1: float, steps: int = 14) -> None:
    assert self.b is not None
    if self.mobile:
      p0 = [{'x': round(float(x0), 1), 'y': round(float(y0), 1), 'radiusX': 6, 'radiusY': 6, 'force': 1.0, 'id': 1}]
      self.b.cmd('Input.dispatchTouchEvent', type='touchStart', touchPoints=p0)
      time.sleep(0.01)
      for i in range(1, steps + 1):
        xi = x0 + (x1 - x0) * i / steps
        yi = y0 + (y1 - y0) * i / steps
        pi = [{'x': round(float(xi), 1), 'y': round(float(yi), 1), 'radiusX': 6, 'radiusY': 6, 'force': 1.0, 'id': 1}]
        self.b.cmd('Input.dispatchTouchEvent', type='touchMove', touchPoints=pi)
        if i % 4 == 0:
          time.sleep(0.006)
      time.sleep(0.02)
      self.b.cmd('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
    else:
      self.b.cmd('Input.dispatchMouseEvent', type='mouseMoved', x=float(x0), y=float(y0), button='none', buttons=0)
      self.b.cmd(
          'Input.dispatchMouseEvent',
          type='mousePressed',
          x=float(x0),
          y=float(y0),
          button='left',
          buttons=1,
          clickCount=1,
      )
      for i in range(1, steps + 1):
        xi = x0 + (x1 - x0) * i / steps
        yi = y0 + (y1 - y0) * i / steps
        self.b.cmd('Input.dispatchMouseEvent', type='mouseMoved', x=float(xi), y=float(yi), button='left', buttons=1)
        if i % 4 == 0:
          time.sleep(0.006)
      time.sleep(0.02)
      self.b.cmd(
          'Input.dispatchMouseEvent',
          type='mouseReleased',
          x=float(x1),
          y=float(y1),
          button='left',
          buttons=0,
          clickCount=1,
      )

  def locate_control(self, selectors: str | list[str]) -> dict[str, Any]:
    sel_list = [selectors] if isinstance(selectors, str) else list(selectors)
    res = self.eval_json(f'({LOCATE_CONTROL_RECT_JS})({json.dumps(sel_list)})')
    return res if isinstance(res, dict) else {'found': False}

  def tap_control(
      self,
      selectors: str | list[str],
      respect_debounce: bool = True,
  ) -> dict[str, Any]:
    info = self.locate_control(selectors)
    if not info.get('found'):
      raise AssertionError(f'Visible control not found for selectors: {selectors}')
    if respect_debounce:
      time.sleep(0.30)
    self.pointer_tap(info['x'], info['y'])
    return info

  def clear_diagnostics(self) -> None:
    assert self.b is not None
    self.b.console.clear()
    self.b.exceptions.clear()
    self.b.requests.clear()
    try:
      self.b.eval('if (Array.isArray(window.__ERRORS__)) window.__ERRORS__.length = 0; true')
    except Exception:
      pass

  def collect_diagnostics(self) -> dict[str, list[str]]:
    assert self.b is not None
    win_errs: list[str] = []
    try:
      raw = self.b.eval('JSON.stringify(window.__ERRORS__ || [])')
      if raw:
        win_errs = [str(x) for x in json.loads(raw)]
    except Exception as exc:
      win_errs = [f'eval_window_errors_failed: {exc}']

    console_errs = [
        msg
        for typ, msg in self.b.console
        if typ in ('error', 'assert') and 'favicon.ico' not in msg
    ]
    http_errs = [
        f'{cmd} {path} -> {code}'
        for cmd, path, code in self.b.requests
        if str(code).startswith(('4', '5')) and not str(path).endswith('/favicon.ico')
    ]
    return {
        'window_errors': win_errs,
        'exceptions': [str(x) for x in self.b.exceptions],
        'console_errors': console_errs,
        'http_errors': http_errs,
    }

  def assert_clean(self, label: str = '') -> None:
    diag = self.collect_diagnostics()
    problems = (
        diag['window_errors']
        + diag['exceptions']
        + diag['console_errors']
        + diag['http_errors']
    )
    if problems:
      prefix = f'[{label}] ' if label else ''
      raise AssertionError(
          f'{prefix}unexpected console/page/HTTP errors: {json.dumps(diag, indent=2)}'
      )

  def screenshot(self, filename: str, quality: int = 84) -> str:
    """Saves a compressed JPEG screenshot strictly under /tmp/bv1a5s/shots/qa/."""
    assert self.b is not None
    base, ext = os.path.splitext(filename)
    if ext.lower() not in ('.jpg', '.jpeg'):
      filename = f'{base}.jpg'
    path = filename if os.path.isabs(filename) else os.path.join(QA_SHOTS_DIR, filename)
    norm_path = os.path.abspath(path)
    norm_root = os.path.abspath(TMP_ROOT)
    if not norm_path.startswith(norm_root + os.sep):
      raise ValueError(f'Screenshot path must remain inside {norm_root}: {norm_path}')
    return self.b.screenshot(norm_path, fmt='jpeg', quality=quality)
