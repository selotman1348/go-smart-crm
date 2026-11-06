"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { prepareEmlUploadAction, processEmlAction } from "./actions";

type Status = { kind: "idle" } | { kind: "busy" | "error" | "done"; message: string };

const subscribeNothing = () => () => {};

/**
 * "Upload .eml" (plan.md 2.1): feeds a saved e-mail into the same pipeline
 * as the inbound webhook. The file goes straight to Storage.
 */
export function EmlUpload() {
  const id = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);

  async function upload(file: File) {
    setStatus({ kind: "busy", message: `Reading ${file.name}…` });
    const prepared = await prepareEmlUploadAction({ fileName: file.name, size: file.size });
    if (!prepared.ok) {
      setStatus({ kind: "error", message: prepared.error });
      return;
    }
    const response = await fetch(prepared.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "message/rfc822", "x-upsert": "false" },
      body: file,
    });
    if (!response.ok) {
      setStatus({ kind: "error", message: "The upload failed. Please try again." });
      return;
    }
    const result = await processEmlAction(prepared.emailId);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    if (fileInput.current) {
      fileInput.current.value = "";
    }
    setStatus({
      kind: "done",
      message: result.duplicate
        ? "This e-mail was received before."
        : result.linkedCaseNumbers.length > 0
          ? `Linked to case ${result.linkedCaseNumbers.join(", ")} (BR-10).`
          : "The e-mail is waiting in the Inbox.",
    });
    router.push(`/inbox/${result.id}`);
  }

  return (
    <form
      aria-label="Upload .eml"
      className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const file = fileInput.current?.files?.[0];
        if (!file) {
          setStatus({ kind: "error", message: "Choose an .eml file." });
          return;
        }
        startTransition(() => upload(file));
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={`${id}-file`}>E-mail file (.eml)</Label>
        <input
          ref={fileInput}
          id={`${id}-file`}
          type="file"
          accept=".eml,message/rfc822"
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-2.5 file:py-1 file:text-sm"
        />
      </div>
      <Button type="submit" variant="outline" disabled={!ready || status.kind === "busy"}>
        Upload .eml
      </Button>
      {status.kind !== "idle" ? (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`basis-full text-sm ${status.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
