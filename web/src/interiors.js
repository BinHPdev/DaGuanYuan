// Furnished interiors for the main halls, following the novel (see research/interiors.md).
//
// Usage (two phases, because places are batched once and models load asynchronously):
//   1. furnish(roomId, hallGroup, { w, d, h, platform })  — synchronous, while building places.
//      Adds procedural floor / ceiling / partitions / paintings / curtains to hallGroup and
//      drops empty "slot" Object3Ds marking where AI furniture models go.
//   2. placeInteriorModels(root, scene)  — after the place groups are positioned (e.g. after
//      batch()), finds every slot under `root`, loads its model and adds it to `scene` at the
//      slot's world transform. Returns a Promise.
// Local frame of a hall built by arch.hall(): origin = ground centre, front = +z, floor at
// y = platform, back wall at z = -d/2, side walls at x = ±w/2, column height h.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const FONT = '"Kaiti SC","STKaiti","KaiTi","Songti SC","Noto Serif SC",serif';
let seed = 4242;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- materials
// Interiors get no real lights; a little self-illumination stands in for bounce light.
const GLOW = 0.22;
function mat({ glow, ...o } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  if (o.map) { m.emissive.set('#ffffff'); m.emissiveMap = o.map; m.emissiveIntensity = glow ?? GLOW; }
  else if (o.color) { m.emissive.set(o.color); m.emissiveIntensity = glow ?? GLOW; }
  ALL_MATS.push([m, m.emissiveIntensity]);
  return m;
}
const ALL_MATS = []; // [material, base emissive]
// Night: rooms read as lamp-lit — lamps (base ≥ 1) flare, surfaces take a warmer, stronger fill.
export function setInteriorLight(night, yuanxiao = false) {
  for (const [m, base] of ALL_MATS) {
    m.emissiveIntensity = base >= 1 ? base * (night ? (yuanxiao ? 3 : 2.2) : 1) : base * (night ? 1.6 : 1);
  }
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const cache = {};
const once = (k, f) => (cache[k] ||= f());

// ---------------------------------------------------------------- procedural textures
function floorTex(kind) {
  return once('floor-' + kind, () => {
    const [c, g] = canvas(256, 256);
    if (kind === 'earth') {
      g.fillStyle = '#8a7558'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${60 + rnd() * 60},${45 + rnd() * 40},${25 + rnd() * 30},0.25)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
      return tex(c, true);
    }
    const base = { jinzhuan: [38, 40, 42], grey: [128, 126, 118], bilu: [52, 104, 84] }[kind];
    const n = 4, s = 256 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = (rnd() - 0.5) * 14;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      g.fillRect(x * s, y * s, s, s);
      if (kind === 'jinzhuan') { // polished sheen
        const gr = g.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
        gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)');
        g.fillStyle = gr; g.fillRect(x * s, y * s, s, s);
      }
      if (kind === 'bilu') { // 碧绿凿花: carved four-petal flower in each tile
        g.save(); g.translate(x * s + s / 2, y * s + s / 2);
        g.strokeStyle = 'rgba(200,230,200,0.45)'; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, s * 0.18, s * 0.09, s * 0.17, 0, 0, 7); g.stroke(); }
        g.beginPath(); g.arc(0, 0, s * 0.05, 0, 7); g.stroke();
        g.strokeRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
        g.restore();
      }
    }
    g.strokeStyle = kind === 'jinzhuan' ? 'rgba(0,0,0,0.6)' : 'rgba(40,40,36,0.55)'; g.lineWidth = 2;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); }
    return tex(c, true);
  });
}

function ceilingTex(kind) {
  return once('ceil-' + kind, () => {
    const [c, g] = canvas(256, 256);
    if (kind === 'paper') { // 海墁天花: white papered ceiling with a faint pattern
      g.fillStyle = '#efeadc'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(150,140,120,0.18)'; g.lineWidth = 1;
      for (let y = 16; y < 256; y += 32) for (let x = 16; x < 256; x += 32) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke(); }
      return tex(c, true);
    }
    // 井口天花: square coffers, green frame, blue panel, round medallion
    g.fillStyle = '#2f5f4a'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const ox = x * 128, oy = y * 128;
      g.fillStyle = '#1f4a63'; g.fillRect(ox + 10, oy + 10, 108, 108);
      g.strokeStyle = '#c8a24a'; g.lineWidth = 2.5; g.strokeRect(ox + 10, oy + 10, 108, 108);
      g.fillStyle = '#2f6b52'; g.beginPath(); g.arc(ox + 64, oy + 64, 38, 0, 7); g.fill();
      g.strokeStyle = '#d8b25a'; g.lineWidth = 3; g.beginPath(); g.arc(ox + 64, oy + 64, 38, 0, 7); g.stroke();
      g.fillStyle = '#c8a24a';
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.ellipse(ox + 64 + Math.cos(a) * 20, oy + 64 + Math.sin(a) * 20, 8, 4, a, 0, 7); g.fill(); }
      g.fillStyle = '#b8473a'; g.beginPath(); g.arc(ox + 64, oy + 64, 8, 0, 7); g.fill();
      g.fillStyle = '#c8a24a'; for (const [cx, cy] of [[14, 14], [114, 14], [14, 114], [114, 114]]) { g.beginPath(); g.arc(ox + cx, oy + cy, 5, 0, 7); g.fill(); }
    }
    return tex(c, true);
  });
}

