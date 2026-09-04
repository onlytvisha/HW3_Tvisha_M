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
import type { ListenerBand } from "@/lib/types";

/**
 * How the archive's YouTube Music monthly listener counts are distributed.
 *
 * A histogram, not a ranked chart: the bars stay in band order even where
 * that is not the order of their heights, because the shape of the
 * distribution across the axis *is* the finding. Sorting these by count
 * would destroy the only thing the chart is for.
 *
 * The bands are order-of-magnitude wide (under 100K, 100K-1M, ...) rather
 * than linear. Monthly listener counts here run from a few thousand to a few
 * hundred million, so on a linear axis every bar but the last would be
 * indistinguishable from zero - see supabase/schema-v4-youtube-ranking.sql,
 * where the banding is done.
 *
 * One series, so one hue and no legend; the title names the measure.
 */
export function ListenerDistribution({ data }: { data: ListenerBand[] }) {
  const rows = data
    .slice()
    .sort((a, b) => a.band - b.band)
    .map((b) => ({ label: b.label, artists: b.artist_count }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--sw-line)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="label"
          stroke="var(--sw-text-dim)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--sw-text-dim)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: "var(--sw-surface-2)", fillOpacity: 0.5 }}
          content={
            <ChartTooltip rows={[{ key: "artists", label: "Artists" }]} />
          }
        />
        {/* Rounded on the data end only, so every bar rises from the same
            hard baseline. */}
        <Bar
          dataKey="artists"
          fill="var(--chart-3)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
