// All sound is synthesized with WebAudio — no audio files are shipped.
// Engine hum, sirens, gunshots, pickups and a slow procedural music loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  const settings = { sfx: 0.7, music: 0.35, muted: false };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = settings.muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = settings.sfx;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = settings.music;
      musicGain.connect(master);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 82;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(sfxGain);
      engineOsc.start();
      engineOsc2.start();
      // Siren: one square that flips between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(sfxGain);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 3000;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start();
  }

  // A slow Am–F–C–G pad loop, one soft chord every bar, with a sparse bass.
  const CHORDS = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66],
    [130.81, 196.0, 246.94],
  ];
  function musicTick() {
    if (!ctx) return;
    const chord = CHORDS[musicStep % CHORDS.length];
    musicStep += 1;
    for (const freq of chord) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + 3.4);
      o.connect(g);
      g.connect(musicGain);
      o.start(t);
      o.stop(t + 3.5);
    }
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = chord[0] / 2;
    const bg = ctx.createGain();
    const t = ctx.currentTime;
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.07, t + 0.4);
    bg.gain.linearRampToValueAtTime(0.0001, t + 3.4);
    bass.connect(bg);
    bg.connect(musicGain);
    bass.start(t);
    bass.stop(t + 3.5);
  }

  return {
    get ready() {
      return !!ctx;
    },
    unlock() {
      if (ensure()) {
        resume();
        if (!musicTimer) musicTimer = window.setInterval(musicTick, 3500);
      }
    },
    setVolumes(sfx, music) {
      settings.sfx = sfx;
      settings.music = music;
      if (sfxGain) sfxGain.gain.value = sfx;
      if (musicGain) musicGain.gain.value = music;
    },
    setMuted(muted) {
      settings.muted = muted;
      if (master) master.gain.value = muted ? 0 : 1;
    },
    setEngine(speed01, throttle) {
      if (!ctx) return;
      const f = 55 + speed01 * 140;
      engineOsc.frequency.value = f;
      engineOsc2.frequency.value = f * 1.5;
      engineGain.gain.value = throttle > 0.05 || speed01 > 0.05 ? 0.05 + speed01 * 0.06 : 0;
    },
    setSiren(on, distance) {
      if (!ctx) return;
      if (on && !sirenTimer) {
        sirenTimer = window.setInterval(() => {
          sirenOsc.frequency.value = sirenOsc.frequency.value < 800 ? 960 : 720;
        }, 420);
      } else if (!on && sirenTimer) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
      }
      const d = Math.max(0, Math.min(1, 1 - distance / 120));
      sirenGain.gain.value = on ? 0.02 + d * 0.05 : 0;
    },
    shoot() {
      noiseBurst(0.12, 0.5, 2600);
      blip(160, 0.08, 'square', 0.18);
    },
    punch() {
      noiseBurst(0.08, 0.35, 900);
    },
    hit() {
      blip(220, 0.12, 'sawtooth', 0.15);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.22);
      blip(880, 0.12, 'sine', 0.22, 0.09);
    },
    cash() {
      blip(990, 0.08, 'sine', 0.2);
      blip(1320, 0.14, 'sine', 0.2, 0.08);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'triangle', 0.22, i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.25, 'triangle', 0.2, i * 0.14));
    },
    click() {
      blip(520, 0.05, 'sine', 0.15);
    },
    busted() {
      [330, 262, 196].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.14, i * 0.16));
    },
    crash() {
      noiseBurst(0.25, 0.4, 700);
    },
  };
}
