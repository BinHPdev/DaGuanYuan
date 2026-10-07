// Canvas-generated textures: roof tiles, lattice windows, plaques, couplets, painted beams, leaves.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Roof tiles: vertical rows of semicylindrical tubes (筒瓦) running down the slope.
export function tileTexture(base = '#4a4f55') {
  const [c, g] = canvas(128, 128);
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    const x = i * 32;
    const grad = g.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grad; g.fillRect(x + 4, 0, 24, 128);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 1.5);
  return tex(c);
}

export function thatchTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#9c8452'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    g.strokeStyle = `rgba(${60 + Math.random() * 80},${50 + Math.random() * 60},${20 + Math.random() * 30},0.5)`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y + 6 + Math.random() * 8); g.stroke();
  }
  return tex(c);
}

// 步步锦 style lattice with paper behind.
export function latticeTexture(frame = '#5a2a1c', paper = '#efe6cf') {
  const [c, g] = canvas(128, 256);
  g.fillStyle = paper; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = frame; g.lineWidth = 4;
  g.strokeRect(2, 2, 124, 252);
  g.lineWidth = 2.5;
  const cell = 16;
  for (let y = 8; y < 200; y += cell) {
    for (let x = 8; x < 120; x += cell) {
      const off = ((y / cell) | 0) % 2 ? cell / 2 : 0;
      g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off, y + cell * 0.6); g.stroke();
      g.beginPath(); g.moveTo(x, y + cell * 0.6); g.lineTo(x + cell * 0.7, y + cell * 0.6); g.stroke();
    }
  }
  // 裙板 (lower solid panel)
  g.fillStyle = frame; g.fillRect(0, 200, 128, 56);
  g.strokeStyle = '#a6763a'; g.lineWidth = 2; g.strokeRect(14, 212, 100, 32);
  return tex(c, false);
}

// Painted beam band (青绿彩画, simplified 旋子 pattern).
export function beamTexture() {
  const [c, g] = canvas(256, 32);
  g.fillStyle = '#2d5a6b'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#3f7d5c'; g.fillRect(0, 8, 256, 16);
  for (let x = 0; x < 256; x += 64) {
    g.fillStyle = '#c8a24a';
    g.beginPath(); g.ellipse(x + 32, 16, 20, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2d5a6b';
    g.beginPath(); g.ellipse(x + 32, 16, 13, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8e2d0';
    g.fillRect(x, 0, 4, 32);
  }
  g.fillStyle = '#c8a24a'; g.fillRect(0, 0, 256, 2); g.fillRect(0, 30, 256, 2);
  return tex(c);
}

export function tigerStoneTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#d9d2c3'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 128, r = 10 + Math.random() * 14;
    g.fillStyle = `hsl(${30 + Math.random() * 20},${15 + Math.random() * 20}%,${40 + Math.random() * 25}%)`;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.5;
      const rr = r * (0.7 + Math.random() * 0.4);
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7);
    }
    g.closePath(); g.fill();
  }
  return tex(c);
}

export function brickTexture(base = '#8d8f8c') {
  const [c, g] = canvas(128, 64);
  g.fillStyle = base; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(230,230,225,0.7)'; g.lineWidth = 1.5;
  for (let y = 0; y < 64; y += 8) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    const off = (y / 8) % 2 ? 16 : 0;
    for (let x = off; x < 128; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); }
  }
  return tex(c);
}

const FONT = '"Kaiti SC","STKaiti","KaiTi","Songti SC","Noto Serif SC","Noto Serif CJK SC",serif';

// Horizontal plaque (匾额), written left-to-right so modern readers are not misled.
export function plaqueTexture(text, { bg = '#1d2b3a', fg = '#d8b25a' } = {}) {
  const chars = [...text];
  const n = chars.length;
  const [c, g] = canvas(140 * n + 60, 190);
  g.fillStyle = '#6b3a1e'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg; g.fillRect(8, 8, c.width - 16, c.height - 16);
  g.fillStyle = bg; g.fillRect(16, 16, c.width - 32, c.height - 32);
  g.fillStyle = fg; g.font = `bold 118px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((ch, i) => g.fillText(ch, 30 + 140 * i + 70, 100));
  const t = tex(c, false);
  t.userData = { aspect: c.width / c.height };
  return t;
}

// Vertical couplet board (楹联).
export function coupletTexture(text, { bg = '#20160f', fg = '#d8b25a', border = '#b38b45' } = {}) {
  const chars = [...text];
  const [c, g] = canvas(110, 104 * chars.length + 40);
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = fg; g.font = `bold 84px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((ch, i) => g.fillText(ch, 55, 20 + 104 * i + 52));
  const t = tex(c, false);
  t.userData = { aspect: c.width / c.height };
  return t;
}

