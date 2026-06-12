"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The 3D rig for the landing hero. Tracks the pointer and writes four CSS
 * vars onto the section (rAF + lerp, no React re-renders):
 *
 *   --tilt-x / --tilt-y  plane rotation in deg — tilts the object plane
 *   --par-x  / --par-y   normalized pointer offset (−1…1) — parallax input
 *
 * Two object layers sandwich the content:
 *   `back`  — decorative pieces painted behind the content
 *   `front` — interactive pieces (pointer-events re-enabled per object)
 *
 * The rig never starts on touch devices, small screens, or reduced motion —
 * vars stay at 0 and the CSS renders a static table.
 */
export function TableScene({
  back,
  front,
  children,
  className = "",
}: {
  back?: ReactNode;
  front?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const wideViewport = window.matchMedia("(min-width: 1024px)");
    if (reducedMotion.matches || !finePointer.matches || !wideViewport.matches) return;

    const MAX_TILT_X = 2.1;
    const MAX_TILT_Y = 1.6;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      el.style.setProperty("--par-x", x.toFixed(3));
      el.style.setProperty("--par-y", y.toFixed(3));
      el.style.setProperty("--tilt-x", (x * MAX_TILT_X).toFixed(2));
      el.style.setProperty("--tilt-y", (y * -MAX_TILT_Y).toFixed(2));
    };

    const tick = () => {
      x += (targetX - x) * 0.085;
      y += (targetY - y) * 0.085;
      apply();
      if (Math.abs(targetX - x) > 0.002 || Math.abs(targetY - y) > 0.002) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <section ref={ref} className={`plaza-scene ${className}`}>
      {back && (
        <div className="plaza-scene__objects" aria-hidden="true">
          <div className="plaza-scene__plane">{back}</div>
        </div>
      )}
      {children}
      {front && (
        <div className="plaza-scene__objects" style={{ zIndex: 5 }}>
          <div className="plaza-scene__plane">{front}</div>
        </div>
      )}
    </section>
  );
}
