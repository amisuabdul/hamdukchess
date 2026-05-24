// Lightweight theme controller. Persists choice in localStorage and applies
// `.dark` to <html>. Defaults to system preference.

export type Theme = "light" | "dark" | "system";

const KEY = "hamduk:theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  return ((localStorage.getItem(KEY) as Theme | null) ?? "system");
}

export function resolveTheme(t: Theme): "light" | "dark" {
  return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(t);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function setTheme(t: Theme) {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, t);
  applyTheme(t);
}

export function initTheme() {
  applyTheme(getStoredTheme());
  if (typeof window !== "undefined") {
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
      if (getStoredTheme() === "system") applyTheme("system");
    });
  }
}
