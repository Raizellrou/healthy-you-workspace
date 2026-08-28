import { LandingNav } from "@/app/landing/LandingNav";
import { LandingHero } from "@/app/landing/LandingHero";
import { LandingPillars } from "@/app/landing/LandingPillars";
import { LandingFeatures } from "@/app/landing/LandingFeatures";
import { LandingCta } from "@/app/landing/LandingCta";
import { LandingFooter } from "@/app/landing/LandingFooter";
import { Eyebrow } from "@/components/ui/Eyebrow";

const HOW_IT_WORKS = [
  { step: "Sign in", description: "One shared demo account, zero friction." },
  { step: "Explore", description: "24 team members, real data, every pillar wired up." },
  { step: "Act", description: "From burnout alerts to boundary enforcement, take action." },
];

/**
 * Public landing page. Reachable by unauthenticated visitors because
 * proxy.ts treats "/" as a public route alongside "/login" — an
 * authenticated visitor is redirected to /dashboard before this renders.
 *
 * No data fetching anywhere on this page: every string is static marketing
 * copy. That is deliberate, not incidental — this route is served to
 * anonymous traffic, and the employee tables it would otherwise read are
 * all `to authenticated` under RLS.
 *
 * The page paints on `bg-paper` rather than the app's `--bg`, so the
 * landing sits on the mockup's white while `bg-paper-alt` sections still
 * read as distinct bands.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-paper">
      <LandingNav />

      <main>
        <LandingHero />
        <LandingPillars />
        <LandingFeatures />

        <section className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8" aria-labelledby="how-it-works-heading">
          <div className="landing-reveal mx-auto max-w-[640px] text-center">
            <Eyebrow centered>A short path, on purpose</Eyebrow>
            <h2
              id="how-it-works-heading"
              className="mt-3.5 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium tracking-tight text-ink"
            >
              How it works
            </h2>
          </div>

          <ol className="mt-12 grid grid-cols-1 gap-9 md:grid-cols-3 md:gap-0">
            {HOW_IT_WORKS.map((item, i) => (
              <li key={item.step} className="landing-step landing-reveal relative px-8 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel font-mono text-sm font-semibold text-ink">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-[19px] font-semibold text-ink">{item.step}</h3>
                <p className="mx-auto mt-2.5 max-w-[250px] text-[14.5px] text-ink-soft">{item.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <LandingCta />
      </main>

      <LandingFooter />
    </div>
  );
}
