import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealsLoadError } from './DealsLoadError';

describe('DealsLoadError', () => {
  it('says the capped list is showing when some deals loaded', () => {
    render(<DealsLoadError error="Missing or insufficient permissions." hasDeals />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load deals: Missing or insufficient permissions. Showing the capped list embedded in the report.',
    );
  });

  it('drops the capped-list sentence when no deals loaded', () => {
    render(<DealsLoadError error="Timed out" hasDeals={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Could not load deals: Timed out\.$/);
  });

  it('renders nothing without an error', () => {
    const { container } = render(<DealsLoadError hasDeals />);
    expect(container).toBeEmptyDOMElement();
  });
});
