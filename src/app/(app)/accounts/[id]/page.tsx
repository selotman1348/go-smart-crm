import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccountService } from "@/domain/accounts";
import { getContactService } from "@/domain/contacts";

import { AccountForm } from "../account-form";
import { AccountTypeBadges } from "../account-type-badges";
import { saveAccountAction } from "../actions";

export const metadata: Metadata = {
  title: "Account",
};

export default function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading account…</p>}>
      <AccountDetail params={params} />
    </Suspense>
  );
}

async function AccountDetail({ params }: Pick<PageProps<"/accounts/[id]">, "params">) {
  const { id } = await params;
  const [accounts, contacts] = await Promise.all([getAccountService(), getContactService()]);
  const account = await accounts.get(id);
  if (!account) {
    notFound();
  }
  const [parentOptions, accountContacts] = await Promise.all([
    accounts.listOptions(),
    contacts.listByAccount(account.id),
  ]);

  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <Link href="/accounts" className="text-sm text-muted-foreground hover:underline">
          Accounts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
        <AccountTypeBadges types={account.accountTypes} />
      </div>

      <AccountForm
        action={saveAccountAction.bind(null, account.id)}
        account={account}
        parentOptions={parentOptions}
      />

      <section aria-labelledby="contacts-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="contacts-heading" className="text-lg font-semibold tracking-tight">
            Contacts
          </h2>
          <Link
            href={`/contacts/new?accountId=${account.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Add contact
          </Link>
        </div>
        {accountContacts.length === 0 ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <Link href={`/contacts/${contact.id}`} className="hover:underline">
                      {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                    </Link>
                  </TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell>{contact.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
