import type { CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { PILLARS } from "@/lib/pillars";
import { PILLAR_ACCENT } from "@/lib/landing";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * Server Component. Renders PILLARS (lib/pillars.ts) — the product's own
 * authoritative list — so a pillar added there appears here with no edit.
 * Colour comes from PILLAR_ACCENT, which is landing-side presentation only.
 *
 * The accent bar that wipes across each card's top edge is a ::before in
 * app/globals.css (`.landing-card`), driven by the `--accent` custom
 * property set per card below. It reacts to :focus-within as well as
 * :hover, so keyboard users get the same affordance.
 */
export function LandingFeatures() {
  return (
    <section className="bg-paper-alt py-20" aria-labelledby="features-heading">
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8">
        <div className="landing-reveal max-w-[640px]">
          <Eyebrow>Every pillar, wired up</Eyebrow>
          <h2
            id="features-heading"
            className="mt-3.5 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium tracking-tight text-ink"
          >
            Seven tools, one dashboard
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <Link
              key={pillar.href}
              href={pillar.href}
              style={{ "--accent": PILLAR_ACCENT[pillar.href] ?? "var(--ink)" } as CSSProperties}
              className="landing-card landing-reveal relative overflow-hidden rounded-2xl border border-line bg-panel px-6 pt-6 pb-6 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl"
            >
              <Icon name={pillar.icon} size={30} className="mb-4 text-[var(--accent)]" />
              <h3 className="text-[17px] font-semibold text-ink">{pillar.label}</h3>
              <span className="mt-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                {pillar.category}
              </span>
              <p className="mt-3.5 text-sm leading-relaxed text-ink-soft">{pillar.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