// Leaf cards with alpha.
export function leafTexture(kind) {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  if (kind === 'bamboo') {
    for (let i = 0; i < 40; i++) {
      const x = 10 + Math.random() * 108, y = 10 + Math.random() * 108;
      const a = Math.PI * (0.55 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1) + Math.PI / 2;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `hsl(${90 + Math.random() * 25},${45 + Math.random() * 20}%,${38 + Math.random() * 18}%)`;
      g.beginPath(); g.ellipse(0, 0, 15, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  } else if (kind === 'willow') {
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 128;
      g.strokeStyle = `hsl(${75 + Math.random() * 20},${45 + Math.random() * 20}%,${38 + Math.random() * 15}%)`;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y < 128; y += 4) {
        const xx = x + Math.sin(y * 0.05 + i) * 2;
        g.lineTo(xx, y);
        if (y % 8 === 0) { g.moveTo(xx, y); g.lineTo(xx + 3, y + 3); g.moveTo(xx, y); }
      }
      g.stroke();
    }
  } else if (kind === 'reed') {
    // 芦苇: slender stems, ribbon leaves, and feathery plumes made of fine hair-strokes (no solid blobs)
    for (let i = 0; i < 16; i++) {
      const x = 8 + Math.random() * 112, top = 8 + Math.random() * 30, lean = (Math.random() - 0.5) * 14;
      g.strokeStyle = `hsl(${48 + Math.random() * 12},${30 + Math.random() * 15}%,${45 + Math.random() * 15}%)`;
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + lean * 0.3, 70, x + lean, top + 16); g.stroke();
      // a couple of narrow leaves
      for (let k = 0; k < 2; k++) {
        const ly = 70 + Math.random() * 40, dir = Math.random() < 0.5 ? -1 : 1;
        g.beginPath(); g.moveTo(x + lean * 0.2, ly); g.quadraticCurveTo(x + dir * 10, ly - 12, x + dir * 18, ly - 4); g.stroke();
      }
      // plume: a fan of fine hairs drooping to one side
      for (let h = 0; h < 22; h++) {
        const a = -Math.PI / 2 + (Math.random() - 0.3) * 1.1, len = 6 + Math.random() * 12;
        g.strokeStyle = `rgba(${225 + Math.random() * 25},${215 + Math.random() * 25},${195 + Math.random() * 30},${0.75 + Math.random() * 0.25})`;
        g.lineWidth = 0.7;
        const sx = x + lean + (Math.random() - 0.5) * 3, sy = top + 16 - Math.random() * 14;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * len * 0.6 + lean * 0.15, sy + Math.sin(a) * len * 0.5 + len * 0.4); g.stroke();
      }
    }
  } else if (kind === 'banana') {
    g.fillStyle = '#4f8a2e';
    g.beginPath(); g.moveTo(64, 128); g.bezierCurveTo(0, 90, 10, 20, 64, 0); g.bezierCurveTo(118, 20, 128, 90, 64, 128); g.fill();
    g.strokeStyle = '#7fb24a'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 128); g.lineTo(64, 2); g.stroke();
    g.strokeStyle = 'rgba(30,70,20,0.5)'; g.lineWidth = 1;
    for (let y = 10; y < 120; y += 6) { g.beginPath(); g.moveTo(64, y); g.lineTo(18, y - 12); g.moveTo(64, y); g.lineTo(110, y - 12); g.stroke(); }
  }
  const t = tex(c, false);
  return t;
}

