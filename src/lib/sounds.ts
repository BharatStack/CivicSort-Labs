// "Payment successful"-style success sound, synthesised with the Web Audio API (no audio file needed).
// A quick rising arpeggio followed by a bright, ringing "ding" with a soft shimmer.
// Must be called from a user action (e.g. a submit click) so the browser allows audio.
export function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const tone = (freq: number, start: number, length: number, peak: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + length);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + length + 0.05);
    };

    // Rising arpeggio: C6 → E6 → G6
    tone(1047, 0.0, 0.18, 0.18, 'triangle');
    tone(1319, 0.07, 0.18, 0.18, 'triangle');
    tone(1568, 0.14, 0.2, 0.18, 'triangle');
    // Ringing "ding" on C7 with an octave-up shimmer and a soft body note
    tone(2093, 0.22, 1.1, 0.28);
    tone(4186, 0.22, 0.5, 0.05);
    tone(1047, 0.22, 0.9, 0.1);

    setTimeout(() => ctx.close().catch(() => {}), 1800);
  } catch {
    // Audio is a nice-to-have; never let it break submission
  }
}
