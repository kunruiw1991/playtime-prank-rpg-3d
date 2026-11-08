// 3D Voxel Prank Gadgets, 3-Tier Playtime Prank Contraptions, Golden Prank Trophies,
// Lily Lovebraids Gear (Golden Tea-Party Crown & Star Glasses, Rocket GrabPack Roller-Skates,
// Royal Starlight Prank Cape), Bouncy Tea-Party Cushion Cloud & 2D 16x16 Pixel Icons for
// Playtime Prank RPG 3D: Lily, Giblet & The Smiling Critters!
// Inspired by GameToons' "CHAPTER 5: CIVIL WAR! (Poppy Playtime Animation)" (c4AAxXPD8w8).
// Zero CJK text, metalness <= 0.20 on all materials.

import * as THREE from '../../vendor/three.module.min.js';
import { resolveBossId, resolveWeaponId } from '../data/catalog.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const BASE_POS = UNIT_BOX.attributes.position;
const BASE_NORM = UNIT_BOX.attributes.normal;
const BASE_INDEX = UNIT_BOX.index;

const _mat4 = new THREE.Matrix4();
const _normMat = new THREE.Matrix3();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _color = new THREE.Color();

let sharedMatteMaterial = null;
let sharedFlashMaterial = null;
const glowMaterialCache = new Map();
const iconDataUrlCache = new Map();

const GADGET_WEAPON_ALIASES = Object.freeze({
  wood_stick: 'wooden_kentungan_bat',
  wooden_kentungan_bat: 'wooden_kentungan_bat',
  stone_mallet: 'bronze_temple_gong',
  sparkle_sword: 'bronze_temple_gong',
  gold_pickaxe: 'bronze_temple_gong',
  bronze_temple_gong: 'bronze_temple_gong',
  iron_sledge: 'golden_sahur_mallet',
  ocean_trident: 'golden_sahur_mallet',
  golden_sahur_mallet: 'golden_sahur_mallet',
  diamond_cleaver: 'neon_thunder_taiko',
  thunder_hammer: 'neon_thunder_taiko',
  neon_thunder_taiko: 'neon_thunder_taiko',
  rainbow_blade: 'rainbow_mega_hammer',
  rainbow_mega_hammer: 'rainbow_mega_hammer',
});

function resolveGadgetWeaponId(rawWeaponId) {
  if (rawWeaponId && GADGET_WEAPON_ALIASES[rawWeaponId]) {
    return GADGET_WEAPON_ALIASES[rawWeaponId];
  }
  return resolveWeaponId(rawWeaponId);
}

export function getMatteVoxelMaterial() {
  if (!sharedMatteMaterial) {
    sharedMatteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.66,
      metalness: 0.08,
      emissive: new THREE.Color(0x181c26),
      emissiveIntensity: 0.16,
    });
  }
  return sharedMatteMaterial;
}

export function getGlowVoxelMaterial(emissiveHex = 0xffc940, intensity = 0.34) {
  const clampedIntensity = Math.max(0.15, Math.min(0.44, Number(intensity) || 0.34));
  const key = `${emissiveHex}:${clampedIntensity.toFixed(2)}`;
  let mat = glowMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.36,
      metalness: 0.16,
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: clampedIntensity,
    });
    glowMaterialCache.set(key, mat);
  }
  return mat;
}

export function getFlashVoxelMaterial() {
  if (!sharedFlashMaterial) {
    sharedFlashMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff9db,
      roughness: 0.32,
      metalness: 0.12,
      emissive: new THREE.Color(0xffe066),
      emissiveIntensity: 0.44,
    });
  }
  return sharedFlashMaterial;
}

export function createSafeSpriteMaterial(options = {}) {
  return new THREE.SpriteMaterial({
    transparent: true,
    depthWrite: false,
    ...options,
    toneMapped: false,
    fog: false,
  });
}

