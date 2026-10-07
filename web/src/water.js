// Water surface: fresnel sky reflection, ripples advected along a CPU-built flow map
// (two-phase flow-map technique), foam where the 沁芳 stream runs fast, sun glint.
import * as THREE from 'three';
import L from './layout.json';
import { waterDepthMetric } from './terrain.js';

// ---------------------------------------------------------------- flow field
// Covers the 420×360 water plane. RG = flow direction·speed (0..1 → -1..1), B = foam mask.
const FX0 = -210, FZ0 = -180, FW = 420, FD = 360, NX = 336, NZ = 288;
const field = new Float32Array(NX * NZ * 3); // vx, vz (m/s), foam
let built = false;

const SOURCES = [ // foam hot spots: 沁芳闸 inflow, 蓼汀花溆 cave, 沁芳亭 "石桥三港" confluence
  { x: 166, z: -127.5, r: 13, k: 1.0 },
  { x: -102, z: -74, r: 9, k: 0.8 },
  { x: 2, z: 76, r: 7, k: 0.45 },
];

function buildField() {
  if (built) return;
  built = true;
  const streams = L.water.streams;
  const pd = L.water.pond;
  // pond circulation: from the inflow (end of the north stream) toward the two outflows
  const inflow = streams[0].pts.at(-1), outs = [streams[1].pts[0], streams[2].pts[0]];
  for (let j = 0; j < NZ; j++) {
    const z = FZ0 + ((j + 0.5) / NZ) * FD;
    for (let i = 0; i < NX; i++) {
      const x = FX0 + ((i + 0.5) / NX) * FW;
      let vx = 0, vz = 0, wsum = 0, foam = 0;
      for (const s of streams) {
        const half = s.width / 2 + 2.5;
        for (let k = 0; k < s.pts.length - 1; k++) {
          const [ax, az] = s.pts[k], [bx, bz] = s.pts[k + 1];
          const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, l = Math.sqrt(l2);
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
          const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
          if (d > half) continue;
          const bank = 1 - (d / half) ** 2;               // fastest mid-channel
          const w = bank * bank + 1e-3;
          vx += (dx / l) * bank * w; vz += (dz / l) * bank * w; wsum += w;
        }
      }
      if (wsum > 0) { vx /= wsum; vz /= wsum; vx *= 1.0; vz *= 1.0; }
      const e = Math.hypot((x - pd.cx) / pd.rx, (z - pd.cz) / pd.rz);
      if (e < 1.08) {
        // slow drift: away from the inflow, toward the outflows
        let px = 0, pz = 0;
        const dxi = x - inflow[0], dzi = z - inflow[1], ri = Math.max(dxi * dxi + dzi * dzi, 40);
        px += (dxi / ri) * 60; pz += (dzi / ri) * 60;
        for (const o of outs) { const dxo = o[0] - x, dzo = o[1] - z, ro = Math.max(dxo * dxo + dzo * dzo, 40); px += (dxo / ro) * 45; pz += (dzo / ro) * 45; }
        // plus a gentle clockwise swirl
        px += -(z - pd.cz) / pd.rz * 0.06; pz += (x - pd.cx) / pd.rx * 0.06;
        const m = Math.hypot(px, pz), cap = 0.22;
        if (m > cap) { px *= cap / m; pz *= cap / m; }
        const k = Math.min(1, Math.max(0, (1.08 - e) / 0.2)) * (wsum > 0 ? 0.4 : 1);
        vx = vx * (1 - k) + px * k; vz = vz * (1 - k) + pz * k;
      }
      for (const s of SOURCES) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < s.r) foam = Math.max(foam, s.k * (1 - d / s.r) ** 1.3);
      }
      const o = (j * NX + i) * 3;
      field[o] = vx; field[o + 1] = vz; field[o + 2] = foam;
    }
  }
}

