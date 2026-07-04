"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/motion/FadeUp";

const HEADLINE = "Turn every contract into structured intelligence.";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Per-word stagger: first word at 0.15s, +0.08s each subsequent word.
const WORD_BASE_DELAY = 0.15;
const WORD_STEP = 0.08;

/** Floating glassmorphic stat card (echoes the reference "Trading Pairs" cards). */
function StatCard({
  label,
  value,
  caption,
  percent,
  className = "",
  delay = 0,
}: {
  label: string;
  value: string;
  caption: string;
  percent: number;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 20, scale: reduce ? 1 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={`pointer-events-auto w-[15rem] rounded-2xl border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-white/60">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/55">{caption}</p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </motion.div>
  );
}

export function VideoHero() {
  const words = HEADLINE.split(" ");

  return (
    <section className="relative z-10 flex h-screen min-h-[640px] flex-col justify-center overflow-hidden px-8 pb-8 pt-[70px] max-[900px]:px-[18px] max-[900px]:pt-[90px]">
      {/* --- Foreground content (background video is page-fixed in FixedVideoBg) --- */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <FadeUp
          as="span"
          delay={0.05}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur"
        >
          <Sparkles className="h-4 w-4 text-amber-300" />
          The new era of AI contract intelligence
        </FadeUp>

        {/* Heading — each word fades up on a stagger. */}
        <h2 className="m-0 flex flex-wrap justify-center gap-x-[0.25em] gap-y-1 font-display font-bold uppercase leading-[1.08] tracking-[-0.01em] text-white [font-size:clamp(30px,5vw,64px)]">
          {words.map((word, i) => (
            <FadeUp
              as="span"
              key={`${word}-${i}`}
              y={32}
              delay={WORD_BASE_DELAY + i * WORD_STEP}
              className="inline-block"
            >
              {word}
            </FadeUp>
          ))}
        </h2>

        {/* Subtext */}
        <FadeUp
          as="p"
          delay={0.9}
          className="mt-6 max-w-xl text-base leading-[1.65] text-white/85"
        >
          Parsegrid ingests any agreement, extracts the fields that matter with
          confidence-scored AI, and routes anything uncertain to a human — so nothing
          slips through.
        </FadeUp>

        {/* CTAs */}
        <FadeUp
          delay={1.05}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link href="/login">
            <Button
              size="lg"
              className="h-12 rounded-full bg-white px-8 text-base font-semibold text-slate-900 shadow-xl shadow-black/30 hover:bg-white/90"
            >
              Start free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="#how">
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/25 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur hover:bg-white/10 hover:text-white"
            >
              See how it works
            </Button>
          </Link>
        </FadeUp>
      </div>

      {/* --- Floating glass stat cards (desktop only, like the reference) --- */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-hidden>
        <StatCard
          label="Extraction accuracy"
          value="98.9%"
          caption="Across 2k+ contracts"
          percent={99}
          delay={1.2}
          className="absolute left-[6%] top-[30%]"
        />
        <StatCard
          label="Faster turnaround"
          value="96%"
          caption="Days to minutes"
          percent={96}
          delay={1.35}
          className="absolute bottom-[16%] right-[6%]"
        />
      </div>
    </section>
  );
}
