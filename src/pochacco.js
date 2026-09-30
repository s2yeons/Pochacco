import * as THREE from 'three';

export const INK = 0x1c1a1f;
export const RED = 0xc4303d;

export function toonGradient() {
  const data = new Uint8Array([120, 205, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function makeMaterials(gradientMap) {
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  return {
    toon,
    white: toon(0xfffdf8),
    ink: toon(INK),
    red: toon(RED),
    blush: new THREE.MeshBasicMaterial({ color: 0xffb3b0, transparent: true, opacity: 0.7 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    speck: new THREE.MeshBasicMaterial({ color: 0xe9e9ef }),
    tongue: toon(0xff7b8a),
    outline: new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
  };
}

// A mesh with an inverted-hull outline child — the whole "drawn with a marker" look.
export function inked(geo, mat, mats, { pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], outline = 0.05 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  if (outline) {
    const o = new THREE.Mesh(geo, mats.outline);
    o.scale.setScalar(1 + outline);
    o.raycast = () => {};
    m.add(o);
  }
  return m;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Pochacco's head, from the reference sheets: a tall dome whose lower third
// swells into round cheeks (a bell), with a soft, wide chin.
const HEAD = { A: 0.84, B: 0.89, C: 0.8 };
function deformHead(x, y, z, out) {
  const g = Math.exp(-(((y + 0.5) / 0.3) ** 2)); // cheek band
  const top = smooth(0.25, 1, y);
  const widen = (1 + 0.3 * g) * (1 - 0.06 * top);
  let yy = y;
  if (yy < -0.78) yy = -0.78 + (yy + 0.78) * 0.55; // softly flattened chin
  return out.set(x * HEAD.A * widen, yy * HEAD.B, z * HEAD.C * (1 + 0.12 * g));
}

function headGeometry() {
  const g = new THREE.SphereGeometry(1, 72, 54);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    deformHead(p.getX(i), p.getY(i), p.getZ(i), v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Point + orientation on the head surface for unit-sphere front coords (x, y).
function onHead(x, y, lift = 0) {
  const P = (a, b) => {
    const z = Math.sqrt(Math.max(0, 1 - a * a - b * b));
    return deformHead(a, b, z, new THREE.Vector3());
  };
  const p = P(x, y);
  const e = 0.01;
  const tx = P(x + e, y).sub(P(x - e, y));
  const ty = P(x, y + e).sub(P(x, y - e));
  const n = new THREE.Vector3().crossVectors(tx, ty).normalize();
  if (n.z < 0 && Math.abs(y) < 0.95) n.negate();
  p.addScaledVector(n, lift);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return { p, q, n };
}

function place(obj, x, y, lift = 0) {
  const { p, q } = onHead(x, y, lift);
  obj.position.copy(p);
  obj.quaternion.copy(q);
  return obj;
}

// Long leaf-shaped ear: pinched at the base, fullest ~2/3 out, rounded tip.
const EAR = { L: 0.92, W: 0.225, flat: 0.36 };
const earRadius = (t) => EAR.W * Math.sin(Math.PI * Math.pow(t, 1.45));
function earGeometry() {
  const pts = [];
  const N = 32;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(Math.max(earRadius(t), 0.0005), t * EAR.L));
  }
  const g = new THREE.LatheGeometry(pts, 40);
  g.translate(0, -EAR.L * 0.5, 0);
  return g;
}

export function createPochacco(mats) {
  const S = new THREE.SphereGeometry(1, 40, 28);
  const root = new THREE.Group();   // choreography: position, scale, facing
  const hop = new THREE.Group();    // jumps & spins
  const squash = new THREE.Group(); // squash & stretch from the feet
  root.add(hop);
  hop.add(squash);
  // parts that fly apart in the blueprint (exploded-view) section
  const parts = {};
  const part = (key, obj, dir) => {
    parts[key] = { obj, base: obj.position.clone(), dir: new THREE.Vector3(...dir) };
    return obj;
  };

  // ── lower body (white) + legs ──────────────────────────────
  const hips = inked(S, mats.white, mats, { pos: [0, 0.42, 0], scale: [0.5, 0.36, 0.44] });
  squash.add(part('hips', hips, [0, -0.25, 0]));

  const legGeo = new THREE.CapsuleGeometry(0.15, 0.1, 8, 18);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.22 * s, 0.33, 0.04);
    pivot.add(inked(legGeo, mats.white, mats, { pos: [0, -0.13, 0.02], outline: 0.08 }));
    for (const dx of [-0.035, 0.035]) {
      const toe = new THREE.Mesh(S, mats.ink);
      toe.scale.set(0.011, 0.032, 0.01);
      toe.position.set(dx, -0.25, 0.155);
      pivot.add(toe);
    }
    squash.add(part(s < 0 ? 'legL' : 'legR', pivot, [0.3 * s, -0.45, 0.05]));
    return pivot;
  });

  // ── crimson T-shirt ────────────────────────────────────────
  const shirt = inked(S, mats.red, mats, { pos: [0, 0.74, 0], scale: [0.56, 0.4, 0.48], outline: 0.045 });
  squash.add(part('shirt', shirt, [0, 0, 0]));

  // ── arms: red sleeve + white nub ───────────────────────────
  const armGeo = new THREE.CapsuleGeometry(0.115, 0.2, 8, 18);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.44 * s, 0.9, 0.04);
    pivot.rotation.z = 0.5 * s;
    pivot.add(inked(armGeo, mats.white, mats, { pos: [0, -0.24, 0], outline: 0.09 }));
    pivot.add(inked(S, mats.red, mats, { pos: [0, -0.06, 0], scale: [0.17, 0.16, 0.17], outline: 0.08 }));
    const hand = new THREE.Object3D();
    hand.position.set(0, -0.42, 0);
    pivot.add(hand);
    squash.add(part(s < 0 ? 'armL' : 'armR', pivot, [0.75 * s, 0.05, 0]));
    return { pivot, hand, s };
  });

  // ── tail with a black tip ──────────────────────────────────
  const tail = new THREE.Group();
  tail.position.set(0, 0.36, -0.36);
  tail.rotation.x = -0.9;
  const tailGeo = new THREE.CapsuleGeometry(0.07, 0.14, 6, 12);
  tail.add(inked(tailGeo, mats.white, mats, { pos: [0, 0.08, 0], outline: 0.12 }));
  tail.add(inked(S, mats.ink, mats, { pos: [0, 0.22, 0], scale: [0.09, 0.12, 0.09], outline: 0.08 }));
  squash.add(part('tail', tail, [0.35, -0.1, -0.7]));

  // ── head ───────────────────────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(0, 1.04, 0);
  squash.add(part('head', neck, [0, 0.75, 0]));
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0);
  neck.add(head);
  head.add(inked(headGeometry(), mats.white, mats, { outline: 0.028 }));

  // face features share one group so the blueprint can pop them forward
  const face = new THREE.Group();
  head.add(part('face', face, [0, -0.05, 0.45]));

  // eyes — small upright ovals, set low and wide apart
  const eyesOpen = [];
  const eyesHappy = [];
  const arc = new THREE.TorusGeometry(0.06, 0.018, 8, 24, Math.PI);
  [-1, 1].forEach((s) => {
    const eye = place(new THREE.Group(), 0.35 * s, -0.36);
    const pupil = new THREE.Mesh(S, mats.ink);
    pupil.scale.set(0.056, 0.075, 0.035);
    const shine = new THREE.Mesh(S, mats.shine);
    shine.scale.set(0.014, 0.018, 0.01);
    shine.position.set(0.016, 0.028, 0.03);
    eye.add(pupil, shine);
    face.add(eye);
    eyesOpen.push(eye);

    const happy = place(new THREE.Mesh(arc, mats.ink), 0.35 * s, -0.38, 0.006);
    happy.visible = false;
    face.add(happy);
    eyesHappy.push(happy);

    const blush = place(new THREE.Mesh(new THREE.CircleGeometry(0.085, 32), mats.blush), 0.62 * s, -0.56, 0.014);
    blush.scale.set(1.25, 0.8, 1);
    face.add(blush);
  });

  // nose — a wide little bean, just below the eye line
  const nose = place(new THREE.Mesh(S, mats.ink), 0, -0.47);
  nose.scale.set(0.082, 0.055, 0.045);
  const noseShine = new THREE.Mesh(S, mats.shine);
  noseShine.scale.set(0.22, 0.2, 0.2);
  noseShine.position.set(-0.3, 0.38, 0.85);
  nose.add(noseShine);
  face.add(nose);

  // open mouth (only while barking)
  const mouthOpen = place(new THREE.Group(), 0, -0.62, 0.004);
  const mo = new THREE.Mesh(S, mats.ink);
  mo.scale.set(0.065, 0.055, 0.02);
  const tongue = new THREE.Mesh(S, mats.tongue);
  tongue.scale.set(0.042, 0.028, 0.012);
  tongue.position.set(0, -0.022, 0.012);
  mouthOpen.add(mo, tongue);
  mouthOpen.scale.setScalar(0.001);
  face.add(mouthOpen);

  // crease strokes where the dome meets the puffy cheeks
  const creaseGeo = new THREE.TorusGeometry(0.13, 0.013, 6, 18, Math.PI * 0.45);
  [-1, 1].forEach((s) => {
    const c = place(new THREE.Mesh(creaseGeo, mats.ink), 0.86 * s, -0.3, 0.004);
    c.rotateZ(s > 0 ? Math.PI * 0.78 : Math.PI * 1.77);
    face.add(c);
  });

  // three hair strokes floating just above the dome: two on the left, one arc on the right
  const tufts = new THREE.Group();
  tufts.position.set(0, HEAD.B + 0.07, 0.14);
  const wedge = new THREE.ConeGeometry(0.03, 0.15, 10);
  [[-0.26, 0.02, 0.62], [-0.11, 0.05, 0.22]].forEach(([x, y, rz]) => {
    const t = new THREE.Mesh(wedge, mats.ink);
    t.position.set(x, y, 0);
    t.rotation.set(0, 0, rz + Math.PI); // thick end up, thin end down toward the head
    tufts.add(t);
  });
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20, 1.3), mats.ink);
  hook.position.set(0.14, -0.08, 0);
  hook.rotation.z = 0.75;
  tufts.add(hook);
  head.add(part('tufts', tufts, [0, 0.45, 0.1]));

  // ears — one standing up, one flopped out sideways; glossy white specks
  const earGeo = earGeometry();
  const earDefs = [
    { s: -1, at: [-0.56, 0.74], base: 0.42, z: 0.14, key: 'earL', dir: [-0.6, 0.22, 0] },  // up
    { s: 1, at: [0.62, 0.62], base: -1.6, z: 0.02, key: 'earR', dir: [0.6, 0.1, 0] },     // sideways
  ];
  const specks = [[0.3, -0.02, 0.9], [0.42, 0.05, 0.55], [0.55, -0.05, 1], [0.7, 0.04, 0.7], [0.82, -0.02, 0.5]];
  const ears = earDefs.map((d) => {
    const pivot = new THREE.Group();
    const { p } = onHead(d.at[0], d.at[1]);
    pivot.position.copy(p).multiplyScalar(0.92);
    pivot.position.z = d.z;
    pivot.rotation.set(0, 0.2 * d.s, d.base);
    pivot.add(inked(earGeo, mats.ink, mats, { pos: [0, EAR.L * 0.5 - 0.04, 0], scale: [1, 1, EAR.flat], outline: 0.05 }));
    for (const [t, xo, k] of specks) {
      const r = earRadius(t);
      const sp = new THREE.Mesh(S, mats.speck);
      sp.scale.set(0.016 * k + 0.008, 0.034 * k + 0.012, 0.006);
      sp.position.set(xo * r * 2.2, t * EAR.L - 0.04, r * EAR.flat + 0.004);
      sp.rotation.z = xo * 3;
      pivot.add(sp);
    }
    head.add(part(d.key, pivot, d.dir));
    return { pivot, s: d.s, base: d.base, angle: 0, vel: 0 };
  });

  return { root, hop, squash, neck, head, face, nose, ears, arms, legs, tail, tufts, eyesOpen, eyesHappy, mouthOpen, parts };
}
