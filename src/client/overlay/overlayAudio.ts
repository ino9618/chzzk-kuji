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

export function playGoogleTtsAudio(audioDataUrl: string) {
  const audio = new Audio(audioDataUrl);
  audio.volume = 1;
  void audio.play().catch(() => { /* OBS/browser source audio may be muted. */ });
}
