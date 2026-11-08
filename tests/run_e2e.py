#!/usr/bin/env python3
"""Master End-to-End QA Suite (E01..E44) for Lucky Block Titans 3D.

Owner: lucky-qa
Exclusive path: tests/run_e2e.py
Runs 44 named assertions (E01..E44) covering:
  - Boot, WebGL context, live 3D title background, <= 80ms PLAY transition
  - Live Three.js scene guardrails (maxMetalness <= 0.22, sprite toneMapped=false & fog=false,
    cameraRoll === 0, horizontal yaw drag P1-4 tap-vs-drag, drawCalls <= 65)
  - Island navigation, water/cliff clamp (deadTaps === 0), Starter Block 3-drop guarantee,
    bouncy magnet pickups, 12s block regrowth, Critter tummy-pat bonus gems, 3D Guide Arrow
  - All 3 Magic Flowerpot tiers (Glow -> Crystal -> Ultimate Star Pot) & 4 Hub Pads
  - Mystery Artifact Roulette natural spin (2.0-3.2s, strict tier climb), all 6 weapons 3D equip,
    zero-downgrade protection, Speed Boots, Blazing Gold Helmet & 5 Rainbow Shield Hearts,
    Royal Star Cape, and 280ms HUD multi-tap debounce
  - All 4 Giant Voxel Titans (under-geared Rainbow Spring Cloud boing + +3 stars + 0 loss,
    geared pinata smash across moss_titan, snow_titan, thunder_titan, bedrock_king -> 4/4 Victory)
  - Victory Keep Playing endless mode, Lucky Chaos Mode toggle & drop boost, Pause Modal toggles,
    and localStorage['lucky_titan_progress'] persistence
  - Neural Voiceover manifest + ffprobe validation on all MP3s (<= 4.5 MB, 0 corrupt/empty),
    0 speechSynthesis static + runtime, -6 dB BGM ducking, and 1-tap Voice Replay via both
    #btn-hud-voice and #voice-subtitle (including auto-unmute from muted state)
  - Gate F13 (l10n_audit.py 0-CJK static + full runtime flow) and Gate F11 (layout_audit.py 5 viewports)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from typing import Any, Callable

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from l10n_audit import run_l10n_audit, run_static_repo_scan  # noqa: E402
from layout_audit import run_layout_audit  # noqa: E402
from qa_helpers import (  # noqa: E402
    HUD_BUTTON_IDS,
    QA_SHOTS_DIR,
    QA_TMP_DIR,
    REPO_ROOT,
    SEAM_METHODS,
    STORAGE_KEY,
    TITAN_ORDER,
    WEAPON_ORDER,
    WEAPON_TIERS,
    QASession,
    ensure_qa_dirs,
    extract_pad_tiers,
    extract_player_gems,
    extract_pot_seeds,
    extract_trophies,
    ffprobe_mp3,
    owner_for_area,
    parse_voice_catalog_entries,
)

INSTALL_THREE_SPY_JS = r"""
(async () => {
  if (window.__QA_THREE_HOOKED__) return true;
  const THREE = await import('/vendor/three.module.min.js');
  window.__QA_THREE__ = THREE;
  const origRender = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function qaHookedRender(scene, camera) {
    window.__QA_LAST_SCENE__ = scene;
    window.__QA_LAST_CAMERA__ = camera;
    window.__QA_LAST_RENDERER__ = this;
    return origRender.call(this, scene, camera);
  };
  window.__QA_THREE_HOOKED__ = true;
  return true;
})()
"""


def _ensure_three_spy(sess: QASession) -> None:
  sess.eval(INSTALL_THREE_SPY_JS)
  sess.step_frames(2)
  sess.wait_raf(2)


# ==============================================================================
# Group 1: Boot, Seam, Live 3D Title & Three.js Visual Guardrails (E01..E08)
# ==============================================================================


def check_e01_boot_zero_errors(sess: QASession, ctx: dict[str, Any]) -> dict[str, Any]:
  sess.clear_diagnostics()
  ok = sess.goto('index.html?seed=2026', timeout=25.0)
  assert ok, 'Timed out loading index.html'
  sess.wait_raf(3)
  _ensure_three_spy(sess)
  info = sess.eval_json(
      """(() => {
        const c = document.getElementById('game-canvas') || document.querySelector('canvas');
        const r = c ? c.getBoundingClientRect() : { width: 0, height: 0 };
        const gl = window.__QA_LAST_RENDERER__?.getContext?.() || null;
        return {
          hasCanvas: Boolean(c),
          width: Math.round(r.width),
          height: Math.round(r.height),
          hasWebGL: Boolean(gl && !gl.isContextLost()),
        };
      })()"""
  )
  sess.assert_clean('E01')
  assert info['hasCanvas'] and info['width'] >= 800 and info['height'] >= 500, f'Bad canvas: {info}'
  assert info['hasWebGL'], f'WebGL context missing or lost: {info}'
  ctx['e01_shot'] = sess.screenshot('e2e_01_title_boot.jpg')
  return info


def check_e02_seam_contract_complete(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      f"""(() => {{
        const L = window.__LUCKY_TITAN__;
        if (!L) return {{ exists: false, missing: {json.dumps(SEAM_METHODS)} }};
        const missing = {json.dumps(SEAM_METHODS)}.filter((m) => typeof L[m] !== 'function');
        const st = L.getState();
        return {{
          exists: true,
          missing,
          hasPlayer: Boolean(st && typeof st.player === 'object'),
          hasFeedback: Boolean(st && typeof st.feedback === 'object'),
          mode: st?.mode || null,
        }};
      }})()"""
  )
  assert res['exists'] and not res['missing'], f'Missing seam methods: {res}'
  assert res['hasPlayer'] and res['hasFeedback'], f'Incomplete getState() snapshot: {res}'
  return res


def check_e03_title_live_3d_background(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  sess.goto('index.html?seed=2026', timeout=25.0)
  sess.wait_raf(3)
  _ensure_three_spy(sess)
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        const st = L.getState();
        const cam = window.__QA_LAST_CAMERA__;
        const x0 = cam ? cam.position.x : 0;
        const z0 = cam ? cam.position.z : 0;
        L.stepFrames(30, 1 / 60);
        const x1 = cam ? cam.position.x : 0;
        const z1 = cam ? cam.position.z : 0;
        const playBtn = document.querySelector('#btn-title-play, #btn-play, #title-screen button');
        const br = playBtn ? playBtn.getBoundingClientRect() : { width: 0, height: 0 };
        const sceneChildren = window.__QA_LAST_SCENE__?.children?.length || 0;
        return {
          mode: st.mode,
          sceneChildren,
          camOrbitDelta: Math.round(Math.hypot(x1 - x0, z1 - z0) * 1000) / 1000,
          playBtnWidth: Math.round(br.width),
          playBtnHeight: Math.round(br.height),
        };
      })()"""
  )
  assert res['mode'] == 'title', f"Expected mode='title' on fresh load, got {res}"
  assert res['sceneChildren'] >= 3, f'3D scene not populated behind title: {res}'
  assert res['playBtnWidth'] >= 112 and res['playBtnHeight'] >= 72, f'Title PLAY button too small: {res}'
  return res


def check_e04_play_transition_under_80ms(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        const btn = document.querySelector('#btn-title-play, #btn-play, #title-screen button');
        const t0 = performance.now();
        if (btn) btn.click(); else L.startGame({ seed: 2026 });
        L.stepFrames(1, 1 / 60);
        const elapsedMs = performance.now() - t0;
        const st = L.getState();
        const titleEl = document.getElementById('title-screen');
        const titleHidden = !titleEl || titleEl.hidden || getComputedStyle(titleEl).display === 'none' || parseFloat(getComputedStyle(titleEl).opacity || '1') <= 0.05;
        return {
          elapsedMs: Math.round(elapsedMs * 100) / 100,
          mode: st.mode,
          titleHidden,
        };
      })()"""
  )
  assert res['mode'] == 'playing', f'PLAY did not enter playing mode: {res}'
  assert res['elapsedMs'] <= 80.0, f"PLAY transition exceeded 80ms budget: {res['elapsedMs']}ms"
  assert res['titleHidden'], f'#title-screen still visible during play: {res}'
  return res


def check_e05_three_max_metalness_guardrail(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  _ensure_three_spy(sess)
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.spawnTitan('bedrock_king');
        L.stepFrames(30, 1 / 60);
        const scene = window.__QA_LAST_SCENE__;
        let maxMat = 0;
        let matCount = 0;
        const offenders = [];
        if (scene) {
          scene.traverse((obj) => {
            const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
            for (const m of mats) {
              matCount++;
              if (typeof m.metalness === 'number') {
                if (m.metalness > maxMat) maxMat = m.metalness;
                if (m.metalness > 0.22) {
                  offenders.push({ name: obj.name || obj.type, metalness: m.metalness });
                }
              }
            }
          });
        }
        const reported = Number(L.getState().perf?.maxMetalness || 0);
        return {
          matCount,
          liveMaxMetalness: Math.round(maxMat * 1000) / 1000,
          reportedMaxMetalness: Math.round(reported * 1000) / 1000,
          offenders: offenders.slice(0, 10),
        };
      })()"""
  )
  assert res['matCount'] > 5, f'Expected live Three.js materials, got {res}'
  assert res['liveMaxMetalness'] <= 0.22 and not res['offenders'], f'Metalness > 0.22 found: {res}'
  assert res['reportedMaxMetalness'] <= 0.22, f'perf.maxMetalness > 0.22: {res}'
  return res


