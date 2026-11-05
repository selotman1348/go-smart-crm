import { Badge } from "@/components/ui/badge";
import { CASE_STATUS_LABELS, type CaseStatus } from "@/domain/cases/case-status";

export function CaseStatusBadge({ status, onHold }: { status: CaseStatus; onHold?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={status === "closed" ? "outline" : "secondary"}>{CASE_STATUS_LABELS[status]}</Badge>
      {onHold ? <Badge variant="destructive">On hold</Badge> : null}
    </span>
  );
}
