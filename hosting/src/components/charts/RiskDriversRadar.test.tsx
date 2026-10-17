import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskDriversRadar } from './RiskDriversRadar';

describe('RiskDriversRadar', () => {
  it('draws a labelled radar', () => {
    render(<RiskDriversRadar dimensions={[{ label: 'Engagement', value: 100, pipeline: 0 }, { label: 'Velocity', value: 40, pipeline: 0 }, { label: 'Process', value: 10, pipeline: 0 }]} valueTotal={0} />);
    expect(screen.getByRole('img', { name: 'Top risk drivers radar chart' })).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
  });

  it('says so when nothing is driving risk', () => {
    render(<RiskDriversRadar dimensions={[{ label: 'Process', value: 0, pipeline: 0 }]} valueTotal={0} />);
    expect(screen.getByText('No risk drivers in this view.')).toBeInTheDocument();
  });
});
