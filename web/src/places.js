// Builds every scenic spot of 大观园 from layout.json using the procedural kit.
// Returns the scene group plus side-channel requests for flora, AI props, colliders and labels.
import * as THREE from 'three';
import L from './layout.json';
import * as A from './arch.js';
import { MAT } from './arch.js';
import { heightAt, addFlat, GROUND } from './terrain.js';
import * as T from './textures.js';

export const flora = [];   // {type, x, z, n, r} or {type, pts:[[x,z]...]}
export const props = [];   // {model, x, y, z, rot, height}
export const labels = [];  // {place, pos: Vector3}
const colliderOwners = []; // objects whose userData marks collision geometry

const P = Object.fromEntries(L.places.map((p) => [p.id, p]));

// Register terrain flattening for every footprint BEFORE the terrain mesh is built.
const FOOT = {
  zhengmen: [14, 8], xiaoxiang: null, daoxiang: null, hengwu: null, yihong: null, qiushuang: null, liaofeng: null,
  zhengdian: [40, 30], paifang: [10, 5], longcui: [12, 12], tubi: [10, 8], luxue: [10, 7], houmen: [5, 4], huajing: [0, 0],
};
const levels = {};
export function registerFlats() {
  for (const p of L.places) {
    let f = FOOT[p.id];
    if (f === undefined) continue;
    if (f === null) f = [p.w / 2 + 2, p.d / 2 + 2];
    if (!f[0]) continue;
    levels[p.id] = addFlat(p.x, p.z, f[0], f[1], -p.rot);
  }
  levels.zhengdian = addFlat(P.zhengdian.x, P.zhengdian.z, 40, 30, 0, GROUND + 0.6);
}

// Helpers -------------------------------------------------------------------
function place(obj, x, z, rot = 0, y) {
  obj.position.set(x, y ?? heightAt(x, z), z);
  obj.rotation.y = rot;
  return obj;
}
// local (x,z) of a group at (ox,oz,rot) -> world
function toWorld(p, lx, lz) {
  const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
}
function addFlora(p, type, lx, lz, n, r) { const [x, z] = toWorld(p, lx, lz); flora.push({ type, x, z, n, r }); }
function addProp(p, model, lx, lz, height, rot = 0, y) {
  const [x, z] = toWorld(p, lx, lz);
  props.push({ model, x, z, y: y ?? heightAt(x, z), rot: (p.rot || 0) + rot, height, place: p.id });
}
function label(p, top) { labels.push({ place: p, pos: new THREE.Vector3(p.x, (levels[p.id] ?? heightAt(p.x, p.z)) + top, p.z) }); }
function collide(obj) { colliderOwners.push(obj); return obj; }

// White stone tablet with an inscription (镜面白石 / 石碣).
function inscription(text, w = 2.2) {
  const t = T.plaqueTexture(text, { bg: '#e9e6dc', fg: '#3a3a3a' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / t.userData.aspect), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  m.userData.keepSeparate = true;
  return m;
}

// Wine flag (酒幌) on a bamboo pole.
function wineFlag(text) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 8, 6), MAT.bamboo);
  pole.position.y = 4; pole.rotation.z = 0.12; g.add(pole);
  const c = document.createElement('canvas'); c.width = 128; c.height = 360;
  const x = c.getContext('2d');
  x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 128, 360);
  x.fillStyle = '#2a4a8a'; x.fillRect(0, 0, 128, 18); x.fillRect(0, 342, 128, 18);
  x.fillStyle = '#20202a'; x.font = 'bold 72px "Kaiti SC","STKaiti",serif'; x.textAlign = 'center';
  [...text].forEach((ch, i) => x.fillText(ch, 64, 90 + i * 80));
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.5), new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide }));
  flag.position.set(0.9, 6.3, 0); flag.userData.keepSeparate = true; g.add(flag);
  return g;
}

// Builders per place -----------------------------------------------------------
const B = {};

B.zhengmen = (p, g) => {
  // 正门五间, 筒瓦泥鳅脊 (rounded ridge -> 卷棚), 并无朱粉涂饰, 白石台矶.
  const gate = A.hall({ w: 17, d: 6.5, h: 4.2, bays: 5, roofType: 'juanpeng', roofH: 2.3, colMat: MAT.columnPlain, beamMat: MAT.beamPlain,
    latticeMat: MAT.lattice, platMat: MAT.marble, platform: 0.9, plaque: p.plaque, frontOpen: false, backWall: false, sideWalls: true });
  // open the central bay as the passage
  gate.children = gate.children.filter((c) => !(c.geometry?.type === 'PlaneGeometry' && Math.abs(c.position.x) < 1 && c.material === MAT.lattice));
  g.add(gate);
  addProp(p, 'shishi', -5, 6.2, 2.4, 0);
  addProp(p, 'shishi', 5, 6.2, 2.4, 0);
  label(p, 12);
};

