import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { getCommunicationService } from "@/domain/communications";
import { DOCUMENT_CATEGORY_LABELS } from "@/domain/documents/document-rules";

import { composeAction, discardDraftAction } from "../../actions";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = {
  title: "E-mail",
};

/** UC-33: a template e-mail, rendered as a draft, for the user to check and send. */
export default function ComposePage({ params }: PageProps<"/cases/[id]/communications/messages/[messageId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Compose params={params} />
    </Suspense>
  );
}

async function Compose({ params }: Pick<PageProps<"/cases/[id]/communications/messages/[messageId]">, "params">) {
  const { id, messageId } = await params;
  const communications = await getCommunicationService();
  const view = await communications.compose(id, messageId);
  if (!view) {
    notFound();
  }
  const { message } = view;

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="grid gap-1">
        <Link href={`/cases/${id}/communications`} className="text-sm text-muted-foreground hover:underline">
          Communications
        </Link>
        <h2 className="text-lg font-semibold">{message.templateName ?? "E-mail"}</h2>
        <p className="text-sm text-muted-foreground">
          {message.status === "failed" ? "Sending failed. Check the message and try again." : "Draft. Check the message and send it."}
        </p>
      </div>
      {!view.delivers ? (
        <p role="note" className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          E-mail delivery is off in this environment (no provider token): sending logs the e-mail on the case without
          delivering it.
        </p>
      ) : null}
      {view.missing.length > 0 ? (
        <p role="note" className="rounded-lg border border-amber-500/50 px-3 py-2 text-sm">
          The case has no value for: {view.missing.join(", ")}. Complete the message, or the case, before sending.
        </p>
      ) : null}
      {view.statusHint ? <p className="text-sm text-muted-foreground">{view.statusHint}</p> : null}
      <ComposeForm
        action={composeAction.bind(null, id, message.id)}
        stored={{
          to: message.to.join(", "),
          cc: message.cc.join(", "),
          subject: message.subject,
          body: message.body,
          attachRepairOrder: view.attachRepairOrder,
        }}
        documents={view.documents.map((document) => ({
          id: document.id,
          label: `${document.fileName} (${DOCUMENT_CATEGORY_LABELS[document.category]})`,
        }))}
        repairOrderUrl={`/cases/${id}/repair-order`}
      />
      <form action={discardDraftAction.bind(null, id, message.id)}>
        <Button type="submit" variant="ghost" size="sm">
          Discard draft
        </Button>
      </form>
    </div>
  );
}
