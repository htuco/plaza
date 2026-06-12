"use client";

import { useActionState } from "react";
import { joinRoomAction } from "@/app/actions";
import { usePreferences } from "./preferences-provider";
import { RoomCode } from "./room-code";
import { SubmitButton } from "./submit-button";

type State = { error?: string } | undefined;

async function action(_prev: State, formData: FormData): Promise<State> {
  return joinRoomAction(formData);
}

// Shown when someone opens a shared room link but hasn't joined yet: the code is
// already known, so we only ask for a name and drop them straight into the lobby.
export function JoinLobbyForm({ code }: { code: string }) {
  const [state, formAction] = useActionState<State, FormData>(action, undefined);
  const { localizeError, t } = usePreferences();

  return (
    <div className="plaza-page flex flex-1 flex-col">
      <header className="plaza-room-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-5">
          <span className="plaza-wordmark text-lg">Plaza</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16 pt-8">
        <section className="mb-6 grid justify-items-center gap-3 text-center">
          <p className="plaza-label">{t("lobby.roomCode")}</p>
          <RoomCode code={code} />
          <p className="plaza-muted-2 text-xs">{t("join.invited")}</p>
        </section>

        <form action={formAction} className="plaza-panel flex flex-col gap-4 p-5">
          <h1 className="plaza-display text-xl font-extrabold">{t("join.heading")}</h1>
          <label className="flex flex-col gap-1.5">
            <span className="plaza-muted text-xs font-medium">{t("form.nickname")}</span>
            <input
              name="nickname"
              required
              autoFocus
              maxLength={20}
              autoComplete="off"
              placeholder={t("form.nicknamePlaceholder")}
              className="plaza-input rounded-lg px-3 py-2 text-base"
            />
          </label>
          <input type="hidden" name="code" value={code} />
          <SubmitButton>{t("join.cta")}</SubmitButton>
          {state?.error && (
            <p className="text-sm text-[var(--plaza-danger)]">{localizeError(state.error)}</p>
          )}
        </form>
      </main>
    </div>
  );
}
