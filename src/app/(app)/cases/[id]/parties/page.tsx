import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccountService } from "@/domain/accounts";
import { getCaseService } from "@/domain/cases";
import { getPartyService, PARTY_ROLE_ORDER, PARTY_ROLES } from "@/domain/parties";

import { addPartyAction } from "../actions";
import { AddPartyForm } from "./add-party-form";
import { RemovePartyButton } from "./remove-party-button";

export const metadata: Metadata = {
  title: "Parties",
};

/** Parties tab (UC-11). */
export default function PartiesTabPage({ params }: PageProps<"/cases/[id]/parties">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PartiesTab params={params} />
    </Suspense>
  );
}

async function PartiesTab({ params }: Pick<PageProps<"/cases/[id]/parties">, "params">) {
  const { id } = await params;
  const [cases, parties, accounts] = await Promise.all([getCaseService(), getPartyService(), getAccountService()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [caseParties, accountOptions, contactOptions] = await Promise.all([
    parties.listForCase(detail.id),
    accounts.listTypedOptions(),
    parties.contactOptions(),
  ]);
  const ordered = [...caseParties].sort(
    (a, b) => PARTY_ROLE_ORDER.indexOf(a.role) - PARTY_ROLE_ORDER.indexOf(b.role),
  );

  return (
    <div className="grid gap-6">
      {ordered.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">No parties yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((party) => {
              const label = `${PARTY_ROLES[party.role].label} ${party.accountName ?? party.contactName ?? ""}`.trim();
              return (
                <TableRow key={party.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {PARTY_ROLES[party.role].label}
                      {/* BR-02 */}
                      {party.isInvoiceParty ? <Badge variant="outline">Invoice party</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    {party.accountId ? (
                      <Link href={`/accounts/${party.accountId}`} className="hover:underline">
                        {party.accountName}
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {party.contactId ? (
                      <Link href={`/contacts/${party.contactId}`} className="hover:underline">
                        {party.contactName}
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <RemovePartyButton caseId={detail.id} partyId={party.id} label={label} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <AddPartyForm
        action={addPartyAction.bind(null, detail.id)}
        accounts={accountOptions}
        contacts={contactOptions}
      />
    </div>
  );
}
