"use client";

import Link from "next/link";
import { usePreferences } from "@/components/preferences-provider";
import { RoomBody, RoomContent, RoomScreen, RoomTopBar } from "@/components/room-shell";

// 09 · Soba ne postoji — the code expired or the host closed the room. Two
// equal-height actions: start a fresh room, or try another code.
export default function RoomNotFound() {
  const { t } = usePreferences();

  return (
    <RoomScreen>
      <RoomTopBar>
        <span className="plaza-display text-[1.0625rem] font-extrabold">Plaza</span>
      </RoomTopBar>

      <RoomBody center>
        <RoomContent className="items-center gap-4 px-6 py-10 text-center">
          <span
            className="plaza-panel grid h-18 w-18 place-items-center rounded-3xl text-[1.875rem]"
            aria-hidden="true"
          >
            🪑
          </span>
          <h1 className="plaza-display text-[1.375rem] font-extrabold">
            {t("notFound.emptyTitle")}
          </h1>
          <p className="plaza-muted max-w-65 text-[0.84rem] leading-relaxed">
            {t("notFound.emptyBody")}
          </p>

          <div className="mt-1.5 grid w-full max-w-70 gap-2.5">
            <Link href="/" className="plaza-button rm-cta">
              {t("notFound.createRoom")}
            </Link>
            <Link
              href="/#join"
              className="plaza-button-secondary flex h-14 items-center justify-center rounded-2xl text-sm font-semibold"
            >
              {t("notFound.enterCode")}
            </Link>
          </div>
        </RoomContent>
      </RoomBody>
    </RoomScreen>
  );
}
