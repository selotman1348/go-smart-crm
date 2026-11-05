import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

/** Save and Close buttons at the bottom of a case tab (design.md section 4). */
export function FormActions({ pending, closeHref }: { pending: boolean; closeHref: string }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Link href={closeHref} className={buttonVariants({ variant: "outline" })}>
        Close
      </Link>
    </div>
  );
}

/** Messages shown above a form after a save. */
export function FormMessages({
  formError,
  hasFieldErrors,
  saved,
}: {
  formError?: string;
  hasFieldErrors: boolean;
  saved?: boolean;
}) {
  return (
    <>
      {formError ? (
        <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {hasFieldErrors ? (
        <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          Check the highlighted fields.
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Changes saved.
        </p>
      ) : null}
    </>
  );
}
