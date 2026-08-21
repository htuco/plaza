import type { ReactNode } from "react";

// The room shell every authenticated screen shares: a 56px top bar with a
// hairline under it, a body that scrolls, and — where the screen has an
// action — a bottom bar pinned within one-hand reach.
//
// Mobile-first: on a phone this is the whole viewport. On a tablet it becomes a
// framed column; on a desktop the frame widens, and screens that have two jobs
// (the lobby, a board and its standings) opt into `wide` and lay out in two
// panes via `RoomSplit`.
//
// Server-safe on purpose: the join screen, lobby and game pages all mount it,
// and the interactive parts live in the children.

export function RoomScreen({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="plaza-room-page">
      <div className="plaza-room" data-wide={wide ? "true" : undefined}>
        {children}
      </div>
    </div>
  );
}

export function RoomTopBar({ children }: { children: ReactNode }) {
  return <header className="rm-topbar">{children}</header>;
}

// `scroll` is the default: content taller than the screen scrolls between the
// two bars instead of pushing the primary action off-screen.
export function RoomBody({
  children,
  scroll = true,
  center = false,
  className = "",
}: {
  children: ReactNode;
  scroll?: boolean;
  center?: boolean;
  className?: string;
}) {
  if (!scroll) {
    return (
      <div className={`rm-body ${center ? "justify-center" : ""} ${className}`}>{children}</div>
    );
  }
  // Centring a scroll container with `justify-center` clips the top once the
  // content outgrows it, so the content is centred with auto margins instead.
  if (center) {
    return (
      <main className="rm-scroll flex flex-col">
        <div className={`m-auto flex w-full flex-col ${className}`}>{children}</div>
      </main>
    );
  }
  return <main className={`rm-scroll flex flex-col ${className}`}>{children}</main>;
}

// One capped, centred column — keeps a single-column screen readable when the
// shell is wider than a phone.
export function RoomContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`rm-content flex flex-col ${className}`}>{children}</div>;
}

// Two panes side by side on a desktop, stacked below it. Use inside a `wide`
// RoomScreen; `aside` is the narrower supporting pane.
//
// `asideFirst` sets the reading order in both directions: the lobby leads with
// the room code (top on a phone, left on a desktop), while a game screen leads
// with the play and puts standings after it (below, then right).
export function RoomSplit({
  aside,
  children,
  asideFirst = false,
}: {
  aside: ReactNode;
  children: ReactNode;
  asideFirst?: boolean;
}) {
  const asidePane = (
    <div className="rm-split__aside flex flex-col gap-3.5">{aside}</div>
  );
  return (
    <div className="rm-split">
      {asideFirst ? asidePane : null}
      {children}
      {asideFirst ? null : asidePane}
    </div>
  );
}

export function RoomBottomBar({
  children,
  note,
}: {
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rm-bottombar">
      <div className="rm-bar-inner">
        {children}
        {note ? (
          <p className="plaza-muted-2 text-center text-[0.69rem] leading-snug">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="rm-eyebrow">{children}</span>;
}
