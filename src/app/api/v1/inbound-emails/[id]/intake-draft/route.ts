import { getApiService } from "@/domain/api";

/** POST /api/v1/inbound-emails/{id}/intake-draft (scope drafts:write) – see docs/api.md. */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/inbound-emails/[id]/intake-draft">) {
  const { id } = await params;
  const payload: unknown = await request.json().catch(() => null);
  const result = await (await getApiService()).proposeIntake(request.headers.get("authorization"), id, payload);
  return Response.json(result.body, { status: result.status });
}