B.houmen = (p, g) => { g.add(A.gateHouse({ w: 4, d: 3, plaque: '' })); label(p, 7); };

B.cuizhang = (p, g) => {
  addProp(p, 'cuizhang', 0, 0, 9, 0);
  const s = inscription('曲徑通幽處', 3.4); s.position.set(-1.2, 5.6, 9.5); g.add(s);
  label(p, 14);
};

B.qinfangting = (p, g) => {
  // 白石为栏，环抱池沿，石桥三港 — a three-span flat stone bridge carrying the pavilion.
  const deckY = 1.6, len = 26, w = 6;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, len), MAT.stone);
  deck.position.y = deckY; g.add(deck);
  for (const z of [-len / 2 + 3, -4.5, 4.5, len / 2 - 3]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, 1.6), MAT.stone);
    pier.position.set(0, deckY - 2, z); g.add(pier);
  }
  for (const sx of [-1, 1]) {
    const b = A.balustrade([[sx * (w / 2 - 0.2), -len / 2], [sx * (w / 2 - 0.2), len / 2]]);
    b.position.y = deckY + 0.25; g.add(b);
  }
  const pav = A.pavilion({ n: 4, r: 2.9, h: 3.4, platform: 0.3, plaque: p.plaque });
  pav.position.y = deckY + 0.25; g.add(pav);
  A.addCouplet(pav, p.couplet, { y: 0.3, h: 3.4, x: 2.05, z: 2.05 + 0.2 });
  label(p, 13);
};

B.xiaoxiang = (p, g, lv) => {
  const { w, d } = p;
  collide(g.add(A.enclosure(w, d, { h: 3.2, gateW: 3.4 })) && g.children.at(-1));
  const gh = A.gateHouse({ w: 3.4, d: 2.4, plaque: '瀟湘館', colMat: MAT.columnGreen });
  gh.position.z = d / 2; g.add(gh);
  // 一明两暗 small three-bay hall
  const main = A.hall({ w: 10, d: 6, h: 3.3, bays: 3, roofType: 'juanpeng', colMat: MAT.columnGreen, latticeMat: MAT.latticeGreen, plaque: p.plaque, couplet: p.couplet,
    hangMat: MAT.hangLatticeGreen, sillMat: MAT.wall });
  main.position.z = -3; g.add(collide(main));
  // 曲折游廊 from gate to hall
  g.add(A.corridor([[-1.5, d / 2 - 2], [-6, 9], [-6, 3], [-4, 1.2]], { colMat: MAT.columnGreen }));
  // 后院: two little 退步 rooms, pear + banana
  const back = A.hall({ w: 6, d: 4, h: 2.8, bays: 2, roofType: 'yingshan', colMat: MAT.columnGreen, latticeMat: MAT.latticeGreen, platform: 0.4,
    plaque: '梨花春雨', lanterns: false, hangMat: MAT.hangLatticeGreen }); // 第十八回所列四字匾之一，置于梨花后院（位置为推测）
  // 阶下石子漫成甬路
  const path = A.pavement(2.2, 12, MAT.pebble, 2.2); path.position.set(1.5, 0.04, d / 2 - 7.5); g.add(path);
  back.position.set(6, 0, -d / 2 + 4); g.add(collide(back));
  addFlora(p, 'pear', -7, -d / 2 + 5, 2, 2);
  addFlora(p, 'banana', -3, -d / 2 + 4, 3, 1.6);
  // the little spring channel "开沟仅尺许 … 盘旋竹下而出"
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, d - 4), new THREE.MeshStandardMaterial({ color: '#3f6f74', roughness: 0.2 }));
  ch.position.set(w / 2 - 2.5, 0.03, 0); g.add(ch);
  // 千百竿翠竹
  addFlora(p, 'bamboo', -9, 8, 220, 5);
  addFlora(p, 'bamboo', 9, 8, 200, 5);
  addFlora(p, 'bamboo', 0, d / 2 + 6, 260, 9);
  addFlora(p, 'bamboo', -w / 2 - 6, 0, 300, 7);
  addFlora(p, 'bamboo', w / 2 + 6, 0, 300, 7);
  addFlora(p, 'bamboo', 0, -d / 2 - 6, 260, 9);
  addProp(p, 'shizu', 5, 9, 1.8, 1);
  label(p, 11);
};