// Ink landscape scroll. misty=true → 米点 (Mi Fu "rain dots") misty hills for 米襄阳《烟雨图》.
function scrollTex(key, { misty = false, w = 300, h = 720 } = {}) {
  return once('scroll-' + key, () => {
    const [c, g] = canvas(w, h);
    // mounting: silk border (天头地头) and pale paper
    g.fillStyle = '#c9b48a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 22, w, 22);
    const px = 22, py = 70, pw = w - 44, ph = h - 160;
    g.fillStyle = '#ece3cd'; g.fillRect(px, py, pw, ph);
    g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip();
    const layers = misty ? 6 : 4;
    for (let L = 0; L < layers; L++) {
      const baseY = py + ph * (0.25 + L * (0.6 / layers));
      const ink = 40 + (layers - L) * 22;
      g.fillStyle = `rgba(${ink},${ink},${ink + 6},${misty ? 0.55 : 0.75})`;
      g.beginPath(); g.moveTo(px, py + ph);
      for (let x = 0; x <= pw; x += 6) {
        const y = baseY - Math.abs(Math.sin(x * 0.02 + L * 1.7)) * ph * 0.16 - Math.sin(x * 0.07 + L) * 8;
        g.lineTo(px + x, y);
      }
      g.lineTo(px + pw, py + ph); g.closePath(); g.fill();
      if (misty) { // 米点: horizontal ink dots built up on the hill crests
        for (let i = 0; i < 260; i++) {
          const x = px + rnd() * pw, y = baseY - Math.abs(Math.sin((x - px) * 0.02 + L * 1.7)) * ph * 0.16 + rnd() * 30;
          g.fillStyle = `rgba(${20 + L * 10},${20 + L * 10},${25 + L * 10},${0.25 + rnd() * 0.4})`;
          g.beginPath(); g.ellipse(x, y, 3 + rnd() * 3, 1.6 + rnd() * 1.2, 0, 0, 7); g.fill();
        }
      }
      // mist band between layers
      const gr = g.createLinearGradient(0, baseY - 10, 0, baseY + 40);
      gr.addColorStop(0, 'rgba(236,227,205,0)'); gr.addColorStop(0.5, 'rgba(236,227,205,0.85)'); gr.addColorStop(1, 'rgba(236,227,205,0)');
      g.fillStyle = gr; g.fillRect(px, baseY - 10, pw, 50);
    }
    // a few trees and a hut, ink strokes
    g.strokeStyle = 'rgba(30,30,30,0.8)'; g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const x = px + 20 + rnd() * (pw - 40), y = py + ph * 0.86; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 26); g.stroke(); g.fillStyle = 'rgba(30,30,30,0.6)'; g.beginPath(); g.arc(x, y - 28, 6, 0, 7); g.fill(); }
    g.restore();
    // seal
    g.fillStyle = '#b3301f'; g.fillRect(px + pw - 26, py + ph - 40, 16, 16);
    return tex(c);
  });
}

