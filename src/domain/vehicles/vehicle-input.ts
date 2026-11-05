import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";

import {
  fieldErrorsOf,
  optionalDate,
  optionalInteger,
  optionalText,
  optionalUuid,
  type FieldErrors,
} from "@/domain/shared/input";

export type VehicleCategory = Database["public"]["Enums"]["vehicle_category"];

/** design.md 1.4 (Q-009: is this list complete?). */
export const VEHICLE_CATEGORIES = [
  "electric",
  "hybrid",
  "diesel",
  "petrol",
  "light_van",
] as const satisfies readonly VehicleCategory[];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  electric: "Electric",
  hybrid: "Hybrid",
  diesel: "Diesel",
  petrol: "Petrol",
  light_van: "Light van",
};

/** 17 characters; I, O and Q are never used in a VIN. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

const emptyToNull = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : (value ?? null);

const vehicleInputSchema = z.object({
  licencePlate: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, " ") || null : value),
    z
      .string({ error: "Enter the licence plate." })
      .max(20, { error: "Use at most 20 characters." }),
  ),
  vin: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\s/g, "").toUpperCase() || null : (value ?? null)),
    z
      .string()
      .regex(VIN_PATTERN, { error: "A VIN has 17 letters and digits (never I, O or Q)." })
      .nullable(),
  ),
  firstRegistrationDate: optionalDate,
  make: optionalText(60),
  model: optionalText(60),
  modelYear: optionalInteger({ min: 1900, max: 2100 }),
  typeDesignation: optionalText(100),
  category: z.preprocess(
    emptyToNull,
    z.enum(VEHICLE_CATEGORIES, { error: "Choose a valid category." }).nullable(),
  ),
  colour: optionalText(60),
  paintType: optionalText(60),
  ownerAccountId: optionalUuid,
  leasingAccountId: optionalUuid,
  powerKw: optionalInteger({ min: 0, max: 2000 }),
  engineCc: optionalInteger({ min: 0, max: 20000 }),
  co2: optionalInteger({ min: 0, max: 1000 }),
  seats: optionalInteger({ min: 1, max: 100 }),
});

export type VehicleInput = z.output<typeof vehicleInputSchema>;
export type VehicleField = keyof VehicleInput;

export type ParsedVehicleInput =
  | { ok: true; value: VehicleInput }
  | { ok: false; fieldErrors: FieldErrors<VehicleField> };

/** UC-10: validates the vehicle form. */
export function parseVehicleInput(input: unknown): ParsedVehicleInput {
  const result = vehicleInputSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, fieldErrors: fieldErrorsOf<VehicleField>(result.error) };
}
