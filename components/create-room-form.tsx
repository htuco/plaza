"use client";

import { useActionState } from "react";
import { createRoomAction } from "@/app/actions";
import { usePreferences } from "./preferences-provider";
import { SubmitButton } from "./submit-button";

type State = { error?: string } | undefined;

async function action(_prev: State, formData: FormData): Promise<State> {
  return createRoomAction(formData);
}

export function CreateRoomForm() {
  const [state, formAction] = useActionState<State, FormData>(action, undefined);
  const { localizeError, t } = usePreferences();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="plaza-muted text-xs font-medium">{t("form.nickname")}</span>
        <input
          name="nickname"
          required
          maxLength={20}
          autoComplete="off"
          placeholder={t("form.nicknamePlaceholder")}
          className="plaza-input rounded-lg px-3 py-2 text-base"
        />
      </label>
      <SubmitButton>{t("form.startRoom")}</SubmitButton>
      {state?.error && (
        <p className="text-sm text-[var(--plaza-danger)]">{localizeError(state.error)}</p>
      )}
    </form>
  );
}
