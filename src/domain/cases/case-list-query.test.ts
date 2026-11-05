import { describe, expect, it } from "vitest";

import { caseListParams, hasDateFilter, parseCaseListQuery, plateKey } from "./case-list-query";
import { caseSearchFilter } from "./case-repository";

const CLIENT = "22222222-2222-4222-8222-222222222222";

describe("parseCaseListQuery (UC-05, UC-06)", () => {
  it("reads valid filters from the URL", () => {
    expect(
      parseCaseListQuery({
        q: " 9-TKA-101 ",
        status: "open",
        client: CLIENT,
        damageFrom: "2026-10-01",
        createdTo: "2026-11-05",
        page: "2",
      }),
    ).toMatchObject({
      search: "9-TKA-101",
      status: "open",
      clientId: CLIENT,
      damageFrom: "2026-10-01",
      createdTo: "2026-11-05",
      page: 2,
    });
  });

  it("ignores invalid values instead of failing", () => {
    expect(
      parseCaseListQuery({ status: "archived", client: "velora", repairer: "", assignmentFrom: "05/11/2026", page: "-1" }),
    ).toEqual(expect.objectContaining({ status: undefined, clientId: undefined, repairerId: undefined, assignmentFrom: undefined, page: 1 }));
  });

  it("round-trips the filters for paging links", () => {
    const query = parseCaseListQuery({ q: "VCR", status: "closed", completionTo: "2026-12-31" });
    expect(parseCaseListQuery(caseListParams(query) as Record<string, string>)).toEqual(query);
    expect(hasDateFilter(query)).toBe(true);
    expect(hasDateFilter(parseCaseListQuery({ q: "VCR" }))).toBe(false);
  });
});

describe("plate search", () => {
  it("compares plates without spaces, dashes or case", () => {
    expect(plateKey("9-tka 101")).toBe("9TKA101");
    expect(plateKey("--")).toBe("");
  });

  it("searches the text columns and the normalised plate", () => {
    const filter = caseSearchFilter("9-tka-101");
    expect(filter).toContain('case_number.ilike."%9-tka-101%"');
    expect(filter).toContain('licence_plate_key.ilike."%9TKA101%"');
  });

  it("leaves out the plate when the term has no letters or digits", () => {
    expect(caseSearchFilter("--")).not.toContain("licence_plate_key");
  });
});
