import { afterEach, describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { mockResizeObserver } from '@/test/resizeObserver';
import { useElementWidth } from './useElementWidth';

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref, 760);
  return <div ref={ref}>width {width}</div>;
}

afterEach(() => vi.unstubAllGlobals());

describe('useElementWidth', () => {
  it('falls back to the given width when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Probe />);
    expect(screen.getByText('width 760')).toBeInTheDocument();
  });

  it('reports the measured width', () => {
    mockResizeObserver(360);
    render(<Probe />);
    expect(screen.getByText('width 360')).toBeInTheDocument();
  });
});
