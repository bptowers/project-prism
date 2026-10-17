import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionList } from './ActionList';

describe('ActionList', () => {
  it('says so when there are no recommendations', () => {
    render(<ActionList items={[]} />);
    expect(screen.getByText('No recommendations were generated for this run.')).toBeInTheDocument();
  });

  it('shows one line per action, P1 first, and expands the detail', () => {
    render(<ActionList items={[
      { priority: 'P2', title: 'Coach on multithreading', desc: 'Run a session.', impact: '$20K' },
      { priority: 'P1', title: 'Call Acme', desc: 'Champion went dark', impact: '$40K' },
    ]} />);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Call Acme');
    expect(screen.queryByText('Champion went dark')).not.toBeInTheDocument();
    fireEvent.click(rows[0]);
    expect(screen.getByText('Champion went dark')).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
  });
});
