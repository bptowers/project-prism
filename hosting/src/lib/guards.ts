/**
 * Defensive coercion for LLM-authored report payloads.
 *
 * Enrichment JSON comes from a model with no fixed schema. When it has nothing
 * to report it sometimes writes prose where an array belongs; calling .map on
 * that string throws during render. Backend normalisers now strip this before
 * storage, but older reports in Firestore may still carry it, so widgets must
 * never trust the shape blindly.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** True for a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
