import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessingFooter } from './ProcessingFooter';

describe('ProcessingFooter', () => {
  it('renders the run metadata it is given', () => {
    render(
      <ProcessingFooter
        recordsAnalyzed={261}
        provider="claude"
        model="claude-sonnet-4-6"
        generatedAt="9 Sep 2026"
        dataQualityScore={91.4}
      />
    );
    expect(screen.getByText('261 opportunities analyzed')).toBeInTheDocument();
    expect(screen.getByText('claude · claude-sonnet-4-6')).toBeInTheDocument();
    expect(screen.getByText('9 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('Data Quality')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
  });

  it('omits fields that are absent rather than inventing values', () => {
    render(<ProcessingFooter recordsAnalyzed={12} />);
    expect(screen.getByText('12 opportunities analyzed')).toBeInTheDocument();
    expect(screen.queryByText(/Claude Opus/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feb 3, 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText('Data Quality')).not.toBeInTheDocument();
    expect(screen.queryByText('87%')).not.toBeInTheDocument();
  });

  it('renders nothing at all when it has no metadata', () => {
    const { container } = render(<ProcessingFooter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns when the source row cap was reached', () => {
    render(<ProcessingFooter recordsAnalyzed={500} sourceTruncated sourceRowLimit={500} />);
    expect(screen.getByText('Row cap of 500 reached — some deals not included')).toBeInTheDocument();
  });

  it('does not warn when the source was not truncated', () => {
    render(<ProcessingFooter recordsAnalyzed={120} sourceTruncated={false} sourceRowLimit={500} />);
    expect(screen.queryByText(/Row cap/)).not.toBeInTheDocument();
  });
});
