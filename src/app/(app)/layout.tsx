import Link from "next/link";
import { Suspense } from "react";

import { UserMenu } from "./user-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Go Smart CRM
          </Link>
          {/* Reads the session at request time; the rest of the shell is static. */}
          <Suspense fallback={<div className="h-8 w-40" aria-hidden />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
