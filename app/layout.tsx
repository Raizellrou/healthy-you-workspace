import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { IconSprite } from "@/components/icons/IconSprite";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Display serif, landing page only. Loaded as a variable font: next/font
 * rejects `axes` alongside a fixed `weight` list ("Axes can only be defined
 * for variable fonts when the weight property is nonexistent or set to
 * `variable`"), so the weight axis stays continuous and `axes` names only
 * the one extra axis in use. Fraunces also ships SOFT and WONK — omitted,
 * since nothing here sets them and each axis adds to the file. Italic is
 * included because the hero headline sets one word in it.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

/** Mono, for eyebrow labels and category tags. Static font — only the two
 *  weights the design actually sets. */
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PETAL",
  description: "HR wellbeing platform — burnout analytics, nudges, mood, boundaries, kudos, tasks, and focus mode.",
  icons: {
    icon: "/logo.webp",
  },
};

const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-bg text-ink">
        {/* `beforeInteractive` Scripts need a stable position for Next's
            hydration/hoisting — inserting a sibling ahead of it here
            triggered "Encountered a script tag while rendering React
            component" in dev. The skip link only needs to be the first
            *focusable* element, not literally body's first DOM node —
            Script and IconSprite render nothing focusable — so it moves
            after both instead. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <IconSprite />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
