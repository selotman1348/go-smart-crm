import { describe, expect, it, vi } from "vitest";

import type { CaseDetail, CaseRepository } from "./case-repository";
import {
  CASE_CREATE_FAILED_MESSAGE,
  CASE_NUMBER_ATTEMPTS,
  createCaseService,
  STATUS_CONFLICT_MESSAGE,
} from "./case-service";

const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const CASE = "33333333-3333-4333-8333-333333333333";
const TAG = "44444444-4444-4444-8444-444444444444";
const NEW_TAG = "55555555-5555-4555-8555-555555555555";

const conflict = { code: "23505", message: 'duplicate key value violates unique constraint "case_case_number_key"' };

function fakeRepository(overrides: Partial<CaseRepository> = {}): CaseRepository {
  return {
    list: vi.fn(),
    clientTiles: vi.fn(),
    getById: vi.fn(async () => ({ id: CASE, tagIds: [TAG] }) as CaseDetail),
    getStatus: vi.fn(async () => "followup_repairer" as const),
    getClient: vi.fn(async () => ({ id: CLIENT, clientCode: "VCR" })),
    lastCaseNumber: vi.fn(async () => "VCR20260005"),
    create: vi.fn(async () => ({ ok: true as const, id: CASE })),
    updateHeader: vi.fn(async () => ({ ok: true as const, id: CASE })),
    changeStatus: vi.fn(async () => ({ ok: true as const })),
    listTags: vi.fn(),
    findOrCreateTag: vi.fn(async () => NEW_TAG),
    setCaseTags: vi.fn(async () => undefined),
    ...overrides,
  };
}

// 10:00 in Brussels on 5 November 2026.
const now = () => new Date("2026-11-05T09:00:00Z");

describe("create case (UC-08, BR-01)", () => {
  it("numbers the case after the client's last number and applies the defaults", async () => {
    const repository = fakeRepository();
    await expect(createCaseService(repository, now).create({ clientAccountId: CLIENT }, USER)).resolves.toEqual({
      ok: true,
      id: CASE,
    });
    expect(repository.lastCaseNumber).toHaveBeenCalledWith("VCR", 2026);
    expect(repository.create).toHaveBeenCalledWith({
      caseNumber: "VCR20260006",
      clientAccountId: CLIENT,
      ownerAccountId: CLIENT,
      managerUserId: USER,
      assignedToUserId: USER,
      assignmentDate: "2026-11-05",
    });
  });

  it("uses the Brussels year at the turn of the year", async () => {
    const repository = fakeRepository({ lastCaseNumber: vi.fn(async () => null) });
    // 00:30 on 1 January 2027 in Brussels.
    await createCaseService(repository, () => new Date("2026-12-31T23:30:00Z")).create({ clientAccountId: CLIENT }, USER);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ caseNumber: "VCR20270001", assignmentDate: "2027-01-01" }),
    );
  });

  it("tries the next number when another user took it at the same moment", async () => {
    const last = ["VCR20260005", "VCR20260006"];
    const repository = fakeRepository({
      lastCaseNumber: vi.fn(async () => last.shift() ?? null),
      create: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: conflict })
        .mockResolvedValueOnce({ ok: true, id: CASE }),
    });
    await expect(createCaseService(repository, now).create({ clientAccountId: CLIENT }, USER)).resolves.toEqual({
      ok: true,
      id: CASE,
    });
    expect(vi.mocked(repository.create).mock.calls.map(([input]) => input.caseNumber)).toEqual([
      "VCR20260006",
      "VCR20260007",
    ]);
  });

  it("gives up after a few conflicts", async () => {
    const repository = fakeRepository({ create: vi.fn(async () => ({ ok: false as const, error: conflict })) });
    await expect(createCaseService(repository, now).create({ clientAccountId: CLIENT }, USER)).resolves.toEqual({
      ok: false,
      formError: CASE_CREATE_FAILED_MESSAGE,
    });
    expect(repository.create).toHaveBeenCalledTimes(CASE_NUMBER_ATTEMPTS);
  });

  it("requires a client account with a client code", async () => {
    const repository = fakeRepository({ getClient: vi.fn(async () => null) });
    await expect(createCaseService(repository, now).create({ clientAccountId: CLIENT }, USER)).resolves.toEqual({
      ok: false,
      fieldErrors: { clientAccountId: ["Choose a client."] },
    });
    await expect(createCaseService(repository, now).create({ clientAccountId: "x" }, USER)).resolves.toMatchObject({
      ok: false,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("save case header", () => {
  it("saves the header and updates the tags, creating a new tag", async () => {
    const repository = fakeRepository();
    await createCaseService(repository).saveHeader(CASE, { insurerRef: "ATL-1", tagIds: [], newTag: "Glass" });
    expect(repository.updateHeader).toHaveBeenCalledWith(CASE, expect.objectContaining({ insurerRef: "ATL-1" }));
    expect(repository.findOrCreateTag).toHaveBeenCalledWith("Glass");
    expect(repository.setCaseTags).toHaveBeenCalledWith(CASE, [TAG], [NEW_TAG]);
  });

  it("explains an unknown on-hold reason", async () => {
    const repository = fakeRepository({
      updateHeader: vi.fn(async () => ({
        ok: false as const,
        error: { code: "23503", message: 'violates foreign key constraint "case_on_hold_reason_fkey"' },
      })),
    });
    await expect(
      createCaseService(repository).saveHeader(CASE, { onHold: "on", onHoldReason: "unknown_reason" }),
    ).resolves.toEqual({ ok: false, fieldErrors: { onHoldReason: ["Choose a valid reason."] } });
    expect(repository.setCaseTags).not.toHaveBeenCalled();
  });
});

describe("change status", () => {
  it("applies the engine's plan with the current status as expected status", async () => {
    const repository = fakeRepository();
    await expect(createCaseService(repository).changeStatus(CASE, "followup_broker_insurer")).resolves.toEqual({
      ok: true,
    });
    expect(repository.changeStatus).toHaveBeenCalledWith(CASE, "followup_repairer", "followup_broker_insurer", false);
  });

  it("does not write when the engine rejects the change", async () => {
    const repository = fakeRepository();
    const result = await createCaseService(repository).changeStatus(CASE, "followup_repairer");
    expect(result.ok).toBe(false);
    expect(repository.changeStatus).not.toHaveBeenCalled();
  });

  it("explains a status changed by someone else in the meantime", async () => {
    const repository = fakeRepository({
      changeStatus: vi.fn(async () => ({ ok: false as const, error: { code: "PT409", message: "changed" } })),
    });
    await expect(createCaseService(repository).changeStatus(CASE, "closed")).resolves.toEqual({
      ok: false,
      error: STATUS_CONFLICT_MESSAGE,
    });
  });
});
