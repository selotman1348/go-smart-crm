import { describe, expect, it } from "vitest";

import { readForm } from "./form-state";

describe("readForm", () => {
  it("reads single values, checkbox groups and skips React's action fields", () => {
    const form = new FormData();
    form.append("$ACTION_ID_123", "");
    form.append("name", "Riverside Body Shop BV");
    form.append("accountTypes", "repairer");
    form.append("accountTypes", "supplier");
    form.append("isNetworkMember", "on");

    expect(readForm(form, ["accountTypes"])).toEqual({
      name: "Riverside Body Shop BV",
      accountTypes: ["repairer", "supplier"],
      isNetworkMember: "on",
    });
  });

  it("returns an empty list for an unticked checkbox group", () => {
    expect(readForm(new FormData(), ["accountTypes"])).toEqual({ accountTypes: [] });
  });
});
