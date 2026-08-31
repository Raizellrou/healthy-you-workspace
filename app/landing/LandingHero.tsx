import Link from "next/link";
import { PETAL_LETTERS } from "@/lib/landing";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { gradientButtonClassName } from "@/components/ui/Button";

/**
 * Server Component. The draw/undraw loop, wash fade, and sway are all CSS
 * (`.hero-tulip-*` / `.landing-mark`, app/globals.css), so nothing here
 * needs the client.
 *
 * The hero art is an illustrated tulip (this component's own inline SVG),
 * NOT the brand mark — the actual PETAL logo stays public/logo.webp via
 * <Logo/> everywhere it appears (LandingNav, LandingFooter) and is not
 * touched here. This illustration is decorative, ported from the landing
 * mockup's own hero-art markup: three petal paths, each drawn as a stroke
 * outline (pathLength=1 + stroke-dashoffset, staggered), with a soft
 * gradient-filled "wash" layered underneath. The whole sequence loops —
 * draws in, holds, undraws, repeats — rather than playing once; the sway
 * runs continuously and independently of it.
 *
 * Legend chips are plain anchors to the pillar rows. No scroll handler:
 * the browser's own fragment navigation does it, and unlike a click
 * listener it is focusable, keyboard-operable, and right-clickable.
 */

const PETAL_PATHS = [
  { className: "p-left", d: "M100,110 C63,106 38,80 42,44 C64,58 94,84 100,110 Z" },
  { className: "p-center", d: "M100,110 C75,100 60,54 100,16 C140,54 125,100 100,110 Z" },
  { className: "p-right", d: "M100,110 C137,106 162,80 158,44 C136,58 106,84 100,110 Z" },
];
export function LandingHero() {
  return (
    <header className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 pt-20 pb-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pt-28">
        <div className="order-2 lg:order-1">
          <Eyebrow>A demo HR wellbeing platform</Eyebrow>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,5.4vw,4.25rem)] font-medium leading-[1.05] tracking-tight text-ink">
            HR wellbeing,
            <br />
            <em className="font-normal italic text-p5">engineered.</em>
          </h1>
          <p className="mt-5 max-w-[480px] text-lg leading-relaxed text-ink-soft">
            Petal is a people-first dashboard that predicts burnout, protects boundaries, and strengthens team
            connection, before anyone burns out.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link href="/login" className={gradientButtonClassName()}>
              Sign in to explore
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-line pb-1 text-[15px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              View on GitHub
            </a>
          </div>
        </div>

        <div className="relative order-1 flex items-center justify-center lg:order-2" aria-hidden="true">
          <div className="pointer-events-none absolute h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,var(--p1-soft)_0%,var(--p5-soft)_42%,transparent_72%)] opacity-15 blur-3xl dark:opacity-30 lg:h-[520px] lg:w-[520px]" />
          <svg
            viewBox="0 0 200 260"
            className="relative h-auto w-[min(56%,260px)] lg:w-[min(78%,300px)]"
            role="img"
            aria-label="An illustrated tulip in Petal's brand gradient"
          >
            <defs>
              <linearGradient id="heroTulipGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: "var(--p1-soft)" }} />
                <stop offset="100%" style={{ stopColor: "var(--p5-soft)" }} />
              </linearGradient>
            </defs>
            <g className="landing-mark">
              <path
                className="hero-tulip-leaf"
                d="M100,150 C79,143 60,155 48,178 C71,176 92,166 100,150 Z"
                fill="var(--stem)"
              />
              <path
                className="hero-tulip-stem"
                d="M100,107 C97,146 103,182 100,225"
                stroke="var(--stem)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
              {PETAL_PATHS.map((petal) => (
                <g key={petal.className}>
                  <path
                    className={`hero-tulip-wash ${petal.className}`}
                    d={petal.d}
                    fill="url(#heroTulipGradient)"
                    stroke="none"
                  />
                  <path
                    className={`hero-tulip-draw ${petal.className}`}
                    d={petal.d}
                    fill="none"
                    stroke="url(#heroTulipGradient)"
                    strokeWidth="5.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                  />
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-6 pb-8 sm:px-8">
        <ul className="landing-reveal grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {PETAL_LETTERS.map((p) => (
            <li key={p.letter}>
              <a
                href={`#${p.anchorId}`}
                className="flex h-full flex-col gap-2.5 bg-panel p-5 transition-colors hover:bg-paper-alt"
              >
                <span className={`h-2.5 w-2.5 rotate-45 rounded-sm ${p.dotClass}`} aria-hidden="true" />
                <span className="font-mono text-[13px] font-semibold text-ink">
                  {p.letter}: {p.word}
                </span>
                <span className="text-xs leading-snug text-ink-mute">{p.tagline}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
