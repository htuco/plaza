"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePreferences } from "./preferences-provider";
import { CheckIcon } from "./room-icons";

// The room code is the hero of the lobby: one cell per character, tappable to
// copy. Three placements, same component:
//   lg     — join screen, 58×72 cells
//   md     — lobby hero, 46×56 cells
//   inline — compact row (guest lobby), the code as one monospace line
//   sm     — chip in the in-game top bar
type RoomCodeSize = "lg" | "md" | "inline" | "sm";

const CELL_SCALE: Record<"lg" | "md", CSSProperties> = {
  lg: {
    "--rm-cell-w": "3.625rem",
    "--rm-cell-h": "4.5rem",
    "--rm-cell-radius": "1rem",
    "--rm-cell-size": "1.875rem",
    "--rm-cell-gap": "0.5rem",
  } as CSSProperties,
  md: {
    "--rm-cell-w": "2.875rem",
    "--rm-cell-h": "3.5rem",
    "--rm-cell-radius": "0.75rem",
    "--rm-cell-size": "1.44rem",
    "--rm-cell-gap": "0.4375rem",
  } as CSSProperties,
};

export function RoomCode({
  code,
  size = "md",
}: {
  code: string;
  size?: RoomCodeSize;
}) {
  const { t } = usePreferences();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (http / older browser) — the code is visible anyway.
    }
  }

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("code.copyAria", code)}
        className="rm-numeric plaza-code-chip inline-flex h-[1.875rem] shrink-0 items-center gap-1.5 rounded-[0.5625rem] px-2.5 text-xs font-semibold tracking-[0.12em]"
      >
        {code}
        <span aria-hidden="true" className="plaza-code-chip__icon text-[0.6rem] tracking-normal">
          {copied ? "✓" : "⧉"}
        </span>
      </button>
    );
  }

  if (size === "inline") {
    return (
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("code.copyAria", code)}
        className="flex min-w-0 flex-col items-start gap-0.5 text-left"
      >
        <span className="rm-eyebrow">{t("lobby.roomCode")}</span>
        <span className="rm-numeric text-[1.375rem] font-extrabold tracking-[0.14em]">
          {code}
        </span>
        <span
          aria-live="polite"
          className={`text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--plaza-success)] transition-opacity ${
            copied ? "opacity-100" : "opacity-0"
          }`}
        >
          {t("code.copied")}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("code.copyAria", code)}
      className="grid justify-items-center gap-2.5"
    >
      <span className="rm-code-cells" style={CELL_SCALE[size]}>
        {code.split("").map((character, index) => (
          <span key={index} className="rm-code-cell">
            {character}
          </span>
        ))}
      </span>
      {/* Confirmation only: the space is reserved so copying never shifts the
          layout, and the idle screen stays as quiet as the design. */}
      <span
        aria-live="polite"
        className={`inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--plaza-success)] transition-opacity ${
          copied ? "opacity-100" : "opacity-0"
        }`}
      >
        <CheckIcon size={12} /> {t("code.copied")}
      </span>
    </button>
  );
}
