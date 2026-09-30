import * as THREE from 'three';
import { toonGradient, makeMaterials, createPochacco } from './pochacco.js';
import { createSparkles } from './sparkles.js';
import { makeBasketball, makeBanana, makeStar, makeBone, makeHeart, makeIceCream, makeHoop, blobTexture } from './props.js';

const TAU = Math.PI * 2;
const G = 24;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

// Where Pochacco stands and what he's doing in each section.
// x/y are fractions of the visible frustum at z=0, so the layout survives any aspect ratio.
const DESKTOP = {
  hero:        { x: 0.0,   y: -0.13, s: 1.2,  ry: 0.0,  mode: 'idle' },
  profile:     { x: -0.25, y: -0.12, s: 1.05, ry: 0.4,  mode: 'idle' },
  personality: { x: -0.05, y: -0.27, s: 0.72, ry: Math.PI / 2, mode: 'run' },
  sports:      { x: -0.02, y: -0.3,  s: 0.82, ry: 0.55, mode: 'dribble' },
  icecream:    { x: 0.24,  y: -0.14, s: 1.0,  ry: -0.45, mode: 'happy' },
  outro:       { x: 0.31,  y: -0.24, s: 0.85, ry: -0.3, mode: 'party' },
};
const MOBILE = {
  hero:        { x: 0.0,  y: -0.1,  s: 0.78, ry: 0.0,  mode: 'idle' },
  profile:     { x: 0.22, y: -0.33, s: 0.5,  ry: -0.3, mode: 'idle' },
  personality: { x: 0.0,  y: -0.3,  s: 0.55, ry: Math.PI / 2, mode: 'run' },
  sports:      { x: -0.22, y: -0.1, s: 0.4,  ry: 0.5,  mode: 'dribble' },
  icecream:    { x: 0.18, y: -0.3,  s: 0.6,  ry: -0.4, mode: 'happy' },
  outro:       { x: 0.0,  y: -0.24, s: 0.62, ry: 0.0,  mode: 'party' },
};

const PHRASES = ['왈!', '놀자!', '멍멍!', '공 던져줘!', '바나나 아이스크림!', '킁킁…?', '한 번 더!', '헤헤', '같이 뛰자!'];
const CONFETTI_COLORS = [0xe23b2e, 0xffd23f, 0x6cc6ff, 0xffffff, 0x1c1a1f, 0xff8fb1, 0x7fe0c2];

