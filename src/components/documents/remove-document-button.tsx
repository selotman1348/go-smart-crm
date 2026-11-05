"use client";

import { useState, useTransition } from "react";

import { removeDocumentAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";

export function RemoveDocumentButton({ documentId, fileName }: { documentId: string; fileName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Remove ${fileName}`}
        onClick={() => {
          if (!window.confirm(`Remove ${fileName}? The case history keeps a record of it.`)) {
            return;
          }
          startTransition(async () => {
            const result = await removeDocumentAction(documentId);
            setError(result.ok ? null : result.error);
          });
        }}
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
