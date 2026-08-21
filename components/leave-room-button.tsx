"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "./preferences-provider";

// "Leave room" with an inline confirmation dialog. Hosts get an extra note
// because leaving hands the room to the next player (or closes it).
//
// `label` lets the in-game top bar use the shorter "Izađi" while the lobby
// keeps the full "Napusti sobu".
export function LeaveRoomButton({
  roomCode,
  isHost,
  label = "leave.action",
}: {
  roomCode: string;
  isHost: boolean;
  label?: "leave.action" | "room.exit";
}) {
  const router = useRouter();
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setLeaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/leave`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(t("leave.error"));
        setLeaving(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("leave.error"));
      setLeaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="plaza-button-secondary h-8 shrink-0 rounded-[0.625rem] px-3 text-xs font-medium"
      >
        {t(label)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("leave.title")}
          className="plaza-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !leaving) setOpen(false);
          }}
        >
          <div className="plaza-modal plaza-modal--confirm grid gap-2">
            <h2 className="plaza-display text-[1.125rem] font-extrabold">{t("leave.title")}</h2>
            <p className="plaza-muted text-[0.81rem] leading-relaxed">
              {isHost ? t("leave.hostNote") : t("leave.note")}
            </p>
            {error && <p className="plaza-error mt-1 rounded-lg px-3 py-2 text-sm">{error}</p>}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                autoFocus
                disabled={leaving}
                onClick={() => setOpen(false)}
                className="plaza-button-secondary h-12 rounded-[0.875rem] text-sm font-semibold disabled:opacity-50"
              >
                {t("leave.stay")}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => void leave()}
                className="plaza-button-danger h-12 rounded-[0.875rem] text-sm font-bold disabled:opacity-60"
              >
                {leaving ? "…" : t("leave.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
