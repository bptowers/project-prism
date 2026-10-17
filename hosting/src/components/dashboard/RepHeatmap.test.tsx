import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { RepHeatmap } from './RepHeatmap';

describe('RepHeatmap', () => {
  it('ranks reps riskiest first and opens a rep on click', () => {
    const onRepClick = vi.fn();
    render(<RepHeatmap risks={[makeDeal({ rep: 'Sam', healthScore: 80, level: 'LOW' }), makeDeal({ rep: 'Jo', healthScore: 30, level: 'HIGH' })]} onRepClick={onRepClick} />);
    const rows = screen.getAllByRole('button', { name: /^Show deals for / });
    expect(rows.map(r => r.getAttribute('aria-label'))).toEqual(['Show deals for Jo', 'Show deals for Sam']);
    fireEvent.click(rows[0]);
    expect(onRepClick).toHaveBeenCalledWith('Jo');
    // The panel header now comes from InsightPanel.
    expect(screen.queryByText('Rep Performance')).not.toBeInTheDocument();
  });
});
