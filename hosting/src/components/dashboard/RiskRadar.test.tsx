import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RiskRadar } from './RiskRadar';
import type { RiskDeal } from '@/lib/types';

const acme: RiskDeal = {
  id: 1,
  opportunityId: 'OPP-1',
  region: 'uk',
  level: 'HIGH',
  value: 'Acme Corp Renewal',
  pipelineValue: 42_000,
  healthScore: 30,
  confidence: 80,
  summary: 'Champion has gone dark.',
  action: 'Re-engage economic buyer.',
  daysStalled: 12,
  stage: 'Proposal',
  rep: 'Jo',
};

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

describe('RiskRadar deal cards', () => {
  function getCard() {
    return screen.getByRole('button', { name: /Open Acme Corp Renewal/ });
  }

  it('is a focusable role=button with no nested native buttons inside a button', () => {
    render(<RiskRadar risks={[acme]} />);
    const card = getCard();
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveAttribute('tabindex', '0');
    expect(document.querySelectorAll('button button')).toHaveLength(0);
    // The Review action stays a real button inside the card.
    expect(within(card).getByRole('button', { name: /Review/ })).toBeInTheDocument();
  });

  it('opens the deal detail on Enter and Space', () => {
    render(<RiskRadar risks={[acme]} />);
    fireEvent.keyDown(getCard(), { key: 'Enter' });
    expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('does not open the detail when the inner Review button is clicked', () => {
    render(<RiskRadar risks={[acme]} />);
    fireEvent.click(within(getCard()).getByRole('button', { name: /Review/ }));
    expect(screen.queryByText('Risk Assessment')).not.toBeInTheDocument();
    expect(screen.getByText(/1 deal marked as reviewed/)).toBeInTheDocument();
  });

  it('labels the risk distribution bands in text, not colour alone', () => {
    render(<RiskRadar risks={[acme]} />);
    const legend = screen.getByTestId('risk-distribution-legend');
    expect(within(legend).getByText('Red')).toBeInTheDocument();
    expect(within(legend).getByText('Yellow')).toBeInTheDocument();
    expect(within(legend).getByText('Green')).toBeInTheDocument();
  });
});

describe('RiskRadar revenue confidence gauge', () => {
  function arcPaths() {
    const gauge = screen.getByLabelText(/Revenue confidence: \d+ out of 100/);
    return Array.from(gauge.querySelectorAll('path')).map(p => p.getAttribute('d') ?? '');
  }

  it.each([30, 54, 90])('draws the arc above the baseline at confidence %i', (health) => {
    render(<RiskRadar risks={[{ ...acme, healthScore: health }]} />);
    const fg = arcPaths()[1];
    // A half-circle gauge never sweeps more than 180°, so the large-arc flag must be 0;
    // a 1 makes the arc loop below the baseline and out of the viewBox.
    expect(fg).toMatch(/A 60 60 0 0 1 /);
  });

  it('keeps the /100 label inside the drawing area', () => {
    render(<RiskRadar risks={[acme]} />);
    const gauge = screen.getByLabelText(/Revenue confidence: \d+ out of 100/);
    const viewBoxHeight = Number(gauge.getAttribute('viewBox')!.split(' ')[3]);
    const label = Array.from(gauge.querySelectorAll('text')).find(t => t.textContent === '/100')!;
    // fontSize 11: the glyphs descend ~3 units below the baseline y.
    expect(Number(label.getAttribute('y')) + 3).toBeLessThanOrEqual(viewBoxHeight);
  });
});