// ---------------------------------------------------------------- v0.2 detail textures
// Eave fascia seen from outside: a row of round tile-ends (瓦当) over drip tiles (滴水).
export function eaveTexture(base = '#3e4348') {
  const [c, g] = canvas(256, 32);
  g.fillStyle = '#2b2f33'; g.fillRect(0, 0, 256, 32);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = base;
    g.beginPath(); g.arc(x + 8, 11, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + 8, 11, 4, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#34383d';
    g.beginPath(); g.moveTo(x + 17, 6); g.lineTo(x + 31, 6); g.lineTo(x + 24, 26); g.closePath(); g.fill();
  }
  return tex(c);
}

// Roof underside: rafters (椽子) in red-brown with blue-green painted rafter heads at the eave edge.
export function soffitTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#4a2b20'; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 12, 0);
    gr.addColorStop(0, '#6b3a28'); gr.addColorStop(0.5, '#8a4a30'); gr.addColorStop(1, '#5a3122');
    g.fillStyle = gr; g.fillRect(x + 2, 0, 11, 128);
  }
  g.fillStyle = 'rgba(30,50,60,0.25)';
  for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 2);
  return tex(c);
}

// 隔扇 door leaves: four leaves, lattice upper part (格心), panelled lower part (裙板).
export function doorTexture(frame = '#6a2418', paper = '#efe6cf') {
  const [c, g] = canvas(256, 256);
  g.fillStyle = frame; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) {
    const x = i * 64;
    g.fillStyle = paper; g.fillRect(x + 7, 10, 50, 140);
    g.strokeStyle = frame; g.lineWidth = 2.5;
    for (let y = 18; y < 150; y += 12) { g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 57, y); g.stroke(); }
    for (let xx = x + 15; xx < x + 57; xx += 10) { g.beginPath(); g.moveTo(xx, 10); g.lineTo(xx, 150); g.stroke(); }
    g.fillStyle = '#7d2c1c'; g.fillRect(x + 7, 160, 50, 12);
    g.fillStyle = '#5a1e14'; g.fillRect(x + 7, 180, 50, 66);
    g.strokeStyle = '#b8863b'; g.lineWidth = 2; g.strokeRect(x + 13, 188, 38, 50);
    g.fillStyle = '#b8863b'; g.beginPath(); g.arc(x + (i % 2 ? 9 : 55), 150, 2.5, 0, 7); g.fill();
  }
  return tex(c, false);
}

// 倒挂楣子: open lattice band hung under the eave beam (alpha).
export function hangingLatticeTexture(color = '#7a2a1c') {
  const [c, g] = canvas(256, 48);
  g.clearRect(0, 0, 256, 48);
  g.strokeStyle = color; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 45);
  for (let x = 0; x < 256; x += 24) {
    g.strokeRect(x + 4, 8, 16, 14); g.beginPath(); g.moveTo(x + 12, 22); g.lineTo(x + 12, 40); g.stroke();
    g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 24, 40); g.stroke();
  }
  const t = tex(c); return t;
}

// 漏窗 (decorative wall window): grey tile lattice in a white frame.
export function louchuangTexture(kind = 0) {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#f1eee6'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2f3336';
  g.beginPath();
  if (kind % 3 === 0) g.arc(64, 64, 50, 0, Math.PI * 2);
  else if (kind % 3 === 1) { g.moveTo(64, 10); g.lineTo(118, 64); g.lineTo(64, 118); g.lineTo(10, 64); g.closePath(); }
  else g.rect(16, 22, 96, 84);
  g.fill();
  g.save(); g.clip();
  g.strokeStyle = '#bfc3c0'; g.lineWidth = 5;
  for (let i = -128; i < 256; i += 18) {
    if (kind % 2) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
    else { for (let y = 0; y < 128; y += 18) { g.beginPath(); g.arc(i, y + ((i / 18) % 2 ? 9 : 0), 9, 0, Math.PI); g.stroke(); } }
  }
  g.restore();
  g.strokeStyle = '#d9d4c7'; g.lineWidth = 6; g.stroke();
  return tex(c, false);
}

// Courtyard paving: square grey bricks (方砖墁地).
export function pavingTexture(base = '#a7a59c') {
  const [c, g] = canvas(128, 128);
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
    g.fillStyle = `hsl(40,6%,${58 + Math.random() * 10}%)`; g.fillRect(x + 1, y + 1, 30, 30);
  }
  return tex(c);
}

