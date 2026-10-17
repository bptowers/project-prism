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

  it('shows a scope note when a region filter cannot apply to it', () => {
    render(<AIBriefing isLive briefing="Text." scopeNote="Global briefing: covers all regions, not just UK." />);
    expect(screen.getByText('Global briefing: covers all regions, not just UK.')).toBeInTheDocument();
  });
});