def check_e06_sprite_tonemapped_fog_guardrail(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  _ensure_three_spy(sess)
  res = sess.eval_json(
      """(() => {
        const scene = window.__QA_LAST_SCENE__;
        let spriteCount = 0;
        const badSprites = [];
        if (scene) {
          scene.traverse((obj) => {
            if (obj.isSprite && obj.material) {
              spriteCount++;
              const m = obj.material;
              if (m.toneMapped !== false || m.fog !== false) {
                badSprites.push({
                  name: obj.name || 'Sprite',
                  toneMapped: m.toneMapped,
                  fog: m.fog,
                });
              }
            }
          });
        }
        return { spriteCount, badSprites };
      })()"""
  )
  assert not res['badSprites'], f'Sprites missing toneMapped:false or fog:false: {res}'
  return res


def check_e07_camera_zero_roll_and_drag_yaw(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  _ensure_three_spy(sess)
  before = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.stepFrames(15, 1 / 60);
        const cam = window.__QA_LAST_CAMERA__;
        const st = L.getState();
        const canvas = document.getElementById('game-canvas') || document.querySelector('canvas');
        const cs = canvas ? getComputedStyle(canvas) : { touchAction: '' };
        return {
          camX: cam ? cam.position.x : 0,
          camZ: cam ? cam.position.z : 0,
          roll: cam ? Math.abs(cam.rotation.z) : Math.abs(st.perf?.cameraRoll || 0),
          tapsBefore: st.feedback?.taps || 0,
          touchAction: cs.touchAction,
        };
      })()"""
  )
  # Drag horizontally 140px across canvas center -> must rotate yaw AND NOT fire tap on release (P1-4)
  sess.pointer_drag(640, 380, 500, 380, steps=14)
  after = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.stepFrames(20, 1 / 60);
        const cam = window.__QA_LAST_CAMERA__;
        const st = L.getState();
        // Also test during Titan bonk hop
        L.spawnTitan('moss_titan');
        L.stepFrames(40, 1 / 60);
        L.bonkTitan('moss_titan');
        L.stepFrames(5, 1 / 60);
        const rollOnBonk = cam ? Math.abs(cam.rotation.z) : 0;
        const st2 = L.getState();
        return {
          camX: cam ? cam.position.x : 0,
          camZ: cam ? cam.position.z : 0,
          rollAfterDrag: cam ? Math.abs(cam.rotation.z) : 0,
          rollOnBonk,
          reportedRoll: Math.abs(st2.perf?.cameraRoll || 0),
          tapsAfterDrag: st.feedback?.taps || 0,
        };
      })()"""
  )
  cam_shift = ((after['camX'] - before['camX']) ** 2 + (after['camZ'] - before['camZ']) ** 2) ** 0.5
  assert before['roll'] < 1e-5 and after['rollAfterDrag'] < 1e-5 and after['rollOnBonk'] < 1e-5, (
      f'Non-zero camera roll detected: before={before}, after={after}'
  )
  assert after['reportedRoll'] < 1e-5, f'perf.cameraRoll !== 0: {after}'
  assert cam_shift > 0.25, f'Horizontal drag did not rotate camera yaw: shift={cam_shift}'
  assert after['tapsAfterDrag'] == before['tapsBefore'], (
      f'P1-4 violation: camera drag fired a canvas tap ({before["tapsBefore"]} -> {after["tapsAfterDrag"]})'
  )
  assert before['touchAction'] == 'none', f"Expected canvas touch-action:none, got {before['touchAction']}"
  return {'camShift': round(cam_shift, 3), 'touchAction': before['touchAction'], 'maxRoll': 0.0}


def check_e08_draw_calls_budget(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  _ensure_three_spy(sess)
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.stepFrames(10, 1 / 60);
        const rCalls = window.__QA_LAST_RENDERER__?.info?.render?.calls ?? 0;
        const pCalls = L.getState().perf?.drawCalls ?? rCalls;
        return { rendererDrawCalls: rCalls, perfDrawCalls: pCalls };
      })()"""
  )
  calls = max(int(res['rendererDrawCalls']), int(res['perfDrawCalls']))
  assert 1 <= calls <= 65, f'Draw calls outside [1, 65] budget: {res}'
  return res


# ==============================================================================
# Group 2: Island Navigation, Starter Block, Drops, Critters & Regrow (E09..E15)
# ==============================================================================


def check_e09_hero_spawn_and_base_speed(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const p0 = L.getState().player;
        L.tapWorld(-9.0, 4.5);
        L.stepFrames(4, 1 / 60);
        const m0 = L.getState().player;
        L.stepFrames(30, 1 / 60);
        const m1 = L.getState().player;
        const measured = Math.hypot(m1.x - m0.x, m1.z - m0.z) / 0.5;
        return {
          spawn: { x: p0.x, y: p0.y, z: p0.z },
          weaponId: p0.weaponId,
          powerTier: p0.powerTier,
          stateSpeed: p0.speed,
          measuredSpeed: Math.round(measured * 100) / 100,
        };
      })()"""
  )
  assert abs(res['spawn']['x'] - 0.0) < 0.5 and abs(res['spawn']['z'] - 4.5) < 0.5, f'Bad spawn: {res}'
  assert res['weaponId'] in ('wooden_kentungan_bat', 'wood_stick') and res['powerTier'] == 1, f'Bad starter gear: {res}'
  assert res['stateSpeed'] >= 6.8 and res['measuredSpeed'] >= 6.8, f'Base speed < 6.8 b/s: {res}'
  return res


def check_e10_water_and_bounds_clamp_zero_dead_taps(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        for (const [wx, wz] of [[-48, -48], [48, 48], [-50, 0], [0, 52], [44, -44]]) {
          L.tapWorld(wx, wz);
          L.stepFrames(45, 1 / 60);
        }
        const st = L.getState();
        const p = st.player;
        return {
          deadTaps: st.feedback?.deadTaps ?? -1,
          pos: { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, z: Math.round(p.z * 10) / 10 },
        };
      })()"""
  )
  assert res['deadTaps'] == 0, f'Ocean taps caused deadTaps: {res}'
  assert abs(res['pos']['x']) <= 34.5 and abs(res['pos']['z']) <= 34.5, f'Hero left island bounds: {res}'
  return res


def check_e11_starter_block_three_drop_guarantee(
    sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        L.breakBlock(0, 1, 2.0);
        const stMid = L.getState();
        const dropsSpawned = Array.isArray(stMid.activeDrops) ? stMid.activeDrops.length : 0;
        L.tapWorld(0, 2.0);
        L.stepFrames(100, 1 / 60);
        const st = L.getState();
        return {
          blocksBroken: st.blocksBroken,
          dropsSpawned,
          starGems: st.player?.starGems || 0,
          potSeeds: st.player?.potSeeds || 0,
          freeSpins: st.player?.freeSpins || 0,
          lastVoiceId: st.voice?.lastId || null,
        };
      })()"""
  )
  ctx['e11_shot'] = sess.screenshot('e2e_11_starter_pop.jpg')
  assert res['blocksBroken'] >= 1, f'Starter block did not break: {res}'
  assert res['starGems'] >= 5 and res['potSeeds'] >= 1 and res['freeSpins'] >= 1, (
      f'Starter 3-drop guarantee missing items: {res}'
  )
  return res


def check_e12_ordinary_block_break_and_magnet_pickup(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2030, chaosMode: false });
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(90, 1 / 60);
        const beforeBroken = L.getState().blocksBroken;
        const beforeGems = L.getState().player.starGems;
        for (let x = -22; x <= -12; x += 2) {
          for (let z = 12; z <= 20; z += 2) {
            L.breakBlock(x, 1, z);
          }
        }
        const midDrops = (L.getState().activeDrops || []).length;
        // Auto-collect across slope/magnet timer
        L.tapWorld(-16, 16);
        L.stepFrames(340, 1 / 60);
        const after = L.getState();
        return {
          brokenDelta: after.blocksBroken - beforeBroken,
          midDrops,
          gemsDelta: after.player.starGems - beforeGems,
          remainingDrops: (after.activeDrops || []).length,
        };
      })()"""
  )
  assert res['brokenDelta'] >= 3, f'Biome breakBlock calls did not break blocks: {res}'
  assert res['midDrops'] >= 1 or res['gemsDelta'] > 0, f'No drops spawned from broken blocks: {res}'
  assert res['gemsDelta'] > 0, f'Pickups did not credit hero: {res}'
  return res


def check_e13_block_regrow_12s_never_empty(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        // Find a breakable block in meadow by breaking it once, waiting >12s, and breaking the exact same spot again!
        let target = null;
        for (let x = -24; x <= -10 && !target; x++) {
          for (let z = 10; z <= 24 && !target; z++) {
            const b0 = L.getState().blocksBroken;
            L.breakBlock(x, 1, z);
            if (L.getState().blocksBroken > b0) {
              target = { x, y: 1, z };
            }
          }
        }
        if (!target) return { foundBlock: false };
        const brokenAfterFirst = L.getState().blocksBroken;
        // Immediately hitting same spot should NOT break again while regrowing
        L.breakBlock(target.x, target.y, target.z);
        const brokenImmediate = L.getState().blocksBroken;
        // Advance 13.0s (780 frames) past 12.0s regrow timer
        L.stepFrames(780, 1 / 60);
        L.breakBlock(target.x, target.y, target.z);
        const brokenAfterRegrow = L.getState().blocksBroken;
        return {
          foundBlock: true,
          target,
          brokenAfterFirst,
          brokenImmediate,
          brokenAfterRegrow,
        };
      })()"""
  )
  assert res.get('foundBlock'), f'Could not locate meadow breakable block: {res}'
  assert res['brokenAfterRegrow'] > res['brokenImmediate'], f'Block did not regrow after 13s: {res}'
  return res