// 石子漫成甬路: pebble mosaic path with a border.
export function pebbleTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#8f8a7e'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    g.fillStyle = `hsl(${30 + Math.random() * 20},${8 + Math.random() * 10}%,${50 + Math.random() * 30}%)`;
    g.beginPath(); g.ellipse(x, y, 2 + Math.random() * 2, 1.4 + Math.random() * 1.2, Math.random() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = '#5d5a52'; g.lineWidth = 6;
  for (let y = 0; y < 128; y += 64) { g.beginPath(); g.moveTo(0, y + 32); g.quadraticCurveTo(32, y, 64, y + 32); g.quadraticCurveTo(96, y + 64, 128, y + 32); g.stroke(); }
  g.fillStyle = '#6e6a60'; g.fillRect(0, 0, 6, 128); g.fillRect(122, 0, 6, 128);
  return tex(c);
}

// Painted beam with 旋子 ends and a central 包袱 (Suzhou-style landscape panel).
export function richBeamTexture() {
  const [c, g] = canvas(512, 64);
  g.fillStyle = '#244f5e'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#2f6b52'; g.fillRect(0, 14, 512, 36);
  // 箍头 and 旋子 at both ends
  for (const x0 of [0, 400]) {
    g.fillStyle = '#c8a24a'; g.fillRect(x0 + 6, 0, 6, 64); g.fillRect(x0 + 100, 0, 6, 64);
    for (let k = 0; k < 3; k++) {
      g.fillStyle = k % 2 ? '#e7dcc0' : '#2b5d7a';
      g.beginPath(); g.ellipse(x0 + 56, 32, 34 - k * 9, 22 - k * 6, 0, 0, 7); g.fill();
    }
    g.fillStyle = '#c8a24a'; g.beginPath(); g.arc(x0 + 56, 32, 5, 0, 7); g.fill();
  }
  // 包袱: semicircular panel with a little landscape
  g.fillStyle = '#efe6cf';
  g.beginPath(); g.moveTo(170, 0); g.lineTo(342, 0); g.quadraticCurveTo(342, 70, 256, 62); g.quadraticCurveTo(170, 70, 170, 0); g.fill();
  g.strokeStyle = '#c8a24a'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#7f9a8a';
  g.beginPath(); g.moveTo(186, 40); g.lineTo(210, 14); g.lineTo(232, 38); g.lineTo(255, 20); g.lineTo(290, 44); g.lineTo(186, 44); g.fill();
  g.fillStyle = '#5a7a6a'; g.beginPath(); g.moveTo(250, 46); g.lineTo(285, 22); g.lineTo(326, 46); g.fill();
  g.fillStyle = '#b3473a'; g.fillRect(232, 34, 10, 6);
  g.fillStyle = '#c8a24a'; g.fillRect(0, 0, 512, 3); g.fillRect(0, 61, 512, 3);
  return tex(c);
}

// Foliage cluster cards (white/grey so vertex colours tint them). kind: leaf | blossom | needle | willow
export function foliageTexture(kind = 'leaf') {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  const R = (a, b) => a + Math.random() * (b - a);
  // keep clusters roughly round so card edges never show
  const inside = (x, y) => Math.hypot(x - 128, y - 128) < 112 * (0.75 + 0.25 * Math.random());
  if (kind === 'needle') {
    for (let i = 0; i < 260; i++) {
      const x = R(20, 236), y = R(20, 236); if (!inside(x, y)) continue;
      const v = R(150, 255); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.6;
      for (let k = 0; k < 7; k++) { const a = R(0, 6.28); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
    }
  } else if (kind === 'willow') {
    for (let i = 0; i < 70; i++) {
      const x = R(10, 246), len = R(120, 250); const v = R(170, 255);
      g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y < len; y += 5) { const xx = x + Math.sin(y * 0.03 + i) * 3; g.lineTo(xx, y); g.moveTo(xx, y); g.lineTo(xx + 3, y + 4); g.moveTo(xx, y); }
      g.stroke();
    }
  } else {
    for (let i = 0; i < 520; i++) {
      const x = R(16, 240), y = R(16, 240); if (!inside(x, y)) continue;
      const v = R(140, 255);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.save(); g.translate(x, y); g.rotate(R(0, 6.28));
      if (kind === 'blossom' && Math.random() < 0.75) {
        for (let k = 0; k < 5; k++) { g.rotate(1.2566); g.beginPath(); g.ellipse(0, 3.2, 2.2, 3.4, 0, 0, 7); g.fill(); }
      } else { g.beginPath(); g.ellipse(0, 0, R(4, 7), R(2, 3.2), 0, 0, 7); g.fill(); }
      g.restore();
    }
  }
  const t = tex(c, false);
  return t;
}

