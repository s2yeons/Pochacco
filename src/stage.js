import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterials, createPochacco } from './pochacco.js';
import { createSparkles } from './sparkles.js';
import { createHoops } from './hoops.js';
import { makeBasketball, makeBanana, makeStar, makeBone, makeHeart, makeIceCream, makeHoop, blobTexture } from './props.js';

const TAU = Math.PI * 2;
const G = 24;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

// Where Pochacco stands and what he's doing in each section.
// x/y are fractions of the visible frustum at z=0, so the layout survives any aspect ratio.
const DESKTOP = {
  hero:        { x: 0.0,   y: -0.16, s: 0.98, ry: 0.0,  mode: 'idle' },
  profile:     { x: -0.25, y: -0.16, s: 0.9,  ry: 0.4,  mode: 'idle' },
  anatomy:     { x: 0.0,   y: -0.24, s: 0.8,  ry: 0.0,  mode: 'anatomy' },
  personality: { x: -0.05, y: -0.27, s: 0.62, ry: Math.PI / 2, mode: 'run' },
  sports:      { x: -0.2,  y: -0.3,  s: 0.72, ry: 0.55, mode: 'dribble' },
  icecream:    { x: 0.24,  y: -0.17, s: 0.86, ry: -0.45, mode: 'happy' },
  outro:       { x: 0.31,  y: -0.26, s: 0.74, ry: -0.3, mode: 'party' },
};
const MOBILE = {
  hero:        { x: 0.0,  y: -0.12, s: 0.66, ry: 0.0,  mode: 'idle' },
  profile:     { x: 0.22, y: -0.33, s: 0.44, ry: -0.3, mode: 'idle' },
  anatomy:     { x: 0.0,  y: -0.05, s: 0.44, ry: 0.0,  mode: 'anatomy' },
  personality: { x: 0.0,  y: -0.3,  s: 0.48, ry: Math.PI / 2, mode: 'run' },
  sports:      { x: -0.24, y: -0.12, s: 0.36, ry: 0.5,  mode: 'dribble' },
  icecream:    { x: 0.18, y: -0.3,  s: 0.52, ry: -0.4, mode: 'happy' },
  outro:       { x: 0.0,  y: -0.26, s: 0.54, ry: 0.0,  mode: 'party' },
};

const PHRASES = ['왈!', '놀자!', '멍멍!', '공 던져줘!', '바나나 아이스크림!', '킁킁…?', '한 번 더!', '헤헤', '같이 뛰자!'];
const CONFETTI_COLORS = [0xc4303d, 0xffd23f, 0x6cc6ff, 0xffffff, 0x1c1a1f, 0xff8fb1, 0x7fe0c2];

