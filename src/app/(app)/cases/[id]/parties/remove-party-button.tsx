"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { removePartyAction } from "../actions";

export function RemovePartyButton({ caseId, partyId, label }: { caseId: string; partyId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Remove ${label}`}
        onClick={() =>
          startTransition(async () => {
            const result = await removePartyAction(caseId, partyId);
            setError(result.ok ? null : result.error);
          })
        }
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
