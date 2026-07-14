/**
 * Project Prism - Authorised email domains (frontend copy)
 *
 * The single allowlist governing who may access the tool. Enforced in FOUR
 * places that must be kept in sync (no shared FE/BE package yet — Phase 3):
 *   1. hosting/src/lib/allowedDomains.ts    (this file, frontend gate)
 *   2. functions/src/util/allowedDomains.ts (backend requireAuth)
 *   3. firestore.rules                      (allowed() regex helper)
 *   4. storage.rules                        (allowed() regex helper)
 * When adding a domain, update all four.
 *
 * Frontend enforcement is defence-in-depth / UX only — the authoritative
 * checks are the Firestore/Storage rules and the backend requireAuth.
 */
export const ALLOWED_DOMAINS = [
  'simprogroup.com',
  'simpro.us',
  'simpro.au',
  'bigchange.com',
] as const;

/** True only for a non-empty email whose domain is on the allowlist. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  return !!domain && (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}
