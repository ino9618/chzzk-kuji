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

let activeSpeech: HTMLAudioElement | undefined;

export function playRouletteSpinSound(durationMs = 3500) {
  try {
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.13;
    master.connect(context.destination);

    const drive = context.createOscillator();
    const driveFilter = context.createBiquadFilter();
    const driveGain = context.createGain();
    drive.type = 'sawtooth';
    drive.frequency.setValueAtTime(105, context.currentTime);
    drive.frequency.exponentialRampToValueAtTime(58, context.currentTime + durationMs / 1000);
    driveFilter.type = 'lowpass';
    driveFilter.frequency.value = 420;
    driveGain.gain.setValueAtTime(0.0001, context.currentTime);
    driveGain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.18);
    driveGain.gain.setValueAtTime(0.045, context.currentTime + durationMs / 1000 - 0.7);
    driveGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
    drive.connect(driveFilter).connect(driveGain).connect(master);
    drive.start();
    drive.stop(context.currentTime + durationMs / 1000);

    let elapsed = 0;
    let tick = 0;
    while (elapsed < durationMs / 1000) {
      const progress = elapsed / (durationMs / 1000);
      const oscillator = context.createOscillator();
      const tickGain = context.createGain();
      oscillator.type = tick % 2 ? 'square' : 'triangle';
      oscillator.frequency.value = 430 + (tick % 4) * 85;
      tickGain.gain.setValueAtTime(0.0001, context.currentTime + elapsed);
      tickGain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + elapsed + 0.005);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + elapsed + 0.04);
      oscillator.connect(tickGain).connect(master);
      oscillator.start(context.currentTime + elapsed);
      oscillator.stop(context.currentTime + elapsed + 0.05);
      elapsed += 0.048 + Math.pow(progress, 4) * 0.3;
      tick += 1;
    }
    window.setTimeout(() => void context.close(), durationMs + 400);
  } catch { /* Browser source audio may be disabled. */ }
}

export function playRouletteStopSound() {
  try {
    const context = new AudioContext();
    const master = context.createGain();
    master.connect(context.destination);
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.24, context.currentTime + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.05);

    const impact = context.createOscillator();
    const impactGain = context.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(170, context.currentTime);
    impact.frequency.exponentialRampToValueAtTime(58, context.currentTime + 0.28);
    impactGain.gain.setValueAtTime(0.25, context.currentTime);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
    impact.connect(impactGain).connect(master);
    impact.start();
    impact.stop(context.currentTime + 0.3);

    [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      noteGain.gain.setValueAtTime(0.0001, context.currentTime + 0.08 + index * 0.09);
      noteGain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.1 + index * 0.09);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.62 + index * 0.09);
      oscillator.connect(noteGain).connect(master);
      oscillator.start(context.currentTime + 0.08 + index * 0.09);
      oscillator.stop(context.currentTime + 0.7 + index * 0.09);
    });
    window.setTimeout(() => void context.close(), 1300);
  } catch { /* Browser source audio may be disabled. */ }
}

export function playGoogleTtsAudio(audioDataUrl: string) {
  activeSpeech?.pause();
  const audio = new Audio(audioDataUrl);
  activeSpeech = audio;
  audio.preload = 'auto';
  audio.volume = 1;
  audio.addEventListener('ended', () => { if (activeSpeech === audio) activeSpeech = undefined; }, { once: true });
  void audio.play().catch(() => { if (activeSpeech === audio) activeSpeech = undefined; });
}
