"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { shouldRefetchGameEvent, subscribeToRoom } from "@/lib/realtime/channels";
import { createClient } from "@/lib/supabase/client";

const FALLBACK_ERROR = "Something went wrong.";

export async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : FALLBACK_ERROR;
  } catch {
    return FALLBACK_ERROR;
  }
}

export type IntentResult<S> = { ok: true; snapshot: S } | { ok: false; message: string };

export type SendIntentOptions = {
  // false: the caller handles the failure message itself (e.g. "Wrong guess." flashes).
  showError?: boolean;
  // false: background request (deadline nudge) that must not disable the UI.
  trackSending?: boolean;
};

// Everything a game client shares with the room: loading its redacted snapshot,
// sending intents, following realtime pings, and leaving when the room finishes.
export function useGameRoom<S extends { updatedAt: string }, I>({
  roomCode,
  gameId,
  onSnapshot,
}: {
  roomCode: string;
  gameId: string;
  // Runs on every snapshot the client accepts, before it is stored (transition effects).
  onSnapshot?: (snapshot: S) => void;
}) {
  const router = useRouter();
  const { localizeError } = usePreferences();
  const [snapshot, setSnapshot] = useState<S | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const roomPath = `/api/rooms/${encodeURIComponent(roomCode)}`;

  const onSnapshotRef = useRef(onSnapshot);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  // Freshest server state we hold, so realtime pings we already have can skip a refetch.
  const latestUpdatedAt = useRef<string | null>(null);

  const applySnapshot = useCallback((data: S) => {
    latestUpdatedAt.current = data.updatedAt;
    onSnapshotRef.current?.(data);
    setSnapshot(data);
    setError(null);
  }, []);

  // One load at a time; pings arriving mid-load queue a single follow-up.
  const loadInFlight = useRef(false);
  const reloadQueued = useRef(false);

  const loadState = useCallback(async () => {
    if (loadInFlight.current) {
      reloadQueued.current = true;
      return;
    }
    loadInFlight.current = true;
    try {
      do {
        reloadQueued.current = false;
        const response = await fetch(`${roomPath}/state`, { cache: "no-store" });
        if (!response.ok) {
          setError(localizeError(await readError(response)));
          continue;
        }
        applySnapshot((await response.json()) as S);
      } while (reloadQueued.current);
    } catch {
      setError(localizeError(FALLBACK_ERROR));
    } finally {
      loadInFlight.current = false;
    }
  }, [applySnapshot, localizeError, roomPath]);

  // POST to a room endpoint that answers with a fresh snapshot.
  const request = useCallback(
    async (
      path: string,
      body: unknown,
      { showError = true, trackSending = true }: SendIntentOptions = {},
    ): Promise<IntentResult<S>> => {
      if (trackSending) setPendingCount((count) => count + 1);
      try {
        const response = await fetch(`${roomPath}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        if (!response.ok) {
          const message = await readError(response);
          if (showError) setError(localizeError(message));
          return { ok: false, message };
        }
        const data = (await response.json()) as S;
        applySnapshot(data);
        return { ok: true, snapshot: data };
      } catch {
        if (showError) setError(localizeError(FALLBACK_ERROR));
        return { ok: false, message: FALLBACK_ERROR };
      } finally {
        if (trackSending) setPendingCount((count) => count - 1);
      }
    },
    [applySnapshot, localizeError, roomPath],
  );

  const sendIntent = useCallback(
    (intent: I, options?: SendIntentOptions) => request("intent", { gameId, intent }, options),
    [gameId, request],
  );

  const finishSession = useCallback(async () => {
    setPendingCount((count) => count + 1);
    try {
      const response = await fetch(`${roomPath}/finish`, { method: "POST" });
      if (!response.ok) {
        setError(localizeError(await readError(response)));
        return;
      }
      router.replace("/");
    } finally {
      setPendingCount((count) => count - 1);
    }
  }, [localizeError, roomPath, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadState(), 0);
    return () => window.clearTimeout(timer);
  }, [loadState]);

  useEffect(() => {
    const supabase = createClient();
    const channel = subscribeToRoom(supabase, roomCode, (event) => {
      if (event.type === "state") {
        const payload = event.payload as { status?: unknown; target?: unknown };
        if (payload.status === "finished") {
          router.replace(typeof payload.target === "string" ? payload.target : "/");
        }
        return;
      }
      if (event.type === "game-event") {
        if (shouldRefetchGameEvent(event.payload, gameId, latestUpdatedAt.current)) {
          void loadState();
        }
        return;
      }
      // lobby-update: someone joined/left, so the player list in the snapshot changed.
      void loadState();
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, loadState, roomCode, router]);

  return {
    snapshot,
    error,
    setError,
    isSending: pendingCount > 0,
    loadState,
    applySnapshot,
    request,
    sendIntent,
    finishSession,
  };
}
