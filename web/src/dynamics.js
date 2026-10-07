// Animated life in the garden: the 沁芳闸 cascade, wind in the plants, drifting petals
// (落花浮荡), butterflies, koi, ducks and geese (第十七回 "买些鹅鸭鸡类"), chickens at 稻香村,
// and fireflies on moonlit nights.
// initDynamics is called once after the world is built; updateDynamics every frame.
import * as THREE from 'three';
import { floraUniforms, floraInfo } from './flora.js';
import { flowAt } from './water.js';

let C = null;          // ctx
const systems = [];    // { update(dt, t, night) }
let nightLast = null;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _sky = new THREE.Color();
const isNight = () => {
  const m = C.getTimeMode?.() || '昼';
  if (m === '月夜' || m === '元宵') return true;
  // also follow the lighting itself (the water's sky tint is darkened at night)
  const u = C.water?.material?.uniforms?.uSky;
  return !!u && _sky.copy(u.value).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25;
};

export function initDynamics(ctx) {
  C = ctx;
  const L = ctx.layout;
  buildCascade(L);
  systems.push(petals());
  systems.push(butterflies());
  systems.push(koi(L));
  systems.push(waterfowl(L));
  systems.push(chickens(L));
  systems.push(fireflies(L));
}

export function updateDynamics(dt, t) {
  if (!C) return;
  floraUniforms.uTime.value = t;
  const night = isNight();
  for (const s of systems) s.update(dt, t, night, night !== nightLast);
  nightLast = night;
}

// ---------------------------------------------------------------- 沁芳闸 cascade
// "至一大桥前，见水如晶帘一般奔入。原来这桥便是通外河之闸，引泉而入者。"
// The outer river is held higher behind a stone weir on the inflow (east) side of the sluice
// bridge and pours over it as a crystal curtain.
let cascadeMat = null;
function buildCascade(L) {
  const s = L.water.streams[0].pts;
  const sl = L.places.find((p) => p.id === 'qinfangzha');
  const d = new THREE.Vector2(s[2][0] - s[1][0], s[2][1] - s[1][1]).normalize(); // flow direction (into garden)
  const c = new THREE.Vector2(-d.y, d.x);                                        // across the stream
  const lipY = 0.62, W = 7.8, fallLen = 1.5;
  const lip = new THREE.Vector2(sl.x, sl.z).addScaledVector(d, -4.6);

  // raised outer-river water upstream of the weir, re-using the garden's water shader
  const up = [lip, new THREE.Vector2(s[1][0], s[1][1]).addScaledVector(d, -6), new THREE.Vector2(s[0][0], s[0][1])];
  const pos = [], idx = [];
  up.forEach((p, i) => {
    const dir = i < up.length - 1 ? up[i + 1].clone().sub(p).normalize() : p.clone().sub(up[i - 1]).normalize();
    const n = new THREE.Vector2(-dir.y, dir.x);
    for (const k of [-1, 1]) pos.push(p.x + n.x * k * (W / 2 + 0.2), lipY, p.y + n.y * k * (W / 2 + 0.2));
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  });
  const ug = new THREE.BufferGeometry();
  ug.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ug.setIndex(idx);
  const upper = new THREE.Mesh(ug, C.water.material);
  upper.renderOrder = 1;
  C.scene.add(upper);

  // stone weir sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.7, lipY + 1.7, W + 0.4), new THREE.MeshStandardMaterial({ color: '#b9b4a6', roughness: 0.95 }));
  sill.position.set(lip.x - d.x * 0.35, (lipY - 1.7) / 2 - 0.02, lip.y - d.y * 0.35);
  sill.rotation.y = -Math.atan2(c.y, c.x);
  sill.castShadow = sill.receiveShadow = true;
  C.scene.add(sill);

  // the falling curtain: ballistic profile over the lip
  const NU = 24, NV = 14, cp = [], cuv = [], ci = [];
  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    const along = fallLen * Math.pow(t, 0.75), y = lipY * (1 - t * t) + 0.02;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU - 0.5;
      const bulge = 0.12 * Math.sin(Math.PI * t) * (1 - 4 * u * u);
      cp.push(lip.x + d.x * (along + bulge) + c.x * u * W, y, lip.y + d.y * (along + bulge) + c.y * u * W);
      cuv.push(i / NU, t);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const k = j * (NU + 1) + i;
    ci.push(k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
  cg.setIndex(ci);
  cascadeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }]),
    vertexShader: /* glsl */ `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `uniform float uTime, uNight; varying vec2 vUv;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 q = vec2(vUv.x * 46.0, vUv.y * 3.0 - uTime * 2.6);
        float s = n(q) * 0.65 + n(q * vec2(2.3, 1.7) + 5.0) * 0.35;      // vertical streaks
        float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        float a = (0.32 + 0.55 * smoothstep(0.35, 0.85, s)) * edge;
        a += smoothstep(0.7, 1.0, vUv.y) * 0.35 * n(q * 3.0) * edge;       // white water at the foot
        vec3 col = mix(vec3(0.62, 0.78, 0.78), vec3(0.96, 0.98, 0.97), smoothstep(0.45, 0.9, s));
        col *= mix(1.0, 0.35, uNight);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  const curtain = new THREE.Mesh(cg, cascadeMat);
  curtain.renderOrder = 3;
  C.scene.add(curtain);
  systems.push({ update(dt, t, night) { cascadeMat.uniforms.uTime.value = t; cascadeMat.uniforms.uNight.value = night ? 1 : 0; } });
}

