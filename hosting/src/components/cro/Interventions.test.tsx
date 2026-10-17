import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { Interventions } from './Interventions';

const data = {
  question10: {
    label: 'Top deals needing CRO intervention', answer: '',
    deals: [
      { name: 'Acme Renewal', rep: 'Jo', region: 'UK', mrr: '$12,000', croAction: 'Call the CFO', deadline: '2026-10-18' },
      { name: 'Unknown Co', rep: 'Sam', region: 'UK', mrr: '$3K', croAction: 'Exec sponsor' },
      { name: 'Far Away', rep: 'Lee', region: 'AU', mrr: '$5K', croAction: 'Re-qualify' },
    ],
  },
};

describe('Interventions', () => {
  it('lists the region\'s deals with action and deadline, and reviews matched deals', () => {
    render(
      <MemoryReviewsProvider>
        <Interventions data={data} region="uk" deals={[makeDeal({ value: 'Acme Renewal' })]} isLive />
      </MemoryReviewsProvider>,
    );
    expect(screen.getByText('2 deals worth $15K need you personally.')).toBeInTheDocument();
    expect(screen.getByText('Call the CFO')).toBeInTheDocument();
    expect(screen.getByText('by 18 Oct 2026')).toBeInTheDocument();
    expect(screen.queryByText('Far Away')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed: Acme Renewal' }));
    expect(screen.getByRole('region', { name: /1 of 2 reviewed/ })).toBeInTheDocument();
    // An AI row with no matching report deal has nothing to review.
    expect(screen.queryByRole('button', { name: /Unknown Co/ })).not.toBeInTheDocument();
  });

  it('skips malformed AI rows instead of crashing', () => {
    const malformed = { question10: { label: '', answer: '', deals: [null, 'Acme', { name: 42, region: 'UK', mrr: '$2K' }] } } as never;
    render(<Interventions data={malformed} region="all" deals={[makeDeal({ value: '42' })]} isLive />);
    expect(screen.getByText('1 deal worth $2K needs you personally.')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('says nothing needs intervention when no row is in the region', () => {
    render(<Interventions data={data} region="na" deals={[]} isLive />);
    expect(screen.getByRole('region', { name: 'Needs your intervention' })).toBeInTheDocument();
    expect(screen.getByText('Nothing in this view needs CRO intervention.')).toBeInTheDocument();
  });

  it('says when the section was not generated', () => {
    render(<Interventions data={undefined} region="all" deals={[]} isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });
});
