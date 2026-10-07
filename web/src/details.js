// Garden-scale detail: bridges where paths cross water, 湖石驳岸 bank rocks, stepping stones,
// and the 元宵 lantern field (第十八回: 两边石栏上皆系水晶玻璃各色风灯 … 每一株悬灯数盏).
import * as THREE from 'three';
import L from './layout.json';
import * as A from './arch.js';
import { MAT } from './arch.js';
import { heightAt, waterDepthMetric, polyDist } from './terrain.js';
import { rockVariants, rockMaterial } from './rocks.js';

let seed = 777;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Crossing points of a path polyline with a stream polyline.
function segIntersect(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a[0] + t * r[0], z: a[1] + t * r[1], dir: Math.atan2(s[1], s[0]) };
}

export function buildBridges() {
  const g = new THREE.Group(); g.name = 'bridges';
  const skip = [[0, 76], [163, -126.5], [-102, -74]]; // 沁芳桥, 沁芳闸, 蓼汀花溆 港洞 already built
  const done = [];
  for (const path of L.paths) for (let i = 0; i < path.length - 1; i++) {
    for (const s of L.water.streams) for (let k = 0; k < s.pts.length - 1; k++) {
      const hit = segIntersect(path[i], path[i + 1], s.pts[k], s.pts[k + 1]);
      if (!hit) continue;
      if (skip.some(([x, z]) => Math.hypot(hit.x - x, hit.z - z) < 14)) continue;
      if (done.some((d) => Math.hypot(hit.x - d.x, hit.z - d.z) < 10)) continue;
      done.push(hit);
      const span = s.width + 6;
      const arch = done.length % 2 === 0;
      const br = arch
        ? A.archBridge({ span: span - 3, w: 2.8, rise: 1.8 })
        : A.zigzagBridge([[-span / 2 - 1, 0], [-span / 6, 1.2], [span / 6, -1.2], [span / 2 + 1, 0]], { y: 0.75 });
      br.position.set(hit.x, arch ? 0.1 : 0, hit.z);
      br.rotation.y = -(hit.dir + Math.PI / 2); // span across the stream
      g.add(br);
    }
  }
  return g;
}

