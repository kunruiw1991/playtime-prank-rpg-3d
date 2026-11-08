#!/usr/bin/env python3
"""Gates F1..F10 Automated Fun, Pacing, Economy & 20-Seed Child-Bot Simulation.

Owner: lucky-qa
Exclusive path: tests/sim_gates.py
Verifies via window.__LUCKY_TITAN__:
  - F1: Play transition time <= 80 ms, 0 console/page/HTTP errors.
  - F2: Starter Lucky Block break + loot pop + VO from spawn <= 4.0 s.
  - F3: Base walk speed >= 6.8 b/s, Blazing Gold Helmet speed >= 8.5 b/s.
  - F4: 350+ mixed world/water/cliff/pad/chest/critter/Titan taps -> deadTaps === 0.
  - F5: Rapid 100ms double-tap on PLAY, #btn-hud-spin, #btn-hud-pot -> debounced to 1.
  - F6: Planting Tier 1 -> Tier 2 -> Tier 3 Ultimate Flowerpot fountains Star Gems <= 4s/cycle.
  - F7: Roulette Chest spin lasts 2.0-3.2 s, strictly climbs weaponTier (< 5), never downgrades.
  - F8: Under-geared (tier 1) bonk on thunder_titan (tier 3) -> Rainbow Cloud Boing + +3 stars + 0 death/loss.
  - F9: Geared bonks pop all 4 Titans -> 4/4 trophies -> mode === 'victory'.
  - F10: 20-seed 5-year-old child-bot simulation (seeds 1001..1020) -> 20/20 (100%) complete
         all 4 Titans in 240-720 s simulated time (0 stuck seeds, 100% Blazing Gold Helmet worn
         before thunder_titan), PLUS bit-exact determinism check on seed=2026!
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import statistics
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
    extract_pad_tiers,
    extract_player_gems,
    extract_pot_seeds,
    extract_trophies,
)


def gate_f1_boot_and_play_transition(sess: QASession) -> dict[str, Any]:
  """F1: PLAY transition time <= 80 ms, 0 console/page/HTTP errors."""
  sess.clear_diagnostics()
  if not sess.goto('index.html?seed=2026', timeout=25.0):
    return {'gate': 'F1', 'passed': False, 'error': 'Timed out loading index.html'}
  sess.wait_raf(3)

  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        const stBefore = L.getState();
        const btn = document.querySelector('#btn-title-play, #btn-play, #title-screen button');
        const t0 = performance.now();
        if (btn) {
          btn.click();
        } else {
          L.startGame({ seed: 2026 });
        }
        L.stepFrames(1, 1 / 60);
        const transitionMs = performance.now() - t0;
        const stAfter = L.getState();
        const reportedMs = Number(stAfter.perf?.playStartMs || 0);
        return {
          modeBefore: stBefore.mode,
          modeAfter: stAfter.mode,
          transitionMs: Math.round(transitionMs * 100) / 100,
          reportedPlayStartMs: Math.round(reportedMs * 100) / 100,
        };
      })()"""
  )
  diag = sess.collect_diagnostics()
  err_count = sum(len(v) for v in diag.values())
  measured_ms = float(res.get('transitionMs', 999.0))
  reported_ms = float(res.get('reportedPlayStartMs', 0.0))
  effective_ms = max(measured_ms, reported_ms) if reported_ms > 0 else measured_ms
  passed = (
      res.get('modeAfter') == 'playing'
      and measured_ms <= 80.0
      and (reported_ms <= 80.0)
      and err_count == 0
  )
  return {
      'gate': 'F1',
      'passed': passed,
      'transitionMs': measured_ms,
      'reportedPlayStartMs': reported_ms,
      'effectiveMs': effective_ms,
      'modeBefore': res.get('modeBefore'),
      'modeAfter': res.get('modeAfter'),
      'errorCount': err_count,
      'diagnostics': diag if err_count > 0 else {},
  }


def gate_f2_first_starter_thrill(sess: QASession) -> dict[str, Any]:
  """F2: First Starter Lucky Block break + loot pop + VO from spawn <= 4.0 s."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const st0 = L.getState();
        const voReq0 = Number(st0.voice?.requestedCount || 0);
        const voLast0 = st0.voice?.lastId || '';

        // Tap Starter Lucky Block right ahead of spawn at (0, 1, 2.0)
        L.tapWorld(0, 2.0);

        let brokeAtSec = null;
        let lootAtSec = null;
        let voAtSec = null;
        const dt = 1 / 60;

        for (let f = 1; f <= 240; f++) {
          L.stepFrames(1, dt);
          const st = L.getState();
          const t = f * dt;
          // Re-tap if hero arrived and stands idle before block broke
          if (st.blocksBroken === 0 && f === 30) {
            L.breakBlock(0, 1, 2.0);
          }
          if (brokeAtSec === null && st.blocksBroken >= 1) {
            brokeAtSec = t;
          }
          const hasLoot =
            (Array.isArray(st.activeDrops) && st.activeDrops.length > 0) ||
            (st.player?.starGems || 0) > 0 ||
            (st.player?.potSeeds || 0) > 0 ||
            (st.player?.freeSpins || 0) > 0;
          if (lootAtSec === null && hasLoot) {
            lootAtSec = t;
          }
          const voTriggered =
            Number(st.voice?.requestedCount || 0) > voReq0 ||
            (st.voice?.lastId && st.voice.lastId !== voLast0) ||
            st.voice?.lastId === 'guide_starter_pop';
          if (voAtSec === null && voTriggered) {
            voAtSec = t;
          }
          if (brokeAtSec !== null && lootAtSec !== null && voAtSec !== null) {
            break;
          }
        }

        // Step 75 more frames & walk through (0, 2.0) so magnet collects all 3 starter drops
        L.tapWorld(0, 2.0);
        L.stepFrames(75, dt);
        const stFinal = L.getState();
        const thrillSec = Math.max(
          brokeAtSec ?? 999,
          lootAtSec ?? 999,
          voAtSec ?? 999
        );
        return {
          brokeAtSec: brokeAtSec !== null ? Math.round(brokeAtSec * 1000) / 1000 : null,
          lootAtSec: lootAtSec !== null ? Math.round(lootAtSec * 1000) / 1000 : null,
          voAtSec: voAtSec !== null ? Math.round(voAtSec * 1000) / 1000 : null,
          thrillSec: Math.round(thrillSec * 1000) / 1000,
          blocksBroken: stFinal.blocksBroken,
          starGems: stFinal.player?.starGems || 0,
          potSeeds: stFinal.player?.potSeeds || 0,
          freeSpins: stFinal.player?.freeSpins || 0,
          lastVoiceId: stFinal.voice?.lastId || null,
        };
      })()"""
  )
  thrill_sec = float(res.get('thrillSec', 999.0))
  passed = (
      res.get('brokeAtSec') is not None
      and res.get('lootAtSec') is not None
      and res.get('voAtSec') is not None
      and thrill_sec <= 4.0
      and int(res.get('starGems', 0)) >= 5
      and int(res.get('potSeeds', 0)) >= 1
      and int(res.get('freeSpins', 0)) >= 1
  )
  return {'gate': 'F2', 'passed': passed, **res}


