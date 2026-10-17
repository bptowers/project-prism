import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { DealCard } from './DealCard';

const acme = makeDeal({ value: 'Acme Corp Renewal', healthScore: 30, level: 'HIGH', summary: 'Champion has gone dark.', pipelineValue: 0 });

function setup() {
  const onOpen = vi.fn();
  render(<MemoryReviewsProvider><DealCard deal={acme} onOpen={onOpen} /></MemoryReviewsProvider>);
  return {
    onOpen,
    card: screen.getByRole('article', { name: 'Acme Corp Renewal' }),
    open: screen.getByRole('button', { name: 'Open Acme Corp Renewal' }),
  };
}

describe('DealCard', () => {
  it('is a named, non-interactive card whose open and review buttons are siblings', () => {
    const { card, open } = setup();
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('tabindex');
    expect(open.tagName).toBe('BUTTON');
    const review = within(card).getByRole('button', { name: 'Mark reviewed: Acme Corp Renewal' });
    expect(open).not.toContainElement(review);
    // No interactive element wraps another button: some screen readers skip the inner one.
    expect(card.querySelectorAll('button button, [role="button"] button, button [role="button"]')).toHaveLength(0);
    expect(within(card).getAllByRole('button')).toHaveLength(2);
  });

  it('opens from the deal name, once', () => {
    const { open, onOpen } = setup();
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(acme);
  });

  it('opens on a click anywhere on the card for mouse users', () => {
    const { onOpen } = setup();
    fireEvent.click(screen.getByText('Champion has gone dark.'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('reviewing does not open the deal', () => {
    const { card, onOpen } = setup();
    fireEvent.click(within(card).getByRole('button', { name: 'Mark reviewed: Acme Corp Renewal' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(within(card).getByRole('button', { name: 'Reviewed: Acme Corp Renewal' })).toBeInTheDocument();
  });

  it('labels the risk band in text, in the same words as the filters', () => {
    setup();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows a dash, not $0, when the deal has no recorded value', () => {
    setup();
    expect(screen.getByText(/^— · 0d since activity$/)).toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });
});