export function createStage(canvas, hooks = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const CAM_Z = 10;
  camera.position.set(0, 0, CAM_Z);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb2ff, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(3, 6, 8);
  scene.add(sun);
  const back = new THREE.DirectionalLight(0xfff0c0, 1.2);
  back.position.set(-6, 3, -4);
  scene.add(back);

  const mats = makeMaterials(toonGradient());
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

  // dribble ball lives in Pochacco's hop space until it's shot
  const ball = makeBasketball(mats, 0.2);
  ball.scale.setScalar(0.001);
  rig.hop.add(ball);

  const hoop = makeHoop(mats);
  hoop.group.scale.setScalar(0.001);
  scene.add(hoop.group);

  const bigCone = makeIceCream(mats, { scoops: 2 });
  bigCone.scale.setScalar(0.001);
  scene.add(bigCone);

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
  const CN = 420;
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

  function burst(at, n = 80, power = 1) {
    for (let i = 0; i < n; i++) {
      const c = cParts[cHead];
      cHead = (cHead + 1) % CN;
      c.p.copy(at);
      const a = rand(0, TAU), up = rand(0.4, 1);
      const sp = rand(3, 8) * power;
      c.v.set(Math.cos(a) * sp * (1 - up * 0.5), up * sp * 1.1, Math.sin(a) * sp * 0.6);
      c.r.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      c.rv.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
      c.life = rand(1.6, 2.6);
      c.w = rand(0.05, 0.1);
      c.h = rand(0.09, 0.16);
      c.sway = rand(0, TAU);
    }
  }

  // shockwave rings
  const rings = Array.from({ length: 5 }, () => {
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
  const shot = { active: false, phase: '', t: 0, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), h: 1, vel: new THREE.Vector3(), made: false };
  const netSpring = { x: 1, v: 0 };
  const headPrev = new THREE.Vector3(), headVel = new THREE.Vector3(), headAcc = new THREE.Vector3();
  let auraT = 0;
  let blinkT = 2, blinking = 0, barkT = 0, happyFlash = 0, partyT = 0.6, rainT = 0, dustT = 0;
  let mode = 'idle';
  let weights = {};
  let scrollPx = 0, time = 0;
  let hovering = false;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

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
    if (e.target.closest('a, button, input, .no-stage')) return;
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

  function headWorld(out = new THREE.Vector3()) {
    return rig.head.getWorldPosition(out);
  }
  function toScreen(v) {
    tmp2.copy(v).project(camera);
    return { x: (tmp2.x * 0.5 + 0.5) * W, y: (-tmp2.y * 0.5 + 0.5) * H };
  }

  function bark(text) {
    barkT = 1.1;
    const phrase = text || PHRASES[(Math.random() * PHRASES.length) | 0];
    hooks.onBark?.(phrase);
    hooks.sfx?.bark();
  }

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

  function jump({ spin: doSpin = false, power = 1 } = {}) {
    if (J.air || J.pending > 0 || !appear.on) return false;
    J.pending = 0.09;
    J.power = power;
    J.spin = doSpin;
    sq.v -= 5;
    return true;
  }

  // ── public: shoot the ball at the hoop ───────────────────────
  function shoot(made) {
    if (shot.active || ballVis < 0.6 || hoopVis.x < 0.6) return false;
    shot.active = true;
    shot.phase = 'flight';
    shot.t = 0;
    shot.made = made;
    ball.getWorldPosition(shot.from);
    scene.attach(ball);
    hoop.rim.getWorldPosition(shot.to);
    if (made) shot.to.y += 0.06;
    else shot.to.add(tmp.set(Math.random() < 0.5 ? -0.33 : 0.3, 0.12, 0.18));
    const dist = shot.from.distanceTo(shot.to);
    shot.h = 1.4 + dist * 0.18;
    shot.dur = 0.8 + dist * 0.05;
    jump({ power: 0.55 });
    hooks.sfx?.pop();
    return true;
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
    sparkles.emit(h, { n: 180, speed: 7, spread: 0.3, up: 0.2, gravity: 2, colors: SC.party, life: 1.8, size: 0.55 });
    shock(h.clone().add(tmp.set(0, 0.3, 0)), 0xe23b2e, 2.2);
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

  // ── choreography blend ──────────────────────────────────────
  let ballVis = 0;
  function update(dt, choreo) {
    dt = Math.min(dt, 1 / 30);
    time += dt;
    scrollPx = choreo.scroll;
    const table = mobile ? MOBILE : DESKTOP;
    const A = table[choreo.a], B = table[choreo.b];
    const t = choreo.t;
    mode = t < 0.5 ? A.mode : B.mode;
    weights = { [choreo.a]: 1 - t };
    weights[choreo.b] = (weights[choreo.b] || 0) + t;

    const L = reduced ? 20 : 4.5;
    cur.x = damp(cur.x, lerp(A.x, B.x, t), L, dt);
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

    // drag-spin with inertia, springs back to the nearest full turn
    spin.v *= Math.exp(-3 * dt);
    if (!spin.drag) spin.v += (Math.round(spin.a / TAU) * TAU - spin.a) * 10 * dt;
    spin.a += spin.v * dt * 0.05;
    const lookY = mode === 'run' ? 0 : mouse.sx * 0.25;
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

    if (mode === 'idle') {
      look();
      P.headZ = Math.sin(time * 1.3) * 0.07;
      P.armLx = Math.sin(time * 2) * 0.12;
      P.armRx = -Math.sin(time * 2) * 0.12;
      P.sq = 1 + Math.sin(time * 2.6) * 0.022;
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
      look();
      const T = 0.56;
      const p = (time % T) / T;
      const u = Math.abs(2 * p - 1);
      if (!shot.active) {
        ball.position.set(0.6, 0.2 + 0.64 * (1 - (1 - u) * (1 - u)), 0.42);
        ball.rotation.x += dt * 4;
      }
      P.armRx = shot.active ? -2.7 : -(0.85 + 0.5 * u);
      P.armRz = shot.active ? 0.2 : 0.22;
      P.armLx = shot.active ? -2.7 : -0.2;
      P.armLz = shot.active ? -0.2 : -0.5;
      P.sq = 1 - 0.035 * (1 - u);
      P.headX = shot.active ? -0.3 : 0.18 + 0.08 * (1 - u);
      P.legL = 0.1;
      P.legR = -0.1;
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
    if (J.air && mode !== 'dribble') {
      // arms up while airborne — pure joy
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

    // squash & stretch spring
    sq.v += ((P.sq - sq.x) * 280 - sq.v * 13) * dt;
    sq.x = clamp(sq.x + sq.v * dt, 0.62, 1.45);
    const inv = 1 / Math.sqrt(sq.x);
    rig.squash.scale.set(inv, sq.x, inv);

    // shadow shrinks as he leaves the ground
    const hs = 1 / (1 + J.y * 0.5);
    shadow.scale.set(hs, hs, hs);
    shadow.material.opacity = 0.22 * hs;
    shadow.position.y = -J.y * 0 + 0.005;
    shadow.position.x = 0;

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
    for (const ear of rig.ears) {
      const f = -headAcc.y * 0.05 - ear.s * headAcc.x * 0.035 + spinSpeed * 0.08;
      ear.vel += (f - 90 * ear.angle - 7 * ear.vel) * dt;
      ear.angle = clamp(ear.angle + ear.vel * dt, -0.7, 1.2);
      // positive angle = ear lifts (flopped ear rises, perked ear tips outward)
      ear.pivot.rotation.z = ear.base + ear.angle * (ear.s < 0 ? 0.7 : 1) + Math.sin(time * 3 + ear.s) * 0.03;
    }

    // tufts wobble
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

    // ── ball visibility ──
    ballVis = damp(ballVis, wantBall, 8, dt);
    if (!shot.active) ball.scale.setScalar(Math.max(0.001, ballVis));

    // ── hoop placement ──
    const hw = weights.sports || 0;
    hoopVis.v += ((hw > 0.5 ? 1 : 0) - hoopVis.x) * 120 * dt - hoopVis.v * 10 * dt;
    hoopVis.x += hoopVis.v * dt;
    hoop.group.position.set((mobile ? 0.22 : 0.29) * visW, (mobile ? 0.0 : 0.06) * visH - (1 - hw) * 2, -0.6);
    hoop.group.scale.setScalar(Math.max(0.001, hoopVis.x * (mobile ? 0.55 : 1)));
    hoop.group.rotation.y = -0.35 + Math.sin(time * 0.8) * 0.04;
    netSpring.v += (1 - netSpring.x) * 220 * dt - netSpring.v * 8 * dt;
    netSpring.x += netSpring.v * dt;
    hoop.net.scale.set(2 - netSpring.x, netSpring.x, 2 - netSpring.x);

    // ── shot flight ──
    if (shot.active) {
      shot.t += dt;
      if (shot.phase === 'flight') {
        hoop.rim.getWorldPosition(tmp);
        if (shot.made) shot.to.copy(tmp).add(tmp2.set(0, 0.06, 0));
        const u = Math.min(1, shot.t / shot.dur);
        ball.position.lerpVectors(shot.from, shot.to, u);
        ball.position.y += shot.h * 4 * u * (1 - u);
        ball.rotation.x -= 12 * dt;
        if (u >= 1) {
          shot.phase = 'after';
          shot.t = 0;
          if (shot.made) {
            shot.vel.set(0, -1.2, 0);
            netSpring.v -= 9;
            burst(tmp, 110, 1.1);
            shock(tmp, 0xffd23f, 1.8);
            sparkles.emit(tmp, { n: 140, speed: 5, spread: 0.3, up: 0.5, colors: SC.gold, life: 1.5, size: 0.5 });
            hooks.sfx?.swish();
            happyFlash = 1.4;
            bark(['슛~골인!', '나이스!', '스윗!'][(Math.random() * 3) | 0]);
          } else {
            shot.vel.set(rand(-1, 1) > 0 ? 2.2 : -2.2, 3.2, 1.8);
            netSpring.v -= 3;
            hooks.sfx?.clank();
            bark(['아깝다!', '한 번 더!', '으앙'][(Math.random() * 3) | 0]);
          }
          hooks.onShot?.(shot.made);
        }
      } else {
        shot.vel.y -= (shot.made ? 10 : 14) * dt;
        ball.position.addScaledVector(shot.vel, dt);
        ball.rotation.z -= 6 * dt;
        if (shot.t > 0.9) ball.scale.multiplyScalar(Math.pow(0.02, dt * 3));
        if (shot.t > 1.3) {
          shot.active = false;
          rig.hop.add(ball);
          ball.rotation.set(0, 0, 0);
          ballVis = 0;
          ball.scale.setScalar(0.001);
        }
      }
    }

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

    // ── floaters: scroll parallax + mouse parallax + bob ──
    const pxToWorld = visH / H;
    for (const f of floaters) {
      const depth = (CAM_Z - f.z) / CAM_Z;
      const range = visH * depth * 1.6;
      let y = f.y0 * range * 0.5 + scrollPx * pxToWorld * f.speed * 0.55;
      y = (((y + range / 2) % range) + range) % range - range / 2;
      const w = visW * depth;
      f.obj.position.set(
        f.xf * w * (mobile ? 1.1 : 1) + mouse.sx * (f.z + 7) * 0.05,
        y + Math.sin(time * 0.9 + f.phase) * 0.15 + mouse.sy * (f.z + 7) * 0.03,
        f.z
      );
      f.obj.rotation.x += f.spin.x * dt;
      f.obj.rotation.y += f.spin.y * dt;
      f.obj.rotation.z += f.spin.z * dt;
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

    // ── sparkles: aura while happy, ball comet tail, cursor trail ──
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
    }
    if (shot.active && shot.phase === 'flight') {
      sparkles.emit(ball.position, { n: 2, speed: 0.5, spread: 0.12, up: 0, gravity: 0.5, life: 0.6, size: 0.35, colors: SC.gold });
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
        tmp.multiplyScalar(4 / -tmp.z * 1).add(camera.position); // point on plane z = 6
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

  return {
    update, intro, jump, shoot, treat, party, poke,
    get weights() { return weights; },
    get busy() { return shot.active; },
    headScreen() { return toScreen(headWorld(tmp).add(tmp2.set(0, 0.9 * cur.s, 0))); },
  };
}
