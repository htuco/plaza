"use client";

import { useRef, useState, type CSSProperties } from "react";
import { usePreferences } from "@/components/preferences-provider";

// Cube rotation (deg) that brings each face front, per the face placements
// in globals.css (1 front, 2 bottom, 3 right, 4 left, 5 top, 6 back).
const FACES: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: 90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: -90, ry: 0 },
  6: { rx: 0, ry: 180 },
};

// Resting offset so the die always sits at a pleasing 3D angle instead of
// dead flat — the shown face stays ~25° off-axis but clearly readable.
const TILT_X = -14;
const TILT_Y = 20;
const ROLL_MS = 1150;

function norm(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * A real rollable 3D die. Click throws it: the cube hops while tumbling at
 * least one full turn per axis (rotation is cumulative so it never rewinds)
 * and settles on a random face. The result is announced via aria-live.
 */
export function InteractiveDice({
  size,
  className = "",
  startValue = 5,
}: {
  size?: "sm" | "lg" | "hero";
  className?: string;
  startValue?: number;
}) {
  const { t } = usePreferences();
  const [orientation, setOrientation] = useState(() => ({
    rx: FACES[startValue].rx + TILT_X,
    ry: FACES[startValue].ry + TILT_Y,
  }));
  const [rolling, setRolling] = useState(false);
  const [announce, setAnnounce] = useState("");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roll = () => {
    if (rolling) return;
    const value = 1 + Math.floor(Math.random() * 6);
    const target = FACES[value];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const turnsX = reduced ? 0 : 360 * (1 + Math.floor(Math.random() * 2));
    const turnsY = reduced ? 0 : 360;

    // Rotation is cumulative — add whole turns plus the shortest delta to the
    // next face so the cube always tumbles forward and never rewinds.
    setOrientation((prev) => ({
      rx: prev.rx + turnsX + norm(target.rx + TILT_X - prev.rx),
      ry: prev.ry + turnsY + norm(target.ry + TILT_Y - prev.ry),
    }));
    setRolling(true);

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(
      () => {
        setRolling(false);
        setAnnounce(t("table.rolled", value));
      },
      reduced ? 0 : ROLL_MS,
    );
  };

  const sizeClass =
    size === "sm"
      ? "plaza-dice--sm"
      : size === "lg"
        ? "plaza-dice--lg"
        : size === "hero"
          ? "plaza-dice--hero"
          : "";

  return (
    <button
      type="button"
      className={`plaza-dice ${sizeClass} ${className}`}
      data-rolling={rolling}
      onClick={roll}
      aria-label={t("table.rollDie")}
    >
      <span className="plaza-dice__scene" aria-hidden="true">
        <span
          className="plaza-dice__cube"
          style={
            {
              "--dice-rx": orientation.rx,
              "--dice-ry": orientation.ry,
            } as CSSProperties
          }
        >
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <span key={face} className={`plaza-dice__face plaza-dice__face--${face}`} />
          ))}
        </span>
      </span>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </button>
  );
}
