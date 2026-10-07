// Procedural garden stones: 太湖石 (pale, water-worn, perforated limestone) and 黄石 (blocky
// yellow stone). Each variant is a signed-distance field polygonised once with marching cubes,
// so the Taihu holes (瘦、漏、透、皱) are real tunnels, not painted. Crevices are darkened by an
// ambient-occlusion pass baked into vertex colours; moss, lichen and rain streaks are added in
// the fragment shader from world-space noise.
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

const NOISE = new ImprovedNoise();
const n3 = (x, y, z) => NOISE.noise(x, y, z); // ~[-1,1]
function fbm(x, y, z, oct = 3) {
  let a = 0, f = 1, w = 0.5;
  for (let i = 0; i < oct; i++) { a += w * n3(x * f, y * f, z * f); f *= 2.03; w *= 0.5; }
  return a;
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- SDFs
function capsuleDist(px, py, pz, a, b) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h);
}

function makeTaihuSDF(seed, fine = true) {
  const r = mulberry(seed);
  const o = [r() * 50, r() * 50, r() * 50];
  // tall, leaning, slender ("瘦") body made of a few blended lobes
  const lobes = [];
  const nl = 3 + Math.floor(r() * 3);
  for (let i = 0; i < nl; i++) {
    const t = i / (nl - 1);
    lobes.push({ c: [(r() - 0.5) * 0.55, -0.75 + t * 1.5, (r() - 0.5) * 0.45], rr: [0.38 + r() * 0.25, 0.35 + r() * 0.2, 0.3 + r() * 0.2] });
  }
  // through-holes ("漏/透"): wormy tunnels
  const tunnels = [];
  const nt = fine ? 3 + Math.floor(r() * 3) : 1;
  for (let i = 0; i < nt; i++) {
    const c = [(r() - 0.5) * 0.5, (r() - 0.5) * 1.3, (r() - 0.5) * 0.3];
    const th = r() * Math.PI * 2, ph = (r() - 0.5) * 0.9;
    const d = [Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)];
    tunnels.push({ a: [c[0] - d[0], c[1] - d[1], c[2] - d[2]], b: [c[0] + d[0], c[1] + d[1], c[2] + d[2]], rad: fine ? 0.11 + r() * 0.08 : 0.2 });
  }
  // surface pockets: spheres centred just inside the lobe surfaces
  const dents = [];
  if (fine) for (let i = 0; i < 14; i++) {
    const L = lobes[Math.floor(r() * lobes.length)], th = r() * Math.PI * 2, ph = (r() - 0.5) * 2.2;
    dents.push([L.c[0] + Math.cos(th) * Math.cos(ph) * L.rr[0], L.c[1] + Math.sin(ph) * L.rr[1] * 0.8, L.c[2] + Math.sin(th) * Math.cos(ph) * L.rr[2], 0.07 + r() * 0.09]);
  }
  return (x, y, z) => {
    // domain warp for organic, wrinkled ("皱") forms
    const wx = x + 0.15 * n3(x * 1.7 + o[0], y * 1.7, z * 1.7);
    const wy = y + 0.12 * n3(x * 1.7, y * 1.7 + o[1], z * 1.7);
    const wz = z + 0.15 * n3(x * 1.7, y * 1.7, z * 1.7 + o[2]);
    let d = Infinity, k = 0.25;
    for (const L of lobes) {
      const dx = (wx - L.c[0]) / L.rr[0], dy = (wy - L.c[1]) / L.rr[1], dz = (wz - L.c[2]) / L.rr[2];
      const e = (Math.hypot(dx, dy, dz) - 1) * Math.min(L.rr[0], L.rr[1], L.rr[2]);
      // smooth union
      const h = Math.max(k - Math.abs(d - e), 0) / k;
      d = Math.min(d, e) - h * h * k * 0.25;
    }
    // vertical erosion grooves and fine pitting
    d += 0.035 * Math.sin(Math.atan2(wz, wx) * 7 + 3 * n3(wx * 2, wy * 0.5, wz * 2));
    d += (fine ? 0.045 : 0.035) * fbm(wx * 3.1 + o[1], wy * 3.1, wz * 3.1 + o[2], fine ? 3 : 2);
    // tunnels and cellular pits
    for (const T of tunnels) {
      const td = capsuleDist(wx, wy, wz, T.a, T.b) - T.rad * (1 + 0.3 * n3(wx * 4, wy * 4, wz * 4));
      d = Math.max(d, -td);
    }
    // rounded solution pockets (dents) on the surface
    for (const D of dents) { const dd = Math.hypot(wx - D[0], wy - D[1], wz - D[2]) - D[3]; d = Math.max(d, -dd); }
    return d;
  };
}