export function createStage(canvas, hooks = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const CAM_Z = 10;
  camera.position.set(0, 0, CAM_Z);

  // studio lighting: soft env reflections (glossy ears/eyes), key light with soft self-shadow, cool rim
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8d4ff, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const SUN_OFFSET = new THREE.Vector3(-3, 6, 6);
  const back = new THREE.DirectionalLight(0xdfe8ff, 1.2);
  back.position.set(4, 3, -5);
  scene.add(back);

  const mats = makeMaterials();
  const sparkles = createSparkles(scene, renderer);
  const SC = sparkles.colors;
  const rig = createPochacco(mats);
  scene.add(rig.root);

  // blob shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.5),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.position.y = 0.005;
  shadow.rotation.x = -Math.PI / 2 + 0.25;
  rig.root.add(shadow);

  const ball = makeBasketball(mats, 0.2);
  ball.scale.setScalar(0.001);
  rig.hop.add(ball);

  const hoop = makeHoop(mats);
  hoop.group.scale.setScalar(0.001);
  scene.add(hoop.group);

  const bigCone = makeIceCream(mats, { scoops: 2 });
  bigCone.scale.setScalar(0.001);
  scene.add(bigCone);

  // ── blueprint rig: dashed orbit rings + measuring line for the exploded view ──
  const blueprint = new THREE.Group();
  const dashMat = new THREE.LineDashedMaterial({ color: 0xfffaf0, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.8 });
  const circle = (r, seg = 96) => {
    const pts = [];
    for (let i = 0; i <= seg; i++) pts.push(new THREE.Vector3(Math.cos((i / seg) * TAU) * r, 0, Math.sin((i / seg) * TAU) * r));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashMat);
    l.computeLineDistances();
    return l;
  };
  const orbitA = circle(1.35);
  const orbitB = circle(1.05);
  orbitB.position.y = 1.7;
  const measure = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.7, 0, 0), new THREE.Vector3(1.7, 3.4, 0)]),
    dashMat
  );
  measure.computeLineDistances();
  blueprint.add(orbitA, orbitB, measure);
  blueprint.scale.setScalar(0.001);
  rig.root.add(blueprint);

  // ── floating props (parallax field) ─────────────────────────
  const floaterFactories = [
    () => makeBasketball(mats, 0.3), () => makeBanana(mats), () => makeStar(mats), () => makeBone(mats),
    () => makeHeart(mats), () => makeStar(mats, 0x6cc6ff), () => makeIceCream(mats, { scoops: 1 }),
  ];
  const floaters = [];
  const FLOAT_N = 18;
  for (let i = 0; i < FLOAT_N; i++) {
    const obj = floaterFactories[i % floaterFactories.length]();
    const side = i % 2 ? 1 : -1;
    const z = i % 4 === 0 ? rand(0, 1.2) : rand(-7, -1);
    const f = {
      obj, z,
      xf: side * rand(0.3, 0.52),
      y0: rand(-1, 1),
      speed: rand(0.35, 1.1) * (1 + (z + 7) * 0.08),
      spin: new THREE.Vector3(rand(-0.6, 0.6), rand(-0.8, 0.8), rand(-0.4, 0.4)),
      phase: rand(0, TAU),
      scale: rand(0.6, 1.0) * (z > 0 ? 0.7 : 1),
    };
    obj.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    obj.scale.setScalar(0.001);
    scene.add(obj);
    floaters.push(f);
  }

  // ── ice-cream / banana rain pool ────────────────────────────
  const rain = [];
  for (let i = 0; i < 22; i++) {
    const obj = i % 3 === 0 ? makeBanana(mats) : i % 3 === 1 ? makeIceCream(mats, { scoops: 1 }) : makeStar(mats);
    obj.visible = false;
    scene.add(obj);
    rain.push({ obj, alive: false, vy: 0, spin: new THREE.Vector3(), s: 1 });
  }

  // ── confetti (instanced) ────────────────────────────────────
  const CN = 480;
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    CN
  );
  confetti.frustumCulled = false;
  const cParts = [];
  const tmpC = new THREE.Color();
  for (let i = 0; i < CN; i++) {
    cParts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), life: 0, w: 0.08, h: 0.13, sway: 0 });
    confetti.setColorAt(i, tmpC.setHex(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
  }
  scene.add(confetti);
  let cHead = 0;
  const dummy = new THREE.Object3D();

  function burst(at, n = 80, power = 1, down = false) {
    for (let i = 0; i < n; i++) {
      const c = cParts[cHead];
      cHead = (cHead + 1) % CN;
      c.p.copy(at);
      const a = rand(0, TAU), up = rand(0.4, 1);
      const sp = rand(3, 8) * power;
      if (down) {
        c.p.x += rand(-0.5, 0.5) * visW;
        c.v.set(rand(-1, 1), rand(-2, 0), rand(-0.5, 0.5));
      } else {
        c.v.set(Math.cos(a) * sp * (1 - up * 0.5), up * sp * 1.1, Math.sin(a) * sp * 0.6);
      }
      c.r.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      c.rv.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
      c.life = rand(1.6, 2.6) * (down ? 1.8 : 1);
      c.w = rand(0.05, 0.1);
      c.h = rand(0.09, 0.16);
      c.sway = rand(0, TAU);
    }
  }

  // shockwave rings
  const rings = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    m.userData.t = 1;
    scene.add(m);
    return m;
  });
  let ringHead = 0;
  function shock(at, color = 0xffffff, size = 1.6) {
    const m = rings[ringHead];
    ringHead = (ringHead + 1) % rings.length;
    m.position.copy(at);
    m.material.color.setHex(color);
    m.userData.t = 0;
    m.userData.size = size;
  }

  // dust puffs
  const dustMat = mats.toon(0xffffff, { transparent: true, opacity: 0.9 });
  const dust = Array.from({ length: 24 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), dustMat.clone());
    m.visible = false;
    m.userData = { t: 1, v: new THREE.Vector3() };
    scene.add(m);
    return m;
  });
  let dustHead = 0;
  function puff(at, vx = 0) {
    const m = dust[dustHead];
    dustHead = (dustHead + 1) % dust.length;
    m.position.copy(at);
    m.userData.t = 0;
    m.userData.v.set(vx + rand(-0.3, 0.3), rand(0.3, 0.9), rand(-0.3, 0.3));
    m.visible = true;
  }

  // ── state ────────────────────────────────────────────────────
  let W = 1, H = 1, visW = 1, visH = 1, mobile = false;
  const cur = { x: 0, y: -0.13, s: 1.2, ry: 0 };
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1, lx: 0, ly: 0, trail: 0, moved: false };
  const pose = {
    legL: 0, legR: 0, armLx: 0, armLz: 0.5, armRx: 0, armRz: 0.5,
    headX: 0, headY: 0, headZ: 0, bob: 0, lean: 0, tail: 0,
  };
  const sq = { x: 1, v: 0 };
  const J = { air: false, pending: 0, y: 0, vy: 0, t: 0, dur: 1, spin: false, from: 0, to: 0, power: 1 };
  const spin = { a: 0, v: 0, drag: false, lastX: 0, downX: 0, downY: 0, moved: 0 };
  const appear = { x: 0, v: 0, on: false };
  const hoopVis = { x: 0, v: 0 };
  const coneVis = { x: 0, v: 0 };
  const explode = { x: 0, v: 0, p: 0 };
  const netSpring = { x: 1, v: 0 };
  const headPrev = new THREE.Vector3(), headVel = new THREE.Vector3(), headAcc = new THREE.Vector3();
  let auraT = 0;
  let blinkT = 2, blinking = 0, barkT = 0, happyFlash = 0, partyT = 0.6, rainT = 0, dustT = 0;
  let feverT = 0, beatT = 0, beatN = 0;
  let mode = 'idle';
  let weights = {};
  let scrollPx = 0, time = 0;
  let hovering = false;
  let ballVis = 0;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
  const hemiSky = new THREE.Color(0xffffff), hemiGround = new THREE.Color(0xc8d4ff);

  function resize() {
    W = innerWidth;
    H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    visW = visH * camera.aspect;
    mobile = W / H < 0.85;
    sparkles.layoutAmbient(visW, visH, mobile);
  }
  resize();
  addEventListener('resize', resize);

  function headWorld(out = new THREE.Vector3()) {
    return rig.head.getWorldPosition(out);
  }
  function toScreen(v) {
    tmp3.copy(v).project(camera);
    return { x: (tmp3.x * 0.5 + 0.5) * W, y: (-tmp3.y * 0.5 + 0.5) * H };
  }

  function bark(text) {
    barkT = 1.1;
    const phrase = text || PHRASES[(Math.random() * PHRASES.length) | 0];
    hooks.onBark?.(phrase);
    hooks.sfx?.bark();
  }

  function jump({ spin: doSpin = false, power = 1 } = {}) {
    if (J.air || J.pending > 0 || !appear.on) return false;
    J.pending = 0.09;
    J.power = power;
    J.spin = doSpin;
    sq.v -= 5;
    return true;
  }

  // ── basketball game ─────────────────────────────────────────
  const table = () => (mobile ? MOBILE : DESKTOP);
  const hoops = createHoops({
    scene, ball, hoop, rig, sparkles, hooks,
    active: () => (weights.sports || 0) > 0.6 && appear.on,
    view: () => ({ visW, visH, W, H, mobile, s: cur.s }),
    baseX: () => table().sports.x * visW,
    ballVis: () => ballVis,
    toScreen,
    jump,
    burst,
    shock,
    netKick: () => { netSpring.v -= 9; },
    cheer: (label) => {
      happyFlash = 1.2;
      hoops.setPose('cheer', 0.7);
      if (Math.random() < 0.5) bark(['나이스!', '골인!', '헤헤', '멍!'][(Math.random() * 4) | 0]);
    },
    sad: () => {
      hoops.setPose('sad', 0.8);
      if (Math.random() < 0.4) bark(['으앙', '아깝다!', '다시!'][(Math.random() * 3) | 0]);
    },
    celebrate: () => party(),
  });

  // ── pointer: look-at, click to jump, drag to spin ───────────
  function hitTest(clientX, clientY) {
    if (!appear.on) return false;
    ndc.set((clientX / W) * 2 - 1, -(clientY / H) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(rig.squash, true).length > 0;
  }

  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / W) * 2 - 1;
    mouse.y = -(e.clientY / H) * 2 + 1;
    mouse.px = e.clientX;
    mouse.py = e.clientY;
    mouse.moved = true;
    if (spin.drag) {
      const dx = e.clientX - spin.lastX;
      spin.lastX = e.clientX;
      spin.v += dx * 0.9;
      spin.moved += Math.abs(dx);
    }
  });
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, .no-stage, .court-zone')) return;
    if (!hitTest(e.clientX, e.clientY)) return;
    spin.drag = true;
    spin.lastX = spin.downX = e.clientX;
    spin.moved = 0;
  });
  addEventListener('pointerup', () => {
    if (!spin.drag) return;
    spin.drag = false;
    if (spin.moved < 8) poke();
  });

  function poke() {
    if (jump({ spin: Math.random() < 0.35 })) {
      happyFlash = 0.9;
      bark();
      const h = headWorld();
      burst(h, 70);
      shock(h, 0xffffff, 2.2);
      sparkles.emit(h, { n: 60, speed: 4, spread: 0.3, up: 0.3, colors: SC.gold, life: 1.2, size: 0.45 });
      hooks.onPoke?.();
    }
  }

  function spawnRain(n = 1, fromY) {
    for (let k = 0; k < n; k++) {
      const r = rain.find((q) => !q.alive);
      if (!r) return;
      r.alive = true;
      r.obj.visible = true;
      const z = rand(-4, 0.5);
      const w = visW * (CAM_Z - z) / CAM_Z;
      r.obj.position.set(rand(-0.48, 0.48) * w, fromY ?? visH * 0.5 * (CAM_Z - z) / CAM_Z + rand(0.5, 2), z);
      r.vy = rand(1.2, 2.6);
      r.spin.set(rand(-2, 2), rand(-2, 2), rand(-2, 2));
      r.s = rand(0.45, 0.8);
      r.obj.scale.setScalar(r.s);
    }
  }

  function treat() {
    spawnRain(12);
    jump({ spin: true });
    happyFlash = 1.5;
    bark('냠냠!');
    burst(headWorld(), 60);
    bigCone.getWorldPosition(tmp);
    sparkles.emit(tmp, { n: 90, speed: 4.5, spread: 0.4, up: 0.2, colors: SC.pink, life: 1.4, size: 0.5 });
  }

  function party() {
    jump({ spin: true, power: 1.25 });
    happyFlash = 1.8;
    bark(['최고야!', '또 놀러와!', '신난다!'][(Math.random() * 3) | 0]);
    const h = headWorld();
    burst(h, 160, 1.3);
    shock(h, 0xffd23f, 3);
    shock(h.clone().add(tmp.set(0, 0.3, 0)), 0xc4303d, 2.2);
    sparkles.emit(h, { n: 180, speed: 7, spread: 0.3, up: 0.2, gravity: 2, colors: SC.party, life: 1.8, size: 0.55 });
  }

  function fever(seconds = 9) {
    if (feverT > 0) return;
    feverT = seconds;
    beatT = 0;
    beatN = 0;
    happyFlash = seconds;
    bark('FEVER!!');
    party();
  }

  function intro() {
    appear.on = true;
    J.air = true;
    J.y = 5.5;
    J.vy = 0;
    J.spin = false;
    J.from = J.to = 0;
    J.dur = 1;
    J.t = 0;
    J.power = 1.4;
    for (const f of floaters) f.pop = rand(0, 0.8);
  }

  // ── the frame ───────────────────────────────────────────────
  function update(dt, choreo) {
    dt = Math.min(dt, 1 / 30);
    time += dt;
    scrollPx = choreo.scroll;
    explode.p = choreo.anatomy ?? explode.p;
    const T = table();
    const A = T[choreo.a], B = T[choreo.b];
    const t = choreo.t;
    mode = t < 0.5 ? A.mode : B.mode;
    weights = { [choreo.a]: 1 - t };
    weights[choreo.b] = (weights[choreo.b] || 0) + t;
    const fev = feverT > 0;
    if (fev) {
      feverT -= dt;
      if (feverT <= 0) {
        hemi.color.copy(hemiSky);
        hemi.groundColor.copy(hemiGround);
        hooks.onFeverEnd?.();
      }
    }

    const L = reduced ? 20 : 4.5;
    const sw = weights.sports || 0;
    cur.x = damp(cur.x, lerp(A.x, B.x, t) + (hoops.shiftX / visW) * sw, L, dt);
    cur.y = damp(cur.y, lerp(A.y, B.y, t), L, dt);
    cur.s = damp(cur.s, lerp(A.s, B.s, t), L, dt);
    cur.ry = damp(cur.ry, lerp(A.ry, B.ry, t), L, dt);

    mouse.sx = damp(mouse.sx, mouse.x, 5, dt);
    mouse.sy = damp(mouse.sy, mouse.y, 5, dt);

    // appear spring (pop-in with overshoot)
    appear.v += ((appear.on ? 1 : 0) - appear.x) * 140 * dt - appear.v * 9 * dt;
    appear.x += appear.v * dt;

    rig.root.position.set(cur.x * visW, cur.y * visH, 0);
    rig.root.scale.setScalar(Math.max(0.001, cur.s * appear.x));
    // the key light (and its shadow frustum) follows Pochacco around the page
    const ss = Math.max(cur.s, 0.3);
    sun.target.position.copy(rig.root.position);
    sun.position.copy(rig.root.position).addScaledVector(SUN_OFFSET, ss);
    const sc = sun.shadow.camera;
    if (Math.abs(sc.right - 2.6 * ss) > 0.01) {
      Object.assign(sc, { left: -2.6 * ss, right: 2.6 * ss, top: 4 * ss, bottom: -1.5 * ss, near: 0.1, far: 30 * ss });
      sc.updateProjectionMatrix();
    }

    // drag-spin with inertia, springs back to the nearest full turn
    spin.v *= Math.exp(-3 * dt);
    if (!spin.drag) spin.v += (Math.round(spin.a / TAU) * TAU - spin.a) * 10 * dt;
    spin.a += spin.v * dt * 0.05;
    if (fev) spin.a += dt * 5 * Math.sin(time * 1.3) ** 2;
    let lookY = mode === 'run' ? 0 : mouse.sx * 0.25;
    if (mode === 'anatomy') lookY = (explode.p - 0.5) * 1.6 + Math.sin(time * 0.6) * 0.12;
    rig.root.rotation.y = cur.ry + spin.a + lookY;
    rig.root.rotation.x = mode === 'run' ? 0 : -mouse.sy * 0.06;

    // ── jumping ──
    if (J.pending > 0) {
      J.pending -= dt;
      if (J.pending <= 0) {
        J.air = true;
        J.vy = 7.2 * J.power;
        J.t = 0;
        J.dur = (2 * J.vy) / G;
        J.from = rig.hop.rotation.y;
        J.to = J.spin ? J.from + TAU : J.from;
        sq.v += 7;
        hooks.sfx?.boing();
      }
    }
    if (J.air) {
      J.t += dt;
      J.vy -= G * dt;
      J.y += J.vy * dt;
      rig.hop.rotation.y = lerp(J.from, J.to, easeInOut(Math.min(1, J.t / J.dur)));
      if (J.y <= 0) {
        J.y = 0;
        J.air = false;
        rig.hop.rotation.y = J.to % TAU;
        sq.v -= 8 * Math.min(1.3, J.power);
        rig.root.getWorldPosition(tmp);
        sparkles.emit(tmp, { n: 16, speed: 2.2, spread: 0.3 * cur.s, up: 0.4, gravity: 3, colors: SC.gold, life: 0.7, size: 0.3 });
        for (let i = 0; i < 5; i++) puff(tmp.clone().add(tmp2.set(rand(-0.4, 0.4) * cur.s, 0.05, rand(-0.2, 0.3))), rand(-1, 1));
      }
    }
    rig.hop.position.y = J.y;

    // ── mode-driven pose targets ──
    const P = {
      legL: 0, legR: 0, armLx: 0, armLz: -0.5, armRx: 0, armRz: 0.5,
      headX: 0, headY: 0, headZ: 0, bob: 0, lean: 0, tail: Math.sin(time * 9) * 0.5, sq: 1,
    };
    const look = () => {
      P.headY = clamp(mouse.sx * 0.55 - (cur.ry + spin.a) * 0.5, -0.8, 0.8);
      P.headX = clamp(-mouse.sy * 0.25, -0.3, 0.3);
    };
    let happy = happyFlash > 0;
    let wantBall = 0;
    let eTarget = 0;

    if (fev) {
      // dance: alternating arm pumps on the beat, head bops, hips wiggle
      const b = Math.sin(time * TAU * (130 / 60) / 2);
      happy = true;
      P.armLz = -1.2 - b * 1.2;
      P.armRz = 1.2 - b * 1.2;
      P.armLx = Math.sin(time * 6) * 0.4;
      P.headZ = b * 0.25;
      P.headX = Math.abs(b) * -0.15;
      P.bob = Math.abs(b) * 0.12;
      P.legL = b * 0.4;
      P.legR = -b * 0.4;
      P.tail = Math.sin(time * 25);
      P.sq = 1 + Math.abs(b) * 0.06;
    } else if (mode === 'idle') {
      look();
      P.headZ = Math.sin(time * 1.3) * 0.07;
      P.armLx = Math.sin(time * 2) * 0.12;
      P.armRx = -Math.sin(time * 2) * 0.12;
      P.sq = 1 + Math.sin(time * 2.6) * 0.022;
    } else if (mode === 'anatomy') {
      // stand still and let the parts fly
      const p = explode.p;
      eTarget = smooth(0.06, 0.3, p) * (1 - smooth(0.8, 0.95, p));
      P.armLz = -0.9;
      P.armRz = 0.9;
      P.headX = -0.05;
      P.sq = 1 + Math.sin(time * 2) * 0.01;
    } else if (mode === 'run') {
      const w = 13;
      const s = Math.sin(time * w);
      P.legL = s * 0.9;
      P.legR = -s * 0.9;
      P.armLx = -s * 0.9;
      P.armRx = s * 0.9;
      P.armLz = -0.3;
      P.armRz = 0.3;
      P.bob = Math.abs(Math.sin(time * w)) * 0.16;
      P.lean = 0.16;
      P.headY = -0.55;
      P.headX = -0.05 + Math.sin(time * w * 2) * 0.03;
      P.tail = Math.sin(time * 22) * 0.7;
      dustT -= dt;
      if (dustT <= 0 && !J.air) {
        dustT = 0.09;
        rig.root.getWorldPosition(tmp);
        tmp.x -= 0.35 * cur.s;
        tmp.y += 0.05;
        puff(tmp, -1.5);
        sparkles.emit(tmp, { n: 2, speed: 1.2, spread: 0.1, up: 0.6, gravity: 0.5, colors: SC.cool, life: 0.8, size: 0.3 });
      }
    } else if (mode === 'dribble') {
      wantBall = 1;
      const hp = hoops.pose;
      if (hp === 'dribble') {
        look();
        const u = hoops.dribbleU;
        P.armRx = -(0.85 + 0.5 * u);
        P.armRz = 0.22;
        P.armLx = -0.2;
        P.sq = 1 - 0.035 * (1 - u);
        P.headX = 0.18 + 0.08 * (1 - u);
        P.legL = 0.1;
        P.legR = -0.1;
      } else if (hp === 'aim' || hp === 'shoot') {
        P.armLx = -2.85;
        P.armRx = -2.85;
        P.armLz = -0.3;
        P.armRz = 0.3;
        P.headX = -0.28;
        P.headY = 0.35;
        P.sq = hp === 'aim' ? 0.93 : 1.05;
        P.legL = hp === 'aim' ? 0.25 : -0.2;
        P.legR = hp === 'aim' ? -0.25 : 0.2;
      } else if (hp === 'cheer') {
        happy = true;
        P.armLz = -2.6;
        P.armRz = 2.6;
        P.headZ = Math.sin(time * 12) * 0.15;
        P.tail = Math.sin(time * 25);
      } else if (hp === 'sad') {
        P.headX = 0.4;
        P.headZ = 0.12;
        P.armLz = -0.25;
        P.armRz = 0.25;
        P.sq = 0.95;
        P.tail = 0;
      }
    } else if (mode === 'happy') {
      happy = true;
      look();
      P.headZ = Math.sin(time * 3.2) * 0.2;
      P.bob = Math.abs(Math.sin(time * 3.2)) * 0.1;
      P.armLz = -2.3 - Math.sin(time * 7) * 0.35;
      P.armRz = 0.9 + Math.sin(time * 3.2) * 0.2;
      P.legL = Math.sin(time * 6.4) * 0.2;
      P.legR = -P.legL;
      P.tail = Math.sin(time * 16) * 0.8;
      rainT -= dt;
      if (rainT <= 0 && (weights.icecream || 0) > 0.6) {
        rainT = 0.45;
        spawnRain(1);
      }
    } else if (mode === 'party') {
      happy = true;
      look();
      P.armLz = -2.5 - Math.sin(time * 9) * 0.3;
      P.armRz = 2.5 + Math.sin(time * 9) * 0.3;
      P.headZ = Math.sin(time * 4) * 0.15;
      P.tail = Math.sin(time * 18) * 0.8;
      partyT -= dt;
      if (partyT <= 0 && !J.air && (weights.outro || 0) > 0.7) {
        partyT = rand(1.1, 1.8);
        jump({ spin: Math.random() < 0.5, power: rand(0.7, 1) });
      }
    }
    if (J.air && mode !== 'dribble' && !fev) {
      P.armLz = Math.min(P.armLz, -2.2);
      P.armRz = Math.max(P.armRz, 2.2);
      P.legL = -0.4;
      P.legR = 0.4;
    }

    const PL = 14;
    for (const k of Object.keys(pose)) pose[k] = damp(pose[k], P[k], PL, dt);

    rig.legs[0].rotation.x = pose.legL;
    rig.legs[1].rotation.x = pose.legR;
    rig.arms[0].pivot.rotation.set(pose.armLx, 0, pose.armLz);
    rig.arms[1].pivot.rotation.set(pose.armRx, 0, pose.armRz);
    rig.neck.rotation.set(pose.headX, pose.headY, pose.headZ);
    rig.squash.position.y = pose.bob;
    rig.squash.rotation.x = pose.lean;
    rig.tail.rotation.z = pose.tail;

    // ── exploded view ──
    explode.v += ((eTarget - explode.x) * 90 - explode.v * 9) * dt;
    explode.x += explode.v * dt;
    const ex = Math.max(0, explode.x);
    for (const key in rig.parts) {
      const pt = rig.parts[key];
      pt.obj.position.copy(pt.base).addScaledVector(pt.dir, explode.x);
    }
    blueprint.scale.setScalar(Math.max(0.001, Math.min(1.2, ex * 1.1)));
    orbitA.rotation.y = time * 0.4;
    orbitB.rotation.y = -time * 0.6;
    dashMat.opacity = Math.min(1, ex) * 0.8;

    // squash & stretch spring
    sq.v += ((P.sq - sq.x) * 280 - sq.v * 13) * dt;
    sq.x = clamp(sq.x + sq.v * dt, 0.62, 1.45);
    const inv = 1 / Math.sqrt(sq.x);
    rig.squash.scale.set(inv, sq.x, inv);

    // shadow shrinks as he leaves the ground
    const hs = 1 / (1 + J.y * 0.5);
    shadow.scale.set(hs, hs, hs);
    shadow.material.opacity = 0.22 * hs;

    // ── ear physics (driven by head acceleration) ──
    headWorld(tmp);
    const invDt = 1 / Math.max(dt, 1e-4);
    tmp2.copy(tmp).sub(headPrev).multiplyScalar(invDt);
    const raw = tmp2.clone().sub(headVel).multiplyScalar(invDt);
    raw.clampLength(0, 80);
    headAcc.lerp(raw, 0.35);
    headVel.copy(tmp2);
    headPrev.copy(tmp);
    const spinSpeed = Math.abs(spin.v * 0.05) + (J.air && J.spin ? 8 : 0);
    const droop = mode === 'dribble' && hoops.pose === 'sad' ? -0.5 : 0;
    for (const ear of rig.ears) {
      const f = -headAcc.y * 0.05 - ear.s * headAcc.x * 0.035 + spinSpeed * 0.08 + droop * 60 * (ear.s > 0 ? 1 : 0);
      ear.vel += (f - 90 * ear.angle - 7 * ear.vel) * dt;
      ear.angle = clamp(ear.angle + ear.vel * dt, -0.7, 1.2);
      ear.pivot.rotation.z = ear.base + ear.angle * (ear.s < 0 ? 0.7 : 1) + Math.sin(time * 3 + ear.s) * 0.03;
    }
    rig.tufts.rotation.z = Math.sin(time * 5) * 0.06 + clamp(-headAcc.x * 0.004, -0.3, 0.3);

    // ── eyes: blink / happy ──
    happyFlash = Math.max(0, happyFlash - dt);
    blinkT -= dt;
    if (blinkT <= 0) {
      blinking = 0.14;
      blinkT = rand(2, 5);
    }
    blinking = Math.max(0, blinking - dt);
    const eyeY = blinking > 0 ? 0.1 : 1;
    for (const e of rig.eyesOpen) {
      e.visible = !happy;
      e.scale.y = damp(e.scale.y, eyeY, 40, dt);
    }
    for (const e of rig.eyesHappy) e.visible = happy;
    barkT = Math.max(0, barkT - dt);
    const mo = barkT > 0.3 ? 1 : 0.001;
    rig.mouthOpen.scale.setScalar(damp(rig.mouthOpen.scale.x, mo, 25, dt));

    // ── hoop + ball ──
    ballVis = damp(ballVis, wantBall, 8, dt);
    const hw = weights.sports || 0;
    hoopVis.v += ((hw > 0.5 ? 1 : 0) - hoopVis.x) * 120 * dt - hoopVis.v * 10 * dt;
    hoopVis.x += hoopVis.v * dt;
    hoop.group.position.set((mobile ? 0.25 : 0.3) * visW + hoops.hoopDX, (mobile ? 0.0 : 0.04) * visH - (1 - hw) * 2, -0.6);
    hoop.group.scale.setScalar(Math.max(0.001, hoopVis.x * (mobile ? 0.62 : 1)));
    hoop.group.rotation.y = -1.12;
    netSpring.v += (1 - netSpring.x) * 220 * dt - netSpring.v * 8 * dt;
    netSpring.x += netSpring.v * dt;
    hoop.net.scale.set(2 - netSpring.x, netSpring.x, 2 - netSpring.x);
    hoops.update(dt, time);

    // ── big ice cream cone ──
    const iw = weights.icecream || 0;
    coneVis.v += ((iw > 0.5 ? 1 : 0) - coneVis.x) * 120 * dt - coneVis.v * 9 * dt;
    coneVis.x += coneVis.v * dt;
    bigCone.position.set(
      rig.root.position.x + (mobile ? -0.95 : -1.55) * cur.s,
      rig.root.position.y + 1.3 * cur.s + Math.sin(time * 2) * 0.12,
      0.3
    );
    bigCone.scale.setScalar(Math.max(0.001, coneVis.x * cur.s * 0.95));
    bigCone.rotation.set(Math.sin(time * 1.3) * 0.12, time * 0.9, Math.sin(time * 1.7) * 0.2);

    // ── fever: disco lights, beat pulses, glitter storm ──
    if (fev) {
      hemi.color.setHSL((time * 0.35) % 1, 0.9, 0.7);
      hemi.groundColor.setHSL((time * 0.35 + 0.5) % 1, 0.9, 0.55);
      beatT -= dt;
      if (beatT <= 0) {
        beatT = 60 / 130;
        beatN++;
        hooks.onBeat?.(beatN);
        hooks.sfx?.kick();
        const h = headWorld(tmp);
        shock(h, [0xffd23f, 0xff8fb1, 0x6cc6ff, 0xc4303d][beatN % 4], 2.8);
        if (beatN % 2 === 0) jump({ spin: beatN % 4 === 0, power: 0.7 });
        burst(tmp2.set(0, visH * 0.6, 0), 24, 1, true);
      }
      for (let i = 0; i < 4; i++) {
        tmp.set(rand(-0.5, 0.5) * visW, rand(-0.5, 0.5) * visH, rand(-2, 1));
        sparkles.emit(tmp, { n: 1, speed: 0.6, spread: 0.1, up: 0.3, gravity: 0, life: 0.8, size: 0.6, colors: SC.party });
      }
    }

    // ── floaters: scroll parallax + mouse parallax + bob ──
    const pxToWorld = visH / H;
    for (const f of floaters) {
      const depth = (CAM_Z - f.z) / CAM_Z;
      const range = visH * depth * 1.6;
      let y = f.y0 * range * 0.5 + scrollPx * pxToWorld * f.speed * 0.55;
      y = (((y + range / 2) % range) + range) % range - range / 2;
      const w = visW * depth;
      const boost = fev ? 4 : 1;
      f.obj.position.set(
        f.xf * w * (mobile ? 1.1 : 1) + mouse.sx * (f.z + 7) * 0.05,
        y + Math.sin(time * 0.9 * boost + f.phase) * 0.15 * boost + mouse.sy * (f.z + 7) * 0.03,
        f.z
      );
      f.obj.rotation.x += f.spin.x * dt * boost;
      f.obj.rotation.y += f.spin.y * dt * boost;
      f.obj.rotation.z += f.spin.z * dt * boost;
      if (f.pop !== undefined) {
        f.pop -= dt;
        const target = f.pop < 0 ? f.scale * (mobile ? 0.7 : 1) : 0.001;
        f.obj.scale.setScalar(damp(f.obj.scale.x, target, 6, dt));
      }
    }

    // ── rain ──
    for (const r of rain) {
      if (!r.alive) continue;
      r.vy += 2.5 * dt;
      r.obj.position.y -= r.vy * dt;
      r.obj.rotation.x += r.spin.x * dt;
      r.obj.rotation.y += r.spin.y * dt;
      r.obj.rotation.z += r.spin.z * dt;
      if (r.obj.position.y < -visH) {
        r.alive = false;
        r.obj.visible = false;
      }
    }

    // ── confetti ──
    for (let i = 0; i < CN; i++) {
      const c = cParts[i];
      if (c.life > 0) {
        c.life -= dt;
        c.v.y -= 9 * dt;
        c.v.multiplyScalar(Math.exp(-1.8 * dt));
        c.sway += dt * 6;
        c.p.addScaledVector(c.v, dt);
        c.p.x += Math.sin(c.sway) * dt * 0.6;
        c.r.x += c.rv.x * dt;
        c.r.y += c.rv.y * dt;
        c.r.z += c.rv.z * dt;
        const k = Math.min(1, c.life * 2);
        dummy.position.copy(c.p);
        dummy.rotation.copy(c.r);
        dummy.scale.set(c.w * k, c.h * k, 1);
      } else {
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;

    // ── rings & dust ──
    for (const m of rings) {
      const d = m.userData;
      if (d.t >= 1) {
        m.material.opacity = 0;
        continue;
      }
      d.t = Math.min(1, d.t + dt * 1.8);
      const e = 1 - Math.pow(1 - d.t, 3);
      m.scale.setScalar(0.1 + e * d.size);
      m.material.opacity = (1 - d.t) * 0.9;
      m.lookAt(camera.position);
    }
    for (const m of dust) {
      const d = m.userData;
      if (!m.visible) continue;
      d.t += dt * 1.6;
      m.position.addScaledVector(d.v, dt);
      m.scale.setScalar((0.4 + d.t * 1.4) * cur.s);
      m.material.opacity = Math.max(0, 0.9 - d.t);
      if (d.t >= 1) m.visible = false;
    }

    // ── sparkles: aura while happy, cursor trail ──
    auraT -= dt;
    if (auraT <= 0 && appear.on) {
      auraT = 0.07;
      if (happy || J.air) {
        headWorld(tmp).add(tmp2.set(rand(-1, 1) * cur.s, rand(-0.6, 0.9) * cur.s, rand(-0.3, 0.5)));
        sparkles.emit(tmp, { n: 1, speed: 0.4, spread: 0.05, up: 0.4, gravity: -0.2, life: 1, size: 0.4, colors: mode === 'happy' ? SC.pink : SC.gold });
      }
      if (coneVis.x > 0.5) {
        bigCone.getWorldPosition(tmp).add(tmp2.set(rand(-0.6, 0.6), rand(-0.6, 1.2), rand(0, 0.6)).multiplyScalar(cur.s));
        sparkles.emit(tmp, { n: 1, speed: 0.3, spread: 0.05, up: 0.3, gravity: -0.1, life: 1.2, size: 0.45, colors: SC.gold });
      }
      if (ex > 0.3) {
        // blueprint glints drifting off the separated parts
        const keys = Object.keys(rig.parts);
        rig.parts[keys[(Math.random() * keys.length) | 0]].obj.getWorldPosition(tmp);
        sparkles.emit(tmp, { n: 1, speed: 0.3, spread: 0.2, up: 0.2, gravity: -0.1, life: 1, size: 0.35, colors: SC.cool });
      }
    }
    if (mouse.px >= 0 && !reduced) {
      const md = Math.hypot(mouse.px - mouse.lx, mouse.py - mouse.ly);
      mouse.trail += md;
      mouse.lx = mouse.px;
      mouse.ly = mouse.py;
      if (mouse.trail > 26) {
        mouse.trail = 0;
        ndc.set((mouse.px / W) * 2 - 1, -(mouse.py / H) * 2 + 1);
        tmp.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
        tmp.multiplyScalar(4 / -tmp.z).add(camera.position); // point on plane z = 6
        sparkles.emit(tmp, { n: 1, speed: 0.25, spread: 0.02, up: -0.2, gravity: 0.6, life: 0.7, size: 0.14 });
      }
    }
    sparkles.update(dt, time, scrollPx * (visH / H) * 0.35);

    // ── hover detection for the cursor ──
    if (mouse.moved) {
      mouse.moved = false;
      const h = hitTest(mouse.px, mouse.py);
      if (h !== hovering) {
        hovering = h;
        hooks.onHover?.(h);
      }
    }

    renderer.render(scene, camera);
  }

  // Screen positions of blueprint callout anchors.
  const ANCHORS = {
    earL: () => rig.ears[0].pivot.localToWorld(tmp.set(0, 0.62, 0)),
    earR: () => rig.ears[1].pivot.localToWorld(tmp.set(0, 0.62, 0)),
    tufts: () => rig.tufts.localToWorld(tmp.set(-0.1, 0.05, 0)),
    eye: () => rig.eyesOpen[1].getWorldPosition(tmp),
    nose: () => rig.nose.getWorldPosition(tmp),
    shirt: () => rig.parts.shirt.obj.localToWorld(tmp.set(0.3, 0.75, 0.42)),
    tail: () => rig.tail.localToWorld(tmp.set(0, 0.22, 0)),
    leg: () => rig.legs[0].localToWorld(tmp.set(0, -0.2, 0.1)),
  };

  return {
    update, intro, jump, treat, party, poke, fever, hoops,
    get weights() { return weights; },
    get explode() { return Math.max(0, explode.x); },
    get fevering() { return feverT > 0; },
    anchors() {
      const out = {};
      for (const k in ANCHORS) out[k] = toScreen(ANCHORS[k]());
      return out;
    },
    headScreen() { return toScreen(headWorld(tmp).add(tmp2.set(0, 0.9 * cur.s, 0))); },
  };
}
