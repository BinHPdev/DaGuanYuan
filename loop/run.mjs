#!/usr/bin/env node
// Loop harness: render every viewpoint in loop/config.json, measure fps, collect errors,
// and write loop/runs/<timestamp>/{<id>.png, manifest.json, report.html}.
//
// usage: node loop/run.mjs [--url http://localhost:5173/] [--only id1,id2] [--ui] [--diff <runDir|timestamp|latest>] [--tag note]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../web/node_modules/playwright/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const url = arg('url', cfg.url);
const only = arg('only', null);
const keepUI = !!arg('ui', false);
const tag = arg('tag', '');
const runsDir = path.join(HERE, 'runs');
fs.mkdirSync(runsDir, { recursive: true });
const prevRuns = fs.readdirSync(runsDir).filter((d) => fs.existsSync(path.join(runsDir, d, 'manifest.json'))).sort();
let diffDir = arg('diff', null);
if (diffDir === 'latest' || diffDir === true) diffDir = prevRuns.at(-1) || null;
if (diffDir && !fs.existsSync(diffDir)) diffDir = path.join(runsDir, diffDir);
if (diffDir && !fs.existsSync(path.join(diffDir, 'manifest.json'))) { console.warn('diff run not found:', diffDir); diffDir = null; }

const _d = new Date(), _p = (n) => String(n).padStart(2, '0');
const stamp = `${_d.getFullYear()}${_p(_d.getMonth() + 1)}${_p(_d.getDate())}-${_p(_d.getHours())}${_p(_d.getMinutes())}${_p(_d.getSeconds())}`;
const outDir = path.join(runsDir, stamp);
fs.mkdirSync(outDir, { recursive: true });

const views = cfg.viewpoints.filter((v) => !only || only.split(',').includes(v.id));

// ---------------------------------------------------------------- refs.md sections per spot
const REFS_HEAD = {
  global: '全局样式表', zhengmen: '正门', cuizhang: '翠嶂', qinfangting: '沁芳亭', xiaoxiang: '潇湘馆', yihong: '怡红院',
  hengwu: '蘅芜苑', daoxiang: '稻香村', zhengdian: '省亲别墅', paifang: '玉石牌坊', qinfangzha: '沁芳闸', liaoting: '蓼汀花溆',
  qiushuang: '秋爽斋', ouxiang: '藕香榭', zhuijin: '紫菱洲', longcui: '栊翠庵', tubi: '凸碧山庄', luxue: '芦雪广', huajing: '', yuanxiao: '',
};
function refsFor(spot) {
  const f = path.join(ROOT, 'research', 'refs.md');
  if (!fs.existsSync(f) || !REFS_HEAD[spot]) return '';
  const md = fs.readFileSync(f, 'utf8');
  const parts = md.split(/\n(?=#{2,3} )/);
  const sec = parts.find((p) => /^#{2,3} /.test(p) && p.split('\n')[0].includes(REFS_HEAD[spot]));
  return sec || '';
}

// ---------------------------------------------------------------- render
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: cfg.viewport });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));

// The dev server may hot-reload while other edits land; every step re-waits for the scene and retries.
const hideUI = '#title,#tools,#card,#tour,#minimap,#hint,#walkpad,#labels{visibility:hidden!important}';
async function waitScene() {
  await page.waitForFunction(() => window.__dgy && document.getElementById('loading')?.hidden, null, { timeout: 180000 });
  if (!keepUI) await page.addStyleTag({ content: hideUI });
}
async function retry(fn, tries = 4) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries || !/context was destroyed|navigation|Target closed|__dgy/.test(String(e))) throw e;
      errors.push('RELOAD during run (retrying): ' + String(e).split('\n')[0]);
      await page.waitForLoadState('load').catch(() => {});
      await waitScene().catch(() => {});
    }
  }
}

