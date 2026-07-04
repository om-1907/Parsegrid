"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type Tag = "div" | "section" | "span" | "h1" | "h2" | "h3" | "p" | "nav";

type FadeUpProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
  as?: Tag;
  once?: boolean;
};

// Custom ease from the design spec (ease-out expo-ish).
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Reusable scroll-triggered fade-up. Animates opacity + Y translate when the
 * element enters the viewport. Honors `prefers-reduced-motion` by dropping the
 * translate (opacity-only), keeping content readable without movement.
 */
export function FadeUp({
  children,
  delay = 0,
  duration = 0.7,
  y = 24,
  className,
  style,
  as = "div",
  once = true,
}: FadeUpProps) {
  const reduce = useReducedMotion();
  // motion[as] is a valid motion component for each tag; cast to a concrete
  // one so TS resolves children/props uniformly regardless of the tag.
  const MotionTag = motion[as] as typeof motion.div;
  const offset = reduce ? 0 : y;

  return (
    <MotionTag
      className={className}
      style={style}
      initial={{ opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}
