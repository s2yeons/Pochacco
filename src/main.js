import { createStage } from './stage.js';
import { createSfx } from './sfx.js';
import { createLiquid } from './liquid.js';

const anime = window.anime;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

document.body.classList.add('loading');
history.scrollRestoration = 'manual';
scrollTo(0, 0);

const sfx = createSfx();

// ── bubble (speech) ──────────────────────────────────────────
const bubble = $('#bubble');
let bubbleT = 0;
function showBubble(text) {
  bubble.textContent = text;
  bubbleT = 1.3;
  anime.remove(bubble);
  anime({ targets: bubble, opacity: [0, 1], scale: [0.3, 1], rotate: [anime.random(-14, 14), anime.random(-5, 5)], duration: 600, easing: 'easeOutElastic(1, .5)' });
}

// ── cursor ───────────────────────────────────────────────────
const dot = $('.cursor-dot'), ring = $('.cursor-ring');
const ptr = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; });
$$('a, button').forEach((el) => {
  el.addEventListener('pointerenter', () => document.body.classList.add('c-link'));
  el.addEventListener('pointerleave', () => document.body.classList.remove('c-link'));
});
addEventListener('pointerdown', (e) => {
  if (!finePointer || reduced) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'paw-print');
  svg.innerHTML = '<use href="#paw"/>';
  svg.style.left = e.clientX + 'px';
  svg.style.top = e.clientY + 'px';
  document.body.appendChild(svg);
  anime({
    targets: svg, scale: [0, 1.2], rotate: anime.random(-30, 30), opacity: [{ value: 1, duration: 100 }, { value: 0, duration: 700, delay: 300 }],
    translateY: [0, -30], duration: 1100, easing: 'easeOutExpo', complete: () => svg.remove(),
  });
});

// ── stage ────────────────────────────────────────────────────
const stage = createStage($('#stage'), {
  sfx,
  onBark: showBubble,
  onHover: (h) => document.body.classList.toggle('c-poch', h),
  onPoke: () => fever.poke(),
  onScore: (e) => game.score(e),
  onMiss: (e) => game.miss(e),
  onRound: (e) => game.round(e),
  onTick: (r) => game.tick(r),
  onBanner: (text, kind) => banner(text, kind),
  onBeat: (n) => fever.beat(n),
  onFeverEnd: () => fever.end(),
});
let liquid = null;
try { liquid = createLiquid($('#liquid')); } catch (err) { console.warn('liquid background disabled', err); }

// ── magnetic buttons ─────────────────────────────────────────
$$('[data-magnetic]').forEach((el) => {
  if (!finePointer) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    anime.remove(el);
    anime({ targets: el, translateX: dx * 0.3, translateY: dy * 0.35, duration: 400, easing: 'easeOutQuad' });
  });
  el.addEventListener('pointerleave', () => {
    anime.remove(el);
    anime({ targets: el, translateX: 0, translateY: 0, duration: 900, easing: 'easeOutElastic(1, .4)' });
  });
});

// ── split text into word-safe chars ──────────────────────────
function split(el) {
  const html = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = html.map((line) =>
    line.trim().split(/\s+/).map((w) => `<span class="w">${[...w].map((c) => `<span class="c">${c}</span>`).join('')}</span>`).join(' ')
  ).join('<br>');
  return $$('.c', el);
}
$$('.split').forEach(split);
$$('[data-word]').forEach((el) => { el.innerHTML = [...el.textContent].map((c) => `<span class="c">${c}</span>`).join(''); });