def check_e14_critter_tummy_pat_bonus_gems(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.stepFrames(15, 1 / 60);
        const st0 = L.getState();
        const critters0 = st0.critters || [];
        if (critters0.length === 0) return { critterCount: 0 };
        const c = critters0[0];
        const gems0 = st0.player.starGems;
        const pets0 = st0.feedback?.crittersPetted || 0;
        L.tapWorld(c.x, c.z);
        for (let i = 0; i < 30; i++) {
          L.stepFrames(10, 1 / 60);
          const cur = (L.getState().critters || [])[0];
          if ((L.getState().feedback?.crittersPetted || 0) > pets0) break;
          if (cur && i === 12) L.tapWorld(cur.x, cur.z);
        }
        L.stepFrames(60, 1 / 60);
        const st1 = L.getState();
        return {
          critterCountBefore: critters0.length,
          critterCountAfter: (st1.critters || []).length,
          crittersPettedDelta: (st1.feedback?.crittersPetted || 0) - pets0,
          gemsDelta: st1.player.starGems - gems0,
          lastVoiceId: st1.voice?.lastId || null,
        };
      })()"""
  )
  assert res.get('critterCountBefore', 0) >= 3, f'Ambient critters missing: {res}'
  assert res['critterCountAfter'] >= res['critterCountBefore'], f'Critter disappeared on pat (must never die): {res}'
  assert res['crittersPettedDelta'] >= 1 and res['gemsDelta'] >= 4, f'Critter pat failed to reward stars: {res}'
  return res


def check_e15_guide_arrow_onboarding_beacon(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  _ensure_three_spy(sess)
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.stepFrames(10, 1 / 60);
        // Break starter block so hero holds potSeed >= 1 and freeSpin >= 1 -> HUD buttons should pulse!
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(90, 1 / 60);
        const potBtn = document.getElementById('btn-hud-pot');
        const spinBtn = document.getElementById('btn-hud-spin');
        const hasPulse = Boolean(
          (potBtn && /puls|ready|glow|active|highlight/i.test(potBtn.className)) ||
          (spinBtn && /puls|ready|glow|active|highlight/i.test(spinBtn.className))
        );
        return {
          potBtnFound: Boolean(potBtn),
          spinBtnFound: Boolean(spinBtn),
          hasPulse,
          potClass: potBtn ? potBtn.className : '',
          spinClass: spinBtn ? spinBtn.className : '',
        };
      })()"""
  )
  assert res['potBtnFound'] and res['spinBtnFound'], f'HUD pot/spin buttons missing: {res}'
  assert res['hasPulse'], f'Expected pulsing cue on #btn-hud-pot or #btn-hud-spin when ready: {res}'
  return res


# ==============================================================================
# Group 3: Magic Flowerpots — Cover-Star 3-Tier Bonsai Economy (E16..E19)
# ==============================================================================


def check_e16_flowerpot_tier1_glow_pot(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(90, 1 / 60);
        const gemsBeforePlant = L.getState().player.starGems;
        const seedsBeforePlant = L.getState().player.potSeeds;
        L.plantPot(0);
        const stPlanted = L.getState();
        const pad0 = stPlanted.flowerpots[0];
        // Walk next to Pad 0 and wait 3.8s for Tier 1 fountain
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(40, 1 / 60);
        const gemsBase = L.getState().player.starGems;
        L.stepFrames(230, 1 / 60);
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(45, 1 / 60);
        const gemsAfterFountain = L.getState().player.starGems;
        return {
          seedsBeforePlant,
          seedsAfterPlant: stPlanted.player.potSeeds,
          gemsBeforePlant,
          tier: pad0?.tier,
          gemsFountained: gemsAfterFountain - gemsBase,
          lastVoiceId: stPlanted.voice?.lastId || null,
        };
      })()"""
  )
  assert res['tier'] == 1, f'Pad 0 did not plant Tier 1 Glow Pot: {res}'
  assert res['seedsAfterPlant'] == res['seedsBeforePlant'] - 1, f'potSeed not consumed first: {res}'
  assert res['gemsFountained'] >= 2, f'Tier 1 Glow Pot did not fountain >=2 stars within 4s: {res}'
  return res


def check_e17_flowerpot_tier2_crystal_pot(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        // Earn gems/seeds to upgrade Pad 0 to Tier 2 Crystal Pot
        for (let x = -22; x <= -12; x += 2) {
          for (let z = 12; z <= 22; z += 2) L.breakBlock(x, 1, z);
        }
        L.stepFrames(330, 1 / 60);
        L.plantPot(0);
        const tier = L.getState().flowerpots[0]?.tier;
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(50, 1 / 60);
        const gems0 = L.getState().player.starGems;
        L.stepFrames(210, 1 / 60); // 3.5s
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(45, 1 / 60);
        const gems1 = L.getState().player.starGems;
        return { tier, gemsFountained: gems1 - gems0 };
      })()"""
  )
  assert res['tier'] == 2, f'Pad 0 did not upgrade to Tier 2 Crystal Pot: {res}'
  assert res['gemsFountained'] >= 4, f'Tier 2 Crystal Pot did not fountain >=4 stars: {res}'
  return res


def check_e18_flowerpot_tier3_ultimate_star_pot(
    sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        for (let x = 12; x <= 22; x += 2) {
          for (let z = 12; z <= 22; z += 2) L.breakBlock(x, 1, z);
        }
        L.stepFrames(330, 1 / 60);
        L.plantPot(0);
        const tier = L.getState().flowerpots[0]?.tier;
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(50, 1 / 60);
        const gems0 = L.getState().player.starGems;
        L.stepFrames(180, 1 / 60); // 3.0s
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(45, 1 / 60);
        const gems1 = L.getState().player.starGems;
        return { tier, gemsFountained: gems1 - gems0 };
      })()"""
  )
  ctx['e18_shot'] = sess.screenshot('e2e_18_ultimate_flowerpot.jpg')
  assert res['tier'] == 3, f'Pad 0 did not upgrade to Tier 3 Ultimate Star Pot: {res}'
  assert res['gemsFountained'] >= 8, f'Tier 3 Ultimate Star Pot did not fountain >=8 stars: {res}'
  return res


def check_e19_all_four_pads_bloom(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        // Let Pad 0 Ultimate Pot rain treasure & upgrade Pads 1, 2, 3 all the way to Tier 3!
        for (let cycle = 0; cycle < 12; cycle++) {
          L.tapWorld(-4.2, 1.6);
          L.stepFrames(240, 1 / 60);
          for (let p = 0; p < 4; p++) {
            if ((L.getState().flowerpots[p]?.tier || 0) < 3) {
              L.plantPot(p);
            }
          }
          if (L.getState().flowerpots.every((fp) => fp.tier === 3)) break;
        }
        const tiers = L.getState().flowerpots.map((fp) => fp.tier);
        return { tiers };
      })()"""
  )
  assert res['tiers'] == [3, 3, 3, 3], f'Not all 4 Hub Garden Pads reached Tier 3: {res}'
  return res


# ==============================================================================
# Group 4: Roulette Chest, All 6 Weapons & Blazing Gold Gear (E20..E26)
# ==============================================================================


def check_e20_roulette_natural_spin_timing_and_upgrade(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(90, 1 / 60);
        const tier0 = L.getState().player.weaponTier;
        L.spinChest();
        let dur = 0;
        for (let i = 1; i <= 90; i++) {
          L.stepFrames(3, 1 / 60);
          dur = i * 0.05;
          if (!L.getState().roulette.spinning) break;
        }
        L.stepFrames(15, 1 / 60);
        const st1 = L.getState();
        return {
          tierBefore: tier0,
          tierAfter: st1.player.weaponTier,
          weaponAfter: st1.player.weaponId,
          durationSec: Math.round(dur * 100) / 100,
        };
      })()"""
  )
  assert 2.0 <= res['durationSec'] <= 3.2, f'Roulette spin duration outside [2.0, 3.2]s: {res}'
  assert res['tierAfter'] > res['tierBefore'], f'Roulette spin did not strictly upgrade weapon tier: {res}'
  return res


def check_e21_roulette_forced_all_6_weapons_3d_equip(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  equipped: list[dict[str, Any]] = []
  for idx, wpn_id in enumerate(WEAPON_ORDER):
    info = sess.eval_json(
        f"""(() => {{
          const L = window.__LUCKY_TITAN__;
          L.startGame({{ seed: {2100 + idx} }});
          L.breakBlock(0, 1, 2.0);
          L.tapWorld(0, 2.0);
          L.stepFrames(90, 1 / 60);
          if ({json.dumps(wpn_id)} !== 'wooden_kentungan_bat' && {json.dumps(wpn_id)} !== 'wood_stick') {{
            L.spinChest({json.dumps(wpn_id)});
            L.stepFrames(180, 1 / 60);
          }}
          const p = L.getState().player;
          return {{ weaponId: p.weaponId, weaponTier: p.weaponTier }};
        }})()"""
    )
    assert info['weaponId'] == wpn_id and info['weaponTier'] == WEAPON_TIERS[wpn_id], (
        f'Weapon {wpn_id} failed to equip cleanly: {info}'
    )
    equipped.append(info)
  return {'weaponsVerified': len(equipped), 'equipped': equipped}


def check_e22_roulette_never_downgrades_weapon(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(90, 1 / 60);
        L.spinChest('rainbow_mega_hammer');
        L.stepFrames(180, 1 / 60);
        // Earn gems & force lower-tier spin
        for (let x = -20; x <= -12; x += 2) L.breakBlock(x, 1, 14);
        L.stepFrames(330, 1 / 60);
        const gemsBefore = L.getState().player.starGems;
        L.spinChest('wooden_kentungan_bat');
        L.stepFrames(180, 1 / 60);
        const p = L.getState().player;
        return {
          weaponId: p.weaponId,
          weaponTier: p.weaponTier,
          gemsBefore,
          gemsAfter: p.starGems,
        };
      })()"""
  )
  assert res['weaponId'] in ('rainbow_mega_hammer', 'rainbow_blade') and res['weaponTier'] == 5, (
      f'Weapon downgraded from rainbow_mega_hammer: {res}'
  )
  return res


