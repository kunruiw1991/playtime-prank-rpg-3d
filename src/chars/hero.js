// Expressive 3D Playtime Civil War Prank Trio Rig:
// 1. Center Lead (jjGroup -> Lily Lovebraids): Cute lavender-violet doll (0xd0bfff) in black star-overalls
//    over a purple shirt with a glowing yellow 5-point chest star, purple/gold boots, expressive cartoon eyes,
//    and two long bouncy purple twin-braids (leftBraid, rightBraid) that swing as she walks and jumps!
// 2. Left Buddy (mikeyGroup -> Giblet the Patchwork Spy): Caramel-brown & tan stitched patchwork fox/cat buddy
//    with big pointed ears, one oversized white button eye + one cool spy eyepatch, green scout vest & wagging tail!
// 3. Right Buddy (sahurGroup -> Chum Chompkins the Belly-Mouth Buddy): Plump crimson-red fuzzy monster buddy
//    with tiny cute eyes on top of his head and a big cheerful smiling Belly-Mouth right on his tummy!
// Zero CJK text, metalness <= 0.20, 100% deterministic.

import * as THREE from '../../vendor/three.module.min.js';
import { HUB_LAYOUT, WEAPON_ORDER, WEAPONS, resolveWeaponId } from '../data/catalog.js';
import {
  buildBlazingHelmetMesh,
  buildKingCrownMesh,
  buildStarCapeMesh,
  buildVoxelGroup,
  buildWeaponMesh,
  buildWingedBootOverlay,
  createSafeSpriteMaterial,
} from './props3d.js';

const HERO_WEAPON_ALIASES = Object.freeze({
  wood_stick: 'wooden_kentungan_bat',
  stone_mallet: 'bronze_temple_gong',
  sparkle_sword: 'bronze_temple_gong',
  gold_pickaxe: 'bronze_temple_gong',
  iron_sledge: 'golden_sahur_mallet',
  ocean_trident: 'golden_sahur_mallet',
  diamond_cleaver: 'neon_thunder_taiko',
  thunder_hammer: 'neon_thunder_taiko',
  rainbow_blade: 'rainbow_mega_hammer',
});

function resolveHeroWeaponKey(id) {
  if (id && HERO_WEAPON_ALIASES[id]) return HERO_WEAPON_ALIASES[id];
  return resolveWeaponId(id);
}

function createGroundShadowTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c2d = canvas.getContext('2d');
  if (!c2d) return null;
  const grad = c2d.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.18)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  c2d.fillStyle = grad;
  c2d.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHero(ctx = {}) {
  const group = new THREE.Group();
  group.name = 'hero_root';

  const spawn = HUB_LAYOUT.spawn;
  const initYaw = Math.atan2(spawn.facingX - spawn.x, spawn.facingZ - spawn.z);
  group.position.set(spawn.x, spawn.y, spawn.z);
  group.rotation.y = initYaw;

  const shadowTex = createGroundShadowTexture();
  let shadowDisc = null;
  if (shadowTex) {
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    shadowDisc = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.35), shadowMat);
    shadowDisc.rotation.x = -Math.PI * 0.5;
    shadowDisc.position.y = 0.03;
    shadowDisc.renderOrder = 1;
    group.add(shadowDisc);
  }

  const bodyRig = new THREE.Group();
  bodyRig.name = 'hero_rig';
  group.add(bodyRig);

  // Lily Lovebraids' black star-overall legs (0x2b2d42) with purple & gold Dollhouse Boots (0x862e9c / 0xffd43b)!
  const legBoxes = [
    { s: [0.22, 0.28, 0.22], p: [0, -0.14, 0], c: 0x2b2d42 },
    { s: [0.23, 0.06, 0.23], p: [0, -0.27, 0], c: 0x9c36b5 },
    { s: [0.26, 0.16, 0.32], p: [0, -0.39, 0.04], c: 0x862e9c },
    { s: [0.18, 0.07, 0.08], p: [0, -0.35, 0.18], c: 0xffd43b, glow: true },
    { s: [0.28, 0.06, 0.34], p: [0, -0.46, 0.04], c: 0xffd43b, glow: true },
  ];

  const legL = new THREE.Group();
  legL.name = 'hero_leg_l';
  legL.position.set(0.16, 0.48, 0);
  bodyRig.add(legL);
  const baseLegL = buildVoxelGroup(legBoxes, { name: 'hero_base_leg_l' });
  legL.add(baseLegL);

  const legR = new THREE.Group();
  legR.name = 'hero_leg_r';
  legR.position.set(-0.16, 0.48, 0);
  bodyRig.add(legR);
  const baseLegR = buildVoxelGroup(legBoxes, { name: 'hero_base_leg_r' });
  legR.add(baseLegR);

  const speedBootL = buildWingedBootOverlay(1);
  speedBootL.visible = false;
  legL.add(speedBootL);

  const speedBootR = buildWingedBootOverlay(-1);
  speedBootR.visible = false;
  legR.add(speedBootR);

  // Torso Pivot: Lily Lovebraids (Center) + Giblet the Patchwork Spy (Left) + Chum Chompkins (Right)!
  const torsoPivot = new THREE.Group();
  torsoPivot.name = 'hero_torso_pivot';
  torsoPivot.position.set(0, 0.48, 0);
  bodyRig.add(torsoPivot);

  const jjGroup = buildVoxelGroup(
    [
      // --- CENTER LEAD: LILY LOVEBRAIDS (Black Star-Overalls over Purple Shirt + Glowing Yellow 5-Point Star) ---
      // Base purple shirt torso (0x9c36b5)
      { s: [0.56, 0.64, 0.40], p: [0, 0.34, 0], c: 0x9c36b5 },
      // Black Star-Overalls bib & waist (0x2b2d42)
      { s: [0.58, 0.30, 0.42], p: [0, 0.18, 0], c: 0x2b2d42 },
      { s: [0.42, 0.28, 0.06], p: [0, 0.42, 0.19], c: 0x2b2d42 },
      // Overall shoulder straps & golden buttons
      { s: [0.12, 0.26, 0.44], p: [-0.17, 0.55, 0], c: 0x2b2d42 },
      { s: [0.12, 0.26, 0.44], p: [0.17, 0.55, 0], c: 0x2b2d42 },
      { s: [0.08, 0.08, 0.06], p: [-0.17, 0.52, 0.22], c: 0xffd43b, glow: true },
      { s: [0.08, 0.08, 0.06], p: [0.17, 0.52, 0.22], c: 0xffd43b, glow: true },
      // Glowing Yellow 5-Point Star on Lily's chest (+Z)
      { s: [0.22, 0.22, 0.07], p: [0, 0.38, 0.21], c: 0xffd43b, glow: true },
      { s: [0.20, 0.20, 0.07], p: [0, 0.38, 0.21], r: [0, 0, 0.785], c: 0xffe066, glow: true },
      { s: [0.10, 0.10, 0.08], p: [0, 0.38, 0.22], c: 0xfff9db, glow: true },
      // Lavender doll neck collar & golden belt trim
      { s: [0.28, 0.08, 0.26], p: [0, 0.66, 0], c: 0xd0bfff },
      { s: [0.60, 0.06, 0.44], p: [0, 0.05, 0], c: 0xffd43b, glow: true },
    ],
    {
      name: 'lily_lovebraids_torso',
      glowEmissive: 0xffc940,
      glowIntensity: 0.34,
    }
  );
  torsoPivot.add(jjGroup);

  // --- LEFT BUDDY (x = -0.64, z = -0.18): GIBLET THE PATCHWORK SPY ---
  // Caramel-brown & tan stitched patchwork fox/cat buddy (0xc97a3e / 0xe6a15c) with big pointed ears,
  // one oversized white button eye + one cool spy eyepatch, green scout vest (0x2b8a3e), and wagging stitched tail!
  const mikeyGroup = buildVoxelGroup(
    [
      // Patchwork caramel & tan legs
      { s: [0.11, 0.16, 0.12], p: [-0.72, -0.10, -0.18], c: 0xc97a3e },
      { s: [0.11, 0.16, 0.12], p: [-0.56, -0.10, -0.18], c: 0xe6a15c },
      // Patchwork torso wrapped in Green Scout Vest (0x2b8a3e) with tan belly patch & dark stitch lines
      { s: [0.30, 0.34, 0.24], p: [-0.64, 0.14, -0.18], c: 0x2b8a3e },
      { s: [0.18, 0.26, 0.05], p: [-0.64, 0.14, -0.055], c: 0xe6a15c, glow: true },
      { s: [0.04, 0.24, 0.06], p: [-0.64, 0.14, -0.05], c: 0x5c3a21 },
      { s: [0.10, 0.10, 0.06], p: [-0.55, 0.20, -0.05], c: 0xffd43b, glow: true },
      // Giblet's caramel/tan patchwork head (left half caramel 0xc97a3e, right half tan 0xe6a15c + stitch seam)
      { s: [0.17, 0.28, 0.28], p: [-0.72, 0.44, -0.18], c: 0xc97a3e },
      { s: [0.17, 0.28, 0.28], p: [-0.56, 0.44, -0.18], c: 0xe6a15c },
      { s: [0.04, 0.29, 0.29], p: [-0.64, 0.44, -0.18], c: 0x5c3a21 },
      // Big Pointed Fox/Cat Ears with pink inner fluff
      { s: [0.10, 0.16, 0.09], p: [-0.75, 0.64, -0.18], r: [0, 0, 0.18], c: 0xc97a3e },
      { s: [0.10, 0.16, 0.09], p: [-0.53, 0.64, -0.18], r: [0, 0, -0.18], c: 0xe6a15c },
      { s: [0.06, 0.10, 0.06], p: [-0.75, 0.63, -0.14], r: [0, 0, 0.18], c: 0xffb3d9, glow: true },
      { s: [0.06, 0.10, 0.06], p: [-0.53, 0.63, -0.14], r: [0, 0, -0.18], c: 0xffb3d9, glow: true },
      // Left eye: Oversized White Button Eye with X-stitch! Right eye: Cool Black Spy Eyepatch & strap!
      { s: [0.11, 0.11, 0.06], p: [-0.72, 0.46, -0.03], c: 0xffffff, glow: true },
      { s: [0.04, 0.07, 0.07], p: [-0.72, 0.46, -0.02], c: 0x182232 },
      { s: [0.07, 0.04, 0.07], p: [-0.72, 0.46, -0.02], c: 0x182232 },
      { s: [0.12, 0.11, 0.06], p: [-0.55, 0.46, -0.03], c: 0x182232 },
      { s: [0.34, 0.04, 0.30], p: [-0.64, 0.49, -0.18], r: [0, 0, -0.14], c: 0x182232 },
      // Cute stitched snout & smile + patchwork arms + wagging stitched tail on back (-Z)
      { s: [0.12, 0.08, 0.07], p: [-0.64, 0.37, -0.02], c: 0xfff3bf, glow: true },
      { s: [0.06, 0.05, 0.08], p: [-0.64, 0.40, 0.01], c: 0x182232 },
      { s: [0.09, 0.20, 0.09], p: [-0.82, 0.16, -0.14], r: [-0.35, 0, 0.2], c: 0xc97a3e },
      { s: [0.10, 0.26, 0.10], p: [-0.64, 0.14, -0.36], r: [0.65, 0, 0], c: 0xc97a3e },
      { s: [0.11, 0.14, 0.11], p: [-0.64, 0.24, -0.46], r: [0.65, 0, 0], c: 0xe6a15c, glow: true },
    ],
    {
      name: 'giblet_patchwork_buddy',
      glowEmissive: 0xffc940,
      glowIntensity: 0.30,
    }
  );
  torsoPivot.add(mikeyGroup);

  // --- RIGHT BUDDY (x = +0.64, z = -0.18): CHUM CHOMPKINS THE BELLY-MOUTH BUDDY ---
  // Plump crimson-red fuzzy monster buddy (0xe03131 / 0xff6b6b) with tiny cute eyes on top of his head
  // and a big cheerful smiling Belly-Mouth (0xfff5f5 cartoon teeth + pink tongue) right on his tummy!
  const sahurGroup = buildVoxelGroup(
    [
      // Stubby crimson legs & golden playcare shoes
      { s: [0.13, 0.12, 0.16], p: [0.56, -0.12, -0.16], c: 0xe03131 },
      { s: [0.13, 0.12, 0.16], p: [0.72, -0.12, -0.16], c: 0xe03131 },
      { s: [0.14, 0.05, 0.18], p: [0.56, -0.18, -0.15], c: 0xffd43b, glow: true },
      { s: [0.14, 0.05, 0.18], p: [0.72, -0.18, -0.15], c: 0xffd43b, glow: true },
      // Plump fuzzy crimson-red monster body (0xe03131 / 0xff6b6b)
      { s: [0.38, 0.48, 0.32], p: [0.64, 0.20, -0.18], c: 0xe03131 },
      { s: [0.34, 0.52, 0.28], p: [0.64, 0.22, -0.18], c: 0xff6b6b },
      // BIG CHEERFUL SMILING BELLY-MOUTH right on Chum Chompkins' tummy (+Z)!
      { s: [0.28, 0.22, 0.06], p: [0.64, 0.18, -0.02], c: 0x3b0d11 },
      // Upper & lower rows of cartoon white belly-teeth (0xfff5f5)
      { s: [0.06, 0.06, 0.07], p: [0.55, 0.26, -0.015], c: 0xfff5f5, glow: true },
      { s: [0.06, 0.06, 0.07], p: [0.64, 0.26, -0.015], c: 0xfff5f5, glow: true },
      { s: [0.06, 0.06, 0.07], p: [0.73, 0.26, -0.015], c: 0xfff5f5, glow: true },
      { s: [0.06, 0.05, 0.07], p: [0.59, 0.10, -0.015], c: 0xfff5f5, glow: true },
      { s: [0.06, 0.05, 0.07], p: [0.69, 0.10, -0.015], c: 0xfff5f5, glow: true },
      // Cheerful pink tongue inside the belly-mouth!
      { s: [0.14, 0.08, 0.07], p: [0.64, 0.15, -0.01], c: 0xff85a1, glow: true },
      // Tiny cute eyes perched right on top of his fuzzy red head!
      { s: [0.10, 0.10, 0.07], p: [0.57, 0.50, -0.06], c: 0xffffff, glow: true },
      { s: [0.10, 0.10, 0.07], p: [0.71, 0.50, -0.06], c: 0xffffff, glow: true },
      { s: [0.05, 0.05, 0.08], p: [0.57, 0.50, -0.05], c: 0x182232 },
      { s: [0.05, 0.05, 0.08], p: [0.71, 0.50, -0.05], c: 0x182232 },
      // Fuzzy red arms cheering on the sides
      { s: [0.10, 0.22, 0.10], p: [0.85, 0.24, -0.14], r: [0.35, 0, -0.28], c: 0xe03131 },
    ],
    {
      name: 'chum_chompkins_buddy',
      glowEmissive: 0xff85a1,
      glowIntensity: 0.30,
    }
  );
  torsoPivot.add(sahurGroup);

  // Royal Starlight Prank Cape (hinged at shoulders on -Z)
  const capePivot = new THREE.Group();
  capePivot.name = 'hero_cape_pivot';
  capePivot.position.set(0, 0.62, -0.24);
  capePivot.rotation.x = 0.24;
  torsoPivot.add(capePivot);

  const starCapeMesh = buildStarCapeMesh();
  starCapeMesh.visible = false;
  capePivot.add(starCapeMesh);

  // Expressive Lily Lovebraids Head: Lavender-Violet Doll Skin (0xd0bfff), Big Cartoon Eyes,
  // Purple Parted Bangs, and Two Long Bouncy Purple Twin-Braids (leftBraid, rightBraid)!
  const headPivot = new THREE.Group();
  headPivot.name = 'hero_head_pivot';
  headPivot.position.set(0, 0.66, 0);
  torsoPivot.add(headPivot);

  const headMesh = buildVoxelGroup(
    [
      // Cute lavender-violet doll head (0xd0bfff)
      { s: [0.62, 0.58, 0.56], p: [0, 0.29, 0], c: 0xd0bfff },
      // Deep purple & violet braided hair cap, back, and center-parted doll bangs (0x862e9c / 0xae3ec9)
      { s: [0.66, 0.16, 0.60], p: [0, 0.55, 0], c: 0x862e9c },
      { s: [0.66, 0.44, 0.16], p: [0, 0.35, -0.23], c: 0x862e9c },
      { s: [0.10, 0.36, 0.54], p: [-0.30, 0.39, -0.02], c: 0x9c36b5 },
      { s: [0.10, 0.36, 0.54], p: [0.30, 0.39, -0.02], c: 0x9c36b5 },
      // Swept purple front bangs with golden star hairpins
      { s: [0.28, 0.12, 0.09], p: [-0.17, 0.48, 0.27], r: [0, 0, 0.16], c: 0xae3ec9 },
      { s: [0.28, 0.12, 0.09], p: [0.17, 0.48, 0.27], r: [0, 0, -0.16], c: 0xae3ec9 },
      { s: [0.10, 0.10, 0.07], p: [-0.24, 0.50, 0.30], r: [0, 0, 0.785], c: 0xffd43b, glow: true },
      { s: [0.10, 0.10, 0.07], p: [0.24, 0.50, 0.30], r: [0, 0, 0.785], c: 0xffd43b, glow: true },
      // Big Expressive Cartoon Doll Eyes (white sclera + violet-cyan pupils + cute eyelashes)
      { s: [0.15, 0.16, 0.06], p: [-0.16, 0.30, 0.27], c: 0xffffff, glow: true },
      { s: [0.15, 0.16, 0.06], p: [0.16, 0.30, 0.27], c: 0xffffff, glow: true },
      { s: [0.09, 0.11, 0.07], p: [-0.15, 0.30, 0.28], c: 0x5f3dc4 },
      { s: [0.09, 0.11, 0.07], p: [0.15, 0.30, 0.28], c: 0x5f3dc4 },
      { s: [0.04, 0.04, 0.08], p: [-0.17, 0.33, 0.29], c: 0xffffff, glow: true },
      { s: [0.04, 0.04, 0.08], p: [0.13, 0.33, 0.29], c: 0xffffff, glow: true },
      // Rosy doll cheeks & cheerful smile
      { s: [0.10, 0.06, 0.05], p: [-0.24, 0.20, 0.27], c: 0xff85c0, glow: true },
      { s: [0.10, 0.06, 0.05], p: [0.24, 0.20, 0.27], c: 0xff85c0, glow: true },
      { s: [0.18, 0.05, 0.05], p: [0, 0.15, 0.27], c: 0x9c36b5 },
      { s: [0.14, 0.04, 0.06], p: [0, 0.16, 0.28], c: 0xffffff, glow: true },
    ],
    {
      name: 'hero_head',
      glowEmissive: 0xffffff,
      glowIntensity: 0.26,
    }
  );
  headPivot.add(headMesh);

  // Lily's Two Long Bouncy Purple Twin-Braids (leftBraid & rightBraid)
  // Stacked purple braid puffs (0x862e9c / 0xae3ec9) with glowing yellow hair ties (0xffd43b)!
  function createTwinBraid(side = 1, name = 'braid') {
    const braidBoxes = [
      // Top yellow star hair-tie at temple
      { s: [0.14, 0.10, 0.14], p: [0, 0, 0], c: 0xffd43b, glow: true },
      // Stacked braided purple puffs swinging down
      { s: [0.18, 0.16, 0.18], p: [side * 0.03, -0.12, -0.02], r: [0, 0, side * 0.12], c: 0x862e9c },
      { s: [0.19, 0.16, 0.19], p: [side * 0.06, -0.26, -0.03], r: [0, 0, -side * 0.10], c: 0xae3ec9, glow: true },
      { s: [0.18, 0.16, 0.18], p: [side * 0.08, -0.40, -0.04], r: [0, 0, side * 0.12], c: 0x862e9c },
      { s: [0.17, 0.15, 0.17], p: [side * 0.10, -0.54, -0.04], r: [0, 0, -side * 0.10], c: 0xae3ec9, glow: true },
      // Lower yellow ribbon tie & heart-shaped purple braid tip
      { s: [0.16, 0.08, 0.16], p: [side * 0.11, -0.66, -0.04], c: 0xffd43b, glow: true },
      { s: [0.20, 0.14, 0.18], p: [side * 0.12, -0.76, -0.04], c: 0x9c36b5, glow: true },
    ];
    return buildVoxelGroup(braidBoxes, {
      name,
      glowEmissive: 0xd0bfff,
      glowIntensity: 0.30,
    });
  }

  const leftBraid = createTwinBraid(1, 'lily_left_braid');
  leftBraid.position.set(0.34, 0.36, -0.06);
  headPivot.add(leftBraid);

  const rightBraid = createTwinBraid(-1, 'lily_right_braid');
  rightBraid.position.set(-0.34, 0.36, -0.06);
  headPivot.add(rightBraid);

  const helmetMesh = buildBlazingHelmetMesh();
  helmetMesh.position.set(0, 0.30, 0);
  helmetMesh.visible = false;
  headPivot.add(helmetMesh);

  const crownMesh = buildKingCrownMesh();
  crownMesh.position.set(0, 0.64, 0);
  crownMesh.visible = false;
  headPivot.add(crownMesh);

  // Lily's Left Arm (+X) & Right Gadget Arm (-X) in Purple Shirt Sleeves & Lavender Doll Hands!
  const armBoxes = [
    { s: [0.20, 0.32, 0.20], p: [0, -0.14, 0], c: 0x9c36b5 },
    { s: [0.22, 0.06, 0.22], p: [0, -0.29, 0], c: 0xffd43b, glow: true },
    { s: [0.18, 0.14, 0.18], p: [0, -0.39, 0], c: 0xd0bfff },
  ];

  const armL = buildVoxelGroup(armBoxes, { name: 'hero_arm_l' });
  armL.position.set(0.39, 0.58, 0);
  armL.rotation.z = 0.10;
  torsoPivot.add(armL);

  const armR = buildVoxelGroup(armBoxes, { name: 'hero_arm_r' });
  armR.position.set(-0.39, 0.58, 0);
  armR.rotation.z = -0.10;
  torsoPivot.add(armR);

  // Right-hand Prank Gadget Socket
  const weaponSocket = new THREE.Group();
  weaponSocket.name = 'hero_weapon_socket';
  weaponSocket.position.set(-0.06, -0.38, 0.12);
  weaponSocket.rotation.set(0.68, -0.22, -0.24);
  weaponSocket.scale.setScalar(1.18);
  armR.add(weaponSocket);

  // Pre-build & cache all 5 canonical Prank Gadget models
  const weaponMeshes = new Map();
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    const wid = WEAPON_ORDER[i];
    const wMesh = buildWeaponMesh(wid);
    wMesh.visible = wid === 'wooden_kentungan_bat';
    weaponSocket.add(wMesh);
    weaponMeshes.set(wid, wMesh);
  }

  // World-space Odyssey-style Returning Prank Gadget Projectile Group
  const thrownStickGroup = new THREE.Group();
  thrownStickGroup.name = 'thrown_sahur_stick';
  thrownStickGroup.visible = false;
  thrownStickGroup.position.set(spawn.x, spawn.y + 0.92, spawn.z);

  const spinPivot = new THREE.Group();
  spinPivot.name = 'thrown_sahur_stick_pivot';
  thrownStickGroup.add(spinPivot);

  const thrownWeaponMeshes = new Map();
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    const wid = WEAPON_ORDER[i];
    const wMesh = buildWeaponMesh(wid);
    wMesh.visible = wid === 'wooden_kentungan_bat';
    wMesh.rotation.set(Math.PI * 0.5, 0, 0);
    wMesh.scale.setScalar(1.35);
    spinPivot.add(wMesh);
    thrownWeaponMeshes.set(wid, wMesh);
  }

  // Glowing golden boomerang spin ring (toneMapped: false, fog: false)
  const spinRingGeo = new THREE.RingGeometry(0.45, 0.72, 24);
  spinRingGeo.rotateX(-Math.PI * 0.5);
  const spinRingMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const spinRingMesh = new THREE.Mesh(spinRingGeo, spinRingMat);
  spinRingMesh.name = 'thrown_sahur_spin_ring';
  spinPivot.add(spinRingMesh);

  const cheerStarSprite = new THREE.Sprite(
    createSafeSpriteMaterial({ color: 0xffe066, opacity: 0.0 })
  );
  cheerStarSprite.scale.set(0.65, 0.65, 1);
  cheerStarSprite.position.set(0, 2.25, 0);
  cheerStarSprite.visible = false;
  group.add(cheerStarSprite);

  if (ctx && ctx.scene) {
    ctx.scene.add(group);
    ctx.scene.add(thrownStickGroup);
  }

  const equipment = {
    weaponId: 'wooden_kentungan_bat',
    helmet: false,
    speedBoots: false,
    starCape: false,
    crown: false,
  };

  let walkPhase = 0;
  let swingTimer = 0;
  const SWING_DURATION = 0.28;
  let boingTimer = 0;
  const BOING_DURATION = 1.05;
  let cheerTimer = 0;
  const CHEER_DURATION = 1.10;
  let shieldFlashTimer = 0;
  let jumpAnimTimer = 0;
  let landAnimTimer = 0;

  function applyEquipmentVisuals() {
    const canonicalWeapon = resolveHeroWeaponKey(equipment.weaponId);
    for (const [wid, mesh] of weaponMeshes.entries()) {
      mesh.visible = wid === canonicalWeapon;
    }
    for (const [wid, mesh] of thrownWeaponMeshes.entries()) {
      mesh.visible = wid === canonicalWeapon;
    }
    helmetMesh.visible = Boolean(equipment.helmet);
    const hasBoots = Boolean(equipment.speedBoots);
    baseLegL.visible = !hasBoots;
    baseLegR.visible = !hasBoots;
    speedBootL.visible = hasBoots;
    speedBootR.visible = hasBoots;
    if (!hasBoots) {
      speedBootL.rotation.y = 0;
      speedBootR.rotation.y = 0;
    }
    starCapeMesh.visible = Boolean(equipment.starCape);
    crownMesh.visible = Boolean(equipment.crown);
    crownMesh.position.y = equipment.helmet ? 0.78 : 0.64;
  }

  function setEquipment(patch = {}) {
    if (!patch || typeof patch !== 'object') return { ...equipment };
    if (patch.weaponId !== undefined) {
      const resolved = resolveHeroWeaponKey(patch.weaponId);
      if (WEAPONS[resolved]) {
        equipment.weaponId = resolved;
      }
    }
    if (patch.helmet !== undefined) equipment.helmet = Boolean(patch.helmet);
    if (patch.speedBoots !== undefined) equipment.speedBoots = Boolean(patch.speedBoots);
    else if (patch.boots !== undefined) equipment.speedBoots = Boolean(patch.boots);
    if (patch.starCape !== undefined) equipment.starCape = Boolean(patch.starCape);
    else if (patch.cape !== undefined) equipment.starCape = Boolean(patch.cape);
    if (patch.crown !== undefined) equipment.crown = Boolean(patch.crown);
    applyEquipmentVisuals();
    return { ...equipment };
  }

  function getEquipment() {
    return { ...equipment };
  }

  function triggerSwing() {
    swingTimer = SWING_DURATION;
  }

  function triggerBoing() {
    boingTimer = BOING_DURATION;
  }

  function triggerCheer() {
    cheerTimer = CHEER_DURATION;
  }

  function triggerJump() {
    jumpAnimTimer = 0.24;
  }

  function triggerLand() {
    landAnimTimer = 0.16;
  }

  function flashShield() {
    shieldFlashTimer = 0.24;
  }

  function syncStickThrow(sp = null, fallbackX = 0, fallbackY = 1, fallbackZ = 0) {
    const proj = sp ?? ctx?.state?.stickThrow;
    if (proj && proj.active) {
      weaponSocket.visible = false;
      thrownStickGroup.visible = true;
      thrownStickGroup.position.set(
        Number(proj.x) || fallbackX,
        Number(proj.y) || (fallbackY + 0.92),
        Number(proj.z) || fallbackZ
      );
      spinPivot.rotation.set(
        0,
        Number(proj.spinAngle) || 0,
        Math.sin((Number(proj.spinAngle) || 0) * 0.5) * 0.12
      );
      const ringPulse = 1 + Math.sin((Number(proj.spinAngle) || 0) * 0.8) * 0.12;
      spinRingMesh.scale.set(ringPulse, ringPulse, 1);
    } else {
      weaponSocket.visible = true;
      thrownStickGroup.visible = false;
    }
  }

  function getThrownStickGroup() {
    return thrownStickGroup;
  }

  function update(dt = 1 / 60, time = 0, moveState = {}) {
    const stepDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    const t = Number(time) || 0;

    const fallbackPlayer = ctx?.state?.player;
    const x = moveState.x ?? fallbackPlayer?.x ?? group.position.x;
    const y = moveState.y ?? fallbackPlayer?.y ?? group.position.y;
    const groundY = moveState.groundY ?? fallbackPlayer?.groundY ?? y;
    const z = moveState.z ?? fallbackPlayer?.z ?? group.position.z;
    const yaw = moveState.yaw ?? fallbackPlayer?.yaw ?? group.rotation.y;
    const vy = Number(moveState.vy ?? fallbackPlayer?.vy ?? 0);
    const isJumping = Boolean(moveState.jumping ?? fallbackPlayer?.jumping);
    const landSquash = Math.max(
      0,
      Number(moveState.landSquash ?? fallbackPlayer?.landSquashTimer ?? landAnimTimer ?? 0)
    );
    const speedRatio = Math.max(0, Math.min(2.0, Number(moveState.speedRatio ?? 0)));
    const isSwinging = Boolean(moveState.swinging) || swingTimer > 0;
    const isBoinging = Boolean(moveState.boinging) || boingTimer > 0;

    group.position.set(x, y, z);
    group.rotation.set(0, yaw, 0);

    if (swingTimer > 0) swingTimer = Math.max(0, swingTimer - stepDt);
    if (boingTimer > 0) boingTimer = Math.max(0, boingTimer - stepDt);
    if (cheerTimer > 0) cheerTimer = Math.max(0, cheerTimer - stepDt);
    if (jumpAnimTimer > 0) jumpAnimTimer = Math.max(0, jumpAnimTimer - stepDt);
    if (landAnimTimer > 0) landAnimTimer = Math.max(0, landAnimTimer - stepDt);
    if (shieldFlashTimer > 0) {
      shieldFlashTimer = Math.max(0, shieldFlashTimer - stepDt);
      const pulse = 1 + Math.sin((shieldFlashTimer / 0.24) * Math.PI) * 0.14;
      helmetMesh.scale.setScalar(pulse);
    } else {
      helmetMesh.scale.setScalar(1);
    }

    if (speedRatio > 0.02) {
      const freq = 11.0 + speedRatio * 4.8;
      walkPhase += stepDt * freq;
    } else {
      walkPhase *= Math.max(0, 1 - stepDt * 10);
    }

    const stride = Math.min(1.25, speedRatio);
    const legSwing = Math.sin(walkPhase) * 0.78 * stride;
    const stepHop = speedRatio > 0.03 && !isJumping ? Math.abs(Math.sin(walkPhase)) * 0.11 * stride : 0;
    const idleBob = !isJumping ? Math.sin(t * 3.8) * 0.028 * (1 - Math.min(1, stride)) : 0;

    bodyRig.position.set(0, stepHop + idleBob, 0);
    bodyRig.rotation.set(stride * 0.09, 0, Math.cos(walkPhase) * 0.04 * stride);
    bodyRig.scale.set(1, 1, 1);

    legL.rotation.set(-legSwing, 0, 0);
    legR.rotation.set(legSwing, 0, 0);

    armL.rotation.set(legSwing * 0.85, 0, 0.12);
    armR.rotation.set(-0.30 - legSwing * 0.65, 0, -0.14);
    weaponSocket.rotation.set(0.68, -0.22, -0.24);

    torsoPivot.rotation.set(0, 0, 0);
    headPivot.rotation.set(
      Math.sin(t * 2.2) * 0.03,
      Math.sin(t * 1.5) * 0.05 * (1 - Math.min(1, stride)),
      0
    );

    // Animate Lily's twin purple braids & Giblet/Chum Chompkins sidekicks!
    const braidWalkSwing = Math.sin(walkPhase) * 0.28 * stride;
    const braidAirLift = isJumping ? Math.max(-0.45, Math.min(0.65, -vy * 0.045)) : 0;
    leftBraid.rotation.set(
      0.16 + stride * 0.24 + Math.abs(braidWalkSwing) * 0.35 + braidAirLift,
      0,
      0.12 + Math.sin(t * 3.6 + walkPhase) * (0.05 + stride * 0.12) + Math.max(0, braidAirLift * 0.5)
    );
    rightBraid.rotation.set(
      0.16 + stride * 0.24 + Math.abs(braidWalkSwing) * 0.35 + braidAirLift,
      0,
      -0.12 - Math.sin(t * 3.6 + walkPhase) * (0.05 + stride * 0.12) - Math.max(0, braidAirLift * 0.5)
    );

    mikeyGroup.position.y = Math.abs(Math.sin(walkPhase + 0.8)) * 0.06 * stride + Math.sin(t * 4.5) * 0.015;
    sahurGroup.position.y = Math.abs(Math.cos(walkPhase + 0.4)) * 0.06 * stride + Math.cos(t * 4.2) * 0.015;

    if (equipment.starCape) {
      capePivot.rotation.x =
        0.24 +
        stride * 0.64 +
        (isBoinging || isJumping ? 0.55 : 0) +
        Math.sin(t * (7 + stride * 9)) * (0.06 + stride * 0.14);
    }
    if (equipment.speedBoots) {
      const wingFlap = Math.sin(t * 16 + walkPhase * 1.5) * (0.06 + (stride + (isJumping ? 0.8 : 0)) * 0.16);
      speedBootL.rotation.y = wingFlap;
      speedBootR.rotation.y = -wingFlap;
    }

    // Mario-style expressive jump pose & landing squash-and-stretch
    if (isJumping && !isBoinging) {
      const riseFactor = Math.max(-1, Math.min(1, vy / 11.5));
      const stretchY = 1 + Math.max(0, riseFactor) * 0.12;
      const squashXZ = 1 / Math.sqrt(stretchY);
      bodyRig.scale.set(squashXZ, stretchY, squashXZ);
      bodyRig.rotation.x = -riseFactor * 0.14;
      armR.rotation.set(-2.45, 0, -0.22);
      armL.rotation.set(0.55, 0, 0.34);
      legL.rotation.set(-0.62, 0, 0);
      legR.rotation.set(0.48, 0, 0);
      headPivot.rotation.x = -0.15;
    } else if (landSquash > 0 && !isBoinging) {
      const s = Math.sin(Math.min(1, landSquash / 0.16) * Math.PI);
      bodyRig.scale.set(1 + s * 0.16, 1 - s * 0.15, 1 + s * 0.16);
      bodyRig.position.y -= s * 0.08;
    }

    if (isSwinging) {
      const prog =
        swingTimer > 0
          ? 1 - swingTimer / SWING_DURATION
          : ((t * 3.4) % 1);
      if (prog < 0.28) {
        const u = prog / 0.28;
        armR.rotation.x = -0.30 - u * 1.85;
        armR.rotation.z = -0.12 - u * 0.22;
        weaponSocket.rotation.x = 0.96 - u * 0.25;
        torsoPivot.rotation.y = -u * 0.26;
      } else if (prog < 0.68) {
        const u = (prog - 0.28) / 0.40;
        const ease = 1 - Math.pow(1 - u, 3);
        armR.rotation.x = -2.15 + ease * 1.92;
        armR.rotation.z = -0.34 + ease * 0.26;
        weaponSocket.rotation.x = 0.71 + ease * 0.92;
        torsoPivot.rotation.y = -0.26 + ease * 0.52;
        bodyRig.scale.set(
          1 + Math.sin(u * Math.PI) * 0.08,
          1 - Math.sin(u * Math.PI) * 0.06,
          1 + Math.sin(u * Math.PI) * 0.08
        );
      } else {
        const u = (prog - 0.68) / 0.32;
        armR.rotation.x = -0.23 * (1 - u) + -0.30 * u;
        weaponSocket.rotation.x = 1.63 * (1 - u) + 0.96 * u;
        torsoPivot.rotation.y = 0.26 * (1 - u);
      }
    }

    if (isBoinging) {
      const bp = boingTimer > 0 ? 1 - boingTimer / BOING_DURATION : (t * 2) % 1;
      bodyRig.rotation.y = Math.sin(bp * Math.PI * 2) * 0.45;
      bodyRig.rotation.z = Math.sin(t * 14) * 0.14;
      armL.rotation.set(-2.35 + Math.sin(t * 18) * 0.25, 0, 0.35);
      armR.rotation.set(-2.20 - Math.sin(t * 18) * 0.25, 0, -0.35);
      legL.rotation.x = -0.55 + Math.sin(t * 20) * 0.45;
      legR.rotation.x = -0.55 - Math.sin(t * 20) * 0.45;
      headPivot.rotation.x = -0.18;
    } else if (cheerTimer > 0) {
      const cp = 1 - cheerTimer / CHEER_DURATION;
      const hop = Math.abs(Math.sin(cp * Math.PI * 2)) * 0.42;
      bodyRig.position.y += hop;
      bodyRig.rotation.y = Math.sin(cp * Math.PI * 4) * 0.25;
      armL.rotation.set(-2.55, 0, 0.32 + Math.sin(t * 18) * 0.20);
      armR.rotation.set(-2.45, 0, -0.32 - Math.sin(t * 18) * 0.20);
      weaponSocket.rotation.x = 0.55;
      headPivot.rotation.x = -0.16;
    }

    // Odyssey-style Thrown Gadget visibility & world-space spin sync
    syncStickThrow(moveState.stickProjectile ?? ctx?.state?.stickThrow, x, y, z);

    if (shadowDisc) {
      const jumpHeight = Math.max(0, y - groundY);
      shadowDisc.position.y = (groundY - y) + 0.03;
      const hScale = Math.max(0.42, 1 - (bodyRig.position.y + jumpHeight * 0.45) * 0.28);
      shadowDisc.scale.set(hScale, hScale, 1);
    }
    cheerStarSprite.visible = false;
  }

  function reset() {
    walkPhase = 0;
    swingTimer = 0;
    boingTimer = 0;
    cheerTimer = 0;
    shieldFlashTimer = 0;
    jumpAnimTimer = 0;
    landAnimTimer = 0;
    equipment.weaponId = 'wooden_kentungan_bat';
    equipment.helmet = false;
    equipment.speedBoots = false;
    equipment.starCape = false;
    equipment.crown = false;
    applyEquipmentVisuals();
    weaponSocket.visible = true;
    thrownStickGroup.visible = false;
    thrownStickGroup.position.set(spawn.x, spawn.y + 0.92, spawn.z);
    group.position.set(spawn.x, spawn.y, spawn.z);
    group.rotation.set(0, initYaw, 0);
    bodyRig.position.set(0, 0, 0);
    bodyRig.rotation.set(0, 0, 0);
    bodyRig.scale.set(1, 1, 1);
    leftBraid.rotation.set(0.16, 0, 0.12);
    rightBraid.rotation.set(0.16, 0, -0.12);
    if (shadowDisc) {
      shadowDisc.position.y = 0.03;
      shadowDisc.scale.set(1, 1, 1);
    }
  }

  applyEquipmentVisuals();

  return {
    group,
    jjGroup,
    mikeyGroup,
    sahurGroup,
    leftBraid,
    rightBraid,
    weaponSocket,
    thrownStickGroup,
    syncStickThrow,
    getThrownStickGroup,
    setEquipment,
    getEquipment,
    get equipment() {
      return { ...equipment };
    },
    triggerSwing,
    triggerBoing,
    triggerCheer,
    triggerJump,
    triggerLand,
    flashShield,
    update,
    reset,
  };
}

export const createHeroRig = createHero;
