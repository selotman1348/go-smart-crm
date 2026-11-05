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
