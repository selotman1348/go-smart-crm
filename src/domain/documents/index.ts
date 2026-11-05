import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createDocumentRepository } from "./document-repository";
import { createDocumentService, type DocumentService } from "./document-service";

export type { DocumentItem } from "./document-repository";
export type { PreparedUpload } from "./document-service";

export async function getDocumentService(): Promise<DocumentService> {
  return createDocumentService(createDocumentRepository(await createClient()));
}
