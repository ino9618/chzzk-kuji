import { describe, it, expect } from 'vitest';
import { maskNickname } from '../../src/server/maskNickname';

describe('maskNickname', () => {
  it('masks the only character of a 1-character nickname', () => {
    expect(maskNickname('김')).toBe('*');
  });

  it('masks the last character of a 2-character nickname', () => {
    expect(maskNickname('김민')).toBe('김*');
  });

  it('masks the middle character of a 3-character nickname', () => {
    expect(maskNickname('홍길동')).toBe('홍*동');
  });

  it('masks a middle character of a 4-character nickname', () => {
    expect(maskNickname('김철수영')).toBe('김철*영');
  });

  it('returns an empty string unchanged', () => {
    expect(maskNickname('')).toBe('');
  });
});