B.daoxiang = (p, g) => {
  const { w, d } = p;
  // 黄泥筑就矮墙，墙头皆用稻茎掩护
  collide(g.add(A.enclosure(w, d, { h: 1.9, t: 0.6, mat: MAT.wallMud, base: MAT.wallMud, baseH: 0, cap: MAT.thatch, gateW: 2.6 })) && g.children.at(-1));
  const hut = (x, z, ww, r = 0) => {
    const h = A.hall({ w: ww, d: 5.5, h: 2.7, bays: 3, roofType: 'thatch', roofMat: MAT.thatch, colMat: MAT.columnPlain, beamMat: MAT.beamPlain,
      wallMat: MAT.wallMud, latticeMat: A.MAT.lattice, platform: 0.3, platMat: MAT.wallMud, roofH: 2.8, rustic: true, steps: false });
    h.position.set(x, 0, z); h.rotation.y = r; g.add(collide(h)); return h;
  };
  const main = hut(0, -8, 11);
  A.addPlaque(main, '稻香村', { y: 2.3, z: 3.3, width: 2.6, bg: '#4a3a24', fg: '#e3d3a2' });
  hut(-12, -2, 7, Math.PI / 2);
  hut(12, 0, 7, -Math.PI / 2);
  // 两溜青篱
  g.add(A.fence([[-w / 2 - 3, d / 2 + 2], [-4, d / 2 + 3], [-2, d / 2 + 8]]));
  g.add(A.fence([[w / 2 + 3, d / 2 + 2], [4, d / 2 + 3], [2, d / 2 + 8]]));
  // 土井 + 桔槔
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.7, 12, 1, true), MAT.stone);
  const [wx, wz] = [w / 2 + 6, d / 2 + 4];
  well.position.set(wx, 0.35, wz); well.material.side = THREE.DoubleSide; g.add(well);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3, 6), MAT.wood); post.position.set(wx + 2, 1.5, wz); g.add(post);
  const sweep = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 6, 6), MAT.wood);
  sweep.position.set(wx + 1.2, 3, wz); sweep.rotation.z = 1.2; g.add(sweep);
  // 酒幌, 石碣
  const flag = wineFlag(p.plaque); flag.position.set(-w / 2 - 3, 0, d / 2 + 4); g.add(flag);
  addProp(p, 'bei', 6, d / 2 + 6, 2.2, 0);
  // 石碣 inscription (路旁有一石碣，亦为留题之备)
  const tx = T.coupletTexture('稻香村', { bg: '#8d8a80', fg: '#2b2a26', border: '#8d8a80' });
  const ins = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5 / tx.userData.aspect), new THREE.MeshStandardMaterial({ map: tx }));
  ins.userData.keepSeparate = true; ins.position.set(6, 1.35, d / 2 + 6.38); g.add(ins);
  // 鹅鸭鸡类 pen and a vegetable plot fence
  g.add(A.fence([[8, -4], [16, -4], [16, 6], [8, 6], [8, -4]], { h: 0.9 }));
  // 几百株杏花, 桑榆槿柘
  addFlora(p, 'apricot', 0, 0, 90, w * 0.9);
  addFlora(p, 'mulberry', -w / 2 - 8, 6, 10, 6);
  addFlora(p, 'mulberry', w / 2 + 8, 6, 10, 6);
  addFlora(p, 'crops', -30, 30, 300, 18);
  label(p, 9);
};

B.huajing = (p, g) => {
  // 荼蘼架 / 木香棚 (pergolas), 牡丹亭, 芍药圃, 蔷薇院, 芭蕉坞 along the path north of the village.
  const pergola = (x, z, len, rot, flower) => {
    const pg = new THREE.Group();
    for (let i = 0; i <= len / 2.5; i++) for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), MAT.bamboo);
      c.position.set(-len / 2 + i * 2.5, 1.3, s * 1.3); pg.add(c);
    }
    for (let i = 0; i <= len / 0.6; i++) {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.2), MAT.bamboo); sl.position.set(-len / 2 + i * 0.6, 2.62, 0); pg.add(sl);
    }
    const pos = place(pg, x, z, rot); pos.position.y = heightAt(x, z);
    flora.push({ type: flower, x, z, n: Math.round(len * 4), r: len / 2, onTop: 2.8, rot });
    return pg;
  };
  const root = new THREE.Group();
  root.add(pergola(-133, -14, 12, 0.3, 'tumi'));
  root.add(pergola(-131, -28, 10, -0.1, 'muxiang'));
  const pav = A.pavilion({ n: 6, r: 2.2, h: 3, plaque: '牡丹亭' });
  place(pav, -118, -38, 0.6); root.add(collide(pav));
  flora.push({ type: 'peony', x: -118, z: -38, n: 60, r: 7 });
  flora.push({ type: 'shaoyao', x: -138, z: -44, n: 80, r: 6 });
  const rose = A.wall([[-3, 4], [-3, -4], [5, -4], [5, 4]], { h: 2.2, t: 0.4, baseH: 0.4 });
  place(rose, -116, -56, 0.3); root.add(rose);
  flora.push({ type: 'rose', x: -115, z: -56, n: 70, r: 3.5 });
  flora.push({ type: 'banana', x: -108, z: -64, n: 14, r: 5 });
  // this group is placed in world coords directly
  g.userData.world = root;
  labels.push({ place: p, pos: new THREE.Vector3(p.x, heightAt(p.x, p.z) + 8, p.z) });
};

