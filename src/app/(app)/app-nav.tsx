"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// design.md section 4. Leads, Notes, Surveys and Repairs are placeholders in
// version 1. `exact`: not active on the pages below it.
const NAV_SECTIONS: { title: string; items: { href: string; label: string; exact?: boolean }[] }[] = [
  {
    title: "CRM",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/accounts", label: "Accounts" },
      { href: "/contacts", label: "Contacts" },
      { href: "/tasks", label: "Tasks" },
      { href: "/leads", label: "Leads" },
      { href: "/notes", label: "Notes" },
      { href: "/surveys", label: "Surveys" },
    ],
  },
  {
    title: "Damage claims",
    items: [
      { href: "/cases", label: "Cases" },
      { href: "/inbox", label: "Inbox" },
    ],
  },
  {
    title: "Repairs",
    items: [
      { href: "/repairs", label: "Dashboard", exact: true },
      { href: "/repairs/network", label: "Network" },
      { href: "/repairs/cases", label: "Cases" },
    ],
  },
  {
    title: "Files",
    items: [{ href: "/documents", label: "Documents" }],
  },
];

export function AppNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex gap-6 md:flex-col">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="grid gap-1">
          <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          <ul className="flex gap-1 md:flex-col">
            {section.items.map((item) => {
              const active =
                pathname !== null &&
                (pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`)));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                      active && "bg-muted font-medium",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AppNav() {
  return <AppNavLinks pathname={usePathname()} />;
}
