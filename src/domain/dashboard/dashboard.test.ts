import { describe, expect, it } from "vitest";

import { isOverdue, parseTaskInput } from "@/domain/tasks/task-rules";

import { average, countPerMonth, linearTrend, monthOf, trendDirection } from "./trends";

const USER = "11111111-1111-4111-8111-111111111111";

describe("new cases per month (UC-02)", () => {
  const now = new Date("2026-11-05T10:00:00Z");

  it("counts the last 12 months, empty months included, in Brussels time", () => {
    const months = countPerMonth(
      ["2026-11-01T09:00:00Z", "2026-10-31T23:30:00Z", "2026-10-15T09:00:00Z", "2025-12-01T00:00:00+01:00", "2025-11-30T12:00:00Z"],
      now,
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ period: "2025-12", label: "Dec 25", count: 1 });
    // 31 October 23:30 UTC is already 1 November in Brussels.
    expect(months.at(-1)).toEqual({ period: "2026-11", label: "Nov 26", count: 2 });
    expect(months.at(-2)?.count).toBe(1);
    expect(monthOf(new Date("2026-03-31T22:30:00Z"))).toBe("2026-04");
  });

  it("gives the average and a least-squares trend", () => {
    expect(average([1, 2, 3, 6])).toBe(3);
    expect(average([])).toBe(0);
    expect(linearTrend([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(linearTrend([2, 2, 2])).toEqual([2, 2, 2]);
    expect(trendDirection(linearTrend([0, 1, 1, 2, 3, 3]))).toBe("rising");
    expect(trendDirection(linearTrend([4, 3, 1, 0]))).toBe("falling");
    expect(trendDirection(linearTrend([1, 1, 1]))).toBe("flat");
  });
});

describe("tasks (UC-03)", () => {
  it("needs a title and a category, and assigns “My tasks” to the creator", () => {
    expect(parseTaskInput({ title: "Call the driver", category: "my_tasks" }, USER)).toEqual({
      ok: true,
      value: { title: "Call the driver", category: "my_tasks", dueDate: null, assigneeUserId: USER, caseNumber: null },
    });
    expect(parseTaskInput({ title: "Chase estimate", category: "repairer_dealer", caseNumber: "dem20260001" }, USER)).toMatchObject({
      ok: true,
      value: { assigneeUserId: null, caseNumber: "DEM20260001" },
    });
    const invalid = parseTaskInput({ title: "", category: "nope", caseNumber: "123" }, USER);
    expect(invalid.ok ? [] : Object.keys(invalid.fieldErrors).sort()).toEqual(["caseNumber", "category", "title"]);
  });

  it("marks open tasks past their due date as overdue", () => {
    expect(isOverdue({ dueDate: "2026-11-04", done: false }, "2026-11-05")).toBe(true);
    expect(isOverdue({ dueDate: "2026-11-05", done: false }, "2026-11-05")).toBe(false);
    expect(isOverdue({ dueDate: "2026-11-01", done: true }, "2026-11-05")).toBe(false);
    expect(isOverdue({ dueDate: null, done: false }, "2026-11-05")).toBe(false);
  });
});