// ---------------------------------------------------------------- falling petals
function petals() {
  const N = 700;
  const geo = new THREE.PlaneGeometry(0.11, 0.08);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  C.scene.add(im);
  const P = Array.from({ length: N }, () => ({ x: 0, y: -99, z: 0, st: 3, t: rand(0, 4), life: 0, rx: 0, ry: 0, sx: 0, sy: 0, ground: 0, sc: 1 }));
  const col = new THREE.Color();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), V = new THREE.Vector3();
  let near = [], refresh = 0;
  const fl = [0, 0];

  function spawn(p) {
    if (!near.length) { p.st = 3; p.t = rand(0.5, 2); return; }
    const b = pick(near);
    const r = 1.6 * b.s, a = Math.random() * Math.PI * 2;
    p.x = b.x + Math.cos(a) * r * Math.sqrt(Math.random());
    p.z = b.z + Math.sin(a) * r * Math.sqrt(Math.random());
    p.y = b.y + b.s * rand(2.2, 3.6);
    p.vy = -rand(0.35, 0.65); p.ph = rand(0, 6.28);
    p.rx = rand(0, 6.28); p.ry = rand(0, 6.28); p.sx = rand(-3, 3); p.sy = rand(-2, 2);
    p.st = 0; p.life = 0; p.sc = 1;
    p.ground = C.heightAt(p.x, p.z);
    im.setColorAt(P.indexOf(p), col.set(b.color).offsetHSL(0, 0, rand(-0.04, 0.06)));
    im.instanceColor.needsUpdate = true;
  }
  P.forEach((p, i) => im.setColorAt(i, col.set('#f3b6c2')));

  return {
    update(dt, t) {
      refresh -= dt;
      if (refresh <= 0) {
        refresh = 1.5;
        const cx = C.camera.position.x, cz = C.camera.position.z;
        near = floraInfo.blossoms.filter((b) => Math.hypot(b.x - cx, b.z - cz) < 140);
        if (near.length > 60) near.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)).length = 60;
      }
      const wx = 0.35 + 0.25 * Math.sin(t * 0.3), wz = 0.12 + 0.1 * Math.cos(t * 0.23);
      for (let i = 0; i < N; i++) {
        const p = P[i];
        p.life += dt;
        if (p.st === 3) { p.t -= dt; if (p.t <= 0) spawn(p); S.setScalar(0); }
        else if (p.st === 0) {           // falling, fluttering
          p.x += (wx + Math.sin(t * 2.1 + p.ph) * 0.35) * dt;
          p.z += (wz + Math.cos(t * 1.7 + p.ph) * 0.35) * dt;
          p.y += p.vy * dt;
          p.rx += p.sx * dt; p.ry += p.sy * dt;
          if (p.y <= p.ground + 0.6) p.ground = C.heightAt(p.x, p.z);
          if (p.y <= Math.max(p.ground, 0) + 0.02) {
            if (C.waterDepthMetric(p.x, p.z) > 0.2) { p.st = 1; p.y = 0.03; p.life = 0; p.t = rand(14, 24); }
            else { p.st = 2; p.y = p.ground + 0.03; p.t = rand(3, 6); }
            p.rx = -Math.PI / 2; p.sx = 0;
          }
          S.setScalar(1);
        } else if (p.st === 1) {         // floating: drift with the stream (落花浮荡)
          flowAt(p.x, p.z, fl);
          p.x += (fl[0] * 0.9 + wx * 0.1) * dt; p.z += (fl[1] * 0.9 + wz * 0.1) * dt;
          p.ry += Math.hypot(fl[0], fl[1]) * 0.6 * dt;
          p.y = 0.03 + Math.sin(t * 2 + p.ph) * 0.01;
          p.t -= dt;
          if (C.waterDepthMetric(p.x, p.z) < -0.3) { p.st = 2; p.t = 2; }
          S.setScalar(Math.min(1, p.t / 3));
          if (p.t <= 0) { p.st = 3; p.t = rand(0.1, 1.5); }
        } else {                         // resting on the ground
          p.t -= dt;
          S.setScalar(Math.min(1, p.t));
          if (p.t <= 0) { p.st = 3; p.t = rand(0.1, 1.5); }
        }
        Q.setFromEuler(E.set(p.rx, p.ry, 0, 'YXZ'));
        im.setMatrixAt(i, M.compose(V.set(p.x, p.y, p.z), Q, S));
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- butterflies
function wingTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (const s of [-1, 1]) {
    g.save(); g.translate(64, 32); g.scale(s, 1);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(26, -9, 26, 20, -0.35, 0, Math.PI * 2); g.fill();   // forewing
    g.beginPath(); g.ellipse(20, 14, 18, 14, 0.4, 0, Math.PI * 2); g.fill();     // hindwing
    g.strokeStyle = 'rgba(30,25,20,0.85)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(26, -9, 25, 19, -0.35, -1.6, 0.9); g.stroke();
    g.fillStyle = 'rgba(30,25,20,0.8)';
    g.beginPath(); g.arc(40, -16, 4, 0, 7); g.fill();
    g.restore();
  }
  g.fillStyle = '#2a2420'; g.fillRect(62, 10, 4, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function butterflies() {
  const N = 60;
  // one quad spanning both wings; vertices with |x|>0 flap around the body axis (z)
  const geo = new THREE.PlaneGeometry(0.36, 0.18, 4, 1).rotateX(-Math.PI / 2);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) phase[i] = Math.random() * 6.28;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = new THREE.MeshLambertMaterial({ map: wingTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  const uni = { uT: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT; attribute float aPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fa = (0.25 + 0.95 * (0.5 + 0.5 * sin(uT * 17.0 + aPhase))) ;
        float ax = abs(transformed.x);
        transformed.y += ax * sin(fa);
        transformed.x = sign(transformed.x) * ax * cos(fa);`);
  };
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  C.scene.add(im);
  const COLORS = ['#fbfaf2', '#f6e27a', '#f3a640', '#fbfaf2', '#e8d0f0', '#f8f0b0'];
  const spots = floraInfo.flowerSpots.filter((s) => s.type !== 'bamboo');
  const col = new THREE.Color();
  const B = Array.from({ length: N }, (_, i) => {
    const h = spots.length ? pick(spots) : { x: 0, z: 0, r: 10 };
    im.setColorAt(i, col.set(pick(COLORS)));
    const r = Math.max(4, Math.min(h.r * 1.2, 14));
    return {
      hx: h.x, hz: h.z, r, gy: C.heightAt(h.x, h.z),
      f: [rand(0.08, 0.2), rand(0.11, 0.27), rand(0.3, 0.6), rand(0.05, 0.12)],
      p: [rand(0, 6.28), rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)],
    };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  const pos = (b, t, o) => {
    o[0] = b.hx + b.r * (0.65 * Math.sin(t * b.f[0] * 6.28 + b.p[0]) + 0.35 * Math.sin(t * b.f[1] * 6.28 * 1.7 + b.p[1]));
    o[1] = b.hz + b.r * (0.65 * Math.cos(t * b.f[3] * 6.28 * 1.3 + b.p[2]) + 0.35 * Math.sin(t * b.f[1] * 6.28 + b.p[3]));
    o[2] = b.gy + 1.3 + 0.7 * Math.sin(t * b.f[2] * 6.28 + b.p[1]) + 0.25 * Math.sin(t * 3.1 + b.p[2]);
    return o;
  };
  const a = [0, 0, 0], c2 = [0, 0, 0];
  return {
    update(dt, t, night, changed) {
      im.visible = !night;
      if (night) return;
      uni.uT.value = t;
      for (let i = 0; i < N; i++) {
        const b = B[i];
        pos(b, t, a); pos(b, t + 0.05, c2);
        const yaw = Math.atan2(c2[0] - a[0], c2[1] - a[1]);
        Q.setFromEuler(E.set(-0.25 + (c2[2] - a[2]) * 3, yaw, Math.sin(t * 2 + b.p[0]) * 0.2, 'YXZ'));
        im.setMatrixAt(i, M.compose(V.set(a[0], a[2], a[1]), Q, S));
      }
      im.instanceMatrix.needsUpdate = true;
      if (changed) im.instanceColor.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- koi
function koi(L) {
  const N = 40;
  const body = new THREE.SphereGeometry(1, 10, 6).scale(0.11, 0.06, 0.34);
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.3, -0.13, 0, -0.52, 0.13, 0, -0.52], 3));
  tail.computeVertexNormals();
  body.deleteAttribute('uv');
  const geo = new THREE.BufferGeometry();
  {
    const b = body.toNonIndexed(), tl = tail;
    const pa = new Float32Array(b.attributes.position.count * 3 + 9);
    pa.set(b.attributes.position.array); pa.set(tl.attributes.position.array, b.attributes.position.count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pa, 3));
    geo.computeVertexNormals();
  }
  const phase = new Float32Array(N); for (let i = 0; i < N; i++) phase[i] = Math.random() * 6.28;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const uni = { uT: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT; attribute float aPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x += sin(uT * 7.0 + aPhase + transformed.z * 6.0) * 0.07 * smoothstep(0.05, -0.5, transformed.z);`);
  };
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  C.scene.add(im);
  const pd = L.water.pond;
  const COLS = ['#f2701e', '#f58a2a', '#ffffff', '#e2401c', '#f6c04a', '#f7f2e8'];
  const col = new THREE.Color();
  const F = Array.from({ length: N }, (_, i) => {
    im.setColorAt(i, col.set(pick(COLS)));
    // keep each fish on an orbit that stays in deep water
    let rf = rand(0.25, 0.82), cx = pd.cx + rand(-12, 12), cz = pd.cz + rand(-5, 5);
    for (let k = 0; k < 12; k++) {
      let ok = true;
      for (let a = 0; a < 6.28; a += 0.5) if (C.waterDepthMetric(cx + pd.rx * rf * Math.cos(a), cz + pd.rz * rf * Math.sin(a)) < 2) { ok = false; break; }
      if (ok) break; rf *= 0.85;
    }
    const school = i % 5; // loose schools share a phase offset
    return { cx, cz, rf, a: rand(0, 6.28) + school * 0.05, w: (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.7) / (pd.rx * rf), wob: rand(0, 6.28), rise: rand(4, 20), up: 0 };
  });
  // surfacing rings
  const ringMat = new THREE.MeshBasicMaterial({ color: '#e8f0ee', transparent: true, opacity: 0.5, depthWrite: false });
  const rings = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), ringMat.clone());
    m.visible = false; m.position.y = 0.04; m.renderOrder = 4; m.userData.t = 0; C.scene.add(m); return m;
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  return {
    update(dt, t) {
      uni.uT.value = t;
      for (let i = 0; i < N; i++) {
        const f = F[i];
        f.a += f.w * dt;
        const wob = Math.sin(t * 0.7 + f.wob) * 2.5;
        const x = f.cx + (pd.rx * f.rf + wob) * Math.cos(f.a), z = f.cz + (pd.rz * f.rf + wob * 0.5) * Math.sin(f.a);
        const tx = -Math.sin(f.a) * pd.rx * Math.sign(f.w), tz = Math.cos(f.a) * pd.rz * Math.sign(f.w);
        f.rise -= dt;
        if (f.rise <= 0) {
          f.up = 1.2; f.rise = rand(8, 25);
          const r = rings.find((m) => !m.visible);
          if (r) { r.visible = true; r.userData.t = 0; r.position.x = x; r.position.z = z; }
        }
        f.up = Math.max(0, f.up - dt);
        const y = -0.16 + Math.sin(Math.min(1, f.up / 1.2) * Math.PI) * 0.17;
        Q.setFromEuler(E.set(0, Math.atan2(tx, tz), 0));
        im.setMatrixAt(i, M.compose(V.set(x, y, z), Q, S));
      }
      im.instanceMatrix.needsUpdate = true;
      for (const r of rings) {
        if (!r.visible) continue;
        r.userData.t += dt;
        const k = r.userData.t / 2.2;
        r.scale.setScalar(0.2 + k * 1.6);
        r.material.opacity = 0.5 * (1 - k);
        if (k >= 1) r.visible = false;
      }
    },
  };
}

