"use client";

import type { ReactNode } from "react";

// Pieces every game screen shares, so the six games read as one product:
// the phase header under the top bar, the phase-progress segments, the
// standings row, and the loading state.

export function PhaseHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="px-5 pt-[1.125rem] sm:px-6">
      <div className="rm-content flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="rm-eyebrow truncate">{eyebrow}</span>
          <span className="truncate text-[1.0625rem] font-semibold">{title}</span>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

// Fixed-width phase pills (Imposteri: reveal → clues → vote → result).
export function PhaseSegments({
  total,
  activeIndex,
  label,
}: {
  total: number;
  activeIndex: number;
  label: string;
}) {
  return (
    <span className="rm-segments" role="img" aria-label={label}>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={`rm-phase-segment ${index <= activeIndex ? "rm-phase-segment--on" : ""}`}
        />
      ))}
    </span>
  );
}

// A 40px standings row: name on the left, a monospace score on the right.
export function StandingRow({
  name,
  score,
  isMe = false,
  dimmed = false,
  note,
  rank,
  extra,
  youLabel,
}: {
  name: string;
  score: ReactNode;
  isMe?: boolean;
  dimmed?: boolean;
  note?: ReactNode;
  rank?: number;
  extra?: ReactNode;
  youLabel?: string;
}) {
  return (
    <li
      className={`flex h-10 items-center gap-2.5 rounded-xl px-3 ${
        isMe
          ? "border border-[color-mix(in_srgb,var(--plaza-accent)_32%,var(--plaza-line))] bg-[var(--plaza-accent-soft)]"
          : "plaza-subtle"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      {rank !== undefined && <span className="plaza-rank-badge">{rank}</span>}
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-[0.84rem] font-semibold">{name}</span>
        {isMe && youLabel && (
          <span className="shrink-0 text-[0.69rem] font-medium text-[var(--plaza-accent)]">
            {youLabel}
          </span>
        )}
        {note && <span className="plaza-muted-2 shrink-0 text-[0.69rem]">{note}</span>}
        {extra}
      </span>
      <span className="rm-numeric text-[0.94rem] font-bold">{score}</span>
    </li>
  );
}

export function RoomLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5 p-5">
      <div className="plaza-skeleton h-4 w-32 rounded-lg" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="plaza-skeleton h-13 rounded-xl" />
      ))}
    </div>
  );
}

export function RoomError({ message }: { message: string }) {
  return (
    <p className="plaza-error mx-5 rounded-xl px-3 py-2 text-[0.78rem] font-medium" role="alert">
      {message}
    </p>
  );
}

// "Waiting for the host" placeholder that occupies a bottom bar slot so the
// layout doesn't jump between host and guest views.
export function WaitingNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="rm-spinner" aria-hidden="true" />
      <span className="plaza-muted flex-1 text-[0.81rem]">{children}</span>
    </div>
  );
}
