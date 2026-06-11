"use client";

import { usePreferences, type LanguagePreference, type ThemePreference } from "./preferences-provider";

export function PreferencesSwitcher() {
  const { theme, language, setTheme, setLanguage, t } = usePreferences();

  return (
    <div className="plaza-preferences flex flex-wrap justify-end gap-2 text-xs">
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
      role="group"
      aria-label={label}
      className="plaza-segmented-control flex items-center p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            title={`${label}: ${option.label}`}
            className={`plaza-segmented-control__option ${
              active
                ? "plaza-segmented-control__option--active"
                : "plaza-segmented-control__option--idle"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