B.liaoting = (p, g) => {
  // 港洞: the stream runs through a cave in the rockery (AI model with a cave mouth), 萝薜倒垂.
  props.push({ model: 'cuizhang', x: p.x, z: p.z, y: -0.8, rot: -Math.PI / 2 + 0.25, height: 8.5, place: p.id });
  const pl = A.addPlaque(g, p.plaque, { y: 4.6, z: 0, x: 0, width: 3.2 });
  pl.rotation.y = Math.PI / 2 - 0.3; pl.position.set(14, 4.6, 0);
  flora.push({ type: 'vines', x: p.x, z: p.z, n: 50, r: 6, onTop: 5 });
  // 两行垂柳，杂着桃杏
  flora.push({ type: 'willow', pts: L.water.streams[1].pts.slice(1, 5), n: 16, off: 6 });
  flora.push({ type: 'peach', pts: L.water.streams[1].pts.slice(1, 5), n: 12, off: 9 });
  flora.push({ type: 'apricot', pts: L.water.streams[1].pts.slice(2, 5), n: 8, off: 11 });
  flora.push({ type: 'petals', pts: L.water.streams[1].pts.slice(1, 5), n: 400, off: 2.5 });
  label(p, 11);
};

B.hengwu = (p, g) => {
  const { w, d } = p;
  // 一色水磨砖墙，清瓦花堵
  collide(g.add(A.enclosure(w, d, { h: 3.4, mat: MAT.brick, base: MAT.brick, baseH: 0, gateW: 3.4 })) && g.children.at(-1));
  const gh = A.gateHouse({ w: 3.4, d: 2.4, plaque: '蘅蕪苑' }); gh.position.z = d / 2; g.add(gh);
  // 迎面突出插天的大玲珑山石 … 竟把里面所有房屋悉皆遮住
  addProp(p, 'linglong', 0, d / 2 - 5, 8.5, 0);
  addProp(p, 'shizu', -4, d / 2 - 6, 3, 0.7);
  addProp(p, 'shizu', 4, d / 2 - 7, 2.6, 2.1);
  // 五间清厦连着卷棚，四面出廊，绿窗油壁
  const main = A.hall({ w: 15, d: 7, h: 3.5, bays: 5, roofType: 'juanpeng', corridor: 1.4, latticeMat: MAT.latticeGreen, colMat: MAT.columnGreen,
    plaque: p.plaque, couplet: p.couplet });
  main.position.z = -d / 2 + 7; g.add(collide(main));
  g.add(A.pavement(w - 2, d - 2, MAT.paving));
  // 超手游廊 on both sides
  g.add(A.corridor([[-w / 2 + 2.2, d / 2 - 3], [-w / 2 + 2.2, -d / 2 + 9]]));
  g.add(A.corridor([[w / 2 - 2.2, d / 2 - 3], [w / 2 - 2.2, -d / 2 + 9]]));
  // 异草: vines everywhere, 一株花木也无
  flora.push({ type: 'vines', x: p.x, z: p.z + 3, n: 160, r: 12 });
  label(p, 12);
};

