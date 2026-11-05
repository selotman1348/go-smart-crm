"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  CATEGORY_LABELS,
  QUOTE_LINE_CATEGORIES,
  QUOTE_ORIGIN_LABELS,
  QUOTE_STATUS_LABELS,
  quoteTotals,
  SUB_TYPE_LABELS,
  SUB_TYPES_BY_CATEGORY,
  USER_QUOTE_ORIGINS,
  type QuoteLineCategory,
} from "@/domain/quotes/quote-lines";
import type { Quote } from "@/domain/quotes/quote-rules";
import { formatMoney, parseMoney } from "@/domain/shared/money";

import type { QuoteFormState } from "./actions";

type Action = (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;

type EditorLine = {
  key: string;
  id: string | null;
  category: QuoteLineCategory;
  subType: string;
  description: string;
  amount: string;
};

type EditorValues = {
  origin: string;
  hourlyRatePaint: string;
  hourlyRateAssembly: string;
  lines: EditorLine[];
};

const amountText = (amount: number | null) => (amount === null ? "" : amount.toFixed(2).replace(".", ","));

function fromQuote(quote: Quote | null): EditorValues {
  return {
    origin: quote?.origin === "ai" ? "manual" : (quote?.origin ?? "repairer"),
    hourlyRatePaint: amountText(quote?.hourlyRatePaint ?? null),
    hourlyRateAssembly: amountText(quote?.hourlyRateAssembly ?? null),
    lines: (quote?.lines ?? []).map((line) => ({
      key: line.id,
      id: line.id,
      category: line.category,
      subType: line.subType ?? "",
      description: line.description ?? "",
      // Deductions are stored negative but typed as a positive amount.
      amount: amountText(line.category === "deduction" ? Math.abs(line.amount) : line.amount),
    })),
  };
}

function fromSubmitted(submitted: unknown): EditorValues {
  const values = submitted as EditorValues & { lines: Omit<EditorLine, "key">[] };
  return {
    origin: String(values.origin ?? ""),
    hourlyRatePaint: String(values.hourlyRatePaint ?? ""),
    hourlyRateAssembly: String(values.hourlyRateAssembly ?? ""),
    lines: (values.lines ?? []).map((line, index) => ({
      ...line,
      key: line.id ?? `new-${index}`,
      subType: line.subType ?? "",
      description: line.description ?? "",
    })),
  };
}

/** Live totals from what is typed; amounts that cannot be read count as 0. */
function liveTotals(lines: EditorLine[]) {
  return quoteTotals(
    lines.map((line) => {
      const amount = parseMoney(line.amount);
      const value = amount === null || Number.isNaN(amount) ? 0 : amount;
      return { category: line.category, amount: line.category === "deduction" ? -Math.abs(value) : value };
    }),
  );
}

/** UC-18: a pre- or post-calculation with its lines, subtotals and total. */
export function QuoteEditor({
  title,
  quote,
  action,
  toolbar,
}: {
  title: string;
  quote: Quote | null;
  action: Action;
  toolbar?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<QuoteFormState, FormData>(action, { version: 0 });
  const readOnly = quote?.status === "validated";
  // The fields reload after a save and whenever the stored quote changes
  // underneath them, e.g. after "Copy from pre-calculation".
  const revision = quote
    ? `${quote.id}:${quote.status}:${quote.total}:${quote.lines.map((line) => line.id).join(".")}`
    : "none";
  const headingId = `${title.toLowerCase().replace(/\W+/g, "-")}-heading`;

  return (
    <section aria-labelledby={headingId} className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {quote ? (
            <Badge variant={quote.status === "validated" ? "default" : "secondary"}>
              {QUOTE_STATUS_LABELS[quote.status]}
            </Badge>
          ) : (
            <Badge variant="outline">Not entered</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">{toolbar}</div>
      </div>

      {state.formError ? (
        <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      {state.errors ? (
        <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          Check the highlighted fields.
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          {title} saved.
        </p>
      ) : null}

      {readOnly ? (
        <ReadOnlyQuote quote={quote!} />
      ) : (
        <form action={formAction} className="grid gap-4">
          <QuoteFields
            key={`${state.version}-${revision}`}
            title={title}
            initial={state.submitted ? fromSubmitted(state.submitted) : fromQuote(quote)}
            errors={state.errors ?? {}}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : `Save ${title.toLowerCase()}`}
            </Button>
            <Link href="/cases" className={buttonVariants({ variant: "outline" })}>
              Close
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}

function QuoteFields({
  title,
  initial,
  errors,
}: {
  title: string;
  initial: EditorValues;
  errors: Record<string, string[]>;
}) {
  const [values, setValues] = useState(initial);
  const [nextKey, setNextKey] = useState(0);
  const totals = liveTotals(values.lines);
  const prefix = title.toLowerCase().replace(/\W+/g, "-");

  const updateLine = (key: string, change: Partial<EditorLine>) =>
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...change } : line)),
    }));
  const payload = {
    ...values,
    lines: values.lines.map((line) => ({
      id: line.id,
      category: line.category,
      subType: line.subType || null,
      description: line.description,
      amount: line.amount,
    })),
  };

  return (
    <>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={`${prefix}-origin`} label="Figures from" error={errors.origin}>
          {(control) => (
            <NativeSelect
              {...control}
              value={values.origin}
              onChange={(event) => setValues({ ...values, origin: event.target.value })}
              className="w-full"
            >
              {USER_QUOTE_ORIGINS.map((origin) => (
                <NativeSelectOption key={origin} value={origin}>
                  {QUOTE_ORIGIN_LABELS[origin]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id={`${prefix}-rate-paint`} label="Hourly rate paintwork (€)" error={errors.hourlyRatePaint}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={values.hourlyRatePaint}
              onChange={(event) => setValues({ ...values, hourlyRatePaint: event.target.value })}
            />
          )}
        </FormField>
        <FormField id={`${prefix}-rate-assembly`} label="Hourly rate (dis)assembly (€)" error={errors.hourlyRateAssembly}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={values.hourlyRateAssembly}
              onChange={(event) => setValues({ ...values, hourlyRateAssembly: event.target.value })}
            />
          )}
        </FormField>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Category</th>
              <th className="py-2 pr-2 font-medium">Sub-type</th>
              <th className="py-2 pr-2 font-medium">Description</th>
              <th className="py-2 pr-2 text-right font-medium">Amount (€)</th>
              <th className="py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {values.lines.map((line, index) => {
              const subTypes = SUB_TYPES_BY_CATEGORY[line.category];
              const error = (field: string) => errors[`lines.${index}.${field}`]?.[0];
              const label = (field: string) => `Line ${index + 1} ${field}`;
              return (
                <tr key={line.key} className="border-b align-top">
                  <td className="py-2 pr-2">
                    <NativeSelect
                      aria-label={label("category")}
                      value={line.category}
                      onChange={(event) =>
                        updateLine(line.key, { category: event.target.value as QuoteLineCategory, subType: "" })
                      }
                      className="w-full"
                    >
                      {QUOTE_LINE_CATEGORIES.map((category) => (
                        <NativeSelectOption key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <CellError message={error("category")} />
                  </td>
                  <td className="py-2 pr-2">
                    <NativeSelect
                      aria-label={label("sub-type")}
                      aria-invalid={error("subType") ? true : undefined}
                      value={line.subType}
                      disabled={subTypes.length === 0}
                      onChange={(event) => updateLine(line.key, { subType: event.target.value })}
                      className="w-full"
                    >
                      <NativeSelectOption value="">{subTypes.length === 0 ? "—" : "Choose…"}</NativeSelectOption>
                      {subTypes.map((subType) => (
                        <NativeSelectOption key={subType} value={subType}>
                          {SUB_TYPE_LABELS[subType]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <CellError message={error("subType")} />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      aria-label={label("description")}
                      value={line.description}
                      onChange={(event) => updateLine(line.key, { description: event.target.value })}
                    />
                    <CellError message={error("description")} />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      aria-label={label("amount")}
                      aria-invalid={error("amount") ? true : undefined}
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                      className="text-right tabular-nums"
                    />
                    <CellError message={error("amount")} />
                  </td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() =>
                        setValues({ ...values, lines: values.lines.filter((candidate) => candidate.key !== line.key) })
                      }
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setValues({
              ...values,
              lines: [
                ...values.lines,
                { key: `new-${nextKey}`, id: null, category: "labour", subType: "", description: "", amount: "" },
              ],
            });
            setNextKey(nextKey + 1);
          }}
        >
          Add line
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Deductions are entered as a positive amount and subtracted from the total.
        </p>
      </div>

      <QuoteTotalsTable totals={totals} label={`${title} totals`} />
    </>
  );
}

function CellError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;
}

/** Subtotals per category and the total (UC-18). */
function QuoteTotalsTable({ totals, label }: { totals: ReturnType<typeof quoteTotals>; label: string }) {
  return (
    <dl aria-label={label} className="ml-auto grid w-full max-w-xs gap-1 text-sm">
      {totals.subtotals.map((subtotal) => (
        <div key={subtotal.category} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{CATEGORY_LABELS[subtotal.category]}</dt>
          <dd className="tabular-nums">{formatMoney(subtotal.amount)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t pt-1 font-medium">
        <dt>Total excl. VAT</dt>
        <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
      </div>
    </dl>
  );
}

function ReadOnlyQuote({ quote }: { quote: Quote }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {QUOTE_ORIGIN_LABELS[quote.origin]}
        {quote.hourlyRatePaint !== null ? ` · paintwork ${formatMoney(quote.hourlyRatePaint)}/h` : null}
        {quote.hourlyRateAssembly !== null ? ` · (dis)assembly ${formatMoney(quote.hourlyRateAssembly)}/h` : null}
        {" · validated quotes can no longer change."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Category</th>
              <th className="py-2 pr-2 font-medium">Sub-type</th>
              <th className="py-2 pr-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-b">
                <td className="py-2 pr-2">{CATEGORY_LABELS[line.category]}</td>
                <td className="py-2 pr-2">{line.subType ? SUB_TYPE_LABELS[line.subType] : ""}</td>
                <td className="py-2 pr-2">{line.description}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <QuoteTotalsTable totals={quoteTotals(quote.lines)} label="Validated totals" />
    </div>
  );
}
