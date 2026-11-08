# JJ & Mikey vs Tung Tung Sahur: McDonald's Burger Battle 3D! — Architecture & Kid-UX Design Specification

## 1. Vision & 5-Year-Old Fun Requirements
**JJ & Mikey vs Tung Tung Sahur: McDonald's Burger Battle 3D!** is a joyful, laugh-out-loud, non-scary 3D Three.js (r170) WebGL burger-island adventure built specifically for a **5-year-old child** on an iPad or laptop, with **100% English UI** and **68 pre-recorded neural voiceover clips (`edge-tts`)**, inspired by Maizen's YouTube video [POOR vs RICH McDonalds Battle in Minecraft](https://www.youtube.com/watch?v=pU0IwO54t74) and **Tung Tung Tung Sahur**.

- **ZERO inventory grids, ZERO crafting menus, ZERO tiny stats, ZERO scary horror, and ZERO "You Died" / "Game Over" screens!**
- **Authority Rule**: `src/data/catalog.js` and `src/data/voice_catalog.js` are the single canonical source of truth and win on any conflict.

### 5 Core Gameplay Pillars:
1. **🍔 Hero Trio (JJ + Mikey + Tung Tung Tung Sahur) & Fast Movement (`8.5 -> 10.8 blocks/s`)**:
   - **JJ** (Maizen's iconic Pro builder in bright red hoodie over crisp white shirt with white drawstrings, warm brown hair, bright cyan-blue eyes, dark denim jeans, and golden McDonald's `"M"` visor cap) leads the trio with **Mikey** (bright green turtle buddy with yellow belly shell, red tongue, and mini green noob burger on the left) and **Tung Tung Tung Sahur** (warm teakwood kentungan drum log buddy with big googly eyes, blue sneakers, and mini Sahur drumstick on the right) merged into `torsoMesh` at **0 extra draw calls**.
   - **Fast Walk Speed**: Base speed **`8.5 blocks/s`**, boosted to **`10.8 blocks/s`** with **Blue Sneaker Speed Boots**, **Fizzy Cola Zoom**, or **Golden Burger Crown**!
   - **Rhythmic 3-Beat `"TUNG! TUNG! TUNG! SAHUR!"` Combo & HUD Drum Button (`#btn-hud-drum`)**:
     - Every swing advances a 3-beat rhythm combo:
       - `Beat 1: "TUNG!"` gold ring (`r = 2.2` blocks)
       - `Beat 2: "TUNG! TUNG!"` double cyan-gold ring (`r = 2.8` blocks)
       - `Beat 3: "TUNG! TUNG! TUNG! SAHUR!"` giant rainbow shockwave hitting `r = 4.0` blocks + `+2` bonus Golden Burger Stars!
     - Tapping/holding a target or pressing the big bottom-right **`🥁 TUNG!` Drum Button (`#btn-hud-drum`, >= 76x76 px)** swings immediately on `pointerdown` and auto-swings every `300 ms` while held.
2. **4 Hub Burger Battle Stations (`Tier 0 -> Tier 1 $1 Noob Shack -> Tier 2 $100K Pro McDonald's -> Tier 3 Ultimate Mega Burger Palace + Secret Gold Vault`)**:
   - Around the central **Burger Battle Plaza**, 4 Burger Shop Stations (`Mikey $1 Noob Shack`, `JJ $100K Pro McDonalds`, `Tung Tung Sahur Drive-Thru`, `Secret Underground Gold Vault`) start at Tier 0:
     - **Tier 1 (`Mikey's $1 NOOB Cobblestone Burger Shack`)**: Mossy cobblestone and grey stone walls, oak door, yellow wool roof awning, giant brown Dirt-Block `"M"` sign on top of the roof, and a cute white pixel ghost on the wall!
     - **Tier 2 (`JJ's $100,000 PRO 2-Story Diamond McDonald's`)**: Crisp red/white/yellow 2-story modern restaurant, red carpet VIP entrance, cyan diamond-block side tower, 2nd-floor window dining room, and a giant glowing Golden `"JM"` Arches sign on the roof!
     - **Tier 3 (`Ultimate JJ & Mikey & Tung Tung Sahur Mega Burger Palace + Secret Gold Vault`)**: Stepped golden 2-story McDonald's + cyan diamond towers + glowing underground Gold Vault base + Tung Tung Sahur's Golden Kentungan Drive-Thru Archway + giant rotating Golden Mega Cheeseburger & Sahur Star topper!
   - Upgrading them (`#btn-hud-totem` or tapping pad, `GARDEN_LINGER_RADIUS = 5.8` covering all 4 pads at `(±4.5, 1, 1.6)` and `(±4.5, 1, -2.6)`) wakes up friendly 3D Burger Crew helpers who dance beside their stations and fountain **Golden Burger Stars** automatically (`+2 / +4 / +8` Stars).
   - Once all 4 reach Tier 3 (`[3, 3, 3, 3]`), surplus Burger Seeds convert into a **Rainbow Burger Star Fountain (`+6` Stars)** so nothing ever stalls.
3. **Golden Burger & Sahur Roulette Wheel (`#btn-hud-spin` / `#roulette-modal`)**:
   - Strictly climbing, non-downgrading picture roulette progression across **5 wacky Burger & Sahur Weapons**:
     1. `wooden_kentungan_bat` — **Golden Burger Spatula** (`Tier 1`, starter)
     2. `bronze_temple_gong` — **Crispy Fries Fryer Gong** (`Tier 2`)
     3. `golden_sahur_mallet` — **Tung Tung Sahur Mallet** (`Tier 3`)
     4. `neon_thunder_taiko` — **Fizzy Cola Taiko Blaster** (`Tier 4`)
     5. `rainbow_mega_hammer` — **Rainbow Mega Burger Hammer** (`Tier 5`)
   - Plus **Blue Sneaker Speed Boots (`10.8 b/s`, `5` shield hearts)** & **Golden Burger Crown (`10.8 b/s`, `5` shield hearts, `+25%` bonk power)**.
   - Gated smoothly with Burger Station fountain milestones (`ROULETTE_COSTS = [28, 88, 112, 120, 270, 290]`) so child-bots naturally engage all mechanics (`4.0 - 8.5 min` total run time).
4. **12 Wacky Mystery Burger Crates & 3 Pattable Burger Town Helpers**:
   - Around the `72x72` island, glowing **Golden Mystery Burger Crates** pop open in `3` `"TUNG! TUNG! TUNG!"` bonks (with the **Starter Mystery Crate** at `(0, 1, 2.0)` popping on the first swing to drop `+8` Golden Burger Stars, `+1` Shop Seed, and `+1` Free Spin Token in `<= 3.5 s`) into 12 comedy surprises.
   - 3 pattable 3D Burger Town Helpers (**Mini Mikey Turtle Chef**, **Mini Tung Tung Sahur Drummer**, **Mini JJ Security Guard**) give hearts, giggles, and `+2..+4` Stars when tapped.
5. **4 Sleeping `"Zzz"` Giant Boss Visitors (`Cursed Land Ghost`, `Sneaky Burger Robber`, `TNT Rotten Burger Golem`, `Tung Tung Sahur Burger King`)**:
   - 4 giant (`4.2x - 5.0x` scale) bespoke 3D Boss Visitors in the 4 island corners:
     1. **`tralalero_tralala` — 👻 Cursed Land Ghost** (`reqTier = 1`, SW *Mikey $1 Cursed Lot* at `(-18, 1, 18)`): Giant floating snow-white pixel ghost from Mikey's `$1` Cursed Land thumbnail (`0xffffff` shroud with pixelated bottom fringe, hollow black eyes & open `"O"` mouth, holding a mossy cobblestone block & red ketchup-handprint paintbrush!).
     2. **`bombardiro_crocodilo` — 🦹 Sneaky Burger Robber** (`reqTier = 2`, NW *Robber Alley & Register* at `(-18, 2, -18)`): Masked robber from `12:13` in the video (`black domino mask`, black-and-white burglar stripes, red McDonald's cap, overflowing golden burger-coin loot sack on his back, and a silly red plunger pop-blaster!).
     3. **`brr_brr_patapim` — 🧨 TNT Rotten Burger Golem** (`reqTier = 3` + Blue Sneaker Boots, SE *TNT Rotten Burger Yard* at `(18, 1, 18)`): Giant red-and-white `TNT` demolition block golem crowned with Mikey's smelly green rotten-meat burger and green french fries from `07:45` and `14:03` in the video!
     4. **`golden_sahur_king` — 👑 Tung Tung Sahur Burger King** (`reqTier = 4`, NE *JJ $100K Diamond Hilltop* at `(20, 2, -20)`): Giant `5.0x` crowned golden Tung Tung Tung Sahur Kentungan Titan Chef wearing a royal golden McDonald's Burger Crown, holding a giant Triple Cheeseburger Value Combo tray in one hand and a blazing Golden Taiko Drum Mallet in the other!
   - **Comedy Sesame Burger-Bun Cloud `BOING!` (Zero Death / Zero Game-Over)**: Poking a sleeping `"Zzz"` Giant Boss (5 swings to wake) when under-geared triggers a hilarious comedy move that bounces the trio onto a **merged-geometry 3D Sesame Burger-Bun, Melted Cheese, Lettuce & Ketchup Foam Spring Cloud (`BOING!`)** arc back to the Hub `(0, 1, 3.4)` with `+3` consolation Golden Burger Stars (`peakDrawCalls <= 65`, `maxMetalness <= 0.22`).
   - **Geared Boss Dance-Friend Victory**: When properly geared, `6-9` rhythmic `"TUNG! TUNG! TUNG! SAHUR!"` bonks turn the Giant Boss into a happy burger customer & dancing parade friend, award their **Golden Burger Trophy (`1/4..4/4`)**, and trigger the **Grand McDonald's & Sahur Burger Parade Finale (`#victory-modal`)**!

---

## 2. Strict Global Technical & Localization Rules
1. **ZERO CJK Characters Anywhere**: Zero `[\u4e00-\u9fff]` characters in any file, DOM element, attribute, or 2D canvas draw (`tests/l10n_audit.py`).
2. **Zero-Build ES2022 Modules & Zero Browser TTS**: Relative imports only (`../../vendor/three.module.min.js`). Zero `window.speechSynthesis` calls or identifiers in runtime code.
3. **Three.js r170 Material, Draw-Call & Camera Guardrails (`Gate F12`)**:
   - `maxMetalness <= 0.20` (`<= 0.22` hard gate).
   - All `THREE.SpriteMaterial` / billboard / ring materials set `toneMapped: false` and `fog: false`.
   - `camera.rotation.z === 0` on every frame.
   - `peakDrawCalls <= 65` across all viewports and scenes (using single-mesh merged voxel rigs, merged Sesame Burger-Bun Spring Cloud geometry, and single active Giant Boss visibility).
   - Live 3D world renders behind `#title-screen` and calls `renderer.compile(scene, camera)` on boot so tapping `▶ PLAY` transitions in `<= 50 ms` (`<= 80 ms` gate).
4. **5-Viewport Kid-UX & Docked Subtitle Contract (`Gate F11`)**:
   - Viewports: `1280x800`, `1024x768`, `768x1024` (iPad portrait), `844x390` (mobile landscape), `390x844` (mobile portrait).
   - `0` scrollbars, `0` clipped text, `0` pairwise bounding-box overlaps among buttons, status pills, `#boss-banner`, and `#voice-subtitle`.
   - `<= 5` visible clickable `<button>` controls during active play (`#btn-hud-spin`, `#btn-hud-totem`, `#btn-hud-voice`, `#btn-hud-menu`, `#btn-hud-drum`).
   - Docked `#voice-subtitle` pill sits cleanly at `bottom: 112px` and replays voice on tap.

---

## 3. Frozen Deterministic Seam (`window.__JJ_MIKEY_BURGER__` + aliases `window.__SAHUR_ISLAND__` & `window.__LUCKY_TITAN__`)
Exposed by `src/core/seam.js`:
- `startGame({ seed = 2026, chaosMode = false } = {})`
- `continueGame()`
- `tapWorld(x, z)`
- `swingDrum()`
- `breakBlock(x, y, z)` / `breakDrum(x, y, z)`
- `upgradeTotem(padIdx = 0)` / `plantPot(padIdx = 0)`
- `spinWheel(forcedClubId = null)` / `spinChest(forcedWeaponId = null)`
- `spawnBoss(bossId)` / `spawnTitan(titanId)`
- `bonkBoss(bossId)` / `bonkTitan(titanId)`
- `replayVoice()`
- `stepFrames(n = 1, dt = 1 / 60)`
- `getState()` -> deep-cloned plain JSON snapshot.
