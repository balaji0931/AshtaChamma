// ============================================================================
// Sound Engine — Pro Level (Natural + Hybrid)
// Asta Chamma — Warm, wooden, organic feel
// ============================================================================

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ============================================================================
// 🔊 OPTIONAL REAL AUDIO (BEST FOR DICE)
// Place file in: /public/sounds/roll.mp3
// ============================================================================

const rollSample = new Audio("/sounds/roll.mp3");

function playRealRoll() {
  rollSample.currentTime = 0;
  rollSample.playbackRate = 0.9 + Math.random() * 0.2;
  rollSample.volume = 0.6 + Math.random() * 0.2;
  rollSample.play().catch(() => { });
}

// ============================================================================
// 🎛️ CORE BUILDING BLOCKS (IMPROVED)
// ============================================================================

// Soft filtered noise (like seed/wood texture)
function softNoise(ctx: AudioContext, duration: number, volume: number, time: number) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3; // reduced harshness
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1500 + Math.random() * 1000, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  src.start(time);
}

// Warm wooden tap (core sound)
function woodTap(ctx: AudioContext, time: number, volume = 0.05) {
  const osc = ctx.createOscillator();
  osc.type = "triangle"; // warmer than sine
  osc.frequency.setValueAtTime(250 + Math.random() * 80, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + 0.08);
}

// ============================================================================
// 🎲 DICE ROLL — HYBRID (REAL + GENERATED)
// ============================================================================

export function playRollSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // 👉 Use real sound if available
  if (rollSample.src.includes("roll.mp3")) {
    playRealRoll();
  }

  // 👉 Add subtle synthetic layer (for realism)
  for (let i = 0; i < 4; i++) {
    const t = now + i * 0.05 + Math.random() * 0.02;
    softNoise(ctx, 0.03, 0.04 * (1 - i / 5), t);
  }

  // final settling tap
  woodTap(ctx, now + 0.35, 0.04);
}

// ============================================================================
// 🪵 MOVE — SOFT WOOD TAP
// ============================================================================

export function playMoveSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  woodTap(ctx, now, 0.05);
}

// ============================================================================
// 🌱 ENTRY — LIGHT DOUBLE TAP
// ============================================================================

export function playEntrySound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  woodTap(ctx, now, 0.05);
  woodTap(ctx, now + 0.06, 0.04);
}

// ============================================================================
// ⚔️ KILL — CONTROLLED IMPACT (NOT HARSH)
// ============================================================================

export function playKillSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);

  // soft second hit
  woodTap(ctx, now + 0.05, 0.05);
}

// ============================================================================
// 🏠 HOME — PLEASANT ASCENDING
// ============================================================================

export function playHomeSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  [500, 700, 900].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, now + i * 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.3);
  });
}

// ============================================================================
// 🏆 WIN — WARM CELEBRATION (NOT ARCADE)
// ============================================================================

export function playWinSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  [400, 600, 800, 1000].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, now + i * 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.4);
  });
}