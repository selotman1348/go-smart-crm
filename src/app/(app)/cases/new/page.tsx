import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getAccountService } from "@/domain/accounts";
import { getIntakeService } from "@/domain/intake";

import { EmailView } from "../../inbox/email-view";
import { NewCaseForm } from "./new-case-form";

export const metadata: Metadata = {
  title: "New case",
};

/** UC-08; from the Inbox, "Create case from e-mail" shows the e-mail beside the form (plan.md 2.1). */
export default function NewCasePage({ searchParams }: PageProps<"/cases/new">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <NewCase searchParams={searchParams} />
    </Suspense>
  );
}

async function NewCase({ searchParams }: Pick<PageProps<"/cases/new">, "searchParams">) {
  const { email: emailParam } = await searchParams;
  const [accounts, intake] = await Promise.all([getAccountService(), getIntakeService()]);
  const email = typeof emailParam === "string" ? await intake.get(emailParam) : null;
  const fromEmail = email && (email.status === "new" || email.status === "triage") ? email : null;
  const clients = await accounts.listOptions("client");

  return (
    <div className={fromEmail ? "grid gap-6 lg:grid-cols-2" : "grid max-w-xl gap-6"}>
      <div className="grid content-start gap-6">
        <div className="grid gap-1">
          <Link href={fromEmail ? `/inbox/${fromEmail.id}` : "/cases"} className="text-sm text-muted-foreground hover:underline">
            {fromEmail ? "Inbox" : "Cases"}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{fromEmail ? "New case from e-mail" : "New case"}</h1>
          <p className="text-sm text-muted-foreground">
            Only the client is needed to start. Vehicle, parties and damage can be added on the case.
            {fromEmail ? " The e-mail and its attachments move to the new case." : null}
          </p>
        </div>
        <NewCaseForm clients={clients} emailId={fromEmail?.id ?? null} />
      </div>
      {fromEmail ? <EmailView email={fromEmail} /> : null}
    </div>
  );
}
