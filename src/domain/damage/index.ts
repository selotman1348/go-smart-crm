import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createDamageRepository } from "./damage-repository";
import { createDamageService, type DamageService } from "./damage-service";

export type { DamageField } from "./damage-input";
export type { Damage } from "./damage-repository";

export async function getDamageService(): Promise<DamageService> {
  return createDamageService(createDamageRepository(await createClient()));
}
