import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): JSX.Element {
  throw new Error('widget exploded');
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary section="Test"><span>all good</span></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders a named fallback instead of unmounting the tree when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <div>
        <span>sibling survives</span>
        <ErrorBoundary section="Competitive Displacement"><Bomb /></ErrorBoundary>
      </div>
    );
    expect(screen.getByText('sibling survives')).toBeInTheDocument();
    expect(screen.getByText(/Competitive Displacement/)).toBeInTheDocument();
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
