import { describe, it, expect } from 'vitest';
import { extractNumbers } from '../../src/server/donationParser';

describe('extractNumbers', () => {
  it('extracts a single number with a trailing 번', () => {
    expect(extractNumbers('3번')).toEqual([3]);
  });

  it('extracts multiple numbers separated by 번 and spaces', () => {
    expect(extractNumbers('3번 7번')).toEqual([3, 7]);
  });

  it('extracts multiple numbers separated by commas', () => {
    expect(extractNumbers('3, 7')).toEqual([3, 7]);
  });

  it('strips leading zeros via normal integer parsing', () => {
    expect(extractNumbers('07번')).toEqual([7]);
  });

  it('returns an empty array when there are no digits', () => {
    expect(extractNumbers('번호없음ㅋㅋ')).toEqual([]);
  });

  it('ignores non-digit characters mixed with numbers', () => {
    expect(extractNumbers('12번 축하해요!! 😀')).toEqual([12]);
  });

  it('returns an empty array for an empty string', () => {
    expect(extractNumbers('')).toEqual([]);
  });
});
