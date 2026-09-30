// Tiny WebAudio synth — every sound is generated, nothing to download.
export function createSfx() {
  let ctx = null;
  let on = false;
  const ensure = () => {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone({ type = 'sine', f0, f1, dur = 0.2, vol = 0.2, delay = 0 }) {
    if (!on) return;
    const c = ensure();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  return {
    get on() { return on; },
    toggle() {
      on = !on;
      if (on) ensure();
      return on;
    },
    boing() {
      tone({ f0: 180, f1: 620, dur: 0.2, vol: 0.22 });
      tone({ type: 'triangle', f0: 620, f1: 300, dur: 0.18, vol: 0.08, delay: 0.14 });
    },
    bark() {
      tone({ type: 'square', f0: 720, f1: 360, dur: 0.08, vol: 0.05 });
      tone({ type: 'square', f0: 780, f1: 400, dur: 0.08, vol: 0.05, delay: 0.12 });
    },
    pop() { tone({ f0: 500, f1: 1300, dur: 0.1, vol: 0.14 }); },
    swish() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.14, delay: i * 0.07 }));
    },
    clank() {
      tone({ type: 'sawtooth', f0: 190, f1: 80, dur: 0.28, vol: 0.08 });
      tone({ type: 'triangle', f0: 1400, f1: 900, dur: 0.12, vol: 0.05 });
    },
    tick() { tone({ type: 'triangle', f0: 1200, dur: 0.04, vol: 0.05 }); },
    go() {
      tone({ type: 'square', f0: 880, dur: 0.35, vol: 0.08 });
      tone({ type: 'square', f0: 1320, dur: 0.35, vol: 0.05, delay: 0.02 });
    },
    thud() { tone({ f0: 160, f1: 60, dur: 0.16, vol: 0.25 }); },
    bounce() { tone({ f0: 120, f1: 50, dur: 0.12, vol: 0.2 }); },
    buzzer() {
      tone({ type: 'sawtooth', f0: 110, dur: 0.9, vol: 0.12 });
      tone({ type: 'square', f0: 116, dur: 0.9, vol: 0.06 });
    },
    kick() {
      tone({ f0: 150, f1: 40, dur: 0.22, vol: 0.35 });
      tone({ type: 'triangle', f0: [523, 659, 784, 659][(Math.random() * 4) | 0], dur: 0.12, vol: 0.05, delay: 0.23 });
    },
  };
}
