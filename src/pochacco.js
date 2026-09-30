import * as THREE from 'three';

export const INK = 0x1c1a1f;
export const RED = 0xe23b2e;

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
    blush: new THREE.MeshBasicMaterial({ color: 0xffb3b0, transparent: true, opacity: 0.85 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
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

// Pochacco's head: a bun — round on top, puffy cheeks that bulge out at the bottom.
const HEAD = { A: 0.93, B: 0.86, C: 0.82 };
function deformHead(x, y, z, out) {
  const cheek = smooth(0.3, -0.55, y) * (1 - smooth(-0.75, -1, y) * 0.6);
  const widen = 1 + 0.11 * cheek;
  let yy = y;
  if (yy < -0.72) yy = -0.72 + (yy + 0.72) * 0.6; // softly flattened chin
  return out.set(x * HEAD.A * widen, yy * HEAD.B, z * HEAD.C * (1 + 0.1 * cheek));
}

function headGeometry() {
  const g = new THREE.SphereGeometry(1, 64, 48);
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

// Leaf-shaped floppy ear, grown along +y from its base.
function earGeometry() {
  const L = 0.86, W = 0.25, pts = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(Math.max(W * Math.sin(Math.PI * Math.pow(t, 1.55)), 0.0005), t * L));
  }
  const g = new THREE.LatheGeometry(pts, 36);
  g.translate(0, -L * 0.5, 0);
  return { g, L };
}

export function createPochacco(mats) {
  const S = new THREE.SphereGeometry(1, 40, 28);
  const root = new THREE.Group();   // choreography: position, scale, facing
  const hop = new THREE.Group();    // jumps & spins
  const squash = new THREE.Group(); // squash & stretch from the feet
  root.add(hop);
  hop.add(squash);

  // ── lower body (white) + legs ──────────────────────────────
  squash.add(inked(S, mats.white, mats, { pos: [0, 0.42, 0], scale: [0.5, 0.36, 0.44] }));

  const legGeo = new THREE.CapsuleGeometry(0.15, 0.1, 8, 18);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.22 * s, 0.33, 0.04);
    pivot.add(inked(legGeo, mats.white, mats, { pos: [0, -0.13, 0.02], outline: 0.08 }));
    // tiny paw-pad toe lines
    const toe = new THREE.Mesh(S, mats.ink);
    toe.scale.set(0.012, 0.035, 0.01);
    toe.position.set(0.03 * s, -0.25, 0.15);
    pivot.add(toe);
    squash.add(pivot);
    return pivot;
  });

  // ── red T-shirt ────────────────────────────────────────────
  const shirt = inked(S, mats.red, mats, { pos: [0, 0.74, 0], scale: [0.56, 0.4, 0.48], outline: 0.045 });
  squash.add(shirt);

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
    squash.add(pivot);
    return { pivot, hand, s };
  });

  // ── tail with a black tip ──────────────────────────────────
  const tail = new THREE.Group();
  tail.position.set(0, 0.36, -0.36);
  tail.rotation.x = -0.9;
  const tailGeo = new THREE.CapsuleGeometry(0.07, 0.14, 6, 12);
  tail.add(inked(tailGeo, mats.white, mats, { pos: [0, 0.08, 0], outline: 0.12 }));
  tail.add(inked(S, mats.ink, mats, { pos: [0, 0.22, 0], scale: [0.09, 0.12, 0.09], outline: 0.08 }));
  squash.add(tail);

  // ── head ───────────────────────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(0, 1.06, 0);
  squash.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.56, 0);
  neck.add(head);
  head.add(inked(headGeometry(), mats.white, mats, { outline: 0.03 }));

  // eyes — small upright ovals, set wide & low
  const eyesOpen = [];
  const eyesHappy = [];
  const arc = new THREE.TorusGeometry(0.06, 0.018, 8, 24, Math.PI);
  [-1, 1].forEach((s) => {
    const eye = place(new THREE.Group(), 0.37 * s, -0.12);
    const pupil = new THREE.Mesh(S, mats.ink);
    pupil.scale.set(0.058, 0.082, 0.035);
    const shine = new THREE.Mesh(S, mats.shine);
    shine.scale.set(0.016, 0.02, 0.01);
    shine.position.set(0.018, 0.03, 0.03);
    eye.add(pupil, shine);
    head.add(eye);
    eyesOpen.push(eye);

    const happy = place(new THREE.Mesh(arc, mats.ink), 0.37 * s, -0.14, 0.006);
    happy.visible = false;
    head.add(happy);
    eyesHappy.push(happy);

    // blush
    const blush = place(new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), mats.blush), 0.62 * s, -0.36, 0.012);
    blush.scale.set(1.2, 0.8, 1);
    head.add(blush);
  });

  // nose — a little horizontal bean
  const nose = place(new THREE.Mesh(S, mats.ink), 0, -0.25);
  nose.scale.set(0.078, 0.055, 0.045);
  const noseShine = new THREE.Mesh(S, mats.shine);
  noseShine.scale.set(0.25, 0.22, 0.2);
  noseShine.position.set(-0.3, 0.35, 0.85);
  nose.add(noseShine);
  head.add(nose);

  // open mouth (only while barking)
  const mouthOpen = place(new THREE.Group(), 0, -0.42, 0.004);
  const mo = new THREE.Mesh(S, mats.ink);
  mo.scale.set(0.07, 0.06, 0.02);
  const tongue = new THREE.Mesh(S, mats.tongue);
  tongue.scale.set(0.045, 0.03, 0.012);
  tongue.position.set(0, -0.025, 0.012);
  mouthOpen.add(mo, tongue);
  mouthOpen.scale.setScalar(0.001);
  head.add(mouthOpen);

  // cheek contour strokes (the little curve where the cheeks puff)
  const cheekGeo = new THREE.TorusGeometry(0.1, 0.014, 6, 16, Math.PI * 0.55);
  [-1, 1].forEach((s) => {
    const c = place(new THREE.Mesh(cheekGeo, mats.ink), 0.84 * s, -0.36, 0.004);
    c.rotateZ(s > 0 ? Math.PI * 0.95 : Math.PI * 1.5);
    head.add(c);
  });

  // three hair tufts on top
  const tuftGeo = new THREE.CapsuleGeometry(0.018, 0.1, 4, 8);
  const tufts = new THREE.Group();
  tufts.position.set(0, HEAD.B - 0.02, 0.05);
  [-0.35, 0, 0.35].forEach((a, i) => {
    const t = new THREE.Mesh(tuftGeo, mats.ink);
    t.position.set(Math.sin(a) * 0.14, 0.06 + (i === 1 ? 0.03 : 0), 0);
    t.rotation.z = -a * 1.4;
    tufts.add(t);
  });
  head.add(tufts);

  // ears — one perked up, one flopped sideways (the signature asymmetry)
  const { g: earGeo, L: EL } = earGeometry();
  const earDefs = [
    { s: -1, at: [-0.44, 0.76], base: 0.42, z: 0.12 },  // up, leaning left
    { s: 1, at: [0.74, 0.5], base: -1.72, z: 0.0 },     // flopped out to the right
  ];
  const ears = earDefs.map((d) => {
    const pivot = new THREE.Group();
    const { p } = onHead(d.at[0], d.at[1]);
    pivot.position.copy(p).multiplyScalar(0.9);
    pivot.position.z = d.z;
    pivot.rotation.set(0, 0.25 * d.s, d.base);
    pivot.add(inked(earGeo, mats.ink, mats, { pos: [0, EL * 0.5 - 0.04, 0], scale: [1, 1, 0.38], outline: 0.05 }));
    head.add(pivot);
    return { pivot, s: d.s, base: d.base, angle: 0, vel: 0 };
  });

  return { root, hop, squash, neck, head, ears, arms, legs, tail, tufts, eyesOpen, eyesHappy, mouthOpen };
}
