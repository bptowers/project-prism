import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from './ReviewsContext';
import { ReviewButton } from './ReviewButton';

describe('ReviewButton', () => {
  it('toggles a shared review and shows who reviewed it', () => {
    const deal = makeDeal({ value: 'Acme' });
    render(<MemoryReviewsProvider><ReviewButton deal={deal} /></MemoryReviewsProvider>);
    const button = screen.getByRole('button', { name: 'Mark reviewed: Acme' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Reviewed: Acme' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('flags a deal that got worse since it was reviewed', () => {
    const deal = makeDeal({ opportunityId: 'X', value: 'Acme', healthScore: 20 }); // risk 80
    render(
      <MemoryReviewsProvider initial={{ X: { reviewedBy: 'a@simprogroup.com', reviewedByName: 'Ann', reviewedAt: null, riskAtReview: 50 } }}>
        <ReviewButton deal={deal} />
      </MemoryReviewsProvider>,
    );
    expect(screen.getByText('Worse since review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review again: Acme' })).toBeInTheDocument();
  });

  it('does not let the click bubble to a clickable card', () => {
    const onCard = vi.fn();
    render(
      <MemoryReviewsProvider>
        <div onClick={onCard}><ReviewButton deal={makeDeal({ value: 'Acme' })} /></div>
      </MemoryReviewsProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onCard).not.toHaveBeenCalled();
  });

  it('keeps Enter and Space inside the button but lets Escape reach document handlers', () => {
    const onDocKey = vi.fn();
    document.addEventListener('keydown', onDocKey);
    try {
      render(<MemoryReviewsProvider><ReviewButton deal={makeDeal({ value: 'Acme' })} /></MemoryReviewsProvider>);
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: ' ' });
      expect(onDocKey).not.toHaveBeenCalled();
      fireEvent.keyDown(button, { key: 'Escape' });
      expect(onDocKey).toHaveBeenCalledTimes(1);
      expect(onDocKey.mock.calls[0][0].key).toBe('Escape');
    } finally {
      document.removeEventListener('keydown', onDocKey);
    }
  });
});
