import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwentyQuestions } from './TwentyQuestions';

describe('TwentyQuestions empty states', () => {
  it('renders nothing when there is no live report', () => {
    const { container } = render(<TwentyQuestions data={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the section was not generated when live data lacks it', () => {
    render(<TwentyQuestions data={undefined} isLive />);
    expect(screen.getByText('CRO Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });

  it('treats a payload with no questions the same as missing', () => {
    render(<TwentyQuestions data={{ generatedAt: '2026-09-09' }} isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });
});

describe('TwentyQuestions accordion accessibility', () => {
  const data = {
    question1: {
      label: 'Deals Gone Silent',
      answer: 'Three deals have gone quiet.',
      silent7Days: [{ name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$1K', stage: 'Proposal', daysSinceActivity: 9 }],
    },
    question3: { label: 'Coverage', answer: 'Coverage is fine.' },
  };

  it('exposes expandable questions as buttons with aria-expanded', () => {
    render(<TwentyQuestions data={data} isLive />);
    const header = screen.getByRole('button', { name: /Deals Gone Silent/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Days Silent')).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Days Silent')).toBeInTheDocument();
  });

  it('does not make questions without detail into buttons', () => {
    render(<TwentyQuestions data={data} isLive />);
    expect(screen.queryByRole('button', { name: /Coverage/ })).not.toBeInTheDocument();
    expect(screen.getByText('Coverage is fine.')).toBeInTheDocument();
  });
});
