import { cn } from "@/lib/utils";

/**
 * One headline number. The label carries the unit so the value itself can
 * stay short, and the value uses tabular figures so a row of tiles lines up.
 */
export function StatTile({
  value,
  label,
  hint,
  accent = "pink",
  numeric = true,
  className,
}: {
  value: string;
  label: string;
  hint?: string;
  accent?: "pink" | "cyan" | "amber" | "mint";
  /** Tabular mono figures. Turn off when the value is a word, not a number. */
  numeric?: boolean;
  className?: string;
}) {
  const accentClass = {
    pink: "text-sw-pink",
    cyan: "text-sw-cyan",
    amber: "text-sw-amber",
    mint: "text-sw-mint",
  }[accent];

  return (
    <div
      className={cn(
        "border-sw-line/60 bg-sw-surface/50 rounded-lg border p-4 backdrop-blur-sm",
        className,
      )}
      title={hint}
    >
      <p
        className={cn(
          "font-semibold",
          numeric
            ? "tnum text-2xl sm:text-3xl"
            : "font-heading text-xl leading-tight text-balance sm:text-2xl",
          accentClass,
        )}
      >
        {value}
      </p>
      <p className="text-sw-text-dim mt-1 text-xs tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}