function makeHuangSDF(seed) {
  const r = mulberry(seed);
  const o = [r() * 50, r() * 50, r() * 50];
  const half = [0.6 + r() * 0.35, 0.35 + r() * 0.3, 0.5 + r() * 0.3];
  return (x, y, z) => {
    const wx = x + 0.08 * n3(x * 2 + o[0], y * 2, z * 2), wz = z + 0.08 * n3(x * 2, y * 2, z * 2 + o[2]);
    // rounded box
    const qx = Math.abs(wx) - half[0], qy = Math.abs(y) - half[1], qz = Math.abs(wz) - half[2];
    const rad = 0.12;
    let d = Math.hypot(Math.max(qx + rad, 0), Math.max(qy + rad, 0), Math.max(qz + rad, 0)) + Math.min(Math.max(qx, qy, qz) + rad, 0) - rad;
    // horizontal bedding layers + chipped faces
    d += 0.03 * Math.abs(Math.sin(y * 18 + 2 * n3(x * 1.5, y * 1.5, z * 1.5 + o[1])));
    d += 0.06 * fbm(x * 2.4 + o[0], y * 2.4, z * 2.4);
    // a couple of planar cleavage cuts
    d = Math.max(d, (x * 0.8 + y * 0.6) - half[0] * 0.95);
    return d;
  };
}

// ---------------------------------------------------------------- marching cubes
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const EDGE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

function polygonise(sdf, N = 44, B = 1.25) {
  const S = N + 1, step = (2 * B) / N;
  const field = new Float32Array(S * S * S);
  for (let k = 0; k < S; k++) for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -B + i * step, y = -B + j * step, z = -B + k * step;
    // keep a closed shell inside the grid
    const edge = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) - (B - step * 1.5);
    field[i + j * S + k * S * S] = Math.max(sdf(x, y, z), edge);
  }
  const F = (i, j, k) => field[i + j * S + k * S * S];
  const pos = [], idx = [], cache = new Map();
  const vid = (i, j, k, e) => {
    const [a, b] = EDGE[e];
    const ca = CORNER[a], cb = CORNER[b];
    const ia = [i + ca[0], j + ca[1], k + ca[2]], ib = [i + cb[0], j + cb[1], k + cb[2]];
    const lo = ia[0] + ia[1] + ia[2] <= ib[0] + ib[1] + ib[2] ? ia : ib;
    const axis = ca[0] !== cb[0] ? 0 : ca[1] !== cb[1] ? 1 : 2;
    const key = ((lo[0] * S + lo[1]) * S + lo[2]) * 3 + axis;
    let v = cache.get(key);
    if (v !== undefined) return v;
    const va = F(...ia), vb = F(...ib);
    const t = va / (va - vb || 1e-6);
    v = pos.length / 3;
    pos.push(-B + (ia[0] + (ib[0] - ia[0]) * t) * step, -B + (ia[1] + (ib[1] - ia[1]) * t) * step, -B + (ia[2] + (ib[2] - ia[2]) * t) * step);
    cache.set(key, v);
    return v;
  };
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let ci = 0;
    for (let c = 0; c < 8; c++) if (F(i + CORNER[c][0], j + CORNER[c][1], k + CORNER[c][2]) < 0) ci |= 1 << c;
    if (!edgeTable[ci]) continue;
    const base = ci * 16;
    for (let t = 0; triTable[base + t] !== -1; t += 3) {
      idx.push(vid(i, j, k, triTable[base + t]), vid(i, j, k, triTable[base + t + 1]), vid(i, j, k, triTable[base + t + 2]));
    }
  }
  return { pos, idx };
}

// Drop floating crumbs: keep connected pieces holding ≥ 8 % of the triangles.
function largestPiece(pos, idx) {
  const n = pos.length / 3, par = new Int32Array(n);
  for (let i = 0; i < n; i++) par[i] = i;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); par[b] = a; par[find(c)] = a; }
  const count = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); count.set(r, (count.get(r) || 0) + 1); }
  const total = idx.length / 3, keep = new Set([...count].filter(([, c]) => c >= total * 0.08).map(([r]) => r));
  const remap = new Int32Array(n).fill(-1), P = [], I = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (!keep.has(find(idx[t]))) continue;
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k];
      if (remap[v] < 0) { remap[v] = P.length / 3; P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
      I.push(remap[v]);
    }
  }
  return { pos: P, idx: I };
}

function buildVariant(kind, seed, res) {
  const fine = !res || res > 30;
  const sdf = kind === 'huang' ? makeHuangSDF(seed) : makeTaihuSDF(seed, fine);
  const raw = polygonise(sdf, res || (kind === 'huang' ? 34 : 54), kind === 'huang' ? 1.25 : 1.45);
  const { pos, idx } = largestPiece(raw.pos, raw.idx);
  const n = pos.length / 3;
  // normals from the SDF gradient (smooth, and consistent winding)
  const nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const e = 0.01;
  const base = kind === 'huang' ? new THREE.Color('#b89663') : new THREE.Color('#c3c0b6');
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
    nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
    // ambient occlusion: how quickly the field opens up along the normal
    let ao = 0;
    for (const s of [0.06, 0.14, 0.28]) ao += Math.max(0, s - sdf(x + gx * s, y + gy * s, z + gz * s)) / s;
    const occ = Math.max(0.5, 1 - ao * 0.3);
    const tint = 0.92 + 0.12 * n3(x * 3 + seed, y * 3, z * 3);
    col[v * 3] = base.r * occ * tint; col[v * 3 + 1] = base.g * occ * tint; col[v * 3 + 2] = base.b * occ * tint;
  }
  // fix winding against the gradient
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    if (fx * nor[a] + fy * nor[a + 1] + fz * nor[a + 2] < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  // sit the stone on y = 0 with a little of it buried
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y - (bb.max.y - bb.min.y) * 0.06, -(bb.min.z + bb.max.z) / 2);
  // normalise so the larger horizontal half-extent is 1
  g.computeBoundingBox();
  const s = 1 / Math.max(g.boundingBox.max.x, g.boundingBox.max.z, 0.01);
  g.scale(s, s, s);
  g.computeBoundingSphere();
  g.userData.kind = kind;
  return g;
}