// ── reveal on view ───────────────────────────────────────────
const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    io.unobserve(en.target);
    const el = en.target;
    if (el.classList.contains('split')) {
      const cs = $$('.c', el);
      anime.set(cs, { translateY: '110%', rotate: anime.stagger([-25, 25]), scale: 0.4, opacity: 0 });
      anime({ targets: cs, translateY: '0%', rotate: 0, scale: 1, opacity: 1, delay: anime.stagger(35), duration: 1100, easing: 'easeOutElastic(1, .55)' });
    } else {
      anime({ targets: el, translateY: [50, 0], opacity: [0, 1], duration: 900, delay: 120, easing: 'easeOutExpo' });
    }
    $$('[data-count]', el).forEach((n) => {
      const o = { v: 0 };
      anime({ targets: o, v: +n.dataset.count, round: 1, duration: 1800, easing: 'easeOutExpo', update: () => (n.textContent = o.v) });
    });
    $$('[data-bar]', el).forEach((b, i) => {
      anime({ targets: b, width: ['0%', b.dataset.bar + '%'], duration: 1400, delay: 200 + i * 140, easing: 'easeOutElastic(1, .6)' });
    });
  }
}, { threshold: 0.2 });
$$('.split, .reveal').forEach((el) => io.observe(el));

// ── card tilt ────────────────────────────────────────────────
$$('[data-tilt]').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--rx', `${-py * 16}deg`);
    card.style.setProperty('--ry', `${px * 18}deg`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
});

// ── hero letters: hover bounce ───────────────────────────────
$$('.hero-title .ch').forEach((ch) => {
  ch.addEventListener('pointerenter', () => {
    anime.remove(ch);
    anime({
      targets: ch, keyframes: [{ translateY: -60, scaleY: 1.15, scaleX: 0.9, rotate: anime.random(-15, 15), duration: 220, easing: 'easeOutQuad' },
        { translateY: 0, scaleY: 1, scaleX: 1, rotate: 0, duration: 900, easing: 'easeOutElastic(1, .35)' }],
    });
    sfx.tick();
  });
});

// ── marquee ──────────────────────────────────────────────────
const marquees = $$('.marquee .marquee-track').map((t, i) => {
  t.innerHTML += t.innerHTML;
  return { t, x: 0, dir: i ? 1 : -1 };
});

// ── scroll engine (Lenis) ────────────────────────────────────
let lenis = null;
if (window.Lenis && !reduced) {
  lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  lenis.stop();
  window.__lenis = lenis;
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const target = $(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else target.scrollIntoView({ behavior: 'smooth' });
}));

// ── choreography: which section is Pochacco "in"? ────────────
const sections = $$('[data-scene]');
const BG = { hero: '#8fd0ff', profile: '#fff3dc', anatomy: '#2450b8', personality: '#7fe0c2', sports: '#1f1c26', icecream: '#ffd23f', outro: '#8fd0ff' };
let holds = [];
function measure() {
  const vh = innerHeight;
  holds = sections.map((el) => {
    const top = el.getBoundingClientRect().top + scrollY;
    const h = el.offsetHeight;
    let s = top - vh * 0.3, e = top + h - vh * 0.7;
    if (e < s) s = e = (s + e) / 2;
    return { name: el.dataset.scene, el, s, e, top, h };
  });
}
const smooth = (t) => t * t * (3 - 2 * t);
function choreo(y) {
  for (let i = 0; i < holds.length; i++) {
    const h = holds[i];
    if (y < h.s) {
      if (i === 0) return { a: h.name, b: h.name, t: 0 };
      const p = holds[i - 1];
      return { a: p.name, b: h.name, t: smooth(clamp((y - p.e) / (h.s - p.e), 0, 1)) };
    }
    if (y <= h.e) return { a: h.name, b: h.name, t: 0 };
  }
  const last = holds[holds.length - 1];
  return { a: last.name, b: last.name, t: 0 };
}
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

function sectionProgress(name, y) {
  const h = holds.find((q) => q.name === name);
  return h ? clamp((y - h.top) / (h.h - innerHeight), 0, 1) : 0;
}

