import { describe, expect, it, vi } from 'vitest';
import { buildRouletteSpeech, buildWinnerSpeech, synthesizeGoogleTts } from '../../src/server/googleTts';

describe('Google Cloud TTS', () => {
  it('builds Korean winner copy including anonymous fallback', () => {
    expect(buildWinnerSpeech({ nickname: '후원자', number: 7, grade: 'A', prizeName: '게임기' })).toBe('후원자님, 축하합니다. 7번, A상 게임기에 당첨되었습니다.');
    expect(buildWinnerSpeech({ nickname: null, number: 2 })).toContain('익명 후원자님');
    expect(buildRouletteSpeech({ nickname: '후원자', label: '노래 한 곡' })).toBe('후원자님의 룰렛 결과는 노래 한 곡입니다. 축하합니다.');
  });

  it('requests a Korean Neural2 voice with an OAuth bearer token', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ audioContent: 'SUQz' }), { status: 200 })) as unknown as typeof fetch;
    expect(await synthesizeGoogleTts('당첨', 'access-token', fetcher)).toBe('data:audio/mpeg;base64,SUQz');
    const [url, options] = (fetcher as any).mock.calls[0];
    expect(url).not.toContain('access-token');
    expect(options.headers.Authorization).toBe('Bearer access-token');
    expect(JSON.parse(options.body).voice.name).toBe('ko-KR-Neural2-A');
  });
});
