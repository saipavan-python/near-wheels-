let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

/** Call once on the first user gesture so the browser allows audio later. */
export function primeTone() {
  try {
    getCtx();
  } catch {
    /* audio unavailable — stay silent */
  }
}

function blip(freq: number, at: number, dur: number, vol = 0.14) {
  const c = ctx;
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** New-notification chime: two soft ascending notes. */
export function playDing() {
  if (!getCtx()) return;
  blip(587.33, 0, 0.16);
  blip(659.25, 0.14, 0.24, 0.13);
}

/** Gentle repeat reminder while unread notifications remain. */
export function playNudge() {
  if (!getCtx()) return;
  blip(392, 0, 0.2, 0.06);
}