/**
 * Tests for BigQuerySource row mapping against the PRODUCTION table shape.
 * Column names below mirror edw-simprogroup-propagation.SF_Simpro.sf_opportunity
 * (verified via INFORMATION_SCHEMA, 2026-07-15). If these tests fail after a
 * field-map change, the scheduled BigQuery pipeline is likely mapping fields
 * to empty strings in production.
 */
import { BigQuerySource, BigQueryConfig, describeFetch } from "./bigquerySource";

const CONFIG: BigQueryConfig = {
  projectId: "test-project",
  dataset: "SF_Simpro",
  table: "sf_opportunity",
};

// A row shaped like the real production table (subset of columns).
function productionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "006XX0000012345",
    account_name: "Acme Electrical Ltd",
    name: "Acme Electrical - New Business",
    stage_name: "Discovery",
    expected_mrr_c: 1500,
    amount: 18000,
    close_date: { value: "2026-09-30" },
    is_closed: false,
    is_won: false,
    currency_iso_code: "GBP",
    owner_name: "Jane Rep",
    created_date: { value: "2026-02-01T10:00:00Z" },
    _fivetran_start: { value: "2026-07-01T08:00:00Z" },
    _fivetran_synced: { value: "2026-07-14T02:00:00Z" },
    next_step: null,
    next_step_long_text: "Demo booked for 22 July with ops manager",
    probability: 40,
    forecast_category: "Pipeline",
    lead_source: "Referral",
    type: "New Business",
    sales_region: "Simpro UK",
    industry: "Electrical",
    close_plan: "Trial then board sign-off in August",
    manager_notes: "Champion strong, EB not yet engaged",
    why_would_they_buy_from_us: "Job costing visibility",
    why_wouldnt_they_buy_from_us: "Price vs incumbent",
    path_to_purchase: "Trial -> proposal -> board",
    who_is_signing_economic_buyer: "Ops Director",
    reason_for_win: null,
    win_notes: null,
    lost_reason: null,
    lost_notes: null,
    competitor_name: "JobLogic",
    sim_pro_company_c: "Simpro UK",
    ...overrides,
  };
}

type MapRowFn = (row: Record<string, unknown>) => ReturnType<never> | any;

function mapRow(row: Record<string, unknown>) {
  const source = new BigQuerySource(CONFIG);
  return (source as unknown as { mapRow: MapRowFn }).mapRow(row);
}

describe("BigQuerySource.mapRow with production column names", () => {
  it("maps core identity fields", () => {
    const record = mapRow(productionRow());
    expect(record.opportunityId).toBe("006XX0000012345");
    expect(record.accountName).toBe("Acme Electrical Ltd");
    expect(record.opportunityName).toBe("Acme Electrical - New Business");
    expect(record.stage).toBe("Discovery");
    expect(record.salesRep).toBe("Jane Rep");
  });

  it("prefers next_step_long_text (populated in prod) over the near-empty next_step", () => {
    const record = mapRow(productionRow());
    expect(record.nextStep).toBe("Demo booked for 22 July with ops manager");
  });

  it("falls back to next_step when long text is absent", () => {
    const record = mapRow(
      productionRow({ next_step_long_text: null, next_step: "Call Tuesday" })
    );
    expect(record.nextStep).toBe("Call Tuesday");
  });

  it("uses _fivetran_start (record-change proxy) for updatedDate, not _fivetran_synced", () => {
    const record = mapRow(productionRow());
    expect(record.updatedDate).toBe("2026-07-01T08:00:00Z");
  });

  it("surfaces the snake_case notes fields into composite notes for the LLM", () => {
    const record = mapRow(productionRow());
    // close_plan maps to its own field (dealReviewNotes), not composite notes
    expect(record.dealReviewNotes).toBe("Trial then board sign-off in August");
    expect(record.notes).toContain("Champion strong, EB not yet engaged"); // manager_notes
    expect(record.notes).toContain("Job costing visibility"); // why_would_they_buy_from_us
    expect(record.notes).toContain("Price vs incumbent"); // why_wouldnt_they_buy_from_us
    expect(record.notes).toContain("Trial -> proposal -> board"); // path_to_purchase
    expect(record.notes).toContain("JobLogic"); // competitor_name
    expect(record.notes).toContain("Ops Director"); // who_is_signing_economic_buyer
  });

  it("maps the economic buyer field", () => {
    const record = mapRow(productionRow());
    expect(record.economicBuyer).toBe("Ops Director");
  });

  it("leaves lastActivityDate empty (no such column in the table)", () => {
    const record = mapRow(productionRow());
    expect(record.lastActivityDate).toBe("");
  });

  it("detects UK region from sales_region", () => {
    const record = mapRow(productionRow());
    expect(record.region).toBe("UK");
  });

  it("classifies an open deal as active", () => {
    const record = mapRow(productionRow());
    expect(record.winLossStatus).toBe("active");
  });
});