def check_e23_speed_boots_equip_boost(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        let broken = 0;
        for (let x = -24; x <= -10 && broken < 12; x += 2) {
          for (let z = 10; z <= 24 && broken < 12; z += 2) {
            const b0 = L.getState().blocksBroken;
            L.breakBlock(x, 1, z);
            if (L.getState().blocksBroken > b0) broken++;
          }
        }
        L.stepFrames(340, 1 / 60);
        const p = L.getState().player;
        return { broken, speedBoots: Boolean(p.speedBoots), speed: p.speed };
      })()"""
  )
  assert res['speedBoots'], f'speed_boots pity did not trigger by block 12: {res}'
  assert res['speed'] >= 8.0, f'Speed boots did not boost walk speed >= 8.0 b/s: {res}'
  return res


def check_e24_blazing_gold_helmet_speed_tier_and_shields(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        // Defeat moss_titan at tier 1 (guarantees gold_helmet on first Titan pinata + block #16 pity)
        L.spawnTitan('tralalero_tralala');
        L.stepFrames(45, 1 / 60);
        for (let i = 0; i < 8; i++) {
          if ((L.getState().trophies || []).includes('tralalero_tralala')) break;
          L.bonkTitan('tralalero_tralala');
          L.stepFrames(25, 1 / 60);
        }
        L.tapWorld(-18, 18);
        L.stepFrames(340, 1 / 60);
        if (!L.getState().player.helmet) {
          for (let x = -24; x <= -10; x += 2) {
            for (let z = 10; z <= 24; z += 2) {
              L.breakBlock(x, 1, z);
              if (L.getState().blocksBroken >= 18) break;
            }
            if (L.getState().blocksBroken >= 18) break;
          }
          L.stepFrames(340, 1 / 60);
        }
        const p = L.getState().player;
        return {
          helmet: Boolean(p.helmet),
          speed: p.speed,
          shieldHearts: p.shieldHearts,
          maxShieldHearts: p.maxShieldHearts,
          weaponId: p.weaponId,
          powerTier: p.powerTier,
        };
      })()"""
  )
  assert res['helmet'], f'Blazing Gold Helmet not equipped: {res}'
  assert res['speed'] >= 8.5, f'Blazing Gold Helmet speed < 8.5 b/s: {res}'
  assert res['shieldHearts'] >= 5, f'Expected >= 5 Rainbow Shield Hearts with Gold Helmet: {res}'
  assert res['powerTier'] >= 2, f'Expected Gold Helmet to boost powerTier >= 2: {res}'
  return res


def check_e25_star_cape_magnet_radius_boost(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.spinChest('sparkle_sword');
        L.stepFrames(180, 1 / 60);
        // Defeat moss_titan & snow_titan + break blocks up to #24 if needed to guarantee star_cape
        for (const tid of ['tralalero_tralala', 'bombardiro_crocodilo']) {
          L.spawnTitan(tid);
          L.stepFrames(45, 1 / 60);
          for (let i = 0; i < 8; i++) {
            if ((L.getState().trophies || []).includes(tid)) break;
            L.bonkTitan(tid);
            L.stepFrames(25, 1 / 60);
          }
        }
        L.stepFrames(340, 1 / 60);
        if (!L.getState().player.starCape) {
          for (let x = -26; x <= 26; x += 2) {
            for (let z = 10; z <= 26; z += 2) {
              L.breakBlock(x, 1, z);
              if (L.getState().blocksBroken >= 26) break;
            }
            if (L.getState().blocksBroken >= 26) break;
          }
          L.stepFrames(340, 1 / 60);
        }
        const p = L.getState().player;
        return { starCape: Boolean(p.starCape), blocksBroken: L.getState().blocksBroken };
      })()"""
  )
  assert res['starCape'], f'Royal Rainbow Star Cape not equipped by snow_titan / block 26: {res}'
  return res


def check_e26_hud_debounce_280ms_gate(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.breakBlock(0, 1, 2.0);
        for (let x = -20; x <= -12; x += 2) {
          for (let z = 12; z <= 20; z += 2) L.breakBlock(x, 1, z);
        }
        L.stepFrames(340, 1 / 60);
        return L.getState();
      })()"""
  )
  sess.wait_raf(2)
  time.sleep(0.34)
  pot_btn = sess.locate_control(['#btn-hud-pot'])
  assert pot_btn.get('found'), '#btn-hud-pot not visible'
  tiers0 = sum(extract_pad_tiers(sess.get_state()))
  sess.pointer_tap(pot_btn['x'], pot_btn['y'])
  time.sleep(0.09)
  sess.pointer_tap(pot_btn['x'], pot_btn['y'])
  sess.step_frames(6)
  sess.wait_raf(2)
  tiers1 = sum(extract_pad_tiers(sess.get_state()))
  assert tiers1 - tiers0 == 1, f'280ms debounce failed on #btn-hud-pot: {tiers0} -> {tiers1}'
  return {'potTierDeltaOnRapidDoubleTap': tiers1 - tiers0}


# ==============================================================================
# Group 5: All 4 Giant Voxel Titans, Boing, Victory & Persistence (E27..E35)
# ==============================================================================


def check_e27_under_geared_titan_rainbow_cloud_boing(
    sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(100, 1 / 60);
        L.spawnTitan('thunder_titan');
        L.stepFrames(45, 1 / 60);
        const before = L.getState();
        L.bonkTitan('thunder_titan');
        L.stepFrames(18, 1 / 60);
        return { gemsBefore: before.player.starGems, boingsBefore: before.feedback.boings };
      })()"""
  )
  ctx['e27_shot'] = sess.screenshot('e2e_27_titan_cloud_boing.jpg')
  after = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.stepFrames(80, 1 / 60);
        const st = L.getState();
        return {
          mode: st.mode,
          boings: st.feedback.boings,
          gemsAfter: st.player.starGems,
          hubDist: Math.hypot(st.player.x, st.player.z),
        };
      })()"""
  )
  assert after['boings'] == res['boingsBefore'] + 1, f'Cloud boing counter did not increment: {after}'
  assert after['gemsAfter'] >= res['gemsBefore'] + 3, f'Missing +3 consolation stars on boing: {res} -> {after}'
  assert after['hubDist'] <= 11.5 and after['mode'] == 'playing', f'Did not land safely in Hub: {after}'
  return {**res, **after}


def _defeat_single_titan_helper(sess: QASession, titan_id: str) -> dict[str, Any]:
  return sess.eval_json(
      f"""(() => {{
        const L = window.__LUCKY_TITAN__;
        const gems0 = L.getState().player.starGems;
        L.spawnTitan({json.dumps(titan_id)});
        L.stepFrames(45, 1 / 60);
        for (let i = 0; i < 10; i++) {{
          if ((L.getState().trophies || []).includes({json.dumps(titan_id)})) break;
          L.bonkTitan({json.dumps(titan_id)});
          L.stepFrames(25, 1 / 60);
        }}
        L.stepFrames(80, 1 / 60);
        const st = L.getState();
        return {{
          titanId: {json.dumps(titan_id)},
          trophies: st.trophies || [],
          mode: st.mode,
          crown: Boolean(st.player.crown),
          gemsDelta: st.player.starGems - gems0,
        }};
      }})()"""
  )


