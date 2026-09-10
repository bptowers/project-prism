import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/firebase', () => ({ storage: {}, db: {} }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(() => () => undefined),
}));

import { UploadModal } from './UploadModal';

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button>Upload CSV</button>
      <UploadModal isOpen={open} onClose={onClose} />
    </>
  );
}

describe('UploadModal accessibility', () => {
  it('is a labelled modal dialog', () => {
    render(<Harness open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent('Upload Salesforce Export');
  });

  it('moves focus into the dialog on open and back to the trigger on close', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness open={false} onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Upload CSV' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(<Harness open onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    rerender(<Harness open={false} onClose={onClose} />);
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the dialog even from the checked radio, the last real tab stop', () => {
    render(<Harness open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog');
    // Browsers put only the checked member of a radio group in the tab order,
    // so the checked "Claude" radio is the final tab stop, not the "OpenAI" one.
    const checked = screen.getByRole('radio', { name: /Claude/ });
    expect(checked).toBeChecked();
    checked.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));

    // And Shift+Tab from the first stop lands on that checked radio, not an unreachable one.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(checked);
  });

  it('exposes the drop zone as a keyboard-reachable button that opens the file picker', () => {
    render(<Harness open onClose={() => undefined} />);
    const dropZone = screen.getByRole('button', { name: /Drop your Salesforce export here/ });
    expect(dropZone).not.toHaveAttribute('tabindex', '-1');
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    // A native button fires click for Enter and Space, so activation is one path.
    fireEvent.click(dropZone);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
