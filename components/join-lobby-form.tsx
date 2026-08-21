"use client";

import { useActionState } from "react";
import { joinRoomAction } from "@/app/actions";
import { usePreferences } from "./preferences-provider";
import { LanguageSwitcher } from "./preferences-switcher";
import { RoomCode } from "./room-code";
import { RoomBody, RoomContent, RoomScreen, RoomTopBar } from "./room-shell";
import { SubmitButton } from "./submit-button";

type State = { error?: string } | undefined;

async function action(_prev: State, formData: FormData): Promise<State> {
  return joinRoomAction(formData);
}

// 01 · Ulazak preko linka — someone opens a shared room link but hasn't joined
// yet. The code is already known, so the screen is one centred column: the code
// as the hero, then a single card asking for a name.
export function JoinLobbyForm({ code }: { code: string }) {
  const [state, formAction] = useActionState<State, FormData>(action, undefined);
  const { localizeError, t } = usePreferences();

  return (
    <RoomScreen>
      <RoomTopBar>
        <span className="plaza-display text-[1.0625rem] font-extrabold">Plaza</span>
        <LanguageSwitcher />
      </RoomTopBar>

      <RoomBody center>
        <RoomContent className="gap-7 px-6 pb-10 pt-8">
          <section className="grid justify-items-center gap-3.5 text-center">
            <p className="rm-eyebrow">{t("lobby.roomCode")}</p>
            <RoomCode code={code} size="lg" />
            <p className="plaza-muted text-xs">{t("join.invitedShort")}</p>
          </section>

          <form action={formAction} className="plaza-panel grid gap-[1.125rem] rounded-[1.25rem] p-[1.375rem]">
            <h1 className="plaza-display text-[1.1875rem] font-extrabold">{t("join.heading")}</h1>

            <label className="grid gap-2">
              <span className="rm-eyebrow">{t("form.nickname")}</span>
              <input
                name="nickname"
                required
                autoFocus
                maxLength={20}
                autoComplete="off"
                placeholder={t("form.nicknamePlaceholder")}
                className="plaza-input h-13 rounded-[0.875rem] px-4 text-base"
              />
              <span className="plaza-muted-2 text-[0.69rem]">{t("join.nicknameHelper")}</span>
            </label>

            <input type="hidden" name="code" value={code} />
            <SubmitButton>{t("join.cta")}</SubmitButton>

            {state?.error && (
              <p className="plaza-error rounded-xl px-3 py-2 text-sm font-medium">
                {localizeError(state.error)}
              </p>
            )}
          </form>
        </RoomContent>
      </RoomBody>
    </RoomScreen>
  );
}