describe("BigQuerySource.buildQuery", () => {
  it("filters out inactive Fivetran row versions defensively", () => {
    const source = new BigQuerySource(CONFIG);
    const { query } = (
      source as unknown as { buildQuery: () => { query: string; params: Record<string, unknown> } }
    ).buildQuery();
    expect(query).toContain("COALESCE(_fivetran_active, TRUE)");
    expect(query).toContain("is_closed = FALSE");
  });
});

describe("BigQuerySource row-cap telemetry", () => {
  it("describeFetch flags truncation only when the row count hits the limit", () => {
    expect(describeFetch(300, 300)).toEqual({ truncated: true, rowLimit: 300, rowCount: 300 });
    expect(describeFetch(299, 300)).toEqual({ truncated: false, rowLimit: 300, rowCount: 299 });
    expect(describeFetch(0, 300)).toEqual({ truncated: false, rowLimit: 300, rowCount: 0 });
  });

  it("exposes the effective row limit (default 300, config override)", () => {
    expect(new BigQuerySource(CONFIG).rowLimit).toBe(300);
    expect(new BigQuerySource({ ...CONFIG, limit: 50 }).rowLimit).toBe(50);
  });

  it("fetchRecordsWithMeta reports truncation and warns naming the cap", async () => {
    const source = new BigQuerySource({ ...CONFIG, limit: 2 });
    const rows = [productionRow({ id: "A" }), productionRow({ id: "B" })];
    (source as unknown as { client: unknown }).client = {
      query: async () => [rows],
    };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await source.fetchRecordsWithMeta();
      expect(result.records.map((r) => r.opportunityId)).toEqual(["A", "B"]);
      expect(result.truncated).toBe(true);
      expect(result.rowLimit).toBe(2);
      expect(result.rowCount).toBe(2);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/LIMIT 2\b|cap of 2\b|limit of 2\b/));
    } finally {
      warn.mockRestore();
    }
  });

  it("fetchRecordsWithMeta does not warn when under the cap", async () => {
    const source = new BigQuerySource({ ...CONFIG, limit: 5 });
    (source as unknown as { client: unknown }).client = {
      query: async () => [[productionRow()]],
    };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await source.fetchRecordsWithMeta();
      expect(result.truncated).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("BigQuerySource.mapRow pipeline value basis", () => {
  it("keeps expectedMRR and amount as separate fields", () => {
    const record = mapRow(productionRow({ expected_mrr_c: 1500, amount: 18000 }));
    expect(record.expectedMRR).toBe(1500);
    expect(record.amount).toBe(18000);
  });

  it("leaves expectedMRR undefined when the column is null", () => {
    const record = mapRow(productionRow({ expected_mrr_c: null, amount: 18000 }));
    expect(record.expectedMRR).toBeUndefined();
    expect(record.amount).toBe(18000);
  });
});
