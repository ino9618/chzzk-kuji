function playFanfare() {
  const context = new AudioContext();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.95);
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 3 ? 'triangle' : 'square';
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.12);
    oscillator.stop(context.currentTime + 0.55 + index * 0.12);
  });
  window.setTimeout(() => void context.close(), 1200);
}

export function playWinnerFanfare() {
  try { playFanfare(); } catch { /* Browser source audio may be disabled. */ }
}

export function playRouletteSpinSound(durationMs = 3300) {
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0.11;
    gain.connect(context.destination);
    let elapsed = 0;
    let tick = 0;
    while (elapsed < durationMs / 1000) {
      const progress = elapsed / (durationMs / 1000);
      const oscillator = context.createOscillator();
      const tickGain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 520 + (tick % 3) * 70;
      tickGain.gain.setValueAtTime(0.0001, context.currentTime + elapsed);
      tickGain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + elapsed + 0.006);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + elapsed + 0.045);
      oscillator.connect(tickGain).connect(gain);
      oscillator.start(context.currentTime + elapsed);
      oscillator.stop(context.currentTime + elapsed + 0.05);
      elapsed += 0.055 + Math.pow(progress, 3) * 0.18;
      tick += 1;
    }
    window.setTimeout(() => void context.close(), durationMs + 400);
  } catch { /* Browser source audio may be disabled. */ }
}

export function playRouletteStopSound() {
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    [659.25, 987.77].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.1);
      oscillator.stop(context.currentTime + 0.55);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch { /* Browser source audio may be disabled. */ }
}

export function playGoogleTtsAudio(audioDataUrl: string) {
  const audio = new Audio(audioDataUrl);
  audio.volume = 1;
  void audio.play().catch(() => { /* OBS/browser source audio may be muted. */ });
}
