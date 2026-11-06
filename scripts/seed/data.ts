/**
 * Fictitious seed data (CLAUDE.md): Belgian-style formats, but no real
 * companies, people, e-mail addresses, VAT numbers, phone numbers or plates.
 *
 * - E-mail addresses use the reserved .example domain (RFC 2606).
 * - VAT numbers have deliberately wrong check digits.
 * - Phone numbers use a 000 subscriber range that is not issued.
 * - Licence plates use the 9- series, which is not issued yet.
 * - VINs use a made-up manufacturer prefix.
 * - Street names are invented ("Voorbeeldstraat" = "Example street").
 *
 * The demo client DEM has no case in 2026, so the demo's first e-mail case
 * becomes DEM20260001 (plan.md section 5).
 */
import type { CaseStatus } from "@/domain/cases/case-status";
import { formatCaseNumber } from "@/domain/cases/case-number";
import type { Database } from "@/lib/supabase/database.types";

import { seedId } from "./ids";

type Tables = Database["public"]["Tables"];
type Insert<T extends keyof Tables> = Tables[T]["Insert"];
type Enums = Database["public"]["Enums"];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const SEED_USERS = [
  { key: "alex", email: "alex.morgan@gosmart.example", fullName: "Alex Morgan", role: "Case handler" },
  { key: "sam", email: "sam.taylor@gosmart.example", fullName: "Sam Taylor", role: "Case manager" },
  { key: "lena", email: "lena.janssens@gosmart.example", fullName: "Lena Janssens", role: "Case handler" },
] as const;

export type SeedUserKey = (typeof SEED_USERS)[number]["key"];
export type SeedUserIds = Record<SeedUserKey, string>;

export function userSignature(user: (typeof SEED_USERS)[number]): string {
  return `Kind regards,\n${user.fullName}\n${user.role} – Go Smart`;
}

// ---------------------------------------------------------------------------
// Fictitious Belgian formats
// ---------------------------------------------------------------------------

const AREA_CODES: Record<string, string> = {
  Antwerpen: "3",
  Brugge: "50",
  Brussel: "2",
  Gent: "9",
  Hasselt: "11",
  Kortrijk: "56",
  Leuven: "16",
  "Liège": "4",
  Mechelen: "15",
  Wavre: "10",
};

const POSTCODES: Record<string, string> = {
  Antwerpen: "2000",
  Brugge: "8000",
  Brussel: "1000",
  Gent: "9000",
  Hasselt: "3500",
  Kortrijk: "8500",
  Leuven: "3000",
  "Liège": "4000",
  Mechelen: "2800",
  Wavre: "1300",
};

const STREETS = ["Voorbeeldstraat", "Fictielaan", "Demoplein", "Proeflaan", "Testweg", "Rue de l'Exemple"];

/** Belgian enterprise-number format with a check value that never validates. */
export function fictitiousVatNumber(index: number): string {
  const first8 = `0${String(4_100_000 + index * 7_919).padStart(7, "0").slice(-7)}`;
  const validCheck = 97 - (Number(first8) % 97);
  const wrongCheck = validCheck === 97 ? 1 : validCheck + 1;
  return `BE${first8}${String(wrongCheck).padStart(2, "0")}`;
}

export function isValidBelgianVatNumber(vat: string): boolean {
  const match = /^BE([01]\d{7})(\d{2})$/.exec(vat);
  return match !== null && 97 - (Number(match[1]) % 97) === Number(match[2]);
}

