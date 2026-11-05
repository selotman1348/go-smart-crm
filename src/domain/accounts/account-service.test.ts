import { describe, expect, it, vi } from "vitest";

import type { WriteResult } from "@/domain/shared/repository";

import type { AccountRepository } from "./account-repository";
import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  ACCOUNT_SAVE_FAILED_MESSAGE,
  createAccountService,
} from "./account-service";

const ID = "6f1d1c52-5b8e-4b8a-9a3e-2f8c4d0e7a10";
const client = { name: "Velora Car Rental NV", accountTypes: ["client"], clientCode: "VCR" };

function fakeRepository(result: WriteResult = { ok: true, id: ID }): AccountRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(async () => null),
    listOptions: vi.fn(async () => []),
    listTypedOptions: vi.fn(async () => []),
    create: vi.fn(async () => result),
    update: vi.fn(async () => result),
  };
}

describe("account service", () => {
  it("creates a valid account", async () => {
    const repository = fakeRepository();
    await expect(createAccountService(repository).save(client)).resolves.toEqual({ ok: true, id: ID });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ clientCode: "VCR" }));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("updates when an id is given", async () => {
    const repository = fakeRepository();
    await createAccountService(repository).save(client, ID);
    expect(repository.update).toHaveBeenCalledWith(ID, expect.objectContaining({ name: client.name }));
  });

  it("does not write invalid input", async () => {
    const repository = fakeRepository();
    const result = await createAccountService(repository).save({ ...client, clientCode: "" });
    expect(result.ok).toBe(false);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("explains a client code that is already used", async () => {
    const repository = fakeRepository({
      ok: false,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "account_client_code_key"' },
    });
    await expect(createAccountService(repository).save(client)).resolves.toEqual({
      ok: false,
      fieldErrors: { clientCode: ["This client code is already used by another account."] },
    });
  });

  it("explains a missing account and other failures", async () => {
    await expect(
      createAccountService(fakeRepository({ ok: false, error: "not_found" })).save(client, ID),
    ).resolves.toEqual({ ok: false, formError: ACCOUNT_NOT_FOUND_MESSAGE });
    await expect(
      createAccountService(fakeRepository({ ok: false, error: { code: "57014", message: "timeout" } })).save(client),
    ).resolves.toEqual({ ok: false, formError: ACCOUNT_SAVE_FAILED_MESSAGE });
  });

  it("does not query the database for an id that is not a UUID", async () => {
    const repository = fakeRepository();
    await expect(createAccountService(repository).get("not-an-id")).resolves.toBeNull();
    expect(repository.getById).not.toHaveBeenCalled();
  });
});
