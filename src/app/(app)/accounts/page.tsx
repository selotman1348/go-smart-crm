import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { ListPagination } from "@/components/list-pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  getAccountService,
  isAccountType,
} from "@/domain/accounts";
import { pageNumber } from "@/domain/shared/search";

import { AccountTypeBadges } from "./account-type-badges";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <Link href="/accounts/new" className={buttonVariants()}>
          New account
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading accounts…</p>}>
        <AccountList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function AccountList({ searchParams }: Pick<PageProps<"/accounts">, "searchParams">) {
  const params = await searchParams;
  const search = first(params.q)?.trim() || undefined;
  const typeParam = first(params.type);
  const type = isAccountType(typeParam) ? typeParam : undefined;
  const page = pageNumber(params.page);

  const accounts = await getAccountService();
  const result = await accounts.list({ search, type, page });

  return (
    <div className="grid gap-4">
      <Form
        action="/accounts"
        role="search"
        key={`${search}-${type}`}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Name or client code"
          aria-label="Search accounts"
          className="w-64"
        />
        <NativeSelect name="type" defaultValue={type ?? ""} aria-label="Account type">
          <NativeSelectOption value="">All types</NativeSelectOption>
          {ACCOUNT_TYPES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {ACCOUNT_TYPE_LABELS[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {search || type ? (
          <Link href="/accounts" className={buttonVariants({ variant: "ghost" })}>
            Reset
          </Link>
        ) : null}
      </Form>

      {result.items.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          {search || type ? "No accounts match your search." : "No accounts yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client code</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>E-mail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  <Link href={`/accounts/${account.id}`} className="hover:underline">
                    {account.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <AccountTypeBadges types={account.accountTypes} />
                </TableCell>
                <TableCell className="font-mono">{account.clientCode}</TableCell>
                <TableCell>{account.city}</TableCell>
                <TableCell>{account.phone}</TableCell>
                <TableCell>{account.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListPagination
        pathname="/accounts"
        params={{ q: search, type }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={["account", "accounts"]}
      />
    </div>
  );
}