// ---------------------------------------------------------------- ducks & geese
function colorGeo(g, color) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function mergeColored(parts) {
  const geos = parts.map(([g, c]) => colorGeo(g, c));
  let total = 0; for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
function duckGeo(mallard) {
  return mergeColored([
    [new THREE.SphereGeometry(1, 10, 7).scale(0.17, 0.12, 0.28).translate(0, 0.06, 0), mallard ? '#8a6a48' : '#f4f1e8'],
    [new THREE.SphereGeometry(0.085, 8, 6).translate(0, 0.24, 0.2), mallard ? '#2f6a3c' : '#f6f4ec'],
    [new THREE.ConeGeometry(0.035, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0.23, 0.31), '#e3a13a'],
    [new THREE.ConeGeometry(0.06, 0.14, 5).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.12, -0.3), mallard ? '#5a4632' : '#ece8de'],
  ]);
}
function gooseGeo() {
  return mergeColored([
    [new THREE.SphereGeometry(1, 10, 7).scale(0.22, 0.16, 0.38).translate(0, 0.08, 0), '#f7f5ee'],
    [new THREE.CylinderGeometry(0.04, 0.05, 0.36, 6).rotateX(0.25).translate(0, 0.32, 0.26), '#f7f5ee'],
    [new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0.5, 0.31), '#f7f5ee'],
    [new THREE.ConeGeometry(0.035, 0.12, 6).rotateX(Math.PI / 2).translate(0, 0.49, 0.42), '#e58a2a'],
    [new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.53, 0.38), '#d06a1a'], // knob
  ]);
}

