import { describe, it, expect } from 'vitest';
import { asArray, isRecord } from './guards';

describe('asArray', () => {
  it('returns the array unchanged when given an array', () => {
    const input = [{ a: 1 }];
    expect(asArray(input)).toBe(input);
  });

  it('returns an empty array for a prose string', () => {
    expect(asArray('Not available in source data.')).toEqual([]);
  });

  it('returns an empty array for undefined, null, and objects', () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
    expect(asArray({ length: 3 })).toEqual([]);
  });
});

describe('isRecord', () => {
  it('is true for plain objects and false for arrays, strings, null', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord('Not available.')).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});