function phone(city: string, index: number): string {
  return `+32 ${AREA_CODES[city]} 000 ${String(10 + index).padStart(2, "0")} ${String(10 + ((index * 7) % 90)).padStart(2, "0")}`;
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

const REPAIRER_INVOICING_CONDITIONS =
  "Invoice Go Smart with the agreed total discount of 13% (8% for the client and 5% commission). " +
  "Send the invoice to invoices@gosmart.example and always state the case number.";

type AccountSeed = {
  key: string;
  name: string;
  domain: string;
  types: Enums["account_type"][];
  city: string;
  clientCode?: string;
  parent?: string;
  requiresVdaPo?: boolean;
  repairer?: { discountPct: number | null; network: boolean };
};

const ACCOUNTS: AccountSeed[] = [
  { key: "velora-group", name: "Velora Mobility Group NV", domain: "velora-group", types: ["client"], clientCode: "VMG", city: "Antwerpen" },
  // BR-11: the car-rental client needs VDA and PO references.
  { key: "velora-rental", name: "Velora Car Rental NV", domain: "velora-rental", types: ["client"], clientCode: "VCR", parent: "velora-group", requiresVdaPo: true, city: "Antwerpen" },
  { key: "velora-fleet", name: "Velora Fleet Services NV", domain: "velora-fleet", types: ["client"], clientCode: "VFS", parent: "velora-group", city: "Mechelen" },
  { key: "demo-fleet", name: "Demo Fleet BV", domain: "demofleet", types: ["client"], clientCode: "DEM", city: "Gent" },
  { key: "harbourline", name: "Harbourline Insurance Brokers BV", domain: "harbourline", types: ["broker"], city: "Brussel" },
  { key: "keystone", name: "Keystone Brokerage NV", domain: "keystone-brokerage", types: ["broker"], city: "Leuven" },
  { key: "atlas", name: "Atlas Mutual Insurance NV", domain: "atlas-mutual", types: ["insurer"], city: "Brussel" },
  { key: "meridian", name: "Meridian Assurance SA", domain: "meridian-assurance", types: ["insurer"], city: "Liège" },
  { key: "precision", name: "Precision Claims Experts BV", domain: "precision-claims", types: ["expert"], city: "Gent" },
  { key: "clearview", name: "ClearView Assessments BV", domain: "clearview-assessments", types: ["expert"], city: "Hasselt" },
  { key: "summit", name: "Summit Auto Lease NV", domain: "summit-lease", types: ["leasing_company"], city: "Brussel" },
  { key: "orbit", name: "Orbit Lease Solutions NV", domain: "orbit-lease", types: ["leasing_company"], city: "Wavre" },
  { key: "riverside", name: "Riverside Body Shop BV", domain: "riverside-bodyshop", types: ["repairer"], city: "Antwerpen", repairer: { discountPct: 13, network: true } },
  { key: "northgate", name: "Northgate Carrosserie BV", domain: "northgate-carrosserie", types: ["repairer"], city: "Mechelen", repairer: { discountPct: 13, network: true } },
  { key: "lakeside", name: "Lakeside Collision Centre NV", domain: "lakeside-collision", types: ["repairer"], city: "Gent", repairer: { discountPct: 13, network: true } },
  { key: "hillcrest", name: "Hillcrest Car Repair BV", domain: "hillcrest-carrepair", types: ["repairer"], city: "Leuven", repairer: { discountPct: null, network: false } },
  { key: "partsworks", name: "PartsWorks Supplies BV", domain: "partsworks", types: ["supplier"], city: "Kortrijk" },
  { key: "brightline", name: "Brightline Couriers BV", domain: "brightline-couriers", types: ["third_party"], city: "Brugge" },
];

type AccountKey = (typeof ACCOUNTS)[number]["key"];

const accountId = (key: AccountKey) => seedId(`account:${key}`);

function accountSeedByKey(key: AccountKey): AccountSeed {
  const account = ACCOUNTS.find((candidate) => candidate.key === key);
  if (!account) {
    throw new Error(`Unknown seed account "${key}"`);
  }
  return account;
}

const accountMailbox = (key: AccountKey) => {
  const account = accountSeedByKey(key);
  return `${account.name} <info@${account.domain}.example>`;
};

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

type ContactSeed = {
  key: string;
  account: AccountKey;
  salutation: "Mr" | "Ms";
  firstName: string;
  lastName: string;
};

const CONTACTS: ContactSeed[] = [
  { key: "lotte-wouters", account: "velora-rental", salutation: "Ms", firstName: "Lotte", lastName: "Wouters" },
  { key: "jonas-maes", account: "velora-rental", salutation: "Mr", firstName: "Jonas", lastName: "Maes" },
  { key: "emma-claes", account: "velora-rental", salutation: "Ms", firstName: "Emma", lastName: "Claes" },
  { key: "lucas-hermans", account: "velora-rental", salutation: "Mr", firstName: "Lucas", lastName: "Hermans" },
  { key: "wout-lemmens", account: "velora-rental", salutation: "Mr", firstName: "Wout", lastName: "Lemmens" },
  { key: "bram-desmet", account: "velora-fleet", salutation: "Mr", firstName: "Bram", lastName: "De Smet" },
  { key: "noor-goossens", account: "velora-fleet", salutation: "Ms", firstName: "Noor", lastName: "Goossens" },
  { key: "arthur-jacobs", account: "velora-fleet", salutation: "Mr", firstName: "Arthur", lastName: "Jacobs" },
  { key: "pieter-lambrechts", account: "velora-group", salutation: "Mr", firstName: "Pieter", lastName: "Lambrechts" },
  { key: "sara-michiels", account: "demo-fleet", salutation: "Ms", firstName: "Sara", lastName: "Michiels" },
  { key: "milan-willems", account: "demo-fleet", salutation: "Mr", firstName: "Milan", lastName: "Willems" },
  { key: "louise-mertens", account: "harbourline", salutation: "Ms", firstName: "Louise", lastName: "Mertens" },
  { key: "victor-aerts", account: "keystone", salutation: "Mr", firstName: "Victor", lastName: "Aerts" },
  { key: "marie-dubois", account: "atlas", salutation: "Ms", firstName: "Marie", lastName: "Dubois" },
  { key: "thomas-lambert", account: "meridian", salutation: "Mr", firstName: "Thomas", lastName: "Lambert" },
  { key: "elise-dupont", account: "precision", salutation: "Ms", firstName: "Elise", lastName: "Dupont" },
  { key: "ruben-vermeulen", account: "clearview", salutation: "Mr", firstName: "Ruben", lastName: "Vermeulen" },
  { key: "julie-cools", account: "summit", salutation: "Ms", firstName: "Julie", lastName: "Cools" },
  { key: "nathan-renard", account: "orbit", salutation: "Mr", firstName: "Nathan", lastName: "Renard" },
  { key: "kevin-pauwels", account: "riverside", salutation: "Mr", firstName: "Kevin", lastName: "Pauwels" },
  { key: "hanne-verstraeten", account: "northgate", salutation: "Ms", firstName: "Hanne", lastName: "Verstraeten" },
  { key: "jasper-martens", account: "lakeside", salutation: "Mr", firstName: "Jasper", lastName: "Martens" },
  { key: "ilse-smets", account: "hillcrest", salutation: "Ms", firstName: "Ilse", lastName: "Smets" },
  { key: "dirk-peeters", account: "partsworks", salutation: "Mr", firstName: "Dirk", lastName: "Peeters" },
  { key: "yusuf-demir", account: "brightline", salutation: "Mr", firstName: "Yusuf", lastName: "Demir" },
];

type ContactKey = (typeof CONTACTS)[number]["key"];

const contactId = (key: ContactKey) => seedId(`contact:${key}`);

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

type VehicleSeed = {
  key: string;
  plate: string;
  make: string;
  model: string;
  typeDesignation: string;
  modelYear: number;
  firstRegistration: string;
  category: Enums["vehicle_category"];
  colour: string;
  paintType: string;
  owner: AccountKey;
  leasing?: AccountKey;
  powerKw: number;
  seats: number;
};

const VEHICLES: VehicleSeed[] = [
  { key: "v01", plate: "9-TKA-101", make: "Volkswagen", model: "Golf", typeDesignation: "Golf 1.5 eTSI Life", modelYear: 2023, firstRegistration: "2023-03-14", category: "petrol", colour: "White", paintType: "Solid", owner: "velora-rental", powerKw: 110, seats: 5 },
  { key: "v02", plate: "9-TKB-214", make: "Skoda", model: "Octavia Combi", typeDesignation: "Octavia Combi 2.0 TDI Style", modelYear: 2022, firstRegistration: "2022-09-02", category: "diesel", colour: "Grey metallic", paintType: "Metallic", owner: "velora-rental", leasing: "summit", powerKw: 110, seats: 5 },
  { key: "v03", plate: "9-TKC-327", make: "Tesla", model: "Model 3", typeDesignation: "Model 3 Long Range AWD", modelYear: 2024, firstRegistration: "2024-02-21", category: "electric", colour: "Blue metallic", paintType: "Metallic", owner: "velora-rental", powerKw: 366, seats: 5 },
  { key: "v04", plate: "9-TKD-438", make: "Toyota", model: "Corolla Touring Sports", typeDesignation: "Corolla TS 1.8 Hybrid", modelYear: 2023, firstRegistration: "2023-06-08", category: "hybrid", colour: "Silver", paintType: "Metallic", owner: "velora-rental", powerKw: 103, seats: 5 },
  { key: "v05", plate: "9-TKE-549", make: "Peugeot", model: "308 SW", typeDesignation: "308 SW Hybrid 180 e-EAT8", modelYear: 2024, firstRegistration: "2024-04-30", category: "hybrid", colour: "Black", paintType: "Pearl", owner: "velora-rental", powerKw: 133, seats: 5 },
  { key: "v06", plate: "9-TKF-650", make: "Volvo", model: "XC40", typeDesignation: "XC40 Recharge Single Motor", modelYear: 2023, firstRegistration: "2023-01-17", category: "electric", colour: "White", paintType: "Solid", owner: "velora-fleet", leasing: "orbit", powerKw: 175, seats: 5 },
  { key: "v07", plate: "9-TKG-761", make: "Ford", model: "Transit Custom", typeDesignation: "Transit Custom 2.0 EcoBlue L1H1", modelYear: 2022, firstRegistration: "2022-05-11", category: "light_van", colour: "White", paintType: "Solid", owner: "velora-fleet", powerKw: 96, seats: 3 },
  { key: "v08", plate: "9-TKH-872", make: "Renault", model: "Kangoo Van", typeDesignation: "Kangoo Van E-Tech Electric", modelYear: 2023, firstRegistration: "2023-08-25", category: "light_van", colour: "Grey", paintType: "Solid", owner: "velora-fleet", powerKw: 90, seats: 2 },
  { key: "v09", plate: "9-TKJ-983", make: "BMW", model: "3 Series Touring", typeDesignation: "320d Touring", modelYear: 2021, firstRegistration: "2021-11-03", category: "diesel", colour: "Black metallic", paintType: "Metallic", owner: "velora-fleet", leasing: "summit", powerKw: 140, seats: 5 },
  { key: "v10", plate: "9-TKK-194", make: "Kia", model: "Niro EV", typeDesignation: "Niro EV 64.8 kWh", modelYear: 2024, firstRegistration: "2024-07-12", category: "electric", colour: "Green metallic", paintType: "Metallic", owner: "demo-fleet", powerKw: 150, seats: 5 },
  { key: "v11", plate: "9-TKL-205", make: "Citroën", model: "Berlingo Van", typeDesignation: "Berlingo Van 1.5 BlueHDi M", modelYear: 2022, firstRegistration: "2022-02-28", category: "light_van", colour: "White", paintType: "Solid", owner: "demo-fleet", powerKw: 75, seats: 3 },
  { key: "v12", plate: "9-TKM-316", make: "Audi", model: "A4 Avant", typeDesignation: "A4 Avant 35 TDI", modelYear: 2022, firstRegistration: "2022-10-19", category: "diesel", colour: "Grey metallic", paintType: "Metallic", owner: "velora-group", powerKw: 120, seats: 5 },
];

type VehicleKey = (typeof VEHICLES)[number]["key"];

const vehicleId = (key: VehicleKey) => seedId(`vehicle:${key}`);

/** 17 characters without I, O or Q; the "GSD" prefix is not a real manufacturer code. */
function fictitiousVin(index: number): string {
  return `GSDEMV${String(index).padStart(11, "0")}`;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const TAGS = ["Priority", "Electric vehicle", "Fleet contract"] as const;
type TagName = (typeof TAGS)[number];
const tagId = (name: TagName) => seedId(`tag:${name}`);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

type LineSeed =
  | {
      category: "labour";
      subType: Enums["quote_line_sub_type"];
      description: string;
      hours: number;
      rate: "paint" | "assembly";
    }
  | {
      category: Exclude<Enums["quote_line_category"], "labour">;
      subType?: Enums["quote_line_sub_type"];
      description: string;
      amount: number;
    };

type QuoteSeed = {
  origin: Enums["quote_origin"];
  status: Enums["quote_status"];
  rates: { paint: number; assembly: number };
  lines: LineSeed[];
};

type CaseSeed = {
  client: AccountKey;
  year: number;
  sequence: number;
  vehicle: VehicleKey;
  manager: SeedUserKey;
  assignedTo: SeedUserKey;
  /** Status path; the last entry is the current status. */
  history: { status: CaseStatus; at: string; automatic?: boolean }[];
  parties: { role: Enums["party_role"]; account?: AccountKey; contact?: ContactKey }[];
  header?: Partial<Insert<"case">>;
  damage: Omit<Insert<"damage">, "case_id" | "id"> & { city: string; parts: string[] };
  pre?: QuoteSeed;
  /** "copy": copied from the pre-calculation (UC-21). */
  post?: "copy" | QuoteSeed;
  assessment?: Omit<
    Insert<"assessment">,
    "case_id" | "id" | "approved_amount_excl_vat" | "approved_amount_incl_vat" | "validated_at" | "validated_by"
  >;
  purchaseInvoice?: { invoiceNumber: string; receivedDate: string };
  tags?: TagName[];
};

const RIVERSIDE_RATES = { paint: 62, assembly: 58 };
const NORTHGATE_RATES = { paint: 60, assembly: 56 };
const LAKESIDE_RATES = { paint: 68, assembly: 64 };

const CASES: CaseSeed[] = [
  {
    client: "velora-rental",
    year: 2026,
    sequence: 1,
    vehicle: "v01",
    manager: "sam",
    assignedTo: "alex",
    history: [
      { status: "client_assignment", at: "2026-03-02T09:15:00+01:00" },
      { status: "followup_repairer", at: "2026-03-03T10:05:00+01:00" },
      { status: "followup_broker_insurer", at: "2026-03-09T14:30:00+01:00" },
      { status: "followup_repairer_report_ok", at: "2026-03-12T11:00:00+01:00", automatic: true },
      { status: "invoicing_other", at: "2026-04-02T09:40:00+02:00" },
      { status: "invoicing_ok", at: "2026-04-06T15:20:00+02:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-rental" },
      { role: "driver", contact: "jonas-maes" },
      { role: "intermediary", account: "harbourline", contact: "louise-mertens" },
      { role: "insurer", account: "atlas" },
      { role: "repairer", account: "riverside", contact: "kevin-pauwels" },
    ],
    header: {
      insurer_ref: "ATL-26-004211",
      broker_ref: "HLB-26-0187",
      policy_number: "POL-778-1042",
      cover_type: "Comprehensive",
      vda_number: "VDA-26-00412",
      po_number: "PO-4500017311",
      vat_liable_pct: 35,
      deductible: 250,
      assignment_date: "2026-03-02",
      appointment_estimate_at: "2026-03-05T10:00:00+01:00",
      appointment_repair_at: "2026-03-23T08:30:00+01:00",
      vehicle_in_date: "2026-03-23",
      vehicle_ready_date: "2026-03-26",
      client_notified_date: "2026-03-26",
      vehicle_out_date: "2026-03-27",
      completion_date: "2026-03-26",
      repair_decision: "repair",
    },
    damage: {
      damage_date: "2026-02-27",
      mileage_in: 41250,
      mileage_out: 41262,
      address_line1: "Voorbeeldstraat 1",
      city: "Antwerpen",
      cause: "Rear-end collision while waiting at traffic lights.",
      liability: "third_party_fault",
      circumstances: "collision_vehicle",
      parts: ["rear_bumper", "tail_light_left", "boot"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: RIVERSIDE_RATES,
      lines: [
        { category: "labour", subType: "assembly_disassembly", description: "Remove and refit rear bumper and tail light", hours: 2.5, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint rear bumper and boot lid", hours: 4, rate: "paint" },
        { category: "parts", description: "Rear bumper cover", amount: 412.3 },
        { category: "parts", description: "Tail light left", amount: 286.9 },
        { category: "paint_products", description: "Paint and materials", amount: 168.4 },
        { category: "other_costs", subType: "environmental_fee", description: "Environmental fee", amount: 12.5 },
        { category: "other_costs", subType: "small_parts", description: "Clips and small parts", amount: 18.75 },
      ],
    },
    post: "copy",
    assessment: { assessment_type: "approval_without_expert", vat_applicable: true, loss_of_use_days: 3 },
    purchaseInvoice: { invoiceNumber: "RBS-2026-0412", receivedDate: "2026-04-02" },
    tags: ["Fleet contract"],
  },
  {
    client: "velora-rental",
    year: 2026,
    sequence: 2,
    vehicle: "v02",
    manager: "sam",
    assignedTo: "lena",
    history: [
      { status: "client_assignment", at: "2026-10-12T08:50:00+02:00" },
      { status: "followup_repairer", at: "2026-10-13T11:20:00+02:00" },
      { status: "followup_broker_insurer", at: "2026-10-19T16:05:00+02:00" },
      { status: "followup_repairer_report_ok", at: "2026-10-23T10:30:00+02:00", automatic: true },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-rental" },
      { role: "driver", contact: "emma-claes" },
      { role: "leasing_company", account: "summit", contact: "julie-cools" },
      { role: "intermediary", account: "keystone", contact: "victor-aerts" },
      { role: "insurer", account: "meridian" },
      { role: "repairer", account: "northgate", contact: "hanne-verstraeten" },
    ],
    header: {
      insurer_ref: "MER-26-118734",
      broker_ref: "KSB-26-0642",
      leasing_ref: "SAL-LC-88213",
      policy_number: "POL-912-5530",
      cover_type: "Comprehensive",
      vda_number: "VDA-26-01877",
      po_number: "PO-4500019204",
      vat_liable_pct: 35,
      deductible: 500,
      assignment_date: "2026-10-12",
      appointment_estimate_at: "2026-10-15T09:30:00+02:00",
      appointment_repair_at: "2026-11-10T08:00:00+01:00",
      repair_decision: "repair",
    },
    damage: {
      damage_date: "2026-10-09",
      mileage_in: 68420,
      address_line1: "Fictielaan 14",
      city: "Mechelen",
      cause: "Door and wing dented by another car while parked.",
      liability: "own_fault",
      circumstances: "parking",
      parts: ["front_door_left", "front_wing_left"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: NORTHGATE_RATES,
      lines: [
        { category: "labour", subType: "panel_work", description: "Repair dent in front door left", hours: 3, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint front door and front wing left", hours: 5, rate: "paint" },
        { category: "paint_products", description: "Paint and materials", amount: 196.2 },
        { category: "other_costs", subType: "small_parts", description: "Small parts", amount: 14.6 },
      ],
    },
    post: "copy",
    assessment: { assessment_type: "approval_without_expert", vat_applicable: true, loss_of_use_days: 2 },
  },
  {
    client: "velora-rental",
    year: 2026,
    sequence: 3,
    vehicle: "v03",
    manager: "alex",
    assignedTo: "alex",
    history: [
      { status: "client_assignment", at: "2026-10-26T09:00:00+01:00" },
      { status: "followup_repairer", at: "2026-10-27T10:45:00+01:00" },
      { status: "followup_broker_insurer", at: "2026-11-02T15:10:00+01:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-rental" },
      { role: "driver", contact: "lucas-hermans" },
      { role: "intermediary", account: "harbourline", contact: "louise-mertens" },
      { role: "insurer", account: "atlas", contact: "marie-dubois" },
      { role: "repairer", account: "lakeside", contact: "jasper-martens" },
      { role: "third_party", account: "brightline", contact: "yusuf-demir" },
    ],
    header: {
      insurer_ref: "ATL-26-009870",
      broker_ref: "HLB-26-0931",
      policy_number: "POL-778-2214",
      cover_type: "Third-party liability",
      vda_number: "VDA-26-02311",
      po_number: "PO-4500020118",
      vat_liable_pct: 35,
      deductible: 250,
      assignment_date: "2026-10-26",
      appointment_estimate_at: "2026-10-29T13:00:00+01:00",
    },
    damage: {
      damage_date: "2026-10-24",
      mileage_in: 22870,
      address_line1: "Demoplein 3",
      city: "Gent",
      cause: "Delivery van reversed into the front of the parked car.",
      liability: "third_party_fault",
      circumstances: "collision_vehicle",
      parts: ["front_bumper", "headlight_right", "bonnet"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: LAKESIDE_RATES,
      lines: [
        { category: "labour", subType: "assembly_disassembly", description: "Remove and refit front bumper and headlight", hours: 3.5, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint front bumper and bonnet", hours: 6, rate: "paint" },
        { category: "parts", description: "Front bumper cover", amount: 689 },
        { category: "parts", description: "Headlight right (LED)", amount: 1245 },
        { category: "paint_products", description: "Paint and materials", amount: 231.5 },
        { category: "other_costs", subType: "diagnostics", description: "Driver-assistance camera calibration", amount: 185 },
        { category: "other_costs", subType: "environmental_fee", description: "Environmental fee", amount: 12.5 },
      ],
    },
    tags: ["Electric vehicle", "Priority"],
  },
  {
    client: "velora-rental",
    year: 2026,
    sequence: 4,
    vehicle: "v05",
    manager: "alex",
    assignedTo: "alex",
    history: [
      { status: "client_assignment", at: "2026-11-04T10:10:00+01:00" },
      { status: "intake_first_contact", at: "2026-11-04T16:30:00+01:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-rental" },
      { role: "driver", contact: "emma-claes" },
      { role: "intermediary", account: "keystone", contact: "victor-aerts" },
      { role: "insurer", account: "meridian", contact: "thomas-lambert" },
    ],
    header: {
      broker_ref: "KSB-26-0718",
      policy_number: "POL-912-6017",
      vda_number: "VDA-26-02390",
      assignment_date: "2026-11-04",
    },
    damage: {
      damage_date: "2026-11-02",
      mileage_in: 15310,
      city: "Leuven",
      cause: "Hailstorm damage on the roof and bonnet.",
      liability: "unknown",
      circumstances: "weather",
      parts: ["roof", "bonnet"],
    },
  },
  {
    client: "velora-rental",
    year: 2026,
    sequence: 5,
    vehicle: "v04",
    manager: "sam",
    assignedTo: "lena",
    history: [{ status: "client_assignment", at: "2026-11-05T08:45:00+01:00" }],
    parties: [
      { role: "owner_fleet_owner", account: "velora-rental" },
      { role: "driver", contact: "wout-lemmens" },
    ],
    // VDA and PO numbers still missing (BR-11).
    header: { broker_ref: "HLB-26-1002", assignment_date: "2026-11-05" },
    damage: {
      damage_date: "2026-11-03",
      city: "Antwerpen",
      cause: "Right side mirror hit by a passing van.",
      circumstances: "collision_vehicle",
      parts: ["side_mirror_right"],
    },
  },
  {
    client: "velora-fleet",
    year: 2026,
    sequence: 1,
    vehicle: "v06",
    manager: "sam",
    assignedTo: "lena",
    history: [
      { status: "client_assignment", at: "2026-04-14T09:30:00+02:00" },
      { status: "followup_repairer", at: "2026-04-15T10:00:00+02:00" },
      { status: "followup_broker_insurer", at: "2026-04-21T14:45:00+02:00" },
      { status: "followup_expert", at: "2026-04-23T11:15:00+02:00" },
      { status: "followup_repairer_report_ok", at: "2026-05-04T16:20:00+02:00", automatic: true },
      { status: "invoicing_other", at: "2026-05-29T09:05:00+02:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-fleet" },
      { role: "driver", contact: "noor-goossens" },
      { role: "leasing_company", account: "orbit", contact: "nathan-renard" },
      { role: "intermediary", account: "harbourline", contact: "louise-mertens" },
      { role: "insurer", account: "atlas" },
      { role: "expert", account: "precision", contact: "elise-dupont" },
      { role: "repairer", account: "riverside", contact: "kevin-pauwels" },
    ],
    header: {
      insurer_ref: "ATL-26-005102",
      broker_ref: "HLB-26-0344",
      expert_ref: "PCE-26-1093",
      leasing_ref: "OLS-77120",
      policy_number: "POL-778-1388",
      cover_type: "Comprehensive",
      vat_liable_pct: 50,
      deductible: 500,
      assignment_date: "2026-04-14",
      appointment_repair_at: "2026-05-11T08:00:00+02:00",
      vehicle_in_date: "2026-05-11",
      vehicle_ready_date: "2026-05-15",
      client_notified_date: "2026-05-15",
      vehicle_out_date: "2026-05-16",
      completion_date: "2026-05-15",
      repair_decision: "repair",
    },
    damage: {
      damage_date: "2026-04-10",
      mileage_in: 35990,
      mileage_out: 36004,
      address_line1: "Proeflaan 45",
      city: "Mechelen",
      cause: "Hit a concrete bollard while turning into a car park.",
      liability: "own_fault",
      circumstances: "collision_object",
      parts: ["front_bumper", "front_wing_right", "headlight_right", "wheel_rim_front_right"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: RIVERSIDE_RATES,
      lines: [
        { category: "labour", subType: "assembly_disassembly", description: "Remove and refit front bumper, headlight and wheel", hours: 4, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint front bumper and front wing right", hours: 6.5, rate: "paint" },
        { category: "parts", description: "Front bumper cover", amount: 734 },
        { category: "parts", description: "Headlight right", amount: 968.4 },
        { category: "parts", description: "Wheel rim front right", amount: 389 },
        { category: "paint_products", description: "Paint and materials", amount: 245.8 },
        { category: "other_costs", subType: "environmental_fee", description: "Environmental fee", amount: 12.5 },
        { category: "other_costs", subType: "small_parts", description: "Clips and small parts", amount: 22.3 },
      ],
    },
    // Figures from the expert report (UC-24).
    post: {
      origin: "expert",
      status: "validated",
      rates: RIVERSIDE_RATES,
      lines: [
        { category: "labour", subType: "assembly_disassembly", description: "Remove and refit front bumper, headlight and wheel", hours: 3.5, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint front bumper and front wing right", hours: 6, rate: "paint" },
        { category: "parts", description: "Front bumper cover", amount: 734 },
        { category: "parts", description: "Headlight right", amount: 968.4 },
        { category: "parts", description: "Wheel rim front right", amount: 389 },
        { category: "paint_products", description: "Paint and materials", amount: 230 },
        { category: "other_costs", subType: "environmental_fee", description: "Environmental fee", amount: 12.5 },
        { category: "other_costs", subType: "small_parts", description: "Clips and small parts", amount: 22.3 },
        { category: "deduction", subType: "previous_claim", description: "Earlier damage on the front wing, not part of this claim", amount: -150 },
      ],
    },
    // BR-04: remote assessment = Smart Expertise; BR-05: repair days = loss-of-use days.
    assessment: {
      assessment_type: "smart_expertise",
      expert_account_id: seedId("account:precision"),
      vat_applicable: true,
      loss_of_use_days: 4,
    },
    purchaseInvoice: { invoiceNumber: "RBS-2026-0577", receivedDate: "2026-05-28" },
    tags: ["Electric vehicle"],
  },
  {
    client: "velora-fleet",
    year: 2026,
    sequence: 2,
    vehicle: "v08",
    manager: "sam",
    assignedTo: "alex",
    history: [
      { status: "client_assignment", at: "2026-07-20T09:10:00+02:00" },
      { status: "followup_repairer", at: "2026-07-21T10:30:00+02:00" },
      { status: "followup_broker_insurer", at: "2026-07-27T13:40:00+02:00" },
      { status: "followup_expert", at: "2026-07-29T09:55:00+02:00" },
      { status: "followup_repairer_report_ok", at: "2026-08-10T15:00:00+02:00", automatic: true },
      { status: "followup_delay", at: "2026-08-24T11:25:00+02:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-fleet" },
      { role: "driver", contact: "arthur-jacobs" },
      { role: "intermediary", account: "harbourline", contact: "louise-mertens" },
      { role: "insurer", account: "atlas" },
      { role: "expert", account: "precision", contact: "elise-dupont" },
      { role: "repairer", account: "lakeside", contact: "jasper-martens" },
    ],
    header: {
      insurer_ref: "ATL-26-007456",
      broker_ref: "HLB-26-0612",
      expert_ref: "PCE-26-1420",
      policy_number: "POL-778-1931",
      cover_type: "Comprehensive",
      vat_liable_pct: 100,
      deductible: 250,
      assignment_date: "2026-07-20",
      appointment_repair_at: "2026-11-23T08:00:00+01:00",
      on_hold: true,
      on_hold_reason: "awaiting_parts",
      on_hold_reason_text: "Sliding door panel back-ordered by the manufacturer; delivery expected in week 47.",
      repair_decision: "repair",
    },
    damage: {
      damage_date: "2026-07-17",
      mileage_in: 28115,
      address_line1: "Testweg 21",
      city: "Gent",
      cause: "Sliding door scraped along a loading-dock pillar.",
      liability: "own_fault",
      circumstances: "collision_object",
      parts: ["rear_door_left", "side_window_rear_left"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: LAKESIDE_RATES,
      lines: [
        { category: "labour", subType: "assembly_disassembly", description: "Replace sliding door panel and rear side window", hours: 5, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint sliding door", hours: 4.5, rate: "paint" },
        { category: "parts", description: "Sliding door panel left", amount: 1386 },
        { category: "parts", description: "Rear side window left", amount: 274.6 },
        { category: "paint_products", description: "Paint and materials", amount: 188.9 },
        { category: "other_costs", subType: "cavity_protection", description: "Cavity protection", amount: 45 },
      ],
    },
    post: "copy",
    // BR-04: inspected at the repairer = On site.
    assessment: {
      assessment_type: "on_site",
      expert_account_id: seedId("account:precision"),
      vat_applicable: true,
      loss_of_use_days: 5,
    },
    tags: ["Priority"],
  },
  {
    client: "velora-fleet",
    year: 2026,
    sequence: 3,
    vehicle: "v07",
    manager: "alex",
    assignedTo: "alex",
    history: [
      { status: "client_assignment", at: "2026-09-28T08:40:00+02:00" },
      { status: "followup_repairer", at: "2026-09-29T09:15:00+02:00" },
      { status: "followup_broker_insurer", at: "2026-10-05T14:00:00+02:00" },
      { status: "followup_expert", at: "2026-10-08T10:20:00+02:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-fleet" },
      { role: "driver", contact: "arthur-jacobs" },
      { role: "intermediary", account: "keystone", contact: "victor-aerts" },
      { role: "insurer", account: "meridian", contact: "thomas-lambert" },
      { role: "expert", account: "clearview", contact: "ruben-vermeulen" },
      { role: "repairer", account: "northgate", contact: "hanne-verstraeten" },
    ],
    header: {
      insurer_ref: "MER-26-120551",
      broker_ref: "KSB-26-0588",
      expert_ref: "CVA-26-0571",
      policy_number: "POL-912-4471",
      cover_type: "Comprehensive",
      vat_liable_pct: 100,
      deductible: 500,
      assignment_date: "2026-09-28",
    },
    damage: {
      damage_date: "2026-09-25",
      mileage_in: 91540,
      address_line1: "Rue de l'Exemple 7",
      city: "Wavre",
      cause: "Side-swiped by a lorry on the motorway.",
      liability: "shared",
      circumstances: "collision_vehicle",
      parts: ["rear_door_right", "rear_wing_right", "tail_light_right"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: NORTHGATE_RATES,
      lines: [
        { category: "labour", subType: "panel_work", description: "Straighten rear wing right", hours: 6, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint rear door and rear wing right", hours: 7, rate: "paint" },
        { category: "parts", description: "Rear door right", amount: 1120 },
        { category: "parts", description: "Tail light right", amount: 214.5 },
        { category: "paint_products", description: "Paint and materials", amount: 265.4 },
        { category: "other_costs", subType: "environmental_fee", description: "Environmental fee", amount: 12.5 },
      ],
    },
  },
  {
    client: "velora-fleet",
    year: 2026,
    sequence: 4,
    vehicle: "v09",
    manager: "lena",
    assignedTo: "lena",
    history: [
      { status: "client_assignment", at: "2026-10-30T09:25:00+01:00" },
      { status: "followup_repairer", at: "2026-10-31T11:40:00+01:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "velora-fleet" },
      { role: "driver", contact: "bram-desmet" },
      { role: "leasing_company", account: "summit", contact: "julie-cools" },
      { role: "intermediary", account: "keystone", contact: "victor-aerts" },
      { role: "insurer", account: "meridian" },
      { role: "repairer", account: "hillcrest", contact: "ilse-smets" },
    ],
    header: {
      broker_ref: "KSB-26-0731",
      leasing_ref: "SAL-LC-90455",
      policy_number: "POL-912-6102",
      cover_type: "Comprehensive",
      vat_liable_pct: 50,
      deductible: 250,
      assignment_date: "2026-10-30",
      appointment_estimate_at: "2026-11-06T14:00:00+01:00",
    },
    damage: {
      damage_date: "2026-10-28",
      mileage_in: 120480,
      city: "Leuven",
      cause: "Scratches along the left side and a broken mirror (vandalism).",
      liability: "unknown",
      circumstances: "vandalism",
      parts: ["side_mirror_left", "front_door_left", "rear_door_left"],
    },
  },
  {
    client: "demo-fleet",
    year: 2025,
    sequence: 1,
    vehicle: "v10",
    manager: "sam",
    assignedTo: "alex",
    history: [
      { status: "client_assignment", at: "2025-11-18T09:00:00+01:00" },
      { status: "followup_repairer", at: "2025-11-19T10:10:00+01:00" },
      { status: "followup_broker_insurer", at: "2025-11-26T15:30:00+01:00" },
      { status: "closed", at: "2025-12-03T11:45:00+01:00" },
    ],
    parties: [
      { role: "owner_fleet_owner", account: "demo-fleet" },
      { role: "driver", contact: "milan-willems" },
      { role: "intermediary", account: "harbourline", contact: "louise-mertens" },
      { role: "insurer", account: "atlas" },
      { role: "repairer", account: "riverside", contact: "kevin-pauwels" },
    ],
    // BR-07: "no repair" with a reason; the repairer was notified.
    header: {
      insurer_ref: "ATL-25-019935",
      broker_ref: "HLB-25-2210",
      policy_number: "POL-778-0815",
      cover_type: "Comprehensive",
      vat_liable_pct: 35,
      deductible: 250,
      assignment_date: "2025-11-18",
      completion_date: "2025-12-03",
      repair_decision: "no_repair",
      no_repair_reason: "cash_settlement",
      no_repair_reason_text: "The broker agreed a cash settlement with the client.",
    },
    damage: {
      damage_date: "2025-11-14",
      mileage_in: 8740,
      city: "Gent",
      cause: "Rear bumper scuffed in a car park.",
      liability: "unknown",
      circumstances: "parking",
      parts: ["rear_bumper"],
    },
    pre: {
      origin: "repairer",
      status: "sent",
      rates: RIVERSIDE_RATES,
      lines: [
        { category: "labour", subType: "preparation", description: "Sand and prepare rear bumper", hours: 1.5, rate: "assembly" },
        { category: "labour", subType: "paintwork", description: "Paint rear bumper", hours: 3, rate: "paint" },
        { category: "paint_products", description: "Paint and materials", amount: 98.6 },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

const VAT_RATE = 0.21;

/** Rounds to cents. */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function lineAmount(line: LineSeed, rates: QuoteSeed["rates"]): number {
  return line.category === "labour" ? money(line.hours * rates[line.rate]) : line.amount;
}

export type SeedData = ReturnType<typeof buildSeed>;

export function buildSeed(users: SeedUserIds) {
  const accounts: Insert<"account">[] = ACCOUNTS.map((account, index) => ({
    id: accountId(account.key),
    name: account.name,
    account_type: account.types,
    client_code: account.clientCode ?? null,
    parent_account_id: account.parent ? accountId(account.parent) : null,
    vat_number: fictitiousVatNumber(index + 1),
    vat_liable: true,
    address_line1: `${STREETS[index % STREETS.length]} ${10 + index * 3}`,
    postcode: POSTCODES[account.city],
    city: account.city,
    country: "BE",
    phone: phone(account.city, index),
    email: `info@${account.domain}.example`,
    invoicing_conditions: account.repairer?.network ? REPAIRER_INVOICING_CONDITIONS : null,
    discount_pct: account.repairer?.discountPct ?? null,
    requires_vda_po: account.requiresVdaPo ?? false,
    is_network_member: account.repairer?.network ?? false,
    created_by: users.sam,
    created_at: "2025-10-01T09:00:00+02:00",
  }));

  const contacts: Insert<"contact">[] = CONTACTS.map((contact, index) => {
    const account = accountSeedByKey(contact.account);
    return {
      id: contactId(contact.key),
      account_id: accountId(contact.account),
      salutation: contact.salutation,
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: `${slug(contact.firstName)}.${slug(contact.lastName)}@${account.domain}.example`,
      phone: phone(account.city, 40 + index),
      created_by: users.sam,
      created_at: "2025-10-01T09:30:00+02:00",
    };
  });

  const vehicles: Insert<"vehicle">[] = VEHICLES.map((vehicle, index) => ({
    id: vehicleId(vehicle.key),
    licence_plate: vehicle.plate,
    vin: fictitiousVin(index + 1),
    first_registration_date: vehicle.firstRegistration,
    make: vehicle.make,
    model: vehicle.model,
    model_year: vehicle.modelYear,
    type_designation: vehicle.typeDesignation,
    category: vehicle.category,
    colour: vehicle.colour,
    paint_type: vehicle.paintType,
    owner_account_id: accountId(vehicle.owner),
    leasing_account_id: vehicle.leasing ? accountId(vehicle.leasing) : null,
    power_kw: vehicle.powerKw,
    seats: vehicle.seats,
    created_by: users.sam,
    created_at: "2025-10-02T10:00:00+02:00",
  }));

  const tags: Insert<"tag">[] = TAGS.map((name) => ({
    id: tagId(name),
    name,
    created_by: users.sam,
    created_at: "2025-10-01T09:00:00+02:00",
  }));

  const cases: Insert<"case">[] = [];
  const caseParties: Insert<"case_party">[] = [];
  const damages: Insert<"damage">[] = [];
  const damagedParts: Insert<"damaged_part">[] = [];
  const preQuotes: Insert<"quote">[] = [];
  const postQuotes: Insert<"quote">[] = [];
  const quoteLines: Insert<"quote_line">[] = [];
  const assessments: Insert<"assessment">[] = [];
  const invoices: Insert<"invoice">[] = [];
  const caseTags: Insert<"case_tag">[] = [];
  const statusHistory: Insert<"status_history">[] = [];
  const events: Insert<"event">[] = [];
  const auditLog: Insert<"audit_log">[] = [];

  for (const seed of CASES) {
    const client = accountSeedByKey(seed.client);
    const caseNumber = formatCaseNumber(client.clientCode ?? "", seed.year, seed.sequence);
    const caseId = seedId(`case:${caseNumber}`);
    const createdAt = seed.history[0].at;
    const current = seed.history[seed.history.length - 1];
    const manager = users[seed.manager];
    const handler = users[seed.assignedTo];

    cases.push({
      id: caseId,
      case_number: caseNumber,
      client_account_id: accountId(seed.client),
      vehicle_id: vehicleId(seed.vehicle),
      status: current.status,
      manager_user_id: manager,
      assigned_to_user_id: handler,
      ...seed.header,
      created_by: manager,
      created_at: createdAt,
    });

    seed.parties.forEach((party, index) => {
      caseParties.push({
        id: seedId(`case_party:${caseNumber}:${index}`),
        case_id: caseId,
        role: party.role,
        account_id: party.account ? accountId(party.account) : null,
        contact_id: party.contact ? contactId(party.contact) : null,
        created_by: handler,
        created_at: createdAt,
      });
    });

    const { parts, city, ...damage } = seed.damage;
    const damageId = seedId(`damage:${caseNumber}`);
    damages.push({
      id: damageId,
      case_id: caseId,
      ...damage,
      city,
      postcode: POSTCODES[city],
      country: "BE",
      created_by: handler,
      created_at: createdAt,
    });
    for (const part of parts) {
      damagedParts.push({ damage_id: damageId, part_code: part, created_by: handler, created_at: createdAt });
    }

    const quoteAt = (status: CaseStatus) => seed.history.find((step) => step.status === status)?.at ?? createdAt;

    function addQuote(
      version: Enums["quote_version"],
      quote: QuoteSeed,
      target: Insert<"quote">[],
      extra: Partial<Insert<"quote">> = {},
    ): number {
      const quoteId = seedId(`quote:${caseNumber}:${version}`);
      const at = version === "pre_calculation" ? quoteAt("followup_broker_insurer") : quoteAt("followup_repairer_report_ok");
      const amounts = quote.lines.map((line) => lineAmount(line, quote.rates));
      const total = money(amounts.reduce((sum, amount) => sum + amount, 0));
      target.push({
        id: quoteId,
        case_id: caseId,
        version,
        origin: quote.origin,
        status: quote.status,
        hourly_rate_paint: quote.rates.paint,
        hourly_rate_assembly: quote.rates.assembly,
        total_excl_vat: total,
        created_by: handler,
        created_at: at,
        ...extra,
      });
      quote.lines.forEach((line, index) => {
        quoteLines.push({
          id: seedId(`quote_line:${caseNumber}:${version}:${index}`),
          quote_id: quoteId,
          category: line.category,
          sub_type: line.subType ?? null,
          description: line.description,
          amount: amounts[index],
          created_by: handler,
          // Keeps the entered order when sorting by created_at.
          created_at: new Date(Date.parse(at) + index * 1000).toISOString(),
        });
      });
      return total;
    }

    let approvedTotal: number | null = null;
    if (seed.pre) {
      addQuote("pre_calculation", seed.pre, preQuotes);
      if (seed.post === "copy") {
        approvedTotal = addQuote(
          "post_calculation",
          { ...seed.pre, status: "validated" },
          postQuotes,
          { copied_from_quote_id: seedId(`quote:${caseNumber}:pre_calculation`) },
        );
      } else if (seed.post) {
        approvedTotal = addQuote("post_calculation", seed.post, postQuotes);
      }
    }

    const validation = seed.history.find((step) => step.automatic);
    if (seed.assessment && approvedTotal !== null && validation) {
      assessments.push({
        id: seedId(`assessment:${caseNumber}`),
        case_id: caseId,
        ...seed.assessment,
        approved_amount_excl_vat: approvedTotal,
        approved_amount_incl_vat: seed.assessment.vat_applicable ? money(approvedTotal * (1 + VAT_RATE)) : approvedTotal,
        validated_at: validation.at,
        validated_by: handler,
        created_by: handler,
        created_at: validation.at,
      });
    }

    if (seed.purchaseInvoice && approvedTotal !== null) {
      const repairer = seed.parties.find((party) => party.role === "repairer")?.account;
      const discount = repairer ? (accountSeedByKey(repairer).repairer?.discountPct ?? 0) : 0;
      invoices.push({
        id: seedId(`invoice:${caseNumber}:purchase`),
        case_id: caseId,
        direction: "purchase",
        received: true,
        received_date: seed.purchaseInvoice.receivedDate,
        invoice_number: seed.purchaseInvoice.invoiceNumber,
        // BR-09: the repairer invoices with the agreed total discount.
        amount_excl_vat: money(approvedTotal * (1 - discount / 100)),
        created_by: handler,
        created_at: `${seed.purchaseInvoice.receivedDate}T12:00:00Z`,
      });
    }

    for (const tag of seed.tags ?? []) {
      caseTags.push({ case_id: caseId, tag_id: tagId(tag), created_by: handler, created_at: createdAt });
    }

    seed.history.forEach((step, index) => {
      const previous = index === 0 ? null : seed.history[index - 1].status;
      statusHistory.push({
        id: seedId(`status_history:${caseNumber}:${index}`),
        case_id: caseId,
        from_status: previous,
        to_status: step.status,
        changed_at: step.at,
        changed_by: handler,
        automatic: step.automatic ?? false,
        created_by: handler,
        created_at: step.at,
      });
      events.push({
        id: seedId(`event:${caseNumber}:${index}`),
        type: index === 0 ? "case.created" : "status.changed",
        case_id: caseId,
        payload:
          index === 0
            ? { caseNumber }
            : { caseNumber, from: previous, to: step.status, automatic: step.automatic ?? false },
        // Historic seed events: never replayed to webhooks.
        delivered: true,
        created_by: handler,
        created_at: step.at,
      });
      if (step.automatic) {
        events.push({
          id: seedId(`event:${caseNumber}:${index}:quote.validated`),
          type: "quote.validated",
          case_id: caseId,
          payload: { caseNumber, quoteId: seedId(`quote:${caseNumber}:post_calculation`) },
          delivered: true,
          created_by: handler,
          created_at: step.at,
        });
      }
      if (index > 0) {
        auditLog.push({
          id: seedId(`audit_log:${caseNumber}:${index}`),
          entity: "case",
          entity_id: caseId,
          case_id: caseId,
          field: "status",
          old_value: previous,
          new_value: step.status,
          actor_type: step.automatic ? "system" : "user",
          actor_id: step.automatic ? null : handler,
          at: step.at,
          created_by: handler,
          created_at: step.at,
        });
      }
    });
  }

  // Communications (UC-33 to UC-35): the assignment e-mail, the repair order
  // and, on open cases, a phone call that still needs processing.
  const communications: Insert<"communication">[] = [];
  const caseCommunications: Insert<"case_communication">[] = [];
  for (const seed of CASES) {
    const client = accountSeedByKey(seed.client);
    const caseNumber = formatCaseNumber(client.clientCode ?? "", seed.year, seed.sequence);
    const caseId = seedId(`case:${caseNumber}`);
    const handler = users[seed.assignedTo];
    const plate = VEHICLES.find((vehicle) => vehicle.key === seed.vehicle)?.plate ?? "";
    const partyMailbox = (role: Enums["party_role"]) => {
      const party = seed.parties.find((candidate) => candidate.role === role);
      if (party?.contact) {
        const contact = CONTACTS.find((candidate) => candidate.key === party.contact)!;
        const account = accountSeedByKey(contact.account);
        return `${contact.firstName} ${contact.lastName} <${slug(contact.firstName)}.${slug(contact.lastName)}@${account.domain}.example>`;
      }
      return party?.account ? accountMailbox(party.account) : null;
    };
    const add = (key: string, row: Omit<Insert<"communication">, "id" | "created_by" | "created_at">, at: string) => {
      const id = seedId(`communication:${caseNumber}:${key}`);
      communications.push({ id, ...row, sent_at: at, created_by: handler, created_at: at });
      caseCommunications.push({ case_id: caseId, communication_id: id, created_by: handler, created_at: at });
    };

    const assignedBy = partyMailbox("intermediary") ?? accountMailbox(seed.client);
    add(
      "assignment",
      {
        channel: "email",
        direction: "in",
        subject: `New assignment ${plate}`,
        body: `Hello,

Please handle the damage to vehicle ${plate}. The claim form and photos are attached.

Kind regards`,
        from_address: assignedBy,
        to_addresses: ["Go Smart CRM <intake@gosmart.example>"],
        processed: true,
      },
      seed.history[0].at,
    );
    const repairOrder = seed.history.find((step) => step.status === "followup_repairer");
    const repairer = partyMailbox("repairer");
    if (repairOrder && repairer) {
      add(
        "repair-order",
        {
          channel: "email",
          direction: "out",
          subject: `New repair order ${caseNumber} – ${plate}`,
          body: `Please find attached the repair order for case ${caseNumber}.

Please send us your estimate, and always state case number ${caseNumber} in the subject of your e-mails.`,
          from_address: "Go Smart CRM <cases@gosmart.example>",
          to_addresses: [repairer],
          processed: true,
          language: "en",
        },
        repairOrder.at,
      );
    }
    const current = seed.history[seed.history.length - 1];
    if (current.status !== "closed" && !current.status.startsWith("invoicing")) {
      add(
        "driver-call",
        {
          channel: "phone",
          direction: "in",
          subject: "Driver asked when the vehicle will be ready",
          body: "Promised to check with the repairer and call back.",
          processed: false,
        },
        new Date(Date.parse(current.at) + 2 * 3600 * 1000).toISOString(),
      );
    }
  }

  return {
    accounts,
    contacts,
    vehicles,
    tags,
    cases,
    caseParties,
    damages,
    damagedParts,
    preQuotes,
    postQuotes,
    quoteLines,
    assessments,
    invoices,
    caseTags,
    statusHistory,
    events,
    auditLog,
    communications,
    caseCommunications,
  };
}
