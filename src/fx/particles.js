// Pooled low-draw-call 3D particle & Rainbow Spring Cloud FX for Lucky Block Titans 3D (owner: lucky-vo-audio).
// Strict Gate F12 compliance: metalness <= 0.08, toneMapped: false, fog: false, zero runtime mesh allocations!

import * as THREE from '../../vendor/three.module.min.js';

const MAX_CRUMBS = 360;
const MAX_SPARKLES = 260;
const MAX_RINGS = 24;
const MAX_SPRING_CLOUDS = 1;

const RAINBOW_HEX = Object.freeze([
  0xff4d6d,
  0xff922b,
  0xffd43b,
  0x51cf66,
  0x39d5ff,
  0x9775fa,
]);

const CANDY_PINATA_HEX = Object.freeze([
  0xff6b9d,
  0xffd43b,
  0x39d5ff,
  0x69db7c,
  0xb197fc,
  0xff922b,
  0xffffff,
]);

const FIREWORK_PALETTES = Object.freeze([
  [0xffd43b, 0xfff3bf, 0xff922b],
  [0xff6b9d, 0xffdeeb, 0xfcc419],
  [0x39d5ff, 0x99e9f2, 0x74c0fc],
  [0x69db7c, 0xd8f5a2, 0xffd43b],
  [0xb197fc, 0xe5dbff, 0x39d5ff],
]);

