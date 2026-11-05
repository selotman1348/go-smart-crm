import { NextResponse, type NextRequest } from "next/server";

import { getDocumentService } from "@/domain/documents";

import { requireUser } from "../../../session";

/** Redirects to a 60-second signed link that downloads the document (UC-36). */
export async function GET(_request: NextRequest, { params }: RouteContext<"/documents/[id]/download">) {
  await requireUser();
  const { id } = await params;
  const documents = await getDocumentService();
  const url = await documents.downloadUrl(id);
  if (!url) {
    return new NextResponse("Document not found.", { status: 404 });
  }
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
