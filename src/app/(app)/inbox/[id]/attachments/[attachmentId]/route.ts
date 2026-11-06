import { redirect } from "next/navigation";

import { getIntakeService } from "@/domain/intake";

import { requireUser } from "../../../../session";

/** Downloads an attachment of a received e-mail through a short-lived signed URL. */
export async function GET(_request: Request, { params }: RouteContext<"/inbox/[id]/attachments/[attachmentId]">) {
  await requireUser();
  const { id, attachmentId } = await params;
  const intake = await getIntakeService();
  const url = await intake.attachmentUrl(id, attachmentId);
  if (!url) {
    return new Response("Not found", { status: 404 });
  }
  redirect(url);
}
