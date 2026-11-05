import { describe, expect, it } from "vitest";

import { formDefaults, readForm } from "./form-state";

describe("formDefaults", () => {
  it("uses the stored record until the user submits", () => {
    const defaults = formDefaults(undefined, { insurerRef: "ATL-1", onHold: true, tagIds: ["a"], deductible: 250 });
    expect(defaults.text("insurerRef")).toBe("ATL-1");
    expect(defaults.text("deductible")).toBe("250");
    expect(defaults.text("brokerRef")).toBe("");
    expect(defaults.checked("onHold")).toBe(true);
    expect(defaults.list("tagIds")).toEqual(["a"]);
  });

  it("uses the submitted values after a rejected save", () => {
    const defaults = formDefaults({ insurerRef: "typed", tagIds: [] }, { insurerRef: "ATL-1", onHold: true, tagIds: ["a"] });
    expect(defaults.text("insurerRef")).toBe("typed");
    expect(defaults.checked("onHold")).toBe(false);
    expect(defaults.list("tagIds")).toEqual([]);
  });
});

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
