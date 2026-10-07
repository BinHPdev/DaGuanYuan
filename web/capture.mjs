// Capture clean showcase images for the README: node capture.mjs [url]
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:5173/';
const V = (pos, target) => ({ pos, target });
const shots = [
  ['overview', V([95, 85, 160], [-5, 0, -25]), 0],
  ['shengqin', V([10, 5, -70], [10, 6, -112]), 0],
  ['yihong', V([104, 3.4, 89], [97, 3.2, 66]), 0],
  ['xiaoxiang', V([-55, 2.6, 69], [-58, 3, 50]), 0],
  ['qinfang', V([-14, 6, 98], [0, 3, 76]), 0],
  ['liaoting', V([-86, 13, -56], [-102, 3, -74]), 0],
  ['ouxiang', V([-6, 9, -10], [-26, 2, -36]), 1],
  ['yuanxiao', V([60, 50, 40], [0, 0, -60]), 2],
  ['gongdu', V([152, 3.2, -103], [148, 1, -109]), 0],
  ['dicui', V([28, 5, 6], [20, 2, -14]), 0],
  ['interior', V([106.6, 2.4, -14.3], [112, 2.2, -14]), 0],
  ['palace', V([62, 38, -52], [10, 4, -116]), 1],
  ['snow', V([95, 85, 160], [-5, 0, -25]), 3],
  ['snow_plum', V([60, 14, 8], [62, 2, 30]), 3],
];
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(url);
await p.waitForFunction(() => window.__dgy && document.getElementById('loading').hidden, null, { timeout: 120000 });
await p.addStyleTag({ content: '#title,#tools,#card,#tour,#minimap,#hint,#labels,#walkpad{display:none!important}' });
for (const [id, v, t] of shots) {
  await p.evaluate(([v, t]) => {
    const d = window.__dgy, C = d.camera.position.constructor;
    d.setMode('orbit'); d.applyTime(t);
    d.flyTo({ pos: new C(...v.pos), target: new C(...v.target) }, 0.01);
  }, [v, t]);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `../docs/images/${id}.png` });
}
await b.close();
