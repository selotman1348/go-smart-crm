import Link from "next/link";
import { Suspense } from "react";

import { AppNav, AppNavLinks } from "./app-nav";
import { UserMenu } from "./user-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Go Smart CRM
          </Link>
          {/* Reads the session at request time; the rest of the shell is static. */}
          <Suspense fallback={<div className="h-8 w-40" aria-hidden />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
        <nav
          aria-label="Main"
          className="overflow-x-auto border-b px-4 py-3 md:w-52 md:shrink-0 md:border-r md:border-b-0 md:py-6"
        >
          <Suspense fallback={<AppNavLinks pathname={null} />}>
            <AppNav />
          </Suspense>
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
