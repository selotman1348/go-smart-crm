import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createVehicleRepository } from "./vehicle-repository";
import { createVehicleService, type VehicleService } from "./vehicle-service";

export type { VehicleField } from "./vehicle-input";
export type { Vehicle, VehicleMatch } from "./vehicle-repository";

export async function getVehicleService(): Promise<VehicleService> {
  return createVehicleService(createVehicleRepository(await createClient()));
}
