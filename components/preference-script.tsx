const THEME_KEY = "plaza-theme";
const LANGUAGE_KEY = "plaza-language";

export function PreferenceScript() {
  const code = `
(() => {
  try {
    const storedTheme = localStorage.getItem("${THEME_KEY}");
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;

    const storedLanguage = localStorage.getItem("${LANGUAGE_KEY}");
    const firstLanguage = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    const language = storedLanguage === "en" || storedLanguage === "bs"
      ? storedLanguage
      : (firstLanguage.toLowerCase().startsWith("bs") ? "bs" : "en");
    document.documentElement.lang = language;
  } catch {}
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
