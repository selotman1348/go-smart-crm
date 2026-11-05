import "server-only";

import { createClient } from "@/lib/supabase/server";

import { isUuid } from "@/domain/shared/input";

import { formatHistory, referencedIds, type HistoryEntry } from "./history-format";
import { createHistoryRepository } from "./history-repository";

export type { HistoryChange, HistoryEntry } from "./history-format";

/** UC-37: all changes on the case and its vehicle, newest first; null if the case does not exist. */
export async function getCaseHistory(caseId: string): Promise<HistoryEntry[] | null> {
  if (!isUuid(caseId)) {
    return null;
  }
  const repository = createHistoryRepository(await createClient());
  const { exists, vehicleId } = await repository.caseVehicleId(caseId);
  if (!exists) {
    return null;
  }
  const rows = await repository.auditRows(caseId, vehicleId);
  return formatHistory(rows, await repository.nameLookups(caseId, referencedIds(rows)));
}
