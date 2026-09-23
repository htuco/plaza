"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { HigherLowerCard } from "./types";

export function formatSearches(value: number): string {
  return new Intl.NumberFormat("bs-BA").format(value);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Counts from 0 up to `value` on mount — the reveal's drumroll.
export function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, value]);

  return <>{formatSearches(shown)}</>;
}

export function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <span className="rm-hl-hearts" aria-label={`${lives} / ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={index < lives ? "" : "rm-hl-heart--lost"}>
          ♥
        </span>
      ))}
    </span>
  );
}

export function ItemCard({
  card,
  eyebrow,
  unit,
  tone,
  hiddenLabel,
  animateValue = false,
  className = "",
}: {
  card: HigherLowerCard;
  eyebrow: ReactNode;
  unit: string;
  tone?: "correct" | "wrong";
  hiddenLabel: string;
  animateValue?: boolean;
  className?: string;
}) {
  const hidden = card.searches === null;
  return (
    <div
      className={`rm-value-card ${hidden ? "rm-value-card--next" : ""} ${
        tone ? `rm-hl-card--${tone}` : ""
      } ${className}`}
    >
      <span className="rm-eyebrow">{eyebrow}</span>
      <span className="text-[1.1875rem] font-semibold leading-snug">{card.label}</span>
      <span
        className={`rm-numeric mt-1.5 text-[2rem] font-extrabold ${
          hidden ? "text-[var(--plaza-muted-2)]" : ""
        }`}
      >
        {card.searches === null ? (
          hiddenLabel
        ) : animateValue ? (
          <CountUp value={card.searches} />
        ) : (
          formatSearches(card.searches)
        )}
      </span>
      <span className="plaza-muted text-[0.78rem] font-medium">{unit}</span>
    </div>
  );
}

export function OptionGroup<T extends string | number>({
  label,
  options,
  value,
  format,
  disabled,
  onSelect,
  columns = 3,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  disabled: boolean;
  onSelect: (option: T) => void;
  columns?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="rm-eyebrow">{label}</span>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            disabled={disabled}
            onClick={() => onSelect(option)}
            className={`plaza-select-card grid min-h-11 place-items-center rounded-[0.875rem] px-2 text-[0.78rem] font-semibold disabled:cursor-default ${
              option === value ? "plaza-select-card--selected" : "disabled:opacity-50"
            }`}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
