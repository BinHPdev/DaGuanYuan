// Animated life in the garden: the 沁芳闸 cascade, wind in the plants, drifting petals
// (落花浮荡), butterflies, koi, ducks and geese (第十七回 "买些鹅鸭鸡类"), chickens at 稻香村,
// and fireflies on moonlit nights.
// initDynamics is called once after the world is built; updateDynamics every frame.
import * as THREE from 'three';
import { floraUniforms, floraInfo } from './flora.js';
import { flowAt } from './water.js';

let C = null;          // ctx
const systems = [];    // { update(dt, t, night) }
let nightLast = null;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _sky = new THREE.Color();
const isNight = () => {
  const m = C.getTimeMode?.() || '昼';
  if (m === '月夜' || m === '元宵') return true;
  // also follow the lighting itself (the water's sky tint is darkened at night)
  const u = C.water?.material?.uniforms?.uSky;
  return !!u && _sky.copy(u.value).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25;
};

export function initDynamics(ctx) {
  C = ctx;
  const L = ctx.layout;
  buildCascade(L);
  systems.push(petals());
  systems.push(butterflies());
  systems.push(koi(L));
  systems.push(waterfowl(L));
  systems.push(chickens(L));
  systems.push(fireflies(L));
}

export function updateDynamics(dt, t) {
  if (!C) return;
  floraUniforms.uTime.value = t;
  const night = isNight();
  for (const s of systems) s.update(dt, t, night, night !== nightLast);
  nightLast = night;
}

// ---------------------------------------------------------------- 沁芳闸 cascade
// "至一大桥前，见水如晶帘一般奔入。原来这桥便是通外河之闸，引泉而入者。"
// The outer river is held higher behind a stone weir on the inflow (east) side of the sluice
// bridge and pours over it as a crystal curtain.
let cascadeMat = null;
function buildCascade(L) {
  const s = L.water.streams[0].pts;
  const sl = L.places.find((p) => p.id === 'qinfangzha');
  const d = new THREE.Vector2(s[2][0] - s[1][0], s[2][1] - s[1][1]).normalize(); // flow direction (into garden)
  const c = new THREE.Vector2(-d.y, d.x);                                        // across the stream
  const lipY = 0.62, W = 7.8, fallLen = 1.5;
  const lip = new THREE.Vector2(sl.x, sl.z).addScaledVector(d, -4.6);

  // raised outer-river water upstream of the weir, re-using the garden's water shader
  const up = [lip, new THREE.Vector2(s[1][0], s[1][1]).addScaledVector(d, -6), new THREE.Vector2(s[0][0], s[0][1])];
  const pos = [], idx = [];
  up.forEach((p, i) => {
    const dir = i < up.length - 1 ? up[i + 1].clone().sub(p).normalize() : p.clone().sub(up[i - 1]).normalize();
    const n = new THREE.Vector2(-dir.y, dir.x);
    for (const k of [-1, 1]) pos.push(p.x + n.x * k * (W / 2 + 0.2), lipY, p.y + n.y * k * (W / 2 + 0.2));
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  });
  const ug = new THREE.BufferGeometry();
  ug.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ug.setIndex(idx);
  const upper = new THREE.Mesh(ug, C.water.material);
  upper.renderOrder = 1;
  C.scene.add(upper);

  // stone weir sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.7, lipY + 1.7, W + 0.4), new THREE.MeshStandardMaterial({ color: '#b9b4a6', roughness: 0.95 }));
  sill.position.set(lip.x - d.x * 0.35, (lipY - 1.7) / 2 - 0.02, lip.y - d.y * 0.35);
  sill.rotation.y = -Math.atan2(c.y, c.x);
  sill.castShadow = sill.receiveShadow = true;
  C.scene.add(sill);

  // the falling curtain: ballistic profile over the lip
  const NU = 24, NV = 14, cp = [], cuv = [], ci = [];
  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    const along = fallLen * Math.pow(t, 0.75), y = lipY * (1 - t * t) + 0.02;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU - 0.5;
      const bulge = 0.12 * Math.sin(Math.PI * t) * (1 - 4 * u * u);
      cp.push(lip.x + d.x * (along + bulge) + c.x * u * W, y, lip.y + d.y * (along + bulge) + c.y * u * W);
      cuv.push(i / NU, t);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const k = j * (NU + 1) + i;
    ci.push(k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
  cg.setIndex(ci);
  cascadeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }]),
    vertexShader: /* glsl */ `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `uniform float uTime, uNight; varying vec2 vUv;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 q = vec2(vUv.x * 46.0, vUv.y * 3.0 - uTime * 2.6);
        float s = n(q) * 0.65 + n(q * vec2(2.3, 1.7) + 5.0) * 0.35;      // vertical streaks
        float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        float a = (0.32 + 0.55 * smoothstep(0.35, 0.85, s)) * edge;
        a += smoothstep(0.7, 1.0, vUv.y) * 0.35 * n(q * 3.0) * edge;       // white water at the foot
        vec3 col = mix(vec3(0.62, 0.78, 0.78), vec3(0.96, 0.98, 0.97), smoothstep(0.45, 0.9, s));
        col *= mix(1.0, 0.35, uNight);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  const curtain = new THREE.Mesh(cg, cascadeMat);
  curtain.renderOrder = 3;
  C.scene.add(curtain);
  systems.push({ update(dt, t, night) { cascadeMat.uniforms.uTime.value = t; cascadeMat.uniforms.uNight.value = night ? 1 : 0; } });
}

