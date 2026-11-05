import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getAccountService } from "@/domain/accounts";
import { getContactService } from "@/domain/contacts";

import { saveContactAction } from "../actions";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading contact…</p>}>
      <ContactDetail params={params} />
    </Suspense>
  );
}

async function ContactDetail({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  const { id } = await params;
  const [contacts, accounts] = await Promise.all([getContactService(), getAccountService()]);
  const contact = await contacts.get(id);
  if (!contact) {
    notFound();
  }
  const accountOptions = await accounts.listOptions();
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <Link href="/contacts" className="text-sm text-muted-foreground hover:underline">
          Contacts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/accounts/${contact.accountId}`} className="hover:underline">
            {contact.accountName}
          </Link>
        </p>
      </div>
      <ContactForm
        action={saveContactAction.bind(null, contact.id)}
        contact={contact}
        accountOptions={accountOptions}
      />
    </div>
  );
}
