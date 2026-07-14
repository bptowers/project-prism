import { isAllowedEmail, ALLOWED_DOMAINS } from "./allowedDomains.js";

describe("isAllowedEmail", () => {
  it("accepts every allowlisted domain", () => {
    for (const d of ALLOWED_DOMAINS) {
      expect(isAllowedEmail(`user@${d}`)).toBe(true);
    }
  });

  it("is case-insensitive on the domain and tolerant of surrounding whitespace", () => {
    expect(isAllowedEmail("Foo@Simprogroup.com")).toBe(true);
    expect(isAllowedEmail("  user@SIMPRO.US  ")).toBe(true);
  });

  it("rejects non-allowlisted domains", () => {
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("someone@simprogroup.co")).toBe(false);
    expect(isAllowedEmail("someone@notsimpro.us")).toBe(false);
  });

  it("does not allow a listed domain smuggled into the local part", () => {
    expect(isAllowedEmail("simprogroup.com@gmail.com")).toBe(false);
  });

  it("rejects empty / malformed / anonymous (no email) inputs", () => {
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
    expect(isAllowedEmail("no-at-sign")).toBe(false);
    expect(isAllowedEmail("trailing@")).toBe(false);
  });
});
