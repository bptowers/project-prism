import { writeDealsSubcollection } from "./dealsSubcollection.js";

/** Minimal in-memory stand-in for the slice of Firestore this module uses. */
function fakeDb(initial: string[] = []) {
  const docs = new Map<string, unknown>(initial.map((id) => [id, { stale: true }]));
  let commits = 0;
  const ref = (id: string) => ({ id });
  const collection = {
    doc: (id: string) => ref(id),
    listDocuments: async () => [...docs.keys()].map(ref),
  };
  const db = {
    collection: () => ({ doc: () => ({ collection: () => collection }) }),
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        set: (r: { id: string }, data: unknown) => ops.push(() => docs.set(r.id, data)),
        delete: (r: { id: string }) => ops.push(() => docs.delete(r.id)),
        commit: async () => { commits++; ops.forEach((op) => op()); },
      };
    },
  };
  return { db, docs, commits: () => commits };
}

describe("writeDealsSubcollection", () => {
  it("writes every deal keyed by opportunityId", async () => {
    const { db, docs } = fakeDb();
    await writeDealsSubcollection(db as never, "2026-10-10", [
      { opportunityId: "A", value: "Deal A" },
      { opportunityId: "B", value: "Deal B" },
    ]);
    expect([...docs.keys()].sort()).toEqual(["A", "B"]);
    expect(docs.get("A")).toEqual({ opportunityId: "A", value: "Deal A" });
  });

  it("removes deals left over from an earlier run on the same day", async () => {
    const { db, docs } = fakeDb(["A", "GONE"]);
    const result = await writeDealsSubcollection(db as never, "2026-10-10", [
      { opportunityId: "A" },
      { opportunityId: "B" },
    ]);
    expect([...docs.keys()].sort()).toEqual(["A", "B"]);
    expect(result).toEqual({ written: 2, removed: 1 });
  });

  it("leaves the existing list alone when there are no deals to write", async () => {
    const { db, docs } = fakeDb(["A"]);
    await writeDealsSubcollection(db as never, "2026-10-10", []);
    expect([...docs.keys()]).toEqual(["A"]);
  });

  it("chunks writes and deletes under Firestore's 500-op batch limit", async () => {
    const stale = Array.from({ length: 600 }, (_, i) => `OLD-${i}`);
    const { db, docs, commits } = fakeDb(stale);
    const deals = Array.from({ length: 700 }, (_, i) => ({ opportunityId: `NEW-${i}` }));
    await writeDealsSubcollection(db as never, "2026-10-10", deals);
    expect(docs.size).toBe(700);
    expect(commits()).toBe(4); // 2 write batches + 2 delete batches
  });
});
