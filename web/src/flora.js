// Instanced vegetation: species from the text (翠竹, 垂柳, 梨花, 西府海棠, 芭蕉, 杏花, 红梅, 青松, 梧桐, 芦苇, 荷叶 …).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import L from './layout.json';
import { heightAt, waterDepthMetric, polyDist } from './terrain.js';
import { leafTexture } from './textures.js';

let seed = 12345;

// ---------------------------------------------------------------- wind
// Shared uniforms (uTime advanced by dynamics.js) and per-material sway parameters.
export const floraUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
// Positions of flowering trees / flower beds, consumed by dynamics.js (petals, butterflies).
export const floraInfo = { blossoms: [], flowerSpots: [] };

const WIND = {
  willow: { amp: 0.22, h: 6, freq: 1.25, droop: 0.38 },
  pine: { amp: 0.07, h: 8, freq: 0.75 },
  generic: { amp: 0.13, h: 6, freq: 1.0 }, wutong: { amp: 0.13, h: 7, freq: 0.9 }, mulberry: { amp: 0.12, h: 4.5, freq: 1.1 },
  osmanthus: { amp: 0.08, h: 4, freq: 1.1 },
  pear: { amp: 0.11, h: 4.5, freq: 1.1 }, haitang: { amp: 0.12, h: 4.5, freq: 1.05 }, peach: { amp: 0.11, h: 4, freq: 1.15 },
  apricot: { amp: 0.11, h: 4, freq: 1.15 }, plum: { amp: 0.09, h: 3.5, freq: 1.2 },
  vines: { amp: 0.05, h: 0.8, freq: 2.0 }, crops: { amp: 0.07, h: 0.5, freq: 2.2 },
  tumi: { amp: 0.03, h: 0.5, freq: 2.0 }, muxiang: { amp: 0.03, h: 0.5, freq: 2.0 },
  peony: { amp: 0.06, h: 0.8, freq: 1.8 }, shaoyao: { amp: 0.06, h: 0.7, freq: 1.9 }, rose: { amp: 0.06, h: 1.0, freq: 1.8 },
  bamboo: { amp: 0.55, h: 8, freq: 0.85 }, banana: { amp: 0.16, h: 3.2, freq: 1.5, droop: 0.12 }, reed: { amp: 0.3, h: 2.4, freq: 1.7 },
  lotus: { amp: 0.0, h: 1, freq: 1, bob: 0.035 }, petals: { amp: 0.0, h: 1, freq: 1, bob: 0.02 },
};

