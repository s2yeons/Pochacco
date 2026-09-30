import * as THREE from 'three';

// Slingshot basketball with real(ish) 2D physics in the camera plane:
// rim edges are colliders, the backboard is a wall (bank shots!), swishes score extra.
const G = 13;
const ROUND = 30;
const RANKS = [
  [0, '새싹 루키'],
  [8, '동네 슈터'],
  [16, '골목 에이스'],
  [26, '코트의 MVP'],
  [40, '포차코급 전설'],
];
const FIRE = [0xff4d1a, 0xffa31a, 0xffe066, 0xffffff].map((c) => new THREE.Color(c));
const GOLD = [0xffe066, 0xffd23f, 0xffffff].map((c) => new THREE.Color(c));

export function createHoops(ctx) {
  const { scene, ball, hoop, rig, sparkles, hooks } = ctx;
  scene.attach(ball);

  // trajectory preview dots
  const DOTS = 26;
  const dots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.9, depthWrite: false }),
    DOTS
  );
  dots.frustumCulled = false;
  dots.visible = false;
  scene.add(dots);
  const dummy = new THREE.Object3D();

  const ballMat = ball.material;
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();

  const S = {
    state: 'hand',       // hand | aim | flight | respawn
    t: 0,
    p: new THREE.Vector2(),
    v: new THREE.Vector2(),
    z: 0, z0: 0,
    aimFrom: new THREE.Vector2(),
    aimV: new THREE.Vector2(),
    rimHit: false, boardHit: false, scored: false, bounces: 0, clankT: 0,
    pose: 'dribble', poseT: 0,
    shiftX: 0, shiftTarget: 0,
    hoopDX: 0, hoopPhase: 0, hoopAmp: 0,
    rimWobble: 0, rimWobbleV: 0,
    fire: false,
  };
  const R = {
    playing: false, countdown: 0, time: ROUND, score: 0, streak: 0, makes: 0, shots: 0,
    best: +(safeGet('pochacco-best') || 0), lastCount: 0, warned: false, moving: false,
  };

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

  // ── geometry helpers (world space, read from the live hoop transform) ──
  function rimInfo() {
    const hs = hoop.group.scale.x;
    const c = hoop.rim.getWorldPosition(v3);
    const front = hoop.group.localToWorld(v3b.set(0, 0, 0.3)).x;
    const back = hoop.group.localToWorld(v3b.set(0, 0, -0.3)).x;
    const board = hoop.group.localToWorld(v3b.set(0, 0, -0.385)).x;
    const y0 = hoop.group.localToWorld(v3b.set(0, 0.5 - 0.56, -0.42)).y;
    const y1 = hoop.group.localToWorld(v3b.set(0, 0.5 + 0.56, -0.42)).y;
    return { cx: c.x, cy: c.y, cz: c.z, front: Math.min(front, back), back: Math.max(front, back), board, y0, y1, tube: 0.04 * hs, hs };
  }
  const ballR = () => 0.2 * ctx.view().s;

  function overhead(out) {
    return rig.hop.localToWorld(out.set(0.18, 2.9, 0.25));
  }

  // ── input ──
  function aimStart(x, y) {
    if (S.state !== 'hand' || !ctx.active() || (R.countdown > 0)) return false;
    S.state = 'aim';
    S.aimFrom.set(x, y);
    S.aimV.set(0, 0);
    S.pose = 'aim';
    hooks.sfx?.tick();
    return true;
  }
  function aimMove(x, y) {
    if (S.state !== 'aim') return;
    const k = 12 / 230;
    S.aimV.set(-(x - S.aimFrom.x) * k, (y - S.aimFrom.y) * k);
    if (S.aimV.length() > 12.5) S.aimV.setLength(12.5);
  }
  function aimEnd() {
    if (S.state !== 'aim') return;
    dots.visible = false;
    if (S.aimV.length() < 2) {
      S.state = 'hand';
      S.pose = 'dribble';
      return;
    }
    const o = overhead(v3);
    S.p.set(o.x, o.y);
    S.z = S.z0 = o.z;
    S.v.copy(S.aimV);
    S.state = 'flight';
    S.t = 0;
    S.rimHit = S.boardHit = S.scored = false;
    S.bounces = 0;
    S.pose = 'shoot';
    S.poseT = 0.45;
    if (R.playing) R.shots++;
    ctx.jump({ power: 0.5 });
    hooks.sfx?.pop();
  }

  // ── round control ──
  function start() {
    if (R.playing || R.countdown > 0) return;
    Object.assign(R, { countdown: 3.2, time: ROUND, score: 0, streak: 0, makes: 0, shots: 0, lastCount: 4, warned: false, moving: false });
    S.shiftTarget = 0;
    S.hoopAmp = 0;
    setFire(false);
    hooks.onRound?.({ phase: 'countdown', ...R });
  }
  function end() {
    R.playing = false;
    const newBest = R.score > R.best;
    if (newBest) { R.best = R.score; safeSet('pochacco-best', R.best); }
    let rank = RANKS[0][1];
    for (const [min, name] of RANKS) if (R.score >= min) rank = name;
    S.hoopAmp = 0;
    S.shiftTarget = 0;
    setFire(false);
    hooks.sfx?.buzzer();
    hooks.onRound?.({ phase: 'end', ...R, rank, newBest });
    if (newBest && R.score > 0) ctx.celebrate();
  }

  function setFire(on) {
    if (S.fire === on) return;
    S.fire = on;
    ballMat.emissive?.setHex(on ? 0xff3d00 : 0x000000);
    ballMat.emissiveIntensity = on ? 0.55 : 0;
    if (on) hooks.onBanner?.('ON FIRE!', 'fire');
  }

  function resolve(made, info) {
    const screen = ctx.toScreen(v3.set(info.cx, info.cy + 0.5, info.cz));
    if (made) {
      const swish = !S.rimHit && !S.boardHit;
      let pts = swish ? 3 : 2;
      let label = swish ? 'SWISH!' : S.boardHit ? 'BANK SHOT!' : 'NICE!';
      if (R.playing) {
        R.streak++;
        R.makes++;
        if (R.streak >= 3) setFire(true);
        if (S.fire) pts *= 2;
        R.score += pts;
        // Pochacco hops to a new spot for the next shot
        const vw = ctx.view().visW;
        const m = ctx.view().mobile;
        const lo = (m ? -0.36 : -0.38) * vw, hi = (m ? -0.14 : -0.04) * vw;
        S.shiftTarget = lo + Math.random() * (hi - lo) - ctx.baseX();
        ctx.jump({ spin: Math.random() < 0.4 });
      }
      hooks.onScore?.({ pts, label, swish, fire: S.fire, x: screen.x, y: screen.y, practice: !R.playing, ...R });
      hooks.sfx?.swish();
      ctx.cheer(label);
      const at = v3.set(info.cx, info.cy, info.cz);
      sparkles.emit(at, { n: S.fire ? 180 : 110, speed: 5, spread: 0.3, up: 0.5, colors: S.fire ? FIRE : GOLD, life: 1.4, size: 0.5 });
      ctx.burst(at, swish ? 130 : 80, 1.1);
      ctx.shock(at, S.fire ? 0xff6a00 : 0xffd23f, swish ? 2.4 : 1.6);
      hoop.net.userData.kick = true;
    } else {
      if (R.playing) {
        R.streak = 0;
        setFire(false);
      }
      hooks.onMiss?.({ x: screen.x, y: screen.y, ...R });
      ctx.sad();
    }
  }

  // ── simulation ──
  function step(h, info, floorY) {
    const br = ballR();
    S.v.y -= G * h;
    const py = S.p.y;
    S.p.addScaledVector(S.v, h);

    // rim edges (front & back) as round colliders
    for (const ex of [info.front, info.back]) {
      const dx = S.p.x - ex, dy = S.p.y - info.cy;
      const d = Math.hypot(dx, dy), min = br + info.tube;
      if (d < min && d > 1e-5) {
        const nx = dx / d, ny = dy / d;
        S.p.set(ex + nx * min, info.cy + ny * min);
        const vn = S.v.x * nx + S.v.y * ny;
        if (vn < 0) {
          S.v.x -= 1.55 * vn * nx;
          S.v.y -= 1.55 * vn * ny;
          S.v.multiplyScalar(0.88);
          S.rimHit = true;
          S.rimWobbleV += Math.min(6, -vn * 2);
          if (S.clankT <= 0) { hooks.sfx?.clank(); S.clankT = 0.12; }
        }
      }
    }
    // backboard: vertical segment
    {
      const cy = Math.min(info.y1, Math.max(info.y0, S.p.y));
      const dx = S.p.x - info.board, dy = S.p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < br) {
        let nx = -1, ny = 0;
        if (d > 1e-5) { nx = dx / d; ny = dy / d; }
        S.p.set(info.board + nx * br, cy + ny * br);
        const vn = S.v.x * nx + S.v.y * ny;
        if (vn < 0) {
          S.v.x -= 1.6 * vn * nx;
          S.v.y -= 1.6 * vn * ny;
          S.boardHit = true;
          if (S.clankT <= 0) { hooks.sfx?.thud(); S.clankT = 0.12; }
        }
      }
    }
    // through the hoop: crossing the rim plane downward between the edges
    if (!S.scored && py >= info.cy && S.p.y < info.cy && S.v.y < 0 && S.p.x > info.front + info.tube && S.p.x < info.back - info.tube) {
      S.scored = true;
      S.v.x *= 0.3;
      S.v.y = Math.min(S.v.y * 0.5, -1.2);
      resolve(true, info);
    }
    // floor
    if (S.p.y - br < floorY) {
      S.p.y = floorY + br;
      if (S.v.y < 0) {
        S.v.y = -S.v.y * 0.55;
        S.v.x *= 0.8;
        S.bounces++;
        if (S.v.y > 1) hooks.sfx?.bounce();
      }
    }
  }

  function update(dt, time) {
    const active = ctx.active();
    const view = ctx.view();
    S.clankT -= dt;

    // countdown / timer
    if (R.countdown > 0) {
      R.countdown -= dt;
      const n = Math.ceil(R.countdown - 0.2);
      if (n !== R.lastCount && n >= 0) {
        R.lastCount = n;
        hooks.onRound?.({ phase: 'count', n, ...R });
        n > 0 ? hooks.sfx?.tick() : hooks.sfx?.go();
      }
      if (R.countdown <= 0) {
        R.playing = true;
        hooks.onRound?.({ phase: 'play', ...R });
      }
    }
    if (R.playing) {
      if (!active) { R.time = 0; }
      R.time -= dt;
      if (!R.moving && R.time < ROUND - 10) {
        R.moving = true;
        hooks.onBanner?.('MOVING HOOP!', 'move');
      }
      if (!R.warned && R.time < 10) {
        R.warned = true;
        hooks.onBanner?.('LAST 10 SEC!', 'warn');
      }
      S.hoopAmp = R.moving ? (R.time < 10 ? 1 : 0.6) : 0;
      hooks.onTick?.(R);
      if (R.time <= 0) { R.time = 0; end(); }
    }

    // moving hoop
    const ampTarget = S.hoopAmp * (view.mobile ? 0.12 : 0.1) * view.visW;
    S.hoopPhase += dt * (R.time < 10 && R.playing ? 2.2 : 1.3);
    S._amp = (S._amp || 0) + (ampTarget - (S._amp || 0)) * (1 - Math.exp(-2 * dt));
    S.hoopDX = Math.sin(S.hoopPhase) * S._amp;

    S.shiftX += (S.shiftTarget - S.shiftX) * (1 - Math.exp(-5 * dt));

    // rim wobble
    S.rimWobbleV += (-S.rimWobble * 260 - S.rimWobbleV * 10) * dt;
    S.rimWobble += S.rimWobbleV * dt;
    hoop.rim.rotation.y = S.rimWobble * 0.05;
    hoop.rim.position.y = -Math.abs(S.rimWobble) * 0.015;

    S.poseT -= dt;
    if (S.poseT <= 0 && (S.pose === 'shoot' || S.pose === 'cheer' || S.pose === 'sad')) S.pose = S.state === 'aim' ? 'aim' : 'dribble';

    const s = view.s;
    const vis = ctx.ballVis();

    if (!active && S.state !== 'hand') {
      S.state = 'hand';
      dots.visible = false;
    }

    if (S.state === 'hand' || S.state === 'respawn') {
      if (S.state === 'respawn') {
        S.t -= dt;
        if (S.t <= 0) S.state = 'hand';
      }
      const T = 0.56;
      const p = (time % T) / T;
      const u = Math.abs(2 * p - 1);
      S.dribbleU = u;
      rig.hop.localToWorld(v3.set(0.6, 0.2 + 0.64 * (1 - (1 - u) * (1 - u)), 0.42));
      ball.position.copy(v3);
      ball.rotation.x += dt * 4;
      const grow = S.state === 'respawn' ? 0.001 : 1;
      ball.scale.setScalar(Math.max(0.001, vis * s * grow));
    } else if (S.state === 'aim') {
      const info = rimInfo();
      overhead(v3);
      ball.position.lerp(v3, 1 - Math.exp(-18 * dt));
      ball.scale.setScalar(Math.max(0.001, vis * s));
      ball.rotation.z += dt * 2;
      // trajectory preview
      const show = S.aimV.length() >= 2;
      dots.visible = show;
      if (show) {
        for (let i = 0; i < DOTS; i++) {
          const t = (i + 1) * 0.055;
          const x = v3.x + S.aimV.x * t;
          const y = v3.y + S.aimV.y * t - 0.5 * G * t * t;
          const z = v3.z + (info.cz - v3.z) * Math.min(1, t / 0.5);
          const k = (1 - i / DOTS) * 0.045 * Math.max(0.6, s) + 0.01;
          dummy.position.set(x, y, z);
          dummy.scale.setScalar(k);
          dummy.updateMatrix();
          dots.setMatrixAt(i, dummy.matrix);
        }
        dots.instanceMatrix.needsUpdate = true;
        dots.material.opacity = 0.55 + 0.35 * Math.sin(time * 10) ** 2;
      }
    } else if (S.state === 'flight') {
      const info = rimInfo();
      const floorY = rig.root.position.y;
      S.t += dt;
      const sub = 5, h = dt / sub;
      for (let i = 0; i < sub; i++) step(h, info, floorY);
      S.z = S.z0 + (info.cz - S.z0) * Math.min(1, S.t / 0.5);
      ball.position.set(S.p.x, S.p.y, S.z);
      ball.rotation.z -= S.v.x * dt * 3;
      ball.scale.setScalar(Math.max(0.001, s));
      // comet trail
      sparkles.emit(ball.position, {
        n: S.fire ? 4 : 1, speed: S.fire ? 0.9 : 0.4, spread: 0.08 * s, up: S.fire ? 0.4 : 0, gravity: S.fire ? -0.5 : 0.5,
        life: S.fire ? 0.5 : 0.5, size: S.fire ? 0.5 : 0.3, colors: S.fire ? FIRE : GOLD,
      });
      const gone = S.t > 3.2 || S.bounces >= 3 || S.p.x > view.visW * 0.7 || S.p.x < -view.visW * 0.7 || (S.scored && S.t > 1.8);
      if (gone) {
        if (!S.scored) resolve(false, info);
        S.state = 'respawn';
        S.t = 0.25;
      }
    }

    // net kick (after a make)
    if (hoop.net.userData.kick) {
      hoop.net.userData.kick = false;
      ctx.netKick();
    }
  }

  return {
    update, aimStart, aimMove, aimEnd, start,
    get pose() { return S.pose; },
    get aiming() { return S.state === 'aim'; },
    get shiftX() { return S.shiftX; },
    get hoopDX() { return S.hoopDX; },
    get dribbleU() { return S.dribbleU ?? 1; },
    get round() { return R; },
    get fire() { return S.fire; },
    setPose(p, t) { S.pose = p; S.poseT = t; },
    reset() {
      S.shiftTarget = 0;
      S.hoopAmp = 0;
    },
  };
}
