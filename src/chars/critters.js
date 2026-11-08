// 8 Friendly Playcare Walking Buddies (Poppy Playtime Chapter 5 Civil War):
// Styled as cute 3D voxel plushies & buddies:
// 1. hoppy_hopscotch: Hoppy Hopscotch (bright mint-green bunny with tall perky ears & golden lightning pendant)
// 2. kickin_chicken: KickinChicken (sunny yellow cool chicken with orange crest/beak, red sneakers & cyan star pendant)
// 3. baba_chops: Baba Chops (fluffy charcoal-black & wool-white sheep with cute curled ears & silver skull/star charm)
// 4. dogday: DogDay (sunny orange pup with floppy brown ears, wagging tail & golden sun pendant)
// 5. huggy_wuggy: Huggy Wuggy (bright blue fuzzy buddy with cheerful red grin, yellow hands/feet & yellow bowtie)
// 6. kissy_missy: Kissy Missy (pastel-pink fuzzy buddy with long eyelashes, red grin, yellow hands/feet & pink heart bow)
// Zero CJK text, metalness <= 0.20, 6-draw-call InstancedMesh, 100% deterministic.

import * as THREE from '../../vendor/three.module.min.js';
import { CRITTER_TYPES } from '../data/catalog.js';
import {
  createSafeSpriteMaterial,
  getMatteVoxelMaterial,
  mergeVoxelBoxes,
} from './props3d.js';

const CRITTER_ALIAS = Object.freeze({
  mini_cappuccina: 'mini_cappuccina',
  piggy: 'mini_cappuccina',
  hoppy_hopscotch: 'mini_cappuccina',
  dogday: 'mini_cappuccina',
  mini_bananini: 'mini_bananini',
  bee: 'mini_bananini',
  kickin_chicken: 'mini_bananini',
  baba_chops: 'mini_bananini',
  mini_lirili: 'mini_lirili',
  chick: 'mini_lirili',
  huggy_wuggy: 'mini_lirili',
  kissy_missy: 'mini_lirili',
});

export function resolveCritterKind(kind) {
  return CRITTER_ALIAS[kind] || 'mini_cappuccina';
}

const BUDDY_MODEL_IDS = Object.freeze([
  'hoppy_hopscotch',
  'kickin_chicken',
  'baba_chops',
  'dogday',
  'huggy_wuggy',
  'kissy_missy',
]);

// 9 Friendly Playcare Walking Buddies around the Playcare Hub
const AMBIENT_CRITTER_SPAWNS = Object.freeze([
  Object.freeze({ kind: 'mini_cappuccina', buddyModel: 'hoppy_hopscotch', x: -12.5, z: 11.5 }),
  Object.freeze({ kind: 'mini_cappuccina', buddyModel: 'dogday', x: -22.5, z: 13.5 }),
  Object.freeze({ kind: 'mini_cappuccina', buddyModel: 'hoppy_hopscotch', x: -14.5, z: 23.5 }),
  Object.freeze({ kind: 'mini_bananini', buddyModel: 'kickin_chicken', x: -10.5, z: 16.5 }),
  Object.freeze({ kind: 'mini_bananini', buddyModel: 'baba_chops', x: 12.5, z: 11.5 }),
  Object.freeze({ kind: 'mini_bananini', buddyModel: 'kickin_chicken', x: 22.5, z: 14.5 }),
  Object.freeze({ kind: 'mini_lirili', buddyModel: 'huggy_wuggy', x: 11.5, z: 17.5 }),
  Object.freeze({ kind: 'mini_lirili', buddyModel: 'kissy_missy', x: 15.5, z: 23.5 }),
  Object.freeze({ kind: 'mini_lirili', buddyModel: 'dogday', x: 23.5, z: 21.5 }),
]);

const MAX_PER_MODEL = 12;
const MAX_CRITTERS = 24;
const PET_DURATION = 0.85;
const HEART_POOL_SIZE = 6;

