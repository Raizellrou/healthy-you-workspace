import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { LoginClient } from "./LoginClient";

/**
 * Server Component shell around the interactive form. The halo and
 * wordmark are static chrome shared with the landing page's brand
 * language — kept here rather than in LoginClient so the client bundle
 * stays limited to what actually needs state (the form itself).
 */
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 py-16">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,var(--p1-soft)_0%,var(--p5-soft)_45%,transparent_72%)] opacity-15 blur-3xl dark:opacity-25"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-4 inline-flex items-center text-sm text-ink-soft hover:text-ink">
          ← Back to home
        </Link>
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5" aria-label="Petal home">
          <Logo size={26} />
          <span className="text-[15px] font-bold tracking-[0.16em] text-ink">PETAL</span>
        </Link>
        <LoginClient />
      </div>
    </div>
  );
}