// ── blueprint callouts: labels + dashed leader lines to the 3D parts ──
const bpPin = $('#anatomy .pin'), bpSvg = $('.bp-lines'), bpBar = $('#bp-bar'), bpPct = $('#bp-pct');
const bpLabels = $$('.bp-label').map((el, i) => {
  const ns = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(ns, 'path');
  const dotEl = document.createElementNS(ns, 'circle');
  bpSvg.append(path, dotEl);
  return { el, i, key: el.dataset.anchor, left: el.dataset.side === 'l', path, dot: dotEl, k: -1 };
});
function updateBlueprint(p) {
  const w = stage.weights.anatomy || 0;
  if (w < 0.02) {
    if (bpSvg.style.display !== 'none') {
      bpSvg.style.display = 'none';
      bpLabels.forEach((l) => { l.el.style.opacity = 0; l.k = -1; });
    }
    return;
  }
  bpSvg.style.display = '';
  const e = stage.explode;
  bpBar.style.width = `${Math.min(100, e * 100)}%`;
  bpPct.textContent = `${Math.round(Math.min(1, e) * 100)}%`;
  const pinTop = bpPin.getBoundingClientRect().top;
  const anchors = stage.anchors();
  for (const l of bpLabels) {
    const k = clamp((e - 0.35 - l.i * 0.05) / 0.25, 0, 1) * w;
    if (Math.abs(k - l.k) > 0.001) {
      l.k = k;
      l.el.style.opacity = k;
      l.el.style.transform = `translateY(${(1 - k) * 20}px) scale(${0.8 + 0.2 * k})`;
    }
    const a = anchors[l.key];
    const sx = l.left ? l.el.offsetLeft + l.el.offsetWidth : l.el.offsetLeft;
    // svg lives in the sticky pin, so convert viewport → pin space
    const sy = l.el.offsetTop + l.el.offsetHeight / 2;
    const ay = a.y - pinTop;
    const mx = sx + (a.x - sx) * 0.35;
    l.path.setAttribute('d', `M${sx} ${sy} L${mx} ${sy} L${a.x} ${ay}`);
    l.path.style.opacity = k;
    l.dot.setAttribute('cx', a.x);
    l.dot.setAttribute('cy', ay);
    l.dot.setAttribute('r', 6 * k);
  }
}

// ── personality: pinned horizontal track ─────────────────────
const persona = $('#personality'), track = $('.track', persona), ground = $('.run-ground i'), runMeter = $('#run-meter'), runM = $('#run-m');
const words = $$('.panel-word', persona);
function updatePersona(y, vel) {
  const h = holds.find((q) => q.name === 'personality');
  if (!h) return;
  const p = clamp((y - h.top) / (h.h - innerHeight), 0, 1);
  const dist = track.scrollWidth - innerWidth;
  track.style.transform = `translate3d(${-p * dist}px,0,0) skewX(${clamp(-vel * 0.03, -8, 8)}deg)`;
  ground.style.transform = `translate3d(${-(y * 1.5) % 280}px,0,0)`;
  runMeter.style.setProperty('--p', `${p * 100}%`);
  runM.textContent = `${Math.round(p * 1989)}m`;
  // each giant word breathes as it crosses the center
  for (const w of words) {
    const r = w.getBoundingClientRect();
    const c = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
    const k = 1 - clamp(Math.abs(c), 0, 1);
    w.style.color = `rgba(255,250,240,${k * k * k})`;
    w.style.transform = `translateY(${(1 - k) * 40}px) rotate(${c * -6}deg)`;
  }
}

// ── big center banner (countdown, ON FIRE, TIME UP…) ─────────
const shotText = $('#shot-text');
function banner(text, kind = '') {
  shotText.textContent = text;
  shotText.className = `shot-text ${kind}`;
  anime.remove(shotText);
  anime({
    targets: shotText, opacity: [{ value: 1, duration: 100 }, { value: 0, duration: 350, delay: 550 }],
    scale: [{ value: [0.2, 1.05], duration: 650, easing: 'easeOutElastic(1, .45)' }, { value: 1.35, duration: 350 }],
    rotate: [anime.random(-10, 10), 0], easing: 'easeOutQuad',
  });
}

