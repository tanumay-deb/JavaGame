/* Every sound in the park is synthesised here. Nothing is loaded — the same
   rule the artwork follows, for the same reason: no borrowed assets, and the
   whole game still opens from a file:// URL with nothing beside it.

   Two things this has to get right. A browser will not start an AudioContext
   until the player has touched something, so nothing is built until the first
   real gesture. And a park with three hundred people in it can ask for a coin
   sound three hundred times a second, so every sound is rate-limited and the
   number of voices playing at once is capped. */

const SOUND_KEY = 'prehistoric-fun-park-sound';

const audio = {
  ctx: null,
  master: null,
  on: true,
  volume: 0.55,
  voices: 0,
  maxVoices: 14,
  _last: {},          /* sound name -> when it last played, for the throttle */
  _murmur: null,      /* the crowd, one set of nodes for the whole game */

  /* ------------------------------------------------------------- setup */
  /* Called from a click handler. Before that there is no context at all, so
     every play() is a no-op and costs nothing. */
  start() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                                  /* no audio here; stay quiet */
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.buildMurmur();
    } catch (e) { this.ctx = null; }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  load() {
    try {
      const v = localStorage.getItem(SOUND_KEY);
      if (v !== null) this.on = v === '1';
    } catch (e) { /* storage blocked; the default stands */ }
  },

  setOn(v) {
    this.on = !!v;
    try { localStorage.setItem(SOUND_KEY, this.on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!this.ctx) { if (this.on) this.start(); return; }
    this.resume();
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(this.on ? this.volume : 0, now + 0.12);
    if (this.on) this.play('tap');
  },

  /* ------------------------------------------------------------ voices */
  /* One envelope, one output. Every sound below is built out of this, so there
     is exactly one place that counts voices and cleans up after them.
     `src` is the thing that can be started and stopped; `out` is the end of
     the chain hanging off it, which for a plain tone is the source itself. */
  voice(src, out, gain, t0, attack, hold, release) {
    const g = this.ctx.createGain();
    const peak = Math.max(0.0002, gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    out.connect(g);
    g.connect(this.master);
    this.voices++;
    src.onended = () => {
      this.voices--;
      try { g.disconnect(); if (out !== src) out.disconnect(); } catch (e) { /* already gone */ }
    };
    src.start(t0);
    src.stop(t0 + attack + hold + release + 0.02);
  },

  tone(type, freq, gain, t0, attack, hold, release, bend) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, bend), t0 + attack + hold + release);
    this.voice(o, o, gain, t0, attack, hold, release);
  },

  /* A short burst of noise, shaped by a filter — thuds, splashes, crunches.
     The buffer is made once and replayed, rather than a new one per hit. */
  noiseBuffer() {
    if (this._noise) return this._noise;
    const n = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  },

  noise(gain, t0, attack, hold, release, type, freq, endFreq) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + attack + hold + release);
    f.Q.value = 1.1;
    src.connect(f);
    this.voice(src, f, gain, t0, attack, hold, release);
  },

  /* ------------------------------------------------------------- crowd */
  /* Filtered noise with a slow wobble on it, turned up and down by how many
     people are in the park. Four nodes for the whole game, made once. */
  buildMurmur() {
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.7;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.13;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.006;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(); lfo.start();
      this._murmur = g;
    } catch (e) { this._murmur = null; }
  },

  /* called once a second from the sim, not every frame */
  crowd(n) {
    if (!this._murmur || !this.ctx) return;
    const want = Math.min(0.05, n * 0.00035);
    const g = this._murmur.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(want, now + 1.2);
  },

  /* -------------------------------------------------------------- play */
  /* `gap` is the shortest time between two of the same sound. Money comes in
     many times a second in a busy park; one chink is a park, thirty is a fault. */
  play(name, gap) {
    if (!this.ctx || !this.on) return;
    /* The cap keeps a busy park from stacking up voices, but a handful of
       sounds are the point of the moment they happen in and must not be the
       ones dropped. Each of them is rare or throttled, so letting them past
       cannot run away. */
    if (this.voices > this.maxVoices && !SFX_ALWAYS[name]) return;
    const now = this.ctx.currentTime;
    const wait = gap === undefined ? (SFX_GAP[name] || 0) : gap;
    if (wait && now - (this._last[name] || -99) < wait) return;
    this._last[name] = now;
    const f = SFX[name];
    if (f) { try { f(this, now); } catch (e) { /* a dropped sound is not worth a crash */ } }
  }
};

