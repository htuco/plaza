"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "./preferences-provider";

// "Leave room" with an inline confirmation dialog. Hosts get an extra note
// because leaving hands the room to the next player (or closes it).
export function LeaveRoomButton({
  roomCode,
  isHost,
}: {
  roomCode: string;
  isHost: boolean;
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
        className="plaza-ghost-button h-9 shrink-0 rounded-lg px-3 text-xs font-medium"
      >
        {t("leave.action")}
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
          <div className="plaza-modal">
            <h2 className="text-lg font-semibold">{t("leave.title")}</h2>
            <p className="plaza-muted mt-1.5 text-sm">
              {isHost ? t("leave.hostNote") : t("leave.note")}
            </p>
            {error && <p className="mt-2 text-sm text-[var(--plaza-danger)]">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                disabled={leaving}
                onClick={() => setOpen(false)}
                className="plaza-button-secondary h-11 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t("leave.stay")}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => void leave()}
                className="plaza-button-danger h-11 rounded-lg text-sm font-medium disabled:opacity-60"
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
