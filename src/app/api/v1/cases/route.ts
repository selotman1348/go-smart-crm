import { getApiService } from "@/domain/api";

/** GET /api/v1/cases (scope cases:read) – see docs/api.md. */
export async function GET(request: Request) {
  const result = await (await getApiService()).listCases(request.headers.get("authorization"), new URL(request.url).searchParams);
  return Response.json(result.body, { status: result.status });
}
