import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineFunnel } from './PipelineFunnel';

const stages = [
  { stage: 'Discovery', count: 10, revenue: '$100K', color: 'var(--prism-blue)' },
  { stage: 'Proposal', count: 4, revenue: '$40K', color: 'var(--prism-green)' },
];

describe('PipelineFunnel', () => {
  it('does not show a hardcoded average cycle time or its own title (the InsightPanel has one)', () => {
    render(<PipelineFunnel stages={stages} />);
    expect(screen.queryByText(/Avg\. cycle/)).not.toBeInTheDocument();
    expect(screen.queryByText('Pipeline Stage Progression')).not.toBeInTheDocument();
  });

  it('renders nothing and does not throw when there are no stages (the takeaway says so)', () => {
    const { container } = render(<PipelineFunnel stages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders stage counts when present', () => {
    render(<PipelineFunnel stages={stages} />);
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('sizes the track to its stages rather than a fixed 900px', () => {
    render(<PipelineFunnel stages={stages} />);
    expect(screen.getByTestId('funnel-track')).toHaveStyle({ minWidth: '220px' });
  });
});
