import { useLayoutEffect, useState, type RefObject } from 'react';

/** The element's content width in CSS px, kept current with ResizeObserver; `fallback` where that's unavailable (jsdom). */
export function useElementWidth(ref: RefObject<Element>, fallback: number): number {
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