// Flow velocity (m/s, unit speed = 1 → scaled by FLOW_SPEED) at a world position, bilinear.
export const FLOW_SPEED = 1.1;
export function flowAt(x, z, out = [0, 0]) {
  buildField();
  const fi = ((x - FX0) / FW) * NX - 0.5, fj = ((z - FZ0) / FD) * NZ - 0.5;
  const i0 = Math.max(0, Math.min(NX - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(NZ - 2, Math.floor(fj)));
  const tx = Math.max(0, Math.min(1, fi - i0)), tz = Math.max(0, Math.min(1, fj - j0));
  let vx = 0, vz = 0;
  for (const [di, dj, w] of [[0, 0, (1 - tx) * (1 - tz)], [1, 0, tx * (1 - tz)], [0, 1, (1 - tx) * tz], [1, 1, tx * tz]]) {
    const o = ((j0 + dj) * NX + i0 + di) * 3;
    vx += field[o] * w; vz += field[o + 1] * w;
  }
  out[0] = vx * FLOW_SPEED; out[1] = vz * FLOW_SPEED;
  return out;
}

function flowTexture() {
  buildField();
  const data = new Uint8Array(NX * NZ * 4);
  for (let p = 0; p < NX * NZ; p++) {
    data[p * 4] = Math.round(THREE.MathUtils.clamp(field[p * 3] * 0.5 + 0.5, 0, 1) * 255);
    data[p * 4 + 1] = Math.round(THREE.MathUtils.clamp(field[p * 3 + 1] * 0.5 + 0.5, 0, 1) * 255);
    data[p * 4 + 2] = Math.round(THREE.MathUtils.clamp(field[p * 3 + 2], 0, 1) * 255);
  }
  // A = distance from the bank (0 at the shoreline → 1 at ≥ 8 m), for depth colour and transparency
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = FX0 + ((i + 0.5) / NX) * FW, z = FZ0 + ((j + 0.5) / NZ) * FD;
    data[(j * NX + i) * 4 + 3] = Math.round(THREE.MathUtils.clamp(waterDepthMetric(x, z) / 8, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function buildWater(sunDir) {
  const geo = new THREE.PlaneGeometry(FW, FD, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSun: { value: sunDir.clone() },
        uDeep: { value: new THREE.Color('#2e5a52') },
        uShallow: { value: new THREE.Color('#5f8f78') },
        uSky: { value: new THREE.Color('#b9d0dc') },
        uSnow: { value: 0 },
        uFlow: { value: null },
        uFlowRect: { value: new THREE.Vector4(FX0, FZ0, FW, FD) },
        uFlowSpeed: { value: FLOW_SPEED },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform float uSnow;
      uniform sampler2D uFlow; uniform vec4 uFlowRect; uniform float uFlowSpeed;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float hgt(vec2 q) { return vnoise(q) + 0.5 * vnoise(q * 2.13 + 3.7); }
      vec2 grad(vec2 q) {
        const float e = 0.08;
        return vec2(hgt(q + vec2(e, 0.0)) - hgt(q - vec2(e, 0.0)), hgt(q + vec2(0.0, e)) - hgt(q - vec2(0.0, e))) / (2.0 * e);
      }
      vec2 wave(vec2 p, vec2 dir, float freq, float speed) {
        float ph = dot(p, dir) * freq + uTime * speed;
        return dir * cos(ph) * freq;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec4 fl = texture2D(uFlow, (p - uFlowRect.xy) / uFlowRect.zw);
        vec2 flow = fl.rg * 2.0 - 1.0;
        float speed = length(flow);
        float foamMask = fl.b;

        // two-phase flow map: two copies of the ripple field advected along the flow,
        // each reset every cycle and cross-faded so the stretching never shows.
        const float cyc = 1.8;
        float ph0 = fract(uTime / cyc), ph1 = fract(uTime / cyc + 0.5);
        float w1 = abs(ph0 - 0.5) * 2.0;
        vec2 adv = flow * uFlowSpeed * cyc;
        vec2 q0 = p - adv * ph0, q1 = p - adv * ph1 + vec2(17.3, 9.1);
        vec2 gf = mix(grad(q0 * 0.55), grad(q1 * 0.55), w1);
        // fine fast ripples on top of flowing water
        vec2 gf2 = mix(grad(q0 * 1.7 + 4.0), grad(q1 * 1.7 + 4.0), w1);

        vec2 g = (wave(p, normalize(vec2(1.0, 0.3)), 0.9, 1.3) * 0.05
               + wave(p, normalize(vec2(-0.4, 1.0)), 1.7, 1.9) * 0.03
               + wave(p, normalize(vec2(0.7, -0.8)), 3.1, 2.7) * 0.015) * (1.0 - 0.6 * speed)
               + gf * (0.035 + 0.11 * speed) + gf2 * (0.01 + 0.05 * speed + 0.08 * foamMask);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        // depth: shallow, warm and clear near the banks; deep green-black in the middle
        float depth = fl.a;
        vec3 shallowC = vec3(0.36, 0.42, 0.30), midC = uShallow * 0.75, deepC = uDeep * 0.62;
        vec3 base = mix(shallowC, midC, smoothstep(0.0, 0.25, depth));
        base = mix(base, deepC, smoothstep(0.25, 0.9, depth));
        base *= 0.92 + 0.12 * sin(p.x * 0.05) * sin(p.y * 0.04) + 0.1 * speed;
        vec3 sky = mix(uSky, vec3(0.92), uSnow * 0.5);
        // fake reflection of the planted banks: the near-shore band mirrors dark foliage
        vec3 bankRefl = mix(vec3(0.16, 0.22, 0.12), sky * 0.6, smoothstep(0.05, 0.45, depth));
        vec3 refl = mix(bankRefl, sky, smoothstep(0.0, 0.6, v.y * 0.0 + depth));
        vec3 col = mix(base, refl, 0.06 + 0.62 * fres);
        vec3 h = normalize(normalize(uSun) + v);
        col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 800.0) * 0.35;
        // wet shoreline band with soft lapping foam
        float shore = 1.0 - smoothstep(0.0, 0.05, depth);
        float lap = smoothstep(0.55, 0.95, hgt(p * 1.3 + vec2(uTime * 0.25, -uTime * 0.18)));
        col = mix(col, vec3(0.82, 0.86, 0.82), shore * lap * 0.45);

        // foam: advected noise, streaky where the current is fast, white water at the sluice & cave
        float f0 = hgt(q0 * vec2(0.9, 0.9) * 1.4), f1 = hgt(q1 * 1.26);
        float fn = mix(f0, f1, w1);
        float streak = smoothstep(1.02, 1.32, fn) * smoothstep(0.35, 0.9, speed) * 0.55;
        float white = smoothstep(0.9 - foamMask * 0.75, 1.3 - foamMask * 0.5, fn) * foamMask;
        float foam = clamp(streak + white * 1.3, 0.0, 1.0);
        vec3 foamCol = mix(vec3(0.9, 0.94, 0.93), sky, 0.25);
        col = mix(col, foamCol, foam * 0.85);
        gl_FragColor = vec4(col, clamp(0.5 + 0.38 * smoothstep(0.0, 0.5, depth) + 0.3 * fres + foam * 0.2, 0.0, 0.97));
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uFlow.value = flowTexture();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.name = 'water';
  mesh.renderOrder = 1;
  // no depth write: things just under the surface (koi, lotus stems) are drawn after the water
  // with their own underwater tint, so they read as seen through it
  mat.depthWrite = false;
  return mesh;
}