// ---------------------------------------------------------------- falling petals
function petals() {
  const N = 700;
  const geo = new THREE.PlaneGeometry(0.11, 0.08);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  C.scene.add(im);
  const P = Array.from({ length: N }, () => ({ x: 0, y: -99, z: 0, st: 3, t: rand(0, 4), life: 0, rx: 0, ry: 0, sx: 0, sy: 0, ground: 0, sc: 1 }));
  const col = new THREE.Color();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), V = new THREE.Vector3();
  let near = [], refresh = 0;
  const fl = [0, 0];

  function spawn(p) {
    if (!near.length) { p.st = 3; p.t = rand(0.5, 2); return; }
    const b = pick(near);
    const r = 1.6 * b.s, a = Math.random() * Math.PI * 2;
    p.x = b.x + Math.cos(a) * r * Math.sqrt(Math.random());
    p.z = b.z + Math.sin(a) * r * Math.sqrt(Math.random());
    p.y = b.y + b.s * rand(2.2, 3.6);
    p.vy = -rand(0.35, 0.65); p.ph = rand(0, 6.28);
    p.rx = rand(0, 6.28); p.ry = rand(0, 6.28); p.sx = rand(-3, 3); p.sy = rand(-2, 2);
    p.st = 0; p.life = 0; p.sc = 1;
    p.ground = C.heightAt(p.x, p.z);
    im.setColorAt(P.indexOf(p), col.set(b.color).offsetHSL(0, 0, rand(-0.04, 0.06)));
    im.instanceColor.needsUpdate = true;
  }
  P.forEach((p, i) => im.setColorAt(i, col.set('#f3b6c2')));

  return {
    update(dt, t) {
      refresh -= dt;
      if (refresh <= 0) {
        refresh = 1.5;
        const cx = C.camera.position.x, cz = C.camera.position.z;
        near = floraInfo.blossoms.filter((b) => Math.hypot(b.x - cx, b.z - cz) < 140);
        if (near.length > 60) near.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)).length = 60;
      }
      const wx = 0.35 + 0.25 * Math.sin(t * 0.3), wz = 0.12 + 0.1 * Math.cos(t * 0.23);
      for (let i = 0; i < N; i++) {
        const p = P[i];
        p.life += dt;
        if (p.st === 3) { p.t -= dt; if (p.t <= 0) spawn(p); S.setScalar(0); }
        else if (p.st === 0) {           // falling, fluttering
          p.x += (wx + Math.sin(t * 2.1 + p.ph) * 0.35) * dt;
          p.z += (wz + Math.cos(t * 1.7 + p.ph) * 0.35) * dt;
          p.y += p.vy * dt;
          p.rx += p.sx * dt; p.ry += p.sy * dt;
          if (p.y <= p.ground + 0.6) p.ground = C.heightAt(p.x, p.z);
          if (p.y <= Math.max(p.ground, 0) + 0.02) {
            if (C.waterDepthMetric(p.x, p.z) > 0.2) { p.st = 1; p.y = 0.03; p.life = 0; p.t = rand(14, 24); }
            else { p.st = 2; p.y = p.ground + 0.03; p.t = rand(3, 6); }
            p.rx = -Math.PI / 2; p.sx = 0;
          }
          S.setScalar(1);
        } else if (p.st === 1) {         // floating: drift with the stream (落花浮荡)
          flowAt(p.x, p.z, fl);
          p.x += (fl[0] * 0.9 + wx * 0.1) * dt; p.z += (fl[1] * 0.9 + wz * 0.1) * dt;
          p.ry += Math.hypot(fl[0], fl[1]) * 0.6 * dt;
          p.y = 0.03 + Math.sin(t * 2 + p.ph) * 0.01;
          p.t -= dt;
          if (C.waterDepthMetric(p.x, p.z) < -0.3) { p.st = 2; p.t = 2; }
          S.setScalar(Math.min(1, p.t / 3));
          if (p.t <= 0) { p.st = 3; p.t = rand(0.1, 1.5); }
        } else {                         // resting on the ground
          p.t -= dt;
          S.setScalar(Math.min(1, p.t));
          if (p.t <= 0) { p.st = 3; p.t = rand(0.1, 1.5); }
        }
        Q.setFromEuler(E.set(p.rx, p.ry, 0, 'YXZ'));
        im.setMatrixAt(i, M.compose(V.set(p.x, p.y, p.z), Q, S));
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- butterflies
function wingTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (const s of [-1, 1]) {
    g.save(); g.translate(64, 32); g.scale(s, 1);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(26, -9, 26, 20, -0.35, 0, Math.PI * 2); g.fill();   // forewing
    g.beginPath(); g.ellipse(20, 14, 18, 14, 0.4, 0, Math.PI * 2); g.fill();     // hindwing
    g.strokeStyle = 'rgba(30,25,20,0.85)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(26, -9, 25, 19, -0.35, -1.6, 0.9); g.stroke();
    g.fillStyle = 'rgba(30,25,20,0.8)';
    g.beginPath(); g.arc(40, -16, 4, 0, 7); g.fill();
    g.restore();
  }
  g.fillStyle = '#2a2420'; g.fillRect(62, 10, 4, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function butterflies() {
  const N = 60;
  // one quad spanning both wings; vertices with |x|>0 flap around the body axis (z)
  const geo = new THREE.PlaneGeometry(0.36, 0.18, 4, 1).rotateX(-Math.PI / 2);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) phase[i] = Math.random() * 6.28;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = new THREE.MeshLambertMaterial({ map: wingTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  const uni = { uT: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT; attribute float aPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fa = (0.25 + 0.95 * (0.5 + 0.5 * sin(uT * 17.0 + aPhase))) ;
        float ax = abs(transformed.x);
        transformed.y += ax * sin(fa);
        transformed.x = sign(transformed.x) * ax * cos(fa);`);
  };
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  C.scene.add(im);
  const COLORS = ['#fbfaf2', '#f6e27a', '#f3a640', '#fbfaf2', '#e8d0f0', '#f8f0b0'];
  const spots = floraInfo.flowerSpots.filter((s) => s.type !== 'bamboo');
  const col = new THREE.Color();
  const B = Array.from({ length: N }, (_, i) => {
    const h = spots.length ? pick(spots) : { x: 0, z: 0, r: 10 };
    im.setColorAt(i, col.set(pick(COLORS)));
    const r = Math.max(4, Math.min(h.r * 1.2, 14));
    return {
      hx: h.x, hz: h.z, r, gy: C.heightAt(h.x, h.z),
      f: [rand(0.08, 0.2), rand(0.11, 0.27), rand(0.3, 0.6), rand(0.05, 0.12)],
      p: [rand(0, 6.28), rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)],
    };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  const pos = (b, t, o) => {
    o[0] = b.hx + b.r * (0.65 * Math.sin(t * b.f[0] * 6.28 + b.p[0]) + 0.35 * Math.sin(t * b.f[1] * 6.28 * 1.7 + b.p[1]));
    o[1] = b.hz + b.r * (0.65 * Math.cos(t * b.f[3] * 6.28 * 1.3 + b.p[2]) + 0.35 * Math.sin(t * b.f[1] * 6.28 + b.p[3]));
    o[2] = b.gy + 1.3 + 0.7 * Math.sin(t * b.f[2] * 6.28 + b.p[1]) + 0.25 * Math.sin(t * 3.1 + b.p[2]);
    return o;
  };
  const a = [0, 0, 0], c2 = [0, 0, 0];
  return {
    update(dt, t, night, changed) {
      im.visible = !night;
      if (night) return;
      uni.uT.value = t;
      for (let i = 0; i < N; i++) {
        const b = B[i];
        pos(b, t, a); pos(b, t + 0.05, c2);
        const yaw = Math.atan2(c2[0] - a[0], c2[1] - a[1]);
        Q.setFromEuler(E.set(-0.25 + (c2[2] - a[2]) * 3, yaw, Math.sin(t * 2 + b.p[0]) * 0.2, 'YXZ'));
        im.setMatrixAt(i, M.compose(V.set(a[0], a[2], a[1]), Q, S));
      }
      im.instanceMatrix.needsUpdate = true;
      if (changed) im.instanceColor.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- koi
// 锦鲤: lofted body with head, dorsal/pectoral/pelvic fins and a forked tail; eight variety
// patterns in a texture atlas (红白、大正三色、昭和三色、山吹黄金、白金、浅黄、茶鲤、野鲤);
// body undulation in the vertex shader; boids schooling kept inside deep water.
const KOI_PATTERNS = 8;
function koiAtlas() {
  const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H * KOI_PATTERNS;
  const g = c.getContext('2d');
  const blob = (u, v, ru, rv, col, y0) => {
    for (const du of [-1, 0, 1]) {
      g.fillStyle = col; g.beginPath();
      g.ellipse((u + du) * W * 0.94, y0 + v * H, ru * W, rv * H, 0, 0, Math.PI * 2); g.fill();
    }
  };
  const R = Math.random;
  for (let k = 0; k < KOI_PATTERNS; k++) {
    const y0 = k * H;
    const base = ['#f4f1ea', '#f2efe8', '#1e1c1c', '#e9b23a', '#e4e3df', '#7f93a4', '#8a6a44', '#5b5a3c'][k];
    g.fillStyle = base; g.fillRect(0, y0, W, H);
    g.save(); g.beginPath(); g.rect(0, y0, W * 0.94, H); g.clip();
    // u: 0 = top of the back, 0.5 = belly; v: 0 = tail, 1 = nose
    if (k === 0 || k === 1) { // 红白 / 大正三色: hi patches on the back
      for (let i = 0; i < 4; i++) blob(R() < 0.5 ? R() * 0.12 : 1 - R() * 0.12, 0.2 + R() * 0.75, 0.08 + R() * 0.08, 0.1 + R() * 0.12, '#d8361c', y0);
      if (k === 1) for (let i = 0; i < 9; i++) blob(R() < 0.5 ? R() * 0.2 : 1 - R() * 0.2, 0.15 + R() * 0.7, 0.02 + R() * 0.03, 0.03 + R() * 0.04, '#141212', y0);
    } else if (k === 2) { // 昭和三色: black base, red and white wraps
      for (let i = 0; i < 4; i++) blob(R(), R(), 0.1 + R() * 0.1, 0.12 + R() * 0.12, '#d23a1d', y0);
      for (let i = 0; i < 4; i++) blob(0.3 + R() * 0.4, R(), 0.1, 0.12, '#f1ede4', y0);
    } else if (k === 3 || k === 4) { // 山吹 / 白金 metallic sheen down the back
      const gr = g.createLinearGradient(0, 0, W * 0.94, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.25, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.5)');
      g.fillStyle = gr; g.fillRect(0, y0, W, H);
    } else if (k === 5) { // 浅黄: blue-grey netted back, red flanks
      g.fillStyle = '#c8452a'; g.fillRect(W * 0.25, y0, W * 0.44, H);
    }
    // scales: a fine net over everything
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
    for (let y = y0; y < y0 + H; y += 6) for (let x = (y / 6) % 2 ? 0 : 5; x < W; x += 10) { g.beginPath(); g.arc(x, y, 5, 0.2, Math.PI - 0.2); g.stroke(); }
    // pale belly
    const bel = g.createLinearGradient(0, 0, W * 0.94, 0);
    bel.addColorStop(0.3, 'rgba(255,250,240,0)'); bel.addColorStop(0.5, 'rgba(255,250,240,0.55)'); bel.addColorStop(0.7, 'rgba(255,250,240,0)');
    g.fillStyle = bel; g.fillRect(0, y0, W, H);
    g.restore();
    // fin strip (u > 0.95): translucent with rays
    const fin = ['#f6eee0', '#f6eee0', '#2a2522', '#f0c050', '#eeeeea', '#c9b8a8', '#9a7a52', '#6a6a48'][k];
    g.fillStyle = fin; g.fillRect(W * 0.95, y0, W * 0.05, H);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; for (let y = y0; y < y0 + H; y += 4) { g.beginPath(); g.moveTo(W * 0.95, y); g.lineTo(W, y + 2); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function koiGeometry() {
  // body: loft of ellipses along z (tail -0.5 → nose +0.5), unit length 1
  const NZ = 22, NA = 14, pos = [], uv = [], idx = [];
  const prof = (z) => { // half-width, half-height, centre y — narrow caudal peduncle, deep body, blunt rounded head
    const t = z + 0.5; // 0 tail → 1 nose
    const sh = t < 0.62 ? 0.22 + 0.78 * Math.pow(THREE.MathUtils.smoothstep(t, 0, 0.62), 0.75)
      : Math.sqrt(Math.max(0.02, 1 - ((t - 0.62) / 0.38) ** 2));
    return [0.1 * sh, 0.13 * sh * (t > 0.85 ? 0.95 : 1), 0.012 * Math.sin(t * Math.PI) - (t > 0.8 ? (t - 0.8) * 0.05 : 0)];
  };
  for (let i = 0; i <= NZ; i++) {
    const z = -0.5 + i / NZ, [w, h, cy] = prof(z);
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      pos.push(Math.sin(a) * w, cy + Math.cos(a) * h, z);
      uv.push((j / NA) * 0.94, i / NZ);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) {
    const k = i * (NA + 1) + j;
    idx.push(k, k + NA + 1, k + 1, k + 1, k + NA + 1, k + NA + 2);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex(idx); body.computeVertexNormals();
  // fins as small polygons mapped to the fin strip
  const fins = [];
  const fin = (pts) => { // pts: [[x,y,z],...] triangle fan from pts[0]
    const g = new THREE.BufferGeometry(), p = [], u = [], ix = [];
    pts.forEach(([x, y, z], i) => { p.push(x, y, z); u.push(0.955 + 0.04 * (i / (pts.length - 1)), (z + 0.5)); });
    for (let i = 1; i < pts.length - 1; i++) ix.push(0, i, i + 1);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(ix); g.computeVertexNormals(); fins.push(g);
  };
  // forked tail
  fin([[0, 0.01, -0.46], [0, 0.11, -0.64], [0, 0.15, -0.74], [0, 0.07, -0.68], [0, 0.0, -0.62], [0, -0.07, -0.68], [0, -0.13, -0.74], [0, -0.1, -0.64]]);
  // dorsal fin along the back
  fin([[0, 0.12, 0.12], [0, 0.2, 0.05], [0, 0.19, -0.1], [0, 0.15, -0.25], [0, 0.07, -0.3], [0, 0.1, -0.1]]);
  // pectoral fins behind the head, angled down and out
  for (const s of [-1, 1]) fin([[s * 0.07, -0.06, 0.24], [s * 0.2, -0.12, 0.2], [s * 0.19, -0.12, 0.1], [s * 0.08, -0.08, 0.15]]);
  // pelvic fins
  for (const s of [-1, 1]) fin([[s * 0.04, -0.1, -0.02], [s * 0.12, -0.16, -0.08], [s * 0.06, -0.12, -0.12]]);
  // barbels (two tiny whiskers)
  const geo = mergeGeoms([body, ...fins]);
  return geo;
}
function mergeGeoms(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) {
    P.set(g.attributes.position.array, ov * 3); N.set(g.attributes.normal.array, ov * 3); U.set(g.attributes.uv.array, ov * 2);
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + ov;
    ov += g.attributes.position.count; oi += ix.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}

function koi(L) {
  const N = 52;
  const geo = koiGeometry();
  const phase = new Float32Array(N), pat = new Float32Array(N), beat = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    phase[i] = Math.random() * 6.28;
    const r = Math.random();
    pat[i] = r < 0.22 ? 0 : r < 0.36 ? 1 : r < 0.48 ? 2 : r < 0.6 ? 3 : r < 0.68 ? 4 : r < 0.76 ? 5 : r < 0.86 ? 6 : 7;
    beat[i] = 1;
  }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aPat', new THREE.InstancedBufferAttribute(pat, 1));
  const beatAttr = new THREE.InstancedBufferAttribute(beat, 1); beatAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aBeat', beatAttr);
  const mat = new THREE.MeshStandardMaterial({ map: koiAtlas(), roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide, transparent: true, depthWrite: true });
  const uni = { uT: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uT; attribute float aPhase; attribute float aPat; attribute float aBeat; varying float vKoiDepth;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv = vec2(uv.x, (uv.y + aPat) / ${KOI_PATTERNS}.0);
          vMapUv.y = 1.0 - vMapUv.y;
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // travelling wave, stronger toward the tail; fins flutter
        float kz = transformed.z;
        float tailW = smoothstep(0.25, -0.75, kz);
        float wv = sin(uT * 6.5 * aBeat + aPhase - kz * 7.0);
        transformed.x += wv * 0.11 * tailW * tailW;
        if (abs(transformed.x) > 0.11 && kz > -0.2) transformed.y += sin(uT * 9.0 + aPhase) * 0.02;
        vec4 kw = instanceMatrix * vec4(transformed, 1.0);
        vKoiDepth = -kw.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vKoiDepth;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // seen through the water: fade toward the water colour with depth
        float kd = clamp(0.05 + vKoiDepth * 0.6, 0.0, 0.35);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.16, 0.30, 0.27), kd);`);
  };
  mat.customProgramCacheKey = () => 'koi-v2';
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 2; // after the water surface (see water.js)
  C.scene.add(im);

  const pd = L.water.pond;
  const deep = (x, z) => C.waterDepthMetric(x, z);
  const F = Array.from({ length: N }, (_, i) => {
    let x, z;
    for (let k = 0; k < 40; k++) {
      x = pd.cx + (Math.random() * 2 - 1) * pd.rx * 0.8; z = pd.cz + (Math.random() * 2 - 1) * pd.rz * 0.8;
      if (deep(x, z) > 4) break;
    }
    const a = Math.random() * 6.28, sp = rand(0.25, 0.45);
    return { x, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, len: rand(0.4, 0.8), school: i % 6, y: rand(-0.38, -0.14), rise: rand(5, 25), up: 0, wan: Math.random() * 100 };
  });
  const ringMat = new THREE.MeshBasicMaterial({ color: '#e8f0ee', transparent: true, opacity: 0.5, depthWrite: false });
  const rings = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), ringMat.clone());
    m.visible = false; m.position.y = 0.04; m.renderOrder = 4; m.userData.t = 0; C.scene.add(m); return m;
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  return {
    update(dt, t) {
      uni.uT.value = t;
      dt = Math.min(dt, 0.05);
      for (let i = 0; i < N; i++) {
        const f = F[i];
        let ax = 0, az = 0, cx = 0, cz = 0, avx = 0, avz = 0, n = 0;
        for (let j = 0; j < N; j++) {
          if (j === i) continue;
          const o = F[j], dx = o.x - f.x, dz = o.z - f.z, d2 = dx * dx + dz * dz;
          if (d2 < 0.8) { ax -= dx / (d2 + 0.05) * 0.25; az -= dz / (d2 + 0.05) * 0.25; }          // separation
          if (o.school === f.school && d2 < 36) { cx += o.x; cz += o.z; avx += o.vx; avz += o.vz; n++; }
        }
        if (n) { ax += (cx / n - f.x) * 0.06 + (avx / n - f.vx) * 0.4; az += (cz / n - f.z) * 0.06 + (avz / n - f.vz) * 0.4; } // cohesion, alignment
        // wander
        f.wan += dt * 0.3;
        ax += Math.sin(f.wan * 1.7 + i) * 0.12; az += Math.cos(f.wan * 1.3 + i * 2.1) * 0.12;
        // shore avoidance: look ahead, steer toward deeper water
        const sp = Math.hypot(f.vx, f.vz) || 1e-3;
        const lx = f.x + f.vx / sp * 2.5, lz = f.z + f.vz / sp * 2.5;
        const dl = deep(lx, lz);
        if (dl < 3.5) {
          const gx = deep(lx + 0.8, lz) - deep(lx - 0.8, lz), gz = deep(lx, lz + 0.8) - deep(lx, lz - 0.8);
          const gl = Math.hypot(gx, gz) || 1, k = (3.5 - dl) * 0.9;
          ax += gx / gl * k; az += gz / gl * k;
        }
        // avoid the 藕香榭 / 滴翠亭 / 紫菱洲 piles
        for (const [ox, oz, r] of [[-26, -36, 9], [20, -16, 6], [52, -58, 10]]) {
          const dx = f.x - ox, dz = f.z - oz, d = Math.hypot(dx, dz);
          if (d < r) { ax += dx / d * (r - d) * 0.6; az += dz / d * (r - d) * 0.6; }
        }
        f.vx += ax * dt; f.vz += az * dt;
        let v = Math.hypot(f.vx, f.vz);
        const vmax = 0.6, vmin = 0.18;
        if (v > vmax) { f.vx *= vmax / v; f.vz *= vmax / v; v = vmax; }
        if (v < vmin) { f.vx *= vmin / (v || 1); f.vz *= vmin / (v || 1); v = vmin; }
        f.x += f.vx * dt; f.z += f.vz * dt;
        if (deep(f.x, f.z) < 0.8) { f.x -= f.vx * dt * 2; f.z -= f.vz * dt * 2; f.vx *= -0.5; f.vz *= -0.5; }
        beatAttr.array[i] = 0.7 + v * 1.6;
        f.rise -= dt;
        if (f.rise <= 0) {
          f.up = 1.6; f.rise = rand(10, 30);
          const r = rings.find((m) => !m.visible);
          if (r) { r.visible = true; r.userData.t = 0; r.position.x = f.x; r.position.z = f.z; }
        }
        f.up = Math.max(0, f.up - dt);
        const y = f.y + Math.sin(Math.min(1, f.up / 1.6) * Math.PI) * (-f.y - 0.04);
        const heading = Math.atan2(f.vx, f.vz);
        Q.setFromEuler(E.set(-Math.sin(Math.min(1, f.up / 1.6) * Math.PI) * 0.25, heading, 0));
        im.setMatrixAt(i, M.compose(V.set(f.x, y, f.z), Q, S.setScalar(f.len)));
      }
      im.instanceMatrix.needsUpdate = true;
      beatAttr.needsUpdate = true;
      for (const r of rings) {
        if (!r.visible) continue;
        r.userData.t += dt;
        const k = r.userData.t / 2.2;
        r.scale.setScalar(0.2 + k * 1.6);
        r.material.opacity = 0.5 * (1 - k);
        if (k >= 1) r.visible = false;
      }
    },
  };
}