const t0 = Date.now();
await page.goto(url);
try { await waitScene(); } catch { errors.push('timeout waiting for scene load'); }
const loadMs = Date.now() - t0;
if (!(await page.evaluate(() => !!window.__dgy).catch(() => false))) {
  console.error('scene failed to load; errors:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ stamp, url, failed: true, errors: [...new Set(errors)] }, null, 2));
  await browser.close();
  process.exit(1);
}

const measureFps = (ms) => retry(() => page.evaluate((ms) => new Promise((res) => {
  let n = 0; const s = performance.now();
  const f = () => { n++; if (performance.now() - s < ms) requestAnimationFrame(f); else res((n * 1000) / (performance.now() - s)); };
  requestAnimationFrame(f);
}), ms));

const globalFps = await measureFps(cfg.fpsSampleMs);

const shots = [];
for (const v of views) {
  const res = await retry(() => page.evaluate((v) => {
    const d = window.__dgy; const V = d.camera.position.constructor;
    // time of day
    let timeOk = true;
    if (v.time !== undefined) {
      if (typeof v.time === 'number') d.applyTime(v.time);
      else if (d.setTimeByName) timeOk = d.setTimeByName(v.time) !== false;
      else timeOk = false;
    } else d.applyTime(0);
    d.setMode('orbit');
    let f;
    if (v.place) { const p = d.PLACE[v.place]; if (!p) return { ok: false, why: 'unknown place ' + v.place }; f = d.viewFor(p, v.dist); }
    else f = { pos: new V(...v.pos), target: new V(...v.target) };
    d.flyTo(f, 0.01);
    return { ok: true, timeOk };
  }, v));
  if (!res.ok || (v.optional && !res.timeOk)) { shots.push({ ...v, skipped: res.why || 'time mode not available' }); continue; }
  await page.waitForTimeout(cfg.settleMs);
  const fps = await measureFps(800);
  const file = `${v.id}.png`;
  await retry(() => page.screenshot({ path: path.join(outDir, file) }));
  shots.push({ ...v, file, fps: +fps.toFixed(1) });
  process.stdout.write(`  ${v.id.padEnd(18)} ${fps.toFixed(0).padStart(3)} fps\n`);
}
await page.evaluate(() => window.__dgy?.applyTime(0)).catch(() => {});
await browser.close();

// ---------------------------------------------------------------- manifest
const manifest = {
  stamp, url, tag, loadMs, globalFps: +globalFps.toFixed(1), fpsBudget: cfg.fpsBudget,
  minFps: Math.min(...shots.filter((s) => s.fps).map((s) => s.fps)),
  errors: [...new Set(errors)], diff: diffDir ? path.basename(diffDir) : null,
  shots: shots.map(({ id, label, spot, file, fps, skipped }) => ({ id, label, spot, file, fps, skipped })),
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
const prevManifest = diffDir ? JSON.parse(fs.readFileSync(path.join(diffDir, 'manifest.json'), 'utf8')) : null;

// ---------------------------------------------------------------- report
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md2html = (md) => esc(md).replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h4>$1</h4>').replace(/\n/g, '<br>');
const relPrev = (f) => path.relative(outDir, path.join(diffDir, f));
const spots = [...new Set(shots.map((s) => s.spot))];
const card = (spot) => {
  const items = cfg.checklists[spot] || [];
  const list = items.map((c) => `<label class="ck"><input type="checkbox" data-k="${esc(c.id)}"> <b class="w${c.weight}">${c.weight}</b> ${esc(c.text)} <span class="src">${esc(c.source)}</span></label>`).join('');
  const sh = shots.filter((s) => s.spot === spot).map((s) => {
    if (s.skipped) return `<figure class="skip"><figcaption>${esc(s.label)}（跳过：${esc(s.skipped)}）</figcaption></figure>`;
    const prev = prevManifest?.shots.find((p) => p.id === s.id && p.file);
    const imgs = prev
      ? `<div class="pair"><div><img src="${esc(relPrev(prev.file))}" loading="lazy"><small>之前 ${esc(prevManifest.stamp)}</small></div><div><img src="${esc(s.file)}" loading="lazy"><small>本次</small></div></div>`
      : `<a href="${esc(s.file)}" target="_blank"><img src="${esc(s.file)}" loading="lazy"></a>`;
    return `<figure>${imgs}<figcaption>${esc(s.label)} · <code>${esc(s.id)}</code> · <span class="${s.fps < cfg.fpsBudget ? 'bad' : ''}">${s.fps} fps</span></figcaption></figure>`;
  }).join('');
  const refs = refsFor(spot);
  return `<section data-spot="${esc(spot)}"><h2>${esc(spot)} <span class="score" data-spot="${esc(spot)}"></span></h2>
    <div class="grid"><div class="shots">${sh}</div><div class="side"><div class="list">${list}</div>
    <label class="note">本轮评分 / 备注<textarea data-k="__note"></textarea></label>
    ${refs ? `<details><summary>refs.md 参考</summary><div class="refs">${md2html(refs)}</div></details>` : ''}</div></div></section>`;
};

const html = `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><title>大观园 loop ${stamp}</title>
<style>
:root{--bg:#f4f1e8;--fg:#1f2420;--muted:#6b6a60;--line:#d8d2c2;--accent:#9b3a2a;--ok:#2f6b4f}
body{margin:0;padding:16px 20px;background:var(--bg);color:var(--fg);font:14px/1.6 -apple-system,"PingFang SC",sans-serif}
h1{font-size:20px;margin:0 0 4px} h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.meta{color:var(--muted);font-size:13px} .bad{color:var(--accent);font-weight:600}
.grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(280px,2fr);gap:16px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
figure{margin:0 0 12px} img{width:100%;display:block;border:1px solid var(--line)} figcaption{font-size:12px;color:var(--muted)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:6px} .pair small{color:var(--muted)}
.ck{display:block;padding:3px 0;border-bottom:1px dotted var(--line)} .ck .src{color:var(--muted);font-size:11px}
.ck b{display:inline-block;width:18px;text-align:center;border-radius:3px;color:#fff;font-size:11px} .w3{background:var(--accent)} .w2{background:#b8862f} .w1{background:#8a8a80}
.ck input:checked+b+*{} .ck:has(input:checked){color:var(--ok)}
textarea{width:100%;min-height:54px;font:inherit} .note{display:block;margin-top:8px;font-size:12px;color:var(--muted)}
.refs{font-size:12px;color:#3a3a34;max-height:320px;overflow:auto;background:#fff8;padding:6px;border:1px solid var(--line)}
.score{font-size:13px;color:var(--ok);font-weight:400} .skip{opacity:.6}
#sum{position:sticky;top:0;background:var(--bg);padding:6px 0;border-bottom:1px solid var(--line);z-index:2}
pre{white-space:pre-wrap;font-size:12px}
</style></head><body>
<h1>大观园 · loop 报告 ${esc(stamp)} ${tag ? '· ' + esc(tag) : ''}</h1>
<div class="meta">url ${esc(url)} · 加载 ${(loadMs / 1000).toFixed(1)} s · 全局 fps <span class="${manifest.globalFps < cfg.fpsBudget ? 'bad' : ''}">${manifest.globalFps}</span> · 最低视角 fps <span class="${manifest.minFps < cfg.fpsBudget ? 'bad' : ''}">${manifest.minFps}</span>（预算 ≥ ${cfg.fpsBudget}）${prevManifest ? ' · 对比 ' + esc(prevManifest.stamp) : ''}</div>
${manifest.errors.length ? `<details open><summary class="bad">控制台错误 ${manifest.errors.length}</summary><pre>${esc(manifest.errors.join('\n'))}</pre></details>` : '<div class="meta">控制台无错误</div>'}
<div id="sum" class="meta"></div>
${spots.map(card).join('')}
<h2>导出</h2><button id="exp">生成未满足清单（按权重）</button><pre id="out"></pre>
<script>
const KEY='dgy-loop-${stamp}';
let st={};try{st=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
document.querySelectorAll('section').forEach(sec=>{const sp=sec.dataset.spot;st[sp]=st[sp]||{};
  sec.querySelectorAll('input[type=checkbox]').forEach(cb=>{cb.checked=!!st[sp][cb.dataset.k];cb.onchange=()=>{st[sp][cb.dataset.k]=cb.checked;save();score()}});
  const ta=sec.querySelector('textarea');ta.value=st[sp].__note||'';ta.oninput=()=>{st[sp].__note=ta.value;save()}});
function score(){let tw=0,tm=0;document.querySelectorAll('section').forEach(sec=>{let w=0,m=0;sec.querySelectorAll('.ck').forEach(l=>{const k=+l.querySelector('b').textContent;w+=k;if(l.querySelector('input').checked)m+=k});tw+=w;tm+=m;
  const s=sec.querySelector('.score');if(s&&w)s.textContent=m+' / '+w});
  document.getElementById('sum').textContent='加权满足度 '+tm+' / '+tw+(tw?'（'+Math.round(tm*100/tw)+'%）':'')}
score();
document.getElementById('exp').onclick=()=>{const rows=[];document.querySelectorAll('section').forEach(sec=>sec.querySelectorAll('.ck').forEach(l=>{if(!l.querySelector('input').checked)rows.push([+l.querySelector('b').textContent,sec.dataset.spot,l.querySelector('input').dataset.k,l.textContent.trim()])}));
  rows.sort((a,b)=>b[0]-a[0]);document.getElementById('out').textContent=rows.map(r=>r[0]+'  '+r[1]+'/'+r[2]+'  '+r[3]).join('\\n')};
</script></body></html>`;
fs.writeFileSync(path.join(outDir, 'report.html'), html);
fs.writeFileSync(path.join(runsDir, 'latest.txt'), stamp + '\n');

console.log(`\nrun ${stamp}: ${shots.filter((s) => s.file).length} shots, load ${(loadMs / 1000).toFixed(1)}s, fps global ${manifest.globalFps} / min ${manifest.minFps} (budget ${cfg.fpsBudget}), errors ${manifest.errors.length}`);
console.log('report:', path.join(outDir, 'report.html'));
if (manifest.errors.length) console.log(manifest.errors.slice(0, 10).join('\n'));
