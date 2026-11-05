import { isUuid, type SaveResult } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import { parseVehicleInput, type VehicleField } from "./vehicle-input";
import type { VehicleRepository } from "./vehicle-repository";

export const VEHICLE_SAVE_FAILED_MESSAGE = "The vehicle could not be saved. Please try again.";
export const VEHICLE_CASE_NOT_FOUND_MESSAGE = "This case no longer exists.";
export const VIN_IN_USE_MESSAGE =
  "A vehicle with this VIN already exists. Use “Find vehicle” to link it to this case.";

function explainWriteError(error: RepositoryError | "not_found"): SaveResult<VehicleField> {
  if (error === "not_found") {
    return { ok: false, formError: VEHICLE_CASE_NOT_FOUND_MESSAGE };
  }
  if (error.code === "23505" && error.message.includes("vin")) {
    return { ok: false, fieldErrors: { vin: [VIN_IN_USE_MESSAGE] } };
  }
  if (error.code === "23503") {
    if (error.message.includes("leasing_account_id")) {
      return { ok: false, fieldErrors: { leasingAccountId: ["Choose an existing account."] } };
    }
    return { ok: false, fieldErrors: { ownerAccountId: ["Choose an existing account."] } };
  }
  return { ok: false, formError: VEHICLE_SAVE_FAILED_MESSAGE };
}

export function createVehicleService(repository: VehicleRepository) {
  return {
    get(id: string) {
      return isUuid(id) ? repository.getById(id) : Promise.resolve(null);
    },

    /** Finds vehicles by licence plate or VIN, ignoring spaces, dashes and case. */
    search(term: string) {
      const key = term.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return key.length >= 3 ? repository.search(key) : Promise.resolve([]);
    },

    /**
     * UC-10: saves the case's vehicle. Without a vehicle yet, a new one is
     * created (owned by the case's client unless another owner is chosen)
     * and linked to the case.
     */
    async saveForCase(caseId: string, input: unknown): Promise<SaveResult<VehicleField>> {
      const parsed = parseVehicleInput(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const context = isUuid(caseId) ? await repository.caseContext(caseId) : null;
      if (!context) {
        return { ok: false, formError: VEHICLE_CASE_NOT_FOUND_MESSAGE };
      }

      if (context.vehicleId) {
        const updated = await repository.update(context.vehicleId, parsed.value);
        return updated.ok ? updated : explainWriteError(updated.error);
      }
      const created = await repository.create({
        ...parsed.value,
        ownerAccountId: parsed.value.ownerAccountId ?? context.clientAccountId,
      });
      if (!created.ok) {
        return explainWriteError(created.error);
      }
      const linked = await repository.linkToCase(caseId, created.id);
      return linked.ok ? linked : explainWriteError(linked.error);
    },

    /** Links an existing vehicle (found by plate or VIN) to the case. */
    async linkExisting(caseId: string, vehicleId: string): Promise<SaveResult<VehicleField>> {
      if (!isUuid(caseId) || !isUuid(vehicleId) || !(await repository.getById(vehicleId))) {
        return { ok: false, formError: "Choose a vehicle from the search results." };
      }
      const linked = await repository.linkToCase(caseId, vehicleId);
      return linked.ok ? linked : explainWriteError(linked.error);
    },
  };
}

export type VehicleService = ReturnType<typeof createVehicleService>;
