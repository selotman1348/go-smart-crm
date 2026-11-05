import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getAccountService } from "@/domain/accounts";

import { saveContactAction } from "../actions";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = {
  title: "New contact",
};

export default function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <Link href="/contacts" className="text-sm text-muted-foreground hover:underline">
          Contacts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New contact</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewContactForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewContactForm({ searchParams }: Pick<PageProps<"/contacts/new">, "searchParams">) {
  const { accountId } = await searchParams;
  const accounts = await getAccountService();
  const accountOptions = await accounts.listOptions();
  const preselected = accountOptions.find((option) => option.id === accountId)?.id;

  return (
    <ContactForm
      action={saveContactAction.bind(null, null)}
      accountId={preselected}
      accountOptions={accountOptions}
    />
  );
}
