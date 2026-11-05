import { describe, expect, it, vi } from "vitest";

import { parseVehicleInput } from "./vehicle-input";
import type { VehicleRepository } from "./vehicle-repository";
import { createVehicleService, VIN_IN_USE_MESSAGE } from "./vehicle-service";

const CASE = "33333333-3333-4333-8333-333333333333";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const VEHICLE = "66666666-6666-4666-8666-666666666666";

describe("parseVehicleInput (UC-10)", () => {
  it("normalises the plate and VIN", () => {
    const result = parseVehicleInput({ licencePlate: " 9-tka-101 ", vin: "gsdemv 00000000001", modelYear: "2023", category: "" });
    expect(result.ok && result.value).toMatchObject({
      licencePlate: "9-TKA-101",
      vin: "GSDEMV00000000001",
      modelYear: 2023,
      category: null,
    });
  });

  it("requires a plate and checks the VIN, year and category", () => {
    const result = parseVehicleInput({ licencePlate: "", vin: "WVWZZZ1KZOW000001", modelYear: "1850", category: "truck", seats: "0" });
    expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual([
      "category",
      "licencePlate",
      "modelYear",
      "seats",
      "vin",
    ]);
  });
});

function fakeRepository(overrides: Partial<VehicleRepository> = {}): VehicleRepository {
  return {
    getById: vi.fn(async () => null),
    search: vi.fn(async () => []),
    caseContext: vi.fn(async () => ({ vehicleId: null, clientAccountId: CLIENT })),
    create: vi.fn(async () => ({ ok: true as const, id: VEHICLE })),
    update: vi.fn(async () => ({ ok: true as const, id: VEHICLE })),
    linkToCase: vi.fn(async () => ({ ok: true as const, id: VEHICLE })),
    ...overrides,
  };
}

describe("vehicle service", () => {
  it("creates a vehicle owned by the client and links it when the case has none", async () => {
    const repository = fakeRepository();
    await expect(createVehicleService(repository).saveForCase(CASE, { licencePlate: "9-ABC-123" })).resolves.toEqual({
      ok: true,
      id: VEHICLE,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ licencePlate: "9-ABC-123", ownerAccountId: CLIENT }),
    );
    expect(repository.linkToCase).toHaveBeenCalledWith(CASE, VEHICLE);
  });

  it("updates the case's existing vehicle", async () => {
    const repository = fakeRepository({ caseContext: vi.fn(async () => ({ vehicleId: VEHICLE, clientAccountId: CLIENT })) });
    await createVehicleService(repository).saveForCase(CASE, { licencePlate: "9-ABC-123" });
    expect(repository.update).toHaveBeenCalledWith(VEHICLE, expect.objectContaining({ ownerAccountId: null }));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("points to the search when the VIN belongs to another vehicle", async () => {
    const repository = fakeRepository({
      create: vi.fn(async () => ({
        ok: false as const,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "vehicle_vin_key"' },
      })),
    });
    await expect(
      createVehicleService(repository).saveForCase(CASE, { licencePlate: "9-ABC-123", vin: "GSDEMV00000000001" }),
    ).resolves.toEqual({ ok: false, fieldErrors: { vin: [VIN_IN_USE_MESSAGE] } });
    expect(repository.linkToCase).not.toHaveBeenCalled();
  });

  it("searches on plate or VIN characters only, from 3 characters", async () => {
    const repository = fakeRepository();
    const service = createVehicleService(repository);
    await service.search("9-tka 101");
    expect(repository.search).toHaveBeenCalledWith("9TKA101");
    await expect(service.search("9-t")).resolves.toEqual([]);
    expect(repository.search).toHaveBeenCalledTimes(1);
  });
});
