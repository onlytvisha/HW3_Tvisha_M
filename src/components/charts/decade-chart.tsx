"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { DecadeStat } from "@/lib/types";

/**
 * How many of the archive's artists debuted in each decade.
 *
 * An area over an ordered axis, because decades are a sequence and the shape
 * of the rise is the point. One series, so no legend - the title names it.
 */
export function DecadeChart({ data }: { data: DecadeStat[] }) {
  const rows = data
    .slice()
    .sort((a, b) => a.decade - b.decade)
    .map((d) => ({
      decade: `${d.decade}s`,
      artists: d.artist_count,
      streams: Number(d.total_streams_m),
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="decadeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid
          vertical={false}
          stroke="var(--sw-line)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="decade"
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
          width={32}
        />
        <Tooltip
          cursor={{ stroke: "var(--sw-text-dim)", strokeOpacity: 0.4 }}
          content={
            <ChartTooltip
              rows={[{ key: "artists", label: "Artists who debuted" }]}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="artists"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#decadeFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
