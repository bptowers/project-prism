import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
