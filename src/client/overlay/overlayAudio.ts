import type { OverlayAnnouncement } from './DrawAnnouncement';

export function buildWinnerSpeech(announcement: Omit<OverlayAnnouncement, 'key'>): string {
  const winner = announcement.nickname?.trim() || '익명 후원자';
  const grade = announcement.grade?.trim() ? `${announcement.grade.trim()}상 ` : '';
  const prize = announcement.prizeName?.trim() || '상품';
  return `${winner}님, 축하합니다. ${announcement.number}번, ${grade}${prize}에 당첨되었습니다.`;
}

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

export function playWinnerAudio(announcement: Omit<OverlayAnnouncement, 'key'>) {
  try { playFanfare(); } catch { /* Browser source audio may be disabled. */ }
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  window.setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(buildWinnerSpeech(announcement));
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('ko'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, 650);
}
