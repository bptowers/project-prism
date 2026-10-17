import { vi } from 'vitest';

/** jsdom has no ResizeObserver; stand one in that reports a fixed width on observe. Undo with vi.unstubAllGlobals(). */
export function mockResizeObserver(width: number) {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() {
      this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  });
}
