import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import L from './layout.json';
import { buildTerrain, heightAt, GROUND } from './terrain.js';
import { buildWater } from './water.js';
import { registerFlats, buildPlaces, flora, props, labels, collectColliders } from './places.js';
import { buildFlora } from './flora.js';
import { placeProps } from './props.js';

const $ = (id) => document.getElementById(id);
const app = $('app');

// ---------------------------------------------------------------- renderer & scene
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.domElement.className = 'gl';
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.2;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 2500);
camera.position.set(115, 150, 255);

// Gradient sky dome (zenith → horizon) with a soft sun halo.
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uGlow: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 uTop, uHor, uGlow, uSun; varying vec3 vDir;
    void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(uHor, uTop, pow(h, 0.55));
      c += uGlow * pow(max(dot(normalize(vDir), normalize(uSun)), 0.0), 24.0) * 0.6;
      gl_FragColor = vec4(c, 1.0); }`,
}));
sky.renderOrder = -1;
scene.add(sky);
const hemi = new THREE.HemisphereLight('#dfe9f0', '#5d6640', 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3dd', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 900 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog('#cfd8d6', 260, 900);

const TIMES = [
  { name: '昼', elev: 48, az: 150, sun: '#fff3dd', int: 2.4, hemi: 0.9, fog: '#cdd9dc', top: '#6f9cc4', hor: '#d6e2e4', glow: '#fff4d6', exp: 0.85 },
  { name: '暮', elev: 7, az: 240, sun: '#ffb071', int: 1.8, hemi: 0.5, fog: '#d9b49a', top: '#5a6f9a', hor: '#f0b88a', glow: '#ffcf8a', exp: 0.85 },
  { name: '月夜', elev: 38, az: 120, sun: '#a9c0ea', int: 0.7, hemi: 0.22, fog: '#1d2633', top: '#0b1226', hor: '#24304a', glow: '#000000', exp: 0.7, night: true },
];
let timeIdx = 0;
const water = buildWater(new THREE.Vector3(0, 1, 0));
function applyTime(i) {
  const t = TIMES[i];
  const phi = THREE.MathUtils.degToRad(90 - t.elev), theta = THREE.MathUtils.degToRad(t.az);
  const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.uSun.value.copy(dir);
  sky.material.uniforms.uTop.value.set(t.top);
  sky.material.uniforms.uHor.value.set(t.hor);
  sky.material.uniforms.uGlow.value.set(t.glow);
  sun.position.copy(dir).multiplyScalar(400);
  sun.color.set(t.sun); sun.intensity = t.int;
  hemi.intensity = t.hemi;
  scene.environmentIntensity = t.night ? 0.05 : 0.2;
  scene.fog.color.set(t.fog);
  renderer.toneMappingExposure = t.exp;
  water.material.uniforms.uSun.value.copy(dir);
  water.material.uniforms.uSky.value.set(t.night ? '#2a3550' : i === 1 ? '#e8b48e' : '#b9d0dc');
  moon.visible = !!t.night;
  $('b-time').textContent = '时辰：' + t.name;
}
const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: '#fbf6dc', fog: false }));
moon.position.set(-300, 260, -700);
scene.add(moon);

// ---------------------------------------------------------------- world
registerFlats();
const terrain = buildTerrain();
scene.add(terrain, water);
const placesRoot = buildPlaces();
scene.add(placesRoot);
const colliders = collectColliders(placesRoot);

const exclusions = L.places.filter((p) => p.w).map((p) => ({ x: p.x, z: p.z, hw: (Math.abs(Math.cos(p.rot || 0)) * p.w + Math.abs(Math.sin(p.rot || 0)) * p.d) / 2 + 1, hd: (Math.abs(Math.sin(p.rot || 0)) * p.w + Math.abs(Math.cos(p.rot || 0)) * p.d) / 2 + 1 }));
for (const [id, hw, hd] of [['zhengdian', 34, 26], ['zhengmen', 14, 10], ['paifang', 9, 5], ['longcui', 12, 12], ['tubi', 10, 10], ['luxue', 9, 6], ['qinfangting', 5, 15], ['cuizhang', 16, 10], ['aojing', 6, 5], ['qinfangzha', 9, 6]]) {
  const p = L.places.find((q) => q.id === id); exclusions.push({ x: p.x, z: p.z, hw, hd });
}
scene.add(buildFlora(flora, exclusions));

// Static batching: merge every non-instanced mesh of the architecture by material.
function batch(root) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  const keep = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (o.userData.keepSeparate) { keep.push(o); return; }
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(g);
  });
  const out = new THREE.Group(); out.name = 'batched';
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = m.receiveShadow = true;
    out.add(m);
  }
  for (const k of keep) { k.updateMatrixWorld(true); const c = k.clone(); k.matrixWorld.decompose(c.position, c.quaternion, c.scale); out.add(c); }
  return out;
}
scene.remove(placesRoot);
const batched = batch(placesRoot);
scene.add(batched);

const propsReady = placeProps(props, scene);
applyTime(0);

// ---------------------------------------------------------------- controls
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 0, 0);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.47;
orbit.minDistance = 8; orbit.maxDistance = 700;
orbit.update();

let mode = 'orbit';
const keys = new Set();
const walk = { yaw: Math.PI, pitch: -0.05 };
addEventListener('keydown', (e) => { if (mode === 'walk') keys.add(e.code); });
addEventListener('keyup', (e) => keys.delete(e.code));
document.querySelectorAll('#walkpad button').forEach((b) => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(k); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys.delete(k));
});
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (mode === 'walk') { walk.yaw -= dx * 0.004; walk.pitch = THREE.MathUtils.clamp(walk.pitch - dy * 0.003, -1.2, 1.0); }
});
addEventListener('pointerup', (e) => { if (drag && drag.moved < 6) pick(e); drag = null; });

function groundY(x, z) { return Math.max(heightAt(x, z), GROUND - 0.2); }
function collide(x, z, r = 0.45) {
  for (const [ax, az, bx, bz] of colliders) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + t * dx, pz = az + t * dz, d = Math.hypot(x - px, z - pz);
    if (d < r) { const k = (r - d) / (d || 1); x += (x - px) * k; z += (z - pz) * k; }
  }
  return [x, z];
}

function setMode(m) {
  mode = m;
  $('b-orbit').setAttribute('aria-pressed', m === 'orbit');
  $('b-walk').setAttribute('aria-pressed', m === 'walk');
  $('b-tour').setAttribute('aria-pressed', m === 'tour');
  orbit.enabled = m === 'orbit';
  $('walkpad').hidden = m !== 'walk';
  $('tour').hidden = m !== 'tour';
  $('hint').hidden = m === 'tour';
  $('hint').textContent = m === 'walk' ? 'WASD / 方向键行走 · Shift 快走 · 拖动环顾 · 点击景点看原文'
    : m === 'tour' ? '随贾政一行，依第十七回原文游园' : '拖动旋转 · 滚轮缩放 · 点击景点看原文';
  if (m === 'walk') {
    // start at the main gate looking north, as 贾政 did
    const g = L.places[0];
    camera.position.set(g.x, groundY(g.x, g.z + 16) + 1.65, g.z + 16);
    walk.yaw = 0; walk.pitch = 0.02;
  }
  if (m === 'orbit') { flyTo(null); orbit.target.set(camera.position.x, 0, camera.position.z).lerp(new THREE.Vector3(), 0.0); }
  if (m === 'tour') goStop(tourIdx);
}
$('b-orbit').onclick = () => { setMode('orbit'); overview(); };
$('b-walk').onclick = () => setMode('walk');
$('b-tour').onclick = () => setMode('tour');
$('b-time').onclick = () => applyTime((timeIdx = (timeIdx + 1) % TIMES.length));
let showLabels = true;
$('b-labels').onclick = () => { showLabels = !showLabels; $('b-labels').setAttribute('aria-pressed', showLabels); $('labels').hidden = !showLabels; };
$('b-about').onclick = () => ($('about').hidden = false);
$('about-close').onclick = () => ($('about').hidden = true);

function overview() { flyTo({ pos: new THREE.Vector3(115, 150, 255), target: new THREE.Vector3(0, 0, 0) }); }

// ---------------------------------------------------------------- camera flights
let flight = null;
function flyTo(f, dur = 2.6) {
  if (!f) { flight = null; return; }
  const target0 = mode === 'orbit' ? orbit.target.clone() : camera.position.clone().add(new THREE.Vector3(0, 0, -10).applyQuaternion(camera.quaternion));
  flight = { p0: camera.position.clone(), t0: target0, p1: f.pos, t1: f.target, t: 0, dur };
}
function viewFor(p, dist) {
  const ty = (p.id === 'qinfangting' ? 2 : heightAt(p.x, p.z)) + 3;
  const target = new THREE.Vector3(p.x, ty, p.z);
  const D = dist ?? (p.w ? Math.max(p.w, p.d) * 1.15 + 14 : 30);
  const a = (p.rot || 0) + 0.35;
  const pos = new THREE.Vector3(p.x + Math.sin(a) * D, ty + D * 0.55, p.z + Math.cos(a) * D);
  pos.y = Math.max(pos.y, heightAt(pos.x, pos.z) + 4);
  return { pos, target };
}

// ---------------------------------------------------------------- info card
const PLACE = Object.fromEntries(L.places.map((p) => [p.id, p]));
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function showCard(p) {
  const c = $('card');
  c.innerHTML = `<button class="close" aria-label="关闭">×</button>
    <h2>${esc(p.name)}</h2>
    <div class="meta">${p.resident ? '居者 · ' + esc(p.resident) + '　' : ''}第${p.chapter}回</div>
    ${p.plaque ? `<div class="plaque">${esc(p.plaque)}</div>` : ''}
    ${p.couplet ? `<div class="couplet">${esc(p.couplet[0])}，${esc(p.couplet[1])}。</div>` : ''}
    <blockquote>${esc(p.quote)}</blockquote>
    ${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}`;
  c.hidden = false;
  c.querySelector('.close').onclick = () => (c.hidden = true);
}
const ray = new THREE.Raycaster();
function pick(e) {
  if (e.target !== renderer.domElement) return;
  const m = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(m, camera);
  const hit = ray.intersectObjects([terrain, batched], true)[0];
  if (!hit) return;
  let best = null, bd = Infinity;
  for (const p of L.places) { const d = Math.hypot(p.x - hit.point.x, p.z - hit.point.z) - (p.w ? Math.max(p.w, p.d) / 2 : 6); if (d < bd) { bd = d; best = p; } }
  if (best && bd < 14) showCard(best);
}

// ---------------------------------------------------------------- labels
const lblEls = labels.map((l) => {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = esc(l.place.name.split('·')[0]) + (l.place.resident ? `<small>${esc(l.place.resident)}</small>` : '');
  el.onclick = () => { showCard(l.place); if (mode === 'orbit') flyTo(viewFor(l.place)); };
  $('labels').appendChild(el);
  return { el, pos: l.pos };
});
const tmpV = new THREE.Vector3();
function updateLabels() {
  if (!showLabels) return;
  for (const { el, pos } of lblEls) {
    tmpV.copy(pos).project(camera);
    const dist = camera.position.distanceTo(pos);
    const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 && dist < (mode === 'walk' ? 120 : 900);
    el.hidden = !vis;
    if (vis) { el.style.left = ((tmpV.x + 1) / 2) * innerWidth + 'px'; el.style.top = ((1 - tmpV.y) / 2) * innerHeight + 'px'; el.style.opacity = dist > 420 ? 0.75 : 1; }
  }
}

// ---------------------------------------------------------------- tour (第十七回)
const stops = L.places.filter((p) => p.tour).sort((a, b) => a.tour - b.tour);
let tourIdx = 0, autoplay = null;
function goStop(i) {
  tourIdx = (i + stops.length) % stops.length;
  const p = stops[tourIdx];
  $('t-step').textContent = `第 ${tourIdx + 1} / ${stops.length} 站`;
  $('t-name').textContent = p.name;
  $('t-quote').textContent = p.quote;
  $('card').hidden = true;
  const dist = { zhengmen: 34, cuizhang: 30, qinfangting: 26, paifang: 26, qinfangzha: 26, zhengdian: 70, huajing: 40, liaoting: 30 }[p.id];
  flyTo(viewFor(p, dist), 3.2);
}
$('t-prev').onclick = () => goStop(tourIdx - 1);
$('t-next').onclick = () => goStop(tourIdx + 1);
$('t-play').onclick = () => {
  if (autoplay) { clearInterval(autoplay); autoplay = null; $('t-play').textContent = '自动'; return; }
  $('t-play').textContent = '暂停';
  autoplay = setInterval(() => goStop(tourIdx + 1), 9000);
};

// ---------------------------------------------------------------- minimap
const mm = $('mm'), mx = mm.getContext('2d');
const MMW = mm.width, MMH = mm.height, pad = 14;
const sx = (x) => pad + ((x - L.bounds.x[0]) / (L.bounds.x[1] - L.bounds.x[0])) * (MMW - pad * 2);
const sz = (z) => pad + ((z - L.bounds.z[0]) / (L.bounds.z[1] - L.bounds.z[0])) * (MMH - pad * 2);
const mmBase = document.createElement('canvas'); mmBase.width = MMW; mmBase.height = MMH;
(function drawBase() {
  const g = mmBase.getContext('2d');
  g.fillStyle = '#e7dfcb'; g.fillRect(0, 0, MMW, MMH);
  g.fillStyle = '#c9cfae'; g.fillRect(sx(-180), sz(-150), sx(180) - sx(-180), sz(150) - sz(-150));
  for (const h of L.hills) { g.fillStyle = 'rgba(95,110,70,0.35)'; g.beginPath(); g.arc(sx(h.x), sz(h.z), (h.r / 360) * (MMW - pad * 2), 0, 7); g.fill(); }
  g.strokeStyle = '#5f8b93'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of L.water.streams) { g.lineWidth = s.width * 0.55; g.beginPath(); s.pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z)))); g.stroke(); }
  const pd = L.water.pond; g.fillStyle = '#5f8b93';
  g.beginPath(); g.ellipse(sx(pd.cx), sz(pd.cz), pd.rx * (MMW - pad * 2) / 360, pd.rz * (MMH - pad * 2) / 300, 0, 0, 7); g.fill();
  g.strokeStyle = '#3a3a34'; g.lineWidth = 2; g.strokeRect(sx(-180), sz(-150), sx(180) - sx(-180), sz(150) - sz(-150));
  for (const p of L.places) {
    g.fillStyle = p.resident ? '#9b3a2a' : '#2c3a3a';
    g.beginPath(); g.arc(sx(p.x), sz(p.z), p.resident ? 4.5 : 3, 0, 7); g.fill();
  }
  g.fillStyle = '#2c3a3a'; g.font = '15px "Kaiti SC","STKaiti",serif'; g.textAlign = 'center';
  g.fillText('北', MMW - 12, 18);
})();
function drawMinimap() {
  mx.drawImage(mmBase, 0, 0);
  const x = sx(camera.position.x), z = sz(camera.position.z);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const a = Math.atan2(dir.z, dir.x);
  mx.fillStyle = 'rgba(155,58,42,0.25)';
  mx.beginPath(); mx.moveTo(x, z); mx.arc(x, z, 34, a - 0.45, a + 0.45); mx.closePath(); mx.fill();
  mx.fillStyle = '#9b3a2a'; mx.beginPath(); mx.arc(x, z, 5, 0, 7); mx.fill();
}
mm.addEventListener('click', (e) => {
  const r = mm.getBoundingClientRect();
  const px = ((e.clientX - r.left) / r.width) * MMW, pz = ((e.clientY - r.top) / r.height) * MMH;
  const wx = L.bounds.x[0] + ((px - pad) / (MMW - pad * 2)) * 360, wz = L.bounds.z[0] + ((pz - pad) / (MMH - pad * 2)) * 300;
  if (mode === 'walk') { camera.position.set(wx, groundY(wx, wz) + 1.65, wz); return; }
  if (mode === 'tour') setMode('orbit');
  flyTo({ pos: new THREE.Vector3(wx + 40, heightAt(wx, wz) + 55, wz + 60), target: new THREE.Vector3(wx, heightAt(wx, wz), wz) });
});

// ---------------------------------------------------------------- loop
let last = performance.now();
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
function tick() {
  const now = performance.now(); const dt = Math.min((now - last) / 1000, 0.05); last = now;
  water.material.uniforms.uTime.value += dt;
  sky.position.copy(camera.position);
  if (flight) {
    flight.t += dt / flight.dur;
    const k = flight.t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * flight.t);
    camera.position.lerpVectors(flight.p0, flight.p1, k);
    const tg = new THREE.Vector3().lerpVectors(flight.t0, flight.t1, k);
    if (mode === 'orbit') orbit.target.copy(tg);
    camera.lookAt(tg);
    if (flight.t >= 1) flight = null;
  } else if (mode === 'orbit') orbit.update();
  if (mode === 'walk') {
    const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 9 : 3.6) * dt;
    fwd.set(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
    right.set(-fwd.z, 0, fwd.x);
    let { x, z } = camera.position;
    if (keys.has('KeyW') || keys.has('ArrowUp')) { x += fwd.x * sp; z += fwd.z * sp; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { x -= fwd.x * sp; z -= fwd.z * sp; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { x -= right.x * sp; z -= right.z * sp; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { x += right.x * sp; z += right.z * sp; }
    [x, z] = collide(x, z);
    x = THREE.MathUtils.clamp(x, -178, 178); z = THREE.MathUtils.clamp(z, -148, 160);
    const y = groundY(x, z) + 1.65;
    camera.position.set(x, camera.position.y + (y - camera.position.y) * Math.min(1, dt * 10), z);
    camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  }
  updateLabels();
  drawMinimap();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
tick();
propsReady.then(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => (l.hidden = true), 700); });
window.__dgy = { camera, scene, renderer, setMode, goStop, flyTo, viewFor, PLACE, applyTime, orbit, showCard, get flight() { return flight; } };
