import type { CSSProperties } from "react";
import { InteractiveDice } from "@/components/landing/interactive-dice";
import { TableObject } from "@/components/landing/table-object";

/**
 * The pieces scattered across the hero table. Back decor paints behind the
 * content (letter tiles spelling PLAZA, face-down cards, coins, meeples);
 * positions are percentages of the scene, depths drive per-piece parallax.
 * Desktop-only — small screens keep the table calm and scroll-friendly.
 */
export function TableDecorBack() {
  return (
    <>
      {/* Letter tiles spelling PLAZA along the bottom edge of the table. */}
      {["P", "L", "A", "Z", "A"].map((char, index) => (
        <TableObject
          key={`${char}-${index}`}
          x={17.5 + index * 4.7}
          y={90.5 - (index % 2) * 2.4}
          depth={0.5 + index * 0.06}
          rot={(index - 2) * 6}
          rotDrift={index % 2 ? -2.5 : 2.5}
          delay={980 + index * 90}
          floatDur={6.8 + index * 0.45}
          desktopOnly
        >
          <span className="plaza-piece plaza-piece-tile">{char}</span>
        </TableObject>
      ))}

      {/* Face-down cards resting at the table edges. */}
      <TableObject x={4} y={20} depth={0.32} rot={-13} delay={860} floatDur={8.2} desktopOnly>
        <span className="plaza-piece-cardback">P</span>
      </TableObject>
      <TableObject x={91.5} y={7} depth={0.5} rot={11} delay={1040} floatDur={7.4} desktopOnly>
        <span className="plaza-piece-cardback">P</span>
      </TableObject>
      <TableObject
        x={47}
        y={86}
        depth={0.78}
        rot={7}
        rotDrift={-3}
        delay={1140}
        floatDur={6.4}
        desktopOnly
      >
        <span className="plaza-piece plaza-piece-card plaza-piece-card--lg" />
      </TableObject>

      {/* Coins and meeples filling the quiet corners. */}
      <TableObject x={7} y={62} depth={0.42} delay={1220} floatDur={5.8} desktopOnly>
        <span className="plaza-piece plaza-piece-coin" />
      </TableObject>
      <TableObject x={52} y={11} depth={0.6} delay={1330} floatDur={6.9} desktopOnly>
        <span className="plaza-piece plaza-piece-coin" />
      </TableObject>
      <TableObject
        x={12}
        y={87}
        depth={0.55}
        rot={-7}
        delay={1180}
        floatDur={7.1}
        desktopOnly
      >
        <span
          className="plaza-piece-pawn"
          style={{ "--pawn-color": "var(--plaza-team-0)" } as CSSProperties}
        />
      </TableObject>
      <TableObject
        x={63}
        y={15}
        depth={0.68}
        rot={6}
        delay={1280}
        floatDur={6.2}
        desktopOnly
      >
        <span
          className="plaza-piece-pawn"
          style={{ "--pawn-color": "var(--plaza-team-1)" } as CSSProperties}
        />
      </TableObject>
      <TableObject x={88.5} y={92} depth={0.5} rot={-4} delay={1400} floatDur={7.8} desktopOnly>
        <span
          className="plaza-piece-pawn"
          style={{ "--pawn-color": "var(--plaza-team-2)" } as CSSProperties}
        />
      </TableObject>
    </>
  );
}

/**
 * Front decor: the big rollable die sitting in the gap between the copy and
 * the tray — above the content layer so it stays genuinely clickable.
 */
export function TableDecorFront() {
  return (
    <TableObject
      x={63.5}
      y={60}
      depth={0.95}
      delay={1260}
      floatDur={7.5}
      desktopOnly
      interactive
    >
      <InteractiveDice size="hero" startValue={3} />
    </TableObject>
  );
}
