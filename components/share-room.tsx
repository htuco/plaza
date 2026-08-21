"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { usePreferences } from "./preferences-provider";
import { CloseIcon, QrIcon, ShareIcon } from "./room-icons";

// Sharing a room. Share + QR are the lobby's primary action pair, so they sit
// side by side: the solid button opens the device's native share sheet, the
// outlined one opens our own sheet with a real QR and a copyable link.
//
// `variant` matches the two placements in the redesign: the host's 40px hero
// pair, and the 34px pair in the guest lobby's compact code row.
export function ShareRoom({
  code,
  variant = "hero",
}: {
  code: string;
  variant?: "hero" | "compact";
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived client-only values — computed lazily during render (no effect/setState),
  // so they're ready on the client's first paint. The link points at the room; a
  // non-player landing there gets the join screen.
  const [shareUrl] = useState(() =>
    typeof window === "undefined" ? "" : `${window.location.origin}/play/${code}`,
  );
  const [canNativeShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );

  // Render the QR once we know the URL and the sheet is open (lazy — no work otherwise).
  useEffect(() => {
    if (!open || !shareUrl) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 480,
      margin: 1,
      color: { dark: "#2a1d12", light: "#f3e4cb" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [open, shareUrl]);

  // Close on Escape and lock body scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: t("share.title"),
        text: t("share.text", code),
        url: shareUrl,
      });
    } catch {
      // User dismissed the share sheet, or it's unsupported — no-op.
    }
  }

  // Primary action: native sheet where it exists, our sheet where it doesn't.
  function handleShare() {
    if (canNativeShare) {
      void nativeShare();
    } else {
      setOpen(true);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the link is selectable in the field below.
    }
  }

  const compact = variant === "compact";
  const buttonSize = compact
    ? "h-[2.125rem] rounded-[0.625rem] px-3 text-xs"
    : "h-10 rounded-xl px-[1.125rem] text-[0.84rem]";

  return (
    <>
      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          onClick={handleShare}
          className={`plaza-share-trigger plaza-share-trigger--primary rm-action ${buttonSize}`}
        >
          <ShareIcon size={compact ? 14 : 16} />
          {t("share.button")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`plaza-share-trigger rm-action ${buttonSize}`}
        >
          <QrIcon size={compact ? 14 : 16} />
          {compact ? t("share.qrShort") : t("share.qrButton")}
        </button>
      </div>

      {open && (
        <div
          className="plaza-share-overlay fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("share.inviteTitle")}
        >
          <div
            className="plaza-share-sheet mx-2.5 mb-2.5 grid w-full max-w-[24.4rem] gap-[1.125rem] rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="plaza-display text-[1.125rem] font-extrabold">
                  {t("share.inviteTitle")}
                </p>
                <p className="plaza-muted text-[0.78rem]">{t("share.inviteSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("share.close")}
                className="rm-icon-button"
              >
                <CloseIcon />
              </button>
            </div>

            {/* The QR is for scanning across the table; the code is repeated
                underneath so it can also just be read out loud. */}
            <div className="grid justify-items-center gap-3">
              <div className="plaza-share-qr grid h-[12.875rem] w-[12.875rem] place-items-center rounded-[1.25rem] p-3">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-generated data URL
                  <img
                    src={qrDataUrl}
                    alt={t("share.qrAlt", code)}
                    className="h-full w-full rounded-xl"
                  />
                ) : (
                  <span className="plaza-muted-2 text-xs">…</span>
                )}
              </div>
              <span className="rm-numeric text-[0.94rem] font-bold tracking-[0.2em]">{code}</span>
            </div>

            <div className="plaza-share-link flex items-center gap-2.5 rounded-xl px-3 py-2.5">
              <span className="rm-numeric min-w-0 flex-1 truncate text-[0.78rem]" title={shareUrl}>
                {shareUrl.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="plaza-share-copy shrink-0 rounded-lg px-2.5 py-1.5 text-[0.69rem] font-extrabold"
              >
                {copied ? t("share.copied") : t("share.copy")}
              </button>
            </div>

            {canNativeShare && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void nativeShare();
                }}
                className="plaza-button rm-cta"
              >
                <ShareIcon />
                {t("share.shareViaCta")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
