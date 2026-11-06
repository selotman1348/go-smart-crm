"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CaseTab } from "@/domain/cases/case-warnings";
import { cn } from "@/lib/utils";

// design.md section 4.
const TABS: { tab: CaseTab; segment: string; label: string }[] = [
  { tab: "case", segment: "", label: "Case" },
  { tab: "vehicle", segment: "/vehicle", label: "Vehicle" },
  { tab: "parties", segment: "/parties", label: "Parties" },
  { tab: "damage", segment: "/damage", label: "Damage" },
  { tab: "quote", segment: "/quote", label: "Quote" },
  { tab: "assessment", segment: "/assessment", label: "Assessment" },
  { tab: "communications", segment: "/communications", label: "Communications" },
  { tab: "documents", segment: "/documents", label: "Documents" },
  { tab: "history", segment: "/history", label: "History" },
];

export function CaseTabLinks({
  caseId,
  pathname,
  warningTabs,
}: {
  caseId: string;
  pathname: string | null;
  warningTabs: CaseTab[];
}) {
  const base = `/cases/${caseId}`;
  return (
    <nav aria-label="Case sections" className="overflow-x-auto border-b">
      <ul className="flex gap-1">
        {TABS.map(({ tab, segment, label }) => {
          const href = `${base}${segment}`;
          const active = pathname === href || (segment !== "" && pathname?.startsWith(`${href}/`) === true);
          const warning = warningTabs.includes(tab);
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                  active && "border-primary font-medium text-foreground",
                )}
              >
                {label}
                {/* BR-13: a marker on tabs with missing required information. */}
                {warning ? (
                  <span className="size-2 rounded-full bg-amber-500" title="Missing information">
                    <span className="sr-only">(missing information)</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CaseTabs(props: { caseId: string; warningTabs: CaseTab[] }) {
  return <CaseTabLinks {...props} pathname={usePathname()} />;
}
