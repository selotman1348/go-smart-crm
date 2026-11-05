import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getAccountService } from "@/domain/accounts";

import { NewCaseForm } from "./new-case-form";

export const metadata: Metadata = {
  title: "New case",
};

export default function NewCasePage() {
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-1">
        <Link href="/cases" className="text-sm text-muted-foreground hover:underline">
          Cases
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New case</h1>
        <p className="text-sm text-muted-foreground">
          Only the client is needed to start. Vehicle, parties and damage can be added on the case.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ClientPicker />
      </Suspense>
    </div>
  );
}

async function ClientPicker() {
  const accounts = await getAccountService();
  return <NewCaseForm clients={await accounts.listOptions("client")} />;
}
