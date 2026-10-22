"use client";

/**
 * Game sounds, made on the fly with the Web Audio API (no audio files to
 * download). Browsers only allow sound after the person has tapped the page
 * once, so the first tap anywhere unlocks it; the TV shows a "Turn on sound"
 * button for that. A mute choice is remembered on the device.
 */

const MUTE_KEY = "crowdplay_muted";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let listening = false;

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
  if (master) master.gain.value = m ? 0 : volume;
}

let volume = 0.5;
/** The TV plays louder than phones. */
export function setVolume(v: number) {
  volume = v;
  if (master && !isMuted()) master.gain.value = v;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Call once on page load: the first tap anywhere turns sound on. */
export function listenForUnlock() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const unlock = () => {
    const c = audio();
    if (c && c.state === "suspended") c.resume();
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

export function unlockSound() {
  const c = audio();
  if (c && c.state === "suspended") return c.resume();
}

export function soundReady() {
  return !!ctx && ctx.state === "running";
}

type Wave = OscillatorType;

function tone(freq: number, at: number, dur: number, type: Wave = "sine", gain = 0.3, slideTo?: number) {
  const c = audio();
  if (!c || !master || c.state !== "running") return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(at: number, dur: number, gain = 0.2, filterFreq = 1200) {
  const c = audio();
  if (!c || !master || c.state !== "running") return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sounds = {
  /** A soft pop when you tap an answer or vote. */
  tap: () => tone(660, 0, 0.08, "triangle", 0.25, 880),
  /** Your team's answer is locked in. */
  lock: () => {
    tone(520, 0, 0.09, "square", 0.12);
    tone(780, 0.07, 0.12, "square", 0.12);
  },
  /** One clock tick (the last 5 seconds); higher on the final second. */
  tick: (last = false) => tone(last ? 1200 : 950, 0, 0.06, "square", 0.1),
  /** Someone joined the lobby. */
  join: () => {
    tone(700, 0, 0.08, "sine", 0.2);
    tone(1050, 0.08, 0.12, "sine", 0.2);
  },
  /** Get-ready beeps before a question (3, 2, 1). */
  beep: (go = false) => tone(go ? 1320 : 660, 0, go ? 0.3 : 0.12, "sine", 0.3),
  /** Time's up and the answer is revealed. */
  reveal: () => {
    noise(0, 0.35, 0.15, 2500);
    tone(300, 0, 0.35, "sawtooth", 0.08, 900);
  },
  /** Your team got it right: a bright rising ding. */
  correct: () => {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, "triangle", 0.25));
  },
  /** Your team missed: a low falling buzz. */
  wrong: () => {
    tone(220, 0, 0.35, "sawtooth", 0.12, 140);
    tone(233, 0.02, 0.35, "sawtooth", 0.08, 147);
  },
  /** The top 3 slide in. */
  standings: () => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.2, "sine", 0.22));
  },
  /** Drumroll before 1st place (about 2.4 seconds). */
  drumroll: (seconds = 2.4) => {
    const hits = Math.floor(seconds / 0.05);
    for (let i = 0; i < hits; i++) noise(i * 0.05, 0.06, 0.06 + (i / hits) * 0.14, 350);
    noise(seconds, 0.4, 0.3, 200);
  },
  /** The winner fanfare. */
  fanfare: () => {
    const notes: [number, number, number][] = [
      [523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1047, 0.45, 0.5],
      [784, 0.95, 0.12], [1047, 1.07, 0.7],
    ];
    notes.forEach(([f, at, d]) => {
      tone(f, at, d, "square", 0.12);
      tone(f / 2, at, d, "triangle", 0.15);
    });
  },
  /** A gentler end for everyone who didn't win. */
  gameOver: () => {
    [659, 523, 587, 784].forEach((f, i) => tone(f, i * 0.16, 0.3, "triangle", 0.2));
  },
};
