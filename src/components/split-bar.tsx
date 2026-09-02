import { Card, CardContent } from "@/components/ui/card";
import { formatStreams } from "@/lib/format";

type Segment = {
  label: string;
  value: number;
  color: string;
};

/**
 * A two-part stacked bar for a part-to-whole comparison.
 *
 * Deliberately not a pie: the interesting question here is always "which side
 * is bigger, and by how much", and a single bar answers that at a glance
 * while a pie makes you compare wedge angles. Values are labelled directly on
 * the legend rather than hidden in a tooltip, since this renders on the
 * server with no interactivity.
 */
export function SplitBar({
  title,
  caption,
  segments,
}: {
  title: string;
  caption?: string;
  segments: Segment[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <Card className="sw-card">
      <CardContent className="px-5">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {caption && (
          <p className="text-sw-text-dim mt-1.5 text-sm leading-relaxed">
            {caption}
          </p>
        )}

        {/* gap-0.5 puts a 2px surface sliver between the segments so the two
            fills read as separate marks rather than one blended band. */}
        <div
          className="mt-4 flex h-3 gap-0.5"
          role="img"
          aria-label={segments
            .map((s) => `${s.label}: ${pct(s.value).toFixed(1)} percent`)
            .join(", ")}
        >
          {segments.map((segment) => (
            <div
              key={segment.label}
              className="rounded-sm"
              style={{
                width: `${pct(segment.value)}%`,
                backgroundColor: segment.color,
              }}
            />
          ))}
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-start gap-2">
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <div>
                <dt className="text-sw-text-dim text-xs tracking-wide uppercase">
                  {segment.label}
                </dt>
                <dd className="tnum mt-0.5 text-sm">
                  <span className="font-medium">
                    {formatStreams(segment.value)}
                  </span>
                  <span className="text-sw-text-dim">
                    {" "}
                    &middot; {pct(segment.value).toFixed(1)}%
                  </span>
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
