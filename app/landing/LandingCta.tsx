import Link from "next/link";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { gradientButtonClassName } from "@/components/ui/Button";
import { TulipField } from "./TulipField";

/** Server Component. The external link carries rel="noopener noreferrer"
 *  alongside target="_blank" (reverse-tabnabbing protection). Placeholder
 *  GitHub URL — swap once a real repo link is decided. */
export function LandingCta() {
  return (
    <section className="overflow-hidden px-6 pt-20 text-center sm:px-8">
      <div className="landing-reveal mx-auto max-w-[560px]">
        <Eyebrow centered>Ready to put people first?</Eyebrow>
        <h2 className="mt-3.5 font-display text-[clamp(2rem,4.4vw,2.875rem)] font-medium tracking-tight text-ink">
          Grown for people, not just for productivity.
        </h2>
        <p className="mt-4 text-[16.5px] text-ink-soft">
          Petal is a demo HR wellbeing platform built with Next.js, Supabase, and a lot of care.
        </p>
      </div>

      <div className="landing-reveal mt-8 flex flex-wrap items-center justify-center gap-6">
        <Link href="/login" className={gradientButtonClassName()}>
          Sign in
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

      <TulipField />
    </section>
  );
}
