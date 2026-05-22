let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.06) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durationMs / 1000);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durationMs / 1000);
}

export const sounds = {
  move: () => tone(440, 90, "triangle"),
  capture: () => {
    tone(220, 80, "sawtooth", 0.05);
    setTimeout(() => tone(160, 90, "sawtooth", 0.05), 30);
  },
  check: () => {
    tone(880, 120, "square", 0.05);
    setTimeout(() => tone(660, 140, "square", 0.05), 80);
  },
  end: () => {
    tone(523, 150, "sine");
    setTimeout(() => tone(392, 250, "sine"), 120);
  },
};