B.zhengdian = (p, g) => {
  // 第十七回：崇阁巍峨，层楼高起，面面琳宫合抱，迢迢复道萦纡，青松拂檐，玉栏绕砌，金辉兽面，彩焕螭头。
  // 第十八回：正殿匾"顾恩思义"及联；正楼曰大观楼，东面飞楼曰缀锦阁，西面斜楼曰含芳阁；月台。
  // 月台 (marble terrace) in front of the main hall
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(34, 1.4, 14), MAT.marble);
  terrace.position.set(0, 0.7, 13); g.add(terrace);
  const bal = A.balustrade([[-3, 20], [-17, 20], [-17, 6], [17, 6], [17, 20], [3, 20]]); bal.position.y = 1.4; g.add(bal);
  for (const sx of [-1, 1]) { // 两陛: side stairs
    const st = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 3), MAT.marble); st.position.set(sx * 11, 0.35, 21.5); g.add(st);
  }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 3), MAT.marble); ramp.position.set(0, 0.35, 21.5); g.add(ramp);
  // 正殿 · 顾恩思义 — seven bays, 斗拱, green glazed tiles
  const hallMain = A.hall({ w: 26, d: 12, h: 5.2, bays: 7, roofType: 'xieshan', roofMat: MAT.tileGreen, dougong: true,
    platform: 1.4, platMat: MAT.marble, plaque: '顧恩思義', plaqueOpts: { width: 4.4 }, lanterns: 'palace', roofH: 5.2,
    couplet: ['天地啟宏慈赤子蒼頭同感戴', '古今垂曠典九州萬國被恩榮'] });
  hallMain.position.z = 0; g.add(collide(hallMain));
  // 大观楼 behind, flanked by 缀锦阁 (east) and 含芳阁 (west)
  const main = A.lou({ w: 22, d: 10, h1: 4.6, h2: 4.0, bays: 7, roofType: 'xieshan', roofMat: MAT.tileGreen, plaque: '大觀樓' });
  main.position.set(0, 0, -22); g.add(collide(main));
  const east = A.lou({ w: 10, d: 7, h1: 3.8, h2: 3.4, bays: 3, roofType: 'xieshan', roofMat: MAT.tileGreen, plaque: '綴錦閣' });
  east.position.set(25, 0, -16); east.rotation.y = -Math.PI / 2; g.add(collide(east));
  const west = A.lou({ w: 10, d: 7, h1: 3.8, h2: 3.4, bays: 3, roofType: 'xieshan', roofMat: MAT.tileGreen, plaque: '含芳閣' });
  west.position.set(-25, 0, -16); west.rotation.y = Math.PI / 2; g.add(collide(west));
  // 复道萦纡: corridors tie hall, tower and side pavilions together
  g.add(A.corridor([[-13.5, -2], [-21, -2], [-21, -11]]));
  g.add(A.corridor([[13.5, -2], [21, -2], [21, -11]]));
  g.add(A.corridor([[-25, -21], [-25, -26], [-11, -26]]));
  g.add(A.corridor([[25, -21], [25, -26], [11, -26]]));
  g.add(A.corridor([[-17, 8], [-26, 8], [-26, 22], [-12, 24]]));
  g.add(A.corridor([[17, 8], [26, 8], [26, 22], [12, 24]]));
  // 东西配殿
  for (const sx of [-1, 1]) {
    const side = A.hall({ w: 12, d: 6, h: 3.8, bays: 3, roofType: 'xieshan', roofMat: MAT.tileGreen, lanterns: 'palace' });
    side.position.set(sx * 31, 0, 14); side.rotation.y = -sx * Math.PI / 2; g.add(collide(side));
  }
  addProp(p, 'ding', 0, 27, 2.6, 0);
  addProp(p, 'shishi', -4.5, 24.5, 2.4, 0);
  addProp(p, 'shishi', 4.5, 24.5, 2.4, 0);
  // 青松拂檐
  addFlora(p, 'pine', -36, -4, 8, 6);
  addFlora(p, 'pine', 36, -4, 8, 6);
  addFlora(p, 'pine', 0, -32, 8, 14);
  { const pv = A.pavement(52, 30, MAT.paving, 3); pv.position.set(0, 0.04, 8); g.add(pv); }
  label(p, 24);
};

B.paifang = (p, g) => {
  addProp(p, 'paifang', 0, 0, 9.5, 0);
  const pl = A.addPlaque(g, '省親別墅', { y: 6.1, z: 0.65, width: 3.1, bg: '#1d3a5a' }); // 元妃命将'天仙宝境'换作'省亲别墅'（第十八回）
  pl.userData.paifangPlaque = true;
  label(p, 13);
};

B.qinfangzha = (p, g) => {
  const br = A.archBridge({ span: 11, w: 4.6, rise: 2.6 });
  br.position.y = 0.2; g.add(br);
  // sluice piers
  for (const sx of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 6), MAT.stone);
    pier.position.set(sx * 7.5, 0.4, 0); g.add(pier);
  }
  const s = inscription(p.plaque, 2.6); s.position.set(0, 3.9, 2.35); g.add(s);
  flora.push({ type: 'peach', x: p.x - 14, z: p.z + 10, n: 9, r: 8 });
  flora.push({ type: 'petals', x: p.x - 18, z: p.z + 6, n: 120, r: 9 });
  label(p, 10);
};