function polyPath(pts) {
  const seg = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
  return {
    total,
    at(s) { // returns [x, z, dx, dz]
      s = Math.max(0, Math.min(total - 1e-3, s));
      let i = 0; while (s > seg[i] && i < seg.length - 1) s -= seg[i++];
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const f = s / seg[i];
      return [ax + (bx - ax) * f, az + (bz - az) * f, (bx - ax) / seg[i], (bz - az) / seg[i]];
    },
  };
}

function waterfowl(L) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const kinds = [duckGeo(true), duckGeo(false), gooseGeo()];
  const birds = [];
  // stream by 稻香村 (west bank), and the pond
  const stream = polyPath(L.water.streams[1].pts.slice(4, 9));
  const pd = L.water.pond;
  const plan = [[0, 's'], [0, 's'], [1, 's'], [2, 's'], [2, 's'], [0, 'p'], [1, 'p'], [0, 'p'], [1, 'p'], [2, 'p']];
  const groups = kinds.map((g) => { const m = new THREE.InstancedMesh(g, mat, plan.length); m.count = 0; m.frustumCulled = false; m.castShadow = true; C.scene.add(m); return m; });
  for (const [k, where] of plan) {
    const m = groups[k];
    birds.push({ m, i: m.count++, where, s: rand(0, stream.total), dir: Math.random() < 0.5 ? 1 : -1, off: rand(-1.8, 1.8),
      a: rand(0, 6.28), rf: rand(0.4, 0.75), sp: rand(0.25, 0.45), ph: rand(0, 6.28), pause: 0 });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  return {
    update(dt, t) {
      for (const b of birds) {
        let x, z, yaw;
        if (b.pause > 0) b.pause -= dt; else if (Math.random() < dt * 0.04) b.pause = rand(2, 6);
        const v = b.pause > 0 ? 0.05 : b.sp;
        if (b.where === 's') {
          b.s += b.dir * v * dt;
          if (b.s < 2 || b.s > stream.total - 2) b.dir *= -1;
          const [px, pz, dx, dz] = stream.at(b.s);
          const o = b.off + Math.sin(t * 0.2 + b.ph) * 0.8;
          x = px - dz * o; z = pz + dx * o; yaw = Math.atan2(dx * b.dir, dz * b.dir);
        } else {
          b.a += (v / (pd.rx * b.rf)) * dt;
          x = pd.cx + pd.rx * b.rf * Math.cos(b.a) + Math.sin(t * 0.13 + b.ph) * 3;
          z = pd.cz + pd.rz * b.rf * Math.sin(b.a);
          yaw = Math.atan2(-Math.sin(b.a) * pd.rx, Math.cos(b.a) * pd.rz);
        }
        Q.setFromAxisAngle(Y, yaw + Math.sin(t * 0.9 + b.ph) * 0.15);
        b.m.setMatrixAt(b.i, M.compose(V.set(x, 0.01 + Math.sin(t * 1.6 + b.ph) * 0.015, z), Q, S));
      }
      for (const m of groups) m.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- chickens at 稻香村
function chickens(L) {
  const p = L.places.find((q) => q.id === 'daoxiang');
  const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
  const toWorld = (lx, lz) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
  const variants = [['#9a5a2a', '#c8743a'], ['#f2ede0', '#e8e2d2'], ['#2a2420', '#3a2e26']];
  const geos = variants.map(([b, t]) => mergeColored([
    [new THREE.SphereGeometry(1, 9, 7).scale(0.13, 0.13, 0.18).translate(0, 0.26, 0), b],
    [new THREE.SphereGeometry(0.065, 8, 6).translate(0, 0.42, 0.13), b],
    [new THREE.BoxGeometry(0.025, 0.06, 0.08).translate(0, 0.49, 0.13), '#c8231e'],
    [new THREE.ConeGeometry(0.022, 0.06, 5).rotateX(Math.PI / 2).translate(0, 0.41, 0.21), '#e0a63a'],
    [new THREE.ConeGeometry(0.07, 0.2, 5).rotateX(-Math.PI / 2 - 0.9).translate(0, 0.36, -0.17), t],
    [new THREE.CylinderGeometry(0.012, 0.012, 0.15, 4).translate(-0.05, 0.08, 0), '#d8a23a'],
    [new THREE.CylinderGeometry(0.012, 0.012, 0.15, 4).translate(0.05, 0.08, 0), '#d8a23a'],
  ]));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const N = 12;
  const meshes = geos.map((g) => { const m = new THREE.InstancedMesh(g, mat, N); m.count = 0; m.frustumCulled = false; m.castShadow = true; C.scene.add(m); return m; });
  const area = () => [rand(-8, 8), rand(2.5, 14)];
  const H = Array.from({ length: N }, (_, i) => {
    const m = meshes[i % 3], [lx, lz] = area();
    return { m, i: m.count++, lx, lz, tx: lx, tz: lz, peck: rand(0, 3), yaw: rand(0, 6.28), ph: rand(0, 6.28) };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  return {
    update(dt, t) {
      for (const h of H) {
        let pitch = 0;
        if (h.peck > 0) {
          h.peck -= dt;
          pitch = Math.max(0, Math.sin(t * 9 + h.ph)) * 0.75;
          if (h.peck <= 0) [h.tx, h.tz] = area();
        } else {
          const dx = h.tx - h.lx, dz = h.tz - h.lz, d = Math.hypot(dx, dz);
          if (d < 0.1) h.peck = rand(1.5, 5);
          else {
            const v = Math.min(d, 0.55 * dt);
            h.lx += (dx / d) * v; h.lz += (dz / d) * v;
            h.yaw = Math.atan2(dx * c + dz * s, -dx * s + dz * c); // local dir -> world yaw
            pitch = Math.abs(Math.sin(t * 12 + h.ph)) * 0.08;
          }
        }
        const [x, z] = toWorld(h.lx, h.lz);
        Q.setFromEuler(E.set(pitch, h.yaw, 0, 'YXZ'));
        h.m.setMatrixAt(h.i, M.compose(V.set(x, C.heightAt(x, z), z), Q, S));
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- fireflies
function fireflies(L) {
  const N = 420;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const spots = [];
  const xx = L.places.find((p) => p.id === 'xiaoxiang'), lx = L.places.find((p) => p.id === 'luxue');
  for (let i = 0; i < N; i++) {
    let x, z;
    const r = Math.random();
    if (r < 0.3) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * 30; x = xx.x + Math.cos(a) * d; z = xx.z + Math.sin(a) * d; }   // 潇湘馆 bamboo
    else if (r < 0.42) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * 16; x = lx.x + Math.cos(a) * d; z = lx.z - 8 + Math.sin(a) * d; } // 芦雪广 reeds
    else { // stream banks
      const st = pick(L.water.streams), k = Math.floor(Math.random() * (st.pts.length - 1)), f = Math.random();
      const [ax, az] = st.pts[k], [bx, bz] = st.pts[k + 1];
      const l = Math.hypot(bx - ax, bz - az), o = (Math.random() < 0.5 ? -1 : 1) * rand(st.width / 2 - 1, st.width / 2 + 5);
      x = ax + (bx - ax) * f - ((bz - az) / l) * o; z = az + (bz - az) * f + ((bx - ax) / l) * o;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = Math.max(C.heightAt(x, z), 0) + rand(0.3, 2.6); pos[i * 3 + 2] = z;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `uniform float uT, uScale; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uT*0.5+aSeed)*0.8, sin(uT*0.7+aSeed*1.3)*0.35, cos(uT*0.43+aSeed*0.7)*0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float blink = pow(max(0.0, sin(uT * (0.9 + fract(aSeed) * 1.4) + aSeed)), 2.0);
        vA = blink;
        gl_PointSize = uScale * (3.0 + 9.0 * blink) * 60.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * a, a); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  C.scene.add(pts);
  return {
    update(dt, t, night) {
      pts.visible = night;
      if (!night) return;
      mat.uniforms.uT.value = t;
      mat.uniforms.uScale.value = window.devicePixelRatio || 1;
    },
  };
}
