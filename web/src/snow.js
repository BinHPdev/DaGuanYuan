// 第四十九回 琉璃世界白雪红梅: snow settles on every upward-facing surface; flakes fall around the viewer.
// A shared uniform drives all materials so switching season is instant.
import * as THREE from 'three';

export const snowUniform = { value: 0 };

// Patch a material so that upward-facing fragments blend toward snow. amount scales coverage
// (foliage holds less snow; red plum blossoms none, so 红梅 stays vivid against the white).
export function snowify(mat, amount = 1, allFaces = false) {
  if (!mat || mat.userData.snowPatched || !(mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
  mat.userData.snowPatched = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uSnow = snowUniform;
    sh.uniforms.uSnowAmt = { value: amount };
    sh.uniforms.uSnowAll = { value: allFaces ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        {
          vec3 sn = objectNormal;
          #ifdef USE_INSTANCING
            sn = mat3(instanceMatrix) * sn;
          #endif
          vSnowUp = normalize(mat3(modelMatrix) * sn).y;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSnowUp;\nuniform float uSnow, uSnowAmt, uSnowAll;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float up = gl_FrontFacing ? vSnowUp : -vSnowUp;
          float cover = uSnow * uSnowAmt * max(smoothstep(0.25, 0.75, up), uSnowAll);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.97), clamp(cover, 0.0, 1.0));
        }`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|snow' + amount + (allFaces ? 'a' : '');
  mat.needsUpdate = true;
}

// Walk the scene once and patch materials; callers can tag meshes with userData.snowAmt.
export function snowifyScene(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noSnow) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) snowify(m, o.userData.snowAmt ?? m.userData.snowAmt ?? 1, !!o.userData.snowAll);
  });
}

// Falling flakes in a box that follows the camera.
export function buildSnowfall(count = 6000) {
  const box = 90, pos = new Float32Array(count * 3), spd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * box; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = (Math.random() - 0.5) * box;
    spd[i] = 0.8 + Math.random() * 1.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.22, transparent: true, depthWrite: false, opacity: 0.9 }));
  pts.frustumCulled = false; pts.visible = false;
  pts.userData.update = (dt, t, cam) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i * 3 + 1] -= spd[i] * dt;
      p[i * 3] += Math.sin(t * 0.7 + i) * 0.3 * dt;
      if (p[i * 3 + 1] < -2) p[i * 3 + 1] += 40;
    }
    geo.attributes.position.needsUpdate = true;
    pts.position.set(Math.round(cam.position.x / 10) * 10, cam.position.y - 20, Math.round(cam.position.z / 10) * 10);
  };
  return pts;
}
