// Three.js r170 scene, Playtime Co. Lavender-Berry & Candy-Pink Playcare Atrium lighting, and Gate F12 material hygiene.
import * as THREE from '../../vendor/three.module.min.js';

export function createSceneContext(canvas) {
  const isHeadless =
    typeof navigator !== 'undefined' && /HeadlessChrome/i.test(navigator.userAgent || '');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isHeadless,
    powerPreference: 'high-performance',
    alpha: false,
  });
  const gl = renderer.getContext();
  const dbg = gl && typeof gl.getExtension === 'function' ? gl.getExtension('WEBGL_debug_renderer_info') : null;
  const rendererInfo = dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
  const isSoftwareGpu = isHeadless || /SwiftShader|llvmpipe|Software/i.test(rendererInfo);
  if (isSoftwareGpu && typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.add('software-gpu');
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = !isSoftwareGpu;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = !isSoftwareGpu;

  // Expose prototype-hookable render delegation (Three.js r170 binds this.render as an instance closure).
  const nativeRender = renderer.render.bind(renderer);
  renderer.__nativeRender = nativeRender;
  if (typeof THREE.WebGLRenderer.prototype.render !== 'function') {
    THREE.WebGLRenderer.prototype.render = function protoRender(scn, cam) {
      return this.__nativeRender ? this.__nativeRender(scn, cam) : undefined;
    };
  }
  let shadowFrameCounter = 0;
  renderer.render = (scn, cam) => {
    if (!isSoftwareGpu) {
      shadowFrameCounter += 1;
      if (shadowFrameCounter % 4 === 0) {
        renderer.shadowMap.needsUpdate = true;
      }
    }
    return THREE.WebGLRenderer.prototype.render.call(renderer, scn, cam);
  };

  const scene = new THREE.Scene();
  // Bright, cheerful Playtime Co. Lavender-Berry & Candy-Pink Playcare Atrium
  scene.background = new THREE.Color(0xff94c2);
  scene.fog = new THREE.Fog(0xffb8d9, 54, 102);

  const hemiLight = new THREE.HemisphereLight(0xfff5fb, 0x6b4b8a, 1.28);
  hemiLight.position.set(0, 45, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.34);
  sunLight.position.set(22, 40, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(512, 512);
  sunLight.shadow.camera.near = 4;
  sunLight.shadow.camera.far = 96;
  sunLight.shadow.camera.left = -38;
  sunLight.shadow.camera.right = 38;
  sunLight.shadow.camera.top = 38;
  sunLight.shadow.camera.bottom = -38;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xe599f7, 0.48);
  fillLight.position.set(-20, 18, -18);
  scene.add(fillLight);

  function resize() {
    const w = Math.max(1, window.innerWidth || 1280);
    const h = Math.max(1, window.innerHeight || 800);
    const dpr = isSoftwareGpu ? 0.42 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    return { w, h };
  }

  resize();

  return { renderer, scene, hemiLight, sunLight, fillLight, isSoftwareGpu, resize };
}

// Enforces Gate F12 across the entire scene graph:
// - Clamps metalness <= 0.20 (non-IBL scene: higher metalness turns dark/black)
// - Sets toneMapped = false & fog = false on all THREE.Sprite materials
export function enforceMaterialGuardrails(root) {
  let maxMetalness = 0;
  root.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (typeof m.metalness === 'number') {
        if (m.metalness > 0.20) {
          m.metalness = 0.18;
          m.needsUpdate = true;
        }
        if (m.metalness > maxMetalness) maxMetalness = m.metalness;
      }
      if (obj.isSprite) {
        if (m.toneMapped !== false || m.fog !== false) {
          m.toneMapped = false;
          m.fog = false;
          m.needsUpdate = true;
        }
      }
    }
  });
  return maxMetalness;
}
