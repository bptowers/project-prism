import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsRow } from './StatsRow';
import type { Stats } from '@/lib/types';

const stat = (value: string, sub = '') => ({ value, change: '—', dir: 'flat' as const, sub });

const stats: Stats = {
  pipeline: stat('$1.2M', 'Active pipeline value'),
  avgHealthScore: stat('58', 'avg deal health score'),
  atRisk: stat('12', '12 deals flagged'),
  dealsAtRisk: stat('40%', 'HIGH or MEDIUM risk'),
  forecast: stat('0%', 'Weighted forecast confidence'),
  velocity: stat('9d', 'avg days since last activity'),
};

describe('StatsRow', () => {
  it('labels the count card as deals and the percentage card as pipeline share', () => {
    render(<StatsRow stats={stats} sparklines={{}} />);
    expect(screen.getByText('Deals at Risk')).toBeInTheDocument();
    expect(screen.getByText('% Pipeline at Risk')).toBeInTheDocument();
    expect(screen.queryByText('Revenue at Risk')).not.toBeInTheDocument();
  });

  it('renders a 0% forecast as n/a with an explanation instead of a real reading', () => {
    render(<StatsRow stats={stats} sparklines={{}} />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('no closed deals in source')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders a real forecast value untouched', () => {
    render(<StatsRow stats={{ ...stats, forecast: stat('72%', 'Weighted forecast confidence') }} sparklines={{}} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.queryByText('n/a')).not.toBeInTheDocument();
  });
});
