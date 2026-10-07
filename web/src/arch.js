// Procedural kit of Qing-style garden architecture. Every builder returns a THREE.Group
// whose local origin is the ground centre of the structure and whose front faces +z.
import * as THREE from 'three';
import * as T from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

export const MAT = {
  tile: std({ map: T.tileTexture(), side: THREE.DoubleSide, roughness: 0.7 }),
  tileGreen: std({ map: T.tileTexture('#3e5a46'), side: THREE.DoubleSide, roughness: 0.6 }),
  tileGold: std({ map: T.tileTexture('#b8892c'), side: THREE.DoubleSide, roughness: 0.45, metalness: 0.15 }),
  thatch: std({ map: T.thatchTexture(), side: THREE.DoubleSide }),
  ridge: std({ color: '#3b3f44' }),
  column: std({ color: '#8e2b20', roughness: 0.6 }),
  columnPlain: std({ color: '#6b4a32', roughness: 0.8 }), // 并无朱粉涂饰
  columnGreen: std({ color: '#3d5c3e', roughness: 0.7 }),
  beam: std({ map: T.beamTexture() }),
  beamPlain: std({ color: '#5a4030' }),
  lattice: std({ map: T.latticeTexture(), side: THREE.DoubleSide }),
  latticeGreen: std({ map: T.latticeTexture('#2f4a35', '#f1ecd9'), side: THREE.DoubleSide }),
  wall: std({ color: '#f1eee6' }),
  wallMud: std({ color: '#b7975c' }),
  brick: std({ map: T.brickTexture() }),
  tiger: std({ map: T.tigerStoneTexture() }),
  stone: std({ color: '#cfcabd', roughness: 0.95 }),
  marble: std({ color: '#ecebe4', roughness: 0.5 }),
  wood: std({ color: '#6e4a2c' }),
  redRail: std({ color: '#a33a28', roughness: 0.6 }),
  bamboo: std({ color: '#8a9a50' }),
  gold: std({ color: '#c9a04a', metalness: 0.4, roughness: 0.4 }),
  dark: std({ color: '#2a2622' }),
};

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
  if (type === 'xieshan' || type === 'yingshan' || type === 'wudian') {
    const rl = type === 'wudian' ? Math.max(0.5, w - d) : type === 'xieshan' ? w - 1.1 * (d / 2) : w;
    grp.add(at(box(rl, 0.45, 0.4, MAT.ridge), 0, H + 0.15, 0));
    for (const sx of [-1, 1]) grp.add(at(box(0.35, 0.9, 0.5, MAT.ridge), sx * rl / 2, H + 0.4, 0));
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

// ---------------------------------------------------------------- halls
// A timber-frame hall. w = width (along x), d = depth, h = column height.
export function hall({
  w = 12, d = 7, h = 3.6, bays = 3, roofType = 'xieshan', roofMat = MAT.tile,
  colMat = MAT.column, beamMat = MAT.beam, latticeMat = MAT.lattice, wallMat = MAT.wall,
  platform = 0.6, platMat = MAT.stone, frontOpen = false, backWall = true, sideWalls = true,
  corridor = 0, roofH, plaque, plaqueOpts, couplet,
} = {}) {
  const g = new THREE.Group();
  const W = w + corridor * 2, D = d + corridor * 2;
  g.add(at(box(W + 1.2, platform, D + 1.2, platMat), 0, platform / 2, 0));
  const y0 = platform;
  // columns: perimeter grid
  const bw = w / bays;
  const colR = Math.max(0.16, h * 0.05);
  const xs = []; for (let i = 0; i <= bays; i++) xs.push(-w / 2 + i * bw);
  if (corridor) { xs.unshift(-W / 2); xs.push(W / 2); }
  const zs = corridor ? [-D / 2, -d / 2, d / 2, D / 2] : [-d / 2, d / 2];
  for (const x of xs) for (const z of zs) {
    if (!corridor && Math.abs(z) < d / 2 - 0.01) continue;
    g.add(at(cyl(colR, h, colMat), x, y0 + h / 2, z));
  }
  // beams (额枋) around top
  const bh = 0.45;
  for (const z of [-D / 2, D / 2]) g.add(at(box(W, bh, 0.3, beamMat), 0, y0 + h - bh / 2, z));
  for (const x of [-W / 2, W / 2]) g.add(at(box(0.3, bh, D, beamMat), x, y0 + h - bh / 2, 0));
  // walls / lattice
  const wh = h - bh;
  if (backWall) g.add(at(box(w, wh, 0.3, wallMat), 0, y0 + wh / 2, -d / 2));
  if (sideWalls) for (const sx of [-1, 1]) g.add(at(box(0.3, wh, d, wallMat), sx * w / 2, y0 + wh / 2, 0));
  if (!frontOpen) {
    for (let i = 0; i < bays; i++) {
      const cx = -w / 2 + (i + 0.5) * bw;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(bw - colR * 2, wh), latticeMat);
      panel.position.set(cx, y0 + wh / 2, d / 2 - 0.05);
      g.add(panel);
    }
  }
  // roof
  const oh = 1.3;
  const rH = roofH ?? Math.max(2.2, D * 0.42);
  const r = roof(W + oh * 2, D + oh * 2, rH, roofType, roofMat, { overhang: oh });
  r.position.y = y0 + h;
  g.add(r);
  if (plaque) addPlaque(g, plaque, { y: y0 + h - bh - 0.55, z: D / 2 + 0.25, width: Math.min(bw * 0.95, 0.75 * [...plaque].length + 0.6), ...plaqueOpts });
  if (couplet) addCouplet(g, couplet, { y: y0, h, x: bw / 2 * (bays > 1 ? 1 : 0.6), z: D / 2 + colR + 0.04 });
  g.userData.top = y0 + h + rH;
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
export function lou({ w = 14, d = 8, h1 = 3.8, h2 = 3.4, bays = 5, roofType = 'xieshan', plaque, roofMat = MAT.tile } = {}) {
  const g = new THREE.Group();
  const low = hall({ w, d, h: h1, bays, roofType: 'none', roofMat });
  // replace the lower roof with a skirt roof (腰檐)
  low.children = low.children.filter((c) => !(c.isGroup));
  g.add(low);
  const skirt = roof(w + 3.2, d + 3.2, 1.2, 'wudian', roofMat, { p: 1.3 });
  skirt.position.y = 0.6 + h1;
  // punch the centre: skirt roof is cosmetic, upper storey sits above
  g.add(skirt);
  const up = hall({ w: w - 1, d: d - 1, h: h2, bays, roofType, roofMat, platform: 0.3, platMat: MAT.wood, plaque });
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
  const rr = roof((r + 1.2) * 2, (r + 1.2) * 2, r * 0.62 + 0.7, 'cuanjian', roofMat, { sides, lift: 0.8, p: 1.8 });
  rr.rotation.y = 0;
  rr.position.y = platform + h;
  g.add(rr);
  if (plaque) addPlaque(g, plaque, { y: platform + h - 0.62, z: r * Math.cos(Math.PI / sides) + 0.12, width: 0.7 * [...plaque].length + 0.5 });
  g.userData.top = platform + h + r * 0.62 + 0.7;
  return g;
}

// ---------------------------------------------------------------- walls & gates
// Wall along a polyline in the parent's coordinates. Gaps can be given as [segmentIndex, t0, t1].
export function wall(points, { h = 3, t = 0.5, mat = MAT.wall, base = MAT.tiger, baseH = 0.8, cap = MAT.tile, gaps = [], capped = true } = {}) {
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
        const c = roof(l + 0.3, t + 0.7, 0.35, 'yingshan', cap, { p: 1.2, overhang: 0.0, gableMat: mat });
        c.position.y = h; seg.add(c);
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
  return wall(pts, { gaps, ...wallOpts });
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
export function corridor(points, { w = 2.4, h = 2.8, colMat = MAT.column, roofMat = MAT.tile } = {}) {
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
    }
    const r = roof(len + 0.6, w + 1.6, 1.1, 'juanpeng', roofMat, { overhang: 0.8, gableMat: MAT.wall });
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
export function rock(size = 1, seed = 1, mat = MAT.stone) {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const p = geo.attributes.position;
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < p.count; i++) {
    const k = 0.7 + rnd() * 0.55;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.3, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}
