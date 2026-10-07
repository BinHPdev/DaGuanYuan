import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'shots';
const views = (process.argv[4] || 'overview').split(',');
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] , headless: true});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto(url);
await p.waitForFunction(() => window.__dgy && document.getElementById('loading').hidden, null, { timeout: 120000 }).catch(() => errs.push('timeout loading'));
for (const v of views) {
  await p.evaluate((v) => {
    const d = window.__dgy;
    if (v === 'overview') return;
    if (v === 'walk') { d.setMode('walk'); return; }
    if (v === 'yuanxiao') { d.applyTime(2); d.setMode('orbit'); d.flyTo({pos: new d.camera.position.constructor(60,70,40), target: new d.camera.position.constructor(0,0,-60)}, 0.01); return; }
    if (v === 'night') { d.applyTime(3); d.setMode('orbit'); d.flyTo(d.viewFor(d.PLACE.xiaoxiang, 60), 0.01); return; }
    if (v === 'dusk') { d.applyTime(1); d.setMode('orbit'); d.flyTo({pos: new d.camera.position.constructor(-60,60,120), target: new d.camera.position.constructor(0,0,-60)}, 0.01); return; }
    if (v.startsWith('tour')) { d.setMode('tour'); d.goStop(+v.slice(4)); return; }
    if (v.startsWith('cam:')) { const [x,y,z,tx,ty,tz] = v.slice(4).split('_').map(Number); d.flyTo({ pos: new d.camera.position.constructor(x,y,z), target: new d.camera.position.constructor(tx,ty,tz) }, 0.01); return; }
    const p = d.PLACE[v]; d.setMode('orbit'); d.flyTo(d.viewFor(p), 0.01); d.showCard(p);
  }, v);
  await p.waitForTimeout(v.startsWith('tour') ? 3800 : 900);
  await p.screenshot({ path: `${out}/${v.replace(/[:]/g,'_')}.png` });
}
console.log(errs.slice(0, 30).join('\n'));
await b.close();
