import { Logo } from "@/components/shell/Logo";

/** Server Component. The wordmark is gradient-filled text
 *  (background-clip), so it inherits the spectrum tokens and re-themes
 *  with the rest of the page rather than baking in a colour. */
export function LandingFooter() {
  return (
    <footer className="border-t border-line px-6 py-16 text-center sm:px-8">
      <div className="inline-flex flex-col items-center gap-3.5">
        <Logo size={56} />
        <span className="bg-gradient-to-r from-p1-soft to-p5-soft bg-clip-text pl-[0.34em] text-[22px] font-bold tracking-[0.34em] text-transparent">
          PETAL
        </span>
      </div>
      <p className="mt-5 text-[13px] text-ink-mute">
        Petal, an HR wellbeing dashboard · {new Date().getFullYear()}
      </p>
    </footer>
  );
}
