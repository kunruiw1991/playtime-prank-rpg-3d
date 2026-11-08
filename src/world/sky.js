// Playtime Co. Lavender-Berry & Candy-Pink Playcare Atrium sky dome, smiling flower sun sprite, warm pastel clouds, and prank sparkles.

import * as THREE from '../../vendor/three.module.min.js';
import { createRng } from '../core/rng.js';

export function createSky(textures) {
  const group = new THREE.Group();
  group.name = 'SkyGroup';

  // 1. Vertex-colored Playtime Co. Lavender-Berry & Candy-Pink Playcare Atrium sky dome
  const skyGeo = new THREE.SphereGeometry(86, 28, 18);
  const posAttr = skyGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const zenithCol = new THREE.Color(0x3b1e6d); // Royal violet zenith
  const midSkyCol = new THREE.Color(0x9c4dcc); // Orchid mid-sky
  const horizonCol = new THREE.Color(0xff94c2); // Candy-pink horizon
  const warmGlowCol = new THREE.Color(0xffe066); // Golden Playtime Co. star glow
  const seaHorizonCol = new THREE.Color(0x4a2574); // Deep plum lower atrium
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const ny = Math.max(-1, Math.min(1, y / 86));

    if (ny >= 0) {
      if (ny < 0.30) {
        tmpCol.copy(horizonCol).lerp(midSkyCol, ny / 0.30);
      } else {
        tmpCol.copy(midSkyCol).lerp(zenithCol, Math.min(1, (ny - 0.30) / 0.70));
      }
      // Cheerful golden-pink skylight glow toward the northern-east atrium vista
      const sunDot = Math.max(0, (x * 0.32 + y * 0.34 - z * 0.88) / 86);
      if (sunDot > 0.45) {
        const sunMix = Math.pow((sunDot - 0.45) / 0.55, 1.8) * 0.52;
        tmpCol.lerp(warmGlowCol, sunMix);
      }
    } else {
      tmpCol.copy(horizonCol).lerp(seaHorizonCol, Math.min(1, -ny * 3.0));
    }

    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.renderOrder = -20;
  skyDome.matrixAutoUpdate = false;
  skyDome.updateMatrix();
  group.add(skyDome);

  // 2. Cheerful Playtime Co. Smiling Flower-Star Skylight Sprite (toneMapped: false, fog: false)
  const sunMat = new THREE.SpriteMaterial({
    map: textures.sunTex,
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.position.set(17, 14.0, -58);
  sunSprite.scale.set(15.5, 15.5, 1);
  sunSprite.renderOrder = -15;
  group.add(sunSprite);

  // 3. Drifting warm pastel cotton-candy cloud puffs (0xfff0f8, single InstancedMesh draw call)
  const rng = createRng(90210);
  const cloudPuffs = [];
  const clusterCount = 14;
  for (let c = 0; c < clusterCount; c++) {
    const baseAngle = (c / clusterCount) * Math.PI * 2 + rng.range(-0.12, 0.12);
    const radius = rng.range(46, 64);
    const baseY = rng.range(7.2, 15.0);
    const speed = rng.range(0.014, 0.026);
    const bobPhase = rng.range(0, Math.PI * 2);

    const subCount = c % 3 === 0 ? 4 : 3;
    for (let s = 0; s < subCount; s++) {
      cloudPuffs.push({
        baseAngle,
        angleOffset: (s - (subCount - 1) * 0.5) * rng.range(0.045, 0.07),
        radius: radius + rng.range(-2.2, 2.2),
        baseY: baseY + (s === 1 ? 0.85 : rng.range(-0.35, 0.35)),
        sx: s === 1 ? rng.range(5.4, 7.2) : rng.range(3.6, 5.2),
        sy: s === 1 ? rng.range(1.9, 2.5) : rng.range(1.3, 1.8),
        sz: rng.range(3.2, 4.8),
        speed,
        bobPhase: bobPhase + s * 0.4,
      });
    }
  }

  const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfff0f8,
    emissive: 0xf783ac,
    emissiveIntensity: 0.34,
    roughness: 0.9,
    metalness: 0.0,
    fog: false,
  });
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudPuffs.length);
  cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cloudMesh.castShadow = false;
  cloudMesh.receiveShadow = false;
  cloudMesh.frustumCulled = false;
  group.add(cloudMesh);

  // 4. Floating Playcare & Smiling Critters confetti sparkle motes (1 Points draw call)
  const moteCount = 76;
  const moteBase = new Float32Array(moteCount * 4);
  const motePos = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  const palette = [
    new THREE.Color(0xffe066), // Jester Star Gold
    new THREE.Color(0xff85c0), // Miss Gracie Capsule Pink
    new THREE.Color(0x74c0fc), // Playtime Co. GrabPack Blue
    new THREE.Color(0x69db7c), // Hoppy Soccer Pitch Green
    new THREE.Color(0xe599f7), // Lily Lovebraids Lavender
  ];

  for (let i = 0; i < moteCount; i++) {
    const inHub = i < 24;
    const r = inHub ? rng.range(1.8, 10.8) : rng.range(11.5, 29.5);
    const theta = rng.range(0, Math.PI * 2);
    const mx = Math.cos(theta) * r;
    const mz = Math.sin(theta) * r;
    const my = (mx < -10 && mz < -10) || (mx > 10 && mz < -10) ? rng.range(2.6, 5.4) : rng.range(1.6, 4.5);
    const phase = rng.range(0, Math.PI * 2);

    moteBase[i * 4] = mx;
    moteBase[i * 4 + 1] = my;
    moteBase[i * 4 + 2] = mz;
    moteBase[i * 4 + 3] = phase;

    motePos[i * 3] = mx;
    motePos[i * 3 + 1] = my;
    motePos[i * 3 + 2] = mz;

    let col = palette[0];
    if (!inHub) {
      if (mx < 0 && mz >= 0) col = palette[2];
      else if (mx < 0 && mz < 0) col = palette[4];
      else if (mx >= 0 && mz >= 0) col = palette[3];
      else col = palette[1];
    }
    moteColors[i * 3] = col.r;
    moteColors[i * 3 + 1] = col.g;
    moteColors[i * 3 + 2] = col.b;
  }

  const moteGeo = new THREE.BufferGeometry();
  const motePosAttr = new THREE.BufferAttribute(motePos, 3);
  motePosAttr.setUsage(THREE.DynamicDrawUsage);
  moteGeo.setAttribute('position', motePosAttr);
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteColors, 3));

  const moteMat = new THREE.PointsMaterial({
    map: textures.sparkleTex,
    size: 0.48,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.frustumCulled = false;
  group.add(motePoints);

  const dummy = new THREE.Object3D();

  function updateCloudTransforms(time) {
    for (let i = 0; i < cloudPuffs.length; i++) {
      const p = cloudPuffs[i];
      const ang = p.baseAngle + p.angleOffset + time * p.speed;
      const x = Math.cos(ang) * p.radius;
      const z = Math.sin(ang) * p.radius;
      const y = p.baseY + Math.sin(time * 0.9 + p.bobPhase) * 0.35;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      cloudMesh.setMatrixAt(i, dummy.matrix);
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
  }

  updateCloudTransforms(0);

  function update(_dt, time = 0) {
    updateCloudTransforms(time);

    const sunPulse = 15.5 + Math.sin(time * 1.6) * 0.65;
    sunSprite.scale.set(sunPulse, sunPulse, 1);

    const arr = motePosAttr.array;
    for (let i = 0; i < moteCount; i++) {
      const bx = moteBase[i * 4];
      const by = moteBase[i * 4 + 1];
      const bz = moteBase[i * 4 + 2];
      const ph = moteBase[i * 4 + 3];
      arr[i * 3] = bx + Math.sin(time * 0.8 + ph) * 0.35;
      arr[i * 3 + 1] = by + Math.sin(time * 1.7 + ph * 1.3) * 0.42;
      arr[i * 3 + 2] = bz + Math.cos(time * 0.75 + ph) * 0.35;
    }
    motePosAttr.needsUpdate = true;
  }

  return { group, update };
}
