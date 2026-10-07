// Height field for the garden: hills, the 沁芳 stream network, the central pond, stone paths.
import * as THREE from 'three';
import L from './layout.json';
import { flagstoneTexture } from './textures.js';

export const GROUND = 0.9; // ground level above the water surface (y = 0)
const WATER_BED = -1.6;

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
export function polyDist(px, pz, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function noise(x, z) {
  return Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * 0.5 + Math.sin(z * 0.13 + Math.cos(x * 0.05) * 1.7) * 0.5
    + Math.sin((x + z) * 0.31) * 0.15;
}

// Signed "how far into water" measure: > 0 inside water, metres from the bank.
export function waterDepthMetric(x, z) {
  const p = L.water.pond;
  const e = Math.hypot((x - p.cx) / p.rx, (z - p.cz) / p.rz);
  let m = (1 - e) * Math.min(p.rx, p.rz) + noise(x, z) * 1.5;
  for (const s of L.water.streams) m = Math.max(m, s.width / 2 - polyDist(x, z, s.pts) + noise(x * 2, z * 2) * 0.5);
  return m;
}

// Flatten zones: [x, z, halfW, halfD, rot, level]
const flats = [];
export function addFlat(x, z, hw, hd, rot = 0, level = null) {
  const lv = level ?? rawHeight(x, z);
  flats.push({ x, z, hw, hd, rot, level: lv });
  return lv;
}

function rawHeight(x, z) {
  let h = GROUND + noise(x, z) * 0.25;
  for (const hl of L.hills) {
    const d = Math.hypot(x - hl.x, z - hl.z) / hl.r;
    if (d < 1.6) {
      const n = 1 + 0.18 * noise(x * 1.7 + hl.x, z * 1.7 + hl.z);
      h += hl.h * Math.exp(-d * d * 2.2) * n;
    }
  }
  return h;
}

export function heightAt(x, z) {
  let h = rawHeight(x, z);
  for (const f of flats) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
    const ex = Math.max(Math.abs(lx) - f.hw, 0), ez = Math.max(Math.abs(lz) - f.hd, 0);
    const d = Math.hypot(ex, ez);
    const k = 1 - smooth(0, 8, d);
    if (k > 0) h = h * (1 - k) + f.level * k;
  }
  const w = waterDepthMetric(x, z);
  const k = smooth(-1.5, 2.5, w);
  return h * (1 - k) + WATER_BED * k;
}

export function buildTerrain() {
  const W = 420, D = 360, NX = 336, NZ = 288;
  const geo = new THREE.PlaneGeometry(W, D, NX, NZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const mask = new Float32Array(pos.count * 3); // x: stone path, y: wet bank, z: moss
  const dry = new THREE.Color('#9c9a58'), lush = new THREE.Color('#577a33');
  const c = new THREE.Color();
  const grass = new THREE.Color('#6d8a3e'), grass2 = new THREE.Color('#87a050'), moss = new THREE.Color('#4f6b34');
  const path = new THREE.Color('#bdb5a2'), bank = new THREE.Color('#8f8a7b'), rockC = new THREE.Color('#9d998e');
  const field = new THREE.Color('#9fb04a'), field2 = new THREE.Color('#6b5a3a'), outside = new THREE.Color('#7f8a62');
  const village = L.places.find((p) => p.id === 'daoxiang');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = noise(x * 0.9, z * 0.9);
    c.copy(grass).lerp(grass2, 0.5 + 0.5 * n).lerp(moss, Math.max(0, -n) * 0.4);
    // larger-scale meadow variation: dry yellowish patches and lush dark patches
    const n2 = noise(x * 0.23 + 40, z * 0.23 - 17), n3 = noise(x * 2.7 - 9, z * 2.7 + 5);
    if (n2 > 0.35) c.lerp(dry, Math.min(0.45, (n2 - 0.35) * 1.2));
    if (n2 < -0.3) c.lerp(lush, Math.min(0.5, (-0.3 - n2) * 1.4));
    c.multiplyScalar(0.95 + n3 * 0.06);
    const inside = Math.abs(x) < L.bounds.x[1] && Math.abs(z) < L.bounds.z[1];
    if (!inside) c.copy(outside);
    const hillness = y - GROUND;
    if (hillness > 3) c.lerp(rockC, smooth(3, 9, hillness) * 0.55);
    // fields of 稻香村 ("分畦列亩")
    const fx = x - (village.x - 30), fz = z - (village.z + 30);
    if (fx > -20 && fx < 22 && fz > -6 && fz < 22) c.copy(Math.floor((fx + 20) / 3) % 2 ? field : field2).lerp(grass, 0.15);
    const w = waterDepthMetric(x, z);
    if (w > -2.2 && w < 1) c.lerp(bank, 0.75);
    let pd = Infinity; for (const p of L.paths) pd = Math.min(pd, polyDist(x, z, p));
    if (pd < 1.4) c.lerp(path, 1 - smooth(0.9, 1.4, pd));
    mask[i * 3] = 1 - smooth(0.9, 1.6, pd);                       // flagstone path
    mask[i * 3 + 1] = w > -3.5 && w < 1.5 ? (1 - smooth(-3.5, -0.5, -Math.abs(w + 0.5) - 0.5)) * 0 + smooth(-3.5, -0.6, w) : 0; // wet band toward the water
    const dWall = Math.min(L.bounds.x[1] - Math.abs(x), L.bounds.z[1] - Math.abs(z));
    mask[i * 3 + 2] = inside ? (1 - smooth(0.5, 3.5, dWall)) * (0.6 + 0.4 * n) + (hillness > 2 ? smooth(2, 6, hillness) * 0.4 * (0.5 + 0.5 * n3) : 0) : 0;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 3));
  geo.computeVertexNormals();
  // fine grass/soil detail multiplied over the vertex colours so the ground stops reading as clay
  const c2 = document.createElement('canvas'); c2.width = c2.height = 256;
  const g2 = c2.getContext('2d');
  g2.fillStyle = '#e6e6e6'; g2.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, v = 195 + Math.random() * 60;
    g2.strokeStyle = `rgb(${v},${v},${v})`; g2.lineWidth = 1;
    g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4); g2.stroke();
  }
  const detail = new THREE.CanvasTexture(c2);
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.repeat.set(W / 6, D / 6); detail.anisotropy = 8;
  detail.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95 });
  const flag = flagstoneTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlag = { value: flag };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMask; varying vec3 vMask; varying vec2 vTW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask; vTW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uFlag; varying vec3 vMask; varying vec2 vTW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 flagC = texture2D(uFlag, vTW * 0.42).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, flagC * 0.95, smoothstep(0.15, 0.85, vMask.x));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.6, 0.58), vMask.y * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.24, 0.1), vMask.z * 0.55);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, vMask.y * 0.9);');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
