import { formatFileSize } from "@/domain/documents/document-rules";
import type { InboundEmailDetail } from "@/domain/intake";
import { formatDateTime } from "@/domain/shared/time";

/** A received e-mail: headers, text body and attachments. The HTML part is never rendered. */
export function EmailView({ email }: { email: InboundEmailDetail }) {
  return (
    <article aria-label="E-mail" className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">{email.subject ?? "(no subject)"}</h2>
        <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">From</dt>
          <dd>{email.from ?? "—"}</dd>
          <dt className="text-muted-foreground">To</dt>
          <dd>{email.to.join(", ") || "—"}</dd>
          {email.cc.length > 0 ? (
            <>
              <dt className="text-muted-foreground">Cc</dt>
              <dd>{email.cc.join(", ")}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Received</dt>
          <dd>{formatDateTime(email.receivedAt)}</dd>
        </dl>
      </div>
      <pre className="max-h-[32rem] overflow-auto rounded-md bg-muted/50 p-3 font-sans text-sm whitespace-pre-wrap">
        {email.bodyText ?? "(no text)"}
      </pre>
      {email.attachments.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium">Attachments</p>
          <ul className="grid gap-1 text-sm">
            {email.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a href={`/inbox/${email.id}/attachments/${attachment.id}`} className="hover:underline">
                  {attachment.fileName}
                </a>{" "}
                <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
