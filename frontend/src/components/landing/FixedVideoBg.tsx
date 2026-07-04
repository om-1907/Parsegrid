const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260514_135830_bb6491d1-9b66-4aec-9722-13b4dfe3fb46.mp4";

/**
 * Full-viewport background video, fixed to the viewport so it stays put while
 * the page content scrolls over it. A constant dark scrim keeps foreground text
 * readable everywhere on the page (≥4.5:1). Purely decorative → aria-hidden.
 */
export function FixedVideoBg() {
  return (
    <div className="fixed inset-0 z-0" aria-hidden>
      {/* Fallback while the video loads / if it fails — never a blank/white flash. */}
      <div className="absolute inset-0 bg-[#050510]" />
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      {/* Readability scrim over the whole video. */}
      <div className="absolute inset-0 bg-black/55" />
    </div>
  );
}