// ---------------------------------------------------------------- material
const GLSL_NOISE = /* glsl */ `
  float rk_h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float rk_n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(rk_h(i), rk_h(i + vec3(1,0,0)), f.x), mix(rk_h(i + vec3(0,1,0)), rk_h(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(rk_h(i + vec3(0,0,1)), rk_h(i + vec3(1,0,1)), f.x), mix(rk_h(i + vec3(0,1,1)), rk_h(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float rk_f(vec3 p){ return 0.5 * rk_n(p) + 0.25 * rk_n(p * 2.07) + 0.125 * rk_n(p * 4.13); }
`;

let MATERIAL = null;
export function rockMaterial() {
  if (MATERIAL) return MATERIAL;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRkW; varying vec3 vRkN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 rkw = vec4(transformed, 1.0);
        mat3 rkm = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          rkw = instanceMatrix * rkw; rkm = rkm * mat3(instanceMatrix);
        #endif
        vRkW = (modelMatrix * rkw).xyz;
        vRkN = normalize(rkm * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRkW; varying vec3 vRkN;\n' + GLSL_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 rp = vRkW;
        float grain = rk_f(rp * 2.6);
        float speck = rk_n(rp * 38.0);
        diffuseColor.rgb *= 0.93 + 0.12 * grain;
        
        // rain streaks running down vertical faces
        float streak = rk_n(vec3(rp.x * 7.0, rp.y * 0.6, rp.z * 7.0));
        diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.55, 0.85, streak) * (1.0 - abs(vRkN.y));
        // moss on upward faces, lichen flecks
        float up = vRkN.y;
        float mossMask = smoothstep(0.75, 0.98, up) * smoothstep(0.6, 0.74, rk_f(rp * 0.9 + 7.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.48, 0.25) * (0.85 + 0.3 * grain), mossMask * 0.6);
        float lichen = smoothstep(0.82, 0.86, rk_n(rp * 9.0 + 3.0)) * (0.4 + 0.6 * max(up, 0.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.79, 0.66), lichen * 0.35);
        // waterline darkening (wet stone)
        float wet = 1.0 - smoothstep(-0.05, 0.12, rp.y);
        diffuseColor.rgb *= 1.0 - 0.25 * wet;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // procedural bump from world-space noise (Mikkelsen surface gradient)
          float bh = rk_f(vRkW * 5.0) * 0.5;
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float dhx = dFdx(bh), dhy = dFdy(bh);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad * 0.45);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.55, 1.0 - smoothstep(0.02, 0.3, vRkW.y));`);
  };
  m.customProgramCacheKey = () => 'rocks-v3';
  MATERIAL = m;
  return m;
}

// ---------------------------------------------------------------- variants
const VARIANTS = {};
function ensure(kind, count, res = 0) {
  const list = (VARIANTS[kind + res] ||= []);
  while (list.length < count) list.push(buildVariant(kind, (kind === 'huang' ? 900 : 100) + list.length * 37, res));
  return list;
}

// Shared geometries for instancing. kind: 'taihu' | 'huang' | 'mixed'; res: marching-cubes grid
// (0 = hero quality ~15k tris; 18–22 = light versions for hundreds of instances).
export function rockVariants(n = 6, kind = 'taihu', res = 0) {
  if (kind === 'mixed') return [...ensure('taihu', Math.ceil(n * 0.66), res), ...ensure('huang', Math.max(1, Math.floor(n * 0.34)), res)];
  return ensure(kind, n, res).slice(0, n);
}

// Drop-in replacement for arch.js rock(size, seed, mat): radius-ish `size`, base at y≈0.
// opts: { kind: 'taihu'|'huang', tall: height multiplier, mat }
export function taihuRock(size = 1, seed = 1, opts = {}) {
  if (opts && opts.isMaterial) opts = { mat: opts };
  const kind = opts.kind || 'taihu';
  const list = ensure(kind, kind === 'huang' ? 2 : 4);
  const geo = list[Math.abs(seed | 0) % list.length];
  const mesh = new THREE.Mesh(geo, opts.mat && opts.mat.vertexColors ? opts.mat : rockMaterial());
  const tall = opts.tall ?? (kind === 'taihu' ? 1.15 : 0.8);
  mesh.scale.set(size, size * tall, size);
  mesh.rotation.y = (seed * 2.399) % (Math.PI * 2);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