// ================================================================ v0.3 PBR-ish procedural materials
// Value-noise fbm for canvas generation (deterministic per seed).
function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  let s = seed * 9973 + 17;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = Array.from({ length: 256 }, (_, i) => i).sort(() => r() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h) => (h / 255) * 2 - 1;
  const n2 = (x, y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = grad(perm[perm[xi] + yi]), b = grad(perm[perm[xi + 1] + yi]), c = grad(perm[perm[xi] + yi + 1]), d = grad(perm[perm[xi + 1] + yi + 1]);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  // periodic fbm over [0,period)
  return (x, y, oct = 4, period = 8) => {
    let amp = 0.5, f = 1, sum = 0;
    for (let o = 0; o < oct; o++) {
      const P = period * f;
      const xx = ((x * f) % P + P) % P, yy = ((y * f) % P + P) % P;
      // tileable via 4-corner blend
      const fx = xx / P, fy = yy / P;
      const v = n2(xx, yy) * (1 - fx) * (1 - fy) + n2(xx - P, yy) * fx * (1 - fy) + n2(xx, yy - P) * (1 - fx) * fy + n2(xx - P, yy - P) * fx * fy;
      sum += v * amp; amp *= 0.5; f *= 2;
    }
    return sum;
  };
}

// Height (Float32Array, w×h, wraps) -> tangent-space normal map texture.
function normalFromHeight(H, w, h, strength = 2) {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hl = H[y * w + ((x - 1 + w) % w)], hr = H[y * w + ((x + 1) % w)];
    const hu = H[((y - 1 + h) % h) * w + x], hd = H[((y + 1) % h) * w + x];
    let nx = (hl - hr) * strength, ny = (hd - hu) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (y * w + x) * 4;
    img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function fromPixels(w, h, fn, srgb = true) {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, gg, b, a = 255] = fn(x, y);
    const o = (y * w + x) * 4;
    img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = a;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const clamp255 = (v) => Math.max(0, Math.min(255, v));

// Roof tiles: 4 rows of 筒瓦 (cover tubes) over concave 板瓦, 4 courses per tile (uv 1.1 m × 1 m).
export function tilePBR(base = '#565c63', seed = 3) {
  const W = 512, Hh = 512, N = makeNoise(seed), H = new Float32Array(W * Hh);
  const bc = new THREE.Color(base);
  const col = W / 4;
  const tileVar = Array.from({ length: 64 }, () => 0.85 + Math.random() * 0.3);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const cx = (x % col) / col;                 // 0..1 across a row
    const course = (y % (Hh / 4)) / (Hh / 4);   // 0..1 down a course
    const tube = Math.abs(cx - 0.5) < 0.26 ? Math.sqrt(1 - ((cx - 0.5) / 0.26) ** 2) : 0;
    const pan = -Math.cos((cx - 0.5) * Math.PI * 2) * 0.12;
    const lip = course < 0.08 ? (0.08 - course) * 2.5 : 0;  // overlap step at each course
    H[y * W + x] = tube * 1.0 + (tube ? 0 : pan) + lip * (tube ? 0.6 : 1) + N(x / 32, y / 32, 3, 16) * 0.05;
  }
  const map = fromPixels(W, Hh, (x, y) => {
    const h = H[y * W + x];
    const ti = (Math.floor(x / col) + Math.floor(y / (Hh / 4)) * 4) % 64;
    const lich = Math.max(0, N(x / 40 + 7, y / 40 + 3, 4, 12.8) - 0.18) * 2.2; // lichen/stain patches
    const ao = 0.62 + 0.38 * Math.min(1, Math.max(0, h + 0.15));
    const v = ao * tileVar[ti] * (0.94 + N(x / 6, y / 6, 2, 85.33) * 0.12);
    return [clamp255((bc.r * v * (1 - lich * 0.25) + lich * 0.18) * 255), clamp255((bc.g * v * (1 - lich * 0.15) + lich * 0.2) * 255), clamp255((bc.b * v * (1 - lich * 0.4) + lich * 0.08) * 255)];
  });
  return { map, normalMap: normalFromHeight(H, W, Hh, 6) };
}