// ---------------------------------------------------------------- ducks & geese
function colorGeo(g, color) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function mergeColored(parts) {
  const geos = parts.map(([g, c]) => colorGeo(g, c));
  let total = 0; for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
function duckGeo(mallard) {
  return mergeColored([
    [new THREE.SphereGeometry(1, 10, 7).scale(0.17, 0.12, 0.28).translate(0, 0.06, 0), mallard ? '#8a6a48' : '#f4f1e8'],
    [new THREE.SphereGeometry(0.085, 8, 6).translate(0, 0.24, 0.2), mallard ? '#2f6a3c' : '#f6f4ec'],
    [new THREE.ConeGeometry(0.035, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0.23, 0.31), '#e3a13a'],
    [new THREE.ConeGeometry(0.06, 0.14, 5).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.12, -0.3), mallard ? '#5a4632' : '#ece8de'],
  ]);
}
function gooseGeo() {
  return mergeColored([
    [new THREE.SphereGeometry(1, 10, 7).scale(0.22, 0.16, 0.38).translate(0, 0.08, 0), '#f7f5ee'],
    [new THREE.CylinderGeometry(0.04, 0.05, 0.36, 6).rotateX(0.25).translate(0, 0.32, 0.26), '#f7f5ee'],
    [new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0.5, 0.31), '#f7f5ee'],
    [new THREE.ConeGeometry(0.035, 0.12, 6).rotateX(Math.PI / 2).translate(0, 0.49, 0.42), '#e58a2a'],
    [new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.53, 0.38), '#d06a1a'], // knob
  ]);
}

