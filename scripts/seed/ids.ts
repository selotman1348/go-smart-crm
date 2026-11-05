import { createHash } from "node:crypto";

// Arbitrary namespace for Go Smart CRM seed data.
const NAMESPACE = Buffer.from("7c1e5c0a2f9b4e1d8a6b3c5d9e0f1a2b", "hex");

/**
 * Deterministic UUID (version 5) for a seed record, so every run of the seed
 * produces the same ids and existing rows are recognised.
 */
export function seedId(key: string): string {
  const hash = createHash("sha1").update(NAMESPACE).update(key).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
