import { describe, expect, it } from "vitest";

import { formatHistory, formatValue, referencedIds, type AuditRow, type NameLookups } from "./history-format";

const ALEX = "11111111-1111-4111-8111-111111111111";
const SAM = "12121212-1212-4212-8212-121212121212";
const RIVERSIDE = "22222222-2222-4222-8222-222222222222";
const KEVIN = "88888888-8888-4888-8888-888888888888";
const CASE = "33333333-3333-4333-8333-333333333333";

const names: NameLookups = {
  accounts: new Map([[RIVERSIDE, "Riverside Body Shop BV"]]),
  contacts: new Map([[KEVIN, "Kevin Pauwels"]]),
  users: new Map([
    [ALEX, "Alex Morgan"],
    [SAM, "Sam Taylor"],
  ]),
  tags: new Map(),
  vehicles: new Map(),
  quotes: new Map([
    ["q-pre", "Pre-calculation"],
    ["q-post", "Post-calculation"],
  ]),
  documents: new Map([["doc-1", "expert-report.pdf"]]),
  codes: new Map([
    ["on_hold_reason", new Map([["awaiting_parts", "Awaiting parts"]])],
    ["part_catalog", new Map([["front_bumper", "Front bumper"]])],
  ]),
};

const row = (overrides: Partial<AuditRow>): AuditRow => ({
  id: crypto.randomUUID(),
  entity: "case",
  entityId: CASE,
  field: null,
  oldValue: null,
  newValue: null,
  actorType: "user",
  actorId: ALEX,
  at: "2026-11-05T09:00:00Z",
  ...overrides,
});

describe("formatHistory (UC-37)", () => {
  it("groups the fields changed in one save into one entry", () => {
    const entries = formatHistory(
      [
        row({ field: "on_hold", oldValue: "false", newValue: "true" }),
        row({ field: "on_hold_reason", oldValue: null, newValue: "awaiting_parts" }),
        row({ field: "manager_user_id", oldValue: ALEX, newValue: SAM }),
      ],
      names,
    );
    expect(entries).toEqual([
      {
        key: expect.any(String),
        at: "2026-11-05T09:00:00Z",
        actor: "Alex Morgan",
        summary: "Updated the case",
        changes: [
          { label: "On hold", from: "No", to: "Yes" },
          { label: "On-hold reason", from: "—", to: "Awaiting parts" },
          { label: "Case manager", from: "Alex Morgan", to: "Sam Taylor" },
        ],
      },
    ]);
  });

  it("describes a status change with labels", () => {
    const [entry] = formatHistory(
      [row({ field: "status", oldValue: "client_assignment", newValue: "followup_repairer" })],
      names,
    );
    expect(entry.summary).toBe("Changed the status");
    expect(entry.changes).toEqual([
      { label: "Status", from: "Client assignment", to: "File follow-up – repairer" },
    ]);
  });

  it("describes added and removed records by name", () => {
    const entries = formatHistory(
      [
        row({
          entity: "case_party",
          newValue: JSON.stringify({ role: "repairer", account_id: RIVERSIDE, contact_id: KEVIN }),
        }),
        row({ entity: "damaged_part", oldValue: JSON.stringify({ part_code: "front_bumper" }) }),
        row({ entity: "document", newValue: JSON.stringify({ file_name: "claim.pdf", category: "claim_form" }) }),
        row({ entity: "case", newValue: JSON.stringify({ case_number: "VCR20260006" }), actorType: "system", actorId: null }),
      ],
      names,
    );
    expect(entries.map((entry) => [entry.summary, entry.actor])).toEqual([
      ["Added party Repairer: Riverside Body Shop BV – Kevin Pauwels", "Alex Morgan"],
      ["Removed damaged part: Front bumper", "Alex Morgan"],
      ["Uploaded document claim.pdf (Claim form)", "Alex Morgan"],
      ["Created the case VCR20260006", "System"],
    ]);
  });

  it("keeps separate saves apart", () => {
    const entries = formatHistory(
      [
        row({ field: "insurer_ref", newValue: "B", at: "2026-11-05T10:00:00Z" }),
        row({ field: "insurer_ref", newValue: "A", at: "2026-11-05T09:00:00Z" }),
      ],
      names,
    );
    expect(entries).toHaveLength(2);
  });
});

describe("formatValue", () => {
  it("formats dates, appointments, booleans and empty values", () => {
    expect(formatValue("case", "assignment_date", "2026-11-05", names)).toBe("05/11/2026");
    expect(formatValue("case", "appointment_repair_at", "2026-11-10T07:00:00+00:00", names)).toBe("10/11/2026 08:00");
    expect(formatValue("case", "on_hold", "true", names)).toBe("Yes");
    expect(formatValue("case", "broker_ref", null, names)).toBe("—");
    expect(formatValue("vehicle", "category", "light_van", names)).toBe("Light van");
  });
});

describe("referencedIds", () => {
  it("collects the ids to look up, including the actors", () => {
    const ids = referencedIds([
      row({ field: "manager_user_id", oldValue: ALEX, newValue: SAM }),
      row({ entity: "case_party", newValue: JSON.stringify({ account_id: RIVERSIDE, contact_id: KEVIN }) }),
    ]);
    expect([...ids.users].sort()).toEqual([ALEX, SAM].sort());
    expect([...ids.accounts]).toEqual([RIVERSIDE]);
    expect([...ids.contacts]).toEqual([KEVIN]);
  });
});

