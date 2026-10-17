import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatValue, normalizeStage, isLateStage, parseMoney } from './format';

describe('formatValue', () => {
  it('formats a positive total as currency', () => {
    expect(formatValue(40_000, 2)).toBe('$40K');
  });

  it('shows a dash, not $0, when deals exist but none carries a value', () => {
    expect(formatValue(0, 3)).toBe('—');
  });

  it('shows $0 only when there are genuinely no deals', () => {
    expect(formatValue(0, 0)).toBe('$0');
  });
});

describe('formatCurrency', () => {
  it('renders $0 for zero, negatives and NaN', () => {
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(-500)).toBe('$0');
    expect(formatCurrency(Number.NaN)).toBe('$0');
  });

  it('renders whole dollars under a thousand', () => {
    expect(formatCurrency(842.4)).toBe('$842');
  });

  it('renders thousands as rounded K', () => {
    expect(formatCurrency(12_400)).toBe('$12K');
    expect(formatCurrency(12_600)).toBe('$13K');
  });

  it('renders millions with one decimal', () => {
    expect(formatCurrency(1_250_000)).toBe('$1.3M');
    expect(formatCurrency(1_000_000)).toBe('$1.0M');
  });
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string as a calendar date without timezone shift', () => {
    expect(formatDate('2026-06-09')).toBe('9 Jun 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('formats a full ISO timestamp', () => {
    // 10:00Z lands on the same calendar day in every timezone from UTC-10 to UTC+13.
    expect(formatDate('2026-06-09T10:00:00.000Z')).toBe('9 Jun 2026');
  });

  it('returns unparseable input unchanged so model-authored text survives', () => {
    expect(formatDate('End of week')).toBe('End of week');
    expect(formatDate('March 15')).toBe('March 15');
    expect(formatDate('2026-13-45')).toBe('2026-13-45');
  });

  it('returns an empty string for empty or missing input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('normalizeStage', () => {
  it('maps Salesforce stage names onto the canonical funnel', () => {
    expect(normalizeStage('Awaiting Signature')).toBe('Commit');
    expect(normalizeStage('Contract Sent')).toBe('Contract Review');
    expect(normalizeStage('Proposal Draft')).toBe('Proposal');
    expect(normalizeStage('Approved by Finance')).toBe('Approved');
    expect(normalizeStage('discovery call')).toBe('Discovery');
  });

  it('passes unknown stages through and labels missing ones Unknown', () => {
    expect(normalizeStage('Something Custom')).toBe('Something Custom');
    expect(normalizeStage(undefined)).toBe('Unknown');
  });

  it('trims stray whitespace so unknown stages round-trip through the URL hash', () => {
    expect(normalizeStage('  Something Custom ')).toBe('Something Custom');
    expect(normalizeStage('   ')).toBe('Unknown');
  });
});

describe('isLateStage', () => {
  it('treats Proposal onwards as late stage', () => {
    expect(isLateStage('Proposal')).toBe(true);
    expect(isLateStage('Negotiation')).toBe(true);
    expect(isLateStage('Awaiting Signature')).toBe(true);
    expect(isLateStage('Discovery')).toBe(false);
    expect(isLateStage(undefined)).toBe(false);
  });
});

describe('parseMoney', () => {
  it.each([
    ['$12,400', 12_400],
    ['$1.2M', 1_200_000],
    ['$40K', 40_000],
    ['£3.5k MRR', 3_500],
    ['$12,000 MRR', 12_000],
    ['n/a', 0],
    ['', 0],
  ])('parses %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it('passes finite numbers through and treats undefined as 0', () => {
    expect(parseMoney(250)).toBe(250);
    expect(parseMoney(undefined)).toBe(0);
  });
});
