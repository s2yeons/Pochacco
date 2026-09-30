import * as THREE from 'three';

// Full-screen background behind the DOM. Section colors don't cross-fade — the next
// color rises as a wobbling liquid front with an inked edge, like a cartoon fill.
const frag = /* glsl */ `
  precision highp float;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uT;
  uniform float uTime;
  uniform float uVel;
  uniform float uAspect;
  uniform vec2 uMouse;
  uniform float uFever;
  uniform float uBeat;
  varying vec2 vUv;

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  vec3 hsv(float h, float s, float v) {
    vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), k, s);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = vec2(uv.x * uAspect, uv.y);

    // the liquid front: slow swell + fast ripple, agitated by scroll speed
    float agit = 1.0 + min(abs(uVel) * 0.03, 2.5);
    float wave = snoise(vec2(p.x * 1.3, uTime * 0.3)) * 0.07 * agit
               + sin(p.x * 7.0 + uTime * 2.2) * 0.018 * agit
               + snoise(vec2(p.x * 4.0, uTime * 0.8)) * 0.012;
    float front = mix(-0.15, 1.15, uT) + wave;
    float d = front - uv.y;
    float px = 1.5 / 900.0;
    vec3 col = mix(uA, uB, smoothstep(-px, px, d));

    // inked meniscus + a lighter highlight just under it
    float edge = step(0.002, uT) * step(uT, 0.998);
    float stroke = (1.0 - smoothstep(0.0035, 0.0035 + px * 2.0, abs(d))) * edge;
    float gloss = smoothstep(0.03, 0.0, d) * step(0.0, d) * edge;
    col = mix(col, col + 0.12, gloss * 0.6);

    // drifting soft light patches
    float b = snoise(p * 1.1 + vec2(uTime * 0.04, -uTime * 0.03));
    col += smoothstep(0.35, 0.9, b) * 0.045;

    // cursor glow
    float md = length((uv - uMouse) * vec2(uAspect, 1.0));
    col += 0.07 * smoothstep(0.45, 0.0, md);

    // fever: psychedelic rainbow sunburst pulsing on the beat
    if (uFever > 0.001) {
      vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
      float ang = atan(c.y, c.x);
      float rays = step(0.5, fract(ang * 3.0 / 3.14159 + uTime * 0.4));
      float rr = length(c);
      vec3 rainbow = hsv(fract(rr * 0.8 - uTime * 0.25 + ang * 0.05), 0.65, 1.0);
      vec3 fcol = mix(rainbow, rainbow * 0.82, rays);
      fcol += uBeat * 0.18 * smoothstep(0.9, 0.0, rr);
      col = mix(col, fcol, uFever);
    }

    col = mix(col, vec3(0.11, 0.1, 0.12), stroke);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createLiquid(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uA: { value: new THREE.Color() },
    uB: { value: new THREE.Color() },
    uT: { value: 0 },
    uTime: { value: 0 },
    uVel: { value: 0 },
    uAspect: { value: 1 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uFever: { value: 0 },
    uBeat: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
    depthTest: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const mouse = new THREE.Vector2(0.5, 0.5);
  addEventListener('pointermove', (e) => mouse.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight));

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    uniforms.uAspect.value = innerWidth / innerHeight;
  }
  resize();
  addEventListener('resize', resize);

  let fever = 0, beat = 0;
  return {
    update(dt, { a, b, t, vel, fevering }) {
      // hex → raw values: the shader writes straight to the sRGB canvas
      uniforms.uA.value.setHex(parseInt(a.slice(1), 16), THREE.LinearSRGBColorSpace);
      uniforms.uB.value.setHex(parseInt(b.slice(1), 16), THREE.LinearSRGBColorSpace);
      uniforms.uT.value = t;
      uniforms.uTime.value += dt;
      uniforms.uVel.value += (vel - uniforms.uVel.value) * 0.1;
      uniforms.uMouse.value.lerp(mouse, 0.08);
      fever += ((fevering ? 1 : 0) - fever) * Math.min(1, dt * 3);
      beat *= Math.exp(-dt * 6);
      uniforms.uFever.value = fever;
      uniforms.uBeat.value = beat;
      renderer.render(scene, camera);
    },
    beat() { beat = 1; },
  };
}
