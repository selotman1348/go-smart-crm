import { APP_TIME_ZONE } from "@/domain/shared/time";

export type PeriodCount = { period: string; label: string; count: number };

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

/** "2026-11" for an instant, in the app's time zone. */
export function monthOf(instant: Date, timeZone = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

/**
 * UC-02: counts per month for the last `months` months up to and including
 * the current one; months without cases count 0.
 */
export function countPerMonth(dates: string[], now: Date, months = 12): PeriodCount[] {
  const [year, month] = monthOf(now).split("-").map(Number);
  const periods: PeriodCount[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const first = new Date(Date.UTC(year, month - 1 - offset, 1));
    const period = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
    periods.push({ period, label: MONTH_LABEL.format(first), count: 0 });
  }
  const index = new Map(periods.map((item, position) => [item.period, position]));
  for (const date of dates) {
    const position = index.get(monthOf(new Date(date)));
    if (position !== undefined) {
      periods[position].count += 1;
    }
  }
  return periods;
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Least-squares line through the values (x = 0, 1, 2 …): its value at each x. */
export function linearTrend(values: number[]): number[] {
  const n = values.length;
  if (n < 2) {
    return [...values];
  }
  const meanX = (n - 1) / 2;
  const meanY = average(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, x) => {
    numerator += (x - meanX) * (value - meanY);
    denominator += (x - meanX) ** 2;
  });
  const slope = numerator / denominator;
  return values.map((_, x) => meanY + slope * (x - meanX));
}

/** "rising", "falling" or "flat", for the chart's summary. */
export function trendDirection(trend: number[]): "rising" | "falling" | "flat" {
  if (trend.length < 2) {
    return "flat";
  }
  const change = trend[trend.length - 1] - trend[0];
  return Math.abs(change) < 0.5 ? "flat" : change > 0 ? "rising" : "falling";
}
