import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskByStage } from './RiskByStage';
import type { RiskDeal } from '@/lib/types';

const deal = (id: number, level: RiskDeal['level']): RiskDeal => ({
  id, region: 'uk', level, value: `Deal ${id}`, confidence: 50, summary: '', action: '', daysStalled: 0, stage: 'Proposal',
});

describe('RiskByStage', () => {
  it('labels each risk band segment in text, not colour alone', () => {
    render(<RiskByStage risks={[deal(1, 'HIGH'), deal(2, 'HIGH'), deal(3, 'MEDIUM'), deal(4, 'LOW')]} />);
    expect(screen.getByLabelText('Proposal: 2 high risk')).toBeInTheDocument();
    expect(screen.getByLabelText('Proposal: 1 medium risk')).toBeInTheDocument();
    expect(screen.getByLabelText('Proposal: 1 low risk')).toBeInTheDocument();
  });
});
