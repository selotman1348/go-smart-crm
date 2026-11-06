import { describe, expect, it } from "vitest";

import { CASE_NUMBER_PATTERN, parseCaseNumber } from "@/domain/cases/case-number";
import { CASE_STATUSES } from "@/domain/cases/case-status";

import { buildSeed, isValidBelgianVatNumber, money, SEED_USERS } from "./data";
import { seedId } from "./ids";

const users = { alex: seedId("test:alex"), sam: seedId("test:sam"), lena: seedId("test:lena") };
const seed = buildSeed(users);

const accountsById = new Map(seed.accounts.map((account) => [account.id, account]));
const sum = (values: number[]) => money(values.reduce((total, value) => total + value, 0));

describe("seed cases", () => {
  it("has 10 cases in 10 different statuses", () => {
    expect(seed.cases).toHaveLength(10);
    expect(new Set(seed.cases.map((item) => item.status)).size).toBe(10);
    for (const item of seed.cases) {
      expect(CASE_STATUSES).toContain(item.status);
    }
  });

  it("numbers every case as client code + year + sequence (BR-01)", () => {
    const numbers = seed.cases.map((item) => item.case_number);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const item of seed.cases) {
      expect(item.case_number).toMatch(CASE_NUMBER_PATTERN);
      const client = accountsById.get(item.client_account_id);
      expect(parseCaseNumber(item.case_number)?.clientCode).toBe(client?.client_code);
    }
  });

  it("numbers each client's cases per year without gaps", () => {
    const byClientYear = new Map<string, number[]>();
    for (const item of seed.cases) {
      const parsed = parseCaseNumber(item.case_number)!;
      const key = `${parsed.clientCode}${parsed.year}`;
      byClientYear.set(key, [...(byClientYear.get(key) ?? []), parsed.sequence]);
    }
    for (const sequences of byClientYear.values()) {
      expect(sequences.sort((a, b) => a - b)).toEqual(sequences.map((_, index) => index + 1));
    }
  });

  it("leaves DEM20260001 free for the demo script (plan.md section 5)", () => {
    expect(seed.cases.some((item) => item.case_number.startsWith("DEM2026"))).toBe(false);
  });

  it("ends each status history with the case's current status, in time order", () => {
    for (const item of seed.cases) {
      const history = seed.statusHistory
        .filter((step) => step.case_id === item.id)
        .map((step) => ({ ...step, time: Date.parse(step.changed_at!) }));
      expect(history[0].from_status).toBeNull();
      expect(history[0].to_status).toBe("client_assignment");
      expect(history.at(-1)?.to_status).toBe(item.status);
      for (let index = 1; index < history.length; index++) {
        expect(history[index].from_status).toBe(history[index - 1].to_status);
        expect(history[index].time).toBeGreaterThan(history[index - 1].time);
      }
      expect(history.at(-1)!.time).toBeLessThanOrEqual(Date.now());
    }
  });

  it("marks only quote validation (BR-03) as an automatic status change", () => {
    for (const step of seed.statusHistory.filter((entry) => entry.automatic)) {
      expect(step.to_status).toBe("followup_repairer_report_ok");
    }
  });

  it("writes an event for every status change and an audit entry for every transition", () => {
    const statusEvents = seed.events.filter((event) => event.type !== "quote.validated");
    expect(statusEvents).toHaveLength(seed.statusHistory.length);
    expect(seed.auditLog).toHaveLength(seed.statusHistory.length - seed.cases.length);
    expect(seed.events.filter((event) => event.type === "case.created")).toHaveLength(seed.cases.length);
  });

  it("has exactly one owner/fleet owner per case, and it is the client (BR-02)", () => {
    for (const item of seed.cases) {
      const owners = seed.caseParties.filter(
        (party) => party.case_id === item.id && party.role === "owner_fleet_owner",
      );
      expect(owners).toHaveLength(1);
      expect(owners[0].account_id).toBe(item.client_account_id);
    }
  });

  it("gives every party an account or a contact", () => {
    for (const party of seed.caseParties) {
      expect(party.account_id ?? party.contact_id).toBeTruthy();
    }
  });
});