// Wood with vertical grain; lacquer=true gives weathered red/green paint over wood.
export function woodPBR(base = '#6e4a2c', { lacquer = false, seed = 5 } = {}) {
  const W = 256, Hh = 512, N = makeNoise(seed), H = new Float32Array(W * Hh);
  const bc = new THREE.Color(base), woodC = new THREE.Color('#5a3a22');
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const grain = Math.sin(x * 0.35 + N(x / 24, y / 96, 3, 10.67) * 9) * 0.5 + 0.5;
    H[y * W + x] = grain * 0.15 + N(x / 8, y / 8, 2, 32) * 0.08;
  }
  const map = fromPixels(W, Hh, (x, y) => {
    const g = H[y * W + x];
    let c = bc.clone().multiplyScalar(0.82 + g * 1.4);
    if (lacquer) {
      const wear = N(x / 30 + 11, y / 30, 4, 8.53);
      if (wear > 0.28) c = c.lerp(woodC, Math.min(1, (wear - 0.28) * 4));     // paint worn through
      c.multiplyScalar(0.92 + N(x / 3, y / 50, 2, 85) * 0.1);
    }
    return [c.r * 255, c.g * 255, c.b * 255].map(clamp255);
  });
  return { map, normalMap: normalFromHeight(H, W, Hh, 3) };
}

// White plaster: low-frequency mottling (dirt gradient and rain streaks are added in-shader from uv).
export function plasterTexture(base = '#efebe2', seed = 9) {
  const N = makeNoise(seed), bc = new THREE.Color(base);
  return fromPixels(256, 256, (x, y) => {
    const v = 0.93 + N(x / 40, y / 40, 4, 6.4) * 0.12 + N(x / 4, y / 4, 2, 64) * 0.03;
    return [bc.r * v * 255, bc.g * v * 255, bc.b * v * 255].map(clamp255);
  });
}

// Grey brick (水磨砖) with recessed mortar: map + normal.
export function brickPBR(base = '#8c8e8b', seed = 13) {
  const W = 256, Hh = 256, N = makeNoise(seed), H = new Float32Array(W * Hh), bc = new THREE.Color(base);
  const bw = 64, bh = 32;
  const bv = Array.from({ length: 64 }, () => 0.86 + Math.random() * 0.24);
  const inMortar = (x, y) => { const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0; return (y % bh) < 3 || ((x + off) % bw) < 3; };
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) H[y * W + x] = inMortar(x, y) ? 0 : 1 + N(x / 10, y / 10, 2, 25.6) * 0.1;
  const map = fromPixels(W, Hh, (x, y) => {
    if (inMortar(x, y)) return [205, 203, 196];
    const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0, id = (row * 5 + Math.floor((x + off) / bw)) % 64;
    const v = bv[id] * (0.95 + N(x / 6, y / 6, 2, 42.67) * 0.1);
    return [bc.r * v * 255, bc.g * v * 255, bc.b * v * 255].map(clamp255);
  });
  return { map, normalMap: normalFromHeight(H, W, Hh, 1.5) };
}

// Stone with fine speckle (青白石 / 汉白玉) — used world-mapped (triplanar).
export function stoneTexture(base = '#cfcabd', seed = 21, speck = 0.12) {
  const N = makeNoise(seed), bc = new THREE.Color(base);
  return fromPixels(256, 256, (x, y) => {
    const v = 0.9 + N(x / 30, y / 30, 4, 8.53) * 0.12 + (Math.random() - 0.5) * speck;
    return [bc.r * v * 255, bc.g * v * 255, bc.b * v * 255].map(clamp255);
  });
}

