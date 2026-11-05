"use server";

import { refresh } from "next/cache";

import { getCaseService, type CaseHeaderField } from "@/domain/cases";
import { getDamageService, type DamageField } from "@/domain/damage";
import { getPartyService, type PartyField } from "@/domain/parties";
import type { SaveResult } from "@/domain/shared/input";
import { getVehicleService, type VehicleField, type VehicleMatch } from "@/domain/vehicles";

import type { ActionResult } from "../../documents/actions";
import { readForm, type FormState, type FormValues } from "../../form-state";
import { requireUser } from "../../session";

function afterSave<Field extends string>(
  result: SaveResult<Field>,
  values: FormValues,
  previous: FormState<Field>,
): FormState<Field> {
  const version = previous.version + 1;
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  refresh();
  return { saved: true, version };
}

export type StatusFormState = { error?: string; version: number };

/** Status dropdown in the case header: every change goes through the status engine. */
export async function changeStatusAction(
  caseId: string,
  previous: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  await requireUser();
  const cases = await getCaseService();
  const result = await cases.changeStatus(caseId, formData.get("status"));
  if (!result.ok) {
    return { error: result.error, version: previous.version + 1 };
  }
  refresh();
  return { version: previous.version + 1 };
}

/** Case tab: header, client references, on hold and tags (UC-09, UC-17, UC-28). */
export async function saveCaseHeaderAction(
  caseId: string,
  previous: FormState<CaseHeaderField>,
  formData: FormData,
): Promise<FormState<CaseHeaderField>> {
  await requireUser();
  const values = readForm(formData, ["tagIds"]);
  const cases = await getCaseService();
  return afterSave(await cases.saveHeader(caseId, values), values, previous);
}

/** Vehicle tab (UC-10). */
export async function saveVehicleAction(
  caseId: string,
  previous: FormState<VehicleField>,
  formData: FormData,
): Promise<FormState<VehicleField>> {
  await requireUser();
  const values = readForm(formData);
  const vehicles = await getVehicleService();
  return afterSave(await vehicles.saveForCase(caseId, values), values, previous);
}

export type VehicleSearchState = { term: string; matches?: VehicleMatch[] };

export async function searchVehiclesAction(_previous: VehicleSearchState, formData: FormData): Promise<VehicleSearchState> {
  await requireUser();
  const term = String(formData.get("term") ?? "").trim();
  const vehicles = await getVehicleService();
  return { term, matches: await vehicles.search(term) };
}

export async function linkVehicleAction(caseId: string, vehicleId: string): Promise<ActionResult> {
  await requireUser();
  const vehicles = await getVehicleService();
  const result = await vehicles.linkExisting(caseId, vehicleId);
  if (!result.ok) {
    return { ok: false, error: result.formError ?? "The vehicle could not be linked." };
  }
  refresh();
  return { ok: true };
}

/** Parties tab (UC-11). */
export async function addPartyAction(
  caseId: string,
  previous: FormState<PartyField>,
  formData: FormData,
): Promise<FormState<PartyField>> {
  await requireUser();
  const values = readForm(formData);
  const parties = await getPartyService();
  return afterSave(await parties.add(caseId, values), values, previous);
}

export async function removePartyAction(caseId: string, partyId: string): Promise<ActionResult> {
  await requireUser();
  const parties = await getPartyService();
  const result = await parties.remove(caseId, partyId);
  if (result.ok) {
    refresh();
  }
  return result;
}

/** Damage tab (UC-12). */
export async function saveDamageAction(
  caseId: string,
  previous: FormState<DamageField>,
  formData: FormData,
): Promise<FormState<DamageField>> {
  await requireUser();
  const values = readForm(formData, ["parts"]);
  const damage = await getDamageService();
  return afterSave(await damage.save(caseId, values), values, previous);
}