// Calligraphy couplet on paper (ink on cream, e.g. 颜鲁公墨迹).
function calligraphyTex(text) {
  return once('cal-' + text, () => {
    const chars = [...text];
    const [c, g] = canvas(120, 110 * chars.length + 60);
    g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#efe6cf'; g.fillRect(10, 24, 100, c.height - 48);
    g.fillStyle = '#1a1a1a'; g.font = `bold 86px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    chars.forEach((ch, i) => g.fillText(ch, 60, 30 + 110 * i + 55));
    return tex(c);
  });
}

// Stylised painting of a smiling girl (怡红院: "迎面一个女孩儿，满面含笑……原来是一幅画儿").
function ladyTex() {
  return once('lady', () => {
    const [c, g] = canvas(256, 640);
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, 256, 640);
    g.fillStyle = '#efe4c8'; g.fillRect(14, 14, 228, 612);
    // robe
    g.fillStyle = '#c8556a'; g.beginPath(); g.moveTo(128, 210); g.bezierCurveTo(60, 260, 40, 520, 56, 600); g.lineTo(200, 600); g.bezierCurveTo(216, 520, 196, 260, 128, 210); g.fill();
    g.fillStyle = '#7fa69a'; g.beginPath(); g.moveTo(128, 230); g.bezierCurveTo(100, 330, 96, 500, 104, 600); g.lineTo(152, 600); g.bezierCurveTo(160, 500, 156, 330, 128, 230); g.fill();
    g.strokeStyle = 'rgba(60,30,30,0.6)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(80 + i * 18, 320); g.quadraticCurveTo(70 + i * 20, 470, 70 + i * 24, 598); g.stroke(); }
    // sleeves
    g.fillStyle = '#d8798a'; g.beginPath(); g.ellipse(84, 330, 26, 60, 0.4, 0, 7); g.fill(); g.beginPath(); g.ellipse(172, 330, 26, 60, -0.4, 0, 7); g.fill();
    // face & hair
    g.fillStyle = '#f3dcc6'; g.beginPath(); g.ellipse(128, 168, 30, 38, 0, 0, 7); g.fill();
    g.fillStyle = '#1d1b1a'; g.beginPath(); g.ellipse(128, 128, 40, 30, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(128, 96, 24, 0, 7); g.fill();
    g.fillStyle = '#d8b25a'; g.fillRect(150, 92, 22, 4);
    g.strokeStyle = '#1d1b1a'; g.lineWidth = 2; g.beginPath(); g.arc(116, 168, 6, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(140, 168, 6, 0.2, Math.PI - 0.2); g.stroke();
    g.strokeStyle = '#b3301f'; g.beginPath(); g.arc(128, 186, 7, 0.3, Math.PI - 0.3); g.stroke();
    // flowers and seal
    g.fillStyle = '#e3485f'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(30 + rnd() * 40, 60 + rnd() * 200, 4, 0, 7); g.fill(); }
    g.fillStyle = '#b3301f'; g.fillRect(200, 560, 18, 18);
    return tex(c);
  });
}

// Openwork partition (雕空玲珑木板 / 落地罩), alpha. motif: 'cloud' 流云百蝠 | 'pine' 岁寒三友 | 'wan' 万字 | 'grid' 碧纱橱
function openworkTex(motif, color = '#5a2a1c', gold = false) {
  return once(`ow-${motif}-${color}-${gold}`, () => {
    const [c, g] = canvas(256, 512);
    g.clearRect(0, 0, 256, 512);
    g.strokeStyle = color; g.lineCap = 'round';
    g.lineWidth = 14; g.strokeRect(7, 7, 242, 498);
    g.lineWidth = 5;
    if (motif === 'grid') { // 碧纱橱: lattice top, green gauze panels show through, solid skirt
      g.fillStyle = 'rgba(120,170,130,0.35)'; g.fillRect(14, 14, 228, 330);
      for (let y = 14; y < 344; y += 22) { g.beginPath(); g.moveTo(14, y); g.lineTo(242, y); g.stroke(); }
      for (let x = 14; x < 242; x += 22) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, 344); g.stroke(); }
      g.fillStyle = color; g.fillRect(14, 344, 228, 154);
      g.strokeStyle = '#b8863b'; g.lineWidth = 3; g.strokeRect(34, 370, 188, 108);
    } else if (motif === 'wan') {
      for (let y = 30; y < 490; y += 40) for (let x = 30; x < 230; x += 40) {
        g.beginPath(); g.moveTo(x - 14, y - 14); g.lineTo(x, y - 14); g.lineTo(x, y + 14); g.lineTo(x + 14, y + 14);
        g.moveTo(x + 14, y - 14); g.lineTo(x + 14, y); g.lineTo(x - 14, y); g.lineTo(x - 14, y + 14); g.stroke();
      }
    } else if (motif === 'cloud') { // 流云百蝠: scrolling clouds with bats
      for (let y = 40; y < 480; y += 70) for (let x = 20; x < 250; x += 80) {
        g.beginPath(); g.arc(x + 20, y, 16, Math.PI, 0); g.arc(x + 44, y, 12, Math.PI, 0); g.quadraticCurveTo(x + 70, y + 20, x + 40, y + 22); g.quadraticCurveTo(x + 10, y + 26, x + 4, y); g.stroke();
        g.save(); g.translate(x + 50, y + 42); g.fillStyle = gold ? '#c9a04a' : color;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -10, -26, 0); g.quadraticCurveTo(-14, 2, -8, 8); g.lineTo(0, 4); g.lineTo(8, 8); g.quadraticCurveTo(14, 2, 26, 0); g.quadraticCurveTo(14, -10, 0, 0); g.fill(); g.restore();
      }
    } else { // 岁寒三友: pine, bamboo, plum branches
      g.lineWidth = 7;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(40 + i * 80, 500); g.bezierCurveTo(10 + i * 80, 360, 90 + i * 70, 220, 50 + i * 80, 20); g.stroke(); }
      g.lineWidth = 4;
      for (let i = 0; i < 40; i++) {
        const x = 20 + rnd() * 216, y = 30 + rnd() * 450;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 50, y - 20 - rnd() * 20); g.stroke();
        g.fillStyle = gold ? (i % 2 ? '#c9a04a' : '#c8556a') : color;
        g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      }
    }
    if (gold) { g.strokeStyle = '#c9a04a'; g.lineWidth = 3; g.strokeRect(16, 16, 224, 480); }
    return tex(c);
  });
}

// 琴剑瓶炉皆贴在墙上: board wall with flush recesses shaped like antiques.
function antiqueWallTex() {
  return once('antwall', () => {
    const [c, g] = canvas(512, 256);
    g.fillStyle = '#5b2c1c'; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(30,10,5,${0.15 + rnd() * 0.2})`; g.beginPath(); g.moveTo(0, rnd() * 256); g.lineTo(512, rnd() * 256); g.stroke(); }
    g.strokeStyle = '#c9a04a'; g.lineWidth = 3;
    const shape = (f) => { g.fillStyle = '#2a120a'; g.beginPath(); f(); g.fill(); g.stroke(); };
    shape(() => { g.ellipse(70, 128, 22, 96, 0, 0, 7); });                    // 琴
    shape(() => { g.rect(140, 28, 10, 190); g.rect(128, 60, 34, 8); });       // 剑
    shape(() => { g.ellipse(230, 150, 34, 44, 0, 0, 7); g.rect(218, 70, 24, 50); }); // 悬瓶
    shape(() => { g.rect(300, 120, 70, 40); g.rect(296, 160, 8, 30); g.rect(366, 160, 8, 30); g.rect(318, 104, 34, 18); }); // 炉
    shape(() => { g.rect(410, 40, 70, 120); g.rect(430, 160, 30, 40); });     // 桌屏
    // inlaid gold/jade dots: 金彩珠光
    for (let i = 0; i < 60; i++) { g.fillStyle = rnd() < 0.5 ? '#d8b25a' : '#7fb3a0'; g.beginPath(); g.arc(rnd() * 512, rnd() < 0.5 ? 8 : 248, 3, 0, 7); g.fill(); }
    return tex(c);
  });
}

