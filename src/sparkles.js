import * as THREE from 'three';

// One draw call for every sparkle on the page.
// Slots [0, AMBIENT) are a static twinkling field animated purely on the GPU;
// the rest are a CPU-driven pool for bursts, trails and auras.
const AMBIENT = 260;
const POOL = 700;
const N = AMBIENT + POOL;

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aLife;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixel;
  uniform float uScroll;
  uniform float uRange;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpin;
  void main() {
    vec3 p = position;
    float ambient = step(aLife, -0.5); // life < -0.5 marks ambient stars
    // ambient stars drift with scroll and wrap around vertically
    p.y = mix(p.y, mod(p.y + uScroll + uRange * 0.5, uRange) - uRange * 0.5, ambient);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.5 + 0.5 * sin(uTime * (2.0 + fract(aPhase * 7.3) * 4.0) + aPhase * 6.2831);
    tw = pow(tw, 3.0);
    float life = clamp(aLife, 0.0, 1.0);
    float a = mix(life * (0.6 + 0.4 * tw), tw, ambient);
    vAlpha = a;
    vColor = aColor;
    vSpin = aPhase * 6.2831 + uTime * (0.6 + fract(aPhase * 3.1));
    gl_PointSize = aSize * uPixel * (0.35 + 0.65 * a) * (10.0 / -mv.z);
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpin;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vSpin), s = sin(vSpin);
    uv = mat2(c, -s, s, c) * uv;
    vec2 a = abs(uv);
    // four-point glint + soft core
    float rays = max(0.0, 1.0 - a.x * 9.0) * max(0.0, 1.0 - a.y) + max(0.0, 1.0 - a.y * 9.0) * max(0.0, 1.0 - a.x);
    float d = length(uv);
    float core = smoothstep(0.42, 0.0, d);
    float glow = smoothstep(1.0, 0.0, d) * 0.25;
    float shape = rays + core + glow;
    // white-hot center, tinted edges
    vec3 col = mix(vColor, vec3(1.0), core * 0.85);
    float alpha = clamp(shape, 0.0, 1.0) * vAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const PALETTE = [0xffffff, 0xffe066, 0xff8fb1, 0x6cc6ff, 0xffd23f, 0xff5a4e].map((c) => new THREE.Color(c));

export function createSparkles(scene, renderer) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const phase = new Float32Array(N);
  const life = new Float32Array(N);
  const color = new Float32Array(N * 3);
  const vel = new Float32Array(POOL * 3);
  const decay = new Float32Array(POOL);
  const grav = new Float32Array(POOL);

  for (let i = 0; i < N; i++) {
    phase[i] = Math.random();
    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    color.set([c.r, c.g, c.b], i * 3);
    if (i < AMBIENT) {
      life[i] = -1;
      size[i] = 0.12 + Math.random() * 0.28;
    } else {
      life[i] = 0;
      size[i] = 0;
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: renderer.getPixelRatio() * 40 },
      uScroll: { value: 0 },
      uRange: { value: 12 },
    },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  let head = 0;
  let dirty = false;

  function layoutAmbient(visW, visH, mobile) {
    const range = visH * 2.2;
    mat.uniforms.uRange.value = range;
    const count = mobile ? AMBIENT * 0.55 : AMBIENT;
    for (let i = 0; i < AMBIENT; i++) {
      const z = -8 + Math.random() * 9;
      const depth = (10 - z) / 10;
      pos[i * 3] = (Math.random() - 0.5) * visW * depth * 1.1;
      pos[i * 3 + 1] = (Math.random() - 0.5) * range;
      pos[i * 3 + 2] = z;
      size[i] = i < count ? 0.1 + Math.random() * 0.3 : 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  /**
   * Emit sparkles from a world point.
   * opts: n, speed, spread (radius), up (bias), gravity, life (seconds), size, colors
   */
  function emit(at, { n = 20, speed = 2, spread = 0.1, up = 0.5, gravity = 1.5, life: lf = 1, size: sz = 0.35, colors = null } = {}) {
    for (let k = 0; k < n; k++) {
      const j = head;
      head = (head + 1) % POOL;
      const i = AMBIENT + j;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sx = Math.sin(ph) * Math.cos(th), sy = Math.cos(ph), sz2 = Math.sin(ph) * Math.sin(th);
      pos[i * 3] = at.x + sx * spread;
      pos[i * 3 + 1] = at.y + sy * spread;
      pos[i * 3 + 2] = at.z + sz2 * spread;
      const sp = speed * (0.35 + Math.random() * 0.65);
      vel[j * 3] = sx * sp;
      vel[j * 3 + 1] = sy * sp + up * speed;
      vel[j * 3 + 2] = sz2 * sp * 0.5;
      life[i] = 1;
      decay[j] = 1 / (lf * (0.6 + Math.random() * 0.6));
      grav[j] = gravity;
      size[i] = sz * (0.5 + Math.random() * 0.8);
      const c = colors ? colors[(Math.random() * colors.length) | 0] : PALETTE[(Math.random() * PALETTE.length) | 0];
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
    }
    dirty = true;
  }

  function update(dt, time, scrollWorld) {
    mat.uniforms.uTime.value = time;
    mat.uniforms.uScroll.value = scrollWorld;
    let any = dirty;
    const drag = Math.exp(-1.6 * dt);
    for (let j = 0; j < POOL; j++) {
      const i = AMBIENT + j;
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= decay[j] * dt;
      if (life[i] <= 0) { life[i] = 0; size[i] = 0; continue; }
      vel[j * 3] *= drag;
      vel[j * 3 + 1] = vel[j * 3 + 1] * drag - grav[j] * dt;
      vel[j * 3 + 2] *= drag;
      pos[i * 3] += vel[j * 3] * dt;
      pos[i * 3 + 1] += vel[j * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[j * 3 + 2] * dt;
    }
    if (any) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      if (dirty) geo.attributes.aColor.needsUpdate = true;
      dirty = false;
    }
  }

  return {
    emit, update, layoutAmbient,
    setPixelRatio(pr) { mat.uniforms.uPixel.value = pr * 40; },
    colors: {
      gold: [0xffe066, 0xffd23f, 0xffffff].map((c) => new THREE.Color(c)),
      party: PALETTE,
      cool: [0x6cc6ff, 0xffffff, 0xb8e6ff].map((c) => new THREE.Color(c)),
      pink: [0xff8fb1, 0xffffff, 0xffe066].map((c) => new THREE.Color(c)),
    },
  };
}
