export interface WinnerSpeechInput {
  nickname: string | null;
  number: number;
  grade?: string | null;
  prizeName?: string | null;
}

export interface RouletteSpeechInput {
  nickname: string | null;
  label: string;
}

export function buildWinnerSpeech(input: WinnerSpeechInput): string {
  const winner = input.nickname?.trim() || '익명 후원자';
  const grade = input.grade?.trim() ? `${input.grade.trim()}상 ` : '';
  const prize = input.prizeName?.trim() || '상품';
  return `${winner}님, 축하합니다. ${input.number}번, ${grade}${prize}에 당첨되었습니다.`;
}

export function buildRouletteSpeech(input: RouletteSpeechInput): string {
  const winner = input.nickname?.trim() || '익명 후원자';
  const result = input.label.trim() || '당첨';
  return `${winner}님의 룰렛 결과는 ${result}입니다. 축하합니다.`;
}

export async function synthesizeGoogleTts(text: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!apiKey) throw new Error('google_tts_not_configured');
  const response = await fetcher(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: text.slice(0, 300) },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1, pitch: 1 },
    }),
  });
  if (!response.ok) throw new Error(`google_tts_failed_${response.status}`);
  const payload = await response.json() as { audioContent?: string };
  if (!payload.audioContent) throw new Error('google_tts_empty_audio');
  return `data:audio/mpeg;base64,${payload.audioContent}`;
}