// Lattice patterns for 槅扇 / 槛窗: bubujin 步步锦, denglong 灯笼框, binglie 冰裂纹, guibei 龟背锦, wanzi 万字.
export function latticePattern(pattern = 'bubujin', frame = '#5a2a1c', paper = '#efe6cf') {
  const [c, g] = canvas(256, 512);
  g.fillStyle = paper; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = frame; g.lineCap = 'square';
  const L = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const area = [14, 14, 242, 380]; // 格心
  g.save(); g.beginPath(); g.rect(area[0], area[1], area[2] - area[0], area[3] - area[1]); g.clip();
  g.lineWidth = 4;
  if (pattern === 'bubujin') {
    for (let y = 14; y < 380; y += 36) for (let x = 14; x < 242; x += 36) {
      const o = ((y / 36) | 0) % 2 ? 18 : 0;
      L(x + o, y, x + o, y + 22); L(x, y + 22, x + 26, y + 22); L(x + 10, y + 10, x + 30, y + 10);
    }
  } else if (pattern === 'denglong') {
    g.strokeRect(70, 90, 116, 200);
    L(128, 14, 128, 90); L(128, 290, 128, 380); L(14, 190, 70, 190); L(186, 190, 242, 190);
    for (const y of [40, 340]) L(14, y, 242, y);
    for (const x of [40, 216]) L(x, 14, x, 380);
  } else if (pattern === 'binglie') {
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pts = Array.from({ length: 34 }, () => [14 + r() * 228, 14 + r() * 366]);
    g.lineWidth = 3.5;
    for (const [x, y] of pts) {
      const near = pts.map((p) => [Math.hypot(p[0] - x, p[1] - y), p]).sort((a, b) => a[0] - b[0]).slice(1, 4);
      for (const [, p] of near) L(x, y, p[0], p[1]);
    }
  } else if (pattern === 'guibei') {
    const R = 22;
    for (let y = 0; y < 400; y += R * 1.5) for (let x = 0; x < 270; x += R * Math.sqrt(3)) {
      const ox = ((y / (R * 1.5)) | 0) % 2 ? (R * Math.sqrt(3)) / 2 : 0;
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(x + ox + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); }
      g.stroke();
    }
  } else if (pattern === 'wanzi') {
    for (let y = 14; y < 380; y += 48) for (let x = 14; x < 242; x += 48) {
      L(x + 24, y + 4, x + 24, y + 44); L(x + 4, y + 24, x + 44, y + 24);
      L(x + 24, y + 4, x + 44, y + 4); L(x + 44, y + 24, x + 44, y + 44); L(x + 24, y + 44, x + 4, y + 44); L(x + 4, y + 24, x + 4, y + 4);
    }
  }
  g.restore();
  // frame, 绦环板 and carved 裙板
  g.lineWidth = 10; g.strokeRect(5, 5, 246, 502);
  g.fillStyle = frame; g.fillRect(0, 380, 256, 132);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(24, 392, 208, 22); g.fillRect(24, 428, 208, 70);
  g.strokeStyle = '#b8863b'; g.lineWidth = 2.5; g.strokeRect(28, 396, 200, 14); g.strokeRect(30, 434, 196, 58);
  g.beginPath(); g.ellipse(128, 463, 52, 20, 0, 0, Math.PI * 2); g.stroke();
  return tex(c, false);
}

// Beam paintings: hexi 和玺 (gold 圭线 + dragon roundels on blue/green), su 苏式 (包袱), xuanzi 旋子.
export function beamPaint(kind = 'su') {
  if (kind === 'su') return richBeamTexture();
  if (kind === 'xuanzi') return beamTexture();
  const [c, g] = canvas(1024, 96);
  g.fillStyle = '#1f4a63'; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = '#2c6b4f'; g.fillRect(0, 0, 1024, 48);
  g.strokeStyle = '#e2b84f'; g.lineWidth = 5; g.fillStyle = '#e2b84f';
  // W-shaped 圭线光 dividing 箍头 / 藻头 / 枋心
  for (const x0 of [0, 1024]) {
    const s = x0 ? -1 : 1;
    g.beginPath(); g.moveTo(x0 + s * 30, 0); g.lineTo(x0 + s * 30, 96); g.stroke();
    g.beginPath(); g.moveTo(x0 + s * 170, 0); g.lineTo(x0 + s * 230, 48); g.lineTo(x0 + s * 170, 96); g.stroke();
    g.beginPath(); g.moveTo(x0 + s * 290, 0); g.lineTo(x0 + s * 350, 48); g.lineTo(x0 + s * 290, 96); g.stroke();
    // 藻头 dragon roundel
    g.beginPath(); g.arc(x0 + s * 100, 48, 26, 0, 7); g.stroke();
    for (let k = 0; k < 7; k++) { const a = k * 0.9; g.beginPath(); g.arc(x0 + s * 100 + Math.cos(a) * 14, 48 + Math.sin(a) * 14, 4, 0, 7); g.fill(); }
  }
  // 枋心: long gold dragon (abstract sinuous line with flames)
  g.lineWidth = 7; g.beginPath();
  for (let x = 360; x <= 664; x += 4) g.lineTo(x, 48 + Math.sin((x - 360) * 0.045) * 20);
  g.stroke();
  g.beginPath(); g.arc(380, 40, 12, 0, 7); g.fill();
  for (let x = 400; x < 660; x += 26) { g.beginPath(); g.moveTo(x, 48 + Math.sin((x - 360) * 0.045) * 20); g.lineTo(x + 6, 26 + Math.sin(x) * 6); g.lineTo(x + 12, 48 + Math.sin((x - 348) * 0.045) * 20); g.fill(); }
  g.fillStyle = '#e2b84f'; g.fillRect(0, 0, 1024, 4); g.fillRect(0, 92, 1024, 4);
  return tex(c);
}

