import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  // Simulate an OS set to dark mode: the app must still open in light.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('dark'), media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('opens in light mode even when the OS prefers dark', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('respects and persists an explicit choice', () => {
    localStorage.setItem('prism-theme-choice', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('prism-theme-choice')).toBe('light');
  });

  it('ignores the legacy auto-saved key and leaves it alone', () => {
    // The old provider wrote the OS theme here on every first visit, so it is not a choice.
    localStorage.setItem('prism-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(localStorage.getItem('prism-theme')).toBe('dark');
  });

  it('writes nothing to storage until the user toggles', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(localStorage.length).toBe(0);
  });

  it('remembers a toggle across a remount', () => {
    const { unmount } = render(<ThemeProvider><Probe /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('prism-theme-choice')).toBe('dark');
    unmount();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('still renders and toggles when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    // Prove the throwing paths actually ran, not just that nothing crashed.
    expect(getItem).toHaveBeenCalledWith('prism-theme-choice');
    expect(setItem).toHaveBeenCalledWith('prism-theme-choice', 'dark');
  });
});
