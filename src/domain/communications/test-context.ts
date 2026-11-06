import type { CaseMailContext, MailParty } from "./merge-fields";

// A fictitious case for the communication tests.

const party = (overrides: Partial<MailParty>): MailParty => ({
  role: "repairer",
  accountName: null,
  contactName: null,
  email: null,
  phone: null,
  address: null,
  invoicingConditions: null,
  discountPct: null,
  ...overrides,
});

export const context: CaseMailContext = {
  caseId: "33333333-3333-4333-8333-333333333333",
  caseNumber: "DEM20260001",
  insurerRef: "INS-778",
  brokerRef: "BRK-12",
  expertRef: null,
  policyNumber: "POL-1",
  vdaNumber: null,
  poNumber: null,
  appointmentRepairAt: "2026-11-10T07:00:00+00:00",
  client: { name: "Demo Fleet Rentals NV", address: "Fleetlaan 1, 2000 Antwerpen" },
  vehicle: { licencePlate: "1-ABC-123", make: "Volvo", model: "XC40", vin: null, firstRegistrationDate: "2024-03-01" },
  damage: { date: "2026-11-03", cause: "Rear-end collision", circumstances: "Collision with a vehicle", extraInfo: null, parts: ["Rear bumper"] },
  parties: [
    party({
      role: "repairer",
      accountName: "Riverside Body Shop BV",
      contactName: "Kevin Pauwels",
      email: "kevin@riverside-bodyshop.example",
      phone: "+32 3 555 01 01",
      address: "Kaai 5, 2000 Antwerpen",
      invoicingConditions: "Invoice within 30 days.",
      discountPct: 13,
    }),
    party({ role: "driver", accountName: "Demo Fleet Rentals NV", contactName: "Lena Claes", email: "lena.claes@example.com" }),
    party({ role: "intermediary", accountName: "Brightline Brokers", email: "claims@brightline-brokers.example" }),
  ],
};
