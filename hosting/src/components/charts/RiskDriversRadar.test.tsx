import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskDriversRadar, radarSummary } from './RiskDriversRadar';

describe('RiskDriversRadar', () => {
  it('draws a radar whose text alternative carries the data, largest first', () => {
    render(<RiskDriversRadar dimensions={[{ label: 'Process', value: 10, pipeline: 0 }, { label: 'Engagement', value: 100, pipeline: 0 }, { label: 'Competition', value: 0, pipeline: 0 }, { label: 'Velocity', value: 40, pipeline: 0 }]} valueTotal={0} />);
    expect(screen.getByRole('img', { name: 'Top risk drivers: Engagement 100, Velocity 40, Process 10' })).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
  });

  it('says so when nothing is driving risk', () => {
    render(<RiskDriversRadar dimensions={[{ label: 'Process', value: 0, pipeline: 0 }]} valueTotal={0} />);
    expect(screen.getByText('No risk drivers in this view.')).toBeInTheDocument();
  });

  it('summarises an all-zero radar as none', () => {
    expect(radarSummary([{ label: 'Process', value: 0, pipeline: 0 }])).toBe('Top risk drivers: none in this view');
  });
});
