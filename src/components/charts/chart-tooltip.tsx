"use client";

import type { TooltipContentProps } from "recharts";

type Row = {
  key: string;
  label: string;
  /** Optional formatter; falls back to a plain en-US number. */
  format?: (value: number) => string;
};

/**
 * One tooltip for every chart on the site, so a hover reads the same way
 * wherever it happens.
 *
 * Labels and values wear text tokens rather than the series colour - the
 * colour swatch beside a row is what carries identity, and coloured text on a
 * dark panel is harder to read than it looks.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  rows,
  swatches = false,
}: Partial<TooltipContentProps<number, string>> & {
  rows: Row[];
  /** Show a colour chip per row - only useful for multi-series charts. */
  swatches?: boolean;
}) {
  if (!active || !payload?.length) return null;

  const datum = payload[0]?.payload as Record<string, number | string>;

  return (
    <div className="border-sw-line bg-sw-void/95 rounded-lg border px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-sw-text text-sm font-medium">{String(label)}</p>

      <dl className="mt-1.5 space-y-1">
        {rows.map((row, i) => {
          const raw = datum?.[row.key];
          if (raw == null) return null;
          const value =
            typeof raw === "number"
              ? (row.format?.(raw) ?? raw.toLocaleString("en-US"))
              : String(raw);

          return (
            <div key={row.key} className="flex items-center gap-2 text-xs">
              {swatches && (
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: payload[i]?.color ?? "var(--chart-1)",
                  }}
                  aria-hidden="true"
                />
              )}
              <dt className="text-sw-text-dim">{row.label}</dt>
              <dd className="tnum text-sw-text ml-auto font-medium">{value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