// 护墙板 / 墙裙: framed wooden dado panels along the lower wall.
function wainscotTex(color) {
  return once('wain-' + color, () => {
    const [c, g] = canvas(256, 128);
    g.fillStyle = color; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`; g.beginPath(); g.moveTo(0, rnd() * 128); g.lineTo(256, rnd() * 128); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 124);
    g.strokeStyle = 'rgba(210,170,90,0.55)'; g.lineWidth = 2;
    for (const x of [14, 134]) g.strokeRect(x, 18, 108, 92);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 256, 8);
    return tex(c, true);
  });
}

function carpetTex() {
  return once('carpet', () => {
    const [c, g] = canvas(512, 256);
    g.fillStyle = '#8f1d1d'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 6; g.strokeRect(12, 12, 488, 232);
    g.fillStyle = '#1f3f5c'; g.fillRect(24, 24, 464, 18); g.fillRect(24, 214, 464, 18);
    for (let x = 30; x < 490; x += 28) { g.fillStyle = '#d8b25a'; g.beginPath(); g.arc(x, 33, 5, 0, 7); g.arc(x, 223, 5, 0, 7); g.fill(); }
    for (const cx of [128, 256, 384]) { // 团花 medallions
      g.fillStyle = '#c9a04a'; g.beginPath(); g.arc(cx, 128, 46, 0, 7); g.fill();
      g.fillStyle = '#8f1d1d'; g.beginPath(); g.arc(cx, 128, 36, 0, 7); g.fill();
      g.fillStyle = '#d8b25a'; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.ellipse(cx + Math.cos(a) * 20, 128 + Math.sin(a) * 20, 10, 5, a, 0, 7); g.fill(); }
    }
    return tex(c);
  });
}

function blindTex() { // 湘帘 / 虾须帘: fine bamboo slats
  return once('blind', () => {
    const [c, g] = canvas(64, 128);
    g.fillStyle = '#b39360'; g.fillRect(0, 0, 64, 128);
    for (let y = 0; y < 128; y += 3) { g.fillStyle = `rgba(80,55,30,${0.25 + rnd() * 0.2})`; g.fillRect(0, y, 64, 1); }
    return tex(c, true);
  });
}

function featherFanTex() { // 雉尾扇
  return once('fan', () => {
    const [c, g] = canvas(256, 256);
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#7a1d18'; g.beginPath(); g.ellipse(128, 128, 120, 110, 0, 0, 7); g.fill();
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (i / 26 - 0.5) * 2.6;
      g.strokeStyle = i % 2 ? '#c9a04a' : '#2f6b52'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(128, 220); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 104); g.stroke();
      g.fillStyle = '#1f3f5c'; g.beginPath(); g.arc(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 86, 6, 0, 7); g.fill();
    }
    g.fillStyle = '#d8b25a'; g.beginPath(); g.arc(128, 150, 26, 0, 7); g.fill();
    g.fillStyle = '#b3301f'; g.font = `bold 30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('福', 128, 151);
    return tex(c);
  });
}

