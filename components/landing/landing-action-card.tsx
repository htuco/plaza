"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { createRoomAction, joinRoomAction } from "@/app/actions";
import { usePreferences } from "@/components/preferences-provider";
import { SubmitButton } from "@/components/submit-button";
import { CodeTileInput } from "@/components/landing/letter-tiles";
import { InteractiveDice } from "@/components/landing/interactive-dice";

type ActionState = { error?: string } | undefined;

async function createAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return createRoomAction(formData);
}

async function joinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return joinRoomAction(formData);
}

/**
 * The create/join flow as a physical invitation card lying on the table.
 * Same form semantics as before — one form posting `nickname` (+ `code` for
 * the join submit button) — but the join code is typed onto wooden letter
 * tiles and the garnish die in the corner actually rolls.
 */
export function LandingActionCard({
  actionTitle,
  joinPrompt,
}: {
  actionTitle: string;
  joinPrompt: string;
}) {
  const [nickname, setNickname] = useState("");
  const [createState, createFormAction] = useActionState<ActionState, FormData>(
    createAction,
    undefined,
  );
  const [joinState, joinFormAction] = useActionState<ActionState, FormData>(joinAction, undefined);
  const { localizeError, t } = usePreferences();

  return (
    <form action={createFormAction} className="plaza-action-panel mt-8 p-4 sm:p-5">
      {/* Garnish cluster — the card is decoration, the die really rolls. */}
      <span className="plaza-panel-garnish">
        <span
          className="plaza-piece plaza-piece-card"
          aria-hidden="true"
          style={{ "--piece-rot": "9deg" } as CSSProperties}
        />
        <InteractiveDice size="sm" className="plaza-panel-garnish__dice" />
      </span>
      <p className="plaza-action-panel__title mb-3">{actionTitle}</p>
      <label className="flex flex-col gap-2">
        <span className="plaza-muted text-sm font-semibold">{t("form.nickname")}</span>
        <input
          name="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          maxLength={20}
          autoComplete="off"
          placeholder={t("form.nicknamePlaceholder")}
          className="plaza-input h-12 rounded-xl px-4 text-base"
        />
      </label>

      <div className="plaza-action-row mt-3">
        <div className="plaza-action-primary flex flex-col gap-2">
          <SubmitButton>{t("form.startRoom")}</SubmitButton>
          {createState?.error && (
            <p className="text-sm text-[var(--plaza-danger)]">
              {localizeError(createState.error)}
            </p>
          )}
        </div>

        <div className="plaza-join-strip p-2">
          <label className="sr-only" htmlFor="home-room-code">
            {t("form.roomCode")}
          </label>
          <span className="px-2 text-sm font-bold text-[var(--plaza-muted)]">{joinPrompt}</span>
          <CodeTileInput id="home-room-code" name="code" />
          <button
            type="submit"
            formAction={joinFormAction}
            className="plaza-button-secondary h-11 rounded-lg px-4 text-sm font-bold"
          >
            {t("form.join")}
          </button>
          {joinState?.error && (
            <p className="w-full px-2 pt-1 text-sm text-[var(--plaza-danger)]">
              {localizeError(joinState.error)}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
