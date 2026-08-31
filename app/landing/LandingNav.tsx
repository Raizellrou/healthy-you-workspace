import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { LandingThemeToggle } from "./LandingThemeToggle";

/**
 * Server Component — only the theme toggle inside it is a client island.
 *
 * The mockup's nav gains a blurred background once scrolled; that was
 * dropped deliberately (it needs a scroll listener for a purely cosmetic
 * effect). The nav is translucent-with-blur at all scroll positions
 * instead, which reads the same over content and costs no JavaScript.
 */
export function LandingNav() {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Petal home">
          <Logo size={24} />
          <span className="text-[15px] font-bold tracking-[0.16em] text-ink">PETAL</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="border-b border-transparent pb-0.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            Sign in
          </Link>
          <LandingThemeToggle />
        </div>
      </div>
    </nav>
  );
}
