"use client";

import Link from "next/link";
import { usePreferences } from "@/components/preferences-provider";

export default function RoomNotFound() {
  const { t } = usePreferences();

  return (
    <div className="plaza-page flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <div className="plaza-panel grid w-full max-w-sm justify-items-center gap-2 p-8">
        <span className="text-4xl" aria-hidden="true">
          🪑
        </span>
        <h1 className="plaza-display mt-2 text-2xl font-extrabold">{t("notFound.title")}</h1>
        <p className="plaza-muted">{t("notFound.body")}</p>
        <Link
          href="/"
          className="plaza-button mt-4 rounded-xl px-6 py-3 text-sm font-bold"
        >
          {t("notFound.back")}
        </Link>
      </div>
    </div>
  );
}
