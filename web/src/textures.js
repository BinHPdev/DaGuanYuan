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
export function coupletTexture(text) {
  const chars = [...text];
  const [c, g] = canvas(110, 104 * chars.length + 40);
  g.fillStyle = '#20160f'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#b38b45'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = '#d8b25a'; g.font = `bold 84px ${FONT}`;
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
