import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders nothing for an empty series instead of a NaN path', () => {
    const { container } = render(<Sparkline data={[]} color="#2563eb" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a path for a real series', () => {
    const { container } = render(<Sparkline data={[1, 3, 2]} color="#2563eb" />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    expect(paths[1].getAttribute('d')).not.toMatch(/NaN/);
  });

  it('renders a single point without dividing by zero', () => {
    const { container } = render(<Sparkline data={[5]} color="#2563eb" />);
    expect(container.querySelector('path')?.getAttribute('d')).not.toMatch(/NaN/);
  });
});
