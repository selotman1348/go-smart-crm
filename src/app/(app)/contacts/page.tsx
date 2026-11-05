import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { ListPagination } from "@/components/list-pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getContactService } from "@/domain/contacts";
import { pageNumber } from "@/domain/shared/search";

export const metadata: Metadata = {
  title: "Contacts",
};

export default function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <Link href="/contacts/new" className={buttonVariants()}>
          New contact
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading contacts…</p>}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function ContactList({ searchParams }: Pick<PageProps<"/contacts">, "searchParams">) {
  const params = await searchParams;
  const search = first(params.q)?.trim() || undefined;
  const page = pageNumber(params.page);

  const contacts = await getContactService();
  const result = await contacts.list({ search, page });

  return (
    <div className="grid gap-4">
      <Form action="/contacts" role="search" key={search} className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Name, e-mail or phone"
          aria-label="Search contacts"
          className="w-64"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {search ? (
          <Link href="/contacts" className={buttonVariants({ variant: "ghost" })}>
            Reset
          </Link>
        ) : null}
      </Form>

      {result.items.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          {search ? "No contacts match your search." : "No contacts yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/accounts/${contact.accountId}`} className="hover:underline">
                    {contact.accountName}
                  </Link>
                </TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.phone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListPagination
        pathname="/contacts"
        params={{ q: search }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={["contact", "contacts"]}
      />
    </div>
  );
}
