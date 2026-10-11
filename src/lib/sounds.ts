// Short two-note success chime, synthesised with the Web Audio API (no audio file needed).
// Must be called from a user action (e.g. a submit click) so the browser allows audio.
export function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 784, start: 0 },     // G5
      { freq: 1047, start: 0.14 }, // C6
    ];
    notes.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    // Audio is a nice-to-have; never let it break submission
  }
}