function polyPath(pts) {
  const seg = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
  return {
    total,
    at(s) { // returns [x, z, dx, dz]
      s = Math.max(0, Math.min(total - 1e-3, s));
      let i = 0; while (s > seg[i] && i < seg.length - 1) s -= seg[i++];
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const f = s / seg[i];
      return [ax + (bx - ax) * f, az + (bz - az) * f, (bx - ax) / seg[i], (bz - az) / seg[i]];
    },
  };
}

function waterfowl(L) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const kinds = [duckGeo(true), duckGeo(false), gooseGeo()];
  const birds = [];
  // stream by 稻香村 (west bank), and the pond
  const stream = polyPath(L.water.streams[1].pts.slice(4, 9));
  const pd = L.water.pond;
  const plan = [[0, 's'], [0, 's'], [1, 's'], [2, 's'], [2, 's'], [0, 'p'], [1, 'p'], [0, 'p'], [1, 'p'], [2, 'p']];
  const groups = kinds.map((g) => { const m = new THREE.InstancedMesh(g, mat, plan.length); m.count = 0; m.frustumCulled = false; m.castShadow = true; C.scene.add(m); return m; });
  for (const [k, where] of plan) {
    const m = groups[k];
    birds.push({ m, i: m.count++, where, s: rand(0, stream.total), dir: Math.random() < 0.5 ? 1 : -1, off: rand(-1.8, 1.8),
      a: rand(0, 6.28), rf: rand(0.4, 0.75), sp: rand(0.25, 0.45), ph: rand(0, 6.28), pause: 0 });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  return {
    update(dt, t) {
      for (const b of birds) {
        let x, z, yaw;
        if (b.pause > 0) b.pause -= dt; else if (Math.random() < dt * 0.04) b.pause = rand(2, 6);
        const v = b.pause > 0 ? 0.05 : b.sp;
        if (b.where === 's') {
          b.s += b.dir * v * dt;
          if (b.s < 2 || b.s > stream.total - 2) b.dir *= -1;
          const [px, pz, dx, dz] = stream.at(b.s);
          const o = b.off + Math.sin(t * 0.2 + b.ph) * 0.8;
          x = px - dz * o; z = pz + dx * o; yaw = Math.atan2(dx * b.dir, dz * b.dir);
        } else {
          b.a += (v / (pd.rx * b.rf)) * dt;
          x = pd.cx + pd.rx * b.rf * Math.cos(b.a) + Math.sin(t * 0.13 + b.ph) * 3;
          z = pd.cz + pd.rz * b.rf * Math.sin(b.a);
          yaw = Math.atan2(-Math.sin(b.a) * pd.rx, Math.cos(b.a) * pd.rz);
        }
        Q.setFromAxisAngle(Y, yaw + Math.sin(t * 0.9 + b.ph) * 0.15);
        b.m.setMatrixAt(b.i, M.compose(V.set(x, 0.01 + Math.sin(t * 1.6 + b.ph) * 0.015, z), Q, S));
      }
      for (const m of groups) m.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- chickens at 稻香村
function chickens(L) {
  const p = L.places.find((q) => q.id === 'daoxiang');
  const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
  const toWorld = (lx, lz) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
  const variants = [['#9a5a2a', '#c8743a'], ['#f2ede0', '#e8e2d2'], ['#2a2420', '#3a2e26']];
  const geos = variants.map(([b, t]) => mergeColored([
    [new THREE.SphereGeometry(1, 9, 7).scale(0.13, 0.13, 0.18).translate(0, 0.26, 0), b],
    [new THREE.SphereGeometry(0.065, 8, 6).translate(0, 0.42, 0.13), b],
    [new THREE.BoxGeometry(0.025, 0.06, 0.08).translate(0, 0.49, 0.13), '#c8231e'],
    [new THREE.ConeGeometry(0.022, 0.06, 5).rotateX(Math.PI / 2).translate(0, 0.41, 0.21), '#e0a63a'],
    [new THREE.ConeGeometry(0.07, 0.2, 5).rotateX(-Math.PI / 2 - 0.9).translate(0, 0.36, -0.17), t],
    [new THREE.CylinderGeometry(0.012, 0.012, 0.15, 4).translate(-0.05, 0.08, 0), '#d8a23a'],
    [new THREE.CylinderGeometry(0.012, 0.012, 0.15, 4).translate(0.05, 0.08, 0), '#d8a23a'],
  ]));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const N = 12;
  const meshes = geos.map((g) => { const m = new THREE.InstancedMesh(g, mat, N); m.count = 0; m.frustumCulled = false; m.castShadow = true; C.scene.add(m); return m; });
  const area = () => [rand(-8, 8), rand(2.5, 14)];
  const H = Array.from({ length: N }, (_, i) => {
    const m = meshes[i % 3], [lx, lz] = area();
    return { m, i: m.count++, lx, lz, tx: lx, tz: lz, peck: rand(0, 3), yaw: rand(0, 6.28), ph: rand(0, 6.28) };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  return {
    update(dt, t) {
      for (const h of H) {
        let pitch = 0;
        if (h.peck > 0) {
          h.peck -= dt;
          pitch = Math.max(0, Math.sin(t * 9 + h.ph)) * 0.75;
          if (h.peck <= 0) [h.tx, h.tz] = area();
        } else {
          const dx = h.tx - h.lx, dz = h.tz - h.lz, d = Math.hypot(dx, dz);
          if (d < 0.1) h.peck = rand(1.5, 5);
          else {
            const v = Math.min(d, 0.55 * dt);
            h.lx += (dx / d) * v; h.lz += (dz / d) * v;
            h.yaw = Math.atan2(dx * c + dz * s, -dx * s + dz * c); // local dir -> world yaw
            pitch = Math.abs(Math.sin(t * 12 + h.ph)) * 0.08;
          }
        }
        const [x, z] = toWorld(h.lx, h.lz);
        Q.setFromEuler(E.set(pitch, h.yaw, 0, 'YXZ'));
        h.m.setMatrixAt(h.i, M.compose(V.set(x, C.heightAt(x, z), z), Q, S));
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- fireflies
function fireflies(L) {
  const N = 420;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const spots = [];
  const xx = L.places.find((p) => p.id === 'xiaoxiang'), lx = L.places.find((p) => p.id === 'luxue');
  for (let i = 0; i < N; i++) {
    let x, z;
    const r = Math.random();
    if (r < 0.3) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * 30; x = xx.x + Math.cos(a) * d; z = xx.z + Math.sin(a) * d; }   // 潇湘馆 bamboo
    else if (r < 0.42) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * 16; x = lx.x + Math.cos(a) * d; z = lx.z - 8 + Math.sin(a) * d; } // 芦雪广 reeds
    else { // stream banks
      const st = pick(L.water.streams), k = Math.floor(Math.random() * (st.pts.length - 1)), f = Math.random();
      const [ax, az] = st.pts[k], [bx, bz] = st.pts[k + 1];
      const l = Math.hypot(bx - ax, bz - az), o = (Math.random() < 0.5 ? -1 : 1) * rand(st.width / 2 - 1, st.width / 2 + 5);
      x = ax + (bx - ax) * f - ((bz - az) / l) * o; z = az + (bz - az) * f + ((bx - ax) / l) * o;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = Math.max(C.heightAt(x, z), 0) + rand(0.3, 2.6); pos[i * 3 + 2] = z;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `uniform float uT, uScale; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uT*0.5+aSeed)*0.8, sin(uT*0.7+aSeed*1.3)*0.35, cos(uT*0.43+aSeed*0.7)*0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float blink = pow(max(0.0, sin(uT * (0.9 + fract(aSeed) * 1.4) + aSeed)), 2.0);
        vA = blink;
        gl_PointSize = uScale * (3.0 + 9.0 * blink) * 60.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * a, a); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  C.scene.add(pts);
  return {
    update(dt, t, night) {
      pts.visible = night;
      if (!night) return;
      mat.uniforms.uT.value = t;
      mat.uniforms.uScale.value = window.devicePixelRatio || 1;
    },
  };
}