// floating "+3 SWISH!" at the rim
function pop(html, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.innerHTML = html;
  $('#pops').appendChild(el);
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${x - w / 2}px`;
  el.style.top = `${y - h}px`;
  anime({
    targets: el, translateY: [{ value: -30, duration: 300, easing: 'easeOutBack' }, { value: -110, duration: 700, easing: 'easeInQuad' }],
    scale: [{ value: [0.3, 1.1], duration: 400, easing: 'easeOutElastic(1, .5)' }, { value: 0.8, duration: 600 }],
    rotate: anime.random(-12, 12), opacity: [{ value: 1, duration: 100 }, { value: 0, duration: 400, delay: 550 }],
    complete: () => el.remove(),
  });
}

// ── basketball: slingshot input + round HUD ──────────────────
const court = $('#court'), sportsSec = $('#sports'), gameEl = $('#game');
const playBtn = $('#play'), tip = $('#game-tip'), resultEl = $('#result');
const streakEl = $('#streak'), streakDots = $$('span', streakEl);
const hoops = stage.hoops;
$('#best').textContent = hoops.round.best;
court.addEventListener('pointerenter', () => document.body.classList.add('c-aim'));
court.addEventListener('pointerleave', () => document.body.classList.remove('c-aim'));
court.addEventListener('pointerdown', (e) => {
  if (!hoops.aimStart(e.clientX, e.clientY)) return;
  court.setPointerCapture(e.pointerId);
  e.preventDefault();
});
court.addEventListener('pointermove', (e) => hoops.aimMove(e.clientX, e.clientY));
const release = () => hoops.aimEnd();
court.addEventListener('pointerup', release);
court.addEventListener('pointercancel', release);
playBtn.addEventListener('click', () => {
  hoops.start();
  anime({ targets: playBtn, scale: [0.85, 1], duration: 600, easing: 'easeOutElastic(1, .4)' });
});

function setStreak(n, fire) {
  streakDots.forEach((d, i) => d.classList.toggle('on', i < Math.min(n, 3)));
  streakEl.classList.toggle('fire', !!fire);
  gameEl.classList.toggle('fire', !!fire);
}
const game = {
  score(e) {
    pop(`+${e.pts}<small>${e.label}${e.fire ? ' 🔥x2' : ''}</small>`, e.x, e.y, e.fire ? 'fire' : '');
    if (e.practice) return;
    $('#score').textContent = e.score;
    anime({ targets: '#score', scale: [1.8, 1], duration: 700, easing: 'easeOutElastic(1, .4)' });
    setStreak(e.streak, e.fire);
  },
  miss(e) {
    pop('MISS', e.x, e.y, 'miss');
    if (hoops.round.playing) setStreak(0, false);
  },
  tick(r) {
    $('#time').textContent = Math.ceil(r.time);
    $('#timebar').style.transform = `scaleX(${r.time / 30})`;
    gameEl.classList.toggle('hurry', r.time < 10);
  },
  round(e) {
    if (e.phase === 'countdown') {
      resultEl.hidden = true;
      playBtn.hidden = true;
      tip.textContent = '준비…!';
      sportsSec.classList.add('playing');
      $('#score').textContent = 0;
      $('#time').textContent = 30;
      $('#timebar').style.transform = 'scaleX(1)';
      setStreak(0, false);
    } else if (e.phase === 'count') {
      banner(e.n > 0 ? String(e.n) : 'GO!');
    } else if (e.phase === 'play') {
      tip.textContent = '당겼다 놓아서 슛! 🏀';
    } else if (e.phase === 'end') {
      sportsSec.classList.remove('playing');
      gameEl.classList.remove('hurry');
      setStreak(0, false);
      banner('TIME UP!');
      $('#rank').textContent = e.rank;
      $('#r-score').textContent = e.score;
      $('#r-makes').textContent = e.makes;
      $('#r-shots').textContent = e.shots;
      $('#r-best').hidden = !(e.newBest && e.score > 0);
      $('#best').textContent = e.best;
      resultEl.hidden = false;
      anime({ targets: '#rank', scale: [0.3, 1], rotate: [-12, 0], duration: 1000, easing: 'easeOutElastic(1, .45)' });
      playBtn.hidden = false;
      $('span', playBtn).textContent = '↻ 다시 하기';
      tip.textContent = '';
    }
  },
};

// ── FEVER mode: type "pochacco" or poke him 7 times fast ─────
const feverText = $('#fever-text');
const fever = {
  pokes: [],
  poke() {
    const now = performance.now();
    this.pokes = this.pokes.filter((t) => now - t < 3500);
    this.pokes.push(now);
    if (this.pokes.length >= 7) this.start();
  },
  start() {
    if (stage.fevering) return;
    this.pokes = [];
    stage.fever(9);
    document.body.classList.add('fever');
    anime.remove(feverText);
    anime({ targets: feverText, opacity: [0, 1], duration: 200, easing: 'linear' });
    anime({
      targets: '#fever-text span', translateY: ['-120vh', 0], rotate: [anime.stagger([-60, 60]), 0],
      delay: anime.stagger(60), duration: 900, easing: 'easeOutElastic(1, .5)',
    });
    anime({ targets: feverText, opacity: 0, delay: 1800, duration: 500, easing: 'easeInQuad' });
  },
  beat(n) {
    liquid?.beat();
    if (!reduced) {
      anime({ targets: '.hero-title .ch, .outro-title .c', scale: [1.12, 1], duration: 380, easing: 'easeOutQuad' });
    }
  },
  end() {
    document.body.classList.remove('fever');
    showBubble('헥헥… 재밌었다!');
  },
};
let typed = '';
addEventListener('keydown', (e) => {
  if (e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-8);
  if (typed === 'pochacco') fever.start();
});

$('#treat').addEventListener('click', () => stage.treat());
$('#party').addEventListener('click', (e) => {
  stage.party();
  anime({
    targets: '.outro-title .c', delay: anime.stagger(40, { from: 'center' }),
    keyframes: [{ translateY: -70, rotate: () => anime.random(-25, 25), duration: 220, easing: 'easeOutQuad' }, { translateY: 0, rotate: 0, duration: 900, easing: 'easeOutElastic(1, .35)' }],
  });
  anime({ targets: e.currentTarget.querySelector('span'), scale: [1.3, 1], duration: 700, easing: 'easeOutElastic(1, .4)' });
});

const soundBtn = $('#sound');
soundBtn.addEventListener('click', () => {
  const on = sfx.toggle();
  soundBtn.setAttribute('aria-pressed', on);
  $('b', soundBtn).textContent = on ? 'ON' : 'OFF';
  if (on) sfx.boing();
});

// ── loader → curtain → hero intro ────────────────────────────
function runIntro() {
  anime.set('.hero-title .ch', { translateY: '-120vh', rotate: anime.stagger([-40, 40]), scaleY: 1.6 });
  const count = { v: 0 };
  const paws = $$('.loader-paws svg');
  const num = $('#loader-num');
  const tl = anime.timeline({ easing: 'easeOutExpo' });
  tl.add({
    targets: count, v: 100, round: 1, duration: reduced ? 300 : 1700, easing: 'easeInOutQuart',
    update: () => {
      num.textContent = count.v;
      paws.forEach((p, i) => { p.style.opacity = count.v > (i + 1) * 22 ? 1 : 0.15; });
    },
  })
    .add({ targets: '.curtain i', scaleY: [0, 1], delay: anime.stagger(70), duration: 600, easing: 'easeInOutQuart' })
    .add({
      targets: '#loader', opacity: 0, duration: 1,
      complete: () => {
        $('#loader').style.display = 'none';
        $$('.curtain i').forEach((i) => (i.style.transformOrigin = 'top'));
      },
    })
    .add({ targets: '.curtain i', scaleY: [1, 0], delay: anime.stagger(70, { from: 'center' }), duration: 700, easing: 'easeInOutQuart' })
    .add({
      targets: '.hero-title .ch', translateY: 0, rotate: 0, scaleY: 1,
      delay: anime.stagger(70, { from: 'center' }), duration: 1400, easing: 'easeOutElastic(1, .55)',
      begin: () => stage.intro(),
    }, '-=300')
    .add({ targets: '.reveal-hero', opacity: [0, 1], translateY: [40, 0], scale: [0.6, 1], delay: anime.stagger(80), duration: 900, easing: 'easeOutElastic(1, .6)' }, '-=1000')
    .add({ targets: '.nav', translateY: ['-120%', '0%'], duration: 800 }, '-=900')
    .finished.then(() => {
      $('.curtain').remove();
      document.body.classList.remove('loading');
      lenis?.start();
      measure();
      // idle wave through the title
      if (!reduced) {
        anime({ targets: '.hero-title .ch', translateY: [0, -18, 0], delay: anime.stagger(90), duration: 1600, endDelay: 1800, easing: 'easeInOutSine', loop: true });
      }
    });
}

// ── main loop ────────────────────────────────────────────────
const progress = $('#progress');
let last = performance.now(), prevY = 0, vel = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  lenis?.raf(now);
  const y = lenis ? lenis.animatedScroll : scrollY;
  vel = vel + ((y - prevY) / Math.max(dt, 1e-3) * 0.016 - vel) * 0.2;
  prevY = y;

  const c = choreo(y);
  if (liquid) liquid.update(dt, { a: BG[c.a], b: BG[c.b], t: c.t, vel, fevering: stage.fevering });
  else document.body.style.background = mix(BG[c.a], BG[c.b], c.t);
  const now2 = c.t < 0.5 ? c.a : c.b;
  document.body.classList.toggle('dark-zone', now2 === 'sports' || now2 === 'anatomy');

  const anatomyP = sectionProgress('anatomy', y);
  stage.update(dt, { ...c, scroll: y, velocity: vel, anatomy: anatomyP });
  updateBlueprint(anatomyP);

  // cursor
  ptr.rx += (ptr.x - ptr.rx) * 0.18;
  ptr.ry += (ptr.y - ptr.ry) * 0.18;
  dot.style.transform = `translate3d(${ptr.x}px,${ptr.y}px,0)`;
  ring.style.transform = `translate3d(${ptr.rx}px,${ptr.ry}px,0)`;

  // marquee reacts to scroll velocity
  for (const m of marquees) {
    m.x += (1.2 + Math.abs(vel) * 0.6) * m.dir * dt * 60 * (vel < 0 ? -1 : 1);
    const w = m.t.scrollWidth / 2;
    m.x = ((m.x % w) + w) % w;
    m.t.style.transform = `translate3d(${-m.x}px,0,0) skewX(${clamp(-vel * 0.15, -12, 12)}deg)`;
  }

  progress.style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - innerHeight), 0, 1)})`;
  updatePersona(y, vel);

  // speech bubble follows his head
  if (bubbleT > 0) {
    bubbleT -= dt;
    const p = stage.headScreen();
    bubble.style.left = `${p.x - bubble.offsetWidth / 2}px`;
    bubble.style.top = `${p.y - bubble.offsetHeight - 14}px`;
    if (bubbleT <= 0) anime({ targets: bubble, opacity: 0, scale: 0.6, duration: 250, easing: 'easeInQuad' });
  }
}

addEventListener('resize', measure);
addEventListener('load', measure);
document.fonts?.ready.then(measure);
measure();
requestAnimationFrame(frame);
runIntro();
