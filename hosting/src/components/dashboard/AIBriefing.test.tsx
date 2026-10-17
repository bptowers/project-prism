import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIBriefing } from './AIBriefing';

describe('AIBriefing', () => {
  it('collapses to a few lines with a toggle to read it all', () => {
    render(<AIBriefing isLive briefing="A long briefing." collapsible />);
    const toggle = screen.getByRole('button', { name: 'Read full briefing' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('badges the AI briefing as AI-generated and the code-built fallback as computed', () => {
    const { unmount } = render(<AIBriefing isLive briefing="From the model." fallbackBriefing="From code." />);
    expect(screen.getByText('AI-GENERATED BRIEFING')).toBeInTheDocument();
    expect(screen.getByText('From the model.')).toBeInTheDocument();
    unmount();
    render(<AIBriefing isLive fallbackBriefing="From code." />);
    expect(screen.getByText('SUMMARY (COMPUTED)')).toBeInTheDocument();
    expect(screen.queryByText('AI-GENERATED BRIEFING')).not.toBeInTheDocument();
    expect(screen.getByText('From code.')).toBeInTheDocument();
  });

  it('shows a scope note when a region filter cannot apply to it', () => {
    render(<AIBriefing isLive briefing="Text." scopeNote="Global briefing: covers all regions, not just UK." />);
    expect(screen.getByText('Global briefing: covers all regions, not just UK.')).toBeInTheDocument();
  });
});
