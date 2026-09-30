import * as THREE from 'three';
import { inked } from './pochacco.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function basketballTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f47b20';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(110,35,0,${Math.random() * 0.14})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = '#1c1a1f';
    g.lineWidth = 8;
    g.lineCap = 'round';
    const path = (fn) => {
      g.beginPath();
      for (let y = 0; y <= h; y += 4) {
        const x = fn(y);
        y ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    };
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    path(() => w * 0.25);
    path(() => w * 0.75);
    for (const cx of [0, w / 2, w]) {
      path((y) => cx + 64 * Math.sin((Math.PI * y) / h));
      path((y) => cx - 64 * Math.sin((Math.PI * y) / h));
    }
  });
}

function waffleTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9a860';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b86f2c';
    g.lineWidth = 6;
    for (let i = -h; i < w + h; i += 36) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
    }
  });
}

function backboardTexture() {
  return canvasTex(512, 340, (g, w, h) => {
    g.fillStyle = '#fffdf8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e23b2e';
    g.lineWidth = 18;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 12;
    g.strokeRect(w / 2 - 80, h - 150, 160, 110);
    g.fillStyle = '#1c1a1f';
    g.font = '900 40px "Bagel Fat One", sans-serif';
    g.textAlign = 'center';
    g.fillText('POCHACCO', w / 2, 80);
  });
}

export function makeBasketball(mats, r = 0.2) {
  const mat = mats.toon(0xffffff, { map: basketballTexture() });
  return inked(new THREE.SphereGeometry(r, 36, 24), mat, mats, { outline: 0.06 });
}

export function makeBanana(mats) {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.55, 0.22, 0),
    new THREE.Vector3(0, -0.34, 0),
    new THREE.Vector3(0.55, 0.22, 0)
  );
  const segs = 40, rad = 14;
  const geo = new THREE.TubeGeometry(curve, segs, 0.16, rad, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    const k = 0.22 + 0.78 * Math.pow(Math.sin(Math.PI * u), 0.55);
    for (let j = 0; j <= rad; j++) {
      const idx = i * (rad + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.add(inked(geo, mats.toon(0xffe04a), mats, { outline: 0.06 }));
  const tipGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const brown = mats.toon(0x6b4520);
  [curve.getPointAt(0), curve.getPointAt(1)].forEach((p) => {
    const t = new THREE.Mesh(tipGeo, brown);
    t.position.copy(p);
    g.add(t);
  });
  return g;
}

export function makeStar(mats, color = 0xffd23f) {
  const s = new THREE.Shape();
  const n = 5, R = 0.42, r = 0.2;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
  geo.center();
  return inked(geo, mats.toon(color), mats, { outline: 0.07 });
}

export function makeBone(mats) {
  const g = new THREE.Group();
  const white = mats.toon(0xfff6e6);
  g.add(inked(new THREE.CapsuleGeometry(0.08, 0.5, 6, 12), white, mats, { rot: [0, 0, Math.PI / 2], outline: 0.1 }));
  const k = new THREE.SphereGeometry(0.11, 16, 12);
  for (const x of [-0.34, 0.34]) for (const y of [-0.08, 0.08]) {
    g.add(inked(k, white, mats, { pos: [x, y, 0], outline: 0.1 }));
  }
  return g;
}

export function makeHeart(mats) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.bezierCurveTo(-0.5, 0.05, -0.3, 0.42, 0, 0.18);
  s.bezierCurveTo(0.3, 0.42, 0.5, 0.05, 0, -0.3);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
  geo.center();
  return inked(geo, mats.toon(0xff6f7d), mats, { outline: 0.07 });
}

let waffle;
export function makeIceCream(mats, { scoops = 2 } = {}) {
  waffle ||= waffleTexture();
  const g = new THREE.Group();
  const cone = inked(new THREE.ConeGeometry(0.34, 1.0, 28, 1), mats.toon(0xffffff, { map: waffle }), mats, {
    pos: [0, -0.5, 0], rot: [Math.PI, 0, 0], outline: 0.05,
  });
  g.add(cone);
  const banana = mats.toon(0xfff09a);
  const S = new THREE.SphereGeometry(1, 32, 24);
  for (let i = 0; i < scoops; i++) {
    const y = 0.12 + i * 0.42;
    const r = 0.42 - i * 0.05;
    g.add(inked(S, banana, mats, { pos: [0, y, 0], scale: [r, r * 0.9, r], outline: 0.05 }));
    // drips around the rim of each scoop
    for (let d = 0; d < 7; d++) {
      const a = (d / 7) * Math.PI * 2 + i;
      g.add(inked(S, banana, mats, {
        pos: [Math.cos(a) * r * 0.9, y - r * 0.55 - (d % 2) * 0.06, Math.sin(a) * r * 0.9],
        scale: [0.09, 0.13 + (d % 3) * 0.03, 0.09], outline: 0.1,
      }));
    }
  }
  // banana slice on top
  const top = 0.12 + (scoops - 1) * 0.42 + 0.36;
  const slice = inked(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24), mats.toon(0xfff7cf), mats, {
    pos: [0.05, top, 0.05], rot: [0.5, 0, 0.3], outline: 0.1,
  });
  g.add(slice);
  return g;
}

export function makeHoop(mats) {
  const g = new THREE.Group();
  const board = inked(new THREE.BoxGeometry(1.7, 1.12, 0.07), mats.toon(0xffffff, { map: backboardTexture() }), mats, {
    pos: [0, 0.5, -0.42], outline: 0.02,
  });
  g.add(board);
  const pole = inked(new THREE.CylinderGeometry(0.07, 0.07, 7, 12), mats.toon(0x5b6fd6), mats, { pos: [0, -3.0, -0.6], outline: 0.06 });
  g.add(pole);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), mats.toon(0xe23b2e));
  bracket.position.set(0, 0, -0.33);
  g.add(bracket);
  const rim = inked(new THREE.TorusGeometry(0.3, 0.035, 12, 48), mats.toon(0xe23b2e), mats, { rot: [Math.PI / 2, 0, 0], outline: 0.25 });
  g.add(rim);

  // net: criss-cross lines from rim to a narrower bottom ring
  const net = new THREE.Group();
  const pts = [];
  const N = 14, rTop = 0.3, rBot = 0.17, depth = 0.5;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    for (const k of [-1, 1]) {
      const a1 = ((i + k) / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a0) * rTop, 0, Math.sin(a0) * rTop));
      pts.push(new THREE.Vector3(Math.cos(a1) * rBot, -depth, Math.sin(a1) * rBot));
    }
    const a2 = ((i + 1) / N) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a0) * rBot, -depth, Math.sin(a0) * rBot));
    pts.push(new THREE.Vector3(Math.cos(a2) * rBot, -depth, Math.sin(a2) * rBot));
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff }));
  net.add(lines);
  g.add(net);
  return { group: g, rim, net };
}

// Soft round blob texture for shadows / dust
export function blobTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.9)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}
