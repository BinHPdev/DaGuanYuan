// Deterministic frame capture of the DaGuanYuan scene.
// usage: node capture.mjs <shots.json> <outDir> [--preview] [--only id1,id2] [--w 1080 --h 1920]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '../../../web/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const shotsFile = argv[0], outDir = argv[1];
const preview = argv.includes('--preview');
const only = arg('only', null);
const W = +arg('w', 1080), H = +arg('h', 1920), FPS = 30;
const url = arg('url', 'http://localhost:5199/');
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8')).filter((s) => !only || only.split(',').includes(s.id));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));

await page.addInitScript(() => {
  // seeded Math.random so every load builds the same garden
  let s = 1234567;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // virtual clock: real until __virtual() is called, then advanced only by __step()
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window);
  let virtual = false, T = 0; const q = [];
  performance.now = () => (virtual ? T : realNow());
  window.requestAnimationFrame = (cb) => (virtual ? (q.push(cb), q.length) : realRAF(cb));
  window.__virtual = () => { if (!virtual) { T = realNow(); virtual = true; } };
  window.__step = (ms) => { T += ms; const cbs = q.splice(0); for (const cb of cbs) cb(T); };
});

await page.goto(url);
await page.waitForFunction(() => window.__dgy && document.getElementById('loading')?.hidden, null, { timeout: 240000 });
await page.addStyleTag({ content: '#title,#tools,#card,#tour,#minimap,#hint,#walkpad,#labels,#about,#loading{display:none!important}' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const d = window.__dgy;
  d.setMode('orbit'); d.flyTo(null);
  d.orbit.update = () => false; // camera is driven by us, not OrbitControls
  d.setQuality('high');
  window.__virtual();
});

// camera evaluation: Catmull-Rom through keys, eased global parameter
for (const s of shots) {
  const dur = s.dur, n = Math.round(dur * FPS);
  const frames = preview ? [0, Math.floor(n / 2), n - 1] : [...Array(n).keys()];
  const dir = path.join(outDir, s.id);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await page.evaluate((s) => {
    const d = window.__dgy;
    d.applyTime(s.time ?? 0);
    d.camera.fov = s.fov ?? 55; d.camera.updateProjectionMatrix();
    d.renderer.shadowMap.needsUpdate = true;
  }, s);
  const camAt = async (u) => page.evaluate(([s, u]) => {
    const d = window.__dgy, V = d.camera.position.constructor;
    const ease = s.ease ?? 'inout';
    const e = ease === 'linear' ? u : ease === 'out' ? 1 - Math.pow(1 - u, 2.2) : ease === 'in' ? u * u : u * u * (3 - 2 * u) * 0.5 + u * 0.5;
    const cr = (pts) => {
      if (pts.length === 1) return new V(...pts[0]);
      const m = pts.length - 1, f = Math.min(e * m, m - 1e-6), i = Math.floor(f), t = f - i;
      const P = (k) => new V(...pts[Math.max(0, Math.min(m, k))]);
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const t2 = t * t, t3 = t2 * t;
      return new V(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3));
    };
    let pos, tgt;
    if (s.orbit) { // {c:[x,y,z], r, h, a0, a1} angles in degrees
      const o = s.orbit, a = (o.a0 + (o.a1 - o.a0) * e) * Math.PI / 180;
      const r = o.r0 !== undefined ? o.r0 + (o.r1 - o.r0) * e : o.r;
      const h = o.h0 !== undefined ? o.h0 + (o.h1 - o.h0) * e : o.h;
      pos = new V(o.c[0] + Math.sin(a) * r, o.c[1] + h, o.c[2] + Math.cos(a) * r);
      tgt = new V(...o.c);
    } else { pos = cr(s.pos); tgt = cr(s.target); }
    d.camera.position.copy(pos); d.camera.up.set(0, 1, 0); d.camera.lookAt(tgt);
    if (s.roll) d.camera.rotateZ(s.roll * Math.PI / 180);
  }, [s, u]);
  // warm-up: settle dynamics, shadows, AO history
  await camAt(0);
  for (let i = 0; i < (preview ? 20 : 45); i++) await page.evaluate(() => window.__step(1000 / 30));
  let k = 0;
  for (let f = 0; f < n; f++) {
    await camAt(n > 1 ? f / (n - 1) : 0);
    await page.evaluate(() => window.__step(1000 / 30));
    if (frames.includes(f)) await page.screenshot({ path: path.join(dir, `${String(k++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  if (!preview) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(outDir, `${s.id}.mp4`)]);
  }
  console.log('done', s.id, preview ? '(preview)' : `${n} frames`);
}
await browser.close();
