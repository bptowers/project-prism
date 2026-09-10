import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineFunnel } from './PipelineFunnel';

const stages = [
  { stage: 'Discovery', count: 10, revenue: '$100K', color: 'var(--prism-blue)' },
  { stage: 'Proposal', count: 4, revenue: '$40K', color: 'var(--prism-green)' },
];

describe('PipelineFunnel', () => {
  it('does not show a hardcoded average cycle time', () => {
    render(<PipelineFunnel stages={stages} />);
    expect(screen.getByText('Pipeline Stage Progression')).toBeInTheDocument();
    expect(screen.queryByText(/Avg\. cycle/)).not.toBeInTheDocument();
  });
});
