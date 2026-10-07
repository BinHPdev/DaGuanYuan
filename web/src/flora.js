// Instanced vegetation: species from the text (翠竹, 垂柳, 梨花, 西府海棠, 芭蕉, 杏花, 红梅, 青松, 梧桐, 芦苇, 荷叶 …).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import L from './layout.json';
import { heightAt, waterDepthMetric, polyDist } from './terrain.js';
import { leafTexture, foliageTexture } from './textures.js';

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
  const hang = !!params.hangAttr;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, floraUniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWind, uAmp, uH, uFreq, uDroop, uBob;' + (hang ? '\nattribute float aHang;' : ''))
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
        transformed.y += uBob * sin(uTime * 1.1 + wPh * 3.0);` + (hang ? `
        // 柳条: each strand swings like a pendulum chain — amplitude and lag grow toward its tip
        float hk = aHang * aHang;
        float hw = sin(uTime * uFreq * 1.3 + wPh + aHang * 1.8 + position.x * 0.7) * 0.75 + sin(uTime * uFreq * 2.7 + wPh * 1.3 + aHang * 3.1) * 0.25;
        transformed.x += uDroop * 1.6 * hk * hw * wGust * uWind;
        transformed.z += uDroop * 1.1 * hk * cos(uTime * uFreq * 1.05 + wPh + aHang * 2.2 + position.z * 0.6) * wGust * uWind;
        transformed.y += uDroop * 0.25 * hk * abs(hw) * wGust;` : ''));
  };
  mat.customProgramCacheKey = () => 'flora-wind' + (hang ? '-hang' : '');
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

// Leaf-cluster cards scattered through an ellipsoid canopy (alpha-tested, tinted by vertex colour).
function cards(r, color, x, y, z, sy = 1, n = 34, size = 1.0, hang = false) {
  const list = [], c = new THREE.Color(color), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = Math.cbrt(rnd()) * r;
    const px = x + Math.sqrt(1 - u * u) * Math.cos(th) * rr, py = y + u * rr * sy, pz = z + Math.sqrt(1 - u * u) * Math.sin(th) * rr;
    const s = size * r * (0.7 + rnd() * 0.5);
    const g = new THREE.PlaneGeometry(s, hang ? s * 1.8 : s);
    if (hang) g.translate(0, -s * 0.8, 0), g.rotateY(rnd() * Math.PI);
    else { e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e)); }
    g.translate(px, py, pz);
    const shade = 0.75 + 0.35 * ((py - (y - r * sy)) / (2 * r * sy)); // lighter toward the top
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < col.length; k += 3) { const v = shade * (0.9 + rnd() * 0.2); col[k] = c.r * v; col[k + 1] = c.g * v; col[k + 2] = c.b * v; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    list.push(g);
  }
  return mergeGeometries(list);
}
function limb(x0, y0, z0, x1, y1, z1, r, color) {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r * 0.55, r, len, 5); g.deleteAttribute('uv');
  g.translate(0, len / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())));
  g.translate(x0, y0, z0);
  return colored(g, color);
}

// Species: trunk, canopy lobes [r, colour, x, y, z, sy], card texture. Solid cores keep crowns from looking hollow.
const SPEC = {
  // flowering shrubs as leaf + blossom clusters (蔷薇/宝相, 牡丹, 芍药, 荼蘼, 木香)
  rose: { t: [0.3, 0.03, '#4a3a26'], lobes: [[0.55, '#4b7a30', 0, 0.55, 0, 0.8], [0.3, '#c8243a', 0.22, 0.85, 0.12, 0.7], [0.28, '#ef6f88', -0.22, 0.8, -0.15, 0.7]], tex: 'blossom', n: 16, size: 0.9 },
  peony: { t: [0.25, 0.03, '#4a3a26'], lobes: [[0.5, '#55803a', 0, 0.45, 0, 0.75], [0.26, '#d14d77', 0.05, 0.8, 0, 0.6], [0.2, '#f2a3bd', -0.2, 0.72, 0.15, 0.6]], tex: 'blossom', n: 14, size: 1.0 },
  shaoyao: { t: [0.2, 0.02, '#4a3a26'], lobes: [[0.42, '#5d8a3a', 0, 0.38, 0, 0.75], [0.22, '#f08aa5', 0, 0.68, 0, 0.6]], tex: 'blossom', n: 12, size: 1.0 },
  tumi: { t: [0.05, 0.02, '#4a3a26'], lobes: [[0.45, '#5a8a3c', 0, 0.1, 0, 0.5], [0.35, '#f7f4ea', 0.1, 0.2, 0.1, 0.5]], tex: 'blossom', n: 14, size: 1.0 },
  muxiang: { t: [0.05, 0.02, '#4a3a26'], lobes: [[0.45, '#5a8a3c', 0, 0.1, 0, 0.5], [0.35, '#f3e6a8', 0.1, 0.2, 0.1, 0.5]], tex: 'blossom', n: 14, size: 1.0 },
  // 蘅芜苑异草: trailing leafy masses with 实若丹砂 berries and 花如金桂 clusters (cards, not balls)
  vines: { t: [0.05, 0.02, '#3d4a2a'], lobes: [[0.75, '#3f6a2e', 0, 0.35, 0, 0.55], [0.55, '#4f7a36', 0.45, 0.25, 0.2, 0.5], [0.22, '#b3322b', -0.3, 0.45, 0.25, 0.6], [0.2, '#d4ad38', 0.25, 0.5, -0.3, 0.6]], tex: 'leaf', n: 26, size: 1.1 },
  willow: { t: [3.2, 0.3, '#4e3d2c', 0.12], lobes: [[2.6, '#a9c25a', -0.3, 4.4, 0, 0.9], [2.0, '#9db84f', 1.3, 3.8, 0.6, 0.9], [1.9, '#b3c968', -1.3, 3.7, -0.8, 0.9]], tex: 'willow', hang: true, n: 46, size: 1.0 },
  pear: { t: [2.6, 0.22], lobes: [[1.8, '#f4f1ea', 0, 3.6, 0], [1.4, '#eef0e4', 1, 3.1, 0.6], [1.3, '#f7f5ef', -0.9, 3.3, -0.5]], tex: 'blossom' },
  haitang: { t: [2.4, 0.25], lobes: [[2.4, '#d9677a', 0, 3.6, 0, 0.8], [1.8, '#e58b97', 1.5, 3.3, 0.4, 0.8], [1.8, '#c95466', -1.4, 3.2, -0.6, 0.8], [1.2, '#6f9a45', 0, 2.6, 1.2]], tex: 'blossom' },
  peach: { t: [2.0, 0.2], lobes: [[1.6, '#f0a3b5', 0, 2.8, 0], [1.2, '#f5b8c6', 0.9, 2.5, 0.4], [1.1, '#e98ea4', -0.8, 2.6, -0.3]], tex: 'blossom' },
  apricot: { t: [2.2, 0.2], lobes: [[1.7, '#f2a08f', 0, 3.0, 0], [1.3, '#ef8a7a', 1, 2.7, 0.5], [1.2, '#f7c0b0', -0.9, 2.8, -0.5]], tex: 'blossom' },
  plum: { t: [1.8, 0.18, '#3a2a22', 0.2], lobes: [[1.3, '#c4243b', 0.3, 2.6, 0, 0.8], [1.0, '#d73a50', -0.6, 2.3, 0.4, 0.8], [0.9, '#b51d33', 0.8, 2.1, -0.4, 0.8]], tex: 'blossom', n: 26 },
  pine: { t: [4.5, 0.32, '#5a3d2b', 0.05], lobes: [[2.4, '#2f4c32', 0.4, 5.6, 0, 0.45], [2.0, '#36553a', -1.3, 4.6, 0.5, 0.45], [1.8, '#2a4630', 1.3, 6.6, -0.4, 0.45], [1.5, '#31503a', -0.2, 7.4, 0.2, 0.45]], tex: 'needle', n: 30 },
  wutong: { t: [4.5, 0.32, '#7d8a6a'], lobes: [[3.0, '#5f8a3c', 0, 6.2, 0], [2.2, '#6c9646', 1.8, 5.4, 0.8], [2.2, '#557e36', -1.7, 5.6, -0.7]], tex: 'leaf' },
  mulberry: { t: [2.4, 0.22], lobes: [[1.9, '#5d8a35', 0, 3.4, 0], [1.4, '#6a9640', 1.0, 3.0, 0.5]], tex: 'leaf' },
  osmanthus: { t: [1.6, 0.2], lobes: [[2.0, '#3f6a32', 0, 2.8, 0, 1.1], [1.0, '#d9b24a', 0.8, 3.2, 0.6, 0.6]], tex: 'leaf' },
  generic: { t: [3.0, 0.28], lobes: [[2.6, '#557f34', 0, 4.2, 0], [2.0, '#4c7530', 1.4, 3.6, 0.7], [2.0, '#628a3c', -1.3, 3.8, -0.8]], tex: 'leaf' },
};
function treeTemplate(sp) {
  const [h, r, bark = '#5b4330', lean = 0] = sp.t;
  const solid = [trunk(h, r, bark, lean)], leaf = [];
  for (const [lr, col, x, y, z, sy = 1] of sp.lobes) {
    solid.push(limb(0, h * 0.75, 0, x * 0.8, y - lr * sy * 0.3, z * 0.8, r * 0.5, bark));
    const core = new THREE.Color(col).multiplyScalar(0.72).getStyle();
    if (!sp.hang) solid.push(blob(lr * 0.5, core, x, y, z, sy));
    leaf.push(cards(lr * 1.05, col, x, y, z, sy, sp.n || 44, sp.size || 1.15, sp.hang));
  }
  return { solid: mergeGeometries(solid), cards: mergeGeometries(leaf), tex: sp.tex };
}
const SPECIES = {
  // vines handled as a SPEC entry below (leaf cards)
  crops: () => mergeGeometries([blob(0.35, '#86a83e', 0, 0.2, 0, 0.8), blob(0.25, '#e3d14a', 0.3, 0.25, 0, 0.8)]),
};

// ---------------------------------------------------------------- 垂柳
// Strand texture: a thin reddish-green twig with alternate lanceolate spring leaves (柳芽).
let STRAND_TEX = null;
function strandTexture() {
  if (STRAND_TEX) return STRAND_TEX;
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 512);
  g.strokeStyle = '#7d6b3a'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(32, 0); for (let y = 0; y <= 512; y += 16) g.lineTo(32 + Math.sin(y * 0.02) * 1.5, y); g.stroke();
  for (let y = 4; y < 512; y += 6) {
    const side = (y / 6) % 2 < 1 ? -1 : 1, len = 22 + Math.random() * 10, ang = side * (0.45 + Math.random() * 0.4);
    const x0 = 32 + Math.sin(y * 0.02) * 1.5;
    g.save(); g.translate(x0, y); g.rotate(ang);
    const hue = 68 + Math.random() * 18, lit = 48 + Math.random() * 16;
    g.fillStyle = `hsl(${hue},${55 + Math.random() * 20}%,${lit}%)`;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side * 4.5, len * 0.45, 0, len); g.quadraticCurveTo(-side * 2.2, len * 0.5, 0, 0); g.fill();
    g.strokeStyle = `hsla(${hue},40%,${lit + 15}%,0.6)`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 0.6, len * 0.9); g.stroke();
    g.restore();
  }
  STRAND_TEX = new THREE.CanvasTexture(c);
  STRAND_TEX.colorSpace = THREE.SRGBColorSpace;
  STRAND_TEX.wrapT = THREE.RepeatWrapping; STRAND_TEX.anisotropy = 8;
  return STRAND_TEX;
}

// Gnarled trunk: a tapered, bent, lumpy cylinder.
function gnarledTrunk(h, r, bark, lean) {
  const g = new THREE.CylinderGeometry(r * 0.62, r, h, 9, 10); g.deleteAttribute('uv');
  const p = g.attributes.position, salt = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i) + h / 2, z = p.getZ(i);
    const t = y / h, ang = Math.atan2(z, x);
    const bump = 1 + 0.16 * Math.sin(ang * 3 + t * 7 + salt) + 0.1 * Math.sin(ang * 5 - t * 11);
    x *= bump; z *= bump;
    x += Math.sin(t * 2.4 + salt) * h * 0.06 + lean * y * y / h; z += Math.cos(t * 1.9 + salt) * h * 0.05;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return colored(g, bark);
}

function willowTemplate() {
  const H = 3.0 + rnd() * 0.4, lean = 0.12;
  const solid = [gnarledTrunk(H, 0.34, '#4a3a2a', lean)];
  const top = [lean * H, H, 0];
  // main limbs arching up and out (the "head" of a pollarded garden willow)
  const tips = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rnd() * 0.6, R = 1.6 + rnd() * 1.2, y = H + 1.6 + rnd() * 1.4;
    const mid = [top[0] + Math.cos(a) * R * 0.45, H + 1.3 + rnd() * 0.6, Math.sin(a) * R * 0.45];
    const tip = [top[0] + Math.cos(a) * R, y, Math.sin(a) * R];
    solid.push(limb(top[0], H - 0.2, top[2], mid[0], mid[1], mid[2], 0.17, '#4a3a2a'));
    solid.push(limb(mid[0], mid[1], mid[2], tip[0], tip[1], tip[2], 0.1, '#55432f'));
    tips.push(tip);
  }
  // hanging strands (柳条), hundreds of them from the crown dome
  const pos = [], uv = [], col = [], hangA = [], idx = [];
  const Rc = 3.3, domeY = H + 2.4, SEG = 6, base = new THREE.Color('#8fae4e');
  const NS = 440;
  for (let s = 0; s < NS; s++) {
    const th = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * Rc;
    const ax = top[0] + Math.cos(th) * rr, az = Math.sin(th) * rr;
    const ay = domeY + 1.0 * (1 - (rr / Rc) ** 2) - rnd() * 0.5;
    const L = (ay - 0.4) * (0.55 + rnd() * 0.42) * (rr / Rc * 0.4 + 0.6);
    const out = 0.35 + rnd() * 0.4, w = 0.3 + rnd() * 0.06; // ribbon 0.3 m ↔ 64 px, so leaves keep their true ~10 cm shape
    const yaw = rnd() * Math.PI, sx = Math.cos(yaw) * w / 2, sz = Math.sin(yaw) * w / 2;
    const tint = 0.85 + rnd() * 0.3, hueShift = rnd();
    const c = base.clone().offsetHSL((hueShift - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08).multiplyScalar(tint);
    const v0 = pos.length / 3;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      // arc outward a little at the top, then fall almost straight down
      const bul = out * Math.sin(Math.min(1, t * 2.2) * Math.PI / 2) * (1 - 0.3 * t);
      const x = ax + Math.cos(th) * bul, z = az + Math.sin(th) * bul, y = ay - L * t - 0.25 * Math.sin(t * Math.PI) * 0;
      pos.push(x - sx, y, z - sz, x + sx, y, z + sz);
      uv.push(0, t * L / 2.4, 1, t * L / 2.4);
      for (let q = 0; q < 2; q++) col.push(c.r, c.g, c.b);
      hangA.push(t, t);
      if (k) { const a = v0 + (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const cards = new THREE.BufferGeometry();
  cards.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cards.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  cards.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  cards.setAttribute('aHang', new THREE.Float32BufferAttribute(hangA, 1));
  cards.setIndex(idx);
  // normals pointing outward from the crown axis, so the curtain is lit like foliage
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const dx = pos[i] - top[0], dz = pos[i + 2], l = Math.hypot(dx, dz) || 1;
    nrm[i] = dx / l * 0.8; nrm[i + 1] = 0.45; nrm[i + 2] = dz / l * 0.8;
  }
  cards.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return { solid: mergeGeometries(solid), cards, strand: true };
}

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
  const cardTex = {};
  for (const [type, mats] of Object.entries(buckets)) {
    if (type === 'willow') {
      // two template variants so neighbouring willows differ
      const half = [mats.filter((_, i) => i % 2 === 0), mats.filter((_, i) => i % 2 === 1)];
      for (const part of half) {
        if (!part.length) continue;
        const tpl = willowTemplate();
        const sm = new THREE.InstancedMesh(tpl.solid, windify(vcBase.clone(), { ...WIND.willow, droop: 0, amp: 0.05 }), part.length);
        const cm = new THREE.InstancedMesh(tpl.cards, windify(new THREE.MeshStandardMaterial({
          vertexColors: true, map: strandTexture(), alphaTest: 0.12, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.25,
        }), { ...WIND.willow, hangAttr: true }), part.length);
        part.forEach((m, i) => { sm.setMatrixAt(i, m); cm.setMatrixAt(i, m); });
        sm.castShadow = cm.castShadow = true; sm.receiveShadow = cm.receiveShadow = true;
        group.add(sm, cm);
      }
    } else if (SPEC[type]) {
      const tpl = treeTemplate(SPEC[type]);
      const sm = new THREE.InstancedMesh(tpl.solid, windify(vcBase.clone(), WIND[type]), mats.length);
      const cm = new THREE.InstancedMesh(tpl.cards, windify(new THREE.MeshStandardMaterial({
        vertexColors: true, map: (cardTex[tpl.tex] ||= foliageTexture(tpl.tex)), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9,
      }), WIND[type]), mats.length);
      mats.forEach((m, i) => { sm.setMatrixAt(i, m); cm.setMatrixAt(i, m); });
      sm.castShadow = cm.castShadow = true; sm.receiveShadow = cm.receiveShadow = true;
      group.add(sm, cm);
    } else if (SPECIES[type]) {
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
  if (buckets.lotus) group.add(...lotusMeshes(buckets.lotus));
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
    // 芭蕉: a sheathed pseudostem and broad leaves that arch out and droop, split along the veins by wind.
    const parts = [];
    const stem = new THREE.CylinderGeometry(0.11, 0.17, 2.2, 8).translate(0, 1.1, 0); stem.deleteAttribute('uv');
    stem.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(stem.attributes.position.count * 2).fill(0.02), 2));
    parts.push(stem.toNonIndexed());
    const nL = 9;
    for (let k = 0; k < nL; k++) {
      const len = 2.0 + rnd() * 0.7, wid = 0.85 + rnd() * 0.2, segs = 12;
      const g = new THREE.PlaneGeometry(wid, len, 2, segs); g.translate(0, len / 2, 0);
      const pa = g.attributes.position;
      const rise = 0.9 + rnd() * 0.5, droop = 1.1 + rnd() * 0.6;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), t = y / len;
        // arc: leaves rise then bend over; slight V fold along the midrib
        const ang = rise * (1 - t) * 0.6 + (Math.PI / 2 - rise * 0.6) * 0 + t * droop;
        const zz = Math.sin(ang * t) * y * 0.9, yy = Math.cos(ang * t) * y * 0.9;
        pa.setXYZ(i, x, yy, zz + Math.abs(x) * 0.25);
      }
      g.computeVertexNormals();
      const tilt = new THREE.Matrix4().makeRotationX(0.35 + rnd() * 0.25);
      g.applyMatrix4(tilt);
      g.translate(0, 1.7 + rnd() * 0.5, 0);
      g.rotateY((k / nL) * Math.PI * 2 + rnd() * 0.4);
      parts.push(g.toNonIndexed());
    }
    geo = mergeGeometries(parts);
  } else {
    geo = mergeGeometries([new THREE.PlaneGeometry(1.6, 2.4).translate(0, 1.2, 0), new THREE.PlaneGeometry(1.6, 2.4).rotateY(Math.PI / 2).translate(0, 1.2, 0)]);
  }
  const im = new THREE.InstancedMesh(geo, windify(new THREE.MeshStandardMaterial({ map: kind === 'banana' ? bananaLeafTexture() : leafTexture(kind), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.65 }), WIND[kind]), mats.length);
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

// ---------------------------------------------------------------- 荷叶
// Cupped lotus leaves with radiating veins and a notch; a share stand above the water on stalks
// (出水荷叶), and a few pink buds.
function lotusTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, '#9fb86a'); gr.addColorStop(0.25, '#6e9447'); gr.addColorStop(0.85, '#4e7a36'); gr.addColorStop(1, '#3f6a2e');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(200,220,150,0.55)'; g.lineWidth = 1.6;
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    g.beginPath(); g.moveTo(128, 128);
    const mx = 128 + Math.cos(a + 0.05) * 70, my = 128 + Math.sin(a + 0.05) * 70;
    g.quadraticCurveTo(mx, my, 128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124); g.stroke();
  }
  g.fillStyle = 'rgba(160,190,110,0.8)'; g.beginPath(); g.arc(128, 128, 6, 0, 7); g.fill();
  // waxy sheen speckle
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function lotusLeafGeo(cup) {
  // polar disc with a narrow notch, centre lowered (cup) and rim slightly raised/wavy
  const NR = 6, NA = 28, notch = 0.22, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NR; i++) {
    const r = i / NR;
    for (let j = 0; j <= NA; j++) {
      const a = notch / 2 + (j / NA) * (Math.PI * 2 - notch);
      const y = cup * (r * r) + 0.02 * Math.sin(a * 7) * r * r;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push(0.5 + Math.cos(a) * r * 0.49, 0.5 + Math.sin(a) * r * 0.49);
    }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
    const k = i * (NA + 1) + j;
    idx.push(k, k + NA + 1, k + 1, k + 1, k + NA + 1, k + NA + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function lotusMeshes(mats) {
  const tex = lotusTexture();
  const leafMat = windify(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, side: THREE.DoubleSide }), WIND.lotus);
  const floatM = [], standM = [], stalkM = [], budM = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
  for (const m of mats) {
    m.decompose(P, Q, S);
    const r = 0.45 * S.x / 0.6;
    if (rnd() < 0.22) {
      // 出水荷叶: on a stalk, tilted
      const h = 0.5 + rnd() * 0.9;
      E.set((rnd() - 0.5) * 0.7, rnd() * 6.28, (rnd() - 0.5) * 0.7);
      standM.push(new THREE.Matrix4().compose(new THREE.Vector3(P.x, h, P.z), new THREE.Quaternion().setFromEuler(E), new THREE.Vector3(r * 1.2, r * 1.2, r * 1.2)));
      stalkM.push(new THREE.Matrix4().compose(new THREE.Vector3(P.x, h / 2 - 0.2, P.z), new THREE.Quaternion(), new THREE.Vector3(1, h + 0.4, 1)));
      if (rnd() < 0.25) budM.push(new THREE.Matrix4().compose(new THREE.Vector3(P.x + 0.4, h * 0.9 + 0.2, P.z + 0.3), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    } else {
      E.set(0, rnd() * 6.28, 0);
      floatM.push(new THREE.Matrix4().compose(new THREE.Vector3(P.x, 0.03, P.z), new THREE.Quaternion().setFromEuler(E), new THREE.Vector3(r, r, r)));
    }
  }
  const out = [];
  const mk = (geo, mat, list, order) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.renderOrder = order; im.castShadow = order === 0; im.receiveShadow = true;
    out.push(im);
  };
  mk(lotusLeafGeo(0.06), leafMat, floatM, 2);
  mk(lotusLeafGeo(0.16), leafMat, standM, 0);
  mk(new THREE.CylinderGeometry(0.015, 0.02, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#5f7d3a' }), stalkM.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0))), 0);
  const bud = new THREE.SphereGeometry(0.09, 10, 8).scale(1, 1.7, 1);
  mk(bud, new THREE.MeshStandardMaterial({ color: '#e98aa0', roughness: 0.5 }), budM, 0);
  return out;
}

// Banana leaf texture: yellow-green blade, pale midrib, parallel veins, ragged tears from the margin inward.
function bananaLeafTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 512);
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, '#5b8f2c'); grad.addColorStop(0.45, '#7cae3e'); grad.addColorStop(0.5, '#cfe08a'); grad.addColorStop(0.55, '#7cae3e'); grad.addColorStop(1, '#4f8226');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(64, 0); g.bezierCurveTo(4, 60, 2, 420, 60, 512); g.lineTo(68, 512); g.bezierCurveTo(126, 420, 124, 60, 64, 0); g.fill();
  g.strokeStyle = 'rgba(40,70,20,0.35)'; g.lineWidth = 1;
  for (let y = 8; y < 500; y += 7) { g.beginPath(); g.moveTo(64, y); g.lineTo(4, y - 26); g.moveTo(64, y); g.lineTo(124, y - 26); g.stroke(); }
  // tears: cut thin wedges from the margin toward the midrib
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    const y = 80 + Math.random() * 380, side = Math.random() < 0.5 ? -1 : 1, depth = 20 + Math.random() * 38;
    g.beginPath(); g.moveTo(64 + side * 64, y - 10); g.lineTo(64 + side * (64 - depth), y - 26); g.lineTo(64 + side * 64, y - 4); g.fill();
  }
  // a little brown dried margin
  g.globalCompositeOperation = 'source-atop';
  g.strokeStyle = 'rgba(150,120,60,0.6)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(64, 0); g.bezierCurveTo(4, 60, 2, 420, 60, 512); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
