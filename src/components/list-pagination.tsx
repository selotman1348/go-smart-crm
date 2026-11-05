import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Page 2 of 4 · 87 results" with previous/next links that keep the other query parameters. */
export function ListPagination({
  pathname,
  params,
  page,
  pageCount,
  total,
  noun,
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
  noun: [singular: string, plural: string];
}) {
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        query.set(key, value);
      }
    }
    if (target > 1) {
      query.set("page", String(target));
    }
    const search = query.toString();
    return search ? `${pathname}?${search}` : pathname;
  };
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        {total} {total === 1 ? noun[0] : noun[1]}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : null}
      </p>
      {pageCount > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={linkClass}>
              Previous
            </Link>
          ) : (
            <span className={cn(linkClass, "pointer-events-none opacity-50")}>Previous</span>
          )}
          {page < pageCount ? (
            <Link href={href(page + 1)} className={linkClass}>
              Next
            </Link>
          ) : (
            <span className={cn(linkClass, "pointer-events-none opacity-50")}>Next</span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
