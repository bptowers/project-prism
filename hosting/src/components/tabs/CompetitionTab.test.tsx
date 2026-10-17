import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CompetitiveDisplacementData, DeltaIntelligenceData, TwentyQuestionsData } from '@/lib/types';
import { CompetitionTab } from './CompetitionTab';

const twentyQuestions = {
  question6: {
    label: 'Competitive pressure',
    answer: 'JobLogic is circling UK deals.',
    threats: [
      { competitor: 'JobLogic', region: 'UK', affectedDeals: 3, mrrAtRisk: '$12K', displacementPattern: 'Undercuts on price' },
      { competitor: 'ServiceM8', region: 'AU', affectedDeals: 5, mrrAtRisk: '$4K', displacementPattern: 'Mobile-first' },
    ],
  },
} as TwentyQuestionsData;
const displacement = {
  lossMechanisms: [{ region: 'UK', competitor: 'joblogic', statedReason: 'Price', realMechanism: 'Bundled scheduling', counter: 'Lead with 3-year cost' }],
} as CompetitiveDisplacementData;
const delta = {
  significantDealChanges: { deteriorated: [{ deal: 'Acme', rep: 'Jo', region: 'UK', change: 'Champion left' }], improved: [] },
  forecastDrift: { previousRealistic: '$100K', currentRealistic: '$90K', delta: '-$10K', driftDirection: 'declining', primaryCause: 'Commit slipped', quarterEndProjection: '' },
} as unknown as DeltaIntelligenceData;

describe('CompetitionTab', () => {
  it('builds competitor cards for the region in view, labelling the AI-estimated value', () => {
    render(<CompetitionTab delta={delta} displacement={displacement} twentyQuestions={twentyQuestions} region="uk" isLive />);
    expect(screen.getByText('JobLogic is the biggest threat here: about $12K at risk (AI estimate).')).toBeInTheDocument();
    const card = screen.getByRole('article', { name: 'JobLogic' });
    expect(card).toHaveTextContent('3 deals (AI count) · $12K at risk (AI estimate)');
    expect(card).toHaveTextContent('Counter-play: Lead with 3-year cost');
    expect(screen.queryByRole('article', { name: 'ServiceM8' })).not.toBeInTheDocument();
  });

  it('keeps the full analyses behind native disclosures, marked as AI analysis covering all regions', () => {
    render(<CompetitionTab delta={delta} displacement={displacement} twentyQuestions={twentyQuestions} region="uk" isLive />);
    const changeDetail = screen.getByText(/More change detail/);
    const full = screen.getByText(/Full competitive analysis/);
    expect(changeDetail.tagName).toBe('SUMMARY');
    expect(full.tagName).toBe('SUMMARY');
    expect(changeDetail).toHaveTextContent('(all regions)');
    expect(full).toHaveTextContent('(all regions)');
    expect(changeDetail).toHaveTextContent(/^More change detail \(AI analysis\)/);
    expect(full).toHaveTextContent(/^Full competitive analysis \(AI analysis\)/);
    expect(changeDetail.closest('details')).not.toHaveAttribute('open');
  });

  it('hides the change-detail disclosure when there is nothing extra in it', () => {
    const summaryOnly = { significantDealChanges: delta.significantDealChanges } as DeltaIntelligenceData;
    render(<CompetitionTab delta={summaryOnly} displacement={displacement} twentyQuestions={twentyQuestions} region="all" isLive />);
    expect(screen.queryByText(/More change detail/)).not.toBeInTheDocument();
    expect(screen.getByText(/Full competitive analysis/)).not.toHaveTextContent('(all regions)');
  });

  it('marks a loss-history-only competitor as having no open deals', () => {
    const lossOnly = { lossMechanisms: [{ region: 'UK', competitor: 'Aroflo', statedReason: '', realMechanism: 'Cheaper', counter: '' }] } as CompetitiveDisplacementData;
    render(<CompetitionTab displacement={lossOnly} region="all" isLive />);
    expect(screen.getByRole('article', { name: 'Aroflo' })).toHaveTextContent('No open deals flagged; seen in past losses.');
    expect(screen.getByRole('article', { name: 'Aroflo' })).not.toHaveTextContent('0 deals');
  });

  it('says competitor analysis was not generated on a live run without it, rather than "no threats"', () => {
    render(<CompetitionTab delta={delta} region="all" isLive />);
    expect(screen.getByText("Competitor analysis wasn't generated for this run.")).toBeInTheDocument();
    expect(screen.queryByText('No competitor threats recorded for this view.')).not.toBeInTheDocument();
  });

  it('shows honest empty states on sample data', () => {
    render(<CompetitionTab region="all" />);
    expect(screen.getByText('No competitor threats recorded for this view.')).toBeInTheDocument();
    expect(screen.queryByText(/More change detail/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Full competitive analysis/)).not.toBeInTheDocument();
  });
});
