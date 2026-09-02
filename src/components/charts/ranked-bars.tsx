"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatStreams } from "@/lib/format";

export type RankedRow = {
  label: string;
  value: number;
  artists: number;
};

/**
 * A ranked horizontal bar chart, used for both "streams by genre" and
 * "streams by country".
 *
 * Horizontal because the category labels are words of very different lengths
 * ("Hip-Hop" against "Contemporary R&B", "Canada" against "Trinidad and
 * Tobago") - the usual alternative is rotating x-axis labels, which is worse
 * to read.
 *
 * One measure over a nominal dimension, so every bar takes the same slot-1
 * hue: colouring each category differently would spend the identity channel
 * re-encoding what the bar length already says.
 */
export function RankedBars({
  data,
  valueLabel = "Streams",
  color = "var(--chart-1)",
}: {
  data: RankedRow[];
  valueLabel?: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 30)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        barCategoryGap={4}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--sw-line)"
          strokeOpacity={0.5}
        />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatStreams(v)}
          stroke="var(--sw-text-dim)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          stroke="var(--sw-text-dim)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--sw-surface-2)", fillOpacity: 0.5 }}
          content={
            <ChartTooltip
              rows={[
                { key: "value", label: valueLabel, format: formatStreams },
                { key: "artists", label: "Artists in set" },
              ]}
            />
          }
        />
        {/* Rounded only on the data end; the baseline end stays square so the
            bars all start from the same hard edge. */}
        <Bar
          dataKey="value"
          fill={color}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