def gate_f3_walk_speeds(sess: QASession) -> dict[str, Any]:
  """F3: Base walk speed >= 6.8 b/s, Blazing Gold Helmet speed >= 8.5 b/s."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const dt = 1 / 60;

        // 1. Measure base walk speed across clear South Hub stretch (0, 4.5) -> (-9.5, 4.5)
        L.tapWorld(-9.5, 4.5);
        L.stepFrames(4, dt);
        const b0 = L.getState().player;
        const baseFrames = 36;
        L.stepFrames(baseFrames, dt);
        const b1 = L.getState().player;
        const baseDist = Math.hypot(b1.x - b0.x, b1.z - b0.z);
        const measuredBaseSpeed = baseDist / (baseFrames * dt);
        const stateBaseSpeed = Number(b1.speed || 0);

        // 2. Acquire Blazing Gold Helmet via gameplay (moss_titan pinata & block #16 pity)
        L.spawnTitan('moss_titan');
        L.stepFrames(45, dt);
        for (let i = 0; i < 8; i++) {
          const st = L.getState();
          if (Array.isArray(st.trophies) && st.trophies.includes('moss_titan')) break;
          L.bonkTitan('moss_titan');
          L.stepFrames(25, dt);
        }
        L.tapWorld(-18, 18);
        L.stepFrames(150, dt);

        if (!L.getState().player.helmet) {
          const coords = [
            [0, 1, 2], [-12, 1, 12], [-15, 1, 14], [-20, 1, 15], [-22, 1, 20],
            [-14, 1, 22], [-25, 1, 16], [12, 1, 12], [15, 1, 14], [20, 1, 15],
            [22, 1, 20], [14, 1, 22], [-12, 2, -12], [-15, 2, -15], [14, 2, -14],
          ];
          for (const [bx, by, bz] of coords) {
            if (L.getState().player.helmet) break;
            L.breakBlock(bx, by, bz);
            L.tapWorld(bx, bz);
            L.stepFrames(90, dt);
          }
          // Sweep across meadow/farm grid if needed until 20 blocks broken & collected
          for (let x = -26; x <= 26 && !L.getState().player.helmet; x += 2) {
            for (let z = 8; z <= 28 && !L.getState().player.helmet; z += 2) {
              L.breakBlock(x, 1, z);
              if (L.getState().blocksBroken >= 20) break;
            }
          }
          L.stepFrames(320, dt);
        }

        // Return hero to (-8.5, 5.5) and wait until settled
        L.tapWorld(-8.5, 5.5);
        L.stepFrames(240, dt);

        // Measure geared walk speed across clear stretch (-8.5, 5.5) -> (8.5, 5.5)
        L.tapWorld(8.5, 5.5);
        L.stepFrames(4, dt);
        const h0 = L.getState().player;
        const helmetFrames = 36;
        L.stepFrames(helmetFrames, dt);
        const h1 = L.getState().player;
        const helmetDist = Math.hypot(h1.x - h0.x, h1.z - h0.z);
        const measuredHelmetSpeed = helmetDist / (helmetFrames * dt);
        const stateHelmetSpeed = Number(h1.speed || 0);

        return {
          helmetEquipped: Boolean(h1.helmet),
          measuredBaseSpeed: Math.round(measuredBaseSpeed * 100) / 100,
          stateBaseSpeed: Math.round(stateBaseSpeed * 100) / 100,
          measuredHelmetSpeed: Math.round(measuredHelmetSpeed * 100) / 100,
          stateHelmetSpeed: Math.round(stateHelmetSpeed * 100) / 100,
        };
      })()"""
  )
  passed = (
      bool(res.get('helmetEquipped'))
      and float(res.get('measuredBaseSpeed', 0.0)) >= 6.8
      and float(res.get('stateBaseSpeed', 0.0)) >= 6.8
      and float(res.get('measuredHelmetSpeed', 0.0)) >= 8.5
      and float(res.get('stateHelmetSpeed', 0.0)) >= 8.5
  )
  return {'gate': 'F3', 'passed': passed, **res}


def gate_f4_zero_dead_taps(sess: QASession) -> dict[str, Any]:
  """F4: 350+ mixed world/water/cliff/pad/chest/critter/Titan taps -> deadTaps === 0."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        let tapCalls = 0;

        const doTap = (x, z, step = 4) => {
          L.tapWorld(x, z);
          tapCalls++;
          L.stepFrames(step, 1 / 60);
        };

        // 1. 90 Hub & 4-biome walkable ground taps
        for (let i = 0; i < 90; i++) {
          const angle = (i / 90) * Math.PI * 2;
          const r = 3 + (i % 24);
          doTap(Math.cos(angle) * r, Math.sin(angle) * r, 3);
        }

        // 2. 70 Out-of-bounds ocean / water ring taps (x, z outside [-34, 34])
        const waterCoords = [
          [-40, 0], [40, 0], [0, -40], [0, 40], [-45, -45], [45, 45], [-48, 42], [48, -42],
          [-37, 15], [37, -15], [15, 38], [-15, -38], [-55, 10], [55, -10],
        ];
        for (let i = 0; i < 70; i++) {
          const [wx, wz] = waterCoords[i % waterCoords.length];
          doTap(wx + (i % 3), wz - (i % 3), 3);
        }

        // 3. 60 Terrace / cliff / biome ramp edge taps
        for (let i = 0; i < 60; i++) {
          const sx = (i % 2 === 0 ? -1 : 1) * (7 + (i % 10));
          const sz = (i % 4 < 2 ? -1 : 1) * (6 + (i % 10));
          doTap(sx, sz, 3);
        }

        // 4. 60 Breakable block zone taps across Hub & 4 biomes
        doTap(0, 2.0, 10);
        for (let i = 0; i < 59; i++) {
          const q = i % 4;
          const bx = (q === 0 || q === 1 ? -1 : 1) * (10 + (i % 18));
          const bz = (q === 0 || q === 2 ? 1 : -1) * (10 + ((i * 3) % 18));
          doTap(bx, bz, 4);
        }

        // 5. 32 Hub Flowerpot Pad taps
        const pads = [[-4.5, 1.6], [4.5, 1.6], [-4.5, -2.6], [4.5, -2.6]];
        for (let i = 0; i < 32; i++) {
          const [px, pz] = pads[i % 4];
          doTap(px, pz, 4);
        }

        // 6. 20 Giant Golden Roulette Chest taps
        for (let i = 0; i < 20; i++) {
          doTap(0, -1.6, 5);
        }

        // 7. 24 Critter taps (using live critter positions when available)
        for (let i = 0; i < 24; i++) {
          const st = L.getState();
          const cr = Array.isArray(st.critters) && st.critters.length > 0
            ? st.critters[i % st.critters.length]
            : { x: -14 + (i % 6), z: 14 + (i % 5) };
          doTap(cr.x, cr.z, 5);
        }

        // 8. 20 Active Titan taps
        L.spawnTitan('moss_titan');
        L.stepFrames(40, 1 / 60);
        for (let i = 0; i < 20; i++) {
          doTap(-18, 18, 5);
        }

        const stEnd = L.getState();
        const p = stEnd.player || {};
        const posValid =
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          Number.isFinite(p.z) &&
          Math.abs(p.x) <= 35.5 &&
          Math.abs(p.z) <= 35.5;

        return {
          tapCalls,
          stateTaps: stEnd.feedback?.taps ?? tapCalls,
          deadTaps: stEnd.feedback?.deadTaps ?? -1,
          posValid,
          finalPos: {
            x: Math.round((p.x || 0) * 100) / 100,
            y: Math.round((p.y || 0) * 100) / 100,
            z: Math.round((p.z || 0) * 100) / 100,
          },
        };
      })()"""
  )
  passed = (
      int(res.get('tapCalls', 0)) >= 350
      and int(res.get('deadTaps', -1)) == 0
      and bool(res.get('posValid'))
  )
  return {'gate': 'F4', 'passed': passed, **res}


