import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskRadar } from './RiskRadar';

describe('RiskRadar deal-load failure', () => {
  it('tells the reader deals could not be loaded instead of claiming no risks exist', () => {
    render(<RiskRadar risks={[]} dealsError="Missing or insufficient permissions." />);
    expect(screen.getByText(/Could not load deals: Missing or insufficient permissions\./)).toBeInTheDocument();
    expect(screen.queryByText(/No active risks detected/)).not.toBeInTheDocument();
  });

  it('keeps the no-risks message when the deal fetch succeeded with nothing', () => {
    render(<RiskRadar risks={[]} />);
    expect(screen.getByText(/No active risks detected/)).toBeInTheDocument();
  });
});