// Eave front: 勾头/滴水 row above, red 连檐 board, then blue/green painted 椽头 (rafter ends).
export function eaveTexture2(base = '#4a4f55') {
  const [c, g] = canvas(512, 128);
  g.fillStyle = '#2b2f33'; g.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = base; g.beginPath(); g.arc(x + 16, 22, 15, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; g.beginPath(); g.arc(x + 16, 22, 9, 0, 7); g.stroke();
    g.fillStyle = '#3a3e43'; g.beginPath(); g.moveTo(x + 34, 10); g.lineTo(x + 62, 10); g.lineTo(x + 48, 50); g.closePath(); g.fill();
  }
  g.fillStyle = '#8a2c20'; g.fillRect(0, 56, 512, 18);        // 连檐 / 瓦口
  for (let x = 0; x < 512; x += 32) {                          // 飞椽头 (green) and 檐椽头 (blue)
    g.fillStyle = '#2f6b4f'; g.fillRect(x + 6, 78, 18, 18);
    g.fillStyle = '#e2b84f'; g.fillRect(x + 12, 84, 6, 6);
    g.fillStyle = '#244f6e'; g.beginPath(); g.arc(x + 15, 112, 10, 0, 7); g.fill();
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(x + 15, 112, 4, 0, 7); g.fill();
  }
  return tex(c);
}

// 山花: red gable with a gold 绶带 (ribbon-and-bow) motif.
export function shanhuaTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#8a2a1e'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#d9ae4c'; g.lineWidth = 6; g.fillStyle = '#d9ae4c';
  g.beginPath(); g.arc(256, 150, 34, 0, 7); g.stroke();
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(256 + s * 34, 150); g.bezierCurveTo(256 + s * 120, 100, 256 + s * 160, 220, 256 + s * 240, 170); g.stroke();
    g.beginPath(); g.moveTo(256 + s * 30, 168); g.bezierCurveTo(256 + s * 90, 230, 256 + s * 150, 120, 256 + s * 210, 220); g.stroke();
  }
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.arc(256 + Math.cos(a) * 20, 150 + Math.sin(a) * 20, 4, 0, 7); g.fill(); }
  return tex(c, false);
}

// Flagstone / cobble path for terrain blending (world mapped).
export function flagstoneTexture(seed = 31) {
  const N = makeNoise(seed);
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cells = Array.from({ length: 40 }, () => [r() * 256, r() * 256, 0.8 + r() * 0.35]);
  return fromPixels(256, 256, (x, y) => {
    let d1 = 1e9, d2 = 1e9, v = 1;
    for (const [cx, cy, cv] of cells) for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      const d = Math.hypot(x - cx - ox, y - cy - oy);
      if (d < d1) { d2 = d1; d1 = d; v = cv; } else if (d < d2) d2 = d;
    }
    const joint = d2 - d1 < 3 ? 0.55 : 1;
    const k = joint * v * (0.92 + N(x / 12, y / 12, 3, 21.3) * 0.16);
    return [clamp255(178 * k), clamp255(172 * k), clamp255(160 * k)];
  });
}
