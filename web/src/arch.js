// Procedural kit of Qing-style garden architecture. Every builder returns a THREE.Group
// whose local origin is the ground centre of the structure and whose front faces +z.
import * as THREE from 'three';
import * as T from './textures.js';
import { taihuRock } from './rocks.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

// World-space (triplanar) texturing for boxes whose UVs would otherwise stretch (walls, platforms,
// masonry). grime: darken toward the bottom (splash) and add rain streaks below the coping, from uv.v.
export function worldMapped(mat, scale = 0.5, { grime = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTpScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTpW; varying vec3 vTpN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTpW = (modelMatrix * vec4(transformed, 1.0)).xyz; vTpN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTpW; varying vec3 vTpN; uniform float uTpScale;\nfloat tpHash(float n){ return fract(sin(n) * 43758.5453); }')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec3 tpB = pow(abs(normalize(vTpN)), vec3(4.0)); tpB /= (tpB.x + tpB.y + tpB.z);
          vec4 tpC = texture2D(map, vTpW.zy * uTpScale) * tpB.x + texture2D(map, vTpW.xz * uTpScale) * tpB.y + texture2D(map, vTpW.xy * uTpScale) * tpB.z;
          diffuseColor *= tpC;
        #endif
        ${grime ? `
        #ifdef USE_MAP
          float gv = vMapUv.y;
          float side = 1.0 - tpB.y;
          diffuseColor.rgb *= mix(1.0, mix(0.68, 1.0, smoothstep(0.0, 0.28, gv)) * vec3(1.0, 0.97, 0.9).r, side);
          float col = floor((vTpW.x + vTpW.z) * 7.0);
          float streak = step(0.72, tpHash(col)) * smoothstep(0.55, 0.98, gv) * (0.5 + 0.5 * tpHash(col + 3.1));
          diffuseColor.rgb *= 1.0 - streak * 0.22 * side;
        #endif` : ''}`);
  };
  mat.customProgramCacheKey = () => 'tp' + (grime ? 'g' : '') + scale;
  return mat;
}

const tilePbr = T.tilePBR('#646a71'), tileGreenPbr = T.tilePBR('#46604c', 4), tileGoldPbr = T.tilePBR('#b8892c', 6);
const lacquerRed = T.woodPBR('#8e2b20', { lacquer: true }), lacquerGreen = T.woodPBR('#3d5c3e', { lacquer: true, seed: 8 });
const woodPlain = T.woodPBR('#6b4a32', { seed: 11 }), woodDark = T.woodPBR('#5a4030', { seed: 12 });
const brickPbr = T.brickPBR();
const latticeFor = (pattern, frame, paper) => std({ map: T.latticePattern(pattern, frame, paper), side: THREE.DoubleSide, roughness: 0.75 });

export const MAT = {
  tile: std({ ...tilePbr, side: THREE.DoubleSide, roughness: 0.62 }),
  tileGreen: std({ ...tileGreenPbr, side: THREE.DoubleSide, roughness: 0.45 }),
  tileGold: std({ ...tileGoldPbr, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.15 }),
  thatch: std({ map: T.thatchTexture(), side: THREE.DoubleSide }),
  ridge: std({ ...T.tilePBR('#4a4f55', 9), roughness: 0.6 }),
  column: std({ ...lacquerRed, roughness: 0.55 }),
  columnPlain: std({ ...woodPlain, roughness: 0.8 }), // 并无朱粉涂饰
  columnGreen: std({ ...lacquerGreen, roughness: 0.6 }),
  beam: std({ map: T.beamTexture() }),
  beamPlain: std({ ...woodDark }),
  lattice: latticeFor('bubujin', '#6a2418'),
  latticeGreen: latticeFor('denglong', '#2f4a35', '#f1ecd9'),
  wall: worldMapped(std({ map: T.plasterTexture(), roughness: 0.95 }), 0.25, { grime: true }),
  wallMud: worldMapped(std({ map: T.stoneTexture('#b7975c', 25, 0.2), roughness: 1 }), 0.4, { grime: true }),
  brick: worldMapped(std({ map: brickPbr.map, roughness: 0.9 }), 1.0),
  tiger: worldMapped(std({ map: T.tigerStoneTexture(), roughness: 0.95 }), 0.45),
  stone: worldMapped(std({ map: T.stoneTexture('#cfcabd', 21, 0.14), roughness: 0.95 }), 0.35),
  marble: worldMapped(std({ map: T.stoneTexture('#ecebe4', 22, 0.07), roughness: 0.55 }), 0.3),
  wood: std({ ...woodPlain }),
  redRail: std({ ...lacquerRed, roughness: 0.55 }),
  bamboo: std({ color: '#8a9a50' }),
  gold: std({ color: '#c9a04a', metalness: 0.45, roughness: 0.4 }),
  dark: std({ color: '#2a2622' }),
  eave: std({ map: T.eaveTexture2(), roughness: 0.7 }),
  eaveGreen: std({ map: T.eaveTexture2('#46604c'), roughness: 0.6 }),
  soffit: std({ map: T.soffitTexture(), side: THREE.DoubleSide }),
  door: std({ map: T.doorTexture(), side: THREE.DoubleSide }),
  doorGreen: std({ map: T.doorTexture('#2f4a35', '#f1ecd9'), side: THREE.DoubleSide }),
  hangLattice: std({ map: T.hangingLatticeTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
  hangLatticeGreen: std({ map: T.hangingLatticeTexture('#2f4a35'), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
  beamRich: std({ map: T.richBeamTexture() }),
  beamHexi: std({ map: T.beamPaint('hexi'), roughness: 0.6 }),
  dianban: std({ ...lacquerRed }),            // 垫板
  dougong: std({ color: '#2d5a6b', roughness: 0.7 }),
  dougongTop: std({ color: '#3f7d5c', roughness: 0.7 }),
  kanqiang: worldMapped(std({ map: brickPbr.map, roughness: 0.9 }), 1.0), // 槛墙: grey brick (86 版)
  paving: std({ map: T.pavingTexture(), roughness: 0.95 }),
  pebble: std({ map: T.pebbleTexture(), roughness: 0.95 }),
  ridgeDark: std({ color: '#33373b', roughness: 0.6 }),
  latticePlain: latticeFor('bubujin', '#6b4a32'),
  doorPlain: std({ map: T.doorTexture('#6b4a32', '#efe6cf'), side: THREE.DoubleSide }),
  hangLatticePlain: std({ map: T.hangingLatticeTexture('#6b4a32'), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
  lantern: std({ color: '#c0281e', emissive: '#ff3a1a', emissiveIntensity: 0.0, roughness: 0.5 }),
  lanternGold: std({ color: '#c9a04a', metalness: 0.5, roughness: 0.4 }),
  shanhua: std({ map: T.shanhuaTexture(), roughness: 0.7 }),
  bofeng: std({ ...lacquerRed, roughness: 0.6 }),   // 博缝板
  floor: worldMapped(std({ map: T.pavingTexture('#8f8d86'), roughness: 0.9 }), 0.5), // interior 方砖
  frameRed: std({ ...lacquerRed, roughness: 0.55 }),
  frameGreen: std({ ...lacquerGreen, roughness: 0.6 }),
  frameWood: std({ ...woodPlain }),
  doorStud: std({ color: '#c9a04a', metalness: 0.6, roughness: 0.35 }),
};
for (const [k, m] of Object.entries(MAT)) if (m && m.isMaterial) m.name = k;
// Lattice families by name for hall({ lattice }) — 步步锦, 灯笼框, 冰裂纹, 龟背锦, 万字.
const LATTICE = {};
export function latticeMat(pattern = 'bubujin', tone = 'red') { return latticeMat_(pattern, tone); }
function latticeMat_(pattern = 'bubujin', tone = 'red') {
  const key = pattern + tone;
  const frames = { red: ['#6a2418', '#efe6cf'], green: ['#2f4a35', '#f1ecd9'], plain: ['#6b4a32', '#efe6cf'], white: ['#8f8a7e', '#f3efe4'] };
  return (LATTICE[key] ||= latticeFor(pattern, ...(frames[tone] || frames.red)));
}
const PAINT = { hexi: () => MAT.beamHexi, su: () => MAT.beamRich, xuanzi: () => MAT.beam, plain: () => MAT.beamPlain };
MAT.louchuang = [0, 1, 2, 3].map((k) => std({ map: T.louchuangTexture(k) }));
// Lanterns light up at night / 元宵: main.js changes MAT.lantern.emissiveIntensity.
export const lanternSpots = []; // filled from mesh.userData.lantern after placement

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r, h, m, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
function at(mesh, x, y, z, ry = 0) { mesh.position.set(x, y, z); mesh.rotation.y = ry; return mesh; }

// ---------------------------------------------------------------- roofs
// Height-field roof over a w×d footprint (eave overhang included). Concave Chinese
// profile y = H·s^p (gentle at eaves, steep near ridge) plus 翼角 corner lift.
export function roofGeometry(w, d, H, type = 'xieshan', opts = {}) {
  const a = w / 2, b = d / 2;
  const p = opts.p ?? (type === 'thatch' ? 1.15 : 1.7);
  const lift = opts.lift ?? (type === 'thatch' || type === 'yingshan' ? 0 : Math.min(1.2, b * 0.18));
  const nx = Math.max(12, Math.round(w * 2)), nz = Math.max(12, Math.round(d * 2.4));
  const pos = [], uv = [], idx = [];
  const sides = opts.sides || 4; // for cuanjian
  const sAt = (x, z) => {
    const sz = (b - Math.abs(z)) / b;
    if (type === 'wudian') return Math.min((a - Math.abs(x)) / b, sz);
    if (type === 'xieshan') {
      const inner = a - 0.55 * b;
      if (Math.abs(x) < inner) return sz;
      return Math.min(sz, (a - Math.abs(x)) / b);
    }
    if (type === 'cuanjian') {
      const r = Math.hypot(x, z), ang = Math.atan2(z, x);
      const sector = (Math.PI * 2) / sides;
      const local = ((ang + Math.PI * 2 + sector / 2) % sector) - sector / 2;
      return 1 - (r * Math.cos(local)) / a;
    }
    return sz; // yingshan / juanpeng / thatch
  };
  const yAt = (x, z) => {
    let s = Math.max(0, Math.min(1, sAt(x, z)));
    let y;
    if (type === 'juanpeng') y = H * (s < 0.85 ? Math.pow(s / 0.85, p) * 0.94 : 0.94 + 0.06 * Math.sin(((s - 0.85) / 0.15) * Math.PI / 2));
    else y = H * Math.pow(s, p);
    if (lift) {
      let corner;
      if (type === 'cuanjian') {
        const ang = Math.atan2(z, x), sector = (Math.PI * 2) / sides;
        const local = ((ang + Math.PI * 2) % sector) / sector;
        corner = Math.pow(Math.abs(Math.cos(local * Math.PI)), 10);
      } else if (type === 'yingshan' || type === 'juanpeng' || type === 'thatch') corner = 0;
      else corner = Math.pow(Math.abs(x) / a, 10) * Math.pow(Math.abs(z) / b, 6);
      y += lift * corner * Math.pow(1 - s, 3);
    }
    return y;
  };
  if (type === 'cuanjian') {
    // polar grid
    const nr = 14, na = sides * 8;
    for (let i = 0; i <= nr; i++) {
      for (let j = 0; j <= na; j++) {
        const ang = (j / na) * Math.PI * 2 + Math.PI / sides;
        const sector = (Math.PI * 2) / sides;
        const local = ((ang + Math.PI * 2 + sector / 2) % sector) - sector / 2;
        const R = (a / Math.cos(local)) * (1 - i / nr);
        const x = Math.cos(ang) * R, z = Math.sin(ang) * R;
        pos.push(x, yAt(x, z), z);
        uv.push(j / 2, i / 2);
      }
    }
    for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
      const k = i * (na + 1) + j;
      idx.push(k, k + 1, k + na + 1, k + 1, k + na + 2, k + na + 1);
    }
  } else {
    for (let i = 0; i <= nz; i++) {
      for (let j = 0; j <= nx; j++) {
        const x = -a + (j / nx) * w, z = -b + (i / nz) * d;
        pos.push(x, yAt(x, z), z);
        uv.push(x / 1.1, z / 1.0);
      }
    }
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
      const k = i * (nx + 1) + j;
      idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.yAt = yAt;
  return g;
}

// Full roof assembly: surface + ridge + gable infill.
export function roof(w, d, H, type, mat = MAT.tile, opts = {}) {
  const grp = new THREE.Group();
  const geo = roofGeometry(w, d, H, type, opts);
  const m = new THREE.Mesh(geo, mat);
  grp.add(m);
  const yAt = geo.userData.yAt;
  const a = w / 2, b = d / 2;
  const detail = opts.detail ?? (w > 3 && type !== 'thatch');
  if (detail) {
    // rafters seen from below
    const under = new THREE.Mesh(geo.clone().translate(0, -0.17, 0), MAT.soffit);
    grp.add(under);
    // eave fascia with 瓦当/滴水
    grp.add(new THREE.Mesh(fasciaGeometry(w, d, type, yAt, opts.sides || 4), mat === MAT.tileGreen ? MAT.eaveGreen : MAT.eave));
    // real 筒瓦 tubes with 勾头 ends along the eaves (silhouette scallop)
    const et = opts.eaveTiles === false ? null : eaveTiles(w, d, type, yAt, opts.sides || 4);
    if (et) grp.add(new THREE.Mesh(et, mat === MAT.tileGreen ? MAT.tileGreen : MAT.ridge));
  }
  if (detail && type === 'xieshan') grp.add(gable(a, b, H, yAt));
  if (type === 'xieshan' || type === 'yingshan' || type === 'wudian') {
    const rl = type === 'wudian' ? Math.max(0.5, w - d) : type === 'xieshan' ? w - 1.1 * (d / 2) : w;
    const rh = Math.min(0.6, 0.25 + d * 0.02);
    grp.add(at(box(rl, rh, 0.42, MAT.ridge), 0, H + rh / 2 - 0.05, 0));
    grp.add(at(box(rl, 0.08, 0.5, MAT.ridgeDark), 0, H + rh - 0.02, 0));
    grp.add(at(box(rl, 0.06, 0.46, MAT.ridgeDark), 0, H + rh * 0.35, 0)); // 当沟 band
    for (const sx of [-1, 1]) grp.add(wen(rh * 2.4, sx, sx * rl / 2, H - 0.05));
  }
  if (detail && (type === 'xieshan' || type === 'wudian')) {
    const inner = type === 'xieshan' ? a - 0.55 * b : Math.max(0.25, a - b);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      // 戗脊 / 垂脊 following the hip line |z| = b - a + |x| down to the corner
      const x0 = type === 'xieshan' ? inner : inner, z0 = type === 'xieshan' ? 0.45 * b : 0;
      grp.add(ridgeTube((t) => { const x = x0 + (a * 0.97 - x0) * t, z = z0 + (b * 0.97 - z0) * t; return [sx * x, yAt(sx * x, sz * z), sz * z]; }, 0.11));
      if (type === 'xieshan') grp.add(ridgeTube((t) => { const z = 0.45 * b * t; return [sx * inner, yAt(sx * inner * 0.999, sz * z) + 0.0, sz * z]; }, 0.1));
      // 走兽 on the lower end of the hip
      const nBeast = w > 14 ? 5 : 3, ang = Math.atan2(sz * (b - z0), sx * (a - x0));
      for (let k = 0; k <= nBeast; k++) {
        const t = 0.66 + k * (0.26 / nBeast), x = x0 + (a * 0.97 - x0) * t, z = z0 + (b * 0.97 - z0) * t;
        const bst = new THREE.Mesh(k === nBeast ? XIANREN_GEO : BEAST_GEO, MAT.ridgeDark);
        bst.position.set(sx * x, yAt(sx * x, sz * z) + 0.16, sz * z); bst.rotation.y = -ang;
        grp.add(bst);
      }
      // 垂兽 at the upper end of the hip
      const tx = x0 + (a * 0.97 - x0) * 0.5, tz = z0 + (b * 0.97 - z0) * 0.5;
      const cs = new THREE.Mesh(BEAST_GEO, MAT.ridgeDark); cs.scale.setScalar(1.7);
      cs.position.set(sx * tx, yAt(sx * tx, sz * tz) + 0.2, sz * tz); cs.rotation.y = -ang; grp.add(cs);
    }
  }
  if (detail && type === 'cuanjian') {
    const sides = opts.sides || 4, sector = (Math.PI * 2) / sides;
    for (let k = 0; k < sides; k++) {
      const ang = (k + 0.5) * sector, R = (a / Math.cos(sector / 2)) * 0.97;
      grp.add(ridgeTube((t) => { const x = Math.cos(ang) * R * t, z = Math.sin(ang) * R * t; return [x, yAt(x, z), z]; }, 0.09));
    }
  }
  if (type === 'cuanjian') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), MAT.gold);
    top.position.y = H + 0.15; grp.add(top);
  }
  if (type === 'yingshan' || type === 'juanpeng' || type === 'thatch') {
    // gable walls under the roof ends
    const shape = new THREE.Shape();
    const b = d / 2 - (opts.overhang ?? 0.9);
    const yAt = geo.userData.yAt;
    shape.moveTo(-b, 0);
    for (let i = 0; i <= 16; i++) { const z = -b + (i / 16) * 2 * b; shape.lineTo(z, yAt(0, z) - 0.05); }
    shape.lineTo(b, 0);
    const sg = new THREE.ShapeGeometry(shape);
    for (const sx of [-1, 1]) {
      const gw = new THREE.Mesh(sg, opts.gableMat || MAT.wall);
      gw.rotation.y = Math.PI / 2;
      gw.position.x = sx * (w / 2 - (opts.overhang ?? 0.9) + 0.05);
      gw.material.side = THREE.DoubleSide;
      grp.add(gw);
    }
  }
  return grp;
}

// Vertical ribbon along the eave line, textured with tile ends.
function fasciaGeometry(w, d, type, yAt, sides) {
  const a = w / 2, b = d / 2, pts = [];
  if (type === 'cuanjian') {
    const sector = (Math.PI * 2) / sides;
    for (let i = 0; i <= sides * 8; i++) {
      const ang = (i / (sides * 8)) * Math.PI * 2 + Math.PI / sides;
      const local = ((ang + Math.PI * 2 + sector / 2) % sector) - sector / 2;
      const R = a / Math.cos(local);
      pts.push([Math.cos(ang) * R, Math.sin(ang) * R]);
    }
  } else {
    const n = 24;
    const edge = (x0, z0, x1, z1) => { for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n)]); };
    edge(-a, b, a, b); edge(a, b, a, -b); edge(a, -b, -a, -b); edge(-a, -b, -a, b); pts.push([-a, b]);
  }
  const pos = [], uv = [], idx = [];
  let u = 0;
  pts.forEach(([x, z], i) => {
    const y = yAt(x * 0.999, z * 0.999);
    if (i) u += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    pos.push(x, y + 0.05, z, x, y - 0.42, z);
    uv.push(u / 2.2, 1, u / 2.2, 0);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function ridgeTube(f, r) {
  const pts = []; for (let i = 0; i <= 10; i++) { const [x, y, z] = f(i / 10); pts.push(new THREE.Vector3(x, y + r * 0.6, z)); }
  // upturned tip (仙人走兽 end) at the eave
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  pts.push(last.clone().add(last.clone().sub(prev).setY(0).multiplyScalar(0.6)).add(new THREE.Vector3(0, 0.35, 0)));
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 5), MAT.ridge);
}

// 正吻: ridge-end dragon head swallowing the ridge — open jaw at the bottom, curled tail and 剑把 on top.
const WEN_GEO = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(0.55, 0); sh.lineTo(0.6, 0.12); sh.lineTo(0.35, 0.18); sh.lineTo(0.62, 0.32); // open jaw facing the ridge
  sh.quadraticCurveTo(0.7, 0.62, 0.45, 0.78); sh.lineTo(0.5, 0.95); sh.quadraticCurveTo(0.1, 1.05, -0.05, 0.86); // head and curled tail
  sh.quadraticCurveTo(-0.28, 0.72, -0.18, 0.5); sh.quadraticCurveTo(-0.05, 0.62, 0.02, 0.5); sh.lineTo(0, 0);
  const eye = new THREE.Path(); eye.absarc(0.4, 0.55, 0.05, 0, Math.PI * 2, true); sh.holes.push(eye);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.15);
  return g;
})();
function wen(h, sx, x, y) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(WEN_GEO, MAT.ridgeDark);
  m.scale.set(-sx * h, h, 1); // jaw faces the ridge centre
  g.add(m);
  g.add(at(cyl(0.035, h * 0.35, MAT.ridgeDark, 5), -sx * h * 0.05, h * 1.08, 0)); // 剑把
  g.position.set(x, y, 0);
  return g;
}
// 走兽 (seated beast) and 仙人 (rider) silhouettes for the hip ridge ends.
const BEAST_GEO = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.1, 0); sh.lineTo(0.12, 0); sh.lineTo(0.12, 0.08); sh.quadraticCurveTo(0.14, 0.2, 0.08, 0.24); sh.lineTo(0.13, 0.3);
  sh.lineTo(0.03, 0.31); sh.quadraticCurveTo(-0.02, 0.2, -0.08, 0.16); sh.quadraticCurveTo(-0.14, 0.1, -0.1, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false, curveSegments: 3 }); g.translate(0, 0, -0.045); g.rotateY(Math.PI / 2);
  return g;
})();
const XIANREN_GEO = (() => {
  const g = mergeGeometries([new THREE.CylinderGeometry(0.05, 0.08, 0.28, 6).translate(0, 0.14, 0), new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0.32, 0),
    new THREE.BoxGeometry(0.22, 0.08, 0.1).translate(0.03, 0.04, 0)].map((x) => x.toNonIndexed()));
  return g;
})();

// 筒瓦 tubes with 勾头 discs along every eave edge (merged), giving the scalloped eave silhouette.
function eaveTiles(w, d, type, yAt, sides) {
  if (type === 'thatch') return null;
  const a = w / 2, b = d / 2, step = 0.275, len = 0.85, list = [];
  // open 5-sided tube + a 勾头 disc at the eave end only (~15 tris per tile)
  const tube = mergeGeometries([
    new THREE.CylinderGeometry(0.085, 0.085, len, 5, 1, true).toNonIndexed(),
    new THREE.CircleGeometry(0.095, 6).rotateX(-Math.PI / 2).translate(0, len / 2, 0).toNonIndexed(),
  ]);
  tube.rotateX(Math.PI / 2); // along z, disc at +z
  const edges = []; // [x0,z0,x1,z1, inward nx,nz]
  if (type === 'cuanjian') {
    const sector = (Math.PI * 2) / sides, R = a / Math.cos(sector / 2);
    for (let k = 0; k < sides; k++) {
      const a0 = (k + 0.5) * sector, a1 = (k + 1.5) * sector, am = (k + 1) * sector;
      edges.push([Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R, -Math.cos(am), -Math.sin(am)]);
    }
  } else {
    edges.push([-a, b, a, b, 0, -1], [a, -b, -a, -b, 0, 1]);
    if (type === 'xieshan' || type === 'wudian') edges.push([a, b, a, -b, -1, 0], [-a, -b, -a, b, 1, 0]);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
  for (const [x0, z0, x1, z1, nx, nz] of edges) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / step);
    const margin = type === 'yingshan' || type === 'juanpeng' ? 0.2 : Math.min(1.2, L * 0.12);
    for (let i = 0; i <= n; i++) {
      const t = (i * step) / L, dl = t * L;
      if (dl < margin || dl > L - margin) continue;
      const px = x0 + (x1 - x0) * t + nx * 0.02, pz = z0 + (z1 - z0) * t + nz * 0.02;
      const qx = px + nx * len, qz = pz + nz * len;
      const y1 = yAt(px * 0.999, pz * 0.999) + 0.07, y2 = yAt(qx, qz) + 0.07;
      dir.set(px - qx, y1 - y2, pz - qz).normalize();
      q.setFromUnitVectors(zAxis, dir);
      pos.set((px + qx) / 2, (y1 + y2) / 2, (pz + qz) / 2);
      list.push(tube.clone().applyMatrix4(m.compose(pos, q, one)));
    }
  }
  return list.length ? mergeGeometries(list) : null;
}

// 歇山 gable: red 山花 triangle with gold ribbons, framed by 博缝板 boards following the roof profile.
function gable(a, b, H, yAt) {
  const g = new THREE.Group();
  const inner = a - 0.55 * b, zb = 0.45 * b, yb = yAt(inner * 1.001, zb * 0.999);
  const sh = new THREE.Shape(); sh.moveTo(-zb, yb);
  for (let i = 0; i <= 20; i++) { const z = -zb + (i / 20) * 2 * zb; sh.lineTo(z, yAt(inner * 0.995, z) - 0.06); }
  sh.lineTo(zb, yb); sh.closePath();
  const geo = new THREE.ShapeGeometry(sh);
  // map uv to the triangle's bounding box
  const uv = geo.attributes.uv, P = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (P.getX(i) + zb) / (2 * zb), (P.getY(i) - yb) / Math.max(0.1, H - yb));
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(geo, MAT.shanhua); m.material.side = THREE.DoubleSide;
    m.rotation.y = sx * Math.PI / 2; m.position.x = sx * (inner - 0.05); g.add(m);
    // 博缝板 along the top edge
    const pts = []; for (let i = 0; i <= 16; i++) { const z = -zb + (i / 16) * 2 * zb; pts.push(new THREE.Vector3(sx * (inner + 0.02), yAt(inner * 0.995, z) - 0.02, z)); }
    const bf = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.12, 4), MAT.bofeng);
    bf.scale.set(1, 1, 1); g.add(bf);
  }
  return g;
}

// Hanging lanterns: 'red' round lantern or 'palace' hexagonal 宫灯.
export function lantern(kind = 'red') {
  const g = new THREE.Group();
  const string = cyl(0.015, 0.5, MAT.dark, 4); string.position.y = 0.25; g.add(string);
  if (kind === 'palace') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 6), MAT.lantern); g.add(body);
    for (const y of [0.3, -0.3]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 6), MAT.lanternGold), 0, y, 0));
    const tassel = cyl(0.03, 0.4, MAT.lantern, 4); tassel.position.y = -0.55; g.add(tassel);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), MAT.lantern); body.scale.y = 1.15; g.add(body);
    for (const y of [0.29, -0.29]) g.add(at(cyl(0.11, 0.06, MAT.lanternGold, 8), 0, y, 0));
    const tassel = cyl(0.025, 0.3, MAT.lanternGold, 4); tassel.position.y = -0.47; g.add(tassel);
  }
  g.children[1].userData.lantern = true;
  return g;
}

// 雀替: carved bracket at a column head — scrolled lower edge with pierced cut-outs.
const queTiGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.95, 0); s.quadraticCurveTo(0.9, -0.08, 0.78, -0.1);
  s.bezierCurveTo(0.7, -0.22, 0.58, -0.08, 0.52, -0.2); s.bezierCurveTo(0.45, -0.34, 0.3, -0.24, 0.24, -0.36);
  s.bezierCurveTo(0.18, -0.46, 0.06, -0.42, 0, -0.5); s.closePath();
  for (const [x, y, r] of [[0.36, -0.15, 0.045], [0.12, -0.25, 0.05]]) { const h = new THREE.Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.06);
  return g;
})();

// Thin frame boxes around a w×h opening split into `n` vertical panes.
function frameRect(g, mat, cx, cy, z, w, h, n = 1) {
  const t = 0.07, dp = 0.1;
  g.add(at(box(w, t, dp, mat), cx, cy + h / 2, z)); g.add(at(box(w, t, dp, mat), cx, cy - h / 2, z));
  for (let k = 0; k <= n; k++) g.add(at(box(t, h, dp, mat), cx - w / 2 + (k / n) * w, cy, z));
}

// Four 隔扇 leaves (frame + 格心 lattice + 绦环板/裙板); middle two swing inward by `open` radians.
function doorLeaves(pw, wh, lmat, fmat, open, cx, y0, z) {
  const g = new THREE.Group();
  const lw = pw / 4, lh = wh - 0.16;
  const leaf = () => {
    const L = new THREE.Group();
    L.add(at(new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.1, lh - 0.1), lmat), 0, lh / 2, 0));
    frameRect(L, fmat, 0, lh / 2, 0.02, lw, lh, 1);
    L.add(at(box(lw - 0.1, 0.06, 0.06, fmat), 0, lh * 0.25, 0.03)); // 绦环板 rail
    return L;
  };
  for (let k = 0; k < 4; k++) {
    const L = leaf();
    if (k === 1 || k === 2) {
      const sgn = k === 1 ? 1 : -1;               // leaf 1 hinges on its left edge, leaf 2 on its right
      const pivot = new THREE.Group();
      pivot.position.set(cx - sgn * (pw / 2 - lw), y0 + 0.16, z);
      L.position.x = sgn * lw / 2; pivot.add(L); pivot.rotation.y = sgn * open; // swing inward (-z)
      g.add(pivot);
    } else {
      L.position.set(cx - pw / 2 + (k + 0.5) * lw, y0 + 0.16, z);
      g.add(L);
    }
  }
  return g;
}

// Thin pavement slab (courtyard paving, pebble path).
export function pavement(w, d, mat = MAT.paving, repeat = 3) {
  const geo = new THREE.BoxGeometry(w, 0.08, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / repeat, uv.getY(i) * d / repeat);
  const m = new THREE.Mesh(geo, mat); m.position.y = 0.04;
  return m;
}

// ---------------------------------------------------------------- halls
// A timber-frame hall. w = width (along x), d = depth, h = column height.
export function hall({
  w = 12, d = 7, h = 3.6, bays = 3, roofType = 'xieshan', roofMat = MAT.tile,
  colMat = MAT.column, beamMat = MAT.beamRich, latticeMat = MAT.lattice, wallMat = MAT.wall,
  platform = 0.6, platMat = MAT.stone, frontOpen = false, backWall = true, sideWalls = true,
  corridor = 0, roofH, plaque, plaqueOpts, couplet, dougong = false, lanterns = 'red', steps = true,
  doorMat, hangMat = MAT.hangLattice, sillMat = MAT.kanqiang, rustic = false, unpainted = false, openCenter = false,
  paint, lattice, tone, doorOpen = 1.15,
} = {}) {
  // paint: 'hexi' | 'su' | 'xuanzi' | 'plain'  ·  lattice: 'bubujin' | 'denglong' | 'binglie' | 'guibei' | 'wanzi'
  if (paint && PAINT[paint]) beamMat = PAINT[paint]();
  if (lattice) latticeMat = latticeMat_(lattice, tone || (latticeMat === MAT.latticeGreen ? 'green' : unpainted ? 'plain' : 'red'));
  const frameMat = unpainted || rustic ? MAT.frameWood : (tone === 'green' || latticeMat === MAT.latticeGreen || colMat === MAT.columnGreen) ? MAT.frameGreen : MAT.frameRed;
  const g = new THREE.Group();
  const W = w + corridor * 2, D = d + corridor * 2;
  g.add(at(box(W + 1.2, platform, D + 1.2, platMat), 0, platform / 2, 0));
  const y0 = platform;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, d - 0.3).rotateX(-Math.PI / 2), MAT.floor); fl.position.y = y0 + 0.01; g.add(fl); // interior 方砖 floor
  if (steps && platform > 0.35) {
    const n = Math.max(2, Math.round(platform / 0.18)), bw0 = Math.min(w / bays, 4.5);
    for (let k = 0; k < n; k++) g.add(at(box(bw0, platform * (n - k) / n, 0.34, platMat), 0, platform * (n - k) / n / 2, D / 2 + 0.6 + 0.17 + k * 0.34));
  }
  const bw = w / bays;
  const colR = Math.max(0.16, h * 0.05);
  const xs = []; for (let i = 0; i <= bays; i++) xs.push(-w / 2 + i * bw);
  if (corridor) { xs.unshift(-W / 2); xs.push(W / 2); }
  const zs = corridor ? [-D / 2, -d / 2, d / 2, D / 2] : [-d / 2, d / 2];
  for (const x of xs) for (const z of zs) {
    if (!corridor && Math.abs(z) < d / 2 - 0.01) continue;
    g.add(at(cyl(colR, h, colMat), x, y0 + h / 2, z));
    if (!rustic) g.add(at(cyl(colR * 1.55, 0.16, MAT.stone, 10), x, y0 + 0.08, z)); // 柱础
  }
  // beams: 大额枋 + 垫板 + 平板枋 (painted); rustic halls keep plain beams
  const bh = rustic ? 0.4 : 0.42, db = rustic ? 0 : 0.18, pb = rustic ? 0 : 0.12;
  const top = y0 + h;
  const beamY = top - db - pb - bh / 2;
  const bm = rustic ? MAT.beamPlain : beamMat;
  for (const z of [-D / 2, D / 2]) {
    g.add(at(box(W, bh, 0.3, bm), 0, beamY, z));
    if (db) { g.add(at(box(W, db, 0.22, unpainted ? MAT.wood : MAT.dianban), 0, top - pb - db / 2, z)); g.add(at(box(W + 0.1, pb, 0.36, unpainted ? MAT.beamPlain : MAT.dougong), 0, top - pb / 2, z)); }
  }
  for (const x of [-W / 2, W / 2]) {
    g.add(at(box(0.3, bh, D, bm), x, beamY, 0));
    if (db) { g.add(at(box(0.22, db, D, unpainted ? MAT.wood : MAT.dianban), x, top - pb - db / 2, 0)); g.add(at(box(0.36, pb, D + 0.1, unpainted ? MAT.beamPlain : MAT.dougong), x, top - pb / 2, 0)); }
  }
  // 斗拱 row along the four sides
  let dgH = 0;
  if (dougong) {
    dgH = 0.5;
    const ring = [];
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 0.85) ring.push([x, D / 2], [x, -D / 2]);
    for (let z = -D / 2 + 0.85; z < D / 2; z += 0.85) ring.push([W / 2, z], [-W / 2, z]);
    for (const [x, z] of ring) {
      g.add(at(box(0.26, 0.22, 0.26, MAT.dougong), x, top + 0.11, z));
      g.add(at(box(0.62, 0.12, 0.62, MAT.dougongTop), x, top + 0.28, z));
      g.add(at(box(0.3, 0.12, 0.3, MAT.dougong), x, top + 0.42, z));
    }
  }
  // 雀替 at front column heads
  if (!rustic) for (const x of xs) for (const sx of [-1, 1]) {
    if ((sx < 0 && x <= -W / 2 + 0.01) || (sx > 0 && x >= W / 2 - 0.01)) continue;
    const q = new THREE.Mesh(queTiGeo, unpainted ? MAT.wood : MAT.gold);
    q.position.set(x + sx * colR * 0.8, beamY - bh / 2, D / 2); q.scale.x = sx * Math.min(1, bw / 3.2);
    g.add(q);
  }
  // walls / doors / windows
  const wh = beamY - bh / 2 - y0;
  if (backWall) g.add(at(box(w, wh, 0.3, wallMat), 0, y0 + wh / 2, -d / 2));
  if (sideWalls) for (const sx of [-1, 1]) g.add(at(box(0.3, wh, d, wallMat), sx * w / 2, y0 + wh / 2, 0));
  const dm = doorMat || (latticeMat === MAT.latticeGreen ? MAT.doorGreen : MAT.door);
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + (i + 0.5) * bw, pw = bw - colR * 2;
    if (!frontOpen) {
      const center = i === Math.floor(bays / 2);
      if (center && openCenter) { /* passage */ } else if (center && !rustic) {
        // 隔扇门: four leaves with real frames; the two middle leaves stand open so the interior shows
        g.add(doorLeaves(pw, wh, latticeMat, frameMat, doorOpen, cx, y0, d / 2 - 0.08));
        g.add(at(box(pw + 0.1, 0.16, 0.24, frameMat), cx, y0 + 0.08, d / 2 - 0.08)); // 下槛
      } else if (center || rustic) {
        g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(pw, wh), center ? dm : latticeMat), cx, y0 + wh / 2, d / 2 - 0.05));
      } else {
        // 槛墙 (grey brick) + 槛窗 with frame
        g.add(at(box(pw, 0.85, 0.32, sillMat), cx, y0 + 0.425, d / 2 - 0.1));
        g.add(at(box(pw + 0.06, 0.08, 0.4, MAT.stone), cx, y0 + 0.88, d / 2 - 0.1)); // 榻板
        const wy = y0 + 0.92 + (wh - 0.92) / 2, wht = wh - 0.92;
        for (let k = 0; k < 4; k++) {
          const lw = pw / 4;
          g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.08, wht - 0.1), latticeMat), cx - pw / 2 + (k + 0.5) * lw, wy, d / 2 - 0.06));
        }
        frameRect(g, frameMat, cx, wy, d / 2 - 0.04, pw, wht, 4);
      }
    }
    // 倒挂楣子 under the front beam (outer row when there is a corridor)
    if (!rustic) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(pw, 0.34), hangMat), cx, beamY - bh / 2 - 0.17, D / 2));
  }
  // roof
  const oh = 1.3 + (dougong ? 0.3 : 0);
  const rH = roofH ?? Math.max(2.2, D * 0.42);
  const r = roof(W + oh * 2, D + oh * 2, rH, roofType, roofMat, { overhang: oh, detail: !rustic && roofType !== 'thatch' });
  r.position.y = top + dgH;
  g.add(r);
  if (lanterns && !rustic) for (let i = 0; i < bays; i++) { // one gauze lantern per bay under the eave
    if (bays === 1 && i) break;
    if (plaque && bays > 1 && i === Math.floor(bays / 2)) continue; // keep the plaque clear
    const l = lantern(lanterns); l.position.set(-w / 2 + (i + 0.5) * bw, beamY - bh / 2 - 0.75, D / 2 + 0.6); g.add(l);
  }
  if (plaque) addPlaque(g, plaque, { y: beamY - bh / 2 - 0.62, z: D / 2 + 0.25, width: Math.min(bw * 0.95, 0.75 * [...plaque].length + 0.6), ...plaqueOpts });
  if (couplet) addCouplet(g, couplet, { y: y0, h: wh, x: bw / 2 * (bays > 1 ? 1 : 0.6), z: D / 2 + colR + 0.04 });
  g.userData.top = top + dgH + rH;
  return g;
}

export function addPlaque(g, text, { y, z, width = 2.4, x = 0, ...o }) {
  const t = T.plaqueTexture(text, o);
  const ht = width / t.userData.aspect;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, ht), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  m.position.set(x, y, z);
  m.userData.keepSeparate = true;
  g.add(m);
  return m;
}

export function addCouplet(g, [left, right], { y, h, x, z }) {
  // Right-hand board (上联) is read first and hangs on the viewer's right.
  [[right, -x], [left, x]].forEach(([text, xx], i) => {
    const t = T.coupletTexture(i === 0 ? left : right);
    const ht = h * 0.78, wd = ht * t.userData.aspect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.set(i === 0 ? x : -x, y + h * 0.48, z);
    m.userData.keepSeparate = true;
    g.add(m);
  });
}

// Two-storey building (楼/阁) with balcony.
export function lou({ w = 14, d = 8, h1 = 3.8, h2 = 3.4, bays = 5, roofType = 'xieshan', plaque, roofMat = MAT.tile, paint, lattice, tone } = {}) {
  const g = new THREE.Group();
  const low = hall({ w, d, h: h1, bays, roofType: 'none', roofMat, paint, lattice, tone });
  // replace the lower roof with a skirt roof (腰檐)
  low.children = low.children.filter((c) => !(c.isGroup));
  g.add(low);
  const skirt = roof(w + 3.2, d + 3.2, 1.2, 'wudian', roofMat, { p: 1.3 });
  skirt.position.y = 0.6 + h1;
  // punch the centre: skirt roof is cosmetic, upper storey sits above
  g.add(skirt);
  const up = hall({ w: w - 1, d: d - 1, h: h2, bays, roofType, roofMat, platform: 0.3, platMat: MAT.wood, plaque, paint, lattice, tone });
  up.position.y = 0.6 + h1 + 0.9;
  g.add(up);
  // balcony railing
  const ry = 0.6 + h1 + 1.2;
  for (const z of [-(d + 0.6) / 2, (d + 0.6) / 2]) g.add(at(box(w + 0.6, 0.12, 0.12, MAT.redRail), 0, ry + 0.9, z));
  for (const x of [-(w + 0.6) / 2, (w + 0.6) / 2]) g.add(at(box(0.12, 0.12, d + 0.6, MAT.redRail), x, ry + 0.9, 0));
  g.userData.top = up.position.y + up.userData.top;
  return g;
}

// Pavilion (亭): n-sided cuanjian, or 4-sided xieshan when n === 'x'.
export function pavilion({ n = 4, r = 2.6, h = 3.2, platform = 0.5, roofMat = MAT.tile, colMat = MAT.column, plaque, seat = true } = {}) {
  const g = new THREE.Group();
  const sides = n;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.6, r + 0.7, platform, sides, 1), MAT.stone);
  plat.rotation.y = Math.PI / sides; plat.position.y = platform / 2;
  g.add(plat);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    g.add(at(cyl(0.15, h, colMat), Math.cos(a) * r, platform + h / 2, Math.sin(a) * r));
    if (seat) {
      const a2 = a + Math.PI / sides, mid = r * Math.cos(Math.PI / sides);
      const len = 2 * r * Math.sin(Math.PI / sides);
      const s = box(len, 0.1, 0.4, MAT.redRail);
      s.position.set(Math.cos(a2) * mid, platform + 0.5, Math.sin(a2) * mid);
      s.rotation.y = -a2 + Math.PI / 2;
      if (i !== sides - 1 || sides < 4) g.add(s);
    }
  }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.35, sides, 1, true), MAT.beam);
  ring.rotation.y = Math.PI / sides; ring.position.y = platform + h - 0.2;
  g.add(ring);
  const rr = roof((r + 1.2) * 2, (r + 1.2) * 2, r * 0.62 + 0.7, 'cuanjian', roofMat, { sides, lift: 1.25, p: 1.8 });
  rr.rotation.y = 0;
  rr.position.y = platform + h;
  g.add(rr);
  if (plaque) addPlaque(g, plaque, { y: platform + h - 0.62, z: r * Math.cos(Math.PI / sides) + 0.12, width: 0.7 * [...plaque].length + 0.5 });
  g.userData.top = platform + h + r * 0.62 + 0.7;
  return g;
}

// ---------------------------------------------------------------- walls & gates
// Wall along a polyline in the parent's coordinates. Gaps can be given as [segmentIndex, t0, t1].
export function wall(points, { h = 3, t = 0.5, mat = MAT.wall, base = MAT.tiger, baseH = 0.8, cap = MAT.tile, gaps = [], capped = true, louchuang = 0 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    let pieces = [[0, 1]];
    for (const [si, a, b] of gaps) if (si === i) pieces = pieces.flatMap(([p, q]) => {
      const out = []; if (a > p) out.push([p, Math.min(a, q)]); if (b < q) out.push([Math.max(b, p), q]); return out;
    });
    for (const [p, q] of pieces) {
      const l = (q - p) * len; if (l < 0.05) continue;
      const mid = (p + q) / 2;
      const cx = x0 + (x1 - x0) * mid, cz = z0 + (z1 - z0) * mid;
      const seg = new THREE.Group();
      seg.add(at(box(l, h - baseH, t, mat), 0, baseH + (h - baseH) / 2, 0));
      if (baseH > 0) seg.add(at(box(l + 0.02, baseH, t + 0.06, base), 0, baseH / 2, 0));
      if (capped) {
        const c = roof(l + 0.3, t + 0.7, 0.35, 'yingshan', cap, { p: 1.2, overhang: 0.0, gableMat: mat, detail: false });
        c.position.y = h; seg.add(c);
      }
      if (louchuang && l > 4 && mat === MAT.wall) {
        const n = Math.floor(l / louchuang);
        for (let k = 0; k < n; k++) {
          const x = -l / 2 + (k + 0.5) * (l / n), lm = MAT.louchuang[(i + k) % 4];
          for (const sd of [-1, 1]) {
            const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), lm);
            pane.position.set(x, baseH + (h - baseH) * 0.55, sd * (t / 2 + 0.01)); pane.rotation.y = sd < 0 ? Math.PI : 0;
            seg.add(pane);
          }
        }
      }
      seg.position.set(cx, 0, cz); seg.rotation.y = -ang;
      g.add(seg);
    }
  }
  return g;
}

// Rectangular enclosure with a gate gap centred on the front (+z) side.
export function enclosure(w, d, { gateW = 3.2, gateSide = 'front', ...wallOpts } = {}) {
  const a = w / 2, b = d / 2;
  const pts = [[-a, b], [-a, -b], [a, -b], [a, b], [-a, b]];
  const gw = gateW / w;
  const gaps = gateSide === 'front' ? [[3, 0.5 - gw / 2, 0.5 + gw / 2]] : [];
  return wall(pts, { gaps, louchuang: 6, ...wallOpts });
}

// 垂花门 / small gate house.
export function gateHouse({ w = 3.6, d = 2.6, h = 3.4, plaque, roofMat = MAT.tile, colMat = MAT.column } = {}) {
  const g = new THREE.Group();
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(at(cyl(0.15, h, colMat), x, h / 2, z));
  g.add(at(box(w, 0.4, 0.25, MAT.beam), 0, h - 0.2, d / 2));
  g.add(at(box(w, 0.4, 0.25, MAT.beam), 0, h - 0.2, -d / 2));
  for (const x of [-w / 2 + 0.35, w / 2 - 0.35]) g.add(at(cyl(0.12, 0.5, MAT.gold, 8), x, h - 0.6, d / 2 + 0.05)); // 垂柱
  const r = roof(w + 2, d + 2, 1.5, 'juanpeng', roofMat, { overhang: 1, gableMat: MAT.brick });
  r.position.y = h; g.add(r);
  if (plaque) addPlaque(g, plaque, { y: h - 0.7, z: d / 2 + 0.15, width: Math.min(w - 0.4, 0.62 * [...plaque].length + 0.4) });
  // door frame, two leaves standing open with 门钉, four 门簪 on the lintel, 抱鼓石 at the jambs
  const dw = Math.min(w - 0.6, 2.4), dh = h - 1.0, leafMat = colMat === MAT.columnGreen ? MAT.frameGreen : MAT.frameRed;
  g.add(at(box(dw + 0.3, 0.22, 0.3, leafMat), 0, dh + 0.11, 0)); // 中槛
  for (const sx of [-1, 1]) g.add(at(box(0.16, dh, 0.3, leafMat), sx * (dw / 2 + 0.08), dh / 2, 0));
  for (let k = 0; k < 4; k++) {
    const zan = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 6), MAT.gold); zan.rotation.x = Math.PI / 2;
    zan.position.set(-dw * 0.36 + k * dw * 0.24, dh + 0.11, 0.25); g.add(zan);
  }
  const studs = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) studs.push(new THREE.SphereGeometry(0.035, 6, 4).translate(-dw / 4 + 0.18 + c * (dw / 2 - 0.36) / 2, 0.5 + r * (dh - 1) / 4, 0.04).toNonIndexed());
  const studGeo = mergeGeometries(studs);
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * dw / 2, 0, -0.02);
    const leaf = new THREE.Group(); leaf.position.x = -sx * dw / 4;
    leaf.add(at(box(dw / 2 - 0.02, dh - 0.02, 0.07, leafMat), 0, dh / 2, 0));
    leaf.add(at(new THREE.Mesh(studGeo, MAT.doorStud), 0, 0, 0));
    piv.add(leaf); piv.rotation.y = -sx * 1.35; g.add(piv);
    // 抱鼓石
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16), MAT.stone); drum.rotation.z = Math.PI / 2; drum.rotation.y = Math.PI / 2;
    drum.position.set(sx * (dw / 2 + 0.2), 0.95, 0.42); g.add(drum);
    g.add(at(box(0.26, 0.55, 0.9, MAT.stone), sx * (dw / 2 + 0.2), 0.28, 0.32));
  }
  return g;
}

// 月洞门: a short wall section with a circular opening.
export function moonGate({ w = 6, h = 3, r = 1.3, t = 0.5, mat = MAT.wall } = {}) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  const hole = new THREE.Path(); hole.absarc(0, r + 0.05, r, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 32 });
  geo.translate(0, 0, -t / 2);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const c = roof(w + 0.3, t + 1.0, 0.45, 'yingshan', MAT.tile, { p: 1.2, overhang: 0, gableMat: mat });
  c.position.y = h; g.add(c);
  return g;
}

// 游廊: covered corridor along a polyline.
export function corridor(points, { w = 2.4, h = 2.8, colMat = MAT.columnGreen, roofMat = MAT.tile } = {}) {  // 绿柱灰顶的回廊 (86 版北京大观园)
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const seg = new THREE.Group();
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= n; k++) for (const s of [-1, 1]) seg.add(at(cyl(0.12, h, colMat, 8), -len / 2 + (k / n) * len, h / 2 + 0.3, s * w / 2));
    seg.add(at(box(len + 0.3, 0.3, w + 0.4, MAT.stone), 0, 0.15, 0));
    for (const s of [-1, 1]) {
      seg.add(at(box(len, 0.3, 0.2, MAT.beam), 0, h + 0.15, s * w / 2));
      seg.add(at(box(len, 0.08, 0.35, MAT.redRail), 0, 0.85, s * w / 2)); // 坐凳栏杆
      seg.add(at(box(len, 0.25, 0.06, MAT.redRail), 0, 0.6, s * w / 2));
      for (let k = 0; k < n; k++) {
        const hl = new THREE.Mesh(new THREE.PlaneGeometry(len / n - 0.24, 0.3), MAT.hangLattice);
        hl.position.set(-len / 2 + (k + 0.5) * (len / n), h - 0.15, s * w / 2); seg.add(hl);
      }
    }
    const r = roof(len + 0.6, w + 1.6, 1.1, 'juanpeng', roofMat, { overhang: 0.8, gableMat: MAT.wall, eaveTiles: false });
    r.position.y = h + 0.3;
    r.children.filter((c) => c.geometry?.type === 'ShapeGeometry').forEach((c) => (c.visible = false));
    seg.add(r);
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -ang;
    g.add(seg);
  }
  return g;
}

// White stone balustrade along a polyline.
export function balustrade(points, { h = 0.9, mat = MAT.marble } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const seg = new THREE.Group();
    seg.add(at(box(len, 0.12, 0.18, mat), 0, h - 0.1, 0));
    seg.add(at(box(len, 0.35, 0.12, mat), 0, 0.25, 0));
    const n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) seg.add(at(box(0.2, h + 0.15, 0.2, mat), -len / 2 + (k / n) * len, (h + 0.15) / 2, 0));
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -ang;
    g.add(seg);
  }
  return g;
}

// Stone arch bridge spanning `span` along x.
export function archBridge({ span = 12, w = 3.6, rise = 2.4, mat = MAT.stone, rail = MAT.marble } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const N = 24;
  s.moveTo(-span / 2 - 2, -1.5);
  for (let i = 0; i <= N; i++) { const t = i / N; const x = -span / 2 - 2 + t * (span + 4); s.lineTo(x, rise * Math.sin(t * Math.PI) * 0.9 + 0.3); }
  s.lineTo(span / 2 + 2, -1.5);
  const hole = new THREE.Path();
  hole.moveTo(-span * 0.32, -1.6);
  for (let i = 0; i <= N; i++) { const t = i / N; hole.lineTo(-span * 0.32 + t * span * 0.64, -1.6 + Math.sin(t * Math.PI) * (rise + 0.6)); }
  hole.lineTo(span * 0.32, -1.6);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  g.add(new THREE.Mesh(geo, mat));
  for (const sz of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([-span / 2 - 2 + t * (span + 4), sz * (w / 2 - 0.15)]); }
    for (let i = 0; i < 8; i++) {
      const [xa, za] = pts[i], [xb] = pts[i + 1];
      const ya = rise * Math.sin(((xa + span / 2 + 2) / (span + 4)) * Math.PI) * 0.9 + 0.3;
      const yb = rise * Math.sin(((xb + span / 2 + 2) / (span + 4)) * Math.PI) * 0.9 + 0.3;
      const seg = box(Math.hypot(xb - xa, yb - ya), 0.6, 0.18, rail);
      seg.position.set((xa + xb) / 2, (ya + yb) / 2 + 0.35, za);
      seg.rotation.z = Math.atan2(yb - ya, xb - xa);
      g.add(seg);
    }
  }
  return g;
}

// 折带朱栏板桥: zigzag flat plank bridge with red railings, through points.
export function zigzagBridge(points, { w = 1.8, y = 0.5, rail = MAT.redRail, deck = MAT.wood } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const seg = new THREE.Group();
    seg.add(at(box(len + w, 0.2, w, deck), 0, y, 0));
    for (const s of [-1, 1]) {
      seg.add(at(box(len + w, 0.08, 0.08, rail), 0, y + 0.9, s * w / 2));
      const n = Math.max(1, Math.round(len / 1.2));
      for (let k = 0; k <= n; k++) seg.add(at(box(0.08, 0.9, 0.08, rail), -len / 2 + (k / n) * len, y + 0.45, s * w / 2));
    }
    const nPost = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= nPost; k++) seg.add(at(cyl(0.1, 2.2, MAT.dark, 6), -len / 2 + (k / nPost) * len, y - 1.0, 0));
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -ang;
    g.add(seg);
  }
  return g;
}

// Bamboo/wicker fence (青篱) along a polyline.
export function fence(points, { h = 1.3, mat = MAT.bamboo } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const seg = new THREE.Group();
    const n = Math.round(len / 0.35);
    const geo = new THREE.CylinderGeometry(0.04, 0.05, h, 4);
    for (let k = 0; k <= n; k++) seg.add(at(new THREE.Mesh(geo, mat), -len / 2 + (k / n) * len, h / 2, 0));
    for (const yy of [0.4, 0.95]) seg.add(at(box(len, 0.06, 0.06, mat), 0, yy, 0));
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -ang;
    g.add(seg);
  }
  return g;
}

// Simple rock made from a jittered icosahedron (fallback & filler for AI rocks).
export function rock(size = 1, seed = 1, mat) { return taihuRock(size, seed, { mat }); }
