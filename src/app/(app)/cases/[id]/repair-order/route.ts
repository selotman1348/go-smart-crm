import { getCommunicationService } from "@/domain/communications";

import { requireUser } from "../../../session";

/** UC-13: the repair order of the case as a PDF, as it would be attached now. */
export async function GET(_request: Request, { params }: RouteContext<"/cases/[id]/repair-order">) {
  await requireUser();
  const { id } = await params;
  const communications = await getCommunicationService();
  const order = await communications.repairOrder(id);
  if (!order) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(Buffer.from(order.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
