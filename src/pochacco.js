import * as THREE from 'three';

// Vinyl-figure Pochacco: satin white body, glossy black ears / eyes, fabric-ish shirt.
// Modeled after the official 3D figures — gumdrop head, thick tube ears, three hair nubs.

export const INK = 0x141318;
export const RED = 0xd6333f;

export function makeMaterials() {
  const soft = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0, ...extra });
  return {
    // props are glossy vinyl toys, same family as the figure
    toon: (color, extra = {}) => soft(color, { roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, ...extra }),
    soft,
    white: soft(0xfdfcff, { roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.45 }),
    ink: soft(INK, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }),
    red: soft(RED, { roughness: 0.62, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9a9a) }),
    pad: soft(0x2a2528, { roughness: 0.35, clearcoat: 0.6 }),
    blush: new THREE.MeshBasicMaterial({ map: blushTexture(), transparent: true, depthWrite: false, opacity: 0.85 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    tongue: soft(0xff7b8a, { roughness: 0.4 }),
  };
}

function blushTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,150,160,0.95)');
  grd.addColorStop(0.45, 'rgba(255,160,170,0.6)');
  grd.addColorStop(1, 'rgba(255,170,180,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Kept for the props: a mesh at a transform (the ink-outline era is over).
export function inked(geo, mat, _mats, { pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  return m;
}

function mesh(geo, mat, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Smooth lathe from a handful of (radius, y) control points.
function smoothLathe(ctrl, { samples = 64, segments = 64 } = {}) {
  const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(p.x, 0.0001), p.y));
  return new THREE.LatheGeometry(pts, segments);
}

// Gumdrop head: full round crown, widening to chubby cheeks, soft flat chin.
function headGeometry() {
  const g = smoothLathe([
    [0.0, -0.8], [0.42, -0.79], [0.72, -0.73], [0.91, -0.58], [0.98, -0.38], [0.96, -0.14],
    [0.89, 0.1], [0.79, 0.34], [0.65, 0.55], [0.46, 0.71], [0.23, 0.8], [0.0, 0.825],
  ], { samples: 90, segments: 80 });
  g.scale(1, 1.1, 0.86);
  g.computeVertexNormals();
  return g;
}

// Thick glossy ear: tube that swells a little then ends in a round tip, bent outward.
function earGeometry(bend = -1) {
  const L = 1.0;
  const g = smoothLathe([
    [0.0, -0.02], [0.12, 0.0], [0.15, 0.12], [0.17, 0.4], [0.175, 0.7], [0.17, 0.9],
    [0.14, 1.03], [0.08, 1.1], [0.0, 1.13],
  ], { samples: 60, segments: 40 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + bend * 0.12 * y * y); // tip curls outward
    p.setZ(i, p.getZ(i) * 0.82);
  }
  g.computeVertexNormals();
  return g;
}

function foot(mats) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(1, 40, 28), mats.white, [0, 0, 0.04], [0.19, 0.15, 0.23]));
  // paw pads on the sole
  const pad = new THREE.SphereGeometry(1, 20, 14);
  g.add(mesh(pad, mats.pad, [0, -0.14, 0.02], [0.075, 0.02, 0.085]));
  [[-0.08, 0.12], [0, 0.155], [0.08, 0.12]].forEach(([x, z]) => g.add(mesh(pad, mats.pad, [x, -0.125, z], [0.03, 0.018, 0.03])));
  return g;
}

