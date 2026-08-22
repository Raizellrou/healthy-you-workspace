import Image from "next/image";

/**
 * The brand mark, `public/logo.webp`. Replaces the hand-drawn gradient SVG
 * that used to live here (`PetalLogo.tsx`) — same call sites, same square
 * `size` prop, so swapping it in was a one-line change per usage.
 *
 * The source file has a transparent background, so it reads correctly both
 * on the light sidebar surface and the dark dashboard brand block.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.webp"
      alt="PETAL"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
