import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import type { Recommendation } from '@/lib/types';
import { CroBriefTab } from './CroBriefTab';

const recs: Recommendation[] = [{ priority: 'P1', title: 'Call Acme', desc: 'Champion went dark', impact: '$40K' }];

describe('CroBriefTab', () => {
  it('warns when the full deal list failed to load', () => {
    render(<CroBriefTab recommendations={recs} region="all" deals={[makeDeal()]} dealsError="Missing or insufficient permissions." isLive />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load deals: Missing or insufficient permissions. Showing the capped list embedded in the report.');
  });

  it('closes any open action when the region changes', () => {
    const { rerender } = render(<CroBriefTab recommendations={recs} region="uk" deals={[]} isLive />);
    fireEvent.click(screen.getByRole('button', { name: /Call Acme/ }));
    expect(screen.getByText('Champion went dark')).toBeInTheDocument();
    rerender(<CroBriefTab recommendations={recs} region="na" deals={[]} isLive />);
    expect(screen.queryByText('Champion went dark')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Call Acme/ })).toHaveAttribute('aria-expanded', 'false');
  });
});