export function createParticles(sceneOrCtx) {
  const targetScene = sceneOrCtx?.isScene ? sceneOrCtx : sceneOrCtx?.scene;
  const root = new THREE.Group();
  root.name = 'fx-particles-root';
  if (targetScene && typeof targetScene.add === 'function') {
    targetScene.add(root);
  }

  // Deterministic lightweight visual LCG (never touches gameplay RNG!)
  let fxSeed = 2463534242;
  function fxRand() {
    fxSeed = (Math.imul(fxSeed, 1664525) + 1013904223) >>> 0;
    return fxSeed / 4294967296;
  }
  function fxRange(min, max) {
    return min + (max - min) * fxRand();
  }

  const dummy = new THREE.Object3D();
  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpColor = new THREE.Color();
  const whiteColor = new THREE.Color(0xffffff);

  // 1. Pooled 3D Voxel Crumb & Candy Pinata InstancedMesh (1 draw call)
  const crumbGeo = new THREE.BoxGeometry(1, 1, 1);
  const crumbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.05,
    toneMapped: false,
  });
  const crumbMesh = new THREE.InstancedMesh(crumbGeo, crumbMat, MAX_CRUMBS);
  crumbMesh.frustumCulled = false;
  crumbMesh.castShadow = false;
  crumbMesh.receiveShadow = false;
  for (let i = 0; i < MAX_CRUMBS; i++) {
    crumbMesh.setMatrixAt(i, zeroMatrix);
    crumbMesh.setColorAt(i, whiteColor);
  }
  crumbMesh.instanceMatrix.needsUpdate = true;
  if (crumbMesh.instanceColor) crumbMesh.instanceColor.needsUpdate = true;
  root.add(crumbMesh);

  const crumbs = Array.from({ length: MAX_CRUMBS }, () => ({
    active: false,
    age: 0,
    life: 0.8,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vrx: 0,
    vry: 0,
    vrz: 0,
    size: 0.22,
    gravity: 22,
    floorY: 1.05,
  }));
  let crumbCursor = 0;

  // 2. Pooled Rising Star Sparkle & Firework Glow InstancedMesh (1 draw call)
  const sparkleGeo = new THREE.OctahedronGeometry(0.5, 0);
  const sparkleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    fog: false,
  });
  const sparkleMesh = new THREE.InstancedMesh(sparkleGeo, sparkleMat, MAX_SPARKLES);
  sparkleMesh.frustumCulled = false;
  for (let i = 0; i < MAX_SPARKLES; i++) {
    sparkleMesh.setMatrixAt(i, zeroMatrix);
    sparkleMesh.setColorAt(i, whiteColor);
  }
  sparkleMesh.instanceMatrix.needsUpdate = true;
  if (sparkleMesh.instanceColor) sparkleMesh.instanceColor.needsUpdate = true;
  root.add(sparkleMesh);

  const sparkles = Array.from({ length: MAX_SPARKLES }, () => ({
    active: false,
    age: 0,
    life: 0.9,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    gravity: -1.5,
    size: 0.28,
    spin: 0,
  }));
  let sparkleCursor = 0;

  // 3. Pooled Ground Tap / Shockwave Ring InstancedMesh (1 draw call)
  const ringGeo = new THREE.RingGeometry(0.36, 0.52, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
    toneMapped: false,
    fog: false,
    depthWrite: false,
  });
  const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, MAX_RINGS);
  ringMesh.frustumCulled = false;
  for (let i = 0; i < MAX_RINGS; i++) {
    ringMesh.setMatrixAt(i, zeroMatrix);
    ringMesh.setColorAt(i, whiteColor);
  }
  ringMesh.instanceMatrix.needsUpdate = true;
  if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
  root.add(ringMesh);

  const rings = Array.from({ length: MAX_RINGS }, () => ({
    active: false,
    age: 0,
    life: 0.45,
    x: 0,
    y: 0,
    z: 0,
    startRadius: 0.4,
    endRadius: 2.2,
  }));
  let ringCursor = 0;

  // 4. Pooled Fluffy 3D Rainbow Spring Clouds (pre-built for zero runtime compile hitch!)
  const cloudPuffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xdff4ff,
    emissiveIntensity: 0.30,
    roughness: 0.78,
    metalness: 0.0,
    toneMapped: false,
  });
  const rainbowBandMats = RAINBOW_HEX.map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.28,
        roughness: 0.65,
        metalness: 0.04,
        toneMapped: false,
      })
  );

  const puffCenterGeo = new THREE.BoxGeometry(1.65, 0.72, 1.35);
  const puffSideGeo = new THREE.BoxGeometry(1.05, 0.62, 1.05);
  const puffTopGeo = new THREE.BoxGeometry(1.15, 0.55, 0.95);
  const springCoilGeo = new THREE.TorusGeometry(0.58, 0.11, 8, 18);
  springCoilGeo.rotateX(Math.PI / 2);
  const rainbowStripeGeo = new THREE.BoxGeometry(0.28, 0.22, 1.52);

  function buildSpringCloudSlot() {
    const group = new THREE.Group();
    group.visible = false;

    const springGroup = new THREE.Group();
    const coil = new THREE.Mesh(springCoilGeo, rainbowBandMats[2]);
    coil.position.y = 0.24;
    springGroup.add(coil);
    group.add(springGroup);

    const cushionGroup = new THREE.Group();
    cushionGroup.position.y = 0.62;
    const corePuff = new THREE.Mesh(puffCenterGeo, cloudPuffMat);
    cushionGroup.add(corePuff);

    group.add(cushionGroup);
    root.add(group);

    return {
      group,
      springGroup,
      cushionGroup,
      active: false,
      age: 0,
      life: 1.35,
    };
  }

  const springClouds = Array.from({ length: MAX_SPRING_CLOUDS }, buildSpringCloudSlot);
  let springCloudCursor = 0;

  // Queued multi-shell victory fireworks
  const pendingFireworks = [];
  let totalSpawned = 0;

  function emitCrumb({
    x,
    y,
    z,
    vx,
    vy,
    vz,
    colorHex = 0xffd43b,
    size = 0.24,
    life = 0.78,
    gravity = 22,
    floorY = 1.05,
  }) {
    const idx = crumbCursor;
    crumbCursor = (crumbCursor + 1) % MAX_CRUMBS;
    const c = crumbs[idx];
    c.active = true;
    c.age = 0;
    c.life = life;
    c.x = x;
    c.y = y;
    c.z = z;
    c.vx = vx;
    c.vy = vy;
    c.vz = vz;
    c.rx = fxRange(0, Math.PI * 2);
    c.ry = fxRange(0, Math.PI * 2);
    c.rz = fxRange(0, Math.PI * 2);
    c.vrx = fxRange(-10, 10);
    c.vry = fxRange(-10, 10);
    c.vrz = fxRange(-10, 10);
    c.size = size;
    c.gravity = gravity;
    c.floorY = floorY;

    tmpColor.setHex(Number(colorHex) || 0xffd43b);
    crumbMesh.setColorAt(idx, tmpColor);
    if (crumbMesh.instanceColor) crumbMesh.instanceColor.needsUpdate = true;

    dummy.position.set(x, y, z);
    dummy.rotation.set(c.rx, c.ry, c.rz);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    crumbMesh.setMatrixAt(idx, dummy.matrix);
    crumbMesh.instanceMatrix.needsUpdate = true;
    totalSpawned += 1;
  }

  function emitSparkle({
    x,
    y,
    z,
    vx,
    vy,
    vz,
    colorHex = 0xffd43b,
    size = 0.30,
    life = 0.85,
    gravity = -1.2,
  }) {
    const idx = sparkleCursor;
    sparkleCursor = (sparkleCursor + 1) % MAX_SPARKLES;
    const s = sparkles[idx];
    s.active = true;
    s.age = 0;
    s.life = life;
    s.x = x;
    s.y = y;
    s.z = z;
    s.vx = vx;
    s.vy = vy;
    s.vz = vz;
    s.gravity = gravity;
    s.size = size;
    s.spin = fxRange(-6, 6);

    tmpColor.setHex(Number(colorHex) || 0xffd43b);
    sparkleMesh.setColorAt(idx, tmpColor);
    if (sparkleMesh.instanceColor) sparkleMesh.instanceColor.needsUpdate = true;

    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    sparkleMesh.setMatrixAt(idx, dummy.matrix);
    sparkleMesh.instanceMatrix.needsUpdate = true;
    totalSpawned += 1;
  }

  function emitRing({
    x,
    y,
    z,
    colorHex = 0xffe066,
    startRadius = 0.35,
    endRadius = 2.4,
    life = 0.42,
  }) {
    const idx = ringCursor;
    ringCursor = (ringCursor + 1) % MAX_RINGS;
    const r = rings[idx];
    r.active = true;
    r.age = 0;
    r.life = life;
    r.x = x;
    r.y = y;
    r.z = z;
    r.startRadius = startRadius;
    r.endRadius = endRadius;

    tmpColor.setHex(Number(colorHex) || 0xffe066);
    ringMesh.setColorAt(idx, tmpColor);
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(startRadius, 1, startRadius);
    dummy.updateMatrix();
    ringMesh.setMatrixAt(idx, dummy.matrix);
    ringMesh.instanceMatrix.needsUpdate = true;
    totalSpawned += 1;
  }

  function normalizeColorHex(c, fallback = 0xffd43b) {
    if (typeof c === 'number') return c;
    if (typeof c === 'string') {
      tmpColor.set(c);
      return tmpColor.getHex();
    }
    return fallback;
  }

  function spawnBlockBurst(x = 0, y = 1.5, z = 0, colorOrPalette = 0xffd43b, count = 16) {
    const palette = Array.isArray(colorOrPalette) && colorOrPalette.length > 0
      ? colorOrPalette.map((c) => normalizeColorHex(c))
      : [normalizeColorHex(colorOrPalette)];
    const n = Math.max(4, Math.min(48, Number(count) || 16));
    const floorY = Math.max(0.95, y - 0.55);

    for (let i = 0; i < n; i++) {
      const ang = fxRange(0, Math.PI * 2);
      const spd = fxRange(1.8, 5.4);
      emitCrumb({
        x: x + fxRange(-0.32, 0.32),
        y: y + fxRange(-0.15, 0.35),
        z: z + fxRange(-0.32, 0.32),
        vx: Math.cos(ang) * spd,
        vy: fxRange(4.2, 8.8),
        vz: Math.sin(ang) * spd,
        colorHex: palette[i % palette.length],
        size: fxRange(0.18, 0.31),
        life: fxRange(0.55, 0.92),
        gravity: 22,
        floorY,
      });
    }
    emitRing({ x, y: floorY + 0.04, z, colorHex: palette[0], startRadius: 0.4, endRadius: 1.9, life: 0.34 });
  }

  function spawnLuckyBurst(x = 0, y = 1.5, z = 0) {
    spawnBlockBurst(x, y, z, RAINBOW_HEX, 22);
    spawnStarSparkles(x, y + 0.25, z, 14, 0xffe066);
  }

  function spawnStarSparkles(x = 0, y = 1.5, z = 0, arg4 = undefined, arg5 = undefined) {
    // Support both (x, y, z, count, color) and (x, y, z, color, count) caller conventions!
    const swapped =
      typeof arg4 === 'string' ||
      (typeof arg4 === 'number' && arg4 > 255) ||
      Boolean(arg4 && typeof arg4 === 'object');
    const rawCount = swapped ? arg5 : arg4;
    const rawColor = swapped ? arg4 : arg5;
    const baseHex = normalizeColorHex(rawColor !== undefined ? rawColor : 0xffd43b, 0xffd43b);
    const n = Math.max(3, Math.min(40, Number(rawCount) || 12));
    for (let i = 0; i < n; i++) {
      const ang = fxRange(0, Math.PI * 2);
      const rad = fxRange(0.4, 2.2);
      const col = i % 3 === 0 ? 0xfff9db : baseHex;
      emitSparkle({
        x: x + fxRange(-0.28, 0.28),
        y: y + fxRange(0, 0.45),
        z: z + fxRange(-0.28, 0.28),
        vx: Math.cos(ang) * rad,
        vy: fxRange(2.2, 5.2),
        vz: Math.sin(ang) * rad,
        colorHex: col,
        size: fxRange(0.20, 0.36),
        life: fxRange(0.60, 1.05),
        gravity: -0.8,
      });
    }
  }

  function spawnTapRipple(x = 0, y = 1.02, z = 0, color = 0xffe066) {
    const hex = normalizeColorHex(color, 0xffe066);
    emitRing({ x, y: y + 0.04, z, colorHex: hex, startRadius: 0.28, endRadius: 1.55, life: 0.36 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + fxRange(-0.3, 0.3);
      emitSparkle({
        x: x + Math.cos(ang) * 0.25,
        y: y + 0.12,
        z: z + Math.sin(ang) * 0.25,
        vx: Math.cos(ang) * 0.9,
        vy: fxRange(1.5, 2.6),
        vz: Math.sin(ang) * 0.9,
        colorHex: hex,
        size: 0.18,
        life: 0.42,
        gravity: 3.0,
      });
    }
  }

  // Fluffy 3D Rainbow Spring Cloud for under-geared Titan boings!
  function spawnSpringCloud(x = 0, y = 1.0, z = 0) {
    const slot = springClouds[springCloudCursor];
    springCloudCursor = (springCloudCursor + 1) % MAX_SPRING_CLOUDS;

    slot.active = true;
    slot.age = 0;
    slot.life = 1.35;
    slot.group.visible = true;
    slot.group.position.set(x, y + 0.05, z);
    slot.group.scale.set(1.15, 0.55, 1.15);
    slot.springGroup.scale.set(1, 0.5, 1);
    slot.cushionGroup.position.y = 0.52;

    emitRing({
      x,
      y: y + 0.06,
      z,
      colorHex: 0x39d5ff,
      startRadius: 0.7,
      endRadius: 3.8,
      life: 0.55,
    });
    emitRing({
      x,
      y: y + 0.10,
      z,
      colorHex: 0xff6b9d,
      startRadius: 0.4,
      endRadius: 2.8,
      life: 0.45,
    });

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const spd = fxRange(1.6, 3.8);
      emitSparkle({
        x: x + Math.cos(ang) * 0.65,
        y: y + 0.45,
        z: z + Math.sin(ang) * 0.65,
        vx: Math.cos(ang) * spd,
        vy: fxRange(2.8, 6.2),
        vz: Math.sin(ang) * spd,
        colorHex: RAINBOW_HEX[i % RAINBOW_HEX.length],
        size: fxRange(0.24, 0.40),
        life: fxRange(0.65, 1.05),
        gravity: 2.0,
      });
    }
    totalSpawned += 1;
    return slot.group;
  }

  function spawnHitSpark(x = 0, y = 2.5, z = 0, color = 0xffd43b) {
    const hex = normalizeColorHex(color, 0xffd43b);
    spawnBlockBurst(x, y, z, [hex, 0xffffff, 0xff922b], 14);
    spawnStarSparkles(x, y, z, 10, hex);
  }

  function spawnPinataExplosion(x = 0, y = 3.0, z = 0) {
    const floorY = Math.max(0.95, y - 2.0);
    for (let i = 0; i < 64; i++) {
      const theta = fxRange(0, Math.PI * 2);
      const phi = fxRange(-0.2, Math.PI * 0.48);
      const spd = fxRange(3.5, 10.5);
      emitCrumb({
        x: x + fxRange(-0.5, 0.5),
        y: y + fxRange(-0.4, 0.8),
        z: z + fxRange(-0.5, 0.5),
        vx: Math.cos(theta) * Math.cos(phi) * spd,
        vy: Math.sin(phi) * spd + fxRange(4.0, 8.5),
        vz: Math.sin(theta) * Math.cos(phi) * spd,
        colorHex: CANDY_PINATA_HEX[i % CANDY_PINATA_HEX.length],
        size: fxRange(0.24, 0.44),
        life: fxRange(0.85, 1.45),
        gravity: 19,
        floorY,
      });
    }
    for (let i = 0; i < 36; i++) {
      const ang = fxRange(0, Math.PI * 2);
      const spd = fxRange(2.0, 6.8);
      emitSparkle({
        x,
        y: y + 0.4,
        z,
        vx: Math.cos(ang) * spd,
        vy: fxRange(3.5, 8.5),
        vz: Math.sin(ang) * spd,
        colorHex: RAINBOW_HEX[i % RAINBOW_HEX.length],
        size: fxRange(0.30, 0.50),
        life: fxRange(0.85, 1.35),
        gravity: 2.5,
      });
    }
    emitRing({ x, y: floorY + 0.08, z, colorHex: 0xffd43b, startRadius: 0.9, endRadius: 6.2, life: 0.62 });
    emitRing({ x, y: floorY + 0.12, z, colorHex: 0xff6b9d, startRadius: 0.5, endRadius: 4.4, life: 0.50 });
  }

  function spawnFirework(x = 0, y = 10, z = -6, paletteIndex = -1) {
    const pal = paletteIndex >= 0
      ? FIREWORK_PALETTES[paletteIndex % FIREWORK_PALETTES.length]
      : FIREWORK_PALETTES[Math.floor(fxRand() * FIREWORK_PALETTES.length)];

    for (let i = 0; i < 34; i++) {
      const u = fxRange(-1, 1);
      const theta = fxRange(0, Math.PI * 2);
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      const spd = fxRange(4.2, 8.8);
      emitSparkle({
        x,
        y,
        z,
        vx: r * Math.cos(theta) * spd,
        vy: u * spd + 1.2,
        vz: r * Math.sin(theta) * spd,
        colorHex: pal[i % pal.length],
        size: fxRange(0.28, 0.48),
        life: fxRange(0.80, 1.35),
        gravity: 4.8,
      });
    }
  }

  function spawnVictoryFireworks(centerX = 0, centerY = 9.5, centerZ = -7.5) {
    const offsets = [
      [0, 1.5, 0, 0.0, 0],
      [-5.5, 0.8, 1.2, 0.22, 1],
      [5.5, 1.0, 1.2, 0.42, 2],
      [-3.0, 2.6, -1.5, 0.68, 3],
      [3.0, 2.8, -1.5, 0.92, 4],
      [0, 3.6, -0.8, 1.18, 0],
    ];
    for (const [dx, dy, dz, delay, palIdx] of offsets) {
      if (delay <= 0.001) {
        spawnFirework(centerX + dx, centerY + dy, centerZ + dz, palIdx);
      } else {
        pendingFireworks.push({
          timer: delay,
          x: centerX + dx,
          y: centerY + dy,
          z: centerZ + dz,
          palIdx,
        });
      }
    }
  }

  function update(dt = 1 / 60) {
    const step = Math.min(0.1, Math.max(0, Number(dt) || 0));
    if (step <= 0) return;

    // Scheduled multi-burst fireworks
    for (let i = pendingFireworks.length - 1; i >= 0; i--) {
      const fw = pendingFireworks[i];
      fw.timer -= step;
      if (fw.timer <= 0) {
        spawnFirework(fw.x, fw.y, fw.z, fw.palIdx);
        pendingFireworks.splice(i, 1);
      }
    }

    // Update voxel crumbs
    let crumbsDirty = false;
    for (let i = 0; i < MAX_CRUMBS; i++) {
      const c = crumbs[i];
      if (!c.active) continue;
      crumbsDirty = true;
      c.age += step;
      if (c.age >= c.life) {
        c.active = false;
        crumbMesh.setMatrixAt(i, zeroMatrix);
        continue;
      }
      c.vy -= c.gravity * step;
      c.x += c.vx * step;
      c.y += c.vy * step;
      c.z += c.vz * step;
      if (c.y < c.floorY) {
        c.y = c.floorY;
        c.vy = Math.abs(c.vy) * 0.42;
        c.vx *= 0.78;
        c.vz *= 0.78;
      }
      c.rx += c.vrx * step;
      c.ry += c.vry * step;
      c.rz += c.vrz * step;

      const t = c.age / c.life;
      const scale = c.size * (t > 0.72 ? Math.max(0.01, (1 - t) / 0.28) : 1.0);
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(c.rx, c.ry, c.rz);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      crumbMesh.setMatrixAt(i, dummy.matrix);
    }
    if (crumbsDirty) {
      crumbMesh.instanceMatrix.needsUpdate = true;
    }

    // Update rising sparkles & firework stars
    let sparklesDirty = false;
    for (let i = 0; i < MAX_SPARKLES; i++) {
      const s = sparkles[i];
      if (!s.active) continue;
      sparklesDirty = true;
      s.age += step;
      if (s.age >= s.life) {
        s.active = false;
        sparkleMesh.setMatrixAt(i, zeroMatrix);
        continue;
      }
      s.vy -= s.gravity * step;
      s.x += s.vx * step;
      s.y += s.vy * step;
      s.z += s.vz * step;

      const t = s.age / s.life;
      const pulse = Math.sin(t * Math.PI);
      const scale = Math.max(0.01, s.size * (0.35 + 0.85 * pulse));
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(s.age * s.spin, s.age * s.spin * 1.3, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      sparkleMesh.setMatrixAt(i, dummy.matrix);
    }
    if (sparklesDirty) {
      sparkleMesh.instanceMatrix.needsUpdate = true;
    }

    // Update shockwave / tap rings
    let ringsDirty = false;
    for (let i = 0; i < MAX_RINGS; i++) {
      const r = rings[i];
      if (!r.active) continue;
      ringsDirty = true;
      r.age += step;
      if (r.age >= r.life) {
        r.active = false;
        ringMesh.setMatrixAt(i, zeroMatrix);
        continue;
      }
      const t = r.age / r.life;
      const ease = 1 - Math.pow(1 - t, 3);
      const radius = r.startRadius + (r.endRadius - r.startRadius) * ease;
      const thickness = Math.max(0.05, 1 - t);
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(radius, thickness, radius);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(i, dummy.matrix);
    }
    if (ringsDirty) {
      ringMesh.instanceMatrix.needsUpdate = true;
    }

    // Update 3D Rainbow Spring Clouds
    for (const sc of springClouds) {
      if (!sc.active) continue;
      sc.age += step;
      if (sc.age >= sc.life) {
        sc.active = false;
        sc.group.visible = false;
        continue;
      }
      const t = sc.age / sc.life;
      // Elastic spring-boing envelope!
      const springWave = Math.exp(-5.2 * t) * Math.sin(t * 22);
      const fadeOut = t > 0.72 ? Math.max(0.01, (1 - t) / 0.28) : 1.0;
      const stretchY = Math.max(0.25, (1.0 + 0.55 * springWave) * fadeOut);
      const squashXZ = Math.max(0.25, (1.0 - 0.22 * springWave) * fadeOut);

      sc.group.scale.set(squashXZ * 1.15, stretchY * 1.12, squashXZ * 1.15);
      sc.springGroup.scale.y = Math.max(0.35, 1.0 + 0.65 * springWave);
      sc.cushionGroup.position.y = 0.68 + Math.max(-0.2, 0.36 * springWave);
      sc.group.rotation.y += step * 1.6;
    }
  }

  function clear() {
    pendingFireworks.length = 0;
    for (let i = 0; i < MAX_CRUMBS; i++) {
      crumbs[i].active = false;
      crumbMesh.setMatrixAt(i, zeroMatrix);
    }
    crumbMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < MAX_SPARKLES; i++) {
      sparkles[i].active = false;
      sparkleMesh.setMatrixAt(i, zeroMatrix);
    }
    sparkleMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < MAX_RINGS; i++) {
      rings[i].active = false;
      ringMesh.setMatrixAt(i, zeroMatrix);
    }
    ringMesh.instanceMatrix.needsUpdate = true;

    for (const sc of springClouds) {
      sc.active = false;
      sc.group.visible = false;
    }
  }

  function getState() {
    let activeCrumbs = 0;
    let activeSparkles = 0;
    let activeRings = 0;
    let activeClouds = 0;
    for (const c of crumbs) if (c.active) activeCrumbs += 1;
    for (const s of sparkles) if (s.active) activeSparkles += 1;
    for (const r of rings) if (r.active) activeRings += 1;
    for (const sc of springClouds) if (sc.active) activeClouds += 1;
    return {
      activeCrumbs,
      activeSparkles,
      activeRings,
      activeClouds,
      totalSpawned,
    };
  }

  function dispose() {
    clear();
    if (root.parent) root.parent.remove(root);
    crumbGeo.dispose();
    crumbMat.dispose();
    sparkleGeo.dispose();
    sparkleMat.dispose();
    ringGeo.dispose();
    ringMat.dispose();
    puffCenterGeo.dispose();
    puffSideGeo.dispose();
    puffTopGeo.dispose();
    springCoilGeo.dispose();
    rainbowStripeGeo.dispose();
    cloudPuffMat.dispose();
    for (const m of rainbowBandMats) m.dispose();
  }

  return {
    group: root,
    spawnBlockBurst,
    blockBurst: spawnBlockBurst,
    crumbBurst: spawnBlockBurst,
    spawnLuckyBurst,
    luckyBurst: spawnLuckyBurst,
    spawnStarSparkles,
    starSparkles: spawnStarSparkles,
    gemSparkles: spawnStarSparkles,
    fountainBurst: spawnStarSparkles,
    spawnTapRipple,
    tapRipple: spawnTapRipple,
    spawnSpringCloud,
    cloudBoing: spawnSpringCloud,
    spawnHitSpark,
    titanHitBurst: spawnHitSpark,
    spawnPinataExplosion,
    pinataBurst: spawnPinataExplosion,
    titanPinataBurst: spawnPinataExplosion,
    spawnFirework,
    spawnVictoryFireworks,
    victoryFireworks: spawnVictoryFireworks,
    update,
    clear,
    reset: clear,
    getState,
    dispose,
  };
}