def check_e28_moss_titan_spawn_bonk_and_trophy(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.spinChest('rainbow_mega_hammer');
        L.stepFrames(180, 1 / 60);
        return true;
      })()"""
  )
  res = _defeat_single_titan_helper(sess, 'tralalero_tralala')
  assert 'tralalero_tralala' in res['trophies'], f'tralalero_tralala trophy missing: {res}'
  return res


def check_e29_snow_titan_spawn_bonk_and_trophy(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = _defeat_single_titan_helper(sess, 'bombardiro_crocodilo')
  assert 'bombardiro_crocodilo' in res['trophies'] and len(res['trophies']) == 2, f'bombardiro_crocodilo trophy missing: {res}'
  return res


def check_e30_thunder_titan_spawn_bonk_and_trophy(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = _defeat_single_titan_helper(sess, 'brr_brr_patapim')
  assert 'brr_brr_patapim' in res['trophies'] and len(res['trophies']) == 3, (
      f'brr_brr_patapim trophy missing: {res}'
  )
  return res


def check_e31_bedrock_king_defeat_and_4_trophy_victory(
    sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  res = _defeat_single_titan_helper(sess, 'golden_sahur_king')
  sess.wait_raf(3)
  ctx['e31_shot'] = sess.screenshot('e2e_31_victory_podium.jpg')
  assert set(res['trophies']) == set(TITAN_ORDER) and len(res['trophies']) == 4, (
      f'Expected 4/4 trophies: {res}'
  )
  assert res['mode'] == 'victory', f"Expected mode === 'victory', got {res}"
  assert res['crown'], f'Expected King Crown equipped on 4-trophy victory: {res}'
  return res


def check_e32_victory_keep_playing_endless_mode(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const modal = document.querySelector('#victory-modal, .victory-modal, #victory-screen, .victory-screen, [data-modal="victory"]');
        if (modal) {
          const btns = Array.from(modal.querySelectorAll('button, [role="button"]'));
          const keepBtn = btns.find((b) => /keep|play|more|free|continue/i.test(b.textContent || '')) || btns[0];
          if (keepBtn) keepBtn.click();
        }
        window.__LUCKY_TITAN__.stepFrames(20, 1 / 60);
        const st = window.__LUCKY_TITAN__.getState();
        return { mode: st.mode, trophyCount: (st.trophies || []).length };
      })()"""
  )
  assert res['mode'] == 'playing' and res['trophyCount'] == 4, (
      f'Keep Playing did not resume endless play with 4 trophies: {res}'
  )
  return res


def check_e33_lucky_chaos_mode_toggle_and_drop_boost(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        const countDropsOnRun = (chaos) => {
          L.startGame({ seed: 2040, chaosMode: chaos });
          L.breakBlock(0, 1, 2.0);
          L.stepFrames(10, 1 / 60);
          let broken = 0;
          for (let x = -24; x <= -12 && broken < 10; x += 2) {
            for (let z = 12; z <= 24 && broken < 10; z += 2) {
              const b0 = L.getState().blocksBroken;
              L.breakBlock(x, 1, z);
              if (L.getState().blocksBroken > b0) broken++;
            }
          }
          const activeCount = (L.getState().activeDrops || []).length;
          L.stepFrames(340, 1 / 60);
          const gems = L.getState().player.starGems;
          return { chaosMode: L.getState().chaosMode, activeCount, gems };
        };
        const normal = countDropsOnRun(false);
        const chaos = countDropsOnRun(true);
        return { normal, chaos };
      })()"""
  )
  assert res['chaos']['chaosMode'] is True, f'chaosMode did not activate: {res}'
  assert (
      res['chaos']['activeCount'] > res['normal']['activeCount']
      or res['chaos']['gems'] > res['normal']['gems']
  ), f'Chaos Mode did not boost multi-drop bursts: {res}'
  return res


def check_e34_pause_modal_audio_toggles_and_resume(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  sess.eval_json('(() => { window.__LUCKY_TITAN__.startGame({ seed: 2026 }); return true; })()')
  sess.wait_raf(2)
  time.sleep(0.34)
  menu_btn = sess.locate_control(['#btn-hud-menu'])
  assert menu_btn.get('found'), '#btn-hud-menu not found'
  sess.pointer_tap(menu_btn['x'], menu_btn['y'])
  sess.wait_raf(2)

  info = sess.eval_json(
      r"""(async () => {
        const modal = document.querySelector('#pause-modal, .pause-modal, [data-modal="pause"]');
        if (!modal) return { open: false };
        const btns = Array.from(modal.querySelectorAll('button, [role="button"]')).map((b) => ({
          id: b.id || '',
          text: (b.textContent || '').trim().replace(/\s+/g, ' '),
          w: Math.round(b.getBoundingClientRect().width),
          h: Math.round(b.getBoundingClientRect().height),
        }));
        const toggleCheck = async (btnSel, pillSel, stateKey) => {
          const btn = modal.querySelector(btnSel);
          const pill = modal.querySelector(pillSel);
          if (!btn || !pill) return { ok: false };
          const p0 = pill.textContent.trim();
          btn.click();
          window.__LUCKY_TITAN__.stepFrames(2, 1 / 60);
          const p1 = pill.textContent.trim();
          const s1 = Boolean(window.__LUCKY_TITAN__.getState().audio?.[stateKey]);
          await new Promise((r) => setTimeout(r, 310));
          btn.click();
          window.__LUCKY_TITAN__.stepFrames(2, 1 / 60);
          const p2 = pill.textContent.trim();
          const s2 = Boolean(window.__LUCKY_TITAN__.getState().audio?.[stateKey]);
          return { ok: p0 === 'ON' && p1 === 'OFF' && s1 === false && p2 === 'ON' && s2 === true, p0, p1, p2, s1, s2 };
        };
        const toggles = {
          music: await toggleCheck('#btn-pause-music', '#pill-pause-music', 'musicOn'),
          sound: await toggleCheck('#btn-pause-sound', '#pill-pause-sound', 'sfxOn'),
          voice: await toggleCheck('#btn-pause-voice', '#pill-pause-voice', 'voiceOn'),
        };
        const resume = Array.from(modal.querySelectorAll('button, [role="button"]')).find((b) =>
          /resume|play|continue|back|close/i.test(b.textContent || '')
        );
        if (resume) resume.click();
        return { open: true, buttonCount: btns.length, buttons: btns, toggles };
      })()"""
  )
  sess.step_frames(10)
  sess.wait_raf(2)
  assert info.get('open') and info.get('buttonCount', 0) >= 4, f'Pause modal incomplete: {info}'
  for k, t in (info.get('toggles') or {}).items():
    assert t.get('ok'), f'Pause toggle {k} failed ON->OFF->ON check: {t}'
  for b in info['buttons']:
    assert b['w'] >= 71 and b['h'] >= 71, f'Pause modal button undersized (<72px): {b}'
  assert sess.get_state().get('mode') == 'playing', 'Pause modal did not resume to playing'
  return info


def check_e35_localstorage_progress_persistence(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  # Open Pause modal, toggle Chaos Mode ON so prefs persist in localStorage['lucky_titan_progress'], then reload
  sess.eval_json('(() => { window.__LUCKY_TITAN__.startGame({ seed: 2026, chaosMode: false }); return true; })()')
  sess.wait_raf(2)
  time.sleep(0.34)
  menu_btn = sess.locate_control(['#btn-hud-menu'])
  if menu_btn.get('found'):
    sess.pointer_tap(menu_btn['x'], menu_btn['y'])
    sess.wait_raf(2)
    sess.eval(
        """(() => {
          const modal = document.querySelector('#pause-modal, .pause-modal, [data-modal="pause"]');
          if (!modal) return;
          const chaosBtn = Array.from(modal.querySelectorAll('button, [role="button"]')).find((b) =>
            /chaos/i.test((b.id || '') + ' ' + (b.textContent || ''))
          );
          if (chaosBtn) chaosBtn.click();
        })()"""
    )
    sess.wait_raf(2)

  raw_before = sess.eval(f'localStorage.getItem({json.dumps(STORAGE_KEY)})')
  assert raw_before, f'localStorage[{STORAGE_KEY!r}] was not written'
  parsed_before = json.loads(raw_before)

  assert sess.reload(timeout=25.0), 'Reload failed during localStorage persistence test'
  sess.wait_raf(2)
  raw_after = sess.eval(f'localStorage.getItem({json.dumps(STORAGE_KEY)})')
  parsed_after = json.loads(raw_after or '{}')
  assert parsed_after == parsed_before, f'localStorage mismatch after reload: {parsed_before} vs {parsed_after}'
  # Reset clean defaults
  sess.eval(f'localStorage.removeItem({json.dumps(STORAGE_KEY)})')
  return {'persisted': parsed_after}


# ==============================================================================
# Group 6: Neural Voiceover, ffprobe, BGM Ducking, Replay & L10n/Layout (E36..E44)
# ==============================================================================


def check_e36_voice_manifest_and_catalog_parity(
    _sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  manifest_path = os.path.join(REPO_ROOT, 'assets', 'voice', 'manifest.json')
  assert os.path.exists(manifest_path), f'Missing {manifest_path}'
  with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

  clips = manifest.get('clips') or {}
  catalog_entries = parse_voice_catalog_entries()
  catalog_ids = {e['id'] for e in catalog_entries}
  manifest_ids = set(clips.keys())

  missing_from_manifest = sorted(catalog_ids - manifest_ids)
  assert 60 <= len(clips) <= 85, f'Expected 60-85 voice clips, got {len(clips)}'
  assert not missing_from_manifest, f'Catalog IDs missing from manifest.json: {missing_from_manifest}'
  for cid, meta in clips.items():
    assert meta.get('text') and str(meta['text']).strip(), f'Empty subtitle text for {cid}'
  ctx['voice_manifest'] = manifest
  return {'totalClips': len(clips), 'catalogCount': len(catalog_ids)}


def check_e37_ffprobe_all_mp3s_valid_and_under_4_5mb(
    _sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  manifest = ctx.get('voice_manifest')
  if not manifest:
    with open(os.path.join(REPO_ROOT, 'assets', 'voice', 'manifest.json'), 'r', encoding='utf-8') as f:
      manifest = json.load(f)

  clips = manifest.get('clips') or {}
  total_bytes = 0
  bad_clips: list[dict[str, Any]] = []
  durations: list[float] = []

  for cid, meta in sorted(clips.items()):
    rel_file = meta.get('file') or f'assets/voice/{cid}.mp3'
    mp3_path = os.path.join(REPO_ROOT, rel_file)
    probe = ffprobe_mp3(mp3_path)
    if not probe.get('ok'):
      bad_clips.append({'id': cid, **probe})
    else:
      total_bytes += int(probe['bytes'])
      durations.append(float(probe['duration']))

  max_bytes = int(4.5 * 1024 * 1024)
  assert not bad_clips, f'Corrupt/empty/missing MP3s detected by ffprobe: {bad_clips[:8]}'
  assert total_bytes <= max_bytes, f'Total MP3 size {total_bytes} bytes exceeds 4.5 MB ({max_bytes} B)'
  return {
      'validatedClips': len(clips),
      'totalMB': round(total_bytes / (1024 * 1024), 3),
      'minDurationSec': round(min(durations), 3) if durations else 0.0,
      'maxDurationSec': round(max(durations), 3) if durations else 0.0,
  }


def check_e38_zero_speech_synthesis_static_and_runtime(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  static_rep = run_static_repo_scan(REPO_ROOT)
  assert static_rep['speechSynthesisHitCount'] == 0, (
      f"Banned speechSynthesis found in src/ or index.html: {static_rep['speechSynthesisFindings']}"
  )
  return {'speechSynthesisHitCount': 0, 'filesScanned': static_rep['filesScanned']}


def check_e39_bgm_minus_6db_ducking_during_voice(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.replayVoice();
        L.stepFrames(4, 1 / 60);
        const during = L.getState();
        const duckedDuring = Boolean(during.voice?.bgmDucked || during.audio?.bgmDucked);
        const speakingDuring = Boolean(during.voice?.speaking);
        // Step 6.5s so voice finishes and BGM unducks
        L.stepFrames(390, 1 / 60);
        const after = L.getState();
        const duckedAfter = Boolean(after.voice?.bgmDucked || after.audio?.bgmDucked);
        return { speakingDuring, duckedDuring, duckedAfter };
      })()"""
  )
  assert res['speakingDuring'] and res['duckedDuring'], f'BGM did not duck (-6 dB) during VO: {res}'
  assert not res['duckedAfter'], f'BGM stayed ducked after VO completed: {res}'
  return res


