import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import type { WriteResult } from "@/domain/shared/repository";

import type { DamageInput } from "./damage-input";

type DamageRow = Database["public"]["Tables"]["damage"]["Row"];

export type Damage = DamageInput & { id: string };

export function toDamage(row: DamageRow, parts: string[]): Damage {
  return {
    id: row.id,
    damageDate: row.damage_date,
    mileageIn: row.mileage_in,
    mileageOut: row.mileage_out,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postcode: row.postcode,
    city: row.city,
    country: row.country,
    cause: row.cause,
    liability: row.liability,
    circumstances: row.circumstances,
    extraInfo: row.extra_info,
    parts,
  };
}

export function createDamageRepository(db: DbClient) {
  return {
    async getForCase(caseId: string): Promise<Damage | null> {
      const { data, error } = await db
        .from("damage")
        .select("*, damaged_part (part_code)")
        .eq("case_id", caseId)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the damage: ${error.message}`);
      }
      return data ? toDamage(data, data.damaged_part.map((part) => part.part_code)) : null;
    },

    /** Creates or updates the case's single damage record (design.md 1.7). */
    async save(caseId: string, damage: Omit<DamageInput, "parts">): Promise<WriteResult> {
      const { data, error } = await db
        .from("damage")
        .upsert(
          {
            case_id: caseId,
            damage_date: damage.damageDate,
            mileage_in: damage.mileageIn,
            mileage_out: damage.mileageOut,
            address_line1: damage.addressLine1,
            address_line2: damage.addressLine2,
            postcode: damage.postcode,
            city: damage.city,
            country: damage.country,
            cause: damage.cause,
            liability: damage.liability,
            circumstances: damage.circumstances,
            extra_info: damage.extraInfo,
          },
          { onConflict: "case_id" },
        )
        .select("id")
        .single();
      return error ? { ok: false, error } : { ok: true, id: data.id };
    },

    async setParts(damageId: string, current: string[], wanted: string[]): Promise<WriteResult> {
      const add = wanted.filter((code) => !current.includes(code));
      const remove = current.filter((code) => !wanted.includes(code));
      if (add.length > 0) {
        const { error } = await db
          .from("damaged_part")
          .insert(add.map((code) => ({ damage_id: damageId, part_code: code })));
        if (error) {
          return { ok: false, error };
        }
      }
      if (remove.length > 0) {
        const { error } = await db.from("damaged_part").delete().eq("damage_id", damageId).in("part_code", remove);
        if (error) {
          return { ok: false, error };
        }
      }
      return { ok: true, id: damageId };
    },
  };
}

export type DamageRepository = ReturnType<typeof createDamageRepository>;
