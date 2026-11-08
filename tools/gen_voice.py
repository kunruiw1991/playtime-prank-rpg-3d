#!/usr/bin/env python3
"""Generate and verify all 68 pre-recorded neural voiceover MP3s for JJ & Mikey vs Tung Tung Sahur: McDonald's Burger Battle 3D!

Reads canonical speaker definitions and the 68 voice lines from src/data/voice_catalog.js,
synthesizes audio in parallel via edge-tts into /tmp/playtime_prank_rpg_3d/tmp_profiles/tts_tmp/,
trims silence and normalizes loudness with ffmpeg (44.1 kHz, mono, 64 kbps MP3), and writes:
  - assets/voice/<id>.mp3
  - assets/voice/manifest.json
  - src/data/voice_manifest.js

Usage:
  PYTHONPATH=/tmp/tts_pkgs python3 tools/gen_voice.py --force
  python3 tools/gen_voice.py --check
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time


ROOT_DIR = Path(__file__).resolve().parent.parent
VOICE_CATALOG_PATH = ROOT_DIR / 'src' / 'data' / 'voice_catalog.js'
ASSETS_VOICE_DIR = ROOT_DIR / 'assets' / 'voice'
MANIFEST_JSON_PATH = ASSETS_VOICE_DIR / 'manifest.json'
MANIFEST_JS_PATH = ROOT_DIR / 'src' / 'data' / 'voice_manifest.js'
TMP_DIR = ROOT_DIR / 'tmp_profiles' / 'tts_tmp'

EDGE_TTS_BIN = Path('/tmp/tts_pkgs/bin/edge-tts')
EXPECTED_COUNT = 68
MAX_TOTAL_BYTES = int(4.0 * 1024 * 1024)
CJK_RE = re.compile(r'[\u4e00-\u9fff]')


def parse_voice_catalog(catalog_path: Path) -> tuple[dict[str, dict[str, str]], list[tuple[str, str, str]]]:
  """Parse VOICE_SPEAKERS and VOICE_LINES_SPEC directly from src/data/voice_catalog.js."""
  src = catalog_path.read_text(encoding='utf-8')
  if CJK_RE.search(src):
    raise ValueError(f'CJK characters found in {catalog_path}')

  speakers: dict[str, dict[str, str]] = {}
  speaker_pat = re.compile(
      r"(\w+)\s*:\s*Object\.freeze\(\{\s*"
      r"(?:id:\s*'[^']*'\s*,\s*)?"
      r"(?:name:\s*'([^']*)'\s*,\s*)?"
      r"voice:\s*'([^']+)'\s*,\s*"
      r"rate:\s*'([^']+)'\s*,\s*"
      r"pitch:\s*'([^']+)'\s*"
      r"(?:,\s*role:\s*'([^']+)')?\s*,?\s*\}\)"
  )
  for m in speaker_pat.finditer(src):
    key, name_val, voice, rate, pitch, role_val = m.groups()
    speakers[key] = {
        'voice': voice,
        'rate': rate,
        'pitch': pitch,
        'role': role_val or name_val or key,
    }

  lines: list[tuple[str, str, str]] = []
  obj_pat = re.compile(
      r"Object\.freeze\(\{\s*"
      r"id:\s*(['\"])([^'\"]+)\1\s*,\s*"
      r"speaker:\s*(['\"])([^'\"]+)\3\s*,\s*"
      r"text:\s*(['\"])(.*?)\5\s*,?\s*\}\)",
      re.DOTALL,
  )
  for m in obj_pat.finditer(src):
    clip_id, speaker, text = m.group(2), m.group(4), m.group(6)
    if speaker not in speakers:
      raise ValueError(f'Unknown speaker {speaker!r} for clip {clip_id!r}')
    lines.append((clip_id, speaker, text))

  if not lines:
    line_pat = re.compile(
        r"""\[\s*(['"])([^'"]+)\1\s*,\s*(['"])([^'"]+)\3\s*,\s*(['"])(.*?)\5\s*\]"""
    )
    for m in line_pat.finditer(src):
      clip_id, speaker, text = m.group(2), m.group(4), m.group(6)
      if speaker not in speakers:
        raise ValueError(f'Unknown speaker {speaker!r} for clip {clip_id!r}')
      lines.append((clip_id, speaker, text))

  if len(lines) != EXPECTED_COUNT:
    raise ValueError(f'Expected {EXPECTED_COUNT} lines in {catalog_path}, got {len(lines)}')

  seen_ids = set()
  for clip_id, _, _ in lines:
    if clip_id in seen_ids:
      raise ValueError(f'Duplicate clip ID in catalog: {clip_id}')
    seen_ids.add(clip_id)

  return speakers, lines


def probe_mp3(mp3_path: Path) -> dict[str, float | int | str]:
  """Inspect MP3 duration, byte size, sample rate, and channels via ffprobe."""
  if not mp3_path.is_file():
    raise FileNotFoundError(f'Missing MP3 file: {mp3_path}')

  cmd = [
      'ffprobe',
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate,channels:format=duration,size',
      '-of',
      'json',
      str(mp3_path),
  ]
  res = subprocess.run(cmd, capture_output=True, text=True, check=True)
  info = json.loads(res.stdout)
  fmt = info.get('format', {})
  streams = info.get('streams', [{}])
  stream = streams[0] if streams else {}

  duration = round(float(fmt.get('duration', 0.0)), 3)
  size_bytes = mp3_path.stat().st_size
  sample_rate = int(stream.get('sample_rate', 0))
  channels = int(stream.get('channels', 0))
  codec_name = str(stream.get('codec_name', ''))
  return {
      'duration': duration,
      'bytes': size_bytes,
      'sample_rate': sample_rate,
      'channels': channels,
      'codec_name': codec_name,
  }


def synthesize_one(
    clip_id: str,
    speaker: str,
    text: str,
    speaker_cfg: dict[str, str],
    force: bool = False,
    prev_text: str | None = None,
) -> dict[str, object]:
  """Synthesize, trim silence, and normalize a single voice clip."""
  out_mp3 = ASSETS_VOICE_DIR / f'{clip_id}.mp3'
  if not force and prev_text == text and out_mp3.is_file():
    try:
      stats = probe_mp3(out_mp3)
      if (
          float(stats['duration']) > 0.35
          and int(stats['bytes']) > 2000
          and int(stats['sample_rate']) == 44100
          and int(stats['channels']) == 1
      ):
        return {
            'id': clip_id,
            'speaker': speaker,
            'text': text,
            'file': f'assets/voice/{clip_id}.mp3',
            'duration': stats['duration'],
            'bytes': stats['bytes'],
        }
    except Exception:
      pass

  raw_mp3 = TMP_DIR / f'{clip_id}_raw.mp3'
  norm_mp3 = TMP_DIR / f'{clip_id}_norm.mp3'

  env = os.environ.copy()
  py_path = env.get('PYTHONPATH', '')
  tts_pkg_dir = '/tmp/tts_pkgs'
  if tts_pkg_dir not in py_path.split(':'):
    env['PYTHONPATH'] = f'{tts_pkg_dir}:{py_path}' if py_path else tts_pkg_dir

  edge_bin = str(EDGE_TTS_BIN) if EDGE_TTS_BIN.is_file() else 'edge-tts'
  clean_tts_text = text.strip()

  last_err: Exception | None = None
  for attempt in range(1, 5):
    try:
      if raw_mp3.exists():
        raw_mp3.unlink()
      tts_cmd = [
          edge_bin,
          '--no-progress',
          f"--voice={speaker_cfg['voice']}",
          f"--rate={speaker_cfg['rate']}",
          f"--pitch={speaker_cfg['pitch']}",
          f'--text={clean_tts_text}',
          f'--write-media={raw_mp3}',
      ]
      subprocess.run(tts_cmd, env=env, capture_output=True, text=True, check=True, timeout=45)
      if not raw_mp3.is_file() or raw_mp3.stat().st_size < 500:
        raise RuntimeError(f'Raw TTS output too small for {clip_id}')
      break
    except Exception as exc:
      last_err = exc
      time.sleep(0.6 * attempt)
  else:
    raise RuntimeError(f'edge-tts failed for {clip_id} after 4 attempts: {last_err}')

  af_trimmed = (
      'silenceremove=start_periods=1:start_silence=0.03:start_threshold=-46dB,'
      'areverse,'
      'silenceremove=start_periods=1:start_silence=0.08:start_threshold=-46dB,'
      'areverse,'
      'dynaudnorm=f=120:g=5:p=0.92:m=4.0'
  )
  ff_cmd = [
      'ffmpeg',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      str(raw_mp3),
      '-af',
      af_trimmed,
      '-ar',
      '44100',
      '-ac',
      '1',
      '-b:a',
      '64k',
      '-write_xing',
      '1',
      '-id3v2_version',
      '0',
      '-map_metadata',
      '-1',
      str(norm_mp3),
  ]
  subprocess.run(ff_cmd, capture_output=True, text=True, check=True, timeout=30)

  stats = probe_mp3(norm_mp3)
  if float(stats['duration']) <= 0.35 or int(stats['bytes']) <= 2000:
    ff_fallback = [
        'ffmpeg',
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        str(raw_mp3),
        '-af',
        'dynaudnorm=f=120:g=5:p=0.92:m=4.0',
        '-ar',
        '44100',
        '-ac',
        '1',
        '-b:a',
        '64k',
        '-write_xing',
        '1',
        '-id3v2_version',
        '0',
        '-map_metadata',
        '-1',
        str(norm_mp3),
    ]
    subprocess.run(ff_fallback, capture_output=True, text=True, check=True, timeout=30)
    stats = probe_mp3(norm_mp3)

  shutil.move(str(norm_mp3), str(out_mp3))
  if raw_mp3.exists():
    raw_mp3.unlink()

  final_stats = probe_mp3(out_mp3)
  return {
      'id': clip_id,
      'speaker': speaker,
      'text': text,
      'file': f'assets/voice/{clip_id}.mp3',
      'duration': final_stats['duration'],
      'bytes': final_stats['bytes'],
  }


def write_manifests(ordered_clips: list[dict[str, object]]) -> dict[str, object]:
  """Write assets/voice/manifest.json and src/data/voice_manifest.js."""
  total_bytes = sum(int(c['bytes']) for c in ordered_clips)
  clips_map = {str(c['id']): c for c in ordered_clips}
  manifest = {
      'version': 1,
      'totalClips': len(ordered_clips),
      'totalBytes': total_bytes,
      'clips': clips_map,
  }

  json_text = json.dumps(manifest, indent=2, ensure_ascii=True) + '\n'
  MANIFEST_JSON_PATH.write_text(json_text, encoding='utf-8')

  js_lines = [
      '// Auto-generated by tools/gen_voice.py from src/data/voice_catalog.js.',
      '// Do not edit manually; re-run: PYTHONPATH=/tmp/tts_pkgs python3 tools/gen_voice.py',
      '',
      'export const VOICE_MANIFEST = Object.freeze({',
      '  version: 1,',
      f'  totalClips: {len(ordered_clips)},',
      f'  totalBytes: {total_bytes},',
      '  clips: Object.freeze({',
  ]
  for c in ordered_clips:
    cid = json.dumps(str(c['id']), ensure_ascii=True)
    spk = json.dumps(str(c['speaker']), ensure_ascii=True)
    txt = json.dumps(str(c['text']), ensure_ascii=True)
    fl = json.dumps(str(c['file']), ensure_ascii=True)
    dur = float(c['duration'])
    bts = int(c['bytes'])
    js_lines.append(
        f'    {cid}: Object.freeze({{ id: {cid}, speaker: {spk}, text: {txt}, '
        f'file: {fl}, duration: {dur:.3f}, bytes: {bts} }}),'
    )
  js_lines.append('  }),')
  js_lines.append('});')
  js_lines.append('')
  MANIFEST_JS_PATH.write_text('\n'.join(js_lines), encoding='utf-8')
  return manifest


def run_check() -> int:
  """Offline verification of all 68 MP3s, manifest.json, and voice_manifest.js."""
  _, lines = parse_voice_catalog(VOICE_CATALOG_PATH)

  if not MANIFEST_JSON_PATH.is_file():
    print(f'FAIL: Missing {MANIFEST_JSON_PATH}', file=sys.stderr)
    return 1
  if not MANIFEST_JS_PATH.is_file():
    print(f'FAIL: Missing {MANIFEST_JS_PATH}', file=sys.stderr)
    return 1

  manifest_raw = MANIFEST_JSON_PATH.read_text(encoding='utf-8')
  js_raw = MANIFEST_JS_PATH.read_text(encoding='utf-8')
  if CJK_RE.search(manifest_raw) or CJK_RE.search(js_raw):
    print('FAIL: CJK characters detected in voice manifests', file=sys.stderr)
    return 1

  manifest = json.loads(manifest_raw)
  clips = manifest.get('clips', {})
  if manifest.get('totalClips') != EXPECTED_COUNT or len(clips) != EXPECTED_COUNT:
    print(
        f'FAIL: Expected {EXPECTED_COUNT} clips in manifest, got {len(clips)}',
        file=sys.stderr,
    )
    return 1

  total_bytes = 0
  total_duration = 0.0
  for clip_id, speaker, text in lines:
    if clip_id not in clips:
      print(f'FAIL: Clip {clip_id} missing from manifest.json', file=sys.stderr)
      return 1
    entry = clips[clip_id]
    if entry.get('speaker') != speaker or entry.get('text') != text:
      print(f'FAIL: Catalog mismatch on {clip_id}', file=sys.stderr)
      return 1
    if f'"{clip_id}"' not in js_raw:
      print(f'FAIL: Clip {clip_id} missing from voice_manifest.js', file=sys.stderr)
      return 1

    mp3_path = ROOT_DIR / str(entry['file'])
    stats = probe_mp3(mp3_path)
    dur = float(stats['duration'])
    bts = int(stats['bytes'])
    sr = int(stats['sample_rate'])
    ch = int(stats['channels'])

    if dur <= 0.35:
      print(f'FAIL: {clip_id} duration too short ({dur}s <= 0.35s)', file=sys.stderr)
      return 1
    if bts <= 2000:
      print(f'FAIL: {clip_id} byte size too small ({bts} <= 2000)', file=sys.stderr)
      return 1
    if sr != 44100 or ch != 1:
      print(f'FAIL: {clip_id} invalid audio format (sr={sr}, ch={ch})', file=sys.stderr)
      return 1
    if bts != int(entry.get('bytes', -1)):
      print(f"FAIL: {clip_id} byte size mismatch ({bts} vs {entry.get('bytes')})", file=sys.stderr)
      return 1
    if abs(dur - float(entry.get('duration', -999))) > 0.05:
      print(
          f"FAIL: {clip_id} duration mismatch ({dur} vs {entry.get('duration')})",
          file=sys.stderr,
      )
      return 1

    total_bytes += bts
    total_duration += dur

  if total_bytes != int(manifest.get('totalBytes', -1)):
    print(
        f"FAIL: totalBytes mismatch ({total_bytes} vs {manifest.get('totalBytes')})",
        file=sys.stderr,
    )
    return 1

  if total_bytes > MAX_TOTAL_BYTES:
    print(
        f'FAIL: Total MP3 size {total_bytes / (1024 * 1024):.2f} MB exceeds 4.00 MB cap',
        file=sys.stderr,
    )
    return 1

  mb = total_bytes / (1024 * 1024)
  print(
      f'OK: {EXPECTED_COUNT}/{EXPECTED_COUNT} MP3s verified via ffprobe | '
      f'totalDuration={total_duration:.1f}s | totalSize={mb:.2f} MB ({total_bytes} bytes)'
  )
  return 0


def main() -> int:
  parser = argparse.ArgumentParser(description='Generate or verify Tung Tung Tung Sahur 3D neural VO.')
  parser.add_argument('--check', action='store_true', help='Verify existing MP3s and manifests offline.')
  parser.add_argument('--force', action='store_true', help='Re-synthesize all clips even if valid MP3s exist.')
  parser.add_argument('--workers', type=int, default=6, help='Parallel synthesis worker count (default: 6).')
  args = parser.parse_args()

  if args.check:
    return run_check()

  speakers, lines = parse_voice_catalog(VOICE_CATALOG_PATH)
  ASSETS_VOICE_DIR.mkdir(parents=True, exist_ok=True)
  TMP_DIR.mkdir(parents=True, exist_ok=True)

  prev_texts: dict[str, str] = {}
  if MANIFEST_JSON_PATH.is_file():
    try:
      prev_manifest = json.loads(MANIFEST_JSON_PATH.read_text(encoding='utf-8'))
      for k, v in prev_manifest.get('clips', {}).items():
        if isinstance(v, dict) and 'text' in v:
          prev_texts[str(k)] = str(v['text'])
    except Exception:
      prev_texts = {}

  t0 = time.time()
  results_by_id: dict[str, dict[str, object]] = {}
  max_workers = max(1, min(12, int(args.workers)))

  try:
    print(f'Synthesizing {len(lines)} neural VO clips (max_workers={max_workers})...')
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
      fut_map = {
          pool.submit(
              synthesize_one,
              cid,
              spk,
              txt,
              speakers[spk],
              args.force,
              prev_texts.get(cid),
          ): cid
          for cid, spk, txt in lines
      }
      done_count = 0
      for fut in as_completed(fut_map):
        cid = fut_map[fut]
        res = fut.result()
        results_by_id[cid] = res
        done_count += 1
        if done_count % 10 == 0 or done_count == len(lines):
          print(f'  [{done_count}/{len(lines)}] latest: {cid} ({res["duration"]}s, {res["bytes"]} B)')

    ordered = [results_by_id[cid] for cid, _, _ in lines]
    write_manifests(ordered)
  finally:
    shutil.rmtree(TMP_DIR, ignore_errors=True)

  elapsed = time.time() - t0
  print(f'Generated manifests in {elapsed:.1f}s. Running ffprobe verification...')
  return run_check()


if __name__ == '__main__':
  sys.exit(main())
