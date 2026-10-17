import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceGauge } from './ConfidenceGauge';

function arcPaths() {
  const gauge = screen.getByLabelText(/Revenue confidence: \d+ out of 100/);
  return Array.from(gauge.querySelectorAll('path')).map(p => p.getAttribute('d') ?? '');
}

describe('ConfidenceGauge', () => {
  it.each([30, 54, 90])('draws the arc above the baseline at confidence %i', (value) => {
    render(<ConfidenceGauge value={value} />);
    // A half-circle gauge never sweeps more than 180°, so the large-arc flag must be 0.
    expect(arcPaths()[1]).toMatch(/A 60 60 0 0 1 /);
  });

  it('keeps the /100 label inside the drawing area', () => {
    render(<ConfidenceGauge value={60} />);
    const gauge = screen.getByLabelText(/Revenue confidence: 60 out of 100/);
    const viewBoxHeight = Number(gauge.getAttribute('viewBox')!.split(' ')[3]);
    const label = Array.from(gauge.querySelectorAll('text')).find(t => t.textContent === '/100')!;
    expect(Number(label.getAttribute('y')) + 3).toBeLessThanOrEqual(viewBoxHeight);
  });

  it('says it is computed in code, not by the AI', () => {
    render(<ConfidenceGauge value={60} />);
    expect(screen.getByText(/not by the AI/)).toBeInTheDocument();
  });
});
