"use client";

import { useState, type ReactNode } from "react";

/**
 * Shared "poke" micro-interaction used across the Wellbeing pillars: click
 * the wrapped visual for a squish-bounce plus a random reaction bubble.
 * Purely decorative — no data implication, no server round-trip.
 */
export function PokeBadge({
  reactions,
  label,
  children,
  shapeClassName = "rounded-full",
}: {
  reactions: string[];
  label: string;
  children: ReactNode;
  shapeClassName?: string;
}) {
  const [pokeKey, setPokeKey] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);

  function handlePoke() {
    setPokeKey((k) => k + 1);
    setReaction(reactions[Math.floor(Math.random() * reactions.length)]);
    window.setTimeout(() => setReaction(null), 1400);
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handlePoke}
        aria-label={label}
        className={`transition-transform active:scale-95 ${shapeClassName}`}
      >
        <span key={pokeKey} className={`inline-block${pokeKey > 0 ? " poke-bump" : ""}`}>
          {children}
        </span>
      </button>
      {reaction ? (
        <span
          aria-live="polite"
          className="reaction-pop pointer-events-none absolute -top-2 left-1/2 z-10 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-md"
        >
          {reaction}
        </span>
      ) : null}
    </span>
  );
}
