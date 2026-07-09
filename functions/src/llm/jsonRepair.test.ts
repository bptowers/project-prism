import { extractAndParseJson, extractJsonObject, sanitizeJsonControlChars } from "./jsonRepair.js";

describe("extractJsonObject", () => {
  it("extracts a clean object", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("ignores trailing prose after the closing brace", () => {
    const text = '{"a":1}\n\nHope that helps!';
    expect(extractJsonObject(text)).toBe('{"a":1}');
  });

  it("ignores leading prose before the opening brace", () => {
    const text = 'Here is the JSON:\n{"a":1}';
    expect(extractJsonObject(text)).toBe('{"a":1}');
  });

  it("respects braces inside string values", () => {
    const text = '{"note":"contains a { brace } inside"}';
    expect(extractJsonObject(text)).toBe(text);
  });

  it("respects escaped quotes inside string values", () => {
    const text = '{"note":"she said \\"hello\\""}';
    expect(extractJsonObject(text)).toBe(text);
  });

  it("returns null when no object is present", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });

  it("stops at the first balanced object, ignoring a second one after", () => {
    const text = '{"a":1}{"b":2}';
    expect(extractJsonObject(text)).toBe('{"a":1}');
  });
});

describe("sanitizeJsonControlChars", () => {
  it("escapes a raw newline inside a string value", () => {
    const raw = '{"note":"line one\nline two"}';
    const sanitized = sanitizeJsonControlChars(raw);
    expect(() => JSON.parse(sanitized)).not.toThrow();
    expect(JSON.parse(sanitized).note).toBe("line one\nline two");
  });

  it("leaves structural whitespace (outside strings) untouched", () => {
    const pretty = '{\n  "a": 1\n}';
    expect(sanitizeJsonControlChars(pretty)).toBe(pretty);
    expect(() => JSON.parse(sanitizeJsonControlChars(pretty))).not.toThrow();
  });

  it("escapes raw tabs and carriage returns inside strings", () => {
    const raw = '{"note":"col1\tcol2\r\nrow2"}';
    const sanitized = sanitizeJsonControlChars(raw);
    expect(() => JSON.parse(sanitized)).not.toThrow();
  });

  it("does not double-escape already-escaped sequences", () => {
    const raw = '{"note":"already escaped \\n newline"}';
    expect(sanitizeJsonControlChars(raw)).toBe(raw);
  });
});

describe("extractAndParseJson", () => {
  it("parses a well-formed response", () => {
    expect(extractAndParseJson<{ a: number }>('{"a":1}').a).toBe(1);
  });

  it("recovers from a raw newline inside a reflected note field — the production bug", () => {
    // Reproduces the Phase 2/3 failure: the model reflects a multi-line CRM
    // note back into a JSON string value without escaping the newline.
    const broken = '{"executiveBriefing":"Deal notes: \nChampion identified\nNo competitor named","recommendations":[]}';
    const parsed = extractAndParseJson<{ executiveBriefing: string }>(broken);
    expect(parsed.executiveBriefing).toContain("Champion identified");
  });

  it("recovers from trailing prose after the JSON object", () => {
    const text = '{"a":1}\n\nLet me know if you need anything else!';
    expect(extractAndParseJson<{ a: number }>(text).a).toBe(1);
  });

  it("throws a descriptive error when no JSON is present", () => {
    expect(() => extractAndParseJson("not json at all")).toThrow(/No JSON object found/);
  });
});
