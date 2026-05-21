import { useState, useCallback } from 'react';

const STORAGE_KEY = 'prism-deal-reviews';

function loadReviewed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

export function useDealReviews() {
  const [reviewed, setReviewed] = useState<Set<string>>(loadReviewed);

  const toggleReview = useCallback((id: string) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch { /* quota exceeded — ignore */ }
      return next;
    });
  }, []);

  const isReviewed = useCallback((id: string) => reviewed.has(id), [reviewed]);

  return { reviewed, toggleReview, isReviewed };
}
