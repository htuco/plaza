"use client";

import { useEffect, useRef } from "react";

/**
 * Immersive landing environment: the tabletop artwork lives on fixed layers
 * behind the content, and a soft circular spotlight trails the cursor,
 * revealing the warm, fully lit version of the table through a radial mask.
 *
 * - Fine pointers get the cursor spotlight (rAF + lerp smoothing).
 * - Touch devices get a slow ambient lamp glow instead.
 * - prefers-reduced-motion gets a static dimmed scene.
 *
 * All decorative layers are aria-hidden and pointer-events: none, so forms
 * and buttons on top stay fully interactive.
 */
export function SpotlightStage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");

    // Mode is a DOM attribute, not React state — the decorative layers are
    // styled purely from CSS and never need a re-render.
    if (reducedMotion.matches) {
      el.dataset.spotlight = "static";
      return;
    }
    if (!finePointer.matches) {
      el.dataset.spotlight = "ambient";
      return;
    }
    el.dataset.spotlight = "spotlight";

    let raf = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.4;
    let x = targetX;
    let y = targetY;
    let visible = false;

    const apply = () => {
      el.style.setProperty("--spot-x", `${x.toFixed(1)}px`);
      el.style.setProperty("--spot-y", `${y.toFixed(1)}px`);
    };

    const tick = () => {
      x += (targetX - x) * 0.14;
      y += (targetY - y) * 0.14;
      apply();
      if (Math.abs(targetX - x) > 0.4 || Math.abs(targetY - y) > 0.4) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!visible) {
        visible = true;
        el.style.setProperty("--spot-o", "1");
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointerLeave = () => {
      visible = false;
      el.style.setProperty("--spot-o", "0");
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
    <div ref={ref} data-spotlight="static" className={`plaza-stage ${className}`}>
      <div className="plaza-stage__art" aria-hidden="true" />
      <div className="plaza-stage__reveal" aria-hidden="true" />
      <div className="plaza-stage__glow" aria-hidden="true" />
      <div className="plaza-stage__vignette" aria-hidden="true" />
      <div className="plaza-stage__content flex min-h-svh flex-col">{children}</div>
    </div>
  );
}