const sharedBuddyGeos = new Map();
let sharedHeartStarTex = null;

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function hashSeed(seed, idx) {
  let h = ((Number(seed) >>> 0) ^ Math.imul(idx + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function getHeartTexture() {
  if (sharedHeartStarTex) return sharedHeartStarTex;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c2d = canvas.getContext('2d');
  if (!c2d) return null;
  c2d.imageSmoothingEnabled = false;

  // Pink heart + sparkling golden star badge texture
  const grid = [
    '...........YY...',
    '..OOOO....YYYY..',
    '.ORRRRO..OYYYYO.',
    'ORRWWROOORRRRRRO',
    'ORRWWRRRRRRRRRRO',
    'ORRRRRRRRRRRRRRO',
    'ORRRRRRRRRRRRRRO',
    '.ORRRRRRRRRRRRO.',
    '..ORRRRRRRRRRO..',
    '...ORRRRRRRRO...',
    '....ORRRRRRO....',
    '.....ORRRRO.....',
    '..YY..ORRO......',
    '.YYYY..OO.......',
    '..YY............',
    '................',
  ];
  const pal = { O: '#590d22', R: '#ff4d6d', W: '#fff0f3', Y: '#ffd43b' };
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const ch = grid[r][c];
      if (ch === '.') continue;
      c2d.fillStyle = pal[ch];
      c2d.fillRect(c * 4, r * 4, 4, 4);
    }
  }
  sharedHeartStarTex = new THREE.CanvasTexture(canvas);
  sharedHeartStarTex.magFilter = THREE.NearestFilter;
  sharedHeartStarTex.minFilter = THREE.NearestFilter;
  sharedHeartStarTex.colorSpace = THREE.SRGBColorSpace;
  return sharedHeartStarTex;
}

function resolveBuddyModel(rawModel, validKind, seq) {
  if (rawModel && BUDDY_MODEL_IDS.includes(rawModel)) {
    return rawModel;
  }
  if (validKind === 'mini_cappuccina') {
    return seq % 2 === 0 ? 'dogday' : 'hoppy_hopscotch';
  }
  if (validKind === 'mini_bananini') {
    return seq % 2 === 0 ? 'baba_chops' : 'kickin_chicken';
  }
  return seq % 2 === 0 ? 'kissy_missy' : 'huggy_wuggy';
}

function getBuddyGeometry(buddyModelId) {
  const modelKey = BUDDY_MODEL_IDS.includes(buddyModelId) ? buddyModelId : 'hoppy_hopscotch';
  let geo = sharedBuddyGeos.get(modelKey);
  if (geo) return geo;

  let boxes;
  if (modelKey === 'hoppy_hopscotch') {
    // 1. Hoppy Hopscotch: bright mint-green bunny (0x51cf66) with tall perky bunny ears,
    // pastel pink inner ears, white tummy patch, cotton tail, and glowing yellow lightning bolt pendant!
    boxes = [
      // Dark green paws & bouncy bunny feet
      { s: [0.16, 0.14, 0.22], p: [-0.13, 0.07, 0.03], c: 0x2b8a3e },
      { s: [0.16, 0.14, 0.22], p: [0.13, 0.07, 0.03], c: 0x2b8a3e },
      // Mint-green plush body + lighter mint belly + golden zipper & lightning bolt pendant
      { s: [0.44, 0.36, 0.36], p: [0, 0.28, 0], c: 0x51cf66 },
      { s: [0.28, 0.28, 0.05], p: [0, 0.28, 0.17], c: 0xb2f2bb },
      { s: [0.12, 0.18, 0.07], p: [0, 0.31, 0.19], r: [0, 0, -0.35], c: 0xffd43b, glow: true },
      // Fluffy white bunny cotton tail
      { s: [0.16, 0.16, 0.14], p: [0, 0.22, -0.22], c: 0xffffff, glow: true },
      // Green bunny head + wide Smiling Critters grin + big cartoon eyes
      { s: [0.46, 0.34, 0.40], p: [0, 0.58, 0.02], c: 0x51cf66 },
      { s: [0.11, 0.11, 0.06], p: [-0.14, 0.62, 0.21], c: 0xffffff, glow: true },
      { s: [0.11, 0.11, 0.06], p: [0.14, 0.62, 0.21], c: 0xffffff, glow: true },
      { s: [0.06, 0.07, 0.07], p: [-0.14, 0.62, 0.22], c: 0x182232 },
      { s: [0.06, 0.07, 0.07], p: [0.14, 0.62, 0.22], c: 0x182232 },
      { s: [0.08, 0.06, 0.06], p: [0, 0.57, 0.22], c: 0xff85c0, glow: true },
      { s: [0.24, 0.09, 0.06], p: [0, 0.49, 0.21], c: 0x182232 },
      // Tall perky green bunny ears with pastel-pink inner ears
      { s: [0.13, 0.32, 0.10], p: [-0.14, 0.88, 0.0], r: [0.08, 0, 0.08], c: 0x51cf66 },
      { s: [0.13, 0.32, 0.10], p: [0.14, 0.88, 0.0], r: [0.08, 0, -0.08], c: 0x51cf66 },
      { s: [0.07, 0.22, 0.05], p: [-0.14, 0.88, 0.04], r: [0.08, 0, 0.08], c: 0xff85c0, glow: true },
      { s: [0.07, 0.22, 0.05], p: [0.14, 0.88, 0.04], r: [0.08, 0, -0.08], c: 0xff85c0, glow: true },
    ];
  } else if (modelKey === 'kickin_chicken') {
    // 2. KickinChicken: sunny golden-yellow cool chicken (0xffd43b) with orange beak & feather crest (0xff922b),
    // red sneakers, feathered wings, and glowing cyan/white star pendant!
    boxes = [
      // Cool orange legs & bright red sneakers
      { s: [0.16, 0.14, 0.22], p: [-0.13, 0.07, 0.04], c: 0xe03131, glow: true },
      { s: [0.16, 0.14, 0.22], p: [0.13, 0.07, 0.04], c: 0xe03131, glow: true },
      // Sunny yellow plush chicken body + glowing cyan star pendant
      { s: [0.46, 0.38, 0.38], p: [0, 0.29, 0], c: 0xffd43b, glow: true },
      { s: [0.12, 0.26, 0.24], p: [-0.27, 0.30, 0], r: [0, 0, 0.18], c: 0xfcc419 },
      { s: [0.12, 0.26, 0.24], p: [0.27, 0.30, 0], r: [0, 0, -0.18], c: 0xfcc419 },
      { s: [0.15, 0.15, 0.07], p: [0, 0.32, 0.19], r: [0, 0, 0.785], c: 0x39d5ff, glow: true },
      // Yellow chicken head + orange beak + spiky feather crest on top!
      { s: [0.46, 0.34, 0.40], p: [0, 0.58, 0.02], c: 0xffd43b, glow: true },
      { s: [0.18, 0.10, 0.14], p: [0, 0.55, 0.25], c: 0xff922b, glow: true },
      { s: [0.11, 0.11, 0.06], p: [-0.14, 0.63, 0.21], c: 0xffffff, glow: true },
      { s: [0.11, 0.11, 0.06], p: [0.14, 0.63, 0.21], c: 0xffffff, glow: true },
      { s: [0.06, 0.07, 0.07], p: [-0.14, 0.63, 0.22], c: 0x182232 },
      { s: [0.06, 0.07, 0.07], p: [0.14, 0.63, 0.22], c: 0x182232 },
      // Spiky cool feather tuft on top of head
      { s: [0.14, 0.18, 0.22], p: [0, 0.82, 0.04], r: [-0.25, 0, 0], c: 0xff922b, glow: true },
      { s: [0.10, 0.14, 0.16], p: [0.08, 0.80, -0.02], r: [-0.15, 0, -0.25], c: 0xffd43b, glow: true },
    ];
  } else if (modelKey === 'baba_chops') {
    // 3. Baba Chops: fluffy charcoal-black & wool-white sheep (0x2b2d42 / 0xf8f9fa) with cute curled sheep ears,
    // fluffy white wool coat & puff on head, pink nose, and pastel purple/silver trinket!
    boxes = [
      // Dark charcoal sheep hooves
      { s: [0.16, 0.14, 0.20], p: [-0.13, 0.07, 0.02], c: 0x182232 },
      { s: [0.16, 0.14, 0.20], p: [0.13, 0.07, 0.02], c: 0x182232 },
      // Fluffy snow-white wool body + dark inner belly + pastel violet charm
      { s: [0.50, 0.38, 0.42], p: [0, 0.29, 0], c: 0xf8f9fa, glow: true },
      { s: [0.26, 0.28, 0.06], p: [0, 0.28, 0.19], c: 0x2b2d42 },
      { s: [0.13, 0.13, 0.07], p: [0, 0.32, 0.21], r: [0, 0, 0.785], c: 0xd0bfff, glow: true },
      // Charcoal-black sheep face + fluffy white wool crown & droopy sheep ears
      { s: [0.46, 0.34, 0.38], p: [0, 0.58, 0.02], c: 0x2b2d42 },
      { s: [0.50, 0.16, 0.42], p: [0, 0.78, 0.02], c: 0xf8f9fa, glow: true },
      { s: [0.12, 0.22, 0.14], p: [-0.28, 0.58, 0.0], r: [0, 0, 0.32], c: 0x2b2d42 },
      { s: [0.12, 0.22, 0.14], p: [0.28, 0.58, 0.0], r: [0, 0, -0.32], c: 0x2b2d42 },
      // Expressive white eyes + cute pink nose
      { s: [0.12, 0.11, 0.06], p: [-0.13, 0.61, 0.20], c: 0xffffff, glow: true },
      { s: [0.12, 0.11, 0.06], p: [0.13, 0.61, 0.20], c: 0xffffff, glow: true },
      { s: [0.06, 0.07, 0.07], p: [-0.13, 0.61, 0.21], c: 0x182232 },
      { s: [0.06, 0.07, 0.07], p: [0.13, 0.61, 0.21], c: 0x182232 },
      { s: [0.09, 0.06, 0.06], p: [0, 0.54, 0.21], c: 0xff85c0, glow: true },
    ];
  } else if (modelKey === 'dogday') {
    // 4. DogDay: sunny orange pup (0xf76707 / 0xffa94d) with floppy chocolate-brown ears (0x8f5a2a),
    // cheerful grin, wagging tail, and glowing golden sun pendant (0xffd43b)!
    boxes = [
      // Warm brown puppy paws
      { s: [0.17, 0.14, 0.22], p: [-0.13, 0.07, 0.03], c: 0xd9480f },
      { s: [0.17, 0.14, 0.22], p: [0.13, 0.07, 0.03], c: 0xd9480f },
      // Sunny orange pup body + light golden belly + glowing golden sun pendant
      { s: [0.46, 0.36, 0.38], p: [0, 0.28, 0], c: 0xf76707 },
      { s: [0.28, 0.28, 0.05], p: [0, 0.28, 0.18], c: 0xffd8a8 },
      { s: [0.16, 0.16, 0.07], p: [0, 0.32, 0.20], r: [0, 0, 0.785], c: 0xffd43b, glow: true },
      // Wagging orange puppy tail
      { s: [0.10, 0.22, 0.12], p: [0, 0.30, -0.24], r: [-0.45, 0, 0], c: 0xf76707 },
      // Sunny orange puppy head + cream snout + floppy brown dog ears
      { s: [0.46, 0.35, 0.40], p: [0, 0.58, 0.02], c: 0xff922b },
      { s: [0.24, 0.14, 0.10], p: [0, 0.53, 0.22], c: 0xffd8a8 },
      { s: [0.09, 0.07, 0.06], p: [0, 0.57, 0.27], c: 0x2b2d42 },
      { s: [0.11, 0.11, 0.06], p: [-0.14, 0.63, 0.21], c: 0xffffff, glow: true },
      { s: [0.11, 0.11, 0.06], p: [0.14, 0.63, 0.21], c: 0xffffff, glow: true },
      { s: [0.06, 0.07, 0.07], p: [-0.14, 0.63, 0.22], c: 0x182232 },
      { s: [0.06, 0.07, 0.07], p: [0.14, 0.63, 0.22], c: 0x182232 },
      // Floppy chocolate-brown dog ears
      { s: [0.12, 0.28, 0.16], p: [-0.28, 0.56, 0.02], r: [0, 0, 0.22], c: 0x8f5a2a },
      { s: [0.12, 0.28, 0.16], p: [0.28, 0.56, 0.02], r: [0, 0, -0.22], c: 0x8f5a2a },
    ];
  } else if (modelKey === 'huggy_wuggy') {
    // 5. Huggy Wuggy: friendly tall-armed bright blue fuzzy buddy (0x1c7ed6 / 0x339af0)
    // with bright yellow hands & feet (0xffd43b), cheerful red smiling lips, and yellow/cyan bowtie!
    boxes = [
      // Bright yellow fuzzy feet + blue legs
      { s: [0.18, 0.12, 0.24], p: [-0.13, 0.06, 0.04], c: 0xffd43b, glow: true },
      { s: [0.18, 0.12, 0.24], p: [0.13, 0.06, 0.04], c: 0xffd43b, glow: true },
      // Tall blue fuzzy body + long friendly blue arms with yellow mitten hands
      { s: [0.42, 0.42, 0.34], p: [0, 0.32, 0], c: 0x1c7ed6 },
      { s: [0.12, 0.38, 0.12], p: [-0.28, 0.32, 0.04], r: [-0.25, 0, 0.22], c: 0x339af0 },
      { s: [0.12, 0.38, 0.12], p: [0.28, 0.32, 0.04], r: [-0.25, 0, -0.22], c: 0x339af0 },
      { s: [0.15, 0.14, 0.15], p: [-0.33, 0.16, 0.12], c: 0xffd43b, glow: true },
      { s: [0.15, 0.14, 0.15], p: [0.33, 0.16, 0.12], c: 0xffd43b, glow: true },
      // Cheerful cyan/yellow neck bowtie
      { s: [0.24, 0.09, 0.07], p: [0, 0.48, 0.18], c: 0x39d5ff, glow: true },
      // Iconic wide rounded-triangle blue Huggy head + big googly eyes + bright red smiling lips
      { s: [0.54, 0.34, 0.38], p: [0, 0.66, 0.02], c: 0x1c7ed6 },
      { s: [0.13, 0.13, 0.06], p: [-0.14, 0.72, 0.20], c: 0xffffff, glow: true },
      { s: [0.13, 0.13, 0.06], p: [0.14, 0.72, 0.20], c: 0xffffff, glow: true },
      { s: [0.07, 0.07, 0.07], p: [-0.14, 0.72, 0.21], c: 0x182232 },
      { s: [0.07, 0.07, 0.07], p: [0.14, 0.72, 0.21], c: 0x182232 },
      { s: [0.32, 0.10, 0.07], p: [0, 0.58, 0.20], c: 0xe03131, glow: true },
      { s: [0.24, 0.05, 0.08], p: [0, 0.58, 0.21], c: 0xffffff, glow: true },
    ];
  } else {
    // 6. Kissy Missy: sweet pastel-pink fuzzy buddy (0xff85c0 / 0xf783ac)
    // with bright yellow hands & feet, rosy cheeks, cheerful smile, and cute heart hair bow!
    boxes = [
      // Bright yellow fuzzy feet
      { s: [0.18, 0.12, 0.24], p: [-0.13, 0.06, 0.04], c: 0xffd43b, glow: true },
      { s: [0.18, 0.12, 0.24], p: [0.13, 0.06, 0.04], c: 0xffd43b, glow: true },
      // Pastel-pink fuzzy body + friendly waving pink arms with yellow mitten hands
      { s: [0.42, 0.42, 0.34], p: [0, 0.32, 0], c: 0xff85c0 },
      { s: [0.12, 0.38, 0.12], p: [-0.28, 0.34, 0.04], r: [-0.30, 0, 0.25], c: 0xf783ac },
      { s: [0.12, 0.38, 0.12], p: [0.28, 0.34, 0.04], r: [-0.30, 0, -0.25], c: 0xf783ac },
      { s: [0.15, 0.14, 0.15], p: [-0.34, 0.18, 0.12], c: 0xffd43b, glow: true },
      { s: [0.15, 0.14, 0.15], p: [0.34, 0.18, 0.12], c: 0xffd43b, glow: true },
      // Wide pastel-pink Kissy head + big sparkling eyes + red smile + cute heart bow on top!
      { s: [0.54, 0.34, 0.38], p: [0, 0.66, 0.02], c: 0xff85c0 },
      { s: [0.13, 0.13, 0.06], p: [-0.14, 0.72, 0.20], c: 0xffffff, glow: true },
      { s: [0.13, 0.13, 0.06], p: [0.14, 0.72, 0.20], c: 0xffffff, glow: true },
      { s: [0.07, 0.07, 0.07], p: [-0.14, 0.72, 0.21], c: 0x182232 },
      { s: [0.07, 0.07, 0.07], p: [0.14, 0.72, 0.21], c: 0x182232 },
      { s: [0.30, 0.10, 0.07], p: [0, 0.58, 0.20], c: 0xe03131, glow: true },
      { s: [0.22, 0.05, 0.08], p: [0, 0.58, 0.21], c: 0xffffff, glow: true },
      // Cute red & gold heart bow on top of Kissy Missy's head
      { s: [0.26, 0.12, 0.10], p: [0, 0.86, 0.06], c: 0xe03131, glow: true },
      { s: [0.10, 0.10, 0.12], p: [0, 0.86, 0.07], c: 0xffd43b, glow: true },
    ];
  }

  geo = mergeVoxelBoxes(boxes);
  geo.scale(1.42, 1.42, 1.42);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  sharedBuddyGeos.set(modelKey, geo);
  return geo;
}

export function createCritterManager(ctx = {}) {
  const group = new THREE.Group();
  group.name = 'critters_group';
  if (ctx && ctx.scene) {
    ctx.scene.add(group);
  }

  const instancedByModel = new Map();
  for (let i = 0; i < BUDDY_MODEL_IDS.length; i++) {
    const modelId = BUDDY_MODEL_IDS[i];
    const im = new THREE.InstancedMesh(
      getBuddyGeometry(modelId),
      getMatteVoxelMaterial(),
      MAX_PER_MODEL
    );
    im.name = `critters_instanced_${modelId}`;
    im.castShadow = false;
    im.receiveShadow = false;
    im.frustumCulled = false;
    im.count = 0;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.userData = { interactKind: 'critter', kind: 'critter', buddyModel: modelId };
    group.add(im);
    instancedByModel.set(modelId, im);
  }

  const heartTex = getHeartTexture();
  const heartPool = [];
  for (let i = 0; i < HEART_POOL_SIZE; i++) {
    const sp = new THREE.Sprite(
      createSafeSpriteMaterial({
        map: heartTex || null,
        color: heartTex ? 0xffffff : 0xff4d6d,
        opacity: 1,
      })
    );
    sp.visible = false;
    group.add(sp);
    heartPool.push(sp);
  }

  const critters = [];
  const byId = new Map();
  let nextSeq = 1;
  let currentSeed = 2026;

  const _raySphere = new THREE.Sphere();
  const _hitPoint = new THREE.Vector3();
  const _parentMat = new THREE.Matrix4();
  const _localMat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _euler = new THREE.Euler();
  const _scale = new THREE.Vector3();

  function resolveSurfacePosition(rawX, rawY, rawZ) {
    let x = Number(rawX) || 0;
    let z = Number(rawZ) || 0;
    let y = Number.isFinite(rawY) ? Number(rawY) : 1;

    const world = ctx?.world;
    if (world && typeof world.getGroundY === 'function') {
      const gy = world.getGroundY(x, z);
      if (Number.isFinite(gy) && gy > -50) {
        y = gy;
      } else if (typeof world.clampToWalkable === 'function') {
        const clamped = world.clampToWalkable(x, z);
        if (clamped) {
          x = clamped.x;
          y = Number.isFinite(clamped.y) ? clamped.y : 1;
          z = clamped.z;
        }
      }
    }
    return { x, y, z };
  }

  function removeCritterInternal(c) {
    byId.delete(c.id);
    const idx = critters.indexOf(c);
    if (idx !== -1) critters.splice(idx, 1);
  }

  function syncInstances(time = 0) {
    const counts = {};
    for (let i = 0; i < BUDDY_MODEL_IDS.length; i++) {
      counts[BUDDY_MODEL_IDS[i]] = 0;
    }
    let heartSlot = 0;

    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      const modelId = c.buddyModel || 'hoppy_hopscotch';
      const slot = counts[modelId] || 0;
      if (slot >= MAX_PER_MODEL) continue;
      counts[modelId] = slot + 1;

      _pos.set(c.x, c.y, c.z);
      _euler.set(0, c.yaw, 0);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _parentMat.compose(_pos, _quat, _scale);

      let popScale = 1.0;
      if (c.spawnPopTimer > 0) {
        const u = 1 - c.spawnPopTimer / 0.45;
        popScale = u < 0.7 ? (u / 0.7) * 1.18 : 1.18 - ((u - 0.7) / 0.3) * 0.18;
      }

      const baseHover = c.kind === 'mini_bananini' ? 0.14 + Math.sin(time * 6.5 + c.phase) * 0.08 : 0;

      if (c.petTimer > 0) {
        const p = 1 - c.petTimer / PET_DURATION;
        const arcY = Math.sin(p * Math.PI) * 1.42;
        const flipPitch = -p * Math.PI * 2;
        const stretch = 1 + Math.sin(p * Math.PI * 2) * 0.14;

        _pos.set(0, baseHover + arcY, 0);
        _euler.set(flipPitch, 0, 0);
        _quat.setFromEuler(_euler);
        _scale.set(
          popScale / Math.sqrt(stretch),
          popScale * stretch,
          popScale / Math.sqrt(stretch)
        );
        _localMat.compose(_pos, _quat, _scale);

        if (heartSlot < HEART_POOL_SIZE && c.petTimer > 0.02) {
          const sp = heartPool[heartSlot++];
          sp.visible = true;
          sp.position.set(c.x, c.y + 1.15 + p * 1.10, c.z);
          const hs = 0.58 + Math.sin(p * Math.PI) * 0.42;
          sp.scale.set(hs, hs, 1);
        }
      } else {
        const hopWave = Math.abs(Math.sin(time * 5.2 + c.phase));
        const hopY = c.kind === 'mini_bananini' ? 0 : hopWave * 0.16;
        const waddleRoll = Math.sin(time * (c.kind === 'mini_bananini' ? 9.5 : 5.2) + c.phase) * 0.09;

        _pos.set(0, baseHover + hopY, 0);
        _euler.set(0, 0, waddleRoll);
        _quat.setFromEuler(_euler);
        _scale.set(popScale, popScale, popScale);
        _localMat.compose(_pos, _quat, _scale);
      }

      _parentMat.multiply(_localMat);
      instancedByModel.get(modelId).setMatrixAt(slot, _parentMat);
    }

    for (let i = heartSlot; i < HEART_POOL_SIZE; i++) {
      heartPool[i].visible = false;
    }

    for (let i = 0; i < BUDDY_MODEL_IDS.length; i++) {
      const modelId = BUDDY_MODEL_IDS[i];
      const im = instancedByModel.get(modelId);
      im.count = counts[modelId];
      im.visible = counts[modelId] > 0;
      im.instanceMatrix.needsUpdate = true;
    }
  }

  function spawnInternal(rawKind, rawX, rawY, rawZ, isAmbient = false, explicitBuddyModel = null) {
    const validKind = resolveCritterKind(rawKind);
    const spec = CRITTER_TYPES[validKind] || CRITTER_TYPES.mini_cappuccina;
    const seq = nextSeq++;
    const buddyModel = resolveBuddyModel(
      explicitBuddyModel || (BUDDY_MODEL_IDS.includes(rawKind) ? rawKind : null),
      validKind,
      seq
    );

    const sameModelCount = critters.filter((item) => item.buddyModel === buddyModel).length;
    if (critters.length >= MAX_CRITTERS || sameModelCount >= MAX_PER_MODEL) {
      const removable =
        critters.find((item) => item.buddyModel === buddyModel && !item.ambient) ||
        critters.find((item) => !item.ambient) ||
        critters.find((item) => item.buddyModel === buddyModel);
      if (removable) removeCritterInternal(removable);
    }

    const id = `critter_${seq}`;
    const pos = resolveSurfacePosition(rawX, rawY, rawZ);
    const phase = hashSeed(currentSeed, seq) * Math.PI * 2;

    const c = {
      id,
      seq,
      kind: validKind,
      buddyModel,
      ambient: isAmbient,
      homeX: pos.x,
      homeZ: pos.z,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: phase,
      phase,
      age: isAmbient ? 1.0 : 0.0,
      spawnPopTimer: isAmbient ? 0.0 : 0.45,
      petTimer: 0.0,
      petCount: 0,
      bonusGems: spec.bonusGems,
      voId: spec.voId,
    };

    critters.push(c);
    byId.set(id, c);
    syncInstances(0);

    return {
      id: c.id,
      kind: c.kind,
      buddyModel: c.buddyModel,
      x: round3(c.x),
      y: round3(c.y),
      z: round3(c.z),
      petCount: c.petCount,
      bonusGems: c.bonusGems,
      voId: c.voId,
    };
  }

  function spawn(kind, x = 0, y = 1, z = 0) {
    return spawnInternal(kind, x, y, z, false);
  }

  function pet(idOrObj) {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
    if (!id) return null;
    const c = byId.get(id);
    if (!c) return null;

    c.petTimer = PET_DURATION;
    c.petCount += 1;

    // Pop heart & star celebration sparkles when high-fiving / petting a Playcare buddy!
    if (ctx && ctx.particles) {
      if (typeof ctx.particles.spawnStarSparkles === 'function') {
        ctx.particles.spawnStarSparkles(c.x, c.y + 0.9, c.z, 10);
      } else if (typeof ctx.particles.spawnBurst === 'function') {
        ctx.particles.spawnBurst(c.x, c.y + 0.9, c.z, 0xff85c0, 10);
      }
    }

    return {
      id: c.id,
      kind: c.kind,
      buddyModel: c.buddyModel,
      x: round3(c.x),
      y: round3(c.y),
      z: round3(c.z),
      petCount: c.petCount,
      bonusGems: c.bonusGems,
      voId: c.voId,
    };
  }

  function findNear(x, z, radius = 2.2) {
    const rSq = radius * radius;
    let best = null;
    let bestDistSq = rSq;

    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      const dx = c.x - x;
      const dz = c.z - z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        best = c;
      }
    }

    if (!best) return null;
    return {
      id: best.id,
      kind: best.kind,
      buddyModel: best.buddyModel,
      x: round3(best.x),
      y: round3(best.y),
      z: round3(best.z),
      bonusGems: best.bonusGems,
      voId: best.voId,
      dist: Math.sqrt(bestDistSq),
    };
  }

  function raycast(raycaster) {
    if (!raycaster || critters.length === 0) return null;
    let closest = null;
    let bestDistance = Infinity;

    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      const centerY = c.y + (c.kind === 'mini_bananini' ? 0.56 : 0.42);
      _raySphere.center.set(c.x, centerY, c.z);
      _raySphere.radius = 0.92;
      const hit = raycaster.ray.intersectSphere(_raySphere, _hitPoint);
      if (hit) {
        const dist = raycaster.ray.origin.distanceTo(_hitPoint);
        if (dist < bestDistance) {
          bestDistance = dist;
          closest = {
            kind: 'critter',
            id: c.id,
            critter: {
              id: c.id,
              kind: c.kind,
              buddyModel: c.buddyModel,
              x: round3(c.x),
              y: round3(c.y),
              z: round3(c.z),
              bonusGems: c.bonusGems,
              voId: c.voId,
            },
            point: _hitPoint.clone(),
            distance: dist,
          };
        }
      }
    }
    return closest;
  }

  function update(dt = 1 / 60, time = 0) {
    const stepDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    const t = Number(time) || 0;
    const world = ctx?.world;

    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      c.age += stepDt;
      if (c.spawnPopTimer > 0) c.spawnPopTimer = Math.max(0, c.spawnPopTimer - stepDt);
      if (c.petTimer > 0) c.petTimer = Math.max(0, c.petTimer - stepDt);

      const wanderSpeed = c.kind === 'mini_bananini' ? 1.05 : 0.72;
      const wanderRadius = c.kind === 'mini_bananini' ? 1.55 : 1.35;
      const angle = c.phase + c.age * wanderSpeed;
      const targetX = c.homeX + Math.cos(angle) * wanderRadius;
      const targetZ = c.homeZ + Math.sin(angle * 0.85) * wanderRadius;

      let canStep = true;
      let groundY = c.y;
      if (world && typeof world.getGroundY === 'function') {
        const gy = world.getGroundY(targetX, targetZ);
        if (Number.isFinite(gy) && gy > -50 && Math.abs(gy - c.y) <= 1.2) {
          groundY = gy;
        } else {
          canStep = false;
          const curGy = world.getGroundY(c.x, c.z);
          if (Number.isFinite(curGy) && curGy > -50) groundY = curGy;
        }
      }

      if (canStep && c.petTimer <= 0) {
        const dx = targetX - c.x;
        const dz = targetZ - c.z;
        const moveAlpha = Math.min(1, stepDt * 3.5);
        c.x += dx * moveAlpha;
        c.z += dz * moveAlpha;
        if (dx * dx + dz * dz > 0.0001) {
          c.yaw = Math.atan2(dx, dz);
        }
      }
      c.y = groundY;
    }

    syncInstances(t);
  }

  function getSnapshot() {
    return critters.map((c) => ({
      id: c.id,
      kind: c.kind,
      buddyModel: c.buddyModel,
      x: round3(c.x),
      y: round3(c.y),
      z: round3(c.z),
      petCount: c.petCount,
      bouncing: c.petTimer > 0,
    }));
  }

  function reset(seed = 2026) {
    currentSeed = Number(seed) || 2026;
    critters.length = 0;
    byId.clear();
    nextSeq = 1;

    for (let i = 0; i < AMBIENT_CRITTER_SPAWNS.length; i++) {
      const s = AMBIENT_CRITTER_SPAWNS[i];
      const jitterX = (hashSeed(currentSeed, i * 2 + 11) - 0.5) * 1.2;
      const jitterZ = (hashSeed(currentSeed, i * 2 + 12) - 0.5) * 1.2;
      spawnInternal(s.kind, s.x + jitterX, 1, s.z + jitterZ, true, s.buddyModel);
    }
    syncInstances(0);
  }

  reset(ctx?.state?.seed ?? 2026);

  return {
    group,
    spawn,
    pet,
    findNear,
    raycast,
    update,
    getSnapshot,
    reset,
  };
}

export const createCrittersManager = createCritterManager;