describe("seed quotes", () => {
  const quotes = [...seed.preQuotes, ...seed.postQuotes];

  it("totals each quote from its lines", () => {
    for (const quote of quotes) {
      const lines = seed.quoteLines.filter((line) => line.quote_id === quote.id);
      expect(lines.length).toBeGreaterThan(0);
      expect(quote.total_excl_vat).toBe(sum(lines.map((line) => line.amount)));
    }
  });

  it("keeps deductions negative and sub-types within their category", () => {
    const subTypes: Record<string, string[]> = {
      labour: ["assembly_disassembly", "paintwork", "panel_work", "preparation", "finishing"],
      other_costs: [
        "environmental_fee", "anti_rust", "small_parts", "polishing", "covid_flat_fee",
        "cavity_protection", "diagnostics", "miscellaneous",
      ],
      deduction: ["previous_claim", "wear_and_tear"],
    };
    for (const line of seed.quoteLines) {
      if (line.category === "deduction") {
        expect(line.amount).toBeLessThanOrEqual(0);
      }
      if (line.sub_type) {
        expect(subTypes[line.category]).toContain(line.sub_type);
      }
    }
  });

  it("approves the post-calculation total in the assessment", () => {
    for (const assessment of seed.assessments) {
      const post = seed.postQuotes.find((quote) => quote.case_id === assessment.case_id);
      expect(assessment.approved_amount_excl_vat).toBe(post?.total_excl_vat);
      expect(assessment.approved_amount_incl_vat).toBe(money(post!.total_excl_vat! * 1.21));
    }
  });

  it("has a validated assessment for every case past quote validation", () => {
    const validated = new Set(seed.assessments.map((assessment) => assessment.case_id));
    for (const item of seed.cases) {
      const passedValidation = seed.statusHistory.some(
        (step) => step.case_id === item.id && step.to_status === "followup_repairer_report_ok",
      );
      expect(validated.has(item.id!)).toBe(passedValidation);
    }
  });

  it("has a repairer invoice for every case in invoicing (BR-08)", () => {
    for (const item of seed.cases.filter((entry) => entry.status?.startsWith("invoicing"))) {
      expect(seed.invoices.some((invoice) => invoice.case_id === item.id && invoice.received)).toBe(true);
    }
  });
});

describe("seed communications", () => {
  it("logs an assignment e-mail on every case and links every communication to a case", () => {
    const assignments = seed.communications.filter((item) => item.subject?.startsWith("New assignment"));
    expect(assignments).toHaveLength(seed.cases.length);
    const linked = new Set(seed.caseCommunications.map((link) => link.communication_id));
    expect(seed.communications.every((item) => linked.has(item.id!))).toBe(true);
  });

  it("uses only fictitious addresses", () => {
    const addresses = seed.communications.flatMap((item) => [item.from_address, ...(item.to_addresses ?? [])]).filter(Boolean);
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) {
      expect(address).toMatch(/@[a-z0-9-]+.example>$/);
    }
  });
});

describe("seed master data", () => {
  it("gives every client a unique client code, and only clients", () => {
    const codes = seed.accounts.map((account) => account.client_code).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
    for (const account of seed.accounts) {
      expect(account.client_code != null).toBe(account.account_type.includes("client"));
    }
  });

  it("has a group of companies (BR-02)", () => {
    const children = seed.accounts.filter((account) => account.parent_account_id);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(accountsById.has(child.parent_account_id!)).toBe(true);
    }
  });

  it("uses only fictitious e-mail addresses, VAT numbers, plates and VINs", () => {
    const emails = [
      ...seed.accounts.map((account) => account.email),
      ...seed.contacts.map((contact) => contact.email),
      ...SEED_USERS.map((user) => user.email),
    ];
    for (const email of emails) {
      expect(email).toMatch(/^[a-z0-9.]+@[a-z0-9-]+\.example$/);
    }
    for (const account of seed.accounts) {
      expect(account.vat_number).toMatch(/^BE0\d{9}$/);
      expect(isValidBelgianVatNumber(account.vat_number!)).toBe(false);
    }
    for (const vehicle of seed.vehicles) {
      expect(vehicle.licence_plate).toMatch(/^9-[A-Z]{3}-\d{3}$/);
      expect(vehicle.vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    }
  });

  it("produces the same ids on every run", () => {
    expect(buildSeed(users).cases.map((item) => item.id)).toEqual(seed.cases.map((item) => item.id));
  });
});

describe("isValidBelgianVatNumber", () => {
  it("accepts a number with a correct check value and rejects a wrong one", () => {
    // First 8 digits 01234567: 97 - (1234567 % 97) = 97 - 48 = 49.
    expect(isValidBelgianVatNumber("BE0123456749")).toBe(true);
    expect(isValidBelgianVatNumber("BE0123456750")).toBe(false);
  });
});
