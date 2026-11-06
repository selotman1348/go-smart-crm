import { getApiService } from "@/domain/api";

/** GET /api/v1/cases/{caseNumber} (scope cases:read) – see docs/api.md. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/cases/[caseNumber]">) {
  const { caseNumber } = await params;
  const result = await getApiService().getCase(request.headers.get("authorization"), caseNumber);
  return Response.json(result.body, { status: result.status });
}
