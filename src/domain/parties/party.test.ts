import { describe, expect, it, vi } from "vitest";

import type { AccountType } from "@/domain/accounts/account-types";

import { checkPartyRecords, parsePartyInput } from "./party-input";
import type { PartyRepository } from "./party-repository";
import { createPartyService } from "./party-service";

const CASE = "33333333-3333-4333-8333-333333333333";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const OTHER_ACCOUNT = "77777777-7777-4777-8777-777777777777";
const CONTACT = "88888888-8888-4888-8888-888888888888";

describe("parsePartyInput (UC-11)", () => {
  it("records a person role as a contact only", () => {
    const result = parsePartyInput({ role: "driver", accountId: ACCOUNT, contactId: CONTACT });
    expect(result.ok && result.value).toEqual({ role: "driver", accountId: null, contactId: CONTACT });
  });

  it("requires a person for person roles and an account for organisation roles", () => {
    expect(parsePartyInput({ role: "driver" })).toEqual({
      ok: false,
      fieldErrors: { contactId: ["Choose the driver."] },
    });
    expect(parsePartyInput({ role: "repairer", contactId: CONTACT })).toEqual({
      ok: false,
      fieldErrors: { accountId: ["Choose an account."] },
    });
    expect(parsePartyInput({ role: "mechanic" }).ok).toBe(false);
  });
});

describe("checkPartyRecords", () => {
  const repairer = { role: "repairer" as const, accountId: ACCOUNT, contactId: CONTACT };

  it("accepts an account of the right type with one of its contacts", () => {
    expect(checkPartyRecords(repairer, { accountTypes: ["repairer"], contactAccountId: ACCOUNT })).toBeNull();
  });

  it("rejects an account of another type (e.g. an insurer as repairer)", () => {
    expect(checkPartyRecords(repairer, { accountTypes: ["insurer"], contactAccountId: ACCOUNT })).toEqual({
      accountId: ["For the role Repairer, choose an account of type Repairer."],
    });
  });

  it("maps the intermediary role to broker accounts and the owner role to clients", () => {
    expect(
      checkPartyRecords({ role: "intermediary", accountId: ACCOUNT, contactId: null }, { accountTypes: ["broker"], contactAccountId: null }),
    ).toBeNull();
    expect(
      checkPartyRecords(
        { role: "owner_fleet_owner", accountId: ACCOUNT, contactId: null },
        { accountTypes: ["repairer"], contactAccountId: null },
      ),
    ).toEqual({ accountId: ["For the role Owner / fleet owner, choose an account of type Client."] });
  });

  it("rejects a contact of another account", () => {
    expect(checkPartyRecords(repairer, { accountTypes: ["repairer"], contactAccountId: OTHER_ACCOUNT })).toEqual({
      contactId: ["This contact does not work for the chosen account."],
    });
  });
});

describe("party service", () => {
  function fakeRepository(overrides: Partial<PartyRepository> = {}): PartyRepository {
    return {
      listForCase: vi.fn(),
      contactOptions: vi.fn(),
      accountTypes: vi.fn(async (): Promise<AccountType[]> => ["repairer"]),
      contactAccountId: vi.fn(async () => ACCOUNT),
      add: vi.fn(async () => ({ ok: true as const, id: "p1" })),
      remove: vi.fn(async () => ({ ok: true as const })),
      ...overrides,
    };
  }

  it("adds a valid party", async () => {
    const repository = fakeRepository();
    await createPartyService(repository).add(CASE, { role: "repairer", accountId: ACCOUNT, contactId: CONTACT });
    expect(repository.add).toHaveBeenCalledWith(CASE, { role: "repairer", accountId: ACCOUNT, contactId: CONTACT });
  });

  it("explains a second owner/fleet owner (one invoice party per case, BR-02)", async () => {
    const repository = fakeRepository({
      accountTypes: vi.fn(async (): Promise<AccountType[]> => ["client"]),
      add: vi.fn(async () => ({
        ok: false as const,
        error: { code: "23505", message: 'violates unique constraint "case_party_one_owner_fleet_owner_idx"' },
      })),
    });
    await expect(
      createPartyService(repository).add(CASE, { role: "owner_fleet_owner", accountId: ACCOUNT }),
    ).resolves.toEqual({
      ok: false,
      fieldErrors: { role: ["This case already has an owner/fleet owner. Remove it first."] },
    });
  });
});
