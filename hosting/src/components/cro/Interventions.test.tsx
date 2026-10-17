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
    expect(screen.getByRole('region', { name: 'Needs your intervention · 1 of 1 reviewed · 1 not in deal list' })).toBeInTheDocument();
    // An AI row with no matching report deal has nothing to review, and says why.
    expect(screen.queryByRole('button', { name: /Unknown Co/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not in this report's deal list")).toBeInTheDocument();
  });

  describe('matching AI rows to report deals', () => {
    const q10 = (...names: string[]) => ({ question10: { label: '', answer: '', deals: names.map(name => ({ name, rep: '', region: 'UK', mrr: '' })) } });
    const renderWith = (names: string[], deals: ReturnType<typeof makeDeal>[]) => render(
      <MemoryReviewsProvider><Interventions data={q10(...names)} region="all" deals={deals} isLive /></MemoryReviewsProvider>,
    );

    it('matches a deal name regardless of case', () => {
      renderWith(['acme renewal'], [makeDeal({ value: 'Acme Renewal' })]);
      expect(screen.getByRole('button', { name: 'Mark reviewed: Acme Renewal' })).toBeInTheDocument();
    });

    it('falls back to the account name when exactly one deal has it', () => {
      renderWith(['Acme Ltd'], [makeDeal({ value: 'Acme Upsell', accountName: 'Acme Ltd' }), makeDeal({ value: 'Other', accountName: 'Other Co' })]);
      expect(screen.getByRole('button', { name: 'Mark reviewed: Acme Upsell' })).toBeInTheDocument();
    });

    it('gives no review control when the account name is ambiguous', () => {
      renderWith(['Acme Ltd'], [makeDeal({ value: 'Acme Upsell', accountName: 'Acme Ltd' }), makeDeal({ value: 'Acme Renewal', accountName: 'Acme Ltd' })]);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText("Not in this report's deal list")).toBeInTheDocument();
    });

    it('prefers a deal-name match over an earlier account-name match', () => {
      renderWith(['Acme'], [makeDeal({ value: 'Acme Upsell', accountName: 'Acme' }), makeDeal({ value: 'Acme' })]);
      expect(screen.getByRole('button', { name: 'Mark reviewed: Acme' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Acme Upsell/ })).not.toBeInTheDocument();
    });

    it('counts a deal named twice once, and reviews it from its first row only', () => {
      renderWith(['Acme', 'ACME', 'Ghost Co'], [makeDeal({ value: 'Acme' })]);
      expect(screen.getAllByRole('button', { name: /Acme/ })).toHaveLength(1);
      expect(screen.getByText('Same deal as above')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed: Acme' }));
      expect(screen.getByRole('region', { name: 'Needs your intervention · 1 of 1 reviewed · 1 not in deal list' })).toBeInTheDocument();
    });
  });

  it('shows a deadline that is not a date as written, without "by"', () => {
    const d = { question10: { label: '', answer: '', deals: [{ name: 'Acme', rep: '', region: 'UK', mrr: '', deadline: '48 hours' }] } };
    render(<Interventions data={d} region="all" deals={[]} isLive />);
    expect(screen.getByText('48 hours')).toBeInTheDocument();
    expect(screen.queryByText(/by 48 hours/)).not.toBeInTheDocument();
  });

  it('skips malformed AI rows instead of crashing', () => {
    const malformed = { question10: { label: '', answer: '', deals: [
      null, 'Acme',
      { name: 42, region: 7, mrr: '$2K', croAction: { text: 'Call' }, deadline: { when: 'soon' }, stage: ['Commit'] },
    ] } } as never;
    render(<Interventions data={malformed} region="all" deals={[makeDeal({ value: '42' })]} isLive />);
    expect(screen.getByText('1 deal worth $2K needs you personally.')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7 · $2K')).toBeInTheDocument();
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
