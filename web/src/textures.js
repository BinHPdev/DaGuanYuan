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
    for (let i = 0; i < 30; i++) {
      const x = 5 + Math.random() * 118;
      g.strokeStyle = `hsl(${45 + Math.random() * 15},35%,${50 + Math.random() * 15}%)`;
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + 4, 60, x + (Math.random() - 0.5) * 16, 20); g.stroke();
      g.fillStyle = 'rgba(235,225,205,0.9)';
      g.beginPath(); g.ellipse(x + (Math.random() - 0.5) * 10, 18 + Math.random() * 10, 3, 10, 0.2, 0, Math.PI * 2); g.fill();
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
