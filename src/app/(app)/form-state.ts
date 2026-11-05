/** Submitted form values, kept so a rejected form does not lose the user's input. */
export type FormValues = Record<string, string | string[]>;

export type FormState<Field extends string> = {
  fieldErrors?: Partial<Record<Field, string[]>>;
  formError?: string;
  saved?: boolean;
  values?: FormValues;
  /** Changes on every submission, so the fields remount with fresh defaults. */
  version: number;
};

export const initialFormState = { version: 0 };

/** Reads a form into a plain object; `lists` names the fields that can repeat (checkbox groups). */
export function readForm(formData: FormData, lists: string[] = []): FormValues {
  const values: FormValues = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) {
      continue; // React's internal action fields
    }
    const entries = formData.getAll(key).filter((value): value is string => typeof value === "string");
    values[key] = lists.includes(key) ? entries : (entries[0] ?? "");
  }
  for (const key of lists) {
    values[key] ??= [];
  }
  return values;
}