/* heard whatever else is going on */
const SFX_ALWAYS = { win: 1, moon: 1, fight: 1, error: 1 };

/* how often each sound is allowed, in seconds */
const SFX_GAP = {
  coin: 0.34, tap: 0.04, build: 0.08, demolish: 0.12,
  fight: 0.9, ride: 0.55, splash: 0.5, error: 0.3
};

/* Each one is a few oscillators. Written as notes rather than numbers where
   it helps: the chime is a fifth, the fanfare is a major triad and the octave. */
const SFX = {
  /* a soft wooden tap for anything the player presses */
  tap: (a, t) => { a.tone('sine', 660, 0.10, t, 0.004, 0.012, 0.05); },

  /* something put down: a low thud with a knock of noise on top */
  build: (a, t) => {
    a.tone('sine', 150, 0.26, t, 0.005, 0.02, 0.16, 82);
    a.noise(0.13, t, 0.002, 0.012, 0.09, 'bandpass', 1500, 500);
  },

  /* something taken away: the same thud, falling, with more grit */
  demolish: (a, t) => {
    a.tone('sine', 120, 0.20, t, 0.004, 0.02, 0.26, 48);
    a.noise(0.17, t, 0.003, 0.05, 0.24, 'lowpass', 1800, 260);
  },

  /* money in: two quick notes up, like a stone dropped in a bowl */
  coin: (a, t) => {
    a.tone('triangle', 988, 0.085, t, 0.003, 0.01, 0.06);
    a.tone('triangle', 1319, 0.075, t + 0.055, 0.003, 0.012, 0.09);
  },

  /* money out */
  spend: (a, t) => {
    a.tone('triangle', 740, 0.07, t, 0.003, 0.01, 0.06);
    a.tone('triangle', 494, 0.065, t + 0.055, 0.003, 0.012, 0.1);
  },

  /* no, you cannot do that */
  error: (a, t) => { a.tone('square', 175, 0.09, t, 0.004, 0.05, 0.1, 124); },

  /* somebody gets on a ride */
  ride: (a, t) => {
    a.tone('sine', 523, 0.07, t, 0.006, 0.02, 0.14, 784);
  },

  /* a brawl: a flat percussive smack, no pitch to speak of */
  fight: (a, t) => {
    a.noise(0.22, t, 0.002, 0.02, 0.15, 'lowpass', 900, 180);
    a.tone('square', 96, 0.13, t, 0.003, 0.03, 0.12, 62);
  },

  /* the log boat landing */
  splash: (a, t) => { a.noise(0.15, t, 0.01, 0.04, 0.32, 'highpass', 700, 2600); },

  /* a new moon: a bare fifth on a soft bell */
  moon: (a, t) => {
    a.tone('sine', 587, 0.11, t, 0.02, 0.12, 0.7);
    a.tone('sine', 880, 0.075, t + 0.1, 0.02, 0.12, 0.85);
  },

  /* chief of the valley */
  win: (a, t) => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => a.tone('triangle', f, 0.12, t + i * 0.13, 0.012, 0.09, 0.4));
    a.tone('sine', 262, 0.10, t, 0.03, 0.4, 0.5);
  },

  /* the advisor has something to say */
  tip: (a, t) => {
    a.tone('sine', 784, 0.065, t, 0.006, 0.02, 0.1);
    a.tone('sine', 1047, 0.055, t + 0.08, 0.006, 0.02, 0.12);
  }
};