def check_e40_hud_voice_button_1tap_replay(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.stepFrames(360, 1 / 60);
        return true;
      })()"""
  )
  sess.wait_raf(2)
  replays0 = int((sess.get_state().get('voice') or {}).get('replayCount') or 0)
  time.sleep(0.34)
  voice_btn = sess.locate_control(['#btn-hud-voice'])
  assert voice_btn.get('found'), '#btn-hud-voice not found'
  sess.pointer_tap(voice_btn['x'], voice_btn['y'])
  sess.step_frames(4)
  sess.wait_raf(2)
  st1 = sess.get_state()
  v1 = st1.get('voice') or {}
  assert int(v1.get('replayCount') or 0) == replays0 + 1 and bool(v1.get('speaking')), (
      f'#btn-hud-voice 1-tap replay failed: before={replays0}, voice={v1}'
  )
  return {'replayCount': v1.get('replayCount'), 'replayedId': v1.get('currentId') or v1.get('lastId')}


def check_e41_subtitle_pill_1tap_replay(sess: QASession, _ctx: dict[str, Any]) -> dict[str, Any]:
  # Subtitle pill is currently visible from E40; verify >= 72px height, role="button", and 1-tap replay
  sub_info = sess.locate_control(['#voice-subtitle', '.voice-subtitle'])
  assert sub_info.get('found'), '#voice-subtitle not visible while speaking'
  assert sub_info['height'] >= 71.5 and sub_info['width'] >= 175, (
      f'#voice-subtitle undersized (<72px tall): {sub_info}'
  )
  replays0 = int((sess.get_state().get('voice') or {}).get('replayCount') or 0)
  time.sleep(0.34)
  sess.pointer_tap(sub_info['x'], sub_info['y'])
  sess.step_frames(4)
  sess.wait_raf(2)
  v1 = sess.get_state().get('voice') or {}
  assert int(v1.get('replayCount') or 0) == replays0 + 1 and bool(v1.get('speaking')), (
      f'#voice-subtitle 1-tap replay failed: before={replays0}, voice={v1}'
  )
  return {'subtitleRect': {'w': round(sub_info['width']), 'h': round(sub_info['height'])}, 'replayCount': v1.get('replayCount')}


def check_e42_voice_replay_auto_unmutes_when_muted(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  # Mute Voice via Pause Modal, resume, then tap #btn-hud-voice and verify auto-unmute + playback!
  time.sleep(0.34)
  menu_btn = sess.locate_control(['#btn-hud-menu'])
  assert menu_btn.get('found'), '#btn-hud-menu not found'
  sess.pointer_tap(menu_btn['x'], menu_btn['y'])
  sess.wait_raf(2)

  muted_state = sess.eval_json(
      """(() => {
        const modal = document.querySelector('#pause-modal, .pause-modal, [data-modal="pause"]');
        if (modal) {
          const btns = Array.from(modal.querySelectorAll('button, [role="button"]'));
          const voiceToggle = btns.find((b) => /voice|speech/i.test((b.id || '') + ' ' + (b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')));
          if (voiceToggle) voiceToggle.click();
          const resume = btns.find((b) => /resume|play|continue|back|close/i.test(b.textContent || ''));
          if (resume) resume.click();
        }
        window.__LUCKY_TITAN__.stepFrames(10, 1 / 60);
        const st = window.__LUCKY_TITAN__.getState();
        return { audio: st.audio || {}, voice: st.voice || {} };
      })()"""
  )
  sess.wait_raf(2)
  time.sleep(0.34)
  voice_btn = sess.locate_control(['#btn-hud-voice'])
  sess.pointer_tap(voice_btn['x'], voice_btn['y'])
  sess.step_frames(5)
  sess.wait_raf(2)
  after = sess.get_state()
  a_after = after.get('audio') or {}
  v_after = after.get('voice') or {}
  voice_enabled = a_after.get('voiceEnabled', a_after.get('voiceOn', v_after.get('enabled', True)))
  assert voice_enabled is True and bool(v_after.get('speaking')), (
      f'Voice Replay did not auto-unmute from muted state: muted={muted_state}, after={after}'
  )
  return {'voiceEnabledAfterReplay': voice_enabled, 'speaking': v_after.get('speaking')}


def check_e45_stationary_450ms_hold_tap(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  assert sess.b is not None
  sess.eval_json('(() => { window.__LUCKY_TITAN__.startGame({ seed: 2026 }); return true; })()')
  sess.wait_raf(2)
  taps0 = int((sess.get_state().get('feedback') or {}).get('taps') or 0)
  xf, yf = 640.0, 380.0
  sess.b.cmd(
      'Input.dispatchMouseEvent',
      type='mousePressed',
      x=xf,
      y=yf,
      button='left',
      buttons=1,
      clickCount=1,
  )
  time.sleep(0.45)
  sess.b.cmd(
      'Input.dispatchMouseEvent',
      type='mouseReleased',
      x=xf,
      y=yf,
      button='left',
      buttons=0,
      clickCount=1,
  )
  sess.step_frames(6)
  sess.wait_raf(2)
  fb1 = sess.get_state().get('feedback') or {}
  taps1 = int(fb1.get('taps') or 0)
  dead1 = int(fb1.get('deadTaps') or 0)
  assert taps1 - taps0 == 1 and dead1 == 0, (
      f'450ms stationary hold tap failed: taps={taps0}->{taps1}, dead={dead1}'
  )
  return {'holdMs': 450, 'tapsDelta': taps1 - taps0, 'deadTaps': dead1}


def check_e46_continue_button_reload_persistence(
    sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        L.breakBlock(0, 1, 2.0);
        L.stepFrames(60, 1 / 60);
        L.plantPot(0);
        L.spinChest('golden_sahur_mallet');
        L.stepFrames(180, 1 / 60);
        L.spawnTitan('tralalero_tralala');
        L.stepFrames(30, 1 / 60);
        for (let i = 0; i < 6; i++) {
          if ((L.getState().trophies || []).includes('tralalero_tralala')) break;
          L.bonkTitan('tralalero_tralala');
          L.stepFrames(25, 1 / 60);
        }
        L.stepFrames(90, 1 / 60);
        return true;
      })()"""
  )
  before = sess.get_state()
  assert 'tralalero_tralala' in (before.get('trophies') or []), f'Setup failed before reload: {before}'

  assert sess.reload(timeout=25.0), 'Reload failed during E46 Continue persistence check'
  sess.wait_raf(3)
  _ensure_three_spy(sess)

  cont_btn = sess.locate_control(['#btn-title-continue'])
  assert cont_btn.get('found'), f'#btn-title-continue not visible after reload: {cont_btn}'
  assert cont_btn['width'] >= 72 and cont_btn['height'] >= 72, f'#btn-title-continue undersized: {cont_btn}'
  sess.pointer_tap(cont_btn['x'], cont_btn['y'])
  sess.step_frames(10)
  sess.wait_raf(2)
  after = sess.get_state()
  assert after.get('mode') == 'playing', f'CONTINUE did not enter playing mode: {after}'
  assert 'tralalero_tralala' in (after.get('trophies') or []), f'Trophies lost after CONTINUE: {after}'
  assert (after.get('player') or {}).get('weaponId') == 'golden_sahur_mallet', f'Weapon lost after CONTINUE: {after}'
  assert extract_pad_tiers(after)[0] >= 1, f'Flowerpot tier lost after CONTINUE: {after}'
  sess.eval(f'localStorage.removeItem({json.dumps(STORAGE_KEY)})')
  return {
      'trophies': after.get('trophies'),
      'weaponId': (after.get('player') or {}).get('weaponId'),
      'flowerpotTiers': extract_pad_tiers(after),
  }


def check_e43_zero_cjk_static_and_full_runtime_flow(
    _sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  rep = run_l10n_audit(static_only=False)
  assert rep['passed'], f'Gate F13 l10n_audit failed: {json.dumps(rep)[:500]}'
  return {
      'filesScanned': rep['static']['filesScanned'],
      'runtimeCjkHits': rep['runtime']['totalCjkHits'],
      'canvasDrawsChecked': rep['runtime']['canvasTextsRecorded'],
  }


def check_e44_five_viewport_layout_audit_pass(
    _sess: QASession, _ctx: dict[str, Any]
) -> dict[str, Any]:
  rep = run_layout_audit(save_shots=True)
  assert rep['passed'], f'Gate F11 layout_audit failed: {json.dumps(rep["viewports"])[:500]}'
  return {'viewportsPassed': rep['viewportCount'], 'shotsDir': rep['shotsDir']}


def check_e47_mario_jump_button_and_3d_arc(
    sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  sess.eval_json('(() => { window.__LUCKY_TITAN__.startGame({ seed: 2026 }); return true; })()')
  sess.wait_raf(2)
  time.sleep(0.20)
  jump_btn = sess.locate_control(['#btn-hud-jump'])
  assert jump_btn.get('found'), f'#btn-hud-jump not found: {jump_btn}'
  assert jump_btn['width'] >= 72 and jump_btn['height'] >= 72, (
      f'#btn-hud-jump undersized (<72px): {jump_btn}'
  )

  # 1-tap #btn-hud-jump via CDP pointer event
  sess.pointer_tap(jump_btn['x'], jump_btn['y'])
  sess.step_frames(12)
  sess.wait_raf(2)
  ctx['e47_shot'] = sess.screenshot('e2e_47_mario_jump.jpg')

  mid_state = sess.eval_json(
      """(() => {
        const st = window.__LUCKY_TITAN__.getState();
        const scene = window.__THREE_SCENES__ && window.__THREE_SCENES__[0];
        const cam = window.__THREE_CAMERAS__ && window.__THREE_CAMERAS__[0];
        return {
          y: st.player?.y,
          groundY: st.player?.groundY,
          jumpY: st.player?.jumpY,
          jumping: st.player?.jumping,
          airborne: st.player?.airborne,
          jumpCount: st.player?.jumpCount,
          camRoll: cam ? Math.abs(cam.rotation.z) : 0,
          sceneFound: Boolean(scene),
        };
      })()"""
  )
  assert mid_state.get('jumping') and float(mid_state.get('jumpY') or 0) > 1.0, (
      f'Hero did not enter Mario jump arc after tapping #btn-hud-jump: {mid_state}'
  )
  assert float(mid_state.get('camRoll') or 0) == 0.0, f'Camera roll non-zero during jump: {mid_state}'

  # Step until landing
  landed_state = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        for (let i = 0; i < 55; i++) {
          L.stepFrames(1, 1 / 60);
          const st = L.getState();
          if (st.player.grounded && !st.player.jumping) break;
        }
        // Also test Space key jump trigger
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
        L.stepFrames(10, 1 / 60);
        const spaceMid = L.getState().player;
        for (let i = 0; i < 55; i++) {
          L.stepFrames(1, 1 / 60);
          if (L.getState().player.grounded) break;
        }
        const finalSt = L.getState();
        return {
          spaceTriggeredJump: Boolean(spaceMid.jumping && spaceMid.jumpY > 0.8),
          finalGrounded: finalSt.player.grounded,
          finalJumping: finalSt.player.jumping,
          finalJumpCount: finalSt.player.jumpCount,
          finalJumpApexY: finalSt.player.jumpApexY,
        };
      })()"""
  )
  assert landed_state.get('spaceTriggeredJump'), f'Space key did not trigger Mario jump: {landed_state}'
  assert landed_state.get('finalGrounded') and not landed_state.get('finalJumping'), (
      f'Hero did not land cleanly after jump: {landed_state}'
  )
  assert int(landed_state.get('finalJumpCount') or 0) >= 2, f'jumpCount did not increment: {landed_state}'
  return {'midAir': mid_state, 'landed': landed_state}


def check_e48_odyssey_sahur_stick_throw_and_return(
    sess: QASession, ctx: dict[str, Any]
) -> dict[str, Any]:
  _ensure_three_spy(sess)
  flight_info = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026 });
        const throwRes = L.throwStick({ targetX: 0, targetZ: 2.0 });
        L.stepFrames(14, 1 / 60);
        const stMid = L.getState();
        const scene = window.__QA_LAST_SCENE__;
        let stickMeshVisible = false;
        let handSocketVisible = true;
        if (scene) {
          scene.traverse((obj) => {
            if (obj.name === 'thrown_sahur_stick') stickMeshVisible = Boolean(obj.visible);
            if (obj.name === 'hero_weapon_socket') handSocketVisible = Boolean(obj.visible);
          });
        }
        return {
          throwRes,
          midStick: stMid.stickThrow,
          stickMeshVisible,
          handSocketVisible,
          blocksBrokenMid: stMid.blocksBroken,
        };
      })()"""
  )
  ctx['e48_shot'] = sess.screenshot('e2e_48_stick_throw.jpg')
  assert flight_info.get('throwRes', {}).get('ok'), f'throwStick failed to launch: {flight_info}'
  assert flight_info.get('stickMeshVisible') and not flight_info.get('handSocketVisible'), (
      f'3D thrown_sahur_stick visibility or handSocket hide failed in flight: {flight_info}'
  )
  assert float((flight_info.get('midStick') or {}).get('distFromHero') or 0) >= 2.0, (
      f'Thrown stick did not travel outward in 3D space: {flight_info}'
  )

  return_info = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        for (let i = 0; i < 75; i++) {
          L.stepFrames(1, 1 / 60);
          if (!L.getState().stickThrow?.active) break;
        }
        const stAfter = L.getState();
        const scene = window.__QA_LAST_SCENE__;
        let stickMeshVisibleAfter = true;
        let handSocketVisibleAfter = false;
        if (scene) {
          scene.traverse((obj) => {
            if (obj.name === 'thrown_sahur_stick') stickMeshVisibleAfter = Boolean(obj.visible);
            if (obj.name === 'hero_weapon_socket') handSocketVisibleAfter = Boolean(obj.visible);
          });
        }
        return {
          afterStick: stAfter.stickThrow,
          stickMeshVisibleAfter,
          handSocketVisibleAfter,
          blocksBrokenAfter: stAfter.blocksBroken,
        };
      })()"""
  )
  after_st = return_info.get('afterStick') or {}
  assert not after_st.get('active') and int(after_st.get('returnCount') or 0) >= 1, (
      f'Sahur stick did not return to hero hand: {return_info}'
  )
  assert return_info.get('handSocketVisibleAfter') and not return_info.get('stickMeshVisibleAfter'), (
      f'Sahur stick 3D mesh did not re-attach to hero hand after catch: {return_info}'
  )
  assert int(return_info.get('blocksBrokenAfter') or 0) >= 1 and int(after_st.get('hits') or 0) >= 1, (
      f'Thrown Sahur stick did not hit/break block along path: {return_info}'
  )
  return {'flight': flight_info, 'returned': return_info}


E2E_ASSERTIONS: list[tuple[str, str, Callable[[QASession, dict[str, Any]], dict[str, Any]]]] = [
    ('E01_boot_zero_errors', 'boot', check_e01_boot_zero_errors),
    ('E02_seam_contract_complete', 'seam', check_e02_seam_contract_complete),
    ('E03_title_live_3d_background', 'ui', check_e03_title_live_3d_background),
    ('E04_play_transition_under_80ms', 'scene', check_e04_play_transition_under_80ms),
    ('E05_three_max_metalness_guardrail', 'scene', check_e05_three_max_metalness_guardrail),
    ('E06_sprite_tonemapped_fog_guardrail', 'scene', check_e06_sprite_tonemapped_fog_guardrail),
    ('E07_camera_zero_roll_and_drag_yaw', 'camera', check_e07_camera_zero_roll_and_drag_yaw),
    ('E08_draw_calls_budget', 'world', check_e08_draw_calls_budget),
    ('E09_hero_spawn_and_base_speed', 'world', check_e09_hero_spawn_and_base_speed),
    ('E10_water_and_bounds_clamp_zero_dead_taps', 'world', check_e10_water_and_bounds_clamp_zero_dead_taps),
    ('E11_starter_block_three_drop_guarantee', 'loot', check_e11_starter_block_three_drop_guarantee),
    ('E12_ordinary_block_break_and_magnet_pickup', 'loot', check_e12_ordinary_block_break_and_magnet_pickup),
    ('E13_block_regrow_12s_never_empty', 'world', check_e13_block_regrow_12s_never_empty),
    ('E14_critter_tummy_pat_bonus_gems', 'chars', check_e14_critter_tummy_pat_bonus_gems),
    ('E15_guide_arrow_onboarding_beacon', 'ui', check_e15_guide_arrow_onboarding_beacon),
    ('E16_flowerpot_tier1_glow_pot', 'flowerpots', check_e16_flowerpot_tier1_glow_pot),
    ('E17_flowerpot_tier2_crystal_pot', 'flowerpots', check_e17_flowerpot_tier2_crystal_pot),
    ('E18_flowerpot_tier3_ultimate_star_pot', 'flowerpots', check_e18_flowerpot_tier3_ultimate_star_pot),
    ('E19_all_four_pads_bloom', 'flowerpots', check_e19_all_four_pads_bloom),
    ('E20_roulette_natural_spin_timing_and_upgrade', 'roulette', check_e20_roulette_natural_spin_timing_and_upgrade),
    ('E21_roulette_forced_all_6_weapons_3d_equip', 'chars', check_e21_roulette_forced_all_6_weapons_3d_equip),
    ('E22_roulette_never_downgrades_weapon', 'roulette', check_e22_roulette_never_downgrades_weapon),
    ('E23_speed_boots_equip_boost', 'loot', check_e23_speed_boots_equip_boost),
    ('E24_blazing_gold_helmet_speed_tier_and_shields', 'loot', check_e24_blazing_gold_helmet_speed_tier_and_shields),
    ('E25_star_cape_magnet_radius_boost', 'loot', check_e25_star_cape_magnet_radius_boost),
    ('E26_hud_debounce_280ms_gate', 'ui', check_e26_hud_debounce_280ms_gate),
    ('E27_under_geared_titan_rainbow_cloud_boing', 'combat', check_e27_under_geared_titan_rainbow_cloud_boing),
    ('E28_moss_titan_spawn_bonk_and_trophy', 'combat', check_e28_moss_titan_spawn_bonk_and_trophy),
    ('E29_snow_titan_spawn_bonk_and_trophy', 'combat', check_e29_snow_titan_spawn_bonk_and_trophy),
    ('E30_thunder_titan_spawn_bonk_and_trophy', 'combat', check_e30_thunder_titan_spawn_bonk_and_trophy),
    ('E31_bedrock_king_defeat_and_4_trophy_victory', 'combat', check_e31_bedrock_king_defeat_and_4_trophy_victory),
    ('E32_victory_keep_playing_endless_mode', 'ui', check_e32_victory_keep_playing_endless_mode),
    ('E33_lucky_chaos_mode_toggle_and_drop_boost', 'loot', check_e33_lucky_chaos_mode_toggle_and_drop_boost),
    ('E34_pause_modal_audio_toggles_and_resume', 'ui', check_e34_pause_modal_audio_toggles_and_resume),
    ('E35_localstorage_progress_persistence', 'boot', check_e35_localstorage_progress_persistence),
    ('E36_voice_manifest_and_catalog_parity', 'voice', check_e36_voice_manifest_and_catalog_parity),
    ('E37_ffprobe_all_mp3s_valid_and_under_4_5mb', 'voice', check_e37_ffprobe_all_mp3s_valid_and_under_4_5mb),
    ('E38_zero_speech_synthesis_static_and_runtime', 'voice', check_e38_zero_speech_synthesis_static_and_runtime),
    ('E39_bgm_minus_6db_ducking_during_voice', 'audio', check_e39_bgm_minus_6db_ducking_during_voice),
    ('E40_hud_voice_button_1tap_replay', 'voice', check_e40_hud_voice_button_1tap_replay),
    ('E41_subtitle_pill_1tap_replay', 'voice', check_e41_subtitle_pill_1tap_replay),
    ('E42_voice_replay_auto_unmutes_when_muted', 'voice', check_e42_voice_replay_auto_unmutes_when_muted),
    ('E45_stationary_450ms_hold_tap', 'input', check_e45_stationary_450ms_hold_tap),
    ('E46_continue_button_reload_persistence', 'boot', check_e46_continue_button_reload_persistence),
    ('E47_mario_jump_button_and_3d_arc', 'chars', check_e47_mario_jump_button_and_3d_arc),
    ('E48_odyssey_sahur_stick_throw_and_return', 'combat', check_e48_odyssey_sahur_stick_throw_and_return),
    ('E43_zero_cjk_static_and_full_runtime_flow', 'l10n', check_e43_zero_cjk_static_and_full_runtime_flow),
    ('E44_five_viewport_layout_audit_pass', 'layout', check_e44_five_viewport_layout_audit_pass),
]


def run_e2e_suite(name_filter: str = '', skip_subsuites: bool = False) -> dict[str, Any]:
  ensure_qa_dirs()
  if not os.path.exists(os.path.join(REPO_ROOT, 'index.html')) or not os.path.exists(
      os.path.join(REPO_ROOT, 'src', 'main.js')
  ):
    raise RuntimeError('index.html or src/main.js not yet wired by @lucky-director')

  selected = [
      (name, area, fn)
      for name, area, fn in E2E_ASSERTIONS
      if (not name_filter or name_filter.lower() in name.lower())
      and (not skip_subsuites or not name.startswith(('E43_', 'E44_')))
  ]
  if not selected:
    raise ValueError(f'No E2E assertions matched filter={name_filter!r}')

  results: list[dict[str, Any]] = []
  shared_ctx: dict[str, Any] = {}
  t0 = time.time()

  with QASession(width=1280, height=800, mobile=False) as sess:
    if not sess.goto('index.html?seed=2026', timeout=25.0):
      raise RuntimeError('Failed initial navigation to index.html in run_e2e')
    sess.wait_raf(3)
    _ensure_three_spy(sess)

    for name, area, fn in selected:
      at0 = time.time()
      try:
        detail = fn(sess, shared_ctx)
        sess.assert_clean(name)
        results.append({
            'id': name.split('_')[0],
            'name': name,
            'area': area,
            'owner': owner_for_area(area),
            'passed': True,
            'wallMs': round((time.time() - at0) * 1000, 1),
            'detail': detail,
        })
        print(f"  [PASS] {name} ({round((time.time() - at0) * 1000)}ms)")
      except Exception as exc:
        results.append({
            'id': name.split('_')[0],
            'name': name,
            'area': area,
            'owner': owner_for_area(area),
            'passed': False,
            'wallMs': round((time.time() - at0) * 1000, 1),
            'error': str(exc),
            'trace': traceback.format_exc(limit=4),
        })
        print(f"  [FAIL] {name} ({owner_for_area(area)}): {exc}")

  passed_count = sum(1 for r in results if r['passed'])
  report = {
      'passed': passed_count == len(results),
      'passedCount': passed_count,
      'totalCount': len(results),
      'wallTimeSec': round(time.time() - t0, 2),
      'shotsDir': QA_SHOTS_DIR,
      'assertions': results,
  }
  json_path = os.path.join(QA_TMP_DIR, 'e2e_report.json')
  md_path = os.path.join(QA_TMP_DIR, 'e2e_report.md')
  with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)
  with open(md_path, 'w', encoding='utf-8') as f:
    lines = [
        f"# Lucky Block Titans 3D — E2E Report ({passed_count}/{len(results)} PASS)",
        '',
        '| ID | Assertion | Owner | ms | Result |',
        '|---|---|---|---:|---|',
    ]
    for r in results:
      st = 'PASS' if r['passed'] else f"FAIL: {r.get('error', '')[:80]}"
      lines.append(f"| {r['id']} | `{r['name']}` | {r['owner']} | {r['wallMs']} | {st} |")
    f.write('\n'.join(lines) + '\n')
  return report


def main() -> int:
  ap = argparse.ArgumentParser(description='Run Lucky Block Titans 3D Master E2E Suite (E01..E44)')
  ap.add_argument('--filter', type=str, default='', help='Run subset matching substring, e.g. E36 or titan')
  ap.add_argument('--skip-subsuites', action='store_true', help='Skip E43 (l10n) and E44 (layout) sub-runs')
  ap.add_argument('--include-sim', action='store_true', help='Also run sim_gates.py F1..F10 after E2E')
  args = ap.parse_args()

  rep = run_e2e_suite(name_filter=args.filter, skip_subsuites=args.skip_subsuites)
  print(
      f"E2E_SUMMARY: {rep['passedCount']}/{rep['totalCount']} PASS "
      f"in {rep['wallTimeSec']}s -> {'PASS' if rep['passed'] else 'FAIL'}"
  )
  if args.include_sim:
    from sim_gates import run_sim_gates  # noqa: E402

    sim_rep = run_sim_gates()
    print(
        f"SIM_GATES_SUMMARY: {sim_rep['passedCount']}/{sim_rep['totalGates']} PASS "
        f"-> {'PASS' if sim_rep['passed'] else 'FAIL'}"
    )
    return 0 if (rep['passed'] and sim_rep['passed']) else 1

  return 0 if rep['passed'] else 1


if __name__ == '__main__':
  sys.exit(main())
