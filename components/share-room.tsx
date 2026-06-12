"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { usePreferences } from "./preferences-provider";

// Inline icons — keeps the bundle dependency-free and lets them inherit color.
function ShareIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3" />
      <path d="M21 14v.01" />
      <path d="M14 21h3" />
      <path d="M21 17v4" />
    </svg>
  );
}

// Sharing a room. The primary button opens the device's native share sheet
// (the iOS/Android sheet where you pick WhatsApp, Messages, etc.). A secondary
// button opens our own dialog with a QR code + copy-link for desktop or for
// scanning across the table.
export function ShareRoom({ code }: { code: string }) {
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

  // Render the QR once we know the URL and the dialog is open (lazy — no work otherwise).
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

  // Close on Escape and lock body scroll while the dialog is up.
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

  // Primary action: native sheet where it exists, our dialog where it doesn't.
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

  return (
    <>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleShare}
          className="plaza-share-trigger plaza-share-trigger--primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold"
        >
          <ShareIcon />
          {t("share.button")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="plaza-share-trigger inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold"
        >
          <QrIcon />
          {t("share.qrButton")}
        </button>
      </div>

      {open && (
        <div
          className="plaza-share-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("share.title")}
        >
          <div
            className="plaza-share-sheet w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="plaza-label">{t("share.qrTitle")}</p>
                <p className="plaza-muted mt-1 text-sm">{t("share.qrSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("share.close")}
                className="plaza-share-close shrink-0 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="plaza-share-qr mx-auto mt-5 grid aspect-square w-48 place-items-center rounded-2xl p-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- client-generated data URL
                <img
                  src={qrDataUrl}
                  alt={t("share.qrAlt", code)}
                  className="h-full w-full rounded-lg"
                />
              ) : (
                <span className="plaza-muted-2 text-xs">…</span>
              )}
            </div>

            <p className="plaza-muted-2 mt-3 text-center text-xs">{t("share.scanHint")}</p>

            <div className="plaza-share-link mt-5 flex items-center gap-2 rounded-lg px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-sm" title={shareUrl}>
                {shareUrl.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="plaza-share-copy shrink-0 rounded-md px-2.5 py-1 text-xs font-bold"
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
                className="plaza-button mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold"
              >
                <ShareIcon />
                {t("share.shareVia")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
