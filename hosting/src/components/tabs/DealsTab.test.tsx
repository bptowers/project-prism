import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { dealKey } from '@/lib/reviews';
import { DealsTab } from './DealsTab';

const a = makeDeal({ value: 'A', rep: 'Jo', level: 'HIGH', healthScore: 20, stage: 'Commit' });
const b = makeDeal({ value: 'B', rep: 'Sam', level: 'LOW', healthScore: 85, stage: 'Discovery' });

function setup(props: Partial<React.ComponentProps<typeof DealsTab>> = {}, initialReviews = {}) {
  const onFiltersChange = vi.fn();
  render(
    <MemoryReviewsProvider initial={initialReviews}>
      <DealsTab deals={[a, b]} region="uk" filters={{}} onFiltersChange={onFiltersChange} {...props} />
    </MemoryReviewsProvider>,
  );
  return { onFiltersChange };
}

describe('DealsTab', () => {
  it('lists deals riskiest first', () => {
    setup();
    const cards = screen.getAllByRole('button', { name: /^Open / });
    expect(cards.map(c => c.getAttribute('aria-label'))).toEqual(['Open A', 'Open B']);
  });

  it('applies filters from the view and shows a rep summary', () => {
    setup({ filters: { rep: 'Sam' } });
    expect(screen.getByRole('button', { name: 'Open B' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open A' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Summary for Sam' })).toHaveTextContent('Confidence 85/100');
  });

  it('reports filter changes and removable chips', () => {
    const { onFiltersChange } = setup({ filters: { riskOnly: true } });
    fireEvent.change(screen.getByLabelText('Rep'), { target: { value: 'Sam' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ rep: 'Sam' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: At risk only' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ riskOnly: undefined });
  });

  it('uses a native select for the rep filter', () => {
    setup();
    expect(screen.getByLabelText('Rep').tagName).toBe('SELECT');
  });

  it('can hide deals the team has already reviewed', () => {
    setup({ filters: { hideReviewed: true } }, {
      [dealKey(a)]: { reviewedBy: 'x@simprogroup.com', reviewedByName: 'X', reviewedAt: null, riskAtReview: 80 },
    });
    expect(screen.queryByRole('button', { name: 'Open A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open B' })).toBeInTheDocument();
    // Export follows the list on screen, not the reviewed deals it hides.
    expect(screen.getByRole('button', { name: 'Export CSV (1)' })).toBeInTheDocument();
  });

  it('says when nothing matches, and when deals failed to load', () => {
    setup({ filters: { stage: 'Negotiation' }, dealsError: 'Missing or insufficient permissions.' });
    expect(screen.getByText('No deals match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load deals: Missing or insufficient permissions. Showing the capped list embedded in the report.',
    );
  });

  it('opens the deal detail from a card', () => {
    setup();
    expect(screen.queryByText('Risk Signals')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open A' }));
    expect(screen.getByText('Risk Signals')).toBeInTheDocument();
  });
});
