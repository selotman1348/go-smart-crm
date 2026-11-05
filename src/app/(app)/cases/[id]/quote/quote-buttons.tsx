"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { copyToPostAction, markSentAction } from "./actions";

function ActionButton({
  label,
  busyLabel,
  confirmation,
  run,
}: {
  label: string;
  busyLabel: string;
  confirmation?: string;
  run: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (confirmation && !window.confirm(confirmation)) {
            return;
          }
          startTransition(async () => {
            const result = await run();
            setError(result.ok ? null : result.error);
          });
        }}
      >
        {pending ? busyLabel : label}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** UC-20: the e-mail to the broker follows in iteration 4; this records that it was sent. */
export function MarkSentButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton label="Mark as sent to broker" busyLabel="Saving…" run={() => markSentAction(caseId)} />
  );
}

/** UC-21: one action copies all pre-calculation lines. */
export function CopyToPostButton({ caseId, replaces }: { caseId: string; replaces: number }) {
  return (
    <ActionButton
      label="Copy from pre-calculation"
      busyLabel="Copying…"
      confirmation={
        replaces > 0
          ? `Replace the ${replaces} line${replaces === 1 ? "" : "s"} of the post-calculation with the pre-calculation?`
          : undefined
      }
      run={() => copyToPostAction(caseId)}
    />
  );
}
