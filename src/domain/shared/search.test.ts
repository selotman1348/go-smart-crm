import { describe, expect, it } from "vitest";

import { ilikeAnyFilter, pageNumber, pageRange, searchTerms } from "./search";

describe("searchTerms", () => {
  it("splits on whitespace and drops empty terms", () => {
    expect(searchTerms("  jonas   maes ")).toEqual(["jonas", "maes"]);
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms(undefined)).toEqual([]);
  });

  it("uses at most 5 terms", () => {
    expect(searchTerms("a b c d e f g")).toHaveLength(5);
  });
});

describe("ilikeAnyFilter", () => {
  it("matches the term as a substring in each column", () => {
    expect(ilikeAnyFilter(["name", "client_code"], "velo")).toBe(
      'name.ilike."%velo%",client_code.ilike."%velo%"',
    );
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(ilikeAnyFilter(["name"], "13%_off")).toBe('name.ilike."%13\\\\%\\\\_off%"');
  });

  it("quotes PostgREST syntax characters so input cannot add filters", () => {
    const filter = ilikeAnyFilter(["name"], 'x",id.eq.1,(name');
    expect(filter).toBe('name.ilike."%x\\",id.eq.1,(name%"');
    // Exactly one condition: the comma and quote stay inside the quoted value.
    expect(filter.startsWith('name.ilike."')).toBe(true);
    expect(filter.endsWith('%"')).toBe(true);
  });
});

describe("paging", () => {
  it("reads a positive page number and falls back to 1", () => {
    expect(pageNumber("3")).toBe(3);
    expect(pageNumber(["2", "5"])).toBe(2);
    for (const value of [undefined, "", "0", "-1", "1.5", "abc"]) {
      expect(pageNumber(value)).toBe(1);
    }
  });

  it("turns a page into an inclusive row range", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 24 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
  });
});