describe("quote history", () => {
  // Newest first, as the repository returns them; all rows of one save share
  // the transaction's time.
  const save = [
    row({
      entity: "quote_line",
      entityId: "l3",
      newValue: JSON.stringify({ quote_id: "q-pre", category: "deduction", sub_type: "wear_and_tear", description: "Wear", amount: -50 }),
      at: "2026-11-05T09:00:00Z",
    }),
    row({ entity: "quote", entityId: "q-pre", field: "total_excl_vat", oldValue: "248", newValue: "198", at: "2026-11-05T09:00:00Z" }),
    row({ entity: "quote_line", entityId: "l1", field: "amount", oldValue: "200", newValue: "248", at: "2026-11-05T09:00:00Z" }),
    row({
      entity: "quote_line",
      entityId: "l2",
      oldValue: JSON.stringify({ quote_id: "q-pre", category: "parts", sub_type: null, description: "Clip", amount: 12.5 }),
      at: "2026-11-05T09:00:00Z",
    }),
  ];

  it("shows one quote save as one entry with its line changes", () => {
    expect(formatHistory(save, names)).toEqual([
      {
        key: expect.any(String),
        at: "2026-11-05T09:00:00Z",
        actor: "Alex Morgan",
        summary: "Updated the pre-calculation",
        changes: [
          { label: "Line removed", from: "Parts: Clip (€12.50)", to: "—" },
          { label: "Line amount", from: "€200.00", to: "€248.00" },
          { label: "Total excl. VAT", from: "€248.00", to: "€198.00" },
          { label: "Line added", from: "—", to: "Deduction – Wear and tear: Wear (-€50.00)" },
        ],
      },
    ]);
  });

  it("names creating, sending and validating a quote", () => {
    const created = formatHistory(
      [row({ entity: "quote", entityId: "q-post", newValue: JSON.stringify({ version: "post_calculation" }) })],
      names,
    );
    expect(created[0].summary).toBe("Created the post-calculation");
    const validated = formatHistory(
      [row({ entity: "quote", entityId: "q-post", field: "status", oldValue: "draft", newValue: "validated" })],
      names,
    );
    expect(validated[0]).toMatchObject({
      summary: "Validated the post-calculation",
      changes: [{ label: "Status", from: "Draft", to: "Validated" }],
    });
    const sent = formatHistory(
      [row({ entity: "quote", entityId: "q-pre", field: "status", oldValue: "draft", newValue: "sent" })],
      names,
    );
    expect(sent[0].summary).toBe("Marked the pre-calculation as sent");
  });

  it("keeps separate saves and other records apart", () => {
    const entries = formatHistory(
      [
        row({ entity: "quote", entityId: "q-pre", field: "total_excl_vat", newValue: "10", at: "2026-11-05T10:00:00Z" }),
        row({ entity: "quote", entityId: "q-pre", field: "total_excl_vat", newValue: "5", at: "2026-11-05T09:00:00Z" }),
        row({ entity: "assessment", field: "assessment_type", oldValue: "none", newValue: "smart_expertise", at: "2026-11-05T08:00:00Z" }),
      ],
      names,
    );
    expect(entries.map((entry) => entry.summary)).toEqual([
      "Updated the pre-calculation",
      "Updated the pre-calculation",
      "Updated the assessment",
    ]);
    expect(entries[2].changes).toEqual([{ label: "Assessment type", from: "None", to: "Smart Expertise" }]);
  });

  it("formats assessment amounts and the expert report", () => {
    expect(formatValue("assessment", "approved_amount_incl_vat", "1563.14", names)).toBe("€1,563.14");
    expect(formatValue("assessment", "expert_report_document_id", "doc-1", names)).toBe("expert-report.pdf");
    expect(formatValue("case", "deductible", "250", names)).toBe("€250.00");
  });
});

describe("invoicing and agent history", () => {
  it("names invoices and drafts created by an API client", () => {
    const entries = formatHistory(
      [
        row({ entity: "invoice", newValue: JSON.stringify({ direction: "sales", invoice_number: "SI-2026-0042" }), at: "2026-11-05T12:00:00Z" }),
        row({ entity: "invoice", newValue: JSON.stringify({ direction: "purchase", received: true }), at: "2026-11-05T11:00:00Z" }),
        row({ entity: "invoice", entityId: "inv-1", field: "amount_excl_vat", oldValue: "900", newValue: "870", at: "2026-11-05T10:30:00Z" }),
        row({
          entity: "outbound_message",
          newValue: JSON.stringify({ subject: "Missing data" }),
          actorType: "agent",
          actorId: null,
          at: "2026-11-05T10:00:00Z",
        }),
      ],
      names,
    );
    expect(entries.map((entry) => [entry.summary, entry.actor])).toEqual([
      ["Recorded the sales invoice SI-2026-0042", "Alex Morgan"],
      ["Recorded the repairer invoice", "Alex Morgan"],
      ["Updated the invoice", "Alex Morgan"],
      ["Drafted an e-mail: Missing data", "API client"],
    ]);
    expect(entries[2].changes).toEqual([{ label: "Amount excl. VAT", from: "€900.00", to: "€870.00" }]);
  });
});
