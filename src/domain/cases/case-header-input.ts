import { z } from "zod";

import {
  checkbox,
  fieldErrorsOf,
  optionalCode,
  optionalDate,
  optionalNumber,
  optionalText,
  optionalUuid,
  stringList,
  type FieldErrors,
} from "@/domain/shared/input";
import { zonedLocalToIso } from "@/domain/shared/time";

/** An <input type="datetime-local"> value in the app time zone, stored as an ISO instant. */
const optionalDateTime = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null),
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) {
        return null;
      }
      const iso = zonedLocalToIso(value);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
        return z.NEVER;
      }
      return iso;
    }),
);

/** UC-09 case header, UC-17 client references, UC-28 on hold, and tags. */
const caseHeaderSchema = z
  .object({
    insurerRef: optionalText(60),
    brokerRef: optionalText(60),
    expertRef: optionalText(60),
    leasingRef: optionalText(60),
    vdaNumber: optionalText(60),
    poNumber: optionalText(60),
    policyNumber: optionalText(60),
    coverType: optionalText(100),
    vatLiablePct: optionalNumber({ min: 0, max: 100 }),
    deductible: optionalNumber({ min: 0, max: 1_000_000 }),
    assignmentDate: optionalDate,
    completionDate: optionalDate,
    collectedDate: optionalDate,
    deliveredDate: optionalDate,
    appointmentEstimateAt: optionalDateTime,
    appointmentRepairAt: optionalDateTime,
    vehicleInDate: optionalDate,
    vehicleReadyDate: optionalDate,
    clientNotifiedDate: optionalDate,
    vehicleOutDate: optionalDate,
    managerUserId: optionalUuid,
    assignedToUserId: optionalUuid,
    onHold: checkbox,
    onHoldReason: optionalCode,
    onHoldReasonText: optionalText(500),
    tagIds: z.preprocess(stringList, z.array(z.uuid({ error: "Choose a valid tag." }))),
    newTag: optionalText(40),
  })
  .superRefine((header, ctx) => {
    // UC-28: an on-hold flag with a reason.
    if (header.onHold && !header.onHoldReason) {
      ctx.addIssue({
        code: "custom",
        path: ["onHoldReason"],
        message: "Choose why the case is on hold.",
      });
    }
  })
  .transform((header) => ({
    ...header,
    onHoldReason: header.onHold ? header.onHoldReason : null,
    onHoldReasonText: header.onHold ? header.onHoldReasonText : null,
    tagIds: [...new Set(header.tagIds)],
  }));

export type CaseHeaderInput = z.output<typeof caseHeaderSchema>;
export type CaseHeaderField = keyof CaseHeaderInput;

export type ParsedCaseHeaderInput =
  | { ok: true; value: CaseHeaderInput }
  | { ok: false; fieldErrors: FieldErrors<CaseHeaderField> };

export function parseCaseHeaderInput(input: unknown): ParsedCaseHeaderInput {
  const result = caseHeaderSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, fieldErrors: fieldErrorsOf<CaseHeaderField>(result.error) };
}