B.yihong = (p, g) => {
  const { w, d } = p;
  // 粉墙环护
  collide(g.add(A.enclosure(w, d, { h: 3.4, gateW: 3.6 })) && g.children.at(-1));
  const gh = A.gateHouse({ w: 3.6, d: 2.6, plaque: '怡紅院' }); gh.position.z = d / 2; g.add(gh);
  // 竹篱花障编就的月洞门 outside, among 碧桃
  const mg = A.moonGate({ w: 6, h: 3, r: 1.35, t: 0.35, mat: MAT.bamboo }); mg.position.z = d / 2 + 8; g.add(mg);
  addFlora(p, 'peach', -6, d / 2 + 10, 6, 5);
  addFlora(p, 'peach', 7, d / 2 + 10, 6, 5);
  // 两边都是游廊相接
  g.add(A.corridor([[-2.4, d / 2 - 1.5], [-w / 2 + 2, d / 2 - 1.5], [-w / 2 + 2, -2]]));
  g.add(A.corridor([[2.4, d / 2 - 1.5], [w / 2 - 2, d / 2 - 1.5], [w / 2 - 2, -2]]));
  // main hall with 抱厦
  const yard = A.pavement(w - 6, 12, MAT.paving); yard.position.z = 6; g.add(yard);
  const main = A.hall({ w: 17, d: 8, h: 3.8, bays: 5, roofType: 'xieshan', plaque: p.plaque, lanterns: 'palace' });
  main.position.z = -6; g.add(collide(main));
  const baosha = A.hall({ w: 7, d: 3.4, h: 3.3, bays: 3, roofType: 'juanpeng', frontOpen: true, backWall: false, sideWalls: false, platform: 0.6 });
  baosha.position.z = -6 + 4 + 1.6; g.add(baosha);
  // 一边种着数本芭蕉，那一边乃是一棵西府海棠
  addFlora(p, 'banana', -5.5, 4, 6, 2.2);
  addFlora(p, 'haitang', 5.5, 4.5, 1, 0.1);
  addProp(p, 'shizu', -1.5, 6.5, 1.8, 0.4);
  addProp(p, 'shizu', 2.5, 8.5, 1.3, 2.2);
  // 后院满架蔷薇、宝相
  flora.push({ type: 'rose', ...(([x, z]) => ({ x, z }))(toWorld(p, 0, -d / 2 + 3)), n: 60, r: 6 });
  addFlora(p, 'willow', -w / 2 - 4, 0, 4, 6); // 绿柳周垂
  addFlora(p, 'willow', w / 2 + 4, 0, 4, 6);
  label(p, 12);
};

B.qiushuang = (p, g) => {
  const { w, d } = p;
  collide(g.add(A.enclosure(w, d, { h: 3.2, gateW: 3.2 })) && g.children.at(-1));
  const gh = A.gateHouse({ w: 3.2, d: 2.4, plaque: '秋爽齋' }); gh.position.z = d / 2; g.add(gh);
  const main = A.hall({ w: 12, d: 7, h: 3.8, bays: 3, roofType: 'xieshan', plaque: '曉翠堂', couplet: p.couplet }); main.position.z = -5; g.add(collide(main));
  A.addPlaque(gh, '桐剪秋風', { y: 2.2, z: -1.35, width: 2.2 }).rotation.y = Math.PI; // 第十八回四字匾之一，梧桐所在（位置为推测）
  const yard = A.pavement(w - 2, d - 10, MAT.paving); yard.position.z = 4; g.add(yard);
  addFlora(p, 'wutong', -8, 3, 3, 3);
  addFlora(p, 'banana', 8, 4, 4, 2);
  label(p, 11);
};

B.liaofeng = (p, g) => {
  const { w, d } = p;
  collide(g.add(A.enclosure(w, d, { h: 3.2, gateW: 3 })) && g.children.at(-1));
  const gh = A.gateHouse({ w: 3, d: 2.2, plaque: '蓼風軒' }); gh.position.z = d / 2; g.add(gh);
  const main = A.hall({ w: 10, d: 6, h: 3.3, bays: 3, roofType: 'juanpeng', plaque: '暖香塢' }); main.position.z = -4; g.add(collide(main));
  addFlora(p, 'plum', 6, 4, 2, 2);
  label(p, 10);
};

B.zhuijin = (p, g) => {
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(9, 10.5, 2.4, 20), MAT.stone);
  isle.position.y = -0.4; isle.scale.z = 0.8; g.add(isle);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 8.8, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#6f8c42' }));
  grass.position.y = 0.85; grass.scale.z = 0.8; g.add(grass);
  const lou = A.lou({ w: 10, d: 7, h1: 3.4, h2: 3.2, bays: 3, roofType: 'xieshan', plaque: '綴錦樓' });
  lou.position.y = 0.3; g.add(collide(lou));
  const pl = A.addPlaque(g, p.plaque, { y: 2.3, z: 7.2, width: 2.4 });
  g.add(A.zigzagBridge([[0, 7], [3, 11], [-1, 15], [2, 19]]));
  flora.push({ type: 'lotus', x: p.x - 8, z: p.z + 10, n: 80, r: 12 });
  label(p, 14);
};

