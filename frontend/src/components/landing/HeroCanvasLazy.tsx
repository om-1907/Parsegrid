"use client";

import dynamic from "next/dynamic";

// WebGL is client-only and lazy so it never blocks first paint or SSR.
const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1e1b4b_0%,#070914_60%,#050510_100%)]" />
  ),
});

export default function HeroCanvasLazy() {
  return <HeroCanvas />;
}
