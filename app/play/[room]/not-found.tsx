"use client";

import Link from "next/link";
import { usePreferences } from "@/components/preferences-provider";

export default function RoomNotFound() {
  const { t } = usePreferences();

  return (
    <div className="plaza-page flex flex-1 flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <p className="plaza-muted mt-2">
        {t("notFound.body")}
      </p>
      <Link
        href="/"
        className="plaza-button mt-6 rounded-lg px-4 py-2 text-sm font-medium"
      >
        {t("notFound.back")}
      </Link>
    </div>
  );
}
