import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getAccountService } from "@/domain/accounts";

import { AccountForm } from "../account-form";
import { saveAccountAction } from "../actions";

export const metadata: Metadata = {
  title: "New account",
};

export default function NewAccountPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <Link href="/accounts" className="text-sm text-muted-foreground hover:underline">
          Accounts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New account</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewAccountForm />
      </Suspense>
    </div>
  );
}

async function NewAccountForm() {
  const accounts = await getAccountService();
  const parentOptions = await accounts.listOptions();
  return <AccountForm action={saveAccountAction.bind(null, null)} parentOptions={parentOptions} />;
}
