"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { prepareUploadAction, confirmUploadAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/domain/documents/document-rules";

type Status = { kind: "idle" } | { kind: "busy"; message: string } | { kind: "error" | "done"; message: string };

const subscribeNothing = () => () => {};

/**
 * Uploads files straight to Storage (UC-36): the server checks each file and
 * returns a one-time URL, the browser sends the file there, and the server
 * then registers it. Large photos never pass through the web server.
 */
export function DocumentUpload({
  caseId,
  categories,
  defaultCategory,
  label = "Upload documents",
}: {
  caseId: string | null;
  categories: DocumentCategory[];
  defaultCategory: DocumentCategory;
  label?: string;
}) {
  const id = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Server Action calls (and the page re-renders they cause) run as a
  // transition, so this widget is not remounted and keeps its messages.
  const [, startTransition] = useTransition();
  // The upload needs JavaScript; until the page is interactive (false during
  // server rendering and hydration) the button stays disabled, so a click
  // cannot submit the form natively.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);

  async function upload(files: File[], category: DocumentCategory) {
    for (const [index, file] of files.entries()) {
      setStatus({ kind: "busy", message: `Uploading ${file.name} (${index + 1} of ${files.length})…` });
      const prepared = await prepareUploadAction({
        caseId,
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
        category,
      });
      if (!prepared.ok) {
        setStatus({ kind: "error", message: `${file.name}: ${prepared.error}` });
        return;
      }
      const response = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "cache-control": "max-age=3600", "x-upsert": "false" },
        body: file,
      });
      if (!response.ok) {
        setStatus({ kind: "error", message: `${file.name}: the upload failed. Please try again.` });
        return;
      }
      const confirmed = await confirmUploadAction({
        documentId: prepared.documentId,
        caseId,
        fileName: file.name,
        category,
      });
      if (!confirmed.ok) {
        setStatus({ kind: "error", message: `${file.name}: ${confirmed.error}` });
        return;
      }
    }
    setStatus({ kind: "done", message: files.length === 1 ? "File uploaded." : `${files.length} files uploaded.` });
    if (fileInput.current) {
      fileInput.current.value = "";
    }
    // A transition, so the list updates without remounting this widget.
    router.refresh();
  }

  return (
    <form
      aria-label={label}
      className="grid gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const files = [...(fileInput.current?.files ?? [])];
        if (files.length === 0) {
          setStatus({ kind: "error", message: "Choose one or more files." });
          return;
        }
        const category = new FormData(event.currentTarget).get("category") ?? defaultCategory;
        startTransition(() => upload(files, category as DocumentCategory));
      }}
    >
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-end gap-3">
        {categories.length > 1 ? (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-category`}>Category</Label>
            <NativeSelect id={`${id}-category`} name="category" defaultValue={defaultCategory}>
              {categories.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {DOCUMENT_CATEGORY_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`${id}-files`}>Files</Label>
          <input
            ref={fileInput}
            id={`${id}-files`}
            type="file"
            multiple
            accept={DOCUMENT_ACCEPT}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-2.5 file:py-1 file:text-sm"
          />
        </div>
        <Button type="submit" variant="outline" disabled={!ready || status.kind === "busy"}>
          Upload
        </Button>
      </div>
      {status.kind !== "idle" ? (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={status.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {status.message}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        PDF, images, Word, Excel, e-mail (.eml) or text files, up to 20 MB each.
      </p>
    </form>
  );
}
