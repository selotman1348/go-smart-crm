import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import type { WriteResult } from "@/domain/shared/repository";
import { ilikePatternFilter, looseLikePattern } from "@/domain/shared/search";

import type { VehicleInput } from "./vehicle-input";

type VehicleRow = Database["public"]["Tables"]["vehicle"]["Row"];
type VehicleWrite = Database["public"]["Tables"]["vehicle"]["Insert"];

export type Vehicle = VehicleInput & { id: string };

export type VehicleMatch = {
  id: string;
  licencePlate: string;
  vin: string | null;
  make: string | null;
  model: string | null;
};

export function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    licencePlate: row.licence_plate,
    vin: row.vin,
    firstRegistrationDate: row.first_registration_date,
    make: row.make,
    model: row.model,
    modelYear: row.model_year,
    typeDesignation: row.type_designation,
    category: row.category,
    colour: row.colour,
    paintType: row.paint_type,
    ownerAccountId: row.owner_account_id,
    leasingAccountId: row.leasing_account_id,
    powerKw: row.power_kw,
    engineCc: row.engine_cc,
    co2: row.co2,
    seats: row.seats,
  };
}

export function toVehicleRow(input: VehicleInput): VehicleWrite {
  return {
    licence_plate: input.licencePlate,
    vin: input.vin,
    first_registration_date: input.firstRegistrationDate,
    make: input.make,
    model: input.model,
    model_year: input.modelYear,
    type_designation: input.typeDesignation,
    category: input.category,
    colour: input.colour,
    paint_type: input.paintType,
    owner_account_id: input.ownerAccountId,
    leasing_account_id: input.leasingAccountId,
    power_kw: input.powerKw,
    engine_cc: input.engineCc,
    co2: input.co2,
    seats: input.seats,
  };
}

export function createVehicleRepository(db: DbClient) {
  return {
    async getById(id: string): Promise<Vehicle | null> {
      const { data, error } = await db.from("vehicle").select("*").eq("id", id).maybeSingle();
      if (error) {
        throw new Error(`Could not load the vehicle: ${error.message}`);
      }
      return data ? toVehicle(data) : null;
    },

    /** Vehicles whose plate or VIN contains the characters of `key` in order. */
    async search(key: string): Promise<VehicleMatch[]> {
      const { data, error } = await db
        .from("vehicle")
        .select("id, licence_plate, vin, make, model")
        .or(ilikePatternFilter(["licence_plate", "vin"], looseLikePattern(key)))
        .order("licence_plate")
        .limit(10);
      if (error) {
        throw new Error(`Could not search vehicles: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        licencePlate: row.licence_plate,
        vin: row.vin,
        make: row.make,
        model: row.model,
      }));
    },

    /** The case's vehicle and client, needed to save the Vehicle tab. */
    async caseContext(caseId: string): Promise<{ vehicleId: string | null; clientAccountId: string } | null> {
      const { data, error } = await db
        .from("case")
        .select("vehicle_id, client_account_id")
        .eq("id", caseId)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      return data ? { vehicleId: data.vehicle_id, clientAccountId: data.client_account_id } : null;
    },

    async create(input: VehicleInput): Promise<WriteResult> {
      const { data, error } = await db.from("vehicle").insert(toVehicleRow(input)).select("id").single();
      return error ? { ok: false, error } : { ok: true, id: data.id };
    },

    async update(id: string, input: VehicleInput): Promise<WriteResult> {
      const { data, error } = await db
        .from("vehicle")
        .update(toVehicleRow(input))
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) {
        return { ok: false, error };
      }
      return data ? { ok: true, id: data.id } : { ok: false, error: "not_found" };
    },

    async linkToCase(caseId: string, vehicleId: string): Promise<WriteResult> {
      const { data, error } = await db
        .from("case")
        .update({ vehicle_id: vehicleId })
        .eq("id", caseId)
        .select("id")
        .maybeSingle();
      if (error) {
        return { ok: false, error };
      }
      return data ? { ok: true, id: vehicleId } : { ok: false, error: "not_found" };
    },
  };
}

export type VehicleRepository = ReturnType<typeof createVehicleRepository>;