function gauzeTex(color) { // embroidered bed gauze (葱绿双绣花卉草虫 / 青纱)
  return once('gauze-' + color, () => {
    const [c, g] = canvas(128, 256);
    g.fillStyle = color; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.2})`; g.beginPath(); g.arc(rnd() * 128, rnd() * 256, 3 + rnd() * 4, 0, 7); g.fill(); }
    for (let x = 0; x < 128; x += 9) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x, 0, 3, 256); }
    return tex(c, true);
  });
}

// ---------------------------------------------------------------- geometry helpers
function plane(w, h, m) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); }
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function put(parent, obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; parent.add(obj); return obj; }

// Slot for an AI furniture model; resolved by placeInteriorModels().
function slot(parent, model, x, y, z, ry, size) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z); o.rotation.y = ry;
  o.userData.interiorModel = { model, ...size };
  parent.add(o);
  return o;
}

// Open the centre bay: hide whatever closes it (door leaves of any construction) and show two
// leaves swung inward. Works whether or not the hall was built with openCenter: true.
function openDoor(g, { d, w, platform: y0, h }, bays) {
  const hall = g.parent || g;
  const bw = w / bays, zf = d / 2;
  hall.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(hall.matrixWorld).invert();
  const bb = new THREE.Box3(), m = new THREE.Matrix4();
  let leafMat = null, top = y0 + h - 0.75;
  hall.children.filter((c) => c !== g).forEach((c) => c.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    bb.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const cx = (bb.min.x + bb.max.x) / 2, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
    if (Math.abs(cx) < bw * 0.46 && bb.min.z > zf - 0.35 && bb.max.z < zf + 0.12 && sy > 1.0 && sz < 0.3 && bb.min.y < y0 + 0.6) {
      o.visible = false; leafMat ||= o.material; top = Math.min(top, bb.max.y);
    }
  }));
  const dw = bw * 0.82, ht = top - y0 - 0.15;
  const m2 = leafMat || mat({ color: '#6a2418' });
  for (const s of [-1, 1]) {
    const leaf = plane(dw / 2, ht, m2);
    leaf.geometry.translate(-s * dw / 4, 0, 0);
    leaf.position.set(s * dw / 2, y0 + 0.15 + ht / 2, zf - 0.12); leaf.rotation.y = -s * 1.3;
    g.add(leaf);
  }
  return dw;
}

// Shell common to all rooms: floor, ceiling, inner side of the front wall.
function shell(g, dims, { floor = 'grey', ceiling = 'paper', ceilY, wainscot = '#5a2e1e' } = {}) {
  const { w, d, h, platform: p } = dims;
  const fw = w - 0.32, fd = d - 0.34;
  if (wainscot) { // dado on the back and side walls, 0.95 m high
    const wt = wainscotTex(wainscot);
    const back = plane(fw, 0.95, mat({ map: wt.clone(), glow: 0.18 })); back.material.map.repeat.set(fw / 1.2, 1); back.material.map.needsUpdate = true;
    back.material.emissiveMap = back.material.map; put(g, back, 0, p + 0.475, -d / 2 + 0.16);
    for (const sx of [-1, 1]) {
      const side = plane(fd, 0.95, mat({ map: wt.clone(), glow: 0.18 })); side.material.map.repeat.set(fd / 1.2, 1); side.material.map.needsUpdate = true;
      side.material.emissiveMap = side.material.map; put(g, side, sx * (w / 2 - 0.16), p + 0.475, 0, -sx * Math.PI / 2);
    }
  }
  const ft = floorTex(floor);
  const fm = mat({ map: ft, roughness: floor === 'jinzhuan' ? 0.35 : 0.85, glow: 0.12 });
  ft.repeat.set(fw / (floor === 'earth' ? 3 : 1.6), fd / (floor === 'earth' ? 3 : 1.6));
  const fl = plane(fw, fd, fm); fl.rotation.x = -Math.PI / 2; put(g, fl, 0, p + 0.012, 0);
  const cy = ceilY ?? p + h - 0.78;
  if (ceiling) {
    const ct = ceilingTex(ceiling); ct.repeat.set(fw / (ceiling === 'paper' ? 2 : 1.3), fd / (ceiling === 'paper' ? 2 : 1.3));
    const cl = plane(fw, fd, mat({ map: ct, glow: 0.35 })); cl.rotation.x = Math.PI / 2; put(g, cl, 0, cy, 0);
  }
  return { fw, fd, cy, y0: p };
}

function scroll(g, key, x, y, z, ry, w, h, opts) {
  const m = plane(w, h, mat({ map: scrollTex(key, opts), glow: 0.3 }));
  m.userData.keepSeparate = true;
  return put(g, m, x, y, z, ry);
}
function couplet(g, text, x, y, z, ry, h) {
  const t = calligraphyTex(text);
  const m = plane(h * (120 / (110 * [...text].length + 60)), h, mat({ map: t, glow: 0.3 }));
  m.userData.keepSeparate = true;
  return put(g, m, x, y, z, ry);
}
function partition(g, motif, x, z, ry, w, h, y0, color, gold) {
  const m = plane(w, h, mat({ map: openworkTex(motif, color, gold), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, glow: 0.2 }));
  m.userData.keepSeparate = true;
  return put(g, m, x, y0 + h / 2, z, ry);
}
function blind(g, x, y, z, w) { // rolled-up bamboo blind over a doorway
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, w, 10), mat({ map: blindTex(), glow: 0.2 }));
  r.rotation.z = Math.PI / 2; put(g, r, x, y, z);
  for (const s of [-1, 1]) put(g, box(0.02, 0.35, 0.02, mat({ color: '#b3301f' })), x + s * w * 0.35, y + 0.1, z + 0.08);
}
function gauzeBed(g, x, z, ry, y0, color, len = 2.1, dep = 1.4) {
  // Plain bed with hanging gauze curtains (蘅芜苑 青纱帐幔).
  const grp = new THREE.Group();
  const wood = mat({ color: '#5a3a24', roughness: 0.6 });
  put(grp, box(len, 0.45, dep, wood), 0, 0.225, 0);
  put(grp, box(len - 0.1, 0.12, dep - 0.1, mat({ color: '#d9d4c4' })), 0, 0.51, 0);
  put(grp, box(0.5, 0.14, 0.35, mat({ color: '#c9c3b0' })), -len / 2 + 0.4, 0.62, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(grp, box(0.07, 2.2, 0.07, wood), sx * len / 2, 1.1, sz * dep / 2);
  put(grp, box(len + 0.1, 0.06, dep + 0.1, wood), 0, 2.2, 0);
  const gz = mat({ map: gauzeTex(color), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, glow: 0.3 });
  for (const sz of [-1, 1]) { const c = plane(len, 1.7, gz); c.userData.keepSeparate = true; put(grp, c, 0, 1.3, sz * dep / 2); }
  for (const sx of [-1, 1]) { const c = plane(dep, 1.7, gz); c.userData.keepSeparate = true; put(grp, c, sx * len / 2, 1.3, 0, Math.PI / 2); }
  put(g, grp, x, y0, z, ry);
}

// ---------------------------------------------------------------- rooms
// Model target sizes (metres): h = height; len = cap on the longest horizontal side.
const SZ = {
  f_shujia: { h: 2.0, len: 1.1 }, f_shuan: { h: 0.95, len: 1.6 }, f_quanyi: { h: 1.0 }, f_qinzhuo: { h: 0.8, len: 1.5 },
  f_dashian: { h: 1.15, len: 2.6 }, f_huanang: { h: 0.95 }, f_fopan: { h: 1.15 }, f_qing: { h: 1.35 },
  f_babuchuang: { h: 2.4, len: 2.3 }, f_duobaoge: { h: 2.1, len: 1.7 }, f_jingzi: { h: 2.2, len: 1.2 }, f_baozuo: { h: 3.3, len: 4.4 },
  f_suan: { h: 1.15, len: 1.3 }, f_muta: { h: 0.9, len: 2.0 }, ding: { h: 0.6 },
};
const S = (name, extra) => ({ ...SZ[name], ...extra });

const ROOMS = {
  // 潇湘馆: 一明两暗；窗下案上设着笔砚；书架上磊着满满的书；湘帘
  xiaoxiang(g, dims) {
    const { w, d } = dims, bw = w / 3;
    const { y0, cy } = shell(g, dims, { floor: 'grey', ceiling: 'paper', wainscot: '#3d4a36' });
    openDoor(g, dims, 3);
    blind(g, 0, cy - 0.1, d / 2 - 0.2, bw * 0.8);
    // 碧纱橱 between the bright centre bay and the two dark side bays
    for (const sx of [-1, 1]) {
      partition(g, 'grid', sx * bw / 2, -d / 4 + 0.2, Math.PI / 2, d / 2 - 0.4, cy - y0, y0, '#2f4a35');
      partition(g, 'grid', sx * bw / 2, d / 4 - 0.2, Math.PI / 2, d / 2 - 0.4, cy - y0, y0, '#2f4a35');
    }
    // centre bay: qin table and an ink landscape on the back wall
    slot(g, 'f_qinzhuo', 0, y0, -d / 2 + 0.75, 0, S('f_qinzhuo'));
    scroll(g, 'xiaoxiang', 0, y0 + 1.75, -d / 2 + 0.17, 0, 0.8, 1.9);
    // east dark bay: study — desk under the front window, bookcases along the back
    slot(g, 'f_shuan', bw, y0, d / 2 - 0.8, Math.PI, S('f_shuan'));
    slot(g, 'f_quanyi', bw, y0, d / 2 - 1.55, 0, S('f_quanyi'));
    slot(g, 'f_shujia', bw - 0.6, y0, -d / 2 + 0.45, 0, S('f_shujia'));
    slot(g, 'f_shujia', bw + 0.6, y0, -d / 2 + 0.45, 0, S('f_shujia'));
    // west dark bay: her chair by the window and a bed
    slot(g, 'f_quanyi', -bw + 0.3, y0, d / 2 - 1.0, Math.PI * 0.85, S('f_quanyi'));
    gauzeBed(g, -bw, -d / 2 + 1.0, 0, y0, '#7fa08a', 1.9, 1.2);
  },

  // 秋爽斋·晓翠堂: 三间不隔断；花梨大理石大案；汝窑花囊；米襄阳烟雨图 + 颜鲁公联；佛手；比目磬；拔步床
  qiushuang(g, dims) {
    const { w, d } = dims;
    const { y0, cy } = shell(g, dims, { floor: 'jinzhuan', ceiling: 'paper' });
    openDoor(g, dims, 3);
    blind(g, 0, cy - 0.1, d / 2 - 0.2, w / 3 * 0.8);
    slot(g, 'f_dashian', -0.6, y0, -0.4, 0, S('f_dashian'));
    slot(g, 'ding', -0.4, y0 + 1.0, -0.5, 0, S('ding', { h: 0.38 }));
    slot(g, 'f_quanyi', -0.6, y0, -1.45, 0, S('f_quanyi'));
    slot(g, 'f_huanang', 1.5, y0, -0.9, 0, S('f_huanang'));
    // 西墙上当中挂一大幅米襄阳《烟雨图》，左右挂一副对联
    const xw = -w / 2 + 0.17;
    scroll(g, 'yanyu', xw, y0 + 1.8, 0, Math.PI / 2, 1.3, 2.6, { misty: true, w: 360, h: 720 });
    // facing the west wall the viewer's right is -z: 上联 hangs there
    couplet(g, '煙霞閒骨格', xw, y0 + 1.85, -1.3, Math.PI / 2, 2.2);
    couplet(g, '泉石野生涯', xw, y0 + 1.85, 1.3, Math.PI / 2, 2.2);
    // 左边紫檀架大观窑大盘佛手；右边洋漆架白玉比目磬
    slot(g, 'f_fopan', -w / 2 + 1.0, y0, -d / 2 + 0.6, 0, S('f_fopan'));
    slot(g, 'f_qing', -w / 2 + 2.3, y0, -d / 2 + 0.6, 0, S('f_qing'));
    // 东边便设着卧榻，拔步床上悬着葱绿双绣花卉草虫的纱帐
    slot(g, 'f_babuchuang', w / 2 - 1.5, y0, -d / 2 + 1.35, -Math.PI / 2, S('f_babuchuang'));
  },

  // 蘅芜苑: 雪洞一般，一色玩器全无；土定瓶菊花、两部书、茶奁茶杯；青纱帐幔
  hengwu(g, dims) {
    const { w, d } = dims;
    const { y0, cy } = shell(g, dims, { floor: 'grey', ceiling: 'paper', wainscot: null });
    openDoor(g, dims, 5);
    // whiten the inner walls: an almost white plaster skin
    const snow = mat({ color: '#d4d1c6', glow: 0.02, roughness: 0.95 });
    put(g, plane(w - 0.34, cy - y0, snow), 0, y0 + (cy - y0) / 2, -d / 2 + 0.16);
    for (const sx of [-1, 1]) put(g, plane(d - 0.34, cy - y0, snow), sx * (w / 2 - 0.16), y0 + (cy - y0) / 2, 0, -sx * Math.PI / 2);
    slot(g, 'f_suan', 0, y0, -d / 2 + 0.75, 0, S('f_suan'));
    for (const sx of [-1, 1]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.45, 12), mat({ color: '#e9e6dc' })), sx * 1.0, y0 + 0.225, -d / 2 + 1.4);
    gauzeBed(g, w / 2 - 1.6, -d / 2 + 1.0, 0, y0, '#9fbcc0', 2.0, 1.4);
  },

  // 怡红院: 雕空玲珑木板隔断、多宝格、琴剑瓶炉贴墙、玻璃大镜、美人画、精致床帐、碧绿凿花砖
  yihong(g, dims) {
    const { w, d } = dims, bw = w / 5;
    const { y0, cy } = shell(g, dims, { floor: 'bilu', ceiling: 'jingkou' });
    openDoor(g, dims, 5);
    const H = cy - y0;
    // carved openwork partitions dividing the bays (四面皆是雕空玲珑木板)
    const motifs = ['cloud', 'pine', 'wan', 'cloud'];
    [-1.5, -0.5, 0.5, 1.5].forEach((k, i) => {
      if (Math.abs(k) === 0.5) { // 落地罩 with a moon opening near the centre: two narrow panels
        partition(g, motifs[i], k * bw, -d / 2 + 1.0, Math.PI / 2, 1.6, H, y0, '#5a2a1c', true);
        partition(g, motifs[i], k * bw, d / 2 - 1.0, Math.PI / 2, 1.6, H, y0, '#5a2a1c', true);
      } else {
        partition(g, motifs[i], k * bw, -d / 4, Math.PI / 2, d / 2 - 0.2, H, y0, '#5a2a1c', true);
      }
    });
    // 多宝格 as partitions on the inner bays
    slot(g, 'f_duobaoge', 1.5 * bw, y0, d / 4 - 0.1, -Math.PI / 2, S('f_duobaoge'));
    slot(g, 'f_duobaoge', -1.5 * bw, y0, d / 4 - 0.1, Math.PI / 2, S('f_duobaoge'));
    // 满墙满壁，皆系随依古董玩器之形抠成的槽子 — the back wall of the centre three bays
    const aw = plane(bw * 3 - 0.3, H * 0.6, mat({ map: antiqueWallTex(), glow: 0.3 }));
    aw.userData.keepSeparate = true; put(g, aw, 0, y0 + H * 0.55, -d / 2 + 0.17);
    // 迎面一个女孩儿……原来是一幅画儿 — painted girl facing the door
    const lady = plane(0.9, 2.2, mat({ map: ladyTex(), glow: 0.3 })); lady.userData.keepSeparate = true;
    put(g, lady, 0, y0 + 1.25, -d / 2 + 0.19);
    // 玻璃大镜 in a zitan board wall (west inner bay)
    slot(g, 'f_jingzi', -bw, y0, -d / 2 + 0.5, 0, S('f_jingzi'));
    // 最精致的床帐 (east inner bay) and the incense 鼎 with its cover
    slot(g, 'f_babuchuang', 2 * bw - 0.2, y0, -d / 2 + 1.4, -Math.PI / 2, S('f_babuchuang'));
    slot(g, 'ding', bw * 0.6, y0, 0.6, 0, S('ding', { h: 0.55 }));
    // 葱绿撒花软帘 on the small inner door
    const curtain = plane(1.0, 2.1, mat({ map: gauzeTex('#5f8f4a'), side: THREE.DoubleSide, glow: 0.3 }));
    curtain.userData.keepSeparate = true; put(g, curtain, -bw * 2 + 0.2, y0 + 1.05, -d / 2 + 0.9, Math.PI / 2);
    // 锦笼纱罩: a pair of silk-shaded table lamps (emissive)
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8), mat({ color: '#f2d8a0', glow: 1.2 }));
      put(g, lamp, sx * bw * 0.7, y0 + 1.2, -d / 2 + 0.6);
      put(g, box(0.5, 0.95, 0.4, mat({ color: '#4a2416' })), sx * bw * 0.7, y0 + 0.475, -d / 2 + 0.6);
    }
  },

  // 稻香村: 纸窗木榻，富贵气象一洗皆尽
  daoxiang(g, dims) {
    const { w, d } = dims;
    const { y0 } = shell(g, dims, { floor: 'earth', ceiling: null, wainscot: null });
    openDoor(g, dims, 3);
    const mat2 = mat({ color: '#b9a36a', roughness: 1 }); // 草席
    const mt2 = plane(2.4, 1.6, mat2); mt2.rotation.x = -Math.PI / 2; put(g, mt2, 0, y0 + 0.02, 0);
    slot(g, 'f_muta', -w / 2 + 1.6, y0, -d / 2 + 0.8, 0, S('f_muta'));
    const wood = mat({ color: '#8a6a44', roughness: 0.9 });
    // 素木方桌 + 条凳
    const t = new THREE.Group();
    put(t, box(1.0, 0.06, 1.0, wood), 0, 0.78, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(t, box(0.07, 0.78, 0.07, wood), sx * 0.44, 0.39, sz * 0.44);
    for (const sz of [-1, 1]) { put(t, box(1.1, 0.05, 0.25, wood), 0, 0.45, sz * 0.8); for (const sx of [-1, 1]) put(t, box(0.05, 0.45, 0.2, wood), sx * 0.45, 0.225, sz * 0.8); }
    put(g, t, 0.6, y0, -0.3);
    // 蓑衣斗笠, 锄头 on the back wall
    const straw = mat({ color: '#9c8452', roughness: 1 });
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 10, 1, true), straw); put(g, cape, w / 2 - 1.2, y0 + 1.35, -d / 2 + 0.4);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.18, 14), straw); put(g, hat, w / 2 - 1.2, y0 + 2.0, -d / 2 + 0.4);
    const hoe = new THREE.Group(); put(hoe, box(0.04, 1.5, 0.04, wood), 0, 0.75, 0); put(hoe, box(0.22, 0.14, 0.03, mat({ color: '#555' })), 0.06, 1.45, 0.03);
    hoe.rotation.z = 0.12; put(g, hoe, w / 2 - 2.0, y0 + 0.2, -d / 2 + 0.25, 0);
  },

  // 顾恩思义殿: 帘卷虾须，毯铺鱼獭，鼎飘麝脑之香，屏列雉尾之扇
  zhengdian(g, dims) {
    const { w, d } = dims;
    const { y0, cy } = shell(g, dims, { floor: 'jinzhuan', ceiling: 'jingkou' });
    openDoor(g, dims, 7);
    // two rows of interior 金柱
    const colM = mat({ color: '#8e2b20', roughness: 0.5, glow: 0.15 });
    for (const z of [-d / 6, d / 6]) for (let i = 1; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, cy - y0, 14), colM);
      put(g, c, -w / 2 + i * (w / 7), y0 + (cy - y0) / 2, z);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.25, 14), mat({ color: '#d6d2c4' })), -w / 2 + i * (w / 7), y0 + 0.125, z);
    }
    // throne with screen on a low dais
    put(g, box(6, 0.3, 3.2, mat({ color: '#6b2a1c', roughness: 0.5 })), 0, y0 + 0.15, -d / 2 + 2.2);
    slot(g, 'f_baozuo', 0, y0 + 0.3, -d / 2 + 2.0, 0, S('f_baozuo'));
    // 屏列雉尾之扇: a pair of ceremonial pheasant-feather fans
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.4, 8), mat({ color: '#b3301f' }));
      put(g, pole, sx * 2.9, y0 + 1.7, -d / 2 + 2.2);
      const fan = plane(1.6, 1.6, mat({ map: featherFanTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, glow: 0.3 }));
      fan.userData.keepSeparate = true; put(g, fan, sx * 2.9, y0 + 3.6, -d / 2 + 2.2);
    }
    // 毯铺鱼獭: red carpet from the door to the dais
    const ct = carpetTex();
    const rug = plane(4.2, d - 3.6, mat({ map: ct, roughness: 1, glow: 0.18 })); rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2;
    rug.geometry.rotateZ(0); put(g, rug, 0, y0 + 0.02, 1.4);
    // 鼎飘麝脑之香
    slot(g, 'ding', 0, y0, -d / 2 + 4.6, 0, S('ding', { h: 1.2 }));
    // floor-standing palace lanterns
    for (const sx of [-1, 1]) {
      const lg = new THREE.Group();
      put(lg, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), mat({ color: '#6b2a1c' })), 0, 0.9, 0);
      put(lg, new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 6), mat({ color: '#f2d090', glow: 1.3 })), 0, 2.1, 0);
      put(lg, new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 6), mat({ color: '#c9a04a' })), 0, 2.44, 0);
      put(lg, new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 6), mat({ color: '#c9a04a' })), 0, 1.78, 0);
      put(g, lg, sx * 4.4, y0, -d / 2 + 3.4);
    }
    // 帘卷虾须: rolled fine bamboo blinds over every front bay
    for (let i = 0; i < 7; i++) blind(g, -w / 2 + (i + 0.5) * (w / 7), cy - 0.12, d / 2 - 0.22, w / 7 * 0.8);
  },
};

export const ROOM_IDS = Object.keys(ROOMS);

export function furnish(roomId, hallGroup, dims) {
  const f = ROOMS[roomId];
  if (!f) return null;
  const g = new THREE.Group(); g.name = 'interior-' + roomId;
  hallGroup.add(g);
  f(g, dims);
  g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  return g;
}

// ---------------------------------------------------------------- models
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const modelCache = {};
function loadModel(name) {
  return (modelCache[name] ||= loader.loadAsync(`./models/${name}.json`).then((gl) => {
    const s = gl.scene;
    s.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = true;
      const m = o.material;
      if (m) {
        m.metalness = 0; m.metalnessMap = null; m.roughness = Math.max(m.roughness ?? 1, 0.55);
        if (m.map) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = GLOW + 0.05; }
      }
    });
    return { scene: s, box: new THREE.Box3().setFromObject(s) };
  }).catch((e) => { console.warn('interior model failed', name, e); return null; }));
}

export async function placeInteriorModels(root, scene) {
  root.updateMatrixWorld(true);
  const slots = [];
  root.traverse((o) => { if (o.userData.interiorModel) slots.push(o); });
  const group = new THREE.Group(); group.name = 'interior-models';
  scene.add(group);
  await Promise.all(slots.map(async (sl) => {
    const spec = sl.userData.interiorModel;
    const res = await loadModel(spec.model);
    if (!res) return;
    const obj = res.scene.clone(true);
    const size = res.box.getSize(new THREE.Vector3());
    let k = spec.h / size.y;
    if (spec.len) k = Math.min(k, spec.len / Math.max(size.x, size.z));
    obj.scale.setScalar(k);
    const c = res.box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x * k, -res.box.min.y * k, -c.z * k);
    const turn = new THREE.Group(); turn.rotation.y = -Math.PI / 2; turn.add(obj); // Tripo meshes face +x
    const holder = new THREE.Group(); holder.add(turn);
    sl.matrixWorld.decompose(holder.position, holder.quaternion, holder.scale);
    group.add(holder);
  }));
  return group;
}
