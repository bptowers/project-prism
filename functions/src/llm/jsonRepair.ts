/**
 * Project Prism - Lenient JSON Extraction for Free-Form LLM Output
 *
 * The portfolio-level enrichment prompts (Phases 2-5) don't use a fixed
 * response schema — their shapes vary per phase — so providers return free
 * text and callers extract the JSON object themselves. A naive
 * `text.match(/\{[\s\S]*\}/)` has two failure modes seen in production:
 *  1. It's greedy from the FIRST '{' to the LAST '}' in the whole string,
 *     so any trailing prose after the real object gets pulled in if that
 *     prose itself contains a brace.
 *  2. LLMs occasionally emit raw control characters (literal newlines,
 *     tabs) inside JSON string values instead of escaping them (\n, \t) —
 *     invalid per the JSON spec, and JSON.parse rejects it outright.
 *
 * extractJsonObject() finds the first balanced top-level object via bracket
 * counting (respecting string literals), and sanitizeJsonControlChars()
 * escapes stray control characters found ONLY inside string literals before
 * parsing — both scoped narrowly so they don't alter otherwise-valid JSON.
 */

/**
 * Extracts the first complete, balanced JSON object from a string using
 * bracket counting. Handles braces inside string literals correctly.
 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Escapes raw control characters (0x00-0x1F) found inside JSON string
 * literals. Valid JSON requires these escaped (\n, \r, \t, or \u00XX); LLMs
 * sometimes emit them raw when reflecting multi-line source text (CRM notes)
 * back into a generated string value, which otherwise breaks JSON.parse.
 * Structural whitespace outside strings is left untouched.
 */
export function sanitizeJsonControlChars(text: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);

    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && code < 0x20) {
      switch (ch) {
        case "\n": out += "\\n"; break;
        case "\r": out += "\\r"; break;
        case "\t": out += "\\t"; break;
        default: out += "\\u" + code.toString(16).padStart(4, "0");
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Extracts and parses the first JSON object in `text`, applying control-char
 * sanitization first. Throws with a descriptive message (including the
 * original parse error) if extraction or parsing fails — callers should
 * treat that as a non-fatal enrichment-phase failure, not a crash.
 */
export function extractAndParseJson<T = unknown>(text: string): T {
  const sanitized = sanitizeJsonControlChars(text);
  const extracted = extractJsonObject(sanitized);
  if (!extracted) {
    throw new Error("No JSON object found in response");
  }
  try {
    return JSON.parse(extracted) as T;
  } catch (error) {
    throw new Error(`Failed to parse extracted JSON: ${String(error)}`);
  }
}
