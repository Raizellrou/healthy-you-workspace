import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { PETAL_LETTERS } from "@/lib/landing";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * Server Component. Full-width rows, one per spectrum stop. The glyph tilt
 * on row hover is CSS (`.landing-pillar` / `.landing-glyph`).
 *
 * Each row carries the `anchorId` the hero legend links to, and
 * `scroll-mt` so the sticky nav doesn't cover the heading on arrival.
 */
export function LandingPillars() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8" aria-labelledby="pillars-heading">
      <div className="landing-reveal max-w-[640px]">
        <Eyebrow>Five petals, one bloom</Eyebrow>
        <h2
          id="pillars-heading"
          className="mt-3.5 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium tracking-tight text-ink"
        >
          What PETAL stands for
        </h2>
        <p className="mt-4 max-w-[520px] text-[15px] text-ink-soft">
          Each pillar sits at its own point on Petal&apos;s spectrum — from focused indigo to warm, connective rose.
        </p>
      </div>

      <div className="mt-14">
        {PETAL_LETTERS.map((p) => (
          <article
            key={p.letter}
            id={p.anchorId}
            className="landing-pillar landing-reveal grid scroll-mt-24 grid-cols-[48px_1fr] gap-5 border-t border-line py-9 last:border-b sm:grid-cols-[64px_1fr] sm:gap-7"
          >
            <div
              className={`landing-glyph flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 sm:h-13 sm:w-13 ${p.softBgClass} ${p.colorClass}`}
              aria-hidden="true"
            >
              <Icon name={p.icon} size={24} />
            </div>
            <div>
              <h3 className="flex items-center gap-2.5 font-display text-[22px] font-medium text-ink">
                <span className="font-mono text-xs font-semibold text-ink-mute">{p.letter}</span>
                {p.word}
              </h3>
              <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-ink-soft">{p.description}</p>
              <Link
                href={p.href}
                className={`mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-semibold transition-all hover:gap-2.5 ${p.colorClass}`}
              >
                See it in action
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