// 湖石驳岸: a continuous stacked revetment of Taihu and yellow stones along every water edge,
// big stones at the waterline (partly submerged), smaller ones stacked behind and above;
// plus scattered garden stones. One InstancedMesh per stone variant (few draw calls).
export function buildBankRocks() {
  const variants = rockVariants(6, 'mixed', 16);
  const buckets = variants.map(() => []);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const add = (x, z, s, y, flat = 0.7, vi) => {
    const v = vi ?? Math.floor(rnd() * variants.length);
    E.set((rnd() - 0.5) * 0.35, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.35); Q.setFromEuler(E);
    S.set(s * (0.85 + rnd() * 0.4), s * flat * (0.75 + rnd() * 0.5), s * (0.85 + rnd() * 0.4));
    P.set(x, y, z);
    buckets[v].push(M.compose(P, Q, S).clone());
  };
  const skip = (x, z) => L.places.some((q) => (q.type === 'scene' || q.id === 'dicui') && Math.hypot(q.x - x, q.z - z) < 8)
    || Math.hypot(x - 0, z - 76) < 15 || Math.hypot(x - 163, z + 126.5) < 9 || Math.hypot(x + 102, z + 74) < 9;
  // waterline course: dense, overlapping, partly underwater
  for (let x = -178; x <= 178; x += 1.25) for (let z = -148; z <= 148; z += 1.25) {
    const jx = x + (rnd() - 0.5) * 0.9, jz = z + (rnd() - 0.5) * 0.9;
    const w = waterDepthMetric(jx, jz);
    if (w > -0.4 && w < 0.7 && !skip(jx, jz) && rnd() < 0.8) {
      const s = 0.65 + rnd() * 0.75;
      add(jx, jz, s, -0.55 - rnd() * 0.25 + (0.7 - w) * 0.15, 0.62);
    } else if (w > -1.7 && w < -0.6 && !skip(jx, jz) && rnd() < 0.38) {
      // second course stacked behind, on the bank lip
      const s = 0.45 + rnd() * 0.5;
      add(jx, jz, s, Math.max(heightAt(jx, jz), 0.2) - s * 0.25, 0.7);
    }
  }
  // scattered garden stones off the paths: a few standing Taihu pieces among low ones
  for (let i = 0; i < 300; i++) {
    const x = (rnd() * 2 - 1) * 172, z = (rnd() * 2 - 1) * 142;
    if (waterDepthMetric(x, z) > -2) continue;
    let near = Infinity; for (const pth of L.paths) near = Math.min(near, polyDist(x, z, pth));
    if (near < 2.5 || near > 9) continue;
    if (skip(x, z)) continue;
    const stand = rnd() < 0.25;
    const s = stand ? 0.45 + rnd() * 0.4 : 0.35 + rnd() * 0.6;
    add(x, z, s, heightAt(x, z) - 0.08, stand ? 1.6 + rnd() * 0.8 : 0.6, stand ? Math.floor(rnd() * 4) : undefined);
  }
  const group = new THREE.Group(); group.name = 'bankRocks';
  const mat = rockMaterial();
  variants.forEach((geo, vi) => {
    if (!buckets[vi].length) return;
    const im = new THREE.InstancedMesh(geo, mat, buckets[vi].length);
    buckets[vi].forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = false; im.receiveShadow = true; // ~1.2M tris: keep them out of the shadow pass
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}

// 元宵 lanterns: wind lamps along the stream railings and lamps hung in the willows.
export function buildLanternField() {
  const pts = [];
  for (const s of L.water.streams) for (let k = 0; k < s.pts.length - 1; k++) {
    const [ax, az] = s.pts[k], [bx, bz] = s.pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let d = 0; d < len; d += 5) for (const side of [-1, 1]) {
      const x = ax + (bx - ax) * (d / len) + nx * side * (s.width / 2 + 1.2), z = az + (bz - az) * (d / len) + nz * side * (s.width / 2 + 1.2);
      if (Math.abs(x) > 176 || Math.abs(z) > 146 || waterDepthMetric(x, z) > -0.5) continue;
      pts.push([x, heightAt(x, z) + 1.1, z]);
    }
  }
  const pd = L.water.pond;
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2, x = pd.cx + Math.cos(a) * pd.rx * 1.06, z = pd.cz + Math.sin(a) * pd.rz * 1.08;
    if (waterDepthMetric(x, z) < -0.5) pts.push([x, heightAt(x, z) + 1.1, z]);
  }
  // lamps in trees: a few per willow along the banks
  for (const s of L.water.streams) for (let k = 0; k < s.pts.length - 1; k++) {
    for (let j = 0; j < 4; j++) {
      const t = rnd(), [ax, az] = s.pts[k], [bx, bz] = s.pts[k + 1];
      const x = ax + (bx - ax) * t + (rnd() - 0.5) * (s.width + 8), z = az + (bz - az) * t + (rnd() - 0.5) * (s.width + 8);
      if (waterDepthMetric(x, z) > -1.5 || Math.abs(x) > 176 || Math.abs(z) > 146) continue;
      for (let q = 0; q < 3; q++) pts.push([x + (rnd() - 0.5) * 3, heightAt(x, z) + 2.6 + rnd() * 2, z + (rnd() - 0.5) * 3]);
    }
  }
  const geo = new THREE.SphereGeometry(0.22, 8, 6);
  const colors = ['#ff6a3a', '#ffd27a', '#ff8fb0', '#9fe0ff', '#fff2c0'];
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), pts.length);
  const M = new THREE.Matrix4(), c = new THREE.Color();
  pts.forEach(([x, y, z], i) => { M.makeTranslation(x, y, z); im.setMatrixAt(i, M); im.setColorAt(i, c.set(colors[i % colors.length]).multiplyScalar(2)); });
  im.name = 'lanternField';
  im.visible = false;
  return { mesh: im, points: pts };
}

// Soft additive glow sprites for every lantern (building lanterns + field), shown at night.
export function buildGlow(points, size = 2.2) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,200,140,1)'); gr.addColorStop(0.3, 'rgba(255,140,70,0.45)'); gr.addColorStop(1, 'rgba(255,100,40,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.visible = false;
  return pts;
}
