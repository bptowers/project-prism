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

  it('traps Tab inside the dialog', () => {
    render(<Harness open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute('disabled') && el.style.display !== 'none');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
});
