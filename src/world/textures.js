// Procedural 16x16 pixel-art CanvasTextures and 8x8 voxel atlas for Playtime Prank RPG 3D: Lily, Giblet & The Smiling Critters!
// Theme: Playtime Co. Prank Factory & Lily Lovebraids' Dollhouse (GameToons "CHAPTER 5: CIVIL WAR!").

import * as THREE from '../../vendor/three.module.min.js';
import { createRng } from '../core/rng.js';

const TILE_SIZE = 16;
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;
const ATLAS_SIZE = TILE_SIZE * ATLAS_COLS; // 128x128

export const TILE_INDEX = Object.freeze({
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  path_gold: 3,
  hub_plaza: 4,
  lucky_block: 5,
  flower_red_top: 6,
  flower_red_side: 7,
  flower_sun_top: 8,
  flower_sun_side: 9,
  oak_bark: 10,
  oak_top: 11,
  spruce_bark: 12,
  spruce_top: 13,
  leaves_lush: 14,
  leaves_frost: 15,
  hay_side: 16,
  hay_top: 17,
  pumpkin_front: 18,
  pumpkin_side: 19,
  pumpkin_top: 20,
  melon_side: 21,
  melon_top: 22,
  beehive_front: 23,
  beehive_side: 24,
  beehive_top: 25,
  ice_crystal: 26,
  snow_top: 27,
  snow_side: 28,
  castle_brick: 29,
  furnace_front: 30,
  furnace_side: 31,
  amethyst: 32,
  bedrock_gold: 33,
  mega_titan_side: 34,
  mega_titan_top: 35,
  chest_front: 36,
  chest_side: 37,
  chest_top: 38,
  water: 39,
  farm_soil: 40,
  lantern_glow: 41,
  mushroom_red: 42,
  snowman_face: 43,
});

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizePixelTexture(canvas, repeat = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function fillNoise(ctx, rng, palette, x0 = 0, y0 = 0, w = 16, h = 16) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x0 + w > x; x++) {
      ctx.fillStyle = rng.pick(palette);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawBitmap(ctx, rows, colorMap, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== '.' && colorMap[ch]) {
        ctx.fillStyle = colorMap[ch];
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

function paintTile(name, ctx, emCtx, rng) {
  switch (name) {
    case 'grass_top': {
      // Playtime Co. Blue & Yellow Factory Showroom Floor (#4dabf7, #339af0 bright blue tiles with #ffd43b yellow safety trim)
      fillNoise(ctx, rng, ['#4dabf7', '#339af0', '#42a5f5', '#2b8ae0']);
      px(ctx, 0, 0, '#ffd43b', 16, 1);
      px(ctx, 0, 15, '#1c7ed6', 16, 1);
      px(ctx, 0, 0, '#ffd43b', 1, 16);
      px(ctx, 15, 0, '#1c7ed6', 1, 16);
      px(ctx, 7, 7, '#a5d8ff', 2, 2);
      break;
    }

    case 'grass_side': {
      // Playtime Co. Blue & Yellow Factory Showroom Curb
      fillNoise(ctx, rng, ['#3b2860', '#493275', '#2f1f4d']);
      fillNoise(ctx, rng, ['#4dabf7', '#339af0'], 0, 0, 16, 4);
      px(ctx, 0, 4, '#ffd43b', 16, 2);
      break;
    }

    case 'dirt': {
      // Playtime Co. Royal Violet & Gold Factory Plinth Block
      fillNoise(ctx, rng, ['#5f3dc4', '#7048e8', '#5232ab', '#6741d9']);
      px(ctx, 0, 0, '#ffd43b', 16, 1);
      px(ctx, 0, 15, '#ffd43b', 16, 1);
      px(ctx, 2, 3, '#ffd43b', 2, 2);
      px(ctx, 12, 11, '#ffd43b', 2, 2);
      break;
    }

    case 'farm_soil': {
      // Smiling Critters Green Indoor Soccer Pitch Turf (#40c057, #51cf66 lush green turf with crisp #ffffff soccer chalk lines, 30:49)
      for (let y = 0; y < 16; y++) {
        const stripe = Math.floor(y / 4) % 2 === 0;
        for (let x = 0; x < 16; x++) {
          px(ctx, x, y, stripe ? '#40c057' : '#51cf66');
        }
      }
      // Crisp white soccer pitch chalk lines
      px(ctx, 0, 0, '#ffffff', 16, 1);
      px(ctx, 0, 0, '#ffffff', 1, 16);
      px(ctx, 7, 7, '#ffffff', 2, 2);
      break;
    }

    case 'path_gold': {
      // Red & Gold Playcare VIP Prank Carpet Runner (#e03131 red carpet with #ffd43b golden fringe)
      fillNoise(ctx, rng, ['#e03131', '#c92a2a', '#f03e3e']);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      px(ctx, 2, 0, '#fcc419', 1, 16);
      px(ctx, 13, 0, '#fcc419', 1, 16);
      // Golden star emblem in carpet center
      px(ctx, 7, 6, '#ffe066', 2, 4);
      px(ctx, 6, 7, '#ffe066', 4, 2);
      break;
    }

    case 'hub_plaza': {
      // Lily Lovebraids' Lavender & Pink Diamond Dollhouse Carpet (#f3d9fa, #fcc2d7, #e599f7 pastel diamond floor with #ffd43b gold star accents)
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const md = Math.abs(x - 7.5) + Math.abs(y - 7.5);
          const col = md < 4 ? '#fcc2d7' : md < 7 ? '#f3d9fa' : '#e599f7';
          px(ctx, x, y, col);
        }
      }
      px(ctx, 0, 0, '#d0bfff', 16, 1);
      px(ctx, 0, 0, '#d0bfff', 1, 16);
      // Gold star accent in diamond center
      px(ctx, 7, 6, '#ffd43b', 2, 4);
      px(ctx, 6, 7, '#ffd43b', 4, 2);
      px(ctx, 7, 7, '#fff9db', 2, 2);
      break;
    }

    case 'lucky_block': {
      // Polka-Dot Jack-in-the-Box '?' Prank Box (Purple/Pink box with Golden Jester Hat & '?')
      fillNoise(ctx, rng, ['#9c36b5', '#ae3ec9', '#862e9c']);
      // Pink & cyan polka dots
      px(ctx, 2, 3, '#ff85c0', 2, 2);
      px(ctx, 12, 3, '#74c0fc', 2, 2);
      px(ctx, 2, 11, '#74c0fc', 2, 2);
      px(ctx, 12, 11, '#ff85c0', 2, 2);
      // Golden Jester frame
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#f59f00', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#f59f00', 2, 16);
      const qRows = [
        '..YYYY..',
        '.YYYYYYS',
        '.YY..YYS',
        '....YYYS',
        '...YYYS.',
        '...YYS..',
        '...SSS..',
        '...YY...',
        '...YYS..',
        '....SS..',
      ];
      drawBitmap(ctx, qRows, { Y: '#fff9db', S: '#4a154b' }, 4, 3);
      drawBitmap(emCtx, qRows, { Y: '#ffe066', S: '#2b0938' }, 4, 3);
      px(emCtx, 0, 0, '#7a5c00', 16, 2);
      px(emCtx, 0, 14, '#7a5c00', 16, 2);
      break;
    }

    case 'flower_red_top': {
      // Pink Whoopee Cushion Trap Box Top ('PFFFT!' pink prank cushion)
      fillNoise(ctx, rng, ['#ff85c0', '#f06595', '#faa2c1']);
      px(ctx, 2, 2, '#d6336c', 12, 12);
      px(ctx, 3, 3, '#ff85c0', 10, 10);
      px(ctx, 5, 5, '#fcc2d7', 6, 6);
      px(ctx, 7, 0, '#f06595', 2, 3); // Rubber air nozzle
      break;
    }

    case 'flower_red_side': {
      // Pink Whoopee Cushion Trap Box Side ('PFFFT!' pink prank cushion)
      fillNoise(ctx, rng, ['#ae3ec9', '#9c36b5']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      // Inflated pink whoopee cushion in middle
      px(ctx, 1, 4, '#f06595', 14, 8);
      px(ctx, 2, 5, '#ff85c0', 12, 6);
      px(ctx, 4, 6, '#fff0f6', 8, 2);
      px(ctx, 0, 7, '#d6336c', 16, 2); // Cushion seam
      break;
    }

    case 'flower_sun_top': {
      // Golden Honey Crumpet & Teacup Stack Top (27:43 "I love tea parties and crumpets!")
      fillNoise(ctx, rng, ['#ffd43b', '#fcc419', '#fab005']);
      px(ctx, 0, 0, '#e67700', 16, 1);
      px(ctx, 0, 15, '#e67700', 16, 1);
      px(ctx, 0, 0, '#e67700', 1, 16);
      px(ctx, 15, 0, '#e67700', 1, 16);
      // Crumpet air holes + butter pat
      px(ctx, 3, 3, '#d9480f', 2, 2);
      px(ctx, 11, 3, '#d9480f', 2, 2);
      px(ctx, 3, 11, '#d9480f', 2, 2);
      px(ctx, 11, 11, '#d9480f', 2, 2);
      px(ctx, 6, 6, '#fff9db', 4, 4); // Melting honey butter pat
      break;
    }

    case 'flower_sun_side': {
      // Golden Honey Crumpet & Teacup Stack Side (27:43)
      px(ctx, 0, 0, '#ffd43b', 16, 4); // Top golden crumpet
      px(ctx, 0, 4, '#fff9db', 16, 2); // Honey cream layer
      px(ctx, 0, 6, '#f3d9fa', 16, 5); // Pastel porcelain teacup band
      px(ctx, 0, 11, '#f59f00', 16, 5); // Bottom golden crumpet
      // Pink tea rose motif on porcelain band
      px(ctx, 6, 7, '#f06595', 4, 3);
      px(ctx, 4, 8, '#51cf66', 2, 2);
      px(ctx, 10, 8, '#51cf66', 2, 2);
      break;
    }

    case 'oak_bark': {
      // Lily's Stretchy Purple Braid Spool Side (Braided purple hair spool with gold star clips)
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = (x + Math.floor(y / 2)) % 4;
          const col = wave === 0 ? '#7950f2' : wave === 1 ? '#ae3ec9' : wave === 2 ? '#cc5de8' : '#862e9c';
          px(ctx, x, y, col);
        }
      }
      // Wooden spool rims + gold star hair clips
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 6, 6, '#ffe066', 4, 4);
      px(ctx, 7, 5, '#fff9db', 2, 6);
      break;
    }

    case 'oak_top': {
      // Lily's Stretchy Purple Braid Spool Top
      px(ctx, 0, 0, '#ffd43b', 16, 16);
      px(ctx, 2, 2, '#9c36b5', 12, 12);
      px(ctx, 4, 4, '#cc5de8', 8, 8);
      px(ctx, 6, 6, '#ffd43b', 4, 4);
      break;
    }

    case 'spruce_bark': {
      // GrabPack Blue & Red Hand Crate Side (Yellow Playtime Co. crate with Blue & Red hand emblems)
      fillNoise(ctx, rng, ['#ffd43b', '#fcc419', '#fab005']);
      px(ctx, 0, 0, '#e67700', 16, 2);
      px(ctx, 0, 14, '#e67700', 16, 2);
      px(ctx, 0, 0, '#e67700', 2, 16);
      px(ctx, 14, 0, '#e67700', 2, 16);
      // Left Blue Hand & Right Red Hand
      px(ctx, 3, 5, '#1c7ed6', 4, 6);
      px(ctx, 3, 3, '#339af0', 4, 2);
      px(ctx, 9, 5, '#e03131', 4, 6);
      px(ctx, 9, 3, '#ff6b6b', 4, 2);
      break;
    }

    case 'spruce_top': {
      // GrabPack Blue & Red Hand Crate Top
      fillNoise(ctx, rng, ['#ffd43b', '#fcc419', '#fab005']);
      px(ctx, 0, 0, '#e67700', 16, 2);
      px(ctx, 0, 14, '#e67700', 16, 2);
      px(ctx, 0, 0, '#e67700', 2, 16);
      px(ctx, 14, 0, '#e67700', 2, 16);
      px(ctx, 4, 4, '#228be6', 4, 8);
      px(ctx, 8, 4, '#fa5252', 4, 8);
      break;
    }

    case 'leaves_lush': {
      // Lily Lovebraids' Pink & Lavender Dollhouse Wall Block
      fillNoise(ctx, rng, ['#f783ac', '#f06595', '#faa2c1']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#e599f7', 16, 2);
      // Cozy lavender heart window frame
      drawBitmap(
        ctx,
        [
          '.PP..PP.',
          'PPPPPPPP',
          'PPPPPPPP',
          '.PPPPPP.',
          '..PPPP..',
          '...PP...',
        ],
        { P: '#fff0f6' },
        4,
        5
      );
      break;
    }

    case 'leaves_frost': {
      // Playtime Co. Blue & Cyan Toy Showroom Glass Block
      fillNoise(ctx, rng, ['#339af0', '#4dabf7', '#74c0fc', '#a5d8ff']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      px(ctx, 4, 4, '#ffffff', 3, 3);
      px(ctx, 9, 9, '#e7f5ff', 3, 3);
      break;
    }

    case 'hay_side': {
      // Black & White Soccer Ball Prank Box Side (30:49 soccer ball prank)
      fillNoise(ctx, rng, ['#ffffff', '#f8f9fa', '#f1f3f5']);
      // Green turf trim top/bottom
      px(ctx, 0, 0, '#40c057', 16, 2);
      px(ctx, 0, 14, '#40c057', 16, 2);
      // Classic black soccer pentagons
      px(ctx, 5, 5, '#212529', 6, 6);
      px(ctx, 0, 2, '#212529', 3, 4);
      px(ctx, 13, 2, '#212529', 3, 4);
      px(ctx, 0, 10, '#212529', 3, 4);
      px(ctx, 13, 10, '#212529', 3, 4);
      break;
    }

    case 'hay_top': {
      // Black & White Soccer Ball Prank Box Top (30:49)
      fillNoise(ctx, rng, ['#ffffff', '#f8f9fa', '#f1f3f5']);
      px(ctx, 5, 5, '#212529', 6, 6);
      px(ctx, 1, 1, '#212529', 3, 3);
      px(ctx, 12, 1, '#212529', 3, 3);
      px(ctx, 1, 12, '#212529', 3, 3);
      px(ctx, 12, 12, '#212529', 3, 3);
      break;
    }

    case 'pumpkin_side': {
      // Chum Chompkins' Belly-Mouth Snack Box Side (Crimson furry monster box)
      fillNoise(ctx, rng, ['#e03131', '#c92a2a', '#f03e3e']);
      px(ctx, 0, 0, '#ff8787', 16, 2);
      px(ctx, 0, 14, '#a61e4d', 16, 2);
      px(ctx, 3, 5, '#ffd43b', 4, 6);
      px(ctx, 9, 5, '#ffd43b', 4, 6);
      break;
    }

    case 'pumpkin_front': {
      // Chum Chompkins' Belly-Mouth Snack Box Front (Crimson furry monster box with big cartoon teeth grin!)
      fillNoise(ctx, rng, ['#e03131', '#c92a2a', '#f03e3e']);
      const chompFace = [
        '..YYY.....YYY..',
        '.YYYYY...YYYYY.',
        '..BYY.....BYY..',
        '...............',
        '.MMMMMMMMMMMMM.',
        '.MWWM.MWWM.MWWM',
        '.MWWM.MWWM.MWWM',
        '.MMMMMMMMMMMMM.',
        '.MWWM.MWWM.MWWM',
        '..MMMMMMMMMMM..',
      ];
      drawBitmap(ctx, chompFace, { Y: '#ffd43b', B: '#212529', M: '#4a0e17', W: '#ffffff' }, 0, 3);
      drawBitmap(emCtx, chompFace, { Y: '#ffe066', B: '#000000', M: '#2b050a', W: '#fff9db' }, 0, 3);
      break;
    }

    case 'pumpkin_top': {
      // Chum Chompkins' Belly-Mouth Snack Box Top
      fillNoise(ctx, rng, ['#e03131', '#c92a2a', '#fa5252']);
      px(ctx, 4, 4, '#ffd43b', 3, 3);
      px(ctx, 9, 9, '#ffd43b', 3, 3);
      break;
    }

    case 'melon_side': {
      // Breezy-Bake Pink Toy Oven Block Side (35:35 "I play Breezy Bake Oven!")
      fillNoise(ctx, rng, ['#ff85c0', '#f783ac', '#faa2c1']);
      px(ctx, 0, 0, '#e599f7', 16, 3); // Lavender stove top
      px(ctx, 0, 14, '#ae3ec9', 16, 2); // Purple base
      // Glowing warm cupcake baking window
      px(ctx, 2, 5, '#4a154b', 12, 8);
      px(ctx, 3, 6, '#ffe066', 10, 6);
      px(ctx, 5, 8, '#f06595', 6, 3); // Baking pink cupcake inside!
      // Oven dials
      px(ctx, 3, 1, '#ffd43b', 2, 2);
      px(ctx, 7, 1, '#74c0fc', 2, 2);
      px(ctx, 11, 1, '#ffd43b', 2, 2);
      px(emCtx, 3, 6, '#fab005', 10, 6);
      break;
    }

    case 'melon_top': {
      // Breezy-Bake Pink Toy Oven Stovetop Burners
      fillNoise(ctx, rng, ['#f3d9fa', '#e599f7', '#fcc2d7']);
      px(ctx, 2, 2, '#f06595', 5, 5);
      px(ctx, 9, 2, '#f06595', 5, 5);
      px(ctx, 2, 9, '#f06595', 5, 5);
      px(ctx, 9, 9, '#f06595', 5, 5);
      break;
    }

    case 'beehive_side': {
      // Stocked Factory Fridge Block Side (33:19 white fridge)
      fillNoise(ctx, rng, ['#f8f9fa', '#e9ecef', '#dee2e6']);
      px(ctx, 0, 0, '#74c0fc', 16, 2);
      px(ctx, 0, 14, '#adb5bd', 16, 2);
      px(ctx, 12, 4, '#ffd43b', 2, 8); // Golden fridge handle
      break;
    }

    case 'beehive_front': {
      // Stocked Factory Fridge Block Front (33:19 white fridge packed with watermelon & snacks!)
      fillNoise(ctx, rng, ['#f8f9fa', '#e9ecef', '#ffffff']);
      px(ctx, 0, 0, '#74c0fc', 16, 2);
      px(ctx, 2, 2, '#2b8a3e', 12, 12); // Open fridge interior
      // Top shelf: Watermelon slices (#51cf66 rind + #ff6b6b melon)
      px(ctx, 3, 3, '#51cf66', 10, 4);
      px(ctx, 4, 3, '#ff6b6b', 8, 3);
      px(ctx, 2, 7, '#dee2e6', 12, 1); // Shelf divider
      // Bottom shelf: Golden crumpets & berry drinks
      px(ctx, 3, 9, '#ffd43b', 4, 4);
      px(ctx, 9, 9, '#cc5de8', 4, 4);
      px(emCtx, 3, 3, '#40c057', 10, 4);
      px(emCtx, 3, 9, '#fcc419', 10, 4);
      break;
    }

    case 'beehive_top': {
      // Stocked Factory Fridge Top
      fillNoise(ctx, rng, ['#f8f9fa', '#e9ecef', '#ffffff']);
      px(ctx, 1, 1, '#74c0fc', 14, 2);
      px(ctx, 1, 13, '#74c0fc', 14, 2);
      break;
    }

    case 'ice_crystal': {
      // Glowing Pink Toy Capsule Tube Block (24:14 Miss Gracie's Pink Capsule Pod)
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.abs(x - 7.5);
          const col = d < 2.5 ? '#ffffff' : d < 5 ? '#fcc2d7' : d < 7 ? '#ff85c0' : '#d6336c';
          px(ctx, x, y, col);
        }
      }
      px(ctx, 0, 0, '#ffd43b', 16, 2); // Gold capsule top cap
      px(ctx, 0, 14, '#ffd43b', 16, 2); // Gold capsule base cap
      px(emCtx, 2, 2, '#ff85c0', 12, 12);
      px(emCtx, 5, 2, '#fff0f6', 6, 12);
      break;
    }

    case 'snow_top': {
      // CatNap & Prototype's Royal Purple Lab Tile (#5f3dc4, #6741d9 with #74c0fc cyan circuit border)
      fillNoise(ctx, rng, ['#5f3dc4', '#6741d9', '#5232ab']);
      px(ctx, 0, 0, '#74c0fc', 16, 1);
      px(ctx, 0, 0, '#74c0fc', 1, 16);
      px(ctx, 0, 15, '#3b227a', 16, 1);
      px(ctx, 15, 0, '#3b227a', 1, 16);
      px(ctx, 6, 6, '#9775fa', 4, 4);
      break;
    }

    case 'snow_side': {
      // Royal Purple Lab Wall with Cyan Circuit & Yellow Caution Stripe
      fillNoise(ctx, rng, ['#4c2885', '#3b1e6d', '#5f3dc4']);
      for (let x = 0; x < 16; x += 4) {
        px(ctx, x, 0, '#ffd43b', 2, 4);
        px(ctx, x + 2, 0, '#3b1e6d', 2, 4);
      }
      px(ctx, 0, 4, '#74c0fc', 16, 1);
      break;
    }

    case 'castle_brick': {
      // Rainbow Stained-Glass Workshop Mosaic Tile (#ff6b6b, #ffd43b, #4dabf7, #69db7c stained-glass floor from 40:00 Prototype showdown!)
      px(ctx, 0, 0, '#ff6b6b', 8, 8);
      px(ctx, 8, 0, '#ffd43b', 8, 8);
      px(ctx, 0, 8, '#69db7c', 8, 8);
      px(ctx, 8, 8, '#4dabf7', 8, 8);
      // Stained-glass lead & gold framing
      px(ctx, 0, 0, '#3b1e6d', 16, 1);
      px(ctx, 0, 7, '#3b1e6d', 16, 2);
      px(ctx, 0, 15, '#3b1e6d', 16, 1);
      px(ctx, 0, 0, '#3b1e6d', 1, 16);
      px(ctx, 7, 0, '#3b1e6d', 2, 16);
      px(ctx, 15, 0, '#3b1e6d', 1, 16);
      px(ctx, 6, 6, '#fff9db', 4, 4);
      break;
    }

    case 'furnace_side': {
      // KickinChicken's Rainbow Makeup Blaster Box Side (39:11 neon paint & makeup kit)
      fillNoise(ctx, rng, ['#7048e8', '#5f3dc4', '#7950f2']);
      px(ctx, 0, 0, '#ff85c0', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 3, 4, '#ff6b6b', 3, 8);
      px(ctx, 7, 4, '#51cf66', 3, 8);
      px(ctx, 11, 4, '#4dabf7', 3, 8);
      break;
    }

    case 'furnace_front': {
      // KickinChicken's Rainbow Makeup Blaster Box Front (39:11 neon paint & makeup kit)
      fillNoise(ctx, rng, ['#7048e8', '#5f3dc4', '#7950f2']);
      px(ctx, 0, 0, '#ff85c0', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      // Rainbow blush palette & glowing mirror
      px(ctx, 2, 3, '#fff0f6', 12, 5);
      px(ctx, 3, 9, '#ff6b6b', 3, 4);
      px(ctx, 7, 9, '#ffd43b', 3, 4);
      px(ctx, 11, 9, '#4dabf7', 3, 4);
      px(emCtx, 2, 3, '#ff85c0', 12, 5);
      px(emCtx, 3, 9, '#ffe066', 10, 4);
      break;
    }

    case 'amethyst': {
      // Prototype's Jester-Hat & Spider-Claw Gadget Box (Blue/Red/Gold jester box)
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const harlequin = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
          px(ctx, x, y, harlequin ? '#1c7ed6' : '#e03131');
        }
      }
      // Gold jester crown & bells
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 5, 5, '#ffe066', 6, 6);
      px(ctx, 6, 6, '#fff9db', 4, 4);
      px(emCtx, 5, 5, '#fab005', 6, 6);
      break;
    }

    case 'bedrock_gold': {
      // Playtime Co. Royal Purple & 24K Gold Star Trim
      fillNoise(ctx, rng, ['#7048e8', '#5f3dc4', '#862e9c']);
      px(ctx, 0, 0, '#ffd43b', 16, 3);
      px(ctx, 0, 13, '#ffd43b', 16, 3);
      px(ctx, 2, 6, '#ffe066', 4, 3);
      px(ctx, 10, 6, '#ff85c0', 4, 3);
      px(emCtx, 2, 6, '#7a5c00', 4, 3);
      px(emCtx, 10, 6, '#7a2952', 4, 3);
      break;
    }

    case 'mega_titan_side': {
      // 2x2x2 Giant Playtime Prank Boss Cube (Purple, Pink & Gold Jester-Crown Emblem)
      fillNoise(ctx, rng, ['#862e9c', '#9c36b5', '#5f3dc4']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      const emblem = [
        '.Y...Y...Y.',
        '.YY.YYY.YY.',
        '.YYYYYYYYY.',
        '..WWWWWWW..',
        '....WWW....',
        '....WWW....',
        '....WWW....',
        '...........',
        '....WWW....',
        '....WWW....',
      ];
      drawBitmap(ctx, emblem, { Y: '#ffe066', W: '#ff85c0' }, 3, 3);
      drawBitmap(emCtx, emblem, { Y: '#ffb703', W: '#fcc2d7' }, 3, 3);
      break;
    }

    case 'mega_titan_top': {
      fillNoise(ctx, rng, ['#9c36b5', '#862e9c']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      px(ctx, 4, 4, '#ffe066', 8, 8);
      px(ctx, 6, 6, '#ff85c0', 4, 4);
      px(emCtx, 4, 4, '#ffaa33', 8, 8);
      break;
    }

    case 'chest_front': {
      // Polka-Dot Jack-in-the-Box Prank Contraption Chest Front (Purple & gold chest with Jester-Star latch)
      fillNoise(ctx, rng, ['#862e9c', '#9c36b5', '#7048e8']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      // Polka dots
      px(ctx, 3, 3, '#ff85c0', 2, 2);
      px(ctx, 11, 3, '#74c0fc', 2, 2);
      px(ctx, 3, 11, '#51cf66', 2, 2);
      px(ctx, 11, 11, '#ff85c0', 2, 2);
      // Golden Jester-Star latch
      drawBitmap(
        ctx,
        [
          '....YY....',
          '..YYYYYY..',
          '.YYYYYYYY.',
          '..YYYYYY..',
          '...Y..Y...',
          '..YY..YY..',
        ],
        { Y: '#ffe066' },
        3,
        5
      );
      drawBitmap(
        emCtx,
        [
          '....YY....',
          '..YYYYYY..',
          '.YYYYYYYY.',
          '..YYYYYY..',
          '...Y..Y...',
          '..YY..YY..',
        ],
        { Y: '#ffb703' },
        3,
        5
      );
      break;
    }

    case 'chest_side': {
      fillNoise(ctx, rng, ['#862e9c', '#9c36b5', '#7048e8']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      px(ctx, 4, 4, '#ff85c0', 2, 2);
      px(ctx, 10, 4, '#74c0fc', 2, 2);
      px(ctx, 4, 10, '#ffd43b', 8, 3);
      break;
    }

    case 'chest_top': {
      fillNoise(ctx, rng, ['#ffd43b', '#f59f00', '#ffe066']);
      px(ctx, 0, 0, '#9c36b5', 16, 2);
      px(ctx, 0, 14, '#9c36b5', 16, 2);
      px(ctx, 0, 0, '#9c36b5', 2, 16);
      px(ctx, 14, 0, '#9c36b5', 2, 16);
      px(ctx, 5, 3, '#fff9db', 6, 10);
      px(emCtx, 5, 3, '#996e00', 6, 10);
      break;
    }

    case 'water': {
      // Playcare Pastel Lavender & Starry Checkered Atrium Floor
      fillNoise(ctx, rng, ['#3b1e6d', '#44237c', '#32185e']);
      px(ctx, 0, 0, '#5f3dc4', 16, 1);
      px(ctx, 0, 0, '#5f3dc4', 1, 16);
      px(ctx, 6, 7, '#f783ac', 3, 2);
      px(ctx, 11, 3, '#ffd43b', 2, 2);
      break;
    }

    case 'lantern_glow': {
      px(ctx, 0, 0, '#f06595', 16, 16);
      px(ctx, 2, 2, '#ffd43b', 12, 12);
      px(ctx, 4, 4, '#fff9db', 8, 8);
      px(emCtx, 1, 1, '#ffd43b', 14, 14);
      px(emCtx, 4, 4, '#ffffff', 8, 8);
      break;
    }

    case 'mushroom_red': {
      // Pink & Lavender Striped Dollhouse Roof Awning
      for (let x = 0; x < 16; x++) {
        const isPink = Math.floor(x / 4) % 2 === 0;
        px(ctx, x, 0, isPink ? '#f06595' : '#f3d9fa', 1, 16);
      }
      px(ctx, 0, 14, '#ffd43b', 16, 2);
      break;
    }

    case 'snowman_face': {
      // Playtime Co. Blue Office Door & Smiling Critters Knock Window (23:36)
      fillNoise(ctx, rng, ['#1c7ed6', '#228be6', '#1971c2']);
      px(ctx, 0, 0, '#ffd43b', 16, 2);
      px(ctx, 0, 0, '#ffd43b', 2, 16);
      px(ctx, 14, 0, '#ffd43b', 2, 16);
      // Glowing office window + golden doorknob
      px(ctx, 4, 3, '#a5d8ff', 8, 5);
      px(ctx, 5, 4, '#ffffff', 6, 3);
      px(ctx, 11, 10, '#ffd43b', 2, 2); // Doorknob
      px(ctx, 4, 10, '#1864ab', 6, 4);
      break;
    }

    default: {
      fillNoise(ctx, rng, ['#ffd43b', '#f06595']);
      break;
    }
  }
}

export function getAtlasUVRect(tileIdx) {
  const col = tileIdx % ATLAS_COLS;
  const row = Math.floor(tileIdx / ATLAS_COLS);
  const pad = 0.12 / ATLAS_SIZE;
  const u0 = (col * TILE_SIZE) / ATLAS_SIZE + pad;
  const u1 = ((col + 1) * TILE_SIZE) / ATLAS_SIZE - pad;
  const v1 = 1 - (row * TILE_SIZE) / ATLAS_SIZE - pad;
  const v0 = 1 - ((row + 1) * TILE_SIZE) / ATLAS_SIZE + pad;
  return { u0, v0, u1, v1 };
}

export function createAtlasBoxGeometry(faceTiles, w = 1, h = 1, d = 1) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const tiles = [
    faceTiles.px ?? faceTiles.side,
    faceTiles.nx ?? faceTiles.side,
    faceTiles.py ?? faceTiles.top ?? faceTiles.side,
    faceTiles.ny ?? faceTiles.bottom ?? faceTiles.top ?? faceTiles.side,
    faceTiles.pz ?? faceTiles.front ?? faceTiles.side,
    faceTiles.nz ?? faceTiles.back ?? faceTiles.front ?? faceTiles.side,
  ];
  for (let f = 0; f < 6; f++) {
    const { u0, v0, u1, v1 } = getAtlasUVRect(tiles[f]);
    const base = f * 4;
    uv.setXY(base + 0, u0, v1);
    uv.setXY(base + 1, u1, v1);
    uv.setXY(base + 2, u0, v0);
    uv.setXY(base + 3, u1, v0);
  }
  uv.needsUpdate = true;
  return geo;
}

function createRingGlowTexture() {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (size * 0.5);
      if (r > 1) continue;
      const ringBand = Math.exp(-Math.pow((r - 0.78) / 0.11, 2));
      const innerFill = r < 0.78 ? 0.24 * (1 - r * 0.5) : 0;
      const alpha = Math.min(1, ringBand * 0.92 + innerFill);
      if (alpha > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSunTexture() {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cx) / cx;
      if (r < 1) {
        const glow = Math.pow(Math.max(0, 1 - r), 2.0) * 0.80;
        ctx.fillStyle = `rgba(255,190,235,${glow.toFixed(3)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Playtime Co. Smiling Flower & Star Skylight Emblem
  px(ctx, 18, 18, '#f06595', 28, 28);
  px(ctx, 20, 20, '#ffd43b', 24, 24);
  px(ctx, 23, 23, '#fff9db', 18, 18);
  px(ctx, 26, 27, '#3b1e6d', 3, 4);
  px(ctx, 35, 27, '#3b1e6d', 3, 4);
  px(ctx, 27, 34, '#e03131', 10, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSparkleTexture() {
  const size = 16;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  px(ctx, 7, 1, 'rgba(255,255,255,0.95)', 2, 14);
  px(ctx, 1, 7, 'rgba(255,255,255,0.95)', 14, 2);
  px(ctx, 5, 5, '#ffffff', 6, 6);
  return finalizePixelTexture(canvas, false);
}

export function createWorldTextures() {
  const rng = createRng(1337);
  const atlasCanvas = makeCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const atlasCtx = atlasCanvas.getContext('2d');
  const emCanvas = makeCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const emCtx = emCanvas.getContext('2d');
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  const tiles = {};

  for (const [name, idx] of Object.entries(TILE_INDEX)) {
    const tileCanvas = makeCanvas(TILE_SIZE, TILE_SIZE);
    const tCtx = tileCanvas.getContext('2d');
    const tileEmCanvas = makeCanvas(TILE_SIZE, TILE_SIZE);
    const tEmCtx = tileEmCanvas.getContext('2d');
    tEmCtx.fillStyle = '#000000';
    tEmCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    paintTile(name, tCtx, tEmCtx, rng);

    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    atlasCtx.drawImage(tileCanvas, col * TILE_SIZE, row * TILE_SIZE);
    emCtx.drawImage(tileEmCanvas, col * TILE_SIZE, row * TILE_SIZE);

    tiles[name] = finalizePixelTexture(tileCanvas, name === 'water');
  }

  const atlasTexture = finalizePixelTexture(atlasCanvas, false);
  const emissiveAtlasTexture = finalizePixelTexture(emCanvas, false);

  return {
    tiles,
    atlasTexture,
    emissiveAtlasTexture,
    ringGlowTex: createRingGlowTexture(),
    sunTex: createSunTexture(),
    sparkleTex: createSparkleTexture(),
  };
}

export const createProceduralTextures = createWorldTextures;