B.ouxiang = (p, g) => {
  // 盖在池中，四面有窗，左右有曲廊可通，亦是跨水接岸，后面又有曲折竹桥暗接
  const plat = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 10), MAT.stone); plat.position.y = 0.7; g.add(plat);
  for (const x of [-6, -2, 2, 6]) for (const z of [-4, 0, 4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), MAT.stone); c.position.set(x, -0.6, z); g.add(c); }
  const h = A.hall({ w: 10, d: 6.5, h: 3.4, bays: 3, roofType: 'xieshan', wallMat: MAT.lattice, platform: 0.3, plaque: p.plaque, couplet: p.couplet });
  h.position.y = 0.95; g.add(collide(h));
  const bal = A.balustrade([[-7, 5], [-7, -5], [7, -5], [7, 5], [-7, 5]], { mat: MAT.redRail, h: 0.8 }); bal.position.y = 0.95; g.add(bal);
  // 曲廊 to the east and west shores; 竹桥 behind towards 芦雪广
  const cl = A.corridor([[-7, 0], [-14, 0], [-17, 6], [-24, 7]]); cl.position.y = 0.6; g.add(cl);
  g.add(A.zigzagBridge([[3, 5], [5, 12], [-2, 18], [-8, 26], [-12, 33]], { deck: MAT.bamboo, rail: MAT.bamboo, y: 0.55 }));
  flora.push({ type: 'lotus', x: p.x + 14, z: p.z - 4, n: 220, r: 18 });
  flora.push({ type: 'osmanthus', x: p.x - 30, z: p.z + 10, n: 2, r: 2 }); // 那山坡下两棵桂花
  label(p, 10);
};

B.aojing = (p, g) => {
  const h = A.hall({ w: 8, d: 5, h: 2.9, bays: 3, roofType: 'juanpeng', plaque: p.plaque, platform: 0.5 });
  g.add(collide(h));
  const bal = A.fence([[-12, 4.5], [-5, 4.5]], { mat: MAT.bamboo }); g.add(bal);
  g.add(A.fence([[5, 4.5], [14, 4.5]], { mat: MAT.bamboo }));
  label(p, 8);
};

B.luxue = (p, g) => {
  // 一带几间，茅檐土壁，槿篱竹牖
  const h = A.hall({ w: 13, d: 5.5, h: 2.7, bays: 4, roofType: 'thatch', roofMat: MAT.thatch, wallMat: MAT.wallMud, colMat: MAT.columnPlain,
    beamMat: MAT.beamPlain, latticeMat: MAT.latticeGreen, platform: 0.4, platMat: MAT.wallMud, roofH: 2.6, rustic: true, steps: false });
  g.add(collide(h));
  A.addPlaque(h, p.plaque, { y: 2.2, z: 3.1, width: 2.4, bg: '#4a3a24', fg: '#e3d3a2' });
  A.addPlaque(h, '荻蘆夜雪', { y: 2.2, z: 3.1, x: 4.4, width: 2.0, bg: '#4a3a24', fg: '#e3d3a2' }); // 第十八回四字匾之一（位置为推测）
  g.add(A.fence([[-9, 6], [9, 6], [9, -5]], { mat: MAT.wood }));
  flora.push({ type: 'reed', x: p.x, z: p.z - 7, n: 260, r: 12 });
  flora.push({ type: 'reed', x: p.x + 10, z: p.z - 14, n: 160, r: 9 });
  label(p, 8);
};

B.longcui = (p, g) => {
  collide(g.add(A.enclosure(22, 20, { h: 3.2, gateW: 3 })) && g.children.at(-1));
  const gh = A.gateHouse({ w: 3, d: 2.2, plaque: p.plaque }); gh.position.z = 10; g.add(gh);
  const hall = A.hall({ w: 11, d: 7, h: 3.6, bays: 3, roofType: 'xieshan', plaque: '佛殿', lanterns: 'palace' }); hall.position.z = -4; g.add(collide(hall));
  const yard = A.pavement(18, 8, MAT.paving); yard.position.z = 5; g.add(yard);
  addFlora(p, 'plum', 0, 4, 14, 7); // 十数株红梅
  label(p, 11);
};

B.tubi = (p, g) => {
  // 山之高脊 … 敞厅；厅前平台
  const terr = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 7), MAT.stone); terr.position.set(0, 0.3, 6); g.add(terr);
  const h = A.hall({ w: 12, d: 7, h: 3.6, bays: 3, roofType: 'xieshan', frontOpen: true, sideWalls: false, plaque: '凸碧山莊' });
  g.add(collide(h));
  const bal = A.balustrade([[-8, 2.5], [-8, 9.5], [8, 9.5], [8, 2.5]]); bal.position.y = 0.6; g.add(bal);
  addFlora(p, 'pine', 0, -8, 6, 8);
  label(p, 10);
};

