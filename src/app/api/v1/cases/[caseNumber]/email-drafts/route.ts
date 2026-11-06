import { getApiService } from "@/domain/api";

/** POST /api/v1/cases/{caseNumber}/email-drafts (scope drafts:write) – see docs/api.md. */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/cases/[caseNumber]/email-drafts">) {
  const { caseNumber } = await params;
  const payload: unknown = await request.json().catch(() => null);
  const result = await getApiService().createEmailDraft(request.headers.get("authorization"), caseNumber, payload);
  return Response.json(result.body, { status: result.status });
}
