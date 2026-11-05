import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createContactRepository } from "./contact-repository";
import { createContactService, type ContactService } from "./contact-service";

export type { ContactField } from "./contact-input";
export type { Contact, ContactListItem } from "./contact-repository";

/** Contact service bound to the current request's session (row-level security applies). */
export async function getContactService(): Promise<ContactService> {
  return createContactService(createContactRepository(await createClient()));
}
