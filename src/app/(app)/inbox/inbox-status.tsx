import { Badge } from "@/components/ui/badge";
import type { InboundStatus } from "@/domain/intake";

export const INBOUND_STATUS_LABELS: Record<InboundStatus, string> = {
  new: "To triage",
  triage: "To triage",
  linked: "Linked",
  converted: "Case created",
  ignored: "Ignored",
};

export function InboxStatusBadge({ status }: { status: InboundStatus }) {
  const waiting = status === "new" || status === "triage";
  return <Badge variant={waiting ? "default" : "secondary"}>{INBOUND_STATUS_LABELS[status]}</Badge>;
}