// Vertex-shader sway: grows with height above the template origin; phase from the instance position.
export function windify(mat, params) {
  const u = {
    uAmp: { value: params.amp }, uH: { value: params.h }, uFreq: { value: params.freq },
    uDroop: { value: params.droop || 0 }, uBob: { value: params.bob || 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, floraUniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWind, uAmp, uH, uFreq, uDroop, uBob;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 wIp = instanceMatrix[3].xyz;
        #else
          vec3 wIp = vec3(0.0);
        #endif
        float wPh = dot(wIp.xz, vec2(0.37, 0.21));
        float wHk = clamp(transformed.y / uH, 0.0, 1.4); wHk *= wHk;
        float wGust = 0.55 + 0.45 * sin(uTime * 0.31 + wIp.x * 0.015 + wIp.z * 0.01);
        float wSw = sin(uTime * uFreq + wPh) * 0.7 + sin(uTime * uFreq * 2.3 + wPh * 1.7) * 0.3;
        transformed.x += wSw * uAmp * wHk * wGust * uWind;
        transformed.z += cos(uTime * uFreq * 0.83 + wPh) * uAmp * 0.45 * wHk * wGust * uWind;
        // hanging strands (willow) swing more and with a lag along their length
        float wHang = smoothstep(uH * 0.85, uH * 0.25, transformed.y) * step(0.001, uDroop);
        transformed.x += uDroop * wHang * sin(uTime * uFreq * 1.4 + wPh + transformed.y * 0.9) * wGust * uWind;
        transformed.z += uDroop * 0.6 * wHang * cos(uTime * uFreq * 1.1 + wPh + transformed.y * 0.7) * wGust * uWind;
        transformed.y += uBob * sin(uTime * 1.1 + wPh * 3.0);`);
  };
  mat.customProgramCacheKey = () => 'flora-wind';
  return mat;
}

const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Indexed geometry with a smooth per-position colour variation (keeps foliage soft, not faceted).
function colored(geo, color) {
  const g = geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  const P = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const v = 0.88 + 0.12 * Math.sin(P.getX(i) * 3.1 + P.getY(i) * 2.3) * Math.cos(P.getZ(i) * 2.7);
    a[i * 3] = c.r * v; a[i * 3 + 1] = c.g * v; a[i * 3 + 2] = c.b * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function blob(r, color, x, y, z, sy = 1) {
  const ico = new THREE.IcosahedronGeometry(r, 2);
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  const p = g.attributes.position;
  const salt = rnd() * 100;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
    const h = Math.sin(X * 12.9898 / r + Y * 78.233 / r + Z * 37.719 / r + salt) * 43758.5453;
    const k = 0.84 + (h - Math.floor(h)) * 0.28; // same displacement for shared vertices -> no cracks
    p.setXYZ(i, X * k, Y * k * sy, Z * k);
  }
  g.translate(x, y, z);
  g.computeVertexNormals();
  return colored(g, color);
}
function trunk(h, r, color = '#5b4330', lean = 0) {
  const g = new THREE.CylinderGeometry(r * 0.7, r, h, 6);
  g.deleteAttribute('uv');
  g.translate(0, h / 2, 0);
  if (lean) g.rotateZ(lean);
  return colored(g, color);
}

// Species templates (unit ≈ metres).
const SPECIES = {
  willow: () => mergeGeometries([trunk(3.2, 0.3, '#4e3d2c', 0.12),
    blob(2.6, '#a9c25a', -0.3, 4.2, 0, 1.45), blob(2.0, '#9db84f', 1.2, 3.4, 0.6, 1.6), blob(1.9, '#b3c968', -1.2, 3.2, -0.8, 1.6)]),
  pear: () => mergeGeometries([trunk(2.6, 0.22), blob(1.8, '#f4f1ea', 0, 3.6, 0), blob(1.4, '#eef0e4', 1, 3.1, 0.6), blob(1.3, '#f7f5ef', -0.9, 3.3, -0.5)]),
  haitang: () => mergeGeometries([trunk(2.4, 0.25), blob(2.4, '#d9677a', 0, 3.6, 0, 0.8), blob(1.8, '#e58b97', 1.5, 3.3, 0.4, 0.8), blob(1.8, '#c95466', -1.4, 3.2, -0.6, 0.8), blob(1.2, '#6f9a45', 0, 2.6, 1.2)]),
  peach: () => mergeGeometries([trunk(2.0, 0.2), blob(1.6, '#f0a3b5', 0, 2.8, 0), blob(1.2, '#f5b8c6', 0.9, 2.5, 0.4), blob(1.1, '#e98ea4', -0.8, 2.6, -0.3)]),
  apricot: () => mergeGeometries([trunk(2.2, 0.2), blob(1.7, '#f2a08f', 0, 3.0, 0), blob(1.3, '#ef8a7a', 1, 2.7, 0.5), blob(1.2, '#f7c0b0', -0.9, 2.8, -0.5)]),
  plum: () => mergeGeometries([trunk(1.8, 0.18, '#3a2a22', 0.2), blob(1.3, '#c4243b', 0.3, 2.6, 0, 0.8), blob(1.0, '#d73a50', -0.6, 2.3, 0.4, 0.8), blob(0.9, '#b51d33', 0.8, 2.1, -0.4, 0.8)]),
  pine: () => mergeGeometries([trunk(4.5, 0.32, '#5a3d2b', 0.05), blob(2.4, '#2f4c32', 0.4, 5.6, 0, 0.45), blob(2.0, '#36553a', -1.3, 4.6, 0.5, 0.45), blob(1.8, '#2a4630', 1.3, 6.6, -0.4, 0.45), blob(1.5, '#31503a', -0.2, 7.4, 0.2, 0.45)]),
  wutong: () => mergeGeometries([trunk(4.5, 0.32, '#7d8a6a'), blob(3.0, '#5f8a3c', 0, 6.2, 0), blob(2.2, '#6c9646', 1.8, 5.4, 0.8), blob(2.2, '#557e36', -1.7, 5.6, -0.7)]),
  mulberry: () => mergeGeometries([trunk(2.4, 0.22), blob(1.9, '#5d8a35', 0, 3.4, 0), blob(1.4, '#6a9640', 1.0, 3.0, 0.5)]),
  osmanthus: () => mergeGeometries([trunk(1.6, 0.2), blob(2.0, '#3f6a32', 0, 2.8, 0, 1.1), blob(1.0, '#d9b24a', 0.8, 3.2, 0.6, 0.6)]),
  generic: () => mergeGeometries([trunk(3.0, 0.28), blob(2.6, '#557f34', 0, 4.2, 0), blob(2.0, '#4c7530', 1.4, 3.6, 0.7), blob(2.0, '#628a3c', -1.3, 3.8, -0.8)]),
  vines: () => mergeGeometries([blob(0.6, '#3f6f2e', 0, 0.3, 0, 0.7), blob(0.35, '#b9302c', 0.4, 0.5, 0.2, 1), blob(0.4, '#d6b73c', -0.35, 0.45, -0.2, 1)]),
  crops: () => mergeGeometries([blob(0.35, '#86a83e', 0, 0.2, 0, 0.8), blob(0.25, '#e3d14a', 0.3, 0.25, 0, 0.8)]),
  tumi: () => blob(0.35, '#faf6ea', 0, 0, 0, 0.6),
  muxiang: () => blob(0.35, '#f3e7b2', 0, 0, 0, 0.6),
  peony: () => mergeGeometries([blob(0.35, '#55803a', 0, 0.3, 0), blob(0.24, '#d14d77', 0, 0.62, 0, 0.7)]),
  shaoyao: () => mergeGeometries([blob(0.3, '#5d8a3a', 0, 0.25, 0), blob(0.2, '#f08aa5', 0, 0.55, 0, 0.7)]),
  rose: () => mergeGeometries([blob(0.45, '#4d7a32', 0, 0.45, 0), blob(0.16, '#d02a3f', 0.25, 0.8, 0.1), blob(0.16, '#f06f86', -0.2, 0.75, -0.15)]),
};

const LAND_TREE = new Set(['willow', 'pear', 'haitang', 'peach', 'apricot', 'plum', 'pine', 'wutong', 'mulberry', 'osmanthus', 'generic']);

export function buildFlora(requests, exclusions) {
  const group = new THREE.Group(); group.name = 'flora';
  const buckets = {}; // type -> [matrix]
  const push = (type, m) => (buckets[type] ||= []).push(m);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  const blocked = (x, z, pad = 0) => exclusions.some((e) => Math.abs(x - e.x) < e.hw + pad && Math.abs(z - e.z) < e.hd + pad);
  const onLand = (x, z) => waterDepthMetric(x, z) < -1.5;

  function emit(type, x, z, { y, scale = 1, onTop = 0, rot = 0 } = {}) {
    const yy = y ?? heightAt(x, z) + onTop;
    Q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    S.setScalar(scale);
    Pv.set(x, yy - (LAND_TREE.has(type) ? 0.15 : 0), z);
    push(type, M.compose(Pv, Q, S).clone());
  }

  function scatter(req) {
    const pts = [];
    if (req.pts) {
      // along a polyline, both banks
      const segs = [];
      let total = 0;
      for (let i = 0; i < req.pts.length - 1; i++) { const l = Math.hypot(req.pts[i + 1][0] - req.pts[i][0], req.pts[i + 1][1] - req.pts[i][1]); segs.push(l); total += l; }
      for (let k = 0; k < req.n; k++) {
        let t = rnd() * total, i = 0; while (t > segs[i] && i < segs.length - 1) t -= segs[i++];
        const [ax, az] = req.pts[i], [bx, bz] = req.pts[i + 1];
        const f = t / segs[i], dx = (bx - ax) / segs[i], dz = (bz - az) / segs[i];
        const side = rnd() < 0.5 ? -1 : 1, off = req.off * (0.8 + rnd() * 0.4) * (req.type === 'petals' ? (rnd() * 2 - 1) : side);
        pts.push([ax + (bx - ax) * f - dz * off, az + (bz - az) * f + dx * off]);
      }
    } else {
      for (let k = 0; k < req.n; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * req.r;
        pts.push([req.x + Math.cos(a) * r, req.z + Math.sin(a) * r]);
      }
    }
    return pts;
  }

  for (const req of requests) {
    for (const [x, z] of scatter(req)) {
      const t = req.type;
      if (t === 'lotus') { if (waterDepthMetric(x, z) > 2) emit(t, x, z, { y: 0.04, scale: 0.6 + rnd() * 0.7 }); continue; }
      if (t === 'petals') { if (waterDepthMetric(x, z) > 0.5) emit(t, x, z, { y: 0.03, scale: 0.6 + rnd() * 0.6 }); continue; }
      if (!onLand(x, z) && !req.onTop) continue;
      if (t === 'bamboo') { emit(t, x, z, { scale: 0.8 + rnd() * 0.5 }); continue; }
      emit(t, x, z, { scale: LAND_TREE.has(t) ? 0.75 + rnd() * 0.5 : 0.8 + rnd() * 0.5, onTop: req.onTop || 0 });
    }
  }

  // Garden-wide planting ------------------------------------------------------
  // 绕堤柳: willows along every stream and the pond rim
  for (const s of L.water.streams) {
    for (const [x, z] of scatter({ pts: s.pts, n: Math.round(s.pts.length * 5), off: s.width / 2 + 3 })) {
      if (onLand(x, z) && !blocked(x, z, 2) && Math.abs(x) < 176 && Math.abs(z) < 146) emit('willow', x, z, { scale: 0.8 + rnd() * 0.5 });
    }
  }
  const pd = L.water.pond;
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, k = 1.12 + rnd() * 0.12;
    const x = pd.cx + Math.cos(a) * pd.rx * k, z = pd.cz + Math.sin(a) * pd.rz * k;
    if (onLand(x, z) && !blocked(x, z, 2)) emit(rnd() < 0.7 ? 'willow' : 'peach', x, z, { scale: 0.8 + rnd() * 0.5 });
  }
  // hills: pines and mixed woods
  for (const h of L.hills) {
    const n = Math.round(h.r * h.r * 0.03);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * h.r * 1.1;
      const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r;
      if (!onLand(x, z) || blocked(x, z, 3) || Math.abs(x) > 175 || Math.abs(z) > 145) continue;
      if (h.id === 'cuizhang_hill' && Math.abs(x) < 16 && z > 110) continue;
      emit(rnd() < 0.5 ? 'pine' : 'generic', x, z, { scale: 0.7 + rnd() * 0.5 });
    }
  }
  // general scatter
  for (let i = 0; i < 480; i++) {
    const x = (rnd() * 2 - 1) * 172, z = (rnd() * 2 - 1) * 142;
    if (!onLand(x, z) || blocked(x, z, 4)) continue;
    let near = Infinity; for (const p of L.paths) near = Math.min(near, polyDist(x, z, p));
    if (near < 4) continue;
    const r = rnd();
    emit(r < 0.45 ? 'generic' : r < 0.6 ? 'pine' : r < 0.72 ? 'peach' : r < 0.82 ? 'willow' : r < 0.9 ? 'wutong' : 'pear', x, z, { scale: 0.7 + rnd() * 0.6 });
  }

  // Record flowering trees and flower beds for petals / butterflies.
  const BLOSSOM = { peach: '#f3b3c3', apricot: '#f5b6a6', pear: '#f7f4ec', haitang: '#e98a9a', plum: '#d4364c' };
  const pe = new THREE.Vector3(), ps = new THREE.Vector3(), pq = new THREE.Quaternion();
  for (const [type, color] of Object.entries(BLOSSOM)) {
    for (const m of buckets[type] || []) {
      m.decompose(pe, pq, ps);
      floraInfo.blossoms.push({ x: pe.x, y: pe.y, z: pe.z, color, s: ps.x, type });
    }
  }
  const FLOWERY = new Set(['peach', 'apricot', 'pear', 'haitang', 'plum', 'tumi', 'muxiang', 'peony', 'shaoyao', 'rose', 'banana', 'bamboo', 'vines']);
  for (const req of requests) {
    if (!FLOWERY.has(req.type)) continue;
    if (req.pts) { const m = req.pts[Math.floor(req.pts.length / 2)]; floraInfo.flowerSpots.push({ x: m[0], z: m[1], r: 14, type: req.type }); }
    else floraInfo.flowerSpots.push({ x: req.x, z: req.z, r: Math.max(4, Math.min(req.r || 4, 16)), type: req.type });
  }

  // Build instanced meshes ---------------------------------------------------------
  const vcBase = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  for (const [type, mats] of Object.entries(buckets)) {
    if (SPECIES[type]) {
      const geo = SPECIES[type]();
      const mat = WIND[type] ? windify(vcBase.clone(), WIND[type]) : vcBase;
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = LAND_TREE.has(type); im.receiveShadow = true;
      group.add(im);
    }
  }
  if (buckets.bamboo) group.add(...bambooMeshes(buckets.bamboo));
  if (buckets.banana) group.add(cardMesh(buckets.banana, 'banana'));
  if (buckets.reed) group.add(cardMesh(buckets.reed, 'reed'));
  if (buckets.lotus) group.add(discMesh(buckets.lotus, '#4f7f3a', 0.9, WIND.lotus));
  if (buckets.petals) group.add(discMesh(buckets.petals, '#f3b6c2', 0.12, WIND.petals));
  return group;
}

function bambooMeshes(mats) {
  const culm = new THREE.CylinderGeometry(0.035, 0.05, 8, 5); culm.translate(0, 4, 0);
  const cm = new THREE.InstancedMesh(culm, windify(new THREE.MeshStandardMaterial({ color: '#8fae55', roughness: 0.6 }), WIND.bamboo), mats.length);
  const leafGeo = mergeGeometries([new THREE.PlaneGeometry(1.8, 3.6).translate(0, 6.4, 0), new THREE.PlaneGeometry(1.8, 3.6).rotateY(Math.PI / 2).translate(0, 6.4, 0)]);
  const lm = new THREE.InstancedMesh(leafGeo, windify(new THREE.MeshStandardMaterial({ map: leafTexture('bamboo'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }), WIND.bamboo), mats.length);
  const lean = new THREE.Matrix4();
  mats.forEach((m, i) => {
    lean.makeRotationZ((rnd() - 0.5) * 0.12);
    const mm = m.clone().multiply(lean);
    cm.setMatrixAt(i, mm); lm.setMatrixAt(i, mm);
  });
  cm.castShadow = lm.castShadow = true;
  return [cm, lm];
}

function cardMesh(mats, kind) {
  let geo;
  if (kind === 'banana') {
    const leaves = [];
    for (let k = 0; k < 7; k++) {
      const g = new THREE.PlaneGeometry(1.1, 2.6); g.translate(0, 1.3, 0); g.rotateX(-0.6 - rnd() * 0.5); g.translate(0, 1.6, 0); g.rotateY((k / 7) * Math.PI * 2);
      leaves.push(g);
    }
    const stem = new THREE.CylinderGeometry(0.12, 0.16, 1.8, 6).translate(0, 0.9, 0);
    stem.deleteAttribute('normal'); stem.computeVertexNormals();
    geo = mergeGeometries(leaves.map((g) => g.index ? g.toNonIndexed() : g).concat([stem.toNonIndexed()]));
  } else {
    geo = mergeGeometries([new THREE.PlaneGeometry(1.6, 2.4).translate(0, 1.2, 0), new THREE.PlaneGeometry(1.6, 2.4).rotateY(Math.PI / 2).translate(0, 1.2, 0)]);
  }
  const im = new THREE.InstancedMesh(geo, windify(new THREE.MeshStandardMaterial({ map: leafTexture(kind), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }), WIND[kind]), mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = true;
  return im;
}

function discMesh(mats, color, r, wind) {
  const geo = new THREE.CircleGeometry(r, 10, 0.3, Math.PI * 2 - 0.3).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, windify(new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }), wind), mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.renderOrder = 2;
  return im;
}
