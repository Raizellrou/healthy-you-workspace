import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-fg hover:bg-brand-dark disabled:bg-line disabled:text-ink-mute",
  secondary:
    "bg-surface-2 text-ink hover:bg-line disabled:text-ink-mute",
  ghost:
    "bg-transparent text-ink-soft hover:bg-surface-2 disabled:text-ink-mute",
  danger:
    "bg-risk-critical/10 text-risk-critical hover:bg-risk-critical/20 disabled:text-ink-mute",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

/**
 * The brand gradient pill used at marketing/auth "front door" surfaces —
 * the landing page's CTAs and the login submit button. Deliberately not a
 * `Button` variant: `Button`'s variants are the app's internal, functional
 * button language (dashboard, tasks, every authenticated screen); this is
 * a brand moment meant for a small, specific set of surfaces, not
 * something any app screen should be able to reach for by name.
 *
 * A plain class-string function rather than its own component because it
 * needs to render as both a Next `Link` (landing) and a real
 * `<button type="submit">` (login) — not worth a polymorphic component
 * for two call shapes.
 */
export function gradientButtonClassName(className = "") {
  return `inline-flex items-center justify-center rounded-full bg-gradient-to-r from-p1-soft to-p5-soft px-6 py-3 text-[15px] font-semibold text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-60 ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
