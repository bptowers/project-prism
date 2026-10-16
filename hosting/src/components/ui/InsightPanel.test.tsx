import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightPanel } from './InsightPanel';

describe('InsightPanel', () => {
  it('renders label, question, takeaway, note, action and children', () => {
    render(
      <InsightPanel label="Activity health" question="Are reps still working these deals?" takeaway="3 deals have gone quiet." note="Global answer." action={<button>See all</button>}>
        <p>chart</p>
      </InsightPanel>,
    );
    expect(screen.getByRole('region', { name: 'Activity health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Are reps still working these deals?' })).toBeInTheDocument();
    expect(screen.getByTestId('takeaway')).toHaveTextContent('3 deals have gone quiet.');
    expect(screen.getByText('Global answer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
    expect(screen.getByText('chart')).toBeInTheDocument();
  });

  it('omits the takeaway box when there is none', () => {
    render(<InsightPanel label="X" question="Q?"><span /></InsightPanel>);
    expect(screen.queryByTestId('takeaway')).not.toBeInTheDocument();
  });
});
