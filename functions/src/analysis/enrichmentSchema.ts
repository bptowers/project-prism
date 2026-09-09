/**
 * Shape normalisers for the free-form enrichment payloads (Phases 3-5).
 *
 * The LLM returns these as unconstrained JSON. When it has nothing to say for
 * a slot it sometimes writes prose ("Not available in source data…") where the
 * schema calls for an array or an object. The dashboard iterates those slots,
 * so a string there throws inside React and blanks the whole page (seen in
 * production on 2026-09-09). These functions enforce the contract the
 * frontend relies on before anything is written to Firestore:
 *
 *   - array slots  → always an array of objects (prose / scalars dropped)
 *   - map slots    → a plain object, or absent
 *   - everything else is passed through untouched
 */

type Dict = Record<string, unknown>;

function isPlainObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Non-array → []. Arrays keep only their object entries. */
function objectArray(value: unknown): Dict[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject);
}

/** Arrays of primitives (e.g. competitor names). Non-array → []. */
function primitiveArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => v !== null && typeof v !== "object");
}

/** Non-object → undefined (field omitted). */
function objectOrUndefined(value: unknown): Dict | undefined {
  return isPlainObject(value) ? value : undefined;
}

/**
 * Apply `objectArray` to the listed keys of `obj`, but only when the key is
 * present — absent keys stay absent so the frontend's optional checks hold.
 */
function coerceArrayKeys(obj: Dict, keys: readonly string[]): Dict {
  const out: Dict = { ...obj };
  for (const key of keys) {
    if (key in out) out[key] = objectArray(out[key]);
  }
  return out;
}

function coerceObjectKeys(obj: Dict, keys: readonly string[]): Dict {
  const out: Dict = { ...obj };
  for (const key of keys) {
    if (key in out) {
      const v = objectOrUndefined(out[key]);
      if (v === undefined) delete out[key];
      else out[key] = v;
    }
  }
  return out;
}

// ── Phase 4: Competitive Displacement ──────────────────────────────────────

const CD_ARRAY_KEYS = ["lossMechanisms", "regionalArbitrage", "rewarmOpportunities"] as const;
const CD_OBJECT_KEYS = ["winMechanisms", "whyHaventTheyBought"] as const;

export function normalizeCompetitiveDisplacement(raw: unknown): Dict {
  const base = isPlainObject(raw) ? raw : {};
  return coerceObjectKeys(coerceArrayKeys(base, CD_ARRAY_KEYS), CD_OBJECT_KEYS);
}

// ── Phase 5: Delta Intelligence ────────────────────────────────────────────

const DI_ARRAY_KEYS = ["regionalTrajectory", "earlyWarnings"] as const;
const DI_OBJECT_KEYS = ["pipelineTrajectory", "forecastDrift", "significantDealChanges", "competitiveMomentumShift"] as const;
const DI_DEAL_CHANGE_ARRAYS = ["improved", "deteriorated"] as const;
const DI_EXITED_ARRAYS = ["closedWon", "closedLost", "goneDark"] as const;
const DI_MOMENTUM_OBJECT_ARRAYS = ["gaining", "losing"] as const;

export function normalizeDeltaIntelligence(raw: unknown): Dict {
  const base = isPlainObject(raw) ? raw : {};
  const out = coerceObjectKeys(coerceArrayKeys(base, DI_ARRAY_KEYS), DI_OBJECT_KEYS);

  if (isPlainObject(out.significantDealChanges)) {
    let changes = coerceArrayKeys(out.significantDealChanges, DI_DEAL_CHANGE_ARRAYS);
    changes = coerceObjectKeys(changes, ["newPipeline", "exited"]);
    if (isPlainObject(changes.exited)) {
      changes.exited = coerceArrayKeys(changes.exited, DI_EXITED_ARRAYS);
    }
    out.significantDealChanges = changes;
  }

  if (isPlainObject(out.competitiveMomentumShift)) {
    const shift = coerceArrayKeys(out.competitiveMomentumShift, DI_MOMENTUM_OBJECT_ARRAYS);
    if ("newThreats" in shift) shift.newThreats = primitiveArray(shift.newThreats);
    out.competitiveMomentumShift = shift;
  }

  return out;
}

// ── Phase 3: Twenty Questions ──────────────────────────────────────────────

const TQ_ROW_KEYS = [
  "silent7Days", "silent14Days", "silent30Days",
  "deals", "regions", "reps", "threats",
  "optimismBias", "sandbagging",
] as const;

export function normalizeTwentyQuestions(raw: unknown): Dict {
  const base = isPlainObject(raw) ? raw : {};
  const out: Dict = { ...base };
  for (const [key, value] of Object.entries(out)) {
    if (!/^question\d+$/.test(key)) continue;
    if (!isPlainObject(value)) {
      delete out[key];
      continue;
    }
    out[key] = coerceArrayKeys(value, TQ_ROW_KEYS);
  }
  return out;
}