B.xingye = (p, g) => {
  const jetty = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 14), MAT.wood); deck.position.set(0, 0.6, 5); jetty.add(deck);
  for (let z = -1; z <= 11; z += 3) for (const x of [-1.8, 1.8]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), MAT.dark); c.position.set(x, -0.4, z); jetty.add(c); }
  g.add(jetty);
  const pav = A.pavilion({ n: 4, r: 2, h: 2.8, plaque: p.plaque, seat: false }); pav.position.set(0, GROUND - 0.2, -4); g.add(pav);
  // 两只棠木舫
  const [ax, az] = toWorld(p, -4, 9); props.push({ model: 'fang', x: ax, z: az, y: 0, rot: (p.rot || 0) + Math.PI / 2, height: 3.4, place: p.id, floating: true });
  const [bx, bz] = toWorld(p, 4.5, 12); props.push({ model: 'fang', x: bx, z: bz, y: 0, rot: (p.rot || 0) + Math.PI / 2 + 0.2, height: 3.4, place: p.id, floating: true });
  label(p, 8);
};

// Whole-garden enclosure: 雪白粉墙，下面虎皮石，随势砌去.
function gardenWall(root) {
  const [x0, x1] = L.bounds.x, [z0, z1] = L.bounds.z;
  const segs = [
    { pts: [[x0, z1], [x0, z0]], gaps: [] },
    { pts: [[x0, z0], [x1, z0]], gaps: [] },
    { pts: [[x1, z0], [x1, z1]], gaps: [[0, (-132 - z0 - 6) / (z1 - z0), (-132 - z0 + 6) / (z1 - z0)], [0, (122 - z0 - 6) / (z1 - z0), (122 - z0 + 6) / (z1 - z0)]] },
    { pts: [[x1, z1], [x0, z1]], gaps: [[0, (x1 - 153) / (x1 - x0), (x1 - 147) / (x1 - x0)], [0, (x1 - 9) / (x1 - x0), (x1 + 9) / (x1 - x0)]] },
  ];
  for (const s of segs) {
    // build in 6 m pieces so the wall follows the terrain ("随势砌去")
    const [[ax, az], [bx, bz]] = s.pts;
    const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 6);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const gp = s.gaps.filter(([, a, b]) => b > t0 && a < t1).map(([, a, b]) => [0, (a - t0) / (t1 - t0), (b - t0) / (t1 - t0)]);
      const pa = [ax + (bx - ax) * t0, az + (bz - az) * t0], pb = [ax + (bx - ax) * t1, az + (bz - az) * t1];
      const mx = (pa[0] + pb[0]) / 2, mz = (pa[1] + pb[1]) / 2;
      const w = A.wall([[pa[0] - mx, pa[1] - mz], [pb[0] - mx, pb[1] - mz]], { h: 4.6, t: 0.7, gaps: gp, baseH: 1.2 });
      w.position.set(mx, Math.max(heightAt(mx, mz), GROUND) - 0.2, mz);
      root.add(collide(w));
    }
  }
  // water gates (水门) where the stream passes the east wall
  for (const z of [-132, 122]) {
    const arch = A.archBridge({ span: 8, w: 1.2, rise: 2.4, mat: MAT.wall, rail: MAT.wall });
    arch.position.set(x1, 0.4, z); arch.rotation.y = Math.PI / 2; root.add(arch);
  }
}

// ---------------------------------------------------------------------------
export function buildPlaces() {
  const root = new THREE.Group();
  root.name = 'places';
  for (const p of L.places) {
    const g = new THREE.Group();
    g.name = p.id;
    const fn = B[p.id];
    if (!fn) continue;
    fn(p, g, levels[p.id]);
    if (g.userData.world) { root.add(g.userData.world); continue; }
    let y = levels[p.id] ?? heightAt(p.x, p.z);
    if (['ouxiang', 'zhuijin', 'xingye'].includes(p.id)) y = 0;
    if (p.id === 'qinfangting' || p.id === 'liaoting' || p.id === 'qinfangzha') y = 0;
    g.position.set(p.x, y, p.z);
    g.rotation.y = p.rot || 0;
    root.add(g);
  }
  gardenWall(root);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.keepSeparate; o.receiveShadow = true; } });
  return root;
}

// Collision segments in world xz, gathered from walls/halls after the scene is placed.
export function collectColliders(root) {
  root.updateMatrixWorld(true);
  const segs = [];
  const v = new THREE.Vector3();
  const pushBox = (mesh) => {
    const bb = mesh.geometry.boundingBox || (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
    const c = [[bb.min.x, bb.min.z], [bb.max.x, bb.min.z], [bb.max.x, bb.max.z], [bb.min.x, bb.max.z]].map(([x, z]) => {
      v.set(x, 0, z).applyMatrix4(mesh.matrixWorld); return [v.x, v.z];
    });
    for (let i = 0; i < 4; i++) segs.push([...c[i], ...c[(i + 1) % 4]]);
  };
  for (const owner of colliderOwners) {
    owner.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return;
      const p = o.geometry.parameters;
      // wall bodies and hall platforms are the tallest/largest boxes; use thick boxes only
      if (p.height > 1.5 && (p.width > 1.5 || p.depth > 1.5)) pushBox(o);
    });
  }
  return segs;
}
