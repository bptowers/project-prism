import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForecastIntegrity } from './ForecastIntegrity';
import type { RiskDeal } from '@/lib/types';

function deal(overrides: Partial<RiskDeal>): RiskDeal {
  return {
    id: 1,
    region: 'uk',
    level: 'MEDIUM',
    value: 'Acme',
    confidence: 50,
    summary: '',
    action: '',
    daysStalled: 0,
    ...overrides,
  };
}

describe('ForecastIntegrity', () => {
  it('shows n/a for a 0% forecast confidence', () => {
    render(<ForecastIntegrity risks={[deal({})]} forecastStat={{ value: '0%', change: '—', dir: 'flat', sub: 'weighted' }} />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('no closed deals in source')).toBeInTheDocument();
  });

  it('uses the shared misalignment definition', () => {
    const risks = [
      deal({ id: 1, value: 'Misaligned Co', confidence: 85, healthScore: 20 }),
      deal({ id: 2, value: 'High No Score', confidence: 85, level: 'HIGH' }),
    ];
    render(<ForecastIntegrity risks={risks} forecastStat={{ value: '70%', change: '—', dir: 'flat', sub: '' }} />);
    expect(screen.getByText('Misaligned Co')).toBeInTheDocument();
    expect(screen.queryByText('High No Score')).not.toBeInTheDocument();
  });
});