export function createPochacco(mats) {
  const S = new THREE.SphereGeometry(1, 48, 32);
  const root = new THREE.Group();   // choreography: position, scale, facing
  const hop = new THREE.Group();    // jumps & spins
  const squash = new THREE.Group(); // squash & stretch from the feet
  root.add(hop);
  hop.add(squash);
  const parts = {};
  const part = (key, obj, dir) => {
    parts[key] = { obj, base: obj.position.clone(), dir: new THREE.Vector3(...dir) };
    return obj;
  };

  // ── lower body: chubby white bottom ────────────────────────
  const bottom = mesh(smoothLathe([
    [0.0, 0.12], [0.28, 0.13], [0.42, 0.2], [0.47, 0.34], [0.46, 0.5], [0.4, 0.64], [0.26, 0.74], [0.0, 0.78],
  ]), mats.white, [0, 0, 0], [1, 1, 0.9]);
  squash.add(part('hips', bottom, [0, -0.25, 0]));

  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.2 * s, 0.3, 0.02);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.16, 0.08, 10, 24), mats.white, [0, -0.08, 0]));
    const f = foot(mats);
    f.position.set(0, -0.15, 0.02);
    pivot.add(f);
    squash.add(part(s < 0 ? 'legL' : 'legR', pivot, [0.3 * s, -0.45, 0.05]));
    return pivot;
  });

  // ── polo shirt ─────────────────────────────────────────────
  const shirt = new THREE.Group();
  shirt.add(mesh(smoothLathe([
    [0.49, 0.33], [0.53, 0.36], [0.55, 0.46], [0.54, 0.62], [0.5, 0.8], [0.42, 0.97], [0.28, 1.09], [0.1, 1.14], [0.0, 1.15],
  ]), mats.red, [0, 0, 0], [1, 1, 0.88]));
  // rolled hem
  shirt.add(mesh(new THREE.TorusGeometry(0.515, 0.035, 12, 64), mats.red, [0, 0.35, 0], [1, 0.88, 1], [Math.PI / 2, 0, 0]));
  // collar flaps (the V of a polo)
  const flapGeo = new THREE.SphereGeometry(1, 24, 16);
  [-1, 1].forEach((s) => {
    shirt.add(mesh(flapGeo, mats.red, [0.12 * s, 1.03, 0.3], [0.17, 0.05, 0.1], [0.5, 0.35 * s, -0.55 * s]));
  });
  squash.add(part('shirt', shirt, [0, 0, 0]));

  // ── arms: flared short sleeve + chunky white nub ───────────
  const sleeveGeo = new THREE.CylinderGeometry(0.13, 0.175, 0.22, 32, 1);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.44 * s, 0.92, 0.02);
    pivot.rotation.z = 0.5 * s;
    pivot.add(mesh(sleeveGeo, mats.red, [0, -0.08, 0]));
    pivot.add(mesh(new THREE.TorusGeometry(0.168, 0.028, 10, 36), mats.red, [0, -0.19, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
    pivot.add(mesh(new THREE.CapsuleGeometry(0.14, 0.14, 10, 24), mats.white, [0, -0.3, 0]));
    const hand = new THREE.Object3D();
    hand.position.set(0, -0.44, 0);
    pivot.add(hand);
    squash.add(part(s < 0 ? 'armL' : 'armR', pivot, [0.75 * s, 0.05, 0]));
    return { pivot, hand, s };
  });

  // ── tail ───────────────────────────────────────────────────
  const tail = new THREE.Group();
  tail.position.set(0, 0.4, -0.38);
  tail.rotation.x = -0.9;
  tail.add(mesh(new THREE.CapsuleGeometry(0.075, 0.12, 8, 16), mats.white, [0, 0.08, 0]));
  tail.add(mesh(S, mats.ink, [0, 0.2, 0], [0.085, 0.1, 0.085]));
  squash.add(part('tail', tail, [0.35, -0.1, -0.7]));

  // ── head ───────────────────────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(0, 1.04, 0);
  squash.add(part('head', neck, [0, 0.75, 0]));
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0);
  neck.add(head);
  const skull = mesh(headGeometry(), mats.white);
  head.add(skull);

  // surface placement by raycasting the actual head mesh from the front
  skull.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const Z = new THREE.Vector3(0, 0, 1);
  function place(obj, x, y, lift = 0) {
    ray.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(skull, false)[0];
    if (!hit) return obj;
    const n = hit.face.normal.clone().normalize();
    obj.position.copy(hit.point).addScaledVector(n, lift);
    obj.quaternion.setFromUnitVectors(Z, n);
    return obj;
  }

  const face = new THREE.Group();
  head.add(part('face', face, [0, -0.05, 0.45]));

  // eyes — glossy black ovals, wide-set, low on the face
  const eyesOpen = [];
  const eyesHappy = [];
  const arc = new THREE.TorusGeometry(0.07, 0.022, 12, 28, Math.PI);
  [-1, 1].forEach((s) => {
    const eye = place(new THREE.Group(), 0.36 * s, -0.22, -0.006);
    const pupil = mesh(S, mats.ink, [0, 0, 0], [0.07, 0.092, 0.045]);
    const shine = new THREE.Mesh(S, mats.shine);
    shine.scale.set(0.017, 0.021, 0.01);
    shine.position.set(0.02 * -s + 0.01, 0.034, 0.038);
    eye.add(pupil, shine);
    face.add(eye);
    eyesOpen.push(eye);

    const happy = place(mesh(arc, mats.ink), 0.36 * s, -0.24, 0.004);
    happy.visible = false;
    face.add(happy);
    eyesHappy.push(happy);

    const blush = place(new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.22), mats.blush), 0.56 * s, -0.42, 0.012);
    face.add(blush);
  });

  // nose — glossy horizontal bean between and below the eyes
  const nose = place(new THREE.Group(), 0.0, -0.34, -0.012);
  nose.add(mesh(S, mats.ink, [0, 0, 0], [0.098, 0.064, 0.05]));
  const noseShine = new THREE.Mesh(S, mats.shine);
  noseShine.scale.set(0.022, 0.012, 0.01);
  noseShine.position.set(-0.03, 0.03, 0.045);
  nose.add(noseShine);
  face.add(nose);

  // open mouth (only while barking)
  const mouthOpen = place(new THREE.Group(), 0.02, -0.5, 0.004);
  const mo = new THREE.Mesh(S, mats.ink);
  mo.scale.set(0.06, 0.05, 0.02);
  const tongue = new THREE.Mesh(S, mats.tongue);
  tongue.scale.set(0.04, 0.026, 0.012);
  tongue.position.set(0, -0.02, 0.012);
  mouthOpen.add(mo, tongue);
  mouthOpen.scale.setScalar(0.001);
  face.add(mouthOpen);

  // three glossy hair nubs fanning out of the crown
  const tufts = new THREE.Group();
  tufts.position.set(0, 0.87, 0.02);
  const nub = new THREE.CapsuleGeometry(0.068, 0.13, 8, 16);
  [-0.5, 0, 0.5].forEach((a) => {
    tufts.add(mesh(nub, mats.ink, [Math.sin(a) * 0.14, 0.08 + Math.cos(a) * 0.03, 0], [1, 1, 1], [0, 0, -a]));
  });
  head.add(part('tufts', tufts, [0, 0.45, 0.1]));

  // ears — thick glossy tubes rising from the top sides
  const earDefs = [
    { s: -1, pos: [-0.44, 0.66, -0.1], base: 0.36, key: 'earL', dir: [-0.6, 0.22, 0] },
    { s: 1, pos: [0.44, 0.66, -0.1], base: -0.9, key: 'earR', dir: [0.6, 0.1, 0] },
  ];
  const ears = earDefs.map((d) => {
    const pivot = new THREE.Group();
    pivot.position.set(...d.pos);
    pivot.rotation.set(0, 0, d.base);
    pivot.add(mesh(earGeometry(d.s), mats.ink));
    head.add(part(d.key, pivot, d.dir));
    return { pivot, s: d.s, base: d.base, angle: 0, vel: 0 };
  });

  return { root, hop, squash, neck, head, face, nose, ears, arms, legs, tail, tufts, eyesOpen, eyesHappy, mouthOpen, parts };
}
