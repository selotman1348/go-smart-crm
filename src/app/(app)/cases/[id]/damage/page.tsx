import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DocumentUpload } from "@/components/documents/document-upload";
import { getCaseService } from "@/domain/cases";
import { getDamageService } from "@/domain/damage";
import { getLookups } from "@/domain/lookups";

import { saveDamageAction } from "../actions";
import { DamageForm } from "./damage-form";

export const metadata: Metadata = {
  title: "Damage",
};

/** Damage tab (UC-12). */
export default function DamageTabPage({ params }: PageProps<"/cases/[id]/damage">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DamageTab params={params} />
    </Suspense>
  );
}

async function DamageTab({ params }: Pick<PageProps<"/cases/[id]/damage">, "params">) {
  const { id } = await params;
  const [cases, damageService, lookups] = await Promise.all([getCaseService(), getDamageService(), getLookups()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [damage, liabilities, circumstances, parts] = await Promise.all([
    damageService.getForCase(detail.id),
    lookups.list("liability"),
    lookups.list("circumstances"),
    lookups.list("part_catalog"),
  ]);
  const options = (list: { code: string; label: string }[]) =>
    list.map((item) => ({ value: item.code, label: item.label }));

  return (
    <div className="grid gap-8">
      <DamageForm
        action={saveDamageAction.bind(null, detail.id)}
        stored={
          damage
            ? Object.fromEntries(
                Object.entries(damage).map(([key, value]) => [
                  key,
                  Array.isArray(value) ? value : (value?.toString() ?? null),
                ]),
              )
            : {}
        }
        liabilities={options(liabilities)}
        circumstances={options(circumstances)}
        parts={options(parts)}
      />
      <section className="grid gap-2">
        <DocumentUpload
          caseId={detail.id}
          categories={["claim_form", "photo"]}
          defaultCategory="photo"
          label="Upload the claim form and photos"
        />
        <p className="text-sm text-muted-foreground">
          Uploaded files are listed on the{" "}
          <Link href={`/cases/${detail.id}/documents`} className="underline">
            Documents tab
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
