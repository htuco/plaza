import type { CSSProperties, ReactNode } from "react";

/**
 * One physical piece on the table. Three nested layers so the effects never
 * fight over `transform`:
 *
 *   .plaza-object        position + pointer parallax (depth-scaled)
 *   .plaza-object__enter pop-in choreography (staggered via delay)
 *   .plaza-object__float idle bobbing + slow rotation drift
 *
 * Decorative by default; `interactive` re-enables pointer events for pieces
 * that are real buttons (e.g. the rollable die).
 */
export function TableObject({
  x,
  y,
  depth = 0.4,
  rot = 0,
  rotDrift = 3,
  delay = 760,
  floatDur = 6.5,
  floatDelay = 0,
  z,
  desktopOnly = false,
  interactive = false,
  children,
}: {
  /** Horizontal position as a percentage of the scene. */
  x: number;
  /** Vertical position as a percentage of the scene. */
  y: number;
  /** Parallax factor — higher feels closer to the lamp. */
  depth?: number;
  /** Resting rotation in degrees. */
  rot?: number;
  /** Extra degrees drifted at the top of the idle float. */
  rotDrift?: number;
  /** Entrance delay in ms (load choreography). */
  delay?: number;
  floatDur?: number;
  floatDelay?: number;
  z?: number;
  desktopOnly?: boolean;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`plaza-object ${interactive ? "plaza-object--interactive" : ""}`}
      data-desktop-only={desktopOnly || undefined}
      style={
        {
          "--ox": `${x}%`,
          "--oy": `${y}%`,
          "--depth": depth,
          "--rot": `${rot}deg`,
          "--rot-drift": `${rotDrift}deg`,
          "--o-delay": `${delay}ms`,
          "--float-dur": `${floatDur}s`,
          "--float-delay": `${floatDelay}s`,
          ...(z !== undefined ? { "--oz": z } : {}),
        } as CSSProperties
      }
    >
      <span className="plaza-object__enter">
        <span className="plaza-object__float">{children}</span>
      </span>
    </div>
  );
}
