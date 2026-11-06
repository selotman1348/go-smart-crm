import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

import { createApiRepository } from "./api-repository";
import { createApiService, type ApiService } from "./api-service";

export type { ApiResult } from "./api-service";

/** The external API works with the service role; every call checks the API key and its scope first. */
export async function getApiService(): Promise<ApiService> {
  return createApiService(createApiRepository(await createServiceClient()));
}
