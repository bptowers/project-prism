import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Recommendations } from './Recommendations';

describe('Recommendations', () => {
  it('renders an empty-state line instead of a heading over nothing', () => {
    render(<Recommendations items={[]} />);
    expect(screen.getByText('AI Recommended Actions')).toBeInTheDocument();
    expect(screen.getByText('No recommendations were generated for this run.')).toBeInTheDocument();
    expect(screen.queryByText('Prioritized by revenue impact')).not.toBeInTheDocument();
  });

  it('renders the items when present', () => {
    render(<Recommendations items={[{ priority: 'P1', title: 'Call Acme', desc: 'Champion went dark', impact: '$40K' }]} />);
    expect(screen.getByText('Call Acme')).toBeInTheDocument();
    expect(screen.queryByText(/No recommendations/)).not.toBeInTheDocument();
  });
});
