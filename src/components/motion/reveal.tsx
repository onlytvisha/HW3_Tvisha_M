"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Fades and lifts its children in once they scroll into view.
 *
 * A client component wrapping server-rendered content: the page above stays
 * a Server Component and hands this plain markup as `children`, which is a
 * normal composition boundary in the App Router - only the animation logic
 * needs the browser.
 *
 * `once: true` means this never re-triggers on scroll back up - a section
 * that has already introduced itself does not need to again. Skipped
 * entirely under `prefers-reduced-motion`, matching the rest of the site's
 * convention (see --np-level and the recorder disks in globals.css).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
