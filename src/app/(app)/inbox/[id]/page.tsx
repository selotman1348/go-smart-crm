import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { getIntakeService } from "@/domain/intake";

import { createCaseFromEmailAction, linkEmailAction } from "../actions";
import { EmailView } from "../email-view";
import { InboxStatusBadge } from "../inbox-status";
import { LinkToCaseForm } from "../link-form";

export const metadata: Metadata = {
  title: "E-mail",
};

/** UC-34: one received e-mail, with the triage actions of plan.md 2.1. */
export default function InboxEmailPage({ params }: PageProps<"/inbox/[id]">) {
  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/inbox" className="text-sm text-muted-foreground hover:underline">
        Inbox
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <InboxEmail params={params} />
      </Suspense>
    </div>
  );
}

async function InboxEmail({ params }: Pick<PageProps<"/inbox/[id]">, "params">) {
  const { id } = await params;
  const intake = await getIntakeService();
  const email = await intake.get(id);
  if (!email) {
    notFound();
  }
  const waiting = email.status === "new" || email.status === "triage";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <InboxStatusBadge status={email.status} />
        {email.linkedCaseId ? (
          <p className="text-sm">
            On case{" "}
            <Link href={`/cases/${email.linkedCaseId}/communications`} className="font-medium hover:underline">
              {email.linkedCaseNumber}
            </Link>
          </p>
        ) : null}
      </div>
      {waiting ? (
        <section aria-label="Triage" className="grid gap-4 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            The subject has no case number of an existing case. Create a case from this e-mail, or link it to a case.
          </p>
          <div className="flex flex-wrap items-start gap-6">
            <form action={createCaseFromEmailAction.bind(null, email.id)} className="sm:mt-7">
              <Button type="submit">Create case from e-mail</Button>
            </form>
            <LinkToCaseForm action={linkEmailAction.bind(null, email.id)} />
          </div>
        </section>
      ) : null}
      <EmailView email={email} />
    </>
  );
}
