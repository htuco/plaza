"use client";

import { usePreferences, type LanguagePreference, type ThemePreference } from "./preferences-provider";

export function PreferencesSwitcher() {
  const { theme, language, setTheme, setLanguage, t } = usePreferences();

  return (
    <div className="fixed right-3 top-3 z-50 flex flex-wrap justify-end gap-2 text-xs">
      <SegmentedControl
        label={t("prefs.theme")}
        value={theme}
        options={[
          { value: "light", label: t("prefs.light") },
          { value: "dark", label: t("prefs.dark") },
        ]}
        onChange={(value) => setTheme(value as ThemePreference)}
      />
      <SegmentedControl
        label={t("prefs.language")}
        value={language}
        options={[
          { value: "en", label: "EN" },
          { value: "bs", label: "BS" },
        ]}
        onChange={(value) => setLanguage(value as LanguagePreference)}
      />
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div
      aria-label={label}
      className="plaza-card flex h-9 items-center rounded-lg p-0.5 shadow-sm"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-md px-2.5 font-medium transition-colors ${
              active
                ? "bg-[var(--foreground)] text-[var(--plaza-canvas)]"
                : "text-[var(--plaza-muted)] hover:bg-[var(--plaza-surface-2)] hover:text-[var(--foreground)]"
            }`}
            title={label}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
