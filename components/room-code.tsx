"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "./preferences-provider";

// Prominent, tappable room code. Tapping copies it for sharing.
export function RoomCode({
  code,
  size = "lg",
}: {
  code: string;
  size?: "lg" | "sm";
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
      // Clipboard unavailable (http / older browser) — nothing to do, code is visible anyway.
    }
  }

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("code.copyAria", code)}
        className="plaza-code-chip inline-flex h-9 items-center gap-2 rounded-lg px-3 font-mono text-sm font-semibold tracking-[0.2em]"
      >
        {code}
        <span aria-hidden="true" className="plaza-code-chip__icon text-xs tracking-normal">
          {copied ? "✓" : "⧉"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("code.copyAria", code)}
      className="plaza-code-hero group"
    >
      <span className="plaza-code-hero__digits">
        {code.split("").map((ch, i) => (
          <span key={i} className="plaza-code-hero__digit">
            {ch}
          </span>
        ))}
      </span>
      <span className="plaza-code-hero__hint">
        {copied ? t("code.copied") : t("code.tapToCopy")}
      </span>
    </button>
  );
}
