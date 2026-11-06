"use client";

import { useState } from "react";

import type { PeriodCount } from "@/domain/dashboard";

const WIDTH = 640;
const HEIGHT = 220;
const MARGIN = { top: 12, right: 64, bottom: 28, left: 32 };

/** A clean axis maximum and whole-number ticks (case counts). */
function axis(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(1, max);
  const step = raw <= 5 ? 1 : raw <= 10 ? 2 : raw <= 25 ? 5 : Math.ceil(raw / 50) * 10;
  const top = Math.ceil(raw / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top; tick += step) {
    ticks.push(tick);
  }
  return { top, ticks };
}

/** A column with a 4px rounded data-end and a square base. */
function columnPath(x: number, y: number, width: number, baseline: number): string {
  const height = baseline - y;
  if (height <= 0) {
    return "";
  }
  const r = Math.min(4, width / 2, height);
  return `M${x},${baseline} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${baseline} Z`;
}

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * UC-02: new cases per month (columns) with the average (reference line) and
 * the least-squares trend (line). Hover or focus a month for its values; the
 * table view holds every value.
 */
export function NewCasesChart({ perMonth, average, trend }: { perMonth: PeriodCount[]; average: number; trend: number[] }) {
  const [active, setActive] = useState<number | null>(null);
  const counts = perMonth.map((item) => item.count);
  const { top, ticks } = axis(Math.max(...counts, ...trend, average));
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / perMonth.length;
  const columnWidth = Math.min(24, band * 0.6);
  const baseline = MARGIN.top + plotHeight;
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const center = (index: number) => MARGIN.left + band * index + band / 2;
  const averageY = y(average);
  const trendPoints = trend.map((value, index) => `${center(index)},${y(Math.max(0, value))}`).join(" ");
  const current = active === null ? null : perMonth[active];

  return (
    <figure className="grid gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-viz-series-1" /> New cases
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-viz-series-2" /> Trend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4 bg-muted-foreground" /> Average ({format(average)} per month)
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`New cases per month over the last ${perMonth.length} months; on average ${format(average)} per month.`}
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
              <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px]">
                {tick}
              </text>
            </g>
          ))}
          {perMonth.map((item, index) => (
            <g key={item.period}>
              <path
                d={columnPath(center(index) - columnWidth / 2, y(item.count), columnWidth, baseline)}
                className="fill-viz-series-1"
                opacity={active === null || active === index ? 1 : 0.55}
              />
              <text x={center(index)} y={baseline + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {item.label}
              </text>
            </g>
          ))}
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={averageY} y2={averageY} className="stroke-muted-foreground" strokeWidth={1} />
          <text x={WIDTH - MARGIN.right + 6} y={averageY} dy="0.32em" className="fill-muted-foreground text-[10px]">
            avg {format(average)}
          </text>
          <polyline points={trendPoints} fill="none" className="stroke-viz-series-2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {perMonth.map((item, index) => (
            // The whole month band is the hit target, larger than the column.
            <rect
              key={item.period}
              x={MARGIN.left + band * index}
              y={MARGIN.top}
              width={band}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${item.label}: ${item.count} new ${item.count === 1 ? "case" : "cases"}, trend ${format(trend[index])}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="outline-none focus-visible:stroke-ring"
            />
          ))}
        </svg>
        {current && active !== null ? (
          <div
            className="pointer-events-none absolute top-0 grid min-w-28 -translate-x-1/2 gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: `${(center(active) / WIDTH) * 100}%` }}
          >
            <p className="text-muted-foreground">{current.label}</p>
            <p>
              <span className="text-sm font-semibold tabular-nums">{current.count}</span>{" "}
              <span className="text-muted-foreground">new {current.count === 1 ? "case" : "cases"}</span>
            </p>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-0.5 w-3 rounded bg-viz-series-2" />
              trend <span className="tabular-nums text-foreground">{format(trend[active])}</span>
            </p>
          </div>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full max-w-sm text-left text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="font-normal">Month</th>
              <th className="text-right font-normal">New cases</th>
              <th className="text-right font-normal">Trend</th>
            </tr>
          </thead>
          <tbody>
            {perMonth.map((item, index) => (
              <tr key={item.period}>
                <td>{item.label}</td>
                <td className="text-right tabular-nums">{item.count}</td>
                <td className="text-right tabular-nums">{format(trend[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