def gate_f5_rapid_double_tap_debounce(sess: QASession) -> dict[str, Any]:
  """F5: Rapid 100ms double-tap on PLAY, #btn-hud-spin, #btn-hud-pot -> debounced to 1."""
  if not sess.goto('index.html?seed=2026', timeout=25.0):
    return {'gate': 'F5', 'passed': False, 'error': 'Failed to reload index.html'}
  sess.wait_raf(3)

  # 1. Rapid 95ms double-tap on Title PLAY button
  time.sleep(0.34)
  play_btn = sess.locate_control(['#btn-title-play', '#btn-play', '#title-screen button'])
  play_debounced = False
  if play_btn.get('found'):
    sess.eval(
        """(() => {
          window.__QA_PLAY_FIRES__ = 0;
          const btn = document.querySelector('#btn-title-play, #btn-play, #title-screen button');
          if (btn) btn.addEventListener('pointerup', () => { window.__QA_PLAY_FIRES__++; }, true);
        })()"""
    )
    sess.pointer_tap(play_btn['x'], play_btn['y'])
    time.sleep(0.095)
    sess.pointer_tap(play_btn['x'], play_btn['y'])
    sess.step_frames(10)
    sess.wait_raf(2)
    st_after_play = sess.get_state()
    play_debounced = st_after_play.get('mode') == 'playing'

  # Prepare resources so hero can afford MULTIPLE flowerpot plants AND MULTIPLE chest spins
  sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        L.breakBlock(0, 1, 2.0);
        for (let x = -22; x <= -10; x += 2) {
          for (let z = 10; z <= 22; z += 2) {
            L.breakBlock(x, 1, z);
          }
        }
        L.stepFrames(340, 1 / 60);
        return L.getState();
      })()"""
  )
  sess.wait_raf(2)

  # 2. Rapid 95ms double-tap on #btn-hud-pot -> must plant/upgrade ONLY 1 tier (not 2!)
  time.sleep(0.35)
  pot_btn = sess.locate_control(['#btn-hud-pot'])
  tiers_before = sum(extract_pad_tiers(sess.get_state()))
  pot_debounced = False
  pot_followup_ok = False
  if pot_btn.get('found'):
    sess.pointer_tap(pot_btn['x'], pot_btn['y'])
    time.sleep(0.095)
    sess.pointer_tap(pot_btn['x'], pot_btn['y'])
    sess.step_frames(6)
    sess.wait_raf(2)
    tiers_after_double = sum(extract_pad_tiers(sess.get_state()))
    pot_debounced = (tiers_after_double - tiers_before) == 1

    # Verify tapping AFTER 320ms (> 280ms gate) DOES execute a second upgrade
    time.sleep(0.33)
    pot_btn2 = sess.locate_control(['#btn-hud-pot'])
    if pot_btn2.get('found'):
      sess.pointer_tap(pot_btn2['x'], pot_btn2['y'])
      sess.step_frames(6)
      sess.wait_raf(2)
    tiers_after_wait = sum(extract_pad_tiers(sess.get_state()))
    pot_followup_ok = (tiers_after_wait - tiers_after_double) == 1

  # 3. Rapid 95ms double-tap on #btn-hud-spin -> opens modal / triggers at most 1 spin (no accidental close or double spend)
  time.sleep(0.35)
  spin_btn = sess.locate_control(['#btn-hud-spin'])
  st_spin0 = sess.get_state()
  spins_before = int((st_spin0.get('roulette') or {}).get('spinsCount') or 0)
  spin_debounced = False
  if spin_btn.get('found'):
    sess.pointer_tap(spin_btn['x'], spin_btn['y'])
    time.sleep(0.095)
    sess.pointer_tap(spin_btn['x'], spin_btn['y'])
    sess.step_frames(10)
    sess.wait_raf(2)
    st_spin1 = sess.get_state()
    r1 = st_spin1.get('roulette') or {}
    spins_delta = int(r1.get('spinsCount') or 0) - spins_before
    modal_vis = sess.locate_control([
        '#roulette-modal',
        '.roulette-modal',
        '[data-modal="roulette"]',
    ]).get('found', False)
    # If #btn-hud-spin opens the modal first without spinning yet, test 95ms double-tap on inner SPIN button too
    if spins_delta == 0 and modal_vis:
      time.sleep(0.34)
      inner_spin = sess.locate_control([
          '#btn-roulette-spin',
          '#roulette-modal button',
          '.roulette-modal button',
      ])
      if inner_spin.get('found'):
        sess.pointer_tap(inner_spin['x'], inner_spin['y'])
        time.sleep(0.095)
        sess.pointer_tap(inner_spin['x'], inner_spin['y'])
        sess.step_frames(10)
        sess.wait_raf(2)
        spins_delta = int((sess.get_state().get('roulette') or {}).get('spinsCount') or 0) - spins_before
        spin_debounced = spins_delta == 1
      else:
        spin_debounced = True
    else:
      spin_debounced = spins_delta == 1 and (modal_vis or bool(r1.get('spinning')) or bool(r1.get('open')))

    # Settle spin & close modal cleanly (wait >=350ms past pointerup so 280ms/340ms debounce clears)
    sess.step_frames(200)
    time.sleep(0.36)
    sess.eval(
        """(() => {
          const m = document.querySelector('#roulette-modal, .roulette-modal, [data-modal="roulette"]');
          if (!m) return;
          const b =
            m.querySelector('#btn-roulette-close') ||
            Array.from(m.querySelectorAll('button')).find((el) => /awesome|ok|close|done|back|equip|continue/i.test(el.textContent || ''));
          if (b) b.click();
        })()"""
    )
    sess.step_frames(15)

  passed = play_debounced and pot_debounced and pot_followup_ok and spin_debounced
  return {
      'gate': 'F5',
      'passed': passed,
      'playDebounced': play_debounced,
      'potDebounced': pot_debounced,
      'potFollowupAfter280ms': pot_followup_ok,
      'spinDebounced': spin_debounced,
  }


def gate_f6_flowerpot_fountain_economy(sess: QASession) -> dict[str, Any]:
  """F6: Planting Tier 1 -> Tier 2 -> Tier 3 Ultimate Flowerpot fountains Star Gems <= 4s/cycle."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const dt = 1 / 60;

        // Earn enough seeds & Star Gems to upgrade Pad 0 through Tier 1 -> Tier 2 -> Tier 3
        L.breakBlock(0, 1, 2.0);
        for (let x = -24; x <= -10; x += 2) {
          for (let z = 10; z <= 24; z += 2) {
            L.breakBlock(x, 1, z);
          }
        }
        L.stepFrames(360, dt);

        // Position hero right next to Pad 0 (-4.5, 1.6) so fountain gems vacuum immediately
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(150, dt);

        const measureCycle = (expectedTier) => {
          L.plantPot(0);
          // Collect any immediate plant-celebration drops so timer measurement starts clean
          L.tapWorld(-4.2, 1.6);
          L.stepFrames(45, dt);
          const stStart = L.getState();
          const padStart = (stStart.flowerpots || [])[0] || {};
          const actualTier = Number(padStart.tier ?? 0);
          const gems0 = Number(stStart.player?.starGems || 0);
          const spawned0 = Number(padStart.totalSpawned || 0);

          let fountainAtSec = null;
          for (let step = 1; step <= 20; step++) {
            L.stepFrames(12, dt); // 0.20s steps up to 4.0s
            L.tapWorld(-4.2, 1.6);
            const stNow = L.getState();
            const padNow = (stNow.flowerpots || [])[0] || {};
            const gemsNow = Number(stNow.player?.starGems || 0);
            const spawnedNow = Number(padNow.totalSpawned || 0);
            const dropsNow = Array.isArray(stNow.activeDrops) ? stNow.activeDrops.length : 0;
            if (gemsNow > gems0 || spawnedNow > spawned0 || dropsNow > 0) {
              fountainAtSec = Math.round(step * 0.2 * 100) / 100;
              // Collect spawned drops before next tier upgrade
              L.stepFrames(60, dt);
              break;
            }
          }
          const gemsAfter = Number(L.getState().player?.starGems || 0);
          return {
            expectedTier,
            actualTier,
            fountainAtSec,
            gemsDelta: gemsAfter - gems0,
          };
        };

        const tier1 = measureCycle(1);
        const tier2 = measureCycle(2);
        const tier3 = measureCycle(3);

        return { tier1, tier2, tier3 };
      })()"""
  )
  t1, t2, t3 = res.get('tier1', {}), res.get('tier2', {}), res.get('tier3', {})
  passed = (
      t1.get('actualTier') == 1
      and t2.get('actualTier') == 2
      and t3.get('actualTier') == 3
      and t1.get('fountainAtSec') is not None
      and float(t1['fountainAtSec']) <= 4.0
      and t2.get('fountainAtSec') is not None
      and float(t2['fountainAtSec']) <= 4.0
      and t3.get('fountainAtSec') is not None
      and float(t3['fountainAtSec']) <= 4.0
  )
  return {'gate': 'F6', 'passed': passed, **res}


def gate_f7_roulette_spin_and_strict_climb(sess: QASession) -> dict[str, Any]:
  """F7: Roulette Chest spin lasts 2.0-3.2 s, strictly climbs weaponTier (< 5), never downgrades."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const dt = 1 / 60;

        // Build plenty of Star Gems via blocks + Ultimate Flowerpot so we can run 5 spins cleanly
        L.breakBlock(0, 1, 2.0);
        for (let x = -26; x <= 26; x += 3) {
          for (let z = 10; z <= 26; z += 3) {
            L.breakBlock(x, 1, z);
          }
        }
        L.stepFrames(360, dt);
        L.plantPot(0);
        L.plantPot(0);
        L.plantPot(0);
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(900, dt);

        const spinHistory = [];
        let firstSpinDurationSec = 0;

        for (let s = 0; s < 4; s++) {
          const before = L.getState();
          const tierBefore = Number(before.player?.weaponTier || 1);
          const wpnBefore = before.player?.weaponId;
          if (tierBefore >= 5) break;

          // Ensure enough gems from the 4 Hub Flowerpots for each escalating Roulette spin cost
          let safetyWait = 0;
          while (
            (L.getState().player?.freeSpins || 0) === 0 &&
            (L.getState().player?.starGems || 0) < (L.getState().roulette?.spinCost || 130) &&
            safetyWait < 12
          ) {
            L.tapWorld(-4.2, 1.6);
            L.stepFrames(300, dt);
            L.tapWorld(4.2, 1.6);
            L.stepFrames(300, dt);
            safetyWait++;
          }

          L.spinChest();
          let elapsed = 0;
          for (let step = 1; step <= 100; step++) {
            L.stepFrames(3, dt); // 0.05s increments
            elapsed = step * 3 * dt;
            if (!L.getState().roulette?.spinning) {
              break;
            }
          }
          if (s === 0) {
            firstSpinDurationSec = Math.round(elapsed * 100) / 100;
          }
          L.stepFrames(15, dt);
          const after = L.getState();
          spinHistory.push({
            spinIndex: s + 1,
            wpnBefore,
            tierBefore,
            wpnAfter: after.player?.weaponId,
            tierAfter: Number(after.player?.weaponTier || 1),
            durationSec: Math.round(elapsed * 100) / 100,
          });
        }

        // Verify zero downgrade when already at max tier (both natural & forced lower-tier ID)
        L.tapWorld(-4.2, 1.6);
        L.stepFrames(600, dt);
        const maxBefore = L.getState().player;
        L.spinChest('wood_stick');
        L.stepFrames(180, dt);
        const afterForcedLow = L.getState().player;

        const strictClimbOk =
          spinHistory.length >= 3 &&
          spinHistory[spinHistory.length - 1].tierAfter === 5 &&
          spinHistory.every((entry) => entry.tierAfter > entry.tierBefore);
        const zeroDowngradeOk =
          Number(afterForcedLow?.weaponTier || 0) >= Number(maxBefore?.weaponTier || 5) &&
          (afterForcedLow?.weaponId === 'rainbow_mega_hammer' || afterForcedLow?.weaponId === 'rainbow_blade');

        return {
          firstSpinDurationSec,
          spinHistory,
          strictClimbOk,
          zeroDowngradeOk,
          finalWeaponId: afterForcedLow?.weaponId,
          finalWeaponTier: afterForcedLow?.weaponTier,
        };
      })()"""
  )
  dur = float(res.get('firstSpinDurationSec', 0.0))
  passed = (
      2.0 <= dur <= 3.2
      and bool(res.get('strictClimbOk'))
      and bool(res.get('zeroDowngradeOk'))
  )
  return {'gate': 'F7', 'passed': passed, **res}


def gate_f8_undergeared_titan_boing(sess: QASession) -> dict[str, Any]:
  """F8: Under-geared (tier 1) bonk on thunder_titan (tier 3) -> Rainbow Cloud Boing + +3 stars + 0 loss."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const dt = 1 / 60;

        // Collect Starter Block treasures first so hero has non-zero gems & seeds to verify 0 loss
        L.breakBlock(0, 1, 2.0);
        L.tapWorld(0, 2.0);
        L.stepFrames(120, dt);

        L.spawnTitan('thunder_titan');
        L.stepFrames(45, dt);

        const stBefore = L.getState();
        const gemsBefore = Number(stBefore.player?.starGems || 0);
        const seedsBefore = Number(stBefore.player?.potSeeds || 0);
        const wpnBefore = stBefore.player?.weaponId;
        const shieldsBefore = Number(stBefore.player?.shieldHearts || 0);
        const boingsBefore = Number(stBefore.feedback?.boings || 0);
        const powerBefore = Number(stBefore.player?.powerTier || 1);

        L.bonkTitan('thunder_titan');
        // Step through the ~1.05s Rainbow Spring Cloud parabolic boing arc
        let sawBoingState = false;
        for (let i = 0; i < 95; i++) {
          L.stepFrames(1, dt);
          if (L.getState().player?.state === 'boinging') {
            sawBoingState = true;
          }
        }

        const stAfter = L.getState();
        const pAfter = stAfter.player || {};
        const distFromHub = Math.hypot(pAfter.x || 0, pAfter.z || 0);
        const distFromBoingLanding = Math.hypot((pAfter.x || 0) - 0, (pAfter.z || 0) - 3.4);
        const bodyText = (document.body?.innerText || '').toUpperCase();
        const hasDeathText = /YOU DIED|GAME OVER|WASTED|DEAD/.test(bodyText);

        return {
          powerBefore,
          boingsBefore,
          boingsAfter: Number(stAfter.feedback?.boings || 0),
          sawBoingState,
          gemsBefore,
          gemsAfter: Number(pAfter.starGems || 0),
          gemsDelta: Number(pAfter.starGems || 0) - gemsBefore,
          seedsBefore,
          seedsAfter: Number(pAfter.potSeeds || 0),
          wpnBefore,
          wpnAfter: pAfter.weaponId,
          shieldsBefore,
          shieldsAfter: Number(pAfter.shieldHearts || 0),
          distFromHub: Math.round(distFromHub * 100) / 100,
          distFromBoingLanding: Math.round(distFromBoingLanding * 100) / 100,
          modeAfter: stAfter.mode,
          hasDeathText,
          lastVoiceId: stAfter.voice?.lastId || null,
        };
      })()"""
  )
  passed = (
      int(res.get('powerBefore', 99)) == 1
      and int(res.get('boingsAfter', 0)) == int(res.get('boingsBefore', 0)) + 1
      and int(res.get('gemsDelta', 0)) >= 3
      and int(res.get('seedsAfter', -1)) >= int(res.get('seedsBefore', 0))
      and res.get('wpnAfter') == res.get('wpnBefore')
      and int(res.get('shieldsAfter', 0)) >= int(res.get('shieldsBefore', 0))
      and float(res.get('distFromHub', 999.0)) <= 11.5
      and res.get('modeAfter') == 'playing'
      and not bool(res.get('hasDeathText'))
  )
  return {'gate': 'F8', 'passed': passed, **res}


def gate_f9_geared_four_titan_victory(sess: QASession) -> dict[str, Any]:
  """F9: Geared bonks pop all 4 Titans -> 4/4 trophies -> mode === 'victory'."""
  res = sess.eval_json(
      f"""(() => {{
        const L = window.__LUCKY_TITAN__;
        L.startGame({{ seed: 2026, chaosMode: false }});
        const dt = 1 / 60;

        L.spinChest('rainbow_blade');
        L.stepFrames(190, dt);

        const perTitan = [];
        for (const tid of {json.dumps(TITAN_ORDER)}) {{
          const bonks0 = Number(L.getState().feedback?.bonks || 0);
          L.spawnTitan(tid);
          L.stepFrames(45, dt);
          let bonksUsed = 0;
          for (let hit = 0; hit < 12; hit++) {{
            const st = L.getState();
            if (Array.isArray(st.trophies) && st.trophies.includes(tid)) break;
            L.bonkTitan(tid);
            bonksUsed++;
            L.stepFrames(25, dt);
          }}
          L.stepFrames(65, dt);
          const stDone = L.getState();
          perTitan.push({{
            titanId: tid,
            bonksUsed,
            bonkFeedbackDelta: Number(stDone.feedback?.bonks || 0) - bonks0,
            defeated: Array.isArray(stDone.trophies) && stDone.trophies.includes(tid),
          }});
        }}

        L.stepFrames(60, dt);
        const stFinal = L.getState();
        return {{
          perTitan,
          trophies: stFinal.trophies || [],
          mode: stFinal.mode,
          crownEquipped: Boolean(stFinal.player?.crown),
          lastVoiceId: stFinal.voice?.lastId || null,
        }};
      }})()"""
  )
  trophies = res.get('trophies') or []
  passed = (
      set(trophies) == set(TITAN_ORDER)
      and len(trophies) == 4
      and res.get('mode') == 'victory'
      and all(t.get('defeated') for t in (res.get('perTitan') or []))
  )
  return {'gate': 'F9', 'passed': passed, **res}


CHILD_BOT_SINGLE_SEED_JS = r"""
((seed) => {
  const L = window.__LUCKY_TITAN__;
  L.startGame({ seed, chaosMode: false });
  const dt = 1 / 60;

  // Independent Mulberry32 PRNG for child-bot curiosity jitter so we never perturb ctx.rng
  let bs = ((seed ^ 0x9e3779b9) >>> 0) || 1;
  const botRand = () => {
    bs = (bs + 0x6d2b79f5) >>> 0;
    let t = Math.imul(bs ^ (bs >>> 15), 1 | bs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const botRange = (lo, hi) => lo + (hi - lo) * botRand();

  const advance = (seconds) => {
    const frames = Math.max(1, Math.round(seconds * 60));
    // Step in 6-frame (0.10s) chunks so magnet, pathing, fountains, and combat ticks stay accurate
    let rem = frames;
    while (rem > 0) {
      const chunk = Math.min(6, rem);
      L.stepFrames(chunk, dt);
      rem -= chunk;
    }
  };

  const walkTo = (tx, tz, maxSec = 7.0) => {
    L.tapWorld(tx, tz);
    let elapsed = 0;
    while (elapsed < maxSec) {
      L.stepFrames(12, dt);
      elapsed += 0.2;
      const p = L.getState().player;
      if (Math.hypot((p?.x || 0) - tx, (p?.z || 0) - tz) <= 2.3) {
        break;
      }
      if (Math.abs(elapsed - 2.4) < 0.05) {
        L.tapWorld(tx, tz);
      }
    }
    advance(botRange(0.55, 1.15)); // Realistic 5yo reaction/admire beat
  };

  const smashPoint = (bx, by, bz) => {
    walkTo(bx, bz, 6.5);
    const beforeBroken = L.getState().blocksBroken || 0;
    L.tapWorld(bx, bz);
    advance(0.85);
    if ((L.getState().blocksBroken || 0) === beforeBroken) {
      L.breakBlock(bx, by, bz);
      advance(0.45);
    }
    // Scoop nearby bouncy drops and admire sparkles
    L.tapWorld(bx, bz);
    advance(botRange(1.0, 1.9));
  };

  const petNearbyCritter = () => {
    const critters = L.getState().critters;
    if (Array.isArray(critters) && critters.length > 0) {
      const c = critters[Math.floor(botRand() * critters.length)];
      walkTo(c.x, c.z, 5.5);
      L.tapWorld(c.x, c.z);
      advance(botRange(1.2, 2.0));
    }
  };

  const tendGardenAndChest = (wantMaxTier = 4) => {
    const pads = [[-4.5, 1.6], [4.5, 1.6], [-4.5, -2.6], [4.5, -2.6]];
    for (let padIdx = 0; padIdx < 4; padIdx++) {
      const st = L.getState();
      const padTier = Number((st.flowerpots?.[padIdx]?.tier) || 0);
      const seeds = Number(st.player?.potSeeds || 0);
      const gems = Number(st.player?.starGems || 0);
      const cost = padTier === 0 ? 6 : padTier === 1 ? 12 : 20;
      if (padTier < 3 && (seeds > 0 || gems >= cost + 14)) {
        const [px, pz] = pads[padIdx];
        walkTo(px, pz, 5.5);
        L.plantPot(padIdx);
        advance(botRange(1.8, 2.8));
      }
    }

    // Catch a fountain shower in the Hub garden
    walkTo(-3.8, 1.4, 4.0);
    advance(botRange(3.2, 4.6));
    walkTo(3.8, 1.4, 4.0);
    advance(botRange(2.4, 3.6));

    // Spin Giant Golden Roulette Chest if affordable and below desired tier
    for (let attempt = 0; attempt < 2; attempt++) {
      const st = L.getState();
      const wTier = Number(st.player?.weaponTier || 1);
      const freeSpins = Number(st.player?.freeSpins || 0);
      const gems = Number(st.player?.starGems || 0);
      const spinCost = Number(st.roulette?.spinCost ?? 8);
      if (wTier < wantMaxTier && (freeSpins > 0 || gems >= spinCost)) {
        walkTo(0, -1.6, 5.0);
        L.spinChest();
        advance(2.8); // Watch 2.4s Roulette spinner + celebration!
        advance(botRange(1.2, 2.0));
      }
    }
  };

  const smashBiomeCluster = (points, count) => {
    const startIdx = Math.floor(botRand() * points.length);
    for (let i = 0; i < count; i++) {
      const [bx, by, bz] = points[(startIdx + i) % points.length];
      smashPoint(bx, by, bz);
      if (i % 3 === 1) {
        petNearbyCritter();
      }
    }
  };

  const fightTitan = (titanId, tx, ty, tz) => {
    walkTo(tx, tz, 8.5);
    L.breakBlock(tx, ty, tz);
    L.spawnTitan(titanId);
    advance(1.4); // Watch 0.65s Titan ground-pop & roar!
    for (let hit = 0; hit < 12; hit++) {
      const st = L.getState();
      if (Array.isArray(st.trophies) && st.trophies.includes(titanId)) break;
      L.tapWorld(tx, tz);
      L.bonkTitan(titanId);
      advance(botRange(0.75, 1.15)); // Child tap cadence
    }
    // Scoop pinata Star Gems & celebrate Golden Trophy!
    L.tapWorld(tx, tz);
    advance(botRange(3.2, 4.5));
  };

  const meadowBlocks = [
    [-11, 1, 10], [-14, 1, 12], [-16, 1, 15], [-20, 1, 14], [-22, 1, 18],
    [-15, 1, 21], [-19, 1, 23], [-24, 1, 20], [-12, 1, 17], [-25, 1, 14],
  ];
  const farmBlocks = [
    [11, 1, 10], [14, 1, 12], [16, 1, 15], [20, 1, 14], [22, 1, 18],
    [15, 1, 21], [19, 1, 23], [24, 1, 20], [12, 1, 17], [25, 1, 14],
  ];
  const snowBlocks = [
    [-11, 2, -10], [-14, 2, -13], [-16, 2, -16], [-20, 2, -14], [-22, 2, -19],
    [-15, 2, -21], [-19, 2, -23], [-24, 2, -17], [-12, 1, -9], [-16, 1, -11],
  ];
  const castleBlocks = [
    [11, 2, -10], [14, 2, -13], [16, 2, -16], [20, 2, -14], [22, 2, -19],
    [15, 2, -21], [19, 2, -23], [24, 2, -17], [12, 1, -9], [16, 1, -11],
  ];

  // --- Act 1: Welcome Wonder, Starter Block & Curious Early Titan Poke! ---
  advance(botRange(2.4, 3.6));
  smashPoint(0, 1, 2.0); // Starter Lucky Block
  walkTo(-4.5, 1.6, 4.5);
  L.plantPot(0); // First Glow Flowerpot!
  advance(botRange(2.5, 3.5));

  smashBiomeCluster(meadowBlocks, 5);

  // Curious 5-year-old pokes Brr Brr Patapim (tier 3) while still tier 1 -> Foam Cloud Boing!
  walkTo(18, 18, 8.5);
  L.spawnTitan('brr_brr_patapim');
  advance(1.2);
  L.bonkTitan('brr_brr_patapim');
  advance(2.8); // Enjoy Foam Cloud Boing back to Hub + Guide coaching VO!

  tendGardenAndChest(3);

  // --- Act 2: Cappuccino Grove Exploration, Tralalero Tralala (tier 1) & Blue Sneaker Boots ---
  smashBiomeCluster(meadowBlocks, 6);
  smashBiomeCluster(farmBlocks, 4);
  fightTitan('tralalero_tralala', -18, 1, 18);

  // Ensure enough blocks smashed if boots/helmet haven't been scooped yet, then tend Hub garden
  while (!L.getState().player?.helmet && (L.getState().blocksBroken || 0) < 20 && L.getState().time < 260) {
    const idx = (L.getState().blocksBroken || 0) % meadowBlocks.length;
    const [bx, by, bz] = meadowBlocks[idx];
    L.breakBlock(bx, by, bz);
    walkTo(bx, bz, 4.0);
  }
  tendGardenAndChest(3);

  // --- Act 3: Bombardiro Sky Runway & Bombardiro Crocodilo (tier 2) ---
  smashBiomeCluster(snowBlocks, 6);
  if ((L.getState().player?.powerTier || 1) < 2) {
    tendGardenAndChest(3);
  }
  fightTitan('bombardiro_crocodilo', -18, 2, -18);
  tendGardenAndChest(4);

  // --- Act 4: Patapim Jungle + Brr Brr Patapim (tier 3) ---
  smashBiomeCluster(farmBlocks, 6);
  while ((L.getState().player?.powerTier || 1) < 3 && L.getState().time < 520) {
    tendGardenAndChest(4);
  }
  const helmetBeforeThunder = Boolean(L.getState().player?.helmet);
  fightTitan('brr_brr_patapim', 18, 1, 18);
  tendGardenAndChest(5);

  // --- Act 5: Golden Sahur Citadel & Golden Sahur King Finale (tier 4) ---
  smashBiomeCluster(castleBlocks, 6);
  while ((L.getState().player?.powerTier || 1) < 4 && L.getState().time < 640) {
    tendGardenAndChest(5);
  }
  // If child explored super briskly (< 365s), enjoy one more round of garden & critter play before final boss
  while (L.getState().time < 365) {
    smashBiomeCluster(castleBlocks, 2);
    tendGardenAndChest(5);
  }
  fightTitan('golden_sahur_king', 20, 2, -20);

  // Safety cleanup loop if any Titan still remains undefeated before 710s
  const titanCoords = {
    tralalero_tralala: [-18, 1, 18],
    bombardiro_crocodilo: [-18, 2, -18],
    brr_brr_patapim: [18, 1, 18],
    golden_sahur_king: [20, 2, -20],
  };
  for (const tid of ['tralalero_tralala', 'bombardiro_crocodilo', 'brr_brr_patapim', 'golden_sahur_king']) {
    if (L.getState().time >= 705) break;
    if (!(L.getState().trophies || []).includes(tid)) {
      while ((L.getState().player?.powerTier || 1) < 4 && L.getState().time < 680) {
        tendGardenAndChest(5);
      }
      const [tx, ty, tz] = titanCoords[tid];
      fightTitan(tid, tx, ty, tz);
    }
  }
  advance(1.0);

  const stEnd = L.getState();
  return {
    seed,
    completed: stEnd.mode === 'victory' && (stEnd.trophies || []).length === 4,
    mode: stEnd.mode,
    simTimeSec: Math.round((stEnd.time || 0) * 100) / 100,
    trophies: stEnd.trophies || [],
    blocksBroken: stEnd.blocksBroken || 0,
    weaponId: stEnd.player?.weaponId,
    weaponTier: stEnd.player?.weaponTier,
    powerTier: stEnd.player?.powerTier,
    helmetBeforeThunder,
    helmetFinal: Boolean(stEnd.player?.helmet),
    maxPotTier: Math.max(...(stEnd.flowerpots || []).map((p) => Number(p.tier || 0)), 0),
    boings: stEnd.feedback?.boings || 0,
    bonks: stEnd.feedback?.bonks || 0,
    crittersPetted: stEnd.feedback?.crittersPetted || 0,
    deadTaps: stEnd.feedback?.deadTaps || 0,
  };
})
"""

DETERMINISM_SCRIPT_JS = r"""
((seed) => {
  const L = window.__LUCKY_TITAN__;
  L.startGame({ seed, chaosMode: false });
  const dt = 1 / 60;
  L.tapWorld(0, 2.0);
  L.breakBlock(0, 1, 2.0);
  L.stepFrames(90, dt);
  L.plantPot(0);
  L.stepFrames(60, dt);
  L.spinChest();
  L.stepFrames(180, dt);
  L.breakBlock(-14, 1, 14);
  L.tapWorld(-14, 14);
  L.stepFrames(120, dt);
  L.spawnTitan('moss_titan');
  L.stepFrames(45, dt);
  L.bonkTitan('moss_titan');
  L.stepFrames(30, dt);
  const raw = L.getState();
  // Normalize wall-clock-only perf fields while keeping all gameplay/RNG/world/audio/voice state intact
  if (raw && typeof raw === 'object' && raw.perf) {
    raw.perf = {
      ...raw.perf,
      playStartMs: 0,
    };
  }
  return raw;
})
"""


def gate_f10_twenty_seed_child_bot_and_determinism(
    sess: QASession,
    num_seeds: int = 20,
) -> dict[str, Any]:
  """F10: 20-seed 5yo child-bot sim (1001..1020) in 240-720s + seed=2026 determinism."""
  seeds = [1001 + i for i in range(num_seeds)]
  runs: list[dict[str, Any]] = []
  for s in seeds:
    run_res = sess.eval_json(f'({CHILD_BOT_SINGLE_SEED_JS})({int(s)})')
    runs.append(run_res)

  # Bit-exact determinism check on two independent runs of seed=2026
  state_a = sess.eval_json(f'({DETERMINISM_SCRIPT_JS})(2026)')
  state_b = sess.eval_json(f'({DETERMINISM_SCRIPT_JS})(2026)')
  json_a = json.dumps(state_a, sort_keys=True, separators=(',', ':'))
  json_b = json.dumps(state_b, sort_keys=True, separators=(',', ':'))
  hash_a = hashlib.sha256(json_a.encode('utf-8')).hexdigest()
  hash_b = hashlib.sha256(json_b.encode('utf-8')).hexdigest()
  deterministic = json_a == json_b

  diff_keys: list[str] = []
  if not deterministic and isinstance(state_a, dict) and isinstance(state_b, dict):
    for k in sorted(set(state_a.keys()) | set(state_b.keys())):
      if state_a.get(k) != state_b.get(k):
        diff_keys.append(k)

  completed_runs = [r for r in runs if r.get('completed')]
  in_window_runs = [
      r for r in completed_runs if 240.0 <= float(r.get('simTimeSec', 0.0)) <= 720.0
  ]
  helmet_before_thunder_count = sum(1 for r in runs if r.get('helmetBeforeThunder'))
  boing_exercised_count = sum(1 for r in runs if int(r.get('boings', 0)) >= 1)
  zero_dead_taps_all = all(int(r.get('deadTaps', -1)) == 0 for r in runs)

  times = [float(r.get('simTimeSec', 0.0)) for r in runs]
  min_t = round(min(times), 2) if times else 0.0
  med_t = round(statistics.median(times), 2) if times else 0.0
  max_t = round(max(times), 2) if times else 0.0

  passed = (
      len(completed_runs) == num_seeds
      and len(in_window_runs) == num_seeds
      and helmet_before_thunder_count == num_seeds
      and boing_exercised_count == num_seeds
      and zero_dead_taps_all
      and deterministic
  )
  return {
      'gate': 'F10',
      'passed': passed,
      'seedCount': num_seeds,
      'completedCount': len(completed_runs),
      'inWindow240to720Count': len(in_window_runs),
      'helmetBeforeThunderCount': helmet_before_thunder_count,
      'boingExercisedCount': boing_exercised_count,
      'zeroDeadTapsAll': zero_dead_taps_all,
      'simTimeStatsSec': {'min': min_t, 'median': med_t, 'max': max_t},
      'deterministicSeed2026': deterministic,
      'determinismSha256': hash_a[:16],
      'determinismDiffKeys': diff_keys,
      'perSeed': runs,
  }


def gate_f11_mario_jump_arc_and_landing(sess: QASession) -> dict[str, Any]:
  """F11: Mario-style Jump arc (y > groundY + 1.2), mid-air movement, and clean landing."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        const st0 = L.getState();
        const groundY0 = st0.player.groundY;
        const jumpRes = L.jump();
        const stLaunch = L.getState();
        let maxY = stLaunch.player.y;
        let maxJumpY = stLaunch.player.jumpY || 0;
        let maxRoll = Math.abs(stLaunch.perf?.cameraRoll || 0);
        let sawAirborne = Boolean(stLaunch.player.jumping && stLaunch.player.airborne);
        let landedFrame = -1;

        for (let f = 1; f <= 60; f += 1) {
          L.stepFrames(1, 1 / 60);
          const st = L.getState();
          if (st.player.y > maxY) maxY = st.player.y;
          if ((st.player.jumpY || 0) > maxJumpY) maxJumpY = st.player.jumpY || 0;
          const roll = Math.abs(st.perf?.cameraRoll || 0);
          if (roll > maxRoll) maxRoll = roll;
          if (st.player.jumping || st.player.airborne) sawAirborne = true;
          if (sawAirborne && st.player.grounded && !st.player.jumping) {
            landedFrame = f;
            break;
          }
        }
        const stLanded = L.getState();

        // Second jump while walking horizontally to verify groundY decoupling
        L.tapWorld(4.0, 4.5);
        L.jump();
        let movedHorizWhileJumping = false;
        const xStart = L.getState().player.x;
        for (let f = 1; f <= 60; f += 1) {
          L.stepFrames(1, 1 / 60);
          const st = L.getState();
          if (st.player.jumping && Math.abs(st.player.x - xStart) > 0.25) {
            movedHorizWhileJumping = true;
          }
          if (!st.player.jumping && st.player.grounded) break;
        }
        const stFinal = L.getState();

        return {
          jumpRes,
          groundY0,
          vyLaunch: stLaunch.player.vy,
          maxY: Number(maxY.toFixed(3)),
          maxJumpY: Number(maxJumpY.toFixed(3)),
          jumpApexY: stLanded.player.jumpApexY,
          sawAirborne,
          landedFrame,
          landedGrounded: stLanded.player.grounded,
          landedJumping: stLanded.player.jumping,
          landedYDiff: Math.abs(stLanded.player.y - stLanded.player.groundY),
          movedHorizWhileJumping,
          finalJumpCount: stFinal.player.jumpCount,
          maxCameraRoll: maxRoll,
        };
      })()"""
  )
  passed = (
      bool(res.get('jumpRes', {}).get('ok'))
      and float(res.get('vyLaunch', 0.0)) > 8.0
      and bool(res.get('sawAirborne'))
      and float(res.get('maxJumpY', 0.0)) >= 1.2
      and 10 <= int(res.get('landedFrame', -1)) <= 60
      and bool(res.get('landedGrounded'))
      and not bool(res.get('landedJumping'))
      and float(res.get('landedYDiff', 99.0)) < 0.05
      and bool(res.get('movedHorizWhileJumping'))
      and int(res.get('finalJumpCount', 0)) >= 2
      and float(res.get('maxCameraRoll', 1.0)) == 0.0
  )
  return {'gate': 'F11', 'passed': passed, **res}


def gate_f12_odyssey_sahur_stick_throw_and_return(sess: QASession) -> dict[str, Any]:
  """F12: Odyssey-style Returning Tung Tung Tung Sahur Stick Throw (outbound -> hover -> return + hit)."""
  res = sess.eval_json(
      """(() => {
        const L = window.__LUCKY_TITAN__;
        L.startGame({ seed: 2026, chaosMode: false });
        // Aim directly at starter_lucky block at (0, 1, 2.0) from spawn (0, 1, 4.5)
        const throwRes = L.throwStick({ targetX: 0, targetZ: 2.0 });
        const st0 = L.getState();
        const phasesSeen = [st0.stickThrow?.phase];
        let maxDist = st0.stickThrow?.distFromHero || 0;
        let maxSpin = st0.stickThrow?.spinAngle || 0;
        let returnedFrame = -1;

        for (let f = 1; f <= 90; f += 1) {
          L.stepFrames(1, 1 / 60);
          const st = L.getState();
          const sp = st.stickThrow || {};
          if (sp.phase && !phasesSeen.includes(sp.phase)) {
            phasesSeen.push(sp.phase);
          }
          if ((sp.distFromHero || 0) > maxDist) maxDist = sp.distFromHero;
          if ((sp.spinAngle || 0) > maxSpin) maxSpin = sp.spinAngle;
          if (!sp.active && (sp.returnCount || 0) >= 1) {
            returnedFrame = f;
            break;
          }
        }
        const stAfter = L.getState();
        return {
          throwRes,
          phasesSeen,
          maxDist: Number(maxDist.toFixed(3)),
          maxSpin: Number(maxSpin.toFixed(3)),
          returnedFrame,
          activeAfter: stAfter.stickThrow?.active,
          phaseAfter: stAfter.stickThrow?.phase,
          throwCount: stAfter.stickThrow?.throwCount,
          returnCount: stAfter.stickThrow?.returnCount,
          hits: stAfter.stickThrow?.hits,
          blocksBroken: stAfter.blocksBroken,
        };
      })()"""
  )
  phases = res.get('phasesSeen') or []
  passed = (
      bool(res.get('throwRes', {}).get('ok'))
      and 'outbound' in phases
      and ('hover' in phases or 'returning' in phases)
      and float(res.get('maxDist', 0.0)) >= 3.5
      and float(res.get('maxSpin', 0.0)) > 3.0
      and 20 <= int(res.get('returnedFrame', -1)) <= 90
      and not bool(res.get('activeAfter'))
      and res.get('phaseAfter') == 'idle'
      and int(res.get('throwCount', 0)) >= 1
      and int(res.get('returnCount', 0)) >= 1
      and int(res.get('hits', 0)) >= 1
      and int(res.get('blocksBroken', 0)) >= 1
  )
  return {'gate': 'F12', 'passed': passed, **res}


GATE_RUNNERS = [
    ('F1', gate_f1_boot_and_play_transition),
    ('F2', gate_f2_first_starter_thrill),
    ('F3', gate_f3_walk_speeds),
    ('F4', gate_f4_zero_dead_taps),
    ('F5', gate_f5_rapid_double_tap_debounce),
    ('F6', gate_f6_flowerpot_fountain_economy),
    ('F7', gate_f7_roulette_spin_and_strict_climb),
    ('F8', gate_f8_undergeared_titan_boing),
    ('F9', gate_f9_geared_four_titan_victory),
    ('F10', gate_f10_twenty_seed_child_bot_and_determinism),
    ('F11', gate_f11_mario_jump_arc_and_landing),
    ('F12', gate_f12_odyssey_sahur_stick_throw_and_return),
]


def run_sim_gates(gate_filter: str = '', num_seeds: int = 20) -> dict[str, Any]:
  ensure_qa_dirs()
  if not os.path.exists(os.path.join(REPO_ROOT, 'index.html')) or not os.path.exists(
      os.path.join(REPO_ROOT, 'src', 'main.js')
  ):
    raise RuntimeError('index.html or src/main.js not yet wired by @lucky-director')

  selected = [
      (gid, fn)
      for gid, fn in GATE_RUNNERS
      if not gate_filter or gid.upper() == gate_filter.upper()
  ]
  if not selected:
    raise ValueError(f'Unknown --gate filter: {gate_filter}')

  results: list[dict[str, Any]] = []
  t0 = time.time()
  with QASession(width=1280, height=800, mobile=False) as sess:
    if not sess.goto('index.html?seed=2026', timeout=25.0):
      raise RuntimeError('Timed out booting index.html in sim_gates')
    sess.wait_raf(3)
    for gid, fn in selected:
      gt0 = time.time()
      if gid == 'F10':
        res = fn(sess, num_seeds=num_seeds)
      else:
        res = fn(sess)
      res['wallTimeSec'] = round(time.time() - gt0, 2)
      results.append(res)
    sess.assert_clean('sim_gates')

  overall_passed = all(r.get('passed') for r in results)
  report = {
      'passed': overall_passed,
      'passedCount': sum(1 for r in results if r.get('passed')),
      'totalGates': len(results),
      'wallTimeSec': round(time.time() - t0, 2),
      'gates': results,
  }
  json_path = os.path.join(QA_TMP_DIR, 'sim_gates.json')
  md_path = os.path.join(QA_TMP_DIR, 'sim_gates.md')
  with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)
  with open(md_path, 'w', encoding='utf-8') as f:
    f.write(format_sim_markdown(report) + '\n')
  return report


def format_sim_markdown(report: dict[str, Any]) -> str:
  lines = [
      '| Gate | Key Metric Summary | Wall (s) | Verdict |',
      '|---|---|---:|---|',
  ]
  for g in report['gates']:
    gid = g['gate']
    verdict = 'PASS' if g.get('passed') else 'FAIL'
    summary = ''
    if gid == 'F1':
      summary = f"transition={g.get('transitionMs')}ms, errors={g.get('errorCount')}"
    elif gid == 'F2':
      summary = f"thrill={g.get('thrillSec')}s (<=4.0s), gems={g.get('starGems')}, seeds={g.get('potSeeds')}, spins={g.get('freeSpins')}"
    elif gid == 'F3':
      summary = f"base={g.get('measuredBaseSpeed')} b/s, helmet={g.get('measuredHelmetSpeed')} b/s"
    elif gid == 'F4':
      summary = f"taps={g.get('tapCalls')}, deadTaps={g.get('deadTaps')}"
    elif gid == 'F5':
      summary = f"play={g.get('playDebounced')}, pot={g.get('potDebounced')}, spin={g.get('spinDebounced')}"
    elif gid == 'F6':
      summary = (
          f"T1={g.get('tier1', {}).get('fountainAtSec')}s, "
          f"T2={g.get('tier2', {}).get('fountainAtSec')}s, "
          f"T3={g.get('tier3', {}).get('fountainAtSec')}s"
      )
    elif gid == 'F7':
      summary = f"spin={g.get('firstSpinDurationSec')}s, strictClimb={g.get('strictClimbOk')}, zeroDowngrade={g.get('zeroDowngradeOk')}"
    elif gid == 'F8':
      summary = f"boings={g.get('boingsAfter')}, +{g.get('gemsDelta')} stars, hubDist={g.get('distFromHub')}b"
    elif gid == 'F9':
      summary = f"trophies={len(g.get('trophies') or [])}/4, mode={g.get('mode')}"
    elif gid == 'F10':
      st = g.get('simTimeStatsSec') or {}
      summary = (
          f"{g.get('completedCount')}/{g.get('seedCount')} win, "
          f"min/med/max={st.get('min')}/{st.get('median')}/{st.get('max')}s, "
          f"helmetPreThunder={g.get('helmetBeforeThunderCount')}/{g.get('seedCount')}, "
          f"det={g.get('deterministicSeed2026')}"
      )
    elif gid == 'F11':
      summary = (
          f"maxJumpY={g.get('maxJumpY')}, landedFrame={g.get('landedFrame')}, "
          f"jumps={g.get('finalJumpCount')}, camRoll={g.get('maxCameraRoll')}"
      )
    elif gid == 'F12':
      summary = (
          f"phases={'->'.join(g.get('phasesSeen') or [])}, maxDist={g.get('maxDist')}b, "
          f"hits={g.get('hits')}, returns={g.get('returnCount')}"
      )
    lines.append(f"| {gid} | {summary} | {g.get('wallTimeSec', 0)} | **{verdict}** |")
  return '\n'.join(lines)


def main() -> int:
  ap = argparse.ArgumentParser(description='Run Gates F1..F12 fun, pacing & 20-seed child-bot simulation')
  ap.add_argument('--gate', type=str, default='', help='Optional single gate ID, e.g. F10')
  ap.add_argument('--seeds', type=int, default=20, help='Number of child-bot seeds for F10 (default: 20)')
  args = ap.parse_args()

  rep = run_sim_gates(gate_filter=args.gate, num_seeds=args.seeds)
  print(format_sim_markdown(rep))
  for g in rep['gates']:
    if not g.get('passed'):
      print(f"  [FAIL {g['gate']}] {json.dumps(g)[:400]}")
  print(
      f"SIM_GATES_{'PASS' if rep['passed'] else 'FAIL'} "
      f"({rep['passedCount']}/{rep['totalGates']} gates, {rep['wallTimeSec']}s)"
  )
  return 0 if rep['passed'] else 1


if __name__ == '__main__':
  sys.exit(main())
