import { describe, it, expect } from 'vitest';
import { normalizeRegionKey, regionLabel } from './regions';

describe('normalizeRegionKey', () => {
  it('maps North America aliases to na', () => {
    for (const raw of ['na', 'NA', 'us', 'NAMER', 'North America', ' namer ']) {
      expect(normalizeRegionKey(raw)).toBe('na');
    }
  });

  it('maps UK / EMEA aliases to uk', () => {
    for (const raw of ['uk', 'UK', 'gb', 'eu', 'EMEA', 'United Kingdom', 'Great Britain']) {
      expect(normalizeRegionKey(raw)).toBe('uk');
    }
  });

  it('maps AU / NZ / APAC aliases to au', () => {
    for (const raw of ['au', 'AUS', 'nz', 'ANZ', 'apac', 'Australia', 'New Zealand']) {
      expect(normalizeRegionKey(raw)).toBe('au');
    }
  });

  it('lowercases anything it does not recognise', () => {
    expect(normalizeRegionKey('Unknown')).toBe('unknown');
    expect(normalizeRegionKey('LATAM')).toBe('latam');
  });

  it('treats missing or blank input as unknown', () => {
    expect(normalizeRegionKey(undefined)).toBe('unknown');
    expect(normalizeRegionKey('')).toBe('unknown');
    expect(normalizeRegionKey('   ')).toBe('unknown');
  });
});

describe('regionLabel', () => {
  it('labels the three normalised keys', () => {
    expect(regionLabel('na')).toBe('North America');
    expect(regionLabel('uk')).toBe('UK');
    expect(regionLabel('au')).toBe('AU / NZ');
  });

  it('accepts raw legacy values by normalising first', () => {
    expect(regionLabel('NAMER')).toBe('North America');
    expect(regionLabel('ANZ')).toBe('AU / NZ');
  });

  it('returns the raw value for unknown regions and Unknown for missing', () => {
    expect(regionLabel('LATAM')).toBe('LATAM');
    expect(regionLabel(undefined)).toBe('Unknown');
  });

  it('does not fall through to Object.prototype for keys like "constructor"', () => {
    expect(regionLabel('constructor')).toBe('constructor');
    expect(regionLabel('toString')).toBe('toString');
  });
});