export function mergeVoxelBoxes(boxes) {
  const count = boxes.length;
  const vertCount = count * 24;
  const idxCount = count * 36;

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices = vertCount > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);

  for (let i = 0; i < count; i++) {
    const b = boxes[i];
    const [sx, sy, sz] = b.s;
    const [px, py, pz] = b.p;
    _pos.set(px, py, pz);
    if (b.r) {
      _euler.set(b.r[0] || 0, b.r[1] || 0, b.r[2] || 0);
      _quat.setFromEuler(_euler);
    } else {
      _quat.identity();
    }
    _scale.set(sx, sy, sz);
    _mat4.compose(_pos, _quat, _scale);
    _normMat.getNormalMatrix(_mat4);

    _color.set(b.c !== undefined ? b.c : 0xffffff);
    const boost = b.glow ? 1.62 : 1.0;
    const cr = _color.r * boost;
    const cg = _color.g * boost;
    const cb = _color.b * boost;

    const vBase = i * 24;
    for (let v = 0; v < 24; v++) {
      const outIdx = (vBase + v) * 3;
      _v3.fromBufferAttribute(BASE_POS, v).applyMatrix4(_mat4);
      positions[outIdx] = _v3.x;
      positions[outIdx + 1] = _v3.y;
      positions[outIdx + 2] = _v3.z;

      _v3.fromBufferAttribute(BASE_NORM, v).applyMatrix3(_normMat).normalize();
      normals[outIdx] = _v3.x;
      normals[outIdx + 1] = _v3.y;
      normals[outIdx + 2] = _v3.z;

      colors[outIdx] = cr;
      colors[outIdx + 1] = cg;
      colors[outIdx + 2] = cb;
    }

    const iBase = i * 36;
    for (let k = 0; k < 36; k++) {
      indices[iBase + k] = vBase + BASE_INDEX.getX(k);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function buildVoxelGroup(boxes, opts = {}) {
  const {
    name = 'voxel_group',
    glowEmissive = 0xffc940,
    glowIntensity = 0.34,
    castShadow = false,
    receiveShadow = false,
    singleMesh = true,
    userData = null,
  } = opts;

  const group = new THREE.Group();
  group.name = name;
  if (userData) Object.assign(group.userData, userData);

  const meshes = [];
  if (singleMesh && boxes.length > 0) {
    let glowCount = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].glow) glowCount++;
    }
    const allGlow = glowCount === boxes.length;
    const geo = mergeVoxelBoxes(boxes);
    const mat = allGlow
      ? getGlowVoxelMaterial(glowEmissive, glowIntensity)
      : getMatteVoxelMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${name}_mesh`;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.baseMaterial = mat;
    if (userData) Object.assign(mesh.userData, userData);
    group.add(mesh);
    meshes.push(mesh);
    group.userData.voxelMeshes = meshes;
    return group;
  }

  const matteBoxes = [];
  const glowBoxes = [];
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i].glow) glowBoxes.push(boxes[i]);
    else matteBoxes.push(boxes[i]);
  }

  if (matteBoxes.length > 0) {
    const matteGeo = mergeVoxelBoxes(matteBoxes);
    const matteMat = getMatteVoxelMaterial();
    const matteMesh = new THREE.Mesh(matteGeo, matteMat);
    matteMesh.name = `${name}_matte`;
    matteMesh.castShadow = castShadow;
    matteMesh.receiveShadow = receiveShadow;
    matteMesh.userData.baseMaterial = matteMat;
    if (userData) Object.assign(matteMesh.userData, userData);
    group.add(matteMesh);
    meshes.push(matteMesh);
  }

  if (glowBoxes.length > 0) {
    const glowGeo = mergeVoxelBoxes(glowBoxes);
    const glowMat = getGlowVoxelMaterial(glowEmissive, glowIntensity);
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.name = `${name}_glow`;
    glowMesh.castShadow = castShadow;
    glowMesh.receiveShadow = receiveShadow;
    glowMesh.userData.baseMaterial = glowMat;
    if (userData) Object.assign(glowMesh.userData, userData);
    group.add(glowMesh);
    meshes.push(glowMesh);
  }

  group.userData.voxelMeshes = meshes;
  return group;
}

// ---------------------------------------------------------------------------
// 1. 5 Playtime Prank Gadgets (supporting all canonical + legacy weapon IDs)
// Origin (0,0,0) sits cleanly in Lily Lovebraids' right hand grip; extends +Y
// ---------------------------------------------------------------------------

function getWeaponBoxes(rawWeaponId) {
  const weaponId = resolveGadgetWeaponId(rawWeaponId);
  switch (weaponId) {
    case 'wooden_kentungan_bat':
      // 1. wood_stick / wooden_kentungan_bat: Blue & Red GrabPack Hand Launcher
      // (Yellow hazard handle + coiled wire + bright Blue & Red 5-fingered GrabPack hands)
      return {
        glowEmissive: 0x39d5ff,
        glowIntensity: 0.30,
        boxes: [
          // Yellow & black hazard launcher grip handle
          { s: [0.14, 0.36, 0.14], p: [0, 0.04, 0], c: 0xffd43b, glow: true },
          { s: [0.15, 0.06, 0.15], p: [0, -0.04, 0], c: 0x212529 },
          { s: [0.15, 0.06, 0.15], p: [0, 0.10, 0], c: 0x212529 },
          { s: [0.18, 0.10, 0.18], p: [0, -0.15, 0], c: 0x343a40 },
          // Dual launcher collar & coiled black/cyan GrabPack cables
          { s: [0.34, 0.10, 0.18], p: [0, 0.25, 0], c: 0x495057 },
          { s: [0.08, 0.28, 0.08], p: [-0.10, 0.42, 0], c: 0x212529 },
          { s: [0.08, 0.28, 0.08], p: [0.10, 0.42, 0], c: 0x212529 },
          { s: [0.11, 0.05, 0.11], p: [-0.10, 0.38, 0], c: 0x39d5ff, glow: true },
          { s: [0.11, 0.05, 0.11], p: [0.10, 0.46, 0], c: 0xff4d6d, glow: true },
          // Left Bright Blue 5-Fingered GrabPack Hand (0x228be6)
          { s: [0.22, 0.22, 0.09], p: [-0.13, 0.66, 0.02], r: [0, 0, 0.12], c: 0x228be6, glow: true },
          { s: [0.05, 0.15, 0.07], p: [-0.24, 0.68, 0.02], r: [0, 0, 0.48], c: 0x339af0, glow: true },
          { s: [0.04, 0.17, 0.06], p: [-0.20, 0.84, 0.02], r: [0, 0, 0.18], c: 0x339af0, glow: true },
          { s: [0.04, 0.19, 0.06], p: [-0.15, 0.86, 0.02], r: [0, 0, 0.06], c: 0x339af0, glow: true },
          { s: [0.04, 0.18, 0.06], p: [-0.10, 0.85, 0.02], r: [0, 0, -0.05], c: 0x339af0, glow: true },
          { s: [0.04, 0.15, 0.06], p: [-0.05, 0.82, 0.02], r: [0, 0, -0.15], c: 0x339af0, glow: true },
          // Right Bright Red 5-Fingered GrabPack Hand (0xe03131)
          { s: [0.22, 0.22, 0.09], p: [0.13, 0.66, -0.02], r: [0, 0, -0.12], c: 0xe03131, glow: true },
          { s: [0.05, 0.15, 0.07], p: [0.24, 0.68, -0.02], r: [0, 0, -0.48], c: 0xff595e, glow: true },
          { s: [0.04, 0.17, 0.06], p: [0.20, 0.84, -0.02], r: [0, 0, -0.18], c: 0xff595e, glow: true },
          { s: [0.04, 0.19, 0.06], p: [0.15, 0.86, -0.02], r: [0, 0, -0.06], c: 0xff595e, glow: true },
          { s: [0.04, 0.18, 0.06], p: [0.10, 0.85, -0.02], r: [0, 0, 0.05], c: 0xff595e, glow: true },
          { s: [0.04, 0.15, 0.06], p: [0.05, 0.82, -0.02], r: [0, 0, 0.15], c: 0xff595e, glow: true },
        ],
      };

    case 'bronze_temple_gong':
      // 2. stone_mallet / bronze_temple_gong: Lily's Stretchy Purple Braid Whip
      // (Giant braided purple pigtail club tied with a golden star ribbon)
      return {
        glowEmissive: 0xae3ec9,
        glowIntensity: 0.34,
        boxes: [
          // Lavender & gold ribbon handle
          { s: [0.12, 0.38, 0.12], p: [0, 0.06, 0], c: 0x2b2d42 },
          { s: [0.18, 0.10, 0.18], p: [0, -0.15, 0], c: 0xffd43b, glow: true },
          { s: [0.16, 0.08, 0.16], p: [0, 0.24, 0], c: 0xffd43b, glow: true },
          // Stacked giant bouncy purple braid puffs (alternating 0x862e9c & 0xae3ec9 & 0xd0bfff)
          { s: [0.28, 0.18, 0.26], p: [-0.03, 0.38, 0], r: [0, 0, 0.14], c: 0x862e9c, glow: true },
          { s: [0.32, 0.18, 0.30], p: [0.03, 0.54, 0], r: [0, 0, -0.14], c: 0xae3ec9, glow: true },
          { s: [0.36, 0.20, 0.32], p: [-0.03, 0.71, 0], r: [0, 0, 0.12], c: 0x9c36b5, glow: true },
          { s: [0.34, 0.18, 0.30], p: [0.02, 0.88, 0], r: [0, 0, -0.12], c: 0xd0bfff, glow: true },
          // Golden Star Hair-Ribbon Bow & Heart Tassel at the whip tip!
          { s: [0.38, 0.09, 0.16], p: [0, 1.00, 0.04], r: [0, 0, 0.22], c: 0xffd43b, glow: true },
          { s: [0.38, 0.09, 0.16], p: [0, 1.00, 0.04], r: [0, 0, -0.22], c: 0xffd43b, glow: true },
          { s: [0.22, 0.22, 0.14], p: [0, 1.06, 0.06], r: [0, 0, 0.785], c: 0xffe066, glow: true },
          { s: [0.24, 0.16, 0.22], p: [0, 1.18, 0], c: 0x862e9c, glow: true },
        ],
      };

    case 'golden_sahur_mallet':
      // 3. iron_sledge / golden_sahur_mallet: Breezy-Bake Golden Teapot & Crumpet Launcher
      // (Pastel-pink porcelain teapot + stack of buttered golden crumpets)
      return {
        glowEmissive: 0xffb830,
        glowIntensity: 0.36,
        boxes: [
          // Pastel-pink & gold tea-party staff handle
          { s: [0.12, 0.64, 0.12], p: [0, 0.18, 0], c: 0xf783ac },
          { s: [0.18, 0.10, 0.18], p: [0, -0.14, 0], c: 0xffd43b, glow: true },
          { s: [0.16, 0.08, 0.16], p: [0, 0.24, 0], c: 0xfff3bf, glow: true },
          { s: [0.46, 0.07, 0.46], p: [0, 0.52, 0], c: 0xffffff, glow: true },
          // Pastel-Pink & Gold Porcelain Teapot Body (y = 0.72)
          { s: [0.42, 0.34, 0.42], p: [0, 0.72, 0], c: 0xff85c0, glow: true },
          { s: [0.44, 0.08, 0.44], p: [0, 0.72, 0], c: 0xffd43b, glow: true },
          // Curved Golden Teapot Spout (+X) & Dainty Porcelain Handle (-X)
          { s: [0.18, 0.10, 0.10], p: [0.28, 0.76, 0], r: [0, 0, 0.42], c: 0xffd43b, glow: true },
          { s: [0.12, 0.14, 0.10], p: [0.36, 0.86, 0], r: [0, 0, 0.18], c: 0xfff3bf, glow: true },
          { s: [0.14, 0.24, 0.08], p: [-0.26, 0.74, 0], c: 0xfff0f6, glow: true },
          // Stack of Warm Buttered Golden Crumpets perched on the Teapot Lid!
          { s: [0.34, 0.09, 0.34], p: [0, 0.94, 0], c: 0xf59f00, glow: true },
          { s: [0.32, 0.09, 0.32], p: [0, 1.04, 0], c: 0xffd43b, glow: true },
          { s: [0.16, 0.07, 0.16], p: [0, 1.12, 0], c: 0xfff9db, glow: true },
        ],
      };

    case 'neon_thunder_taiko':
      // 4. diamond_cleaver / neon_thunder_taiko: KickinChicken's Rainbow Makeup Blaster
      // (39:11 neon paint blaster with lipstick tube, blush brush & rainbow star barrel)
      return {
        glowEmissive: 0xff6b9d,
        glowIntensity: 0.36,
        boxes: [
          // Sleek purple & gold makeup grip handle
          { s: [0.13, 0.66, 0.13], p: [0, 0.18, 0], c: 0x5f3dc4 },
          { s: [0.18, 0.12, 0.18], p: [0, -0.15, 0], c: 0xffd43b, glow: true },
          { s: [0.16, 0.08, 0.16], p: [0, 0.22, 0], c: 0xff6b9d, glow: true },
          // Rainbow Star Paint Barrel (pink, yellow, cyan, green stripes)
          { s: [0.40, 0.34, 0.64], p: [0, 0.74, 0], c: 0xff6b9d, glow: true },
          { s: [0.42, 0.12, 0.66], p: [0, 0.74, 0], c: 0xffd43b, glow: true },
          { s: [0.44, 0.30, 0.16], p: [0, 0.74, 0.18], c: 0x39d5ff, glow: true },
          { s: [0.44, 0.30, 0.16], p: [0, 0.74, -0.18], c: 0x51cf66, glow: true },
          // Hot-Pink Lipstick Tube Nozzle (+Z) & Fluffy Powder Blush Brush (-Z)
          { s: [0.22, 0.22, 0.18], p: [0, 0.74, 0.40], c: 0xffd43b, glow: true },
          { s: [0.16, 0.16, 0.20], p: [0, 0.74, 0.54], c: 0xff4d6d, glow: true },
          { s: [0.32, 0.32, 0.16], p: [0, 0.74, -0.40], c: 0xffb3d9, glow: true },
          // Golden KickinChicken Star Sight on top
          { s: [0.24, 0.24, 0.10], p: [0, 1.02, 0], r: [0, 0, 0.785], c: 0xffe066, glow: true },
        ],
      };

    case 'rainbow_mega_hammer':
    default:
      // 5. rainbow_blade / rainbow_mega_hammer: Prototype Remote-Control & Magnet Wrench
      // (52:56 glowing cyber-remote with twin antennas, rainbow plasma rings & giant magnet wrench)
      return {
        glowEmissive: 0x39d5ff,
        glowIntensity: 0.38,
        boxes: [
          // Cyber-metallic shaft with glowing rainbow plasma rings
          { s: [0.13, 0.68, 0.13], p: [0, 0.18, 0], c: 0x343a40 },
          { s: [0.20, 0.12, 0.20], p: [0, -0.16, 0], c: 0xffd43b, glow: true },
          { s: [0.18, 0.08, 0.18], p: [0, 0.18, 0], c: 0x39d5ff, glow: true },
          { s: [0.18, 0.08, 0.18], p: [0, 0.40, 0], c: 0xff6b9d, glow: true },
          // Prototype Cyber-Remote Control Box Core (52:56) with red/green/cyan buttons & screen
          { s: [0.44, 0.38, 0.30], p: [0, 0.72, 0], c: 0x2b2d42 },
          { s: [0.32, 0.16, 0.06], p: [0, 0.78, 0.16], c: 0x39d5ff, glow: true },
          { s: [0.10, 0.10, 0.07], p: [-0.10, 0.62, 0.16], c: 0xff595e, glow: true },
          { s: [0.10, 0.10, 0.07], p: [0.10, 0.62, 0.16], c: 0x51cf66, glow: true },
          // Twin Cyber Remote Antennas with glowing yellow/magenta tips
          { s: [0.05, 0.26, 0.05], p: [-0.14, 1.02, -0.04], r: [0, 0, 0.22], c: 0xadb5bd, glow: true },
          { s: [0.05, 0.26, 0.05], p: [0.14, 1.02, -0.04], r: [0, 0, -0.22], c: 0xadb5bd, glow: true },
          { s: [0.11, 0.11, 0.11], p: [-0.20, 1.16, -0.04], c: 0xffd43b, glow: true },
          { s: [0.11, 0.11, 0.11], p: [0.20, 1.16, -0.04], c: 0xff6b9d, glow: true },
          // Giant U-Shaped Red & Blue Magnet Wrench Claws (+Z and -Z) with silver tips!
          { s: [0.36, 0.14, 0.68], p: [0, 0.86, 0], c: 0xe03131, glow: true },
          { s: [0.36, 0.14, 0.68], p: [0, 0.58, 0], c: 0x228be6, glow: true },
          { s: [0.38, 0.14, 0.14], p: [0, 0.86, 0.36], c: 0xf8f9fa, glow: true },
          { s: [0.38, 0.14, 0.14], p: [0, 0.58, 0.36], c: 0xf8f9fa, glow: true },
          { s: [0.38, 0.14, 0.14], p: [0, 0.86, -0.36], c: 0xf8f9fa, glow: true },
          { s: [0.38, 0.14, 0.14], p: [0, 0.58, -0.36], c: 0xf8f9fa, glow: true },
        ],
      };
  }
}

export function buildWeaponMesh(weaponId = 'wooden_kentungan_bat') {
  const validId = resolveGadgetWeaponId(weaponId);
  const spec = getWeaponBoxes(validId);
  return buildVoxelGroup(spec.boxes, {
    name: `weapon_${validId}`,
    glowEmissive: spec.glowEmissive,
    glowIntensity: spec.glowIntensity,
    castShadow: false,
    userData: { kind: 'weapon', weaponId: validId, rawWeaponId: weaponId },
  });
}

export const createWeaponMesh = buildWeaponMesh;

// ---------------------------------------------------------------------------
// 2. 4 Hub Prank Contraptions (Tier 1..3 across the 4 Hub Pads)
// Rooted at y = 0 so they sit flush on the 4 Hub Pads!
// ---------------------------------------------------------------------------

function normalizePotTier(tier) {
  if (tier === 1 || tier === 'glow_pot' || tier === 'totem_tier_1') return 1;
  if (tier === 2 || tier === 'crystal_pot' || tier === 'totem_tier_2') return 2;
  if (tier === 3 || tier === 'ultimate_pot' || tier === 'totem_tier_3') return 3;
  return 0;
}

export function buildFlowerpotMesh(tier = 1, padIndex = 0) {
  const t = normalizePotTier(tier);
  if (t <= 0) {
    const empty = new THREE.Group();
    empty.name = 'flowerpot_tier_0';
    empty.userData = { kind: 'flowerpot', tier: 0, padIndex };
    return empty;
  }

  if (t === 1) {
    // Tier 1: Pink Toy Capsule Tea-Party Pod (24:14)
    // Translucent/pastel pink capsule cylinder with a bouncing Tea-Party Hat & teacup inside!
    const boxes = [
      // Golden & lavender Playcare capsule base ring
      { s: [1.24, 0.14, 1.24], p: [0, 0.07, 0], c: 0x5f3dc4 },
      { s: [1.10, 0.10, 1.10], p: [0, 0.18, 0], c: 0xffd43b, glow: true },
      // Pastel-pink Capsule Pod lower shell & glowing pink glass cylinder
      { s: [0.96, 0.24, 0.96], p: [0, 0.34, 0], c: 0xff6b9d, glow: true },
      { s: [0.84, 0.56, 0.84], p: [0, 0.72, 0], c: 0xffb3d9, glow: true },
      { s: [0.90, 0.52, 0.12], p: [0, 0.72, 0.40], c: 0xfff0f6, glow: true },
      // Bouncing Tea-Party Hat & Pastel Teacup inside/atop the Pink Capsule Pod!
      { s: [0.58, 0.10, 0.58], p: [0, 1.06, 0], c: 0xff85c0, glow: true },
      { s: [0.42, 0.28, 0.42], p: [0, 1.24, 0], c: 0xae3ec9, glow: true },
      { s: [0.44, 0.08, 0.44], p: [0, 1.18, 0], c: 0xffd43b, glow: true },
      // Dainty white-and-gold teacup + saucer perched on top
      { s: [0.36, 0.06, 0.36], p: [0, 1.42, 0], c: 0xffffff, glow: true },
      { s: [0.24, 0.18, 0.24], p: [0, 1.54, 0], c: 0x39d5ff, glow: true },
      { s: [0.10, 0.12, 0.06], p: [0.16, 1.54, 0], c: 0xffd43b, glow: true },
    ];
    return buildVoxelGroup(boxes, {
      name: 'flowerpot_tier_1',
      glowEmissive: 0xff85c0,
      glowIntensity: 0.36,
      userData: { kind: 'flowerpot', tier: 1, padIndex },
    });
  }

  if (t === 2) {
    // Tier 2: Lily's Dollhouse Crumpet Oven & Stocked Fridge (33:19)
    // Pink Breezy-Bake oven + open mini-fridge with watermelon & floating golden crumpets!
    const boxes = [
      // Checkerboard dollhouse kitchen platform
      { s: [1.44, 0.12, 1.18], p: [0, 0.06, 0], c: 0xd0bfff, glow: true },
      // Left: Pastel-Pink Breezy-Bake Crumpet Oven (x = -0.34)
      { s: [0.68, 0.84, 0.88], p: [-0.34, 0.54, 0], c: 0xff6b9d, glow: true },
      // Glowing warm orange-gold oven window & baking crumpet tray
      { s: [0.48, 0.36, 0.08], p: [-0.34, 0.48, 0.44], c: 0xffd43b, glow: true },
      { s: [0.36, 0.12, 0.09], p: [-0.34, 0.44, 0.45], c: 0xf59f00, glow: true },
      // Oven dials & pink stove hood
      { s: [0.10, 0.10, 0.08], p: [-0.50, 0.80, 0.44], c: 0xffffff, glow: true },
      { s: [0.10, 0.10, 0.08], p: [-0.18, 0.80, 0.44], c: 0xffffff, glow: true },
      { s: [0.72, 0.14, 0.92], p: [-0.34, 1.02, 0], c: 0xff85c0, glow: true },

      // Right: Open Stocked Dollhouse Mini-Fridge (x = +0.36) with Watermelon & Treats!
      { s: [0.64, 1.02, 0.88], p: [0.36, 0.62, 0], c: 0x99e9f2, glow: true },
      { s: [0.52, 0.86, 0.08], p: [0.36, 0.62, 0.42], c: 0xffffff, glow: true },
      // Open fridge door swung out on +X/+Z
      { s: [0.10, 0.88, 0.44], p: [0.68, 0.62, 0.56], r: [0, -0.35, 0], c: 0x39d5ff, glow: true },
      // Juicy Green & Red Watermelon inside the fridge!
      { s: [0.34, 0.24, 0.24], p: [0.36, 0.42, 0.44], c: 0x2b8a3e },
      { s: [0.28, 0.18, 0.26], p: [0.36, 0.44, 0.46], c: 0xff4d6d, glow: true },
      // Floating Golden Buttered Crumpets rising above the oven & fridge!
      { s: [0.42, 0.12, 0.42], p: [-0.28, 1.24, 0], c: 0xf59f00, glow: true },
      { s: [0.38, 0.12, 0.38], p: [0.24, 1.34, 0], c: 0xffd43b, glow: true },
      { s: [0.22, 0.22, 0.12], p: [0, 1.56, 0], r: [0, 0, 0.785], c: 0xffe066, glow: true },
    ];
    return buildVoxelGroup(boxes, {
      name: 'flowerpot_tier_2',
      glowEmissive: 0xff922b,
      glowIntensity: 0.36,
      userData: { kind: 'flowerpot', tier: 2, padIndex },
    });
  }

  // Tier 3: Ultimate GrabPack & Rainbow Makeup Prank Turret (39:11)
  // Golden-crowned prank machine with spinning purple braids, Blue/Red GrabPack hands & confetti fountain!
  const baseBoxes = [
    // Starlight Lavender & Gold Pedestal Base
    { s: [1.54, 0.20, 1.44], p: [0, 0.10, 0], c: 0x5f3dc4, glow: true },
    { s: [1.60, 0.08, 1.50], p: [0, 0.24, 0], c: 0xffd43b, glow: true },
    // Rainbow Makeup & Tea-Party Turret Core
    { s: [1.18, 0.48, 1.12], p: [0, 0.52, 0], c: 0x9c36b5, glow: true },
    { s: [1.26, 0.12, 1.20], p: [0, 0.80, 0], c: 0xffd43b, glow: true },
    // Twin Spinning Purple Braid Coils on front/back
    { s: [0.28, 0.64, 0.28], p: [-0.46, 0.96, 0.42], r: [0, 0, 0.18], c: 0xae3ec9, glow: true },
    { s: [0.28, 0.64, 0.28], p: [0.46, 0.96, 0.42], r: [0, 0, -0.18], c: 0xae3ec9, glow: true },
    // Left Blue GrabPack Launcher Arm (-X) & Right Red GrabPack Launcher Arm (+X)
    { s: [0.36, 0.32, 0.16], p: [-0.72, 1.12, 0], r: [0, 0, 0.32], c: 0x228be6, glow: true },
    { s: [0.36, 0.32, 0.16], p: [0.72, 1.12, 0], r: [0, 0, -0.32], c: 0xe03131, glow: true },
    // Upper Rainbow Makeup Fountain Tower
    { s: [0.88, 0.42, 0.88], p: [0, 1.08, 0], c: 0xff6b9d, glow: true },
    { s: [0.96, 0.12, 0.96], p: [0, 1.34, 0], c: 0x39d5ff, glow: true },
    // Golden Prank Crown & Confetti Star Fountain Topper (y ~ 1.85..2.22)
    { s: [0.68, 0.22, 0.68], p: [0, 1.54, 0], c: 0xffd43b, glow: true },
    { s: [0.16, 0.24, 0.16], p: [-0.24, 1.74, 0.24], c: 0xfff3bf, glow: true },
    { s: [0.16, 0.28, 0.16], p: [0, 1.78, 0.26], c: 0xff4d6d, glow: true },
    { s: [0.16, 0.24, 0.16], p: [0.24, 1.74, 0.24], c: 0xfff3bf, glow: true },
    { s: [0.54, 0.16, 0.14], p: [0, 2.06, 0], c: 0xffd43b, glow: true },
    { s: [0.16, 0.54, 0.14], p: [0, 2.06, 0], c: 0xfff9db, glow: true },
    { s: [0.42, 0.14, 0.12], p: [0, 2.06, 0], r: [0, 0, 0.785], c: 0x39d5ff, glow: true },
  ];

  return buildVoxelGroup(baseBoxes, {
    name: 'flowerpot_tier_3',
    glowEmissive: 0xffc038,
    glowIntensity: 0.40,
    userData: { kind: 'flowerpot', tier: 3, padIndex },
  });
}

export const createFlowerpotMesh = buildFlowerpotMesh;

// ---------------------------------------------------------------------------
// 3. 3D Hub Golden Prank Trophies (for the 4 Trophy Stage Pedestals)
// ---------------------------------------------------------------------------

export function buildTrophyMesh(rawTitanId = 'tralalero_tralala') {
  const titanId = resolveBossId(rawTitanId);
  const accentMap = {
    tralalero_tralala: 0xff85c0,
    bombardiro_crocodilo: 0x9775fa,
    brr_brr_patapim: 0x39d5ff,
    golden_sahur_king: 0xff4d6d,
  };
  const accent = accentMap[titanId] || 0xff85c0;

  const boxes = [
    { s: [0.76, 0.12, 0.76], p: [0, 0.06, 0], c: 0x3b384a },
    { s: [0.64, 0.10, 0.64], p: [0, 0.17, 0], c: 0xffd43b, glow: true },
    { s: [0.70, 0.08, 0.24], p: [0, 0.17, 0], c: 0xffec99, glow: true },
    { s: [0.24, 0.08, 0.70], p: [0, 0.17, 0], c: 0xffec99, glow: true },
    { s: [0.22, 0.28, 0.22], p: [0, 0.36, 0], c: 0xffb830, glow: true },
    { s: [0.30, 0.10, 0.30], p: [0, 0.52, 0], c: accent, glow: true },
    { s: [0.54, 0.38, 0.54], p: [0, 0.76, 0], c: 0xffd43b, glow: true },
    { s: [0.62, 0.10, 0.62], p: [0, 0.96, 0], c: 0xfff3bf, glow: true },
    { s: [0.10, 0.26, 0.12], p: [-0.36, 0.78, 0], c: 0xffec99, glow: true },
    { s: [0.10, 0.26, 0.12], p: [0.36, 0.78, 0], c: 0xffec99, glow: true },
    { s: [0.20, 0.20, 0.08], p: [0, 0.76, 0.28], c: accent, glow: true },
  ];

  if (titanId === 'tralalero_tralala') {
    // Wave 1 Trophy: Miss Gracie's Pink Capsule Pod & Tea-Party Hat Topper
    boxes.push(
      { s: [0.44, 0.10, 0.44], p: [0, 1.08, 0], c: 0xff85c0, glow: true },
      { s: [0.32, 0.22, 0.32], p: [0, 1.22, 0], c: 0xae3ec9, glow: true },
      { s: [0.22, 0.14, 0.22], p: [0, 1.38, 0], c: 0x39d5ff, glow: true }
    );
  } else if (titanId === 'bombardiro_crocodilo') {
    // Wave 2 Trophy: CatNap's Crescent Moon Charm, Golden Crumpet & Watermelon Topper
    boxes.push(
      { s: [0.36, 0.24, 0.34], p: [0, 1.14, 0], c: 0x7950f2, glow: true },
      { s: [0.24, 0.20, 0.10], p: [0, 1.16, 0.18], c: 0xffd43b, glow: true },
      { s: [0.30, 0.12, 0.30], p: [0, 1.34, 0], c: 0xf59f00, glow: true }
    );
  } else if (titanId === 'brr_brr_patapim') {
    // Wave 3 Trophy: Prototype's Two-Horned Jester Hat & Tiny Yellow Shoes Topper
    boxes.push(
      { s: [0.24, 0.24, 0.22], p: [-0.12, 1.18, 0], r: [0, 0, 0.35], c: 0x1c7ed6, glow: true },
      { s: [0.24, 0.24, 0.22], p: [0.12, 1.18, 0], r: [0, 0, -0.35], c: 0xe03131, glow: true },
      { s: [0.16, 0.12, 0.22], p: [-0.10, 1.36, 0.04], c: 0xffd43b, glow: true },
      { s: [0.16, 0.12, 0.22], p: [0.10, 1.36, 0.04], c: 0xffd43b, glow: true }
    );
  } else {
    // Wave 4 Trophy: Clown-Makeover Rainbow Wig, Big Red Clown Nose & Golden Prank Crown Topper
    boxes.push(
      { s: [0.46, 0.18, 0.44], p: [0, 1.10, 0], c: 0xffd43b, glow: true },
      { s: [0.22, 0.20, 0.22], p: [-0.16, 1.26, 0], c: 0x39d5ff, glow: true },
      { s: [0.22, 0.20, 0.22], p: [0.16, 1.26, 0], c: 0x51cf66, glow: true },
      { s: [0.18, 0.18, 0.18], p: [0, 1.22, 0.22], c: 0xe03131, glow: true },
      { s: [0.26, 0.18, 0.26], p: [0, 1.36, 0], c: 0xff6b9d, glow: true }
    );
  }

  return buildVoxelGroup(boxes, {
    name: `trophy_${titanId}`,
    glowEmissive: 0xffc038,
    glowIntensity: 0.38,
    userData: { kind: 'trophy', titanId },
  });
}

export const createTrophyMesh = buildTrophyMesh;

// ---------------------------------------------------------------------------
// 4. Reusable Hero Gear & Bouncy Tea-Party Cushion Cloud Builders
// ---------------------------------------------------------------------------

export function buildBlazingHelmetMesh() {
  // Golden Tea-Party Crown & Star Glasses on Lily Lovebraids' head!
  const boxes = [
    // Golden Tea-Party Crown rim & pastel-pink tea saucer brim
    { s: [0.74, 0.14, 0.72], p: [0, 0.30, 0], c: 0xffd43b, glow: true },
    { s: [0.64, 0.10, 0.62], p: [0, 0.40, 0], c: 0xff85c0, glow: true },
    // Crown spires & mini golden teacup on top
    { s: [0.14, 0.18, 0.14], p: [-0.22, 0.48, 0.22], c: 0xfff3bf, glow: true },
    { s: [0.20, 0.22, 0.20], p: [0, 0.50, 0], c: 0x39d5ff, glow: true },
    { s: [0.14, 0.18, 0.14], p: [0.22, 0.48, 0.22], c: 0xfff3bf, glow: true },
    // Glowing Golden Star Glasses across Lily's eyes (+Z)
    { s: [0.68, 0.06, 0.08], p: [0, 0.02, 0.31], c: 0xffd43b, glow: true },
    { s: [0.22, 0.20, 0.09], p: [-0.16, 0.02, 0.32], r: [0, 0, 0.785], c: 0xffe066, glow: true },
    { s: [0.22, 0.20, 0.09], p: [0.16, 0.02, 0.32], r: [0, 0, 0.785], c: 0xffe066, glow: true },
    { s: [0.12, 0.12, 0.10], p: [-0.16, 0.02, 0.33], c: 0xff6b9d, glow: true },
    { s: [0.12, 0.12, 0.10], p: [0.16, 0.02, 0.33], c: 0x39d5ff, glow: true },
  ];
  return buildVoxelGroup(boxes, {
    name: 'blazing_gold_helmet',
    glowEmissive: 0xffc038,
    glowIntensity: 0.40,
    userData: { kind: 'gear', gear: 'helmet' },
  });
}

export function buildKingCrownMesh() {
  const boxes = [
    { s: [0.58, 0.14, 0.58], p: [0, 0.07, 0], c: 0xffd43b, glow: true },
    { s: [0.12, 0.18, 0.12], p: [-0.22, 0.21, 0.22], c: 0xfff3bf, glow: true },
    { s: [0.14, 0.24, 0.12], p: [0, 0.24, 0.24], c: 0xffd43b, glow: true },
    { s: [0.12, 0.18, 0.12], p: [0.22, 0.21, 0.22], c: 0xfff3bf, glow: true },
    { s: [0.12, 0.18, 0.12], p: [-0.22, 0.21, -0.22], c: 0xfff3bf, glow: true },
    { s: [0.12, 0.18, 0.12], p: [0.22, 0.21, -0.22], c: 0xfff3bf, glow: true },
    { s: [0.12, 0.12, 0.08], p: [0, 0.10, 0.29], c: 0xff4d6d, glow: true },
    { s: [0.10, 0.10, 0.08], p: [-0.18, 0.09, 0.28], c: 0x39d5ff, glow: true },
    { s: [0.10, 0.10, 0.08], p: [0.18, 0.09, 0.28], c: 0x51cf66, glow: true },
  ];
  return buildVoxelGroup(boxes, {
    name: 'king_crown',
    glowEmissive: 0xffc940,
    glowIntensity: 0.42,
    userData: { kind: 'gear', gear: 'crown' },
  });
}

export function buildStarCapeMesh() {
  // Royal Starlight Prank Cape (lavender, royal purple, hot-pink & golden star emblem)
  const boxes = [
    { s: [0.56, 0.16, 0.07], p: [0, -0.08, 0], c: 0x9c36b5, glow: true },
    { s: [0.60, 0.18, 0.07], p: [0, -0.25, -0.02], c: 0xae3ec9, glow: true },
    { s: [0.64, 0.18, 0.07], p: [0, -0.43, -0.04], c: 0xff6b9d, glow: true },
    { s: [0.68, 0.18, 0.07], p: [0, -0.61, -0.06], c: 0xffd43b, glow: true },
    { s: [0.24, 0.24, 0.09], p: [0, -0.34, -0.05], r: [0, 0, 0.785], c: 0xfff9db, glow: true },
  ];
  return buildVoxelGroup(boxes, {
    name: 'royal_star_cape',
    glowEmissive: 0xd0bfff,
    glowIntensity: 0.34,
    userData: { kind: 'gear', gear: 'starCape' },
  });
}

export function buildWingedBootOverlay(side = 1) {
  // Rocket GrabPack Roller-Skates (swaps 1 mesh -> 1 mesh, 0 extra draw calls!)
  const boxes = [
    { s: [0.22, 0.28, 0.22], p: [0, -0.14, 0], c: 0x2b2d42 },
    { s: [0.28, 0.18, 0.36], p: [0, -0.34, 0.04], c: 0x9c36b5, glow: true },
    { s: [0.30, 0.06, 0.38], p: [0, -0.43, 0.04], c: 0xffd43b, glow: true },
    // Glowing cyan/gold roller-skate wheels
    { s: [0.08, 0.09, 0.10], p: [side * 0.14, -0.46, 0.14], c: 0x39d5ff, glow: true },
    { s: [0.08, 0.09, 0.10], p: [side * 0.14, -0.46, -0.06], c: 0x39d5ff, glow: true },
    // Rocket GrabPack thruster & wing on outer ankle
    { s: [0.10, 0.20, 0.14], p: [side * 0.16, -0.28, -0.10], r: [0.25, side * 0.22, 0], c: side > 0 ? 0x228be6 : 0xe03131, glow: true },
    { s: [0.08, 0.14, 0.18], p: [side * 0.20, -0.18, -0.16], r: [0.35, side * 0.28, 0], c: 0xffe066, glow: true },
  ];
  return buildVoxelGroup(boxes, {
    name: `winged_boot_${side < 0 ? 'r' : 'l'}`,
    glowEmissive: 0x66d9e8,
    glowIntensity: 0.34,
    userData: { kind: 'gear', gear: 'speedBoots' },
  });
}

export function buildRainbowSpringCloudMesh() {
  // Giant Fluffy Pink Tea-Party Cushion & GrabPack Spring Cloud (BOING!)
  const boxes = [
    { s: [0.68, 0.12, 0.68], p: [0, 0.08, 0], c: 0xffd43b, glow: true },
    { s: [1.18, 0.18, 1.08], p: [0, 0.22, 0], c: 0xae3ec9, glow: true },
    { s: [1.56, 0.22, 1.38], p: [0, 0.40, 0], c: 0xff85c0, glow: true },
    { s: [1.46, 0.18, 1.28], p: [0, 0.56, 0], c: 0xd0bfff, glow: true },
    { s: [1.22, 0.26, 1.08], p: [0, 0.72, 0], c: 0xfff0f6, glow: true },
    { s: [0.70, 0.08, 0.70], p: [0, 0.87, 0], c: 0xffd43b, glow: true },
    { s: [0.56, 0.34, 0.56], p: [-0.74, 0.46, 0.38], c: 0xff595e, glow: true },
    { s: [0.56, 0.34, 0.56], p: [-0.76, 0.46, -0.32], c: 0xff922b, glow: true },
    { s: [0.56, 0.34, 0.56], p: [0, 0.48, 0.68], c: 0xffd43b, glow: true },
    { s: [0.56, 0.34, 0.56], p: [0.74, 0.46, 0.38], c: 0x51cf66, glow: true },
    { s: [0.56, 0.34, 0.56], p: [0.76, 0.46, -0.32], c: 0x39d5ff, glow: true },
    { s: [0.56, 0.34, 0.56], p: [0, 0.48, -0.68], c: 0xff6b9d, glow: true },
  ];
  return buildVoxelGroup(boxes, {
    name: 'rainbow_spring_cloud',
    glowEmissive: 0xfff0cc,
    glowIntensity: 0.36,
    castShadow: false,
    userData: { kind: 'spring_cloud' },
  });
}

// ---------------------------------------------------------------------------
// 5. Crisp 2D 16x16 Pixel-Art Prank Gadget Icons (for Roulette Wheel & HUD)
// Zero text calls so l10n_audit canvas hooks see 0 strings!
// ---------------------------------------------------------------------------

const PIXEL_ICON_SPECS = {
  wooden_kentungan_bat: {
    bgTop: '#e7f5ff',
    bgBot: '#339af0',
    ring: '#1864ab',
    palette: {
      O: '#182232',
      B: '#228be6',
      R: '#e03131',
      Y: '#ffd43b',
      W: '#ffffff',
    },
    grid: [
      '................',
      '..OO.OO..OO.OO..',
      '.OBBOBB..RROrRO.'.replace('r', 'R'),
      '.OBBBBB..RRRRRO.',
      '..OBBBB..RRRRO..',
      '...OOOO..OOOO...',
      '....OYYOOYYO....',
      '.....OYYYYO.....',
      '.....OOOOOO.....',
      '......OYYO......',
      '......OOOO......',
      '......OYYO......',
      '.....OOYYOO.....',
      '.....OYYYYO.....',
      '......OOOO......',
      '................',
    ],
  },
  bronze_temple_gong: {
    bgTop: '#f8f0fc',
    bgBot: '#ae3ec9',
    ring: '#5f3dc4',
    palette: {
      O: '#21183c',
      P: '#9c36b5',
      L: '#d0bfff',
      Y: '#ffd43b',
      W: '#ffffff',
    },
    grid: [
      '................',
      '......OOOO......',
      '....OOYYYYOO....',
      '...OYYWWWWYYO...',
      '....OOYYYYOO....',
      '....OOPPPPOO....',
      '...OPPLLLLPP0...'.replace('0', 'O'),
      '....OOPPPPOO....',
      '...OPPLLLLPPO...',
      '....OOPPPPOO....',
      '......OYYO......',
      '......OPPO......',
      '.....OOYYOO.....',
      '.....OYYYYO.....',
      '......OOOO......',
      '................',
    ],
  },
  golden_sahur_mallet: {
    bgTop: '#fff0f6',
    bgBot: '#f783ac',
    ring: '#a61e4d',
    palette: {
      O: '#3b230a',
      P: '#ff85c0',
      G: '#ffd43b',
      C: '#f59f00',
      W: '#ffffff',
    },
    grid: [
      '................',
      '.....OOOOOO.....',
      '....OGGGGGGO....',
      '....OCCCCCCO....',
      '..OOOPPPPPPOOO..',
      '.OWOPPPPPPPPOGO.',
      '.OWOPGGGGGGPOGO.',
      '..OOOPPPPPPOOO..',
      '....OOOWWWOO....',
      '......OPPO......',
      '.....OOGGOO.....',
      '......OPPO......',
      '.....OOGGOO.....',
      '.....OGGGGO.....',
      '......OOOO......',
      '................',
    ],
  },
  neon_thunder_taiko: {
    bgTop: '#f3f0ff',
    bgBot: '#9775fa',
    ring: '#5f3dc4',
    palette: {
      O: '#21183c',
      P: '#ff6b9d',
      C: '#39d5ff',
      G: '#ffd43b',
      E: '#51cf66',
      W: '#ffffff',
    },
    grid: [
      '......OOOO......',
      '.....OGWWGO.....',
      '..OOOOPPPPOOOO..',
      '.OCEEPGGGGPEECO.',
      '.OCEEPPPPPPPECO.',
      '.OCEEPGGGGPEECO.',
      '..OOOOPPPPOOOO..',
      '.....OOOOOO.....',
      '......OPPO......',
      '......OCCO......',
      '......OGGO......',
      '.....OOGGOO.....',
      '.....OGGGGO.....',
      '......OOOO......',
      '................',
      '................',
    ],
  },
  rainbow_mega_hammer: {
    bgTop: '#e3fafc',
    bgBot: '#22b8cf',
    ring: '#0b7285',
    palette: {
      O: '#182232',
      R: '#e03131',
      B: '#228be6',
      Y: '#ffd43b',
      C: '#39d5ff',
      W: '#ffffff',
    },
    grid: [
      '..OO........OO..',
      '..OYO......OYO..',
      '..OWRRRRRRRRWO..',
      '..OOOOOOOOOOOO..',
      '...OOCWWWWCOO...',
      '...OORYYYYCBO...',
      '..OOOOOOOOOOOO..',
      '..OWBBBBBBBBWO..',
      '....OOOWWWOO....',
      '......OCCO......',
      '.....OOYYOO.....',
      '......OCCO......',
      '.....OOYYOO.....',
      '......OOOO......',
      '................',
      '................',
    ],
  },
};

export function renderWeaponIconDataURL(weaponId = 'wooden_kentungan_bat', size = 128) {
  const validId = resolveGadgetWeaponId(weaponId);
  const pxSize = Math.max(32, Math.round(Number(size) || 128));
  const cacheKey = `${validId}:${pxSize}`;
  const cached = iconDataUrlCache.get(cacheKey);
  if (cached) return cached;

  const spec = PIXEL_ICON_SPECS[validId] || PIXEL_ICON_SPECS.wooden_kentungan_bat;

  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxSize}" height="${pxSize}" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="${spec.bgBot}"/></svg>`;
    const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    iconDataUrlCache.set(cacheKey, fallback);
    return fallback;
  }

  const canvas = document.createElement('canvas');
  canvas.width = pxSize;
  canvas.height = pxSize;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return '';
  ctx2d.imageSmoothingEnabled = false;

  const r = pxSize * 0.46;
  const cx = pxSize * 0.5;
  const cy = pxSize * 0.5;
  const grad = ctx2d.createRadialGradient(cx, cy * 0.78, pxSize * 0.08, cx, cy, r);
  grad.addColorStop(0, spec.bgTop);
  grad.addColorStop(1, spec.bgBot);

  ctx2d.fillStyle = grad;
  ctx2d.beginPath();
  ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
  ctx2d.fill();

  ctx2d.lineWidth = Math.max(3, Math.round(pxSize * 0.055));
  ctx2d.strokeStyle = spec.ring;
  ctx2d.stroke();

  const pad = Math.round(pxSize * 0.14);
  const cell = (pxSize - pad * 2) / 16;
  for (let row = 0; row < 16; row++) {
    const line = spec.grid[row];
    for (let col = 0; col < 16; col++) {
      const ch = line[col];
      if (!ch || ch === '.') continue;
      const fill = spec.palette[ch];
      if (!fill) continue;
      ctx2d.fillStyle = fill;
      const x0 = Math.floor(pad + col * cell);
      const y0 = Math.floor(pad + row * cell);
      const x1 = Math.floor(pad + (col + 1) * cell);
      const y1 = Math.floor(pad + (row + 1) * cell);
      ctx2d.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }

  ctx2d.fillStyle = '#ffffff';
  const sp = Math.max(3, Math.round(pxSize * 0.045));
  ctx2d.fillRect(Math.round(pxSize * 0.20), Math.round(pxSize * 0.22), sp, sp * 2.2);
  ctx2d.fillRect(Math.round(pxSize * 0.20 - sp * 0.6), Math.round(pxSize * 0.22 + sp * 0.6), sp * 2.2, sp);
  ctx2d.fillRect(Math.round(pxSize * 0.75), Math.round(pxSize * 0.72), sp, sp * 1.8);
  ctx2d.fillRect(Math.round(pxSize * 0.75 - sp * 0.4), Math.round(pxSize * 0.72 + sp * 0.4), sp * 1.8, sp);

  const url = canvas.toDataURL('image/png');
  iconDataUrlCache.set(cacheKey, url);
  return url;
}

export const buildWeaponPreviewDataURL = renderWeaponIconDataURL;
