"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Children, type ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

/**
 * Wraps a grid of server-rendered cards (ArtistCard, genre cards, ...) and
 * brings them in one after another as the grid scrolls into view.
 *
 * Each child is cloned into its own `motion.div`, rather than animating the
 * container as a whole, because the children here are plain server-rendered
 * elements (ArtistCard etc.) with no motion props of their own - this is the
 * standard way to get a staggered reveal without turning every card
 * component itself into a client component.
 *
 * `className` goes on the container, so the caller's own grid classes
 * (`grid gap-4 sm:grid-cols-2 ...`) keep doing the layout; the per-card
 * wrapper divs are plain block elements and do not disturb a CSS grid.
 *
 * `as="ul"` renders the container (and each per-item wrapper) as list
 * markup instead of a div, for a grid whose children are `<li>` elements -
 * an `<li>` with no `<ul>`/`<ol>` ancestor is invalid HTML and drops list
 * semantics for assistive tech, so the plain-div default only fits a grid
 * of non-list items.
 */
export function StaggerReveal({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul";
}) {
  const reduceMotion = useReducedMotion();
  const ItemTag = as === "ul" ? "li" : "div";

  if (reduceMotion) {
    const Wrapper = as === "ul" ? "ul" : "div";
    return (
      <Wrapper className={className}>
        {Children.map(children, (child) => (
          <ItemTag>{child}</ItemTag>
        ))}
      </Wrapper>
    );
  }

  const MotionContainer = as === "ul" ? motion.ul : motion.div;
  const MotionItem = as === "ul" ? motion.li : motion.div;

  return (
    <MotionContainer
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
    >
      {Children.map(children, (child) => (
        <MotionItem variants={item}>{child}</MotionItem>
      ))}
    </MotionContainer>
  );
}
