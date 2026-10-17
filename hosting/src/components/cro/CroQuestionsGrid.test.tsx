import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { TwentyQuestionsData } from '@/lib/types';
import { CroQuestionsGrid } from './CroQuestionsGrid';

const data = {
  question1: {
    label: 'Deals Gone Silent',
    answer: 'Three deals have gone quiet.',
    silent7Days: [{ name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$1K', stage: 'Proposal', daysSinceActivity: 9 }],
  },
  question3: { label: 'Coverage', answer: 'Coverage is fine.' },
};

describe('CroQuestionsGrid', () => {
  it('renders nothing without a live report, and says when it was not generated', () => {
    const { container } = render(<CroQuestionsGrid data={undefined} region="all" />);
    expect(container).toBeEmptyDOMElement();
    render(<CroQuestionsGrid data={{ generatedAt: '2026-09-09' }} region="all" isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });

  it('shows a code-computed stat per card and expands the rows behind it', () => {
    render(<CroQuestionsGrid data={data} region="all" isLive />);
    expect(screen.getByText('1 deal · $1K')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'View 1 →' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Days Silent')).toBeInTheDocument();
  });

  it('offers "Read more" for questions with no rows', () => {
    render(<CroQuestionsGrid data={data} region="all" isLive />);
    expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
    expect(screen.getByText('Coverage is fine.')).toBeInTheDocument();
  });

  it('filters rows to the region and says the prose is global', () => {
    render(<CroQuestionsGrid data={data} region="na" isLive />);
    expect(screen.getAllByText('Nothing flagged')).toHaveLength(2);
    expect(screen.getByText(/the AI's written answers cover all regions/)).toBeInTheDocument();
  });

  it('survives malformed AI rows: prose in place of a table, null rows, a non-string answer', () => {
    const malformed = {
      question1: { label: 'Silent', answer: { text: 'oops' }, silent7Days: 'None this week.' },
      question2: { label: 'Slippage', answer: 'Two slipped.', deals: [null, { name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$2K' }] },
    } as unknown as TwentyQuestionsData;
    render(<CroQuestionsGrid data={malformed} region="all" isLive />);
    // Prose where rows belong counts as no rows; with no usable answer either, there is nothing to expand.
    const silent = screen.getByRole('article', { name: 'Gone silent' });
    expect(within(silent).getByText('Nothing flagged')).toBeInTheDocument();
    expect(within(silent).queryByRole('button')).not.toBeInTheDocument();
    // The null row is skipped, not counted and not rendered.
    expect(screen.getByText('1 deal · $2K')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View 1 →' }));
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('labels the AI\'s stage-stall figures as all regions under a region filter', () => {
    const q9 = { question9: {
      label: 'Stalls', answer: 'Proposal is the bottleneck.', bottleneckStage: 'Proposal', totalMrrStuck: '$40K', isSystemic: true,
      deals: [{ name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$1K', stage: 'Proposal', daysInStage: 40 }],
    } };
    const { unmount } = render(<CroQuestionsGrid data={q9} region="uk" isLive />);
    fireEvent.click(screen.getByRole('button', { name: 'View 1 →' }));
    expect(screen.getByText('Bottleneck (all regions):')).toBeInTheDocument();
    expect(screen.getByText('MRR stuck (all regions):')).toBeInTheDocument();
    unmount();
    render(<CroQuestionsGrid data={q9} region="all" isLive />);
    fireEvent.click(screen.getByRole('button', { name: 'View 1 →' }));
    expect(screen.getByText('Bottleneck:')).toBeInTheDocument();
  });

  it('renders object cell values as blank instead of crashing', () => {
    const odd = { question2: { label: 'Slippage', answer: '', deals: [
      { name: { first: 'Acme' }, rep: ['Jo'], region: 7, mrr: '$1K', currentCloseDate: { d: 1 }, slippageSignal: 'Pushed twice' },
    ] } } as unknown as TwentyQuestionsData;
    render(<CroQuestionsGrid data={odd} region="all" isLive />);
    fireEvent.click(screen.getByRole('button', { name: 'View 1 →' }));
    expect(screen.getByText('Pushed twice')).toBeInTheDocument();
  });
});
